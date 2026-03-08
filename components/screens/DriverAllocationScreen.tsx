import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { useAuth } from '@/context/AuthContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { colors, dimensions, spacing, radius } from '@/theme/tokens';
import { PressableScale } from '@/components/ui/PressableScale';
import { getRoleLabelKey } from '@/lib/rbac';
import { useLocale } from '@/context/LocaleContext';
import { ArrowLeft, User, Truck } from 'lucide-react-native';

export function DriverAllocationScreen({ onBack }: { onBack: () => void }) {
  const { t } = useLocale();
  const { user } = useAuth();
  const theme = useResponsiveTheme();
  const { sites, users, vehicles, siteAssignments, driverVehicleAssignments, setDriverVehicleAssignment, loading } = useMockAppStore();

  const mySiteIds = useMemo(
    () =>
      user?.role === 'head_supervisor'
        ? []
        : sites.filter((s) => s.assistantSupervisorId === user?.id || user?.siteAccess?.includes(s.id)).map((s) => s.id),
    [sites, user?.id, user?.role, user?.siteAccess]
  );

  const [selectedSiteIndex, setSelectedSiteIndex] = useState(0);
  const siteId = mySiteIds[selectedSiteIndex] ?? mySiteIds[0] ?? sites[0]?.id;
  const site = sites.find((s) => s.id === siteId);

  // Active vehicles at this site + free (unassigned) vehicles that can be allocated to this site
  const siteVehicles = useMemo(
    () =>
      vehicles.filter(
        (v) => (v.siteId === siteId || !v.siteId) && (v.status ?? 'active') === 'active'
      ),
    [vehicles, siteId]
  );

  // Only show actual drivers/operators in allocation – exclude owner, admin, head_supervisor, etc.
  const siteDrivers = useMemo(() => {
    const assignableRole = (r: string) => r === 'driver_truck' || r === 'driver_machine';
    return siteAssignments
      .filter((a) => a.siteId === siteId && assignableRole(a.role))
      .map((a) => users.find((u) => u.id === a.userId))
      .filter((u): u is NonNullable<typeof u> => u != null && assignableRole(u.role));
  }, [siteId, siteAssignments, users]);

  const getAssignedVehicleIds = useCallback(
    (driverId: string) =>
      driverVehicleAssignments.find((a) => a.siteId === siteId && a.driverId === driverId)?.vehicleIds ?? [],
    [driverVehicleAssignments, siteId]
  );

  // Free = not assigned to any driver at this site (real-time from driver_vehicle_assignments)
  const allocatedVehicleIds = useMemo(() => {
    const set = new Set<string>();
    for (const a of driverVehicleAssignments) {
      if (a.siteId !== siteId) continue;
      for (const vid of a.vehicleIds ?? []) {
        set.add(vid);
      }
    }
    return set;
  }, [driverVehicleAssignments, siteId]);

  const freeVehicles = useMemo(
    () => siteVehicles.filter((v) => !allocatedVehicleIds.has(v.id)),
    [siteVehicles, allocatedVehicleIds]
  );

  // Per vehicle: which drivers have it assigned (for "Assigned to: A, B" label)
  const vehicleToDriverNames = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const d of siteDrivers) {
      const vIds = getAssignedVehicleIds(d.id);
      for (const vid of vIds) {
        if (!map[vid]) map[vid] = [];
        map[vid].push(d.name);
      }
    }
    return map;
  }, [siteDrivers, getAssignedVehicleIds]);

  const toggleDriverVehicle = (driverId: string, vehicleId: string) => {
    const current = getAssignedVehicleIds(driverId);
    const next = current.includes(vehicleId)
      ? current.filter((id) => id !== vehicleId)
      : [...current, vehicleId];
    setDriverVehicleAssignment(siteId, driverId, next);
  };

  if (user?.role === 'head_supervisor') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title={t('driver_allocation_title')} leftAction={<PressableScale onPress={onBack}><Text style={{ color: colors.primary, fontWeight: '600' }}>{t('common_back')}</Text></PressableScale>} />
        <View style={{ padding: spacing.lg }}>
          <Text style={{ color: colors.textSecondary }}>{t('driver_allocation_only_asst')}</Text>
        </View>
      </View>
    );
  }

  if (!site && !loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title={t('driver_allocation_title')} leftAction={<PressableScale onPress={onBack}><Text style={{ color: colors.primary, fontWeight: '600' }}>{t('common_back')}</Text></PressableScale>} />
        <View style={{ padding: spacing.lg }}><Text style={{ color: colors.textSecondary }}>{t('driver_allocation_no_site')}</Text></View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title={t('driver_allocation_title')} leftAction={<PressableScale onPress={onBack}><Text style={{ color: colors.primary, fontWeight: '600' }}>{t('common_back')}</Text></PressableScale>} />
        <View style={{ flex: 1, paddingVertical: spacing.xxl, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>{t('driver_allocation_loading')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title={t('driver_allocation_reassign')}
        subtitle={site?.name ?? ''}
        leftAction={
          <PressableScale onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ArrowLeft size={dimensions.iconSize} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '600', marginLeft: spacing.xs }}>{t('common_back')}</Text>
          </PressableScale>
        }
      />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding, paddingBottom: theme.spacingXl }}>
        {mySiteIds.length > 1 && (
          <View className="mb-3">
            <Text className="text-xs text-gray-500 mb-2">{t('driver_allocation_site_picker')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
              {mySiteIds.map((sid, idx) => {
                const s = sites.find((x) => x.id === sid);
                const active = siteId === sid;
                return (
                  <Pressable
                    key={sid}
                    onPress={() => setSelectedSiteIndex(idx)}
                    style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, backgroundColor: active ? colors.primary : colors.gray200 }}
                  >
                    <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '500' }}>{s?.name ?? sid}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Free vehicles – assign to drivers (truck) or operators (machine) below */}
        <Card className="mb-4 bg-green-50 border border-green-200">
          <Text className="text-sm font-semibold text-green-800 mb-2">{t('vehicles_free')} – {t('driver_allocation_free_vehicles_hint')}</Text>
          {freeVehicles.length === 0 ? (
            <Text className="text-gray-600 text-sm">{t('driver_allocation_all_assigned')}</Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {freeVehicles.map((v) => (
                <View key={v.id} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
                  <Truck size={14} color={colors.primary} />
                  <Text style={{ marginLeft: 8, fontWeight: '500', color: colors.text }}>{v.vehicleNumberOrId}</Text>
                  <Text style={{ marginLeft: 8, fontSize: 12, color: colors.textSecondary }}>({t('vehicles_free')})</Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        <Text className="text-sm text-gray-600 mb-3">{t('driver_allocation_select_hint')}</Text>
        {siteDrivers.length === 0 ? (
          <Card><Text className="text-gray-600">{t('driver_allocation_no_drivers')}</Text></Card>
        ) : (
          siteDrivers.map((driver) => (
            <Card key={driver.id} className="mb-4">
              <View className="flex-row items-center mb-2">
                <User size={20} color={colors.primary} />
                <Text className="font-semibold text-gray-900 ml-2">{driver.name}</Text>
                <Text className="text-xs text-gray-500 ml-2">({t(getRoleLabelKey(driver.role))})</Text>
              </View>
              <Text className="text-xs text-gray-500 mb-2">{t('driver_vehicles_can_use')}</Text>
              <View className="flex-row flex-wrap gap-2">
                {siteVehicles.map((v) => {
                  const selected = getAssignedVehicleIds(driver.id).includes(v.id);
                  const assignedTo = vehicleToDriverNames[v.id] ?? [];
                  const assignedLabel = assignedTo.length > 0 ? assignedTo.join(', ') : t('vehicles_free');
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => toggleDriverVehicle(driver.id, v.id)}
                      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', backgroundColor: selected ? colors.primary : colors.gray200 }}
                    >
                      <Truck size={14} color={selected ? '#fff' : colors.text} />
                      <Text style={{ marginLeft: 8, fontWeight: '500', color: selected ? '#fff' : colors.text }}>{v.vehicleNumberOrId}</Text>
                      {!selected && assignedTo.length > 0 && (
                        <Text style={{ marginLeft: 8, fontSize: 12, color: colors.textSecondary }}>→ {assignedLabel}</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
