/**
 * Design tokens: colors, dimensions, radius, spacing, typography, layout.
 * Use these for consistent styling across the app.
 */

import { Platform } from 'react-native';

export const colors = {
  background: '#f8fafc',
  surface: '#ffffff',
  primary: '#2563eb',
  text: '#1e293b',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  placeholder: '#94a3b8',
  border: '#e2e8f0',
  gray50: '#f8fafc',
  gray100: '#f1f5f9',
  gray200: '#e2e8f0',
  gray400: '#94a3b8',
  gray500: '#64748b',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1e293b',
  blue50: '#eff6ff',
  blue600: '#2563eb',
  /** Form validation / destructive actions */
  error: '#dc2626',
  /** Status chips: success (e.g. approved), warning (e.g. pending) */
  successBg: '#dcfce7',
  successText: '#166534',
  warningBg: '#fef3c7',
  warningText: '#b45309',
  dangerBg: '#fee2e2',
  dangerText: '#b91c1c',
} as const;

export const dimensions = {
  iconSize: 20,
  iconSizeSm: 16,
  minTouchHeight: 48,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** 8px grid alignment */
export const layout = {
  screenPaddingHorz: 16,
  cardRadius: 12,
  cardPadding: 16,
  cardSpacingVertical: 16,
  grid: 8,
  minTouchHeight: 48,
} as const;

/** Form consistency: input radius 8px, padding 12px, label 14px, button height 48px. inputFontSize 16 prevents iOS zoom. */
export const form = {
  inputRadius: 8,
  inputPadding: 12,
  labelFontSize: 14,
  buttonHeight: 48,
  /** 48–52px for touch-friendly inputs */
  inputMinHeight: 48,
  inputMaxHeight: 52,
  /** 16px minimum prevents iOS zoom on focus */
  inputFontSize: 16,
} as const;

/**
 * Smooth scroll defaults for ScrollView across the app.
 * Use spread: <ScrollView {...scrollConfig} />
 */
export const scrollConfig = {
  scrollEventThrottle: 16,
  decelerationRate: 'normal' as const,
  ...(Platform.OS === 'ios'
    ? { bounces: true, directionalLockEnabled: true }
    : {}),
  ...(Platform.OS === 'android'
    ? { overScrollMode: 'always' as const, nestedScrollEnabled: true }
    : {}),
};

/** Uniform card shadow (boxShadow on web to avoid deprecated shadow* props). */
export const cardShadow = Platform.select({
  web: { boxShadow: '0 2px 4px rgba(0,0,0,0.08)' as const },
  default: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
})!;

export const typography = {
  body: { fontSize: 15 },
  h2: { fontSize: 20 },
  caption: { fontSize: 12 },
  label: { fontSize: 14 },
} as const;
