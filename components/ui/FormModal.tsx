import React, { useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { FormScrollProvider, getKeyboardSafePaddingBottom } from '@/context/FormScrollContext';
import { modalStyles } from '@/components/ui/modalStyles';
import { colors, spacing, scrollConfig } from '@/theme/tokens';

interface FormModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Primary button (e.g. Save). onPrimary called when pressed. */
  primaryLabel: string;
  onPrimary: () => void | Promise<void>;
  /** Optional secondary (Cancel). If not provided, only primary is shown; close via overlay/back. */
  secondaryLabel?: string;
  /** When true, primary shows loading and is disabled. */
  submitting?: boolean;
  children: React.ReactNode;
}

/**
 * Modal with title, scrollable body, fixed footer (Cancel + Primary).
 * Single API for every create/edit flow. Uses modalStyles; Android-friendly keyboard behavior.
 */
export function FormModal({
  visible,
  onClose,
  title,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  submitting = false,
  children,
}: FormModalProps) {
  const scrollRef = useRef<ScrollView>(null);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxHeight = height * 0.85;
  const keyboardSafePaddingBottom = getKeyboardSafePaddingBottom(height);

  const handlePrimary = async () => {
    const result = onPrimary();
    if (result instanceof Promise) {
      await result;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={modalStyles.overlay}>
          <Pressable
            style={[styles.sheet, { height: maxHeight }]}
            onPress={(e) => e.stopPropagation()}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'android' ? 'height' : 'padding'}
              style={styles.keyboardView}
            >
              <Text style={modalStyles.title}>{title}</Text>
              <FormScrollProvider scrollViewRef={scrollRef}>
                <ScrollView
                  ref={scrollRef}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={true}
                  {...scrollConfig}
                  contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: keyboardSafePaddingBottom + insets.bottom },
                  ]}
                  style={styles.scrollView}
                >
                  {children}
                </ScrollView>
              </FormScrollProvider>
              <View style={[styles.footerSticky, { paddingBottom: Math.max(spacing.md, insets.bottom) }]}>
                {secondaryLabel != null && (
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      onClose();
                    }}
                    style={[modalStyles.btn, modalStyles.btnSecondary]}
                  >
                    <Text style={modalStyles.btnTextSecondary}>{secondaryLabel}</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={handlePrimary}
                  disabled={submitting}
                  style={[modalStyles.btn, styles.primaryBtn]}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={colors.surface} />
                  ) : (
                    <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
                  )}
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </Pressable>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    ...modalStyles.sheet,
  },
  keyboardView: {
    flex: 1,
    minHeight: 0,
  },
  scrollView: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  footerSticky: {
    ...modalStyles.footer,
    backgroundColor: colors.surface,
    paddingTop: spacing.sm,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    minHeight: 48,
  },
  primaryBtnText: {
    color: colors.surface,
    fontWeight: '600',
    fontSize: 16,
  },
});
