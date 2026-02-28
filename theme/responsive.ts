import { useWindowDimensions, ScaledSize } from 'react-native';
import { useMemo } from 'react';

/** Base width for scaling (typical phone). Smaller phones scale down, larger scale up slightly. */
const BASE_WIDTH = 375;
const MIN_SCALE = 0.85;
const MAX_SCALE = 1.15;

/**
 * Scale a number by screen width so UI stays proportional on all phone sizes.
 * Use for spacing, font sizes, icon sizes, and fixed dimensions.
 */
export function scaleByWidth(value: number, dimensions: { width: number }): number {
  const scale = Math.min(Math.max(dimensions.width / BASE_WIDTH, MIN_SCALE), MAX_SCALE);
  return Math.round(value * scale);
}

/**
 * Scale by the smaller dimension (useful for squares or when height matters).
 */
export function scaleByMinDimension(value: number, dimensions: ScaledSize): number {
  const min = Math.min(dimensions.width, dimensions.height);
  const scale = Math.min(Math.max(min / BASE_WIDTH, MIN_SCALE), MAX_SCALE);
  return Math.round(value * scale);
}

export interface ResponsiveTheme {
  /** Screen dimensions */
  width: number;
  height: number;
  /** Scale a value by width (spacing, fonts, icons) */
  scale: (value: number) => number;
  /** Scale by smaller dimension (e.g. thumbnails) */
  scaleMin: (value: number) => number;
  /** Responsive horizontal padding for screen content (same on all screens) */
  screenPadding: number;
  /** Safe for small phones: use for modal max height as fraction of screen */
  modalMaxHeightRatio: number;
  /** Tab bar: icon size, label font size, padding */
  tabIconSize: number;
  tabLabelSize: number;
  tabPaddingH: number;
  tabPaddingV: number;
  tabItemMinWidth: number;
  /** Typography: base sizes that scale */
  fontSizeBase: number;
  fontSizeTitle: number;
  fontSizeCaption: number;
  /** Spacing */
  spacingXs: number;
  spacingSm: number;
  spacingMd: number;
  spacingLg: number;
  spacingXl: number;
}

export function useResponsiveTheme(): ResponsiveTheme {
  const dimensions = useWindowDimensions();
  return useMemo(() => {
    const scale = (v: number) => scaleByWidth(v, dimensions);
    const scaleMin = (v: number) => scaleByMinDimension(v, dimensions);
    const isNarrow = dimensions.width < 360;
    const isShort = dimensions.height < 600;
    return {
      width: dimensions.width,
      height: dimensions.height,
      scale,
      scaleMin,
      screenPadding: 16,
      modalMaxHeightRatio: dimensions.height < 600 ? 0.88 : 0.85,
      tabIconSize: scale(22),
      tabLabelSize: scale(11),
      tabPaddingH: scale(8),
      tabPaddingV: isShort ? scale(8) : scale(10),
      tabItemMinWidth: isNarrow ? 64 : 72,
      fontSizeBase: scale(16),
      fontSizeTitle: scale(22),
      fontSizeCaption: scale(12),
      spacingXs: scale(4),
      spacingSm: scale(8),
      spacingMd: scale(16),
      spacingLg: scale(24),
      spacingXl: scale(32),
    };
  }, [dimensions]);
}
