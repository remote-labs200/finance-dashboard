import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import NotificationBell from '@/components/notification-bell';
import { useSQLiteContext } from '@/db/provider';
import { useThemeColors } from '@/hooks/use-theme';
import { useAuthStore } from '@/stores/use-auth-store';
import {
  findTransactionsByUser,
  getMonthlySummary,
} from '@/db/transaction-repo';
import { Account, Transaction } from '@/db/schema';
import { findAccountsByUser } from '@/db/account-repo';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { formatCurrency, formatDateShort } from '@/lib/format';
import { estimateAnnualTax, daysUntilNextDeadline } from '@/lib/tax-engine';
import { computeSmoothing, aggregateMonthlyIncomes, getSmoothingSummary } from '@/lib/income-smoothing';

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const colors = useThemeColors();
 const user = useAuthStore((state) => state.user);
  const router = useRouter();

  const [netIncome, setNetIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [taxEstimate, setTaxEstimate] = useState<ReturnType<typeof estimateAnnualTax> | null>(null);
  const [smoothing, setSmoothing] = useState<ReturnType<typeof computeSmoothing> | null>(null);
  const [nextDeadline, setNextDeadline] = useState<ReturnType<typeof daysUntilNextDeadline>>(null);

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
      filingStatus: 'single',
      taxYear: year,
      currentQuarter: Math.ceil((month / 3)) as 1 | 2 | 3 | 4,
    });
    setTaxEstimate(taxResult);
    setNextDeadline(daysUntilNextDeadline());

    // Compute income smoothing
    const monthlyData = aggregateMonthlyIncomes(
      allTxns.map((t) => ({ amountCents: t.amountCents, date: t.date })),
      `${year - 1}-01`,
      `${year}-12`
    );
    if (monthlyData.length >= 2) {
      const smoothingResult = computeSmoothing({ monthlyIncomes: monthlyData });
      setSmoothing(smoothingResult);
    }
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('closed')) return;
      console.warn('loadData error:', e);
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
  const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <FlatList
          data={recentTxns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <View style={styles.headerSection}>
              <View style={styles.headerRow}>
                <ThemedText type="title">Dashboard</ThemedText>
                <NotificationBell />
              </View>
              <ThemedText type="small" themeColor="textSecondary">{monthName}</ThemedText>

              {/* Hero cards */}
              <View style={[styles.cardRow, { gap: Spacing.two }]}>
                <View style={[styles.card, styles.cardNetIncome, { borderColor: colors.cardBorder }]}>
                  <ThemedText type="small" themeColor="textSecondary">Net Income</ThemedText>
                  <ThemedText
                    type="headline"
                    style={{ color: netIncome >= 0 ? colors.success : colors.danger }}>
                    {formatCurrency(netIncome, 'USD')}
                  </ThemedText>
                </View>
                <View style={[styles.card, styles.cardExpenses, { borderColor: colors.cardBorder }]}>
                  <ThemedText type="small" themeColor="textSecondary">Expenses</ThemedText>
                  <ThemedText type="headline" style={{ color: colors.danger }}>
                    {formatCurrency(totalExpenses, 'USD')}
                  </ThemedText>
                </View>
              </View>

              <View style={[styles.cardRow, { gap: Spacing.two }]}>
                <View style={[styles.card, styles.cardBalance, { borderColor: colors.cardBorder }]}>
                  <ThemedText type="small" themeColor="textSecondary">Total Balance</ThemedText>
                  <ThemedText type="headline">
                    {formatCurrency(totalBalance, 'USD')}
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.card, styles.cardAdd, { borderColor: colors.cardBorder, backgroundColor: colors.primary + '14' }]}
                  onPress={() => router.push('/(tabs)/transaction')}>
                  <SymbolView name={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }} size={28} tintColor={colors.primary} />
                  <ThemedText type="small" themeColor="textSecondary">Add Transaction</ThemedText>
                </Pressable>
              </View>

              {/* Quick Actions */}
              <View style={styles.quickActionsSection}>
                <ThemedText type="callout" style={styles.sectionTitle}>Quick Actions</ThemedText>
                <View style={styles.quickActionsRow}>
                  {([
                    { icon: { ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }, label: 'Add', route: '/(tabs)/transaction' as const, color: colors.primary },
                    { icon: { ios: 'camera.viewfinder', android: 'photo_camera', web: 'photo_camera' }, label: 'Scan', route: '/(tabs)/(main)/scan' as const, color: colors.orange },
                    { icon: { ios: 'person.2.fill', android: 'group', web: 'group' }, label: 'Clients', route: '/(tabs)/clients' as const, color: colors.purple },
                    { icon: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }, label: 'AI Insights', route: '/(tabs)/insights' as const, color: colors.cyan },
                    { icon: { ios: 'car.fill', android: 'directions_car', web: 'directions_car' }, label: 'Mileage', route: '/(tabs)/mileage' as const, color: colors.warning },
                    { icon: { ios: 'square.and.arrow.up', android: 'ios_share', web: 'ios_share' }, label: 'Export', route: '/(tabs)/export-ledger' as const, color: colors.success },
                    { icon: { ios: 'arrow.triangle.2.circlepath', android: 'sync', web: 'sync' }, label: 'Sync', route: '/(tabs)/cloud-sync' as const, color: colors.textSecondary },
                  ] as const).map((action) => (
                    <Pressable
                      key={action.label}
                      style={styles.quickActionItem}
                      onPress={() => router.push(action.route)}>
                      <View style={[styles.quickActionCircle, { backgroundColor: action.color + '1a', borderColor: action.color + '33' }]}>
                        <SymbolView name={action.icon} size={22} tintColor={action.color} />
                      </View>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.quickActionLabel}>{action.label}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Tax Estimation Card */}
              {taxEstimate && (
                <View style={[styles.card, styles.cardTax, { borderColor: colors.warning + '33', backgroundColor: colors.warning + '14' }]}>
                  <View style={styles.cardTaxHeader}>
                    <ThemedText type="small" themeColor="textSecondary">Quarterly Tax Estimate</ThemedText>
                    {nextDeadline && (
                      <View style={[styles.deadlineBadge, { backgroundColor: colors.warning + '26' }]}>
                        <ThemedText type="small" style={{ color: nextDeadline.daysRemaining <= 30 ? colors.danger : colors.warning }}>
                          {nextDeadline.daysRemaining}d left
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  <ThemedText type="headline" style={{ color: colors.warning }}>
                    {formatCurrency(taxEstimate.quarterlyPaymentCents, 'USD')}
                  </ThemedText>
                  <View style={styles.taxBreakdown}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Effective rate: {taxEstimate.effectiveRate.toFixed(1)}%
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      SE Tax: {formatCurrency(taxEstimate.selfEmploymentTaxCents, 'USD')}
                    </ThemedText>
                  </View>
                </View>
              )}

              {/* Income Smoothing Card */}
              {smoothing && smoothing.safePayCents > 0 && (
                <View style={[styles.card, styles.cardSmoothing, { borderColor: colors.success + '33', backgroundColor: colors.success + '14' }]}>
                  <ThemedText type="small" themeColor="textSecondary">Safe Monthly Pay</ThemedText>
                  <ThemedText type="headline" style={{ color: colors.success }}>
                    {formatCurrency(smoothing.safePayCents, 'USD')}
                  </ThemedText>
                  <View style={styles.taxBreakdown}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Volatility: {smoothing.volatilityPercent}%
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Buffer needed: {formatCurrency(smoothing.bufferRequiredCents, 'USD')}
                    </ThemedText>
                  </View>
                  {smoothing.dryMonths.length > 0 && (
                    <View style={[styles.dryMonthWarning, { backgroundColor: colors.warning + '1a' }]}>
                      <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={14} tintColor={colors.warning} />
                      <ThemedText type="small" style={{ color: colors.warning }}>
                        {smoothing.dryMonths.length} dry month{smoothing.dryMonths.length > 1 ? 's' : ''} detected
                      </ThemedText>
                    </View>
                  )}
                </View>
              )}

              {/* AI Insights Card */}
              <Pressable
                style={[styles.card, styles.cardInsights, { borderColor: colors.primary + '33', backgroundColor: colors.primary + '14' }]}
                onPress={() => router.push('/(tabs)/insights')}>
                <View style={styles.cardInsightsRow}>
                  <SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} size={20} tintColor={colors.primary} />
                  <ThemedText type="callout" style={{ fontWeight: '600' }}>AI Insights</ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  Ask questions about your finances in natural language
                </ThemedText>
              </Pressable>

              {/* Client Ledger Card */}
              <Pressable
                style={[styles.card, styles.cardClients, { borderColor: colors.purple + '33', backgroundColor: colors.purple + '14' }]}
                onPress={() => router.push('/(tabs)/clients')}>
                <View style={styles.cardInsightsRow}>
                  <SymbolView name={{ ios: 'person.2.fill', android: 'group', web: 'group' }} size={20} tintColor={colors.purple} />
                  <ThemedText type="callout" style={{ fontWeight: '600' }}>Client Ledger</ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  Track invoices and payments per client
                </ThemedText>
              </Pressable>

              {/* Mileage Tracker Card */}
              <Pressable
                style={[styles.card, styles.cardMileage, { borderColor: colors.orange + '33', backgroundColor: colors.orange + '14' }]}
                onPress={() => router.push('/(tabs)/mileage')}>
                <View style={styles.cardInsightsRow}>
                  <SymbolView name={{ ios: 'car.fill', android: 'directions_car', web: 'directions_car' }} size={20} tintColor={colors.orange} />
                  <ThemedText type="callout" style={{ fontWeight: '600' }}>Mileage Tracker</ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  Log business miles for tax deductions
                </ThemedText>
              </Pressable>

              {/* Cash Flow Forecast Card */}
              <Pressable
                style={[styles.card, styles.cardForecast, { borderColor: colors.cyan + '33', backgroundColor: colors.cyan + '14' }]}
                onPress={() => router.push('/(tabs)/forecast')}>
                <View style={styles.cardInsightsRow}>
                  <SymbolView name={{ ios: 'chart.line.uptrend.xyaxis', android: 'trending_up', web: 'trending_up' }} size={20} tintColor={colors.cyan} />
                  <ThemedText type="callout" style={{ fontWeight: '600' }}>Cash Flow Forecast</ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  AI-powered 3-month income projection
                </ThemedText>
              </Pressable>

              {/* Accounts summary */}
              {accounts.length > 0 && (
                <View style={styles.section}>
                  <ThemedText type="callout" style={styles.sectionTitle}>Accounts</ThemedText>
                  {accounts.map((acc) => (
                    <View key={acc.id} style={styles.accountRow}>
                      <View style={[styles.accountDot, { backgroundColor: acc.color ?? colors.primary }]} />
                      <ThemedText type="default" style={{ flex: 1 }}>{acc.name}</ThemedText>
                      <ThemedText type="default">{formatCurrency(acc.balanceCents, acc.currencyCode)}</ThemedText>
                    </View>
                  ))}
                </View>
              )}

              {/* Recent transactions header */}
              <View style={styles.section}>
                <ThemedText type="callout" style={styles.sectionTitle}>Recent Transactions</ThemedText>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/(tabs)/transaction', params: { id: item.id } })}
              style={({ pressed }) => [styles.txnRow, pressed && styles.txnRowPressed, { borderBottomColor: colors.divider }]}>
              <View style={styles.txnLeft}>
                <ThemedText type="default" numberOfLines={1}>
                  {item.note ?? item.categoryName ?? 'Transaction'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDateShort(item.date)}
                </ThemedText>
              </View>
              <ThemedText
                type="default"
                style={{ color: item.amountCents >= 0 ? colors.success : colors.danger }}>
                {item.amountCents >= 0 ? '+' : ''}{formatCurrency(item.amountCents, item.currencyCode)}
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
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  headerSection: {
    gap: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  cardRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  card: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    gap: Spacing.one,
  },
  cardNetIncome: {},
  cardExpenses: {},
  cardBalance: {},
  cardAdd: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTax: {},
  cardTaxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deadlineBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.two,
  },
  taxBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardSmoothing: {},
  dryMonthWarning: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '600',
  },
  cardInsights: {},
  cardInsightsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  cardClients: {},
  cardMileage: {},
  cardForecast: {},
  quickActionsSection: {
    gap: Spacing.two,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionItem: {
    alignItems: 'center',
    gap: 4,
    minWidth: 48,
  },
  quickActionCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 10,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.one,
    gap: Spacing.two,
  },
  accountDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  txnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  txnRowPressed: { opacity: 0.6 },
  txnLeft: { flex: 1, gap: 2 },
  empty: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
});
