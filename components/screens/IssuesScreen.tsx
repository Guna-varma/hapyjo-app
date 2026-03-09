import React, { useMemo, useState, useCallback } from 'react';
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
  Modal,
  Linking,
  Platform,
  ScrollView,
  ActivityIndicator,
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
import { uploadIssueImage, getIssueImagePublicUrl } from '@/lib/issueImageStorage';
import { compressIssueImage, getUriSizeInBytes, ISSUE_IMAGE_MAX_INPUT_BYTES } from '@/lib/compressIssueImage';
import { AlertCircle, Plus, Image as ImageIcon } from 'lucide-react-native';
import { colors, radius, spacing } from '@/theme/tokens';

const ALL_SITES_VALUE = '';

/** Thumbnail that shows a placeholder on load error so preview never breaks the UI. */
function IssueImageThumb({
  uri,
  size,
  style,
  onPress,
}: { uri: string; size: number; style?: object; onPress?: () => void }) {
  const [error, setError] = useState(false);
  const displayUri = getIssueImagePublicUrl(uri);
  const content = error ? (
    <View style={[styles.issueThumbPlaceholder, { width: size, height: size }]}>
      <ImageIcon size={size * 0.4} color={colors.gray400} />
    </View>
  ) : (
    <Image
      source={{ uri: displayUri }}
      style={[styles.issueThumb, { width: size, height: size }]}
      resizeMode="cover"
      onError={() => setError(true)}
    />
  );
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.issueThumbWrap, { width: size, height: size }, style]}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.issueThumbWrap, { width: size, height: size }, style]}>{content}</View>;
}

/** Full-screen issue image with error fallback. */
function IssueImageFullView({ uri, style }: { uri: string; style?: object }) {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <View style={[styles.imageModalImage, styles.imageModalError]} pointerEvents="box-none">
        <ImageIcon size={48} color={colors.gray400} />
        <Text style={styles.imageModalErrorText}>Image unavailable</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode="contain"
      onError={() => setError(true)}
    />
  );
}

