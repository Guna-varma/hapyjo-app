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
} from 'react-native';
import * as Location from 'expo-location';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { generateId } from '@/lib/id';
import { Truck, Cog, Play, Square, Fuel, MapPin, Camera } from 'lucide-react-native';
import * as Linking from 'expo-linking';

const LIVE_LOCATION_INTERVAL_MS = 20000;

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
    siteAssignments,
    addTrip,
    updateTrip,
    addMachineSession,
    updateMachineSession,
    updateVehicle,
    addExpense,
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
    (v) => mySiteIds.includes(v.siteId) && (isTruck ? v.type === 'truck' : v.type === 'machine')
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
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationPermissionModalVisible, setLocationPermissionModalVisible] = useState(false);
  const [endTripModalVisible, setEndTripModalVisible] = useState(false);
  const liveLocationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchSubscriptionRef = useRef<{ remove: () => void } | null>(null);

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

  const getSiteName = (id: string) => sites.find((s) => s.id === id)?.name ?? id;
  const getVehicleLabel = (id: string) => vehicles.find((v) => v.id === id)?.vehicleNumberOrId ?? id;

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
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: LIVE_LOCATION_INTERVAL_MS,
          distanceInterval: 50,
        },
        (loc) => {
          if (mounted) pushPosition(loc.coords.latitude, loc.coords.longitude);
        }
      );
      watchSubscriptionRef.current = sub;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      pushPosition(pos.coords.latitude, pos.coords.longitude);
    })();
    return () => {
      mounted = false;
      watchSubscriptionRef.current?.remove();
      watchSubscriptionRef.current = null;
    };
  }, [activeTrip?.id, isSupervisorView, updateTrip]);

  const handleStartTrip = async () => {
    const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
    if (!vehicle || !userId) return;
    const siteId = vehicle.siteId;
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationPermissionModalVisible(true);
        Alert.alert(t('alert_error'), t('location_required_trip_start'));
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const startLat = position.coords.latitude;
      const startLon = position.coords.longitude;
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
    } catch (e) {
      Alert.alert(t('alert_gps_error'), e instanceof Error ? e.message : 'Could not get current position.');
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
      } catch (_) {
        // openSettings not available on this platform
      }
    }
  };

  const handleEndTrip = async (photoUri?: string) => {
    if (!activeTrip) return;
    const vehicle = vehicles.find((v) => v.id === activeTrip.vehicleId);
    if (!vehicle) return;
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationPermissionModalVisible(true);
        Alert.alert(t('alert_error'), t('location_required_trip_end'));
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const endLat = position.coords.latitude;
      const endLon = position.coords.longitude;
      const startLat = activeTrip.startLat ?? 0;
      const startLon = activeTrip.startLon ?? 0;
      let distanceKm = Math.round(haversineKm(startLat, startLon, endLat, endLon) * 100) / 100;
      if (distanceKm <= 0) distanceKm = 0.01;
      const endTime = new Date().toISOString();
      const start = new Date(activeTrip.startTime).getTime();
      const end = new Date(endTime).getTime();
      const durationHours = (end - start) / (1000 * 60 * 60);
      updateTrip(activeTrip.id, {
        endTime,
        endLat,
        endLon,
        distanceKm,
        status: 'completed',
        photoUri,
        currentLat: undefined,
        currentLon: undefined,
        locationUpdatedAt: undefined,
      });
    } catch (e) {
      Alert.alert(t('alert_gps_error'), e instanceof Error ? e.message : 'Could not get current position.');
    } finally {
      setLocationLoading(false);
    }
  };

  const openEndTripModal = () => setEndTripModalVisible(true);

  const endTripWithPhoto = async () => {
    setEndTripModalVisible(false);
    try {
      const { launchImageLibraryAsync } = await import('expo-image-picker');
      const result = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true });
      if (!result.canceled && result.assets[0]?.uri) {
        await handleEndTrip(result.assets[0].uri);
      } else {
        await handleEndTrip();
      }
    } catch {
      await handleEndTrip();
    }
  };

  const endTripWithoutPhoto = async () => {
    setEndTripModalVisible(false);
    await handleEndTrip();
  };

  const handleStartSession = () => {
    const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
    if (!vehicle || !userId) return;
    addMachineSession({
      id: generateId('ms'),
      vehicleId: selectedVehicleId,
      driverId: userId,
      siteId: vehicle.siteId,
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
    const cpl = parseFloat(refuelCostPerLitre);
    if (!isNaN(cpl) && cpl > 0) {
      const totalCost = Math.round(l * cpl);
      addExpense({
        id: generateId('e'),
        siteId: vehicle.siteId,
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

  const targetDriverName = users.find((u) => u.id === targetUserId)?.name ?? 'Driver';

  return (
    <View className="flex-1 bg-gray-50">
      <Header
        title={isSupervisorView ? 'Driver trip summary' : (isTruck ? 'My trips' : 'My machine sessions')}
        subtitle={isSupervisorView ? (selectedDriverId ? targetDriverName : 'Select a driver') : (user?.name ? `Welcome, ${user.name}` : '')}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding }}>
        {loading ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color="#2563eb" />
            <Text className="text-gray-600 mt-3">Loading trips...</Text>
          </View>
        ) : (
          <>
        {isSupervisorView && (
          <>
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">Live driver tracking</Text>
              {inProgressTripsForSupervisor.length === 0 ? (
                <Card className="py-3"><Text className="text-sm text-gray-500">No trips in progress. Positions update every 20s when a driver starts a trip.</Text></Card>
              ) : (
                inProgressTripsForSupervisor.map((t) => (
                  <Card key={t.id} className="mb-2 border-l-4 border-l-green-500">
                    <View className="flex-row items-center mb-1">
                      <MapPin size={16} color="#059669" />
                      <Text className="font-semibold text-gray-900 ml-2">{users.find((u) => u.id === t.driverId)?.name ?? 'Driver'}</Text>
                    </View>
                    <Text className="text-sm text-gray-600">{getVehicleLabel(t.vehicleId)} · {getSiteName(t.siteId)}</Text>
                    {(t.currentLat != null && t.currentLon != null) ? (
                      <Text className="text-xs text-gray-500 mt-1">Position: {t.currentLat.toFixed(5)}, {t.currentLon.toFixed(5)}{t.locationUpdatedAt ? ` · Updated ${new Date(t.locationUpdatedAt).toLocaleTimeString()}` : ''}</Text>
                    ) : (
                      <Text className="text-xs text-amber-600 mt-1">Waiting for first position…</Text>
                    )}
                  </Card>
                ))
              )}
            </View>
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">View driver</Text>
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

        {isTruck ? (
          <>
            {!isSupervisorView && !activeTrip ? (
              <TouchableOpacity
                onPress={() => {
                  setSelectedVehicleId(myVehicles[0]?.id ?? '');
                  setStartModalVisible(true);
                }}
                className="bg-blue-600 rounded-lg py-3 flex-row items-center justify-center mb-4"
              >
                <Play size={22} color="#fff" />
                <Text className="text-white font-semibold ml-2">Start trip</Text>
              </TouchableOpacity>
            ) : !isSupervisorView && activeTrip ? (
              <Card className="mb-4 border-l-4 border-l-amber-500">
                <Text className="font-semibold text-gray-900">Trip in progress</Text>
                <Text className="text-sm text-gray-600">{getVehicleLabel(activeTrip.vehicleId)}</Text>
                <View className="flex-row gap-2 mt-3">
                  <TouchableOpacity
                    onPress={() => { setRefuelLitres(''); setRefuelCostPerLitre(''); setRefuelModalVisible(true); }}
                    className="flex-1 bg-gray-600 rounded-lg py-2 flex-row items-center justify-center"
                  >
                    <Fuel size={18} color="#fff" />
                    <Text className="text-white font-semibold ml-2">Mid-shift refuel</Text>
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
                <Text className="text-xs text-gray-600">Trips</Text>
              </Card>
              <Card className="flex-1">
                <Text className="text-2xl font-bold text-gray-900">{totalDistance}</Text>
                <Text className="text-xs text-gray-600">km</Text>
              </Card>
              <Card className="flex-1">
                <Text className="text-2xl font-bold text-gray-900">{totalTripFuel.toFixed(1)}</Text>
                <Text className="text-xs text-gray-600">L fuel</Text>
              </Card>
            </View>
            <Card className="mb-3 bg-gray-50">
              <Text className="text-sm font-semibold text-gray-700 mb-2">Trips by location</Text>
              {Object.entries(byLocationTrips).length === 0 ? (
                <Text className="text-xs text-gray-500">None</Text>
              ) : (
                Object.entries(byLocationTrips).map(([sid, data]) => (
                  <View key={sid} className="flex-row justify-between py-1">
                    <Text className="text-sm text-gray-700">{getSiteName(sid)}</Text>
                    <Text className="text-sm font-medium">{data.count} trips · {data.distance} km</Text>
                  </View>
                ))
              )}
            </Card>
            <Card className="mb-3 bg-gray-50">
              <Text className="text-sm font-semibold text-gray-700 mb-2">Trips by vehicle</Text>
              {Object.entries(byVehicleTrips).length === 0 ? (
                <Text className="text-xs text-gray-500">None</Text>
              ) : (
                Object.entries(byVehicleTrips).map(([vid, data]) => (
                  <View key={vid} className="flex-row justify-between py-1">
                    <Text className="text-sm text-gray-700">{getVehicleLabel(vid)}</Text>
                    <Text className="text-sm font-medium">{data.count} · {data.distance} km</Text>
                  </View>
                ))
              )}
            </Card>
            <Card className="mb-3 bg-gray-50">
              <Text className="text-sm font-semibold text-gray-700 mb-2">Daily / Monthly / Yearly</Text>
              <View className="flex-row justify-between py-1"><Text className="text-sm text-gray-600">Today</Text><Text className="text-sm font-medium">{dailyTrips.length} trips · {dailyTrips.reduce((s, t) => s + t.distanceKm, 0)} km</Text></View>
              <View className="flex-row justify-between py-1"><Text className="text-sm text-gray-600">This month</Text><Text className="text-sm font-medium">{monthlyTrips.length} trips · {monthlyTrips.reduce((s, t) => s + t.distanceKm, 0)} km</Text></View>
              <View className="flex-row justify-between py-1"><Text className="text-sm text-gray-600">All time</Text><Text className="text-sm font-medium">{yearlyTrips.length} trips · {yearlyTrips.reduce((s, t) => s + t.distanceKm, 0)} km</Text></View>
            </Card>
            <Text className="text-lg font-bold text-gray-900 mb-2">Trip history</Text>
            {myTrips.length === 0 && <Text className="text-gray-500 py-2">No trips yet.</Text>}
            {myTrips.map((t) => {
              const start = new Date(t.startTime).getTime();
              const end = t.endTime ? new Date(t.endTime).getTime() : start;
              const durationHours = (end - start) / (1000 * 60 * 60);
              const kmPerHour = t.status === 'completed' && durationHours > 0 ? t.distanceKm / durationHours : 0;
              return (
                <Card key={t.id} className="mb-2">
                  <View className="flex-row justify-between">
                    <View>
                      <Text className="font-medium text-gray-900">{getVehicleLabel(t.vehicleId)}</Text>
                      <Text className="text-xs text-gray-500">{t.startTime.slice(0, 16)} · {t.status}</Text>
                      {t.status === 'completed' && durationHours > 0 && (
                        <Text className="text-xs text-gray-500 mt-1">Duration: {durationHours.toFixed(1)} h · {kmPerHour.toFixed(0)} km/h</Text>
                      )}
                    </View>
                    <Text className="font-semibold">{t.distanceKm} km · {(t.fuelConsumed ?? 0).toFixed(1)} L</Text>
                  </View>
                  {t.photoUri ? <Text className="text-xs text-green-600 mt-1">Photo attached</Text> : null}
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
                <Text className="text-white font-semibold ml-2">Start work</Text>
              </TouchableOpacity>
            ) : !isSupervisorView && activeSession ? (
              <Card className="mb-4 border-l-4 border-l-amber-500">
                <Text className="font-semibold text-gray-900">Session in progress</Text>
                <Text className="text-sm text-gray-600">{getVehicleLabel(activeSession.vehicleId)}</Text>
                <View className="flex-row gap-2 mt-3">
                  <TouchableOpacity
                    onPress={() => { setRefuelLitres(''); setRefuelCostPerLitre(''); setRefuelModalVisible(true); }}
                    className="flex-1 bg-gray-600 rounded-lg py-2 flex-row items-center justify-center"
                  >
                    <Fuel size={18} color="#fff" />
                    <Text className="text-white font-semibold ml-2">Mid-shift refuel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setEndSessionModalVisible(true)}
                    className="flex-1 bg-amber-500 rounded-lg py-2 flex-row items-center justify-center"
                  >
                    <Square size={18} color="#fff" />
                    <Text className="text-white font-semibold ml-2">End work</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ) : null}
            <View className="flex-row gap-3 mb-4">
              <Card className="flex-1">
                <Text className="text-2xl font-bold text-gray-900">{totalSessions}</Text>
                <Text className="text-xs text-gray-600">Sessions</Text>
              </Card>
              <Card className="flex-1">
                <Text className="text-2xl font-bold text-gray-900">{totalHours.toFixed(1)}</Text>
                <Text className="text-xs text-gray-600">hours</Text>
              </Card>
              <Card className="flex-1">
                <Text className="text-2xl font-bold text-gray-900">{totalSessionFuel.toFixed(1)}</Text>
                <Text className="text-xs text-gray-600">L fuel</Text>
              </Card>
            </View>
            <Card className="mb-3 bg-gray-50">
              <Text className="text-sm font-semibold text-gray-700 mb-2">Sessions by location</Text>
              {Object.entries(byLocationSessions).length === 0 ? (
                <Text className="text-xs text-gray-500">None</Text>
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
              <Text className="text-sm font-semibold text-gray-700 mb-2">Sessions by vehicle</Text>
              {Object.entries(byVehicleSessions).length === 0 ? (
                <Text className="text-xs text-gray-500">None</Text>
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
              <Text className="text-sm font-semibold text-gray-700 mb-2">Daily / Monthly / Yearly</Text>
              <View className="flex-row justify-between py-1"><Text className="text-sm text-gray-600">Today</Text><Text className="text-sm font-medium">{dailySessions.length} · {dailySessions.reduce((s, m) => s + (m.durationHours ?? 0), 0).toFixed(1)} h</Text></View>
              <View className="flex-row justify-between py-1"><Text className="text-sm text-gray-600">This month</Text><Text className="text-sm font-medium">{monthlySessions.length} · {monthlySessions.reduce((s, m) => s + (m.durationHours ?? 0), 0).toFixed(1)} h</Text></View>
              <View className="flex-row justify-between py-1"><Text className="text-sm text-gray-600">All time</Text><Text className="text-sm font-medium">{completedSessions.length} · {totalHours.toFixed(1)} h</Text></View>
            </Card>
            <Text className="text-lg font-bold text-gray-900 mb-2">Session history</Text>
            {mySessions.length === 0 && <Text className="text-gray-500 py-2">No sessions yet.</Text>}
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
            <Text className="text-sm text-gray-600 text-center mb-5">{t('trip_end_modal_message')}</Text>
            <View className="gap-3">
              <TouchableOpacity onPress={endTripWithPhoto} className="py-3 rounded-lg bg-amber-500 items-center flex-row justify-center">
                <Camera size={18} color="#fff" />
                <Text className="font-semibold text-white ml-2">{t('trip_end_add_photo')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={endTripWithoutPhoto} className="py-3 rounded-lg bg-gray-200 items-center">
                <Text className="font-semibold text-gray-700">{t('trip_end_without_photo')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEndTripModalVisible(false)} className="py-2 items-center">
                <Text className="text-sm text-gray-500">{t('common_cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={startModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-lg font-bold mb-4">
              {isTruck ? 'Start trip' : 'Start work'}
            </Text>
            {isTruck && (
              <Text className="text-sm text-blue-600 mb-2">{t('trip_start_location_note')}</Text>
            )}
            <Text className="text-sm text-gray-600 mb-1">Vehicle</Text>
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
            {isTruck && (
              <>
                <Text className="text-sm text-gray-600 mb-1">Load quantity (optional)</Text>
                <TextInput
                  value={loadQuantity}
                  onChangeText={setLoadQuantity}
                  placeholder="e.g. 5 tons"
                  className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
                />
                <Text className="text-sm text-gray-600 mb-1">Fuel filled at start L (optional)</Text>
                <TextInput
                  value={fuelFilledAtStart}
                  onChangeText={setFuelFilledAtStart}
                  placeholder="e.g. 100"
                  keyboardType="decimal-pad"
                  className="border border-gray-300 rounded-lg px-3 py-2 mb-4 bg-white"
                />
              </>
            )}
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setStartModalVisible(false)} className="flex-1 py-3 rounded-lg bg-gray-200 items-center">
                <Text className="font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={isTruck ? handleStartTrip : handleStartSession}
                className="flex-1 py-3 rounded-lg bg-blue-600 items-center"
              >
                <Text className="font-semibold text-white">Start</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={endSessionModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-center bg-black/50 px-4">
          <View className="bg-white rounded-2xl p-6">
            <Text className="text-lg font-bold mb-4">End work</Text>
            <Text className="text-sm text-gray-600 mb-4">
              Duration and fuel consumed will be calculated from your start time and the vehicle&apos;s hours per litre.
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setEndSessionModalVisible(false)} className="flex-1 py-3 rounded-lg bg-gray-200 items-center">
                <Text className="font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleEndSession} className="flex-1 py-3 rounded-lg bg-blue-600 items-center">
                <Text className="font-semibold text-white">End</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={refuelModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-lg font-bold mb-4">Mid-shift refuel</Text>
            {activeVehicle && (
              <Text className="text-sm text-gray-600 mb-3">Vehicle: {activeVehicle.vehicleNumberOrId}</Text>
            )}
            <Text className="text-sm text-gray-600 mb-1">Litres</Text>
            <TextInput
              value={refuelLitres}
              onChangeText={setRefuelLitres}
              placeholder="e.g. 50"
              keyboardType="decimal-pad"
              className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
            />
            <Text className="text-sm text-slate-600 mb-1">Cost per litre (RWF, optional)</Text>
            <TextInput
              value={refuelCostPerLitre}
              onChangeText={setRefuelCostPerLitre}
              placeholder="e.g. 1200"
              keyboardType="decimal-pad"
              className="border border-gray-300 rounded-lg px-3 py-2 mb-4 bg-white"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setRefuelModalVisible(false)} className="flex-1 py-3 rounded-lg bg-gray-200 items-center">
                <Text className="font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleMidShiftRefuel} className="flex-1 py-3 rounded-lg bg-blue-600 items-center">
                <Text className="font-semibold text-white">Add fuel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
