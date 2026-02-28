import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';

/** Single skeleton line (bar) with shimmer. */
function SkeletonBar({ width = '100%', height = 12, style }: { width?: number | string; height?: number; style?: object }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[
        styles.bar,
        { width: typeof width === 'number' ? width : undefined, height },
        style,
        { opacity },
      ]}
    />
  );
}

/** Skeleton card mimicking a list item (e.g. vehicle/site row). */
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <SkeletonBar width={120} height={14} />
        <SkeletonBar width={60} height={10} style={styles.cardMeta} />
      </View>
      <View style={styles.cardRow}>
        <SkeletonBar width={80} height={10} />
        <SkeletonBar width={50} height={10} />
      </View>
    </View>
  );
}

/** List of skeleton cards for loading state. */
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.gray200,
    borderRadius: radius.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  cardMeta: {
    marginLeft: spacing.sm,
  },
  list: {
    paddingVertical: spacing.xs,
  },
});
