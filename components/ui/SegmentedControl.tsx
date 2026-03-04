import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, dimensions, radius, spacing } from '@/theme/tokens';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * Single-select horizontal segments (e.g. All / Trucks / Machines).
 * Uses tokens for min touch height, radius, and colors.
 */
export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.container}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(opt.value);
            }}
            style={[styles.segment, selected && styles.segmentSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
          >
            <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: dimensions.minTouchHeight,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
    paddingHorizontal: spacing.sm,
  },
  segmentSelected: {
    backgroundColor: colors.blue50,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  labelSelected: {
    color: colors.primary,
  },
});
