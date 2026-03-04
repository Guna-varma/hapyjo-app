import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Card } from '@/components/ui/Card';
import { colors, layout, spacing, typography } from '@/theme/tokens';

interface ListCardProps {
  title: string;
  subtitle?: string;
  meta?: string;
  /** Max lines for title (default 1). Use 2 for full names on small screens. */
  titleNumberOfLines?: number;
  /** Right slot: badge, chevron, or custom node */
  right?: React.ReactNode;
  /** Optional extra row below meta (e.g. health, ideal range) */
  footer?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

/**
 * Generic row card: title (bold), optional subtitle, optional meta line, optional right slot.
 * Uses Card + tokens. Min touch height for pressable.
 */
export function ListCard({
  title,
  subtitle,
  meta,
  titleNumberOfLines = 1,
  right,
  footer,
  onPress,
  style,
}: ListCardProps) {
  const content = (
    <>
      <View style={styles.row}>
        <View style={styles.main}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={titleNumberOfLines}>
              {title}
            </Text>
            {right != null && <View style={styles.right}>{right}</View>}
          </View>
          {subtitle != null && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
          {meta != null && (
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          )}
        </View>
      </View>
      {footer != null && <View style={styles.footer}>{footer}</View>}
    </>
  );

  if (onPress != null) {
    return (
      <Pressable onPress={onPress} style={[styles.wrapper, style]} accessibilityRole="button">
        <Card>{content}</Card>
      </Pressable>
    );
  }
  return (
    <View style={[styles.wrapper, style]}>
      <Card>{content}</Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.sm,
    minHeight: layout.minTouchHeight,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  right: {
    marginLeft: spacing.xs,
  },
  subtitle: {
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
    marginTop: 2,
  },
  meta: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    marginTop: 2,
  },
  footer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
