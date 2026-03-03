import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform, StatusBar, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { getTabsForRole, type TabId } from '@/lib/rbac';
import type { SurveyNavParams } from '@/components/RoleBasedDashboard';
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
  RefreshCw,
  Bell,
  LogOut,
} from 'lucide-react-native';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { NotificationsModal } from '@/components/ui/NotificationsModal';
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

/** Top inset so header bar and screen content render below the system status bar (Android notch/punch-hole safe). */
function useTopSafeInset(): number {
  const insets = useSafeAreaInsets();
  const fallback = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 28) : 0;
  return Math.max(insets.top, fallback);
}

export function AppNavigation() {
  const { user, logout } = useAuth();
  const { t, locale } = useLocale();
  const { refetch, loading, notifications } = useMockAppStore();
  const topInset = useTopSafeInset();
  const insets = useSafeAreaInsets();
  const theme = useResponsiveTheme();
  const tabIds = useMemo(
    () => (user ? getTabsForRole(user.role) : (['dashboard', 'settings'] as TabId[])),
    [user]
  );
  const [activeTab, setActiveTabState] = useState<TabId>(tabIds[0]);
  const [openNewSurveyModalOnce, setOpenNewSurveyModalOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);

  const setActiveTab = useCallback((tab: TabId, params?: SurveyNavParams) => {
    if (tab === 'surveys' && params?.openNewSurvey) setOpenNewSurveyModalOnce(true);
    setActiveTabState(tab);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refreshing]);

  const handleLogout = useCallback(() => {
    Alert.alert(t('settings_confirm_logout'), t('settings_confirm_logout_message'), [
      { text: t('common_cancel'), style: 'cancel' },
      { text: t('settings_sign_out'), style: 'destructive', onPress: () => logout() },
    ]);
  }, [t, logout]);

  const tabIdsKey = tabIds.join(',');
  useEffect(() => {
    if (!tabIds.includes(activeTab)) {
      setActiveTabState(tabIds[0]);
    }
  }, [tabIdsKey, activeTab, tabIds]);

  const visibleTabs = tabIds.map((id) => ({ id, ...TAB_CONFIG[id], label: t(TAB_CONFIG[id].labelKey) }));

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <RoleBasedDashboard onNavigateTab={setActiveTab} />;
      case 'reports':
        return <ReportsScreen />;
      case 'tasks':
        return user?.role === 'driver_truck' || user?.role === 'driver_machine' || user?.role === 'assistant_supervisor' || user?.role === 'head_supervisor' ? (
          <DriverTripsScreen />
        ) : (
          <RoleBasedDashboard onNavigateTab={setActiveTab} />
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
        return (
          <SurveysScreen
            initialOpenNewSurveyModal={openNewSurveyModalOnce}
            onClearOpenNewSurveyModal={() => setOpenNewSurveyModalOnce(false)}
          />
        );
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

  const tabCount = visibleTabs.length;
  const footerJustify = tabCount <= 3 ? 'center' : tabCount <= 5 ? 'space-evenly' : 'flex-start';
  const footerScrollable = tabCount >= 6;

  const bottomTabPadding = Math.max(theme.tabPaddingV, insets.bottom || 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }} edges={['left', 'right']}>
      <View style={{ flex: 1, minHeight: 0, paddingTop: topInset }}>
        {/* Compact top bar: Refresh + Language – minimal height, no dead space */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: theme.screenPadding,
            paddingVertical: 4,
            minHeight: 36,
            maxHeight: 36,
            backgroundColor: 'transparent',
          }}
        >
          <TouchableOpacity
            onPress={handleRefresh}
            disabled={refreshing || loading}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#e2e8f0' }}
          >
            {refreshing || loading ? (
              <ActivityIndicator size="small" color="#475569" />
            ) : (
              <RefreshCw size={18} color="#475569" />
            )}
            <Text style={{ color: '#475569', fontWeight: '500', fontSize: 11, marginLeft: 4 }}>
              {refreshing || loading ? t('common_loading') : t('common_refresh')}
            </Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              onPress={() => setNotificationsModalVisible(true)}
              style={{ position: 'relative', padding: 4 }}
              accessibilityLabel={t('settings_notifications')}
            >
              <Bell size={22} color="#475569" />
              {notifications.filter((n) => !n.read).length > 0 && (
                <View style={{ position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                    {notifications.filter((n) => !n.read).length > 99 ? '99+' : notifications.filter((n) => !n.read).length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={{ padding: 4 }} accessibilityLabel={t('settings_sign_out')}>
              <LogOut size={22} color="#475569" />
            </TouchableOpacity>
            <LanguageSwitcher />
          </View>
        </View>
        <View key={locale} style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
          {renderContent()}
        </View>
      </View>

      {/* Bottom Tab Bar – responsive padding for all Android/iOS device sizes */}
      <View style={{ backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: 'rgba(226,232,240,0.9)', paddingTop: theme.spacingSm, paddingBottom: bottomTabPadding, paddingHorizontal: theme.tabPaddingH }}>
        {footerScrollable ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingBottom: 0,
            }}
          >
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => { Haptics.selectionAsync(); setActiveTab(tab.id); }}
                  activeOpacity={0.75}
                  style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    minWidth: theme.tabItemMinWidth,
                    backgroundColor: isActive ? 'rgba(30, 64, 175, 0.08)' : 'transparent',
                    borderRadius: 12,
                  }}
                >
                  <Icon size={theme.tabIconSize} color={isActive ? '#1E40AF' : '#64748B'} strokeWidth={isActive ? 2.5 : 2} />
                  <Text style={{ fontSize: theme.tabLabelSize, marginTop: theme.spacingXs, fontWeight: '500', color: isActive ? '#1e3a8a' : '#475569' }}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: footerJustify,
              flexWrap: 'nowrap',
            }}
          >
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => { Haptics.selectionAsync(); setActiveTab(tab.id); }}
                  activeOpacity={0.75}
                  style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    minWidth: theme.tabItemMinWidth,
                    backgroundColor: isActive ? 'rgba(30, 64, 175, 0.08)' : 'transparent',
                    borderRadius: 12,
                  }}
                >
                  <Icon size={theme.tabIconSize} color={isActive ? '#1E40AF' : '#64748B'} strokeWidth={isActive ? 2.5 : 2} />
                  <Text style={{ fontSize: theme.tabLabelSize, marginTop: theme.spacingXs, fontWeight: '500', color: isActive ? '#1e3a8a' : '#475569' }}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <NotificationsModal
        visible={notificationsModalVisible}
        onClose={() => setNotificationsModalVisible(false)}
      />
    </SafeAreaView>
  );
}
