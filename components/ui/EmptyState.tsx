import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Smile } from 'lucide-react-native';
import { useResponsiveTheme } from '@/theme/responsive';
import { colors, spacing, typography } from '@/theme/tokens';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: string;
}

export function EmptyState({ icon, title, message }: EmptyStateProps) {
  const theme = useResponsiveTheme();
  const iconSize = theme.scaleMin(48);
  return (
    <View style={[styles.container, { padding: theme.spacingLg }]}>
      <View style={styles.inner}>
        {icon ?? <Smile size={iconSize} color={colors.textMuted} />}
        <Text style={styles.title}>{title}</Text>
        {message != null && <Text style={styles.message}>{message}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    alignItems: 'center',
  },
  title: {
    fontSize: typography.body.fontSize + 2,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  message: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
