import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { FilterChips } from '@/components/ui/FilterChips';
import { Input } from '@/components/ui/Input';
import { formatDateLabel } from '@/components/ui/DatePickerField';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useToast } from '@/context/ToastContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { formatAmount } from '@/lib/currency';
import { validateSiteDates, getDateFieldErrorKeys } from '@/lib/dateValidation';
import type { Site } from '@/types';
import { ArrowLeft, Calendar } from 'lucide-react-native';

interface SiteDetailScreenProps {
  site: Site;
  onBack: () => void;
}

export function SiteDetailScreen({ site, onBack }: SiteDetailScreenProps) {
  const { user } = useAuth();
  const { t } = useLocale();
  const theme = useResponsiveTheme();
  const {
    sites,
    vehicles,
    users,
    siteAssignments,
    budgetAllocations,
    driverVehicleAssignments,
    setSiteAssignment,
    removeSiteAssignment,
    setDriverVehicleAssignment,
    updateSite,
    updateVehicle,
  } = useMockAppStore();
  const isHeadSupervisor = user?.role === 'head_supervisor';
  /** Admin and Head Supervisor can edit project dates (start, expected end). */
  const canEditSiteDates = user?.role === 'admin' || user?.role === 'head_supervisor';
  const { showToast } = useToast();

  const [editDatesVisible, setEditDatesVisible] = useState(false);
  const [editStartDate, setEditStartDate] = useState(site.startDate?.slice(0, 10) ?? '');
  const [editExpectedEndDate, setEditExpectedEndDate] = useState(site.expectedEndDate?.slice(0, 10) ?? '');
  const editDateErrors = getDateFieldErrorKeys(editStartDate, editExpectedEndDate);
  const [savingDates, setSavingDates] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);

  const currentSite = useMemo(() => sites.find((s) => s.id === site.id) ?? site, [sites, site]);
  const assignmentsForSite = siteAssignments.filter((a) => a.siteId === site.id);

  const onOpenEditDates = () => {
    setEditStartDate(currentSite.startDate?.slice(0, 10) ?? '');
    setEditExpectedEndDate(currentSite.expectedEndDate?.slice(0, 10) ?? '');
    setEditDatesVisible(true);
  };
  const onSaveDates = async () => {
    const startDate = (editStartDate ?? '').trim() || (currentSite.startDate ?? '');
    const expectedEndDate = (editExpectedEndDate ?? '').trim() || undefined;
    const dateValidation = validateSiteDates(startDate, expectedEndDate);
    if (!dateValidation.valid) {
      Alert.alert(t('alert_error'), t(dateValidation.errorKey));
      return;
    }
    setSavingDates(true);
    try {
      await updateSite(currentSite.id, {
        startDate: startDate || currentSite.startDate,
        expectedEndDate: expectedEndDate || undefined,
      });
      setEditDatesVisible(false);
    } catch (e) {
      Alert.alert(t('alert_error'), (e instanceof Error ? e.message : null) || t('sites_save_assignments_failed'));
    } finally {
      setSavingDates(false);
    }
  };

  const actualCompletedAt = currentSite.actualCompletedAt ? new Date(currentSite.actualCompletedAt) : null;
  const expectedEnd = currentSite.expectedEndDate ? new Date(currentSite.expectedEndDate) : null;
  const isOnTime = actualCompletedAt && expectedEnd ? actualCompletedAt <= expectedEnd : null;

  // Available = not assigned to any active/inactive site (unassigned or only on completed projects).
  // Include users already assigned to current site so they stay in the list.
  const isUserAvailableForAssignment = (userId: string, currentSiteId: string): boolean => {
    const assignedSiteIds = siteAssignments.filter((a) => a.userId === userId).map((a) => a.siteId);
    if (assignedSiteIds.length === 0) return true;
    const allCompletedOrThis = assignedSiteIds.every((sid) => {
      if (sid === currentSiteId) return true;
      const s = sites.find((x) => x.id === sid);
      return s?.status === 'completed';
    });
    return allCompletedOrThis;
  };

  const isExcludedFromDriverOperator = (u: { role: string; name?: string }) => {
    const roleExcluded = ['admin', 'owner', 'head_supervisor', 'accountant', 'assistant_supervisor', 'surveyor'].includes(u.role);
    const nameExcluded = (u.name ?? '').trim().toLowerCase() === 'admin' || (u.name ?? '').trim().toLowerCase() === 'owner';
    return roleExcluded || nameExcluded;
  };

  const withRoleAndAvailable = (
    role: 'assistant_supervisor' | 'surveyor' | 'driver_truck' | 'driver_machine',
    extraFilter: (u: { id: string; role: string; name?: string }) => boolean
  ) =>
    users.filter(
      (u) =>
        u.role === role &&
        extraFilter(u) &&
        (isUserAvailableForAssignment(u.id, site.id) || assignmentsForSite.some((a) => a.userId === u.id && a.role === role))
    );

  const assignableByRole = {
    assistant_supervisor: withRoleAndAvailable('assistant_supervisor', () => true),
    surveyor: withRoleAndAvailable('surveyor', () => true),
    driver_truck: withRoleAndAvailable('driver_truck', (u) => !isExcludedFromDriverOperator(u)),
    driver_machine: withRoleAndAvailable('driver_machine', (u) => !isExcludedFromDriverOperator(u)),
  };

  // Vehicles: available = unassigned (no site), or assigned to a completed site, or already on this site
  const assignableVehicles = vehicles.filter((v) => {
    if (!v.siteId) return true;
    if (v.siteId === site.id) return true;
    const assignedSite = sites.find((s) => s.id === v.siteId);
    return assignedSite?.status === 'completed';
  });

  const getAssignedUserIds = (role: string) =>
    assignmentsForSite.filter((a) => a.role === role).map((a) => a.userId);
  const getAssignedVehicleIds = () => {
    const row = assignmentsForSite.find((a) => a.role === 'assistant_supervisor');
    return row?.vehicleIds ?? [];
  };

  const [selectedAssistants, setSelectedAssistants] = useState<string[]>(() => getAssignedUserIds('assistant_supervisor'));
  const [selectedSurveyors, setSelectedSurveyors] = useState<string[]>(() => getAssignedUserIds('surveyor'));
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>(() => getAssignedVehicleIds());

  const assignableTrucks = useMemo(() => assignableVehicles.filter((v) => v.type === 'truck'), [assignableVehicles]);
  const assignableMachines = useMemo(() => assignableVehicles.filter((v) => v.type === 'machine'), [assignableVehicles]);

  const initialVehicleDriverMap = useMemo(() => {
    const m: Record<string, string> = {};
    driverVehicleAssignments
      .filter((a) => a.siteId === site.id)
      .forEach((a) => {
        a.vehicleIds?.forEach((vid) => {
          if (vehicles.find((v) => v.id === vid)?.type === 'truck') m[vid] = a.driverId;
        });
      });
    return m;
  }, [site.id, driverVehicleAssignments, vehicles]);
  const initialVehicleOperatorMap = useMemo(() => {
    const m: Record<string, string> = {};
    driverVehicleAssignments
      .filter((a) => a.siteId === site.id)
      .forEach((a) => {
        a.vehicleIds?.forEach((vid) => {
          if (vehicles.find((v) => v.id === vid)?.type === 'machine') m[vid] = a.driverId;
        });
      });
    return m;
  }, [site.id, driverVehicleAssignments, vehicles]);

  const [vehicleDriverMap, setVehicleDriverMap] = useState<Record<string, string>>(() => initialVehicleDriverMap);
  const [vehicleOperatorMap, setVehicleOperatorMap] = useState<Record<string, string>>(() => initialVehicleOperatorMap);

  type VehicleTypeFilter = 'all' | 'truck' | 'machine';
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<VehicleTypeFilter>('all');
  const vehiclesFilterOptions: { value: VehicleTypeFilter; label: string }[] = [
    { value: 'all', label: t('site_vehicles_filter_all') },
    { value: 'truck', label: t('site_vehicles_filter_trucks') },
    { value: 'machine', label: t('site_vehicles_filter_machines') },
  ];
  const filteredAssignableVehicles = useMemo(() => {
    if (vehicleTypeFilter === 'all') return assignableVehicles;
    return assignableVehicles.filter((v) => v.type === vehicleTypeFilter);
  }, [assignableVehicles, vehicleTypeFilter]);

  /** Returns the other vehicle id if this driver/operator is already assigned to a different vehicle in the list. */
  const alreadyAllocatedToOtherVehicle = (
    personId: string,
    currentVehicleId: string,
    map: Record<string, string>,
    vehicleIds: string[]
  ): string | null => {
    if (!personId) return null;
    const other = vehicleIds.find((vid) => vid !== currentVehicleId && map[vid] === personId);
    return other ?? null;
  };

  const setTruckDriver = (vehicleId: string, driverId: string) => {
    if (driverId) {
      const otherVid = alreadyAllocatedToOtherVehicle(driverId, vehicleId, vehicleDriverMap, truckIdsSelected);
      if (otherVid) {
        const otherVehicle = assignableTrucks.find((x) => x.id === otherVid);
        const vehicleLabel = otherVehicle?.vehicleNumberOrId ?? otherVid;
        showToast(t('site_driver_already_allocated').replace('{vehicle}', vehicleLabel));
        return;
      }
    }
    setVehicleDriverMap((prev) => ({ ...prev, [vehicleId]: driverId }));
  };
  const setMachineOperator = (vehicleId: string, operatorId: string) => {
    if (operatorId) {
      const otherVid = alreadyAllocatedToOtherVehicle(operatorId, vehicleId, vehicleOperatorMap, machineIdsSelected);
      if (otherVid) {
        const otherVehicle = assignableMachines.find((x) => x.id === otherVid);
        const vehicleLabel = otherVehicle?.vehicleNumberOrId ?? otherVid;
        showToast(t('site_operator_already_allocated').replace('{vehicle}', vehicleLabel));
        return;
      }
    }
    setVehicleOperatorMap((prev) => ({ ...prev, [vehicleId]: operatorId }));
  };

  const truckIdsSelected = useMemo(() => assignableTrucks.filter((v) => selectedVehicleIds.includes(v.id)).map((v) => v.id), [assignableTrucks, selectedVehicleIds]);
  const machineIdsSelected = useMemo(() => assignableMachines.filter((v) => selectedVehicleIds.includes(v.id)).map((v) => v.id), [assignableMachines, selectedVehicleIds]);
  const driverIdsFromMaps = useMemo(() => [...new Set(truckIdsSelected.map((vid) => vehicleDriverMap[vid]).filter(Boolean))], [truckIdsSelected, vehicleDriverMap]);
  const operatorIdsFromMaps = useMemo(() => [...new Set(machineIdsSelected.map((vid) => vehicleOperatorMap[vid]).filter(Boolean))], [machineIdsSelected, vehicleOperatorMap]);

  const allSelectedUserIds = [
    ...selectedAssistants,
    ...selectedSurveyors,
    ...driverIdsFromMaps,
    ...operatorIdsFromMaps,
  ];
  const usersAlreadyOnOtherSite = allSelectedUserIds
    .map((userId) => {
      const a = siteAssignments.find((x) => x.userId === userId && x.siteId !== site.id);
      if (!a) return null;
      const otherSite = sites?.find((s) => s.id === a.siteId);
      const u = users.find((x) => x.id === userId);
      return { userId, userName: u?.name ?? userId, otherSiteName: otherSite?.name ?? a.siteId };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const performSave = async () => {
    setSavingAssignments(true);
    try {
      const truckIds = truckIdsSelected;
      const machineIds = machineIdsSelected;
      const allDriverTrucks = driverIdsFromMaps;
      const allDriverMachines = operatorIdsFromMaps;

      const roles = ['assistant_supervisor', 'surveyor', 'driver_truck', 'driver_machine'] as const;
      const selectedByRole = {
        assistant_supervisor: selectedAssistants,
        surveyor: selectedSurveyors,
        driver_truck: allDriverTrucks,
        driver_machine: allDriverMachines,
      };
      for (const role of roles) {
        const currentIds = getAssignedUserIds(role);
        const newIds = selectedByRole[role];
        for (const userId of newIds) {
          await setSiteAssignment(site.id, {
            userId,
            role,
            vehicleIds: role === 'assistant_supervisor' ? selectedVehicleIds : undefined,
          });
        }
        for (const userId of currentIds) {
          if (!newIds.includes(userId)) {
            await removeSiteAssignment(site.id, userId);
          }
        }
      }
      const allAssignedPersonIds = new Set([...allDriverTrucks, ...allDriverMachines]);
      const previousAssignedIds = new Set(
        driverVehicleAssignments.filter((a) => a.siteId === site.id).map((a) => a.driverId)
      );
      for (const driverId of allDriverTrucks) {
        const vehicleIds = truckIds.filter((vid) => vehicleDriverMap[vid] === driverId);
        await setDriverVehicleAssignment(site.id, driverId, vehicleIds);
      }
      for (const operatorId of allDriverMachines) {
        const vehicleIds = machineIds.filter((vid) => vehicleOperatorMap[vid] === operatorId);
        await setDriverVehicleAssignment(site.id, operatorId, vehicleIds);
      }
      for (const driverId of previousAssignedIds) {
        if (!allAssignedPersonIds.has(driverId)) {
          await setDriverVehicleAssignment(site.id, driverId, []);
        }
      }
      const allAssignedVehicleIds = [...new Set([...truckIds, ...machineIds])];
      for (const vid of allAssignedVehicleIds) {
        const vehicle = vehicles.find((v) => v.id === vid);
        if (vehicle && (vehicle.siteId == null || vehicle.siteId === '')) {
          await updateVehicle(vid, { siteId: site.id });
        }
      }
      await updateSite(site.id, {
        assistantSupervisorId: selectedAssistants[0] ?? undefined,
        surveyorId: selectedSurveyors[0] ?? undefined,
        driverIds: [...allDriverTrucks, ...allDriverMachines].length ? [...allDriverTrucks, ...allDriverMachines] : undefined,
        vehicleIds: selectedVehicleIds.length ? selectedVehicleIds : undefined,
      });
      showToast(t('site_assignments_saved'));
      onBack();
    } catch (e) {
      const message = (e instanceof Error ? e.message : null) || t('sites_save_assignments_failed');
      Alert.alert(t('alert_error'), message);
    } finally {
      setSavingAssignments(false);
    }
  };

  const saveAssignments = () => {
    if (usersAlreadyOnOtherSite.length > 0) {
      const lines = usersAlreadyOnOtherSite.map(
        (x) => `${x.userName} ${t('site_already_at')} ${x.otherSiteName}`
      );
      Alert.alert(
        t('site_allocation_caution_title'),
        t('site_allocation_caution_message').replace('{site}', site.name).replace('{list}', lines.join('\n')),
        [
          { text: t('common_cancel'), style: 'cancel' },
          {
            text: t('site_move_here'),
            onPress: async () => {
              setSavingAssignments(true);
              try {
                for (const { userId } of usersAlreadyOnOtherSite) {
                  const other = siteAssignments.find((a) => a.userId === userId && a.siteId !== site.id);
                  if (other) await removeSiteAssignment(other.siteId, userId);
                }
                await performSave();
              } catch (e) {
                const message = (e instanceof Error ? e.message : null) || t('sites_save_assignments_failed');
                Alert.alert(t('alert_error'), message);
              } finally {
                setSavingAssignments(false);
              }
            },
          },
        ]
      );
      return;
    }
    performSave();
  };

  const toggleSelection = (setter: React.Dispatch<React.SetStateAction<string[]>>, id: string) => {
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleVehicle = (vehicleId: string) => {
    setSelectedVehicleIds((prev) =>
      prev.includes(vehicleId) ? prev.filter((id) => id !== vehicleId) : [...prev, vehicleId]
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      <Header
        title={site.name}
        subtitle={site.location}
        leftAction={
          <TouchableOpacity onPress={onBack} className="flex-row items-center">
            <ArrowLeft size={22} color="#2563EB" />
            <Text className="text-blue-600 font-semibold ml-1">{t('tab_sites')}</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding, paddingBottom: theme.spacingXl }}>
        <Card className="mb-4">
          <Text className="text-sm text-gray-600">{t('site_detail_status')}</Text>
          <Text className="font-semibold text-gray-900 capitalize">{currentSite.status}</Text>
          <View className="flex-row justify-between mt-2">
            <Text className="text-sm text-slate-600">{t('sites_budget')}: {formatAmount(currentSite.budget, true)}</Text>
            <Text className="text-sm text-slate-600">{t('dashboard_spent')}: {formatAmount(currentSite.spent, true)}</Text>
          </View>
        </Card>

        <Card className="mb-4">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-base font-semibold text-gray-900">{t('site_dates_project')}</Text>
            {canEditSiteDates && (
              <TouchableOpacity onPress={onOpenEditDates} className="flex-row items-center px-2 py-1 rounded-lg bg-blue-50">
                <Calendar size={14} color="#2563eb" />
                <Text className="text-blue-600 text-sm font-medium ml-1">{t('site_edit_dates')}</Text>
              </TouchableOpacity>
            )}
          </View>
          <View className="py-1">
            <Text className="text-sm text-gray-600">{t('site_start_date')}: <Text className="font-medium text-gray-900">{currentSite.startDate ? formatDateLabel(currentSite.startDate.slice(0, 10)) : '—'}</Text></Text>
            <Text className="text-sm text-gray-600 mt-1">{t('site_expected_end_date')}: <Text className="font-medium text-gray-900">{currentSite.expectedEndDate ? formatDateLabel(currentSite.expectedEndDate.slice(0, 10)) : '—'}</Text></Text>
            {currentSite.status === 'completed' && currentSite.actualCompletedAt && (
              <Text className="text-sm text-gray-600 mt-1">{t('site_actual_completed')}: <Text className="font-medium text-gray-900">{formatDateLabel(currentSite.actualCompletedAt.slice(0, 10))}</Text></Text>
            )}
          </View>
          {isOnTime !== null && (
            <View className="mt-2 pt-2 border-t border-gray-100">
              <Text className={`text-sm font-semibold ${isOnTime ? 'text-green-600' : 'text-amber-600'}`}>
                {isOnTime ? t('site_on_time') : t('site_delayed')}
              </Text>
            </View>
          )}
        </Card>

        <Card className="mb-4">
          <Text className="text-base font-semibold text-gray-900 mb-1">{t('sites_budget_history')}</Text>
          <Text className="text-sm text-blue-600 font-medium mb-2">{t('sites_total_allocated')}: {formatAmount(currentSite.budget, true)}</Text>
          {(() => {
            const siteAllocs = budgetAllocations.filter((a) => a.siteId === currentSite.id);
            const sumFromRows = siteAllocs.reduce((s, a) => s + a.amountRwf, 0);
            const initialShortfall = currentSite.budget > sumFromRows ? currentSite.budget - sumFromRows : 0;
            const displayList: { id: string; amountRwf: number; allocatedAt: string; isInitial?: boolean }[] = [
              ...siteAllocs.map((a) => ({ id: a.id, amountRwf: a.amountRwf, allocatedAt: a.allocatedAt })),
            ];
            if (initialShortfall > 0) {
              displayList.push({
                id: 'initial',
                amountRwf: initialShortfall,
                allocatedAt: currentSite.startDate ? new Date(currentSite.startDate + 'T00:00:00').toISOString() : new Date(0).toISOString(),
                isInitial: true,
              });
            }
            if (displayList.length === 0) {
              return (
                <Text className="text-sm text-gray-500 italic">
                  {currentSite.budget > 0 ? formatAmount(currentSite.budget, true) + ' (initial)' : '—'}
                </Text>
              );
            }
            displayList.sort((a, b) => new Date(b.allocatedAt).getTime() - new Date(a.allocatedAt).getTime());
            return displayList.map((a) => (
              <View key={a.id} className="flex-row justify-between py-2 border-b border-gray-100">
                <Text className="text-sm text-gray-600">
                  {a.isInitial
                    ? t('sites_initial_budget_row')
                    : new Date(a.allocatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </Text>
                <Text className="text-sm font-semibold text-gray-900">{formatAmount(a.amountRwf, true)}</Text>
              </View>
            ));
          })()}
        </Card>

        {isHeadSupervisor && (
          <>
            <Text className="text-lg font-bold text-gray-900 mb-2">{t('site_assignments')}</Text>
            <Text className="text-sm text-gray-500 mb-3">{t('site_available_only_hint')}</Text>

            <Card className="mb-3">
              <Text className="text-sm text-gray-600 mb-2">{t('site_assistant_supervisor')} ({t('site_one_or_more')})</Text>
              <View className="flex-row flex-wrap gap-2">
                {assignableByRole.assistant_supervisor.map((u) => (
                  <Pressable
                    key={u.id}
                    onPress={() => toggleSelection(setSelectedAssistants, u.id)}
                    className={`px-3 py-2 rounded-lg ${selectedAssistants.includes(u.id) ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <Text className={selectedAssistants.includes(u.id) ? 'text-white font-medium' : 'text-gray-700'}>{u.name}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>

            <Card className="mb-3">
              <Text className="text-sm text-gray-600 mb-2">{t('site_surveyor')} ({t('site_one_or_more')})</Text>
              <View className="flex-row flex-wrap gap-2">
                {assignableByRole.surveyor.map((u) => (
                  <Pressable
                    key={u.id}
                    onPress={() => toggleSelection(setSelectedSurveyors, u.id)}
                    className={`px-3 py-2 rounded-lg ${selectedSurveyors.includes(u.id) ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <Text className={selectedSurveyors.includes(u.id) ? 'text-white font-medium' : 'text-gray-700'}>{u.name}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>

            <Card className="mb-3">
              <Text className="text-sm text-gray-600 mb-2">{t('site_vehicles_for_site')}</Text>
              <FilterChips
                options={vehiclesFilterOptions}
                value={vehicleTypeFilter}
                onChange={(val) => setVehicleTypeFilter(val as VehicleTypeFilter)}
                scroll={false}
              />
              <View className="flex-row flex-wrap gap-2 mt-3">
                {filteredAssignableVehicles.length === 0 ? (
                  <Text className="text-sm text-gray-500 italic">{t('site_no_vehicles_available')}</Text>
                ) : (
                  filteredAssignableVehicles.map((v) => (
                    <Pressable
                      key={v.id}
                      onPress={() => toggleVehicle(v.id)}
                      className={`px-3 py-2 rounded-lg ${selectedVehicleIds.includes(v.id) ? 'bg-blue-600' : 'bg-gray-200'}`}
                    >
                      <Text className={selectedVehicleIds.includes(v.id) ? 'text-white font-medium' : 'text-gray-700'}>
                        {v.vehicleNumberOrId}
                        <Text className={selectedVehicleIds.includes(v.id) ? ' text-blue-100 text-xs' : ' text-gray-500 text-xs'}>
                          {' '}({v.type === 'truck' ? t('site_vehicle_type_truck') : t('site_vehicle_type_machine')})
                        </Text>
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            </Card>

            <Card className="mb-3">
              <Text className="text-sm font-semibold text-gray-900 mb-2">{t('site_trucks_section')}</Text>
              {assignableTrucks.filter((v) => selectedVehicleIds.includes(v.id)).length === 0 ? (
                <Text className="text-sm text-gray-500 italic">{t('site_no_vehicles_available')}</Text>
              ) : (
                assignableTrucks
                  .filter((v) => selectedVehicleIds.includes(v.id))
                  .map((v) => (
                    <View key={v.id} className="mb-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
                      <Text className="text-sm font-semibold text-gray-800 mb-2">{v.vehicleNumberOrId} — {t('site_assign_driver')}</Text>
                      <View className="flex-row flex-wrap gap-2">
                        <Pressable
                          onPress={() => setTruckDriver(v.id, '')}
                          className={`px-3 py-2 rounded-lg ${!vehicleDriverMap[v.id] ? 'bg-blue-600' : 'bg-gray-200'}`}
                        >
                          <Text className={!vehicleDriverMap[v.id] ? 'text-white font-medium' : 'text-gray-600'}>{t('site_no_driver')}</Text>
                        </Pressable>
                        {assignableByRole.driver_truck.map((u) => {
                          const otherVid = alreadyAllocatedToOtherVehicle(u.id, v.id, vehicleDriverMap, truckIdsSelected);
                          const isCurrent = vehicleDriverMap[v.id] === u.id;
                          const isAllocatedElsewhere = otherVid != null;
                          const otherVehicle = otherVid ? assignableTrucks.find((x) => x.id === otherVid) : null;
                          const otherLabel = otherVehicle?.vehicleNumberOrId ?? otherVid;
                          return (
                            <Pressable
                              key={u.id}
                              onPress={() => {
                                if (isAllocatedElsewhere) {
                                  showToast(t('site_driver_already_allocated').replace('{vehicle}', otherLabel ?? ''));
                                  return;
                                }
                                setTruckDriver(v.id, u.id);
                              }}
                              className={`px-3 py-2 rounded-lg ${isCurrent ? 'bg-blue-600' : isAllocatedElsewhere ? 'bg-gray-100 opacity-80' : 'bg-gray-200'}`}
                            >
                              <Text className={isCurrent ? 'text-white font-medium' : isAllocatedElsewhere ? 'text-gray-500 text-sm' : 'text-gray-700'}>
                                {u.name}
                                {isAllocatedElsewhere ? ` (${t('site_already_on_vehicle').replace('{vehicle}', otherLabel ?? '')})` : ''}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ))
              )}
            </Card>

            <Card className="mb-3">
              <Text className="text-sm font-semibold text-gray-900 mb-2">{t('site_machines_section')}</Text>
              {assignableMachines.filter((v) => selectedVehicleIds.includes(v.id)).length === 0 ? (
                <Text className="text-sm text-gray-500 italic">{t('site_no_vehicles_available')}</Text>
              ) : (
                assignableMachines
                  .filter((v) => selectedVehicleIds.includes(v.id))
                  .map((v) => (
                    <View key={v.id} className="mb-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
                      <Text className="text-sm font-semibold text-gray-800 mb-2">{v.vehicleNumberOrId} — {t('site_assign_operator')}</Text>
                      <View className="flex-row flex-wrap gap-2">
                        <Pressable
                          onPress={() => setMachineOperator(v.id, '')}
                          className={`px-3 py-2 rounded-lg ${!vehicleOperatorMap[v.id] ? 'bg-blue-600' : 'bg-gray-200'}`}
                        >
                          <Text className={!vehicleOperatorMap[v.id] ? 'text-white font-medium' : 'text-gray-600'}>{t('site_no_operator')}</Text>
                        </Pressable>
                        {assignableByRole.driver_machine.map((u) => {
                          const otherVid = alreadyAllocatedToOtherVehicle(u.id, v.id, vehicleOperatorMap, machineIdsSelected);
                          const isCurrent = vehicleOperatorMap[v.id] === u.id;
                          const isAllocatedElsewhere = otherVid != null;
                          const otherVehicle = otherVid ? assignableMachines.find((x) => x.id === otherVid) : null;
                          const otherLabel = otherVehicle?.vehicleNumberOrId ?? otherVid;
                          return (
                            <Pressable
                              key={u.id}
                              onPress={() => {
                                if (isAllocatedElsewhere) {
                                  showToast(t('site_operator_already_allocated').replace('{vehicle}', otherLabel ?? ''));
                                  return;
                                }
                                setMachineOperator(v.id, u.id);
                              }}
                              className={`px-3 py-2 rounded-lg ${isCurrent ? 'bg-blue-600' : isAllocatedElsewhere ? 'bg-gray-100 opacity-80' : 'bg-gray-200'}`}
                            >
                              <Text className={isCurrent ? 'text-white font-medium' : isAllocatedElsewhere ? 'text-gray-500 text-sm' : 'text-gray-700'}>
                                {u.name}
                                {isAllocatedElsewhere ? ` (${t('site_already_on_vehicle').replace('{vehicle}', otherLabel ?? '')})` : ''}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ))
              )}
            </Card>

            <TouchableOpacity
              onPress={saveAssignments}
              disabled={savingAssignments}
              className={`rounded-lg py-3 items-center mt-2 ${savingAssignments ? 'bg-blue-400' : 'bg-blue-600'}`}
            >
              <Text className="text-white font-semibold">
                {savingAssignments ? t('site_saving_assignments') : t('site_save_assignments')}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {!isHeadSupervisor && (
          <Card>
            <Text className="text-gray-600">{t('site_assignment_managed_hint')}</Text>
          </Card>
        )}

        <Modal visible={editDatesVisible} transparent animationType="fade">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-center bg-black/50 px-4">
            <View className="bg-white rounded-2xl p-5 max-w-md w-full self-center shadow-xl">
              <Text className="text-lg font-bold text-gray-900 mb-4">{t('site_edit_dates')}</Text>
              <Input
                label={t('site_start_date')}
                value={editStartDate}
                onChangeText={setEditStartDate}
                placeholder="YYYY-MM-DD"
                containerStyle={{ marginBottom: 16 }}
                error={editDateErrors.startErrorKey ? t(editDateErrors.startErrorKey) : undefined}
              />
              <Input
                label={t('site_expected_end_date')}
                value={editExpectedEndDate}
                onChangeText={setEditExpectedEndDate}
                placeholder="YYYY-MM-DD"
                containerStyle={{ marginBottom: 20 }}
                error={editDateErrors.endErrorKey ? t(editDateErrors.endErrorKey) : undefined}
              />
              <View className="flex-row gap-3">
                <Pressable onPress={() => setEditDatesVisible(false)} className="flex-1 py-3 rounded-lg bg-gray-200 items-center">
                  <Text className="font-semibold text-gray-700">{t('general_cancel')}</Text>
                </Pressable>
                <Pressable onPress={onSaveDates} disabled={savingDates} className="flex-1 py-3 rounded-lg bg-blue-600 items-center">
                  <Text className="font-semibold text-white">{savingDates ? '...' : t('common_confirm')}</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
    </View>
  );
}
