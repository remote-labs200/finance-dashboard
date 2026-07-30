/**
 * Notifications — notification center screen.
 *
 * Shows a chronological feed of all in-app notifications with:
 *   - Type-specific icons and colors
 *   - Relative timestamps
 *   - Swipe/tap to mark as read
 *   - "Mark all read" header action
 *   - Empty state when no notifications
 */

import { useCallback, useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useResolvedThemeName } from '@/hooks/use-theme';
import { Colors, Spacing } from '@/constants/theme';
import {
  useNotificationStore,
  type NotificationItem,
  type NotificationType,
} from '@/stores/use-notification-store';

// ── Helpers ──────────────────────────────────────────────────────────

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

const TYPE_META: Record<NotificationType, { icon: string; label: string }> = {
  tax_deadline: { icon: '\u{1F4C5}', label: 'Tax Deadline' },
  payment_reminder: { icon: '\u{1F4B0}', label: 'Payment' },
  weekly_summary: { icon: '\u{1F4CA}', label: 'Summary' },
  anomaly: { icon: '\u{26A0}\u{FE0F}', label: 'Alert' },
  sync_status: { icon: '\u{1F504}', label: 'Sync' },
  feature: { icon: '\u{2728}', label: 'New' },
  system: { icon: '\u{1F6E0}\u{FE0F}', label: 'System' },
};

// ── Row ──────────────────────────────────────────────────────────────

function NotificationRow({ item }: { item: NotificationItem }) {
  const markRead = useNotificationStore((s) => s.markRead);
  const dismiss = useNotificationStore((s) => s.dismissNotification);
  const themeName = useResolvedThemeName();
  const colors = Colors[themeName];

  const meta = TYPE_META[item.type] ?? TYPE_META.system;

  return (
    <Pressable
      onPress={() => { if (!item.read) markRead(item.id); }}
      onLongPress={() => dismiss(item.id)}
      style={({ pressed }) => [
        styles.row,
        !item.read && { backgroundColor: colors.backgroundSelected },
        pressed && { opacity: 0.7 },
      ]}>
      {/* Type icon */}
      <View style={styles.rowIcon}>
        <ThemedText style={styles.rowEmoji}>{meta.icon}</ThemedText>
      </View>

      {/* Content */}
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <ThemedText type="smallBold" style={styles.rowTitle}>
            {item.title}
          </ThemedText>
          {!item.read && (
            <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
          )}
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.rowBody}>
          {item.body}
        </ThemedText>
        <View style={styles.rowFooter}>
          <ThemedText type="small" themeColor="textTertiary">
            {meta.label}
          </ThemedText>
          <ThemedText type="small" themeColor="textTertiary">
            {timeAgo(item.createdAt)}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

// ── Screen ───────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const notifications = useNotificationStore((s) => s.notifications);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const themeName = useResolvedThemeName();
  const colors = Colors[themeName];

  const hasUnread = useMemo(() => notifications.some((n) => !n.read), [notifications]);

  const renderItem = useCallback(
    ({ item }: { item: NotificationItem }) => <NotificationRow item={item} />,
    [],
  );

  const keyExtractor = useCallback((item: NotificationItem) => item.id, []);

  // ── Header ──

  const ListHeader = useCallback(
    () => (
      <View style={styles.header}>
        <ThemedText type="title">Notifications</ThemedText>
        {notifications.length > 0 && (
          <View style={styles.headerActions}>
            {hasUnread && (
              <Pressable onPress={markAllRead} hitSlop={8}>
                <ThemedText type="small" style={{ color: Colors[themeName].primary, fontWeight: '600' }}>
                  Mark all read
                </ThemedText>
              </Pressable>
            )}
            <Pressable onPress={clearAll} hitSlop={8}>
              <ThemedText type="small" themeColor="danger" style={{ fontWeight: '600' }}>
                Clear all
              </ThemedText>
            </Pressable>
          </View>
        )}
      </View>
    ),
    [notifications.length, hasUnread, markAllRead, clearAll, themeName],
  );

  // ── Empty state ──

  const ListEmpty = useCallback(
    () => (
      <View style={styles.empty}>
        <ThemedText style={styles.emptyIcon}>{'\u{1F514}'}</ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.emptyTitle}>
          No notifications yet
        </ThemedText>
        <ThemedText type="small" themeColor="textTertiary" style={styles.emptyBody}>
          Tax deadlines, payment reminders, and weekly summaries will appear here.
        </ThemedText>
      </View>
    ),
    [],
  );

  return (
    <ThemedView type="background" style={styles.container}>
      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.three,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.three,
  },

  // Row
  row: {
    flexDirection: 'row',
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    marginBottom: Spacing.one,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.two,
  },
  rowEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  rowContent: {
    flex: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  rowTitle: {
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowBody: {
    marginTop: 2,
    lineHeight: 18,
  },
  rowFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.half + 1,
  },

  // Empty
  empty: {
    alignItems: 'center',
    paddingTop: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.three,
  },
  emptyTitle: {
    marginBottom: Spacing.two,
  },
  emptyBody: {
    textAlign: 'center',
    lineHeight: 20,
  },
});
