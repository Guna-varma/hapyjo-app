import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { generateId } from '@/lib/id';
import { Play, Square, Fuel, MapPin, Camera, Pause, PlayCircle, CheckCircle } from 'lucide-react-native';
import { getNextDriverStatus, ASSIGNED_TRIP_STATUS_LABELS, ASSIGNED_TRIP_STATUS_COLORS } from '@/lib/tripLifecycle';
import * as Linking from 'expo-linking';
import {
  validateAndPrepareWorkPhoto,
  generateThumbnail,
  uploadWorkPhoto,
  isAllowedImageFormat,
} from '@/lib/workPhotoUpload';
import { parseExifGps } from '@/lib/workPhotoExif';

const LIVE_LOCATION_INTERVAL_MS = 30000;

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getDateKey(iso: string, period: 'day' | 'month' | 'year') {
  const d = iso.slice(0, 10);
  if (period === 'day') return d;
  if (period === 'month') return d.slice(0, 7);
  return d.slice(0, 4);
}

export function DriverTripsScreen() {
  const { user } = useAuth();
  const { t } = useLocale();
  const theme = useResponsiveTheme();
  const {
    sites,
    vehicles,
    users,
    trips,
    machineSessions,
    assignedTrips,
    updateAssignedTripStatus,
    addTrip,
    updateTrip,
    addMachineSession,
    updateMachineSession,
    updateVehicle,
    addExpense,
    updateUser,
    addWorkPhoto,
    loading,
  } = useMockAppStore();

  const isSupervisorView = user?.role === 'assistant_supervisor' || user?.role === 'head_supervisor';
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const driverList = users.filter((u) => u.role === 'driver_truck' || u.role === 'driver_machine');
  const targetUserId = isSupervisorView ? (selectedDriverId ?? driverList[0]?.id) : (user?.id ?? '');

  const isTruck = isSupervisorView ? (users.find((u) => u.id === targetUserId)?.role === 'driver_truck') : (user?.role === 'driver_truck');
  const userId = user?.id ?? '';

  const mySiteIds = sites
    .filter((s) => s.driverIds?.includes(userId) || s.assistantSupervisorId === userId)
    .map((s) => s.id);
  if (mySiteIds.length === 0) {
    mySiteIds.push(...sites.map((s) => s.id));
  }
  const myVehicles = vehicles.filter(
    (v) => (v.siteId == null || mySiteIds.includes(v.siteId)) && (isTruck ? v.type === 'truck' : v.type === 'machine')
  );

  const myTrips = trips.filter((t) => t.driverId === targetUserId);
  const mySessions = machineSessions.filter((m) => m.driverId === targetUserId);
  const activeTrip = !isSupervisorView ? myTrips.find((t) => t.status === 'in_progress') : undefined;
  const activeSession = !isSupervisorView ? mySessions.find((m) => m.status === 'in_progress') : undefined;

  const completedTrips = myTrips.filter((t) => t.status === 'completed');
  const completedSessions = mySessions.filter((m) => m.status === 'completed');
  const byLocationTrips = completedTrips.reduce<Record<string, { count: number; distance: number; fuel: number }>>((acc, t) => {
    const sid = t.siteId;
    if (!acc[sid]) acc[sid] = { count: 0, distance: 0, fuel: 0 };
    acc[sid].count += 1;
    acc[sid].distance += t.distanceKm;
    acc[sid].fuel += t.fuelConsumed ?? 0;
    return acc;
  }, {});
  const byLocationSessions = completedSessions.reduce<Record<string, { count: number; hours: number; fuel: number }>>((acc, m) => {
    const sid = m.siteId;
    if (!acc[sid]) acc[sid] = { count: 0, hours: 0, fuel: 0 };
    acc[sid].count += 1;
    acc[sid].hours += m.durationHours ?? 0;
    acc[sid].fuel += m.fuelConsumed ?? 0;
    return acc;
  }, {});
  const byVehicleTrips = completedTrips.reduce<Record<string, { count: number; distance: number }>>((acc, t) => {
    const vid = t.vehicleId;
    if (!acc[vid]) acc[vid] = { count: 0, distance: 0 };
    acc[vid].count += 1;
    acc[vid].distance += t.distanceKm;
    return acc;
  }, {});
  const byVehicleSessions = completedSessions.reduce<Record<string, { count: number; hours: number }>>((acc, m) => {
    const vid = m.vehicleId;
    if (!acc[vid]) acc[vid] = { count: 0, hours: 0 };
    acc[vid].count += 1;
    acc[vid].hours += m.durationHours ?? 0;
    return acc;
  }, {});
  const dailyTrips = completedTrips.filter((t) => getDateKey(t.startTime, 'day') === getDateKey(new Date().toISOString(), 'day'));
  const monthlyTrips = completedTrips.filter((t) => getDateKey(t.startTime, 'month') === getDateKey(new Date().toISOString(), 'month'));
  const yearlyTrips = completedTrips;
  const dailySessions = completedSessions.filter((m) => getDateKey(m.startTime, 'day') === getDateKey(new Date().toISOString(), 'day'));
  const monthlySessions = completedSessions.filter((m) => getDateKey(m.startTime, 'month') === getDateKey(new Date().toISOString(), 'month'));

  const [startModalVisible, setStartModalVisible] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState(myVehicles[0]?.id ?? '');
  const [loadQuantity, setLoadQuantity] = useState('');
  const [fuelFilledAtStart, setFuelFilledAtStart] = useState('');

  const [endSessionModalVisible, setEndSessionModalVisible] = useState(false);
  const [refuelModalVisible, setRefuelModalVisible] = useState(false);
  const [refuelLitres, setRefuelLitres] = useState('');
  const [refuelCostPerLitre, setRefuelCostPerLitre] = useState('');
  const [, setLocationLoading] = useState(false);
  const [locationPermissionModalVisible, setLocationPermissionModalVisible] = useState(false);
  const [endTripModalVisible, setEndTripModalVisible] = useState(false);
  const liveLocationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  type GpsPhoto = { uri: string; lat: number; lon: number };
  const [startPhoto, setStartPhoto] = useState<GpsPhoto | null>(null);
  const [endPhoto, setEndPhoto] = useState<GpsPhoto | null>(null);
  const [takingStartPhoto, setTakingStartPhoto] = useState(false);
  const [takingEndPhoto, setTakingEndPhoto] = useState(false);

  const hasWorkRole = user?.role === 'driver_truck' || user?.role === 'driver_machine' || user?.role === 'assistant_supervisor';

  useEffect(() => {
    if (!hasWorkRole || isSupervisorView) return;
    let mounted = true;
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (mounted && status !== 'granted') {
        setLocationPermissionModalVisible(true);
      }
    })();
    return () => { mounted = false; };
  }, [hasWorkRole, isSupervisorView]);

  // Report driver location every time they open this screen (login / tab focus) — when no active trip, save to profile for supervisor "last seen"
  useEffect(() => {
    if (!userId || isSupervisorView || !hasWorkRole) return;
    const isDriver = user?.role === 'driver_truck' || user?.role === 'driver_machine';
    if (!isDriver) return;
    let mounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !mounted) return;
      const myTripsNow = trips.filter((t) => t.driverId === userId);
      const hasActiveTrip = myTripsNow.some((t) => t.status === 'in_progress');
      if (hasActiveTrip) return; // active trip position is updated by the trip watch effect
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!mounted) return;
        await updateUser(userId, {
          lastLat: pos.coords.latitude,
          lastLon: pos.coords.longitude,
          locationUpdatedAt: new Date().toISOString(),
        });
      } catch {
        // ignore location errors (e.g. timeout); permission modal already shown above
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trips read inside effect to decide skip
  }, [userId, isSupervisorView, hasWorkRole, user?.role, updateUser]);

  const getSiteName = (id: string) => sites.find((s) => s.id === id)?.name ?? id;
  const getVehicleLabel = (id: string) => {
    const v = vehicles.find((ve) => ve.id === id);
    if (!v) return id;
    return `${v.vehicleNumberOrId} (${v.type})`;
  };

  // Live location every 30s for survey/supervisor (no watchPositionAsync to avoid LocationEventEmitter.removeSubscription crash)
  useEffect(() => {
    if (!activeTrip || isSupervisorView) return;
    let mounted = true;
    const tripId = activeTrip.id;
    const pushPosition = (lat: number, lon: number) => {
      if (!mounted) return;
      updateTrip(tripId, {
        currentLat: lat,
        currentLon: lon,
        locationUpdatedAt: new Date().toISOString(),
      });
    };
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !mounted) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (mounted) pushPosition(pos.coords.latitude, pos.coords.longitude);
      const interval = setInterval(async () => {
        if (!mounted) return;
        try {
          const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (mounted) pushPosition(p.coords.latitude, p.coords.longitude);
        } catch {
          // ignore single tick errors
        }
      }, LIVE_LOCATION_INTERVAL_MS);
      liveLocationIntervalRef.current = interval;
    })();
    return () => {
      mounted = false;
      if (liveLocationIntervalRef.current) {
        clearInterval(liveLocationIntervalRef.current);
        liveLocationIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- activeTrip identity used inside
  }, [activeTrip?.id, isSupervisorView, updateTrip]);

  const handleStartTrip = async () => {
    const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
    if (!vehicle || !userId) return;
    const siteId = vehicle.siteId ?? mySiteIds[0];
    if (!siteId) return;
    if (isTruck && !startPhoto) return;
    setLocationLoading(true);
    try {
      let startLat: number;
      let startLon: number;
      if (isTruck && startPhoto) {
        startLat = startPhoto.lat;
        startLon = startPhoto.lon;
        const { uri: photoUri } = await validateAndPrepareWorkPhoto(startPhoto.uri);
        const thumbUri = await generateThumbnail(photoUri);
        const photoId = generateId('wp');
        const { photoUrl, thumbnailUrl } = await uploadWorkPhoto(photoId, photoUri, thumbUri);
        await addWorkPhoto({
          photoUrl,
          thumbnailUrl,
          latitude: startLat,
          longitude: startLon,
          siteId,
          uploadedBy: userId,
          userRole: user?.role ?? 'driver_truck',
        });
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationPermissionModalVisible(true);
          Alert.alert(t('alert_error'), t('location_required_trip_start'));
          return;
        }
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        startLat = position.coords.latitude;
        startLon = position.coords.longitude;
      }
      const filled = parseFloat(fuelFilledAtStart);
      if (!isNaN(filled) && filled > 0) {
        updateVehicle(selectedVehicleId, { fuelBalanceLitre: vehicle.fuelBalanceLitre + filled });
      }
      addTrip({
        id: generateId('t'),
        vehicleId: selectedVehicleId,
        driverId: userId,
        siteId,
        startTime: new Date().toISOString(),
        distanceKm: 0,
        loadQuantity: loadQuantity || undefined,
        fuelFilledAtStart: !isNaN(filled) && filled > 0 ? filled : undefined,
        status: 'in_progress',
        startLat,
        startLon,
        createdAt: new Date().toISOString(),
      });
      setStartModalVisible(false);
      setLoadQuantity('');
      setFuelFilledAtStart('');
      setStartPhoto(null);
    } catch (e) {
      Alert.alert(t('alert_gps_error'), e instanceof Error ? e.message : t('common_gps_position_failed'));
    } finally {
      setLocationLoading(false);
    }
  };

  const requestLocationAndClosePermissionModal = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermissionModalVisible(false);
    if (status !== 'granted') {
      try {
        await Linking.openSettings();
      } catch {
        // openSettings not available on this platform
      }
    }
  };

  const captureGpsPhoto = async (): Promise<GpsPhoto | null> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationPermissionModalVisible(true);
      return null;
    }
    let lat: number;
    let lon: number;
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
    } catch {
      Alert.alert(t('alert_gps_error'), t('common_gps_position_failed'));
      return null;
    }
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (cam.status !== 'granted') {
      Alert.alert(t('alert_error'), t('gps_camera_need_media_permission'));
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
      exif: true,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return null;
    const asset = result.assets[0];
    const uri = asset.uri;
    const mimeType = (asset as { mimeType?: string }).mimeType;
    if (!isAllowedImageFormat(uri, mimeType)) {
      Alert.alert(t('alert_error'), t('work_photo_only_images'));
      return null;
    }
    const exifGps = parseExifGps((asset as { exif?: Record<string, unknown> | null }).exif);
    const finalLat = exifGps?.latitude ?? lat;
    const finalLon = exifGps?.longitude ?? lon;
    return { uri, lat: finalLat, lon: finalLon };
  };

  const takeStartPhoto = async () => {
    setTakingStartPhoto(true);
    const photo = await captureGpsPhoto();
    setTakingStartPhoto(false);
    if (photo) setStartPhoto(photo);
  };

  const takeEndPhoto = async () => {
    setTakingEndPhoto(true);
    const photo = await captureGpsPhoto();
    setTakingEndPhoto(false);
    if (photo) setEndPhoto(photo);
  };

  const handleEndTrip = async (photoUri?: string, endLat?: number, endLon?: number) => {
    if (!activeTrip) return;
    const vehicle = vehicles.find((v) => v.id === activeTrip.vehicleId);
    if (!vehicle) return;
    setLocationLoading(true);
    try {
      let lat = endLat;
      let lon = endLon;
      if (lat == null || lon == null) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationPermissionModalVisible(true);
          Alert.alert(t('alert_error'), t('location_required_trip_end'));
          return;
        }
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = position.coords.latitude;
        lon = position.coords.longitude;
      }
      const endLatVal = lat!;
      const endLonVal = lon!;
      const startLat = activeTrip.startLat ?? 0;
      const startLon = activeTrip.startLon ?? 0;
      let distanceKm = Math.round(haversineKm(startLat, startLon, endLatVal, endLonVal) * 100) / 100;
      if (distanceKm <= 0) distanceKm = 0.01;
      const endTime = new Date().toISOString();
      updateTrip(activeTrip.id, {
        endTime,
        endLat: endLatVal,
        endLon: endLonVal,
        distanceKm,
        status: 'completed',
        photoUri,
        currentLat: undefined,
        currentLon: undefined,
        locationUpdatedAt: undefined,
      });
    } catch (e) {
      Alert.alert(t('alert_gps_error'), e instanceof Error ? e.message : t('common_gps_position_failed'));
    } finally {
      setLocationLoading(false);
    }
  };

  const openEndTripModal = () => {
    setEndPhoto(null);
    setEndTripModalVisible(true);
  };

  const endTripWithGpsPhoto = async () => {
    if (!endPhoto || !activeTrip) return;
    setEndTripModalVisible(false);
    setLocationLoading(true);
    try {
      const siteId = activeTrip.siteId;
      const { uri: photoUri } = await validateAndPrepareWorkPhoto(endPhoto.uri);
      const thumbUri = await generateThumbnail(photoUri);
      const photoId = generateId('wp');
      const { photoUrl, thumbnailUrl } = await uploadWorkPhoto(photoId, photoUri, thumbUri);
      await addWorkPhoto({
        photoUrl,
        thumbnailUrl,
        latitude: endPhoto.lat,
        longitude: endPhoto.lon,
        siteId,
        uploadedBy: userId,
        userRole: user?.role ?? 'driver_truck',
      });
      await handleEndTrip(photoUrl, endPhoto.lat, endPhoto.lon);
    } catch (e) {
      Alert.alert(t('alert_error'), e instanceof Error ? e.message : t('common_gps_position_failed'));
    } finally {
      setLocationLoading(false);
      setEndPhoto(null);
    }
  };

  const endTripWithoutPhoto = async () => {
    setEndTripModalVisible(false);
    setEndPhoto(null);
    await handleEndTrip();
  };

  const handleStartSession = () => {
    const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
    if (!vehicle || !userId) return;
    const siteId = vehicle.siteId ?? mySiteIds[0];
    if (!siteId) return;
    addMachineSession({
      id: generateId('ms'),
      vehicleId: selectedVehicleId,
      driverId: userId,
      siteId,
      startTime: new Date().toISOString(),
      status: 'in_progress',
      createdAt: new Date().toISOString(),
    });
    setStartModalVisible(false);
  };

  const handleEndSession = () => {
    if (!activeSession) return;
    const endTime = new Date().toISOString();
    updateMachineSession(activeSession.id, {
      endTime,
      status: 'completed',
    });
    setEndSessionModalVisible(false);
  };

  const totalTrips = myTrips.filter((t) => t.status === 'completed').length;
  const totalDistance = myTrips
    .filter((t) => t.status === 'completed')
    .reduce((s, t) => s + (t.distanceKm ?? 0), 0);
  const totalTripFuel = myTrips
    .filter((t) => t.status === 'completed')
    .reduce((s, t) => s + (t.fuelConsumed ?? 0), 0);

  const totalSessions = mySessions.filter((m) => m.status === 'completed').length;
  const totalHours = mySessions
    .filter((m) => m.status === 'completed')
    .reduce((s, m) => s + (m.durationHours ?? 0), 0);
  const totalSessionFuel = mySessions
    .filter((m) => m.status === 'completed')
    .reduce((s, m) => s + (m.fuelConsumed ?? 0), 0);

  const myAssignedTrips = !isSupervisorView && userId
    ? assignedTrips.filter((a) => a.driverId === userId && a.vehicleType === 'truck')
    : [];
  const myAssignedTasks = !isSupervisorView && userId
    ? assignedTrips.filter((a) => a.driverId === userId && a.vehicleType === 'machine')
    : [];

  const activeVehicleId = activeTrip?.vehicleId ?? activeSession?.vehicleId;
  const activeVehicle = activeVehicleId ? vehicles.find((v) => v.id === activeVehicleId) : null;
  const inProgressTripsForSupervisor = isSupervisorView
    ? trips.filter((t) => t.status === 'in_progress' && driverList.some((d) => d.id === t.driverId))
    : [];

  const handleMidShiftRefuel = () => {
    const l = parseFloat(refuelLitres);
    if (!activeVehicleId || isNaN(l) || l <= 0) return;
    const vehicle = vehicles.find((v) => v.id === activeVehicleId);
    if (!vehicle) return;
    const siteId = vehicle.siteId ?? mySiteIds[0];
    if (!siteId) return;
    const cpl = parseFloat(refuelCostPerLitre);
    if (!isNaN(cpl) && cpl > 0) {
      const totalCost = Math.round(l * cpl);
      addExpense({
        id: generateId('e'),
        siteId,
        amountRwf: totalCost,
        description: `Mid-shift refuel ${vehicle.vehicleNumberOrId}`,
        date: new Date().toISOString().slice(0, 10),
        type: 'fuel',
        vehicleId: activeVehicleId,
        litres: l,
        costPerLitre: cpl,
        fuelCost: totalCost,
        createdAt: new Date().toISOString(),
      });
    }
    setRefuelModalVisible(false);
    setRefuelLitres('');
    setRefuelCostPerLitre('');
  };

  const targetDriverName = users.find((u) => u.id === targetUserId)?.name ?? t('driver_common_driver');

  return (
    <View className="flex-1 bg-gray-50">
      <Header
        title={isSupervisorView ? t('driver_trips_summary') : (isTruck ? t('driver_my_trips') : t('driver_my_sessions'))}
        subtitle={isSupervisorView ? (selectedDriverId ? targetDriverName : t('driver_select_driver')) : (user?.name ? `${t('driver_welcome')}, ${user.name}` : '')}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding, paddingBottom: theme.spacingXl }}>
        {loading && myTrips.length === 0 ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color="#2563eb" />
            <Text className="text-gray-600 mt-3">{t('driver_loading_trips')}</Text>
          </View>
        ) : (
          <>
            {loading && (
              <View className="py-2 items-center">
                <ActivityIndicator size="small" color="#2563eb" />
              </View>
            )}
        {isSupervisorView && (
          <>
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">{t('driver_live_tracking')}</Text>
              {inProgressTripsForSupervisor.length === 0 ? (
                <Card className="py-3"><Text className="text-sm text-gray-500">{t('driver_no_trips_in_progress')}</Text></Card>
              ) : (
                inProgressTripsForSupervisor.map((trip) => (
                  <Card key={trip.id} className="mb-2 border-l-4 border-l-green-500">
                    <View className="flex-row items-center mb-1">
                      <MapPin size={16} color="#059669" />
                      <Text className="font-semibold text-gray-900 ml-2">{users.find((u) => u.id === trip.driverId)?.name ?? t('driver_common_driver')}</Text>
                    </View>
                    <Text className="text-sm text-gray-600">{getVehicleLabel(trip.vehicleId)} · {getSiteName(trip.siteId)}</Text>
                    {(trip.currentLat != null && trip.currentLon != null) ? (
                      <Text className="text-xs text-gray-500 mt-1">{t('driver_position')}: {trip.currentLat.toFixed(5)}, {trip.currentLon.toFixed(5)}{trip.locationUpdatedAt ? ` · ${t('driver_updated')} ${new Date(trip.locationUpdatedAt).toLocaleTimeString()}` : ''}</Text>
                    ) : (
                      <Text className="text-xs text-amber-600 mt-1">{t('driver_waiting_position')}</Text>
                    )}
                  </Card>
                ))
              )}
            </View>
            {driverList.filter((d) => !trips.some((t) => t.driverId === d.id && t.status === 'in_progress')).some((d) => d.lastLat != null && d.lastLon != null) ? (
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">{t('driver_last_seen_at')}</Text>
                {driverList
                  .filter((d) => !trips.some((t) => t.driverId === d.id && t.status === 'in_progress') && d.lastLat != null && d.lastLon != null)
                  .map((d) => (
                    <Card key={d.id} className="mb-2 border-l-4 border-l-blue-400">
                      <View className="flex-row items-center mb-1">
                        <MapPin size={16} color="#2563eb" />
                        <Text className="font-semibold text-gray-900 ml-2">{d.name}</Text>
                      </View>
                      <Text className="text-xs text-gray-500">{t('driver_position')}: {d.lastLat!.toFixed(5)}, {d.lastLon!.toFixed(5)}{d.locationUpdatedAt ? ` · ${t('driver_updated')} ${new Date(d.locationUpdatedAt).toLocaleString()}` : ''}</Text>
                    </Card>
                  ))}
              </View>
            ) : null}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">{t('driver_view_driver')}</Text>
              <View className="flex-row flex-wrap gap-2">
                {driverList.map((d) => (
                  <Pressable
                    key={d.id}
                    onPress={() => setSelectedDriverId(d.id)}
                    className={`px-3 py-2 rounded-lg ${selectedDriverId === d.id ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <Text className={selectedDriverId === d.id ? 'text-white font-medium' : 'text-gray-700'}>{d.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        )}

        {!isSupervisorView && (myAssignedTrips.length > 0 || myAssignedTasks.length > 0) && (
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">
              {isTruck ? t('assigned_trips_my_trips') : t('assigned_tasks_my_tasks')}
            </Text>
            {(isTruck ? myAssignedTrips : myAssignedTasks).map((a) => {
              const nextStatus = getNextDriverStatus(a.status);
              const vehicleLabel = getVehicleLabel(a.vehicleId);
              const siteName = getSiteName(a.siteId);
              const canStart = a.status === 'TRIP_ASSIGNED' || a.status === 'TRIP_PENDING' || a.status === 'TASK_ASSIGNED' || a.status === 'TASK_PENDING';
              const canPause = a.status === 'TRIP_STARTED' || a.status === 'TRIP_IN_PROGRESS' || a.status === 'TRIP_RESUMED' || a.status === 'TASK_STARTED' || a.status === 'TASK_IN_PROGRESS' || a.status === 'TASK_RESUMED';
              const canResume = a.status === 'TRIP_PAUSED' || a.status === 'TASK_PAUSED';
              const canComplete = a.status === 'TRIP_IN_PROGRESS' || a.status === 'TASK_IN_PROGRESS';
              const isNeedApproval = a.status === 'TRIP_NEED_APPROVAL' || a.status === 'TASK_NEED_APPROVAL';
              return (
                <Card key={a.id} className="mb-2 border-l-4 border-l-blue-400">
                  <View className="flex-row justify-between items-start mb-2">
                    <View>
                      <Text className="font-semibold text-gray-900">{vehicleLabel}</Text>
                      <Text className="text-sm text-gray-600">{siteName} {a.taskType ? `· ${a.taskType}` : ''}</Text>
                      <View className="mt-1 px-2 py-0.5 rounded self-start" style={{ backgroundColor: ASSIGNED_TRIP_STATUS_COLORS[a.status] + '20' }}>
                        <Text className="text-xs font-semibold" style={{ color: ASSIGNED_TRIP_STATUS_COLORS[a.status] }}>{ASSIGNED_TRIP_STATUS_LABELS[a.status]}</Text>
                      </View>
                    </View>
                  </View>
                  {!isNeedApproval && (canStart || canPause || canResume || canComplete) && nextStatus && (
                    <View className="flex-row flex-wrap gap-2">
                      {canStart && (
                        <TouchableOpacity
                          onPress={async () => {
                            try {
                              await updateAssignedTripStatus(a.id, nextStatus);
                              if (isTruck) {
                                const v = vehicles.find((ve) => ve.id === a.vehicleId);
                                const siteId = v?.siteId ?? sites[0]?.id;
                                if (siteId && userId) addTrip({ id: generateId('t'), vehicleId: a.vehicleId, driverId: userId, siteId, startTime: new Date().toISOString(), distanceKm: 0, status: 'in_progress', createdAt: new Date().toISOString() });
                              } else {
                                const v = vehicles.find((ve) => ve.id === a.vehicleId);
                                const siteId = v?.siteId ?? sites[0]?.id;
                                if (siteId && userId) addMachineSession({ id: generateId('ms'), vehicleId: a.vehicleId, driverId: userId, siteId, startTime: new Date().toISOString(), status: 'in_progress', createdAt: new Date().toISOString() });
                              }
                            } catch (e) {
                              Alert.alert(t('alert_error'), (e as Error).message);
                            }
                          }}
                          className="bg-green-600 rounded-lg py-2 px-3 flex-row items-center"
                        >
                          <Play size={16} color="#fff" />
                          <Text className="text-white font-semibold ml-2 text-sm">{t('driver_start_trip')}</Text>
                        </TouchableOpacity>
                      )}
                      {canPause && (
                        <TouchableOpacity
                          onPress={async () => { try { await updateAssignedTripStatus(a.id, nextStatus!); } catch (e) { Alert.alert(t('alert_error'), (e as Error).message); } }}
                          className="bg-amber-500 rounded-lg py-2 px-3 flex-row items-center"
                        >
                          <Pause size={16} color="#fff" />
                          <Text className="text-white font-semibold ml-2 text-sm">{t('assigned_trip_pause')}</Text>
                        </TouchableOpacity>
                      )}
                      {canResume && (
                        <TouchableOpacity
                          onPress={async () => { try { await updateAssignedTripStatus(a.id, nextStatus!); } catch (e) { Alert.alert(t('alert_error'), (e as Error).message); } }}
                          className="bg-green-600 rounded-lg py-2 px-3 flex-row items-center"
                        >
                          <PlayCircle size={16} color="#fff" />
                          <Text className="text-white font-semibold ml-2 text-sm">{t('assigned_trip_resume')}</Text>
                        </TouchableOpacity>
                      )}
                      {canComplete && (
                        <TouchableOpacity
                          onPress={async () => { try { await updateAssignedTripStatus(a.id, nextStatus!); } catch (e) { Alert.alert(t('alert_error'), (e as Error).message); } }}
                          className="bg-blue-600 rounded-lg py-2 px-3 flex-row items-center"
                        >
                          <CheckCircle size={16} color="#fff" />
                          <Text className="text-white font-semibold ml-2 text-sm">{t('assigned_trip_complete')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  {isNeedApproval && (
                    <Text className="text-sm text-amber-700">{t('assigned_trip_wait_approval')}</Text>
                  )}
                </Card>
              );
            })}
          </View>
        )}

        {isTruck ? (
          <>
            {!isSupervisorView && !activeTrip ? (
              <TouchableOpacity
                onPress={() => {
                  setSelectedVehicleId(myVehicles[0]?.id ?? '');
                  setStartPhoto(null);
                  setStartModalVisible(true);
                }}
                className="bg-blue-600 rounded-lg py-3 flex-row items-center justify-center mb-4"
              >
                <Play size={22} color="#fff" />
                <Text className="text-white font-semibold ml-2">{t('driver_start_trip')}</Text>
              </TouchableOpacity>
            ) : !isSupervisorView && activeTrip ? (
              <Card className="mb-4 border-l-4 border-l-amber-500">
                <Text className="font-semibold text-gray-900">{t('driver_trip_in_progress')}</Text>
                <Text className="text-sm text-gray-600">{getVehicleLabel(activeTrip.vehicleId)}</Text>
                <View className="flex-row gap-2 mt-3">
                  <TouchableOpacity
                    onPress={() => { setRefuelLitres(''); setRefuelCostPerLitre(''); setRefuelModalVisible(true); }}
                    className="flex-1 bg-gray-600 rounded-lg py-2 flex-row items-center justify-center"
                  >
                    <Fuel size={18} color="#fff" />
                    <Text className="text-white font-semibold ml-2">{t('driver_mid_shift_refuel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={openEndTripModal}
                    className="flex-1 bg-amber-500 rounded-lg py-2 flex-row items-center justify-center"
                  >
                    <Square size={18} color="#fff" />
                    <Text className="text-white font-semibold ml-2">{t('trip_end_modal_title')}</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ) : null}
            <View className="flex-row gap-3 mb-4">
              <Card className="flex-1">
                <Text className="text-2xl font-bold text-gray-900">{totalTrips}</Text>
                <Text className="text-xs text-gray-600">{t('driver_trips_count')}</Text>
              </Card>
              <Card className="flex-1">
                <Text className="text-2xl font-bold text-gray-900">{totalDistance}</Text>
                <Text className="text-xs text-gray-600">{t('driver_km')}</Text>
              </Card>
              <Card className="flex-1">
                <Text className="text-2xl font-bold text-gray-900">{totalTripFuel.toFixed(1)}</Text>
                <Text className="text-xs text-gray-600">{t('driver_l_fuel')}</Text>
              </Card>
            </View>
            <Card className="mb-3 bg-gray-50">
              <Text className="text-sm font-semibold text-gray-700 mb-2">{t('driver_trips_by_location')}</Text>
              {Object.entries(byLocationTrips).length === 0 ? (
                <Text className="text-xs text-gray-500">{t('general_none')}</Text>
              ) : (
                Object.entries(byLocationTrips).map(([sid, data]) => (
                  <View key={sid} className="flex-row justify-between py-1">
                    <Text className="text-sm text-gray-700">{getSiteName(sid)}</Text>
                    <Text className="text-sm font-medium">{data.count} {t('driver_trips_count').toLowerCase()} · {data.distance} {t('driver_km')}</Text>
                  </View>
                ))
              )}
            </Card>
            <Card className="mb-3 bg-gray-50">
              <Text className="text-sm font-semibold text-gray-700 mb-2">{t('driver_trips_by_vehicle')}</Text>
              {Object.entries(byVehicleTrips).length === 0 ? (
                <Text className="text-xs text-gray-500">{t('general_none')}</Text>
              ) : (
                Object.entries(byVehicleTrips).map(([vid, data]) => (
                  <View key={vid} className="flex-row justify-between py-1">
                    <Text className="text-sm text-gray-700">{getVehicleLabel(vid)}</Text>
                    <Text className="text-sm font-medium">{data.count} · {data.distance} {t('driver_km')}</Text>
                  </View>
                ))
              )}
            </Card>
            <Card className="mb-3 bg-gray-50">
              <Text className="text-sm font-semibold text-gray-700 mb-2">{t('driver_daily_monthly_yearly')}</Text>
              <View className="flex-row justify-between py-1"><Text className="text-sm text-gray-600">{t('driver_today')}</Text><Text className="text-sm font-medium">{dailyTrips.length} {t('driver_trips_count').toLowerCase()} · {dailyTrips.reduce((s, trip) => s + trip.distanceKm, 0)} {t('driver_km')}</Text></View>
              <View className="flex-row justify-between py-1"><Text className="text-sm text-gray-600">{t('driver_this_month')}</Text><Text className="text-sm font-medium">{monthlyTrips.length} {t('driver_trips_count').toLowerCase()} · {monthlyTrips.reduce((s, trip) => s + trip.distanceKm, 0)} {t('driver_km')}</Text></View>
              <View className="flex-row justify-between py-1"><Text className="text-sm text-gray-600">{t('driver_all_time')}</Text><Text className="text-sm font-medium">{yearlyTrips.length} {t('driver_trips_count').toLowerCase()} · {yearlyTrips.reduce((s, trip) => s + trip.distanceKm, 0)} {t('driver_km')}</Text></View>
            </Card>
            <Text className="text-lg font-bold text-gray-900 mb-2">{t('driver_trip_history')}</Text>
            {myTrips.length === 0 && <Text className="text-gray-500 py-2">{t('driver_no_trips_yet')}</Text>}
            {myTrips.map((trip) => {
              const start = new Date(trip.startTime).getTime();
              const end = trip.endTime ? new Date(trip.endTime).getTime() : start;
              const durationHours = (end - start) / (1000 * 60 * 60);
              const kmPerHour = trip.status === 'completed' && durationHours > 0 ? trip.distanceKm / durationHours : 0;
              return (
                <Card key={trip.id} className="mb-2">
                  <View className="flex-row justify-between">
                    <View>
                      <Text className="font-medium text-gray-900">{getVehicleLabel(trip.vehicleId)}</Text>
                      <Text className="text-xs text-gray-500">{trip.startTime.slice(0, 16)} · {trip.status}</Text>
                      {trip.status === 'completed' && durationHours > 0 && (
                        <Text className="text-xs text-gray-500 mt-1">{t('driver_duration')}: {durationHours.toFixed(1)} h · {kmPerHour.toFixed(0)} km/h</Text>
                      )}
                    </View>
                    <Text className="font-semibold">{trip.distanceKm} km · {(trip.fuelConsumed ?? 0).toFixed(1)} L</Text>
                  </View>
                  {trip.photoUri ? <Text className="text-xs text-green-600 mt-1">{t('driver_photo_attached')}</Text> : null}
                </Card>
              );
            })}
          </>
        ) : (
          <>
            {!isSupervisorView && !activeSession ? (
              <TouchableOpacity
                onPress={() => {
                  setSelectedVehicleId(myVehicles[0]?.id ?? '');
                  setStartModalVisible(true);
                }}
                className="bg-blue-600 rounded-lg py-3 flex-row items-center justify-center mb-4"
              >
                <Play size={22} color="#fff" />
                <Text className="text-white font-semibold ml-2">{t('driver_start_work')}</Text>
              </TouchableOpacity>
            ) : !isSupervisorView && activeSession ? (
              <Card className="mb-4 border-l-4 border-l-amber-500">
                <Text className="font-semibold text-gray-900">{t('driver_session_in_progress')}</Text>
                <Text className="text-sm text-gray-600">{getVehicleLabel(activeSession.vehicleId)}</Text>
                <View className="flex-row gap-2 mt-3">
                  <TouchableOpacity
                    onPress={() => { setRefuelLitres(''); setRefuelCostPerLitre(''); setRefuelModalVisible(true); }}
                    className="flex-1 bg-gray-600 rounded-lg py-2 flex-row items-center justify-center"
                  >
                    <Fuel size={18} color="#fff" />
                    <Text className="text-white font-semibold ml-2">{t('driver_mid_shift_refuel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setEndSessionModalVisible(true)}
                    className="flex-1 bg-amber-500 rounded-lg py-2 flex-row items-center justify-center"
                  >
                    <Square size={18} color="#fff" />
                    <Text className="text-white font-semibold ml-2">{t('driver_end_work')}</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ) : null}
            <View className="flex-row gap-3 mb-4">
              <Card className="flex-1">
                <Text className="text-2xl font-bold text-gray-900">{totalSessions}</Text>
                <Text className="text-xs text-gray-600">{t('driver_sessions_count')}</Text>
              </Card>
              <Card className="flex-1">
                <Text className="text-2xl font-bold text-gray-900">{totalHours.toFixed(1)}</Text>
                <Text className="text-xs text-gray-600">{t('driver_hours')}</Text>
              </Card>
              <Card className="flex-1">
                <Text className="text-2xl font-bold text-gray-900">{totalSessionFuel.toFixed(1)}</Text>
                <Text className="text-xs text-gray-600">{t('driver_l_fuel')}</Text>
              </Card>
            </View>
            <Card className="mb-3 bg-gray-50">
              <Text className="text-sm font-semibold text-gray-700 mb-2">{t('driver_sessions_by_location')}</Text>
              {Object.entries(byLocationSessions).length === 0 ? (
                <Text className="text-xs text-gray-500">{t('general_none')}</Text>
              ) : (
                Object.entries(byLocationSessions).map(([sid, data]) => (
                  <View key={sid} className="flex-row justify-between py-1">
                    <Text className="text-sm text-gray-700">{getSiteName(sid)}</Text>
                    <Text className="text-sm font-medium">{data.count} · {data.hours.toFixed(1)} h</Text>
                  </View>
                ))
              )}
            </Card>
            <Card className="mb-3 bg-gray-50">
              <Text className="text-sm font-semibold text-gray-700 mb-2">{t('driver_sessions_by_vehicle')}</Text>
              {Object.entries(byVehicleSessions).length === 0 ? (
                <Text className="text-xs text-gray-500">{t('general_none')}</Text>
              ) : (
                Object.entries(byVehicleSessions).map(([vid, data]) => (
                  <View key={vid} className="flex-row justify-between py-1">
                    <Text className="text-sm text-gray-700">{getVehicleLabel(vid)}</Text>
                    <Text className="text-sm font-medium">{data.count} · {data.hours.toFixed(1)} h</Text>
                  </View>
                ))
              )}
            </Card>
            <Card className="mb-3 bg-gray-50">
              <Text className="text-sm font-semibold text-gray-700 mb-2">{t('driver_daily_monthly_yearly')}</Text>
              <View className="flex-row justify-between py-1"><Text className="text-sm text-gray-600">{t('driver_today')}</Text><Text className="text-sm font-medium">{dailySessions.length} · {dailySessions.reduce((s, m) => s + (m.durationHours ?? 0), 0).toFixed(1)} h</Text></View>
              <View className="flex-row justify-between py-1"><Text className="text-sm text-gray-600">{t('driver_this_month')}</Text><Text className="text-sm font-medium">{monthlySessions.length} · {monthlySessions.reduce((s, m) => s + (m.durationHours ?? 0), 0).toFixed(1)} h</Text></View>
              <View className="flex-row justify-between py-1"><Text className="text-sm text-gray-600">{t('driver_all_time')}</Text><Text className="text-sm font-medium">{completedSessions.length} · {totalHours.toFixed(1)} h</Text></View>
            </Card>
            <Text className="text-lg font-bold text-gray-900 mb-2">{t('driver_session_history')}</Text>
            {mySessions.length === 0 && <Text className="text-gray-500 py-2">{t('driver_no_sessions_yet')}</Text>}
            {mySessions.map((m) => (
              <Card key={m.id} className="mb-2">
                <View className="flex-row justify-between">
                  <View>
                    <Text className="font-medium text-gray-900">{getVehicleLabel(m.vehicleId)}</Text>
                    <Text className="text-xs text-gray-500">{m.startTime.slice(0, 16)} · {m.status}</Text>
                  </View>
                  <Text className="font-semibold">{(m.durationHours ?? 0).toFixed(1)} h · {(m.fuelConsumed ?? 0).toFixed(1)} L</Text>
                </View>
              </Card>
            ))}
          </>
        )}
          </>
        )}
      </ScrollView>

      <Modal visible={locationPermissionModalVisible} transparent animationType="fade">
        <View className="flex-1 justify-center bg-black/50 px-4">
          <View className="bg-white rounded-2xl p-6">
            <View className="items-center mb-4">
              <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center mb-3">
                <MapPin size={24} color="#2563eb" />
              </View>
              <Text className="text-lg font-bold text-gray-900 text-center">{t('location_permission_title')}</Text>
            </View>
            <Text className="text-sm text-gray-600 text-center mb-6">{t('location_permission_message')}</Text>
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setLocationPermissionModalVisible(false)} className="flex-1 py-3 rounded-lg bg-gray-200 items-center">
                <Text className="font-semibold text-gray-700">{t('location_permission_not_now')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={requestLocationAndClosePermissionModal} className="flex-1 py-3 rounded-lg bg-blue-600 items-center">
                <Text className="font-semibold text-white">{t('location_permission_allow')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={endTripModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-center bg-black/50 px-4">
          <View className="bg-white rounded-2xl p-6">
            <View className="items-center mb-3">
              <View className="w-12 h-12 rounded-full bg-amber-100 items-center justify-center mb-2">
                <Camera size={24} color="#d97706" />
              </View>
              <Text className="text-lg font-bold text-gray-900 text-center">{t('trip_end_modal_title')}</Text>
            </View>
            <Text className="text-sm text-gray-600 text-center mb-4">{t('trip_end_modal_message')}</Text>
            {!endPhoto ? (
              <View className="gap-3">
                <TouchableOpacity
                  onPress={takeEndPhoto}
                  disabled={takingEndPhoto}
                  className="py-3 rounded-lg bg-amber-500 items-center flex-row justify-center"
                >
                  {takingEndPhoto ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Camera size={18} color="#fff" style={{ marginRight: 8 }} />
                      <Text className="font-semibold text-white">{t('trip_end_add_photo')}</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={endTripWithoutPhoto} className="py-3 rounded-lg bg-gray-200 items-center">
                  <Text className="font-semibold text-gray-700">{t('trip_end_without_photo')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setEndTripModalVisible(false); setEndPhoto(null); }} className="py-2 items-center">
                  <Text className="text-sm text-gray-500">{t('common_cancel')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="gap-3">
                <Image source={{ uri: endPhoto.uri }} style={{ width: '100%', height: 140, borderRadius: 12, backgroundColor: '#f3f4f6' }} resizeMode="cover" />
                <Text className="text-xs text-gray-500">GPS: {endPhoto.lat.toFixed(5)}, {endPhoto.lon.toFixed(5)}</Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity onPress={() => setEndPhoto(null)} className="flex-1 py-2 rounded-lg bg-gray-200 items-center">
                    <Text className="font-semibold text-gray-700">{t('trip_end_retake')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={endTripWithGpsPhoto} className="flex-1 py-2 rounded-lg bg-amber-500 items-center">
                    <Text className="font-semibold text-white">{t('trip_end_use_photo')}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => { setEndTripModalVisible(false); setEndPhoto(null); }} className="py-2 items-center">
                  <Text className="text-sm text-gray-500">{t('common_cancel')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={startModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-lg font-bold mb-4">
              {isTruck ? t('driver_start_trip') : t('driver_start_work')}
            </Text>
            {isTruck && (
              <Text className="text-sm text-blue-600 mb-2">{t('trip_start_location_note')}</Text>
            )}
            <Text className="text-sm text-gray-600 mb-1">{t('driver_vehicle_label')}</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {myVehicles.map((v) => (
                <Pressable
                  key={v.id}
                  onPress={() => setSelectedVehicleId(v.id)}
                  className={`px-3 py-2 rounded-lg ${selectedVehicleId === v.id ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <Text className={selectedVehicleId === v.id ? 'text-white font-medium' : 'text-gray-700'}>{v.vehicleNumberOrId}</Text>
                </Pressable>
              ))}
            </View>
            {isTruck && !startPhoto && (
              <>
                <TouchableOpacity
                  onPress={takeStartPhoto}
                  disabled={takingStartPhoto}
                  className="mb-4 py-3 rounded-lg bg-amber-500 flex-row items-center justify-center"
                >
                  {takingStartPhoto ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Camera size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text className="font-semibold text-white">{t('trip_start_take_gps_photo')}</Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text className="text-xs text-gray-500 mb-2">{t('trip_start_photo_hint')}</Text>
              </>
            )}
            {isTruck && startPhoto && (
              <View className="mb-4">
                <Image source={{ uri: startPhoto.uri }} style={{ width: '100%', height: 160, borderRadius: 12, backgroundColor: '#f3f4f6' }} resizeMode="cover" />
                <Text className="text-xs text-gray-500 mt-2">GPS: {startPhoto.lat.toFixed(5)}, {startPhoto.lon.toFixed(5)}</Text>
                <View className="flex-row gap-2 mt-2">
                  <TouchableOpacity onPress={() => setStartPhoto(null)} className="flex-1 py-2 rounded-lg bg-gray-200 items-center">
                    <Text className="font-semibold text-gray-700">{t('trip_retake_photo')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {isTruck && (
              <>
                <Text className="text-sm text-gray-600 mb-1">{t('driver_load_optional')}</Text>
                <TextInput
                  value={loadQuantity}
                  onChangeText={setLoadQuantity}
                  placeholder={t('driver_load_placeholder')}
                  className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
                />
                <Text className="text-sm text-gray-600 mb-1">{t('driver_fuel_start_optional')}</Text>
                <TextInput
                  value={fuelFilledAtStart}
                  onChangeText={setFuelFilledAtStart}
                  onFocus={() => { if (fuelFilledAtStart === '0') setFuelFilledAtStart(''); }}
                  placeholder={t('driver_fuel_start_placeholder')}
                  keyboardType="decimal-pad"
                  className="border border-gray-300 rounded-lg px-3 py-2 mb-4 bg-white"
                />
              </>
            )}
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => { setStartModalVisible(false); setStartPhoto(null); }} className="flex-1 py-3 rounded-lg bg-gray-200 items-center">
                <Text className="font-semibold text-gray-700">{t('general_cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={isTruck ? handleStartTrip : handleStartSession}
                disabled={isTruck && !startPhoto}
                className={`flex-1 py-3 rounded-lg items-center ${isTruck && !startPhoto ? 'bg-gray-400' : 'bg-blue-600'}`}
              >
                <Text className="font-semibold text-white">{t('general_start')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={endSessionModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-center bg-black/50 px-4">
          <View className="bg-white rounded-2xl p-6">
            <Text className="text-lg font-bold mb-4">{t('driver_end_work')}</Text>
            <Text className="text-sm text-gray-600 mb-4">
              {t('driver_end_work_hint')}
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setEndSessionModalVisible(false)} className="flex-1 py-3 rounded-lg bg-gray-200 items-center">
                <Text className="font-semibold text-gray-700">{t('general_cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleEndSession} className="flex-1 py-3 rounded-lg bg-blue-600 items-center">
                <Text className="font-semibold text-white">{t('general_end')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={refuelModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-lg font-bold mb-4">{t('driver_mid_shift_refuel_title')}</Text>
            {activeVehicle && (
              <Text className="text-sm text-gray-600 mb-3">{t('driver_vehicle_prefix')} {activeVehicle.vehicleNumberOrId}</Text>
            )}
            <Text className="text-sm text-gray-600 mb-1">{t('driver_litres')}</Text>
            <TextInput
              value={refuelLitres}
              onChangeText={setRefuelLitres}
              onFocus={() => { if (refuelLitres === '0') setRefuelLitres(''); }}
              placeholder={t('driver_refuel_litres_placeholder')}
              keyboardType="decimal-pad"
              className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
            />
            <Text className="text-sm text-slate-600 mb-1">{t('driver_cost_per_litre_optional')}</Text>
            <TextInput
              value={refuelCostPerLitre}
              onChangeText={setRefuelCostPerLitre}
              onFocus={() => { if (refuelCostPerLitre === '0') setRefuelCostPerLitre(''); }}
              placeholder={t('driver_refuel_cost_placeholder')}
              keyboardType="decimal-pad"
              className="border border-gray-300 rounded-lg px-3 py-2 mb-4 bg-white"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setRefuelModalVisible(false)} className="flex-1 py-3 rounded-lg bg-gray-200 items-center">
                <Text className="font-semibold text-gray-700">{t('general_cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleMidShiftRefuel} className="flex-1 py-3 rounded-lg bg-blue-600 items-center">
                <Text className="font-semibold text-white">{t('driver_add_fuel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
