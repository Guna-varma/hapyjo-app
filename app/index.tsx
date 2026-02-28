import React from 'react';
import { View, Text, ActivityIndicator, useWindowDimensions } from 'react-native';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { MockAppStoreProvider } from '@/context/MockAppStoreContext';
import { ToastProvider } from '@/context/ToastContext';
import { LocaleProvider , useLocale } from '@/context/LocaleContext';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { AppNavigation } from '@/components/navigation/AppNavigation';
import '../global.css';

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
    return <LoginScreen />;
  }

  return <AppNavigation />;
}

export default function HomeScreen() {
  return (
    <AuthProvider>
      <LocaleProvider>
        <MockAppStoreProvider>
          <ToastProvider>
            <View className="flex-1">
              <AppContent />
            </View>
          </ToastProvider>
        </MockAppStoreProvider>
      </LocaleProvider>
    </AuthProvider>
  );
}
