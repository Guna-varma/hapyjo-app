import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  RefreshControl,
} from 'react-native';
import { useLocale } from '@/context/LocaleContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { colors, radius, spacing } from '@/theme/tokens';
import { ChevronLeft } from 'lucide-react-native';
import { Select } from '@/components/ui/Select';
import { WorkPhotoDetailModal } from './WorkPhotoDetailModal';
import type { WorkPhoto } from '@/types';

const PAGE_SIZE = 20;
const ALL_SITES_VALUE = '';

export function WorkProgressGalleryScreen({
  workPhotos,
  sites,
  allowedSiteIds = [],
  users,
  onBack,
  onRefresh,
  refreshing = false,
}: {
  workPhotos: WorkPhoto[];
  sites: { id: string; name: string }[];
  /** Sites the current user is allowed to see; dropdown shows only these. If empty, all passed sites are used. */
  allowedSiteIds?: string[];
  users: { id: string; name: string }[];
  onBack: () => void;
  onRefresh?: () => Promise<void>;
  refreshing?: boolean;
}) {
  const { t } = useLocale();
  const theme = useResponsiveTheme();
  const [selectedPhoto, setSelectedPhoto] = useState<WorkPhoto | null>(null);
  const [page, setPage] = useState(0);
  const [selectedSiteId, setSelectedSiteId] = useState<string>(ALL_SITES_VALUE);

  const siteOptions = useMemo(() => {
    const list = allowedSiteIds.length > 0 ? sites.filter((s) => allowedSiteIds.includes(s.id)) : sites;
    return [
      { value: ALL_SITES_VALUE as const, label: t('work_photo_filter_all_sites') },
      ...list.map((s) => ({ value: s.id, label: s.name })),
    ];
  }, [sites, allowedSiteIds, t]);

  const filteredBySite = useMemo(() => {
    if (!selectedSiteId || selectedSiteId === ALL_SITES_VALUE) return workPhotos;
    return workPhotos.filter((p) => p.siteId === selectedSiteId);
  }, [workPhotos, selectedSiteId]);

  const paginated = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filteredBySite.slice(start, start + PAGE_SIZE);
  }, [filteredBySite, page]);
  const totalPages = Math.max(1, Math.ceil(filteredBySite.length / PAGE_SIZE));
  const hasMore = page < totalPages - 1;
  const hasPrev = page > 0;

  const getSiteName = (siteId: string) => sites.find((s) => s.id === siteId)?.name ?? siteId;
  const getUserName = (userId: string) => users.find((u) => u.id === userId)?.name ?? userId;

  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityLabel={t('common_cancel')}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={styles.backText}>{t('work_photo_gallery_back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('work_photo_gallery_title')}</Text>
        <Text style={styles.headerSubtitle}>{t('work_photo_gallery_subtitle')}</Text>
        {siteOptions.length > 1 && (
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>{t('work_photo_filter_site')}</Text>
            <Select<string>
              placeholder={t('work_photo_filter_all_sites')}
              options={siteOptions}
              value={selectedSiteId || ALL_SITES_VALUE}
              onChange={(v) => {
                setSelectedSiteId(v);
                setPage(0);
              }}
              containerStyle={styles.selectContainer}
            />
          </View>
        )}
        <Text style={styles.retentionNote}>{t('work_photo_gallery_retention')}</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          ) : undefined
        }
      >
        {filteredBySite.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('work_photo_no_photos')}</Text>
            <Text style={styles.emptyMessage}>
              {selectedSiteId && selectedSiteId !== ALL_SITES_VALUE
                ? t('work_photo_no_photos_for_site')
                : t('work_photo_no_photos_message')}
            </Text>
          </View>
        ) : (
          <>
            {paginated.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.card}
                onPress={() => setSelectedPhoto(p)}
                activeOpacity={0.8}
              >
                <Image source={{ uri: p.thumbnailUrl }} style={styles.thumb} resizeMode="cover" />
                <View style={styles.cardRight}>
                  <View style={styles.cardBody}>
                    <Text style={styles.siteName} numberOfLines={1}>
                      {getSiteName(p.siteId)}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {t('work_photo_uploaded_by')}: {getUserName(p.uploadedBy)}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {t('work_photo_user_role')}: {t(`role_${p.userRole}` as Parameters<typeof t>[0])}
                    </Text>
                    <Text style={styles.date}>
                      {new Date(p.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}{' '}
                      {new Date(p.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            {totalPages > 1 && (
              <View style={styles.pagination}>
                <TouchableOpacity
                  onPress={() => setPage((prev) => Math.max(0, prev - 1))}
                  disabled={!hasPrev}
                  style={[styles.pageBtn, !hasPrev && styles.pageBtnDisabled]}
                >
                  <Text style={styles.pageBtnText}>{t('work_photo_prev_page')}</Text>
                </TouchableOpacity>
                <Text style={styles.pageInfo}>
                  {page + 1} / {totalPages}
                </Text>
                <TouchableOpacity
                  onPress={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
                  disabled={!hasMore}
                  style={[styles.pageBtn, !hasMore && styles.pageBtnDisabled]}
                >
                  <Text style={styles.pageBtnText}>{t('work_photo_next_page')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
      {selectedPhoto && (
        <WorkPhotoDetailModal
          photo={selectedPhoto}
          siteName={getSiteName(selectedPhoto.siteId)}
          uploadedByName={getUserName(selectedPhoto.uploadedBy)}
          onClose={() => setSelectedPhoto(null)}
        />
      )}
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useResponsiveTheme>) {
  const thumbSize = theme.scaleMin(80);
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: theme.spacingLg,
      paddingHorizontal: theme.screenPadding,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      marginBottom: spacing.sm,
    },
    backText: { fontSize: 16, color: colors.text, marginLeft: 2 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    headerSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    filterRow: { marginTop: spacing.md },
    filterLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
    selectContainer: { marginBottom: 0 },
    retentionNote: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
    scroll: { flex: 1 },
    scrollContent: { padding: theme.screenPadding, paddingBottom: theme.spacingXl },
    empty: { paddingVertical: theme.spacingXl, alignItems: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
    emptyMessage: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
    card: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      marginBottom: spacing.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    thumb: { width: thumbSize, height: thumbSize },
    cardRight: { flex: 1, padding: spacing.sm },
    cardBody: { justifyContent: 'center' },
    siteName: { fontSize: 15, fontWeight: '600', color: colors.text },
    meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    date: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
    pagination: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      marginTop: spacing.lg,
    },
    pageBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    pageBtnDisabled: { opacity: 0.4 },
    pageBtnText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
    pageInfo: { fontSize: 13, color: colors.textMuted },
  });
}
