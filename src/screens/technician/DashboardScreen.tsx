import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import { servicesApi, pushTechnicianLocation } from '../../api/services';
import { QUERY_KEYS, SERVICE_TYPE_LABELS, STATUS_COLORS } from '../../constants/api';
import { ServiceRequest, ServiceStatus } from '../../types';
import { StatusBadge, SkeletonCard } from '../../components/common';
import { COLORS, SPACING, RADIUS } from '../../theme';
import { useAuthStore } from '../../store/authStore';

// ─── Safe rgba helper ─────────────────────────────────────────────────────────
function hexRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Service type → Ionicons + colour ────────────────────────────────────────
const SERVICE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  emergency_charging:    { icon: 'flash',                   color: COLORS.emergency },
  breakdown_assistance:  { icon: 'construct-outline',        color: COLORS.breakdown },
  scheduled_maintenance: { icon: 'settings-outline',         color: COLORS.info      },
  maintenance:           { icon: 'settings-outline',         color: COLORS.info      },
  inspection:            { icon: 'search-outline',           color: COLORS.info      },
  battery_check:         { icon: 'battery-charging-outline', color: COLORS.success   },
  software_update:       { icon: 'cloud-download-outline',   color: COLORS.info      },
  general_repair:        { icon: 'hammer-outline',           color: COLORS.breakdown },
};
const FALLBACK_META = { icon: 'clipboard-outline' as const, color: COLORS.textMuted };

// ─── Priority → colour (unchanged logic) ─────────────────────────────────────
function priorityColor(p: string): string {
  if (p === 'critical') return COLORS.error;
  if (p === 'high')     return COLORS.warning;
  return COLORS.textMuted;
}

function priorityIcon(p: string): keyof typeof Ionicons.glyphMap {
  if (p === 'critical') return 'alert-circle';
  if (p === 'high')     return 'alert-circle-outline';
  return 'remove-circle-outline';
}

// ─── Status filter chips ──────────────────────────────────────────────────────
const TECH_STATUS_FILTERS: { label: string; value?: string }[] = [
  { label: 'All',         value: undefined     },
  { label: 'Assigned',    value: 'assigned'    },
  { label: 'Accepted',    value: 'accepted'    },
  { label: 'On The Way',  value: 'on_the_way'  },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed',   value: 'completed'   },
];

