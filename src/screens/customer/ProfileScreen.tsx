import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { authApi }       from '../../api/auth';
import { useAuthStore }  from '../../store/authStore';
import { Button, Input } from '../../components/common';
import { COLORS, SPACING, RADIUS, GLASS } from '../../theme';

// ─── Role config — Ionicons replaces all three emoji role labels ──────────────
// Also fixes the original typo: 'Techncian' → 'Technician'
const ROLE_META: Record<string, {
  icon:  keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
}> = {
  ev360_technician: { icon: 'build-outline',           label: 'Technician', color: COLORS.info    },
  administrator:    { icon: 'shield-checkmark-outline', label: 'Admin',      color: COLORS.warning },
};
const DEFAULT_ROLE = { icon: 'person-outline' as const, label: 'Customer', color: COLORS.primary };

function getRoleMeta(roles?: string[]) {
  if (roles?.includes('ev360_technician')) return ROLE_META.ev360_technician;
  if (roles?.includes('administrator'))    return ROLE_META.administrator;
  return DEFAULT_ROLE;
}

// ─────────────────────────────────────────────────────────────────────────────
// ProfileScreen
// Two modes:
//   VIEW  — profile data shown as clean read-only rows (not inside inputs)
//   EDIT  — form inputs for editable fields, keyboard-safe, save/cancel
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { user, clearAuth, updateUser } = useAuthStore();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name:  user?.last_name  || '',
    phone:      user?.phone      || '',
  });

  // ── Stable field handlers (replaces the set() factory) ───────────────────
  const h = useMemo(() => ({
    first_name: (v: string) => setForm(p => ({ ...p, first_name: v })),
    last_name:  (v: string) => setForm(p => ({ ...p, last_name:  v })),
    phone:      (v: string) => setForm(p => ({ ...p, phone:      v })),
  }), []);

  // ── Mutations — identical to original ────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: (data) => {
      updateUser(data.user);
      setEditing(false);
      Alert.alert('Updated', 'Profile updated successfully.');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const handleSave   = useCallback(() => updateMutation.mutate(form), [updateMutation, form]);
  const handleCancel = useCallback(() => setEditing(false), []);
  const handleEdit   = useCallback(() => setEditing(true), []);

  const handleLogout = useCallback(() => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try { await authApi.logout(); } catch {}
          finally { queryClient.clear(); await clearAuth(); }
        },
      },
    ]);
  }, [queryClient, clearAuth]);

  const role = getRoleMeta(user?.roles);
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'User';
  const initial  = (user?.first_name?.[0] || '?').toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >

        {/* ── Header bar ──────────────────────────────────────────── */}
        {editing ? (
          // Edit mode header: Cancel | title | Save
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={handleCancel}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.headerBtnCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <TouchableOpacity
              style={[styles.headerBtn, styles.headerBtnSavePill]}
              onPress={handleSave}
              disabled={updateMutation.isPending}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {updateMutation.isPending ? (
                <Text style={styles.headerBtnSaveText}>Saving…</Text>
              ) : (
                <Text style={styles.headerBtnSaveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          // View mode header: title | Edit icon
          <View style={styles.header}>
            <View style={{ width: 40 }} />
            <Text style={styles.headerTitle}>My Profile</Text>
            <TouchableOpacity
              style={styles.editIconBtn}
              onPress={handleEdit}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="pencil-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Avatar section ──────────────────────────────────── */}
          <View style={[styles.avatarSection, editing && styles.avatarSectionCompact]}>
            {/* Outer glow ring */}
            <View style={styles.avatarRing}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            </View>

            <Text style={styles.name}>{fullName}</Text>

            {/* Role badge — only shown in view mode */}
            {!editing && (
              <View style={[
                styles.roleBadge,
                { borderColor: `rgba(${roleTintRgb(role.color)}, 0.3)`,
                  backgroundColor: `rgba(${roleTintRgb(role.color)}, 0.1)` },
              ]}>
                <Ionicons name={role.icon} size={13} color={role.color} />
                <Text style={[styles.roleText, { color: role.color }]}>{role.label}</Text>
              </View>
            )}
          </View>

          {/* ════════════════ VIEW MODE ════════════════ */}
          {!editing && (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconBox}>
                  <Ionicons name="person-outline" size={13} color={COLORS.primary} />
                </View>
                <Text style={styles.sectionTitle}>Account Information</Text>
              </View>
              <View style={styles.divider} />

              <InfoRow icon="person-outline"  label="First Name" value={user?.first_name || '—'} />
              <InfoRow icon="person-outline"  label="Last Name"  value={user?.last_name  || '—'} />
              <InfoRow icon="mail-outline"    label="Email"      value={user?.email       || '—'} isLast={!user?.phone} />
              {user?.phone && (
                <InfoRow icon="call-outline"  label="Phone"      value={user.phone} isLast />
              )}
            </View>
          )}

          {/* ════════════════ EDIT MODE ════════════════ */}
          {editing && (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconBox}>
                  <Ionicons name="create-outline" size={13} color={COLORS.primary} />
                </View>
                <Text style={styles.sectionTitle}>Edit Details</Text>
              </View>
              <View style={styles.divider} />

              <Input
                label="First Name"
                value={form.first_name}
                onChangeText={h.first_name}
                autoCapitalize="words"
              />
              <Input
                label="Last Name"
                value={form.last_name}
                onChangeText={h.last_name}
                autoCapitalize="words"
              />
              <Input
                label="Email"
                value={user?.email || ''}
                onChangeText={() => {}}
                editable={false}
              />
              <Input
                label="Phone"
                value={form.phone}
                onChangeText={h.phone}
                keyboardType="phone-pad"
              />

              <Button
                title="Save Changes"
                onPress={handleSave}
                loading={updateMutation.isPending}
                style={styles.saveBtn}
                icon={
                  !updateMutation.isPending
                    ? <Ionicons name="checkmark-circle-outline" size={17} color={COLORS.bgDark} />
                    : undefined
                }
              />
            </View>
          )}

          {/* ── Logout ────────────────────────────────────────────── */}
          <View style={styles.logoutSection}>
            <Button
              title="Logout"
              onPress={handleLogout}
              variant="danger"
              icon={<Ionicons name="log-out-outline" size={17} color="#fff" />}
            />
          </View>

          <View style={{ height: SPACING.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InfoRow — used in VIEW mode to show read-only profile data
// ─────────────────────────────────────────────────────────────────────────────
function InfoRow({
  icon,
  label,
  value,
  isLast = false,
}: {
  icon:    keyof typeof Ionicons.glyphMap;
  label:   string;
  value:   string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.infoRow, isLast && styles.infoRowLast]}>
      <View style={styles.infoLabelGroup}>
        <Ionicons name={icon} size={14} color={COLORS.textMuted} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ─── Helper: parse COLORS hex → "r,g,b" string for rgba() ────────────────────
function roleTintRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  safe: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },

  // ── Header bar ────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  headerBtn: {
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnCancel: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  headerBtnSavePill: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  headerBtnSaveText: {
    color: COLORS.bgDark,
    fontSize: 13,
    fontWeight: '700',
  },
  editIconBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  // ── Avatar section ────────────────────────────────────────────────────────
  avatarSection: {
    alignItems: 'center',
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
    gap: 8,
  },
  avatarSectionCompact: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  avatarRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(127, 191, 49, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
  avatarCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: COLORS.bgDark,
    fontSize: 28,
    fontWeight: '800',
  },
  name: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginTop: 2,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Card (shared between view and edit) ───────────────────────────────────
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  sectionIconBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(127, 191, 49, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(127, 191, 49, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  },

  // ── Info rows (view mode) ─────────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  infoValue: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    maxWidth: '55%',
    textAlign: 'right',
  },

  // ── Edit mode save button ─────────────────────────────────────────────────
  saveBtn: {
    marginTop: SPACING.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },

  // ── Logout ────────────────────────────────────────────────────────────────
  logoutSection: {
    marginTop: SPACING.sm,
  },
});