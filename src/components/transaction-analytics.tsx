import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  BarChart,
  LineChart,
  PieChart,
} from "react-native-gifted-charts";

import { ThemedText } from "@/components/themed-text";
import { NeumorphicCard } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { getPreference } from "@/db/preferences-repo";
import { useSQLiteContext } from "@/db/provider";
import { findTransactionsByUser, getMonthlyTotals } from "@/db/transaction-repo";
import { useThemeColors } from "@/hooks/use-theme";
import { formatCurrency, getMonthName } from "@/lib/format";
import { useAuthStore } from "@/stores/use-auth-store";

interface MonthPoint {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

interface CategorySlice {
  value: number;
  color: string;
  label: string;
}

const MONTH_LABEL = (m: number) => getMonthName(m).slice(0, 3);

export default function TransactionAnalytics() {
  const db = useSQLiteContext();
  const colors = useThemeColors();
  const user = useAuthStore((state) => state.user);

  const [points, setPoints] = useState<MonthPoint[]>([]);
  const [categories, setCategories] = useState<CategorySlice[]>([]);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const [thisYear, lastYear, allTxns, baseCurrency] = await Promise.all([
        getMonthlyTotals(db, user.id, year),
        getMonthlyTotals(db, user.id, year - 1),
        findTransactionsByUser(db, user.id, { limit: 10000 }),
        getPreference(db, user.id, "base_currency"),
      ]);

      setBaseCurrency(baseCurrency);

      // Build last-12-months window
      const last12: MonthPoint[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(year, month - 1 - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const totals = y === year ? thisYear : lastYear;
        const row = totals.find((t) => t.month === m);
        last12.push({
          month: MONTH_LABEL(m),
          income: row?.income ?? 0,
          expenses: row?.expenses ?? 0,
          net: (row?.income ?? 0) - (row?.expenses ?? 0),
        });
      }
      setPoints(last12);

      // Expense breakdown by category (this year)
      const expenseByCat = new Map<string, number>();
      for (const t of allTxns) {
        if (t.amountCents >= 0) continue;
        const cat = t.categoryName ?? "Uncategorized";
        expenseByCat.set(
          cat,
          (expenseByCat.get(cat) ?? 0) + Math.abs(t.amountCents),
        );
      }
      const palette = [
        colors.primary,
        colors.success,
        colors.warning,
        colors.orange,
        colors.cyan,
        colors.purple,
        colors.pink,
        colors.danger,
      ];
      const slices: CategorySlice[] = Array.from(expenseByCat.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, value], i) => ({
          label,
          value,
          color: palette[i % palette.length],
        }));
      setCategories(slices);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("closed")) return;
      console.warn("analytics load error:", e);
    } finally {
      setLoading(false);
    }
  }, [db, user, colors]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Loading analytics…
      </ThemedText>
    );
  }

  const incomeData = points.map((p) => ({ value: p.income, label: p.month }));
  const expenseData = points.map((p) => ({
    value: p.expenses,
    label: p.month,
  }));
  const netData = points.map((p) => ({ value: p.net, label: p.month }));

  // Revenue + Gross Profit % for combo charts
  const revenueData = points.map((p) => ({
    value: p.income,
    label: p.month,
  }));
  const marginData = points.map((p) => ({
    value: p.income > 0 ? Math.round((p.net / p.income) * 100) : 0,
    label: p.month,
  }));

  const lineCommon = {
    height: 180,
    spacing: 28,
    initialSpacing: 20,
    endSpacing: 20,
    hideDataPoints: true,
    noOfSections: 4,
    yAxisLabelWidth: 46,
    yAxisTextStyle: { color: colors.textSecondary, fontSize: 9 },
    xAxisLabelTextStyle: { color: colors.textSecondary, fontSize: 9 },
    rulesColor: colors.divider,
    rulesType: "solid" as const,
    xAxisColor: colors.divider,
    yAxisColor: colors.divider,
    showVerticalLines: false,
    formatYLabel: (v: string) =>
      `$${Math.round(Number(v) / 1000)}k`,
  };

  return (
    <View style={styles.container}>
      {/* ── 1. Line Chart: Income vs Expenses ── */}
      <NeumorphicCard style={styles.card}>
        <ThemedText type="callout" style={styles.title}>
          Income vs Expenses
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Last 12 months
        </ThemedText>
        <LineChart
          {...lineCommon}
          data={incomeData}
          data2={expenseData}
          color={colors.success}
          color2={colors.danger}
          thickness={2}
          thickness2={2}
          curved
          maxValue={Math.max(
            1000,
            ...points.map((p) => p.income),
            ...points.map((p) => p.expenses),
          )}
        />
        <View style={styles.legendRow}>
          <Legend color={colors.success} label="Income" />
          <Legend color={colors.danger} label="Expenses" />
        </View>
      </NeumorphicCard>

      {/* ── 2. Smooth Area Chart: Net trend ── */}
      <NeumorphicCard style={styles.card}>
        <ThemedText type="callout" style={styles.title}>
          Net Cash Flow Trend
        </ThemedText>
        <LineChart
          {...lineCommon}
          data={netData}
          color={colors.primary}
          thickness={2}
          curved
          areaChart
          startFillColor={colors.primary}
          endFillColor={colors.primary}
          startOpacity={0.35}
          endOpacity={0.05}
          maxValue={Math.max(1000, ...points.map((p) => Math.abs(p.net)))}
        />
      </NeumorphicCard>

      {/* ── 3. Combo Dual-Axis: Revenue ($) + Gross Profit (%) ── */}
      <NeumorphicCard style={styles.card}>
        <ThemedText type="callout" style={styles.title}>
          Revenue vs Gross Profit (Dual-Axis)
        </ThemedText>
        <LineChart
          {...lineCommon}
          data={revenueData}
          color={colors.cyan}
          thickness={2}
          secondaryData={marginData}
          secondaryLineConfig={{
            color: colors.orange,
            thickness: 2,
            curved: true,
          }}
          secondaryYAxis={{
            yAxisSide: 1,
            maxValue: 100,
            noOfSections: 4,
            yAxisTextStyle: { color: colors.orange, fontSize: 9 },
            yAxisLabelSuffix: "%",
          }}
          maxValue={Math.max(1000, ...points.map((p) => p.income))}
        />
        <View style={styles.legendRow}>
          <Legend color={colors.cyan} label="Revenue (left)" />
          <Legend color={colors.orange} label="Gross profit % (right)" />
        </View>
      </NeumorphicCard>

      {/* ── 4. Combo Bar-Line: Revenue bars + Margin line ── */}
      <NeumorphicCard style={styles.card}>
        <ThemedText type="callout" style={styles.title}>
          Revenue & Margin (Bar-Line)
        </ThemedText>
        <BarChart
          height={180}
          spacing={24}
          initialSpacing={16}
          endSpacing={16}
          noOfSections={4}
          maxValue={Math.max(1000, ...points.map((p) => p.income))}
          yAxisLabelWidth={46}
          barWidth={20}
          frontColor={colors.cyan}
          yAxisTextStyle={{ color: colors.textSecondary, fontSize: 9 }}
          xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 9 }}
          rulesColor={colors.divider}
          rulesType="solid"
          xAxisColor={colors.divider}
          yAxisColor={colors.divider}
          showVerticalLines={false}
          data={revenueData}
          lineData={marginData}
          lineConfig={{
            color: colors.orange,
            thickness: 2,
            curved: true,
            dataPointsColor: colors.orange,
            dataPointsRadius: 3,
            hideDataPoints: false,
          }}
          formatYLabel={(v: string) =>
            `$${Math.round(Number(v) / 1000)}k`
          }
        />
        <View style={styles.legendRow}>
          <Legend color={colors.cyan} label="Revenue (bars)" />
          <Legend color={colors.orange} label="Margin % (line)" />
        </View>
      </NeumorphicCard>

      {/* ── 5. Pie Chart: Expense breakdown ── */}
      <NeumorphicCard style={styles.card}>
        <ThemedText type="callout" style={styles.title}>
          Expenses by Category
        </ThemedText>
        {categories.length > 0 ? (
          <>
            <View style={styles.pieWrap}>
              <PieChart
                data={categories.map((c) => ({
                  value: c.value,
                  color: c.color,
                  text: `${Math.round(
                    (c.value / categories.reduce((s, x) => s + x.value, 0)) * 100,
                  )}%`,
                }))}
                radius={90}
                innerRadius={52}
                donut
                showText
                textColor={colors.backgroundElement}
                textSize={10}
                showTextBackground={false}
                focusOnPress
              />
            </View>
            <View style={styles.legendColumn}>
              {categories.map((c) => (
                <View key={c.label} style={styles.legendRow}>
                  <Legend color={c.color} label={c.label} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatCurrency(c.value, baseCurrency)}
                  </ThemedText>
                </View>
              ))}
            </View>
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            No expense data yet.
          </ThemedText>
        )}
      </NeumorphicCard>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontWeight: "600",
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendColumn: {
    gap: Spacing.one,
  },
  pieWrap: {
    alignItems: "center",
  },
});
