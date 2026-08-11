import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { NeumorphicButton, NeumorphicCard } from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useSQLiteContext } from "@/db/provider";
import { getPreference } from "@/db/preferences-repo";
import {
  findTransactionsByUser,
  getMonthlyTotals,
  getYearToDateSummary,
} from "@/db/transaction-repo";
import { downloadTextFile } from "@/lib/export-utils";
import { useTheme } from "@/hooks/use-theme";
import { formatCurrency, getMonthName } from "@/lib/format";
import { estimateAnnualTax, toFilingStatus } from "@/lib/tax-engine";
import { useAuthStore } from "@/stores/use-auth-store";

export default function ReportsScreen() {
  const colors = useTheme();
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const insets = useSafeAreaInsets();

  const [yearSummary, setYearSummary] = useState<{
    totalIncome: number;
    totalExpenses: number;
    net: number;
  } | null>(null);
  const [monthlyTotals, setMonthlyTotals] = useState<
    Array<{ month: number; income: number; expenses: number; net: number }>
  >([]);
  const [taxEstimate, setTaxEstimate] = useState<ReturnType<
    typeof estimateAnnualTax
  > | null>(null);
  const [transactionCount, setTransactionCount] = useState(0);
  const [baseCurrency, setBaseCurrency] = useState("USD");

  const now = new Date();
  const currentYear = now.getFullYear();

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      const [summary, monthly, txns] = await Promise.all([
        getYearToDateSummary(db, user.id, currentYear),
        getMonthlyTotals(db, user.id, currentYear),
        findTransactionsByUser(db, user.id, { limit: 10000 }),
      ]);

      setYearSummary(summary);
      setMonthlyTotals(monthly);
      setTransactionCount(txns.length);

      // Compute tax estimate
      const ytdIncome = txns
        .filter((t) => t.amountCents > 0)
        .reduce((sum, t) => sum + t.amountCents, 0);
      const ytdExpenses = txns
        .filter((t) => t.amountCents < 0)
        .reduce((sum, t) => sum + Math.abs(t.amountCents), 0);

      const [filingStatus, baseCurrency] = await Promise.all([
        getPreference(db, user.id, "tax_filing_status"),
        getPreference(db, user.id, "base_currency"),
      ]);
      setBaseCurrency(baseCurrency);

      const taxResult = estimateAnnualTax({
        ytdIncomeCents: ytdIncome,
        ytdDeductionsCents: ytdExpenses,
        filingStatus: toFilingStatus(filingStatus),
        taxYear: currentYear,
        currentQuarter: Math.ceil((now.getMonth() + 1) / 3) as 1 | 2 | 3 | 4,
      });
      setTaxEstimate(taxResult);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("closed")) return;
      console.warn("loadData error:", e);
    }
  }, [db, user, currentYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const exportCSV = useCallback(async () => {
    if (!user) return;

    const txns = await findTransactionsByUser(db, user.id, { limit: 10000 });

    // Build CSV
    const headers = [
      "Date",
      "Type",
      "Amount",
      "Currency",
      "Category",
      "Account",
      "Note",
    ];
    const rows = txns.map((t) => [
      t.date,
      t.amountCents > 0 ? "Income" : "Expense",
      (t.amountCents / 100).toFixed(2),
      t.currencyCode,
      t.categoryName ?? "",
      t.accountName ?? "",
      (t.note ?? "").replace(/,/g, ";"),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const fileName = `smoootax-export-${currentYear}.csv`;
    await downloadTextFile(fileName, csv, "text/csv", "Export Transactions");
  }, [db, user, currentYear]);

  const exportScheduleC = useCallback(async () => {
    if (!user || !yearSummary || !taxEstimate) return;

    const txns = await findTransactionsByUser(db, user.id, { limit: 10000 });

    // Schedule C summary
    const income = txns.filter((t) => t.amountCents > 0);
    const expenses = txns.filter((t) => t.amountCents < 0);

    // Group expenses by category
    const expenseByCategory = new Map<string, number>();
    for (const t of expenses) {
      const cat = t.categoryName ?? "Uncategorized";
      expenseByCategory.set(
        cat,
        (expenseByCategory.get(cat) ?? 0) + Math.abs(t.amountCents),
      );
    }

    let report = `SCHEDULE C SUMMARY - ${currentYear}\n`;
    report += `${"=".repeat(50)}\n\n`;
    report += `GROSS INCOME: ${formatCurrency(yearSummary.totalIncome, baseCurrency)}\n`;
    report += `TOTAL EXPENSES: ${formatCurrency(yearSummary.totalExpenses, baseCurrency)}\n`;
    report += `NET PROFIT: ${formatCurrency(yearSummary.net, baseCurrency)}\n\n`;
    report += `EXPENSE BREAKDOWN:\n`;
    report += `${"-".repeat(40)}\n`;

    const sortedExpenses = Array.from(expenseByCategory.entries()).sort(
      (a, b) => b[1] - a[1],
    );

    for (const [cat, amount] of sortedExpenses) {
      report += `${cat.padEnd(30)} ${formatCurrency(amount, baseCurrency).padStart(15)}\n`;
    }

    report += `\nTAX ESTIMATE:\n`;
    report += `${"-".repeat(40)}\n`;
    report += `Self-Employment Tax: ${formatCurrency(taxEstimate.selfEmploymentTaxCents, baseCurrency)}\n`;
    report += `Federal Income Tax: ${formatCurrency(taxEstimate.federalIncomeTaxCents, baseCurrency)}\n`;
    report += `Total Estimated Tax: ${formatCurrency(taxEstimate.totalEstimatedTaxCents, baseCurrency)}\n`;
    report += `Quarterly Payment: ${formatCurrency(taxEstimate.quarterlyPaymentCents, baseCurrency)}\n`;
    report += `Effective Rate: ${taxEstimate.effectiveRate.toFixed(1)}%\n`;

    const fileName = `schedule-c-${currentYear}.txt`;
    await downloadTextFile(fileName, report, "text/plain", "Schedule C Summary");
  }, [db, user, currentYear, yearSummary, taxEstimate, baseCurrency]);

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
        >
          <ThemedText type="title">Reports</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {currentYear} Tax Year
          </ThemedText>

          {/* Year Summary */}
          {yearSummary && (
            <NeumorphicCard style={styles.card}>
              <ThemedText type="callout" style={styles.sectionTitle}>
                Year-to-Date Summary
              </ThemedText>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Gross Income
                  </ThemedText>
                  <ThemedText type="headline" style={{ color: colors.success }}>
                    {formatCurrency(yearSummary.totalIncome, baseCurrency)}
                  </ThemedText>
                </View>
                <View style={styles.summaryItem}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Total Expenses
                  </ThemedText>
                  <ThemedText type="headline" style={{ color: colors.danger }}>
                    {formatCurrency(yearSummary.totalExpenses, baseCurrency)}
                  </ThemedText>
                </View>
              </View>
              <View style={[styles.netRow, { borderTopColor: colors.divider }]}>
                <ThemedText type="callout">Net Profit</ThemedText>
                <ThemedText
                  type="headline"
                  style={{
                    color:
                      yearSummary.net >= 0 ? colors.success : colors.danger,
                  }}
                >
                  {formatCurrency(yearSummary.net, baseCurrency)}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {transactionCount} transactions
              </ThemedText>
            </NeumorphicCard>
          )}

          {/* Tax Summary */}
          {taxEstimate && (
            <NeumorphicCard style={styles.card}>
              <ThemedText type="callout" style={styles.sectionTitle}>
                Tax Estimate
              </ThemedText>
              <View style={styles.taxRow}>
                <ThemedText type="default">Self-Employment Tax</ThemedText>
                <ThemedText type="default">
                  {formatCurrency(taxEstimate.selfEmploymentTaxCents, baseCurrency)}
                </ThemedText>
              </View>
              <View style={styles.taxRow}>
                <ThemedText type="default">Federal Income Tax</ThemedText>
                <ThemedText type="default">
                  {formatCurrency(taxEstimate.federalIncomeTaxCents, baseCurrency)}
                </ThemedText>
              </View>
              {taxEstimate.stateIncomeTaxCents > 0 && (
                <View style={styles.taxRow}>
                  <ThemedText type="default">State Income Tax</ThemedText>
                  <ThemedText type="default">
                    {formatCurrency(taxEstimate.stateIncomeTaxCents, baseCurrency)}
                  </ThemedText>
                </View>
              )}
              <View
                style={[styles.taxRowTotal, { borderTopColor: colors.divider }]}
              >
                <ThemedText type="callout" style={{ fontWeight: "700" }}>
                  Total Estimated Tax
                </ThemedText>
                <ThemedText type="headline" style={{ color: colors.warning }}>
                  {formatCurrency(taxEstimate.totalEstimatedTaxCents, baseCurrency)}
                </ThemedText>
              </View>
              <View style={styles.taxRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  Quarterly Payment
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatCurrency(taxEstimate.quarterlyPaymentCents, baseCurrency)}
                </ThemedText>
              </View>
              <View style={styles.taxRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  Effective Rate
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {taxEstimate.effectiveRate.toFixed(1)}%
                </ThemedText>
              </View>
            </NeumorphicCard>
          )}

          {/* Monthly Breakdown */}
          {monthlyTotals.length > 0 && (
            <NeumorphicCard style={styles.card}>
              <ThemedText type="callout" style={styles.sectionTitle}>
                Monthly Breakdown
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={true}
                nestedScrollEnabled
              >
                <View>
                  {/* Header row */}
                  <View
                    style={[
                      styles.monthRow,
                      { borderBottomColor: colors.cardBorder },
                    ]}
                  >
                    <ThemedText type="smallBold" style={styles.monthName}>
                      Month
                    </ThemedText>
                    <ThemedText
                      type="smallBold"
                      style={[styles.monthAmount, { color: colors.success }]}
                    >
                      Income
                    </ThemedText>
                    <ThemedText
                      type="smallBold"
                      style={[styles.monthAmount, { color: colors.danger }]}
                    >
                      Expenses
                    </ThemedText>
                    <ThemedText
                      type="smallBold"
                      style={[styles.monthAmount, { color: colors.text }]}
                    >
                      Net
                    </ThemedText>
                  </View>
                  {monthlyTotals.map((m) => (
                    <View
                      key={m.month}
                      style={[
                        styles.monthRow,
                        { borderBottomColor: colors.cardBorder },
                      ]}
                    >
                      <ThemedText type="default" style={styles.monthName}>
                        {getMonthName(m.month)}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={[
                          styles.monthAmount,
                          { color: colors.success, textAlign: "right" },
                        ]}
                      >
                        {m.income > 0
                          ? `+${formatCurrency(m.income, baseCurrency)}`
                          : "-"}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={[
                          styles.monthAmount,
                          { color: colors.danger, textAlign: "right" },
                        ]}
                      >
                        {m.expenses > 0
                          ? `-${formatCurrency(m.expenses, baseCurrency)}`
                          : "-"}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={[
                          styles.monthAmount,
                          {
                            color: m.net >= 0 ? colors.success : colors.danger,
                            fontWeight: "600",
                            textAlign: "right",
                          },
                        ]}
                      >
                        {formatCurrency(m.net, baseCurrency)}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </NeumorphicCard>
          )}

          {/* Export Buttons */}
          <View style={styles.exportSection}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Export Data
            </ThemedText>

            <NeumorphicButton onPress={exportCSV} style={styles.exportBtn}>
              Export All Transactions (CSV)
            </NeumorphicButton>

            <NeumorphicButton
              variant="secondary"
              onPress={exportScheduleC}
              style={styles.exportBtnSecondary}
            >
              Schedule C Summary
            </NeumorphicButton>
          </View>

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
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  summaryRow: {
    flexDirection: "row",
    gap: Spacing.three,
  },
  summaryItem: {
    flex: 1,
    gap: Spacing.half,
  },
  netRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  taxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.half,
  },
  taxRowTotal: {
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  monthName: {
    width: 70,
    fontWeight: "600",
  },
  monthAmount: {
    width: 100,
    textAlign: "right",
  },
  exportSection: {
    gap: Spacing.two,
  },
  exportBtn: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.half,
  },
  exportBtnSecondary: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.half,
  },
});
