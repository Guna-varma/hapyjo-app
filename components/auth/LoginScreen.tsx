import React, { useState, useEffect } from 'react';
import { View, Text, Image, Alert, TouchableOpacity } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { FormScreenLayout } from '@/components/ui/FormScreenLayout';
import { Input } from '@/components/ui/Input';
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

  useEffect(() => {
    const id = setTimeout(() => {
      requestNotificationPermissionAsync();
    }, 1500);
    return () => clearTimeout(id);
  }, []);

  const { t } = useLocale();
  const theme = useResponsiveTheme();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('alert_error'), t('login_enter_both'));
      return;
    }
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
    <FormScreenLayout
      header={<LanguageSwitcher />}
      footer={
        <Button onPress={handleLogin} loading={loading} className="w-full" style={{ minHeight: 48 }}>
          {t('login_title')}
        </Button>
      }
      contentPadding={theme.screenPadding}
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

        <Input
          label={`${t('login_email')} *`}
          placeholder={t('login_email_placeholder')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          enterKeyHint="next"
        />

        <Input
          label={`${t('login_password')} *`}
          placeholder={t('login_password_placeholder')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          enterKeyHint="done"
          rightElement={
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              {showPassword ? <EyeOff size={22} color="#6B7280" /> : <Eye size={22} color="#6B7280" />}
            </TouchableOpacity>
          }
        />

        <View className="mt-6 p-4 bg-blue-50 rounded-lg">
          <Text className="text-xs font-semibold text-blue-900 mb-2">{t('login_internal_accounts')}</Text>
          <Text className="text-xs text-blue-800">{t('login_internal_hint')}</Text>
          <Text className="text-xs text-blue-700 mt-2 italic">{t('login_forgot_hint')}</Text>
        </View>
      </View>
    </FormScreenLayout>
  );
}
