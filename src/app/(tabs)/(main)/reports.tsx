import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Paths, File as ExpoFile } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSQLiteContext } from '@/db/provider';
import { useAuthStore } from '@/stores/use-auth-store';
import {
  getYearToDateSummary,
  getMonthlyTotals,
  findTransactionsByUser,
} from '@/db/transaction-repo';
import { useTheme } from '@/hooks/use-theme';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { formatCurrency, getMonthName } from '@/lib/format';
import { estimateAnnualTax } from '@/lib/tax-engine';

export default function ReportsScreen() {
  const colors = useTheme();
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);

  const [yearSummary, setYearSummary] = useState<{ totalIncome: number; totalExpenses: number; net: number } | null>(null);
  const [monthlyTotals, setMonthlyTotals] = useState<Array<{ month: number; income: number; expenses: number; net: number }>>([]);
  const [taxEstimate, setTaxEstimate] = useState<ReturnType<typeof estimateAnnualTax> | null>(null);
  const [transactionCount, setTransactionCount] = useState(0);

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

    const taxResult = estimateAnnualTax({
      ytdIncomeCents: ytdIncome,
      ytdDeductionsCents: ytdExpenses,
      filingStatus: 'single',
      taxYear: currentYear,
      currentQuarter: Math.ceil((now.getMonth() + 1) / 3) as 1 | 2 | 3 | 4,
    });
    setTaxEstimate(taxResult);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('closed')) return;
      console.warn('loadData error:', e);
    }
  }, [db, user, currentYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const exportCSV = useCallback(async () => {
    if (!user) return;

    const txns = await findTransactionsByUser(db, user.id, { limit: 10000 });

    // Build CSV
    const headers = ['Date', 'Type', 'Amount', 'Currency', 'Category', 'Account', 'Note'];
    const rows = txns.map((t) => [
      t.date,
      t.amountCents > 0 ? 'Income' : 'Expense',
      (t.amountCents / 100).toFixed(2),
      t.currencyCode,
      t.categoryName ?? '',
      t.accountName ?? '',
      (t.note ?? '').replace(/,/g, ';'),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const fileName = `smoootax-export-${currentYear}.csv`;
    const file = new ExpoFile(Paths.document, fileName);
    await file.write(csv);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Transactions',
      });
    } else {
      Alert.alert('Exported', `File saved to: ${fileName}`);
    }
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
      const cat = t.categoryName ?? 'Uncategorized';
      expenseByCategory.set(cat, (expenseByCategory.get(cat) ?? 0) + Math.abs(t.amountCents));
    }

    let report = `SCHEDULE C SUMMARY - ${currentYear}\n`;
    report += `${'='.repeat(50)}\n\n`;
    report += `GROSS INCOME: ${formatCurrency(yearSummary.totalIncome, 'USD')}\n`;
    report += `TOTAL EXPENSES: ${formatCurrency(yearSummary.totalExpenses, 'USD')}\n`;
    report += `NET PROFIT: ${formatCurrency(yearSummary.net, 'USD')}\n\n`;
    report += `EXPENSE BREAKDOWN:\n`;
    report += `${'-'.repeat(40)}\n`;

    const sortedExpenses = Array.from(expenseByCategory.entries())
      .sort((a, b) => b[1] - a[1]);

    for (const [cat, amount] of sortedExpenses) {
      report += `${cat.padEnd(30)} ${formatCurrency(amount, 'USD').padStart(15)}\n`;
    }

    report += `\nTAX ESTIMATE:\n`;
    report += `${'-'.repeat(40)}\n`;
    report += `Self-Employment Tax: ${formatCurrency(taxEstimate.selfEmploymentTaxCents, 'USD')}\n`;
    report += `Federal Income Tax: ${formatCurrency(taxEstimate.federalIncomeTaxCents, 'USD')}\n`;
    report += `Total Estimated Tax: ${formatCurrency(taxEstimate.totalEstimatedTaxCents, 'USD')}\n`;
    report += `Quarterly Payment: ${formatCurrency(taxEstimate.quarterlyPaymentCents, 'USD')}\n`;
    report += `Effective Rate: ${taxEstimate.effectiveRate.toFixed(1)}%\n`;

    const fileName = `schedule-c-${currentYear}.txt`;
    const file = new ExpoFile(Paths.document, fileName);
    await file.write(report);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/plain',
        dialogTitle: 'Schedule C Summary',
      });
    } else {
      Alert.alert('Exported', `File saved to: ${fileName}`);
    }
  }, [db, user, currentYear, yearSummary, taxEstimate]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="title">Reports</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{currentYear} Tax Year</ThemedText>

          {/* Year Summary */}
          {yearSummary && (
            <View style={[styles.card, { borderColor: colors.cardBorder }]}>
              <ThemedText type="callout" style={styles.sectionTitle}>Year-to-Date Summary</ThemedText>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <ThemedText type="small" themeColor="textSecondary">Gross Income</ThemedText>
                  <ThemedText type="headline" style={{ color: colors.success }}>
                    {formatCurrency(yearSummary.totalIncome, 'USD')}
                  </ThemedText>
                </View>
                <View style={styles.summaryItem}>
                  <ThemedText type="small" themeColor="textSecondary">Total Expenses</ThemedText>
                  <ThemedText type="headline" style={{ color: colors.danger }}>
                    {formatCurrency(yearSummary.totalExpenses, 'USD')}
                  </ThemedText>
                </View>
              </View>
              <View style={[styles.netRow, { borderTopColor: colors.divider }]}>
                <ThemedText type="callout">Net Profit</ThemedText>
                <ThemedText
                  type="headline"
                  style={{ color: yearSummary.net >= 0 ? colors.success : colors.danger }}>
                  {formatCurrency(yearSummary.net, 'USD')}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {transactionCount} transactions
              </ThemedText>
            </View>
          )}

          {/* Tax Summary */}
          {taxEstimate && (
            <View style={[styles.card, { borderColor: colors.cardBorder }]}>
              <ThemedText type="callout" style={styles.sectionTitle}>Tax Estimate</ThemedText>
              <View style={styles.taxRow}>
                <ThemedText type="default">Self-Employment Tax</ThemedText>
                <ThemedText type="default">{formatCurrency(taxEstimate.selfEmploymentTaxCents, 'USD')}</ThemedText>
              </View>
              <View style={styles.taxRow}>
                <ThemedText type="default">Federal Income Tax</ThemedText>
                <ThemedText type="default">{formatCurrency(taxEstimate.federalIncomeTaxCents, 'USD')}</ThemedText>
              </View>
              {taxEstimate.stateIncomeTaxCents > 0 && (
                <View style={styles.taxRow}>
                  <ThemedText type="default">State Income Tax</ThemedText>
                  <ThemedText type="default">{formatCurrency(taxEstimate.stateIncomeTaxCents, 'USD')}</ThemedText>
                </View>
              )}
              <View style={[styles.taxRowTotal, { borderTopColor: colors.divider }]}>
                <ThemedText type="callout" style={{ fontWeight: '700' }}>Total Estimated Tax</ThemedText>
                <ThemedText type="headline" style={{ color: colors.warning }}>
                  {formatCurrency(taxEstimate.totalEstimatedTaxCents, 'USD')}
                </ThemedText>
              </View>
              <View style={styles.taxRow}>
                <ThemedText type="small" themeColor="textSecondary">Quarterly Payment</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatCurrency(taxEstimate.quarterlyPaymentCents, 'USD')}
                </ThemedText>
              </View>
              <View style={styles.taxRow}>
                <ThemedText type="small" themeColor="textSecondary">Effective Rate</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {taxEstimate.effectiveRate.toFixed(1)}%
                </ThemedText>
              </View>
            </View>
          )}

          {/* Monthly Breakdown */}
          {monthlyTotals.length > 0 && (
            <View style={[styles.card, { borderColor: colors.cardBorder }]}>
              <ThemedText type="callout" style={styles.sectionTitle}>Monthly Breakdown</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled>
                <View>
                  {/* Header row */}
                  <View style={[styles.monthRow, { borderBottomColor: colors.cardBorder }]}>
                    <ThemedText type="smallBold" style={styles.monthName}>Month</ThemedText>
                    <ThemedText type="smallBold" style={[styles.monthAmount, { color: colors.success }]}>Income</ThemedText>
                    <ThemedText type="smallBold" style={[styles.monthAmount, { color: colors.danger }]}>Expenses</ThemedText>
                    <ThemedText type="smallBold" style={[styles.monthAmount, { color: colors.text }]}>Net</ThemedText>
                  </View>
                  {monthlyTotals.map((m) => (
                    <View key={m.month} style={[styles.monthRow, { borderBottomColor: colors.cardBorder }]}>
                      <ThemedText type="default" style={styles.monthName}>{getMonthName(m.month)}</ThemedText>
                      <ThemedText type="small" style={[styles.monthAmount, { color: colors.success, textAlign: 'right' }]}>
                        {m.income > 0 ? `+${formatCurrency(m.income, 'USD')}` : '-'}
                      </ThemedText>
                      <ThemedText type="small" style={[styles.monthAmount, { color: colors.danger, textAlign: 'right' }]}>
                        {m.expenses > 0 ? `-${formatCurrency(m.expenses, 'USD')}` : '-'}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={[styles.monthAmount, { color: m.net >= 0 ? colors.success : colors.danger, fontWeight: '600', textAlign: 'right' }]}>
                        {formatCurrency(m.net, 'USD')}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Export Buttons */}
          <View style={styles.exportSection}>
            <ThemedText type="callout" style={styles.sectionTitle}>Export Data</ThemedText>

            <Pressable onPress={exportCSV} style={[styles.exportBtn, { backgroundColor: colors.primary }]}>
              <ThemedText type="default" style={{ color: colors.primaryText, fontWeight: '600' }}>
                Export All Transactions (CSV)
              </ThemedText>
              <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Compatible with Excel, Google Sheets, accounting software
              </ThemedText>
            </Pressable>

            <Pressable onPress={exportScheduleC} style={[styles.exportBtnSecondary, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <ThemedText type="default" style={{ fontWeight: '600' }}>
                Schedule C Summary
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Net profit, expense breakdown, and tax estimate
              </ThemedText>
            </Pressable>
          </View>

          <View style={{ height: BottomTabInset + Spacing.six }} />
        </ScrollView>
      </SafeAreaView>
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
    alignSelf: 'center',
    width: '100%',
    gap: Spacing.three,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    gap: Spacing.two,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  summaryItem: {
    flex: 1,
    gap: Spacing.half,
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  taxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.half,
  },
  taxRowTotal: {
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  monthName: {
    width: 70,
    fontWeight: '600',
  },
  monthAmount: {
    width: 100,
    textAlign: 'right',
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
    borderWidth: 1,
  },
});
