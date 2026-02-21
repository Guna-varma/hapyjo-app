import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Pressable, Alert, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Header } from '@/components/ui/Header';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { canCreateUser, getRoleDisplayLabel, getAssignableRoles } from '@/lib/rbac';
import type { UserRole } from '@/types';
import { User, Mail, Phone, MapPin, Plus, Search, Copy, MessageCircle } from 'lucide-react-native';

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
  const theme = useResponsiveTheme();
  const { users, updateUser, createUserByOwner, resetUserPassword, sites, loading } = useMockAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('assistant_supervisor');
  const [newPhone, setNewPhone] = useState('');
  const [newSiteId, setNewSiteId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState<{ email: string; password: string } | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);

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
  }, [users, currentUser?.id, currentUser?.role]);

  const filteredUsers = visibleUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getRoleDisplayLabel(u.role).toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const handleToggleActive = async (u: { id: string; active: boolean }) => {
    if (u.id === currentUser?.id) {
      Alert.alert('Cannot deactivate yourself', 'You cannot deactivate your own account.');
      return;
    }
    try {
      await updateUser(u.id, { active: !u.active });
    } catch {
      Alert.alert('Error', 'Failed to update user');
    }
  };

  const handleCreateUser = async () => {
    const name = newName.trim();
    if (!name) {
      Alert.alert('Required', 'Name is required.');
      return;
    }
    const email = generatedEmail;
    if (!email) {
      Alert.alert('Error', 'Could not generate email. Try a different name.');
      return;
    }
    if (users.some((u) => u.email.toLowerCase() === email)) {
      Alert.alert('Duplicate email', 'A user with this email already exists.');
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
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create user.');
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (u: { id: string; email: string }) => {
    if (u.id === currentUser?.id) {
      Alert.alert('Not allowed', 'Use Settings to change your own password.');
      return;
    }
    Alert.alert(
      'Reset password',
      `Generate a new temporary password for ${u.email}? They will need to be told the new password (e.g. via WhatsApp).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            setResettingUserId(u.id);
            try {
              const result = await resetUserPassword(u.id);
              setCredentialsModal({
                email: result.email ?? u.email,
                password: result.temporary_password,
              });
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to reset password.');
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
    const text = `HapyJo login\nEmail: ${credentialsModal.email}\nPassword: ${credentialsModal.password}`;
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Email and password copied to clipboard.');
  };

  const handleShareWhatsApp = () => {
    if (!credentialsModal) return;
    const text = `Your HapyJo login:\nEmail: ${credentialsModal.email}\nPassword: ${credentialsModal.password}\n\nYou can change your password in Settings after signing in.`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    Linking.openURL(url);
  };

  return (
    <View className="flex-1 bg-gray-50">
      <Header
        title="User Management"
        subtitle="Manage system users"
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
              <Text className="text-white font-semibold ml-1">Add user</Text>
            </TouchableOpacity>
          ) : null
        }
      />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding }}>
        {loading ? (
          <Card className="py-8">
            <Text className="text-center text-gray-600">Loading users...</Text>
          </Card>
        ) : (
          <>
            <View className="mb-4">
              <View className="bg-white rounded-lg border border-gray-300 flex-row items-center px-4 py-3">
                <Search size={20} color="#9CA3AF" />
                <TextInput
                  className="flex-1 ml-3 text-base text-gray-900"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <View className="flex-row mb-4 gap-3">
              <Card className="flex-1 bg-blue-50">
                <View className="items-center py-2">
                  <Text className="text-2xl font-bold text-gray-900">{users.filter((u) => u.active).length}</Text>
                  <Text className="text-xs text-gray-600">Active Users</Text>
                </View>
              </Card>
              <Card className="flex-1 bg-gray-100">
                <View className="items-center py-2">
                  <Text className="text-2xl font-bold text-gray-900">{users.filter((u) => !u.active).length}</Text>
                  <Text className="text-xs text-gray-600">Inactive Users</Text>
                </View>
              </Card>
              <Card className="flex-1 bg-purple-50">
                <View className="items-center py-2">
                  <Text className="text-2xl font-bold text-gray-900">{users.length}</Text>
                  <Text className="text-xs text-gray-600">Total Users</Text>
                </View>
              </Card>
            </View>

            <View className="mb-4">
              <Text className="text-lg font-bold text-gray-900 mb-3">All Users</Text>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => (
                  <Card key={u.id} className="mb-3">
                    <View className="flex-row items-start justify-between mb-3">
                      <View className="flex-row flex-1">
                        <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center mr-3">
                          <User size={24} color="#3B82F6" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-base font-bold text-gray-900">{u.name}</Text>
                          <View className="flex-row items-center mt-1 gap-2 flex-wrap">
                            <Badge variant={getRoleBadgeVariant(u.role)} size="sm">
                              {getRoleDisplayLabel(u.role)}
                            </Badge>
                            <Badge variant={u.active ? 'success' : 'default'} size="sm">
                              {u.active ? 'Active' : 'Inactive'}
                            </Badge>
                            {currentUser && canCreateUser(currentUser.role) && u.id !== currentUser.id && (
                              <>
                                <TouchableOpacity
                                  onPress={() => handleToggleActive(u)}
                                  className="bg-gray-200 px-2 py-1 rounded"
                                >
                                  <Text className="text-xs font-semibold text-gray-700">
                                    {u.active ? 'Deactivate' : 'Activate'}
                                  </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => handleResetPassword(u)}
                                  disabled={resettingUserId === u.id}
                                  className="bg-amber-100 px-2 py-1 rounded"
                                >
                                  <Text className="text-xs font-semibold text-amber-800">
                                    {resettingUserId === u.id ? 'Resetting…' : 'Reset password'}
                                  </Text>
                                </TouchableOpacity>
                              </>
                            )}
                          </View>
                        </View>
                      </View>
                    </View>
                    <View className="gap-1">
                      <View className="flex-row items-center">
                        <Mail size={14} color="#6B7280" />
                        <Text className="text-sm text-gray-600 ml-2">{u.email}</Text>
                      </View>
                      {u.phone && (
                        <View className="flex-row items-center">
                          <Phone size={14} color="#6B7280" />
                          <Text className="text-sm text-gray-600 ml-2">{u.phone}</Text>
                        </View>
                      )}
                      {u.siteAccess && u.siteAccess.length > 0 && (
                        <View className="flex-row items-start mt-2">
                          <MapPin size={14} color="#6B7280" style={{ marginTop: 2 }} />
                          <View className="flex-1 ml-2">
                            <Text className="text-xs text-gray-600">Site Access:</Text>
                            {u.siteAccess.slice(0, 3).map((siteId) => {
                              const site = sites.find((s) => s.id === siteId);
                              return (
                                <Text key={siteId} className="text-sm text-gray-900">
                                  • {site?.name ?? siteId}
                                </Text>
                              );
                            })}
                            {u.siteAccess.length > 3 && (
                              <Text className="text-sm text-gray-500">+{u.siteAccess.length - 3} more</Text>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  </Card>
                ))
              ) : (
                <EmptyState
                  icon={<User size={48} color="#9CA3AF" />}
                  title="No users found"
                  message="Try adjusting your search criteria"
                />
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Create user modal – internal email only */}
      <Modal visible={createModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-2xl p-6 max-h-[85%]">
            <ScrollView>
              <Text className="text-lg font-bold mb-4">Create user</Text>
              <Text className="text-sm text-gray-600 mb-1">Name</Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Full name (e.g. John Mugenzi)"
                className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
              />
              <View className="mb-3">
                <Text className="text-sm text-gray-600 mb-1">Email (auto-generated)</Text>
                <Text className="text-base font-semibold text-gray-900 bg-gray-100 rounded-lg px-3 py-2">
                  {generatedEmail || '—'}
                </Text>
                <Text className="text-xs text-gray-500 mt-1">Internal address @{DOMAIN}. Password will be generated.</Text>
              </View>
              <Text className="text-sm text-gray-600 mb-1">Role</Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {assignableRoles.map((role) => (
                  <Pressable
                    key={role}
                    onPress={() => setNewRole(role)}
                    className={`px-3 py-2 rounded-lg ${newRole === role ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <Text className={newRole === role ? 'text-white font-medium' : 'text-gray-700'}>
                      {getRoleDisplayLabel(role)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text className="text-sm text-gray-600 mb-1">Phone (optional)</Text>
              <TextInput
                value={newPhone}
                onChangeText={setNewPhone}
                placeholder="+250 788 000 000"
                keyboardType="phone-pad"
                className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white"
              />
              <Text className="text-sm text-gray-600 mb-1">Assign to site (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setNewSiteId(null)}
                    className={`px-3 py-2 rounded-lg ${newSiteId === null ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <Text className={newSiteId === null ? 'text-white font-medium' : 'text-gray-700'}>None</Text>
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
            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity onPress={() => setCreateModalVisible(false)} disabled={creating} className="flex-1 py-3 rounded-lg bg-gray-200 items-center">
                <Text className="font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreateUser} disabled={creating || !generatedEmail} className="flex-1 py-3 rounded-lg bg-blue-600 items-center">
                <Text className="font-semibold text-white">{creating ? 'Creating…' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Credentials modal – Copy & WhatsApp (after create or reset) */}
      <Modal visible={!!credentialsModal} transparent animationType="fade">
        <View className="flex-1 justify-center bg-black/50 px-4">
          <View className="bg-white rounded-2xl p-6">
            <Text className="text-lg font-bold mb-2">Share login details</Text>
            <Text className="text-sm text-gray-600 mb-4">Copy or send via WhatsApp so the user can sign in.</Text>
            {credentialsModal && (
              <>
                <View className="bg-gray-50 rounded-lg p-4 mb-2">
                  <Text className="text-xs text-gray-500 mb-1">Email</Text>
                  <Text className="text-base font-semibold text-gray-900" selectable>{credentialsModal.email}</Text>
                </View>
                <View className="bg-gray-50 rounded-lg p-4 mb-4">
                  <Text className="text-xs text-gray-500 mb-1">Password</Text>
                  <Text className="text-base font-semibold text-gray-900" selectable>{credentialsModal.password}</Text>
                </View>
                <View className="flex-row gap-3 mb-3">
                  <TouchableOpacity onPress={handleCopyCredentials} className="flex-1 py-3 rounded-lg bg-slate-200 flex-row items-center justify-center">
                    <Copy size={20} color="#334155" />
                    <Text className="font-semibold text-slate-700 ml-2">Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleShareWhatsApp} className="flex-1 py-3 rounded-lg bg-green-600 flex-row items-center justify-center">
                    <MessageCircle size={20} color="#fff" />
                    <Text className="font-semibold text-white ml-2">WhatsApp</Text>
                  </TouchableOpacity>
                </View>
                <Text className="text-xs text-gray-500 text-center mb-2">User can change password in Settings after first login.</Text>
              </>
            )}
            <TouchableOpacity onPress={() => setCredentialsModal(null)} className="py-3 rounded-lg bg-blue-600 items-center">
              <Text className="font-semibold text-white">Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
