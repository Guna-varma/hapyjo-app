import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal, Pressable, TextInput } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { getRoleDisplayLabel } from '@/lib/rbac';
import { DriverProfileScreen } from '@/components/screens/DriverProfileScreen';
import { supabase } from '@/lib/supabase';
import { User, Bell, Globe, LogOut, Lock, Eye, EyeOff } from 'lucide-react-native';

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const { t, locale, setLocale } = useLocale();
  const theme = useResponsiveTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    const pwd = newPassword.trim();
    const conf = confirmPassword.trim();
    if (pwd.length < 6) {
      Alert.alert(t('alert_invalid'), t('settings_password_invalid'));
      return;
    }
    if (pwd !== conf) {
      Alert.alert(t('alert_mismatch'), t('settings_password_mismatch'));
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      setPasswordModalVisible(false);
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert(t('alert_done_title'), t('settings_password_updated'));
    } catch (e) {
      Alert.alert(t('alert_error'), e instanceof Error ? e.message : t('settings_password_update_failed'));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('settings_confirm_logout'),
      t('settings_confirm_logout_message'),
      [
        { text: t('common_cancel'), style: 'cancel' },
        {
          text: t('settings_sign_out'),
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  const languageLabel = locale === 'en' ? t('settings_language_english') : t('settings_language_kinyarwanda');

  if (showEditProfile) {
    return <DriverProfileScreen onBack={() => setShowEditProfile(false)} />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      <Header title={t('settings_title')} subtitle={t('settings_subtitle')} />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding }}>
        <Card className="mb-4">
          <View className="items-center py-4">
            <View className="w-20 h-20 bg-blue-600 rounded-full items-center justify-center mb-3">
              <User size={40} color="#ffffff" />
            </View>
            <Text className="text-xl font-bold text-gray-900">{user?.name}</Text>
            <Text className="text-sm text-gray-600 mt-1">{user?.email}</Text>
            <View className="bg-blue-100 px-3 py-1 rounded-full mt-2">
              <Text className="text-xs font-semibold text-blue-800">
                {user?.role ? getRoleDisplayLabel(user.role) : ''}
              </Text>
            </View>
          </View>
        </Card>

        <View className="mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">{t('settings_preferences')}</Text>

          <Card className="mb-3">
            <TouchableOpacity onPress={() => setShowEditProfile(true)} className="flex-row items-center py-2">
              <View className="w-10 h-10 bg-blue-50 rounded-lg items-center justify-center mr-3">
                <User size={20} color="#3B82F6" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900">{t('settings_edit_profile')}</Text>
                <Text className="text-xs text-gray-600">
                  {user?.role === 'owner' ? t('settings_update_name_phone') : t('settings_update_phone_only')}
                </Text>
              </View>
            </TouchableOpacity>
          </Card>

          <Card className="mb-3">
            <TouchableOpacity
              className="flex-row items-center py-2"
              onPress={() => setNotificationsEnabled(!notificationsEnabled)}
            >
              <View className="w-10 h-10 bg-yellow-50 rounded-lg items-center justify-center mr-3">
                <Bell size={20} color="#F59E0B" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900">{t('settings_notifications')}</Text>
                <Text className="text-xs text-gray-600">
                  {notificationsEnabled ? t('settings_enabled') : t('settings_disabled')}
                </Text>
              </View>
            </TouchableOpacity>
          </Card>

          <Card className="mb-3">
            <TouchableOpacity
              className="flex-row items-center py-2"
              onPress={() => setLanguageModalVisible(true)}
            >
              <View className="w-10 h-10 bg-green-50 rounded-lg items-center justify-center mr-3">
                <Globe size={20} color="#10B981" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900">{t('settings_language')}</Text>
                <Text className="text-xs text-gray-600">{languageLabel}</Text>
              </View>
            </TouchableOpacity>
          </Card>

          <Card className="mb-3">
            <TouchableOpacity
              className="flex-row items-center py-2"
              onPress={() => setPasswordModalVisible(true)}
            >
              <View className="w-10 h-10 bg-slate-100 rounded-lg items-center justify-center mr-3">
                <Lock size={20} color="#475569" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900">{t('settings_change_password')}</Text>
                <Text className="text-xs text-gray-600">{t('settings_change_password_hint')}</Text>
              </View>
            </TouchableOpacity>
          </Card>
        </View>

        <View className="mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">{t('settings_about')}</Text>
          <Card>
            <View className="py-2">
              <View className="flex-row justify-between mb-2">
                <Text className="text-sm text-gray-600">{t('settings_version')}</Text>
                <Text className="text-sm font-semibold text-gray-900">1.0.0</Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-sm text-gray-600">{t('settings_company')}</Text>
                <Text className="text-sm font-semibold text-gray-900">HapyJo Ltd</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-gray-600">{t('settings_support')}</Text>
                <Text className="text-sm font-semibold text-blue-600">hapyjo.ltd1@gmail.com</Text>
              </View>
            </View>
          </Card>
        </View>

        <Button variant="danger" onPress={handleLogout} className="mb-6">
          <View className="flex-row items-center">
            <LogOut size={18} color="#ffffff" />
            <Text className="text-white font-semibold ml-2">{t('settings_sign_out')}</Text>
          </View>
        </Button>
      </ScrollView>

      <Modal visible={languageModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-center bg-black/50 px-4">
          <View className="bg-white rounded-2xl p-6">
            <Text className="text-lg font-bold mb-4">{t('settings_language')}</Text>
            <Pressable
              onPress={() => { setLocale('en'); setLanguageModalVisible(false); }}
              className={`py-3 px-4 rounded-lg mb-2 ${locale === 'en' ? 'bg-blue-600' : 'bg-gray-100'}`}
            >
              <Text className={locale === 'en' ? 'text-white font-semibold' : 'text-gray-800'}>{t('settings_language_english')}</Text>
            </Pressable>
            <Pressable
              onPress={() => { setLocale('rn'); setLanguageModalVisible(false); }}
              className={`py-3 px-4 rounded-lg ${locale === 'rn' ? 'bg-blue-600' : 'bg-gray-100'}`}
            >
              <Text className={locale === 'rn' ? 'text-white font-semibold' : 'text-gray-800'}>{t('settings_language_kinyarwanda')}</Text>
            </Pressable>
            <TouchableOpacity onPress={() => setLanguageModalVisible(false)} className="mt-4 py-2 items-center">
              <Text className="text-gray-600 font-medium">{t('common_cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={passwordModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-center bg-black/50 px-4">
          <View className="bg-white rounded-2xl p-6">
            <Text className="text-lg font-bold mb-2">{t('settings_change_password_modal_title')}</Text>
            <Text className="text-sm text-gray-600 mb-4">{t('settings_new_password_confirm_hint')}</Text>
            <Text className="text-sm text-gray-700 mb-1">{t('settings_new_password_required')}</Text>
            <View className="flex-row items-center border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white">
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={t('settings_new_password_placeholder')}
                secureTextEntry={!showNewPassword}
                className="flex-1 text-base text-gray-900"
              />
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                {showNewPassword ? <EyeOff size={20} color="#6B7280" /> : <Eye size={20} color="#6B7280" />}
              </TouchableOpacity>
            </View>
            <Text className="text-sm text-gray-700 mb-1">{t('settings_confirm_password_required')}</Text>
            <View className="flex-row items-center border border-gray-300 rounded-lg px-3 py-2 mb-4 bg-white">
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t('settings_confirm_password_placeholder')}
                secureTextEntry={!showConfirmPassword}
                className="flex-1 text-base text-gray-900"
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                {showConfirmPassword ? <EyeOff size={20} color="#6B7280" /> : <Eye size={20} color="#6B7280" />}
              </TouchableOpacity>
            </View>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => { setPasswordModalVisible(false); setNewPassword(''); setConfirmPassword(''); }}
                disabled={changingPassword}
                className="flex-1 py-3 rounded-lg bg-gray-200 items-center"
              >
                <Text className="font-semibold text-gray-700">{t('common_cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleChangePassword}
                disabled={changingPassword}
                className="flex-1 py-3 rounded-lg bg-blue-600 items-center"
              >
                <Text className="font-semibold text-white">{changingPassword ? t('settings_updating') : t('settings_update_password')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
