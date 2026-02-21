import React, { useState } from 'react';
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
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { generateId } from '@/lib/id';
import type { Vehicle as VehicleType, VehicleType as VType } from '@/types';
import { Truck, Cog, Plus } from 'lucide-react-native';

type FilterType = 'all' | 'truck' | 'machine';

export function VehiclesScreen() {
  const theme = useResponsiveTheme();
  const { sites, vehicles, addVehicle, loading } = useMockAppStore();
  const [filter, setFilter] = useState<FilterType>('all');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addType, setAddType] = useState<VType>('truck');
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [mileageKmPerLitre, setMileageKmPerLitre] = useState('');
  const [hoursPerLitre, setHoursPerLitre] = useState('');
  const [tankCapacity, setTankCapacity] = useState('');
  const [healthInputs, setHealthInputs] = useState('');
  const [idealConsumptionRange, setIdealConsumptionRange] = useState('');
  const [idealWorkingRange, setIdealWorkingRange] = useState('');

  const filtered =
    filter === 'all'
      ? vehicles
      : vehicles.filter((v) => v.type === filter);

  const bySite = filtered.reduce<Record<string, VehicleType[]>>((acc, v) => {
    if (!acc[v.siteId]) acc[v.siteId] = [];
    acc[v.siteId].push(v);
    return acc;
  }, {});

  const openAdd = (type: VType) => {
    setAddType(type);
    setSiteId(sites[0]?.id ?? '');
    setVehicleNumber('');
    setMileageKmPerLitre('');
    setHoursPerLitre('');
    setTankCapacity('');
    setHealthInputs('');
    setIdealConsumptionRange('');
    setIdealWorkingRange('');
    setAddModalVisible(true);
  };

  const submitAdd = async () => {
    const capacity = parseFloat(tankCapacity);
    if (!siteId || !vehicleNumber.trim() || isNaN(capacity) || capacity <= 0) return;
    try {
      if (addType === 'truck') {
        const mileage = parseFloat(mileageKmPerLitre);
        if (isNaN(mileage) || mileage <= 0) return;
        await addVehicle({
          id: generateId('v'),
          siteId,
          type: 'truck',
          vehicleNumberOrId: vehicleNumber.trim(),
          mileageKmPerLitre: mileage,
          tankCapacityLitre: capacity,
          fuelBalanceLitre: 0,
          idealConsumptionRange: idealConsumptionRange.trim() || undefined,
          healthInputs: healthInputs.trim() || undefined,
        });
      } else {
        const hours = parseFloat(hoursPerLitre);
        if (isNaN(hours) || hours <= 0) return;
        await addVehicle({
          id: generateId('v'),
          siteId,
          type: 'machine',
          vehicleNumberOrId: vehicleNumber.trim(),
          hoursPerLitre: hours,
          tankCapacityLitre: capacity,
          fuelBalanceLitre: 0,
          idealWorkingRange: idealWorkingRange.trim() || undefined,
        });
      }
      setAddModalVisible(false);
    } catch {
      Alert.alert('Error', 'Failed to add vehicle');
    }
  };

  const getSiteName = (id: string) => sites.find((s) => s.id === id)?.name ?? id;

  return (
    <View className="flex-1 bg-gray-50">
      <Header
        title="Vehicles"
        subtitle="Trucks and machines by site"
        rightAction={
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => openAdd('truck')}
              className="bg-blue-600 rounded-lg px-3 py-2 flex-row items-center"
            >
              <Truck size={18} color="#fff" />
              <Text className="text-white font-semibold ml-1">Add Truck</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => openAdd('machine')}
              className="bg-gray-700 rounded-lg px-3 py-2 flex-row items-center"
            >
              <Cog size={18} color="#fff" />
              <Text className="text-white font-semibold ml-1">Add Machine</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <View className="px-4 py-2 flex-row border-b border-gray-200 bg-white">
        {(['all', 'truck', 'machine'] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            className={`flex-1 py-2 rounded-lg mx-1 ${filter === f ? 'bg-blue-100' : 'bg-gray-100'}`}
          >
            <Text
              className={`text-center font-medium ${filter === f ? 'text-blue-700' : 'text-gray-600'}`}
            >
              {f === 'all' ? 'All' : f === 'truck' ? 'Trucks' : 'Machines'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding }}>
        {loading ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color="#2563eb" />
            <Text className="text-gray-600 mt-3">Loading vehicles...</Text>
          </View>
        ) : (
          <>
        {Object.entries(bySite).map(([sid, list]) => (
          <View key={sid} className="mb-4">
            <Text className="text-sm font-semibold text-gray-500 mb-2">{getSiteName(sid)}</Text>
            {list.map((v) => (
              <Card key={v.id} className="mb-2">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="font-semibold text-gray-900">{v.vehicleNumberOrId}</Text>
                    <Text className="text-xs text-gray-500 capitalize">{v.type}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-sm text-gray-700">
                      Tank: {v.tankCapacityLitre} L · Balance: {v.fuelBalanceLitre} L
                    </Text>
                    {v.type === 'truck' && v.mileageKmPerLitre != null && (
                      <Text className="text-xs text-gray-500">{v.mileageKmPerLitre} km/L</Text>
                    )}
                    {v.type === 'machine' && v.hoursPerLitre != null && (
                      <Text className="text-xs text-gray-500">{v.hoursPerLitre} h/L</Text>
                    )}
                  </View>
                </View>
                {(v.healthInputs || v.idealWorkingRange || v.idealConsumptionRange) && (
                  <View className="mt-2 pt-2 border-t border-gray-100">
                    {v.type === 'truck' && v.healthInputs && (
                      <Text className="text-xs text-gray-600">Health: {v.healthInputs}</Text>
                    )}
                    {v.type === 'truck' && v.idealConsumptionRange && (
                      <Text className="text-xs text-gray-600">Ideal range: {v.idealConsumptionRange}</Text>
                    )}
                    {v.type === 'machine' && v.idealWorkingRange && (
                      <Text className="text-xs text-gray-600">Ideal working range: {v.idealWorkingRange}</Text>
                    )}
                  </View>
                )}
              </Card>
            ))}
          </View>
        ))}
        {filtered.length === 0 && (
          <Text className="text-gray-500 text-center py-8">No vehicles match the filter.</Text>
        )}
          </>
        )}
      </ScrollView>

      <Modal visible={addModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-2xl p-6 max-h-[80%]">
            <Text className="text-lg font-bold mb-4">
              {addType === 'truck' ? 'Add Truck' : 'Add Machine'}
            </Text>
            <ScrollView>
              <Text className="text-sm text-gray-600 mb-1">Site</Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {sites.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => setSiteId(s.id)}
                    className={`px-3 py-2 rounded-lg ${siteId === s.id ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <Text className={siteId === s.id ? 'text-white font-medium' : 'text-gray-700'}>
                      {s.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text className="text-sm text-gray-600 mb-1">Vehicle number or ID</Text>
              <TextInput
                value={vehicleNumber}
                onChangeText={setVehicleNumber}
                placeholder="e.g. TRK-004"
                className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
              />
              {addType === 'truck' ? (
                <>
                  <Text className="text-sm text-gray-600 mb-1">Mileage (km per litre)</Text>
                  <TextInput
                    value={mileageKmPerLitre}
                    onChangeText={setMileageKmPerLitre}
                    placeholder="e.g. 10"
                    keyboardType="decimal-pad"
                    className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
                  />
                  <Text className="text-sm text-gray-600 mb-1">Ideal consumption range (optional)</Text>
                  <TextInput
                    value={idealConsumptionRange}
                    onChangeText={setIdealConsumptionRange}
                    placeholder="e.g. 8–12 km/L"
                    className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
                  />
                  <Text className="text-sm text-gray-600 mb-1">Health inputs (optional)</Text>
                  <TextInput
                    value={healthInputs}
                    onChangeText={setHealthInputs}
                    placeholder="e.g. Tyres OK, service due Mar 2025"
                    className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
                  />
                </>
              ) : (
                <>
                  <Text className="text-sm text-gray-600 mb-1">Hours per litre</Text>
                  <TextInput
                    value={hoursPerLitre}
                    onChangeText={setHoursPerLitre}
                    placeholder="e.g. 2"
                    keyboardType="decimal-pad"
                    className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
                  />
                  <Text className="text-sm text-gray-600 mb-1">Ideal working range (optional)</Text>
                  <TextInput
                    value={idealWorkingRange}
                    onChangeText={setIdealWorkingRange}
                    placeholder="e.g. 1.5–2.5 h/L"
                    className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
                  />
                </>
              )}
              <Text className="text-sm text-gray-600 mb-1">Tank capacity (litres)</Text>
              <TextInput
                value={tankCapacity}
                onChangeText={setTankCapacity}
                placeholder="e.g. 200"
                keyboardType="decimal-pad"
                className="border border-gray-300 rounded-lg px-3 py-2 mb-4 bg-white"
              />
            </ScrollView>
            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                onPress={() => setAddModalVisible(false)}
                className="flex-1 py-3 rounded-lg bg-gray-200 items-center"
              >
                <Text className="font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitAdd}
                className="flex-1 py-3 rounded-lg bg-blue-600 items-center"
              >
                <Text className="font-semibold text-white">Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
