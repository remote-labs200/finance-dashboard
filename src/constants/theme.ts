/**
 * Theme colors and constants for the finance dashboard.
 * Provides semantic color tokens for light and dark modes.
 */

import '@/global.css';

import { Platform } from 'react-native';

// --- Semantic Color Tokens ---

export const Colors = {
  light: {
    // Surfaces
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    textTertiary: '#999999',

    // Cards & borders
    card: '#ffffff',
    cardBorder: 'rgba(128,128,128,0.15)',
    divider: 'rgba(128,128,128,0.2)',
    border: 'rgba(128,128,128,0.3)',
    inputBorder: '#ccc',
    inputBackground: '#ffffff',

    // Placeholder text
    placeholder: '#999999',

    // Semantic
    primary: '#1a6ba5',
    primaryText: '#ffffff',
    success: '#22c55e',
    danger: '#ef4444',
    error: '#ef4444',
    warning: '#f59e0b',
    purple: '#8b5cf6',
    orange: '#f97316',
    cyan: '#06b6d4',
    pink: '#ec4899',
    surface: '#ffffff',

    // Modal
    modalOverlay: 'rgba(0,0,0,0.5)',
    modalBackground: '#ffffff',
  },
  dark: {
    // Surfaces
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    textTertiary: '#777777',

    // Cards & borders
    card: '#1a1a1a',
    cardBorder: 'rgba(255,255,255,0.1)',
    divider: 'rgba(255,255,255,0.12)',
    border: 'rgba(255,255,255,0.15)',
    inputBorder: '#444444',
    inputBackground: '#1a1a1a',

    // Placeholder text
    placeholder: '#777777',

    // Semantic (same in both modes for brand consistency)
    primary: '#1a6ba5',
    primaryText: '#ffffff',
    success: '#22c55e',
    danger: '#ef4444',
    error: '#ef4444',
    warning: '#f59e0b',
    purple: '#8b5cf6',
    orange: '#f97316',
    cyan: '#06b6d4',
    pink: '#ec4899',
    surface: '#1a1a1a',

    // Modal
    modalOverlay: 'rgba(0,0,0,0.7)',
    modalBackground: '#1a1a1a',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type ThemePalette = typeof Colors.light;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
