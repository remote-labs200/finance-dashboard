import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { NeumorphicCard } from "@/components/ui";
import {
  BottomTabInset,
  MaxContentWidth,
  Spacing,
} from "@/constants/theme";
import { getAllPreferences, setPreference } from "@/db/preferences-repo";
import { useSQLiteContext } from "@/db/provider";
import { useTheme } from "@/hooks/use-theme";
import { refreshTaxDeadlineReminders } from "@/lib/notification-service";
import { useAuthStore } from "@/stores/use-auth-store";
import type { NotificationType } from "@/stores/use-notification-store";
import type { UserPreferenceKey } from "@/db/preferences-repo";

// ---------------------------------------------------------------------------
// Notification type → preference mapping
// ---------------------------------------------------------------------------

interface NotificationKind {
  type: NotificationType;
  key: UserPreferenceKey;
  label: string;
  description: string;
  icon: React.ComponentProps<typeof SymbolView>["name"];
}

const NOTIFICATION_KINDS: NotificationKind[] = [
  {
    type: "tax_deadline",
    key: "notif_tax_deadline",
    label: "Tax Deadlines",
    description: "Quarterly estimated tax due-date reminders",
    icon: {
      ios: "calendar.badge.exclamationmark",
      android: "event_busy",
      web: "event_busy",
    },
  },
  {
    type: "payment_reminder",
    key: "notif_payment_reminder",
    label: "Payment Reminders",
    description: "Overdue invoices and incoming client payments",
    icon: {
      ios: "creditcard",
      android: "payments",
      web: "payments",
    },
  },
  {
    type: "weekly_summary",
    key: "notif_weekly_summary",
    label: "Weekly Summary",
    description: "A recap of income, expenses, and cash flow",
    icon: {
      ios: "chart.bar.doc.horizontal",
      android: "summarize",
      web: "summarize",
    },
  },
  {
    type: "anomaly",
    key: "notif_anomaly",
    label: "Anomaly Alerts",
    description: "Unusual spending or income patterns",
    icon: {
      ios: "exclamationmark.triangle",
      android: "warning",
      web: "warning",
    },
  },
  {
    type: "sync_status",
    key: "notif_sync_status",
    label: "Sync Updates",
    description: "Multi-device sync activity and conflicts",
    icon: {
      ios: "arrow.triangle.2.circlepath",
      android: "sync",
      web: "sync",
    },
  },
  {
    type: "feature",
    key: "notif_feature",
    label: "New Features",
    description: "Product updates and announcements",
    icon: {
      ios: "sparkles",
      android: "auto_awesome",
      web: "auto_awesome",
    },
  },
  {
    type: "system",
    key: "notif_system",
    label: "System Alerts",
    description: "Important account and security notices",
    icon: {
      ios: "gearshape.2",
      android: "settings",
      web: "settings",
    },
  },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);

  // Master switch gates all notification types (cloud + per-device).
  const [enabled, setEnabled] = useState(true);
  // Per-type toggles, keyed by the preference key.
  const [types, setTypes] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      try {
        const prefs = await getAllPreferences(db, user.id);
        if (!mounted) return;
        setEnabled(prefs.notifications_enabled !== "false");
        const next: Record<string, boolean> = {};
        for (const kind of NOTIFICATION_KINDS) {
          next[kind.key] = prefs[kind.key] !== "false";
        }
        setTypes(next);
        setLoading(false);
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes("closed")) return;
        console.warn("Failed to load notification preferences:", e);
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [db, user]);

  const handleMasterToggle = useCallback(
    async (value: boolean) => {
      setEnabled(value);
      if (!user) return;
      try {
        await setPreference(
          db,
          user.id,
          "notifications_enabled",
          value ? "true" : "false",
        );
        await refreshTaxDeadlineReminders(db, user.id);
      } catch (e: unknown) {
        console.warn("Failed to save notifications preference:", e);
      }
    },
    [db, user],
  );

  const handleTypeToggle = useCallback(
    async (key: UserPreferenceKey, value: boolean) => {
      setTypes((prev) => ({ ...prev, [key]: value }));
      if (!user) return;
      try {
        await setPreference(db, user.id, key, value ? "true" : "false");
        if (key === "notif_tax_deadline") {
          await refreshTaxDeadlineReminders(db, user.id);
        }
      } catch (e: unknown) {
        console.warn(`Failed to save ${key} preference:`, e);
      }
    },
    [db, user],
  );

  const renderRow = (kind: NotificationKind, index: number) => {
    const value = loading ? true : types[kind.key] !== false;
    return (
      <View key={kind.type}>
        {index > 0 && (
          <View
            style={[styles.divider, { backgroundColor: theme.divider }]}
          />
        )}
        <View style={[styles.row, !enabled && { opacity: 0.5 }]}>
          <SymbolView
            name={kind.icon}
            size={22}
            tintColor={theme.primary}
          />
          <View style={styles.rowBody}>
            <ThemedText type="default" style={{ fontWeight: "500" }}>
              {kind.label}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {kind.description}
            </ThemedText>
          </View>
          <Switch
            value={value}
            onValueChange={(v) => handleTypeToggle(kind.key, v)}
            disabled={!enabled || loading}
            trackColor={{ false: theme.inputBorder, true: theme.primary }}
          />
        </View>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.flex}>
        {/* ── Header ────────────────────────────────────────────── */}
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
            Notifications
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Choose which alerts you receive
          </ThemedText>
        </View>

        {/* ── Content ───────────────────────────────────────────── */}
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingLeft: insets.left + Spacing.four,
              paddingRight: insets.right + Spacing.four,
              paddingBottom: insets.bottom + BottomTabInset + Spacing.six,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Master toggle */}
          <NeumorphicCard>
            <View style={styles.row}>
              <SymbolView
                name={{
                  ios: "bell.fill",
                  android: "notifications_active",
                  web: "notifications_active",
                }}
                size={22}
                tintColor={theme.primary}
              />
              <View style={styles.rowBody}>
                <ThemedText type="default" style={{ fontWeight: "600" }}>
                  Enable Notifications
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Master switch for all notification types
                </ThemedText>
              </View>
              <Switch
                value={enabled}
                onValueChange={handleMasterToggle}
                trackColor={{
                  false: theme.inputBorder,
                  true: theme.primary,
                }}
              />
            </View>
          </NeumorphicCard>

          {/* Per-type toggles */}
          {loading ? (
            <NeumorphicCard>
              <ThemedText type="small" themeColor="textSecondary">
                Loading preferences…
              </ThemedText>
            </NeumorphicCard>
          ) : (
            <NeumorphicCard>
              {NOTIFICATION_KINDS.map((kind, i) => renderRow(kind, i))}
            </NeumorphicCard>
          )}

          <ThemedText
            type="small"
            themeColor="textTertiary"
            style={styles.footnote}
          >
            Disabled types are neither pushed to your device nor shown in the
            notification center. Your preferences sync across devices via your
            account.
          </ThemedText>
        </ScrollView>
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

  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: Spacing.one,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.half,
    alignSelf: "flex-start",
    paddingVertical: Spacing.one,
  },

  scroll: {
    paddingTop: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
    gap: Spacing.three,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  rowBody: {
    flex: 1,
    gap: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 22 + Spacing.three,
  },
  footnote: {
    lineHeight: 18,
    paddingHorizontal: Spacing.one,
  },
});