import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, RefreshControl, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Header,
  SegmentedControl,
  FilterChips,
  ListCard,
  FormModal,
  Input,
  ScreenContainer,
  SkeletonList,
  EmptyState,
} from '@/components/ui';
import { useLocale } from '@/context/LocaleContext';
import { useAuth } from '@/context/AuthContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useToast } from '@/context/ToastContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Vehicle as VehicleType, VehicleType as VType, VehicleStatus } from '@/types';
import { Pencil, CheckCircle, Circle, Download } from 'lucide-react-native';

type FilterType = 'all' | 'truck' | 'machine';
type StatusFilter = 'active' | 'all';

const CAN_SYNC_AND_EDIT_VEHICLE_ROLES = ['admin', 'owner', 'head_supervisor'] as const;

const TYPE_OPTIONS = [
  { value: 'all' as const, labelKey: 'vehicles_all' },
  { value: 'truck' as const, labelKey: 'vehicles_trucks' },
  { value: 'machine' as const, labelKey: 'vehicles_machines' },
];

const STATUS_OPTIONS = [
  { value: 'active' as const, labelKey: 'vehicles_status_active' },
  { value: 'all' as const, labelKey: 'vehicles_show_inactive' },
];

export function VehiclesScreen() {
  const { t } = useLocale();
  const { user } = useAuth();
  const theme = useResponsiveTheme();
  const {
    sites,
    vehicles,
    driverVehicleAssignments,
    updateVehicle,
    refetch,
    syncFromWebsiteVehicles,
    loading,
  } = useMockAppStore();
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [syncingFromWebsite, setSyncingFromWebsite] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [filter, setFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
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
  const [machineLh, setMachineLh] = useState('');

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
    filter === 'all' ? byStatus : byStatus.filter((v) => v.type === filter);

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

  const canSyncAndEdit =
    user &&
    CAN_SYNC_AND_EDIT_VEHICLE_ROLES.includes(
      user.role as (typeof CAN_SYNC_AND_EDIT_VEHICLE_ROLES)[number]
    );

  const openEdit = (v: VehicleType) => {
    setEditVehicle(v);
    setSiteId(v.siteId ?? FREE_SITE_KEY);
    setVehicleNumber(v.vehicleNumberOrId);
    setMileageKmPerLitre(v.mileageKmPerLitre != null ? String(v.mileageKmPerLitre) : '');
    setHoursPerLitre(v.hoursPerLitre != null ? String(v.hoursPerLitre) : '');
    setMachineLh(
      v.hoursPerLitre != null && v.hoursPerLitre > 0 ? String(1 / v.hoursPerLitre) : ''
    );
    setCapacityTons(v.capacityTons != null ? String(v.capacityTons) : '');
    setTankCapacity(String(v.tankCapacityLitre));
    setFuelBalance(String(v.fuelBalanceLitre));
    setHealthInputs(v.healthInputs ?? '');
    setIdealConsumptionRange(v.idealConsumptionRange ?? '');
    setIdealWorkingRange(v.idealWorkingRange ?? '');
    setEditStatus(v.status ?? 'active');
    setAddType(v.type);
  };

  const closeEdit = () => setEditVehicle(null);

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
      const message =
        (e && typeof e === 'object' && 'message' in e ? (e as { message: string }).message : null) ||
        t('vehicles_sync_failed');
      showToast(message);
    } finally {
      setSyncingFromWebsite(false);
    }
  };

  const submitEdit = async () => {
    if (!editVehicle) return;
    const capacity = parseFloat(tankCapacity);
    const balance = parseFloat(fuelBalance);
    if (isNaN(capacity) || capacity <= 0) return;
    if (isNaN(balance) || balance < 0) return;
    const assignedSiteId = siteId === FREE_SITE_KEY ? undefined : siteId;
    setSubmitting(true);
    try {
      const patch: Partial<VehicleType> = {
        siteId: assignedSiteId,
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
      const message =
        (e && typeof e === 'object' && 'message' in e ? (e as { message: string }).message : null) ||
        t('vehicles_edit_failed');
      Alert.alert(t('alert_error'), message);
    } finally {
      setSubmitting(false);
    }
  };

  const getSiteName = (id: string) =>
    id === FREE_SITE_KEY ? t('vehicles_free_no_site') : (sites.find((s) => s.id === id)?.name ?? id);

  const siteOptions = useMemo(
    () => [
      { value: FREE_SITE_KEY, label: t('vehicles_free_no_site') },
      ...sites.map((s) => ({ value: s.id, label: s.name })),
    ],
    [sites, t]
  );

  const typeSegmentedOptions = useMemo(
    () =>
      TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) })),
    [t]
  );
  const statusSegmentedOptions = useMemo(
    () =>
      STATUS_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) })),
    [t]
  );

  return (
    <View style={styles.screen}>
      <Header
        title={t('vehicles_title')}
        subtitle={t('vehicles_subtitle')}
        rightAction={
          canSyncAndEdit ? (
            <Pressable
              onPress={onSyncFromWebsite}
              disabled={syncingFromWebsite}
              style={styles.syncBtn}
            >
              <Download size={18} color={colors.surface} />
              <Text style={styles.syncBtnText}>{t('vehicles_sync_from_website')}</Text>
            </Pressable>
          ) : undefined
        }
      />

      <View style={styles.filterStrip}>
        <SegmentedControl
          options={typeSegmentedOptions}
          value={filter}
          onChange={(v) => setFilter(v)}
        />
        <View style={styles.statusRow}>
          <SegmentedControl
            options={statusSegmentedOptions}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
          />
        </View>
      </View>

      <ScreenContainer
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={{ paddingBottom: theme.spacingXl, flexGrow: 1 }}
      >
        {loading ? (
          <SkeletonList count={6} />
        ) : (
          <>
            {Object.entries(bySite).map(([sid, list]) => (
              <View key={sid} style={styles.section}>
                <Text style={styles.sectionTitle}>{getSiteName(sid)}</Text>
                {list.map((v) => {
                  const allocated = isAllocated(sid, v.id);
                  const metaParts = [
                    `Tank: ${v.tankCapacityLitre} L · ${t('vehicles_fuel_balance_label')}: ${v.fuelBalanceLitre} L`,
                  ];
                  if (v.type === 'truck' && v.mileageKmPerLitre != null) {
                    metaParts.push(`${Number(v.mileageKmPerLitre).toFixed(2)} km/L`);
                  }
                  if (v.type === 'truck' && v.capacityTons != null) {
                    metaParts.push(`${Number(v.capacityTons).toFixed(1)} t`);
                  }
                  if (v.type === 'machine' && v.hoursPerLitre != null && v.hoursPerLitre > 0) {
                    metaParts.push(`${(1 / v.hoursPerLitre).toFixed(2)} L/h`);
                  }
                  const footerContent =
                    v.healthInputs || v.idealWorkingRange || v.idealConsumptionRange ? (
                      <View>
                        {v.type === 'truck' && v.healthInputs && (
                          <Text style={styles.footerText}>Health: {v.healthInputs}</Text>
                        )}
                        {v.type === 'truck' && v.idealConsumptionRange && (
                          <Text style={styles.footerText}>Ideal range: {v.idealConsumptionRange}</Text>
                        )}
                        {v.type === 'machine' && v.idealWorkingRange && (
                          <Text style={styles.footerText}>Ideal working range: {v.idealWorkingRange}</Text>
                        )}
                      </View>
                    ) : undefined;
                  return (
                    <ListCard
                      key={v.id}
                      title={v.vehicleNumberOrId}
                      subtitle={v.type}
                      meta={metaParts.join(' · ')}
                      right={
                        <View style={styles.badgesRow}>
                          <View
                            style={[
                              styles.badge,
                              allocated ? styles.badgeAllocated : styles.badgeFree,
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeText,
                                allocated ? styles.badgeTextAllocated : styles.badgeTextFree,
                              ]}
                            >
                              {allocated ? t('vehicles_allocated') : t('vehicles_free')}
                            </Text>
                          </View>
                          {(v.status ?? 'active') === 'inactive' && (
                            <View style={styles.badgeInactive}>
                              <Text style={styles.badgeTextInactive}>
                                {t('vehicles_status_inactive')}
                              </Text>
                            </View>
                          )}
                          <Pencil size={14} color={colors.textMuted} />
                        </View>
                      }
                      footer={footerContent}
                      onPress={() => openEdit(v)}
                    />
                  );
                })}
              </View>
            ))}
            {filtered.length === 0 && (
              <EmptyState title={t('vehicles_no_match')} message={t('vehicles_no_match_message')} />
            )}
          </>
        )}
      </ScreenContainer>

      <FormModal
        visible={!!editVehicle}
        onClose={closeEdit}
        title={t('vehicles_edit_title')}
        primaryLabel={t('common_save')}
        onPrimary={submitEdit}
        secondaryLabel={t('common_cancel')}
        submitting={submitting}
      >
        <Text style={styles.modalLabel}>
          {t('vehicles_site_label')} ({t('vehicles_site_optional')})
        </Text>
        <FilterChips
          options={siteOptions}
          value={siteId}
          onChange={setSiteId}
          scroll={false}
        />
        <View style={styles.modalChipsMargin} />
        <Text style={styles.modalLabel}>{t('vehicles_vehicle_number_id')}</Text>
        <View style={styles.readOnlyField}>
          <Text style={styles.readOnlyText}>{editVehicle?.vehicleNumberOrId ?? vehicleNumber}</Text>
        </View>
        <Text style={styles.readOnlyHint}>{t('vehicles_vehicle_number_readonly_hint')}</Text>
        {addType === 'truck' ? (
          <>
            <Input
              label={t('vehicles_mileage_km_litre')}
              value={mileageKmPerLitre}
              onChangeText={setMileageKmPerLitre}
              placeholder={t('vehicles_mileage_placeholder')}
              keyboardType="decimal-pad"
            />
            <Input
              label={t('vehicles_capacity_tons_label')}
              value={capacityTons}
              onChangeText={setCapacityTons}
              placeholder={t('vehicles_capacity_tons_placeholder')}
              keyboardType="decimal-pad"
            />
            <Input
              label={t('vehicles_ideal_consumption_optional')}
              value={idealConsumptionRange}
              onChangeText={setIdealConsumptionRange}
              placeholder={t('vehicles_range_placeholder')}
            />
            <Input
              label={t('vehicles_health_optional')}
              value={healthInputs}
              onChangeText={setHealthInputs}
              placeholder={t('vehicles_health_placeholder')}
            />
          </>
        ) : (
          <>
            <Input
              label={t('vehicles_machine_fuel_label')}
              value={machineLh}
              onChangeText={(text: string) => {
                setMachineLh(text);
                const n = parseFloat(text);
                if (!isNaN(n) && n > 0) setHoursPerLitre(String(1 / n));
              }}
              placeholder="e.g. 5"
              keyboardType="decimal-pad"
            />
            <Input
              label={t('vehicles_ideal_working_optional')}
              value={idealWorkingRange}
              onChangeText={setIdealWorkingRange}
              placeholder={t('vehicles_hours_range_placeholder')}
            />
          </>
        )}
        <Input
          label={t('vehicles_tank_capacity_label')}
          value={tankCapacity}
          onChangeText={setTankCapacity}
          placeholder={t('vehicles_tank_placeholder')}
          keyboardType="decimal-pad"
        />
        <Input
          label={t('vehicles_fuel_balance_label')}
          value={fuelBalance}
          onChangeText={setFuelBalance}
          placeholder="0"
          keyboardType="decimal-pad"
        />
        <Text style={styles.modalLabel}>{t('vehicles_status_label')}</Text>
        <View style={styles.statusChunks}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setEditStatus('active');
            }}
            style={[
              styles.statusChunk,
              editStatus === 'active' && styles.statusChunkActive,
            ]}
          >
            <CheckCircle
              size={20}
              color={editStatus === 'active' ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.statusChunkText,
                editStatus === 'active' && styles.statusChunkTextActive,
              ]}
            >
              {t('vehicles_status_active')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setEditStatus('inactive');
            }}
            style={[
              styles.statusChunk,
              editStatus === 'inactive' && styles.statusChunkInactive,
            ]}
          >
            <Circle
              size={20}
              color={editStatus === 'inactive' ? colors.gray600 : colors.textMuted}
            />
            <Text
              style={[
                styles.statusChunkText,
                editStatus === 'inactive' && styles.statusChunkTextInactive,
              ]}
            >
              {t('vehicles_status_inactive')}
            </Text>
          </Pressable>
        </View>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filterStrip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  statusRow: {
    marginTop: spacing.sm,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  badge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeFree: {
    backgroundColor: colors.blue50,
  },
  badgeAllocated: {
    backgroundColor: colors.gray200,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  badgeTextFree: {
    color: colors.primary,
  },
  badgeTextAllocated: {
    color: colors.gray700,
  },
  badgeInactive: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.gray200,
  },
  badgeTextInactive: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.gray600,
  },
  footerText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray600,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
  },
  syncBtnText: {
    color: colors.surface,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  modalLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  modalChipsMargin: {
    height: spacing.sm,
  },
  readOnlyField: {
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  readOnlyText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  readOnlyHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  statusChunks: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statusChunk: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.gray50,
    minHeight: 48,
  },
  statusChunkActive: {
    backgroundColor: colors.blue50,
    borderColor: colors.primary,
  },
  statusChunkInactive: {
    backgroundColor: colors.gray200,
    borderColor: colors.gray500,
  },
  statusChunkText: {
    marginLeft: spacing.sm,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  statusChunkTextActive: {
    color: colors.primary,
  },
  statusChunkTextInactive: {
    color: colors.gray700,
  },
});
