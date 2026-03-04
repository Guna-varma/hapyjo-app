import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  Alert,
  Keyboard,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {
  Header,
  FilterChips,
  ListCard,
  EmptyState,
  ScreenContainer,
  SkeletonList,
  Badge,
  ModalWithKeyboard,
  Button,
  PressableScale,
  Input,
} from '@/components/ui';
import { modalStyles } from '@/components/ui/modalStyles';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useToast } from '@/context/ToastContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { generateId } from '@/lib/id';
import { AlertCircle, Plus } from 'lucide-react-native';
import { colors, radius, spacing } from '@/theme/tokens';

const ALL_SITES_VALUE = '';

export function IssuesScreen() {
  const { user } = useAuth();
  const { t } = useLocale();
  const theme = useResponsiveTheme();
  const { sites, issues, addIssue, updateIssue, refetch, loading } = useMockAppStore();
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [updatingIssueId, setUpdatingIssueId] = useState<string | null>(null);
  const canRaise =
    user?.role === 'driver_truck' ||
    user?.role === 'driver_machine' ||
    user?.role === 'assistant_supervisor';
  const canViewAll = user?.role === 'head_supervisor' || user?.role === 'owner';
  const canUpdateStatus = user?.role === 'head_supervisor' || user?.role === 'owner';
  const thumbnailSize = theme.scaleMin(64);

  const [raiseModalVisible, setRaiseModalVisible] = useState(false);
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [description, setDescription] = useState('');
  const [filterSiteId, setFilterSiteId] = useState<string>(ALL_SITES_VALUE);
  const [imageUris, setImageUris] = useState<string[]>([]);

  const siteFilterOptions = useMemo(
    () => [
      { value: ALL_SITES_VALUE, label: t('reports_all') },
      ...sites.map((s) => ({ value: s.id, label: s.name })),
    ],
    [sites, t]
  );

  const filteredIssues =
    filterSiteId === ALL_SITES_VALUE
      ? issues
      : issues.filter((i) => i.siteId === filterSiteId);
  const myIssues = !canViewAll ? issues.filter((i) => i.raisedById === user?.id) : undefined;
  const listIssues = canViewAll ? filteredIssues : myIssues ?? [];

  const getSiteName = (id: string) => sites.find((s) => s.id === id)?.name ?? id;
  const statusVariant = {
    open: 'warning' as const,
    acknowledged: 'info' as const,
    resolved: 'success' as const,
  };

  const issueStatusOptions: {
    value: 'open' | 'acknowledged' | 'resolved';
    labelKey: string;
  }[] = [
    { value: 'open', labelKey: 'issues_status_open' },
    { value: 'acknowledged', labelKey: 'issues_status_acknowledged' },
    { value: 'resolved', labelKey: 'issues_status_resolved' },
  ];

  const onStatusChange = async (
    issue: import('@/types').Issue,
    newStatus: 'open' | 'acknowledged' | 'resolved'
  ) => {
    if (issue.status === newStatus) return;
    setUpdatingIssueId(issue.id);
    try {
      await updateIssue(issue.id, { status: newStatus });
      showToast(t('issues_status_updated'));
    } catch {
      showToast(t('alert_error'));
    } finally {
      setUpdatingIssueId(null);
    }
  };

  const openStatusPicker = (issue: import('@/types').Issue) => {
    Alert.alert(
      t('issues_update_status'),
      issue.description.slice(0, 80) + (issue.description.length > 80 ? '…' : ''),
      [
        { text: t('common_cancel'), style: 'cancel' },
        ...issueStatusOptions.map((opt) => ({
          text: t(opt.labelKey),
          onPress: () => onStatusChange(issue, opt.value),
        })),
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const addImage = async () => {
    try {
      const { launchImageLibraryAsync } = await import('expo-image-picker');
      const result = await launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
      });
      if (!result.canceled && result.assets?.length) {
        setImageUris((prev) => [...prev, ...result.assets!.map((a) => a.uri)]);
      }
    } catch {
      /* user cancelled or picker error */
    }
  };

  const removeImage = (uri: string) =>
    setImageUris((prev) => prev.filter((u) => u !== uri));

  const submitIssue = async () => {
    if (!description.trim() || !siteId || !user?.id) return;
    const site = sites.find((s) => s.id === siteId);
    Keyboard.dismiss();
    setSubmittingIssue(true);
    try {
      await addIssue({
        id: generateId('i'),
        siteId,
        siteName: site?.name,
        raisedById: user.id,
        description: description.trim(),
        imageUris: [...imageUris],
        status: 'open',
        createdAt: new Date().toISOString(),
      });
      setRaiseModalVisible(false);
      setDescription('');
      setImageUris([]);
      showToast(t('issues_raise_success_message'));
    } finally {
      setSubmittingIssue(false);
    }
  };

  const openRaise = () => {
    setSiteId(sites[0]?.id ?? '');
    setDescription('');
    setImageUris([]);
    setRaiseModalVisible(true);
  };

  return (
    <View style={styles.screen}>
      <Header
        title={t('issues_title')}
        subtitle={canViewAll ? t('issues_subtitle_view') : t('issues_subtitle_raise')}
        rightAction={
          canRaise ? (
            <Pressable onPress={openRaise} style={styles.raiseBtn}>
              <Plus size={18} color={colors.surface} />
              <Text style={styles.raiseBtnText}>{t('issues_raise')}</Text>
            </Pressable>
          ) : null
        }
      />

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
          <SkeletonList count={5} />
        ) : (
          <>
            {canViewAll && sites.length > 1 && (
              <View style={styles.filterWrap}>
                <FilterChips
                  options={siteFilterOptions}
                  value={filterSiteId}
                  onChange={setFilterSiteId}
                  scroll={true}
                />
              </View>
            )}

            <Text style={styles.sectionTitle}>
              {canViewAll ? t('issues_all_issues') : t('issues_my_issues')}
            </Text>
            {listIssues.length === 0 ? (
              <EmptyState
                title={
                  canViewAll ? t('issues_none_reported') : t('issues_none_raised')
                }
                message={
                  canViewAll ? t('issues_none_reported_message') : t('issues_none_raised_message')
                }
              />
            ) : (
              listIssues.map((issue) => (
                <ListCard
                  key={issue.id}
                  title={
                    issue.description.slice(0, 60) +
                    (issue.description.length > 60 ? '…' : '')
                  }
                  subtitle={issue.siteName ?? getSiteName(issue.siteId)}
                  meta={`${issue.createdAt.slice(0, 10)}${issue.imageUris.length > 0 ? ` · ${issue.imageUris.length} ${t('issues_images_attached')}` : ''}`}
                  right={
                    canUpdateStatus ? (
                      <Pressable
                        onPress={() => openStatusPicker(issue)}
                        disabled={updatingIssueId === issue.id}
                        style={({ pressed }) => ({
                          opacity: pressed || updatingIssueId === issue.id ? 0.7 : 1,
                        })}
                      >
                        <Badge variant={statusVariant[issue.status]} size="sm">
                          {t(`issues_status_${issue.status}`)}
                        </Badge>
                      </Pressable>
                    ) : (
                      <Badge variant={statusVariant[issue.status]} size="sm">
                        {t(`issues_status_${issue.status}`)}
                      </Badge>
                    )
                  }
                  footer={
                    canUpdateStatus ? (
                      <Text style={styles.tapHint}>{t('issues_tap_status_to_update')}</Text>
                    ) : undefined
                  }
                />
              ))
            )}
          </>
        )}
      </ScreenContainer>

      <ModalWithKeyboard
        visible={raiseModalVisible}
        onOverlayPress={() => setRaiseModalVisible(false)}
        submitting={submittingIssue}
        maxHeightRatio={theme.modalMaxHeightRatio}
        footer={
          <View style={modalStyles.footer}>
            <PressableScale
              onPress={() => setRaiseModalVisible(false)}
              disabled={submittingIssue}
              style={[modalStyles.btn, modalStyles.btnSecondary]}
            >
              <Text style={modalStyles.btnTextSecondary}>{t('common_cancel')}</Text>
            </PressableScale>
            <Button
              variant="primary"
              onPress={submitIssue}
              disabled={!description.trim() || submittingIssue}
              loading={submittingIssue}
              style={modalStyles.btn}
            >
              {t('issues_raise_submit')}
            </Button>
          </View>
        }
      >
        <View style={styles.modalHeader}>
          <View style={styles.modalIconWrap}>
            <AlertCircle size={24} color={colors.textSecondary} />
          </View>
          <Text style={[modalStyles.title, styles.modalTitleCenter]}>
            {t('issues_raise_modal_title')}
          </Text>
          <Text style={styles.modalSubtitle}>{t('issues_raise_modal_subtitle')}</Text>
        </View>
        <Text style={modalStyles.label}>{t('issues_raise_site_label')}</Text>
        <FilterChips
          options={sites.map((s) => ({ value: s.id, label: s.name }))}
          value={siteId}
          onChange={setSiteId}
          scroll={false}
        />
        <View style={styles.modalChipsMargin} />
        <Input
          label={t('issues_description')}
          value={description}
          onChangeText={setDescription}
          placeholder={t('issues_raise_description_placeholder')}
          multiline
          numberOfLines={4}
          containerStyle={{ marginBottom: spacing.sm }}
        />
        <Text style={modalStyles.label}>{t('issues_raise_attach_images')}</Text>
        <View style={styles.imageRow}>
          <TouchableOpacity onPress={addImage} style={styles.addImageBtn}>
            <Plus size={24} color={colors.textMuted} />
            <Text style={styles.addImageText}>{t('common_add')}</Text>
          </TouchableOpacity>
          {imageUris.map((uri) => (
            <View key={uri} style={styles.thumbWrap}>
              <Image
                source={{ uri }}
                style={[styles.thumb, { width: thumbnailSize, height: thumbnailSize }]}
              />
              <TouchableOpacity
                onPress={() => removeImage(uri)}
                style={styles.removeThumbBtn}
              >
                <Text style={styles.removeThumbText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ModalWithKeyboard>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  raiseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
  },
  raiseBtnText: {
    color: colors.surface,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  filterWrap: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  tapHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  modalTitleCenter: { textAlign: 'center' },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  modalChipsMargin: { height: spacing.sm },
  imageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  addImageBtn: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray100,
  },
  addImageText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  thumbWrap: {
    position: 'relative',
  },
  thumb: {
    borderRadius: radius.md,
    backgroundColor: colors.gray200,
  },
  removeThumbBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeThumbText: {
    color: colors.surface,
    fontSize: 12,
  },
});
