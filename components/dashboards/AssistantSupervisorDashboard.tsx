import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, TextInput, Alert, useWindowDimensions } from 'react-native';
import { Card } from '@/components/ui/Card';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskDetailScreen } from '@/components/tasks/TaskDetailScreen';
import { Header } from '@/components/ui/Header';
import { DashboardLayout } from '@/components/ui/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useToast } from '@/context/ToastContext';
import { formatAmount } from '@/lib/currency';
import { colors, spacing, radius } from '@/theme/tokens';
import { getRoleLabelKey } from '@/lib/rbac';
import type { Task, AssignedTrip, UserRole } from '@/types';
import type { DashboardNavProps } from '@/components/RoleBasedDashboard';
import { Users, Fuel, CheckCircle2, User, Phone, Truck, Pencil, PhoneCall, Percent, Wrench, BarChart3 } from 'lucide-react-native';
import { DailyProductionChart } from '@/components/charts/DailyProductionChart';
import { generateId } from '@/lib/id';
import { getInitialStatusForVehicleType, getCompletedStatus, ASSIGNED_TRIP_STATUS_LABELS, ASSIGNED_TRIP_STATUS_COLORS } from '@/lib/tripLifecycle';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Linking } from 'react-native';

function normalizeId(id: string) {
  return String(id ?? '').trim();
}

