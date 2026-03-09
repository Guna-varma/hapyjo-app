import React from 'react';
import {
  Modal,
  View,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, scrollConfig } from '@/theme/tokens';

interface ModalWithKeyboardProps {
  visible: boolean;
  onOverlayPress: () => void;
  submitting?: boolean;
  maxHeightRatio: number;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function ModalWithKeyboard({
  visible,
  onOverlayPress,
  submitting = false,
  maxHeightRatio,
  footer,
  children,
}: ModalWithKeyboardProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxHeight = height * maxHeightRatio;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onOverlayPress}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <Pressable style={styles.overlayPressable} onPress={Keyboard.dismiss} />
          <Pressable style={[styles.sheet, { height: maxHeight }]} onStartShouldSetResponder={() => true}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'android' ? 'height' : 'padding'}
              style={styles.keyboardView}
            >
              {submitting ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : (
                <>
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={styles.scrollContent}
                    style={styles.scrollView}
                    {...scrollConfig}
                  >
                    {children}
                  </ScrollView>
                  {footer != null ? (
                    <View style={[styles.footerWrap, { paddingBottom: Math.max(spacing.sm, insets.bottom) }]}>
                      {footer}
                    </View>
                  ) : null}
                </>
              )}
            </KeyboardAvoidingView>
          </Pressable>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  overlayPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing.xl,
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
    padding: spacing.lg,
    paddingBottom: spacing.xl * 1.5,
    flexGrow: 1,
  },
  loadingContainer: {
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
});
