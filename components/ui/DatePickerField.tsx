import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Platform, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocale } from '@/context/LocaleContext';

const isWeb = Platform.OS === 'web';

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

/** 'short' = "Mar 4, 2026"; 'iso' = "2026-03-04" (YYYY-MM-DD only) */
export type DateDisplayFormat = 'short' | 'iso';

interface DatePickerFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  className?: string;
  /** Display format in the field: 'short' (default) or 'iso' (YYYY-MM-DD only). */
  displayFormat?: DateDisplayFormat;
  /** Inline validation error (e.g. "Dates must be in YYYY-MM-DD format only."). */
  error?: string;
}

function displayValue(value: string, format: DateDisplayFormat): string {
  if (!value || value.length < 10) return '';
  return format === 'iso' ? value.slice(0, 10) : formatDateLabel(value);
}

export function DatePickerField({
  value,
  onValueChange,
  label,
  placeholder,
  minimumDate,
  maximumDate,
  className = '',
  displayFormat = 'short',
  error,
}: DatePickerFieldProps) {
  const { t } = useLocale();
  const [show, setShow] = useState(false);
  const webInputRef = useRef<HTMLInputElement | null>(null);
  const placeholderText = placeholder ?? t('common_select_date');
  const currentDate = value ? parseDateToLocal(value) : new Date();
  const displayText = value ? displayValue(value, displayFormat) : '';

  const handleChange = (_: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (selectedDate != null) {
      onValueChange(toISODate(selectedDate));
    }
  };

  const handlePress = () => setShow(true);

  // Web: use native <input type="date"> so the browser date picker works
  if (isWeb) {
    return (
      <View className={className}>
        {label ? (
          <Text className="text-xs text-gray-500 mb-1">{label}</Text>
        ) : null}
        <View style={{ position: 'relative' as const }}>
          <TouchableOpacity
            onPress={() => webInputRef.current?.click()}
            className="border border-gray-300 rounded-lg px-3 py-2.5 bg-white"
            activeOpacity={0.7}
          >
            <Text className={value ? 'text-gray-900' : 'text-gray-500'}>
              {displayText || placeholderText}
            </Text>
          </TouchableOpacity>
          {error ? <Text style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{error}</Text> : null}
          {React.createElement('input', {
            ref: (el: HTMLInputElement | null) => {
              (webInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
            },
            type: 'date',
            value: value || '',
            onChange: (e: { target: { value: string } }) => onValueChange(e.target.value || ''),
            style: {
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer',
              fontSize: 16,
              zIndex: 1,
            },
          })}
        </View>
      </View>
    );
  }

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
          {displayText || placeholderText}
        </Text>
      </TouchableOpacity>
      {error ? <Text style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{error}</Text> : null}

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
                  <Text className="text-blue-600 font-semibold">{t('alert_done')}</Text>
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
        <Modal transparent visible={show} animationType="fade">
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShow(false)}
            style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}
          >
            <View style={{ backgroundColor: 'white', marginHorizontal: 24, borderRadius: 12, padding: 16, alignSelf: 'center' }}>
              <DateTimePicker
                value={currentDate}
                mode="date"
                display="spinner"
                onChange={handleChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
              />
              <TouchableOpacity onPress={() => setShow(false)} style={{ alignSelf: 'flex-end', marginTop: 8, paddingVertical: 4, paddingHorizontal: 12 }}>
                <Text className="text-blue-600 font-semibold">{t('alert_done')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      ) : null}
    </View>
  );
}
