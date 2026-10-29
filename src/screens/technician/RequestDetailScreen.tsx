import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { servicesApi } from '../../api/services';
import {
  QUERY_KEYS,
  SERVICE_TYPE_LABELS,
  SERVICE_STATUS_LABELS,
  STATUS_COLORS,
} from '../../constants/api';
import { ServiceStatus } from '../../types';
import { Card, Button, StatusBadge } from '../../components/common';
import { COLORS, SPACING, RADIUS } from '../../theme';

// ─── Safe rgba helper ─────────────────────────────────────────────────────────
function hexRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Date helper — always render in Accra / UTC+0 ────────────────────────────
function fmtDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GH', {
    timeZone: 'Africa/Accra',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// ─── Status flow ──────────────────────────────────────────────────────────────
const STATUS_FLOW: ServiceStatus[] = [
  'assigned', 'accepted', 'on_the_way', 'arrived', 'in_progress', 'completed',
];

const ADVANCE_LABELS: Partial<Record<ServiceStatus, string>> = {
  assigned:    'Accept Request',
  accepted:    "I'm On The Way",
  on_the_way:  "I've Arrived",
  arrived:     'Start Service',
  in_progress: 'Mark Completed',
};

// ─── Status → Ionicons icon (replaces STATUS_EMOJI record of 7 emojis) ───────
const STATUS_ICON: Partial<Record<ServiceStatus, keyof typeof Ionicons.glyphMap>> = {
  assigned:    'clipboard-outline',
  accepted:    'checkmark-circle-outline',
  on_the_way:  'car-outline',
  arrived:     'location-outline',
  in_progress: 'construct-outline',
  completed:   'checkmark-circle',
  cancelled:   'close-circle-outline',
};
const FALLBACK_STATUS_ICON: keyof typeof Ionicons.glyphMap = 'time-outline';

