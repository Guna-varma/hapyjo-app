import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { useGpsLocation } from './useGpsLocation';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { canAccessTab } from '@/lib/rbac';
import {
  validateAndPrepareWorkPhoto,
  generateThumbnail,
  uploadWorkPhoto,
  isAllowedImageFormat,
} from '@/lib/workPhotoUpload';
import { parseExifGps } from '@/lib/workPhotoExif';
import { useToast } from '@/context/ToastContext';
import { generateId } from '@/lib/id';
import { Camera, Image as ImageIcon, CheckCircle } from 'lucide-react-native';
import { colors, radius, spacing } from '@/theme/tokens';
import { FilterChips } from '@/components/ui';
import { WorkProgressGalleryScreen } from '@/components/workProgress/WorkProgressGalleryScreen';

const ALL_SITES_VALUE = '';
const WORK_PHOTO_RETENTION_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Owner & Head Supervisor see only photos uploaded by Surveyor or Assistant Supervisor. */
const UPLOADER_ROLES_FOR_OWNER_HS: string[] = ['surveyor', 'assistant_supervisor'];

export function GpsCameraScreen({ onBack }: { onBack?: () => void }) {
  const { user } = useAuth();
  const { t } = useLocale();
  const theme = useResponsiveTheme();
  const { showToast } = useToast();
  const { getCurrentLocation, error: gpsError } = useGpsLocation();
  const { sites, siteAssignments, users, addWorkPhoto, refetch, workPhotos } = useMockAppStore();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const canAccess = user?.role && canAccessTab(user.role, 'gps_camera');
  const canCapture = canAccess && (user?.role === 'assistant_supervisor' || user?.role === 'surveyor');
  const mySiteIds = useMemo(() => {
    if (!user?.id) return [];
    const fromAssignments = siteAssignments.filter((a) => a.userId === user.id).map((a) => a.siteId);
    if (user.role === 'assistant_supervisor') {
      const fromSites = sites.filter((s) => s.assistantSupervisorId === user.id).map((s) => s.id);
      return [...new Set([...fromAssignments, ...fromSites])];
    }
    return fromAssignments;
  }, [user?.id, user?.role, siteAssignments, sites]);
  const teamRoles = ['driver_truck', 'driver_machine', 'surveyor'];
  /** Sites this user is allowed to see in the gallery (for site dropdown). Owner: all; Head Supervisor / AS / Surveyor: allocated only. */
  const allowedGallerySiteIds = useMemo(() => {
    if (user?.role === 'owner') return sites.map((s) => s.id);
    return mySiteIds.length > 0 ? mySiteIds : sites.map((s) => s.id);
  }, [user?.role, mySiteIds, sites]);

  const filteredWorkPhotos = useMemo(() => {
    const cutoff = Date.now() - WORK_PHOTO_RETENTION_DAYS * MS_PER_DAY;
    const withinRetention = (p: { createdAt: string }) => new Date(p.createdAt).getTime() >= cutoff;

    if (user?.role === 'owner' || user?.role === 'head_supervisor') {
      return workPhotos.filter(
        (p) =>
          withinRetention(p) &&
          UPLOADER_ROLES_FOR_OWNER_HS.includes(p.userRole) &&
          (allowedGallerySiteIds.length === 0 || allowedGallerySiteIds.includes(p.siteId))
      );
    }
    if (user?.role === 'assistant_supervisor') {
      return workPhotos.filter(
        (p) =>
          withinRetention(p) &&
          mySiteIds.includes(p.siteId) &&
          teamRoles.includes(users.find((u) => u.id === p.uploadedBy)?.role ?? '')
      );
    }
    if (user?.role === 'surveyor') {
      return workPhotos.filter(
        (p) =>
          withinRetention(p) &&
          mySiteIds.includes(p.siteId) &&
          p.uploadedBy === user?.id
      );
    }
    return workPhotos.filter(withinRetention);
  }, [workPhotos, user?.role, user?.id, mySiteIds, allowedGallerySiteIds, users]);

  const siteOptions = useMemo(() => {
    const list = user?.role === 'assistant_supervisor' || user?.role === 'surveyor'
      ? sites.filter((s) => mySiteIds.length === 0 || mySiteIds.includes(s.id))
      : sites;
    return [{ value: ALL_SITES_VALUE, label: t('work_photo_select_site') }, ...list.map((s) => ({ value: s.id, label: s.name }))];
  }, [sites, mySiteIds, user?.role, t]);

  const [siteId, setSiteId] = useState(ALL_SITES_VALUE);
  const [capturing, setCapturing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryRefreshing, setGalleryRefreshing] = useState(false);
  const handleGalleryRefresh = useCallback(async () => {
    setGalleryRefreshing(true);
    await refetch();
    setGalleryRefreshing(false);
  }, [refetch]);

  /** Shared: validate → compress → thumbnail → upload → save. Keeps flow lightweight, no duplicate code. */
  const processAndSaveWorkPhoto = useCallback(
    async (imageUri: string, latitude: number, longitude: number) => {
      if (!user?.id || !user?.role || !siteId || siteId === ALL_SITES_VALUE) return;
      try {
        setStatus(t('work_photo_status_compress'));
        const { uri: photoUri } = await validateAndPrepareWorkPhoto(imageUri);
        const thumbUri = await generateThumbnail(photoUri);
        const photoId = generateId('wp');
        setStatus(t('work_photo_status_upload'));
        const { photoUrl, thumbnailUrl } = await uploadWorkPhoto(photoId, photoUri, thumbUri);
        setStatus(t('work_photo_status_save'));
        await addWorkPhoto({
          photoUrl,
          thumbnailUrl,
          latitude,
          longitude,
          siteId,
          uploadedBy: user.id,
          userRole: user.role,
        });
        await refetch();
        setCapturing(false);
        setStatus(null);
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 2500);
        showToast(t('work_photo_upload_success'));
      } catch (e) {
        setCapturing(false);
        setStatus(null);
        const msg = e instanceof Error ? e.message : t('alert_error');
        Alert.alert(t('alert_error'), msg);
      }
    },
    [user?.id, user?.role, siteId, addWorkPhoto, refetch, t, showToast]
  );

  const handleCaptureWorkPhoto = useCallback(async () => {
    if (!user?.id || !user?.role) return;
    if (!siteId || siteId === ALL_SITES_VALUE) {
      showToast(t('work_photo_select_site'));
      return;
    }
    setCapturing(true);
    setStatus(t('work_photo_status_gps'));
    let latitude: number;
    let longitude: number;
    try {
      const coords = await getCurrentLocation();
      latitude = coords.latitude;
      longitude = coords.longitude;
    } catch {
      setCapturing(false);
      setStatus(null);
      Alert.alert(t('alert_error'), t('work_photo_location_required'));
      return;
    }
    setStatus(t('work_photo_status_capture'));
    const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraPerm.status !== 'granted') {
      setCapturing(false);
      setStatus(null);
      Alert.alert(t('alert_error'), t('gps_camera_need_media_permission'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
      exif: true,
    });
    if (result.canceled || !result.assets?.[0]?.uri) {
      setCapturing(false);
      setStatus(null);
      return;
    }
    const asset = result.assets[0];
    const uri = asset.uri;
    const mimeType = (asset as { mimeType?: string }).mimeType;
    if (!isAllowedImageFormat(uri, mimeType)) {
      setCapturing(false);
      setStatus(null);
      Alert.alert(t('alert_error'), t('work_photo_only_images'));
      return;
    }
    const exifGps = parseExifGps((asset as { exif?: Record<string, unknown> | null }).exif);
    const lat = exifGps?.latitude ?? latitude;
    const lon = exifGps?.longitude ?? longitude;
    await processAndSaveWorkPhoto(uri, lat, lon);
  }, [user?.id, user?.role, siteId, getCurrentLocation, t, showToast, processAndSaveWorkPhoto]);

  /** Fallback when camera not working: pick from gallery; uses current GPS and upload time. */
  const handleUploadFromGallery = useCallback(async () => {
    if (!user?.id || !user?.role) return;
    if (!siteId || siteId === ALL_SITES_VALUE) {
      showToast(t('work_photo_select_site'));
      return;
    }
    setCapturing(true);
    setStatus(t('work_photo_status_gps'));
    let latitude: number;
    let longitude: number;
    try {
      const coords = await getCurrentLocation();
      latitude = coords.latitude;
      longitude = coords.longitude;
    } catch {
      setCapturing(false);
      setStatus(null);
      Alert.alert(t('alert_error'), t('work_photo_location_required'));
      return;
    }
    const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (libPerm.status !== 'granted') {
      setCapturing(false);
      setStatus(null);
      Alert.alert(t('alert_error'), t('gps_camera_need_media_permission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
      exif: true,
    });
    if (result.canceled || !result.assets?.[0]?.uri) {
      setCapturing(false);
      setStatus(null);
      return;
    }
    const asset = result.assets[0];
    const uri = asset.uri;
    const mimeType = (asset as { mimeType?: string }).mimeType;
    if (!isAllowedImageFormat(uri, mimeType)) {
      setCapturing(false);
      setStatus(null);
      Alert.alert(t('alert_error'), t('work_photo_only_images'));
      return;
    }
    const exifGps = parseExifGps((asset as { exif?: Record<string, unknown> | null }).exif);
    const lat = exifGps?.latitude ?? latitude;
    const lon = exifGps?.longitude ?? longitude;
    await processAndSaveWorkPhoto(uri, lat, lon);
  }, [user?.id, user?.role, siteId, getCurrentLocation, t, showToast, processAndSaveWorkPhoto]);

  if (!canAccess) {
    return (
      <View style={styles.container}>
        <View style={styles.blockContent}>
          <Text style={styles.blockTitle}>{t('work_photo_only_roles')}</Text>
          <Text style={styles.blockMessage}>
            Only Surveyors and Assistant Supervisors can capture work progress photos at site locations.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('gps_camera_screen_title')}</Text>
        <Text style={styles.instruction}>
          Capture work progress photos with GPS. Location required. Compressed to ~50KB. {t('work_photo_exif_hint')}
        </Text>
        {canCapture && (
          <>
            <Text style={styles.label}>{t('work_photo_site')}</Text>
            <FilterChips
              options={siteOptions}
              value={siteId}
              onChange={setSiteId}
              scroll={siteOptions.length > 4}
            />
            <TouchableOpacity
              onPress={handleCaptureWorkPhoto}
              disabled={capturing || !siteId || siteId === ALL_SITES_VALUE}
              style={[styles.captureBtn, (capturing || !siteId || siteId === ALL_SITES_VALUE) && styles.captureBtnDisabled]}
            >
              {capturing ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <>
                  <Camera size={22} color={colors.surface} />
                  <Text style={styles.captureBtnText}>{t('work_photo_capture_btn')}</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleUploadFromGallery}
              disabled={capturing || !siteId || siteId === ALL_SITES_VALUE}
              style={[styles.galleryUploadBtn, (capturing || !siteId || siteId === ALL_SITES_VALUE) && styles.captureBtnDisabled]}
            >
              <ImageIcon size={20} color={colors.primary} />
              <Text style={styles.galleryUploadBtnText}>{t('work_photo_upload_from_gallery')}</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>{t('work_photo_upload_from_gallery_hint')}</Text>
            {uploadSuccess && (
              <View style={styles.successRow}>
                <CheckCircle size={20} color={colors.successText} />
                <Text style={styles.successText}>{t('work_photo_upload_success')}</Text>
              </View>
            )}
          </>
        )}
        <TouchableOpacity onPress={() => setShowGallery(true)} style={styles.galleryBtn}>
          <ImageIcon size={20} color={colors.primary} />
          <Text style={styles.galleryBtnText}>{t('work_photo_view_gallery')}</Text>
        </TouchableOpacity>
      </ScrollView>
      {gpsError ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{gpsError}</Text>
        </View>
      ) : null}
      {status ? (
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      ) : null}
      {showGallery && (
        <View style={StyleSheet.absoluteFill}>
          <WorkProgressGalleryScreen
            workPhotos={filteredWorkPhotos}
            sites={sites.filter((s) => allowedGallerySiteIds.includes(s.id))}
            allowedSiteIds={allowedGallerySiteIds}
            users={users}
            onBack={() => setShowGallery(false)}
            onRefresh={handleGalleryRefresh}
            refreshing={galleryRefreshing}
          />
        </View>
      )}
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useResponsiveTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    blockContent: {
      flex: 1,
      padding: theme.screenPadding,
      justifyContent: 'center',
      alignItems: 'center',
    },
    blockTitle: {
      fontSize: theme.fontSizeTitle,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    blockMessage: {
      fontSize: theme.fontSizeBase,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
    },
    scrollContent: {
      padding: theme.screenPadding,
      paddingBottom: theme.spacingXl + 56,
    },
    title: {
      fontSize: theme.fontSizeTitle,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.sm,
    },
    instruction: {
      fontSize: theme.fontSizeBase - 1,
      color: colors.textMuted,
      lineHeight: 22,
      marginBottom: spacing.md,
    },
    label: {
      fontSize: theme.fontSizeCaption,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    captureBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      marginTop: spacing.md,
    },
    captureBtnDisabled: { opacity: 0.6 },
    captureBtnText: { color: colors.surface, fontSize: theme.fontSizeBase, fontWeight: '600' },
    galleryUploadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      marginTop: spacing.sm,
    },
    galleryUploadBtnText: { color: colors.primary, fontSize: theme.fontSizeBase - 1, fontWeight: '600' },
    hint: {
      fontSize: theme.fontSizeCaption,
      color: colors.textMuted,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },
    successRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.gray100 ?? colors.background,
      borderRadius: 8,
    },
    successText: { color: colors.successText, fontSize: theme.fontSizeBase, fontWeight: '600' },
    galleryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      marginTop: spacing.sm,
    },
    galleryBtnText: { color: colors.primary, fontSize: theme.fontSizeBase, fontWeight: '600' },
    banner: {
      position: 'absolute',
      top: spacing.lg + 24,
      left: theme.screenPadding,
      right: theme.screenPadding,
      backgroundColor: 'rgba(200,0,0,0.85)',
      padding: spacing.sm,
      borderRadius: radius.sm,
    },
    bannerText: { color: colors.surface, fontSize: theme.fontSizeCaption },
    statusBar: {
      position: 'absolute',
      bottom: spacing.lg,
      alignSelf: 'center',
      backgroundColor: 'rgba(0,0,0,0.65)',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
    },
    statusText: { color: colors.surface, fontSize: theme.fontSizeCaption },
  });
}
