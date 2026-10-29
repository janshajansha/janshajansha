import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { Button, Input } from '../../components/common';
import { COLORS, SPACING, RADIUS, GLASS, SHADOW } from '../../theme';
import { AuthStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation  = useNavigation<Nav>();
  const { setAuth } = useAuthStore();

  const [email, setEmailVal]            = useState('');
  const [password, setPasswordVal]      = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [errors, setErrors]             = useState<{ email?: string; password?: string }>({});

  // ─── Stable handlers ──────────────────────────────────────────────────────
  // useCallback keeps function references stable so the existing Input
  // component doesn't receive a new prop on every render.
  const handleEmailChange = useCallback((t: string) => {
    setEmailVal(t);
    setErrors(p => ({ ...p, email: undefined }));
  }, []);

  const handlePasswordChange = useCallback((t: string) => {
    setPasswordVal(t);
    setErrors(p => ({ ...p, password: undefined }));
  }, []);

  const togglePassword = useCallback(() => setShowPassword(v => !v), []);

  // ─── Validation & submit ───────────────────────────────────────────────────
  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authApi.login({ email: email.trim().toLowerCase(), password });
      if (res.success && res.token && res.user) {
        await setAuth(res.token, res.user);
      } else {
        Alert.alert('Login Failed', res.message || 'Invalid credentials.');
      }
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    // edges={['top','left','right']} — safe area covers the status bar and
    // notch sides. Bottom is handled by paddingBottom on the panel so the
    // card background visually reaches the screen edge.
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/*
        ── Keyboard strategy ────────────────────────────────────────────────
        iOS  → behavior="padding": KAV adds paddingBottom = keyboard height.
               The ScrollView gains extra scroll space so the focused input
               can scroll above the keyboard. The hero stays at its natural
               height — it never squishes or animates.
        Android → behavior="height": KAV shrinks to screenHeight-keyboardHeight.
               Content scrolls within that smaller space.
        Both → NO flexGrow:1 in the scroll contentContainerStyle.
               flexGrow:1 was forcing a height-recalculation every time KAV
               changed size, causing the cursor/keyboard shake.
      */}
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

          {/* ── Hero ─────────────────────────────────────────────────── */}
          <View style={styles.hero}>
            <Image
              source={require('../../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
			      />
          </View>
          <View style={styles.form}>
            {/* Drag-handle pill — signals this is a sheet */}
            <View style={styles.handle} />

            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>

            {/* ── Inputs ─ using the existing Input component as-is ─── */}
            <Input
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={handleEmailChange}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />

            <Input
              label="Password"
              placeholder="Your password"
              value={password}
              onChangeText={handlePasswordChange}
              secureTextEntry={!showPassword}
              error={errors.password}
              rightIcon={
                <TouchableOpacity
                  onPress={togglePassword}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              }
            />

            {/* ── Sign In ─ primary green button with glow shadow ───── */}
            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              style={styles.signInBtn}
              icon={
                !loading
                  ? <Ionicons name="arrow-forward" size={17} color={COLORS.bgDark} />
                  : undefined
              }
            />

            {/* ── Divider ─────────────────────────────────────────────── */}
            {/* <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View> */}

            {/* ── Register ─ outline button ─────────────────────────── */}
            {/* <Button
              title="Create an Account"
              onPress={() => navigation.navigate('Register')}
              variant="outline"
              icon={<Ionicons name="person-add-outline" size={16} color={COLORS.primary} />}
            /> */}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — every value comes from themes.ts tokens
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  safe: {
    flex: 1,
    backgroundColor: COLORS.bgDark,   // #221714
  },

  scroll: {
    // paddingBottom only — NO flexGrow:1
    // flexGrow:1 forced a layout recalc whenever KAV changed size → keyboard shake.
    paddingBottom: 40,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingTop: SPACING.xl,           // 32
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,    // 24
  },

  logoRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: `${COLORS.primary}1A`,   // #7FBF31 at 10% opacity
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    // Green glow from SHADOW.glossy
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
  },

  logoCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: COLORS.primary,   // solid #7FBF31
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
		width: 150,
		height: 100,
  },
  brand: {
    fontSize: 38,
    fontWeight: '900',
    color: COLORS.textPrimary,         // #F8F1E9
    letterSpacing: 8,
    marginBottom: 4,
  },

  tagline: {
    fontSize: 12,
    color: COLORS.textMuted,           // #8F8377
    letterSpacing: 0.5,
  },

  // ── Form panel ────────────────────────────────────────────────────────────
  // Spread GLASS then override the border to only show on top+sides so the
  // panel background seamlessly reaches the screen bottom edge.
  form: {
    backgroundColor: 'rgba(44, 36, 31, 0.92)',  // GLASS.backgroundColor
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(127, 191, 49, 0.25)',     // GLASS.borderColor
    borderTopLeftRadius: RADIUS.xl,              // 24
    borderTopRightRadius: RADIUS.xl,
    // Upward shadow: panel appears to float above the dark background
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 14,
    paddingTop: SPACING.md,                      // 16
    paddingHorizontal: SPACING.lg,               // 24
    paddingBottom: SPACING.xl,                   // 32
  },

  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,             // #3F3832
    alignSelf: 'center',
    marginBottom: SPACING.lg,                   // 24
  },

  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: SPACING.lg,
  },

  // ── Buttons ───────────────────────────────────────────────────────────────
  signInBtn: {
    marginTop: SPACING.sm,
    // SHADOW.soft — green glow under the button
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 12,
    elevation: 8,
  },

  // ── Divider ───────────────────────────────────────────────────────────────
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    color: COLORS.textMuted,
    marginHorizontal: SPACING.sm,
    fontSize: 13,
  },
});