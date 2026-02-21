import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useAuth } from '@/context/AuthContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { formatAmount } from '@/lib/currency';
import type { Site } from '@/types';
import { ArrowLeft } from 'lucide-react-native';

interface SiteDetailScreenProps {
  site: Site;
  onBack: () => void;
}

export function SiteDetailScreen({ site, onBack }: SiteDetailScreenProps) {
  const { user } = useAuth();
  const theme = useResponsiveTheme();
  const {
    sites,
    vehicles,
    users,
    siteAssignments,
    setSiteAssignment,
    setDriverVehicleAssignment,
    updateSite,
  } = useMockAppStore();
  const isHeadSupervisor = user?.role === 'head_supervisor';

  const siteVehicles = vehicles.filter((v) => v.siteId === site.id);
  const assignableByRole = {
    assistant_supervisor: users.filter((u) => u.role === 'assistant_supervisor'),
    surveyor: users.filter((u) => u.role === 'surveyor'),
    driver_truck: users.filter((u) => u.role === 'driver_truck'),
    driver_machine: users.filter((u) => u.role === 'driver_machine'),
  };
  const assignmentsForSite = siteAssignments.filter((a) => a.siteId === site.id);

  const getAssignedUserId = (role: string) =>
    assignmentsForSite.find((a) => a.role === role)?.userId ?? null;
  const getAssignedVehicleIds = () => {
    const row = assignmentsForSite.find((a) => a.role === 'assistant_supervisor');
    return row?.vehicleIds ?? [];
  };

  const [selectedAssistant, setSelectedAssistant] = useState<string | null>(getAssignedUserId('assistant_supervisor'));
  const [selectedSurveyor, setSelectedSurveyor] = useState<string | null>(getAssignedUserId('surveyor'));
  const [selectedDriverTruck, setSelectedDriverTruck] = useState<string | null>(getAssignedUserId('driver_truck'));
  const [selectedDriverMachine, setSelectedDriverMachine] = useState<string | null>(getAssignedUserId('driver_machine'));
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>(getAssignedVehicleIds());

  const saveAssignments = async () => {
    try {
      if (selectedAssistant) {
        await setSiteAssignment(site.id, { userId: selectedAssistant, role: 'assistant_supervisor', vehicleIds: selectedVehicleIds });
      }
      if (selectedSurveyor) {
        await setSiteAssignment(site.id, { userId: selectedSurveyor, role: 'surveyor' });
      }
      if (selectedDriverTruck) {
        await setSiteAssignment(site.id, { userId: selectedDriverTruck, role: 'driver_truck' });
        await setDriverVehicleAssignment(site.id, selectedDriverTruck, selectedVehicleIds);
      }
      if (selectedDriverMachine) {
        await setSiteAssignment(site.id, { userId: selectedDriverMachine, role: 'driver_machine' });
        await setDriverVehicleAssignment(site.id, selectedDriverMachine, selectedVehicleIds);
      }
      const driverIds = [selectedDriverTruck, selectedDriverMachine].filter(Boolean) as string[];
      await updateSite(site.id, {
        assistantSupervisorId: selectedAssistant ?? undefined,
        surveyorId: selectedSurveyor ?? undefined,
        driverIds: driverIds.length ? driverIds : undefined,
        vehicleIds: selectedVehicleIds.length ? selectedVehicleIds : undefined,
      });
    } catch (_e) {
      // Error surfaced by store or realtime
    }
  };

  const toggleVehicle = (vehicleId: string) => {
    setSelectedVehicleIds((prev) =>
      prev.includes(vehicleId) ? prev.filter((id) => id !== vehicleId) : [...prev, vehicleId]
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      <Header
        title={site.name}
        subtitle={site.location}
        leftAction={
          <TouchableOpacity onPress={onBack} className="flex-row items-center">
            <ArrowLeft size={22} color="#2563EB" />
            <Text className="text-blue-600 font-semibold ml-1">Sites</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding }}>
        <Card className="mb-4">
          <Text className="text-sm text-gray-600">Status</Text>
          <Text className="font-semibold text-gray-900 capitalize">{site.status}</Text>
          <View className="flex-row justify-between mt-2">
            <Text className="text-sm text-slate-600">Budget: {formatAmount(site.budget, true)}</Text>
            <Text className="text-sm text-slate-600">Spent: {formatAmount(site.spent, true)}</Text>
          </View>
        </Card>

        {isHeadSupervisor && (
          <>
            <Text className="text-lg font-bold text-gray-900 mb-2">Assignments</Text>

            <Card className="mb-3">
              <Text className="text-sm text-gray-600 mb-2">Assistant Supervisor</Text>
              <View className="flex-row flex-wrap gap-2">
                {assignableByRole.assistant_supervisor.map((u) => (
                  <Pressable
                    key={u.id}
                    onPress={() => setSelectedAssistant(selectedAssistant === u.id ? null : u.id)}
                    className={`px-3 py-2 rounded-lg ${selectedAssistant === u.id ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <Text className={selectedAssistant === u.id ? 'text-white font-medium' : 'text-gray-700'}>{u.name}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>

            <Card className="mb-3">
              <Text className="text-sm text-gray-600 mb-2">Surveyor</Text>
              <View className="flex-row flex-wrap gap-2">
                {assignableByRole.surveyor.map((u) => (
                  <Pressable
                    key={u.id}
                    onPress={() => setSelectedSurveyor(selectedSurveyor === u.id ? null : u.id)}
                    className={`px-3 py-2 rounded-lg ${selectedSurveyor === u.id ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <Text className={selectedSurveyor === u.id ? 'text-white font-medium' : 'text-gray-700'}>{u.name}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>

            <Card className="mb-3">
              <Text className="text-sm text-gray-600 mb-2">Driver (Truck)</Text>
              <View className="flex-row flex-wrap gap-2">
                {assignableByRole.driver_truck.map((u) => (
                  <Pressable
                    key={u.id}
                    onPress={() => setSelectedDriverTruck(selectedDriverTruck === u.id ? null : u.id)}
                    className={`px-3 py-2 rounded-lg ${selectedDriverTruck === u.id ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <Text className={selectedDriverTruck === u.id ? 'text-white font-medium' : 'text-gray-700'}>{u.name}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>

            <Card className="mb-3">
              <Text className="text-sm text-gray-600 mb-2">Driver (Machine)</Text>
              <View className="flex-row flex-wrap gap-2">
                {assignableByRole.driver_machine.map((u) => (
                  <Pressable
                    key={u.id}
                    onPress={() => setSelectedDriverMachine(selectedDriverMachine === u.id ? null : u.id)}
                    className={`px-3 py-2 rounded-lg ${selectedDriverMachine === u.id ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <Text className={selectedDriverMachine === u.id ? 'text-white font-medium' : 'text-gray-700'}>{u.name}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>

            <Card className="mb-3">
              <Text className="text-sm text-gray-600 mb-2">Vehicles (for this site)</Text>
              <View className="flex-row flex-wrap gap-2">
                {siteVehicles.map((v) => (
                  <Pressable
                    key={v.id}
                    onPress={() => toggleVehicle(v.id)}
                    className={`px-3 py-2 rounded-lg ${selectedVehicleIds.includes(v.id) ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <Text className={selectedVehicleIds.includes(v.id) ? 'text-white font-medium' : 'text-gray-700'}>
                      {v.vehicleNumberOrId}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Card>

            <TouchableOpacity onPress={saveAssignments} className="bg-blue-600 rounded-lg py-3 items-center mt-2">
              <Text className="text-white font-semibold">Save assignments</Text>
            </TouchableOpacity>
          </>
        )}

        {!isHeadSupervisor && (
          <Card>
            <Text className="text-gray-600">Assignment is managed by Head Supervisor.</Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
