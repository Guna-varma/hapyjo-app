import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { colors, form, dimensions, spacing } from '@/theme/tokens';

export interface SelectOption<T = string> {
  value: T;
  label: string;
}

interface SelectProps<T = string> {
  label?: string;
  placeholder?: string;
  options: SelectOption<T>[];
  value: T | '';
  onChange: (value: T) => void;
  /** Optional container style */
  containerStyle?: object;
}

/**
 * Dropdown select: tap to open a modal list, pick one option.
 * Styled to match Input (same height, border, label).
 */
export function Select<T extends string>({
  label,
  placeholder = 'Select…',
  options,
  value,
  onChange,
  containerStyle,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const selectedOption = value ? options.find((o) => o.value === value) : null;
  const displayText = selectedOption ? selectedOption.label : placeholder;

  const handleSelect = (option: SelectOption<T>) => {
    onChange(option.value);
    setOpen(false);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label != null && <Text style={styles.label}>{label}</Text>}
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.trigger}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${displayText}` : displayText}
        accessibilityState={{ expanded: open }}
      >
        <Text style={[styles.triggerText, !selectedOption && styles.placeholder]}>
          {displayText}
        </Text>
        <ChevronDown size={dimensions.iconSize} color={colors.textSecondary} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{label ?? placeholder}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => {
                const selected = item.value === value;
                return (
                  <Pressable
                    onPress={() => handleSelect(item)}
                    style={[styles.option, selected && styles.optionSelected]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selected && styles.optionTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: form.labelFontSize,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: form.inputRadius,
    backgroundColor: colors.surface,
    minHeight: form.inputMinHeight,
    maxHeight: form.inputMaxHeight,
    paddingHorizontal: form.inputPadding,
  },
  triggerText: {
    fontSize: form.inputFontSize,
    color: colors.text,
    flex: 1,
  },
  placeholder: {
    color: colors.placeholder,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  option: {
    paddingVertical: form.inputPadding,
    paddingHorizontal: form.inputPadding,
    borderRadius: form.inputRadius,
  },
  optionSelected: {
    backgroundColor: colors.blue50,
  },
  optionText: {
    fontSize: form.inputFontSize,
    color: colors.text,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
});
