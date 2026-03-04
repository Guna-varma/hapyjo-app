import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Alert,
} from 'react-native';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { formatAmount } from '@/lib/currency';
import type { Site } from '@/types';
import { ArrowLeft } from 'lucide-react-native';

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
    setSiteAssignment,
    removeSiteAssignment,
    setDriverVehicleAssignment,
    updateSite,
  } = useMockAppStore();
  const isHeadSupervisor = user?.role === 'head_supervisor';

  const siteVehicles = vehicles.filter((v) => v.siteId === site.id);

  // Only real roles per slot; exclude admin/owner by role and by display name (test accounts)
  const isExcludedFromDriverOperator = (u: { role: string; name?: string }) => {
    const roleExcluded = ['admin', 'owner', 'head_supervisor', 'accountant', 'assistant_supervisor', 'surveyor'].includes(u.role);
    const nameExcluded = (u.name ?? '').trim().toLowerCase() === 'admin' || (u.name ?? '').trim().toLowerCase() === 'owner';
    return roleExcluded || nameExcluded;
  };
  const assignableByRole = {
    assistant_supervisor: users.filter((u) => u.role === 'assistant_supervisor'),
    surveyor: users.filter((u) => u.role === 'surveyor'),
    driver_truck: users.filter((u) => u.role === 'driver_truck' && !isExcludedFromDriverOperator(u)),
    driver_machine: users.filter((u) => u.role === 'driver_machine' && !isExcludedFromDriverOperator(u)),
  };
  const assignmentsForSite = siteAssignments.filter((a) => a.siteId === site.id);

  const getAssignedUserIds = (role: string) =>
    assignmentsForSite.filter((a) => a.role === role).map((a) => a.userId);
  const getAssignedVehicleIds = () => {
    const row = assignmentsForSite.find((a) => a.role === 'assistant_supervisor');
    return row?.vehicleIds ?? [];
  };

  const [selectedAssistants, setSelectedAssistants] = useState<string[]>(() => getAssignedUserIds('assistant_supervisor'));
  const [selectedSurveyors, setSelectedSurveyors] = useState<string[]>(() => getAssignedUserIds('surveyor'));
  const [selectedDriverTrucks, setSelectedDriverTrucks] = useState<string[]>(() => getAssignedUserIds('driver_truck'));
  const [selectedDriverMachines, setSelectedDriverMachines] = useState<string[]>(() => getAssignedUserIds('driver_machine'));
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>(() => getAssignedVehicleIds());

  const allSelectedUserIds = [
    ...selectedAssistants,
    ...selectedSurveyors,
    ...selectedDriverTrucks,
    ...selectedDriverMachines,
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
    try {
      const roles = ['assistant_supervisor', 'surveyor', 'driver_truck', 'driver_machine'] as const;
      const selectedByRole = {
        assistant_supervisor: selectedAssistants,
        surveyor: selectedSurveyors,
        driver_truck: selectedDriverTrucks,
        driver_machine: selectedDriverMachines,
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
      if (!isHeadSupervisor) {
        for (const driverId of [...selectedDriverTrucks, ...selectedDriverMachines]) {
          await setDriverVehicleAssignment(site.id, driverId, selectedVehicleIds);
        }
      }
      await updateSite(site.id, {
        assistantSupervisorId: selectedAssistants[0] ?? undefined,
        surveyorId: selectedSurveyors[0] ?? undefined,
        driverIds: [...selectedDriverTrucks, ...selectedDriverMachines].length
          ? [...selectedDriverTrucks, ...selectedDriverMachines]
          : undefined,
        vehicleIds: selectedVehicleIds.length ? selectedVehicleIds : undefined,
      });
      onBack();
    } catch (e) {
      const message = (e instanceof Error ? e.message : null) || t('sites_save_assignments_failed');
      Alert.alert(t('alert_error'), message);
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
              try {
                for (const { userId } of usersAlreadyOnOtherSite) {
                  const other = siteAssignments.find((a) => a.userId === userId && a.siteId !== site.id);
                  if (other) await removeSiteAssignment(other.siteId, userId);
                }
                await performSave();
              } catch (e) {
                const message = (e instanceof Error ? e.message : null) || t('sites_save_assignments_failed');
                Alert.alert(t('alert_error'), message);
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
          <Text className="font-semibold text-gray-900 capitalize">{site.status}</Text>
          <View className="flex-row justify-between mt-2">
            <Text className="text-sm text-slate-600">{t('sites_budget')}: {formatAmount(site.budget, true)}</Text>
            <Text className="text-sm text-slate-600">{t('dashboard_spent')}: {formatAmount(site.spent, true)}</Text>
          </View>
        </Card>

        {isHeadSupervisor && (
          <>
            <Text className="text-lg font-bold text-gray-900 mb-2">{t('site_assignments')}</Text>

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
              <Text className="text-sm text-gray-600 mb-2">{t('site_driver_truck')} ({t('site_one_or_more')})</Text>
              <View className="flex-row flex-wrap gap-2">
                {assignableByRole.driver_truck.map((u) => (
                  <Pressable
                    key={u.id}
                    onPress={() => toggleSelection(setSelectedDriverTrucks, u.id)}
                    className={`px-3 py-2 rounded-lg ${selectedDriverTrucks.includes(u.id) ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <Text className={selectedDriverTrucks.includes(u.id) ? 'text-white font-medium' : 'text-gray-700'}>{u.name}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>

            <Card className="mb-3">
              <Text className="text-sm text-gray-600 mb-2">{t('site_driver_machine')} ({t('site_one_or_more')})</Text>
              <View className="flex-row flex-wrap gap-2">
                {assignableByRole.driver_machine.map((u) => (
                  <Pressable
                    key={u.id}
                    onPress={() => toggleSelection(setSelectedDriverMachines, u.id)}
                    className={`px-3 py-2 rounded-lg ${selectedDriverMachines.includes(u.id) ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <Text className={selectedDriverMachines.includes(u.id) ? 'text-white font-medium' : 'text-gray-700'}>{u.name}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>

<Card className="mb-3">
            <Text className="text-sm text-gray-600 mb-2">{t('site_vehicles_for_site')}</Text>
              <View className="flex-row flex-wrap gap-2">
                {siteVehicles.map((v) => (
                  <Pressable
                    key={v.id}
                    onPress={() => toggleVehicle(v.id)}
                    className={`px-3 py-2 rounded-lg ${selectedVehicleIds.includes(v.id) ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <Text className={selectedVehicleIds.includes(v.id) ? 'text-white font-medium' : 'text-gray-700'}>
                      {v.vehicleNumberOrId}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Card>

            <TouchableOpacity onPress={saveAssignments} className="bg-blue-600 rounded-lg py-3 items-center mt-2">
              <Text className="text-white font-semibold">{t('site_save_assignments')}</Text>
            </TouchableOpacity>
          </>
        )}

        {!isHeadSupervisor && (
          <Card>
            <Text className="text-gray-600">{t('site_assignment_managed_hint')}</Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
