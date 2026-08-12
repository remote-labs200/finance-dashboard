/**
 * Notification Service
 *
 * Two notification systems:
 * 1. **Local Notifications** (built) — scheduled on-device via `expo-notifications`.
 *    Works offline. Used for tax deadline reminders and dry month alerts.
 * 2. **Push Notifications** (planned) — real-time server-sent notifications via
 *    Supabase Realtime + Expo Push API. Used for payment confirmations, sync
 *    events, AI insights ready, and server-pushed tax rule updates.
 *
 * ## Expo Go Limitation
 *
 * From SDK 53, Expo Go removed Android push notification support. The
 * `expo-notifications` JS module has a top-level side effect in
 * `DevicePushTokenAutoRegistration.fx.js` that throws on module load.
 *
 * **Fix:** `metro.config.js` intercepts the `expo-notifications` module
 * resolution and returns a stub (`expo-notifications-stub.ts`) at bundle time.
 * The stub has matching exports but zero side effects. No code changes needed
 * when moving to a development build — the stub is swapped out automatically.
 *
 * To use the real module (dev build / EAS):
 *   EXPO_PUBLIC_USE_REAL_NOTIFICATIONS=true npx expo run:android
 *
 * ## Local Notifications
 *
 * | Notification | Trigger | Scheduling |
 * |---|---|---|
 * | Tax deadline 7-day warning | Quarterly due dates | Scheduled on tax profile setup |
 * | Tax deadline 1-day warning | 24h before due date | Scheduled on tax profile setup |
 * | Dry month alert | Income smoothing engine | Immediate when threshold breached |
 *
 * ## Push Notifications (to build)
 *
 * See BLUEPRINT.md for full spec. Required work:
 * - registerPushToken() — get Expo push token, sync to Supabase user_preferences
 * - subscribeToRealtimeChannel() — listen for notification events from server
 * - handleNotificationResponse() — deep-link on notification tap
 * - notifyPush Edge Function — server-side push sender via Expo Push API
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import Constants from 'expo-constants';
import { getQuarterlyDueDates, daysUntil } from './format';
import { supabase } from './supabase';
import { getPreference, setPreference } from '../db/preferences-repo';
import {
  useNotificationStore,
  type NotificationItem,
  type NotificationType,
} from '../stores/use-notification-store';

type NotificationsModule = typeof import('expo-notifications');

const TAX_CHANNEL_ID = 'tax-reminders';
const SMOOTHING_CHANNEL_ID = 'income-alerts';

/** Lazy-load expo-notifications, returning null if unavailable. */
async function loadNotifications(): Promise<NotificationsModule | null> {
  try {
    return await import('expo-notifications');
  } catch {
    // expo-notifications not available (Expo Go SDK 53+ on Android, or web)
    return null;
  }
}

// --- Configuration (lazy) ---

let _handlerConfigured = false;

async function ensureHandler(): Promise<NotificationsModule | null> {
  const Notifications = await loadNotifications();
  if (!Notifications || _handlerConfigured) return Notifications;
  _handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  return Notifications;
}

// --- Channel Setup ---

export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const Notifications = await ensureHandler();
  if (!Notifications) return;

  try {
    await Notifications.setNotificationChannelAsync(TAX_CHANNEL_ID, {
      name: 'Tax Deadline Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      description: 'Reminders for quarterly estimated tax payments',
    });

    await Notifications.setNotificationChannelAsync(SMOOTHING_CHANNEL_ID, {
      name: 'Income Alerts',
      importance: Notifications.AndroidImportance.DEFAULT,
      description: 'Alerts about income smoothing and dry months',
    });
  } catch {
    // Silently fail if notifications are unavailable
  }
}

// --- Permission ---

export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = await ensureHandler();
  if (!Notifications) return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch {
    return false;
  }
}

// --- Tax Deadline Notifications ---

/**
 * Schedule reminders for upcoming quarterly tax deadlines.
 * Schedules 7-day and 1-day warnings before each quarter's due date, for the
 * given year and the following year (covers Q4 of the current year, which
 * falls in January of the next).
 *
 * Each scheduled notification carries `channelId` in its data so it can be
 * cancelled/re-scheduled alongside Android channel setup.
 */
