import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, dimensions, radius, spacing, scrollConfig } from '@/theme/tokens';

export interface FilterChipOption<T = string> {
  value: T;
  label: string;
}

interface FilterChipsProps<T = string> {
  options: FilterChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** When true, chips scroll horizontally; otherwise wrap in a row. */
  scroll?: boolean;
}

/**
 * Single-select chips (e.g. site list). Same tokens; optional horizontal scroll.
 */
export function FilterChips<T = string>({
  options,
  value,
  onChange,
  scroll = true,
}: FilterChipsProps<T>) {
  const chips = options.map((opt) => {
    const selected = value === opt.value;
    return (
      <Pressable
        key={String(opt.value)}
        onPress={() => {
          Haptics.selectionAsync();
          onChange(opt.value);
        }}
        style={[styles.chip, selected && styles.chipSelected]}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={opt.label}
      >
        <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]} numberOfLines={1}>
          {opt.label}
        </Text>
      </Pressable>
    );
  });

  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        {...scrollConfig}
      >
        {chips}
      </ScrollView>
    );
  }
  return <View style={styles.wrap}>{chips}</View>;
}

const styles = StyleSheet.create({
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    minHeight: dimensions.minTouchHeight,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  chipLabelSelected: {
    color: colors.surface,
  },
});
