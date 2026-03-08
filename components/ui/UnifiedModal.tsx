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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const maxHeight = height * 0.85;
  const isCenter = variant === 'center';
  const centerSheetHeight = Math.min(420, height * 0.7);

  const content = (
    <View style={styles.contentWrap}>
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
        showsVerticalScrollIndicator={true}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {children}
      </ScrollView>
      {footer != null && (
        <View style={[modalStyles.footer, { paddingBottom: Math.max(spacing.sm, insets.bottom) }]}>
          {footer}
        </View>
      )}
    </View>
  );

  const wrappedContent = keyboardAvoiding ? (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.flex1}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'android' ? 'height' : 'padding'}
          style={styles.flex1}
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
            variant === 'sheet' && { height: maxHeight },
            isCenter && { height: centerSheetHeight },
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
  flex1: { flex: 1, minHeight: 0 },
  contentWrap: {
    flex: 1,
    minHeight: 0,
  },
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
  scrollView: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
});
