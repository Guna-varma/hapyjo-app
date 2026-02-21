import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import {
  documentDirectory,
  cacheDirectory,
  writeAsStringAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { useAuth } from '@/context/AuthContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { formatAmount } from '@/lib/currency';
import { canSeeFinancialSummary, isReportsReadOnly } from '@/lib/rbac';
import { generateId } from '@/lib/id';
import {
  FileText,
  TrendingUp,
  DollarSign,
  BarChart3,
  Download,
  Lock,
  Fuel,
} from 'lucide-react-native';

function getReportsSubtitle(role: string | undefined): string {
  if (role === 'accountant') return 'Read-only financial reports';
  if (role === 'owner') return 'Business insights';
  if (role === 'head_supervisor') return 'Operations and budget analytics';
  if (role === 'admin') return 'Operations analytics';
  return 'Reports';
}

function reportDataToCSV(data: Record<string, unknown>): string {
  const rows: string[] = [];
  const flatten = (obj: unknown, prefix = ''): [string, string][] => {
    if (obj == null) return [];
    if (typeof obj !== 'object') return [[prefix, String(obj)]];
    const out: [string, string][] = [];
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v != null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
        out.push(...flatten(v, key));
      } else {
        out.push([key, v != null ? String(v) : '']);
      }
    }
    return out;
  };
  const entries = flatten(data);
  rows.push('Key,Value');
  entries.forEach(([k, v]) => rows.push(`"${k.replace(/"/g, '""')}","${String(v).replace(/"/g, '""')}"`));
  return rows.join('\n');
}

