import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, RefreshControl, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Header,
  SegmentedControl,
  FilterChips,
  FormModal,
  Input,
  ScreenContainer,
  SkeletonList,
  EmptyState,
  Card,
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
/** Active = only active vehicles; inactive = only inactive vehicles. */
type StatusFilter = 'active' | 'inactive';
/** all = no filter; free = only unallocated; allocated = only allocated (assigned to a driver/operator at some site). */
type AllocationFilter = 'all' | 'free' | 'allocated';

const CAN_SYNC_AND_EDIT_VEHICLE_ROLES = ['admin', 'owner', 'head_supervisor'] as const;

const TYPE_OPTIONS = [
  { value: 'all' as const, labelKey: 'vehicles_all' },
  { value: 'truck' as const, labelKey: 'vehicles_trucks' },
  { value: 'machine' as const, labelKey: 'vehicles_machines' },
];

const STATUS_OPTIONS = [
  { value: 'active' as const, labelKey: 'vehicles_status_active' },
  { value: 'inactive' as const, labelKey: 'vehicles_status_inactive' },
];

const ALLOCATION_OPTIONS = [
  { value: 'all' as const, labelKey: 'vehicles_all' },
  { value: 'free' as const, labelKey: 'vehicles_free' },
  { value: 'allocated' as const, labelKey: 'vehicles_allocated' },
];

