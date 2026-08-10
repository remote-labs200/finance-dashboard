import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { ComponentProps, useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import NotificationBell from "@/components/notification-bell";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  NeumorphicButton,
  NeumorphicCard,
  NeumorphicPressable,
  NeumorphicSurface,
} from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { findAccountsByUser } from "@/db/account-repo";
import { useSQLiteContext } from "@/db/provider";
import { Account, Transaction } from "@/db/schema";
import { getPreference } from "@/db/preferences-repo";
import {
  findTransactionsByUser,
  getMonthlySummary,
  getMonthlyTotals,
} from "@/db/transaction-repo";
import { useThemeColors } from "@/hooks/use-theme";
import { formatCurrency, formatDateShort } from "@/lib/format";
import {
  aggregateMonthlyIncomes,
  computeSmoothing,
} from "@/lib/income-smoothing";
import {
  daysUntilNextDeadline,
  estimateAnnualTax,
  toFilingStatus,
} from "@/lib/tax-engine";
import { generateForecast } from "@/lib/forecast-service";
import { useAuthStore } from "@/stores/use-auth-store";

interface QuickStatProps {
  icon: ComponentProps<typeof SymbolView>["name"];
  tintColor: string;
  title: string;
  value: string;
  sub: string;
}

function QuickStat({ icon, tintColor, title, value, sub }: QuickStatProps) {
  return (
    <NeumorphicCard style={styles.statCard}>
      <View style={styles.cardInsightsRow}>
        <SymbolView name={icon} size={16} tintColor={tintColor} />
        <ThemedText
          type="small"
          themeColor="textSecondary"
          numberOfLines={2}
          style={{ flex: 1 }}
        >
          {title}
        </ThemedText>
      </View>
      <ThemedText
        type="subtitle"
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[styles.statValue, { color: tintColor }]}
      >
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {sub}
      </ThemedText>
    </NeumorphicCard>
  );
}

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  const [netIncome, setNetIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [taxEstimate, setTaxEstimate] = useState<ReturnType<
    typeof estimateAnnualTax
  > | null>(null);
  const [smoothing, setSmoothing] = useState<ReturnType<
    typeof computeSmoothing
  > | null>(null);
  const [nextDeadline, setNextDeadline] =
    useState<ReturnType<typeof daysUntilNextDeadline>>(null);
  const [bufferedCents, setBufferedCents] = useState(0);
  const [pendingCents, setPendingCents] = useState(0);
  const [uninvoicedCount, setUninvoicedCount] = useState(0);
  const [receiptCount, setReceiptCount] = useState(0);
  const [cashFlow, setCashFlow] = useState<{
    netCents: number;
    trend: "up" | "down" | "stable";
    trendPercent: number;
  } | null>(null);
  const [baseCurrency, setBaseCurrency] = useState("USD");

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const [summary, accs, txns] = await Promise.all([
        getMonthlySummary(db, user.id, year, month),
        findAccountsByUser(db, user.id),
        findTransactionsByUser(db, user.id, { limit: 5 }),
      ]);

      setNetIncome(summary.net);
      setTotalExpenses(-summary.totalExpenses);
      setAccounts(accs);
      setRecentTxns(txns);

      const [filingStatus, baseCurrency] = await Promise.all([
        getPreference(db, user.id, "tax_filing_status"),
        getPreference(db, user.id, "base_currency"),
      ]);
      setBaseCurrency(baseCurrency);

      // Compute tax estimate
      const allTxns = await findTransactionsByUser(db, user.id, { limit: 500 });
      const ytdIncome = allTxns
        .filter((t) => t.amountCents > 0)
        .reduce((sum, t) => sum + t.amountCents, 0);
      const ytdExpenses = allTxns
        .filter((t) => t.amountCents < 0)
        .reduce((sum, t) => sum + Math.abs(t.amountCents), 0);

      const taxResult = estimateAnnualTax({
        ytdIncomeCents: ytdIncome,
        ytdDeductionsCents: ytdExpenses,
        filingStatus: toFilingStatus(filingStatus),
        taxYear: year,
        currentQuarter: Math.ceil(month / 3) as 1 | 2 | 3 | 4,
      });
      setTaxEstimate(taxResult);
      setNextDeadline(daysUntilNextDeadline());

      // Compute income smoothing
      const monthlyData = aggregateMonthlyIncomes(
        allTxns.map((t) => ({ amountCents: t.amountCents, date: t.date })),
        `${year - 1}-01`,
        `${year}-12`,
      );
      if (monthlyData.length >= 2) {
        const smoothingResult = computeSmoothing({
          monthlyIncomes: monthlyData,
        });
        setSmoothing(smoothingResult);
        const lastActual = [...smoothingResult.projections]
          .filter((p) => !p.isProjected)
          .pop();
        setBufferedCents(lastActual?.bufferBalanceCents ?? 0);
      }

      // Pending payments & uninvoiced count (current month income)
      const monthKey = `${year}-${String(month).padStart(2, "0")}`;
      const pendingRows = await db.getAllAsync<{
        amount: number;
        note: string | null;
      }>(
        `SELECT amount_cents as amount, note FROM transactions
         WHERE user_id = ? AND date >= ? AND date <= ? AND amount_cents > 0`,
        user.id,
        `${monthKey}-01`,
        `${monthKey}-31`,
      );
      setPendingCents(pendingRows.reduce((sum, r) => sum + r.amount, 0));
      setUninvoicedCount(
        new Set(
          pendingRows
            .map((r) => r.note)
            .filter((n): n is string => !!n && n.trim() !== ""),
        ).size,
      );

      // Recent OCR receipts logged (last 30 days)
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const receiptRow = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM transactions
         WHERE user_id = ? AND date >= ?
           AND (note LIKE '[Receipt]%' OR note = 'Receipt scan')`,
        user.id,
        since.toISOString().split("T")[0],
      );
      setReceiptCount(receiptRow?.count ?? 0);

      // Cash flow trajectory for the current month
      const [monthlyThisYear, monthlyLastYear] = await Promise.all([
        getMonthlyTotals(db, user.id, year),
        getMonthlyTotals(db, user.id, year - 1),
      ]);
      const history: {
        month: string;
        incomeCents: number;
        expenseCents: number;
      }[] = [];
      for (const m of monthlyLastYear) {
        history.push({
          month: `${year - 1}-${String(m.month).padStart(2, "0")}`,
          incomeCents: m.income,
          expenseCents: m.expenses,
        });
      }
      for (const m of monthlyThisYear) {
        const key = `${year}-${String(m.month).padStart(2, "0")}`;
        if (key <= monthKey) {
          history.push({
            month: key,
            incomeCents: m.income,
            expenseCents: m.expenses,
          });
        }
      }
      const forecast = generateForecast(history, 6);
      const currentActual = history.find((h) => h.month === monthKey);
      const projected = forecast.forecasts.find((f) => f.month >= monthKey);
      const netCents = currentActual
        ? currentActual.incomeCents - currentActual.expenseCents
        : projected
          ? projected.predictedIncomeCents - projected.predictedExpenseCents
          : 0;
      setCashFlow({
        netCents,
        trend: forecast.trendDirection,
        trendPercent: forecast.trendPercent,
      });
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("closed")) return;
      console.warn("loadData error:", e);
    }
  }, [db, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const totalBalance = accounts.reduce((sum, a) => sum + a.balanceCents, 0);
  const now = new Date();
  const monthName = now.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const trendLabel = cashFlow
    ? cashFlow.trend === "up"
      ? `Projected +${cashFlow.trendPercent}%`
      : cashFlow.trend === "down"
        ? `Projected −${cashFlow.trendPercent}%`
        : "Stable trajectory"
    : "No data yet";

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safeArea}>
        <FlashList
          data={recentTxns}
          keyExtractor={(item) => item.id}
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
          ListHeaderComponent={
            <View style={styles.headerSection}>
              <View style={styles.headerRow}>
                <ThemedText type="title">Dashboard</ThemedText>
                <NotificationBell />
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {monthName}
              </ThemedText>

              {/* Safe Pay Hero Card */}
              <NeumorphicCard style={styles.heroCard}>
                <View style={styles.cardInsightsRow}>
                  <SymbolView
                    name={{
                      ios: "shield.checkered",
                      android: "verified_user",
                      web: "verified_user",
                    }}
                    size={20}
                    tintColor={colors.success}
                  />
                  <ThemedText type="callout" style={{ fontWeight: "600" }}>
                    Safe Pay This Month
                  </ThemedText>
                </View>
                <ThemedText type="headline" style={{ color: colors.success }}>
                  {formatCurrency(smoothing?.safePayCents ?? 0, baseCurrency)}
                </ThemedText>
                <View
                  style={[
                    styles.bufferBarTrack,
                    { backgroundColor: colors.inputBorder },
                  ]}
                >
                  {bufferedCents > 0 || (smoothing?.safePayCents ?? 0) > 0 ? (
                    <>
                      <View
                        style={[
                          styles.bufferBarFill,
                          { flex: bufferedCents, backgroundColor: colors.cyan },
                        ]}
                      />
                      <View
                        style={[
                          styles.bufferBarFill,
                          {
                            flex: smoothing?.safePayCents ?? 0,
                            backgroundColor: colors.success,
                          },
                        ]}
                      />
                    </>
                  ) : (
                    <View style={[styles.bufferBarFill, { flex: 1 }]} />
                  )}
                </View>
                <View style={styles.bufferLegend}>
                  <View style={styles.legendItem}>
                    <View
                      style={[styles.legendDot, { backgroundColor: colors.cyan }]}
                    />
                    <ThemedText type="small" themeColor="textSecondary">
                      Buffered {formatCurrency(bufferedCents, baseCurrency)}
                    </ThemedText>
                  </View>
                  <View style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: colors.success },
                      ]}
                    />
                    <ThemedText type="small" themeColor="textSecondary">
                      Safe to spend{" "}
                      {formatCurrency(smoothing?.safePayCents ?? 0, baseCurrency)}
                    </ThemedText>
                  </View>
                </View>
              </NeumorphicCard>

              {/* Quick Stats (2x2 grid) */}
              <View style={styles.quickStatsSection}>
                <ThemedText type="callout" style={styles.sectionTitle}>
                  Quick Stats
                </ThemedText>
                <View style={[styles.cardRow, { gap: Spacing.two }]}>
                  <QuickStat
                    icon={{
                      ios: "building.columns.fill",
                      android: "account_balance",
                      web: "account_balance",
                    }}
                    tintColor={colors.warning}
                    title="Quarterly Tax Reserve"
                    value={formatCurrency(
                      taxEstimate?.quarterlyPaymentCents ?? 0,
                      baseCurrency,
                    )}
                    sub={
                      nextDeadline
                        ? `Q${nextDeadline.quarter} · ${nextDeadline.daysRemaining}d left`
                        : "No estimate yet"
                    }
                  />
                  <QuickStat
                    icon={{
                      ios: "doc.text.fill",
                      android: "description",
                      web: "description",
                    }}
                    tintColor={colors.purple}
                    title={"Uninvoiced · Pending Payments"}
                    value={formatCurrency(pendingCents, baseCurrency)}
                    sub={`${uninvoicedCount} uninvoiced this month`}
                  />
                </View>
                <View style={[styles.cardRow, { gap: Spacing.two }]}>
                  <QuickStat
                    icon={{
                      ios: "doc.viewfinder",
                      android: "document_scanner",
                      web: "document_scanner",
                    }}
                    tintColor={colors.orange}
                    title="OCR Receipts Logged"
                    value={String(receiptCount)}
                    sub="Last 30 days"
                  />
                  <QuickStat
                    icon={{
                      ios: "chart.line.uptrend.xyaxis",
                      android: "trending_up",
                      web: "trending_up",
                    }}
                    tintColor={colors.cyan}
                    title="Cash Flow Trajectory"
                    value={formatCurrency(cashFlow?.netCents ?? 0, baseCurrency)}
                    sub={trendLabel}
                  />
                </View>
              </View>

              {/* Hero cards */}
              <View style={[styles.cardRow, { gap: Spacing.two }]}>
                <NeumorphicCard style={styles.card}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Net Income
                  </ThemedText>
                  <ThemedText
                    type="headline"
                    style={{
                      color: netIncome >= 0 ? colors.success : colors.danger,
                    }}
                  >
                    {formatCurrency(netIncome, baseCurrency)}
                  </ThemedText>
                </NeumorphicCard>
                <NeumorphicCard style={styles.card}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Expenses
                  </ThemedText>
                  <ThemedText type="headline" style={{ color: colors.danger }}>
                    {formatCurrency(totalExpenses, baseCurrency)}
                  </ThemedText>
                </NeumorphicCard>
              </View>

              <View style={[styles.cardRow, { gap: Spacing.two }]}>
                <NeumorphicCard style={styles.card}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Total Balance
                  </ThemedText>
                  <ThemedText type="headline">
                    {formatCurrency(totalBalance, baseCurrency)}
                  </ThemedText>
                </NeumorphicCard>
                <NeumorphicButton
                  style={styles.cardAdd}
                  onPress={() => router.push("/(tabs)/transaction")}
                >
                  <SymbolView
                    name={{
                      ios: "plus.circle.fill",
                      android: "add_circle",
                      web: "add_circle",
                    }}
                    size={22}
                    tintColor="#ffffff"
                  />
                  Add Transaction
                </NeumorphicButton>
              </View>

              {/* Quick Actions */}
              <View style={styles.quickActionsSection}>
                <ThemedText type="callout" style={styles.sectionTitle}>
                  Quick Actions
                </ThemedText>
                <View style={styles.quickActionsRow}>
                  {(
                    [
                      {
                        icon: {
                          ios: "plus.circle.fill",
                          android: "add_circle",
                          web: "add_circle",
                        },
                        label: "Add",
                        route: "/(tabs)/transaction" as const,
                        color: colors.primary,
                      },
                      {
                        icon: {
                          ios: "camera.viewfinder",
                          android: "photo_camera",
                          web: "photo_camera",
                        },
                        label: "Scan",
                        route: "/(tabs)/(main)/scan" as const,
                        color: colors.orange,
                      },
                      {
                        icon: {
                          ios: "person.2.fill",
                          android: "group",
                          web: "group",
                        },
                        label: "Clients",
                        route: "/(tabs)/(main)/clients" as const,
                        color: colors.purple,
                      },
                      {
                        icon: {
                          ios: "sparkles",
                          android: "auto_awesome",
                          web: "auto_awesome",
                        },
                        label: "AI Insights",
                        route: "/(tabs)/insights" as const,
                        color: colors.cyan,
                      },
                      {
                        icon: {
                          ios: "car.fill",
                          android: "directions_car",
                          web: "directions_car",
                        },
                        label: "Mileage",
                        route: "/(tabs)/mileage" as const,
                        color: colors.warning,
                      },
                      {
                        icon: {
                          ios: "square.and.arrow.up",
                          android: "ios_share",
                          web: "ios_share",
                        },
                        label: "Export",
                        route: "/(tabs)/export-ledger" as const,
                        color: colors.success,
                      },
                      {
                        icon: {
                          ios: "arrow.triangle.2.circlepath",
                          android: "sync",
                          web: "sync",
                        },
                        label: "Sync",
                        route: "/(tabs)/cloud-sync" as const,
                        color: colors.textSecondary,
                      },
                    ] as const
                  ).map((action) => (
                    <Pressable
                      key={action.label}
                      style={styles.quickActionItem}
                      onPress={() => router.push(action.route)}
                    >
                      <NeumorphicSurface
                        style={[
                          styles.quickActionCircle,
                          {
                            backgroundColor: action.color + "1a",
                          },
                        ]}
                      >
                        <SymbolView
                          name={action.icon}
                          size={22}
                          tintColor={action.color}
                        />
                      </NeumorphicSurface>
                      <ThemedText
                        type="small"
                        themeColor="textSecondary"
                        style={styles.quickActionLabel}
                      >
                        {action.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Tax Estimation Card */}
              {taxEstimate && (
                <NeumorphicCard style={styles.card}>
                  <View style={styles.cardTaxHeader}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Quarterly Tax Estimate
                    </ThemedText>
                    {nextDeadline && (
                      <NeumorphicSurface
                        small
                        style={[
                          styles.deadlineBadge,
                          { backgroundColor: colors.warning + "26" },
                        ]}
                      >
                        <ThemedText
                          type="small"
                          style={{
                            color:
                              nextDeadline.daysRemaining <= 30
                                ? colors.danger
                                : colors.warning,
                          }}
                        >
                          {nextDeadline.daysRemaining}d left
                        </ThemedText>
                      </NeumorphicSurface>
                    )}
                  </View>
                  <ThemedText type="headline" style={{ color: colors.warning }}>
                    {formatCurrency(taxEstimate.quarterlyPaymentCents, baseCurrency)}
                  </ThemedText>
                  <View style={styles.taxBreakdown}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Effective rate: {taxEstimate.effectiveRate.toFixed(1)}%
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      SE Tax:{" "}
                      {formatCurrency(
                        taxEstimate.selfEmploymentTaxCents,
                        baseCurrency,
                      )}
                    </ThemedText>
                  </View>
                </NeumorphicCard>
              )}

              {/* Income Smoothing Card */}
              {smoothing && smoothing.safePayCents > 0 && (
                <NeumorphicCard style={styles.card}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Safe Monthly Pay
                  </ThemedText>
                  <ThemedText type="headline" style={{ color: colors.success }}>
                    {formatCurrency(smoothing.safePayCents, baseCurrency)}
                  </ThemedText>
                  <View style={styles.taxBreakdown}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Volatility: {smoothing.volatilityPercent}%
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Buffer needed:{" "}
                      {formatCurrency(smoothing.bufferRequiredCents, baseCurrency)}
                    </ThemedText>
                  </View>
                  {smoothing.dryMonths.length > 0 && (
                    <NeumorphicSurface
                      small
                      style={[
                        styles.dryMonthWarning,
                        { backgroundColor: colors.warning + "1a" },
                      ]}
                    >
                      <SymbolView
                        name={{
                          ios: "exclamationmark.triangle.fill",
                          android: "warning",
                          web: "warning",
                        }}
                        size={14}
                        tintColor={colors.warning}
                      />
                      <ThemedText
                        type="small"
                        style={{ color: colors.warning }}
                      >
                        {smoothing.dryMonths.length} dry month
                        {smoothing.dryMonths.length > 1 ? "s" : ""} detected
                      </ThemedText>
                    </NeumorphicSurface>
                  )}
                </NeumorphicCard>
              )}

              {/* AI Insights Card */}
              <NeumorphicPressable
                style={styles.card}
                onPress={() => router.push("/(tabs)/insights")}
              >
                <View style={styles.cardInsightsRow}>
                  <SymbolView
                    name={{
                      ios: "sparkles",
                      android: "auto_awesome",
                      web: "auto_awesome",
                    }}
                    size={20}
                    tintColor={colors.primary}
                  />
                  <ThemedText type="callout" style={{ fontWeight: "600" }}>
                    AI Insights
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  Ask questions about your finances in natural language
                </ThemedText>
              </NeumorphicPressable>

              {/* Client Ledger Card */}
              <NeumorphicPressable
                style={styles.card}
                onPress={() => router.push("/(tabs)/(main)/clients")}
              >
                <View style={styles.cardInsightsRow}>
                  <SymbolView
                    name={{
                      ios: "person.2.fill",
                      android: "group",
                      web: "group",
                    }}
                    size={20}
                    tintColor={colors.purple}
                  />
                  <ThemedText type="callout" style={{ fontWeight: "600" }}>
                    Client Ledger
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  Track invoices and payments per client
                </ThemedText>
              </NeumorphicPressable>

              {/* Mileage Tracker Card */}
              <NeumorphicPressable
                style={styles.card}
                onPress={() => router.push("/(tabs)/mileage")}
              >
                <View style={styles.cardInsightsRow}>
                  <SymbolView
                    name={{
                      ios: "car.fill",
                      android: "directions_car",
                      web: "directions_car",
                    }}
                    size={20}
                    tintColor={colors.orange}
                  />
                  <ThemedText type="callout" style={{ fontWeight: "600" }}>
                    Mileage Tracker
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  Log business miles for tax deductions
                </ThemedText>
              </NeumorphicPressable>

              {/* Cash Flow Forecast Card */}
              <NeumorphicPressable
                style={styles.card}
                onPress={() => router.push("/(tabs)/forecast")}
              >
                <View style={styles.cardInsightsRow}>
                  <SymbolView
                    name={{
                      ios: "chart.line.uptrend.xyaxis",
                      android: "trending_up",
                      web: "trending_up",
                    }}
                    size={20}
                    tintColor={colors.cyan}
                  />
                  <ThemedText type="callout" style={{ fontWeight: "600" }}>
                    Cash Flow Forecast
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  AI-powered 3-month income projection
                </ThemedText>
              </NeumorphicPressable>

              {/* Accounts summary */}
              {accounts.length > 0 && (
                <View style={styles.section}>
                  <ThemedText type="callout" style={styles.sectionTitle}>
                    Accounts
                  </ThemedText>
                  {accounts.map((acc) => (
                    <View key={acc.id} style={styles.accountRow}>
                      <View
                        style={[
                          styles.accountDot,
                          { backgroundColor: acc.color ?? colors.primary },
                        ]}
                      />
                      <ThemedText type="default" style={{ flex: 1 }}>
                        {acc.name}
                      </ThemedText>
                      <ThemedText type="default">
                        {formatCurrency(acc.balanceCents, acc.currencyCode)}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              )}

              {/* Recent transactions header */}
              <View style={styles.section}>
                <ThemedText type="callout" style={styles.sectionTitle}>
                  Recent Transactions
                </ThemedText>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/transaction",
                  params: { id: item.id },
                })
              }
              style={({ pressed }) => [
                styles.txnRow,
                pressed && styles.txnRowPressed,
                { borderBottomColor: colors.divider },
              ]}
            >
              <View style={styles.txnLeft}>
                <ThemedText type="default" numberOfLines={1}>
                  {item.note ?? item.categoryName ?? "Transaction"}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDateShort(item.date)}
                </ThemedText>
              </View>
              <ThemedText
                type="default"
                style={{
                  color: item.amountCents >= 0 ? colors.success : colors.danger,
                }}
              >
                {item.amountCents >= 0 ? "+" : ""}
                {formatCurrency(item.amountCents, item.currencyCode)}
              </ThemedText>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <ThemedText type="small" themeColor="textSecondary">
                No transactions yet. Tap "Add Transaction" to get started.
              </ThemedText>
            </View>
          }
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  headerSection: {
    gap: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  cardRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  card: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  heroCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  bufferBarTrack: {
    height: 10,
    borderRadius: 5,
    flexDirection: "row",
    overflow: "hidden",
    marginTop: Spacing.one,
  },
  bufferBarFill: {
    height: "100%",
  },
  bufferLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  quickStatsSection: {
    gap: Spacing.two,
  },
  statCard: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
    minHeight: 120,
  },
  statValue: {
    marginTop: "auto",
  },
  cardAdd: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardTaxHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  deadlineBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.two,
  },
  taxBreakdown: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dryMonthWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    marginTop: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  section: {
    gap: Spacing.one,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  cardInsightsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  quickActionsSection: {
    gap: Spacing.two,
  },
  quickActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  quickActionItem: {
    alignItems: "center",
    gap: 4,
    minWidth: 48,
  },
  quickActionCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionLabel: {
    fontSize: 10,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.one,
    gap: Spacing.two,
  },
  accountDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  txnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  txnRowPressed: { opacity: 0.6 },
  txnLeft: { flex: 1, gap: 2 },
  empty: {
    paddingVertical: Spacing.six,
    alignItems: "center",
  },
});
