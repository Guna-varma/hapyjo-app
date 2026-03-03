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
} from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';

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
          <Pressable style={[styles.sheet, { maxHeight }]} onStartShouldSetResponder={() => true}>
            <KeyboardAvoidingView
              behavior="padding"
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
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                  >
                    {children}
                  </ScrollView>
                  {footer != null ? <View style={styles.footerWrap}>{footer}</View> : null}
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
    maxHeight: '100%',
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
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
