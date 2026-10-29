import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { servicesApi }       from '../../api/services';
import { notificationsApi }  from '../../api/charging';
import { vehiclesApi }       from '../../api/vehicles';
import { useAuthStore }      from '../../store/authStore';
import {
  QUERY_KEYS,
  SERVICE_TYPE_LABELS,
  STATUS_COLORS,
} from '../../constants/api';
import { ServiceRequest } from '../../types';
import { StatusBadge, SectionHeader, SkeletonCard } from '../../components/common';
import { COLORS, SPACING, RADIUS, GLASS, SHADOW } from '../../theme';

// ─── Safe rgba helper ─────────────────────────────────────────────────────────
// Avoids 8-digit hex (e.g. '#7FBF3120') which causes elevation glitches on
// Android. Converts '#RRGGBB' + opacity (0–1) → 'rgba(r,g,b,opacity)'.
function hexRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Service-type → icon mapping ──────────────────────────────────────────────
// Used by both QuickAction cards and RequestCard rows.
const SERVICE_META: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  emergency_charging:    { icon: 'flash',             color: COLORS.emergency },
  breakdown_assistance:  { icon: 'construct-outline',  color: COLORS.breakdown },
  scheduled_maintenance: { icon: 'settings-outline',   color: COLORS.info },
};
const FALLBACK_META = { icon: 'ellipsis-horizontal-circle-outline' as const, color: COLORS.primary };

