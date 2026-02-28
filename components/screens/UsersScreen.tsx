import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Pressable, Alert, Linking, Switch, Keyboard, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, RefreshControl } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Header } from '@/components/ui/Header';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/SkeletonLoader';
import { useAuth } from '@/context/AuthContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useToast } from '@/context/ToastContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { useLocale } from '@/context/LocaleContext';
import { canCreateUser, getRoleLabelKey, getAssignableRoles } from '@/lib/rbac';
import type { UserRole, User } from '@/types';
import { User as UserIcon, Mail, Phone, MapPin, Plus, Search, Copy, MessageCircle, Pencil, KeyRound } from 'lucide-react-native';
import { InfoButton } from '@/components/ui/InfoButton';
import { modalStyles } from '@/components/ui/modalStyles';
import { colors } from '@/theme/tokens';

const DOMAIN = 'hapyjo.com';

/** Generate slug from name: lowercase, no spaces, alphanumeric only. */
function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '') || 'user';
}

/** Next available email for this name given existing users: name@hapyjo.com, name2@..., name3@... */
function generateInternalEmail(name: string, existingEmails: string[]): string {
  const slug = nameToSlug(name);
  if (!slug) return `user1@${DOMAIN}`;
  const base = `${slug}@${DOMAIN}`;
  if (!existingEmails.includes(base)) return base;
  const used = existingEmails
    .map((e) => {
      const local = e.split('@')[0];
      if (local === slug) return 1;
      if (local.startsWith(slug) && /^\d+$/.test(local.slice(slug.length))) return parseInt(local.slice(slug.length), 10) || 1;
      return 0;
    })
    .filter((n) => n >= 1);
  const next = used.length === 0 ? 2 : Math.max(...used) + 1;
  return `${slug}${next}@${DOMAIN}`;
}

