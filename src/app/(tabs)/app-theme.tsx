/**
 * App Theme — light / dark / system selection with live preview cards.
 */

import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { NeumorphicCard, NeumorphicPressable } from "@/components/ui";
import { Colors, Spacing } from "@/constants/theme";
import { useResolvedThemeName, useThemeColors } from "@/hooks/use-theme";
import { useThemeStore, type ThemePreference } from "@/stores/use-theme-store";
import { useUiPrefs } from "@/stores/use-ui-prefs";

// ── Theme preview card ───────────────────────────────────────────────

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  description: string;
  /** Preview colors: surface, text, accent */
  preview: [string, string, string];
}[] = [
  {
    value: "light",
    label: "Light",
    description: "Clean, bright interface for daytime use.",
    preview: ["#ffffff", "#000000", "#1a6ba5"],
  },
  {
    value: "dark",
    label: "Dark",
    description: "Reduced eye strain in low-light environments.",
    preview: ["#1a1a1a", "#ffffff", "#1a6ba5"],
  },
  {
    value: "system",
    label: "System",
    description: "Automatically matches your device theme setting.",
    preview: ["#f0f0f3", "#333333", "#1a6ba5"],
  },
];

function ThemeCard({
  value,
  label,
  description,
  preview,
  selected,
  onSelect,
}: {
  value: ThemePreference;
  label: string;
  description: string;
  preview: [string, string, string];
  selected: boolean;
  onSelect: (v: ThemePreference) => void;
}) {
  const colors = useThemeColors();
  return (
    <NeumorphicPressable
      inset={selected}
      onPress={() => onSelect(value)}
      style={[styles.card, selected && { backgroundColor: colors.primary }]}
    >
      {/* Mini preview */}
      <View style={[styles.previewBox, { backgroundColor: preview[0] }]}>
        <View style={styles.previewLine} />
        <View
          style={[
            styles.previewLineShort,
            { backgroundColor: preview[1], opacity: 0.6 },
          ]}
        />
        <View style={[styles.previewAccent, { backgroundColor: preview[2] }]} />
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <ThemedText
            type="callout"
            style={{
              fontWeight: "600",
              color: selected ? colors.surface : undefined,
            }}
          >
            {label}
          </ThemedText>
          {selected && (
            <ThemedText
              style={[
                styles.checkmark,
                { color: selected ? colors.surface : preview[2] },
              ]}
            >
              {"\u2713"}
            </ThemedText>
          )}
        </View>
        <ThemedText
          type="small"
          style={{ color: selected ? colors.surface : undefined }}
        >
          {description}
        </ThemedText>
      </View>
    </NeumorphicPressable>
  );
}

// ── Screen ───────────────────────────────────────────────────────────

export default function AppThemeScreen() {
  const router = useRouter();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const hapticsEnabled = useUiPrefs((s) => s.hapticsEnabled);
  const setHapticsEnabled = useUiPrefs((s) => s.setHapticsEnabled);
  const compactMode = useUiPrefs((s) => s.compactMode);
  const setCompactMode = useUiPrefs((s) => s.setCompactMode);
  const resolvedScheme = useResolvedThemeName();
  const colors = Colors[resolvedScheme];
  const insets = useSafeAreaInsets();

  const handleSelect = useCallback(
    (val: ThemePreference) => {
      setPreference(val);
    },
    [setPreference],
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safe}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + Spacing.four,
              paddingLeft: insets.left + Spacing.four,
              paddingRight: insets.right + Spacing.four,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backBtn,
                pressed && { opacity: 0.6 },
              ]}
            >
              <ThemedText
                type="default"
                style={{ color: colors.primary, fontWeight: "600" }}
              >
                {"\u2190 Back"}
              </ThemedText>
            </Pressable>
            <ThemedText type="title">App Theme</ThemedText>
          </View>

          {/* ── Theme picker ── */}
          {THEME_OPTIONS.map((opt) => (
            <ThemeCard
              key={opt.value}
              {...opt}
              selected={preference === opt.value}
              onSelect={handleSelect}
            />
          ))}

          {/* ── Extra customization toggles ── */}
          <NeumorphicCard style={styles.togglesCard}>
            {/* Haptic Feedback */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleBody}>
                <ThemedText type="default" style={{ fontWeight: "500" }}>
                  Haptic Feedback
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Vibrate on button presses and interactions.
                </ThemedText>
              </View>
              <Pressable
                onPress={() => setHapticsEnabled(!hapticsEnabled)}
                style={[
                  styles.toggleSwitch,
                  {
                    backgroundColor: hapticsEnabled
                      ? colors.primary
                      : colors.inputBorder,
                  },
                ]}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    hapticsEnabled && { alignSelf: "flex-end" },
                  ]}
                />
              </Pressable>
            </View>

            <View
              style={[
                styles.toggleDivider,
                { backgroundColor: colors.divider },
              ]}
            />

            {/* Compact Mode */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleBody}>
                <ThemedText type="default" style={{ fontWeight: "500" }}>
                  Compact Mode
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Reduce spacing for a denser UI layout.
                </ThemedText>
              </View>
              <Pressable
                onPress={() => setCompactMode(!compactMode)}
                style={[
                  styles.toggleSwitch,
                  {
                    backgroundColor: compactMode
                      ? colors.primary
                      : colors.inputBorder,
                  },
                ]}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    compactMode && { alignSelf: "flex-end" },
                  ]}
                />
              </Pressable>
            </View>
          </NeumorphicCard>

          {/* ── Info ── */}
          <ThemedText
            type="small"
            themeColor="textTertiary"
            style={styles.info}
          >
            Changes apply immediately across the whole app. Theme is saved on
            this device only.
          </ThemedText>

          <View style={{ height: Spacing.six }} />
        </ScrollView>
      </View>
    </ThemedView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },

  header: {
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  backBtn: {
    alignSelf: "flex-start",
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.half,
    marginLeft: -Spacing.half,
  },

  // Cards
  card: {
    flexDirection: "row",
    borderRadius: Spacing.three,
    overflow: "hidden",
  },
  previewBox: {
    width: 80,
    padding: Spacing.two,
    justifyContent: "center",
    gap: 6,
  },
  previewLine: {
    height: 4,
    backgroundColor: "rgba(128,128,128,0.3)",
    borderRadius: 2,
  },
  previewLineShort: {
    height: 4,
    width: "60%",
    borderRadius: 2,
  },
  previewAccent: {
    height: 6,
    width: "80%",
    borderRadius: 3,
    marginTop: 4,
  },
  cardBody: {
    flex: 1,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  checkmark: {
    fontSize: 20,
    fontWeight: "700",
  },

  // Toggles
  togglesCard: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.two,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  toggleBody: {
    flex: 1,
    gap: 1,
  },
  toggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 3,
    justifyContent: "center",
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#ffffff",
  },
  toggleDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 0,
  },

  info: {
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: Spacing.four,
  },
});