// ─────────────────────────────────────────────────────────────────────────────
// CustomerDashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function CustomerDashboard() {
  const { user }     = useAuthStore();
  const navigation   = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);

  // ── Queries — all options identical to original ───────────────────────────
  const {
    data: reqData,
    isLoading: reqLoading,
    refetch: refetchReqs,
  } = useQuery({
    queryKey: QUERY_KEYS.myRequests(),
    queryFn: () => servicesApi.getMyRequests(),
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
    retry: false,
    throwOnError: false,
  });

  const { data: vehData, isLoading: vehLoading } = useQuery({
    queryKey: QUERY_KEYS.userVehicles,
    queryFn: vehiclesApi.getMyVehicles,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: notifData } = useQuery({
    queryKey: QUERY_KEYS.notifications,
    queryFn: notificationsApi.getNotifications,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
    retry: false,
    throwOnError: false,
  });

  // ── Derived data — identical to original ─────────────────────────────────
  const unreadCount = notifData?.unread_count ?? 0;

  const activeRequests =
    reqData?.requests?.filter((r) =>
      ['pending', 'assigned', 'accepted', 'on_the_way', 'arrived', 'in_progress'].includes(r.status)
    ) ?? [];

  const recentRequests = reqData?.requests?.slice(0, 3) ?? [];
  const vehicles       = vehData?.vehicles ?? [];

  // ── Pull-to-refresh (new) ─────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchReqs();
    setRefreshing(false);
  }, [refetchReqs]);

  // ── Navigation helpers (stable) ───────────────────────────────────────────
  const goNotifs       = useCallback(() => navigation.navigate('Notifications'), [navigation]);
  const goActiveBanner = useCallback(() =>
    navigation.navigate('Requests', {
      screen: 'RequestDetail',
      params: { requestId: activeRequests[0]?.id },
    }),
  [navigation, activeRequests]);
  const goVehicles     = useCallback(() => navigation.navigate('Vehicles'), [navigation]);
  const goAddVehicle   = useCallback(() => navigation.navigate('Vehicles', { screen: 'AddVehicle' }), [navigation]);
  const goRequests     = useCallback(() => navigation.navigate('Requests'), [navigation]);
  const goMap          = useCallback(() => navigation.navigate('Map'), [navigation]);

  const goCreateRequest = useCallback(
    (serviceType: string) =>
      navigation.navigate('Requests', { screen: 'CreateRequest', params: { serviceType } }),
    [navigation],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.first_name}</Text>
            <Text style={styles.subGreeting}>What do you need today?</Text>
          </View>

          <TouchableOpacity
            style={styles.notifBtn}
            onPress={goNotifs}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="notifications-outline" size={21} color={COLORS.textPrimary} />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Active request banner ────────────────────────────────────── */}
        {activeRequests.length > 0 && (
          <TouchableOpacity
            style={styles.activeBanner}
            onPress={goActiveBanner}
            activeOpacity={0.85}
          >
            {/* Pulsing green dot */}
            <View style={styles.activeDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeBannerTitle}>Active Service Request</Text>
              <Text style={styles.activeBannerSub}>
                {activeRequests[0].service_type.replace(/_/g, ' ')}
                {' · '}
                <Text style={{ color: STATUS_COLORS[activeRequests[0].status] }}>
                  {activeRequests[0].status.replace(/_/g, ' ')}
                </Text>
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        {/* ── Quick Actions ────────────────────────────────────────────── */}
        <SectionHeader title="Quick Actions" />
        <View style={styles.actionsGrid}>
          <QuickAction
            icon="flash"
            label="Emergency Charging"
            color={COLORS.emergency}
            onPress={() => goCreateRequest('emergency_charging')}
          />
          <QuickAction
            icon="construct-outline"
            label="Breakdown Assist"
            color={COLORS.breakdown}
            onPress={() => goCreateRequest('breakdown_assistance')}
          />
          <QuickAction
            icon="settings-outline"
            label="Schedule Maintenance"
            color={COLORS.info}
            onPress={() => goCreateRequest('scheduled_maintenance')}
          />
          <QuickAction
            icon="map-outline"
            label="Find Station"
            color={COLORS.success}
            onPress={goMap}
          />
        </View>

        {/* ── My Vehicles ──────────────────────────────────────────────── */}
        <SectionHeader title="My Vehicles" action="Manage" onAction={goVehicles} />

        {vehLoading ? (
          <SkeletonCard />
        ) : vehicles.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="car-outline" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No vehicles added yet.</Text>
            {/* <TouchableOpacity onPress={goAddVehicle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.emptyAction}>+ Add your first EV</Text>
            </TouchableOpacity> */}
          </View>
        ) : (
          // Horizontal ScrollView instead of FlatList — avoids the
          // "VirtualizedList inside ScrollView" warning on Android.
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: SPACING.lg }}
            style={styles.vehScroll}
          >
            {vehicles.slice(0, 3).map((item) => (
              <View key={String(item.id)} style={styles.vehCard}>
                <View style={styles.vehIconBox}>
                  <Ionicons name="car-outline" size={26} color={COLORS.primary} />
                </View>
                <Text style={styles.vehName} numberOfLines={1}>
                  {item.make} {item.model}
                </Text>
                <Text style={styles.vehYear}>{item.year || '—'}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* ── Recent Requests ──────────────────────────────────────────── */}
        <SectionHeader title="Recent Requests" action="View All" onAction={goRequests} />

        {reqLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : recentRequests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="clipboard-outline" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No service requests yet.</Text>
            <Text style={styles.emptySubText}>Create one to get started.</Text>
          </View>
        ) : (
          recentRequests.map((req) => (
            <RequestCard
              key={req.id}
              req={req}
              onPress={() =>
                navigation.navigate('Requests', {
                  screen: 'RequestDetail',
                  params: { requestId: req.id },
                })
              }
            />
          ))
        )}

        {/* Bottom breathing room */}
        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QuickAction card
// ─────────────────────────────────────────────────────────────────────────────
function QuickAction({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.quickCard}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Coloured icon box */}
      <View style={[
        styles.quickIconBox,
        {
          backgroundColor: hexRgba(color, 0.12),
          borderColor: hexRgba(color, 0.22),
        },
      ]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.quickLabel} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RequestCard row
// ─────────────────────────────────────────────────────────────────────────────
function RequestCard({
  req,
  onPress,
}: {
  req: ServiceRequest;
  onPress: () => void;
}) {
  const meta = SERVICE_META[req.service_type] ?? FALLBACK_META;

  return (
    <TouchableOpacity style={styles.reqCard} onPress={onPress} activeOpacity={0.8}>
      {/* Service type icon */}
      <View style={[
        styles.reqIconBox,
        {
          backgroundColor: hexRgba(meta.color, 0.12),
          borderColor: hexRgba(meta.color, 0.22),
        },
      ]}>
        <Ionicons name={meta.icon} size={19} color={meta.color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.reqType}>
          {SERVICE_TYPE_LABELS[req.service_type] || req.service_type}
        </Text>
        <Text style={styles.reqDate}>
          {new Date(req.created_at).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </Text>
      </View>

      <StatusBadge status={req.status} />
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

  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  greeting: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  subGreeting: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 2,
  },
  notifBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: COLORS.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: COLORS.bgDark,
  },
  notifBadgeText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: '800',
  },

  // ── Active banner ──────────────────────────────────────────────────────────
  // Why solid bgCard instead of tinted bg:
  //   COLORS.primary + '18' produces '#7FBF3118' (8-digit hex). Android does not
  //   consistently support 8-digit hex — it either ignores the alpha or renders
  //   a white fill behind the elevation shadow, causing the visible glitch.
  //   SHADOW.soft has elevation:8; Android elevation requires a fully opaque
  //   background to render correctly. Semi-transparent + elevation = grey halo.
  //   Solution: solid bgCard surface, left accent border, no shadow.
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    // Three-sided hairline border in green, strong left accent
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: 'rgba(127, 191, 49, 0.2)',
    borderRightColor: 'rgba(127, 191, 49, 0.2)',
    borderBottomColor: 'rgba(127, 191, 49, 0.2)',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  activeBannerTitle: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  activeBannerSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },

  // ── Quick Actions 2×2 grid ────────────────────────────────────────────────
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  quickCard: {
    // Each card takes exactly half the row minus the gap
    flexBasis: '47.5%',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  quickIconBox: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },

  // ── Vehicles horizontal scroll ─────────────────────────────────────────────
  vehScroll: {
    marginBottom: SPACING.sm,
  },
  vehCard: {
    width: 140,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    marginRight: SPACING.sm,
    gap: 6,
  },
  vehIconBox: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(127, 191, 49, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(127, 191, 49, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  vehName: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  vehYear: {
    color: COLORS.textMuted,
    fontSize: 12,
  },

  // ── Request cards ──────────────────────────────────────────────────────────
  reqCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  reqIconBox: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reqType: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  reqDate: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },

  // ── Empty states ───────────────────────────────────────────────────────────
  emptyCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  emptySubText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  emptyAction: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
  },
});