export async function scheduleTaxDeadlineReminders(
  year: number = new Date().getFullYear(),
): Promise<void> {
  const Notifications = await ensureHandler();
  if (!Notifications) return;

  try {
    await cancelNotificationsByChannel(Notifications, TAX_CHANNEL_ID);

    // Deduplicate deadlines by due date across the two years.
    const deadlines = new Map<string, number>();
    for (const y of [year, year + 1]) {
      for (const d of getQuarterlyDueDates(y)) {
        deadlines.set(d.dueDate, d.quarter);
      }
    }

    const now = Date.now();

    for (const [dueDate, quarter] of deadlines) {
      const days = daysUntil(dueDate);
      if (days <= 0) continue;

      const reminders: Array<{
        daysEarly: number;
        title: string;
        body: string;
      }> = [
        {
          daysEarly: 7,
          title: 'Tax Deadline Approaching',
          body: `Your Q${quarter} estimated tax payment is due in 7 days (${dueDate}).`,
        },
        {
          daysEarly: 1,
          title: 'Tax Deadline Tomorrow!',
          body: `Your Q${quarter} estimated tax payment is due tomorrow. Don't forget to submit.`,
        },
      ];

      for (const reminder of reminders) {
        if (days <= reminder.daysEarly) continue;
        const triggerDate = new Date(`${dueDate}T09:00:00`);
        triggerDate.setDate(triggerDate.getDate() - reminder.daysEarly);

        if (triggerDate.getTime() <= now) continue;

        await Notifications.scheduleNotificationAsync({
          content: {
            title: reminder.title,
            body: reminder.body,
            data: {
              type: 'tax_deadline',
              quarter,
              channelId: TAX_CHANNEL_ID,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
            channelId: TAX_CHANNEL_ID,
          },
        });
      }
    }
  } catch {
    // Silently fail if notifications are unavailable
  }
}

/**
 * Cancel all scheduled tax-deadline reminders (used when the user disables
 * tax notifications or signs out).
 */
export async function cancelTaxDeadlineReminders(): Promise<void> {
  const Notifications = await ensureHandler();
  if (!Notifications) return;
  try {
    await cancelNotificationsByChannel(Notifications, TAX_CHANNEL_ID);
  } catch {
    // Silently fail
  }
}

/**
 * Re-arm the tax-deadline notifications to match the user's current
 * notification preferences. When the master switch or the tax-deadline type
 * is disabled, any previously scheduled reminders are cancelled.
 *
 * Call this on sign-in and whenever notification preferences change.
 */
export async function refreshTaxDeadlineReminders(
  db: SQLite.SQLiteDatabase,
  userId: string,
): Promise<void> {
  const [master, taxEnabled] = await Promise.all([
    getPreference(db, userId, 'notifications_enabled'),
    getPreference(db, userId, 'notif_tax_deadline'),
  ]);

  if (master === 'false' || taxEnabled === 'false') {
    await cancelTaxDeadlineReminders();
    return;
  }

  await scheduleTaxDeadlineReminders();
}

// --- Income Smoothing Notifications ---

/**
 * Send a dry month warning notification.
 */
export async function sendDryMonthWarning(monthName: string, shortfallCents: number): Promise<void> {
  const Notifications = await ensureHandler();
  if (!Notifications) return;

  try {
    const amount = (shortfallCents / 100).toFixed(2);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Dry Month Warning',
        body: `${monthName} is projected to be a dry month. You may be short $${amount} from your safe pay amount.`,
        data: { type: 'dry_month', month: monthName },
      },
      trigger: null, // Immediate
    });
  } catch {
    // Silently fail
  }
}

// --- Utilities ---

async function cancelNotificationsByChannel(Notifications: NotificationsModule, channelId: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduled) {
    if (notification.content.data?.channelId === channelId) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
}

/**
 * Cancel all scheduled notifications.
 */
export async function cancelAllNotifications(): Promise<void> {
  const Notifications = await ensureHandler();
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Silently fail
  }
}

/**
 * Get all pending scheduled notifications.
 */
export async function getScheduledNotifications() {
  const Notifications = await ensureHandler();
  if (!Notifications) return [];
  try {
    return Notifications.getAllScheduledNotificationsAsync();
  } catch {
    return [];
  }
}

/**
 * Get badge count.
 */
