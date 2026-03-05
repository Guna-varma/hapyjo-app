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
import type { Task } from '@/types';
import type { UserRole } from '@/types';
import type { DashboardNavProps } from '@/components/RoleBasedDashboard';
import { Users, Fuel, CheckCircle2, User, Phone, Truck, Pencil, PhoneCall } from 'lucide-react-native';
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
  const { sites, tasks, siteAssignments, users, driverVehicleAssignments, vehicles, updateUser } = useMockAppStore();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editPhoneUserId, setEditPhoneUserId] = useState<string | null>(null);
  const [editPhoneValue, setEditPhoneValue] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  const siteIds = user?.siteAccess ?? [];
  const assignedSite = sites.find((s) => siteIds.includes(s.id) || s.assistantSupervisorId === user?.id) ?? sites[0] ?? null;
  const siteTasks = assignedSite ? tasks.filter((taskItem) => taskItem.siteId === assignedSite.id) : [];
  const remainingDays = assignedSite ? getRemainingDays(assignedSite.expectedEndDate) : null;

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
            siteTasks.map((task) => (
              <TaskCard key={task.id} task={task} onPress={() => setSelectedTask(task)} />
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>{t('dashboard_no_tasks_site')}</Text>
            </Card>
          )}
        </View>

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
