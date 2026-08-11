/**
 * UI Preferences store — persists compact mode, and haptics.
 *
 * These are client-only preferences stored in SecureStore.
 * They control the app shell layout and are available immediately on boot.
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

// ── Keys ─────────────────────────────────────────────────────────────

const COMPACT_KEY = 'ui_compact_mode';
const HAPTICS_KEY = 'ui_haptics_enabled';
const FONT_SCALE_KEY = 'ui_font_scale';

// ── Types ────────────────────────────────────────────────────────────

export type FontScaleLevel = 'small' | 'medium' | 'large';

export const FONT_SCALE_MAP: Record<FontScaleLevel, number> = {
  small: 0.9,
  medium: 1.0,
  large: 1.15,
};

interface UiPrefsState {
  compactMode: boolean;
  hapticsEnabled: boolean;
  fontScaleLevel: FontScaleLevel;
  fontScale: number; // computed multiplier
  isLoading: boolean;

  setCompactMode: (enabled: boolean) => Promise<void>;
  setHapticsEnabled: (enabled: boolean) => Promise<void>;
  setFontScaleLevel: (level: FontScaleLevel) => Promise<void>;
  loadPrefs: () => Promise<void>;
}

// ── Store ────────────────────────────────────────────────────────────

export const useUiPrefs = create<UiPrefsState>((set, get) => ({
  compactMode: false,
  hapticsEnabled: true,
  fontScaleLevel: 'medium',
  fontScale: 1.0,
  isLoading: true,

  loadPrefs: async () => {
    try {
      const [compact, haptics, fontScaleRaw] = await Promise.all([
        SecureStore.getItemAsync(COMPACT_KEY),
        SecureStore.getItemAsync(HAPTICS_KEY),
        SecureStore.getItemAsync(FONT_SCALE_KEY),
      ]);

      const fsLevel: FontScaleLevel =
        fontScaleRaw === 'small' ? 'small' :
        fontScaleRaw === 'large' ? 'large' :
        'medium';

      set({
        compactMode: compact === 'true',
        hapticsEnabled: haptics !== 'false',
        fontScaleLevel: fsLevel,
        fontScale: FONT_SCALE_MAP[fsLevel],
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
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

  setFontScaleLevel: async (level) => {
    try {
      await SecureStore.setItemAsync(FONT_SCALE_KEY, level);
    } catch { /* persist silently */ }
    set({ fontScaleLevel: level, fontScale: FONT_SCALE_MAP[level] });
  },
}));

// ── Convenience hooks ────────────────────────────────────────────────

export function useFontScale(): number {
  return useUiPrefs((s) => s.fontScale);
}

export function useFontScaleLevel(): FontScaleLevel {
  return useUiPrefs((s) => s.fontScaleLevel);
}
