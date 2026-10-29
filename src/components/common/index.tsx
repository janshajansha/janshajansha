import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOW, FONTS } from '../../theme';
import { SERVICE_STATUS_LABELS, STATUS_COLORS } from '../../constants/api';

// ─────────────────────────────────────────
// Button
// ─────────────────────────────────────────
interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  style,
  textStyle,
  icon,
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isDanger = variant === 'danger';
  const isOutline = variant === 'outline';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.btn,
        isPrimary && styles.btnPrimary,
        isSecondary && styles.btnSecondary,
        isDanger && styles.btnDanger,
        isOutline && styles.btnOutline,
        (disabled || loading) && styles.btnDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? COLORS.primary : COLORS.white} size="small" />
      ) : (
        <View style={styles.btnContent}>
          {icon}
          <Text
            style={[
              styles.btnText,
              isOutline && { color: COLORS.primary },
              isSecondary && { color: COLORS.textPrimary },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────
// Input
// ─────────────────────────────────────────
interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  multiline?: boolean;
  numberOfLines?: number;
  editable?: boolean;
  style?: ViewStyle;
  rightIcon?: React.ReactNode;
}

export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  error,
  multiline,
  numberOfLines,
  editable = true,
  style,
  rightIcon,
}: InputProps) {
  return (
    <View style={[styles.inputWrapper, style]}>
      {label && <Text style={styles.inputLabel}>{label}</Text>}
      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            multiline && { height: 80, textAlignVertical: 'top' },
            !editable && { opacity: 0.6 },
            error && styles.inputError,
            rightIcon && { paddingRight: 40 },
          ]}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
        />
        {rightIcon && <View style={styles.inputRightIcon}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.inputErrorText}>{error}</Text>}
    </View>
  );
}

// ─────────────────────────────────────────
// Card
// ─────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}

export function Card({ children, style, onPress }: CardProps) {
  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[styles.card, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

// ─────────────────────────────────────────
// StatusBadge
// ─────────────────────────────────────────
interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = STATUS_COLORS[status] || COLORS.textMuted;
  const label = SERVICE_STATUS_LABELS[status] || status;
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────
// ScreenWrapper — safe area + scroll
// ─────────────────────────────────────────
interface ScreenWrapperProps {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  noPad?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export function ScreenWrapper({ children, scroll, style, noPad, edges = ['top', 'left', 'right'] }: ScreenWrapperProps) {
  const inner = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[!noPad && { padding: SPACING.md }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      bounces={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, !noPad && { padding: SPACING.md }, style]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.safeArea]} edges={edges}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {inner}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────
// SectionHeader
// ─────────────────────────────────────────
export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  subtitle,
  action,
  onAction,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
      {action && onAction && (
        <Button title={action} onPress={onAction} style={{ marginTop: SPACING.md }} />
      )}
    </View>
  );
}

// ─────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────
export function SkeletonCard() {
  return (
    <View style={[styles.card, { gap: SPACING.sm }]}>
      <View style={[styles.skeletonLine, { width: '60%', height: 16 }]} />
      <View style={[styles.skeletonLine, { width: '100%', height: 12 }]} />
      <View style={[styles.skeletonLine, { width: '80%', height: 12 }]} />
    </View>
  );
}

// ─────────────────────────────────────────
// Styles
// ─────────────────────────────────────────
const styles = StyleSheet.create({
  btn: {
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnSecondary: { backgroundColor: COLORS.bgCardLight },
  btnDanger: { backgroundColor: COLORS.error },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  btnDisabled: { opacity: 0.5 },
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: COLORS.bgDark, fontWeight: '700', fontSize: 15 },

  inputWrapper: { marginBottom: SPACING.md },
  inputLabel: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 6, fontWeight: '500' },
  inputRow: { position: 'relative' },
  input: {
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputError: { borderColor: COLORS.error },
  inputErrorText: { color: COLORS.error, fontSize: 12, marginTop: 4 },
  inputRightIcon: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },

  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOW.soft,
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 12, fontWeight: '600' },

  safeArea: { flex: 1, backgroundColor: COLORS.bgDark },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    marginTop: SPACING.xl,
  },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  sectionAction: { color: COLORS.primary, fontSize: 13 },

  empty: { alignItems: 'center', padding: SPACING.xxl },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },

  skeletonLine: {
    backgroundColor: COLORS.bgCardLight,
    borderRadius: RADIUS.sm,
    opacity: 0.6,
  },
});