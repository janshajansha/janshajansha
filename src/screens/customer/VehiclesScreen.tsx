import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { vehiclesApi }  from '../../api/vehicles';
import { QUERY_KEYS }   from '../../constants/api';
import { UserVehicle }  from '../../types';
import { Button, SkeletonCard } from '../../components/common';
import { COLORS, SPACING, RADIUS } from '../../theme';

// ─────────────────────────────────────────────────────────────────────────────
// VehiclesScreen
//
// Architecture note — why FlatList at the root instead of ScreenWrapper:
//   ScreenWrapper wraps children in a ScrollView. Nesting a FlatList inside
//   a ScrollView triggers React Native's "VirtualizedList inside ScrollView"
//   warning and disables FlatList's own windowing/recycling.
//   Solution: FlatList is the root scrollable; the header, loading skeletons
//   and empty state all live inside ListHeaderComponent / ListEmptyComponent.
// ─────────────────────────────────────────────────────────────────────────────
export default function VehiclesScreen() {
  const navigation  = useNavigation<any>();
  const queryClient = useQueryClient();

  // ── Queries / mutations — identical to original ───────────────────────────
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: QUERY_KEYS.userVehicles,
    queryFn: vehiclesApi.getMyVehicles,
  });

  const deleteMutation = useMutation({
    mutationFn: vehiclesApi.deleteVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userVehicles });
    },
  });

  // ── Handlers — identical to original ─────────────────────────────────────
  const handleDelete = useCallback((vehicle: UserVehicle) => {
    Alert.alert(
      'Remove Vehicle',
      `Remove ${vehicle.make} ${vehicle.model} from your account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(vehicle.id),
        },
      ]
    );
  }, [deleteMutation]);

  const goAddVehicle = useCallback(
    (vehicleId?: number) =>
      navigation.navigate('AddVehicle', vehicleId ? { vehicleId } : undefined),
    [navigation],
  );

  const vehicles = data?.vehicles ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        data={isLoading ? [] : vehicles}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}   // Android spinner colour
          />
        }

        // ── Header: title row + Add button ─────────────────────────────────
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={styles.titleRow}>
              <View>
                <Text style={styles.screenTitle}>My Vehicles</Text>
                <Text style={styles.screenSubtitle}>Manage your registered EVs</Text>
              </View>
              {/* Compact icon-only add button in the header row */}
              {/* <TouchableOpacity
                style={styles.addIconBtn}
                onPress={() => goAddVehicle()}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="add" size={22} color={COLORS.bgDark} />
              </TouchableOpacity> */}
            </View>

            {/* Full-width Add button below the title */}
            {/* <Button
              title="Add Vehicle"
              onPress={() => goAddVehicle()}
              icon={<Ionicons name="add-circle-outline" size={18} color={COLORS.bgDark} />}
              style={styles.addBtn}
            /> */}
          </View>
        }

        // ── Empty / loading state ───────────────────────────────────────────
        ListEmptyComponent={
          isLoading ? (
            // Show skeletons while the first fetch runs
            <View style={styles.skeletonWrapper}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : (
            // No vehicles after load
            <View style={styles.emptyWrapper}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="car-sport-outline" size={38} color={COLORS.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No vehicles yet</Text>
              <Text style={styles.emptySubtitle}>
                Manage your EV and request services.
              </Text>
              {/* <Button
                title="Add your first EV"
                onPress={() => goAddVehicle()}
                icon={<Ionicons name="add-circle-outline" size={17} color={COLORS.bgDark} />}
                style={styles.emptyBtn}
              /> */}
            </View>
          )
        }

        // ── Vehicle cards ───────────────────────────────────────────────────
        renderItem={({ item }) => (
          <VehicleCard
            vehicle={item}
            onDelete={() => handleDelete(item)}
            onEdit={() => goAddVehicle(item.id)}
          />
        )}

        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VehicleCard
// ─────────────────────────────────────────────────────────────────────────────
function VehicleCard({
  vehicle,
  onDelete,
  onEdit,
}: {
  vehicle: UserVehicle;
  onDelete: () => void;
  onEdit: () => void;
}) {
  // Only renders a row when value is non-empty
  const InfoRow = ({
    label,
    value,
    icon,
  }: {
    label: string;
    value: string | null | undefined;
    icon: keyof typeof Ionicons.glyphMap;
  }) => {
    if (!value) return null;
    return (
      <View style={styles.infoRow}>
        <View style={styles.infoLabelGroup}>
          <Ionicons name={icon} size={13} color={COLORS.textMuted} />
          <Text style={styles.infoLabel}>{label}</Text>
        </View>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    );
  };

  return (
    <View style={styles.card}>
      {/* ── Card header ──────────────────────────────────────────────── */}
      <View style={styles.cardHeader}>
        {/* Car icon box */}
        <View style={styles.carIconBox}>
          <Ionicons name="car-sport-outline" size={26} color={COLORS.primary} />
        </View>

        {/* Make / model / year */}
        <View style={{ flex: 1 }}>
          <Text style={styles.carName} numberOfLines={1}>
            {vehicle.make} {vehicle.model}
          </Text>
          <Text style={styles.carYear}>{vehicle.year || 'Year unknown'}</Text>
        </View>

        {/* Edit / Delete actions */}
        {/* <View style={styles.actionBtns}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onEdit}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="pencil-outline" size={16} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, styles.deleteBtn]}
            onPress={onDelete}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="trash-outline" size={16} color={COLORS.error} />
          </TouchableOpacity>
        </View> */}
      </View>

      {/* ── Info grid ────────────────────────────────────────────────── */}
      <View style={styles.divider} />
      <View style={styles.infoGrid}>
        <InfoRow label="Registration"  icon="card-outline"          value={vehicle.plate_number} />
        <InfoRow label="VIN"           icon="barcode-outline"        value={vehicle.vin} />
        <InfoRow label="Battery"       icon="battery-charging-outline" value={vehicle.battery_capacity ? `${vehicle.battery_capacity} kWh` : null} />
        <InfoRow label="Range"         icon="speedometer-outline"    value={vehicle.range_km ? `${vehicle.range_km} km` : null} />
        <InfoRow label="Charging"      icon="flash-outline"          value={vehicle.charging_type} />
        <InfoRow label="Odometer"      icon="navigate-circle-outline" value={vehicle.current_odometer ? `${vehicle.current_odometer} km` : null} />
      </View>
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

  list: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  listHeader: {
    paddingTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  addIconBtn: {
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
  addBtn: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 10,
    elevation: 6,
  },

  // ── Empty state ────────────────────────────────────────────────────────────
  skeletonWrapper: {
    gap: SPACING.sm,
  },
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
    paddingHorizontal: SPACING.xl,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 10,
    elevation: 6,
  },

  // ── Vehicle card ──────────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    // Subtle green glow to match the glossy theme
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },

  carIconBox: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(127, 191, 49, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(127, 191, 49, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  carName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  carYear: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 2,
  },

  actionBtns: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgCardLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },

  // ── Info grid ─────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  infoGrid: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  infoValue: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
});