export function UsersScreen() {
  const { user: currentUser } = useAuth();
  const { t } = useLocale();
  const theme = useResponsiveTheme();
  const { users, updateUser, createUserByOwner, resetUserPassword, setSiteAssignment, sites, refetch, loading } = useMockAppStore();
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('assistant_supervisor');
  const [newPhone, setNewPhone] = useState('');
  const [newSiteId, setNewSiteId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState<{ email: string; password: string } | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [updateModalUser, setUpdateModalUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('assistant_supervisor');
  const [editSiteId, setEditSiteId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const existingEmails = useMemo(() => users.map((u) => u.email.toLowerCase()), [users]);
  const generatedEmail = useMemo(
    () => (newName.trim() ? generateInternalEmail(newName.trim(), existingEmails) : ''),
    [newName, existingEmails]
  );

  const assignableRoles = currentUser ? getAssignableRoles(currentUser.role) : [];

  /** Head supervisor sees only operational staff they can manage (and themselves). Owner/Admin see all. */
  const visibleUsers = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'head_supervisor') {
      const operationalRoles: UserRole[] = ['assistant_supervisor', 'surveyor', 'driver_truck', 'driver_machine'];
      return users.filter(
        (u) => u.id === currentUser.id || operationalRoles.includes(u.role)
      );
    }
    return users;
  }, [users, currentUser]);

  const filteredByStatus =
    userFilter === 'active'
      ? visibleUsers.filter((u) => u.active)
      : userFilter === 'inactive'
        ? visibleUsers.filter((u) => !u.active)
        : visibleUsers;
  const filteredUsers = filteredByStatus.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t(getRoleLabelKey(u.role)).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const getRoleBadgeVariant = (role: UserRole): 'success' | 'info' | 'warning' | 'default' => {
    const variants: Record<UserRole, 'success' | 'info' | 'warning' | 'default'> = {
      admin: 'success',
      owner: 'info',
      head_supervisor: 'info',
      accountant: 'default',
      assistant_supervisor: 'warning',
      surveyor: 'warning',
      driver_truck: 'warning',
      driver_machine: 'warning',
    };
    return variants[role] ?? 'default';
  };

  const handleToggleActive = (u: { id: string; active: boolean; name: string }) => {
    if (u.id === currentUser?.id) {
      Alert.alert(t('users_cannot_deactivate_self'), t('users_cannot_deactivate_self'));
      return;
    }
    const newActive = !u.active;
    Alert.alert(
      newActive ? t('users_alert_activate') : t('users_alert_deactivate'),
      newActive ? `${u.name} ${t('users_will_be_activated')}` : `${u.name} ${t('users_will_be_deactivated')}`,
      [
        { text: t('common_cancel'), style: 'cancel' },
        {
          text: newActive ? t('users_activate') : t('users_deactivate'),
          onPress: async () => {
            setTogglingId(u.id);
            try {
              await updateUser(u.id, { active: newActive });
            } catch {
              Alert.alert(t('alert_error'), t('users_update_failed'));
            } finally {
              setTogglingId(null);
            }
          },
        },
      ]
    );
  };

  const openUpdateModal = (u: User) => {
    setUpdateModalUser(u);
    setEditName(u.name);
    setEditPhone(u.phone ?? '');
    setEditRole(u.role);
    setEditSiteId(u.siteAccess?.[0] ?? null);
  };

  const handleUpdateUser = async () => {
    if (!updateModalUser) return;
    const name = editName.trim();
    if (!name) {
      Alert.alert(t('alert_required'), t('users_name_required_alert'));
      return;
    }
    setUpdating(true);
    const userId = updateModalUser.id;
    try {
      await updateUser(userId, { name, phone: editPhone.trim() || undefined, role: editRole });
      setUpdateModalUser(null);
      if (editSiteId && currentUser && getAssignableRoles(currentUser.role).includes(editRole)) {
        try {
          await setSiteAssignment(editSiteId, { userId, role: editRole, vehicleIds: [] });
        } catch {
          Alert.alert(t('alert_error'), t('users_site_assignment_failed'));
        }
      }
    } catch (e) {
      Alert.alert(t('alert_error'), e instanceof Error ? e.message : t('users_update_failed'));
    } finally {
      setUpdating(false);
    }
  };

  const handleCreateUser = async () => {
    const name = newName.trim();
    if (!name) {
      Alert.alert(t('alert_required'), t('users_name_required_alert'));
      return;
    }
    const email = generatedEmail;
    if (!email) {
      Alert.alert(t('alert_error'), t('users_email_generate_failed'));
      return;
    }
    if (users.some((u) => u.email.toLowerCase() === email)) {
      Alert.alert(t('users_duplicate_email'), t('users_duplicate_email'));
      return;
    }
    setCreating(true);
    try {
      const result = await createUserByOwner({
        email,
        name,
        phone: newPhone.trim() || undefined,
        role: newRole,
        site_id: newSiteId ?? undefined,
      });
      setCreateModalVisible(false);
      setNewName('');
      setNewRole('assistant_supervisor');
      setNewPhone('');
      setNewSiteId(null);
      setCredentialsModal({ email: result.email, password: result.temporary_password });
    } catch (e) {
      Alert.alert(t('alert_error'), e instanceof Error ? e.message : t('users_create_failed'));
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (u: { id: string; email: string }) => {
    if (u.id === currentUser?.id) {
      Alert.alert(t('alert_not_allowed'), t('users_reset_own_password_disallowed'));
      return;
    }
    Alert.alert(
      t('users_reset_password'),
      `${u.email}? ${t('users_reset_password_confirm')}`,
      [
        { text: t('common_cancel'), style: 'cancel' },
        {
          text: t('users_reset'),
          onPress: async () => {
            setResettingUserId(u.id);
            try {
              const result = await resetUserPassword(u.id);
              setCredentialsModal({
                email: result.email ?? u.email,
                password: result.temporary_password,
              });
            } catch (e) {
              Alert.alert(t('alert_error'), e instanceof Error ? e.message : t('users_reset_failed'));
            } finally {
              setResettingUserId(null);
            }
          },
        },
      ]
    );
  };

  const handleCopyCredentials = async () => {
    if (!credentialsModal) return;
    const text = `Your HapyJo login:\nEmail: ${credentialsModal.email}\nPassword: ${credentialsModal.password}\n\n${t('users_share_login_body')}`;
    await Clipboard.setStringAsync(text);
    Alert.alert(t('alert_copied'), t('users_copied'));
  };

  const handleShareWhatsApp = () => {
    if (!credentialsModal) return;
    const text = `Your HapyJo login:\nEmail: ${credentialsModal.email}\nPassword: ${credentialsModal.password}\n\n${t('users_share_login_body')}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    Linking.openURL(url);
  };

  return (
    <View className="flex-1 bg-gray-50">
      <Header
        title={t('users_title')}
        subtitle={t('users_subtitle')}
        rightAction={
          currentUser && canCreateUser(currentUser.role) ? (
            <TouchableOpacity
              onPress={() => {
                setNewRole(assignableRoles[0] ?? 'assistant_supervisor');
                setNewName('');
                setCreateModalVisible(true);
              }}
              className="bg-blue-600 rounded-lg px-4 py-2 flex-row items-center"
            >
              <Plus size={18} color="#ffffff" />
              <Text className="text-white font-semibold ml-1">{t('users_add_user')}</Text>
            </TouchableOpacity>
          ) : null
        }
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: theme.screenPadding, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => Keyboard.dismiss()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {loading ? (
          <SkeletonList count={5} />
        ) : (
          <>
            <View className="mb-4">
              <View className="bg-white rounded-lg border border-gray-300 flex-row items-center px-4 py-3">
                <Search size={20} color="#9CA3AF" />
                <TextInput
                  className="flex-1 ml-3 text-base text-gray-900"
                  placeholder={t('users_search_placeholder')}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <View className="flex-row mb-4 gap-3">
              <Pressable onPress={() => setUserFilter('active')} className="flex-1">
                <Card className={`flex-1 bg-blue-50 ${userFilter === 'active' ? 'border-2 border-blue-600' : ''}`}>
                  <View className="items-center py-2">
                    <Text className="text-2xl font-bold text-gray-900">{users.filter((u) => u.active).length}</Text>
                    <Text className="text-xs text-gray-600">{t('users_active_users')}</Text>
                  </View>
                </Card>
              </Pressable>
              <Pressable onPress={() => setUserFilter('inactive')} className="flex-1">
                <Card className={`flex-1 bg-gray-100 ${userFilter === 'inactive' ? 'border-2 border-gray-600' : ''}`}>
                  <View className="items-center py-2">
                    <Text className="text-2xl font-bold text-gray-900">{users.filter((u) => !u.active).length}</Text>
                    <Text className="text-xs text-gray-600">{t('users_inactive_users')}</Text>
                  </View>
                </Card>
              </Pressable>
              <Pressable onPress={() => setUserFilter('all')} className="flex-1">
                <Card className={`flex-1 bg-purple-50 ${userFilter === 'all' ? 'border-2 border-purple-600' : ''}`}>
                  <View className="items-center py-2">
                    <Text className="text-2xl font-bold text-gray-900">{users.length}</Text>
                    <Text className="text-xs text-gray-600">{t('users_total_users')}</Text>
                  </View>
                </Card>
              </Pressable>
            </View>

            <View className="mb-4">
              <Text className="text-lg font-bold text-gray-900 mb-3">{t('users_all_users')}</Text>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => (
                  <Card key={u.id} className="mb-3 overflow-hidden">
                    <View className="flex-row items-center border-b border-gray-100 pb-3 mb-3">
                      <View className="w-14 h-14 rounded-full bg-blue-100 items-center justify-center mr-4">
                        <Text className="text-lg font-bold text-blue-700">
                          {(u.name || 'U').trim().slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-base font-bold text-gray-900">{u.name}</Text>
                        <View className="flex-row items-center mt-1 gap-2 flex-wrap">
                          <Badge variant={getRoleBadgeVariant(u.role)} size="sm">
                            {t(getRoleLabelKey(u.role))}
                          </Badge>
                          <Badge variant={u.active ? 'success' : 'default'} size="sm">
                            {u.active ? t('common_active') : t('common_inactive')}
                          </Badge>
                        </View>
                      </View>
                      {currentUser && canCreateUser(currentUser.role) && u.id !== currentUser.id && (
                        <View className="items-end">
                          <Text className="text-xs text-gray-500 mb-1">{t('users_status')}</Text>
                          <Switch
                            value={u.active}
                            onValueChange={() => handleToggleActive({ ...u, name: u.name })}
                            disabled={togglingId === u.id}
                            trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                            thumbColor={u.active ? '#2563eb' : '#9ca3af'}
                          />
                        </View>
                      )}
                    </View>
                    <View className="gap-2 mb-3">
                      <View className="flex-row items-center">
                        <Mail size={16} color="#6B7280" />
                        <Text className="text-sm text-gray-700 ml-2 flex-1" selectable>{u.email}</Text>
                      </View>
                      {u.phone ? (
                        <View className="flex-row items-center">
                          <Phone size={16} color="#6B7280" />
                          <Text className="text-sm text-gray-700 ml-2">{u.phone}</Text>
                        </View>
                      ) : null}
                      {u.siteAccess && u.siteAccess.length > 0 && (
                        <View className="flex-row items-start">
                          <MapPin size={16} color="#6B7280" style={{ marginTop: 2 }} />
                          <View className="flex-1 ml-2">
                            <Text className="text-xs text-gray-500">{t('users_site_access')}</Text>
                            {u.siteAccess.slice(0, 3).map((siteId) => {
                              const site = sites.find((s) => s.id === siteId);
                              return (
                                <Text key={siteId} className="text-sm text-gray-800">
                                  • {site?.name ?? siteId}
                                </Text>
                              );
                            })}
                            {u.siteAccess.length > 3 && (
                              <Text className="text-sm text-gray-500">{t('users_more_sites').replace('{count}', String(u.siteAccess.length - 3))}</Text>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                    {currentUser && canCreateUser(currentUser.role) && u.id !== currentUser.id && (
                      <View className="flex-row gap-2 pt-2 border-t border-gray-100">
                        <TouchableOpacity
                          onPress={() => openUpdateModal(u)}
                          className="flex-1 flex-row items-center justify-center bg-blue-50 py-2.5 rounded-lg border border-blue-200"
                        >
                          <Pencil size={16} color="#2563eb" />
                          <Text className="text-blue-700 font-semibold ml-2">{t('users_update_user')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleResetPassword(u)}
                          disabled={resettingUserId === u.id}
                          className="flex-1 flex-row items-center justify-center bg-amber-50 py-2.5 rounded-lg border border-amber-200"
                        >
                          <KeyRound size={16} color="#b45309" />
                          <Text className="text-amber-800 font-semibold ml-2">
                            {resettingUserId === u.id ? t('users_resetting') : t('users_reset_password')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </Card>
                ))
              ) : (
                <EmptyState
                  icon={<UserIcon size={48} color="#9CA3AF" />}
                  title={t('users_no_users')}
                  message={t('users_try_search')}
                />
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Create user modal – keyboard does not close */}
      <Modal visible={createModalVisible} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={modalStyles.overlay}>
            <Pressable style={modalStyles.sheet} onPress={(e) => e.stopPropagation()}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ maxHeight: '100%' }}>
                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text className="text-lg font-bold mb-4">{t('users_create_user')}</Text>
              <View className="flex-row items-center mb-1">
                <Text className="text-sm text-gray-600">{t('users_name_required')}</Text>
                <InfoButton
                  title={t('users_modal_name_title')}
                  message={t('users_modal_name_message')}
                  size={16}
                />
              </View>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder={t('users_full_name_placeholder')}
                className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
              />
              <View className="mb-3">
                <Text className="text-sm text-gray-600 mb-1">{t('users_email_auto')}</Text>
                <Text className="text-base font-semibold text-gray-900 bg-gray-100 rounded-lg px-3 py-2">
                  {generatedEmail || '—'}
                </Text>
                <Text className="text-xs text-gray-500 mt-1">{t('users_internal_address_hint').replace('{domain}', DOMAIN)}</Text>
              </View>
              <Text className="text-sm text-gray-600 mb-1">{t('users_role')}</Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {assignableRoles.map((role) => (
                  <Pressable
                    key={role}
                    onPress={() => setNewRole(role)}
                    className={`px-3 py-2 rounded-lg ${newRole === role ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <Text className={newRole === role ? 'text-white font-medium' : 'text-gray-700'}>
                      {t(getRoleLabelKey(role))}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text className="text-sm text-gray-600 mb-1">{t('users_phone_optional')}</Text>
              <TextInput
                value={newPhone}
                onChangeText={setNewPhone}
                placeholder="+250 788 000 000"
                keyboardType="phone-pad"
                className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
              />
              <Text className="text-sm text-gray-600 mb-1">{t('users_assign_site')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setNewSiteId(null)}
                    className={`px-3 py-2 rounded-lg ${newSiteId === null ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <Text className={newSiteId === null ? 'text-white font-medium' : 'text-gray-700'}>{t('users_none')}</Text>
                  </Pressable>
                  {sites.map((site) => (
                    <Pressable
                      key={site.id}
                      onPress={() => setNewSiteId(site.id)}
                      className={`px-3 py-2 rounded-lg ${newSiteId === site.id ? 'bg-blue-600' : 'bg-gray-200'}`}
                    >
                      <Text className={newSiteId === site.id ? 'text-white font-medium' : 'text-gray-700'}>{site.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
                </ScrollView>
                <View style={modalStyles.footer}>
                  <TouchableOpacity onPress={() => setCreateModalVisible(false)} disabled={creating} style={[modalStyles.btn, modalStyles.btnSecondary]}>
                    <Text style={modalStyles.btnTextSecondary}>{t('common_cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleCreateUser} disabled={creating || !generatedEmail} style={[modalStyles.btn, { backgroundColor: '#2563eb' }]}>
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{creating ? t('users_creating') : t('users_create')}</Text>
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </Pressable>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Credentials modal – Copy & WhatsApp (after create or reset) */}
      <Modal visible={!!credentialsModal} transparent animationType="fade">
        <View className="flex-1 justify-center bg-black/50 px-4">
          <View className="bg-white rounded-2xl p-6">
            <Text className="text-lg font-bold mb-2">{t('users_share_login')}</Text>
            <Text className="text-sm text-gray-600 mb-4">{t('users_share_login_hint')}</Text>
            {credentialsModal && (
              <>
                <View className="bg-gray-50 rounded-lg p-4 mb-2">
                  <Text className="text-xs text-gray-500 mb-1">{t('users_email_label')}</Text>
                  <Text className="text-base font-semibold text-gray-900" selectable>{credentialsModal.email}</Text>
                </View>
                <View className="bg-gray-50 rounded-lg p-4 mb-4">
                  <Text className="text-xs text-gray-500 mb-1">{t('users_password_label')}</Text>
                  <Text className="text-base font-semibold text-gray-900" selectable>{credentialsModal.password}</Text>
                </View>
                <View className="flex-row gap-3 mb-3">
                  <TouchableOpacity onPress={handleCopyCredentials} className="flex-1 py-3 rounded-lg bg-slate-200 flex-row items-center justify-center">
                    <Copy size={20} color="#334155" />
                    <Text className="font-semibold text-slate-700 ml-2">{t('users_copy')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleShareWhatsApp} className="flex-1 py-3 rounded-lg bg-green-600 flex-row items-center justify-center">
                    <MessageCircle size={20} color="#fff" />
                    <Text className="font-semibold text-white ml-2">{t('users_whatsapp')}</Text>
                  </TouchableOpacity>
                </View>
                <Text className="text-xs text-gray-500 text-center mb-2">{t('users_change_password_after_hint')}</Text>
              </>
            )}
            <TouchableOpacity onPress={() => setCredentialsModal(null)} className="py-3 rounded-lg bg-blue-600 items-center">
              <Text className="font-semibold text-white">{t('users_done')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Update user modal */}
      <Modal visible={!!updateModalUser} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-2xl p-6 max-h-[85%]">
            <Text className="text-lg font-bold mb-4">{t('users_update_user')}</Text>
            <ScrollView>
              <Text className="text-sm text-gray-600 mb-1">{t('users_name_required')}</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder={t('users_full_name_short')}
                className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
              />
              <Text className="text-sm text-gray-600 mb-1">{t('users_phone_optional')}</Text>
              <TextInput
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="+250 788 000 000"
                keyboardType="phone-pad"
                className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
              />
              <Text className="text-sm text-gray-600 mb-1">{t('users_role')}</Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {currentUser && getAssignableRoles(currentUser.role).map((role) => (
                  <Pressable
                    key={role}
                    onPress={() => setEditRole(role)}
                    className={`px-3 py-2 rounded-lg ${editRole === role ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <Text className={editRole === role ? 'text-white font-medium' : 'text-gray-700'}>
                      {t(getRoleLabelKey(role))}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text className="text-sm text-gray-600 mb-1">{t('users_assign_site')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setEditSiteId(null)}
                    className={`px-3 py-2 rounded-lg ${editSiteId === null ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <Text className={editSiteId === null ? 'text-white font-medium' : 'text-gray-700'}>{t('users_none')}</Text>
                  </Pressable>
                  {sites.map((site) => (
                    <Pressable
                      key={site.id}
                      onPress={() => setEditSiteId(site.id)}
                      className={`px-3 py-2 rounded-lg ${editSiteId === site.id ? 'bg-blue-600' : 'bg-gray-200'}`}
                    >
                      <Text className={editSiteId === site.id ? 'text-white font-medium' : 'text-gray-700'}>{site.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </ScrollView>
            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                onPress={() => setUpdateModalUser(null)}
                disabled={updating}
                className="flex-1 py-3 rounded-lg bg-gray-200 items-center"
              >
                <Text className="font-semibold text-gray-700">{t('common_cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleUpdateUser}
                disabled={updating || !editName.trim()}
                className="flex-1 py-3 rounded-lg bg-blue-600 items-center"
              >
                <Text className="font-semibold text-white">{updating ? t('common_loading') : t('common_save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
