import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { servicesApi }  from '../../api/services';
import { vehiclesApi }  from '../../api/vehicles';
import { QUERY_KEYS }   from '../../constants/api';
import { ServiceType, ServicePriority } from '../../types';
import { Button, Input, Card } from '../../components/common';
import { COLORS, SPACING, RADIUS } from '../../theme';

// ─── Safe rgba helper (avoids 8-digit hex Android glitches) ──────────────────
function hexRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service type definitions — Ionicons replaces emoji icons
//
// URGENT  → allow submitting without a vehicle (soft inline warning only)
// PLANNED → prompt to add a vehicle first, but allow skipping
// ─────────────────────────────────────────────────────────────────────────────
const SERVICE_TYPES: {
  key: ServiceType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  urgent: boolean;
}[] = [
  { key: 'emergency_charging',    label: 'Emergency Charging',    icon: 'flash',                   color: '#EF4444', urgent: true  },
  { key: 'breakdown_assistance',  label: 'Breakdown Assistance',  icon: 'construct-outline',        color: '#F97316', urgent: true  },
  { key: 'scheduled_maintenance', label: 'Scheduled Maintenance', icon: 'settings-outline',         color: '#3B82F6', urgent: false },
  { key: 'inspection',            label: 'Inspection',            icon: 'search-outline',           color: '#8B5CF6', urgent: false },
  { key: 'battery_check',         label: 'Battery Check',         icon: 'battery-charging-outline', color: '#10B981', urgent: false },
  { key: 'software_update',       label: 'Software Update',       icon: 'cloud-download-outline',   color: '#06B6D4', urgent: false },
  { key: 'general_repair',        label: 'General Repair',        icon: 'hammer-outline',           color: '#F59E0B', urgent: false },
];

const PRIORITIES: { key: ServicePriority; label: string; color: string }[] = [
  { key: 'low',      label: 'Low',      color: '#6B7280' },
  { key: 'normal',   label: 'Normal',   color: '#3B82F6' },
  { key: 'high',     label: 'High',     color: '#F97316' },
  { key: 'critical', label: 'Critical', color: '#EF4444' },
];