// ─────────────────────────────────────────────────────────────────────────────
// TechDashboard
//
// Architecture note — why ScreenWrapper is not used:
//   ScreenWrapper wraps children in a ScrollView. The original had a horizontal
//   filter FlatList AND a vertical requests FlatList both inside it, producing
//   two "VirtualizedList inside ScrollView" warnings.
//
//   Fix: layout is three stacked sections in a SafeAreaView:
//     1. Fixed header row  (greeting + refresh)
//     2. Fixed filter chips (horizontal FlatList — NOT inside any ScrollView)
//     3. Requests section   (requests FlatList at the root, fills remaining space)
//   The filter chips stay visible at all times while the requests scroll below.
// ─────────────────────────────────────────────────────────────────────────────
export default function TechDashboard() {
  const navigation   = useNavigation<any>();
  const { user }     = useAuthStore();
  const queryClient  = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();

  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const technicianId = user?.id;

  // ── Query — identical to original ────────────────────────────────────────
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: QUERY_KEYS.adminRequests({ status: statusFilter, assigned_technician_id: technicianId }),
    queryFn:  () =>
      servicesApi.getAdminRequests({
        ...(statusFilter   ? { status:                  statusFilter   } : {}),
        ...(technicianId   ? { assigned_technician_id:  technicianId   } : {}),
      }),
    enabled: !!technicianId,
    refetchInterval: 20000,
    refetchOnWindowFocus: false,
    retry: false,
    throwOnError: false,
  });

  // ── Memoised active request tracking — identical to original ─────────────
  const activeRequestIds = useMemo(
    () =>
      (data?.requests ?? [])
        .filter((r) => ['accepted', 'on_the_way', 'arrived', 'in_progress'].includes(r.status))
        .map((r) => r.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [(data?.requests ?? []).map((r) => `${r.id}:${r.status}`).join(',')]
  );

  const isOnTheWay = useMemo(
    () => (data?.requests ?? []).some((r) => r.status === 'on_the_way'),
    [activeRequestIds]
  );

  // ── Location push — identical to original ────────────────────────────────
  useEffect(() => {
    if (!activeRequestIds.length) return;

    const INTERVAL_MS = isOnTheWay ? 60000 : 5 * 60000;

    const pushLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: isOnTheWay
            ? Location.Accuracy.High
            : Location.Accuracy.Balanced,
        });
        for (const id of activeRequestIds) {
          await pushTechnicianLocation(id, pos.coords.latitude, pos.coords.longitude)
            .catch(() => {});
        }
      } catch {}
    };

    pushLocation();
    locationIntervalRef.current = setInterval(pushLocation, INTERVAL_MS);
    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
    };
  }, [activeRequestIds, isOnTheWay]);

  const requests  = data?.requests ?? [];
  const goRefresh = useCallback(() => refetch(), [refetch]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>

      {/* ── Fixed header ────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          {/* 👷 emoji removed — clean text greeting */}
          <Text style={styles.greeting}>Hello, {user?.first_name}</Text>
          <Text style={styles.subGreeting}>{requests.length} requests loaded</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={goRefresh}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="refresh" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Fixed filter chips — horizontal FlatList sits OUTSIDE any
          ScrollView so there is no nested-VirtualizedList warning.        ── */}
      <FlatList
        horizontal
        data={TECH_STATUS_FILTERS}
        keyExtractor={(item) => String(item.label)}
        contentContainerStyle={styles.filtersContent}
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, statusFilter === item.value && styles.chipActive]}
            onPress={() => setStatusFilter(item.value)}
            activeOpacity={0.75}
          >
            <Text style={[
              styles.chipText,
              statusFilter === item.value && styles.chipTextActive,
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* ── Content ─────────────────────────────────────────────────── */}
      {isLoading ? (
        // Skeleton — ScrollView (not FlatList) since there are only 2 items
        <ScrollView contentContainerStyle={styles.skeletonWrapper}>
          <SkeletonCard />
          <SkeletonCard />
        </ScrollView>

      ) : requests.length === 0 ? (
        // Inline empty state — Ionicons replaces EmptyState icon="📋"
        <View style={styles.emptyWrapper}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="clipboard-outline" size={38} color={COLORS.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No requests</Text>
          <Text style={styles.emptySub}>
            All clear — no service requests at the moment.
          </Text>
        </View>

      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: tabBarHeight + SPACING.md },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          renderItem={({ item }) => (
            <TechRequestCard
              req={item}
              onPress={() =>
                navigation.navigate('TechRequestDetail', { requestId: item.id })
              }
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        />
      )}

    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TechRequestCard — all emojis replaced with Ionicons
// ─────────────────────────────────────────────────────────────────────────────
function TechRequestCard({
  req,
  onPress,
}: {
  req: ServiceRequest;
  onPress: () => void;
}) {
  const meta    = SERVICE_META[req.service_type] ?? FALLBACK_META;
  const priColor = priorityColor(req.priority ?? '');
  const priIcon  = priorityIcon(req.priority ?? '');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>

      {/* ── Top row: service icon + type + status badge ───────────── */}
      <View style={styles.cardTop}>
        <View style={[
          styles.serviceIconBox,
          {
            backgroundColor: hexRgba(meta.color, 0.12),
            borderColor:      hexRgba(meta.color, 0.22),
          },
        ]}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.reqType}>
            {SERVICE_TYPE_LABELS[req.service_type] || req.service_type}
          </Text>
          {/* 👤 emoji replaced with Ionicons person-outline */}
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.reqCustomer} numberOfLines={1}>
              {req.customer_name}
            </Text>
          </View>
        </View>

        <StatusBadge status={req.status} />
      </View>

      {/* ── Divider ───────────────────────────────────────────────── */}
      <View style={styles.cardDivider} />

      {/* ── Meta row: priority + location + date ──────────────────── */}
      <View style={styles.cardMeta}>
        {/* ⚑ replaced with Ionicons flag/alert icon */}
        <View style={styles.metaRow}>
          <Ionicons name={priIcon} size={13} color={priColor} />
          <Text style={[styles.priority, { color: priColor }]}>
            {req.priority} priority
          </Text>
        </View>

        {req.location_address && (
          // 📍 replaced with Ionicons location-outline
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.location} numberOfLines={1}>
              {req.location_address}
            </Text>
          </View>
        )}

        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />
          <Text style={styles.date}>
            {new Date(req.created_at).toLocaleString('en-GH', {
              timeZone:  'Africa/Accra',   // server stores in Accra / UTC+0
              day:       '2-digit',
              month:     'short',
              hour:      '2-digit',
              minute:    '2-digit',
              hour12:    true,
            })}
          </Text>
        </View>
      </View>

    </TouchableOpacity>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  greeting: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  subGreeting: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Filter chips ──────────────────────────────────────────────────────────
  filterBar: {
    flexGrow: 0,               // don't stretch vertically
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filtersContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor:     COLORS.primary,
    shadowColor:     COLORS.primary,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.35,
    shadowRadius:    6,
    elevation:       4,
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

  // ── Skeleton / Empty ──────────────────────────────────────────────────────
  skeletonWrapper: {
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  emptyWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.lg,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(127, 191, 49, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(127, 191, 49, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  emptySub: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Requests list ─────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },

  // ── TechRequestCard ───────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  serviceIconBox: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reqType: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 3,
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  cardMeta: {
    gap: 5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  reqCustomer: {
    color: COLORS.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  priority: {
    fontSize: 12,
    fontWeight: '600',
  },
  location: {
    color: COLORS.textSecondary,
    fontSize: 12,
    flex: 1,
  },
  date: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
});