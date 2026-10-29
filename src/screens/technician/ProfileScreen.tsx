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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { authApi }       from '../../api/auth';
import { servicesApi }   from '../../api/services';
import { useAuthStore }  from '../../store/authStore';
import { Button, Input } from '../../components/common';
import { COLORS, SPACING, RADIUS } from '../../theme';
import { QUERY_KEYS }    from '../../constants/api';

// ─── rgba helper ──────────────────────────────────────────────────────────────
function hexRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Role config — Ionicons replace '👑 Admin' and '🔧 Technician' emojis ────
const ROLE_META = {
  administrator: {
    icon:  'shield-checkmark-outline' as keyof typeof Ionicons.glyphMap,
    label: 'Admin',
    color: COLORS.warning,          // amber
  },
};
const DEFAULT_ROLE = {
  icon:  'build-outline' as keyof typeof Ionicons.glyphMap,
  label: 'Technician',
  color: COLORS.primary,            // brand green
};

function getRoleMeta(roles?: string[]) {
  if (roles?.includes('administrator')) return ROLE_META.administrator;
  return DEFAULT_ROLE;
}

// ─────────────────────────────────────────────────────────────────────────────
// TechProfileScreen — two-mode layout matching CustomerProfileScreen
//
// VIEW mode : read-only info rows + stats (no input borders)
// EDIT mode : form inputs + save/cancel in the header bar
// ─────────────────────────────────────────────────────────────────────────────
export default function TechProfileScreen() {
  const { user, clearAuth, updateUser } = useAuthStore();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    first_name: user?.first_name ?? '',
    last_name:  user?.last_name  ?? '',
    phone:      user?.phone      ?? '',
  });

  // ── Stable field handlers (replaces set() factory) ───────────────────────
  const h = useMemo(() => ({
    first_name: (v: string) => setForm(p => ({ ...p, first_name: v })),
    last_name:  (v: string) => setForm(p => ({ ...p, last_name:  v })),
    phone:      (v: string) => setForm(p => ({ ...p, phone:      v })),
  }), []);

  // ── Stats query — identical to original ──────────────────────────────────
  const { data: reqData } = useQuery({
    queryKey: QUERY_KEYS.adminRequests({ assigned_technician_id: user?.id }),
    queryFn:  () =>
      servicesApi.getAdminRequests({
        assigned_technician_id: user?.id,
        per_page: 100,
      }),
    enabled: !!user?.id,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const requests  = reqData?.requests ?? [];
  const total     = requests.length;
  const active    = requests.filter((r) =>
    ['assigned', 'accepted', 'on_the_way', 'arrived', 'in_progress'].includes(r.status)
  ).length;
  const completed = requests.filter((r) => r.status === 'completed').length;
  const cancelled = requests.filter((r) => r.status === 'cancelled').length;

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

  const handleSave = useCallback(() => updateMutation.mutate(form), [updateMutation, form]);

  // Cancel resets form to current user values — identical to original logic
  const handleCancel = useCallback(() => {
    setForm({
      first_name: user?.first_name ?? '',
      last_name:  user?.last_name  ?? '',
      phone:      user?.phone      ?? '',
    });
    setEditing(false);
  }, [user]);

  const handleEdit = useCallback(() => setEditing(true), []);

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

  const role    = getRoleMeta(user?.roles);
  const initials = [user?.first_name?.[0], user?.last_name?.[0]]
    .filter(Boolean).join('').toUpperCase() || '?';
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'User';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >

        {/* ── Header bar ─────────────────────────────────────────── */}
        {editing ? (
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={handleCancel}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <TouchableOpacity
              style={[styles.headerBtn, styles.savePill]}
              onPress={handleSave}
              disabled={updateMutation.isPending}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.saveText}>
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.header}>
            <View style={{ width: 40 }} />
            <Text style={styles.headerTitle}>My Profile</Text>
            <TouchableOpacity
              style={styles.editBtn}
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

          {/* ── Avatar ─────────────────────────────────────────────── */}
          <View style={[styles.avatarSection, editing && styles.avatarCompact]}>
            <View style={styles.avatarRing}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitial}>{initials}</Text>
              </View>
            </View>
            <Text style={styles.name}>{fullName}</Text>
            {!editing && (
              <View style={[
                styles.roleBadge,
                {
                  // hexRgba replaces role.color + '55' / + '18'
                  borderColor:     hexRgba(role.color, 0.35),
                  backgroundColor: hexRgba(role.color, 0.1),
                },
              ]}>
                <Ionicons name={role.icon} size={13} color={role.color} />
                <Text style={[styles.roleText, { color: role.color }]}>{role.label}</Text>
              </View>
            )}
            <Text style={styles.emailText}>{user?.email}</Text>
          </View>

          {/* ── Stats — always visible (unique to TechProfile) ─────── */}
          <View style={styles.statsRow}>
            <StatCard label="Total"     value={total}     color={COLORS.textSecondary} />
            <StatCard label="Active"    value={active}    color={COLORS.primary}       />
            <StatCard label="Done"      value={completed} color={COLORS.success}       />
            <StatCard label="Cancelled" value={cancelled} color={COLORS.error}         />
          </View>

          {/* ════════ VIEW MODE ════════ */}
          {!editing && (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconBox}>
                  <Ionicons name="person-outline" size={13} color={COLORS.primary} />
                </View>
                <Text style={styles.sectionTitle}>Account Information</Text>
              </View>
              <View style={styles.divider} />

              <InfoRow icon="person-outline" label="First Name" value={user?.first_name || '—'} />
              <InfoRow icon="person-outline" label="Last Name"  value={user?.last_name  || '—'} />
              <InfoRow icon="mail-outline"   label="Email"      value={user?.email       || '—'} />
              <InfoRow
                icon="call-outline"
                label="Phone"
                value={user?.phone || '—'}
                isLast
              />
            </View>
          )}

          {/* ════════ EDIT MODE ════════ */}
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
                value={user?.email ?? ''}
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

          {/* ── Logout ───────────────────────────────────────────────── */}
          <Button
            title="Logout"
            onPress={handleLogout}
            variant="danger"
            icon={<Ionicons name="log-out-outline" size={17} color="#fff" />}
            style={styles.logoutBtn}
          />

          <View style={{ height: SPACING.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatCard — unique to TechProfile (not in CustomerProfile)
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InfoRow — used in VIEW mode (was dead code in the original)
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
    <View style={[styles.infoRow, isLast && { borderBottomWidth: 0 }]}>
      <View style={styles.infoLabelGroup}>
        <Ionicons name={icon} size={14} color={COLORS.textMuted} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — mirrors CustomerProfileScreen structure exactly
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  safe: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },

  // ── Header ────────────────────────────────────────────────────────────────
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
    flex: 1,
    textAlign: 'center',
  },
  headerBtn: {
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  savePill: {
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
  saveText: {
    color: COLORS.bgDark,
    fontSize: 13,
    fontWeight: '700',
  },
  editBtn: {
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

  // ── Avatar ────────────────────────────────────────────────────────────────
  avatarSection: {
    alignItems: 'center',
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    gap: 6,
  },
  avatarCompact: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
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
    fontSize: 26,
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
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emailText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },

  // ── Stats row (unique to TechProfile) ─────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 3,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
  },

  // ── Card (shared view/edit) ───────────────────────────────────────────────
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

  // ── Save button (edit mode) ───────────────────────────────────────────────
  saveBtn: {
    marginTop: SPACING.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },

  // ── Logout ────────────────────────────────────────────────────────────────
  logoutBtn: {
    marginTop: SPACING.sm,
  },
});