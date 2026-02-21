import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

/** Format YYYY-MM-DD for display (e.g. "21 Feb 2025") */
export function formatDateLabel(isoDate: string): string {
  if (!isoDate || isoDate.length < 10) return '';
  const d = new Date(isoDate + 'T12:00:00');
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Parse YYYY-MM-DD to Date at noon to avoid timezone shifts */
export function parseDateToLocal(isoDate: string): Date {
  if (!isoDate || isoDate.length < 10) return new Date();
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Date to YYYY-MM-DD */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface DatePickerFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  className?: string;
}

export function DatePickerField({
  value,
  onValueChange,
  label,
  placeholder = 'Select date',
  minimumDate,
  maximumDate,
  className = '',
}: DatePickerFieldProps) {
  const [show, setShow] = useState(false);
  const currentDate = value ? parseDateToLocal(value) : new Date();

  const handleChange = (_: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (selectedDate != null) {
      onValueChange(toISODate(selectedDate));
    }
  };

  const handlePress = () => setShow(true);

  return (
    <View>
      {label ? (
        <Text className="text-xs text-gray-500 mb-1">{label}</Text>
      ) : null}
      <TouchableOpacity
        onPress={handlePress}
        className={`border border-gray-300 rounded-lg px-3 py-2.5 bg-white ${className}`}
        activeOpacity={0.7}
      >
        <Text className={value ? 'text-gray-900' : 'text-gray-500'}>
          {value ? formatDateLabel(value) : placeholder}
        </Text>
      </TouchableOpacity>

      {show && Platform.OS === 'ios' ? (
        <Modal transparent animationType="slide">
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShow(false)}
            className="flex-1 justify-end bg-black/40"
          >
            <View className="bg-white rounded-t-2xl p-4">
              <View className="flex-row justify-end mb-2">
                <TouchableOpacity onPress={() => setShow(false)} className="px-4 py-2">
                  <Text className="text-blue-600 font-semibold">Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={currentDate}
                mode="date"
                display="spinner"
                onChange={handleChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      ) : null}

      {show && Platform.OS === 'android' ? (
        <DateTimePicker
          value={currentDate}
          mode="date"
          display="default"
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      ) : null}
    </View>
  );
}
