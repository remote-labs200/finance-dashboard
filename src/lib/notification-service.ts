/**
 * Notification Service
 *
 * Handles scheduling and managing local notifications for:
 * - Tax deadline reminders (quarterly estimated taxes)
 * - Income smoothing alerts (dry month warnings)
 * - General app notifications
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getQuarterlyDueDates, daysUntil } from './format';

// --- Configuration ---

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const TAX_CHANNEL_ID = 'tax-reminders';
const SMOOTHING_CHANNEL_ID = 'income-alerts';

// --- Channel Setup ---

export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

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
}

// --- Permission ---

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

// --- Tax Deadline Notifications ---

/**
 * Schedule reminders for upcoming quarterly tax deadlines.
 * Schedules notifications 7 days and 1 day before each deadline.
 */
export async function scheduleTaxDeadlineReminders(year: number): Promise<void> {
  // Cancel existing tax reminders first
  await cancelNotificationsByChannel(TAX_CHANNEL_ID);

  const deadlines = getQuarterlyDueDates(year);
  const now = Date.now();

  for (const deadline of deadlines) {
    const days = daysUntil(deadline.dueDate);

    // Only schedule for future deadlines
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
}

// --- Income Smoothing Notifications ---

/**
 * Send a dry month warning notification.
 */
export async function sendDryMonthWarning(monthName: string, shortfallCents: number): Promise<void> {
  const amount = (shortfallCents / 100).toFixed(2);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Dry Month Warning',
      body: `${monthName} is projected to be a dry month. You may be short $${amount} from your safe pay amount.`,
      data: { type: 'dry_month', month: monthName },
    },
    trigger: null, // Immediate
  });
}

// --- Utilities ---

/**
 * Cancel all notifications in a specific channel.
 */
async function cancelNotificationsByChannel(channelId: string): Promise<void> {
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
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get all pending scheduled notifications.
 */
export async function getScheduledNotifications() {
  return Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Get badge count.
 */
export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}

/**
 * Set badge count.
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}