export async function getBadgeCount(): Promise<number> {
  const Notifications = await ensureHandler();
  if (!Notifications) return 0;
  try {
    return Notifications.getBadgeCountAsync();
  } catch {
    return 0;
  }
}

/**
 * Set badge count.
 */
export async function setBadgeCount(count: number): Promise<void> {
  const Notifications = await ensureHandler();
  if (!Notifications) return;
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch {
    // Silently fail
  }
}

// =============================================================================
// Push Notifications
// =============================================================================
// Real-time server-sent notifications delivered via the Expo Push API and
// recorded in the `push_notifications` table for the in-app feed.
//
// Flow:
//   1. App registers its Expo push token → `user_preferences` (key push_token)
//   2. Server / other devices call the `notify-push` edge function →
//      sends via Expo Push API + INSERTs into `push_notifications`
//   3. App listens on a Realtime channel for that INSERT → in-app feed updates
//   4. On sign-in the app re-pulls recent rows so the feed survives restarts
//   5. Tapping a notification deep-links to the relevant screen
//
// Note: in Expo Go the metro resolver swaps expo-notifications for
// expo-notifications-stub.ts (SDK 53+ removed Android push support). Every
// function below degrades gracefully to a no-op in that case.
// =============================================================================

const PUSH_TOKEN_KEY = 'expo_push_token';

const NOTIFICATION_TYPES: NotificationType[] = [
  'tax_deadline',
  'payment_reminder',
  'weekly_summary',
  'anomaly',
  'sync_status',
  'feature',
  'system',
];

interface PushNotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  action_route: string | null;
  data?: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

function rowToNotificationItem(row: PushNotificationRow): NotificationItem {
  return {
    id: row.id,
    type: NOTIFICATION_TYPES.includes(row.type as NotificationType)
      ? (row.type as NotificationType)
      : 'system',
    title: row.title,
    body: row.body,
    createdAt: Date.parse(row.created_at) || Date.now(),
    read: row.is_read,
    actionRoute: row.action_route ?? undefined,
  };
}

/**
 * TODO-PUSH-1 ✅: Register the device's Expo push token.
 *
 * - Generates an ExpoPushToken via `getExpoPushTokenAsync({ projectId })`
 * - Persists it to `user_preferences` (key `push_token`) so the `notify-push`
 *   edge function can reach this device
 * - Also caches it in SecureStore for offline reference
 *
 * No-ops in Expo Go (the metro stub returns a fake token and/or the EAS
 * project id is missing).
 */
export async function registerPushToken(
  db: SQLite.SQLiteDatabase,
  userId: string,
): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return;

  let token: { data: string } | null = null;
  try {
    token = await Notifications.getExpoPushTokenAsync({
      projectId: getExpoProjectId(),
    });
  } catch {
    // Missing EAS project id (Expo Go / no eas.json) — nothing to register.
    return;
  }

  // The metro stub returns a fixed fake token — don't sync it.
  if (!token || !token.data || token.data === 'stub-push-token') return;
  if (!token.data.startsWith('ExponentPushToken')) return;

  try {
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token.data);
  } catch {
    // SecureStore unavailable — still sync to the cloud below.
  }

  try {
    await setPreference(db, userId, 'push_token', token.data);
  } catch (err) {
    console.warn('Failed to sync push token:', err);
  }
}

function getExpoProjectId(): string | undefined {
  // Available in Expo SDK 57; undefined in Expo Go without an EAS project.
  return (
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId
  );
}

/**
 * TODO-PUSH-2 ✅: Subscribe to Supabase Realtime for push events.
 *
 * Listens for INSERTs on `public.push_notifications` scoped to this user and
 * surfaces them in the in-app notification store instantly. Returns an
 * unsubscribe function.
 */
