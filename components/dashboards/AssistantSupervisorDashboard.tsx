import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, TextInput, Alert, useWindowDimensions, ScrollView, Platform, Linking, Image } from 'react-native';
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
import type { Task, AssignedTrip, UserRole, Trip } from '@/types';
import type { DashboardNavProps } from '@/components/RoleBasedDashboard';
import { Users, Fuel, CheckCircle2, User, Phone, Truck, Pencil, PhoneCall, Percent, Wrench, BarChart3, FileText } from 'lucide-react-native';
import { DailyProductionChart } from '@/components/charts/DailyProductionChart';
import { generateId } from '@/lib/id';
import { getInitialStatusForVehicleType, getCompletedStatus, getEffectiveDurationHours, ASSIGNED_TRIP_STATUS_LABELS, ASSIGNED_TRIP_STATUS_COLORS } from '@/lib/tripLifecycle';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { AssignedTripApprovalModal } from '@/components/trips/AssignedTripApprovalModal';

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
const MIN_ASSIGN_FUEL_L = 1;
const LOW_FUEL_WARNING_L = 10;

export function AssistantSupervisorDashboard({ onNavigateTab }: DashboardNavProps = {}) {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  const { user } = useAuth();
  const { t } = useLocale();
  const { showToast } = useToast();
  const { sites, surveys, siteTasks: siteTasksAll, siteAssignments, users, driverVehicleAssignments, vehicles, assignedTrips, trips, machineSessions, addAssignedTrip, updateAssignedTripStatus, updateAssignedTrip, approveAssignedTripReadings, cleanupExpiredAssignedTripEvidence, updateUser } = useMockAppStore();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editPhoneUserId, setEditPhoneUserId] = useState<string | null>(null);
  const [editPhoneValue, setEditPhoneValue] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [assignTripModalVisible, setAssignTripModalVisible] = useState(false);
  const [assignTaskModalVisible, setAssignTaskModalVisible] = useState(false);
  const [tripApprovalModal, setTripApprovalModal] = useState<AssignedTrip | null>(null);
  const [assignVehicleId, setAssignVehicleId] = useState('');
  const [assignDriverId, setAssignDriverId] = useState('');
  const [assignTaskType, setAssignTaskType] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);
  const [selectedAssignedForDetail, setSelectedAssignedForDetail] = useState<AssignedTrip | null>(null);
  const [detailNotes, setDetailNotes] = useState('');
  const [detailStartReading, setDetailStartReading] = useState('');
  const [detailEndReading, setDetailEndReading] = useState('');
  const [detailManualFuel, setDetailManualFuel] = useState('');
  const [detailReviseMode, setDetailReviseMode] = useState(false);
  const [detailSubmitting, setDetailSubmitting] = useState(false);
  const [tripPhotoPreview, setTripPhotoPreview] = useState<{ uri: string; label: string } | null>(null);

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
    const siteIdNorm = normalizeId(assignedSite.id ?? '');
    const siteVehicles = vehicles.filter((v) => normalizeId(v.siteId ?? '') === siteIdNorm && v.type === 'truck');
    return siteVehicles
      .map((v) => {
        const assignment = driverVehicleAssignments.find(
          (a) => normalizeId(a.siteId) === siteIdNorm && (a.vehicleIds ?? []).includes(v.id)
        );
        const driverId = assignment?.driverId;
        const driver = driverId ? users.find((u) => normalizeId(u.id) === normalizeId(driverId)) : undefined;
        return { vehicleId: v.id, vehicle: v, driverId: driverId ?? '', driverName: driver?.name ?? '—' };
      })
      .filter((x) => x.driverId);
  }, [assignedSite, vehicles, driverVehicleAssignments, users]);

  const machinesWithDriver = useMemo(() => {
    if (!assignedSite) return [];
    const siteIdNorm = normalizeId(assignedSite.id ?? '');
    const siteVehicles = vehicles.filter((v) => normalizeId(v.siteId ?? '') === siteIdNorm && v.type === 'machine');
    return siteVehicles
      .map((v) => {
        const assignment = driverVehicleAssignments.find(
          (a) => normalizeId(a.siteId) === siteIdNorm && (a.vehicleIds ?? []).includes(v.id)
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

  const getCompletedTripForAssignment = useCallback(
    (a: AssignedTrip): Trip | undefined => {
      const byAssignment = trips
        .filter((t) => t.status === 'completed' && t.assignedTripId && normalizeId(t.assignedTripId) === normalizeId(a.id))
        .sort((x, y) => (y.endTime ?? '').localeCompare(x.endTime ?? ''));
      if (byAssignment.length > 0) return byAssignment[0];
      return trips
        .filter((t) => t.status === 'completed' && normalizeId(t.vehicleId) === normalizeId(a.vehicleId) && normalizeId(t.driverId) === normalizeId(a.driverId))
        .sort((x, y) => (y.endTime ?? '').localeCompare(x.endTime ?? ''))[0];
    },
    [trips]
  );

  const getCompletedSessionForAssignment = useCallback(
    (a: AssignedTrip) =>
      machineSessions
        .filter((m) => m.status === 'completed' && normalizeId(m.vehicleId) === normalizeId(a.vehicleId) && normalizeId(m.driverId) === normalizeId(a.driverId))
        .sort((x, y) => (y.endTime ?? '').localeCompare(x.endTime ?? ''))[0],
    [machineSessions]
  );

  const openAssignedDetail = useCallback(
    (a: AssignedTrip) => {
      setSelectedAssignedForDetail(a);
      setDetailNotes(a.notes ?? '');
      setDetailReviseMode(false);
      setDetailStartReading(a.startReading != null ? String(a.startReading) : '');
      setDetailEndReading(a.endReading != null ? String(a.endReading) : '');
      setDetailManualFuel(a.manualFuelOverrideL != null ? String(a.manualFuelOverrideL) : '');
    },
    []
  );

  const closeTripDetailModal = useCallback(() => {
    setSelectedAssignedForDetail(null);
    setDetailReviseMode(false);
  }, []);

  const selectedDetailContext = useMemo(() => {
    if (!selectedAssignedForDetail) return null;
    const a = selectedAssignedForDetail;
    const vehicle = vehicles.find((v) => v.id === a.vehicleId);
    const driver = users.find((u) => u.id === a.driverId);
    const site = sites.find((s) => s.id === a.siteId);
    const isTruck = a.vehicleType === 'truck';
    const trip = isTruck ? getCompletedTripForAssignment(a) : undefined;
    const session = !isTruck ? getCompletedSessionForAssignment(a) : undefined;
    const startPhotoUri = trip?.startPhotoUri ?? a.startPhotoUrl ?? null;
    const endPhotoUri = trip?.photoUri ?? a.endPhotoUrl ?? null;
    const startGpsLat = trip?.startLat ?? a.startGpsLat ?? null;
    const startGpsLng = trip?.startLon ?? a.startGpsLng ?? null;
    const endGpsLat = trip?.endLat ?? a.endGpsLat ?? null;
    const endGpsLng = trip?.endLon ?? a.endGpsLng ?? null;
    const startedAt = trip?.startTime ?? session?.startTime ?? a.startedAt ?? null;
    const endedAt = trip?.endTime ?? session?.endTime ?? a.endedAt ?? a.completedAt ?? null;
    const distanceKm = trip?.distanceKm ?? a.distanceKm ?? 0;
    const fuelUsed = trip?.fuelConsumed ?? session?.fuelConsumed ?? a.fuelUsedL ?? 0;
    let durationHours = 0;
    if (trip) durationHours = getEffectiveDurationHours(trip.startTime, trip.endTime ?? '', a.pauseSegments);
    else if (session) durationHours = (session.durationHours ?? (session.endTime && session.startTime ? (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60 * 60) : 0));
    return { a, vehicle, driver, site, isTruck, trip, session, startPhotoUri, endPhotoUri, startGpsLat, startGpsLng, endGpsLat, endGpsLng, startedAt, endedAt, distanceKm, fuelUsed, durationHours };
  }, [getCompletedSessionForAssignment, getCompletedTripForAssignment, selectedAssignedForDetail, sites, users, vehicles]);

  useEffect(() => {
    cleanupExpiredAssignedTripEvidence().catch(() => {});
  }, [cleanupExpiredAssignedTripEvidence]);

  const openInGoogleMaps = useCallback((lat?: number | null, lng?: number | null) => {
    if (lat == null || lng == null) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url).catch(() => {});
  }, []);

  const detailCalc = useMemo(() => {
    if (!selectedDetailContext?.vehicle) {
      return { valid: false, message: 'Vehicle missing', usage: 0, fuelUsed: 0, projectedFuel: null as number | null };
    }
    if (!selectedDetailContext.startPhotoUri || !selectedDetailContext.endPhotoUri) {
      return { valid: false, message: 'Start/end photos are required', usage: 0, fuelUsed: 0, projectedFuel: null as number | null };
    }
    if (
      selectedDetailContext.startGpsLat == null ||
      selectedDetailContext.startGpsLng == null ||
      selectedDetailContext.endGpsLat == null ||
      selectedDetailContext.endGpsLng == null
    ) {
      return { valid: false, message: 'Start/end GPS evidence is required', usage: 0, fuelUsed: 0, projectedFuel: null as number | null };
    }
    const start = parseFloat(detailStartReading);
    const end = parseFloat(detailEndReading);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      return { valid: false, message: 'Enter valid readings', usage: 0, fuelUsed: 0, projectedFuel: null as number | null };
    }
    if (start < 0 || end < 0) {
      return { valid: false, message: 'Readings must be non-negative', usage: 0, fuelUsed: 0, projectedFuel: null as number | null };
    }
    if (end < start) {
      return { valid: false, message: 'End reading must be >= start reading', usage: 0, fuelUsed: 0, projectedFuel: null as number | null };
    }
    const usage = Math.round((end - start) * 100) / 100;
    const vehicle = selectedDetailContext.vehicle;
    const rate = Number(vehicle.fuelRate ?? 0);
    if (!Number.isFinite(rate) || rate <= 0) {
      return { valid: false, message: 'Vehicle fuel rate is missing', usage, fuelUsed: 0, projectedFuel: null as number | null };
    }
    const calculatedFuel = selectedDetailContext.isTruck ? (usage / rate) : (usage * rate);
    const manual = parseFloat(detailManualFuel);
    const fuelUsed = !Number.isNaN(manual) && manual >= 0 ? manual : calculatedFuel;
    const prevFuel = Number(selectedDetailContext.a.fuelUsedL ?? selectedDetailContext.fuelUsed ?? 0);
    const projectedFuel = Number(vehicle.fuelBalanceLitre ?? 0) - (fuelUsed - prevFuel);
    if (projectedFuel < 0) {
      return { valid: false, message: 'Insufficient fuel balance for approval', usage, fuelUsed, projectedFuel };
    }
    return { valid: true, message: '', usage, fuelUsed, projectedFuel };
  }, [detailEndReading, detailManualFuel, detailStartReading, selectedDetailContext]);

  const getFuelStatus = useCallback((fuelBalanceLitre: number) => {
    if (fuelBalanceLitre <= MIN_ASSIGN_FUEL_L) return 'empty' as const;
    if (fuelBalanceLitre < LOW_FUEL_WARNING_L) return 'low' as const;
    return 'ok' as const;
  }, []);

  const selectedAssignVehicle = useMemo(
    () => vehicles.find((v) => v.id === assignVehicleId) ?? null,
    [assignVehicleId, vehicles]
  );
  const selectedAssignFuelStatus = getFuelStatus(Number(selectedAssignVehicle?.fuelBalanceLitre ?? 0));
  const selectedAssignBlocked = selectedAssignFuelStatus === 'empty';

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
    const vehicle = vehicles.find((v) => v.id === assignVehicleId);
    if (!vehicle) return;
    if (getFuelStatus(Number(vehicle.fuelBalanceLitre ?? 0)) === 'empty') {
      Alert.alert(t('alert_error'), 'E No FUEL. Add fuel entry before assigning this vehicle.');
      return;
    }
    if (vehicle.fuelMode !== 'km_per_l' || !(Number(vehicle.fuelRate ?? 0) > 0)) {
      Alert.alert(t('alert_error'), 'Truck fuel specification is missing (fuel mode/rate). Update vehicle specs first.');
      return;
    }
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
    const vehicle = vehicles.find((v) => v.id === assignVehicleId);
    if (!vehicle) return;
    if (getFuelStatus(Number(vehicle.fuelBalanceLitre ?? 0)) === 'empty') {
      Alert.alert(t('alert_error'), 'E No FUEL. Add fuel entry before assigning this vehicle.');
      return;
    }
    if (vehicle.fuelMode !== 'l_per_hour' || !(Number(vehicle.fuelRate ?? 0) > 0)) {
      Alert.alert(t('alert_error'), 'Machine fuel specification is missing (fuel mode/rate). Update vehicle specs first.');
      return;
    }
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
                    <TouchableOpacity key={a.id} activeOpacity={0.85} onPress={() => openAssignedDetail(a)}>
                      <Card style={styles.assignedCard}>
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
                            <>
                              <TouchableOpacity
                                onPress={() => openAssignedDetail(a)}
                                style={[styles.confirmBtn, { backgroundColor: colors.textSecondary, marginRight: 8 }]}
                              >
                                <FileText size={16} color="#fff" style={{ marginRight: 6 }} />
                                <Text style={styles.confirmBtnText}>{t('assigned_trip_view_details')}</Text>
                              </TouchableOpacity>
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
                            </>
                          )}
                        </View>
                      </Card>
                    </TouchableOpacity>
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
                    <TouchableOpacity key={a.id} activeOpacity={0.85} onPress={() => openAssignedDetail(a)}>
                      <Card style={styles.assignedCard}>
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
                            <>
                              <TouchableOpacity
                                onPress={() => openAssignedDetail(a)}
                                style={[styles.confirmBtn, { backgroundColor: colors.textSecondary, marginRight: 8 }]}
                              >
                                <FileText size={16} color="#fff" style={{ marginRight: 6 }} />
                                <Text style={styles.confirmBtnText}>{t('assigned_trip_view_details')}</Text>
                              </TouchableOpacity>
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
                            </>
                          )}
                        </View>
                      </Card>
                    </TouchableOpacity>
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

      <Modal visible={selectedAssignedForDetail != null} transparent animationType="fade" onRequestClose={closeTripDetailModal}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdropFill} onPress={closeTripDetailModal} />
          {selectedDetailContext && (
            <View style={[styles.tripDetailSheet, isTablet && styles.tripDetailSheetTablet]}>
              <View style={styles.tripDetailHeader}>
                <Text style={styles.tripDetailTitle}>{t('trip_detail_title')}</Text>
                <Text style={styles.tripDetailSubtitle}>
                  {(selectedDetailContext.vehicle?.vehicleNumberOrId ?? selectedDetailContext.a.vehicleId)} • {(selectedDetailContext.site?.name ?? selectedDetailContext.a.siteId)}
                </Text>
              </View>

              <ScrollView
                style={styles.tripDetailScroll}
                contentContainerStyle={styles.tripDetailScrollContent}
                showsVerticalScrollIndicator
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.tripDetailHero}>
                  <View style={styles.tripDetailHeroTextWrap}>
                    <Text style={styles.tripDetailHeroPrimary}>{selectedDetailContext.driver?.name ?? selectedDetailContext.a.driverId}</Text>
                    <Text style={styles.tripDetailHeroSecondary}>{t('trip_detail_driver')}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: ASSIGNED_TRIP_STATUS_COLORS[selectedDetailContext.a.status] + '20' }]}>
                    <Text style={[styles.statusBadgeText, { color: ASSIGNED_TRIP_STATUS_COLORS[selectedDetailContext.a.status] }]}>
                      {ASSIGNED_TRIP_STATUS_LABELS[selectedDetailContext.a.status]}
                    </Text>
                  </View>
                </View>

                <View style={styles.tripMetricCard}>
                  <Text style={styles.modalHint}>{t('trip_detail_start_time')}</Text>
                  <Text style={styles.tripMetricValue}>
                    {selectedDetailContext.startedAt ? new Date(selectedDetailContext.startedAt).toLocaleString() : '—'}
                  </Text>
                </View>
                <View style={styles.tripMetricCard}>
                  <Text style={styles.modalHint}>{t('trip_detail_end_time')}</Text>
                  <Text style={styles.tripMetricValue}>
                    {selectedDetailContext.endedAt ? new Date(selectedDetailContext.endedAt).toLocaleString() : '—'}
                  </Text>
                </View>
                <View style={styles.tripMetricCard}>
                  <Text style={styles.modalHint}>{t('trip_detail_duration')}</Text>
                  <Text style={styles.tripMetricValue}>{selectedDetailContext.durationHours > 0 ? `${selectedDetailContext.durationHours.toFixed(1)} h` : '—'}</Text>
                </View>

                <View style={styles.tripMetricCard}>
                  <Text style={styles.modalHint}>{selectedDetailContext.isTruck ? 'Before Odometer (km)' : 'Before Hour Meter'}</Text>
                  <TextInput style={styles.tripMetricInput} value={detailStartReading} onChangeText={setDetailStartReading} placeholder="0" keyboardType="decimal-pad" />
                </View>
                <View style={styles.tripMetricCard}>
                  <Text style={styles.modalHint}>{selectedDetailContext.isTruck ? 'After Odometer (km)' : 'After Hour Meter'}</Text>
                  <TextInput style={styles.tripMetricInput} value={detailEndReading} onChangeText={setDetailEndReading} placeholder="0" keyboardType="decimal-pad" />
                </View>
                <View style={styles.tripMetricCard}>
                  <Text style={styles.modalHint}>Manual Fuel Override (L) - Optional</Text>
                  <TextInput style={styles.tripMetricInput} value={detailManualFuel} onChangeText={setDetailManualFuel} placeholder="Auto from readings" keyboardType="decimal-pad" />
                </View>
                <View style={styles.tripMetricCard}>
                  <Text style={styles.modalHint}>{selectedDetailContext.isTruck ? 'Distance (km)' : 'Hours Used'}</Text>
                  <Text style={styles.tripMetricValue}>{detailCalc.usage.toFixed(2)}</Text>
                </View>
                <View style={styles.tripMetricCard}>
                  <Text style={styles.modalHint}>Fuel Used (L)</Text>
                  <Text style={styles.tripMetricValue}>{detailCalc.fuelUsed.toFixed(2)}</Text>
                </View>
                <View style={styles.tripMetricCard}>
                  <Text style={styles.modalHint}>Projected Fuel Balance (L)</Text>
                  <Text style={styles.tripMetricValue}>{detailCalc.projectedFuel != null ? detailCalc.projectedFuel.toFixed(2) : '—'}</Text>
                </View>

                {selectedDetailContext.isTruck && (
                  <View style={styles.tripMetricCard}>
                    <Text style={styles.modalHint}>{t('trip_approval_photos')}</Text>
                    <View style={styles.photoGrid}>
                      <View style={styles.photoCell}>
                        <Text style={styles.photoLabel}>{t('trip_approval_start_photo')}</Text>
                        {selectedDetailContext.startPhotoUri ? (
                          <TouchableOpacity onPress={() => setTripPhotoPreview({ uri: selectedDetailContext.startPhotoUri!, label: t('trip_approval_start_photo') })} activeOpacity={0.85}>
                            <Image source={{ uri: selectedDetailContext.startPhotoUri }} style={styles.photoThumb} resizeMode="cover" />
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.photoPlaceholder}>
                            <Text style={styles.photoPlaceholderText}>{t('trip_approval_no_photos')}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.photoCell}>
                        <Text style={styles.photoLabel}>{t('trip_approval_end_photo')}</Text>
                        {selectedDetailContext.endPhotoUri ? (
                          <TouchableOpacity onPress={() => setTripPhotoPreview({ uri: selectedDetailContext.endPhotoUri!, label: t('trip_approval_end_photo') })} activeOpacity={0.85}>
                            <Image source={{ uri: selectedDetailContext.endPhotoUri }} style={styles.photoThumb} resizeMode="cover" />
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.photoPlaceholder}>
                            <Text style={styles.photoPlaceholderText}>{t('trip_approval_no_photos')}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.tripMetricCard}>
                  <Text style={styles.modalHint}>GPS Evidence</Text>
                  <Text style={styles.tripMetricValue}>
                    Start: {selectedDetailContext.startGpsLat != null && selectedDetailContext.startGpsLng != null ? `${selectedDetailContext.startGpsLat.toFixed(5)}, ${selectedDetailContext.startGpsLng.toFixed(5)}` : '—'}
                  </Text>
                  <Text style={[styles.tripMetricValue, { marginTop: 6 }]}>
                    End: {selectedDetailContext.endGpsLat != null && selectedDetailContext.endGpsLng != null ? `${selectedDetailContext.endGpsLat.toFixed(5)}, ${selectedDetailContext.endGpsLng.toFixed(5)}` : '—'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity
                      onPress={() => openInGoogleMaps(selectedDetailContext.startGpsLat, selectedDetailContext.startGpsLng)}
                      disabled={selectedDetailContext.startGpsLat == null || selectedDetailContext.startGpsLng == null}
                      style={[styles.modalCancel, selectedDetailContext.startGpsLat == null && { opacity: 0.4 }]}
                    >
                      <Text style={styles.modalCancelText}>Open Start in Maps</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => openInGoogleMaps(selectedDetailContext.endGpsLat, selectedDetailContext.endGpsLng)}
                      disabled={selectedDetailContext.endGpsLat == null || selectedDetailContext.endGpsLng == null}
                      style={[styles.modalCancel, selectedDetailContext.endGpsLat == null && { opacity: 0.4 }]}
                    >
                      <Text style={styles.modalCancelText}>Open End in Maps</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.tripMetricCard}>
                  <Text style={styles.modalHint}>{t('trip_detail_notes')}</Text>
                  <TextInput
                    style={[styles.tripMetricInput, { minHeight: 82 }]}
                    value={detailNotes}
                    onChangeText={setDetailNotes}
                    placeholder={t('trip_detail_notes')}
                    placeholderTextColor={colors.textMuted}
                    editable={detailReviseMode}
                    multiline
                  />
                </View>
              </ScrollView>

              <View style={styles.tripDetailFooter}>
                <Pressable onPress={closeTripDetailModal} style={styles.modalCancel}>
                  <Text style={styles.modalCancelText}>{t('common_cancel')}</Text>
                </Pressable>
                <TouchableOpacity onPress={() => setDetailReviseMode(!detailReviseMode)} style={[styles.modalCancel, { marginRight: 8 }]}>
                  <Text style={styles.modalCancelText}>{t('trip_detail_revise')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    if (!selectedDetailContext) return;
                    const { a } = selectedDetailContext;
                    setDetailSubmitting(true);
                    try {
                      if (!detailCalc.valid) {
                        Alert.alert(t('alert_error'), detailCalc.message);
                        return;
                      }
                      await approveAssignedTripReadings({
                        assignedTripId: a.id,
                        startReading: parseFloat(detailStartReading),
                        endReading: parseFloat(detailEndReading),
                        validationNotes: detailNotes,
                        manualFuelOverrideL: detailManualFuel.trim() ? parseFloat(detailManualFuel) : null,
                        overrideReason: detailManualFuel.trim() ? 'Manual override by assistant supervisor' : null,
                      });
                      showToast(t('assigned_trip_confirmed'));
                      closeTripDetailModal();
                    } catch (e) {
                      Alert.alert(t('alert_error'), (e as Error).message);
                    } finally {
                      setDetailSubmitting(false);
                    }
                  }}
                  disabled={detailSubmitting || !detailCalc.valid}
                  style={[styles.modalSave, { opacity: detailSubmitting ? 0.7 : 1 }]}
                >
                  <Text style={styles.modalSaveText}>{detailSubmitting ? '…' : t('trip_detail_submit')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={tripPhotoPreview != null} transparent animationType="fade" onRequestClose={() => setTripPhotoPreview(null)}>
        <Pressable style={styles.photoPreviewOverlay} onPress={() => setTripPhotoPreview(null)}>
          <Pressable style={styles.photoPreviewSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{tripPhotoPreview?.label ?? t('driver_photo_attached')}</Text>
            {tripPhotoPreview?.uri ? (
              <Image source={{ uri: tripPhotoPreview.uri }} style={styles.photoPreviewImage} resizeMode="contain" />
            ) : null}
            <View style={[styles.modalActions, { marginTop: spacing.sm }]}>
              <Pressable onPress={() => setTripPhotoPreview(null)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>{t('common_cancel')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
                (() => {
                  const fuel = Number(x.vehicle.fuelBalanceLitre ?? 0);
                  const fuelStatus = getFuelStatus(fuel);
                  return (
                <TouchableOpacity
                  key={x.vehicleId}
                  onPress={() => { setAssignVehicleId(x.vehicleId); setAssignDriverId(x.driverId); }}
                  style={[
                    styles.pickerItem,
                    assignVehicleId === x.vehicleId && styles.pickerItemActive,
                    fuelStatus === 'empty' && styles.pickerItemFuelEmpty,
                    fuelStatus === 'low' && styles.pickerItemFuelLow,
                  ]}
                >
                  <Text style={styles.pickerItemText}>{x.vehicle.vehicleNumberOrId}</Text>
                  <Text style={styles.pickerItemSub}>{x.driverName}</Text>
                  <Text style={styles.pickerFuelReadOnly}>Fuel: {fuel.toFixed(1)} L</Text>
                  {fuelStatus === 'low' ? <Text style={styles.fuelLowText}>[!] Low fuel (below 10L)</Text> : null}
                  {fuelStatus === 'empty' ? <Text style={styles.fuelEmptyText}>E No FUEL (0-1L). Assignment blocked.</Text> : null}
                </TouchableOpacity>
                  );
                })()
              ))}
            </View>
            {selectedAssignVehicle ? (
              <Text style={[styles.assignFuelBanner, selectedAssignFuelStatus === 'empty' ? styles.fuelEmptyText : selectedAssignFuelStatus === 'low' ? styles.fuelLowText : styles.fuelOkText]}>
                {selectedAssignFuelStatus === 'empty'
                  ? 'E No FUEL. Please add fuel entry before assigning.'
                  : selectedAssignFuelStatus === 'low'
                    ? `Caution: ${Number(selectedAssignVehicle.fuelBalanceLitre ?? 0).toFixed(1)}L available (below 10L).`
                    : `Fuel available: ${Number(selectedAssignVehicle.fuelBalanceLitre ?? 0).toFixed(1)}L`}
              </Text>
            ) : null}
            <Text style={styles.modalHint}>{t('assigned_trip_task_type')}</Text>
            <TextInput style={styles.modalInput} value={assignTaskType} onChangeText={setAssignTaskType} placeholder={t('assigned_trip_task_type_placeholder')} placeholderTextColor={colors.textMuted} />
            <Text style={styles.modalHint}>{t('assigned_trip_notes')}</Text>
            <TextInput style={styles.modalInput} value={assignNotes} onChangeText={setAssignNotes} placeholder={t('assigned_trip_notes_placeholder')} placeholderTextColor={colors.textMuted} multiline />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setAssignTripModalVisible(false)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>{t('common_cancel')}</Text>
              </Pressable>
              <Pressable onPress={saveAssignTrip} disabled={assignSaving || !assignVehicleId || selectedAssignBlocked} style={[styles.modalSave, (assignSaving || !assignVehicleId || selectedAssignBlocked) && styles.modalSaveDisabled]}>
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
                (() => {
                  const fuel = Number(x.vehicle.fuelBalanceLitre ?? 0);
                  const fuelStatus = getFuelStatus(fuel);
                  return (
                <TouchableOpacity
                  key={x.vehicleId}
                  onPress={() => { setAssignVehicleId(x.vehicleId); setAssignDriverId(x.driverId); }}
                  style={[
                    styles.pickerItem,
                    assignVehicleId === x.vehicleId && styles.pickerItemActive,
                    fuelStatus === 'empty' && styles.pickerItemFuelEmpty,
                    fuelStatus === 'low' && styles.pickerItemFuelLow,
                  ]}
                >
                  <Text style={styles.pickerItemText}>{x.vehicle.vehicleNumberOrId}</Text>
                  <Text style={styles.pickerItemSub}>{x.driverName}</Text>
                  <Text style={styles.pickerFuelReadOnly}>Fuel: {fuel.toFixed(1)} L</Text>
                  {fuelStatus === 'low' ? <Text style={styles.fuelLowText}>[!] Low fuel (below 10L)</Text> : null}
                  {fuelStatus === 'empty' ? <Text style={styles.fuelEmptyText}>E No FUEL (0-1L). Assignment blocked.</Text> : null}
                </TouchableOpacity>
                  );
                })()
              ))}
            </View>
            {selectedAssignVehicle ? (
              <Text style={[styles.assignFuelBanner, selectedAssignFuelStatus === 'empty' ? styles.fuelEmptyText : selectedAssignFuelStatus === 'low' ? styles.fuelLowText : styles.fuelOkText]}>
                {selectedAssignFuelStatus === 'empty'
                  ? 'E No FUEL. Please add fuel entry before assigning.'
                  : selectedAssignFuelStatus === 'low'
                    ? `Caution: ${Number(selectedAssignVehicle.fuelBalanceLitre ?? 0).toFixed(1)}L available (below 10L).`
                    : `Fuel available: ${Number(selectedAssignVehicle.fuelBalanceLitre ?? 0).toFixed(1)}L`}
              </Text>
            ) : null}
            <Text style={styles.modalHint}>{t('assigned_trip_task_type')}</Text>
            <TextInput style={styles.modalInput} value={assignTaskType} onChangeText={setAssignTaskType} placeholder={t('assigned_trip_task_type_placeholder')} placeholderTextColor={colors.textMuted} />
            <Text style={styles.modalHint}>{t('assigned_trip_notes')}</Text>
            <TextInput style={styles.modalInput} value={assignNotes} onChangeText={setAssignNotes} placeholder={t('assigned_trip_notes_placeholder')} placeholderTextColor={colors.textMuted} multiline />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setAssignTaskModalVisible(false)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>{t('common_cancel')}</Text>
              </Pressable>
              <Pressable onPress={saveAssignTask} disabled={assignSaving || !assignVehicleId || selectedAssignBlocked} style={[styles.modalSave, (assignSaving || !assignVehicleId || selectedAssignBlocked) && styles.modalSaveDisabled]}>
                <Text style={styles.modalSaveText}>{assignSaving ? '…' : t('common_save')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {tripApprovalModal && (
        <AssignedTripApprovalModal
          visible={true}
          trip={tripApprovalModal}
          vehicle={vehicles.find((v) => v.id === tripApprovalModal.vehicleId) ?? null}
          onApprove={async (payload) => {
            const next = getCompletedStatus(tripApprovalModal.status);
            if (!next) return;
            await updateAssignedTripStatus(tripApprovalModal.id, next);
            await updateAssignedTrip(tripApprovalModal.id, {
              startReading: payload.startReading,
              endReading: payload.endReading,
              distanceKm: payload.distanceKm,
              hoursUsed: payload.hoursUsed,
              fuelUsedL: payload.fuelUsedL,
            });
            showToast(t('assigned_trip_confirmed'));
            setTripApprovalModal(null);
          }}
          onClose={() => setTripApprovalModal(null)}
        />
      )}

    </View>
  );
}

