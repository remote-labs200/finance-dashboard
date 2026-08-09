import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { NeumorphicCard, NeumorphicPressable } from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
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
// Mock data: recent anomalies
// ---------------------------------------------------------------------------

const RECENT_INSIGHTS = [
  {
    type: "anomaly" as const,
    title: "Unusual spending detected",
    detail: "Software category 3x higher than monthly average ($450 vs $150).",
    date: "2 days ago",
  },
  {
    type: "forecast" as const,
    title: "Cash reserve running low",
    detail:
      "Projected balance of $2,100 at month-end — below $3,000 threshold.",
    date: "5 days ago",
  },
  {
    type: "opportunity" as const,
    title: "Tax deduction opportunity",
    detail: "Home office expenses are 40% below estimated eligible amount.",
    date: "1 week ago",
  },
];

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function AiFinancialInsightsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [anomalyAlerts, setAnomalyAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [taxOpportunities, setTaxOpportunities] = useState(true);
  const [insightFrequency, setInsightFrequency] = useState<
    "daily" | "weekly" | "monthly"
  >("weekly");
  const [forecastThresh, setForecastThresh] = useState(3000);

  const threshOptions = [1000, 2000, 3000, 5000, 10000];

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
                onValueChange={setAnomalyAlerts}
              />
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <ToggleRow
                label="Weekly Digest"
                description="Receive a summary of income, expenses, and cash flow each week."
                value={weeklyDigest}
                onValueChange={setWeeklyDigest}
              />
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <ToggleRow
                label="Tax Opportunities"
                description="AI identifies potential deductions and tax-saving moves."
                value={taxOpportunities}
                onValueChange={setTaxOpportunities}
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
                  onSelect={() => setInsightFrequency(f)}
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
                  onSelect={() => setForecastThresh(t)}
                />
              ))}
            </View>
          </View>

          {/* Recent insights */}
          {anomalyAlerts && (
            <View style={styles.section}>
              <ThemedText type="callout" style={styles.sectionTitle}>
                Recent Insights
              </ThemedText>
              {RECENT_INSIGHTS.map((insight, idx) => {
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