// ─────────────────────────────────────────────────────────────────────────────
// CreateRequestScreen
// ─────────────────────────────────────────────────────────────────────────────
export default function CreateRequestScreen() {
  const navigation  = useNavigation<any>();
  const route       = useRoute<any>();
  const queryClient = useQueryClient();

  // ── State — identical to original ────────────────────────────────────────
  const [serviceType, setServiceType]             = useState<ServiceType>(route.params?.serviceType ?? 'emergency_charging');
  const [priority, setPriority]                   = useState<ServicePriority>('normal');
  const [description, setDescription]             = useState('');
  const [notes, setNotes]                         = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | undefined>();
  const [location, setLocation]                   = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [locationLoading, setLocationLoading]     = useState(false);
  const [showNoVehicleModal, setShowNoVehicleModal] = useState(false);
  const [scheduleEnabled, setScheduleEnabled]     = useState(false);
  const [scheduledAt, setScheduledAt]             = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return d;
  });
  const [pickerMode, setPickerMode]  = useState<'date' | 'time'>('date');
  const [showPicker, setShowPicker]  = useState(false);

  // ── Queries — identical to original ──────────────────────────────────────
  const { data: vehData } = useQuery({
    queryKey: QUERY_KEYS.userVehicles,
    queryFn: vehiclesApi.getMyVehicles,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const vehicles            = vehData?.vehicles ?? [];
  const selectedServiceType = SERVICE_TYPES.find((s) => s.key === serviceType)!;
  const isUrgent            = selectedServiceType?.urgent ?? false;
  const hasVehicles         = vehicles.length > 0;

  // ── Effects — identical to original ──────────────────────────────────────
  useEffect(() => {
    if (vehicles.length > 0 && !selectedVehicleId) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [vehicles]);

  useEffect(() => {
    if (isUrgent) setShowNoVehicleModal(false);
  }, [isUrgent]);

  // ── Location ──────────────────────────────────────────────────────────────
  // Three-stage approach fixes the silent failures seen in built APKs:
  //
  //  Stage 1 — System GPS toggle check
  //    getCurrentPositionAsync hangs forever if the device's Location toggle
  //    is off. hasServicesEnabledAsync() catches this immediately and tells
  //    the user exactly what to do, rather than spinning endlessly.
  //
  //  Stage 2 — canAskAgain (permanently denied)
  //    On Android, once a user taps "Don't ask again", the permission dialog
  //    never appears again and requestForegroundPermissionsAsync() returns
  //    'denied' instantly — looks like the button does nothing. We detect
  //    this with canAskAgain and send the user to App Settings instead.
  //
  //  Stage 3 — 15 s timeout + last-known-position fallback
  //    Cold-start GPS on Android can take 30–60 s indoors. We race against
  //    a 15-second timer; if it loses, we fall back to the device's last
  //    cached position (usually good enough for a service request address).
  const getLocation = async () => {
    setLocationLoading(true);
    try {
      // ── Stage 1: is the system-level Location toggle on? ─────────────────
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert(
          'Location Turned Off',
          'Please enable Location Services in your device Settings, then try again.',
          [{ text: 'OK' }]
        );
        return;
      }

      // ── Stage 2: request permission, handle permanent denial ──────────────
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!canAskAgain) {
          // User tapped "Don't ask again" — dialog will never show again.
          // Only way to fix this is to send them to App Settings.
          Alert.alert(
            'Location Permission Denied',
            'You previously denied location access. Please go to App Settings and enable Location to continue.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => Linking.openSettings(),
              },
            ]
          );
        } else {
          Alert.alert(
            'Permission Denied',
            'Location permission is required to share your position with the technician.'
          );
        }
        return;
      }

      // ── Stage 3: get position with timeout + last-known fallback ──────────
      let pos: Location.LocationObject | null = null;
      try {
        // Race the GPS request against a 15-second timeout.
        // Balanced accuracy avoids the long cold-start of High accuracy
        // while still giving a good enough result for a service request.
        pos = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 15000)
          ),
        ]) as Location.LocationObject;
      } catch {
        // GPS timed out — try the device's last cached position instead.
        // maxAge: 300000 = accept a position up to 5 minutes old.
        pos = await Location.getLastKnownPositionAsync({ maxAge: 300000 });
      }

      if (!pos) {
        Alert.alert(
          'Location Unavailable',
          'Could not detect your location. Please step outside or closer to a window, then try again.'
        );
        return;
      }

      // ── Reverse geocode to a human-readable address ───────────────────────
      // Wrapped separately: reverseGeocodeAsync can throw a NATIVE error on
      // Android devices without Google Play Services (or when it's throttled).
      // If that happens we must NOT crash — fall back to raw coordinates so
      // the request can still be submitted.
      let address: string;
      try {
        const [geocode] = await Location.reverseGeocodeAsync({
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        address = geocode
          ? [geocode.name, geocode.street, geocode.city, geocode.region]
              .filter(Boolean)
              .join(', ')
          : `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
      } catch {
        // Geocoding failed (no Play Services / offline) — use coordinates.
        address = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
      }

      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, address });

    } catch (err: any) {
      Alert.alert('Location Error', err.message ?? 'Could not get your location.');
    } finally {
      setLocationLoading(false);
    }
  };

  // ── Date picker — identical to original ──────────────────────────────────
  const handleDateChange = (event: any, selected?: Date) => {
    if (event.type === 'dismissed') { setShowPicker(false); return; }
    if (!selected) return;
    if (pickerMode === 'date') {
      const updated = new Date(scheduledAt);
      updated.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setScheduledAt(updated);
      if (Platform.OS === 'android') { setPickerMode('time'); setShowPicker(true); }
      else { setShowPicker(false); }
    } else {
      const updated = new Date(scheduledAt);
      updated.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setScheduledAt(updated);
      setShowPicker(false); setPickerMode('date');
    }
  };
  const openDatePicker = () => { setPickerMode('date'); setShowPicker(true); };

  // ── Submit — identical to original ───────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: servicesApi.createRequest,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myRequests() });
      Alert.alert('Request Submitted', 'A technician will be assigned shortly.', [
        {
          text: 'View Request',
          onPress: () => navigation.replace('RequestDetail', { requestId: data.request.id }),
        },
      ]);
    },
    onError: (err: any) => Alert.alert('Submission Failed', err.message),
  });

  const doSubmit = useCallback(() => {
    if (!location) {
      Alert.alert('Location Required', 'Please share your current location to continue.');
      return;
    }
    createMutation.mutate({
      service_type:     serviceType,
      priority,
      description:      description.trim() || undefined,
      customer_notes:   notes.trim() || undefined,
      user_vehicle_id:  selectedVehicleId,
      location_lat:     location.lat,
      location_lng:     location.lng,
      location_address: location.address,
      scheduled_at:     (!isUrgent && scheduleEnabled) ? scheduledAt.toISOString() : undefined,
    });
  }, [location, serviceType, priority, description, notes, selectedVehicleId, isUrgent, scheduleEnabled, scheduledAt, createMutation]);

  const handleSubmit = useCallback(() => {
    if (!location) {
      Alert.alert('Location Required', 'Please share your current location to continue.');
      return;
    }
    if (!hasVehicles && !isUrgent) {
      setShowNoVehicleModal(true);
      return;
    }
    doSubmit();
  }, [location, hasVehicles, isUrgent, doSubmit]);

  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  // ── Render ────────────────────────────────────────────────────────────────
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
          <Text style={styles.headerTitle}>New Service Request</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >

          {/* ── Service Type ──────────────────────────────────────────── */}
          <Text style={styles.label}>Service Type</Text>
          <View style={styles.serviceGrid}>
            {SERVICE_TYPES.map((st) => {
              const active = serviceType === st.key;
              return (
                <TouchableOpacity
                  key={st.key}
                  style={[
                    styles.serviceCard,
                    active && {
                      borderColor:     st.color,
                      backgroundColor: hexRgba(st.color, 0.1),
                    },
                  ]}
                  onPress={() => setServiceType(st.key)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={st.icon}
                    size={26}
                    color={active ? st.color : COLORS.textMuted}
                  />
                  <Text style={[
                    styles.serviceLabel,
                    active && { color: st.color },
                  ]}>
                    {st.label}
                  </Text>
                  {st.urgent && (
                    <View style={[styles.urgentBadge, { backgroundColor: st.color }]}>
                      <Text style={styles.urgentBadgeText}>URGENT</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Priority ──────────────────────────────────────────────── */}
          <Text style={styles.label}>Priority</Text>
          <View style={styles.chipRow}>
            {PRIORITIES.map((p) => {
              const active = priority === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    styles.chip,
                    active && { backgroundColor: p.color, borderColor: p.color },
                  ]}
                  onPress={() => setPriority(p.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[
                    styles.chipText,
                    active && { color: COLORS.white, fontWeight: '700' },
                  ]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Schedule (planned types only) ─────────────────────────── */}
          {!isUrgent && (
            <>
              <Text style={styles.label}>Schedule</Text>
              <View style={styles.scheduleRow}>
                <TouchableOpacity
                  style={[styles.scheduleToggle, scheduleEnabled && styles.scheduleToggleActive]}
                  onPress={() => setScheduleEnabled((v) => !v)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={scheduleEnabled ? 'calendar' : 'calendar-outline'}
                    size={18}
                    color={scheduleEnabled ? COLORS.bgDark : COLORS.textSecondary}
                  />
                  <Text style={[
                    styles.scheduleToggleText,
                    scheduleEnabled && { color: COLORS.bgDark },
                  ]}>
                    {scheduleEnabled ? 'Scheduled' : 'Schedule for later'}
                  </Text>
                </TouchableOpacity>

                {scheduleEnabled && (
                  <TouchableOpacity style={styles.dateDisplay} onPress={openDatePicker}>
                    <Ionicons name="time-outline" size={15} color={COLORS.primary} />
                    <Text style={styles.dateDisplayText}>
                      {scheduledAt.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {'  ·  '}
                      {scheduledAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Ionicons name="pencil-outline" size={13} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
              </View>

              {showPicker && (
                <DateTimePicker
                  value={scheduledAt}
                  mode={pickerMode}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={new Date(Date.now() + 60 * 60 * 1000)}
                  onChange={handleDateChange}
                />
              )}
            </>
          )}

          {/* ── Vehicle Selector ──────────────────────────────────────── */}
          <Text style={styles.label}>Vehicle</Text>

          {hasVehicles ? (
            vehicles.map((v) => (
              <TouchableOpacity
                key={v.id}
                style={[
                  styles.vehOption,
                  selectedVehicleId === v.id && styles.vehOptionActive,
                ]}
                onPress={() => setSelectedVehicleId(v.id)}
                activeOpacity={0.8}
              >
                <View style={styles.vehOptionLeft}>
                  <View style={[
                    styles.vehIconBox,
                    selectedVehicleId === v.id && styles.vehIconBoxActive,
                  ]}>
                    <Ionicons
                      name="car-sport-outline"
                      size={18}
                      color={selectedVehicleId === v.id ? COLORS.primary : COLORS.textMuted}
                    />
                  </View>
                  <Text style={styles.vehOptionText}>
                    {v.make} {v.model}{v.year ? ` (${v.year})` : ''}
                  </Text>
                </View>
                {selectedVehicleId === v.id && (
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))
          ) : isUrgent ? (
            // URGENT: soft inline warning — don't block submission
            <View style={styles.noVehicleWarning}>
              <Ionicons name="warning-outline" size={18} color={COLORS.warning} />
              <Text style={styles.noVehicleWarningText}>
                No vehicle on your account — technician will confirm vehicle details on arrival.
              </Text>
            </View>
          ) : (
            // PLANNED: stronger prompt with Add Vehicle shortcut
            <View style={styles.noVehiclePrompt}>
              <View style={styles.noVehiclePromptHeader}>
                <Ionicons name="car-outline" size={22} color={COLORS.primary} />
                <Text style={styles.noVehiclePromptTitle}>No vehicle added yet</Text>
              </View>
              <Text style={styles.noVehiclePromptBody}>
                Adding your vehicle helps the technician prepare the right tools and parts before arriving.
              </Text>
              <TouchableOpacity
                style={styles.addVehicleBtn}
                onPress={() => navigation.navigate('AddVehicle')}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={16} color={COLORS.bgDark} />
                <Text style={styles.addVehicleBtnText}>Add Vehicle Now</Text>
              </TouchableOpacity>
              <Text style={styles.orContinue}>or continue without a vehicle</Text>
            </View>
          )}

          {/* ── Location ──────────────────────────────────────────────── */}
          <Text style={styles.label}>Your Location</Text>
          {location ? (
            <Card style={styles.locationCard}>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={20} color={COLORS.success} />
                <Text style={styles.locationText} numberOfLines={2}>{location.address}</Text>
              </View>
              <TouchableOpacity onPress={getLocation} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.refreshLoc}>Refresh location</Text>
              </TouchableOpacity>
            </Card>
          ) : (
            <Button
              title="Get My Location"
              onPress={getLocation}
              loading={locationLoading}
              variant="secondary"
              icon={<Ionicons name="location-outline" size={17} color={COLORS.textPrimary} />}
              style={styles.locationBtn}
            />
          )}

          {/* ── Description & Notes ───────────────────────────────────── */}
          <Input
            label="Issue Description"
            placeholder="Describe the issue (e.g. car won't charge, battery dead…)"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
          <Input
            label="Additional Notes (optional)"
            placeholder="Any extra information for the technician"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
          />

          {/* ── Submit ────────────────────────────────────────────────── */}
          <Button
            title="Submit Request"
            onPress={handleSubmit}
            loading={createMutation.isPending}
            style={styles.submitBtn}
            icon={
              !createMutation.isPending
                ? <Ionicons name="send-outline" size={17} color={COLORS.bgDark} />
                : undefined
            }
          />

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── No-vehicle modal (planned service types only) ─────────────── */}
      <Modal
        visible={showNoVehicleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNoVehicleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>

            {/* Car icon replaces 🚗 emoji */}
            <View style={styles.modalIconWrap}>
              <Ionicons name="car-sport-outline" size={32} color={COLORS.primary} />
            </View>

            <Text style={styles.modalTitle}>No Vehicle Added</Text>
            <Text style={styles.modalBody}>
              For a {selectedServiceType?.label ?? 'scheduled'} visit, adding your vehicle helps the
              technician prepare the right tools and parts before arriving — saving you time.
            </Text>

            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={() => {
                setShowNoVehicleModal(false);
                navigation.navigate('AddVehicle');
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={18} color={COLORS.bgDark} />
              <Text style={styles.modalPrimaryBtnText}>Add Vehicle</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalSecondaryBtn}
              onPress={() => { setShowNoVehicleModal(false); doSubmit(); }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalSecondaryBtnText}>Continue Without Vehicle</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowNoVehicleModal(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

    </SafeAreaView>
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

  // ── Field label ───────────────────────────────────────────────────────────
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },

  // ── Service type grid ─────────────────────────────────────────────────────
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  serviceCard: {
    width: '47%',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: 6,
    position: 'relative',
  },
  serviceLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  urgentBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgentBadgeText: {
    color: COLORS.white,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // ── Priority chips ────────────────────────────────────────────────────────
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: SPACING.md,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },

  // ── Schedule ──────────────────────────────────────────────────────────────
  scheduleRow: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: SPACING.md,
  },
  scheduleToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  scheduleToggleActive: {
    backgroundColor: COLORS.primary,
    borderColor:     COLORS.primary,
  },
  scheduleToggleText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    // rgba instead of COLORS.primary + '55'
    borderColor:     'rgba(127, 191, 49, 0.33)',
    backgroundColor: 'rgba(127, 191, 49, 0.07)',
  },
  dateDisplayText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 13,
    flex: 1,
  },

  // ── Vehicle options ───────────────────────────────────────────────────────
  vehOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  vehOptionActive: {
    borderColor:     COLORS.primary,
    backgroundColor: 'rgba(127, 191, 49, 0.08)',
  },
  vehOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  vehIconBox: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgCardLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehIconBoxActive: {
    backgroundColor: 'rgba(127, 191, 49, 0.12)',
    borderColor:     'rgba(127, 191, 49, 0.25)',
  },
  vehOptionText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    flex: 1,
  },

  // ── No-vehicle — URGENT (soft warning) ───────────────────────────────────
  noVehicleWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    // rgba instead of '#F59E0B18' and '#F59E0B44'
    backgroundColor: 'rgba(245, 158, 11, 0.09)',
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     'rgba(245, 158, 11, 0.27)',
    padding:         SPACING.md,
    marginBottom:    SPACING.sm,
  },
  noVehicleWarningText: {
    color: COLORS.warning,
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },

  // ── No-vehicle — PLANNED (stronger prompt) ────────────────────────────────
  noVehiclePrompt: {
    backgroundColor: COLORS.bgCard,
    borderRadius:    RADIUS.md,
    borderWidth:     1.5,
    // rgba instead of COLORS.primary + '55'
    borderColor:     'rgba(127, 191, 49, 0.33)',
    padding:         SPACING.md,
    marginBottom:    SPACING.sm,
    gap:             10,
  },
  noVehiclePromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noVehiclePromptTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  noVehiclePromptBody: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  addVehicleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius:    RADIUS.md,
    shadowColor:     COLORS.primary,
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.30,
    shadowRadius:    8,
    elevation:       5,
  },
  addVehicleBtnText: {
    color: COLORS.bgDark,
    fontWeight: '700',
    fontSize: 14,
  },
  orContinue: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },

  // ── Location ──────────────────────────────────────────────────────────────
  locationCard: {
    marginBottom: SPACING.md,
  },
  locationRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'flex-start',
  },
  locationText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  refreshLoc: {
    color: COLORS.primary,
    fontSize: 13,
    marginTop: 8,
  },
  locationBtn: {
    marginBottom: SPACING.md,
  },

  // ── Submit button ─────────────────────────────────────────────────────────
  submitBtn: {
    marginTop: SPACING.sm,
    shadowColor:  COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius:  12,
    elevation:     8,
  },

  // ── Modal ─────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius:    RADIUS.xl,
    borderWidth:     1,
    borderColor:     COLORS.border,
    padding:         SPACING.lg,
    width:           '100%',
    alignItems:      'center',
    gap:             12,
  },
  modalIconWrap: {
    width:           68,
    height:          68,
    borderRadius:    34,
    backgroundColor: 'rgba(127, 191, 49, 0.1)',
    borderWidth:     1,
    borderColor:     'rgba(127, 191, 49, 0.2)',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    4,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalBody: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
  modalPrimaryBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    borderRadius:    RADIUS.md,
    width:           '100%',
    shadowColor:     COLORS.primary,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.30,
    shadowRadius:    10,
    elevation:       6,
  },
  modalPrimaryBtnText: {
    color:      COLORS.bgDark,
    fontWeight: '800',
    fontSize:   15,
  },
  modalSecondaryBtn: {
    paddingVertical: 12,
    borderRadius:    RADIUS.md,
    width:           '100%',
    borderWidth:     1.5,
    borderColor:     COLORS.border,
    alignItems:      'center',
  },
  modalSecondaryBtnText: {
    color:      COLORS.textSecondary,
    fontSize:   14,
    fontWeight: '600',
  },
  modalCancelBtn: {
    paddingVertical: 6,
  },
  modalCancelText: {
    color:    COLORS.textMuted,
    fontSize: 13,
  },
});