/**
 * Theme colors and constants for the finance dashboard.
 * Provides semantic color tokens for light and dark modes.
 */

import "@/global.css";

import { Platform } from "react-native";

// --- Semantic Color Tokens ---

export const Colors = {
  light: {
    // Surfaces
    text: "#000000",
    background: "#E0E5EC",
    backgroundElement: "#F0F0F3",
    backgroundSelected: "#E0E1E6",
    textSecondary: "#60646C",
    textTertiary: "#999999",

    // Cards & borders
    card: "#E0E5EC",
    cardBorder: "transparent",
    divider: "rgba(128,128,128,0.2)",
    border: "transparent",
    inputBorder: "transparent",
    inputBackground: "#E0E5EC",

    // Placeholder text
    placeholder: "#999999",

    // Semantic
    primary: "#6C63FF",
    accent: "#6C63FF",
    accentLight: "#8B84FF",
    accentSecondary: "#38B2AC",
    primaryText: "#ffffff",
    success: "#22c55e",
    danger: "#ef4444",
    error: "#ef4444",
    warning: "#f59e0b",
    purple: "#8b5cf6",
    orange: "#f97316",
    cyan: "#06b6d4",
    pink: "#ec4899",
    surface: "#E0E5EC",

    // Modal
    modalOverlay: "rgba(0,0,0,0.5)",
    modalBackground: "#ffffff",
  },
  dark: {
    // Surfaces
    text: "#ffffff",
    background: "#1a1a1a",
    backgroundElement: "#212225",
    backgroundSelected: "#2E3135",
    textSecondary: "#B0B4BA",
    textTertiary: "#777777",

    // Cards & borders
    card: "#1a1a1a",
    cardBorder: "rgba(255,255,255,0.1)",
    divider: "rgba(255,255,255,0.12)",
    border: "rgba(255,255,255,0.15)",
    inputBorder: "#444444",
    inputBackground: "#1a1a1a",

    // Placeholder text
    placeholder: "#777777",

    // Semantic (same in both modes for brand consistency)
    primary: "#6C63FF",
    accent: "#6C63FF",
    accentLight: "#8B84FF",
    accentSecondary: "#38B2AC",
    primaryText: "#ffffff",
    success: "#22c55e",
    danger: "#ef4444",
    error: "#ef4444",
    warning: "#f59e0b",
    purple: "#8b5cf6",
    orange: "#f97316",
    cyan: "#06b6d4",
    pink: "#ec4899",
    surface: "#1a1a1a",

    // Modal
    modalOverlay: "rgba(0,0,0,0.7)",
    modalBackground: "#1a1a1a",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type ThemePalette = typeof Colors.light;

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
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

export type NeumorphismTokens = {
  background: string;
  surface: string;
  accent: string;
  accentLight: string;
  accentSecondary: string;
  radiusContainer: number;
  radiusButton: number;
  radiusInner: number;
  shadowLight: string;
  shadowDark: string;
  extruded: string;
  extrudedHover: string;
  extrudedSmall: string;
  inset: string;
  insetDeep: string;
  insetSmall: string;
};

export const Neumorphism: NeumorphismTokens = {
  background: "#E0E5EC",
  surface: "#E0E5EC",
  accent: "#6C63FF",
  accentLight: "#8B84FF",
  accentSecondary: "#38B2AC",
  radiusContainer: 32,
  radiusButton: 16,
  radiusInner: 12,
  shadowLight: "rgba(255,255,255,0.55)",
  shadowDark: "rgba(163,177,198,0.65)",
  extruded:
    "9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5)",
  extrudedHover:
    "12px 12px 20px rgba(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6)",
  extrudedSmall:
    "5px 5px 10px rgba(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)",
  inset:
    "inset 6px 6px 10px rgba(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5)",
  insetDeep:
    "inset 10px 10px 20px rgba(163,177,198,0.7), inset -10px -10px 20px rgba(255,255,255,0.6)",
  insetSmall:
    "inset 3px 3px 6px rgba(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5)",
};

/**
 * Dark-mode neumorphic shadow tokens. Uses a deep charcoal surface with
 * subtle white top-left highlights and strong black bottom-right shadows —
 * the inverted dual-shadow formula for dark neumorphism.
 */
export const NeumorphismDark: NeumorphismTokens = {
  background: "#1a1a1a",
  surface: "#1a1a1a",
  accent: "#6C63FF",
  accentLight: "#8B84FF",
  accentSecondary: "#38B2AC",
  radiusContainer: 32,
  radiusButton: 16,
  radiusInner: 12,
  shadowLight: "rgba(255,255,255,0.06)",
  shadowDark: "rgba(0,0,0,0.6)",
  extruded:
    "9px 9px 16px rgba(0,0,0,0.6), -9px -9px 16px rgba(255,255,255,0.06)",
  extrudedHover:
    "12px 12px 20px rgba(0,0,0,0.7), -12px -12px 20px rgba(255,255,255,0.08)",
  extrudedSmall:
    "5px 5px 10px rgba(0,0,0,0.6), -5px -5px 10px rgba(255,255,255,0.06)",
  inset:
    "inset 6px 6px 10px rgba(0,0,0,0.6), inset -6px -6px 10px rgba(255,255,255,0.06)",
  insetDeep:
    "inset 10px 10px 20px rgba(0,0,0,0.7), inset -10px -10px 20px rgba(255,255,255,0.08)",
  insetSmall:
    "inset 3px 3px 6px rgba(0,0,0,0.6), inset -3px -3px 6px rgba(255,255,255,0.06)",
};
