import React, { useRef } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FormScrollProvider, getKeyboardSafePaddingBottom } from '@/context/FormScrollContext';
import { colors, spacing } from '@/theme/tokens';

interface FormScreenLayoutProps {
  /** Fixed header (e.g. title + language switcher). */
  header: React.ReactNode;
  /** Form content – only this area scrolls. */
  children: React.ReactNode;
  /** Sticky footer (e.g. primary Save/Submit button). */
  footer: React.ReactNode;
  /** Optional padding around scroll content. */
  contentPadding?: number;
}

/**
 * Full-height form layout: fixed header, scrollable form area, sticky footer.
 * Provides FormScrollContext so inputs can trigger scroll-into-view on focus.
 * Keyboard-safe bottom padding and KeyboardAvoidingView for mobile.
 */
export function FormScreenLayout({
  header,
  children,
  footer,
  contentPadding = spacing.md,
}: FormScreenLayoutProps) {
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const paddingBottom = getKeyboardSafePaddingBottom(height);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        {header}
      </View>

      <FormScrollProvider scrollViewRef={scrollRef}>
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: contentPadding,
              paddingBottom: paddingBottom + insets.bottom,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          {children}
        </ScrollView>
      </FormScrollProvider>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(spacing.md, insets.bottom),
            paddingTop: spacing.sm,
          },
        ]}
      >
        {footer}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: spacing.md,
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
  },
});
