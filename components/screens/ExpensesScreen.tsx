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
} from 'react-native';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { generateId } from '@/lib/id';
import { formatAmount, formatPerUnit, CURRENCY_SYMBOL } from '@/lib/currency';
import { Receipt, Fuel } from 'lucide-react-native';

export function ExpensesScreen() {
  const { sites, vehicles, expenses, addExpense } = useMockAppStore();
  const [generalModalVisible, setGeneralModalVisible] = useState(false);
  const [fuelModalVisible, setFuelModalVisible] = useState(false);

  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [amountRwf, setAmountRwf] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const [fuelSiteId, setFuelSiteId] = useState(sites[0]?.id ?? '');
  const [vehicleId, setVehicleId] = useState('');
  const [litres, setLitres] = useState('');
  const [costPerLitre, setCostPerLitre] = useState('');

  const siteVehicles = vehicles.filter((v) => v.siteId === fuelSiteId);
  const fuelCost =
    (parseFloat(litres) || 0) * (parseFloat(costPerLitre) || 0);

  const submitGeneral = async () => {
    const amount = parseInt(amountRwf, 10);
    if (!siteId || isNaN(amount) || amount <= 0 || !description.trim()) return;
    const site = sites.find((s) => s.id === siteId);
    if (!site) return;
    try {
      await addExpense({
        id: generateId('e'),
        siteId,
        amountRwf: amount,
        description: description.trim(),
        date,
        type: 'general',
        createdAt: new Date().toISOString(),
      });
      setGeneralModalVisible(false);
      setAmountRwf('');
      setDescription('');
    } catch {
      Alert.alert('Error', 'Failed to add expense');
    }
  };

  const submitFuel = async () => {
    const l = parseFloat(litres);
    const cpl = parseFloat(costPerLitre);
    if (!fuelSiteId || !vehicleId || isNaN(l) || l <= 0 || isNaN(cpl) || cpl <= 0) return;
    const site = sites.find((s) => s.id === fuelSiteId);
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!site || !vehicle) return;
    const totalCost = Math.round(l * cpl);
    try {
      await addExpense({
        id: generateId('e'),
        siteId: fuelSiteId,
        amountRwf: totalCost,
        description: `Fuel ${vehicle.vehicleNumberOrId}`,
        date: new Date().toISOString().slice(0, 10),
        type: 'fuel',
        vehicleId,
        litres: l,
        costPerLitre: cpl,
        fuelCost: totalCost,
        createdAt: new Date().toISOString(),
      });
      setFuelModalVisible(false);
      setLitres('');
      setCostPerLitre('');
      setVehicleId('');
    } catch {
      Alert.alert('Error', 'Failed to add fuel expense');
    }
  };

  const getSiteName = (id: string) => sites.find((s) => s.id === id)?.name ?? id;
  const getVehicleLabel = (id: string) => vehicles.find((v) => v.id === id)?.vehicleNumberOrId ?? id;

  return (
    <View className="flex-1 bg-gray-50">
      <Header
        title="Expenses"
        subtitle="General and fuel expenses"
        rightAction={null}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding }}>
        <View className="flex-row gap-3 mb-4">
          <TouchableOpacity
            onPress={() => {
              setSiteId(sites[0]?.id ?? '');
              setAmountRwf('');
              setDescription('');
              setDate(new Date().toISOString().slice(0, 10));
              setGeneralModalVisible(true);
            }}
            className="flex-1 bg-blue-600 rounded-lg p-4 flex-row items-center"
          >
            <Receipt size={24} color="#fff" />
            <Text className="text-white font-semibold ml-2">Add expense</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setFuelSiteId(sites[0]?.id ?? '');
              setVehicleId(siteVehicles[0]?.id ?? '');
              setLitres('');
              setCostPerLitre('');
              setFuelModalVisible(true);
            }}
            className="flex-1 bg-gray-700 rounded-lg p-4 flex-row items-center"
          >
            <Fuel size={24} color="#fff" />
            <Text className="text-white font-semibold ml-2">Add fuel entry</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-lg font-bold text-gray-900 mb-2">Recent expenses</Text>
        {expenses.slice(-20).reverse().map((e) => (
          <Card key={e.id} className="mb-2">
            <View className="flex-row justify-between items-start">
              <View>
                <Text className="font-semibold text-gray-900">{e.description}</Text>
                <Text className="text-xs text-gray-500">{getSiteName(e.siteId)} · {e.date}</Text>
                {e.type === 'fuel' && e.litres != null && (
                  <Text className="text-xs text-slate-500">{e.litres} L @ {e.costPerLitre} {formatPerUnit('L')}</Text>
                )}
              </View>
              <Text className="font-semibold text-slate-900">{formatAmount(e.amountRwf)}</Text>
            </View>
          </Card>
        ))}
        {expenses.length === 0 && (
          <Text className="text-gray-500 py-4">No expenses yet.</Text>
        )}
      </ScrollView>

      <Modal visible={generalModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-lg font-bold mb-4">Add expense ({CURRENCY_SYMBOL})</Text>
            <Text className="text-sm text-gray-600 mb-1">Site</Text>
            <View className="flex-row flex-wrap gap-2 mb-3">
              {sites.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setSiteId(s.id)}
                  className={`px-3 py-2 rounded-lg ${siteId === s.id ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <Text className={siteId === s.id ? 'text-white font-medium' : 'text-gray-700'}>{s.name}</Text>
                </Pressable>
              ))}
            </View>
            <Text className="text-sm text-slate-600 mb-1">Amount (RWF)</Text>
            <TextInput
              value={amountRwf}
              onChangeText={setAmountRwf}
              placeholder="e.g. 50000"
              keyboardType="number-pad"
              className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
            />
            <Text className="text-sm text-gray-600 mb-1">Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Labour cost"
              className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
            />
            <DatePickerField
              label="Expense date"
              value={date}
              onValueChange={setDate}
              placeholder="Pick date"
              className="mb-4"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setGeneralModalVisible(false)} className="flex-1 py-3 rounded-lg bg-gray-200 items-center">
                <Text className="font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submitGeneral} className="flex-1 py-3 rounded-lg bg-blue-600 items-center">
                <Text className="font-semibold text-white">Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={fuelModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-lg font-bold mb-4">Add fuel entry</Text>
            <Text className="text-sm text-gray-600 mb-1">Site</Text>
            <View className="flex-row flex-wrap gap-2 mb-3">
              {sites.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => { setFuelSiteId(s.id); setVehicleId(vehicles.filter((v) => v.siteId === s.id)[0]?.id ?? ''); }}
                  className={`px-3 py-2 rounded-lg ${fuelSiteId === s.id ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <Text className={fuelSiteId === s.id ? 'text-white font-medium' : 'text-gray-700'}>{s.name}</Text>
                </Pressable>
              ))}
            </View>
            <Text className="text-sm text-gray-600 mb-1">Vehicle</Text>
            <View className="flex-row flex-wrap gap-2 mb-3">
              {siteVehicles.map((v) => (
                <Pressable
                  key={v.id}
                  onPress={() => setVehicleId(v.id)}
                  className={`px-3 py-2 rounded-lg ${vehicleId === v.id ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <Text className={vehicleId === v.id ? 'text-white font-medium' : 'text-gray-700'}>{v.vehicleNumberOrId}</Text>
                </Pressable>
              ))}
            </View>
            <Text className="text-sm text-gray-600 mb-1">Litres</Text>
            <TextInput
              value={litres}
              onChangeText={setLitres}
              placeholder="e.g. 100"
              keyboardType="decimal-pad"
              className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
            />
            <Text className="text-sm text-slate-600 mb-1">Cost per litre (RWF)</Text>
            <TextInput
              value={costPerLitre}
              onChangeText={setCostPerLitre}
              placeholder="e.g. 1200"
              keyboardType="decimal-pad"
              className="border border-gray-300 rounded-lg px-3 py-2 mb-2 bg-white"
            />
            <Text className="text-sm text-slate-700 mb-4">Fuel cost = {fuelCost > 0 ? formatAmount(fuelCost) : formatAmount(0)}</Text>
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setFuelModalVisible(false)} className="flex-1 py-3 rounded-lg bg-gray-200 items-center">
                <Text className="font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submitFuel} className="flex-1 py-3 rounded-lg bg-blue-600 items-center">
                <Text className="font-semibold text-white">Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