/** Normalize phone for tel: URI (Rwanda +250 and digits). */
function normalizePhoneForTel(phone: string): string {
  const s = String(phone ?? '').trim();
  if (!s) return '';
  const hasPlus = s.startsWith('+');
  const digits = s.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

/** Format ISO date string to locale-friendly short date (e.g. 4 Mar 2025). */
function formatSiteDate(iso: string | undefined): string {
  if (!iso || !iso.trim()) return '—';
  const d = new Date(iso.trim());
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Remaining days from today to expectedEndDate; null if no end date, negative = overdue. */
function getRemainingDays(expectedEndDate: string | undefined): number | null {
  if (!expectedEndDate || !expectedEndDate.trim()) return null;
  const end = new Date(expectedEndDate.trim());
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / 86400000);
}

const TABLET_BREAKPOINT = 600;

export function AssistantSupervisorDashboard({ onNavigateTab }: DashboardNavProps = {}) {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  const { user } = useAuth();
  const { t } = useLocale();
  const { showToast } = useToast();
  const { sites, surveys, siteTasks: siteTasksAll, siteAssignments, users, driverVehicleAssignments, vehicles, assignedTrips, addAssignedTrip, updateAssignedTripStatus, updateUser } = useMockAppStore();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editPhoneUserId, setEditPhoneUserId] = useState<string | null>(null);
  const [editPhoneValue, setEditPhoneValue] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [assignTripModalVisible, setAssignTripModalVisible] = useState(false);
  const [assignTaskModalVisible, setAssignTaskModalVisible] = useState(false);
  const [assignVehicleId, setAssignVehicleId] = useState('');
  const [assignDriverId, setAssignDriverId] = useState('');
  const [assignTaskType, setAssignTaskType] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);

  const siteIds = user?.siteAccess ?? [];
  const assignedSite = sites.find((s) => siteIds.includes(s.id) || s.assistantSupervisorId === user?.id) ?? sites[0] ?? null;
  const mySiteIds = assignedSite ? [assignedSite.id] : siteIds.length > 0 ? siteIds : sites.map((s) => s.id);
  const dailyProductionData = useMemo(() => {
    const approved = surveys.filter((s) => s.status === 'approved' && mySiteIds.includes(s.siteId));
    const byDate = new Map<string, number>();
    for (const s of approved) {
      const d = s.surveyDate.slice(0, 10);
      byDate.set(d, (byDate.get(d) ?? 0) + s.volumeM3);
    }
    return Array.from(byDate.entries())
      .map(([date, volumeM3]) => ({ date, volumeM3 }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [surveys, mySiteIds]);
  const TEMPLATE_ORDER = [
    'Pre-cut survey',
    'Land clearing',
    'Excavation',
    'Rock breaking',
    'Soil transport',
    'Leveling',
    'Compaction',
    'After-cut survey',
    'Final finishing',
  ];

  const siteTasks = useMemo(() => {
    if (!assignedSite) return [];
    const active = siteTasksAll.filter(
      (t) => t.siteId === assignedSite.id && (t.status === 'started' || t.status === 'in_progress')
    );
    return active
      .slice()
      .sort((a, b) => {
        const ia = TEMPLATE_ORDER.indexOf(a.taskName);
        const ib = TEMPLATE_ORDER.indexOf(b.taskName);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.taskName.localeCompare(b.taskName);
      });
  }, [assignedSite, siteTasksAll]);
  const remainingDays = assignedSite ? getRemainingDays(assignedSite.expectedEndDate) : null;

  const siteTrips = useMemo(() => {
    if (!assignedSite) return [];
    return assignedTrips.filter((a) => normalizeId(a.siteId) === normalizeId(assignedSite.id) && a.vehicleType === 'truck');
  }, [assignedSite, assignedTrips]);

  const siteAssignedTasks = useMemo(() => {
    if (!assignedSite) return [];
    return assignedTrips.filter((a) => normalizeId(a.siteId) === normalizeId(assignedSite.id) && a.vehicleType === 'machine');
  }, [assignedSite, assignedTrips]);

  const trucksWithDriver = useMemo(() => {
    if (!assignedSite) return [];
    const siteVehicles = vehicles.filter((v) => normalizeId(v.siteId) === normalizeId(assignedSite.id) && v.type === 'truck');
    return siteVehicles
      .map((v) => {
        const assignment = driverVehicleAssignments.find(
          (a) => normalizeId(a.siteId) === normalizeId(assignedSite.id) && (a.vehicleIds ?? []).includes(v.id)
        );
        const driverId = assignment?.driverId;
        const driver = driverId ? users.find((u) => normalizeId(u.id) === normalizeId(driverId)) : undefined;
        return { vehicleId: v.id, vehicle: v, driverId: driverId ?? '', driverName: driver?.name ?? '—' };
      })
      .filter((x) => x.driverId);
  }, [assignedSite, vehicles, driverVehicleAssignments, users]);

  const machinesWithDriver = useMemo(() => {
    if (!assignedSite) return [];
    const siteVehicles = vehicles.filter((v) => normalizeId(v.siteId) === normalizeId(assignedSite.id) && v.type === 'machine');
    return siteVehicles
      .map((v) => {
        const assignment = driverVehicleAssignments.find(
          (a) => normalizeId(a.siteId) === normalizeId(assignedSite.id) && (a.vehicleIds ?? []).includes(v.id)
        );
        const driverId = assignment?.driverId;
        const driver = driverId ? users.find((u) => normalizeId(u.id) === normalizeId(driverId)) : undefined;
        return { vehicleId: v.id, vehicle: v, driverId: driverId ?? '', driverName: driver?.name ?? '—' };
      })
      .filter((x) => x.driverId);
  }, [assignedSite, vehicles, driverVehicleAssignments, users]);

  const teamAtSite = useMemo(() => {
    if (!assignedSite) return [];
    const assignments = siteAssignments.filter((a) => a.siteId === assignedSite.id);
    const driverVehiclesByDriver: Record<string, string[]> = {};
    for (const a of driverVehicleAssignments) {
      if (a.siteId !== assignedSite.id) continue;
      driverVehiclesByDriver[a.driverId] = a.vehicleIds ?? [];
    }
    return assignments.map((a) => {
      const u = users.find((u) => normalizeId(u.id) === normalizeId(a.userId));
      const role = (a.role as UserRole) || u?.role;
      const vehicleIds = driverVehiclesByDriver[a.userId] ?? [];
      const vehicleLabels = vehicleIds
        .map((vid) => vehicles.find((v) => normalizeId(v.id) === normalizeId(vid))?.vehicleNumberOrId ?? vid)
        .filter(Boolean);
      const rawName = u?.name != null ? String(u.name).trim() : '';
      const name = (rawName && rawName !== 'null') ? rawName : (u?.email ?? '') || '—';
      return {
        userId: a.userId,
        name,
        role,
        phone: u?.phone != null && String(u.phone).trim() !== '' ? String(u.phone).trim() : null,
        vehicleAllocation: vehicleLabels.length > 0 ? vehicleLabels.join(', ') : null,
      };
    });
  }, [assignedSite, siteAssignments, users, driverVehicleAssignments, vehicles]);

  const openEditPhone = (member: { userId: string; phone: string | null }) => {
    setEditPhoneUserId(member.userId);
    setEditPhoneValue(member.phone ?? '');
  };

  const savePhone = async () => {
    if (editPhoneUserId == null) return;
    setSavingPhone(true);
    try {
      await updateUser(editPhoneUserId, { phone: editPhoneValue.trim() || undefined });
      setEditPhoneUserId(null);
      showToast(t('dashboard_phone_updated'));
    } catch {
      Alert.alert(t('alert_error'), t('dashboard_phone_update_failed'));
    } finally {
      setSavingPhone(false);
    }
  };

  const handleCall = (phone: string) => {
    const tel = normalizePhoneForTel(phone);
    if (tel) Linking.openURL(`tel:${tel}`);
  };

  const saveAssignTrip = async () => {
    if (!assignedSite || !assignVehicleId || !assignDriverId || !user?.id) return;
    setAssignSaving(true);
    try {
      const status = getInitialStatusForVehicleType('truck');
      const trip: AssignedTrip = {
        id: generateId('at'),
        siteId: assignedSite.id,
        vehicleId: assignVehicleId,
        driverId: assignDriverId,
        vehicleType: 'truck',
        taskType: assignTaskType.trim() || undefined,
        notes: assignNotes.trim() || undefined,
        status,
        createdBy: user.id,
        createdAt: new Date().toISOString(),
      };
      await addAssignedTrip(trip);
      showToast(t('assigned_trip_assigned'));
      setAssignTripModalVisible(false);
    } catch (e) {
      Alert.alert(t('alert_error'), (e as Error).message);
    } finally {
      setAssignSaving(false);
    }
  };

  const saveAssignTask = async () => {
    if (!assignedSite || !assignVehicleId || !assignDriverId || !user?.id) return;
    setAssignSaving(true);
    try {
      const status = getInitialStatusForVehicleType('machine');
      const task: AssignedTrip = {
        id: generateId('at'),
        siteId: assignedSite.id,
        vehicleId: assignVehicleId,
        driverId: assignDriverId,
        vehicleType: 'machine',
        taskType: assignTaskType.trim() || undefined,
        notes: assignNotes.trim() || undefined,
        status,
        createdBy: user.id,
        createdAt: new Date().toISOString(),
      };
      await addAssignedTrip(task);
      showToast(t('assigned_task_assigned'));
      setAssignTaskModalVisible(false);
    } catch (e) {
      Alert.alert(t('alert_error'), (e as Error).message);
    } finally {
      setAssignSaving(false);
    }
  };

  if (selectedTask) {
    return (
      <TaskDetailScreen
        task={selectedTask}
        onBack={() => setSelectedTask(null)}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <Header title={t('dashboard_assistant_title')} subtitle={t('dashboard_assistant_subtitle')} />
      <DashboardLayout>
        {assignedSite && (
          <Card style={[styles.siteCard, isTablet && styles.siteCardTablet]}>
            <Text style={[styles.sectionLabel, isTablet && styles.sectionLabelTablet]}>{t('dashboard_your_site')}</Text>
            <Text style={[styles.siteName, isTablet && styles.siteNameTablet]}>{assignedSite.name}</Text>

            <View style={[styles.siteDatesRow, isTablet && styles.siteDatesRowTablet]}>
              <View style={styles.siteDateBlock}>
                <Text style={[styles.siteDateLabel, isTablet && styles.siteDateLabelTablet]}>{t('dashboard_start_date')}</Text>
                <Text style={[styles.siteDateValue, isTablet && styles.siteDateValueTablet]}>{formatSiteDate(assignedSite.startDate)}</Text>
              </View>
              <View style={styles.siteDateBlock}>
                <Text style={[styles.siteDateLabel, isTablet && styles.siteDateLabelTablet]}>{t('dashboard_deadline')}</Text>
                <Text style={[styles.siteDateValue, isTablet && styles.siteDateValueTablet]}>{formatSiteDate(assignedSite.expectedEndDate)}</Text>
              </View>
              <View style={[styles.remainingDaysBlock, remainingDays !== null && remainingDays < 0 && styles.remainingDaysOverdue]}>
                <Text style={[styles.remainingDaysLabel, isTablet && styles.remainingDaysLabelTablet]}>{t('dashboard_remaining_days')}</Text>
                {remainingDays !== null ? (
                  remainingDays < 0 ? (
                    <Text style={[styles.remainingDaysValue, styles.remainingDaysValueOverdue]}>{t('dashboard_overdue')}</Text>
                  ) : (
                    <Text style={[styles.remainingDaysValue, isTablet && styles.remainingDaysValueTablet]}>{remainingDays}</Text>
                  )
                ) : (
                  <Text style={[styles.remainingDaysValue, styles.remainingDaysValueMuted]}>—</Text>
                )}
              </View>
            </View>

            <View style={[styles.siteStats, isTablet && styles.siteStatsTablet]}>
              <View style={styles.statBlock}>
                <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>{t('dashboard_total_investment')}</Text>
                <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>{formatAmount(assignedSite.budget ?? 0, true)}</Text>
              </View>
              <View style={styles.statBlock}>
                <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>{t('dashboard_spent')}</Text>
                <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>{formatAmount(assignedSite.spent ?? 0, true)}</Text>
              </View>
            </View>

            <View style={[styles.progressRow, isTablet && styles.progressRowTablet]}>
              <View style={styles.progressLabelRow}>
                <Percent size={16} color={colors.textSecondary} />
                <Text style={[styles.progressLabel, isTablet && styles.progressLabelTablet]}>{t('site_card_progress')}</Text>
                <Text style={[styles.progressValue, isTablet && styles.progressValueTablet]}>{Math.round(assignedSite.progress ?? 0)}%</Text>
              </View>
              <ProgressBar progress={assignedSite.progress ?? 0} showLabel={false} height={8} />
            </View>
          </Card>
        )}

        {assignedSite && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('dashboard_team_at_site')}</Text>
            {teamAtSite.length > 0 ? (
              teamAtSite.map((member) => (
                <Card key={member.userId} style={styles.teamCard}>
                  <View style={styles.teamRow}>
                    <View style={styles.teamIconWrap}>
                      <User size={20} color={colors.primary} />
                    </View>
                    <View style={styles.teamBody}>
                      <Text style={styles.teamName}>{member.name}</Text>
                      <View style={styles.teamMeta}>
                        <Text style={styles.teamRole}>{t(getRoleLabelKey(member.role as UserRole))}</Text>
                        <View style={styles.contactRow}>
                          <Phone size={14} color={colors.textSecondary} />
                          {member.phone ? (
                            <TouchableOpacity
                              onPress={() => handleCall(member.phone!)}
                              style={styles.callTouch}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.teamContactLink} selectable>{member.phone}</Text>
                              <PhoneCall size={14} color={colors.primary} style={{ marginLeft: 4 }} />
                            </TouchableOpacity>
                          ) : (
                            <Text style={styles.teamContactMuted}>{t('dashboard_team_contact')}: —</Text>
                          )}
                          <TouchableOpacity
                            onPress={() => openEditPhone(member)}
                            style={styles.editPhoneBtn}
                            hitSlop={8}
                          >
                            <Pencil size={14} color={colors.primary} />
                            <Text style={styles.editPhoneBtnText}>{t('dashboard_edit_phone')}</Text>
                          </TouchableOpacity>
                        </View>
                        {member.vehicleAllocation ? (
                          <View style={styles.vehicleRow}>
                            <Truck size={14} color={colors.textSecondary} />
                            <Text style={styles.teamVehicle}>{member.vehicleAllocation}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </Card>
              ))
            ) : (
              <Card style={styles.emptyCard}>
                <Users size={28} color={colors.textMuted} />
                <Text style={styles.emptyText}>{t('dashboard_no_team')}</Text>
              </Card>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dashboard_tasks_at_site')}</Text>
          {siteTasks.length > 0 ? (
            siteTasks.map((task) => {
              const pct = Math.max(1, Math.min(99, Math.round(task.progress ?? 0)));
              return (
                <Card key={task.id} style={styles.taskSummaryCard}>
                  <View style={styles.taskSummaryHeader}>
                    <Text style={styles.taskSummaryTitle}>{task.taskName}</Text>
                    <Text style={styles.taskSummaryPct}>{pct}%</Text>
                  </View>
                  <Text style={styles.taskSummaryMeta}>Weight: {task.weight}% • {task.status.toUpperCase()}</Text>
                  <View style={styles.taskSummaryBarWrap}>
                    <View style={styles.taskSummaryBarTrack}>
                      <View style={[styles.taskSummaryBarFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                </Card>
              );
            })
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>{t('dashboard_no_tasks_site')}</Text>
            </Card>
          )}
        </View>

        {assignedSite && (
          <>
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>{t('assigned_trips_trucks')}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setAssignVehicleId(trucksWithDriver[0]?.vehicleId ?? '');
                    setAssignDriverId(trucksWithDriver[0]?.driverId ?? '');
                    setAssignTaskType('');
                    setAssignNotes('');
                    setAssignTripModalVisible(true);
                  }}
                  style={styles.assignBtn}
                  disabled={trucksWithDriver.length === 0}
                >
                  <Truck size={18} color="#fff" />
                  <Text style={styles.assignBtnText}>{t('assigned_trip_assign_trip')}</Text>
                </TouchableOpacity>
              </View>
              {siteTrips.length > 0 ? (
                siteTrips.map((a) => {
                  const vehicle = vehicles.find((v) => v.id === a.vehicleId);
                  const driver = users.find((u) => u.id === a.driverId);
                  const isNeedApproval = a.status === 'TRIP_NEED_APPROVAL';
                  return (
                    <Card key={a.id} style={styles.assignedCard}>
                      <View style={styles.assignedRow}>
                        <View style={styles.assignedBody}>
                          <Text style={styles.assignedVehicle}>{vehicle?.vehicleNumberOrId ?? a.vehicleId}</Text>
                          <Text style={styles.assignedMeta}>{driver?.name ?? a.driverId} • {a.taskType || '—'}</Text>
                          <View style={[styles.statusBadge, { backgroundColor: ASSIGNED_TRIP_STATUS_COLORS[a.status] + '20' }]}>
                            <Text style={[styles.statusBadgeText, { color: ASSIGNED_TRIP_STATUS_COLORS[a.status] }]}>
                              {ASSIGNED_TRIP_STATUS_LABELS[a.status]}
                            </Text>
                          </View>
                        </View>
                        {isNeedApproval && (
                          <TouchableOpacity
                            onPress={async () => {
                              const next = getCompletedStatus(a.status);
                              if (next) {
                                try {
                                  await updateAssignedTripStatus(a.id, next);
                                  showToast(t('assigned_trip_confirmed'));
                                } catch (e) {
                                  Alert.alert(t('alert_error'), (e as Error).message);
                                }
                              }
                            }}
                            style={styles.confirmBtn}
                          >
                            <Text style={styles.confirmBtnText}>{t('assigned_trip_confirm')}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </Card>
                  );
                })
              ) : (
                <Card style={styles.emptyCard}>
                  <Truck size={28} color={colors.textMuted} />
                  <Text style={styles.emptyText}>{t('assigned_trips_no_trips')}</Text>
                </Card>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>{t('assigned_tasks_machines')}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setAssignVehicleId(machinesWithDriver[0]?.vehicleId ?? '');
                    setAssignDriverId(machinesWithDriver[0]?.driverId ?? '');
                    setAssignTaskType('');
                    setAssignNotes('');
                    setAssignTaskModalVisible(true);
                  }}
                  style={[styles.assignBtn, { backgroundColor: '#7c3aed' }]}
                  disabled={machinesWithDriver.length === 0}
                >
                  <Wrench size={18} color="#fff" />
                  <Text style={styles.assignBtnText}>{t('assigned_task_assign_task')}</Text>
                </TouchableOpacity>
              </View>
              {siteAssignedTasks.length > 0 ? (
                siteAssignedTasks.map((a) => {
                  const vehicle = vehicles.find((v) => v.id === a.vehicleId);
                  const driver = users.find((u) => u.id === a.driverId);
                  const isNeedApproval = a.status === 'TASK_NEED_APPROVAL';
                  return (
                    <Card key={a.id} style={styles.assignedCard}>
                      <View style={styles.assignedRow}>
                        <View style={styles.assignedBody}>
                          <Text style={styles.assignedVehicle}>{vehicle?.vehicleNumberOrId ?? a.vehicleId}</Text>
                          <Text style={styles.assignedMeta}>{driver?.name ?? a.driverId} • {a.taskType || '—'}</Text>
                          <View style={[styles.statusBadge, { backgroundColor: ASSIGNED_TRIP_STATUS_COLORS[a.status] + '20' }]}>
                            <Text style={[styles.statusBadgeText, { color: ASSIGNED_TRIP_STATUS_COLORS[a.status] }]}>
                              {ASSIGNED_TRIP_STATUS_LABELS[a.status]}
                            </Text>
                          </View>
                        </View>
                        {isNeedApproval && (
                          <TouchableOpacity
                            onPress={async () => {
                              const next = getCompletedStatus(a.status);
                              if (next) {
                                try {
                                  await updateAssignedTripStatus(a.id, next);
                                  showToast(t('assigned_trip_confirmed'));
                                } catch (e) {
                                  Alert.alert(t('alert_error'), (e as Error).message);
                                }
                              }
                            }}
                            style={styles.confirmBtn}
                          >
                            <Text style={styles.confirmBtnText}>{t('assigned_trip_confirm')}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </Card>
                  );
                })
              ) : (
                <Card style={styles.emptyCard}>
                  <Wrench size={28} color={colors.textMuted} />
                  <Text style={styles.emptyText}>{t('assigned_tasks_no_tasks')}</Text>
                </Card>
              )}
            </View>
          </>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dashboard_quick_actions')}</Text>
          <TouchableOpacity onPress={() => onNavigateTab?.('expenses')} activeOpacity={0.8}>
            <Card style={styles.actionCard}>
              <View style={styles.actionRow}>
                <View style={styles.actionIconWrap}>
                  <Fuel size={22} color="#059669" />
                </View>
                <View style={styles.actionBody}>
                  <Text style={styles.actionTitle}>{t('dashboard_expense_fuel_entry')}</Text>
                  <Text style={styles.actionHint}>{t('dashboard_use_expenses_tab')}</Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onNavigateTab?.('surveys')} activeOpacity={0.8}>
            <Card style={styles.actionCard}>
              <View style={styles.actionRow}>
                <View style={[styles.actionIconWrap, { backgroundColor: '#ede9fe' }]}>
                  <CheckCircle2 size={22} color="#7c3aed" />
                </View>
                <View style={styles.actionBody}>
                  <Text style={styles.actionTitle}>{t('dashboard_survey_approval')}</Text>
                  <Text style={styles.actionHint}>{t('dashboard_use_surveys_tab')}</Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <BarChart3 size={20} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>{t('dashboard_excavation_production')}</Text>
          </View>
          <Card style={{ padding: spacing.md }}>
            <Text style={[styles.actionHint, { marginBottom: 6 }]}>{t('dashboard_daily_production')}</Text>
            <DailyProductionChart
              data={dailyProductionData}
              maxBars={14}
              emptyMessage={t('dashboard_no_production_data')}
              onPressDate={onNavigateTab ? (date) => onNavigateTab('surveys', { filterByDate: date }) : undefined}
            />
          </Card>
        </View>
      </DashboardLayout>

      <Modal visible={editPhoneUserId != null} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setEditPhoneUserId(null)}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('dashboard_edit_phone')}</Text>
            <Text style={styles.modalHint}>{t('dashboard_phone_placeholder_rwanda')}</Text>
            <TextInput
              style={styles.phoneInput}
              value={editPhoneValue}
              onChangeText={setEditPhoneValue}
              placeholder={t('dashboard_phone_placeholder_rwanda')}
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditPhoneUserId(null)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>{t('common_cancel')}</Text>
              </Pressable>
              <Pressable onPress={savePhone} disabled={savingPhone} style={styles.modalSave}>
                <Text style={styles.modalSaveText}>{savingPhone ? '…' : t('dashboard_save_phone')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={assignTripModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setAssignTripModalVisible(false)}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('assigned_trip_assign_trip')}</Text>
            <Text style={styles.modalHint}>{t('assigned_trip_vehicle')}</Text>
            <View style={styles.pickerWrap}>
              {trucksWithDriver.map((x) => (
                <TouchableOpacity
                  key={x.vehicleId}
                  onPress={() => { setAssignVehicleId(x.vehicleId); setAssignDriverId(x.driverId); }}
                  style={[styles.pickerItem, assignVehicleId === x.vehicleId && styles.pickerItemActive]}
                >
                  <Text style={styles.pickerItemText}>{x.vehicle.vehicleNumberOrId}</Text>
                  <Text style={styles.pickerItemSub}>{x.driverName}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.modalHint}>{t('assigned_trip_task_type')}</Text>
            <TextInput style={styles.modalInput} value={assignTaskType} onChangeText={setAssignTaskType} placeholder={t('assigned_trip_task_type_placeholder')} placeholderTextColor={colors.textMuted} />
            <Text style={styles.modalHint}>{t('assigned_trip_notes')}</Text>
            <TextInput style={styles.modalInput} value={assignNotes} onChangeText={setAssignNotes} placeholder={t('assigned_trip_notes_placeholder')} placeholderTextColor={colors.textMuted} multiline />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setAssignTripModalVisible(false)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>{t('common_cancel')}</Text>
              </Pressable>
              <Pressable onPress={saveAssignTrip} disabled={assignSaving || !assignVehicleId} style={styles.modalSave}>
                <Text style={styles.modalSaveText}>{assignSaving ? '…' : t('common_save')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={assignTaskModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setAssignTaskModalVisible(false)}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('assigned_task_assign_task')}</Text>
            <Text style={styles.modalHint}>{t('assigned_trip_vehicle')}</Text>
            <View style={styles.pickerWrap}>
              {machinesWithDriver.map((x) => (
                <TouchableOpacity
                  key={x.vehicleId}
                  onPress={() => { setAssignVehicleId(x.vehicleId); setAssignDriverId(x.driverId); }}
                  style={[styles.pickerItem, assignVehicleId === x.vehicleId && styles.pickerItemActive]}
                >
                  <Text style={styles.pickerItemText}>{x.vehicle.vehicleNumberOrId}</Text>
                  <Text style={styles.pickerItemSub}>{x.driverName}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.modalHint}>{t('assigned_trip_task_type')}</Text>
            <TextInput style={styles.modalInput} value={assignTaskType} onChangeText={setAssignTaskType} placeholder={t('assigned_trip_task_type_placeholder')} placeholderTextColor={colors.textMuted} />
            <Text style={styles.modalHint}>{t('assigned_trip_notes')}</Text>
            <TextInput style={styles.modalInput} value={assignNotes} onChangeText={setAssignNotes} placeholder={t('assigned_trip_notes_placeholder')} placeholderTextColor={colors.textMuted} multiline />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setAssignTaskModalVisible(false)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>{t('common_cancel')}</Text>
              </Pressable>
              <Pressable onPress={saveAssignTask} disabled={assignSaving || !assignVehicleId} style={styles.modalSave}>
                <Text style={styles.modalSaveText}>{assignSaving ? '…' : t('common_save')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
    letterSpacing: 0.2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  assignBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  assignedCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  assignedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  assignedBody: { flex: 1, minWidth: 0 },
  assignedVehicle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  assignedMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    marginTop: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  confirmBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  pickerWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pickerItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pickerItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.blue50,
  },
  pickerItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  pickerItemSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  siteCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  siteCardTablet: {
    maxWidth: 720,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
  },
  siteName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  siteNameTablet: {
    fontSize: 24,
    marginBottom: spacing.lg,
  },
  siteDatesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  siteDatesRowTablet: {
    gap: spacing.xl,
    paddingVertical: spacing.lg,
  },
  siteDateBlock: {
    minWidth: 100,
  },
  siteDateLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  siteDateLabelTablet: {
    fontSize: 12,
  },
  siteDateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  siteDateValueTablet: {
    fontSize: 16,
  },
  remainingDaysBlock: {
    minWidth: 100,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.blue50,
    alignSelf: 'flex-start',
  },
  remainingDaysOverdue: {
    backgroundColor: colors.dangerBg,
  },
  remainingDaysLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  remainingDaysLabelTablet: {
    fontSize: 12,
  },
  remainingDaysValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  remainingDaysValueTablet: {
    fontSize: 22,
  },
  remainingDaysValueOverdue: {
    color: colors.dangerText,
  },
  remainingDaysValueMuted: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  siteStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  siteStatsTablet: {
    paddingTop: spacing.lg,
  },
  progressRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  progressRowTablet: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressLabelTablet: {
    fontSize: 13,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginLeft: 'auto',
  },
  progressValueTablet: {
    fontSize: 16,
  },
  statBlock: {},
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  statLabelTablet: {
    fontSize: 13,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  statValueTablet: {
    fontSize: 17,
  },
  sectionLabelTablet: {
    fontSize: 14,
  },
  teamCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  teamIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.blue50,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  teamBody: {
    flex: 1,
    minWidth: 0,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  teamMeta: {},
  teamRole: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 2,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 8,
  },
  callTouch: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamContactLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  teamContactMuted: {
    fontSize: 14,
    color: colors.textMuted,
  },
  editPhoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.blue50,
  },
  editPhoneBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 4,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  teamVehicle: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.gray50,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  taskSummaryCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  taskSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  taskSummaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  taskSummaryPct: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  taskSummaryMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  taskSummaryBarWrap: {
    marginTop: 2,
  },
  taskSummaryBarTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    overflow: 'hidden',
  },
  taskSummaryBarFill: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  actionCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  actionBody: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  actionHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  phoneInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  modalCancel: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  modalCancelText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  modalSave: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.surface,
  },
});
