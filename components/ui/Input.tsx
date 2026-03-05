import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, TextInputProps, StyleSheet, findNodeHandle, Platform } from 'react-native';
import { modalStyles } from '@/components/ui/modalStyles';
import { colors } from '@/theme/tokens';
import { useFormScroll } from '@/context/FormScrollContext';

export type EnterKeyHint = 'done' | 'go' | 'next' | 'search' | 'send';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  /** Optional container style (e.g. marginBottom) */
  containerStyle?: object;
  /** Hint for keyboard enter key (next/done). Improves mobile UX. */
  enterKeyHint?: EnterKeyHint;
  /** Optional right accessory (e.g. password visibility toggle). */
  rightElement?: React.ReactNode;
}

/**
 * Label + TextInput + optional error/hint. Production-ready: 48–52px height,
 * 16px font (prevents iOS zoom), focus state, scroll-into-view when inside FormScrollProvider.
 */
export function Input({
  label,
  error,
  hint,
  containerStyle,
  placeholderTextColor = colors.placeholder,
  onFocus,
  onBlur,
  enterKeyHint,
  rightElement,
  ...textInputProps
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<View>(null);
  const formScroll = useFormScroll();

  const handleFocus = useCallback(
    (e: any) => {
      setFocused(true);
      onFocus?.(e);

      // Skip scroll-into-view on Android to avoid measureLayout/findNodeHandle crashes in modals (e.g. Create Site).
      if (Platform.OS === 'android') return;

      if (formScroll?.scrollViewRef?.current && containerRef.current) {
        try {
          const scrollRef = formScroll.scrollViewRef.current as any;
          const nativeScrollNode =
            typeof findNodeHandle === 'function' ? findNodeHandle(scrollRef) : null;
          if (nativeScrollNode != null) {
            (containerRef.current as any).measureLayout(
              nativeScrollNode,
              (_x: number, y: number, _w: number, h: number) => {
                formScroll.scrollToFocusedInput(y, h);
              },
              () => {}
            );
          } else {
            (containerRef.current as any).measureLayout(
              scrollRef,
              (_x: number, y: number, _w: number, h: number) => {
                formScroll.scrollToFocusedInput(y, h);
              },
              () => {}
            );
          }
        } catch (_) {
          // Ignore measure/scroll errors (e.g. unmounted or native ref not ready).
        }
      }
    },
    [onFocus, formScroll]
  );

  const handleBlur = useCallback(
    (e: any) => {
      setFocused(false);
      onBlur?.(e);
    },
    [onBlur]
  );

  const inputStyle = [
    modalStyles.input,
    error != null && styles.inputError,
    focused && modalStyles.inputFocused,
  ];

  const wrapperStyle =
    rightElement != null
      ? [
          styles.inputRowWrapper,
          focused && modalStyles.inputFocused,
          error != null && styles.inputError,
        ]
      : undefined;

  return (
    <View
      ref={containerRef}
      style={[styles.container, containerStyle]}
      collapsable={false}
    >
      {label != null && <Text style={modalStyles.label}>{label}</Text>}
      {rightElement != null ? (
        <View style={wrapperStyle}>
          <TextInput
            placeholderTextColor={placeholderTextColor}
            style={[modalStyles.input, styles.inputFlex]}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...(enterKeyHint != null ? { enterKeyHint } : {})}
            {...textInputProps}
          />
          <View style={styles.rightElement}>{rightElement}</View>
        </View>
      ) : (
        <TextInput
          placeholderTextColor={placeholderTextColor}
          style={inputStyle}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...(enterKeyHint != null ? { enterKeyHint } : {})}
          {...textInputProps}
        />
      )}
      {error != null && <Text style={styles.error}>{error}</Text>}
      {hint != null && error == null && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  inputRowWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    minHeight: 48,
    maxHeight: 52,
  },
  inputFlex: {
    flex: 1,
    borderWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: 'transparent',
  },
  rightElement: {
    paddingRight: 12,
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
});
