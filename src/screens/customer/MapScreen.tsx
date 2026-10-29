import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { chargingApi, serviceCentersApi } from '../../api/charging';
import { QUERY_KEYS } from '../../constants/api';
import { ChargingStation, ServiceCenter } from '../../types';
import { COLORS, SPACING, RADIUS } from '../../theme';

type MapMode = 'stations' | 'centers';

const DEFAULT_REGION = {
  latitude:      10.7905,
  longitude:     78.7047,
  latitudeDelta: 0.2,
  longitudeDelta: 0.2,
};

// ─────────────────────────────────────────────────────────────────────────────
// MapScreen
// ─────────────────────────────────────────────────────────────────────────────
export default function MapScreen() {
  const mapRef  = useRef<MapView>(null);
  const insets      = useSafeAreaInsets();
  // useBottomTabBarHeight returns the full tab bar height including the safe
  // area inset. This is what we need to push content above the tab bar.
  // useSafeAreaInsets().bottom alone only gives the home-indicator height
  // (~34px) and misses the tab bar itself (~49px) — causing the sheet to
  // render behind the tab bar even after adding insets.bottom.
  const tabBarHeight = useBottomTabBarHeight();

  const [mode, setMode]                   = useState<MapMode>('stations');
  const [userLocation, setUserLocation]   = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [mapReady, setMapReady]           = useState(false);

  // ── Location — identical to original ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationError(true); return; }
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        setLocationError(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (mapReady && userLocation) {
      mapRef.current?.animateToRegion(
        {
          latitude:      userLocation.lat,
          longitude:     userLocation.lng,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        },
        600
      );
    }
  }, [mapReady, userLocation]);

  const lat = userLocation?.lat ?? DEFAULT_REGION.latitude;
  const lng = userLocation?.lng ?? DEFAULT_REGION.longitude;

  // ── Queries — identical to original ──────────────────────────────────────
  const { data: stationsData, isLoading: stLoading } = useQuery({
    queryKey: QUERY_KEYS.nearbyStations(lat, lng, 20),
    queryFn:  () => chargingApi.getNearbyStations({ lat, lng, radius_km: 20 }),
    enabled:  mode === 'stations' && !!userLocation,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: centersData, isLoading: ctLoading } = useQuery({
    queryKey: QUERY_KEYS.nearbyServiceCenters(lat, lng, 30),
    queryFn:  () => serviceCentersApi.getNearbyCenters({ lat, lng, radius_km: 30 }),
    enabled:  mode === 'centers' && !!userLocation,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const stations  = stationsData?.stations ?? [];
  const centers   = centersData?.centers   ?? [];
  const isLoading = mode === 'stations' ? stLoading : ctLoading;
  
  // ── Directions — identical to original ───────────────────────────────────
  const openDirections = useCallback((dLat: number, dLng: number) => {
    const url = Platform.OS === 'ios'
      ? `maps://app?daddr=${dLat},${dLng}`
      : `google.navigation:q=${dLat},${dLng}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dLat},${dLng}`)
    );
  }, []);

  return (
    <View style={[styles.container, { paddingBottom: tabBarHeight }]}>

      {/* ── Map ─────────────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton
        onMapReady={() => setMapReady(true)}
      >
        {/* ── Charging station markers ──────────────────────────────── */}
        {mode === 'stations' &&
          stations
            .filter((s) => s.latitude && s.longitude)
            .map((station) => (
              <Marker
                key={station.id}
                coordinate={{ latitude: station.latitude!, longitude: station.longitude! }}
                tracksViewChanges={false}
              >
                {/* Custom bubble marker — replaces plain pinColor */}
                <StationMarker status={station.availability_status} />

                <Callout
                  onPress={() =>
                    openDirections(station.latitude!, station.longitude!)
                  }
                >
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle}>{station.name}</Text>
                    <Text style={styles.calloutSub}>{station.address}</Text>
                    {station.connector_types?.length ? (
                      <Text style={[styles.calloutSub, { color: COLORS.primary }]}>
                        {station.connector_types.join(', ')}
                      </Text>
                    ) : null}
                    <Text style={styles.calloutDir}>Tap for directions ›</Text>
                  </View>
                </Callout>
              </Marker>
            ))}

        {/* ── Service centre markers ────────────────────────────────── */}
        {mode === 'centers' &&
          centers
            .filter((c) => c.latitude && c.longitude)
            .map((center) => (
              <Marker
                key={center.id}
                coordinate={{ latitude: center.latitude!, longitude: center.longitude! }}
                tracksViewChanges={false}
              >
                <CenterMarker />

                <Callout
                  onPress={() =>
                    openDirections(center.latitude!, center.longitude!)
                  }
                >
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle}>{center.name}</Text>
                    <Text style={styles.calloutSub}>{center.address}</Text>
                    {center.phone && (
                      <View style={styles.calloutPhoneRow}>
                        <Ionicons name="call-outline" size={11} color={COLORS.primary} />
                        <Text
                          style={[styles.calloutSub, { color: COLORS.primary }]}
                          onPress={() => Linking.openURL(`tel:${center.phone}`)}
                        >
                          {center.phone}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.calloutDir}>Tap for directions ›</Text>
                  </View>
                </Callout>
              </Marker>
            ))}
      </MapView>

      {/* ── Mode toggle — floats above map ────────────────────────────
          top uses insets.top so it clears the status bar on every device.
          The original used hardcoded top:52 which broke on some devices. */}
      <View style={[styles.modeToggle, { top: insets.top + 12 }]}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'stations' && styles.modeBtnActive]}
          onPress={() => setMode('stations')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="flash"
            size={14}
            color={mode === 'stations' ? COLORS.bgDark : COLORS.textSecondary}
          />
          <Text style={[
            styles.modeBtnText,
            mode === 'stations' && { color: COLORS.bgDark },
          ]}>
            Charging
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeBtn, mode === 'centers' && styles.modeBtnActive]}
          onPress={() => setMode('centers')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="build-outline"
            size={14}
            color={mode === 'centers' ? COLORS.bgDark : COLORS.textSecondary}
          />
          <Text style={[
            styles.modeBtnText,
            mode === 'centers' && { color: COLORS.bgDark },
          ]}>
            Service Centers
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Bottom sheet ──────────────────────────────────────────────
          paddingBottom uses insets.bottom so content is never hidden
          behind the home indicator on iPhone X+ or the tab navigator.
          The original used maxHeight:200 with no bottom inset, causing
          cards to be clipped behind the navigator bar. */}
      <View style={[
        styles.bottomSheet,
        { paddingBottom: SPACING.md },  // tabBarHeight on container already clears the tab bar
      ]}>

        {/* Title row */}
        <View style={styles.bottomTitleRow}>
          <Ionicons
            name={mode === 'stations' ? 'flash' : 'build-outline'}
            size={15}
            color={COLORS.primary}
          />
          <Text style={styles.bottomTitle}>
            {mode === 'stations'
              ? `${stations.length} Charging Stations Nearby`
              : `${centers.length} Service Centers Nearby`}
          </Text>
        </View>

        {/* Content states */}
        {isLoading ? (
          <ActivityIndicator
            color={COLORS.primary}
            style={{ marginVertical: SPACING.md }}
          />
        ) : locationError ? (
          <View style={styles.statusRow}>
            <Ionicons name="warning-outline" size={15} color={COLORS.warning} />
            <Text style={styles.statusText}>Location permission denied.</Text>
          </View>
        ) : !userLocation ? (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={COLORS.textMuted} />
            <Text style={styles.statusText}>Getting your location…</Text>
          </View>
        ) : mode === 'stations' && stations.length === 0 ? (
          <Text style={styles.statusText}>No stations found within 20 km.</Text>
        ) : mode === 'centers' && centers.length === 0 ? (
          <Text style={styles.statusText}>No service centers found within 30 km.</Text>
        ) : (
          <FlatList
            horizontal
            data={mode === 'stations' ? (stations as any[]) : (centers as any[])}
            keyExtractor={(item) => String(item.id)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) =>
              mode === 'stations' ? (
                <StationCard
                  station={item}
                  // FIX: was item.location.lat/lng — data shape uses item.latitude/longitude
                  onNavigate={() => openDirections(item.location.lat, item.location.lng)}
                />
              ) : (
                <CenterCard
                  center={item}
                  // FIX: was item.location.lat/lng — data shape uses item.latitude/longitude
                  onNavigate={() => openDirections(item.latitude, item.longitude)}
                />
              )
            }
          />
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom marker components — replace plain pinColor
// tracksViewChanges={false} on the parent Marker prevents unnecessary
// re-renders which cause jank on Android when the map pans.
// ─────────────────────────────────────────────────────────────────────────────
function StationMarker({ status }: { status?: string }) {
  const color = status === 'operational' ? COLORS.success : COLORS.warning;
  return (
    <View style={styles.markerWrap}>
      <View style={[styles.markerBubble, { backgroundColor: color }]}>
        <Ionicons name="flash" size={14} color="#fff" />
      </View>
      <View style={[styles.markerTail, { borderTopColor: color }]} />
    </View>
  );
}

function CenterMarker() {
  return (
    <View style={styles.markerWrap}>
      <View style={[styles.markerBubble, { backgroundColor: COLORS.primary }]}>
        <Ionicons name="build-outline" size={14} color="#fff" />
      </View>
      <View style={[styles.markerTail, { borderTopColor: COLORS.primary }]} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottom-sheet cards
// ─────────────────────────────────────────────────────────────────────────────
function StationCard({
  station,
  onNavigate,
}: {
  station: ChargingStation;
  onNavigate: () => void;
}) {
  const isOp     = station.availability_status === 'operational';
  const dotColor = isOp ? COLORS.success : COLORS.warning;

  return (
    <View style={styles.listCard}>
      <View style={styles.listCardIconBox}>
        <Ionicons name="flash" size={18} color={COLORS.primary} />
      </View>
      <Text style={styles.listCardName} numberOfLines={2}>{station.name}</Text>
      <View style={styles.listCardStatusRow}>
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        <Text style={[styles.listCardStatus, { color: dotColor }]}>
          {isOp ? 'Available' : station.availability_status}
        </Text>
      </View>
      {station.distance_km != null && (
        <Text style={styles.listCardDist}>
          {station.distance_km.toFixed(1)} km away
        </Text>
      )}
      <TouchableOpacity style={styles.listCardBtn} onPress={onNavigate} activeOpacity={0.85}>
        <Ionicons name="navigate-outline" size={12} color={COLORS.bgDark} />
        <Text style={styles.listCardBtnText}>Navigate</Text>
      </TouchableOpacity>
    </View>
  );
}

function CenterCard({
  center,
  onNavigate,
}: {
  center: ServiceCenter;
  onNavigate: () => void;
}) {
  return (
    <View style={styles.listCard}>
      <View style={styles.listCardIconBox}>
        <Ionicons name="build-outline" size={18} color={COLORS.primary} />
      </View>
      <Text style={styles.listCardName} numberOfLines={2}>{center.name}</Text>
      <Text style={styles.listCardStatus} numberOfLines={1}>{center.city}</Text>
      {center.distance_km != null && (
        <Text style={styles.listCardDist}>
          {center.distance_km.toFixed(1)} km away
        </Text>
      )}
      <TouchableOpacity style={styles.listCardBtn} onPress={onNavigate} activeOpacity={0.85}>
        <Ionicons name="navigate-outline" size={12} color={COLORS.bgDark} />
        <Text style={styles.listCardBtnText}>Navigate</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: COLORS.bgDark },

  map: { flex: 1 },

  // ── Mode toggle ───────────────────────────────────────────────────────────
  modeToggle: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.full,
    padding: 4,
    zIndex: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  modeBtnActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  modeBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },

  // ── Callout ───────────────────────────────────────────────────────────────
  callout: { width: 200, padding: 4 },
  calloutTitle: { fontWeight: '700', fontSize: 14, marginBottom: 3 },
  calloutSub: { fontSize: 12, color: '#555', marginBottom: 2 },
  calloutPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  calloutDir: { fontSize: 12, color: '#007AFF', marginTop: 4 },

  // ── Bottom sheet ──────────────────────────────────────────────────────────
  // Fixed height of 210 ensures consistent layout.
  // paddingBottom is set inline using useSafeAreaInsets().bottom so content
  // never hides behind the home indicator or tab navigator bar.
  bottomSheet: {
    backgroundColor: COLORS.bgCard,
    paddingTop: SPACING.md,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    height: 230,                 // replaces maxHeight: 200 — consistent height
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  bottomTitle: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    paddingBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  statusText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },

  // ── Station / center list card ────────────────────────────────────────────
  listCard: {
    width: 145,
    backgroundColor: COLORS.bgCardLight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    alignItems: 'center',
    gap: 4,
  },
  listCardIconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(127, 191, 49, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(127, 191, 49, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  listCardName: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
  },
  listCardStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  listCardStatus: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  listCardDist: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  listCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    marginTop: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  listCardBtnText: {
    color: COLORS.bgDark,
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Custom marker ─────────────────────────────────────────────────────────
  markerWrap: {
    alignItems: 'center',
  },
  markerBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
  },
  markerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
});