// ─────────────────────────────────────────────────────────────────────────────
// TechRequestDetail
// ─────────────────────────────────────────────────────────────────────────────
export default function TechRequestDetail() {
  const navigation  = useNavigation<any>();
  const route       = useRoute<any>();
  const { requestId } = route.params;
  const queryClient   = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: QUERY_KEYS.serviceRequest(requestId),
    queryFn:  () => servicesApi.getRequest(requestId),
    refetchInterval: 20000,
    refetchOnWindowFocus: false,
    retry: false,
    throwOnError: false,
  });

  // ── Mutation — identical to original ─────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: (status: ServiceStatus) =>
      servicesApi.updateRequest(requestId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.serviceRequest(requestId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminRequests() });
    },
    onError: (err: any) => Alert.alert('Update Failed', err.message),
  });

  const goBack      = useCallback(() => navigation.goBack(), [navigation]);
  const handleRefresh = useCallback(() => refetch(), [refetch]);

  // ── Shared header ─────────────────────────────────────────────────────────
  const Header = ({ subtitle }: { subtitle: string }) => (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.headerBtn}
        onPress={goBack}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{subtitle}</Text>
      <TouchableOpacity
        style={styles.headerBtn}
        onPress={handleRefresh}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="refresh" size={20} color={COLORS.primary} />
      </TouchableOpacity>
    </View>
  );

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading || !data?.request) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <Header subtitle="Request Detail" />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading request…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const req = data.request;
 
  const currentIdx = STATUS_FLOW.indexOf(req.status as ServiceStatus);
  const nextStatus = STATUS_FLOW[currentIdx + 1] as ServiceStatus | undefined;
  const isTerminal = req.status === 'completed' || req.status === 'cancelled';
  const canAdvance = !isTerminal && currentIdx !== -1 && nextStatus !== undefined;

  const handleAdvance = () => {
    if (!nextStatus) return;
    const label = ADVANCE_LABELS[req.status as ServiceStatus] ?? `Mark as ${SERVICE_STATUS_LABELS[nextStatus]}`;
    Alert.alert(
      label,
      `Confirm: change status to "${SERVICE_STATUS_LABELS[nextStatus]}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => updateMutation.mutate(nextStatus) },
      ]
    );
  };

  const openNavigation = () => {
    if (!req.location?.lat || !req.location?.lng) {
      Alert.alert('No Location', "Customer's location is not available.");
      return;
    }
    const { lat, lng } = req.location;
    const url = Platform.OS === 'ios'
      ? `maps://app?daddr=${lat},${lng}`
      : `google.navigation:q=${lat},${lng}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com?q=${lat},${lng}`)
    );
  };

  const statusColor  = STATUS_COLORS[req.status] ?? COLORS.primary;
  const statusIcon   = STATUS_ICON[req.status as ServiceStatus] ?? FALLBACK_STATUS_ICON;
  const actionLabel  = canAdvance
    ? ADVANCE_LABELS[req.status as ServiceStatus] ?? `Mark as ${SERVICE_STATUS_LABELS[nextStatus!]}`
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Header subtitle={`Request #${req.id}`} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >

        {/* ── Status banner ──────────────────────────────────────── */}
        {/* hexRgba replaces statusColor + '18' and + '44' */}
        <View style={[
          styles.statusBanner,
          {
            backgroundColor: hexRgba(statusColor, 0.1),
            borderColor:      hexRgba(statusColor, 0.27),
          },
        ]}>
          {/* STATUS_ICON replaces the STATUS_EMOJI string map */}
          <View style={[
            styles.statusIconBox,
            { borderColor: hexRgba(statusColor, 0.3) },
          ]}>
            <Ionicons name={statusIcon} size={26} color={statusColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusLabel, { color: statusColor }]}>
              {SERVICE_STATUS_LABELS[req.status] ?? req.status}
            </Text>
            <Text style={styles.serviceTypeText}>
              {SERVICE_TYPE_LABELS[req.service_type] ?? req.service_type}
            </Text>
          </View>
          <StatusBadge status={req.priority} />
        </View>

        {/* ── Progress bar ───────────────────────────────────────── */}
        <Card>
          <Text style={styles.sectionTitle}>Progress</Text>
          <View style={styles.progressRow}>
            {STATUS_FLOW.map((s, i) => {
              const done    = currentIdx !== -1 && i <= currentIdx;
              const current = i === currentIdx;
              const color   = done ? (STATUS_COLORS[s] ?? COLORS.primary) : COLORS.border;
              return (
                <View key={s} style={styles.progressStep}>
                  <View style={[
                    styles.progressDot,
                    { backgroundColor: color, transform: [{ scale: current ? 1.4 : 1 }] },
                  ]} />
                  {i < STATUS_FLOW.length - 1 && (
                    <View style={[
                      styles.progressLine,
                      { backgroundColor: done && i < currentIdx ? color : COLORS.border },
                    ]} />
                  )}
                  <Text
                    style={[
                      styles.progressLabel,
                      { color: done ? COLORS.textPrimary : COLORS.textMuted },
                      current && { color: statusColor, fontWeight: '700' },
                    ]}
                    numberOfLines={2}
                  >
                    {SERVICE_STATUS_LABELS[s]}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* ── Customer card ──────────────────────────────────────── */}
        <Card>
          <Text style={styles.sectionTitle}>Customer</Text>
          <View style={styles.customerRow}>
            {/* 👤 emoji → Ionicons person in a styled circle */}
            <View style={styles.customerAvatar}>
              <Ionicons name="person" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.customerName}>{req.customer_name}</Text>
              {req.customer_email && (
                <Text style={styles.customerSub}>{req.customer_email}</Text>
              )}
            </View>
            {req.customer_phone && (
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => Linking.openURL(`tel:${req.customer_phone}`)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="call" size={20} color={COLORS.success} />
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* ── Location card ──────────────────────────────────────── */}
        {req.location?.lat && req.location?.lng && (
          <Card>
            <Text style={styles.sectionTitle}>Customer Location</Text>            
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={15} color={COLORS.textMuted} />
              <Text style={styles.locationText} numberOfLines={2}>
                {req.location.lat} , {req.location.lng}
              </Text>              
            </View>
            {
              (req.status === 'assigned') && 
              <View style={styles.locationRow}>
                <Ionicons name="paper-plane-sharp" size={15} color={COLORS.textMuted} />              
                    <Text style={styles.locationText} numberOfLines={2}>
                      Accept the request below to Navigate to the customer
                    </Text>                        
              </View>
            }
            
            {(req.status === 'accepted' || req.status === 'on_the_way') && (
              <TouchableOpacity style={styles.navBtn} onPress={openNavigation} activeOpacity={0.85}>
                <Ionicons name="navigate" size={15} color={COLORS.bgDark} />
                <Text style={styles.navBtnText}>Navigate to Customer</Text>
              </TouchableOpacity>
            )}
          </Card>
        )}

        {/* ── Request details ────────────────────────────────────── */}
        <Card>
          <Text style={styles.sectionTitle}>Details</Text>
          {req.user_vehicle_title   && <DetailRow label="Vehicle"    value={req.user_vehicle_title} />}
          {req.user_vehicle_plate   && <DetailRow label="Vehicle Plate"    value={req.user_vehicle_plate} />}
          {req.description    && <DetailRow label="Description"    value={req.description} />}
          {req.customer_notes && <DetailRow label="Customer Notes" value={req.customer_notes} />}
          {req.admin_notes    && <DetailRow label="Admin Notes"    value={req.admin_notes} />}
          <DetailRow label="Priority"  value={req.priority_label ?? req.priority} />
          <DetailRow label="Submitted" value={fmtDateTime(req.created_at)} />
          {req.scheduled_at && (
            <DetailRow label="Scheduled" value={fmtDateTime(req.scheduled_at)} isLast />
          )}
          {!req.scheduled_at && <View style={styles.detailRowLastBorder} />}
        </Card>

        {/* ── Action button ──────────────────────────────────────── */}
        {canAdvance && (
          <Button
            title={actionLabel!}
            onPress={handleAdvance}
            loading={updateMutation.isPending}
            style={styles.actionBtn}
            icon={
              !updateMutation.isPending
                ? <Ionicons name="arrow-forward-circle-outline" size={18} color={COLORS.bgDark} />
                : undefined
            }
          />
        )}

        {/* ── Completed banner ───────────────────────────────────── */}
        {/* hexRgba replaces COLORS.success + '18' and + '55' */}
        {req.status === 'completed' && (
          <View style={[
            styles.statusEndBanner,
            {
              backgroundColor: hexRgba(COLORS.success, 0.09),
              borderColor:      hexRgba(COLORS.success, 0.33),
            },
          ]}>
            {/* 🎉 emoji → Ionicons */}
            <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusEndTitle, { color: COLORS.success }]}>
                Service Completed
              </Text>
              {req.completed_at && (
                <Text style={styles.statusEndSub}>{fmtDateTime(req.completed_at)}</Text>
              )}
            </View>
          </View>
        )}

        {/* ── Cancelled banner ───────────────────────────────────── */}
        {/* hexRgba replaces COLORS.error + '18' and + '55' */}
        {req.status === 'cancelled' && (
          <View style={[
            styles.statusEndBanner,
            {
              backgroundColor: hexRgba(COLORS.error, 0.09),
              borderColor:      hexRgba(COLORS.error, 0.33),
            },
          ]}>
            <Ionicons name="close-circle" size={24} color={COLORS.error} />
            <Text style={[styles.statusEndTitle, { color: COLORS.error }]}>
              Request Cancelled
            </Text>
          </View>
        )}

        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DetailRow
// ─────────────────────────────────────────────────────────────────────────────
function DetailRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.detailRow, isLast && { borderBottomWidth: 0 }]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
    backgroundColor: COLORS.bgDark,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerBtn: {
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

  // ── Loading ───────────────────────────────────────────────────────────────
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: {
    padding: SPACING.lg,
    paddingBottom: 48,
  },

  // ── Status banner ─────────────────────────────────────────────────────────
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  statusIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: '800',
  },
  serviceTypeText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },

  // ── Section title (shared) ────────────────────────────────────────────────
  sectionTitle: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.md,
  },

  // ── Progress bar ──────────────────────────────────────────────────────────
  progressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  progressStep: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  progressLine: {
    position: 'absolute',
    top: 4,
    left: '50%',
    right: '-50%',
    height: 2,
  },
  progressLabel: {
    fontSize: 10,
    marginTop: 5,
    textAlign: 'center',
    lineHeight: 13,
  },

  // ── Customer card ─────────────────────────────────────────────────────────
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  customerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    // rgba replaces COLORS.primary + '1A'
    backgroundColor: 'rgba(127, 191, 49, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(127, 191, 49, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerName: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
  customerSub: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    // rgba replaces COLORS.success + '20'
    backgroundColor: 'rgba(127, 191, 49, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(127, 191, 49, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Location card ─────────────────────────────────────────────────────────
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: SPACING.md,
  },
  locationText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    alignSelf: 'flex-start',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  navBtnText: {
    color: COLORS.bgDark,
    fontWeight: '700',
    fontSize: 13,
  },

  // ── Detail rows ───────────────────────────────────────────────────────────
  detailRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailRowLastBorder: {
    height: 0,
  },
  detailLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailValue: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },

  // ── Action button ─────────────────────────────────────────────────────────
  actionBtn: {
    marginBottom: SPACING.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },

  // ── Status end banners (completed / cancelled) ────────────────────────────
  statusEndBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  statusEndTitle: {
    fontWeight: '800',
    fontSize: 15,
  },
  statusEndSub: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
});