const elevatedCardShadow = Platform.select({
  web: { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' as const },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
})!;

const softCardShadow = Platform.select({
  web: { boxShadow: '0 1px 4px rgba(0,0,0,0.04)' as const },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
})!;

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
    flexWrap: 'wrap',
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
  pickerItemFuelLow: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  pickerItemFuelEmpty: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
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
  pickerFuelReadOnly: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  assignFuelBanner: {
    marginTop: -4,
    marginBottom: spacing.md,
    fontSize: 12,
    fontWeight: '700',
  },
  fuelLowText: {
    color: '#B45309',
  },
  fuelEmptyText: {
    color: '#B91C1C',
  },
  fuelOkText: {
    color: '#047857',
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
  photoGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 6,
  },
  photoCell: {
    flex: 1,
  },
  photoLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
    fontWeight: '600',
  },
  photoThumb: {
    width: '100%',
    height: 120,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  photoPlaceholderText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    fontWeight: '600',
  },
  photoPreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  photoPreviewSheet: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  photoPreviewImage: {
    width: '100%',
    height: 360,
    backgroundColor: colors.gray100,
    borderRadius: radius.md,
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
    ...elevatedCardShadow,
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
    ...softCardShadow,
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
    ...softCardShadow,
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
  modalBackdropFill: {
    ...StyleSheet.absoluteFillObject,
  },
  tripDetailSheet: {
    width: '100%',
    maxWidth: 540,
    height: '86%',
    maxHeight: '90%',
    minHeight: 440,
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tripDetailSheetTablet: {
    maxWidth: 680,
  },
  tripDetailHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.gray50,
  },
  tripDetailTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.3,
  },
  tripDetailSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  tripDetailScroll: {
    flex: 1,
    minHeight: 220,
  },
  tripDetailScrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  tripDetailHero: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#eff6ff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  tripDetailHeroTextWrap: {
    flex: 1,
    minWidth: 0,
    marginRight: spacing.sm,
  },
  tripDetailHeroPrimary: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  tripDetailHeroSecondary: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  tripMetricCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  tripMetricValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  tripMetricInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: 16,
    color: colors.text,
    marginTop: 4,
    backgroundColor: colors.gray50,
  },
  tripDetailFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
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
  modalSaveDisabled: {
    opacity: 0.5,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.surface,
  },
});
