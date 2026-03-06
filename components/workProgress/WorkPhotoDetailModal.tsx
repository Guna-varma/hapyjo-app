import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useLocale } from '@/context/LocaleContext';
import { colors, radius, spacing } from '@/theme/tokens';
import type { WorkPhoto } from '@/types';

export function WorkPhotoDetailModal({
  photo,
  siteName,
  uploadedByName,
  onClose,
}: {
  photo: WorkPhoto;
  siteName: string;
  uploadedByName: string;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const dateStr = new Date(photo.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' });
  const timeStr = new Date(photo.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const hasLocation = Number.isFinite(photo.latitude) && Number.isFinite(photo.longitude);

  const openInGoogleMaps = () => {
    if (!hasLocation) return;
    const url = `https://www.google.com/maps?q=${photo.latitude},${photo.longitude}`;
    Linking.openURL(url);
  };

  const handleDownload = async () => {
    try {
      if (Platform.OS === 'web') {
        const a = document.createElement('a');
        a.href = photo.photoUrl;
        a.download = `work-photo-${photo.id}.jpg`;
        a.rel = 'noopener noreferrer';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const filename = (FileSystem.documentDirectory ?? '') + `work-photo-${photo.id}.jpg`;
        const { uri } = await FileSystem.downloadAsync(photo.photoUrl, filename);
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) await Sharing.shareAsync(uri, { mimeType: 'image/jpeg' });
      }
    } catch {
      if (Platform.OS !== 'web') Linking.openURL(photo.photoUrl);
    }
  };

  return (
    <Modal visible={!!photo} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card} pointerEvents="box-none">
          <View style={styles.header}>
            <Text style={styles.title}>{t('work_photo_detail_title')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel={t('common_cancel')}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Image source={{ uri: photo.photoUrl }} style={styles.photo} resizeMode="contain" />
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>{t('work_photo_site')}</Text>
              <Text style={styles.metaValue}>{siteName}</Text>
              <Text style={styles.metaLabel}>{t('work_photo_watermark_lat')}</Text>
              <Text style={styles.metaValue}>{hasLocation ? photo.latitude.toFixed(6) : '—'}</Text>
              <Text style={styles.metaLabel}>{t('work_photo_watermark_long')}</Text>
              <Text style={styles.metaValue}>{hasLocation ? photo.longitude.toFixed(6) : '—'}</Text>
              <Text style={styles.metaLabel}>{t('work_photo_watermark_date')}</Text>
              <Text style={styles.metaValue}>{dateStr}</Text>
              <Text style={styles.metaLabel}>{t('work_photo_watermark_time')}</Text>
              <Text style={styles.metaValue}>{timeStr}</Text>
              <Text style={styles.metaLabel}>{t('work_photo_uploaded_by')}</Text>
              <Text style={styles.metaValue}>{uploadedByName}</Text>
              <Text style={styles.metaLabel}>{t('work_photo_user_role')}</Text>
              <Text style={styles.metaValue}>{t(`role_${photo.userRole}` as Parameters<typeof t>[0])}</Text>
            </View>
            {hasLocation && (
              <TouchableOpacity onPress={openInGoogleMaps} style={styles.googleMapsBtn} activeOpacity={0.8}>
                <Text style={styles.googleMapsBtnText}>Preview in Google Maps</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleDownload} style={styles.downloadBtn}>
              <Text style={styles.downloadBtnText}>{t('work_photo_download')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  closeBtn: { padding: spacing.xs },
  closeText: { fontSize: 28, color: colors.textMuted },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  photo: { width: '100%', height: 280, borderRadius: radius.sm, backgroundColor: colors.background },
  metaBlock: { marginTop: spacing.md },
  metaLabel: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.3 },
  metaValue: { fontSize: 14, color: colors.text, fontWeight: '500' },
  googleMapsBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: '#4285F4',
    borderRadius: radius.md,
    alignItems: 'center',
  },
  googleMapsBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  downloadBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  downloadBtnText: { color: colors.surface, fontWeight: '600' },
});
