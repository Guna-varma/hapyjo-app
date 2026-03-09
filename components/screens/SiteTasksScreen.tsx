import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Modal, Pressable, TextInput, TouchableOpacity, Alert } from 'react-native';
import Slider from '@react-native-community/slider';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FilterChips } from '@/components/ui/FilterChips';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { colors, radius, spacing, scrollConfig } from '@/theme/tokens';
import type { SiteTask, SiteTaskStatus } from '@/types';

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

function clampInt(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function onlyDigits(s: string) {
  return String(s ?? '').replace(/[^\d]/g, '');
}

function statusLabel(status: SiteTaskStatus) {
  switch (status) {
    case 'not_started':
      return 'NOT_STARTED';
    case 'started':
      return 'STARTED';
    case 'in_progress':
      return 'IN_PROGRESS';
    case 'completed':
      return 'COMPLETED';
  }
}

type SiteTasksScreenProps = {
  /** Optional: start focused on this site (e.g. when opened from dashboard). */
  initialSiteId?: string;
  /** Optional: force read-only mode even for editable roles. */
  readOnly?: boolean;
  /** Optional: back action (used when screen is opened from dashboards). */
  onBack?: () => void;
};

export function SiteTasksScreen({ initialSiteId, readOnly, onBack }: SiteTasksScreenProps = {}) {
  const { user } = useAuth();
  const { t } = useLocale();
  const theme = useResponsiveTheme();
  const { sites, siteTasks, updateSiteTask } = useMockAppStore();

  const role = user?.role;
  const canEdit = role === 'assistant_supervisor' && !readOnly;

  const allowedSiteIds = useMemo(() => {
    if (!user) return initialSiteId ? [initialSiteId] : [];
    // When opened from dashboards with a specific site, lock to that site only.
    if (initialSiteId) return [initialSiteId];
    if (role === 'assistant_supervisor') {
      // Assigned site(s) only
      return sites
        .filter((s) => s.assistantSupervisorId === user.id || (user.siteAccess ?? []).includes(s.id))
        .map((s) => s.id);
    }
    // Other roles (e.g. admin) can view all sites when not locked.
    return sites.map((s) => s.id);
  }, [role, sites, user, initialSiteId]);

  const [selectedSiteId, setSelectedSiteId] = useState<string>(initialSiteId ?? allowedSiteIds[0] ?? '');
  const selectedSite = sites.find((s) => s.id === selectedSiteId) ?? null;

  const tasksForSite = useMemo(() => {
    const tasks = siteTasks.filter((st) => st.siteId === selectedSiteId);
    return tasks.slice().sort((a, b) => {
      const ia = TEMPLATE_ORDER.indexOf(a.taskName);
      const ib = TEMPLATE_ORDER.indexOf(b.taskName);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.taskName.localeCompare(b.taskName);
    });
  }, [siteTasks, selectedSiteId]);
  const completedCount = tasksForSite.filter((st) => st.status === 'completed').length;
  const totalCount = tasksForSite.length;

  const overallProgress = selectedSite ? clampInt(Math.round(selectedSite.progress ?? 0), 0, 100) : 0;

  const [editTask, setEditTask] = useState<SiteTask | null>(null);
  const [editStatus, setEditStatus] = useState<SiteTaskStatus>('not_started');
  const [editProgress, setEditProgress] = useState<string>('0');
  const [editNotes, setEditNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const openEdit = (task: SiteTask) => {
    setEditTask(task);
    setEditStatus(task.status);
    setEditProgress(String(Math.round(task.progress ?? 0)));
    setEditNotes(String(task.notes ?? ''));
  };

  const save = async () => {
    if (!editTask) return;
    let progressInt = parseInt(onlyDigits(editProgress), 10);
    if (Number.isNaN(progressInt)) progressInt = 0;

    // Strict: 1..100 only for editable statuses; completed => 100; not_started => 0
    if (editStatus === 'completed') progressInt = 100;
    if (editStatus === 'not_started') progressInt = 0;
    if (editStatus === 'started' || editStatus === 'in_progress') {
      if (progressInt < 1 || progressInt > 100) {
        Alert.alert(t('alert_error'), 'Progress must be a number between 1 and 100.');
        return;
      }
      progressInt = clampInt(progressInt, 1, 100);
    }

    setSaving(true);
    try {
      await updateSiteTask(editTask.id, {
        status: editStatus,
        progress: progressInt,
        notes: editNotes.trim() || null,
      });
      setEditTask(null);
    } catch (e) {
      Alert.alert(t('alert_error'), (e instanceof Error ? e.message : null) || 'Failed to update task.');
    } finally {
      setSaving(false);
    }
  };

  const statusOptions = useMemo(
    () => ([
      { value: 'not_started' as const, label: 'NOT_STARTED' },
      { value: 'started' as const, label: 'STARTED' },
      { value: 'in_progress' as const, label: 'IN_PROGRESS' },
      { value: 'completed' as const, label: 'COMPLETED' },
    ]),
    []
  );

  const statusVariant = {
    not_started: 'default' as const,
    started: 'warning' as const,
    in_progress: 'info' as const,
    completed: 'success' as const,
  };

  const progressValue = useMemo(() => {
    if (editStatus === 'completed') return 100;
    if (editStatus === 'not_started') return 0;
    const n = parseInt(onlyDigits(editProgress), 10);
    if (Number.isNaN(n)) return 1;
    return clampInt(n, 1, 100);
  }, [editProgress, editStatus]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title={t('tab_tasks')}
        subtitle={undefined}
        leftAction={onBack ? (
          <TouchableOpacity onPress={onBack}>
            <Text style={{ color: colors.primary, fontWeight: '600' }}>{t('common_back')}</Text>
          </TouchableOpacity>
        ) : undefined}
      />

      {/* Fixed overall progress panel */}
      <View style={{ paddingHorizontal: theme.screenPadding, paddingTop: theme.screenPadding, paddingBottom: spacing.sm }}>
        {/* Site selector (only when there are multiple sites visible to the user) */}
        {allowedSiteIds.length > 1 && (
          <View style={{ marginBottom: spacing.sm }}>
            <FilterChips
              options={allowedSiteIds.map((id) => ({
                value: id,
                label: sites.find((s) => s.id === id)?.name ?? id,
              }))}
              value={selectedSiteId}
              onChange={setSelectedSiteId}
            />
          </View>
        )}

        <Card
          style={{
            padding: spacing.lg,
            borderRadius: radius.lg,
            backgroundColor: colors.blue600,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#e0ecff', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Overall site progress
          </Text>
          {selectedSite && (
            <Text style={{ marginTop: 4, fontSize: 16, fontWeight: '800', color: '#e5edff', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {selectedSite.name}
            </Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: spacing.sm }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: colors.surface }}>{overallProgress}%</Text>
            <Text style={{ fontSize: 13, color: '#dbeafe' }}>
              Completed tasks: {completedCount} / {totalCount}
            </Text>
          </View>
          <View style={{ marginTop: spacing.sm }}>
            <ProgressBar progress={overallProgress} showLabel={false} height={12} color="bg-white/70" />
          </View>
        </Card>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: theme.screenPadding, paddingBottom: theme.spacingXl }}
        showsVerticalScrollIndicator={true}
        {...scrollConfig}
      >
        {/* Task table */}
        {tasksForSite.map((task) => {
          const pct = clampInt(Math.round(task.progress ?? 0), 0, 100);
          return (
            <TouchableOpacity
              key={task.id}
              activeOpacity={canEdit ? 0.8 : 1}
              onPress={() => (canEdit ? openEdit(task) : undefined)}
              disabled={!canEdit}
            >
              <Card style={{ marginBottom: spacing.md, padding: spacing.lg, borderRadius: radius.lg }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{task.taskName}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Weight: {task.weight}%</Text>
                  </View>
                  <Badge variant={statusVariant[task.status]}>{statusLabel(task.status)}</Badge>
                </View>

                <View style={{ marginTop: spacing.md }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{t('site_card_progress')}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{pct}%</Text>
                  </View>
                  <ProgressBar progress={pct} showLabel={false} height={8} />
                </View>

                {canEdit && (
                  <Text style={{ marginTop: spacing.sm, color: colors.primary, fontWeight: '600' }}>
                    Tap to update
                  </Text>
                )}
              </Card>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Update Task Modal */}
      <Modal visible={editTask != null} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: spacing.lg }} onPress={() => setEditTask(null)}>
          <Pressable style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg }} onPress={(e) => e.stopPropagation()}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: spacing.sm }}>
              Update task
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: spacing.md }}>
              {editTask?.taskName}
            </Text>

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 6 }}>Status</Text>
            <FilterChips options={statusOptions} value={editStatus} onChange={(s) => {
              setEditStatus(s);
              if (s === 'completed') setEditProgress('100');
              if (s === 'not_started') setEditProgress('0');
              if (s === 'started' || s === 'in_progress') {
                const current = parseInt(onlyDigits(editProgress), 10);
                if (Number.isNaN(current) || current < 1) setEditProgress('1');
              }
            }} scroll={false} />

            <View style={{ marginTop: spacing.lg }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 6 }}>Progress (1–100)</Text>
              <TextInput
                value={onlyDigits(editProgress)}
                onChangeText={(v) => {
                  const digits = onlyDigits(v).slice(0, 3);
                  // prevent decimals/text at typing time
                  if (editStatus === 'completed') return setEditProgress('100');
                  if (editStatus === 'not_started') return setEditProgress('0');
                  const n = digits ? parseInt(digits, 10) : 0;
                  if (!digits) return setEditProgress('');
                  setEditProgress(String(clampInt(n, 1, 100)));
                }}
                placeholder="1–100"
                keyboardType="number-pad"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.text,
                  backgroundColor: colors.gray50,
                }}
              />
              <Slider
                style={{ marginTop: spacing.md }}
                minimumValue={editStatus === 'not_started' ? 0 : 1}
                maximumValue={100}
                step={1}
                value={progressValue}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.gray200}
                thumbTintColor={colors.primary}
                disabled={editStatus === 'completed' || editStatus === 'not_started'}
                onValueChange={(v) => {
                  if (editStatus === 'completed') return;
                  if (editStatus === 'not_started') return;
                  setEditProgress(String(Math.round(v)));
                }}
              />
              <View style={{ marginTop: spacing.sm }}>
                <ProgressBar progress={progressValue} showLabel />
              </View>
            </View>

            <View style={{ marginTop: spacing.lg }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 6 }}>Notes (optional)</Text>
              <TextInput
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Add a short note (optional)"
                multiline
                numberOfLines={3}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.text,
                  backgroundColor: colors.gray50,
                  minHeight: 80,
                  textAlignVertical: 'top',
                }}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              <Button variant="secondary" onPress={() => setEditTask(null)} style={{ flex: 1 }}>
                {t('common_cancel')}
              </Button>
              <Button onPress={save} loading={saving} style={{ flex: 1 }}>
                {t('common_save')}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

