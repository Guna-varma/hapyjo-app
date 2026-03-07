/**
 * Modal for capturing one start/end trip photo (speedometer/hour-meter).
 * Compresses to ~50KB, uploads. GPS is mandatory for assignment evidence.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Camera } from 'lucide-react-native';
import { uploadTripPhoto } from '@/lib/tripPhotoStorage';
import { useLocale } from '@/context/LocaleContext';
import { parseExifGps } from '@/lib/workPhotoExif';
import { getCoordsWithTimeout } from '@/lib/getCurrentPositionWithTimeout';

export type TripPhotoKind = 'start' | 'end';

export interface TripPhotoCaptureResult {
  photoUrl: string;
  lat: number | null;
  lng: number | null;
}

interface TripPhotoCaptureModalProps {
  visible: boolean;
  assignedTripId: string;
  kind: TripPhotoKind;
  vehicleType: 'truck' | 'machine';
  onResult: (result: TripPhotoCaptureResult) => void;
  onCancel: () => void;
}

export function TripPhotoCaptureModal({
  visible,
  assignedTripId,
  kind,
  vehicleType,
  onResult,
  onCancel,
}: TripPhotoCaptureModalProps) {
  const { t } = useLocale();
  const [uploading, setUploading] = useState(false);

  const instruction =
    kind === 'start'
      ? vehicleType === 'truck'
        ? t('trip_capture_start_truck')
        : t('trip_capture_start_machine')
      : vehicleType === 'truck'
        ? t('trip_capture_end_truck')
        : t('trip_capture_end_machine');

  const handleCapture = async () => {
    setUploading(true);
    try {
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus !== 'granted') {
        Alert.alert(t('alert_error'), t('location_required_trip_start'));
        return;
      }
      const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (camStatus !== 'granted') {
        Alert.alert(t('alert_error'), t('trip_camera_permission_required'));
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        exif: true,
      });
      if (result.canceled || !result.assets[0]?.uri) {
        setUploading(false);
        return;
      }
      const asset = result.assets[0];
      const exifGps = parseExifGps((asset as { exif?: Record<string, unknown> | null }).exif);
      let lat = exifGps?.latitude ?? null;
      let lng = exifGps?.longitude ?? null;
      if (lat == null || lng == null) {
        const coords = await getCoordsWithTimeout({
          timeoutMs: 10_000,
          useCachedFallback: true,
          accuracy: Location.Accuracy.High,
        });
        lat = coords.lat;
        lng = coords.lon;
      }
      if (lat == null || lng == null) {
        Alert.alert(t('alert_error'), t('common_gps_position_failed'));
        return;
      }
      const photoUrl = await uploadTripPhoto(assignedTripId, kind, result.assets[0].uri);
      onResult({ photoUrl, lat, lng });
    } catch (e) {
      Alert.alert(t('alert_error'), e instanceof Error ? e.message : t('trip_capture_upload_failed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 12 }}>
            {kind === 'start' ? t('trip_capture_title_start') : t('trip_capture_title_end')}
          </Text>
          <Text style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>{instruction}</Text>
          {uploading ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={{ marginTop: 12, fontSize: 14, color: '#64748b' }}>{t('trip_capture_uploading')}</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end' }}>
              <TouchableOpacity onPress={onCancel} style={{ paddingVertical: 12, paddingHorizontal: 20 }}>
                <Text style={{ fontSize: 16, color: '#64748b', fontWeight: '600' }}>{t('common_cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCapture}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 }}
              >
                <Camera size={20} color="#fff" />
                <Text style={{ fontSize: 16, color: '#fff', fontWeight: '600', marginLeft: 8 }}>{t('trip_capture_take_photo')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
