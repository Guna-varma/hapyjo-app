import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, layout, typography } from '@/theme/tokens';

type HeaderVariant = 'default' | 'dashboard';

interface HeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  /** 'dashboard' = lavish banner with more padding, hierarchy, and subtle background */
  variant?: HeaderVariant;
}

export function Header({ title, subtitle, leftAction, rightAction, variant = 'default' }: HeaderProps) {
  const isDashboard = variant === 'dashboard';
  if (isDashboard) {
    return (
      <View style={[styles.header, styles.headerDashboard]}>
        {leftAction ? <View style={styles.dashboardTopRow}>{leftAction}</View> : null}
        <View style={styles.dashboardRow}>
          <View style={styles.dashboardTitleWrap}>
            <Text style={[styles.title, styles.titleDashboard]}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, styles.subtitleDashboard]}>{subtitle}</Text> : null}
          </View>
          {rightAction ? <View style={styles.dashboardActionWrap}>{rightAction}</View> : null}
        </View>
        <View style={styles.dashboardAccent} />
      </View>
    );
  }
  return (
    <View style={styles.header}>
      <View style={styles.row}>
        {leftAction && <View style={styles.leftAction}>{leftAction}</View>}
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {rightAction && <View style={styles.rightAction}>{rightAction}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: layout.screenPaddingHorz,
    paddingVertical: layout.grid,
  },
  headerDashboard: {
    backgroundColor: colors.gray50,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomColor: colors.gray200,
  },
  dashboardTopRow: { marginBottom: 12 },
  dashboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dashboardTitleWrap: { flex: 1, minWidth: 0 },
  dashboardActionWrap: { flexShrink: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftAction: { marginRight: 12 },
  titleWrap: { flex: 1, minWidth: 0, justifyContent: 'center' },
  title: {
    fontSize: typography.h2.fontSize,
    fontWeight: '700',
    color: colors.text,
  },
  titleDashboard: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
    marginTop: 2,
  },
  subtitleDashboard: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
    opacity: 0.95,
  },
  rightAction: { marginLeft: 16, flexShrink: 0 },
  dashboardAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: colors.primary,
    opacity: 0.2,
  },
});
