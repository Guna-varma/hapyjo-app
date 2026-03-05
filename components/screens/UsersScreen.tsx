import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Linking,
  Switch,
  Keyboard,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  Header,
  SegmentedControl,
  ListCard,
  FormModal,
  Input,
  FilterChips,
  EmptyState,
  ScreenContainer,
  SkeletonList,
  Badge,
  UnifiedModal,
} from '@/components/ui';
import { modalStyles } from '@/components/ui/modalStyles';
import { useAuth } from '@/context/AuthContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { useLocale } from '@/context/LocaleContext';
import { canCreateUser, getRoleLabelKey, getAssignableRoles } from '@/lib/rbac';
import type { UserRole, User } from '@/types';
import {
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  Plus,
  Copy,
  MessageCircle,
  Pencil,
  KeyRound,
} from 'lucide-react-native';
import { InfoButton } from '@/components/ui/InfoButton';
import { colors, layout, radius, spacing } from '@/theme/tokens';

const DOMAIN = 'hapyjo.com';

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '') || 'user';
}

function generateInternalEmail(name: string, existingEmails: string[]): string {
  const slug = nameToSlug(name);
  if (!slug) return `user1@${DOMAIN}`;
  const base = `${slug}@${DOMAIN}`;
  if (!existingEmails.includes(base)) return base;
  const used = existingEmails
    .map((e) => {
      const local = e.split('@')[0];
      if (local === slug) return 1;
      if (local.startsWith(slug) && /^\d+$/.test(local.slice(slug.length)))
        return parseInt(local.slice(slug.length), 10) || 1;
      return 0;
    })
    .filter((n) => n >= 1);
  const next = used.length === 0 ? 2 : Math.max(...used) + 1;
  return `${slug}${next}@${DOMAIN}`;
}

const USER_FILTER_OPTIONS = [
  { value: 'all' as const, labelKey: 'users_total_users' },
  { value: 'active' as const, labelKey: 'users_active_users' },
  { value: 'inactive' as const, labelKey: 'users_inactive_users' },
];

