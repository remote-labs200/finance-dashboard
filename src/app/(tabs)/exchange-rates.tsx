import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { SymbolView } from "expo-symbols";
import { memo, useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  NeumorphicButton,
  NeumorphicCard,
  NeumorphicInput,
} from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { getPreference, setPreference } from "@/db/preferences-repo";
import { useTheme } from "@/hooks/use-theme";
import {
  getAllRates,
  setManualRate,
  SUPPORTED_CURRENCIES,
} from "@/lib/fx-service";
import { useAuthStore } from "@/stores/use-auth-store";

type RateDisplay = {
  from: string;
  to: string;
  rate: number;
  timestamp: number;
};

function fmtTime(ts: number): string {
  if (!ts) return "Not updated yet";
  return new Date(ts).toLocaleString();
}

// ---------------------------------------------------------------------------
// Memoized rate row — shows the rate and an inline editor when editable
// ---------------------------------------------------------------------------

const RateRow = memo(function RateRow({
  item,
  editing,
  autoUpdate,
  onToggleEdit,
  onSave,
}: {
  item: RateDisplay;
  editing: boolean;
  autoUpdate: boolean;
  onToggleEdit: () => void;
  onSave: (rate: number) => void;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState(item.rate.toFixed(4));

  if (editing) {
    return (
      <View style={styles.rateRow}>
        <ThemedText type="default" style={{ fontWeight: "500", minWidth: 40 }}>
          {item.to}
        </ThemedText>
        <NeumorphicInput
          containerStyle={styles.editInput}
          style={styles.editInputText}
          value={draft}
          onChangeText={setDraft}
          keyboardType="decimal-pad"
          autoFocus
        />
        <NeumorphicButton
          variant="secondary"
          style={styles.rateBtn}
          textStyle={{ color: theme.success, fontSize: 13 }}
          onPress={() => {
            const val = parseFloat(draft);
            if (!Number.isNaN(val) && val > 0) onSave(val);
            onToggleEdit();
          }}
        >
          Save
        </NeumorphicButton>
      </View>
    );
  }

  return (
    <View style={styles.rateRow}>
      <ThemedText type="default" style={{ fontWeight: "500", minWidth: 40 }}>
        {item.to}
      </ThemedText>
      <ThemedText
        type="default"
        themeColor="textSecondary"
        style={{
          flex: 1,
          textAlign: "right",
          paddingHorizontal: Spacing.two,
          paddingVertical: Spacing.one,
          fontSize: 15,
          fontVariant: ["tabular-nums"],
        }}
      >
        {item.rate.toFixed(4)}
      </ThemedText>
      {!autoUpdate && (
        <Pressable
          onPress={onToggleEdit}
          hitSlop={10}
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          <SymbolView
            name={{ ios: "square.and.pencil", android: "edit", web: "edit" }}
            size={16}
            tintColor={theme.primary}
          />
        </Pressable>
      )}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ExchangeRatesScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [base, setBase] = useState("USD");
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [intervalHrs, setIntervalHrs] = useState("24");
  const [rates, setRates] = useState<RateDisplay[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);

  const loadRates = useCallback(
    async (force?: boolean) => {
      if (!user) return;
      setRefreshing(force ?? false);
      try {
        const all = await getAllRates(db, user.id, base, {
          ...(force ? { forceRefresh: true } : {}),
        });
        setRates(all.filter((r) => r.to !== base));
        if (all.length > 0) setLastUpdated(all[0].timestamp);
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes("closed")) return;
        console.warn("loadRates error:", e);
      } finally {
        setRefreshing(false);
      }
    },
    [db, user, base],
  );

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    Promise.all([
      getPreference(db, user.id, "base_currency"),
      getPreference(db, user.id, "fx_auto_update"),
      getPreference(db, user.id, "fx_auto_update_interval"),
    ]).then(([baseCurr, auto, interval]) => {
      if (!mounted) return;
      const b = baseCurr || "USD";
      setBase(b);
      setAutoUpdate(auto !== "false");
      setIntervalHrs(interval || "24");
      loadRates().then(() => {});
    });
    return () => {
      mounted = false;
    };
  }, [user, db, loadRates]);

  const handleToggleAuto = useCallback(
    (val: boolean) => {
      if (!user) return;
      setAutoUpdate(val);
      setPreference(db, user.id, "fx_auto_update", val ? "true" : "false");
      if (val) loadRates().then(() => {});
    },
    [user, db, loadRates],
  );

  const handleIntervalChange = useCallback(
    (val: string) => {
      if (!user) return;
      const sanitized = val.replace(/[^0-9]/g, "");
      setIntervalHrs(sanitized);
      setPreference(db, user.id, "fx_auto_update_interval", sanitized || "24");
    },
    [user, db],
  );

  const handleSaveOverride = useCallback(
    async (code: string, rate: number) => {
      if (!user) return;
      try {
        await setManualRate(db, user.id, code, rate);
        setRates((prev) =>
          prev.map((r) => (r.to === code ? { ...r, rate } : r)),
        );
      } catch (e: unknown) {
        console.warn("Failed to save manual rate:", e);
      }
    },
    [db, user],
  );

  const supportedCount = SUPPORTED_CURRENCIES.length - 1;

  const renderHeader = useCallback(
    () => (
      <>
        {/* Auto-update toggle card */}
        <NeumorphicCard style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <ThemedText type="default" style={{ fontWeight: "500" }}>
                Auto-update from internet
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Fetch live rates from open.er-api.com automatically
              </ThemedText>
            </View>
            <Switch
              value={autoUpdate}
              onValueChange={handleToggleAuto}
              trackColor={{ false: theme.placeholder, true: theme.primary }}
              thumbColor="#fff"
            />
          </View>

          {autoUpdate && (
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <ThemedText type="default" style={{ fontWeight: "500" }}>
                  Update interval
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  How often to refresh rates (hours)
                </ThemedText>
              </View>
              <NeumorphicInput
                containerStyle={styles.intervalInput}
                style={styles.intervalInputText}
                value={intervalHrs}
                onChangeText={handleIntervalChange}
                keyboardType="number-pad"
                placeholder="24"
              />
            </View>
          )}

          <View style={styles.refreshRow}>
            <ThemedText type="small" themeColor="textSecondary">
              {lastUpdated ? `Updated ${fmtTime(lastUpdated)}` : "Fetching rates…"}
            </ThemedText>
            <NeumorphicButton
              variant="secondary"
              disabled={refreshing}
              style={styles.intervalInput}
              onPress={() => loadRates(true)}
            >
              {refreshing ? "Syncing…" : "Refresh now"}
            </NeumorphicButton>
          </View>
        </NeumorphicCard>

        {/* Section header */}
        <View style={styles.sectionHeader}>
          <ThemedText type="callout" style={{ fontWeight: "600" }}>
            1 {base} =
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Live rates · {supportedCount} currencies
          </ThemedText>
        </View>
      </>
    ),
    [
      theme,
      autoUpdate,
      base,
      intervalHrs,
      lastUpdated,
      refreshing,
      handleToggleAuto,
      handleIntervalChange,
      loadRates,
      supportedCount,
    ],
  );

  const renderFooter = useCallback(
    () =>
      autoUpdate ? (
        <ThemedText style={styles.hint} themeColor="textSecondary">
          Disable auto-update to manually override rates. Overrides are used
          for currency conversion until the next refresh.
        </ThemedText>
      ) : (
        <ThemedText style={styles.hint} themeColor="textSecondary">
          Manual rates are stored on your device and used for conversion.
        </ThemedText>
      ),
    [autoUpdate],
  );

  const renderItem = useCallback(
    ({ item }: { item: RateDisplay }) => (
      <RateRow
        item={item}
        editing={editingCode === item.to}
        autoUpdate={autoUpdate}
        onToggleEdit={() =>
          setEditingCode((prev) => (prev === item.to ? null : item.to))
        }
        onSave={(rate) => handleSaveOverride(item.to, rate)}
      />
    ),
    [autoUpdate, editingCode, handleSaveOverride],
  );

  const keyExtractor = useCallback((item: RateDisplay) => item.to, []);

  return (
    <ThemedView style={styles.container}>
      {/* Header outside list — no re-layout */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing.two,
            paddingLeft: insets.left + Spacing.three,
            paddingRight: insets.right + Spacing.three,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
        >
          <SymbolView
            name={{
              ios: "chevron.left",
              android: "arrow_back",
              web: "arrow_back",
            }}
            size={22}
            tintColor={theme.text}
          />
        </Pressable>
        <ThemedText type="title" style={styles.headerTitle}>
          Exchange Rates
        </ThemedText>
      </View>

      <FlashList
        data={rates}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </ThemedView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  backBtn: {
    padding: Spacing.one,
    marginRight: Spacing.one,
  },
  headerTitle: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  card: {
    borderRadius: 12,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  settingInfo: {
    flex: 1,
    gap: 2,
  },
  intervalInput: {
    minWidth: 96,
  },
  intervalInputText: {
    textAlign: "center",
    fontSize: 16,
  },
  refreshRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  sectionHeader: {
    paddingTop: Spacing.one,
    marginBottom: Spacing.two,
    gap: 2,
  },
  rateRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    minHeight: 44,
    gap: Spacing.one,
  },
  editInput: {
    flex: 1,
    minWidth: 0,
  },
  editInputText: {
    fontSize: 15,
    textAlign: "right",
  },
  rateBtn: {
    minWidth: 56,
  },
  hint: {
    fontSize: 13,
    textAlign: "center",
    paddingTop: Spacing.three,
    lineHeight: 18,
  },
});