import React from 'react';
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
} from 'react-native';
import { modalStyles } from '@/components/ui/modalStyles';
import { colors, spacing } from '@/theme/tokens';
import { X } from 'lucide-react-native';

export type UnifiedModalVariant = 'sheet' | 'center';

interface UnifiedModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  variant?: UnifiedModalVariant;
  /** When true, modal content is wrapped in KeyboardAvoidingView and taps outside don't close (keyboard stays). */
  keyboardAvoiding?: boolean;
  /** Show a close (X) button at top right. */
  showCloseButton?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Single unified modal for the app: same overlay, sheet/center layout, and behavior.
 * Use for all dialogs so they open and look the same.
 */
export function UnifiedModal({
  visible,
  onClose,
  title,
  variant = 'sheet',
  keyboardAvoiding = true,
  showCloseButton = true,
  footer,
  children,
}: UnifiedModalProps) {
  const { height } = useWindowDimensions();
  const maxHeight = height * 0.85;

  const content = (
    <>
      {(title != null || showCloseButton) && (
        <View style={styles.headerRow}>
          {title != null && (
            <View style={styles.titleWrap}>
              <Text style={modalStyles.title}>{title}</Text>
            </View>
          )}
          {showCloseButton && (
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={12}
              accessibilityLabel="Close"
            >
              <X size={22} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      )}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {children}
      </ScrollView>
      {footer != null && <View style={modalStyles.footer}>{footer}</View>}
    </>
  );

  const wrappedContent = keyboardAvoiding ? (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.flex1}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.flex1, { maxHeight }]}
        >
          {content}
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  ) : (
    content
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType={variant === 'sheet' ? 'slide' : 'fade'}
      onRequestClose={onClose}
    >
      <Pressable style={variant === 'sheet' ? modalStyles.overlay : modalStyles.overlayCenter} onPress={onClose}>
        <Pressable
          style={[
            variant === 'sheet' ? modalStyles.sheet : modalStyles.sheetCenter,
            variant === 'sheet' && { maxHeight },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {wrappedContent}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  titleWrap: { flex: 1, marginRight: spacing.sm },
  closeBtn: {
    padding: spacing.xs,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
});
