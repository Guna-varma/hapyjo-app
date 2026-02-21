import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useGpsLocation } from './useGpsLocation';
import { compressImage } from './compressImage';
import { uploadToSupabase } from './uploadToSupabase';
import { saveGpsRecord } from './saveGpsRecord';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { supabase } from '@/lib/supabase';

const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.gpsmapcamera.geotagginglocationonphoto&hl=en_IN&pli=1';

const UPLOAD_RETRIES = 2;
const FALLBACK_LAT = 0;
const FALLBACK_LON = 0;

export function GpsCameraScreen({ onBack }: { onBack?: () => void }) {
  const { user } = useAuth();
  const { t } = useLocale();
  const theme = useResponsiveTheme();
  const { getCurrentLocation, error: gpsError } = useGpsLocation();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('prune_old_gps_photos').then(() => {}).catch(() => {});
  }, []);

  const openPlayStore = useCallback(() => {
    Linking.openURL(PLAY_STORE_URL);
  }, []);

  const showUploadChoice = useCallback(() => {
    if (!user?.id) {
      Alert.alert(t('alert_error'), t('gps_camera_must_sign_in'));
      return;
    }
    Alert.alert(
      t('gps_camera_app_title'),
      t('gps_camera_do_you_have_app'),
      [
        { text: t('gps_camera_no_download'), onPress: () => showNoAppPopup() },
        { text: t('gps_camera_yes_upload'), onPress: () => showHasAppAndPickPhoto() },
        { text: t('common_cancel'), style: 'cancel' },
      ]
    );
  }, [user?.id, t]);

  const showNoAppPopup = useCallback(() => {
    Alert.alert(
      t('gps_camera_download_title'),
      t('gps_camera_download_message'),
      [
        { text: t('gps_camera_open_play_store'), onPress: openPlayStore },
        { text: t('common_ok') },
      ]
    );
  }, [t, openPlayStore]);

  const showHasAppAndPickPhoto = useCallback(() => {
    Alert.alert(
      t('gps_camera_capture_title'),
      t('gps_camera_capture_message'),
      [{ text: t('common_ok'), onPress: pickAndUploadPhoto }]
    );
  }, [t]);

  const pickAndUploadPhoto = useCallback(async () => {
    if (!user?.id) return;

    const { status: permStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permStatus !== 'granted') {
      Alert.alert(t('alert_error'), t('gps_camera_need_media_permission'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    const photoUri = result.assets[0].uri;
    setUploading(true);

    setStatus(t('gps_camera_status_compressing'));
    let compressedUri: string;
    try {
      compressedUri = await compressImage(photoUri);
    } catch (e) {
      setUploading(false);
      setStatus(null);
      Alert.alert(t('alert_compression_error'), e instanceof Error ? e.message : t('gps_camera_compress_failed'));
      return;
    }

    setStatus(t('gps_camera_status_uploading'));
    let imageUrl: string | null = null;
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= UPLOAD_RETRIES; attempt++) {
      try {
        imageUrl = await uploadToSupabase(compressedUri);
        lastError = null;
        break;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (attempt < UPLOAD_RETRIES) {
          setStatus(`${t('gps_camera_upload_retry')} ${attempt + 2}/${UPLOAD_RETRIES + 1}…`);
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }
    if (lastError || !imageUrl) {
      setUploading(false);
      setStatus(null);
      Alert.alert(t('alert_upload_error'), lastError?.message || t('gps_camera_upload_failed'));
      return;
    }

    setStatus(t('gps_camera_status_saving'));
    let latitude = FALLBACK_LAT;
    let longitude = FALLBACK_LON;
    try {
      const coords = await getCurrentLocation();
      latitude = coords.latitude;
      longitude = coords.longitude;
    } catch (_e) {
      /* use fallback 0,0 so we still save the photo */
    }

    const capturedAt = new Date();
    try {
      await saveGpsRecord(user.id, {
        image_url: imageUrl,
        latitude,
        longitude,
        address: null,
        city: null,
        region: null,
        country: null,
        postal_code: null,
        captured_at: capturedAt.toISOString(),
      });
    } catch (e) {
      setUploading(false);
      setStatus(null);
      Alert.alert(t('alert_save_error'), e instanceof Error ? e.message : t('gps_camera_save_failed'));
      return;
    }

    setUploading(false);
    setStatus(null);
    Alert.alert(t('alert_done'), t('gps_camera_photo_saved'), [{ text: t('common_ok') }]);
  }, [user?.id, getCurrentLocation, t]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('gps_camera_screen_title')}</Text>
        <Text style={styles.instruction}>{t('gps_camera_screen_instruction')}</Text>

        <TouchableOpacity onPress={openPlayStore} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>{t('gps_camera_get_app')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={showUploadChoice}
          disabled={uploading}
          style={[styles.secondaryBtn, uploading && styles.btnDisabled]}
        >
          {uploading ? (
            <ActivityIndicator color="#1E40AF" />
          ) : (
            <Text style={styles.secondaryBtnText}>{t('gps_camera_upload_photo')}</Text>
          )}
        </TouchableOpacity>
      </View>

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
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useResponsiveTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    content: {
      flex: 1,
      padding: theme.screenPadding,
      paddingVertical: theme.spacingLg,
      justifyContent: 'center',
      alignItems: 'stretch',
    },
    title: {
      fontSize: theme.fontSizeTitle,
      fontWeight: '700',
      color: '#0f172a',
      marginBottom: theme.spacingMd,
      textAlign: 'center',
    },
    instruction: {
      fontSize: theme.fontSizeBase - 1,
      color: '#475569',
      lineHeight: theme.fontSizeBase + 6,
      marginBottom: theme.spacingXl,
      textAlign: 'center',
    },
    primaryBtn: {
      backgroundColor: '#2563eb',
      paddingVertical: theme.spacingMd,
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: theme.spacingMd,
    },
    primaryBtnText: { color: '#fff', fontSize: theme.fontSizeBase, fontWeight: '600' },
    secondaryBtn: {
      backgroundColor: '#fff',
      paddingVertical: theme.spacingMd,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#1E40AF',
    },
    btnDisabled: { opacity: 0.7 },
    secondaryBtnText: { color: '#1E40AF', fontSize: theme.fontSizeBase, fontWeight: '600' },
    banner: {
      position: 'absolute',
      top: theme.spacingLg + 24,
      left: theme.screenPadding,
      right: theme.screenPadding,
      backgroundColor: 'rgba(200,0,0,0.8)',
      padding: theme.spacingSm,
      borderRadius: theme.spacingSm,
    },
    bannerText: { color: '#fff', fontSize: theme.fontSizeCaption },
    statusBar: {
      position: 'absolute',
      bottom: theme.spacingLg,
      alignSelf: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: theme.spacingMd,
      paddingVertical: theme.spacingSm,
      borderRadius: theme.spacingSm,
    },
    statusText: { color: '#fff', fontSize: theme.fontSizeCaption },
  });
}