export function subscribeToRealtimePushEvents(
  userId: string,
): () => void {
  if (!supabase || !userId) return () => {};

  const client = supabase;
  const channel = client
    .channel(`push-notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'push_notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as PushNotificationRow | undefined;
        if (!row) return;
        useNotificationStore.getState().addNotification({
          type: NOTIFICATION_TYPES.includes(row.type as NotificationType)
            ? (row.type as NotificationType)
            : 'system',
          title: row.title,
          body: row.body,
          actionRoute: row.action_route ?? undefined,
        });
      },
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

/**
 * Pull recent push notifications from the cloud into the in-app feed.
 * Call after sign-in so the notification center survives app restarts.
 */
export async function fetchNotificationHistory(
  userId: string,
): Promise<void> {
  if (!supabase || !userId) return;

  const { data, error } = await supabase
    .from('push_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data) return;

  const store = useNotificationStore.getState();
  const existing = store.notifications;
  const dbIds = new Set((data as PushNotificationRow[]).map((r) => r.id));
  const locals = existing.filter((n) => !dbIds.has(n.id));
  store.setNotifications([
    ...(data as PushNotificationRow[]).map(rowToNotificationItem),
    ...locals,
  ]);
}

/**
 * Mark a single notification as read in the cloud (and locally).
 */
export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase
      .from('push_notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('id', notificationId);
  } catch {
    // Best-effort — local read state still updates.
  }
}

/**
 * Mark all of a user's notifications as read in the cloud.
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase
      .from('push_notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
  } catch {
    // Best-effort.
  }
}

/**
 * Clear a user's notification history from the cloud.
 */
export async function clearNotificationHistory(
  userId: string,
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase
      .from('push_notifications')
      .delete()
      .eq('user_id', userId);
  } catch {
    // Best-effort.
  }
}

/**
 * Helper to push a notification through the `notify-push` edge function.
 * Used by the app itself when it wants to trigger a push (e.g. a test).
 */
export async function sendPushNotification(
  userId: string,
  payload: {
    title: string;
    body: string;
    type?: string;
    actionRoute?: string;
    data?: Record<string, unknown>;
  },
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.functions.invoke('notify-push', {
      body: { user_id: userId, ...payload },
    });
  } catch (err) {
    console.warn('sendPushNotification failed:', err);
  }
}

// --- Notification tap → deep link ---

interface NotificationTapPayload {
  type: string;
  actionRoute: string | null;
  data?: Record<string, unknown>;
}

function extractTapPayload(response: {
  notification?: {
    request?: { content?: { data?: Record<string, unknown> } };
  };
}): NotificationTapPayload | null {
  const data = response?.notification?.request?.content?.data;
  if (!data || typeof data !== 'object') return null;
  return {
    type: typeof data.type === 'string' ? data.type : 'system',
    actionRoute: typeof data.actionRoute === 'string' ? data.actionRoute : null,
    data,
  };
}

/**
 * Return the tap payload when the app was opened by tapping a notification
 * (cold start). Returns null when launched normally.
 */
export async function getInitialNotificationResponse(): Promise<NotificationTapPayload | null> {
  const Notifications = await loadNotifications();
  if (!Notifications) return null;
  try {
    if (typeof Notifications.getLastNotificationResponseAsync !== 'function') {
      return null;
    }
    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) return null;
    return extractTapPayload(response as never);
  } catch {
    return null;
  }
}

/**
 * TODO-PUSH-3 ✅: Handle notification taps (warm start).
 *
 * Invoke `onTap` with the notification's type / actionRoute whenever the user
 * taps a push notification while the app is running. Returns an unsubscribe
 * function. Wire this into the root layout and route via the type map.
 */
export function addNotificationTapListener(
  onTap: (payload: NotificationTapPayload) => void,
): () => void {
  let subscription: { remove: () => void } | null = null;

  loadNotifications().then((Notifications) => {
    if (!Notifications) return;
    subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const payload = extractTapPayload(response as never);
        if (payload) onTap(payload);
      },
    );
  });

  return () => {
    subscription?.remove();
  };
}

/**
 * Map a notification type to the route that should open when it's tapped.
 * Falls back to the explicit `actionRoute` when present.
 */
export function routeForNotification(payload: {
  type: string;
  actionRoute?: string | null;
}): string | null {
  if (payload.actionRoute) return payload.actionRoute;
  const byType: Record<string, string> = {
    tax_deadline: '/(tabs)/tax-payments',
    payment_reminder: '/(tabs)/(main)/clients',
    payment_received: '/(tabs)/(main)/clients',
    weekly_summary: '/(tabs)/reports',
    sync_status: '/(tabs)/cloud-sync',
    anomaly: '/(tabs)/insights',
    ai_insight_ready: '/(tabs)/insights',
    feature: '/(tabs)/notifications',
  };
  return byType[payload.type] ?? null;
}
