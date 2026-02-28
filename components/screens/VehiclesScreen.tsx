import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  RefreshControl,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { modalStyles } from '@/components/ui/modalStyles';
import { SkeletonList } from '@/components/ui/SkeletonLoader';
import { useLocale } from '@/context/LocaleContext';
import { useAuth } from '@/context/AuthContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useToast } from '@/context/ToastContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { colors } from '@/theme/tokens';
import { generateId } from '@/lib/id';
import type { Vehicle as VehicleType, VehicleType as VType, VehicleStatus } from '@/types';
import { Truck, Cog, Pencil, CheckCircle, Circle, Download } from 'lucide-react-native';

type FilterType = 'all' | 'truck' | 'machine';
type StatusFilter = 'active' | 'all';

const CAN_ADD_VEHICLE_ROLES = ['admin', 'owner', 'head_supervisor'] as const;

export function VehiclesScreen() {
  const { t } = useLocale();
  const { user } = useAuth();
  const theme = useResponsiveTheme();
  const {
    sites,
    vehicles,
    driverVehicleAssignments,
    addVehicle,
    updateVehicle,
    refetch,
    syncFromWebsiteVehicles,
    loading,
  } = useMockAppStore();
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [syncingFromWebsite, setSyncingFromWebsite] = useState(false);

  const [filter, setFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editVehicle, setEditVehicle] = useState<VehicleType | null>(null);
  const [addType, setAddType] = useState<VType>('truck');
  const [siteId, setSiteId] = useState<string>(sites[0]?.id ?? '');
  const FREE_SITE_KEY = '';
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [mileageKmPerLitre, setMileageKmPerLitre] = useState('');
  const [hoursPerLitre, setHoursPerLitre] = useState('');
  const [capacityTons, setCapacityTons] = useState('');
  const [tankCapacity, setTankCapacity] = useState('');
  const [fuelBalance, setFuelBalance] = useState('');
  const [healthInputs, setHealthInputs] = useState('');
  const [idealConsumptionRange, setIdealConsumptionRange] = useState('');
  const [idealWorkingRange, setIdealWorkingRange] = useState('');
  const [editStatus, setEditStatus] = useState<VehicleStatus>('active');
  /** Machine: display/edit as L/h (litres per hour). Stored as hours_per_litre = 1/Lh. */
  const [machineLh, setMachineLh] = useState('');

  // Allocated = vehicle id appears in any driver assignment for that site (real-time from driver_vehicle_assignments)
  const allocatedBySite = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const a of driverVehicleAssignments) {
      if (!map[a.siteId]) map[a.siteId] = new Set();
      for (const vid of a.vehicleIds ?? []) {
        map[a.siteId].add(vid);
      }
    }
    return map;
  }, [driverVehicleAssignments]);

  const isAllocated = (siteId: string, vehicleId: string) =>
    allocatedBySite[siteId]?.has(vehicleId) ?? false;

  const byStatus =
    statusFilter === 'active'
      ? vehicles.filter((v) => (v.status ?? 'active') === 'active')
      : vehicles;

  const filtered =
    filter === 'all'
      ? byStatus
      : byStatus.filter((v) => v.type === filter);

  const bySite = useMemo(
    () =>
      filtered.reduce<Record<string, VehicleType[]>>((acc, v) => {
        const key = v.siteId ?? FREE_SITE_KEY;
        if (!acc[key]) acc[key] = [];
        acc[key].push(v);
        return acc;
      }, {}),
    [filtered]
  );

  const canAdd = user && CAN_ADD_VEHICLE_ROLES.includes(user.role as (typeof CAN_ADD_VEHICLE_ROLES)[number]);

  const openAdd = (type: VType) => {
    setAddType(type);
    setSiteId(FREE_SITE_KEY);
    setVehicleNumber('');
    setMileageKmPerLitre('');
    setHoursPerLitre('');
    setMachineLh('');
    setCapacityTons('');
    setTankCapacity('');
    setFuelBalance('0');
    setHealthInputs('');
    setIdealConsumptionRange('');
    setIdealWorkingRange('');
    setAddModalVisible(true);
  };

  const openEdit = (v: VehicleType) => {
    setEditVehicle(v);
    setSiteId(v.siteId ?? FREE_SITE_KEY);
    setVehicleNumber(v.vehicleNumberOrId);
    setMileageKmPerLitre(v.mileageKmPerLitre != null ? String(v.mileageKmPerLitre) : '');
    setHoursPerLitre(v.hoursPerLitre != null ? String(v.hoursPerLitre) : '');
    setMachineLh(v.hoursPerLitre != null && v.hoursPerLitre > 0 ? String(1 / v.hoursPerLitre) : '');
    setCapacityTons(v.capacityTons != null ? String(v.capacityTons) : '');
    setTankCapacity(String(v.tankCapacityLitre));
    setFuelBalance(String(v.fuelBalanceLitre));
    setHealthInputs(v.healthInputs ?? '');
    setIdealConsumptionRange(v.idealConsumptionRange ?? '');
    setIdealWorkingRange(v.idealWorkingRange ?? '');
    setEditStatus(v.status ?? 'active');
    setAddType(v.type);
  };

  const closeEdit = () => {
    setEditVehicle(null);
  };

  const submitAdd = async () => {
    const capacity = parseFloat(tankCapacity);
    if (!vehicleNumber.trim() || isNaN(capacity) || capacity <= 0) return;
    const assignedSiteId = siteId === FREE_SITE_KEY ? undefined : siteId;
    try {
      if (addType === 'truck') {
        const mileage = parseFloat(mileageKmPerLitre);
        if (isNaN(mileage) || mileage <= 0) return;
        await addVehicle({
          id: generateId('v'),
          siteId: assignedSiteId,
          type: 'truck',
          vehicleNumberOrId: vehicleNumber.trim(),
          mileageKmPerLitre: mileage,
          capacityTons: capacityTons.trim() ? parseFloat(capacityTons) : undefined,
          tankCapacityLitre: capacity,
          fuelBalanceLitre: 0,
          idealConsumptionRange: idealConsumptionRange.trim() || undefined,
          healthInputs: healthInputs.trim() || undefined,
          status: 'active',
        });
      } else {
        const lh = parseFloat(machineLh || hoursPerLitre);
        if (isNaN(lh) || lh <= 0) return;
        const hours = 1 / lh;
        await addVehicle({
          id: generateId('v'),
          siteId: assignedSiteId,
          type: 'machine',
          vehicleNumberOrId: vehicleNumber.trim(),
          hoursPerLitre: hours,
          tankCapacityLitre: capacity,
          fuelBalanceLitre: 0,
          idealWorkingRange: idealWorkingRange.trim() || undefined,
          status: 'active',
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAddModalVisible(false);
      showToast(addType === 'truck' ? t('vehicles_toast_added_truck') : t('vehicles_toast_added_machine'));
    } catch (e) {
      const message = (e && typeof e === 'object' && 'message' in e ? (e as { message: string }).message : null) || t('vehicles_add_failed');
      Alert.alert(t('alert_error'), message);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const onSyncFromWebsite = async () => {
    if (syncingFromWebsite) return;
    setSyncingFromWebsite(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { syncedCount } = await syncFromWebsiteVehicles();
      if (syncedCount === 0) {
        showToast(t('vehicles_sync_toast_none'));
      } else {
        showToast(t('vehicles_sync_toast_count').replace('{{count}}', String(syncedCount)));
      }
    } catch (e) {
      const message = (e && typeof e === 'object' && 'message' in e ? (e as { message: string }).message : null) || t('vehicles_sync_failed');
      showToast(message);
    } finally {
      setSyncingFromWebsite(false);
    }
  };

  const submitEdit = async () => {
    if (!editVehicle) return;
    const capacity = parseFloat(tankCapacity);
    const balance = parseFloat(fuelBalance);
    if (!vehicleNumber.trim() || isNaN(capacity) || capacity <= 0) return;
    if (isNaN(balance) || balance < 0) return;
    const assignedSiteId = siteId === FREE_SITE_KEY ? undefined : siteId;
    try {
      const patch: Partial<VehicleType> = {
        siteId: assignedSiteId,
        vehicleNumberOrId: vehicleNumber.trim(),
        tankCapacityLitre: capacity,
        fuelBalanceLitre: balance,
        idealConsumptionRange: idealConsumptionRange.trim() || undefined,
        healthInputs: healthInputs.trim() || undefined,
        idealWorkingRange: idealWorkingRange.trim() || undefined,
        status: editStatus,
      };
      if (addType === 'truck') {
        const mileage = parseFloat(mileageKmPerLitre);
        if (!isNaN(mileage) && mileage > 0) patch.mileageKmPerLitre = mileage;
        if (capacityTons.trim()) {
          const tons = parseFloat(capacityTons);
          if (!isNaN(tons) && tons >= 0) patch.capacityTons = tons;
        }
      } else {
        const lh = parseFloat(machineLh || hoursPerLitre);
        if (!isNaN(lh) && lh > 0) patch.hoursPerLitre = 1 / lh;
      }
      await updateVehicle(editVehicle.id, patch);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeEdit();
      showToast(t('vehicles_toast_saved'));
    } catch (e) {
      const message = (e && typeof e === 'object' && 'message' in e ? (e as { message: string }).message : null) || t('vehicles_edit_failed');
      Alert.alert(t('alert_error'), message);
    }
  };

  const getSiteName = (id: string) =>
    id === FREE_SITE_KEY ? t('vehicles_free_no_site') : (sites.find((s) => s.id === id)?.name ?? id);

  return (
    <View className="flex-1 bg-gray-50">
      <Header
        title={t('vehicles_title')}
        subtitle={t('vehicles_subtitle')}
        rightAction={
          canAdd ? (
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => openAdd('truck')}
                className="bg-blue-600 rounded-lg px-3 py-2 flex-row items-center"
              >
                <Truck size={18} color="#fff" />
                <Text className="text-white font-semibold ml-1">{t('vehicles_add_truck')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => openAdd('machine')}
                className="bg-gray-700 rounded-lg px-3 py-2 flex-row items-center"
              >
                <Cog size={18} color="#fff" />
                <Text className="text-white font-semibold ml-1">{t('vehicles_add_machine')}</Text>
              </TouchableOpacity>
            </View>
          ) : undefined
        }
      />

      <View className="px-4 py-2 border-b border-gray-200 bg-white">
        <View className="flex-row mb-2">
          {(['all', 'truck', 'machine'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              className={`flex-1 py-2 rounded-lg mx-1 ${filter === f ? 'bg-blue-100' : 'bg-gray-100'}`}
            >
              <Text
                className={`text-center font-medium ${filter === f ? 'text-blue-700' : 'text-gray-600'}`}
              >
                {f === 'all' ? t('vehicles_all') : f === 'truck' ? t('vehicles_trucks') : t('vehicles_machines')}
              </Text>
            </Pressable>
          ))}
        </View>
        <View className="flex-row">
          <Pressable
            onPress={() => setStatusFilter('active')}
            className={`flex-1 py-2 rounded-lg mr-1 ${statusFilter === 'active' ? 'bg-green-100' : 'bg-gray-100'}`}
          >
            <Text className={`text-center text-sm font-medium ${statusFilter === 'active' ? 'text-green-700' : 'text-gray-600'}`}>
              {t('vehicles_status_active')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setStatusFilter('all')}
            className={`flex-1 py-2 rounded-lg ${statusFilter === 'all' ? 'bg-gray-200' : 'bg-gray-100'}`}
          >
            <Text className={`text-center text-sm font-medium ${statusFilter === 'all' ? 'text-gray-700' : 'text-gray-600'}`}>
              {t('vehicles_show_inactive')}
            </Text>
          </Pressable>
        </View>
        {canAdd && (
          <TouchableOpacity
            onPress={onSyncFromWebsite}
            disabled={syncingFromWebsite}
            className="flex-row items-center justify-center gap-2 py-2 mt-2 rounded-lg border border-slate-300 bg-slate-50"
          >
            <Download size={16} color="#475569" />
            <Text className="text-sm font-medium text-slate-600">
              {syncingFromWebsite ? t('common_loading') : t('vehicles_sync_from_website')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: theme.screenPadding, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {loading ? (
          <SkeletonList count={6} />
        ) : (
          <>
            {Object.entries(bySite).map(([sid, list]) => (
              <View key={sid} className="mb-4">
                <Text className="text-sm font-semibold text-gray-500 mb-2">{getSiteName(sid)}</Text>
                {list.map((v) => {
                  const allocated = isAllocated(sid, v.id);
                  return (
                    <Pressable key={v.id} onPress={() => openEdit(v)}>
                      <Card className="mb-2">
                        <View className="flex-row items-center justify-between">
                          <View className="flex-1">
                            <View className="flex-row items-center gap-2 flex-wrap">
                              <Text className="font-semibold text-gray-900">{v.vehicleNumberOrId}</Text>
                              <View className={`rounded px-2 py-0.5 ${allocated ? 'bg-amber-100' : 'bg-green-100'}`}>
                                <Text className={`text-xs font-medium ${allocated ? 'text-amber-800' : 'text-green-800'}`}>
                                  {allocated ? t('vehicles_allocated') : t('vehicles_free')}
                                </Text>
                              </View>
                              {(v.status ?? 'active') === 'inactive' && (
                                <View className="rounded px-2 py-0.5 bg-gray-200">
                                  <Text className="text-xs font-medium text-gray-600">{t('vehicles_status_inactive')}</Text>
                                </View>
                              )}
                              <Pencil size={14} color="#64748b" />
                            </View>
                            <Text className="text-xs text-gray-500 capitalize">{v.type}</Text>
                          </View>
                          <View className="items-end">
                            <Text className="text-sm text-gray-700">
                              Tank: {v.tankCapacityLitre} L · {t('vehicles_fuel_balance_label')}: {v.fuelBalanceLitre} L
                            </Text>
                            {v.type === 'truck' && v.mileageKmPerLitre != null && (
                              <Text className="text-xs text-gray-500">{Number(v.mileageKmPerLitre).toFixed(2)} km/L</Text>
                            )}
                            {v.type === 'truck' && v.capacityTons != null && (
                              <Text className="text-xs text-gray-500">{Number(v.capacityTons).toFixed(1)} t</Text>
                            )}
                            {v.type === 'machine' && v.hoursPerLitre != null && v.hoursPerLitre > 0 && (
                              <Text className="text-xs text-gray-500">{((1 / v.hoursPerLitre)).toFixed(2)} L/h</Text>
                            )}
                          </View>
                        </View>
                        {(v.healthInputs || v.idealWorkingRange || v.idealConsumptionRange) && (
                          <View className="mt-2 pt-2 border-t border-gray-100">
                            {v.type === 'truck' && v.healthInputs && (
                              <Text className="text-xs text-gray-600">Health: {v.healthInputs}</Text>
                            )}
                            {v.type === 'truck' && v.idealConsumptionRange && (
                              <Text className="text-xs text-gray-600">Ideal range: {v.idealConsumptionRange}</Text>
                            )}
                            {v.type === 'machine' && v.idealWorkingRange && (
                              <Text className="text-xs text-gray-600">Ideal working range: {v.idealWorkingRange}</Text>
                            )}
                          </View>
                        )}
                      </Card>
                    </Pressable>
                  );
                })}
              </View>
            ))}
            {filtered.length === 0 && (
              <Text className="text-gray-500 text-center py-8">{t('vehicles_no_match')}</Text>
            )}
          </>
        )}
      </ScrollView>

      {/* Add vehicle modal – unified style, keyboard does not close */}
      <Modal visible={addModalVisible} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={modalStyles.overlay}>
            <Pressable style={modalStyles.sheet} onPress={(e) => e.stopPropagation()}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ maxHeight: '100%' }}>
                <Text style={modalStyles.title}>
                  {addType === 'truck' ? t('vehicles_add_truck') : t('vehicles_add_machine')}
                </Text>
                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              <Text style={modalStyles.label}>{t('vehicles_site_label')} ({t('vehicles_site_optional')})</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, paddingRight: 4 }}>
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); setSiteId(FREE_SITE_KEY); }}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: siteId === FREE_SITE_KEY ? colors.primary : colors.gray200 }}
                >
                  <Text style={{ color: siteId === FREE_SITE_KEY ? '#fff' : colors.text, fontWeight: '500' }}>{t('vehicles_free_no_site')}</Text>
                </Pressable>
                {sites.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => { Haptics.selectionAsync(); setSiteId(s.id); }}
                    style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: siteId === s.id ? colors.primary : colors.gray200 }}
                  >
                    <Text style={{ color: siteId === s.id ? '#fff' : colors.text, fontWeight: '500' }} numberOfLines={1}>{s.name}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={modalStyles.label}>{t('vehicles_vehicle_number_id')}</Text>
              <TextInput
                value={vehicleNumber}
                onChangeText={setVehicleNumber}
                placeholder={t('vehicles_number_placeholder')}
                placeholderTextColor={colors.placeholder}
                keyboardType="default"
                autoCapitalize="characters"
                style={[modalStyles.input, { marginBottom: 12 }]}
              />
              {addType === 'truck' ? (
                <>
                  <Text className="text-sm text-gray-600 mb-1">{t('vehicles_mileage_km_litre')}</Text>
                  <TextInput
                    value={mileageKmPerLitre}
                    onChangeText={setMileageKmPerLitre}
                    placeholder={t('vehicles_mileage_placeholder')}
                    keyboardType="decimal-pad"
                    className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
                  />
                  <Text className="text-sm text-gray-600 mb-1">{t('vehicles_ideal_consumption_optional')}</Text>
                  <TextInput
                    value={idealConsumptionRange}
                    onChangeText={setIdealConsumptionRange}
                    placeholder={t('vehicles_range_placeholder')}
                    className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
                  />
                  <Text className="text-sm text-gray-600 mb-1">{t('vehicles_health_optional')}</Text>
                  <TextInput
                    value={healthInputs}
                    onChangeText={setHealthInputs}
                    placeholder={t('vehicles_health_placeholder')}
                    className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
                  />
                </>
              ) : (
                <>
                  <Text className="text-sm text-gray-600 mb-1">{t('vehicles_machine_fuel_label')}</Text>
                  <TextInput
                    value={machineLh}
                    onChangeText={(text) => { setMachineLh(text); const n = parseFloat(text); if (!isNaN(n) && n > 0) setHoursPerLitre(String(1 / n)); }}
                    placeholder="e.g. 5"
                    keyboardType="decimal-pad"
                    className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
                  />
                  <Text className="text-sm text-gray-600 mb-1">{t('vehicles_ideal_working_optional')}</Text>
                  <TextInput
                    value={idealWorkingRange}
                    onChangeText={setIdealWorkingRange}
                    placeholder={t('vehicles_hours_range_placeholder')}
                    className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
                  />
                </>
              )}
              <Text className="text-sm text-gray-600 mb-1">{t('vehicles_tank_capacity_label')}</Text>
              <TextInput
                value={tankCapacity}
                onChangeText={setTankCapacity}
                placeholder={t('vehicles_tank_placeholder')}
                keyboardType="decimal-pad"
                className="border border-gray-300 rounded-lg px-3 py-2 mb-4 bg-white"
              />
                </ScrollView>
                <View style={modalStyles.footer}>
                  <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setAddModalVisible(false); }} style={[modalStyles.btn, modalStyles.btnSecondary]}>
                    <Text style={modalStyles.btnTextSecondary}>{t('common_cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={submitAdd} style={[modalStyles.btn, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{t('common_add')}</Text>
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </Pressable>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Edit vehicle modal – unified style */}
      <Modal visible={!!editVehicle} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={modalStyles.overlay}>
            <Pressable style={modalStyles.sheet} onPress={(e) => e.stopPropagation()}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ maxHeight: '100%' }}>
                <Text style={modalStyles.title}>{t('vehicles_edit_title')}</Text>
                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              <Text className="text-sm text-gray-600 mb-1">{t('vehicles_site_label')} ({t('vehicles_site_optional')})</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, paddingRight: 4 }}>
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); setSiteId(FREE_SITE_KEY); }}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: siteId === FREE_SITE_KEY ? colors.primary : colors.gray200 }}
                >
                  <Text style={{ color: siteId === FREE_SITE_KEY ? '#fff' : colors.text, fontWeight: '500' }}>{t('vehicles_free_no_site')}</Text>
                </Pressable>
                {sites.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => { Haptics.selectionAsync(); setSiteId(s.id); }}
                    style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: siteId === s.id ? colors.primary : colors.gray200 }}
                  >
                    <Text style={{ color: siteId === s.id ? '#fff' : colors.text, fontWeight: '500' }} numberOfLines={1}>{s.name}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={modalStyles.label}>{t('vehicles_vehicle_number_id')}</Text>
              <TextInput
                value={vehicleNumber}
                onChangeText={setVehicleNumber}
                placeholder={t('vehicles_number_placeholder')}
                placeholderTextColor={colors.placeholder}
                keyboardType="default"
                autoCapitalize="characters"
                style={[modalStyles.input, { marginBottom: 12 }]}
              />
              {addType === 'truck' ? (
                <>
                  <Text className="text-sm text-gray-600 mb-1">{t('vehicles_mileage_km_litre')}</Text>
                  <TextInput
                    value={mileageKmPerLitre}
                    onChangeText={setMileageKmPerLitre}
                    placeholder={t('vehicles_mileage_placeholder')}
                    keyboardType="decimal-pad"
                    className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
                  />
                  <Text className="text-sm text-gray-600 mb-1">{t('vehicles_capacity_tons_label')}</Text>
                  <TextInput
                    value={capacityTons}
                    onChangeText={setCapacityTons}
                    placeholder={t('vehicles_capacity_tons_placeholder')}
                    keyboardType="decimal-pad"
                    className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
                  />
                  <Text className="text-sm text-gray-600 mb-1">{t('vehicles_ideal_consumption_optional')}</Text>
                  <TextInput
                    value={idealConsumptionRange}
                    onChangeText={setIdealConsumptionRange}
                    placeholder={t('vehicles_range_placeholder')}
                    className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
                  />
                  <Text className="text-sm text-gray-600 mb-1">{t('vehicles_health_optional')}</Text>
                  <TextInput
                    value={healthInputs}
                    onChangeText={setHealthInputs}
                    placeholder={t('vehicles_health_placeholder')}
                    className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
                  />
                </>
              ) : (
                <>
                  <Text className="text-sm text-gray-600 mb-1">{t('vehicles_machine_fuel_label')}</Text>
                  <TextInput
                    value={machineLh}
                    onChangeText={(text) => { setMachineLh(text); const n = parseFloat(text); if (!isNaN(n) && n > 0) setHoursPerLitre(String(1 / n)); }}
                    placeholder="e.g. 5"
                    keyboardType="decimal-pad"
                    className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
                  />
                  <Text className="text-sm text-gray-600 mb-1">{t('vehicles_ideal_working_optional')}</Text>
                  <TextInput
                    value={idealWorkingRange}
                    onChangeText={setIdealWorkingRange}
                    placeholder={t('vehicles_hours_range_placeholder')}
                    className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
                  />
                </>
              )}
              <Text className="text-sm text-gray-600 mb-1">{t('vehicles_tank_capacity_label')}</Text>
              <TextInput
                value={tankCapacity}
                onChangeText={setTankCapacity}
                placeholder={t('vehicles_tank_placeholder')}
                keyboardType="decimal-pad"
                className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
              />
              <Text className="text-sm text-gray-600 mb-1">{t('vehicles_fuel_balance_label')}</Text>
              <TextInput
                value={fuelBalance}
                onChangeText={setFuelBalance}
                placeholder="0"
                keyboardType="decimal-pad"
                className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
              />
              <Text className="text-sm text-gray-600 mb-2">{t('vehicles_status_label')}</Text>
              <View className="flex-row gap-2 mb-4">
                <Pressable
                  onPress={() => setEditStatus('active')}
                  className={`flex-1 flex-row items-center justify-center py-3 rounded-lg border ${editStatus === 'active' ? 'bg-green-100 border-green-500' : 'bg-gray-50 border-gray-200'}`}
                >
                  <CheckCircle size={20} color={editStatus === 'active' ? '#059669' : '#94a3b8'} />
                  <Text className={`ml-2 font-medium ${editStatus === 'active' ? 'text-green-700' : 'text-gray-600'}`}>
                    {t('vehicles_status_active')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setEditStatus('inactive')}
                  className={`flex-1 flex-row items-center justify-center py-3 rounded-lg border ${editStatus === 'inactive' ? 'bg-gray-200 border-gray-500' : 'bg-gray-50 border-gray-200'}`}
                >
                  <Circle size={20} color={editStatus === 'inactive' ? '#475569' : '#94a3b8'} />
                  <Text className={`ml-2 font-medium ${editStatus === 'inactive' ? 'text-gray-700' : 'text-gray-600'}`}>
                    {t('vehicles_status_inactive')}
                  </Text>
                </Pressable>
              </View>
                </ScrollView>
                <View style={modalStyles.footer}>
                  <TouchableOpacity onPress={() => { Haptics.selectionAsync(); closeEdit(); }} style={[modalStyles.btn, modalStyles.btnSecondary]}>
                    <Text style={modalStyles.btnTextSecondary}>{t('common_cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={submitEdit} style={[modalStyles.btn, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{t('common_save')}</Text>
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </Pressable>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}
