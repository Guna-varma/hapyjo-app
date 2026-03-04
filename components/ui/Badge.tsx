import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default';
  size?: 'sm' | 'md';
}

/** Classic chip/badge: rounded corners, token-based colors. Use for status (e.g. approved, open, active). */
export function Badge({ children, variant = 'default', size = 'md' }: BadgeProps) {
  const variantStyles = getVariantStyles(variant);
  const paddingStyle = size === 'sm' ? styles.sizeSm : styles.sizeMd;
  const textSizeStyle = size === 'sm' ? styles.textSm : styles.textMd;
  return (
    <View style={[styles.chip, paddingStyle, variantStyles.container]}>
      <Text style={[textSizeStyle, variantStyles.text]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

function getVariantStyles(variant: BadgeProps['variant']) {
  switch (variant) {
    case 'success':
      return {
        container: { backgroundColor: colors.successBg },
        text: { color: colors.successText },
      };
    case 'warning':
      return {
        container: { backgroundColor: colors.warningBg },
        text: { color: colors.warningText },
      };
    case 'danger':
      return {
        container: { backgroundColor: colors.dangerBg },
        text: { color: colors.dangerText },
      };
    case 'info':
      return {
        container: { backgroundColor: colors.blue50 },
        text: { color: colors.primary },
      };
    default:
      return {
        container: { backgroundColor: colors.gray100 },
        text: { color: colors.gray700 },
      };
  }
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: radius.md,
  },
  sizeSm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  sizeMd: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  textSm: {
    fontSize: typography.caption.fontSize,
    fontWeight: '500',
  },
  textMd: {
    fontSize: typography.label.fontSize,
    fontWeight: '500',
  },
});
