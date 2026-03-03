import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { Button } from '@/components/ui/Button';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { Eye, EyeOff } from 'lucide-react-native';
import { requestNotificationPermissionAsync } from '@/lib/registerPushToken';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  // Ask for notification permission so real system notifications work (Expo Go + real APK). Delay so Android activity is ready.
  useEffect(() => {
    const t = setTimeout(() => {
      requestNotificationPermissionAsync();
    }, 1500);
    return () => clearTimeout(t);
  }, []);
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const theme = useResponsiveTheme();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 28) : 0);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('alert_error'), t('login_enter_both'));
      return;
    }
    // Request notification permission on Login tap (user gesture helps on Android Expo Go)
    requestNotificationPermissionAsync();

    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('login_invalid_credentials');
      Alert.alert(t('login_failed_title'), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-50"
    >
      <View style={{ paddingTop: topInset, paddingHorizontal: theme.screenPadding, paddingBottom: theme.spacingSm, alignItems: 'flex-end' }}>
        <LanguageSwitcher />
      </View>
      <ScrollView
        contentContainerClassName="flex-grow justify-center"
        contentContainerStyle={{ padding: theme.screenPadding, paddingVertical: theme.spacingLg }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-8">
          <Image
            source={require('../../assets/images/hapyjo_playstore_icon_v2_512.png')}
            className="w-40 h-16 mb-4"
            resizeMode="contain"
          />
          <Text className="text-3xl font-bold text-gray-900">{t('login_company_name')}</Text>
          <Text className="text-base text-gray-600 mt-2">{t('login_tagline')}</Text>
        </View>

        <View className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <Text className="text-xl font-semibold text-gray-900 mb-6">{t('login_title')}</Text>

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">{t('login_email')} *</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white"
              placeholder={t('login_email_placeholder')}
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 mb-2">{t('login_password')} *</Text>
            <View className="flex-row items-center border border-gray-300 rounded-lg px-4 py-3 bg-white">
              <TextInput
                className="flex-1 text-base text-gray-900"
                placeholder={t('login_password_placeholder')}
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={22} color="#6B7280" /> : <Eye size={22} color="#6B7280" />}
              </TouchableOpacity>
            </View>
          </View>

          <Button onPress={handleLogin} loading={loading} className="mb-4">
            {t('login_title')}
          </Button>

          <View className="mt-6 p-4 bg-blue-50 rounded-lg">
            <Text className="text-xs font-semibold text-blue-900 mb-2">{t('login_internal_accounts')}</Text>
            <Text className="text-xs text-blue-800">{t('login_internal_hint')}</Text>
            <Text className="text-xs text-blue-700 mt-2 italic">{t('login_forgot_hint')}</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
