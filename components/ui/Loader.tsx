import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '@/theme/tokens';

const DEFAULT_SIZE = 48;

export interface LoaderProps {
  /** Size in pixels (default 48). */
  size?: number;
  /** Optional style for the container. */
  style?: ViewStyle;
  /** Optional: use a different color (default: theme primary blue). */
  color?: string;
}

/**
 * Generic app loader: rotating circle with theme primary (blue).
 * Use when an interaction is taking time (e.g. save, submit, refetch).
 */
export function Loader({ size = DEFAULT_SIZE, style, color = colors.primary }: LoaderProps) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const borderWidth = Math.max(2, Math.round(size / 16));
  const half = size / 2;

  return (
    <View style={[styles.wrap, { width: size, height: size }, style]} accessibilityRole="progressbar">
      <Animated.View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: half,
            borderWidth,
            borderTopColor: color,
            borderRightColor: 'transparent',
            borderBottomColor: 'transparent',
            borderLeftColor: 'transparent',
            transform: [{ rotate }],
          },
        ]}
      />
    </View>
  );
}

/**
 * Full-screen overlay with centered loader. Use for screen-level loading (e.g. initial fetch).
 */
export function LoaderOverlay({ visible, ...loaderProps }: LoaderProps & { visible?: boolean }) {
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-only">
      <View style={styles.overlay}>
        <Loader size={48} {...loaderProps} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    position: 'absolute',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
