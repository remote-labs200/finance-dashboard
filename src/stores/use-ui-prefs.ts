/**
 * UI Preferences store — persists navbar position, compact mode, and haptics.
 *
 * These are client-only preferences stored in SecureStore.
 * They control the app shell layout and are available immediately on boot.
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

// ── Keys ─────────────────────────────────────────────────────────────

const NAVBAR_KEY = 'ui_navbar_position';
const COMPACT_KEY = 'ui_compact_mode';
const HAPTICS_KEY = 'ui_haptics_enabled';

// ── Types ────────────────────────────────────────────────────────────

export type NavbarPosition = 'bottom' | 'top';

interface UiPrefsState {
  navbarPosition: NavbarPosition;
  compactMode: boolean;
  hapticsEnabled: boolean;
  isLoading: boolean;

  setNavbarPosition: (pos: NavbarPosition) => Promise<void>;
  setCompactMode: (enabled: boolean) => Promise<void>;
  setHapticsEnabled: (enabled: boolean) => Promise<void>;
  loadPrefs: () => Promise<void>;
}

// ── Store ────────────────────────────────────────────────────────────

export const useUiPrefs = create<UiPrefsState>((set, get) => ({
  navbarPosition: 'bottom',
  compactMode: false,
  hapticsEnabled: true,
  isLoading: true,

  loadPrefs: async () => {
    try {
      const [navbar, compact, haptics] = await Promise.all([
        SecureStore.getItemAsync(NAVBAR_KEY),
        SecureStore.getItemAsync(COMPACT_KEY),
        SecureStore.getItemAsync(HAPTICS_KEY),
      ]);

      set({
        navbarPosition: navbar === 'top' ? 'top' : 'bottom',
        compactMode: compact === 'true',
        hapticsEnabled: haptics !== 'false', // default true
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  setNavbarPosition: async (pos) => {
    try {
      await SecureStore.setItemAsync(NAVBAR_KEY, pos);
    } catch { /* persist silently */ }
    set({ navbarPosition: pos });
  },

  setCompactMode: async (enabled) => {
    try {
      await SecureStore.setItemAsync(COMPACT_KEY, enabled ? 'true' : 'false');
    } catch { /* persist silently */ }
    set({ compactMode: enabled });
  },

  setHapticsEnabled: async (enabled) => {
    try {
      await SecureStore.setItemAsync(HAPTICS_KEY, enabled ? 'true' : 'false');
    } catch { /* persist silently */ }
    set({ hapticsEnabled: enabled });
  },
}));

// ── Convenience hooks ────────────────────────────────────────────────

export function useNavbarPosition(): NavbarPosition {
  return useUiPrefs((s) => s.navbarPosition);
}
