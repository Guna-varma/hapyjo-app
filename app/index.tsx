import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, useWindowDimensions } from 'react-native';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { MockAppStoreProvider } from '@/context/MockAppStoreContext';
import { ToastProvider } from '@/context/ToastContext';
import { LocaleProvider , useLocale } from '@/context/LocaleContext';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { AppNavigation } from '@/components/navigation/AppNavigation';
import { PushTokenRegistration } from '@/components/PushTokenRegistration';
import { DemoNotificationScheduler } from '@/components/DemoNotificationScheduler';
import { requestNotificationPermissionAsync } from '@/lib/registerPushToken';
import '../global.css';

/** Asks for notification permission when on login screen so Android Expo Go and APK show the system prompt. */
function RequestNotificationPermissionOnLoginScreen() {
  const requested = useRef(false);
  const { isAuthenticated, authLoading } = useAuth();
  useEffect(() => {
    if (authLoading || isAuthenticated || requested.current) return;
    const t = setTimeout(() => {
      requestNotificationPermissionAsync();
      requested.current = true;
    }, 2500);
    return () => clearTimeout(t);
  }, [isAuthenticated, authLoading]);
  return null;
}

/** Asks for notification permission for ALL user types when they are logged in, so system notifications show in the tray. */
function RequestNotificationPermissionWhenAuthenticated() {
  const requested = useRef(false);
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    if (!isAuthenticated || requested.current) return;
    requested.current = true;
    const t = setTimeout(() => {
      requestNotificationPermissionAsync();
    }, 500);
    return () => clearTimeout(t);
  }, [isAuthenticated]);
  return null;
}

function AppContent() {
  const { isAuthenticated, authLoading } = useAuth();
  const { t } = useLocale();
  const { width } = useWindowDimensions();
  const fontSize = Math.max(14, Math.min(18, width * 0.045));

  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', padding: Math.max(16, width * 0.05) }}>
        <ActivityIndicator size="large" color="#1e40af" />
        <Text style={{ marginTop: 12, fontSize, color: '#475569' }}>{t('common_loading')}</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <RequestNotificationPermissionOnLoginScreen />
        <LoginScreen />
      </>
    );
  }

  return (
    <>
      <RequestNotificationPermissionWhenAuthenticated />
      <PushTokenRegistration />
      <DemoNotificationScheduler />
      <AppNavigation />
    </>
  );
}

export default function HomeScreen() {
  return (
    <AuthProvider>
      <LocaleProvider>
        <MockAppStoreProvider>
          <ToastProvider>
            <View style={{ flex: 1 }}>
              <AppContent />
            </View>
          </ToastProvider>
        </MockAppStoreProvider>
      </LocaleProvider>
    </AuthProvider>
  );
}