export function UsersScreen() {
  const { user: currentUser } = useAuth();
  const { t } = useLocale();
  const theme = useResponsiveTheme();
  const {
    users,
    updateUser,
    createUserByOwner,
    resetUserPassword,
    setSiteAssignment,
    sites,
    refetch,
    loading,
  } = useMockAppStore();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('assistant_supervisor');
  const [newPhone, setNewPhone] = useState('');
  const [newSiteId, setNewSiteId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [updateModalUser, setUpdateModalUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('assistant_supervisor');
  const [editSiteId, setEditSiteId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const existingEmails = useMemo(
    () => users.map((u) => u.email.toLowerCase()),
    [users]
  );
  const generatedEmail = useMemo(
    () =>
      newName.trim()
        ? generateInternalEmail(newName.trim(), existingEmails)
        : '',
    [newName, existingEmails]
  );

  const assignableRoles = currentUser ? getAssignableRoles(currentUser.role) : [];

  const visibleUsers = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'head_supervisor') {
      const operationalRoles: UserRole[] = [
        'assistant_supervisor',
        'surveyor',
        'driver_truck',
        'driver_machine',
      ];
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

  const userFilterOptions = useMemo(
    () =>
      USER_FILTER_OPTIONS.map((o) => ({
        value: o.value,
        label: t(o.labelKey),
      })),
    [t]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const getRoleBadgeVariant = (
    role: UserRole
  ): 'success' | 'info' | 'warning' | 'default' => {
    const variants: Record<
      UserRole,
      'success' | 'info' | 'warning' | 'default'
    > = {
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

  const handleToggleActive = (u: {
    id: string;
    active: boolean;
    name: string;
  }) => {
    if (u.id === currentUser?.id) {
      Alert.alert(
        t('users_cannot_deactivate_self'),
        t('users_cannot_deactivate_self')
      );
      return;
    }
    const newActive = !u.active;
    Alert.alert(
      newActive ? t('users_alert_activate') : t('users_alert_deactivate'),
      newActive
        ? `${u.name} ${t('users_will_be_activated')}`
        : `${u.name} ${t('users_will_be_deactivated')}`,
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
      await updateUser(userId, {
        name,
        phone: editPhone.trim() || undefined,
        role: editRole,
      });
      setUpdateModalUser(null);
      if (
        editSiteId &&
        currentUser &&
        getAssignableRoles(currentUser.role).includes(editRole)
      ) {
        try {
          await setSiteAssignment(editSiteId, {
            userId,
            role: editRole,
            vehicleIds: [],
          });
        } catch {
          Alert.alert(t('alert_error'), t('users_site_assignment_failed'));
        }
      }
    } catch (e) {
      Alert.alert(
        t('alert_error'),
        e instanceof Error ? e.message : t('users_update_failed')
      );
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
      setCredentialsModal({
        email: result.email,
        password: result.temporary_password,
      });
    } catch (e) {
      Alert.alert(
        t('alert_error'),
        e instanceof Error ? e.message : t('users_create_failed')
      );
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (u: { id: string; email: string }) => {
    if (u.id === currentUser?.id) {
      Alert.alert(
        t('alert_not_allowed'),
        t('users_reset_own_password_disallowed')
      );
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
              Alert.alert(
                t('alert_error'),
                e instanceof Error ? e.message : t('users_reset_failed')
              );
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

  const handleShareWhatsApp = async () => {
    if (!credentialsModal) return;
    const text = `Your HapyJo login:\nEmail: ${credentialsModal.email}\nPassword: ${credentialsModal.password}\n\n${t('users_share_login_body')}`;
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
    const webUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

    try {
      const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl);
      if (canOpenWhatsApp) {
        await Linking.openURL(whatsappUrl);
        return;
      }
      const canOpenWeb = await Linking.canOpenURL(webUrl);
      if (canOpenWeb) {
        await Linking.openURL(webUrl);
        return;
      }
      Alert.alert(t('alert_error'), t('users_whatsapp_not_available'));
    } catch {
      Alert.alert(t('alert_error'), t('users_whatsapp_not_available'));
    }
  };

  const roleOptions = assignableRoles.map((role) => ({
    value: role,
    label: t(getRoleLabelKey(role)),
  }));
  const siteOptionsForCreate = useMemo(
    () => [
      { value: '', label: t('users_none') },
      ...sites.map((s) => ({ value: s.id, label: s.name })),
    ],
    [sites, t]
  );
  const siteOptionsForEdit = useMemo(
    () => [
      { value: '', label: t('users_none') },
      ...sites.map((s) => ({ value: s.id, label: s.name })),
    ],
    [sites, t]
  );

  return (
    <View style={styles.screen}>
      <Header
        title={t('users_title')}
        subtitle={t('users_subtitle')}
        rightAction={
          currentUser && canCreateUser(currentUser.role) ? (
            <Pressable
              onPress={() => {
                setNewRole(assignableRoles[0] ?? 'assistant_supervisor');
                setNewName('');
                setCreateModalVisible(true);
              }}
              style={styles.addBtn}
            >
              <Plus size={18} color={colors.surface} />
              <Text style={styles.addBtnText}>{t('users_add_user')}</Text>
            </Pressable>
          ) : null
        }
      />

      <ScreenContainer
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={{ paddingBottom: theme.spacingXl, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => Keyboard.dismiss()}
      >
        {loading ? (
          <SkeletonList count={5} />
        ) : (
          <>
            <View style={styles.searchWrap}>
              <TextInput
                style={styles.searchInput}
                placeholder={t('users_search_placeholder')}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={colors.placeholder}
              />
            </View>

            <SegmentedControl
              options={userFilterOptions}
              value={userFilter}
              onChange={setUserFilter}
            />
            <View style={styles.statusRow} />

            <Text style={styles.sectionTitle}>{t('users_all_users')}</Text>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((u) => (
                <ListCard
                  key={u.id}
                  title={u.name}
                  titleNumberOfLines={2}
                  subtitle={u.email}
                  meta={
                    u.phone
                      ? u.phone
                      : u.siteAccess?.length
                        ? t('users_site_access') +
                          ': ' +
                          u.siteAccess
                            .slice(0, 2)
                            .map((sid) => sites.find((s) => s.id === sid)?.name ?? sid)
                            .join(', ') +
                          (u.siteAccess.length > 2
                            ? ` +${u.siteAccess.length - 2}`
                            : '')
                        : undefined
                  }
                  right={
                    <View style={styles.badgesRow}>
                      <Badge variant={getRoleBadgeVariant(u.role)} size="sm">
                        {t(getRoleLabelKey(u.role))}
                      </Badge>
                      <Badge variant={u.active ? 'success' : 'default'} size="sm">
                        {u.active ? t('common_active') : t('common_inactive')}
                      </Badge>
                      {currentUser &&
                        canCreateUser(currentUser.role) &&
                        u.id !== currentUser.id && (
                          <View>
                            <Text style={styles.switchLabel}>
                              {t('users_status')}
                            </Text>
                            <Switch
                              value={u.active}
                              onValueChange={() =>
                                handleToggleActive({ ...u, name: u.name })
                              }
                              disabled={togglingId === u.id}
                              trackColor={{
                                false: colors.gray200,
                                true: colors.blue50,
                              }}
                              thumbColor={
                                u.active ? colors.primary : colors.textMuted
                              }
                            />
                          </View>
                        )}
                    </View>
                  }
                  footer={
                    currentUser &&
                    canCreateUser(currentUser.role) &&
                    u.id !== currentUser.id ? (
                      <View style={styles.actionsRow}>
                        <Pressable
                          onPress={() => openUpdateModal(u)}
                          style={styles.updateBtn}
                        >
                          <Pencil size={16} color={colors.primary} />
                          <Text style={styles.updateBtnText}>
                            {t('users_update_user')}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleResetPassword(u)}
                          disabled={resettingUserId === u.id}
                          style={styles.resetBtn}
                        >
                          <KeyRound size={16} color={colors.gray700} />
                          <Text style={styles.resetBtnText}>
                            {resettingUserId === u.id
                              ? t('users_resetting')
                              : t('users_reset_password')}
                          </Text>
                        </Pressable>
                      </View>
                    ) : undefined
                  }
                />
              ))
            ) : (
              <EmptyState
                icon={<UserIcon size={48} color={colors.textMuted} />}
                title={t('users_no_users')}
                message={t('users_try_search')}
              />
            )}
          </>
        )}
      </ScreenContainer>

      <FormModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        title={t('users_create_user')}
        primaryLabel={creating ? t('users_creating') : t('users_create')}
        onPrimary={handleCreateUser}
        secondaryLabel={t('common_cancel')}
        submitting={creating}
      >
        <View style={styles.labelRow}>
          <Text style={modalStyles.label}>{t('users_name_required')}</Text>
          <InfoButton
            title={t('users_modal_name_title')}
            message={t('users_modal_name_message')}
            size={16}
          />
        </View>
        <Input
          value={newName}
          onChangeText={setNewName}
          placeholder={t('users_full_name_placeholder')}
        />
        <Text style={modalStyles.label}>{t('users_email_auto')}</Text>
        <View style={styles.readOnlyBox}>
          <Text style={styles.readOnlyText}>
            {generatedEmail || '—'}
          </Text>
        </View>
        <Text style={styles.hint}>
          {t('users_internal_address_hint').replace('{domain}', DOMAIN)}
        </Text>
        <Text style={modalStyles.label}>{t('users_role')}</Text>
        <FilterChips
          options={roleOptions}
          value={newRole}
          onChange={setNewRole}
          scroll={false}
        />
        <View style={styles.chipMargin} />
        <Input
          label={t('users_phone_optional')}
          value={newPhone}
          onChangeText={setNewPhone}
          placeholder="+250 788 000 000"
          keyboardType="phone-pad"
        />
        <Text style={modalStyles.label}>{t('users_assign_site')}</Text>
        <FilterChips
          options={siteOptionsForCreate}
          value={newSiteId ?? ''}
          onChange={(v) => setNewSiteId(v === '' ? null : v)}
          scroll={false}
        />
      </FormModal>

      <UnifiedModal
        visible={!!credentialsModal}
        onClose={() => setCredentialsModal(null)}
        title={t('users_share_login')}
        variant="center"
        showCloseButton={true}
        keyboardAvoiding={false}
        footer={null}
      >
        <Text style={styles.credentialsHint}>{t('users_share_login_hint')}</Text>
        {credentialsModal && (
          <>
            <View style={styles.credBox}>
              <Text style={styles.credLabel}>{t('users_email_label')}</Text>
              <Text style={styles.credValue} selectable>
                {credentialsModal.email}
              </Text>
            </View>
            <View style={styles.credBox}>
              <Text style={styles.credLabel}>{t('users_password_label')}</Text>
              <Text style={styles.credValue} selectable>
                {credentialsModal.password}
              </Text>
            </View>
            <View style={styles.credActions}>
              <Pressable
                onPress={handleCopyCredentials}
                style={styles.copyBtn}
              >
                <Copy size={20} color={colors.gray700} />
                <Text style={styles.copyBtnText}>{t('users_copy')}</Text>
              </Pressable>
              <Pressable
                onPress={handleShareWhatsApp}
                style={styles.whatsappBtn}
              >
                <MessageCircle size={20} color={colors.surface} />
                <Text style={styles.whatsappBtnText}>{t('users_whatsapp')}</Text>
              </Pressable>
            </View>
            <Text style={styles.changePasswordHint}>
              {t('users_change_password_after_hint')}
            </Text>
            <Pressable
              onPress={() => setCredentialsModal(null)}
              style={styles.doneBtn}
            >
              <Text style={styles.doneBtnText}>{t('users_done')}</Text>
            </Pressable>
          </>
        )}
      </UnifiedModal>

      <FormModal
        visible={!!updateModalUser}
        onClose={() => setUpdateModalUser(null)}
        title={t('users_update_user')}
        primaryLabel={t('common_save')}
        onPrimary={handleUpdateUser}
        secondaryLabel={t('common_cancel')}
        submitting={updating}
      >
        <Input
          label={t('users_name_required')}
          value={editName}
          onChangeText={setEditName}
          placeholder={t('users_full_name_short')}
        />
        <Input
          label={t('users_phone_optional')}
          value={editPhone}
          onChangeText={setEditPhone}
          placeholder="+250 788 000 000"
          keyboardType="phone-pad"
        />
        <Text style={modalStyles.label}>{t('users_role')}</Text>
        <FilterChips
          options={roleOptions}
          value={editRole}
          onChange={setEditRole}
          scroll={false}
        />
        <View style={styles.chipMargin} />
        <Text style={modalStyles.label}>{t('users_assign_site')}</Text>
        <FilterChips
          options={siteOptionsForEdit}
          value={editSiteId ?? ''}
          onChange={(v) => setEditSiteId(v === '' ? null : v)}
          scroll={false}
        />
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
  },
  addBtnText: {
    color: colors.surface,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  searchWrap: {
    marginBottom: spacing.md,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: layout.cardPadding,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    minHeight: layout.minTouchHeight,
  },
  statusRow: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  switchLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  updateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue50,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    minHeight: 44,
  },
  updateBtnText: {
    color: colors.primary,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  resetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray100,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    minHeight: 44,
  },
  resetBtnText: {
    color: colors.gray700,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readOnlyBox: {
    backgroundColor: colors.gray100,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  readOnlyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  chipMargin: { height: spacing.sm },
  credentialsHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  credBox: {
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  credLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  credValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  credActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  copyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.gray200,
    minHeight: 48,
  },
  copyBtnText: {
    fontWeight: '600',
    color: colors.gray700,
    marginLeft: spacing.sm,
  },
  whatsappBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    minHeight: 48,
  },
  whatsappBtnText: {
    fontWeight: '600',
    color: colors.surface,
    marginLeft: spacing.sm,
  },
  changePasswordHint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  doneBtn: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    minHeight: 48,
  },
  doneBtnText: {
    fontWeight: '600',
    color: colors.surface,
  },
});
