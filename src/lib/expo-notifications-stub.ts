/**
 * Stub for `expo-notifications` used when running in Expo Go SDK 53+.
 *
 * ## Why This Exists
 *
 * From SDK 53, Expo Go removed Android push notification support. The
 * `expo-notifications` JS module has top-level side effects — specifically
 * `DevicePushTokenAutoRegistration.fx.js` calls `addPushTokenListener()` at
 * module load time. This call throws in Expo Go, crashing the entire app
 * regardless of try/catch or dynamic `import()`.
 *
 * ## How It Works
 *
 * `metro.config.js` intercepts resolution of `expo-notifications` and returns
 * this stub instead. All functions are no-ops that return sensible defaults.
 *
 * ## When Real Notifications Are Used
 *
 * In development builds (expo-dev-client) and production builds (EAS), the
 * real `expo-notifications` module is used. To signal that the real module
 * should be used, set the env var:
 *
 *   EXPO_PUBLIC_USE_REAL_NOTIFICATIONS=true
 *
 * For Expo Go (default), this stub is used silently — notification features
 * simply don't function, but nothing crashes.
 */

import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Enums / Constants
// ---------------------------------------------------------------------------

export const AndroidImportance: Record<string, number> = {
  DEFAULT: 3,
  HIGH: 4,
  LOW: 2,
  MIN: 1,
  MAX: 5,
  NONE: 0,
  UNSPECIFIED: -1000,
};

export const AndroidNotificationVisibility: Record<string, number> = {
  PUBLIC: 1,
  PRIVATE: 0,
  SECRET: -1,
};

export const AndroidAudioContentType: Record<string, number> = {
  UNKNOWN: 0,
  SPEECH: 1,
  MUSIC: 2,
  MOVIE: 3,
  SONIFICATION: 4,
};

export const AndroidAudioUsage: Record<string, number> = {
  UNKNOWN: 0,
  MEDIA: 1,
  VOICE_COMMUNICATION: 2,
  VOICE_COMMUNICATION_SIGNALLING: 3,
  ALARM: 4,
  NOTIFICATION: 5,
  NOTIFICATION_RINGTONE: 6,
  GAME: 14,
};

export const SchedulableTriggerInputTypes: Record<string, string> = {
  DATE: 'date',
  TIME_INTERVAL: 'timeInterval',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  YEARLY: 'yearly',
  CALENDAR: 'calendar',
};

// ---------------------------------------------------------------------------
// Types (mirrored for TypeScript compatibility)
// ---------------------------------------------------------------------------

export interface NotificationContent {
  title?: string;
  subtitle?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: string;
  badge?: number;
  categoryIdentifier?: string;
  attachments?: unknown[];
}

export interface NotificationRequest {
  identifier: string;
  content: NotificationContent;
  trigger: unknown;
}

export interface Notification {
  date: number;
  request: NotificationRequest;
}

export interface NotificationResponse {
  notification: Notification;
  actionIdentifier: string;
  userText?: string;
}

export interface NotificationPermissionsStatus {
  status: 'granted' | 'denied' | 'undetermined' | 'provisional';
  allowsSound?: boolean;
  allowsAlerts?: boolean;
  allowsBadge?: boolean;
  allowsAnnouncements?: boolean;
  allowsCriticalAlerts?: boolean;
  allowsTimeSensitive?: boolean;
  ios?: Record<string, unknown>;
}

export interface NotificationChannel {
  id: string;
  name: string;
  importance?: number;
  sound?: string;
  vibrationPattern?: number[];
  description?: string;
}

export interface ExpoPushToken {
  type: 'expo';
  data: string;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

let _handler: Record<string, unknown> | null = null;

export function setNotificationHandler(handler: Record<string, unknown>): void {
  _handler = handler;
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export async function getPermissionsAsync(): Promise<NotificationPermissionsStatus> {
  return { status: Platform.OS === 'ios' ? 'granted' : 'undetermined' };
}

export async function requestPermissionsAsync(): Promise<NotificationPermissionsStatus> {
  return { status: Platform.OS === 'ios' ? 'granted' : 'denied' };
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

export async function scheduleNotificationAsync(_request: {
  content: NotificationContent;
  trigger: unknown;
}): Promise<string> {
  return 'stub-id';
}

export async function cancelScheduledNotificationAsync(_identifier: string): Promise<void> {
  // no-op
}

export async function cancelAllScheduledNotificationsAsync(): Promise<void> {
  // no-op
}

export async function getAllScheduledNotificationsAsync(): Promise<NotificationRequest[]> {
  return [];
}

// ---------------------------------------------------------------------------
// Push Token
// ---------------------------------------------------------------------------

export async function getExpoPushTokenAsync(_options?: {
  projectId?: string;
  applicationId?: string;
  devicePushToken?: { type: string; data: string };
}): Promise<ExpoPushToken> {
  return { type: 'expo', data: 'stub-push-token' };
}

// ---------------------------------------------------------------------------
// Event Listeners
// ---------------------------------------------------------------------------

export function addNotificationResponseReceivedListener(
  _listener: (event: NotificationResponse) => void
): { remove: () => void } {
  return { remove: () => {} };
}

export function addNotificationReceivedListener(
  _listener: (notification: Notification) => void
): { remove: () => void } {
  return { remove: () => {} };
}

export function removeNotificationSubscription(_subscription: { remove: () => void }): void {
  // no-op
}

export function addNotificationCategoryAsync(
  _identifier: string,
  _actions: unknown[],
  _categoryOptions?: Record<string, unknown>
): Promise<void> {
  return Promise.resolve();
}

// ---------------------------------------------------------------------------
// Channels (Android)
// ---------------------------------------------------------------------------

export async function setNotificationChannelAsync(
  _channelId: string,
  _channel: NotificationChannel
): Promise<NotificationChannel | null> {
  return null;
}

export async function getNotificationChannelAsync(
  _channelId: string
): Promise<NotificationChannel | null> {
  return null;
}

export async function getNotificationChannelsAsync(): Promise<NotificationChannel[]> {
  return [];
}

export async function deleteNotificationChannelAsync(_channelId: string): Promise<void> {
  // no-op
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

export async function getBadgeCountAsync(): Promise<number> {
  return 0;
}

export async function setBadgeCountAsync(_count: number): Promise<boolean> {
  return false;
}

// ---------------------------------------------------------------------------
// Groups (Android)
// ---------------------------------------------------------------------------

export async function setNotificationGroupAsync(
  _groupId: string,
  _group: Record<string, unknown>
): Promise<void> {
  // no-op
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function getNotificationCategoriesAsync(): Promise<unknown[]> {
  return [];
}

export async function setNotificationCategoryAsync(
  _identifier: string,
  _actions: unknown[],
  _categoryOptions?: Record<string, unknown>
): Promise<unknown> {
  return null;
}

export async function deleteNotificationCategoryAsync(_identifier: string): Promise<boolean> {
  return true;
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export async function dismissNotificationAsync(_identifier: string): Promise<void> {
  // no-op
}

export async function dismissAllNotificationsAsync(): Promise<void> {
  // no-op
}

export async function getPresentedNotificationsAsync(): Promise<Notification[]> {
  return [];
}

export function getDevicePushTokenAsync(): Promise<{ type: string; data: string }> {
  return Promise.resolve({ type: 'ios', data: 'stub-device-token' });
}
