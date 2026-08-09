/**
 * Navbar Position — choose bottom (default) or top tab bar placement.
 */

import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { NeumorphicCard, NeumorphicPressable } from "@/components/ui";
import { Colors, Spacing } from "@/constants/theme";
import { useResolvedThemeName } from "@/hooks/use-theme";
import { useUiPrefs, type NavbarPosition } from "@/stores/use-ui-prefs";

// ── Position options ─────────────────────────────────────────────────

const POSITION_OPTIONS: {
  value: NavbarPosition;
  label: string;
  description: string;
  /** Mock tab count */
  tabs: string[];
}[] = [
  {
    value: "bottom",
    label: "Bottom",
    description:
      "Classic placement — tabs at the bottom of the screen, within easy thumb reach.",
    tabs: ["Home", "Transactions", "Scan", "Reports", "Account"],
  },
  {
    value: "top",
    label: "Top",
    description:
      "Tabs at the top — more space for content below, familiar on desktop web.",
    tabs: ["Home", "Transactions", "Scan", "Reports", "Account"],
  },
];

function PositionCard({
  value,
  label,
  description,
  tabs,
  selected,
  onSelect,
}: {
  value: NavbarPosition;
  label: string;
  description: string;
  tabs: string[];
  selected: boolean;
  onSelect: (v: NavbarPosition) => void;
}) {
  const themeName = useResolvedThemeName();
  const colors = Colors[themeName];

  return (
    <NeumorphicPressable
      inset={selected}
      onPress={() => onSelect(value)}
      style={[styles.card, selected && { backgroundColor: colors.primary }]}
    >
      {/* Mock device frame */}
      <View
        style={[
          styles.mockDevice,
          { backgroundColor: colors.backgroundElement },
        ]}
      >
        {/* Tab bar mock — positioned based on value */}
        <View
          style={[
            styles.mockTabs,
            value === "top" ? styles.mockTabsTop : styles.mockTabsBottom,
            { backgroundColor: colors.card },
          ]}
        >
          {tabs.map((t, i) => (
            <View key={t} style={styles.mockTab}>
              <View
                style={[
                  styles.mockDot,
                  {
                    backgroundColor: i === 0 ? colors.primary : colors.divider,
                  },
                ]}
              />
              <ThemedText
                type="small"
                themeColor={i === 0 ? "text" : "textTertiary"}
                style={styles.mockTabLabel}
              >
                {t}
              </ThemedText>
            </View>
          ))}
        </View>
        {/* Content area */}
        <View style={styles.mockContent}>
          <View
            style={[styles.mockLine, { backgroundColor: colors.divider }]}
          />
          <View
            style={[styles.mockLineShort, { backgroundColor: colors.divider }]}
          />
        </View>
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
                { color: selected ? colors.surface : colors.primary },
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

export default function NavbarPositionScreen() {
  const navbarPosition = useUiPrefs((s) => s.navbarPosition);
  const setNavbarPosition = useUiPrefs((s) => s.setNavbarPosition);
  const themeName = useResolvedThemeName();
  const colors = Colors[themeName];
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleSelect = useCallback(
    (pos: NavbarPosition) => {
      setNavbarPosition(pos);
    },
    [setNavbarPosition],
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
            <ThemedText type="title">Navbar Position</ThemedText>
          </View>

          {/* ── Position picker ── */}
          {POSITION_OPTIONS.map((opt) => (
            <PositionCard
              key={opt.value}
              {...opt}
              selected={navbarPosition === opt.value}
              onSelect={handleSelect}
            />
          ))}

          {/* ── Platform notes ── */}
          <NeumorphicCard style={styles.notesCard}>
            <ThemedText
              type="callout"
              style={{ fontWeight: "600", marginBottom: Spacing.two }}
            >
              Platform Behavior
            </ThemedText>

            <View style={styles.noteRow}>
              <ThemedText style={styles.noteIcon}>{"\u{1F310}"}</ThemedText>
              <View style={styles.noteBody}>
                <ThemedText type="small" style={{ fontWeight: "500" }}>
                  Web
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Works fully — the tab bar renders at the top or bottom of the
                  page.
                </ThemedText>
              </View>
            </View>

            <View
              style={[styles.noteDivider, { backgroundColor: colors.divider }]}
            />

            <View style={styles.noteRow}>
              <ThemedText style={styles.noteIcon}>{"\u{1F4F1}"}</ThemedText>
              <View style={styles.noteBody}>
                <ThemedText type="small" style={{ fontWeight: "500" }}>
                  Mobile (iOS / Android)
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Not configurable — mobile uses the platform-native tab bar,
                  which is always at the bottom. This setting applies to web
                  only.
                </ThemedText>
              </View>
            </View>
          </NeumorphicCard>

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
    paddingBottom: Spacing.three,
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
    borderRadius: Spacing.three,
    overflow: "hidden",
  },

  // Mock device
  mockDevice: {
    height: 160,
    borderRadius: Spacing.two,
    overflow: "hidden",
    position: "relative",
  },
  mockTabs: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  mockTabsBottom: {
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.15)",
  },
  mockTabsTop: {
    top: 0,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128,128,128,0.15)",
  },
  mockTab: {
    alignItems: "center",
    gap: 3,
  },
  mockDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  mockTabLabel: {
    fontSize: 8,
    lineHeight: 10,
  },
  mockContent: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
    gap: 8,
  },
  mockLine: {
    height: 8,
    borderRadius: 4,
    width: "80%",
  },
  mockLineShort: {
    height: 8,
    borderRadius: 4,
    width: "50%",
  },

  cardBody: {
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

  // Notes
  notesCard: {
    padding: Spacing.three,
    marginTop: Spacing.two,
  },
  noteRow: {
    flexDirection: "row",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  noteIcon: {
    fontSize: 20,
    lineHeight: 22,
    width: 28,
    textAlign: "center",
  },
  noteBody: {
    flex: 1,
    gap: 2,
  },
  noteDivider: {
    height: StyleSheet.hairlineWidth,
  },
});
