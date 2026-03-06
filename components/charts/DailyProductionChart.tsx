/**
 * Lightweight daily excavation production bar chart.
 * Uses approved surveys grouped by survey_date; no chart library dependency.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';

export interface DailyProductionEntry {
  date: string;
  volumeM3: number;
  label?: string;
}

export interface DailyProductionChartProps {
  data: DailyProductionEntry[];
  maxBars?: number;
  barColor?: string;
  formatDate?: (isoDate: string) => string;
  emptyMessage?: string;
  /** When set, each date row is pressable; called with ISO date (YYYY-MM-DD) to e.g. open Surveys filtered by that date */
  onPressDate?: (date: string) => void;
}

const defaultFormatDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export function DailyProductionChart({
  data,
  maxBars = 14,
  barColor = colors.primary,
  formatDate = defaultFormatDate,
  emptyMessage = 'No production data in this period',
  onPressDate,
}: DailyProductionChartProps) {
  const slice = data.slice(-maxBars);
  const maxVol = Math.max(1, ...slice.map((e) => e.volumeM3));

  if (slice.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  const rowContent = (entry: DailyProductionEntry, i: number) => (
    <>
      <Text style={styles.dateLabel} numberOfLines={1}>
        {formatDate(entry.date)}
      </Text>
      <View style={styles.barWrap}>
        <View
          style={[
            styles.bar,
            {
              width: `${(entry.volumeM3 / maxVol) * 100}%`,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>
      <Text style={styles.valueLabel}>{entry.volumeM3.toLocaleString('en-US', { maximumFractionDigits: 0 })} m³</Text>
    </>
  );

  return (
    <View style={styles.container}>
      {slice.map((entry, i) => (
        onPressDate ? (
          <Pressable
            key={entry.date + i}
            style={({ pressed }) => [styles.row, styles.rowPressable, pressed && styles.rowPressed]}
            onPress={() => onPressDate(entry.date)}
          >
            {rowContent(entry, i)}
          </Pressable>
        ) : (
          <View key={entry.date + i} style={styles.row}>
            {rowContent(entry, i)}
          </View>
        )
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  rowPressable: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginHorizontal: -4,
    borderRadius: radius.sm,
  },
  rowPressed: {
    backgroundColor: colors.gray100,
  },
  dateLabel: {
    width: 56,
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  barWrap: {
    flex: 1,
    height: 22,
    backgroundColor: colors.gray100,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: radius.md,
  },
  valueLabel: {
    width: 72,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
  },
  empty: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
