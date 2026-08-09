import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  NeumorphicButton,
  NeumorphicCard,
  NeumorphicPressable,
} from "@/components/ui";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { getPreference, setPreference } from "@/db/preferences-repo";
import { useSQLiteContext } from "@/db/provider";
import { useTheme } from "@/hooks/use-theme";
import { useAuthStore } from "@/stores/use-auth-store";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const YEAR_TYPES = [
  { value: "calendar", label: "Calendar Year (Jan\u2013Dec)" },
  { value: "fiscal", label: "Fiscal Year" },
] as const;

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AccountingYearScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [yearType, setYearType] = useState<string>("calendar");
  const [startMonth, setStartMonth] = useState<string>("1");
  const [startDay, setStartDay] = useState<string>("1");
  const [saving, setSaving] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const [fyType, fyMonth, fyDay] = await Promise.all([
        getPreference(db, user.id, "fy_type"),
        getPreference(db, user.id, "fy_start_month"),
        getPreference(db, user.id, "fy_start_day"),
      ]);

      if (!cancelled) {
        setYearType(fyType || "calendar");
        setStartMonth(fyMonth || "1");
        setStartDay(fyDay || "1");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, user]);

  // ── Save ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!user) return;

    Keyboard.dismiss();
    setSaving(true);

    try {
      await Promise.all([
        setPreference(db, user.id, "fy_type", yearType),
        setPreference(db, user.id, "fy_start_month", startMonth),
        setPreference(db, user.id, "fy_start_day", startDay),
      ]);

      setSaving(false);
      router.back();
    } catch (err) {
      setSaving(false);
      Alert.alert(
        "Save Failed",
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    }
  }, [db, user, yearType, startMonth, startDay, router]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <ThemedView style={styles.container}>
      <View style={styles.flex}>
        {/* ── Header bar ─────────────────────────────────────── */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.background,
              paddingTop: insets.top + Spacing.three,
              paddingLeft: insets.left + Spacing.four,
              paddingRight: insets.right + Spacing.four,
            },
          ]}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && { opacity: 0.6 },
            ]}
          >
            <SymbolView
              name={{
                ios: "chevron.left",
                android: "arrow_back",
                web: "arrow_back",
              }}
              size={22}
              tintColor={theme.primary}
            />
            <ThemedText
              type="default"
              style={{ color: theme.primary, fontWeight: "500" }}
            >
              Account
            </ThemedText>
          </Pressable>
          <ThemedText type="title" style={{ fontSize: 24 }}>
            Accounting Year
          </ThemedText>
        </View>

        {/* ── Scrollable form ────────────────────────────────── */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              {
                paddingLeft: insets.left + Spacing.four,
                paddingRight: insets.right + Spacing.four,
                paddingBottom: insets.bottom + Spacing.six,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Year type */}
            <NeumorphicCard style={styles.card}>
              <ThemedText type="callout" style={styles.fieldLabel}>
                Accounting Year Type
              </ThemedText>
              <View style={styles.chipRow}>
                {YEAR_TYPES.map((opt) => {
                  const isSelected = yearType === opt.value;
                  return (
                    <NeumorphicPressable
                      key={opt.value}
                      inset={isSelected}
                      onPress={() => setYearType(opt.value)}
                      style={[
                        styles.chip,
                        isSelected && { backgroundColor: theme.primary },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color: isSelected
                            ? theme.surface
                            : theme.textSecondary,
                          fontWeight: isSelected ? "600" : "400",
                        }}
                      >
                        {opt.label}
                      </ThemedText>
                    </NeumorphicPressable>
                  );
                })}
              </View>
            </NeumorphicCard>

            {/* Fiscal year start (only shown when fiscal is selected) */}
            {yearType === "fiscal" && (
              <>
                <NeumorphicCard style={styles.card}>
                  <ThemedText type="callout" style={styles.fieldLabel}>
                    Fiscal Year Start Month
                  </ThemedText>
                  <View style={styles.chipRow}>
                    {MONTHS.map((opt) => {
                      const isSelected = startMonth === opt.value;
                      return (
                        <NeumorphicPressable
                          key={opt.value}
                          inset={isSelected}
                          onPress={() => setStartMonth(opt.value)}
                          style={[
                            styles.monthChip,
                            isSelected && { backgroundColor: theme.primary },
                          ]}
                        >
                          <ThemedText
                            type="small"
                            style={{
                              color: isSelected
                                ? theme.surface
                                : theme.textSecondary,
                              fontWeight: isSelected ? "600" : "400",
                            }}
                          >
                            {opt.label}
                          </ThemedText>
                        </NeumorphicPressable>
                      );
                    })}
                  </View>
                </NeumorphicCard>

                <NeumorphicCard style={styles.card}>
                  <ThemedText type="callout" style={styles.fieldLabel}>
                    Fiscal Year Start Day
                  </ThemedText>
                  <View style={styles.chipRow}>
                    {Array.from({ length: 28 }, (_, i) => String(i + 1)).map(
                      (day) => {
                        const isSelected = startDay === day;
                        return (
                          <NeumorphicPressable
                            key={day}
                            inset={isSelected}
                            onPress={() => setStartDay(day)}
                            style={[
                              styles.dayChip,
                              isSelected && { backgroundColor: theme.primary },
                            ]}
                          >
                            <ThemedText
                              type="small"
                              style={{
                                color: isSelected
                                  ? theme.surface
                                  : theme.textSecondary,
                                fontWeight: isSelected ? "600" : "400",
                              }}
                            >
                              {day}
                            </ThemedText>
                          </NeumorphicPressable>
                        );
                      },
                    )}
                  </View>
                  <ThemedText
                    type="small"
                    themeColor="textTertiary"
                    style={{ marginTop: Spacing.half }}
                  >
                    Day 29\u201331 default to the 1st of the next month for
                    simplicity.
                  </ThemedText>
                </NeumorphicCard>
              </>
            )}

            {/* Spacer for bottom safety */}
            <View style={{ height: Spacing.six }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── Save button (sticky footer) ──────────────────────── */}
        <View
          style={[
            styles.footer,
            {
              borderTopColor: theme.divider,
              backgroundColor: theme.background,
            },
          ]}
        >
          <NeumorphicButton
            onPress={handleSave}
            disabled={saving}
            style={saving && { opacity: 0.6 }}
          >
            {saving ? "Saving\u2026" : "Save Changes"}
          </NeumorphicButton>
        </View>
      </View>
    </ThemedView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },

  /* Header */
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    gap: Spacing.two,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.half,
    alignSelf: "flex-start",
    paddingVertical: Spacing.one,
  },

  /* Scroll */
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
    gap: Spacing.three,
  },

  /* Card */
  card: {
    padding: Spacing.four,
    gap: Spacing.two,
  },

  /* Fields */
  fieldLabel: { fontWeight: "600", fontSize: 15 },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.one,
  },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  monthChip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  dayChip: {
    width: 36,
    height: 32,
    borderRadius: Spacing.two,
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },

  /* Footer */
  footer: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveBtn: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: "center",
    justifyContent: "center",
  },
});
