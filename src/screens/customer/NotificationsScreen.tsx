import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { notificationsApi } from '../../api/charging';
import { QUERY_KEYS }       from '../../constants/api';
import { Notification }     from '../../types';
import { COLORS, SPACING, RADIUS } from '../../theme';

// ─────────────────────────────────────────────────────────────────────────────
// Time helpers — Accra / UTC+0
//
// The server stores timestamps in Accra time (Africa/Accra = UTC+0).
// JavaScript's `new Date(str)` treats strings WITHOUT a timezone suffix as
// *local device time*, so on a phone set to IST (UTC+5:30) a naked timestamp
// like "2024-01-15 10:30:00" would be parsed 5 h 30 min late, making every
// notification appear newer than it really is.
//
// Fix: if the string has no explicit timezone info, append 'Z' to force UTC
// parsing — which is identical to Accra time (UTC+0).
// ─────────────────────────────────────────────────────────────────────────────
function parseAccraTime(dateStr: string): Date {
  if (!dateStr) return new Date();
  // Already carries timezone info (e.g. trailing Z or ±HH:MM) — parse as-is
  if (/Z$|[+-]\d{2}:\d{2}$|[+-]\d{4}$/.test(dateStr)) {
    return new Date(dateStr);
  }
  // No timezone — treat as UTC / Accra (UTC+0)
  // Also replace the space separator used by MySQL/Laravel with T
  return new Date(dateStr.replace(' ', 'T') + 'Z');
}

function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff  = Date.now() - parseAccraTime(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);

  if (diff < 0)   return 'Just now';   // clock-skew guard
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;

  // Older than a week — show the actual date in Accra (UTC) timezone
  return parseAccraTime(dateStr).toLocaleDateString('en-GH', {
    timeZone: 'Africa/Accra',
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// NotificationsScreen
// ─────────────────────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const navigation  = useNavigation<any>();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: QUERY_KEYS.notifications,
    queryFn:  notificationsApi.getNotifications,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const notifications = data?.notifications ?? [];
  const unreadCount   = data?.unread_count   ?? 0;

  // ── Mutations — identical to original ────────────────────────────────────
  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications }),
  });

  const markAllMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications }),
  });

  // ── Handlers — identical to original ─────────────────────────────────────
  const handlePress = useCallback(
    (notif: Notification) => {
      if (!notif.is_read) markReadMutation.mutate(notif.id);
      const requestId = notif.request_id ?? notif.data?.request_id;
      if (requestId) {
        navigation.navigate('Requests', {
          screen: 'RequestDetail',
          params: { requestId },
        });
      }
    },
    [markReadMutation, navigation],
  );

  const handleMarkAll = useCallback(
    () => markAllMutation.mutate(),
    [markAllMutation],
  );

  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={goBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSub}>{unreadCount} unread</Text>
          )}
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={handleMarkAll}
            disabled={markAllMutation.isPending}
            activeOpacity={0.75}
          >
            {markAllMutation.isPending ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.markAllText}>Mark all read</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ── Content ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={COLORS.primary} size="large" />
          <Text style={styles.loadingText}>Loading notifications…</Text>
        </View>

      ) : notifications.length === 0 ? (
        <View style={styles.centerBox}>
          {/* Ionicons replaces 🔔 emoji */}
          <View style={styles.emptyIconBox}>
            <Ionicons name="notifications-outline" size={38} color={COLORS.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySub}>
            You'll be notified when your service request status changes.
          </Text>
        </View>

      ) : (
        <FlatList
          data={notifications}
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
          renderItem={({ item }) => (
            <NotificationItem
              notification={item}
              onPress={() => handlePress(item)}
              onMarkRead={() => markReadMutation.mutate(item.id)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NotificationItem
// ─────────────────────────────────────────────────────────────────────────────
function NotificationItem({
  notification,
  onPress,
  onMarkRead,
}: {
  notification: Notification;
  onPress: () => void;
  onMarkRead: () => void;
}) {
  const isRead = notification.is_read;
  const icon   = notification.request_id
    ? 'construct-outline'
    : 'notifications-outline';

  const timeAgo = formatTimeAgo(
    notification.sent_at ?? notification.created_at ?? ''
  );

  return (
    <TouchableOpacity
      style={[styles.item, !isRead && styles.itemUnread]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Icon + unread dot */}
      <View style={styles.itemLeft}>
        <View style={[
          styles.iconCircle,
          // rgba instead of COLORS.primary + '22'
          !isRead && { backgroundColor: 'rgba(127, 191, 49, 0.13)' },
        ]}>
          <Ionicons
            name={icon}
            size={20}
            color={isRead ? COLORS.textMuted : COLORS.primary}
          />
        </View>
        {!isRead && <View style={styles.unreadDot} />}
      </View>

      {/* Body */}
      <View style={styles.itemBody}>
        <Text
          style={[styles.itemTitle, !isRead && { color: COLORS.textPrimary }]}
          numberOfLines={1}
        >
          {notification.title}
        </Text>
        <Text style={styles.itemMessage} numberOfLines={2}>
          {notification.message}
        </Text>
        <Text style={styles.itemTime}>{timeAgo}</Text>
      </View>

      {/* Mark-read checkmark */}
      {!isRead && (
        <TouchableOpacity
          style={styles.markReadBtn}
          onPress={(e) => { e.stopPropagation?.(); onMarkRead(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      )}
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
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
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
    fontSize: 18,
    fontWeight: '800',
  },
  headerSub: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  markAllBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    // rgba instead of COLORS.primary + '55' and COLORS.primary + '15'
    borderColor:     'rgba(127, 191, 49, 0.33)',
    backgroundColor: 'rgba(127, 191, 49, 0.08)',
    minWidth: 40,
    alignItems: 'center',
  },
  markAllText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Center states ─────────────────────────────────────────────────────────
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.lg,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 14,
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
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── List ──────────────────────────────────────────────────────────────────
  list: {
    paddingVertical: SPACING.sm,
  },

  // ── Notification item ─────────────────────────────────────────────────────
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  itemUnread: {
    // rgba instead of COLORS.primary + '08' — avoids 8-digit hex Android issue
    backgroundColor: 'rgba(127, 191, 49, 0.04)',
  },

  itemLeft: {
    alignItems: 'center',
    gap: 5,
    paddingTop: 2,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },

  itemBody: {
    flex: 1,
    gap: 3,
  },
  itemTitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  itemMessage: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  itemTime: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },

  markReadBtn: {
    padding: 4,
    marginTop: 2,
  },
});