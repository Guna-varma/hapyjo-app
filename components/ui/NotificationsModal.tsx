import React from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { UnifiedModal } from '@/components/ui/UnifiedModal';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { modalStyles } from '@/components/ui/modalStyles';
import { colors, spacing } from '@/theme/tokens';
import type { Notification } from '@/types';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function NotificationsModal({ visible, onClose }: NotificationsModalProps) {
  const { t } = useLocale();
  const { notifications, markNotificationRead, clearAllNotifications } = useMockAppStore();

  const handleClearAll = () => {
    Alert.alert(
      t('settings_clear_notifications'),
      t('settings_clear_notifications_confirm'),
      [
        { text: t('common_cancel'), style: 'cancel' },
        { text: t('common_confirm'), style: 'destructive', onPress: () => clearAllNotifications() },
      ]
    );
  };

  const renderItem = (n: Notification) => (
    <TouchableOpacity
      key={n.id}
      onPress={() => markNotificationRead(n.id)}
      style={[styles.item, n.read && styles.itemRead]}
      activeOpacity={0.7}
    >
      <Text style={styles.itemTitle} numberOfLines={1}>
        {n.linkType === 'issue' ? t('notification_new_issue') : n.title}
      </Text>
      <Text style={styles.itemBody} numberOfLines={2}>
        {n.body}
      </Text>
    </TouchableOpacity>
  );

  return (
    <UnifiedModal
      visible={visible}
      onClose={onClose}
      title={t('settings_notifications')}
      variant="sheet"
      keyboardAvoiding={false}
      showCloseButton={true}
      footer={
        notifications.length > 0 ? (
          <TouchableOpacity
            onPress={handleClearAll}
            style={[modalStyles.btn, styles.clearBtn]}
            activeOpacity={0.8}
          >
            <Text style={styles.clearBtnText}>{t('settings_clear_notifications')}</Text>
          </TouchableOpacity>
        ) : undefined
      }
    >
      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t('settings_in_app_notifications')}</Text>
          <Text style={styles.emptySubtext}>{t('notifications_empty')}</Text>
        </View>
      ) : (
        <View style={styles.list}>{notifications.slice(0, 50).map(renderItem)}</View>
      )}
    </UnifiedModal>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingVertical: spacing.xs,
  },
  item: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemRead: {
    opacity: 0.7,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  itemBody: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  empty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptySubtext: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  clearBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
  },
  clearBtnText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
});
