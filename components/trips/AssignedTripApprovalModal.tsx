/**
 * Assistant supervisor: verify trip/task and enter start/end readings to compute distance/hours and fuel.
 * Truck: start_odometer_km, end_odometer_km → distance_km, fuel_used_l = distance / (km/L).
 * Machine: start_hour_meter, end_hour_meter → hours_used, fuel_used_l = hours * (L/hour).
 */

import React, { useState, useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ScrollView, Image, Alert } from 'react-native';
import type { AssignedTrip } from '@/types';
import type { Vehicle } from '@/types';
import { getTripPhotoPublicUrl } from '@/lib/tripPhotoStorage';
import { saveImageToDevice } from '@/lib/saveImageToDevice';
import { useLocale } from '@/context/LocaleContext';

interface AssignedTripApprovalModalProps {
  visible: boolean;
  trip: AssignedTrip | null;
  vehicle: Vehicle | null;
  onApprove: (payload: {
    startReading: number;
    endReading: number;
    distanceKm?: number;
    hoursUsed?: number;
    fuelUsedL: number;
  }) => Promise<void>;
  onClose: () => void;
}

export function AssignedTripApprovalModal({
  visible,
  trip,
  vehicle,
  onApprove,
  onClose,
}: AssignedTripApprovalModalProps) {
  const { t } = useLocale();
  const [startReading, setStartReading] = useState('');
  const [endReading, setEndReading] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloadingPhoto, setDownloadingPhoto] = useState<'start' | 'end' | null>(null);

  const handleDownloadPhoto = async (url: string, kind: 'start' | 'end') => {
    setDownloadingPhoto(kind);
    try {
      await saveImageToDevice(url, `trip-${trip?.id ?? 'trip'}-${kind}.jpg`);
      Alert.alert('', t('image_saved_to_device'));
    } catch {
      Alert.alert(t('alert_error'), t('image_save_failed'));
    } finally {
      setDownloadingPhoto(null);
    }
  };

  const isTruck = trip?.vehicleType === 'truck';
  const startNum = parseFloat(startReading);
  const endNum = parseFloat(endReading);
  const validReadings = !Number.isNaN(startNum) && !Number.isNaN(endNum) && endNum >= startNum;

  const fuelRate = vehicle?.fuelRate ?? (isTruck ? vehicle?.mileageKmPerLitre : (vehicle?.hoursPerLitre != null && vehicle.hoursPerLitre > 0 ? 1 / vehicle.hoursPerLitre : undefined));
  const { distanceKm, hoursUsed, fuelUsedL } = useMemo(() => {
    if (!validReadings || fuelRate == null || fuelRate <= 0) {
      return { distanceKm: undefined as number | undefined, hoursUsed: undefined as number | undefined, fuelUsedL: 0 };
    }
    if (isTruck) {
      const d = endNum - startNum;
      return { distanceKm: d, hoursUsed: undefined, fuelUsedL: d / fuelRate };
    }
    const h = endNum - startNum;
    return { distanceKm: undefined, hoursUsed: h, fuelUsedL: h * fuelRate };
  }, [isTruck, validReadings, startNum, endNum, fuelRate]);

  const durationText = trip?.startedAt && trip?.endedAt
    ? (() => {
        const start = new Date(trip.startedAt).getTime();
        const end = new Date(trip.endedAt).getTime();
        const segments = trip.pauseSegments ?? [];
        let pauseMs = 0;
        for (const seg of segments) {
          const s = new Date(seg.startedAt).getTime();
          const e = seg.endedAt ? new Date(seg.endedAt).getTime() : end;
          if (e > s) pauseMs += e - s;
        }
        const elapsed = Math.max(0, end - start - pauseMs);
        const m = Math.floor(elapsed / 60000);
        const h = Math.floor(m / 60);
        return `${h}h ${m % 60}m`;
      })()
    : '—';
  const pauseText = (() => {
    const segments = trip?.pauseSegments ?? [];
    let total = 0;
    for (const seg of segments) {
      if (seg.endedAt) total += new Date(seg.endedAt).getTime() - new Date(seg.startedAt).getTime();
    }
    if (total <= 0) return '0m';
    return `${Math.floor(total / 60000)}m`;
  })();

  const handleApprove = async () => {
    if (!validReadings || fuelUsedL < 0) return;
    setSubmitting(true);
    try {
      await onApprove({
        startReading: startNum,
        endReading: endNum,
        distanceKm,
        hoursUsed,
        fuelUsedL,
      });
      onClose();
    } catch (e) {
      Alert.alert(t('alert_error'), e instanceof Error ? e.message : t('assigned_trip_confirm'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!trip) return null;

  const startPhotoUrl = trip.startPhotoUrl ? getTripPhotoPublicUrl(trip.startPhotoUrl) : null;
  const endPhotoUrl = trip.endPhotoUrl ? getTripPhotoPublicUrl(trip.endPhotoUrl) : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1e293b' }}>{t('trip_approval_title')}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ fontSize: 16, color: '#2563eb', fontWeight: '600' }}>{t('common_cancel')}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8 }}>{t('trip_approval_photos')}</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {startPhotoUrl ? (
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{t('trip_approval_start_photo')}</Text>
                  <Image source={{ uri: startPhotoUrl }} style={{ width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: '#e2e8f0' }} resizeMode="cover" />
                  <TouchableOpacity
                    onPress={() => handleDownloadPhoto(startPhotoUrl, 'start')}
                    disabled={downloadingPhoto !== null}
                    style={{ marginTop: 6, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#e2e8f0', borderRadius: 6, alignSelf: 'flex-start' }}
                  >
                    <Text style={{ fontSize: 12, color: '#475569', fontWeight: '600' }}>
                      {downloadingPhoto === 'start' ? t('common_loading') : t('trip_approval_download_photo')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {endPhotoUrl ? (
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{t('trip_approval_end_photo')}</Text>
                  <Image source={{ uri: endPhotoUrl }} style={{ width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: '#e2e8f0' }} resizeMode="cover" />
                  <TouchableOpacity
                    onPress={() => handleDownloadPhoto(endPhotoUrl, 'end')}
                    disabled={downloadingPhoto !== null}
                    style={{ marginTop: 6, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#e2e8f0', borderRadius: 6, alignSelf: 'flex-start' }}
                  >
                    <Text style={{ fontSize: 12, color: '#475569', fontWeight: '600' }}>
                      {downloadingPhoto === 'end' ? t('common_loading') : t('trip_approval_download_photo')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {!startPhotoUrl && !endPhotoUrl && <Text style={{ fontSize: 14, color: '#94a3b8' }}>{t('trip_approval_no_photos')}</Text>}
            </View>
          </View>
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8 }}>{t('trip_approval_gps')}</Text>
            <Text style={{ fontSize: 13, color: '#475569' }}>
              Start: {trip.startGpsLat != null && trip.startGpsLng != null ? `${trip.startGpsLat.toFixed(5)}, ${trip.startGpsLng.toFixed(5)}` : '—'}
            </Text>
            <Text style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
              End: {trip.endGpsLat != null && trip.endGpsLng != null ? `${trip.endGpsLat.toFixed(5)}, ${trip.endGpsLng.toFixed(5)}` : '—'}
            </Text>
          </View>
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8 }}>{t('trip_approval_duration')}</Text>
            <Text style={{ fontSize: 13, color: '#475569' }}>{t('trip_approval_elapsed')}: {durationText} · {t('trip_approval_pause')}: {pauseText}</Text>
          </View>
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8 }}>
              {isTruck ? t('trip_approval_odometer_km') : t('trip_approval_hour_meter')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{t('trip_approval_start_reading')}</Text>
                <TextInput
                  value={startReading}
                  onChangeText={setStartReading}
                  placeholder={isTruck ? '0' : '0.0'}
                  keyboardType="decimal-pad"
                  style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fff' }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{t('trip_approval_end_reading')}</Text>
                <TextInput
                  value={endReading}
                  onChangeText={setEndReading}
                  placeholder={isTruck ? '0' : '0.0'}
                  keyboardType="decimal-pad"
                  style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fff' }}
                />
              </View>
            </View>
          </View>
          {validReadings && (distanceKm != null || hoursUsed != null) && (
            <View style={{ marginBottom: 16, padding: 12, backgroundColor: '#f1f5f9', borderRadius: 8 }}>
              <Text style={{ fontSize: 13, color: '#475569' }}>
                {isTruck ? `${t('trip_approval_distance')}: ${distanceKm!.toFixed(1)} km` : `${t('trip_approval_hours_used')}: ${hoursUsed!.toFixed(1)} h`}
              </Text>
              <Text style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>{t('trip_approval_fuel_used')}: {fuelUsedL.toFixed(1)} L</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={handleApprove}
            disabled={!validReadings || fuelUsedL < 0 || submitting}
            style={{
              backgroundColor: validReadings && fuelUsedL >= 0 ? '#059669' : '#94a3b8',
              paddingVertical: 14,
              borderRadius: 10,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>
              {submitting ? t('common_loading') : t('assigned_trip_confirm')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}