export function ReportsScreen() {
  const { user } = useAuth();
  const theme = useResponsiveTheme();
  const { sites, vehicles, expenses, trips, machineSessions, surveys, reports, addReport, refetch, loading } = useMockAppStore();
  const [selectedType, setSelectedType] = useState<'all' | 'financial' | 'operations' | 'site_performance'>('all');
  const [fuelSiteId, setFuelSiteId] = useState<string | null>(null);
  const [fuelDateFrom, setFuelDateFrom] = useState('');
  const [fuelDateTo, setFuelDateTo] = useState('');
  const [generating, setGenerating] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const readOnly = user ? isReportsReadOnly(user.role) : false;
  const showSummary = user ? canSeeFinancialSummary(user.role) : false;
  const canGenerate = user ? ['admin', 'owner', 'head_supervisor'].includes(user.role) : false;

  const filteredReports = selectedType === 'all'
    ? reports
    : reports.filter((r) => r.type === selectedType);

  const reportTypes = [
    { id: 'all', label: 'All', icon: <FileText size={18} color="#6B7280" /> },
    { id: 'financial', label: 'Financial', icon: <DollarSign size={18} color="#10B981" /> },
    { id: 'operations', label: 'Operations', icon: <BarChart3 size={18} color="#3B82F6" /> },
    { id: 'site_performance', label: 'Site Performance', icon: <TrendingUp size={18} color="#8B5CF6" /> },
  ];

  const totalBudget = sites.reduce((sum, site) => sum + site.budget, 0);
  const totalSpent = sites.reduce((sum, site) => sum + site.spent, 0);

  const fuelExpensesByVehicle = expenses
    .filter((e) => e.type === 'fuel' && e.vehicleId)
    .reduce<Record<string, { litres: number; cost: number }>>((acc, e) => {
      const id = e.vehicleId!;
      if (!acc[id]) acc[id] = { litres: 0, cost: 0 };
      acc[id].litres += e.litres ?? 0;
      acc[id].cost += e.amountRwf;
      return acc;
    }, {});
  const tripDistanceByVehicle = trips
    .filter((t) => t.status === 'completed')
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.vehicleId] = (acc[t.vehicleId] ?? 0) + t.distanceKm;
      return acc;
    }, {});
  const sessionHoursByVehicle = machineSessions
    .filter((m) => m.status === 'completed')
    .reduce<Record<string, number>>((acc, m) => {
      acc[m.vehicleId] = (acc[m.vehicleId] ?? 0) + (m.durationHours ?? 0);
      return acc;
    }, {});

  const inDateRange = (iso: string) => {
    if (!fuelDateFrom && !fuelDateTo) return true;
    const d = iso.slice(0, 10);
    if (fuelDateFrom && d < fuelDateFrom) return false;
    if (fuelDateTo && d > fuelDateTo) return false;
    return true;
  };

  const vehiclesForFuel = fuelSiteId
    ? vehicles.filter((v) => v.siteId === fuelSiteId)
    : vehicles;
  const tripsForFuel = trips.filter((t) => t.status === 'completed' && inDateRange(t.startTime));
  const sessionsForFuel = machineSessions.filter((m) => m.status === 'completed' && inDateRange(m.startTime));

  const expectedFuelByVehicle: Record<string, number> = {};
  const actualFuelByVehicle: Record<string, number> = {};
  vehiclesForFuel.forEach((v) => {
    if (v.type === 'truck' && v.mileageKmPerLitre) {
      const distance = tripsForFuel.filter((t) => t.vehicleId === v.id).reduce((s, t) => s + t.distanceKm, 0);
      expectedFuelByVehicle[v.id] = distance / v.mileageKmPerLitre;
    } else if (v.type === 'machine' && v.hoursPerLitre) {
      const hours = sessionsForFuel.filter((m) => m.vehicleId === v.id).reduce((s, m) => s + (m.durationHours ?? 0), 0);
      expectedFuelByVehicle[v.id] = hours * v.hoursPerLitre;
    } else {
      expectedFuelByVehicle[v.id] = 0;
    }
    const fromTrips = tripsForFuel.filter((t) => t.vehicleId === v.id).reduce((s, t) => s + (t.fuelConsumed ?? 0), 0);
    const fromSessions = sessionsForFuel.filter((m) => m.vehicleId === v.id).reduce((s, m) => s + (m.fuelConsumed ?? 0), 0);
    actualFuelByVehicle[v.id] = fromTrips + fromSessions;
  });

  const totalRevenue = surveys
    .filter((s) => s.status === 'approved' && s.workVolume != null)
    .reduce((sum, s) => {
      const site = sites.find((site) => site.id === s.siteId);
      const rate = site?.contractRateRwf ?? 0;
      return sum + (s.workVolume! * rate);
    }, 0);
  const totalSpentAll = sites.reduce((sum, s) => sum + s.spent, 0);
  const totalProfit = totalRevenue - totalSpentAll;
  const totalBudgetAll = sites.reduce((sum, s) => sum + s.budget, 0);
  const remainingBudgetAll = totalBudgetAll - totalSpentAll;
  const tripsCompleted = trips.filter((t) => t.status === 'completed').length;
  const machineHoursTotal = machineSessions
    .filter((m) => m.status === 'completed')
    .reduce((s, m) => s + (m.durationHours ?? 0), 0);
  const fuelCostTotal = expenses.filter((e) => e.type === 'fuel').reduce((s, e) => s + e.amountRwf, 0);

  const handleGenerateReport = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const reportData = {
        trips: tripsCompleted,
        machine_hours: Math.round(machineHoursTotal * 100) / 100,
        fuel_cost: fuelCostTotal,
        expenses: totalSpentAll,
        revenue: totalRevenue,
        profit: totalProfit,
        totalBudget: totalBudgetAll,
        totalSpent: totalSpentAll,
        remainingBudget: remainingBudgetAll,
        generatedAt: now.toISOString(),
      };
      await addReport({
        id: generateId('r'),
        title: `Financial Report ${period}`,
        type: 'financial',
        generatedDate: now.toISOString().slice(0, 10),
        period,
        data: reportData,
      });
      await refetch();
      Alert.alert('Report generated', 'The report has been saved. You can export it as CSV.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleExportCSV = async (report: (typeof reports)[0]) => {
    if (!report.data || typeof report.data !== 'object') {
      Alert.alert('Export', 'No data to export.');
      return;
    }
    setExportingId(report.id);
    try {
      const csv = reportDataToCSV(report.data as Record<string, unknown>);
      const filename = `report_${report.id}_${report.generatedDate}.csv`;
      const dir = documentDirectory ?? cacheDirectory ?? '';
      const path = `${dir}${filename}`;
      await writeAsStringAsync(path, csv, { encoding: EncodingType.UTF8 });
      let canShare = false;
      try {
        // Optional: expo-sharing for Android save/share
        const Sharing = await import('expo-sharing');
        canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(path, {
            mimeType: 'text/csv',
            dialogTitle: 'Save report',
          });
        }
      } catch {
        // expo-sharing not available (e.g. web or not installed)
      }
      Alert.alert(
        'Report exported',
        canShare
          ? 'CSV ready. Use the share dialog to save to your device or drive.'
          : `CSV saved. Path: ${path}`
      );
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Could not export CSV');
    } finally {
      setExportingId(null);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <Header title="Reports" subtitle={getReportsSubtitle(user?.role)} />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding }}>
        {loading ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color="#2563eb" />
            <Text className="text-gray-600 mt-3">Loading reports...</Text>
          </View>
        ) : (
          <>
        {/* Filter Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          className="mb-4"
        >
          <View className="flex-row gap-2">
            {reportTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                onPress={() => setSelectedType(type.id as any)}
                className={`px-4 py-2 rounded-lg flex-row items-center ${
                  selectedType === type.id 
                    ? 'bg-blue-600' 
                    : 'bg-white border border-gray-300'
                }`}
              >
                {type.icon}
                <Text 
                  className={`ml-2 font-semibold ${
                    selectedType === type.id ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {readOnly && (
          <Card className="mb-4 bg-amber-50 border border-amber-200">
            <View className="flex-row items-center py-2">
              <Lock size={20} color="#B45309" />
              <Text className="text-amber-800 font-semibold ml-2">Read-only access</Text>
            </View>
            <Text className="text-sm text-amber-700">You can view reports but cannot generate or export.</Text>
          </Card>
        )}

        {/* Summary Cards */}
        {showSummary ? (
          <View className="mb-4">
            <Card className="bg-gradient-to-r from-blue-600 to-blue-700 mb-3">
              <View className="py-2">
                <View className="flex-row items-center mb-2">
                  <DollarSign size={24} color="#ffffff" />
                  <Text className="text-white text-base font-semibold ml-2">Financial Summary</Text>
                </View>
                <Text className="text-white text-3xl font-bold mb-3">
                  {formatAmount(totalBudget, true)}
                </Text>
                <View className="flex-row justify-between pt-3 border-t border-blue-500">
                  <View>
                    <Text className="text-blue-200 text-xs">Total Spent</Text>
                    <Text className="text-white text-lg font-semibold">
                      {(totalSpent / 1000000).toFixed(1)}M
                    </Text>
                  </View>
                  <View>
                    <Text className="text-blue-200 text-xs">Remaining</Text>
                    <Text className="text-white text-lg font-semibold">
                      {((totalBudget - totalSpent) / 1000000).toFixed(1)}M
                    </Text>
                  </View>
                  <View>
                    <Text className="text-blue-200 text-xs">Utilization</Text>
                    <Text className="text-white text-lg font-semibold">
                      {((totalSpent / totalBudget) * 100).toFixed(0)}%
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          </View>
        ) : null}

        {/* Vehicle Fuel Summary – Expected vs Actual, site & date filters */}
        {showSummary && (
          <View className="mb-4">
            <Text className="text-lg font-bold text-gray-900 mb-3">Vehicle fuel summary</Text>
            <View className="flex-row flex-wrap gap-2 mb-3">
              <TouchableOpacity
                onPress={() => setFuelSiteId(null)}
                className={`px-3 py-2 rounded-lg ${fuelSiteId === null ? 'bg-blue-600' : 'bg-white border border-gray-300'}`}
              >
                <Text className={fuelSiteId === null ? 'text-white font-medium' : 'text-gray-700'}>All sites</Text>
              </TouchableOpacity>
              {sites.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setFuelSiteId(s.id)}
                  className={`px-3 py-2 rounded-lg ${fuelSiteId === s.id ? 'bg-blue-600' : 'bg-white border border-gray-300'}`}
                >
                  <Text className={fuelSiteId === s.id ? 'text-white font-medium' : 'text-gray-700'}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className="flex-row gap-2 mb-2">
              <View className="flex-1">
                <DatePickerField
                  label="From date"
                  value={fuelDateFrom}
                  onValueChange={setFuelDateFrom}
                  placeholder="Pick start date"
                />
              </View>
              <View className="flex-1">
                <DatePickerField
                  label="To date"
                  value={fuelDateTo}
                  onValueChange={setFuelDateTo}
                  placeholder="Pick end date"
                />
              </View>
            </View>
            <View className="flex-row flex-wrap gap-2 mb-3">
              <TouchableOpacity
                onPress={() => {
                  const end = new Date();
                  const start = new Date(end);
                  start.setDate(start.getDate() - 6);
                  setFuelDateFrom(start.toISOString().slice(0, 10));
                  setFuelDateTo(end.toISOString().slice(0, 10));
                }}
                className="px-3 py-2 rounded-lg bg-slate-100 border border-slate-200"
              >
                <Text className="text-slate-700 text-sm font-medium">Last 7 days</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const now = new Date();
                  setFuelDateFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
                  setFuelDateTo(now.toISOString().slice(0, 10));
                }}
                className="px-3 py-2 rounded-lg bg-slate-100 border border-slate-200"
              >
                <Text className="text-slate-700 text-sm font-medium">This month</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setFuelDateFrom(''); setFuelDateTo(''); }}
                className="px-3 py-2 rounded-lg bg-slate-100 border border-slate-200"
              >
                <Text className="text-slate-700 text-sm font-medium">Clear dates</Text>
              </TouchableOpacity>
            </View>
            {vehiclesForFuel.map((v) => {
              const filled = fuelExpensesByVehicle[v.id];
              const totalFilled = filled?.litres ?? 0;
              const totalCost = filled?.cost ?? 0;
              const distance = tripDistanceByVehicle[v.id] ?? 0;
              const hours = sessionHoursByVehicle[v.id] ?? 0;
              const expected = expectedFuelByVehicle[v.id] ?? 0;
              const actual = actualFuelByVehicle[v.id] ?? 0;
              const variance = expected > 0 ? ((actual - expected) / expected) * 100 : 0;
              return (
                <Card key={v.id} className="mb-2">
                  <View className="flex-row items-center mb-2">
                    <Fuel size={18} color="#3B82F6" />
                    <Text className="font-semibold text-gray-900 ml-2">{v.vehicleNumberOrId}</Text>
                    <Text className="text-xs text-gray-500 ml-2 capitalize">{v.type}</Text>
                  </View>
                  <View className="flex-row flex-wrap gap-4 mb-2">
                    <View>
                      <Text className="text-xs text-gray-500">Expected (L)</Text>
                      <Text className="text-sm font-semibold">{expected.toFixed(1)}</Text>
                    </View>
                    <View>
                      <Text className="text-xs text-gray-500">Actual (L)</Text>
                      <Text className="text-sm font-semibold">{actual.toFixed(1)}</Text>
                    </View>
                    <View>
                      <Text className="text-xs text-gray-500">Variance</Text>
                      <Text className={`text-sm font-semibold ${variance > 0 ? 'text-amber-600' : variance < 0 ? 'text-green-600' : 'text-gray-700'}`}>
                        {variance > 0 ? '+' : ''}{variance.toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row flex-wrap gap-4 pt-2 border-t border-gray-100">
                    <View>
                      <Text className="text-xs text-gray-500">Total filled (L)</Text>
                      <Text className="text-sm font-semibold">{totalFilled.toFixed(1)}</Text>
                    </View>
                    <View>
                      <Text className="text-xs text-gray-500">Fuel cost</Text>
                      <Text className="text-sm font-semibold">{formatAmount(totalCost)}</Text>
                    </View>
                    <View>
                      <Text className="text-xs text-gray-500">{v.type === 'truck' ? 'Distance (km)' : 'Hours'}</Text>
                      <Text className="text-sm font-semibold">{v.type === 'truck' ? distance : hours.toFixed(1)}</Text>
                    </View>
                    <View>
                      <Text className="text-xs text-gray-500">Remaining (L)</Text>
                      <Text className="text-sm font-semibold">{v.fuelBalanceLitre.toFixed(1)}</Text>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* Reports List */}
        <View className="mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">Available Reports</Text>
          {filteredReports.map((report) => (
            <Card key={report.id} className="mb-3">
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1">
                  <Text className="text-base font-bold text-gray-900 mb-1">{report.title}</Text>
                  <Text className="text-xs text-gray-600 capitalize">{report.type.replace('_', ' ')}</Text>
                </View>
                <View className="bg-blue-100 px-2 py-1 rounded">
                  <Text className="text-xs font-semibold text-blue-800">{report.period}</Text>
                </View>
              </View>

              <View className="bg-gray-50 rounded p-3 my-3">
                {report.type === 'financial' && report.data && (
                  <View>
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-sm text-gray-600">Total Budget</Text>
                      <Text className="text-sm font-semibold text-gray-900">
                        {formatAmount(report.data.totalBudget, true)}
                      </Text>
                    </View>
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-sm text-gray-600">Total Spent</Text>
                      <Text className="text-sm font-semibold text-gray-900">
                        {formatAmount(report.data.totalSpent, true)}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-gray-600">Remaining</Text>
                      <Text className="text-sm font-semibold text-green-600">
                        {formatAmount(report.data.remainingBudget, true)}
                      </Text>
                    </View>
                  </View>
                )}
                {report.type === 'operations' && report.data && (
                  <View>
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-sm text-gray-600">Active Sites</Text>
                      <Text className="text-sm font-semibold text-gray-900">{report.data.activeSites}</Text>
                    </View>
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-sm text-gray-600">Completed Tasks</Text>
                      <Text className="text-sm font-semibold text-green-600">{report.data.completedTasks}</Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-gray-600">Pending Tasks</Text>
                      <Text className="text-sm font-semibold text-yellow-600">{report.data.pendingTasks}</Text>
                    </View>
                  </View>
                )}
              </View>

              <View className="flex-row items-center justify-between pt-3 border-t border-gray-200">
                <Text className="text-xs text-gray-600">Generated: {report.generatedDate}</Text>
                {!readOnly && (
                  <TouchableOpacity
                    onPress={() => handleExportCSV(report)}
                    disabled={exportingId === report.id}
                    className="flex-row items-center"
                  >
                    <Download size={16} color="#3B82F6" />
                    <Text className="text-sm text-blue-600 font-semibold ml-1">
                      {exportingId === report.id ? 'Exporting…' : 'Export CSV'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          ))}
        </View>

        {/* Generate Report – Owner / Accountant / Admin / Head Supervisor */}
        {canGenerate && (
          <Card className="bg-blue-50 mb-4">
            <View className="py-2">
              <Text className="text-base font-bold text-gray-900 mb-2">Generate Report</Text>
              <Text className="text-sm text-gray-600 mb-4">
                Create a financial report (trips, machine hours, fuel cost, expenses, revenue, profit) and export as CSV.
              </Text>
              <Button onPress={handleGenerateReport} disabled={generating}>
                {generating ? 'Generating…' : 'Generate Report'}
              </Button>
            </View>
          </Card>
        )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
