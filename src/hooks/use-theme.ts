/**
 * Returns the current theme color palette based on user preference (light/dark/system).
 * Defaults to light when preference is 'system' and system scheme is unspecified.
 */

import {
  Colors,
  Neumorphism,
  NeumorphismDark,
  type NeumorphismTokens,
  type ThemePalette,
} from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeStore } from "@/stores/use-theme-store";

export function useTheme(): ThemePalette {
  const preference = useThemeStore((s) => s.preference);
  const systemScheme = useColorScheme();

  const resolved: "light" | "dark" =
    preference === "system"
      ? systemScheme === "dark"
        ? "dark"
        : "light"
      : preference;

  return Colors[resolved] as ThemePalette;
}

/**
 * Returns the neumorphic shadow/token set for the resolved theme.
 * Light mode uses `Neumorphism`; dark mode uses `NeumorphismDark`.
 */
export function useNeumorphism(): NeumorphismTokens {
  const preference = useThemeStore((s) => s.preference);
  const systemScheme = useColorScheme();

  const resolved: "light" | "dark" =
    preference === "system"
      ? systemScheme === "dark"
        ? "dark"
        : "light"
      : preference;

  return resolved === "dark" ? NeumorphismDark : Neumorphism;
}

/**
 * Returns the resolved theme name ('light' | 'dark') for components that need
 * to pass it to Expo Router's ThemeProvider.
 */
export function useResolvedThemeName(): "light" | "dark" {
  const preference = useThemeStore((s) => s.preference);
  const systemScheme = useColorScheme();

  if (preference === "system") {
    return systemScheme === "dark" ? "dark" : "light";
  }
  return preference;
}

/**
 * Alias for useTheme — returns the current theme color palette.
 * Named useThemeColors for components that prefer a "colors" variable.
 */
export function useThemeColors(): ThemePalette {
  return useTheme();
}
