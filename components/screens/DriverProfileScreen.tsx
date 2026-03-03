import React, { useState } from 'react';
import { View, Text, TextInput, Keyboard, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { User, Mail, Phone } from 'lucide-react-native';
import { colors, dimensions, radius, spacing, typography } from '@/theme/tokens';
import { modalStyles } from '@/components/ui/modalStyles';

export function DriverProfileScreen({ onBack }: { onBack?: () => void }) {
  const { t } = useLocale();
  const { user: authUser, refreshUser } = useAuth();
  const theme = useResponsiveTheme();
  const { users, updateUser, refetch } = useMockAppStore();
  const storeUser = authUser ? users.find((u) => u.id === authUser.id) : null;
  const user = storeUser ?? authUser;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);

  const isOwner = user?.role === 'owner';
  const handleSave = async () => {
    if (!user) return;
    const trimmedPhone = phone.trim() || undefined;
    if (isOwner) {
      const trimmedName = name.trim();
      if (!trimmedName) return;
    }
    setSaving(true);
    try {
      const patch = isOwner ? { name: name.trim(), phone: trimmedPhone } : { phone: trimmedPhone };
      await updateUser(user.id, patch);
      await refetch();
      const updated = { ...user, ...patch };
      refreshUser(updated);
      setEditing(false);
    } catch {
      // Error already surfaced by store or caller
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <View style={driverProfileStyles.screen}>
      <Header
        title={t('profile_personal_info')}
        subtitle={t('profile_name_email_phone')}
        leftAction={
          onBack ? (
            <PressableScale onPress={onBack}>
              <Text style={driverProfileStyles.backText}>{t('common_back')}</Text>
            </PressableScale>
          ) : undefined
        }
      />
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: theme.screenPadding, paddingBottom: theme.spacingXl, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => Keyboard.dismiss()}
        showsVerticalScrollIndicator={false}
      >
        <Card style={driverProfileStyles.card}>
          <View style={driverProfileStyles.content}>
            <View style={driverProfileStyles.avatar}>
              <User size={dimensions.iconSize * 2} color={colors.primary} />
            </View>
            {!editing ? (
              <>
                <Text style={driverProfileStyles.name}>{user.name}</Text>
                <View style={driverProfileStyles.row}>
                  <Mail size={dimensions.iconSizeSm} color={colors.textMuted} />
                  <Text style={driverProfileStyles.mutedText}>{user.email}</Text>
                </View>
                {user.phone && (
                  <View style={[driverProfileStyles.row, { marginTop: spacing.xs }]}>
                    <Phone size={dimensions.iconSizeSm} color={colors.textMuted} />
                    <Text style={driverProfileStyles.mutedText}>{user.phone}</Text>
                  </View>
                )}
                <Button onPress={() => { setName(user.name); setPhone(user.phone ?? ''); setEditing(true); }} style={driverProfileStyles.editBtn}>
                  {t('profile_edit')}
                </Button>
              </>
            ) : (
              <>
                <Text style={modalStyles.label}>{isOwner ? t('profile_name_star') : t('profile_name')}</Text>
                <TextInput value={name} onChangeText={setName} editable={isOwner} placeholder={isOwner ? undefined : ''} placeholderTextColor={colors.placeholder} style={[modalStyles.input, !isOwner && driverProfileStyles.inputDisabled]} />
                <Text style={modalStyles.label}>{t('profile_email_readonly')}</Text>
                <TextInput value={user.email} editable={false} placeholderTextColor={colors.placeholder} style={[modalStyles.input, driverProfileStyles.inputDisabled]} />
                <Text style={modalStyles.label}>{t('profile_phone')}</Text>
                <TextInput value={phone} onChangeText={setPhone} placeholder="+250 788 000 000" keyboardType="phone-pad" placeholderTextColor={colors.placeholder} style={modalStyles.input} />
                <View style={modalStyles.footer}>
                  <Button variant="secondary" onPress={() => setEditing(false)} disabled={saving} style={modalStyles.btn}>
                    {t('common_cancel')}
                  </Button>
                  <Button onPress={handleSave} loading={saving} disabled={saving || (isOwner ? !name.trim() : false)} style={modalStyles.btn}>
                    {saving ? t('profile_saving') : t('profile_save')}
                  </Button>
                </View>
              </>
            )}
          </View>
        </Card>
      </KeyboardAwareScrollView>
    </View>
  );
}

const driverProfileStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  backText: { color: colors.primary, fontWeight: '600', fontSize: typography.body.fontSize },
  card: { marginBottom: spacing.lg },
  content: { alignItems: 'center', paddingVertical: spacing.lg },
  avatar: { width: 80, height: 80, borderRadius: radius.full, backgroundColor: colors.blue50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  name: { fontSize: typography.h2.fontSize, fontWeight: '600', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  mutedText: { fontSize: typography.body.fontSize, color: colors.textSecondary, marginLeft: spacing.sm },
  editBtn: { marginTop: spacing.lg },
  inputDisabled: { backgroundColor: colors.gray100 },
});
