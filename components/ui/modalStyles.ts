import { StyleSheet } from 'react-native';
import { colors, form, layout, radius, spacing, typography } from '@/theme/tokens';

/** Single source of truth for all modals: overlay, sheet, buttons, inputs. */
export const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  overlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: layout.cardPadding,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: layout.cardPadding,
    maxHeight: '85%',
  },
  sheetCenter: {
    backgroundColor: colors.surface,
    borderRadius: layout.cardRadius,
    padding: layout.cardPadding,
    maxWidth: '100%',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  btn: {
    minWidth: 100,
    minHeight: form.buttonHeight,
    justifyContent: 'center',
    borderRadius: form.inputRadius,
    alignItems: 'center',
  },
  btnSecondary: {
    minWidth: 100,
    minHeight: form.buttonHeight,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: form.inputRadius,
    alignItems: 'center',
  },
  btnTextSecondary: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: typography.body.fontSize,
  },
  title: {
    fontSize: typography.h2.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: form.labelFontSize,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: form.inputRadius,
    paddingHorizontal: form.inputPadding,
    paddingVertical: form.inputPadding,
    fontSize: typography.body.fontSize,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 48,
  },
});
