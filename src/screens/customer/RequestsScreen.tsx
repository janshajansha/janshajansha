import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { servicesApi }               from '../../api/services';
import { QUERY_KEYS, SERVICE_TYPE_LABELS } from '../../constants/api';
import { ServiceRequest }            from '../../types';
import { Button, StatusBadge, SkeletonCard } from '../../components/common';
import { COLORS, SPACING, RADIUS }   from '../../theme';

// ─── Safe rgba helper (avoids 8-digit hex Android glitches) ───────────────────
function hexRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Service type → Ionicons icon + accent colour ─────────────────────────────
const SERVICE_META: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  emergency_charging:    { icon: 'flash',                   color: COLORS.emergency },
  breakdown_assistance:  { icon: 'construct-outline',        color: COLORS.breakdown },
  scheduled_maintenance: { icon: 'settings-outline',         color: COLORS.info },
  inspection:            { icon: 'search-outline',           color: COLORS.info },
  battery_check:         { icon: 'battery-charging-outline', color: COLORS.success },
  software_update:       { icon: 'cloud-download-outline',   color: COLORS.info },
  general_repair:        { icon: 'hammer-outline',           color: COLORS.breakdown },
};
const FALLBACK_META = {
  icon: 'clipboard-outline' as keyof typeof Ionicons.glyphMap,
  color: COLORS.textMuted,
};

// ─── Status filter chips ───────────────────────────────────────────────────────
const STATUS_FILTERS = [
  { label: 'All',         value: undefined       },
  { label: 'Active',      value: 'pending'       },
  { label: 'In Progress', value: 'in_progress'   },
  { label: 'Completed',   value: 'completed'     },
  { label: 'Cancelled',   value: 'cancelled'     },
];

// ─────────────────────────────────────────────────────────────────────────────
// RequestsScreen
//
// Architecture note — why the root FlatList instead of ScreenWrapper:
//   The original had TWO FlatLists (filter chips + request list) nested inside
//   ScreenWrapper's ScrollView, triggering "VirtualizedList inside ScrollView"
//   on both. Fix: the request FlatList is the root scroll; the header and
//   horizontal filter chips live in ListHeaderComponent. A horizontal FlatList
//   inside a vertical FlatList's header is allowed (different scroll axes).
// ─────────────────────────────────────────────────────────────────────────────
export default function RequestsScreen() {
  const navigation = useNavigation<any>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: QUERY_KEYS.myRequests(statusFilter),
    queryFn: () =>
      servicesApi.getMyRequests(statusFilter ? { status: statusFilter } : undefined),
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
    retry: false,
    throwOnError: false,
  });

  const requests = data?.requests ?? [];

  const goCreate = useCallback(
    () => navigation.navigate('CreateRequest'),
    [navigation],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        data={isLoading ? [] : requests}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }

        // ── Header: title row + filter chips ─────────────────────────────
        ListHeaderComponent={
          <View>
            {/* Title + New Request button */}
            <View style={styles.titleRow}>
              <View>
                <Text style={styles.screenTitle}>Service Requests</Text>
                <Text style={styles.screenSubtitle}>Track and manage your requests</Text>
              </View>
              <TouchableOpacity
                style={styles.newIconBtn}
                onPress={goCreate}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="add" size={22} color={COLORS.bgDark} />
              </TouchableOpacity>
            </View>

            <Button
              title="New Request"
              onPress={goCreate}
              icon={<Ionicons name="add-circle-outline" size={17} color={COLORS.bgDark} />}
              style={styles.newBtn}
            />

            {/* Horizontal filter chips — horizontal FlatList inside a
                vertical FlatList header is fine (different scroll axes) */}
            <FlatList
              horizontal
              data={STATUS_FILTERS}
              keyExtractor={(item) => String(item.label)}
              contentContainerStyle={styles.filtersContent}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.chip,
                    statusFilter === item.value && styles.chipActive,
                  ]}
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
          </View>
        }

        // ── Empty / loading state ─────────────────────────────────────────
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.skeletonWrapper}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : (
            <View style={styles.emptyWrapper}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="clipboard-outline" size={38} color={COLORS.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No requests found</Text>
              <Text style={styles.emptySubtitle}>
                Create a service request to get started.
              </Text>
              <Button
                title="Create Request"
                onPress={goCreate}
                icon={
                  <Ionicons name="add-circle-outline" size={17} color={COLORS.bgDark} />
                }
                style={styles.emptyBtn}
              />
            </View>
          )
        }

        // ── Request card ──────────────────────────────────────────────────
        renderItem={({ item }) => (
          <RequestCard
            req={item}
            onPress={() =>
              navigation.navigate('RequestDetail', { requestId: item.id })
            }
          />
        )}

        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RequestCard
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
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {/* Service type icon box */}
      <View style={[
        styles.iconBox,
        {
          backgroundColor: hexRgba(meta.color, 0.12),
          borderColor:      hexRgba(meta.color, 0.22),
        },
      ]}>
        <Ionicons name={meta.icon} size={20} color={meta.color} />
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <Text style={styles.reqType}>
          {SERVICE_TYPE_LABELS[req.service_type] || req.service_type}
        </Text>
        <Text style={styles.reqDate}>
          {new Date(req.created_at).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
          })}
        </Text>

        {req.location_address && (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {req.location_address}
            </Text>
          </View>
        )}

        {req.assigned_technician_name && (
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.metaText}>
              {req.assigned_technician_name}
            </Text>
          </View>
        )}
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

  list: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  screenSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  newIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  newBtn: {
    marginBottom: SPACING.md,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 10,
    elevation: 6,
  },

  // ── Filter chips ──────────────────────────────────────────────────────────
  filtersContent: {
    gap: 8,
    paddingBottom: SPACING.md,
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

  // ── Skeleton ──────────────────────────────────────────────────────────────
  skeletonWrapper: {
    gap: SPACING.sm,
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyWrapper: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.sm,
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
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
  emptyBtn: {
    marginTop: SPACING.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 10,
    elevation: 6,
  },

  // ── Request card ──────────────────────────────────────────────────────────
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  metaText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    flex: 1,
  },
});