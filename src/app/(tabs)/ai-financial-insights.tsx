import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { NeumorphicCard, NeumorphicPressable } from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { getAllPreferences, setPreference } from "@/db/preferences-repo";
import { useSQLiteContext } from "@/db/provider";
import { findTransactionsByUser } from "@/db/transaction-repo";
import { useTheme } from "@/hooks/use-theme";
import { useAuthStore } from "@/stores/use-auth-store";
import { useFocusEffect, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Toggle row (reused pattern)
// ---------------------------------------------------------------------------

function ToggleRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleBody}>
        <ThemedText type="default" style={{ fontWeight: "500" }}>
          {label}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {description}
        </ThemedText>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.inputBorder, true: theme.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Frequency chip
// ---------------------------------------------------------------------------

function FrequencyChip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const theme = useTheme();
  return (
    <NeumorphicPressable
      inset={selected}
      onPress={onSelect}
      style={styles.chip}
    >
      <ThemedText
        type="default"
        style={{
          color: selected ? theme.primary : theme.text,
          fontWeight: selected ? "600" : "400",
        }}
      >
        {label}
      </ThemedText>
    </NeumorphicPressable>
  );
}

// ---------------------------------------------------------------------------
// Real insights built from local transaction data
// ---------------------------------------------------------------------------

type InsightType = "anomaly" | "forecast" | "opportunity";

interface Insight {
  type: InsightType;
  title: string;
  detail: string;
  date: string;
}

function formatCents(cents: number, currency: string = "USD"): string {
  return (Math.abs(cents) / 100).toLocaleString(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30)
    return `${Math.floor(days / 7)} week${days >= 14 ? "s" : ""} ago`;
  return `${Math.floor(days / 30)} month${days >= 60 ? "s" : ""} ago`;
}

/**
 * Build a small list of insights from the user's actual transactions:
 * - Category spending anomaly (this month vs monthly average)
 * - Cash flow forecast (projected month-end balance vs threshold)
 * - Tax deduction opportunity (income vs expenses ratio)
 */