export function IssuesScreen() {
  const { user } = useAuth();
  const { t } = useLocale();
  const theme = useResponsiveTheme();
  const { sites, issues, users, addIssue, updateIssue, refetch, loading } = useMockAppStore();
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [updatingIssueId, setUpdatingIssueId] = useState<string | null>(null);
  /** Add issue: only Assistant Supervisor, Driver, Operator (per Issue Reporting System). */
  const canRaise =
    user?.role === 'driver_truck' ||
    user?.role === 'driver_machine' ||
    user?.role === 'assistant_supervisor';
  const canViewAll = user?.role === 'head_supervisor' || user?.role === 'owner' || user?.role === 'admin';
  const canUpdateStatus = user?.role === 'head_supervisor' || user?.role === 'owner';
  const isAssistantSupervisor = user?.role === 'assistant_supervisor';
  const thumbnailSize = theme.scaleMin(64);

  const getCreatorName = (userId: string) => users.find((u) => u.id === userId)?.name ?? userId.slice(0, 8) + '…';
  const getCreatorRoleLabel = (role?: string) => (role ? t(`role_${role}` as Parameters<typeof t>[0]) : '—');
  const formatIssueDateTime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  const [raiseModalVisible, setRaiseModalVisible] = useState(false);
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [description, setDescription] = useState('');
  const [filterSiteId, setFilterSiteId] = useState<string>(ALL_SITES_VALUE);
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [viewingImageUri, setViewingImageUri] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<import('@/types').Issue | null>(null);

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
  const listIssues = filteredIssues;
  const sectionTitleKey = canViewAll ? 'issues_all_issues' : isAssistantSupervisor ? 'issues_section_site_issues' : 'issues_my_issues';

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- optional status picker entry point
  const _openStatusPicker = (issue: import('@/types').Issue) => {
    if (!canUpdateStatus) return;
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

  const openIssueDetail = (issue: import('@/types').Issue) => {
    setSelectedIssue(issue);
  };

  const closeIssueDetail = () => setSelectedIssue(null);

  const handleDownloadImage = useCallback(
    async (uri: string) => {
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const a = document.createElement('a');
          a.href = uri;
          a.download = `issue-image-${Date.now()}.jpg`;
          a.rel = 'noopener noreferrer';
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          showToast(t('issues_image_saved'));
        } else {
          const { documentDirectory, cacheDirectory, writeAsStringAsync, EncodingType } =
            await import('expo-file-system/legacy');
          const FileSystem = await import('expo-file-system');
          const Sharing = await import('expo-sharing');
          const isAvailable = await Sharing.isAvailableAsync();
          const ext = uri.startsWith('data:image/png') ? 'png' : 'jpg';
          const filename = `issue-image-${Date.now()}.${ext}`;
          const dir = documentDirectory ?? cacheDirectory ?? '';
          const path = `${dir}${filename}`;

          if (uri.startsWith('data:')) {
            const base64Match = uri.match(/^data:image\/\w+;base64,(.+)$/);
            if (base64Match?.[1]) {
              await writeAsStringAsync(path, base64Match[1], { encoding: EncodingType.Base64 });
            } else {
              const canOpen = await Linking.canOpenURL(uri);
              if (canOpen) await Linking.openURL(uri);
              return;
            }
          } else {
            const fs = (FileSystem as { default?: { downloadAsync: (uri: string, path: string) => Promise<{ uri: string }> } }).default;
            if (fs?.downloadAsync) await fs.downloadAsync(uri, path);
            else await Linking.openURL(uri);
          }

          if (isAvailable) {
            await Sharing.shareAsync(path, {
              mimeType: uri.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
              dialogTitle: t('issues_download_image'),
            });
            showToast(t('issues_image_saved'));
          } else {
            await Linking.openURL(path);
            showToast(t('issues_image_saved'));
          }
        }
      } catch {
        showToast(t('issues_image_save_failed'));
      }
    },
    [showToast, t]
  );

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
        const toAdd: string[] = [];
        let skipped = 0;
        for (const asset of result.assets) {
          const size = await getUriSizeInBytes(asset.uri);
          if (size > ISSUE_IMAGE_MAX_INPUT_BYTES) skipped++;
          else toAdd.push(asset.uri);
        }
        if (toAdd.length) setImageUris((prev) => [...prev, ...toAdd]);
        if (skipped > 0) showToast(t('issues_image_too_large'));
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
    const issueId = generateId('i');
    Keyboard.dismiss();
    setSubmittingIssue(true);
    try {
      const uploadedPaths: string[] =
        imageUris.length > 0
          ? await Promise.all(
              imageUris.map(async (uri) => {
                const compressed = await compressIssueImage(uri);
                return uploadIssueImage(issueId, compressed);
              })
            )
          : [];
      await addIssue({
        id: issueId,
        siteId,
        siteName: site?.name,
        raisedById: user.id,
        description: description.trim(),
        imageUris: uploadedPaths,
        status: 'open',
        createdAt: new Date().toISOString(),
      });
      setRaiseModalVisible(false);
      setDescription('');
      setImageUris([]);
      showToast(t('issues_raise_success_message'));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('alert_error');
      showToast(message);
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
            {(canViewAll || isAssistantSupervisor) && sites.length > 1 && (
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
              {t(sectionTitleKey)}
            </Text>
            {listIssues.length === 0 ? (
              <EmptyState
                title={
                  canViewAll ? t('issues_none_reported') : isAssistantSupervisor ? t('issues_none_reported') : t('issues_none_raised')
                }
                message={
                  canViewAll ? t('issues_none_reported_message') : isAssistantSupervisor ? t('issues_none_reported_message') : t('issues_none_raised_message')
                }
              />
            ) : (
              listIssues.map((issue) => {
                const isUpdating = updatingIssueId === issue.id;
                return (
                  <TouchableOpacity
                    key={issue.id}
                    onPress={() => openIssueDetail(issue)}
                    activeOpacity={0.7}
                    style={[styles.issueCardTouchable, isUpdating && styles.issueCardUpdating]}
                    accessibilityRole="button"
                    accessibilityLabel={issue.description.slice(0, 60)}
                  >
                    <ListCard
                      onPress={undefined}
                      style={styles.issueCardInner}
                      title={
                        issue.description.slice(0, 60) +
                        (issue.description.length > 60 ? '…' : '')
                      }
                      subtitle={issue.siteName ?? getSiteName(issue.siteId)}
                      meta={`${t('issues_created_by')} ${getCreatorName(issue.raisedById)} · ${t('issues_creator_role')} ${getCreatorRoleLabel(issue.createdByRole)} · ${t('issues_created_at')} ${formatIssueDateTime(issue.createdAt)}${canViewAll && (issue.imageUris?.length ?? 0) > 0 ? ` · ${issue.imageUris!.length} ${t('issues_images_attached')}` : ''}`}
                      right={
                        <View style={styles.issueRightRow}>
                          {isUpdating && (
                            <View style={styles.issueUpdatingWrap}>
                              <ActivityIndicator size="small" color={colors.primary} />
                              <Text style={styles.issueUpdatingText}>{t('issues_updating')}</Text>
                            </View>
                          )}
                          <Badge variant={statusVariant[issue.status]} size="sm">
                            {t(`issues_status_${issue.status}`)}
                          </Badge>
                        </View>
                      }
                      footer={
                        canViewAll && (issue.imageUris?.length ?? 0) > 0 ? (
                          <View style={styles.issueImagesSection}>
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              contentContainerStyle={styles.issueThumbsScroll}
                            >
                              {(issue.imageUris ?? []).map((uri, idx) => (
                                <IssueImageThumb
                                  key={`${issue.id}-${idx}-${uri.slice(-12)}`}
                                  uri={uri}
                                  size={thumbnailSize}
                                  onPress={() => setViewingImageUri(getIssueImagePublicUrl(uri))}
                                />
                              ))}
                            </ScrollView>
                            <View style={styles.issueImageActions}>
                              <TouchableOpacity
                                onPress={(e) => { e?.stopPropagation?.(); issue.imageUris?.length && setViewingImageUri(getIssueImagePublicUrl(issue.imageUris![0])); }}
                                style={styles.issueImageBtn}
                              >
                                <Text style={styles.issueImageBtnText}>{t('issues_view_images')}</Text>
                              </TouchableOpacity>
                              {(issue.imageUris ?? []).map((uri, idx) => (
                                <TouchableOpacity
                                  key={`dl-${idx}`}
                                  onPress={(e) => { e?.stopPropagation?.(); handleDownloadImage(getIssueImagePublicUrl(uri)); }}
                                  style={styles.issueImageBtn}
                                >
                                  <Text style={styles.issueImageBtnText}>
                                    {t('issues_download_image')}{(issue.imageUris?.length ?? 0) > 1 ? ` (${idx + 1})` : ''}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        ) : undefined
                      }
                    />
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}
      </ScreenContainer>

      <Modal
        visible={!!viewingImageUri}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingImageUri(null)}
      >
        <View style={styles.imageModalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setViewingImageUri(null)}
          />
          <View style={styles.imageModalContent} pointerEvents="box-none">
            <View pointerEvents="auto">
              <Pressable
                style={styles.imageModalClose}
                onPress={() => setViewingImageUri(null)}
                accessibilityLabel={t('common_cancel')}
              >
                <Text style={styles.imageModalCloseText}>×</Text>
              </Pressable>
              {viewingImageUri && (
                <IssueImageFullView uri={viewingImageUri} style={styles.imageModalImage} />
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!selectedIssue}
        transparent
        animationType="fade"
        onRequestClose={closeIssueDetail}
      >
        <View style={styles.detailModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeIssueDetail} />
          <View style={styles.detailModalContent} pointerEvents="box-none">
            <View style={styles.detailModalCard} pointerEvents="auto">
              <View style={styles.detailModalHeader}>
                <Text style={styles.detailModalTitle}>{t('issues_detail_title')}</Text>
                <Pressable onPress={closeIssueDetail} style={styles.detailModalClose} accessibilityLabel={t('common_cancel')}>
                  <Text style={styles.imageModalCloseText}>×</Text>
                </Pressable>
              </View>
              {selectedIssue && (
                <ScrollView style={styles.detailModalScroll} showsVerticalScrollIndicator={false}>
                  <Text style={styles.detailSectionLabel}>{t('issues_description')}</Text>
                  <Text style={styles.detailDescription}>{selectedIssue.description}</Text>
                  <Text style={styles.detailMeta}>
                    {selectedIssue.siteName ?? getSiteName(selectedIssue.siteId)}
                  </Text>
                  <View style={styles.detailCreatorBlock}>
                    <Text style={styles.detailCreatorLabel}>{t('issues_created_by')}</Text>
                    <Text style={styles.detailCreatorValue}>{getCreatorName(selectedIssue.raisedById)}</Text>
                    <Text style={styles.detailCreatorLabel}>{t('issues_creator_role')}</Text>
                    <Text style={styles.detailCreatorValue}>{getCreatorRoleLabel(selectedIssue.createdByRole)}</Text>
                    <Text style={styles.detailCreatorLabel}>{t('issues_created_at')}</Text>
                    <Text style={styles.detailCreatorValue}>{formatIssueDateTime(selectedIssue.createdAt)}</Text>
                  </View>
                  <View style={styles.detailBadgeWrap}>
                    <Badge variant={statusVariant[selectedIssue.status]} size="sm">
                      {t(`issues_status_${selectedIssue.status}`)}
                    </Badge>
                  </View>
                  {canViewAll && (selectedIssue.imageUris?.length ?? 0) > 0 && (
                    <View style={styles.detailImagesWrap}>
                      <Text style={styles.detailImagesLabel}>{t('issues_images_attached')}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.issueThumbsScroll}>
                        {(selectedIssue.imageUris ?? []).map((uri, idx) => (
                          <IssueImageThumb
                            key={idx}
                            uri={uri}
                            size={thumbnailSize}
                            onPress={() => setViewingImageUri(getIssueImagePublicUrl(uri))}
                          />
                        ))}
                      </ScrollView>
                      <View style={styles.issueImageActions}>
                        <TouchableOpacity onPress={() => setViewingImageUri(getIssueImagePublicUrl(selectedIssue.imageUris![0]))} style={styles.issueImageBtn}>
                          <Text style={styles.issueImageBtnText}>{t('issues_view_images')}</Text>
                        </TouchableOpacity>
                        {(selectedIssue.imageUris ?? []).map((uri, idx) => (
                          <TouchableOpacity key={idx} onPress={() => handleDownloadImage(getIssueImagePublicUrl(uri))} style={styles.issueImageBtn}>
                            <Text style={styles.issueImageBtnText}>{t('issues_download_image')}{(selectedIssue.imageUris?.length ?? 0) > 1 ? ` (${idx + 1})` : ''}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                  {canUpdateStatus && updatingIssueId !== selectedIssue.id && (
                    <View style={styles.detailActionsWrap}>
                      <Text style={styles.detailSectionLabel}>{t('issues_change_status')}</Text>
                      <View style={styles.detailActions}>
                      {issueStatusOptions.map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          onPress={async () => {
                            if (selectedIssue.status === opt.value) return;
                            await onStatusChange(selectedIssue, opt.value);
                            closeIssueDetail();
                          }}
                          style={[styles.detailActionBtn, selectedIssue.status === opt.value && styles.detailActionBtnActive]}
                        >
                          <Text style={[styles.detailActionBtnText, selectedIssue.status === opt.value && styles.detailActionBtnTextActive]}>
                            {t(opt.labelKey)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    </View>
                  )}
                  {canUpdateStatus && updatingIssueId === selectedIssue.id && (
                    <View style={styles.detailUpdatingWrap}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.issueUpdatingText}>{t('issues_updating')}</Text>
                    </View>
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </Modal>

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
        <Text style={styles.imagesHint}>{t('issues_raise_images_hint')}</Text>
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
  viewUpdateBtn: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginBottom: spacing.xs,
  },
  viewUpdateBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.surface,
  },
  issueCardTouchable: {
    marginBottom: spacing.sm,
  },
  issueCardInner: {
    marginBottom: 0,
  },
  issueCardUpdating: {
    opacity: 0.85,
  },
  detailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  detailModalContent: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
  },
  detailModalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  detailModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  detailModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailModalScroll: {
    maxHeight: 400,
  },
  detailSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailDescription: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  detailMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  detailCreatorBlock: {
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
  },
  detailCreatorLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailCreatorValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  detailBadgeWrap: {
    marginBottom: spacing.md,
  },
  detailImagesWrap: {
    marginBottom: spacing.md,
  },
  detailImagesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  detailActionsWrap: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  detailActionBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
  },
  detailActionBtnActive: {
    backgroundColor: colors.primary,
  },
  detailActionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  detailActionBtnTextActive: {
    color: colors.surface,
  },
  detailUpdatingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  issueRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  issueUpdatingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  issueUpdatingText: {
    fontSize: 12,
    color: colors.textMuted,
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
  imagesHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
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
  issueImagesSection: {
    marginTop: spacing.sm,
  },
  issueThumbsScroll: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  issueThumbWrap: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.gray200,
  },
  issueThumb: {
    borderRadius: radius.sm,
  },
  issueThumbPlaceholder: {
    backgroundColor: colors.gray100,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  issueImageActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  issueImageBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.gray100,
  },
  issueImageBtnText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    width: '100%',
    maxWidth: 400,
    padding: spacing.lg,
    position: 'relative',
  },
  imageModalClose: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 1,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseText: {
    color: colors.surface,
    fontSize: 24,
    lineHeight: 28,
  },
  imageModalImage: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 400,
  },
  imageModalError: {
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalErrorText: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.textMuted,
  },
});
