import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { Button, Input } from '../../components/common';
import { COLORS, SPACING, RADIUS, GLASS } from '../../theme';
import { AuthStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

export default function RegisterScreen() {
  const navigation  = useNavigation<Nav>();
  const { setAuth } = useAuthStore();

  const [form, setForm] = useState({
    first_name:      '',
    last_name:       '',
    email:           '',
    phone:           '',
    password:        '',
    confirmPassword: '',
  });
  const [errors, setErrors]         = useState<Partial<typeof form>>({});
  const [loading, setLoading]       = useState(false);
  const [showPass, setShowPass]     = useState(false);   // ← added, was missing
  const [showConfirm, setShowConfirm] = useState(false); // ← added, was missing

  // ─── Stable handlers ──────────────────────────────────────────────────────
  // Replace the original generic set() factory with individual useCallback
  // handlers so Input never receives a new function reference on every render.
  const setFirstName  = useCallback((v: string) => {
    setForm(p => ({ ...p, first_name: v }));
    setErrors(p => ({ ...p, first_name: undefined }));
  }, []);

  const setLastName   = useCallback((v: string) => {
    setForm(p => ({ ...p, last_name: v }));
    setErrors(p => ({ ...p, last_name: undefined }));
  }, []);

  const setEmail      = useCallback((v: string) => {
    setForm(p => ({ ...p, email: v }));
    setErrors(p => ({ ...p, email: undefined }));
  }, []);

  const setPhone      = useCallback((v: string) => {
    setForm(p => ({ ...p, phone: v }));
  }, []);

  const setPassword   = useCallback((v: string) => {
    setForm(p => ({ ...p, password: v }));
    setErrors(p => ({ ...p, password: undefined }));
  }, []);

  const setConfirm    = useCallback((v: string) => {
    setForm(p => ({ ...p, confirmPassword: v }));
    setErrors(p => ({ ...p, confirmPassword: undefined }));
  }, []);

  const togglePass    = useCallback(() => setShowPass(v => !v), []);
  const toggleConfirm = useCallback(() => setShowConfirm(v => !v), []);

  // ─── Validation — identical to original ───────────────────────────────────
  const validate = () => {
    const e: Partial<typeof form> = {};
    if (!form.first_name.trim()) e.first_name = 'Required';
    if (!form.last_name.trim())  e.last_name  = 'Required';
    if (!form.email.trim())      e.email      = 'Email required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (!form.password)          e.password   = 'Password required';
    else if (form.password.length < 8) e.password = 'Min 8 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ─── Submit — identical to original ───────────────────────────────────────
  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authApi.register({
        first_name:  form.first_name.trim(),
        last_name:   form.last_name.trim(),
        email:       form.email.trim().toLowerCase(),
        password:    form.password,
        phone:       form.phone.trim() || undefined,
        device_name: 'EV360 Mobile App',
      });
      if (res.success && res.token && res.user) {
        await setAuth(res.token, res.user);
      } else {
        Alert.alert('Registration Failed', res.message || 'Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >

          {/* ── Compact header — back button + logo ─────────────────── */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>

            {/* Same logo as LoginScreen, slightly smaller */}
            <Image
              source={require('../../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />

            {/* Spacer keeps logo visually centred */}
            <View style={{ width: 40 }} />
          </View>

          {/* ── Page heading ─────────────────────────────────────────── */}
          <View style={styles.titleArea}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join the EV360 platform</Text>
          </View>

          {/* ── GLASS form panel — full-bleed, matches LoginScreen ───── */}
          <View style={styles.form}>
            <View style={styles.handle} />

            {/* First + Last name side-by-side */}
            <View style={styles.nameRow}>
              <Input
                label="First Name"
                placeholder="John"
                value={form.first_name}
                onChangeText={setFirstName}
                autoCapitalize="words"
                error={errors.first_name}
                style={styles.halfInput}
              />
              <Input
                label="Last Name"
                placeholder="Doe"
                value={form.last_name}
                onChangeText={setLastName}
                autoCapitalize="words"
                error={errors.last_name}
                style={styles.halfInput}
              />
            </View>

            <Input
              label="Email"
              placeholder="you@example.com"
              value={form.email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />

            <Input
              label="Phone (optional)"
              placeholder="+91 98765 43210"
              value={form.phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Input
              label="Password"
              placeholder="Min 8 characters"
              value={form.password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              error={errors.password}
              rightIcon={
                <TouchableOpacity
                  onPress={togglePass}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              }
            />

            <Input
              label="Confirm Password"
              placeholder="Re-enter password"
              value={form.confirmPassword}
              onChangeText={setConfirm}
              secureTextEntry={!showConfirm}
              error={errors.confirmPassword}
              rightIcon={
                <TouchableOpacity
                  onPress={toggleConfirm}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              }
            />

            {/* Primary CTA */}
            <Button
              title="Create Account"
              onPress={handleRegister}
              loading={loading}
              style={styles.createBtn}
              icon={
                !loading
                  ? <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.bgDark} />
                  : undefined
              }
            />

            {/* Sign in link */}
            <TouchableOpacity
              style={styles.link}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.linkText}>
                Already have an account?{' '}
                <Text style={styles.linkHighlight}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  safe: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },

  scroll: {
    paddingBottom: 40,   // NO flexGrow:1 — same reason as LoginScreen
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoImage: {
    width: 110,
    height: 70,
  },

  // ── Page title ────────────────────────────────────────────────────────────
  titleArea: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },

  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
  },

  // ── GLASS form panel — mirrors LoginScreen exactly ────────────────────────
  form: {
    backgroundColor: 'rgba(44, 36, 31, 0.92)',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(127, 191, 49, 0.25)',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 14,
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },

  // ── Name row ──────────────────────────────────────────────────────────────
  nameRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },

  halfInput: {
    flex: 1,
  },

  // ── Buttons ───────────────────────────────────────────────────────────────
  createBtn: {
    marginTop: SPACING.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 12,
    elevation: 8,
  },

  // ── Sign in link ──────────────────────────────────────────────────────────
  link: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },

  linkText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },

  linkHighlight: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});