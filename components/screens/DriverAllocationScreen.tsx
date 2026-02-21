import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable, ActivityIndicator } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { useAuth } from '@/context/AuthContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { getRoleDisplayLabel } from '@/lib/rbac';
import { ArrowLeft, User, Truck } from 'lucide-react-native';

export function DriverAllocationScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const theme = useResponsiveTheme();
  const { sites, users, vehicles, siteAssignments, driverVehicleAssignments, setDriverVehicleAssignment, loading } = useMockAppStore();

  const mySiteIds = sites.filter((s) => s.assistantSupervisorId === user?.id || user?.siteAccess?.includes(s.id)).map((s) => s.id);
  const siteId = mySiteIds[0] ?? sites[0]?.id;
  const site = sites.find((s) => s.id === siteId);
  const siteDrivers = siteAssignments
    .filter((a) => a.siteId === siteId && (a.role === 'driver_truck' || a.role === 'driver_machine'))
    .map((a) => users.find((u) => u.id === a.userId))
    .filter(Boolean) as typeof users;
  const siteVehicles = vehicles.filter((v) => v.siteId === siteId);

  const getAssignedVehicleIds = (driverId: string) =>
    driverVehicleAssignments.find((a) => a.siteId === siteId && a.driverId === driverId)?.vehicleIds ?? [];

  const toggleDriverVehicle = (driverId: string, vehicleId: string) => {
    const current = getAssignedVehicleIds(driverId);
    const next = current.includes(vehicleId)
      ? current.filter((id) => id !== vehicleId)
      : [...current, vehicleId];
    setDriverVehicleAssignment(siteId, driverId, next);
  };

  if (!site && !loading) {
    return (
      <View className="flex-1 bg-gray-50">
        <Header title="Driver allocation" leftAction={<TouchableOpacity onPress={onBack}><Text className="text-blue-600 font-semibold">Back</Text></TouchableOpacity>} />
        <View className="p-4"><Text className="text-gray-600">No site assigned.</Text></View>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50">
        <Header title="Driver allocation" leftAction={<TouchableOpacity onPress={onBack}><Text className="text-blue-600 font-semibold">Back</Text></TouchableOpacity>} />
        <View className="flex-1 py-12 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
          <Text className="text-gray-600 mt-3">Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <Header
        title="Reassign drivers to vehicles"
        subtitle={site.name}
        leftAction={
          <TouchableOpacity onPress={onBack} className="flex-row items-center">
            <ArrowLeft size={22} color="#2563EB" />
            <Text className="text-blue-600 font-semibold ml-1">Back</Text>
          </TouchableOpacity>
        }
      />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding }}>
        <Text className="text-sm text-gray-600 mb-3">Select which vehicles each driver can use at this site.</Text>
        {siteDrivers.length === 0 ? (
          <Card><Text className="text-gray-600">No drivers assigned to this site. Head Supervisor assigns drivers from Site detail.</Text></Card>
        ) : (
          siteDrivers.map((driver) => (
            <Card key={driver.id} className="mb-4">
              <View className="flex-row items-center mb-2">
                <User size={20} color="#3B82F6" />
                <Text className="font-semibold text-gray-900 ml-2">{driver.name}</Text>
                <Text className="text-xs text-gray-500 ml-2">({getRoleDisplayLabel(driver.role)})</Text>
              </View>
              <Text className="text-xs text-gray-500 mb-2">Vehicles this driver can use:</Text>
              <View className="flex-row flex-wrap gap-2">
                {siteVehicles.map((v) => {
                  const selected = getAssignedVehicleIds(driver.id).includes(v.id);
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => toggleDriverVehicle(driver.id, v.id)}
                      className={`px-3 py-2 rounded-lg flex-row items-center ${selected ? 'bg-blue-600' : 'bg-gray-200'}`}
                    >
                      <Truck size={14} color={selected ? '#fff' : '#374151'} />
                      <Text className={`ml-1 font-medium ${selected ? 'text-white' : 'text-gray-700'}`}>{v.vehicleNumberOrId}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