export function VehiclesScreen() {
  const { t } = useLocale();
  const { user } = useAuth();
  const theme = useResponsiveTheme();
  const {
    sites,
    vehicles,
    driverVehicleAssignments,
    users,
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
  const [allocationFilter, setAllocationFilter] = useState<AllocationFilter>('all');
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

  /** Canonical id for comparison (DB/assignments may return with whitespace or different casing). */
  const normalizeVehicleId = (id: string) => String(id ?? '').trim();

  const allocatedBySite = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const a of driverVehicleAssignments) {
      if (!map[a.siteId]) map[a.siteId] = new Set();
      for (const vid of a.vehicleIds ?? []) {
        const nid = normalizeVehicleId(vid);
        if (nid) map[a.siteId].add(nid);
      }
    }
    return map;
  }, [driverVehicleAssignments]);

  const isAllocated = (siteId: string, vehicleId: string) =>
    allocatedBySite[siteId]?.has(normalizeVehicleId(vehicleId)) ?? false;

  /** Set of vehicle ids that are allocated (assigned to a driver or operator) at any site. Includes both trucks and machines. */
  const allocatedVehicleIds = useMemo(() => {
    const set = new Set<string>();
    for (const a of driverVehicleAssignments) {
      for (const vid of a.vehicleIds ?? []) {
        const nid = normalizeVehicleId(vid);
        if (nid) set.add(nid);
      }
    }
    return set;
  }, [driverVehicleAssignments]);

  /** For vehicles with no site_id, use first assignment site so they show under that site (e.g. Sector 52) instead of "Free (no site)". */
  const allocatedSiteByVehicleId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of driverVehicleAssignments) {
      for (const vid of a.vehicleIds ?? []) {
        const nid = normalizeVehicleId(vid);
        if (nid && !(nid in map)) map[nid] = a.siteId;
      }
    }
    return map;
  }, [driverVehicleAssignments]);

  /** For each (site, vehicle) pair, find the primary allocated driver/operator so we can show their name and phone. */
  const contactBySiteAndVehicleId = useMemo(() => {
    const map: Record<string, { name: string; phone?: string | null }> = {};
    if (!users || users.length === 0) return map;
    for (const a of driverVehicleAssignments) {
      const driver = users.find((u) => u.id === a.driverId);
      if (!driver) continue;
      for (const vid of a.vehicleIds ?? []) {
        const nid = normalizeVehicleId(vid);
        if (!nid) continue;
        const key = `${a.siteId}|${nid}`;
        if (!map[key]) {
          map[key] = { name: driver.name, phone: driver.phone };
        }
      }
    }
    return map;
  }, [driverVehicleAssignments, users]);

  const byStatus =
    statusFilter === 'active'
      ? vehicles.filter((v) => (v.status ?? 'active') === 'active')
      : vehicles.filter((v) => (v.status ?? 'active') === 'inactive');

  const byType =
    filter === 'all' ? byStatus : byStatus.filter((v) => v.type === filter);

  const filtered =
    allocationFilter === 'all'
      ? byType
      : allocationFilter === 'allocated'
        ? byType.filter((v) => allocatedVehicleIds.has(normalizeVehicleId(v.id)))
        : byType.filter((v) => !allocatedVehicleIds.has(normalizeVehicleId(v.id)));

  const bySite = useMemo(
    () =>
      filtered.reduce<Record<string, VehicleType[]>>((acc, v) => {
        const key =
          v.siteId ?? allocatedSiteByVehicleId[normalizeVehicleId(v.id)] ?? FREE_SITE_KEY;
        if (!acc[key]) acc[key] = [];
        acc[key].push(v);
        return acc;
      }, {}),
    [filtered, allocatedSiteByVehicleId]
  );

  const canSyncAndEdit =
    user &&
    CAN_SYNC_AND_EDIT_VEHICLE_ROLES.includes(
      user.role as (typeof CAN_SYNC_AND_EDIT_VEHICLE_ROLES)[number]
    );

  const hideStatusAndAssignmentFilters = user?.role === 'assistant_supervisor';

  const openEdit = (v: VehicleType) => {
    setEditVehicle(v);
    setSiteId(v.siteId ?? FREE_SITE_KEY);
    setVehicleNumber(v.vehicleNumberOrId);
    setMileageKmPerLitre(v.mileageKmPerLitre != null ? String(v.mileageKmPerLitre) : '');
    setHoursPerLitre(v.hoursPerLitre != null && v.hoursPerLitre > 0 ? String(v.hoursPerLitre) : '');
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
        const hrPerL = parseFloat(hoursPerLitre);
        if (!isNaN(hrPerL) && hrPerL > 0) patch.hoursPerLitre = hrPerL;
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
  const allocationSegmentedOptions = useMemo(
    () =>
      ALLOCATION_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) })),
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
        <View>
          <Text style={styles.filterLabel}>{t('vehicles_filter_type')}</Text>
          <SegmentedControl
            options={typeSegmentedOptions}
            value={filter}
            onChange={(v) => setFilter(v)}
          />
        </View>
        {!hideStatusAndAssignmentFilters && (
          <>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{t('vehicles_filter_status')}</Text>
              <SegmentedControl
                options={statusSegmentedOptions}
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
              />
            </View>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{t('vehicles_filter_assignment')}</Text>
              <SegmentedControl
                options={allocationSegmentedOptions}
                value={allocationFilter}
                onChange={(v) => setAllocationFilter(v)}
              />
            </View>
          </>
        )}
        {!loading && (
          <Text style={styles.showingCount}>
            {t('vehicles_showing_count').replace('{{count}}', String(filtered.length))}
          </Text>
        )}
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
                  const contactKey = `${sid}|${normalizeVehicleId(v.id)}`;
                  const contact = contactBySiteAndVehicleId[contactKey];
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => openEdit(v)}
                      style={styles.vehicleCardPressable}
                      accessibilityRole="button"
                      accessibilityLabel={`${v.vehicleNumberOrId}, ${v.type}`}
                    >
                      <Card style={styles.vehicleCard}>
                        <View style={styles.vehicleCardHeader}>
                          <View style={styles.vehicleCardTitleRow}>
                            <Text style={styles.vehicleCardTitle}>{v.vehicleNumberOrId}</Text>
                            <View style={styles.vehicleCardTypePill}>
                              <Text style={styles.vehicleCardTypeText}>
                                {v.type === 'truck' ? t('vehicles_trucks') : t('vehicles_machines')}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.vehicleCardBadges}>
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
                                <Text style={styles.badgeTextInactive}>{t('vehicles_status_inactive')}</Text>
                              </View>
                            )}
                            <View style={styles.editChip}>
                              <Pencil size={14} color={colors.primary} />
                              <Text style={styles.editChipText}>{t('vehicles_edit')}</Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.vehicleCardSpecs}>
                          <View style={styles.specRow}>
                            <Text style={styles.specLabel}>{t('vehicles_card_tank')}</Text>
                            <Text style={styles.specValue}>{v.tankCapacityLitre} L</Text>
                          </View>
                          <View style={styles.specRow}>
                            <Text style={styles.specLabel}>{t('vehicles_card_fuel')}</Text>
                            <Text style={styles.specValue}>{v.fuelBalanceLitre} L</Text>
                          </View>
                          {v.type === 'truck' && v.mileageKmPerLitre != null && (
                            <View style={styles.specRow}>
                              <Text style={styles.specLabel}>{t('vehicles_card_mileage')}</Text>
                              <Text style={styles.specValue}>{Number(v.mileageKmPerLitre).toFixed(1)} km/L</Text>
                            </View>
                          )}
                          {v.type === 'truck' && v.capacityTons != null && (
                            <View style={styles.specRow}>
                              <Text style={styles.specLabel}>{t('vehicles_card_capacity')}</Text>
                              <Text style={styles.specValue}>{Number(v.capacityTons).toFixed(1)} t</Text>
                            </View>
                          )}
                          {v.type === 'machine' && v.hoursPerLitre != null && v.hoursPerLitre > 0 && (
                            <View style={styles.specRow}>
                              <Text style={styles.specLabel}>{t('vehicles_card_hours_per_litre')}</Text>
                              <Text style={styles.specValue}>{Number(v.hoursPerLitre).toFixed(2)} hr/L</Text>
                            </View>
                          )}
                        </View>
                        {allocated && contact && (
                          <View style={styles.allocatedRow}>
                            <Text style={styles.allocatedLabel}>{t('vehicles_allocated_to')}:</Text>
                            <Text style={styles.allocatedValue}>{contact.name}{contact.phone ? ` · ${contact.phone}` : ''}</Text>
                          </View>
                        )}
                        {(v.healthInputs || v.idealWorkingRange || v.idealConsumptionRange) ? (
                          <View style={styles.vehicleCardFooter}>
                            {v.type === 'truck' && v.healthInputs ? (
                              <Text style={styles.footerText}>Health: {v.healthInputs}</Text>
                            ) : null}
                            {v.type === 'truck' && v.idealConsumptionRange ? (
                              <Text style={styles.footerText}>Ideal range: {v.idealConsumptionRange}</Text>
                            ) : null}
                            {v.type === 'machine' && v.idealWorkingRange ? (
                              <Text style={styles.footerText}>Ideal working range: {v.idealWorkingRange}</Text>
                            ) : null}
                          </View>
                        ) : null}
                      </Card>
                    </Pressable>
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
              onFocus={() => { if (mileageKmPerLitre === '0') setMileageKmPerLitre(''); }}
              placeholder={t('vehicles_mileage_placeholder')}
              keyboardType="decimal-pad"
            />
            <Input
              label={t('vehicles_capacity_tons_label')}
              value={capacityTons}
              onChangeText={setCapacityTons}
              onFocus={() => { if (capacityTons === '0') setCapacityTons(''); }}
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
              value={hoursPerLitre}
              onChangeText={setHoursPerLitre}
              onFocus={() => { if (hoursPerLitre === '0') setHoursPerLitre(''); }}
              placeholder={t('vehicles_hours_placeholder')}
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
          onFocus={() => { if (tankCapacity === '0') setTankCapacity(''); }}
          placeholder={t('vehicles_tank_placeholder')}
          keyboardType="decimal-pad"
        />
        <Input
          label={t('vehicles_fuel_balance_label')}
          value={fuelBalance}
          onChangeText={setFuelBalance}
          onFocus={() => { if (fuelBalance === '0') setFuelBalance(''); }}
          placeholder={t('vehicles_fuel_balance_placeholder')}
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
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  showingCount: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  filterRow: {
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
  vehicleCardPressable: {
    marginBottom: spacing.md,
  },
  vehicleCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  vehicleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  vehicleCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    flexWrap: 'wrap',
  },
  vehicleCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  vehicleCardTypePill: {
    backgroundColor: colors.blue50,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  vehicleCardTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  vehicleCardBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  editChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.blue50,
  },
  editChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  vehicleCardSpecs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  specLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  specValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  allocatedRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  allocatedLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  allocatedValue: {
    fontSize: 13,
    color: colors.text,
  },
  vehicleCardFooter: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
