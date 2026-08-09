import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { NeumorphicCard, NeumorphicPressable } from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { getPreference, setPreference } from "@/db/preferences-repo";
import { useSQLiteContext } from "@/db/provider";
import { useTheme } from "@/hooks/use-theme";
import { SUPPORTED_CURRENCIES } from "@/lib/fx-service";
import { useAuthStore } from "@/stores/use-auth-store";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CurrencySettingsScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      try {
        const saved = await getPreference(db, user.id, "default_currency");
        if (!mounted) return;
        setDefaultCurrency(saved || "USD");
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes("closed")) return;
        console.warn("Failed to load currency preference:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user, db]);

  const handleSelect = useCallback(
    async (code: string) => {
      if (!user) return;
      setDefaultCurrency(code);
      await setPreference(db, user.id, "default_currency", code);
      Alert.alert(
        "Currency Updated",
        `Default currency set to ${code}. New transactions will use ${code} by default.`,
      );
    },
    [user, db],
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ThemedText type="default" themeColor="textSecondary">
              Loading...
            </ThemedText>
          </View>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safeArea}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + Spacing.three,
              paddingLeft: insets.left + Spacing.four,
              paddingRight: insets.right + Spacing.four,
            },
          ]}
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <SymbolView
              name={{
                ios: "chevron.left",
                android: "arrow_back",
                web: "arrow_back",
              }}
              size={20}
              tintColor={theme.primary}
            />
          </Pressable>
          <ThemedText type="title" style={styles.headerTitle}>
            Default Currency
          </ThemedText>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingLeft: insets.left + Spacing.four,
              paddingRight: insets.right + Spacing.four,
              paddingBottom: insets.bottom + BottomTabInset + Spacing.six,
            },
          ]}
        >
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.subtitle}
          >
            Choose your default currency. This will be used for new transactions
            and account balances. You can still record transactions in other
            currencies.
          </ThemedText>

          <NeumorphicCard style={styles.card}>
            {SUPPORTED_CURRENCIES.map((currency, index) => (
              <View key={currency.code}>
                <NeumorphicPressable
                  inset={defaultCurrency === currency.code}
                  onPress={() => handleSelect(currency.code)}
                  style={styles.optionRow}
                >
                  <View
                    style={[
                      styles.radio,
                      {
                        borderColor:
                          defaultCurrency === currency.code
                            ? theme.primary
                            : theme.inputBorder,
                        backgroundColor:
                          defaultCurrency === currency.code
                            ? theme.primary
                            : "transparent",
                      },
                    ]}
                  >
                    {defaultCurrency === currency.code && (
                      <SymbolView
                        name={{
                          ios: "checkmark",
                          android: "check",
                          web: "check",
                        }}
                        size={12}
                        tintColor="#fff"
                      />
                    )}
                  </View>
                  <View style={styles.currencyInfo}>
                    <ThemedText
                      type="default"
                      style={{
                        fontWeight:
                          defaultCurrency === currency.code ? "600" : "400",
                      }}
                    >
                      {currency.symbol} {currency.code}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {currency.name}
                    </ThemedText>
                  </View>
                </NeumorphicPressable>
                {index < SUPPORTED_CURRENCIES.length - 1 && (
                  <View
                    style={[styles.divider, { backgroundColor: theme.divider }]}
                  />
                )}
              </View>
            ))}
          </NeumorphicCard>

          <View style={styles.infoBox}>
            <SymbolView
              name={{ ios: "info.circle", android: "info", web: "info" }}
              size={16}
              tintColor={theme.primary}
            />
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.infoText}
            >
              Exchange rates are fetched from a free API and cached for one
              hour. Conversion rates may not reflect real-time market rates.
            </ThemedText>
          </View>

          <View style={{ height: Spacing.two }} />
        </ScrollView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  headerTitle: {
    flex: 1,
  },
  backBtn: {
    padding: Spacing.one,
  },
  scroll: {
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  subtitle: {
    marginBottom: Spacing.three,
    lineHeight: 20,
  },
  card: {
    borderRadius: Spacing.three,
    overflow: "hidden",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  currencyInfo: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.five,
  },
  infoBox: {
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.three,
    marginTop: Spacing.three,
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    lineHeight: 18,
  },
});
