import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { NeumorphicPressable } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { getPreference, setPreference } from "@/db/preferences-repo";
import { useTheme } from "@/hooks/use-theme";
import { useAuthStore } from "@/stores/use-auth-store";

// ---------------------------------------------------------------------------
// Currency data
// ---------------------------------------------------------------------------

interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  flag: string;
}

const CURRENCIES: CurrencyInfo[] = [
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸" },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺" },
  { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", flag: "🇯🇵" },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$", flag: "🇨🇦" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", flag: "🇦🇺" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", flag: "🇨🇭" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", flag: "🇨🇳" },
  { code: "INR", name: "Indian Rupee", symbol: "₹", flag: "🇮🇳" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", flag: "🇧🇷" },
  { code: "MXN", name: "Mexican Peso", symbol: "Mex$", flag: "🇲🇽" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", flag: "🇸🇬" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", flag: "🇭🇰" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", flag: "🇳🇿" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", flag: "🇸🇪" },
  { code: "KRW", name: "South Korean Won", symbol: "₩", flag: "🇰🇷" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", flag: "🇳🇬" },
  { code: "ZAR", name: "South African Rand", symbol: "R", flag: "🇿🇦" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", flag: "🇦🇪" },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼", flag: "🇸🇦" },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function BaseCurrencyScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [selected, setSelected] = useState("USD");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    getPreference(db, user.id, "base_currency").then((val) => {
      setSelected(val || "USD");
      setLoaded(true);
    });
  }, [user, db]);

  const handleSelect = useCallback(
    (code: string) => {
      if (!user) return;
      setSelected(code);
      setPreference(db, user.id, "base_currency", code);
    },
    [user, db],
  );

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
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
          Base Currency
        </ThemedText>
      </View>

      <ThemedText style={styles.description} themeColor="textSecondary">
        Your base currency sets the default for all dashboard calculations,
        reports, and tax estimates. All transactions in other currencies will be
        converted using live exchange rates.
      </ThemedText>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingLeft: insets.left + Spacing.three,
            paddingRight: insets.right + Spacing.three,
            paddingBottom: insets.bottom + Spacing.six,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {CURRENCIES.map((c) => {
          const isSelected = selected === c.code;
          return (
            <NeumorphicPressable
              key={c.code}
              inset={isSelected}
              onPress={() => handleSelect(c.code)}
              style={[styles.currencyRow, { borderBottomColor: theme.divider }]}
            >
              <ThemedText style={styles.flag}>{c.flag}</ThemedText>
              <View style={styles.currencyInfo}>
                <ThemedText type="default" style={{ fontWeight: "500" }}>
                  {c.code} — {c.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {c.symbol}
                </ThemedText>
              </View>
              {isSelected && (
                <SymbolView
                  name={{
                    ios: "checkmark.circle.fill",
                    android: "check_circle",
                    web: "check_circle",
                  }}
                  size={22}
                  tintColor={theme.primary}
                />
              )}
            </NeumorphicPressable>
          );
        })}
      </ScrollView>
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
  description: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    lineHeight: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.six,
  },
  currencyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  flag: {
    fontSize: 24,
    width: 32,
    textAlign: "center",
  },
  currencyInfo: {
    flex: 1,
    gap: 2,
  },
});
