import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const THEME_KEY = 'theme_preference';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeState {
  preference: ThemePreference;
  isLoading: boolean;
  setPreference: (pref: ThemePreference) => Promise<void>;
  loadPreference: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'light', // Default to light
  isLoading: true,

  loadPreference: async () => {
    try {
      const stored = await SecureStore.getItemAsync(THEME_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        set({ preference: stored, isLoading: false });
      } else {
        set({ preference: 'light', isLoading: false });
      }
    } catch {
      set({ preference: 'light', isLoading: false });
    }
  },

  setPreference: async (pref) => {
    try {
      await SecureStore.setItemAsync(THEME_KEY, pref);
      set({ preference: pref });
    } catch {
      set({ preference: pref });
    }
  },
}));
