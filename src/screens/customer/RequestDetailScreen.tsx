import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import { servicesApi } from '../../api/services';
import {
  QUERY_KEYS,
  SERVICE_TYPE_LABELS,
  SERVICE_STATUS_LABELS,
  STATUS_COLORS,
} from '../../constants/api';
import { ServiceStatus } from '../../types';
import { Card, StatusBadge, Button } from '../../components/common';
import { COLORS, SPACING, RADIUS } from '../../theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function hexRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Accra / UTC+0 date formatting
const ACCRA: Intl.DateTimeFormatOptions = { timeZone: 'Africa/Accra' };

function parseAccraTime(dateStr: string): Date {
  if (!dateStr) return new Date();
  if (/Z$|[+-]\d{2}:\d{2}$/.test(dateStr)) return new Date(dateStr);
  return new Date(dateStr.replace(' ', 'T') + 'Z');
}

function fmtDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GH', {
    ...ACCRA,
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function fmtShort(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GH', {
    ...ACCRA,
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// "X min ago" relative label for the tech location's recorded_at
function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff  = Date.now() - parseAccraTime(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

// Haversine distance in km between two lat/lng pairs
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ACTIVE_STATUSES: ServiceStatus[] = [
  'pending', 'assigned', 'accepted', 'on_the_way', 'arrived', 'in_progress',
];

const STATUS_TIMELINE: ServiceStatus[] = [
  'pending', 'assigned', 'accepted', 'on_the_way', 'arrived', 'in_progress', 'completed',
];

// Statuses where it makes sense to show the live map
// (tech has accepted and is moving / working)
const TRACKING_STATUSES: ServiceStatus[] = [
  'accepted', 'on_the_way', 'arrived', 'in_progress',
];

// ─────────────────────────────────────────────────────────────────────────────
// RequestDetailScreen
// ─────────────────────────────────────────────────────────────────────────────
export default function RequestDetailScreen() {
  const navigation  = useNavigation<any>();
  const route       = useRoute<any>();
  const { requestId }  = route.params;
  const queryClient    = useQueryClient();
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: QUERY_KEYS.serviceRequest(requestId),
    queryFn:  () => servicesApi.getRequest(requestId),
    refetchInterval: 20000,
    refetchOnWindowFocus: false,
    retry: false,
    throwOnError: false,
  });

  const { data: techLoc } = useQuery({
    queryKey: QUERY_KEYS.technicianLocation(requestId),
    queryFn:  () => servicesApi.getTechnicianLocation(requestId),
    // Only poll when the request is in an active state
    enabled:  ACTIVE_STATUSES.includes(data?.request?.status as ServiceStatus),
    refetchInterval: 15000,   // matches backend push interval
    refetchOnWindowFocus: false,
    retry: false,
    throwOnError: false,
  });

  // ── Cancel mutation ───────────────────────────────────────────────────────
  const cancelMutation = useMutation({
    mutationFn: () => servicesApi.cancelRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.serviceRequest(requestId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myRequests() });
      Alert.alert('Cancelled', 'Your request has been cancelled.');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  // ── Push customer location ────────────────────────────────────────────────
  useEffect(() => {
    const req = data?.request;
    if (!req || !ACTIVE_STATUSES.includes(req.status)) return;

    const pushLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await servicesApi.updateMyLocation(requestId, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      } catch {}
    };

    pushLocation();
    locationIntervalRef.current = setInterval(pushLocation, 30000);
    return () => {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    };
  }, [data?.request?.status]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleCancel = useCallback(() => {
    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel this service request?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel', style: 'destructive', onPress: () => cancelMutation.mutate() },
      ]
    );
  }, [cancelMutation]);

  // ── Shared header ─────────────────────────────────────────────────────────
  const Header = ({ subtitle }: { subtitle: string }) => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={goBack}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{subtitle}</Text>
      <TouchableOpacity style={styles.refreshBtn} onPress={() => refetch()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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

  const isActive  = ACTIVE_STATUSES.includes(req.status);
  const canCancel = req.status === 'pending';
  const statusIdx = STATUS_TIMELINE.indexOf(req.status as ServiceStatus);

  // Status → timestamp map
  const statusTimestamps: Record<string, string> = {};
  if (req.status_log?.length) {
    for (const entry of req.status_log) {
      if (entry.new_status && !statusTimestamps[entry.new_status]) {
        statusTimestamps[entry.new_status] = entry.changed_at;
      }
    }
  }
  statusTimestamps['pending'] = statusTimestamps['pending'] ?? req.created_at;

  const bannerIcon =
    req.status === 'completed' ? 'checkmark-circle'
    : req.status === 'cancelled' ? 'close-circle'
    : 'time-outline';
  const bannerColor = STATUS_COLORS[req.status] ?? COLORS.primary;

  // Live tracking eligibility
  // techLoc.lat/lng come from the backend PHP function as floats
  const hasTechLoc  = !!(techLoc?.lat && techLoc?.lng);
  const hasCustomerLoc = !!(
    (req as any).location_lat &&
    (req as any).location_lng
  );
  const showLiveTracking =
    hasTechLoc &&
    TRACKING_STATUSES.includes(req.status as ServiceStatus);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Header subtitle={`Request #${req.id}`} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >

        {/* ── Status banner ────────────────────────────────────────── */}
        <View style={[styles.statusBanner, { backgroundColor: hexRgba(bannerColor, 0.1) }]}>
          <View style={[styles.statusIconBox, { borderColor: hexRgba(bannerColor, 0.3) }]}>
            <Ionicons name={bannerIcon} size={28} color={bannerColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusLabel, { color: bannerColor }]}>
              {SERVICE_STATUS_LABELS[req.status]}
            </Text>
            <Text style={styles.statusSub}>
              {SERVICE_TYPE_LABELS[req.service_type] || req.service_type}
            </Text>
          </View>
        </View>

        {/* ── Status timeline ──────────────────────────────────────── */}
        <Card>
          <Text style={styles.sectionTitle}>Progress</Text>
          {STATUS_TIMELINE.map((s, i) => {
            const done      = i <= statusIdx;
            const active    = i === statusIdx;
            const timestamp = statusTimestamps[s];
            const dotColor  = active
              ? (STATUS_COLORS[s] ?? COLORS.primary)
              : done ? COLORS.success : COLORS.border;

            return (
              <View key={s} style={styles.timelineRow}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, { backgroundColor: dotColor }, active && styles.timelineDotActive]} />
                  {i < STATUS_TIMELINE.length - 1 && (
                    <View style={[styles.timelineLine,
                      { backgroundColor: done && i < statusIdx ? COLORS.success : COLORS.border }]} />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <View style={styles.timelineLabelRow}>
                    {active ? (
                      <Ionicons name="play-circle-outline" size={14} color={dotColor} />
                    ) : done ? (
                      <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.success} />
                    ) : (
                      <Ionicons name="ellipse-outline" size={14} color={COLORS.border} />
                    )}
                    <Text style={[styles.timelineLabel,
                      done && styles.timelineLabelDone,
                      active && { color: dotColor, fontWeight: '700' }]}>
                      {SERVICE_STATUS_LABELS[s]}
                    </Text>
                  </View>
                  {timestamp && done ? (
                    <Text style={styles.timelineTime}>{fmtShort(timestamp)}</Text>
                  ) : !done ? (
                    <Text style={styles.timelinePending}>Pending</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </Card>

        {/* ── Technician info ──────────────────────────────────────── */}
        {req.assigned_technician_name && (
          <Card>
            <Text style={styles.sectionTitle}>Assigned Technician</Text>
            <View style={styles.techRow}>
              <View style={styles.techAvatar}>
                <Ionicons name="person" size={22} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.techName}>{req.assigned_technician_name}</Text>
                {req.eta && <Text style={styles.techEta}>ETA: {req.eta}</Text>}
                {hasTechLoc && (
                  <View style={styles.techLocRow}>
                    <View style={styles.liveIndicator} />
                    <Text style={styles.techLocText}>Live tracking active</Text>
                  </View>
                )}
              </View>
              {req.customer_phone && (
                <TouchableOpacity style={styles.callBtn}
                  onPress={() => Linking.openURL(`tel:${req.customer_phone}`)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="call" size={18} color={COLORS.success} />
                </TouchableOpacity>
              )}
            </View>
          </Card>
        )}

        {/* ── Live Tracking Map ─────────────────────────────────────
            Shows only when the technician has a recorded location AND
            the request is in an active tracking status.
            techLoc.lat / techLoc.lng come directly from the PHP endpoint:
              SELECT lat, lng, recorded_at FROM ev360_technician_locations
              WHERE technician_id = %d AND service_request_id = %d
              ORDER BY recorded_at DESC LIMIT 1               ────────── */}
        {showLiveTracking && (
          <LiveTrackingCard
            techLat={techLoc!.lat}
            techLng={techLoc!.lng}
            techName={techLoc!.technician_name ?? req.assigned_technician_name}
            recordedAt={techLoc!.recorded_at}
            customerLat={hasCustomerLoc ? (req as any).location_lat : null}
            customerLng={hasCustomerLoc ? (req as any).location_lng : null}
            eta={req.eta}
          />
        )}

        {/* ── Request details ──────────────────────────────────────── */}
        <Card>
          <Text style={styles.sectionTitle}>Request Details</Text>
          <InfoRow label="Service Type" value={SERVICE_TYPE_LABELS[req.service_type] || req.service_type} />
          {(req as any).user_vehicle_title && <InfoRow label="Vehicle"      value={(req as any).user_vehicle_title} />}
          {(req as any).user_vehicle_plate && <InfoRow label="Plate"        value={(req as any).user_vehicle_plate} />}
          <InfoRow label="Priority"    value={req.priority} />
          <InfoRow label="Created"     value={fmtDateTime(req.created_at)} />
          {req.description         && <InfoRow label="Description"      value={req.description} />}
          {req.location_address    && <InfoRow label="Location"         value={req.location_address} />}
          {req.customer_notes      && <InfoRow label="Your Notes"       value={req.customer_notes} />}
          {req.technician_notes    && <InfoRow label="Technician Notes" value={req.technician_notes} />}
          {req.completed_at        && <InfoRow label="Completed"        value={fmtDateTime(req.completed_at)} />}
        </Card>

        {/* ── Cancel ───────────────────────────────────────────────── */}
        {canCancel && (
          <Button title="Cancel Request" onPress={handleCancel}
            variant="danger" loading={cancelMutation.isPending} />
        )}

        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LiveTrackingCard
// Shows a compact MapView with two markers:
//   • Green  pin — technician's current position (updates every 15 s)
//   • Blue   pin — customer's original request location
// The map auto-fits to include both pins. Distance and ETA are shown below.
// ─────────────────────────────────────────────────────────────────────────────
function LiveTrackingCard({
  techLat, techLng, techName, recordedAt,
  customerLat, customerLng,
  eta,
}: {
  techLat:     number;
  techLng:     number;
  techName:    string | null;
  recordedAt:  string | null;
  customerLat: number | null;
  customerLng: number | null;
  eta:         string | null | undefined;
}) {
  const mapRef = useRef<MapView>(null);

  // Calculate straight-line distance when both locations are available
  const distance = useMemo(() => {
    if (!customerLat || !customerLng) return null;
    const km = distanceKm(techLat, techLng, customerLat, customerLng);
    return km < 0.1
      ? `~${Math.round(km * 1000)} m away`
      : `${km.toFixed(1)} km away`;
  }, [techLat, techLng, customerLat, customerLng]);

  // Fit map to show both pins whenever tech location changes
  const fitMap = useCallback(() => {
    const coords = [{ latitude: techLat, longitude: techLng }];
    if (customerLat && customerLng) {
      coords.push({ latitude: customerLat, longitude: customerLng });
    }
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
      animated: true,
    });
  }, [techLat, techLng, customerLat, customerLng]);

  return (
    <View style={styles.trackCard}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={styles.trackHeader}>
        <View style={styles.trackHeaderLeft}>
          {/* Live indicator dot */}
          <View style={styles.liveIndicatorLarge} />
          <View>
            <Text style={styles.trackTitle}>Live Technician Tracking</Text>
            {recordedAt && (
              <Text style={styles.trackUpdated}>
                Updated {timeAgo(recordedAt)}
              </Text>
            )}
          </View>
        </View>
        <Ionicons name="locate-outline" size={18} color={COLORS.primary} />
      </View>

      {/* ── Map ──────────────────────────────────────────────────────── */}
      <View style={styles.mapWrapper}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude:      techLat,
            longitude:     techLng,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          zoomControlEnabled
          scrollEnabled={true}
          zoomEnabled={true}
          rotateEnabled={false}
          pitchEnabled={false}
          onMapReady={fitMap}
        >
          {/* Technician pin */}
          <Marker
            coordinate={{ latitude: techLat, longitude: techLng }}
            tracksViewChanges={false}
          >
            <TechMarker />
          </Marker>

          {/* Customer location pin (if available) */}
          {customerLat && customerLng && (
            <Marker
              coordinate={{ latitude: customerLat, longitude: customerLng }}
              tracksViewChanges={false}
            >
              <CustomerMarker />
            </Marker>
          )}
        </MapView>
      </View>

      {/* ── Info row ─────────────────────────────────────────────────── */}
      <View style={styles.trackInfo}>
        {distance && (
          <View style={styles.trackInfoItem}>
            <Ionicons name="navigate-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.trackInfoText}>{distance}</Text>
          </View>
        )}
        {eta ? (
          <View style={styles.trackInfoItem}>
            <Ionicons name="time-outline" size={14} color={COLORS.primary} />
            <Text style={[styles.trackInfoText, { color: COLORS.primary }]}>
              ETA: {eta}
            </Text>
          </View>
        ) : null}
        {techName && (
          <View style={styles.trackInfoItem}>
            <Ionicons name="person-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.trackInfoText} numberOfLines={1}>{techName}</Text>
          </View>
        )}
      </View>

    </View>
  );
}

// ── Custom map markers ────────────────────────────────────────────────────────
function TechMarker() {
  return (
    <View style={marker.wrap} collapsable={false}>
      <View style={[marker.bubble, { backgroundColor: COLORS.primary }]} collapsable={false}>
        <Ionicons name="build-outline" size={13} color="#fff" />
      </View>
      <View style={[marker.tail, { borderTopColor: COLORS.primary }]} collapsable={false} />
    </View>
  );
}

function CustomerMarker() {
  return (
    <View style={marker.wrap} collapsable={false}>
      <View style={[marker.bubble, { backgroundColor: COLORS.info }]} collapsable={false}>
        <Ionicons name="home-outline" size={13} color="#fff" />
      </View>
      <View style={[marker.tail, { borderTopColor: COLORS.info }]} collapsable={false} />
    </View>
  );
}

const marker = StyleSheet.create({
  wrap:   { alignItems: 'center', width: 34 },
  bubble: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  tail: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginTop: -1,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// InfoRow
// ─────────────────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  safe: { flex: 1, backgroundColor: COLORS.bgDark },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.bgDark, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  refreshBtn: {
    width: 40, height: 40, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { color: COLORS.textMuted, fontSize: 14 },

  scroll: { padding: SPACING.lg, paddingBottom: 48 },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    padding: SPACING.md, borderRadius: RADIUS.lg, marginBottom: SPACING.md,
  },
  statusIconBox: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.bgCard, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  statusLabel: { fontSize: 20, fontWeight: '800' },
  statusSub: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },

  sectionTitle: {
    color: COLORS.primary, fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.md,
  },

  timelineRow: { flexDirection: 'row', alignItems: 'flex-start' },
  timelineLeft: { alignItems: 'center', width: 24, marginRight: SPACING.sm, marginTop: 5 },
  timelineDot: { width: 10, height: 10, borderRadius: 5 },
  timelineDotActive: { width: 14, height: 14, borderRadius: 7 },
  timelineLine: { width: 2, height: 40, backgroundColor: COLORS.border, marginTop: 2 },
  timelineContent: { flex: 1, paddingBottom: 16 },
  timelineLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timelineLabel: { color: COLORS.textMuted, fontSize: 13, lineHeight: 20 },
  timelineLabelDone: { color: COLORS.textSecondary },
  timelineTime: { color: COLORS.success, fontSize: 11, marginTop: 2, marginLeft: 20 },
  timelinePending: { color: COLORS.textMuted, fontSize: 11, marginTop: 2, marginLeft: 20, fontStyle: 'italic' },

  techRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  techAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(127, 191, 49, 0.1)',
    borderWidth: 1, borderColor: 'rgba(127, 191, 49, 0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  techName: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 15 },
  techEta: { color: COLORS.primary, fontSize: 13, marginTop: 2 },
  techLocRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  liveIndicator: {
    width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLORS.success,
  },
  techLocText: { color: COLORS.success, fontSize: 12 },
  callBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(127, 191, 49, 0.12)',
    borderWidth: 1, borderColor: 'rgba(127, 191, 49, 0.22)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Live Tracking Card ────────────────────────────────────────────────────
  trackCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(127, 191, 49, 0.25)',
    overflow: 'hidden',
    marginBottom: SPACING.md,
    // Subtle green glow — signals this section is "live"
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  trackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  trackHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveIndicatorLarge: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success,
    // glow effect on the live dot
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  trackTitle: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 14 },
  trackUpdated: { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },

  mapWrapper: { height: 200, backgroundColor: COLORS.bgDark },
  map: { flex: 1 },

  trackInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  trackInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trackInfoText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '500' },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  infoLabel: { color: COLORS.textMuted, fontSize: 13, flex: 1 },
  infoValue: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500', flex: 2, textAlign: 'right' },
});