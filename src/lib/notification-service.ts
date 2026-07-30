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
 *
 * ## Expo Go Limitation
 *
 * From SDK 53, Expo Go removed Android push notification support. The import
 * of `expo-notifications` itself throws on Android in Expo Go. To work around
 * this, all imports are lazy (dynamic `import()` inside each function).
 * Local notifications still work on iOS in Expo Go and on both platforms
 * when using a development build.
 */

import { Platform } from 'react-native';
import { getQuarterlyDueDates, daysUntil } from './format';

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
 * Schedules notifications 7 days and 1 day before each deadline.
 */
export async function scheduleTaxDeadlineReminders(year: number): Promise<void> {
  const Notifications = await ensureHandler();
  if (!Notifications) return;

  try {
    await cancelNotificationsByChannel(Notifications, TAX_CHANNEL_ID);

    const deadlines = getQuarterlyDueDates(year);
    const now = Date.now();

    for (const deadline of deadlines) {
      const days = daysUntil(deadline.dueDate);

      if (days <= 0) continue;

      // 7-day reminder
      if (days > 7) {
        const triggerDate = new Date(deadline.dueDate + 'T09:00:00');
        triggerDate.setDate(triggerDate.getDate() - 7);

        if (triggerDate.getTime() > now) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Tax Deadline Approaching',
              body: `Your Q${deadline.quarter} estimated tax payment is due in 7 days (${deadline.dueDate}).`,
              data: { type: 'tax_deadline', quarter: deadline.quarter },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: triggerDate,
              channelId: TAX_CHANNEL_ID,
            },
          });
        }
      }

      // 1-day reminder
      if (days > 1) {
        const triggerDate = new Date(deadline.dueDate + 'T09:00:00');
        triggerDate.setDate(triggerDate.getDate() - 1);

        if (triggerDate.getTime() > now) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Tax Deadline Tomorrow!',
              body: `Your Q${deadline.quarter} estimated tax payment is due tomorrow. Don't forget to submit.`,
              data: { type: 'tax_deadline', quarter: deadline.quarter },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: triggerDate,
              channelId: TAX_CHANNEL_ID,
            },
          });
        }
      }
    }
  } catch {
    // Silently fail if notifications are unavailable
  }
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
// Push Notifications (to build)
// =============================================================================
// Run `grep -n 'TODO-PUSH' src/lib/notification-service.ts` to find all stubs.
// See BLUEPRINT.md → Push Notifications for full spec.
// =============================================================================

/**
 * TODO-PUSH-1: Register Expo Push Token
 *
 * - Generate an ExpoPushToken via Notifications.getExpoPushTokenAsync({ projectId })
 * - Persist it to Supabase user_preferences via preferences-repo
 * - This lets downstream Edge Functions (like the payment processor) send
 *   real-time push notifications to this specific device.
 */
export async function registerPushToken(): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) throw new Error('expo-notifications is not available in this environment');
  throw new Error('TODO-PUSH-1: registerPushToken not yet implemented');
}

/**
 * TODO-PUSH-2: Subscribe to Supabase Realtime Channel for Push Events
 *
 * This client-side subscription listens for INSERT events on a dedicated
 * `push_notifications` table (or listens on a Supabase Realtime broadcast channel).
 * When a new push event arrives, it triggers a local notification so the user
 * sees it even if the app is in the foreground.
 *
 * Edge Functions like `notify-push` INSERT into this table after sending via
 * Expo Push API.
 */
export function subscribeToRealtimePushEvents(): () => void {
  throw new Error('TODO-PUSH-2: subscribeToRealtimePushEvents not yet implemented');
}

/**
 * TODO-PUSH-3: Handle Notification Tap with Deep Link
 *
 * When the user taps a push notification, route them to the relevant screen.
 * - 'payment_received' → /accounts screen
 * - 'sync_complete' → /cloud-sync screen
 * - 'tax_deadline' → /tax-config screen
 * - 'ai_insight_ready' → /insights screen
 *
 * Wire this into _layout.tsx's onNotificationResponse handler.
 */
export async function handleNotificationResponse(): Promise<void> {
  throw new Error('TODO-PUSH-3: handleNotificationResponse not yet implemented');
}
