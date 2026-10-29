import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { vehiclesApi }  from '../../api/vehicles';
import { QUERY_KEYS }   from '../../constants/api';
import { Button, Input } from '../../components/common';
import { COLORS, SPACING, RADIUS } from '../../theme';

type RouteParams = { vehicleId?: number };

const CHARGING_TYPES = ['AC', 'DC', 'AC/DC', 'CHAdeMO', 'CCS', 'Type 2', 'Other'];

export default function AddVehicleScreen() {
  const navigation   = useNavigation<any>();
  const route        = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const queryClient  = useQueryClient();
  const editId       = route.params?.vehicleId;
  const isEdit       = !!editId;

  const [form, setForm] = useState({
    make:             '',
    model:            '',
    year:             '',
    color:            '',
    vin:              '',
    plate_number:     '',
    battery_capacity: '',
    range_km:         '',
    charging_type:    '',
    charging_speed:   '',
    current_odometer: '',
    purchase_date:    '',
    insurance_expiry: '',
    warranty_expiry:  '',
  });
  const [errors, setErrors] = useState<Partial<typeof form>>({});

  // ── Load existing vehicle for editing — identical to original ─────────────
  const { data: existingData } = useQuery({
    queryKey: QUERY_KEYS.userVehicle(editId!),
    queryFn: () => vehiclesApi.getMyVehicle(editId!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingData?.vehicle) {
      const v = existingData.vehicle;
      setForm({
        make:             v.make || '',
        model:            v.model || '',
        year:             v.year ? String(v.year) : '',
        color:            v.color || '',
        vin:              v.vin || '',
        plate_number:     v.plate_number || '',
        battery_capacity: v.battery_capacity ? String(v.battery_capacity) : '',
        range_km:         v.range_km ? String(v.range_km) : '',
        charging_type:    v.charging_type || '',
        charging_speed:   v.charging_speed ? String(v.charging_speed) : '',
        current_odometer: v.current_odometer ? String(v.current_odometer) : '',
        purchase_date:    v.purchase_date || '',
        insurance_expiry: v.insurance_expiry || '',
        warranty_expiry:  v.warranty_expiry || '',
      });
    }
  }, [existingData]);

  // ── Stable field handlers ─────────────────────────────────────────────────
  // useMemo with empty deps gives every handler a stable reference for the
  // lifetime of the component — no new functions on each render.
  // (Replaces the original `set(key)` factory which created a fresh closure
  // on every render, causing unnecessary re-renders of Input children.)
  const h = useMemo(() => ({
    make:             (v: string) => setForm(p => ({ ...p, make: v })),
    model:            (v: string) => setForm(p => ({ ...p, model: v })),
    year:             (v: string) => setForm(p => ({ ...p, year: v })),
    color:            (v: string) => setForm(p => ({ ...p, color: v })),
    vin:              (v: string) => setForm(p => ({ ...p, vin: v })),
    plate_number:     (v: string) => setForm(p => ({ ...p, plate_number: v })),
    battery_capacity: (v: string) => setForm(p => ({ ...p, battery_capacity: v })),
    range_km:         (v: string) => setForm(p => ({ ...p, range_km: v })),
    charging_type:    (v: string) => setForm(p => ({ ...p, charging_type: v })),
    charging_speed:   (v: string) => setForm(p => ({ ...p, charging_speed: v })),
    current_odometer: (v: string) => setForm(p => ({ ...p, current_odometer: v })),
    purchase_date:    (v: string) => setForm(p => ({ ...p, purchase_date: v })),
    insurance_expiry: (v: string) => setForm(p => ({ ...p, insurance_expiry: v })),
    warranty_expiry:  (v: string) => setForm(p => ({ ...p, warranty_expiry: v })),
  }), []); // setForm is stable — empty deps is correct

  // ── Validation — identical to original ────────────────────────────────────
  const validate = () => {
    const e: Partial<typeof form> = {};
    if (!form.make.trim())  e.make  = 'Make is required';
    if (!form.model.trim()) e.model = 'Model is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save mutation — identical to original ─────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (payload: any) =>
      isEdit
        ? vehiclesApi.updateVehicle(editId!, payload)
        : vehiclesApi.addVehicle(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userVehicles });
      Alert.alert('Success', isEdit ? 'Vehicle updated.' : 'Vehicle added.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const handleSave = useCallback(() => {
    if (!validate()) return;
    saveMutation.mutate({
      make:             form.make.trim(),
      model:            form.model.trim(),
      year:             form.year ? parseInt(form.year) : undefined,
      color:            form.color || undefined,
      vin:              form.vin || undefined,
      plate_number:     form.plate_number || undefined,
      battery_capacity: form.battery_capacity ? parseFloat(form.battery_capacity) : undefined,
      range_km:         form.range_km ? parseFloat(form.range_km) : undefined,
      charging_type:    form.charging_type || undefined,
      charging_speed:   form.charging_speed ? parseFloat(form.charging_speed) : undefined,
      current_odometer: form.current_odometer ? parseFloat(form.current_odometer) : undefined,
      purchase_date:    form.purchase_date || undefined,
      insurance_expiry: form.insurance_expiry || undefined,
      warranty_expiry:  form.warranty_expiry || undefined,
    });
  }, [form, saveMutation]);

  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={goBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            {isEdit ? 'Edit Vehicle' : 'Add Vehicle'}
          </Text>

          {/* Balances the back button so the title stays centred */}
          <View style={{ width: 40 }} />
        </View>

        {/* ── Form ────────────────────────────────────────────────────── */}
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >

          {/* ── Vehicle Details ──────────────────────────────────────── */}
          <Section title="Vehicle Details" icon="car-sport-outline">
            <Input
              label="Make *"
              placeholder="e.g. Byd, GAC"
              value={form.make}
              onChangeText={h.make}
              error={errors.make}
              autoCapitalize="words"
            />
            <Input
              label="Model *"
              placeholder="e.g. Yuan, Atto"
              value={form.model}
              onChangeText={h.model}
              error={errors.model}
              autoCapitalize="words"
            />
            <View style={styles.row}>
              <Input
                label="Year"
                placeholder="2023"
                value={form.year}
                onChangeText={h.year}
                keyboardType="numeric"
                style={styles.halfLeft}
              />
              <Input
                label="Color"
                placeholder="White, Red…"
                value={form.color}
                onChangeText={h.color}
                autoCapitalize="words"
                style={styles.halfRight}
              />
            </View>
            <Input
              label="VIN Number"
              placeholder="17-character VIN"
              value={form.vin}
              onChangeText={h.vin}
              autoCapitalize="characters"
            />
            <Input
              label="Registration Number"
              placeholder="AS 2567 - 12"
              value={form.plate_number}
              onChangeText={h.plate_number}
              autoCapitalize="characters"
            />
          </Section>

          {/* ── Battery & Range ──────────────────────────────────────── */}
          <Section title="Battery & Range" icon="battery-charging-outline">
            <View style={styles.row}>
              <Input
                label="Battery (kWh)"
                placeholder="40.5"
                value={form.battery_capacity}
                onChangeText={h.battery_capacity}
                keyboardType="numeric"
                style={styles.halfLeft}
              />
              <Input
                label="Range (km)"
                placeholder="400"
                value={form.range_km}
                onChangeText={h.range_km}
                keyboardType="numeric"
                style={styles.halfRight}
              />
            </View>

            <Text style={styles.fieldLabel}>Charging Type</Text>
            <View style={styles.chipRow}>
              {CHARGING_TYPES.map((ct) => (
                <TouchableOpacity
                  key={ct}
                  style={[styles.chip, form.charging_type === ct && styles.chipActive]}
                  onPress={() => h.charging_type(ct)}
                  activeOpacity={0.75}
                >
                  <Text style={[
                    styles.chipText,
                    form.charging_type === ct && styles.chipTextActive,
                  ]}>
                    {ct}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Charging Speed (kW)"
              placeholder="7.2"
              value={form.charging_speed}
              onChangeText={h.charging_speed}
              keyboardType="numeric"
            />
            <Input
              label="Current Odometer (km)"
              placeholder="12500"
              value={form.current_odometer}
              onChangeText={h.current_odometer}
              keyboardType="numeric"
            />
          </Section>

          {/* ── Dates ────────────────────────────────────────────────── */}
          <Section title="Dates" icon="calendar-outline">
            <Input
              label="Purchase Date"
              placeholder="YYYY-MM-DD"
              value={form.purchase_date}
              onChangeText={h.purchase_date}
            />
            <View style={styles.row}>
              <Input
                label="Insurance Expiry"
                placeholder="YYYY-MM-DD"
                value={form.insurance_expiry}
                onChangeText={h.insurance_expiry}
                style={styles.halfLeft}
              />
              <Input
                label="Warranty Expiry"
                placeholder="YYYY-MM-DD"
                value={form.warranty_expiry}
                onChangeText={h.warranty_expiry}
                style={styles.halfRight}
              />
            </View>
          </Section>

          {/* ── Save button ──────────────────────────────────────────── */}
          <Button
            title={isEdit ? 'Update Vehicle' : 'Add Vehicle'}
            onPress={handleSave}
            loading={saveMutation.isPending}
            style={styles.saveBtn}
            icon={
              !saveMutation.isPending
                ? <Ionicons
                    name={isEdit ? 'checkmark-circle-outline' : 'add-circle-outline'}
                    size={18}
                    color={COLORS.bgDark}
                  />
                : undefined
            }
          />

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section card — groups related fields with a labelled header
// ─────────────────────────────────────────────────────────────────────────────
function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconBox}>
          <Ionicons name={icon} size={14} color={COLORS.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionDivider} />
      {children}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
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
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: {
    padding: SPACING.lg,
    paddingBottom: 48,
  },

  // ── Layout helpers ────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  halfLeft: {
    flex: 1,
  },
  halfRight: {
    flex: 1,
  },

  // ── Section card ──────────────────────────────────────────────────────────
  section: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
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
  sectionDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  },

  // ── Field label (for charging type) ──────────────────────────────────────
  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },

  // ── Charging type chips ────────────────────────────────────────────────────
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.md,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCardLight,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: COLORS.bgDark,
    fontWeight: '700',
  },

  // ── Save button ────────────────────────────────────────────────────────────
  saveBtn: {
    marginTop: SPACING.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
});