import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { NeumorphicCard, NeumorphicSurface } from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useSQLiteContext } from "@/db/provider";
import { getPreference } from "@/db/preferences-repo";
import { useThemeColors } from "@/hooks/use-theme";
import { ForecastResult, generateForecast } from "@/lib/forecast-service";
import { formatCurrency, getMonthName } from "@/lib/format";
import { useAuthStore } from "@/stores/use-auth-store";

export default function ForecastScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const loadForecast = useCallback(async () => {
    if (!user) return;

    try {
      const now = new Date();
      const year = now.getFullYear();

      // Get monthly totals for the past 12 months
      const rows = await db.getAllAsync<{
        month: string;
        income: number;
        expenses: number;
      }>(
        `SELECT
        strftime('%Y-%m', date) as month,
        SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END) as income,
        SUM(CASE WHEN amount_cents < 0 THEN ABS(amount_cents) ELSE 0 END) as expenses
       FROM transactions
       WHERE user_id = ?
         AND date >= date('now', '-12 months')
       GROUP BY strftime('%Y-%m', date)
       ORDER BY month ASC`,
        user.id,
      );

      const historicalData = rows.map((r) => ({
        month: r.month,
        incomeCents: r.income,
        expenseCents: r.expenses,
      }));

      if (historicalData.length >= 2) {
        const result = generateForecast(historicalData, 6);
        setForecast(result);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("closed")) return;
      console.warn("loadForecast error:", e);
    }
  }, [db, user]);

  useEffect(() => {
    loadForecast();
  }, [loadForecast]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    getPreference(db, user.id, "base_currency").then((value) => {
      if (mounted) setBaseCurrency(value);
    });
    return () => {
      mounted = false;
    };
  }, [db, user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadForecast();
    setRefreshing(false);
  }, [loadForecast]);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + Spacing.three,
              paddingLeft: insets.left + Spacing.four,
              paddingRight: insets.right + Spacing.four,
            },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <ThemedText type="title">Forecast</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Predicted income and expenses for the next 6 months
          </ThemedText>

          {forecast && forecast.forecasts.length > 0 && (
            <>
              {/* Summary */}
              <NeumorphicCard style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Avg Monthly Income
                    </ThemedText>
                    <ThemedText
                      type="headline"
                      style={{ color: colors.success }}
                    >
                      {formatCurrency(forecast.averageIncomeCents, baseCurrency)}
                    </ThemedText>
                  </View>
                  <View style={styles.summaryItem}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Avg Monthly Expenses
                    </ThemedText>
                    <ThemedText
                      type="headline"
                      style={{ color: colors.danger }}
                    >
                      {formatCurrency(forecast.averageExpenseCents, baseCurrency)}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.trendRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Trend:{" "}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{
                      color:
                        forecast.trendDirection === "up"
                          ? colors.success
                          : forecast.trendDirection === "down"
                            ? colors.danger
                            : colors.warning,
                      fontWeight: "600",
                    }}
                  >
                    {forecast.trendDirection === "up"
                      ? "Growing"
                      : forecast.trendDirection === "down"
                        ? "Declining"
                        : "Stable"}
                    {forecast.trendPercent > 0
                      ? ` (${forecast.trendPercent}%)`
                      : ""}
                  </ThemedText>
                </View>
              </NeumorphicCard>

              {/* Monthly Forecast */}
              <ThemedText type="callout" style={styles.sectionTitle}>
                Monthly Forecast
              </ThemedText>
              {forecast.forecasts.map((point) => {
                const monthNum = parseInt(point.month.split("-")[1], 10);
                const net =
                  point.predictedIncomeCents - point.predictedExpenseCents;
                return (
                  <NeumorphicCard key={point.month} style={styles.forecastCard}>
                    <View style={styles.forecastHeader}>
                      <ThemedText type="callout" style={{ fontWeight: "600" }}>
                        {getMonthName(monthNum)} {point.month.split("-")[0]}
                      </ThemedText>
                      <NeumorphicSurface
                        small
                        style={[
                          styles.confidenceBadge,
                          {
                            backgroundColor:
                              point.confidence > 0.7
                                ? colors.success + "26"
                                : colors.warning + "26",
                          },
                        ]}
                      >
                        <ThemedText
                          type="small"
                          style={{
                            color:
                              point.confidence > 0.7
                                ? colors.success
                                : colors.warning,
                          }}
                        >
                          {Math.round(point.confidence * 100)}% conf
                        </ThemedText>
                      </NeumorphicSurface>
                    </View>
                    <View style={styles.forecastRow}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Income
                      </ThemedText>
                      <ThemedText
                        type="default"
                        style={{ color: colors.success }}
                      >
                        {formatCurrency(point.predictedIncomeCents, baseCurrency)}
                      </ThemedText>
                    </View>
                    <View style={styles.forecastRow}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Expenses
                      </ThemedText>
                      <ThemedText
                        type="default"
                        style={{ color: colors.danger }}
                      >
                        {formatCurrency(point.predictedExpenseCents, baseCurrency)}
                      </ThemedText>
                    </View>
                    <View
                      style={[
                        styles.forecastRow,
                        styles.forecastNet,
                        { borderTopColor: colors.divider },
                      ]}
                    >
                      <ThemedText type="callout" style={{ fontWeight: "600" }}>
                        Net
                      </ThemedText>
                      <ThemedText
                        type="callout"
                        style={{
                          fontWeight: "600",
                          color: net >= 0 ? colors.success : colors.danger,
                        }}
                      >
                        {formatCurrency(net, baseCurrency)}
                      </ThemedText>
                    </View>
                  </NeumorphicCard>
                );
              })}
            </>
          )}

          {(!forecast || forecast.forecasts.length === 0) && (
            <View style={styles.empty}>
              <ThemedText type="default" themeColor="textSecondary">
                Not enough data to generate a forecast.
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Add at least 2 months of transactions to see predictions.
              </ThemedText>
            </View>
          )}

          <View style={{ height: BottomTabInset + Spacing.six }} />
        </ScrollView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
    gap: Spacing.three,
  },
  summaryCard: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  summaryRow: {
    flexDirection: "row",
    gap: Spacing.three,
  },
  summaryItem: {
    flex: 1,
    gap: Spacing.one,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    fontWeight: "600",
  },
  forecastCard: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  forecastHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  confidenceBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  forecastRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  forecastNet: {
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  empty: {
    alignItems: "center",
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
});
