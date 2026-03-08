import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import { Card } from '@/components/ui/Card';
import { TaskDetailScreen } from '@/components/tasks/TaskDetailScreen';
import { Header } from '@/components/ui/Header';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { colors, layout } from '@/theme/tokens';
import { Truck, CheckCircle2, Clock, AlertCircle, Phone, User, MapPin } from 'lucide-react-native';
import { ASSIGNED_TRIP_STATUS_LABELS, ASSIGNED_TRIP_STATUS_COLORS } from '@/lib/tripLifecycle';
import type { Task } from '@/types';
import type { DashboardNavProps } from '@/components/RoleBasedDashboard';

function normalizePhoneForTel(phone: string): string {
  const s = String(phone ?? '').trim();
  if (!s) return '';
  const hasPlus = s.startsWith('+');
  const digits = s.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

export function DriverDashboard(_props: DashboardNavProps = {}) {
  const { t } = useLocale();
  const { user } = useAuth();
  const { tasks, updateUser, sites, vehicles, driverVehicleAssignments, siteAssignments, users, assignedTrips } = useMockAppStore();
  const userId = user?.id ?? '';

  const myAssignedTrips = useMemo(() => {
    if (!userId) return [];
    return assignedTrips.filter((a) => a.driverId === userId && a.vehicleType === 'truck');
  }, [userId, assignedTrips]);

  const myAssignedTasks = useMemo(() => {
    if (!userId) return [];
    return assignedTrips.filter((a) => a.driverId === userId && a.vehicleType === 'machine');
  }, [userId, assignedTrips]);

  const isTruck = user?.role === 'driver_truck';

  // Report driver location on login when dashboard mounts (strict: every time driver is on app)
  useEffect(() => {
    const isDriver = user?.role === 'driver_truck' || user?.role === 'driver_machine';
    if (!userId || !isDriver) return;
    let mounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !mounted) return;
      const myTrips = tasks.filter((t) => t.assignedTo.includes(userId));
      const hasActiveTrip = myTrips.some((t) => t.status === 'in_progress');
      if (hasActiveTrip) return;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!mounted) return;
        await updateUser(userId, {
          lastLat: pos.coords.latitude,
          lastLon: pos.coords.longitude,
          locationUpdatedAt: new Date().toISOString(),
        });
      } catch { /* ignore location errors */ }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tasks used only to skip when driver has active trip
  }, [userId, user?.role, updateUser]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const listForSection = isTruck ? myAssignedTrips : myAssignedTasks;
  const getSiteName = (siteId: string) => sites.find((s) => s.id === siteId)?.name ?? siteId;
  const getVehicleLabel = (vehicleId: string) => vehicles.find((v) => v.id === vehicleId)?.vehicleNumberOrId ?? vehicleId;

  const myAllocations = useMemo(() => {
    if (!userId) return [];
    return driverVehicleAssignments
      .filter((a) => a.driverId === userId && (a.vehicleIds ?? []).length > 0)
      .map((a) => {
        const site = sites.find((s) => s.id === a.siteId);
        const vehicleEntries = (a.vehicleIds ?? [])
          .map((vid) => {
            const v = vehicles.find((ve) => ve.id === vid);
            const label = v?.vehicleNumberOrId ?? vid;
            const type = v?.type ?? 'truck';
            return { label, type };
          })
          .filter((x) => x.label);
        return { siteId: a.siteId, siteName: site?.name ?? a.siteId, vehicleEntries };
      });
  }, [userId, driverVehicleAssignments, sites, vehicles]);

  const managerUser = useMemo(() => {
    if (!userId || myAllocations.length === 0) return null;
    const siteIds = myAllocations.map((a) => a.siteId);
    let asId: string | undefined;
    const site = sites.find((s) => siteIds.includes(s.id) && s.assistantSupervisorId);
    asId = site?.assistantSupervisorId;
    if (!asId) {
      const assignment = siteAssignments.find(
        (a) => siteIds.includes(a.siteId) && a.role === 'assistant_supervisor'
      );
      asId = assignment?.userId;
    }
    if (!asId) return null;
    return users.find((u) => u.id === asId) ?? null;
  }, [userId, myAllocations, sites, siteAssignments, users]);

  const title = isTruck ? t('driver_trips_dashboard') : t('driver_tasks_dashboard');
  const subtitle = user?.name ? `${t('driver_welcome_back')}, ${user.name}` : (isTruck ? t('driver_truck_driver') : t('driver_machine_operator'));
  const sectionHeadingTripsOrTasks = isTruck ? t('driver_section_trips') : t('tab_tasks');

  if (selectedTask) {
    return (
      <TaskDetailScreen
        task={selectedTask}
        onBack={() => setSelectedTask(null)}
      />
    );
  }

  const pendingStatuses = ['TRIP_ASSIGNED', 'TRIP_PENDING', 'TASK_ASSIGNED', 'TASK_PENDING'];
  const inProgressStatuses = ['TRIP_STARTED', 'TRIP_PAUSED', 'TRIP_RESUMED', 'TRIP_IN_PROGRESS', 'TRIP_NEED_APPROVAL', 'TASK_STARTED', 'TASK_PAUSED', 'TASK_RESUMED', 'TASK_IN_PROGRESS', 'TASK_NEED_APPROVAL'];
  const completedStatuses = ['TRIP_COMPLETED', 'TASK_COMPLETED'];
  const pendingCount = listForSection.filter((a) => pendingStatuses.includes(a.status)).length;
  const inProgressCount = listForSection.filter((a) => inProgressStatuses.includes(a.status)).length;
  const completedCount = listForSection.filter((a) => completedStatuses.includes(a.status)).length;

  const stats = [
    {
      icon: <Clock size={20} color="#F59E0B" />,
      label: t('task_pending'),
      value: pendingCount,
      bg: 'bg-yellow-50',
    },
    {
      icon: <AlertCircle size={20} color="#3B82F6" />,
      label: t('task_in_progress'),
      value: inProgressCount,
      bg: 'bg-blue-50',
    },
    {
      icon: <CheckCircle2 size={20} color="#10B981" />,
      label: t('task_completed'),
      value: completedCount,
      bg: 'bg-green-50',
    },
  ];

  const frozenCard = myAllocations.length > 0 && (
    <Card style={styles.frozenCard}>
      <Text style={styles.frozenCardTitle}>{t('driver_your_allocated_vehicles')}</Text>
      {myAllocations.map((a, i) => (
        <View key={a.siteId + i} style={styles.vehicleRow}>
          <Truck size={16} color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={styles.vehicleLabel} numberOfLines={1}>
            {a.vehicleEntries.map((e) => `${e.label} - ${e.type === 'truck' ? t('driver_vehicle_type_truck') : t('driver_vehicle_type_machine')}`).join(', ')}
          </Text>
          <View style={styles.siteRow}>
            <MapPin size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
            <Text style={styles.siteName}>{a.siteName}</Text>
          </View>
        </View>
      ))}
      <View style={styles.managerInCard}>
        {managerUser ? (
          <>
            <View style={styles.managerRow}>
              <User size={18} color={colors.primary} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.managerName}>{managerUser.name}</Text>
                <Text style={styles.managerRole}>{t('driver_manager')}</Text>
              </View>
            </View>
            {managerUser.phone ? (
              <Pressable
                onPress={() => {
                  const tel = normalizePhoneForTel(managerUser.phone!);
                  if (tel) Linking.openURL(`tel:${tel}`).catch(() => {});
                }}
                style={({ pressed }) => [styles.callButton, pressed && styles.callButtonPressed]}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Phone size={20} color="#fff" style={styles.callButtonIcon} />
                <View style={styles.callButtonLabels}>
                  <Text style={styles.callButtonText}>{t('driver_call_manager')}</Text>
                  <Text style={styles.callButtonNumber} numberOfLines={1}>{managerUser.phone}</Text>
                </View>
              </Pressable>
            ) : (
              <View style={styles.noPhoneWrap}>
                <Phone size={16} color={colors.textMuted} style={{ marginRight: 6 }} />
                <Text style={styles.noPhoneText}>{t('dashboard_team_contact')}: —</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.managerRow}>
            <User size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
            <Text style={styles.managerNotAssigned}>{t('driver_manager_not_assigned')}</Text>
          </View>
        )}
      </View>
    </Card>
  );

  return (
    <View style={styles.screen}>
      <Header title={title} subtitle={subtitle} />
      {frozenCard ? <View style={styles.frozenWrap}>{frozenCard}</View> : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsRow}>
          {stats.map((stat, index) => (
            <Card key={index} className={`flex-1 ${stat.bg}`} style={{ paddingVertical: 8, paddingHorizontal: 8 }}>
              <View className="items-center">
                {stat.icon}
                <Text className="text-lg font-bold text-gray-900 mt-0.5">{stat.value}</Text>
                <Text className="text-xs text-gray-600">{stat.label}</Text>
              </View>
            </Card>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{sectionHeadingTripsOrTasks}</Text>
          {listForSection.length > 0 ? (
            listForSection.map((a) => (
              <Card key={a.id} style={styles.assignedItemCard}>
                <View style={styles.assignedItemRow}>
                  <Truck size={16} color={colors.primary} style={{ marginRight: 6 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.assignedItemVehicle}>{getVehicleLabel(a.vehicleId)}</Text>
                    <Text style={styles.assignedItemMeta}>{getSiteName(a.siteId)}{a.taskType ? ` • ${a.taskType}` : ''}</Text>
                    <View style={[styles.assignedItemBadge, { backgroundColor: (ASSIGNED_TRIP_STATUS_COLORS[a.status] ?? colors.primary) + '20' }]}>
                      <Text style={[styles.assignedItemBadgeText, { color: ASSIGNED_TRIP_STATUS_COLORS[a.status] ?? colors.primary }]}>
                        {ASSIGNED_TRIP_STATUS_LABELS[a.status]}
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            ))
          ) : (
            <EmptyState
              icon={<Truck size={48} color="#9CA3AF" />}
              title={isTruck ? t('driver_no_trips') : t('driver_no_tasks')}
              message={isTruck ? t('driver_no_trips_message') : t('driver_no_tasks_message')}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  frozenWrap: {
    paddingHorizontal: layout.screenPaddingHorz,
    paddingTop: layout.cardSpacingVertical,
    paddingBottom: 0,
  },
  frozenCard: {
    marginBottom: layout.cardSpacingVertical,
  },
  frozenCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  vehicleLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginRight: 8,
  },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  siteName: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  managerInCard: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  managerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minHeight: 48,
  },
  callButtonPressed: {
    opacity: 0.9,
  },
  callButtonIcon: {
    marginRight: 12,
  },
  callButtonLabels: {
    flex: 1,
    justifyContent: 'center',
  },
  callButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  callButtonNumber: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.95)',
    marginTop: 2,
  },
  noPhoneWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  noPhoneText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  managerNotAssigned: {
    fontSize: 14,
    color: colors.textMuted,
    flex: 1,
  },
  managerName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  managerRole: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPaddingHorz,
    paddingTop: layout.cardSpacingVertical,
    paddingBottom: layout.cardSpacingVertical * 2.5,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: layout.cardSpacingVertical,
    gap: 12,
  },
  section: {
    marginBottom: layout.cardSpacingVertical,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  assignedItemCard: {
    marginBottom: 8,
    padding: 10,
  },
  assignedItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  assignedItemVehicle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  assignedItemMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  assignedItemBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  assignedItemBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
