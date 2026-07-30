/**
 * Notification store — manages in-app notification list and unread badge count.
 *
 * Architecture:
 *   use-notification-store  (client state, no persistence — rebuilt on sign-in)
 *         │
 *         ├── badgeCount     ← integer shown on the bell icon dot
 *         ├── notifications  ← array of NotificationItem
 *         ├── markRead()     ← clears badge when user opens the center
 *         ├── addNotification()
 *         └── dismissNotification()
 *
 * Future: When push notifications are implemented (see BLUEPRINT.md),
 *         this store will be populated by the Realtime subscription
 *         and/or the notify-push Edge Function callback.
 */

import React from 'react';
import { create } from 'zustand';

// ── Types ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'tax_deadline'
  | 'payment_reminder'
  | 'weekly_summary'
  | 'anomaly'
  | 'sync_status'
  | 'feature'
  | 'system';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: number; // unix ms
  read: boolean;
  /** Optional deep-link route to navigate to when tapped */
  actionRoute?: string;
}

// ── Store ────────────────────────────────────────────────────────────

interface NotificationState {
  notifications: NotificationItem[];
  badgeCount: number;

  /** Populate store (e.g. on sign-in from cache or remote). */
  setNotifications: (items: NotificationItem[]) => void;

  /** Mark a single notification as read and decrement badge. */
  markRead: (id: string) => void;

  /** Mark all as read and reset badge to 0. */
  markAllRead: () => void;

  /** Add a new notification (prepends, increments badge). */
  addNotification: (item: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>) => void;

  /** Remove a notification entirely. */
  dismissNotification: (id: string) => void;

  /** Clear all notifications — resets badge to 0. */
  clearAll: () => void;

  /** Override badge count directly (used by Realtime subscription). */
  setBadgeCount: (count: number) => void;
}

let _counter = 0;
function nextId(): string {
  _counter += 1;
  return `notif-${Date.now()}-${_counter}`;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  badgeCount: 0,

  setNotifications: (items) =>
    set({ notifications: items, badgeCount: items.filter((n) => !n.read).length }),

  markRead: (id) => {
    const { notifications, badgeCount } = get();
    const item = notifications.find((n) => n.id === id);
    if (!item || item.read) return;
    set({
      notifications: notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      badgeCount: Math.max(0, badgeCount - 1),
    });
  },

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      badgeCount: 0,
    })),

  addNotification: (item) =>
    set((s) => ({
      notifications: [{ ...item, id: nextId(), createdAt: Date.now(), read: false }, ...s.notifications],
      badgeCount: s.badgeCount + 1,
    })),

  dismissNotification: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
      badgeCount: Math.max(0, s.badgeCount - (s.notifications.find((n) => n.id === id)?.read ? 0 : 1)),
    })),

  clearAll: () => set({ notifications: [], badgeCount: 0 }),

  setBadgeCount: (count) => set({ badgeCount: count }),
}));

// ── Helper: generate an in-app notification (wraps store call) ─────

export function generateLocalNotification(
  type: NotificationType,
  title: string,
  body: string,
  actionRoute?: string,
) {
  useNotificationStore.getState().addNotification({ type, title, body, actionRoute });
}

// ── React hook for badge count (convenience) ───────────────────────

export function useBadgeCount(): number {
  return useNotificationStore((s) => s.badgeCount);
}
