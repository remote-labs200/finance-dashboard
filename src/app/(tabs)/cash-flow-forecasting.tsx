import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

// ---------------------------------------------------------------------------
// Horizon chip
// ---------------------------------------------------------------------------

function HorizonChip({
  label,
  sublabel,
  selected,
  onSelect,
}: {
  label: string;
  sublabel: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onSelect}
      style={[
        styles.horizonCard,
        {
          borderColor: selected ? theme.primary : theme.cardBorder,
          backgroundColor: selected ? `${theme.primary}08` : theme.card,
        },
      ]}>
      <View style={styles.horizonTop}>
        <ThemedText
          type="default"
          style={{
            fontWeight: '600',
            fontSize: 18,
            color: selected ? theme.primary : theme.text,
          }}>
          {label}
        </ThemedText>
        {selected && (
          <View style={[styles.checkCircle, { backgroundColor: theme.primary }]}>
            <SymbolView
              name={{ ios: 'checkmark', android: 'check', web: 'check' }}
              size={12}
              tintColor={theme.primaryText}
            />
          </View>
        )}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {sublabel}
      </ThemedText>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Mock forecast data
// ---------------------------------------------------------------------------

const FORECAST_MONTHS = [
  { month: 'Aug 2026', income: 8500, expenses: 3200, balance: 5300 },
  { month: 'Sep 2026', income: 8500, expenses: 3100, balance: 5400 },
  { month: 'Oct 2026', income: 8200, expenses: 3500, balance: 4700 },
  { month: 'Nov 2026', income: 8000, expenses: 3400, balance: 4600 },
  { month: 'Dec 2026', income: 9500, expenses: 4200, balance: 5300 },
  { month: 'Jan 2027', income: 8500, expenses: 3300, balance: 5200 },
];

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function CashFlowForecastingScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [horizon, setHorizon] = useState<3 | 6 | 12>(6);
  const [includeTaxReserve, setIncludeTaxReserve] = useState(true);
  const [includeBuffer, setIncludeBuffer] = useState(true);

  const visibleMonths = FORECAST_MONTHS.slice(0, horizon);

  const totals = visibleMonths.reduce(
    (acc, m) => ({
      income: acc.income + m.income,
      expenses: acc.expenses + m.expenses,
      net: acc.net + m.balance,
    }),
    { income: 0, expenses: 0, net: 0 },
  );

  const highestBalance = Math.max(...visibleMonths.map((m) => m.balance));
  const barUnit = highestBalance > 0 ? highestBalance / 100 : 1;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <SymbolView
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              size={20}
              tintColor={theme.primary}
            />
          </Pressable>
          <ThemedText type="title" style={styles.headerTitle}>
            Cash Flow Forecasting
          </ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Forecast horizon */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Forecast Horizon
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionSub}>
              How far ahead would you like to project your cash flow?
            </ThemedText>
            {([3, 6, 12] as const).map((h) => (
              <HorizonChip
                key={h}
                label={`${h} Months`}
                sublabel={
                  h === 3
                    ? 'Short-term view for immediate planning.'
                    : h === 6
                      ? 'Medium-term view covering two tax quarters.'
                      : 'Annual view for full fiscal year planning.'
                }
                selected={horizon === h}
                onSelect={() => setHorizon(h)}
              />
            ))}
          </View>

          {/* Assumptions */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Assumptions
            </ThemedText>
            <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
              <Pressable
                onPress={() => setIncludeTaxReserve((p) => !p)}
                style={styles.assumptionRow}>
                <SymbolView
                  name={
                    includeTaxReserve
                      ? ({ ios: 'checkmark.square.fill', android: 'check_box', web: 'check_box' } as const)
                      : ({ ios: 'square', android: 'check_box_outline_blank', web: 'check_box_outline_blank' } as const)
                  }
                  size={22}
                  tintColor={includeTaxReserve ? theme.primary : theme.placeholder}
                />
                <View style={styles.assumptionBody}>
                  <ThemedText type="default" style={{ fontWeight: '500' }}>
                    Include Tax Reserve
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Subtract estimated tax set-aside from monthly projections.
                  </ThemedText>
                </View>
              </Pressable>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />
              <Pressable
                onPress={() => setIncludeBuffer((p) => !p)}
                style={styles.assumptionRow}>
                <SymbolView
                  name={
                    includeBuffer
                      ? ({ ios: 'checkmark.square.fill', android: 'check_box', web: 'check_box' } as const)
                      : ({ ios: 'square', android: 'check_box_outline_blank', web: 'check_box_outline_blank' } as const)
                  }
                  size={22}
                  tintColor={includeBuffer ? theme.primary : theme.placeholder}
                />
                <View style={styles.assumptionBody}>
                  <ThemedText type="default" style={{ fontWeight: '500' }}>
                    Include Dry-Month Buffer
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Maintain minimum cash reserve for low-income months.
                  </ThemedText>
                </View>
              </Pressable>
            </View>
          </View>

          {/* Summary */}
          <View
            style={[
              styles.summaryCard,
              { borderColor: theme.cardBorder, backgroundColor: theme.card },
            ]}>
            <ThemedText type="callout" style={{ fontWeight: '600', marginBottom: Spacing.two }}>
              {horizon}-Month Projection
            </ThemedText>
            <View style={styles.summaryRow}>
              <ThemedText type="default" themeColor="textSecondary">
                Projected Income
              </ThemedText>
              <ThemedText type="default" style={{ fontWeight: '600', color: theme.success }}>
                ${totals.income.toLocaleString()}
              </ThemedText>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.divider }]} />
            <View style={styles.summaryRow}>
              <ThemedText type="default" themeColor="textSecondary">
                Projected Expenses
              </ThemedText>
              <ThemedText type="default" style={{ fontWeight: '600', color: theme.danger }}>
                ${totals.expenses.toLocaleString()}
              </ThemedText>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.divider }]} />
            <View style={styles.summaryRow}>
              <ThemedText type="default" themeColor="textSecondary">
                Net Cash Flow
              </ThemedText>
              <ThemedText
                type="default"
                style={{
                  fontWeight: '700',
                  fontSize: 18,
                  color: totals.net >= 0 ? theme.success : theme.danger,
                }}>
                ${totals.net.toLocaleString()}
              </ThemedText>
            </View>
          </View>

          {/* Visual bar chart */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Monthly Breakdown
            </ThemedText>
            {visibleMonths.map((m) => {
              const barHeight = Math.max((m.balance / barUnit) * 0.6, 8);
              const barColor = m.balance >= 0 ? theme.success : theme.danger;
              return (
                <View key={m.month} style={styles.barRow}>
                  <ThemedText type="small" style={styles.barLabel}>
                    {m.month}
                  </ThemedText>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: barHeight,
                          backgroundColor: barColor,
                          width: `${Math.min((m.balance / highestBalance) * 100, 100)}%`,
                        },
                      ]}
                    />
                  </View>
                  <ThemedText
                    type="small"
                    style={[styles.barValue, { color: barColor }]}>
                    ${m.balance.toLocaleString()}
                  </ThemedText>
                </View>
              );
            })}
          </View>

          {/* Info */}
          <View style={styles.infoBox}>
            <SymbolView
              name={{ ios: 'info.circle', android: 'info', web: 'info' }}
              size={16}
              tintColor={theme.primary}
            />
            <ThemedText type="small" themeColor="textSecondary" style={styles.infoText}>
              Forecasts are based on historical income and expense patterns. Actual results may vary.
            </ThemedText>
          </View>

          <View style={{ height: BottomTabInset + Spacing.six }} />
        </ScrollView>
      </SafeAreaView>
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
    flexDirection: 'row',
    alignItems: 'center',
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
    alignSelf: 'center',
    width: '100%',
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.one,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  sectionSub: {
    lineHeight: 18,
  },
  horizonCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    gap: Spacing.one,
  },
  horizonTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  card: {
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  assumptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  assumptionBody: {
    flex: 1,
    gap: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  summaryCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.half,
  },
  barLabel: {
    width: 65,
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 20,
    borderRadius: 4,
    justifyContent: 'center',
  },
  bar: {
    borderRadius: 4,
    minWidth: 4,
  },
  barValue: {
    width: 70,
    textAlign: 'right',
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, lineHeight: 18 },
});
