import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { getTabsForRole, type TabId } from '@/lib/rbac';
import { RoleBasedDashboard } from '@/components/RoleBasedDashboard';
import { ReportsScreen } from '@/components/screens/ReportsScreen';
import { SettingsScreen } from '@/components/screens/SettingsScreen';
import { UsersScreen } from '@/components/screens/UsersScreen';
import { SitesScreen } from '@/components/screens/SitesScreen';
import {
  LayoutDashboard,
  FileText,
  Settings,
  ClipboardList,
  Users,
  Building2,
  Truck,
  Receipt,
  ClipboardCheck,
  AlertCircle,
  Camera,
} from 'lucide-react-native';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { GpsCameraScreen } from '@/features/gpsCamera/GpsCameraScreen';
import { VehiclesScreen } from '@/components/screens/VehiclesScreen';
import { ExpensesScreen } from '@/components/screens/ExpensesScreen';
import { DriverTripsScreen } from '@/components/screens/DriverTripsScreen';
import { SurveysScreen } from '@/components/screens/SurveysScreen';
import { IssuesScreen } from '@/components/screens/IssuesScreen';

const TAB_CONFIG: Record<TabId, { labelKey: string; icon: typeof LayoutDashboard }> = {
  dashboard: { labelKey: 'tab_dashboard', icon: LayoutDashboard },
  reports: { labelKey: 'tab_reports', icon: FileText },
  tasks: { labelKey: 'tab_tasks', icon: ClipboardList },
  users: { labelKey: 'tab_users', icon: Users },
  sites: { labelKey: 'tab_sites', icon: Building2 },
  vehicles: { labelKey: 'tab_vehicles', icon: Truck },
  expenses: { labelKey: 'tab_expenses', icon: Receipt },
  surveys: { labelKey: 'tab_surveys', icon: ClipboardCheck },
  issues: { labelKey: 'tab_issues', icon: AlertCircle },
  gps_camera: { labelKey: 'tab_gps_camera', icon: Camera },
  settings: { labelKey: 'tab_settings', icon: Settings },
};

export function AppNavigation() {
  const { user } = useAuth();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const theme = useResponsiveTheme();
  const tabIds = user ? getTabsForRole(user.role) : (['dashboard', 'settings'] as TabId[]);
  const [activeTab, setActiveTab] = useState<TabId>(tabIds[0]);

  useEffect(() => {
    if (!tabIds.includes(activeTab)) {
      setActiveTab(tabIds[0]);
    }
  }, [tabIds.join(','), activeTab]);

  const visibleTabs = tabIds.map((id) => ({ id, ...TAB_CONFIG[id], label: t(TAB_CONFIG[id].labelKey) }));

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <RoleBasedDashboard />;
      case 'reports':
        return <ReportsScreen />;
      case 'tasks':
        return user?.role === 'driver_truck' || user?.role === 'driver_machine' || user?.role === 'assistant_supervisor' || user?.role === 'head_supervisor' ? (
          <DriverTripsScreen />
        ) : (
          <RoleBasedDashboard />
        );
      case 'users':
        return <UsersScreen />;
      case 'sites':
        return <SitesScreen />;
      case 'vehicles':
        return <VehiclesScreen />;
      case 'expenses':
        return <ExpensesScreen />;
      case 'surveys':
        return <SurveysScreen />;
      case 'issues':
        return <IssuesScreen />;
      case 'gps_camera':
        return <GpsCameraScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <RoleBasedDashboard />;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Language switcher – responsive position */}
      <View style={{ position: 'absolute', top: insets.top + theme.spacingSm, right: theme.screenPadding, zIndex: 10 }}>
        <LanguageSwitcher />
      </View>
      <View className="flex-1">
        {renderContent()}
      </View>

      {/* Bottom Tab Bar – scrollable, responsive sizing for all phones */}
      <View className="bg-white border-t border-slate-200/80 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.tabPaddingH,
            paddingVertical: theme.tabPaddingV,
            flexDirection: 'row',
            alignItems: 'center',
          }}
          style={{ maxHeight: theme.tabPaddingV * 2 + theme.tabIconSize + theme.tabLabelSize + 8 }}
        >
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.75}
                className="items-center justify-center rounded-xl px-4 py-2 mr-1"
                style={{
                  minWidth: theme.tabItemMinWidth,
                  backgroundColor: isActive ? 'rgba(30, 64, 175, 0.08)' : 'transparent',
                }}
              >
                <Icon
                  size={theme.tabIconSize}
                  color={isActive ? '#1E40AF' : '#64748B'}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <Text
                  style={{
                    fontSize: theme.tabLabelSize,
                    marginTop: theme.spacingXs,
                    fontWeight: '500',
                    textAlign: 'center',
                    color: isActive ? '#1e3a8a' : '#475569',
                  }}
                  allowFontScaling={true}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