function buildInsights(
  transactions: Array<{
    amountCents: number;
    categoryName: string | null;
    date: string;
  }>,
  forecastThresholdCents: number,
  currency: string = "USD",
): Insight[] {
  const insights: Insight[] = [];
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const nowIso = now.toISOString();

  if (transactions.length === 0) {
    return [
      {
        type: "forecast",
        title: "No transaction data yet",
        detail:
          "Add transactions to start receiving cash flow and anomaly insights.",
        date: nowIso,
      },
    ];
  }

  // --- Anomaly: category spending this month vs monthly average ---
  const byCategory = new Map<string, { total: number; months: Set<string> }>();
  for (const t of transactions) {
    if (t.amountCents >= 0) continue; // expenses only
    const cat = t.categoryName ?? "Uncategorized";
    const entry = byCategory.get(cat) ?? {
      total: 0,
      months: new Set<string>(),
    };
    entry.total += -t.amountCents;
    entry.months.add(t.date.slice(0, 7));
    byCategory.set(cat, entry);
  }
  let topAnomaly: { cat: string; thisMonth: number; avg: number } | null = null;
  for (const [cat, e] of byCategory) {
    if (!e.months.has(thisMonth)) continue;
    const monthTotal = transactions
      .filter(
        (t) =>
          t.amountCents < 0 &&
          (t.categoryName ?? "Uncategorized") === cat &&
          t.date.slice(0, 7) === thisMonth,
      )
      .reduce((sum, t) => sum + -t.amountCents, 0);
    const monthsCount = Math.max(e.months.size, 1);
    const avg = e.total / monthsCount;
    if (monthTotal > avg * 1.5 && monthTotal - avg > 10_000) {
      if (
        !topAnomaly ||
        monthTotal / avg > topAnomaly.thisMonth / topAnomaly.avg
      ) {
        topAnomaly = { cat, thisMonth: monthTotal, avg };
      }
    }
  }
  if (topAnomaly) {
    insights.push({
      type: "anomaly",
      title: "Unusual spending detected",
      detail: `${topAnomaly.cat} is ${Math.round((topAnomaly.thisMonth / topAnomaly.avg) * 100)}% of its monthly average (${formatCents(topAnomaly.thisMonth, currency)} vs ${formatCents(topAnomaly.avg, currency)}).`,
      date: nowIso,
    });
  }

  // --- Forecast: projected month-end balance vs threshold ---
  const incomeThisMonth = transactions
    .filter((t) => t.amountCents > 0 && t.date.slice(0, 7) === thisMonth)
    .reduce((s, t) => s + t.amountCents, 0);
  const expenseThisMonth = transactions
    .filter((t) => t.amountCents < 0 && t.date.slice(0, 7) === thisMonth)
    .reduce((s, t) => s + -t.amountCents, 0);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toISOString()
    .slice(0, 7);
  const expenseLastMonth = transactions
    .filter((t) => t.amountCents < 0 && t.date.slice(0, 7) === lastMonth)
    .reduce((s, t) => s + -t.amountCents, 0);
  const projectedBalance = incomeThisMonth - expenseThisMonth;
  if (projectedBalance < forecastThresholdCents) {
    insights.push({
      type: "forecast",
      title: "Cash reserve running low",
      detail: `Projected month-end balance of ${formatCents(projectedBalance, currency)} — below ${formatCents(forecastThresholdCents, currency)} threshold.`,
      date: nowIso,
    });
  }

  // --- Opportunity: income vs expense ratio (tax-friendly) ---
  const totalIncome = transactions
    .filter((t) => t.amountCents > 0)
    .reduce((s, t) => s + t.amountCents, 0);
  const totalExpense = transactions
    .filter((t) => t.amountCents < 0)
    .reduce((s, t) => s + -t.amountCents, 0);
  if (totalIncome > 0) {
    const ratio = totalExpense / totalIncome;
    if (ratio < 0.3 && totalExpense > 10_000) {
      insights.push({
        type: "opportunity",
        title: "Tax deduction opportunity",
        detail: `Expenses are only ${Math.round(ratio * 100)}% of income (${formatCents(totalExpense, currency)} vs ${formatCents(totalIncome, currency)}). Review deductible business expenses.`,
        date: nowIso,
      });
    }
  }

  // Fallback when nothing stood out
  if (insights.length === 0 && expenseLastMonth > 0) {
    insights.push({
      type: "forecast",
      title: "Cash flow looks steady",
      detail: `Last month's expenses were ${formatCents(expenseLastMonth, currency)}. No anomalies detected.`,
      date: nowIso,
    });
  }

  return insights.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function AiFinancialInsightsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const user = useAuthStore((s) => s.user);

  const [anomalyAlerts, setAnomalyAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [taxOpportunities, setTaxOpportunities] = useState(true);
  const [insightFrequency, setInsightFrequency] = useState<
    "daily" | "weekly" | "monthly"
  >("weekly");
  const [forecastThresh, setForecastThresh] = useState(3000);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [baseCurrency, setBaseCurrency] = useState("USD");

  const threshOptions = [1000, 2000, 3000, 5000, 10000];

  // Load saved preferences + real insights from local transactions
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let active = true;
      (async () => {
        try {
          const prefs = await getAllPreferences(db, user.id);
          if (!active) return;
          setAnomalyAlerts(prefs.ai_anomaly_alerts !== "false");
          setWeeklyDigest(prefs.ai_weekly_digest !== "false");
          setTaxOpportunities(prefs.ai_tax_opportunities !== "false");
          const freq = prefs.ai_insight_frequency;
          setInsightFrequency(
            freq === "daily" || freq === "monthly" ? freq : "weekly",
          );
          const thresh = Number(prefs.ai_forecast_threshold) || 3000;
          setForecastThresh(thresh);
          setBaseCurrency(prefs.base_currency);

          // Real insights from actual transactions
          const txs = await findTransactionsByUser(db, user.id, { limit: 500 });
          if (!active) return;
          setInsights(
            buildInsights(
              txs.map((t) => ({
                amountCents: t.amountCents,
                categoryName: t.categoryName ?? null,
                date: t.date,
              })),
              thresh * 100,
              baseCurrency,
            ),
          );
        } catch (e: unknown) {
          if (e instanceof Error && e.message.includes("closed")) return;
          console.warn("Failed to load AI insights preferences:", e);
        }
      })();
      return () => {
        active = false;
      };
    }, [db, user, baseCurrency]),
  );

  const savePref = useCallback(
    async (
      key:
        | "ai_anomaly_alerts"
        | "ai_weekly_digest"
        | "ai_tax_opportunities"
        | "ai_insight_frequency"
        | "ai_forecast_threshold",
      value: string,
    ) => {
      if (!user) return;
      try {
        await setPreference(db, user.id, key, value);
      } catch (e: unknown) {
        console.warn(`Failed to save ${key}:`, e);
      }
    },
    [db, user],
  );

  const handleAnomalyToggle = useCallback(
    (v: boolean) => {
      setAnomalyAlerts(v);
      savePref("ai_anomaly_alerts", v ? "true" : "false");
    },
    [savePref],
  );

  const handleDigestToggle = useCallback(
    (v: boolean) => {
      setWeeklyDigest(v);
      savePref("ai_weekly_digest", v ? "true" : "false");
    },
    [savePref],
  );

  const handleTaxToggle = useCallback(
    (v: boolean) => {
      setTaxOpportunities(v);
      savePref("ai_tax_opportunities", v ? "true" : "false");
    },
    [savePref],
  );

  const handleFrequency = useCallback(
    (f: "daily" | "weekly" | "monthly") => {
      setInsightFrequency(f);
      savePref("ai_insight_frequency", f);
    },
    [savePref],
  );

  const handleThreshold = useCallback(
    (t: number) => {
      setForecastThresh(t);
      savePref("ai_forecast_threshold", String(t));
    },
    [savePref],
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safe}>
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
            AI Financial Insights
          </ThemedText>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingLeft: insets.left + Spacing.four,
              paddingRight: insets.right + Spacing.four,
            },
          ]}
        >
          {/* Alert toggles */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Alert Types
            </ThemedText>
            <NeumorphicCard style={styles.card}>
              <ToggleRow
                label="Anomaly Detection"
                description="Get notified when spending deviates from your patterns."
                value={anomalyAlerts}
                onValueChange={handleAnomalyToggle}
              />
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <ToggleRow
                label="Weekly Digest"
                description="Receive a summary of income, expenses, and cash flow each week."
                value={weeklyDigest}
                onValueChange={handleDigestToggle}
              />
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <ToggleRow
                label="Tax Opportunities"
                description="AI identifies potential deductions and tax-saving moves."
                value={taxOpportunities}
                onValueChange={handleTaxToggle}
              />
            </NeumorphicCard>
          </View>

          {/* Frequency */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Notification Frequency
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.sectionSub}
            >
              How often the AI reviews your transactions and sends alerts.
            </ThemedText>
            <View style={styles.chipRow}>
              {(["daily", "weekly", "monthly"] as const).map((f) => (
                <FrequencyChip
                  key={f}
                  label={f.charAt(0).toUpperCase() + f.slice(1)}
                  selected={insightFrequency === f}
                  onSelect={() => handleFrequency(f)}
                />
              ))}
            </View>
          </View>

          {/* Cash reserve threshold */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Cash Reserve Threshold
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.sectionSub}
            >
              Minimum balance before you receive a low-cash alert.
            </ThemedText>
            <View style={styles.chipRow}>
              {threshOptions.map((t) => (
                <FrequencyChip
                  key={t}
                  label={`$${(t / 100).toLocaleString()}`}
                  selected={forecastThresh === t}
                  onSelect={() => handleThreshold(t)}
                />
              ))}
            </View>
          </View>

          {/* Recent insights */}
          {(anomalyAlerts || weeklyDigest || taxOpportunities) && (
            <View style={styles.section}>
              <ThemedText type="callout" style={styles.sectionTitle}>
                Recent Insights
              </ThemedText>
              {insights.map((insight, idx) => {
                const accentColor =
                  insight.type === "anomaly"
                    ? theme.warning
                    : insight.type === "forecast"
                      ? theme.danger
                      : theme.success;
                const iconName =
                  insight.type === "anomaly"
                    ? ({
                        ios: "exclamationmark.triangle",
                        android: "warning",
                        web: "warning",
                      } as const)
                    : insight.type === "forecast"
                      ? ({
                          ios: "chart.line.downtrend.xyaxis",
                          android: "trending_down",
                          web: "trending_down",
                        } as const)
                      : ({ ios: "leaf", android: "eco", web: "eco" } as const);

                return (
                  <NeumorphicCard key={idx} style={styles.insightCard}>
                    <View style={styles.insightTop}>
                      <SymbolView
                        name={iconName}
                        size={20}
                        tintColor={accentColor}
                      />
                      <View style={styles.insightBody}>
                        <ThemedText
                          type="default"
                          style={{ fontWeight: "600" }}
                        >
                          {insight.title}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {insight.detail}
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                      style={styles.insightDate}
                    >
                      {insight.date}
                    </ThemedText>
                  </NeumorphicCard>
                );
              })}
            </View>
          )}

          {/* Info */}
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
              AI analysis runs on-device using local transaction data. No
              financial data is sent to external servers.
            </ThemedText>
          </View>

          <View style={{ height: BottomTabInset + Spacing.six }} />
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
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  headerTitle: { flex: 1 },
  backBtn: { padding: Spacing.one },
  scroll: {
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.one,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  sectionSub: {
    lineHeight: 18,
  },
  card: {
    paddingHorizontal: Spacing.three,
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
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.one,
  },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  insightCard: {
    padding: Spacing.three,
    gap: Spacing.one,
  },
  insightTop: {
    flexDirection: "row",
    gap: Spacing.two,
    alignItems: "flex-start",
  },
  insightBody: {
    flex: 1,
    gap: 1,
  },
  insightDate: {
    marginLeft: 20 + Spacing.two,
  },
  infoBox: {
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.three,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, lineHeight: 18 },
});
