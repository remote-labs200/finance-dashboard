import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  TextInput,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuthStore } from '@/stores/use-auth-store';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getPreference, setPreference } from '@/db/preferences-repo';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SafeMonthlyPayScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const theme = useTheme();

  const [targetPct, setTargetPct] = useState('70');
  const [bufferMonths, setBufferMonths] = useState('3');
  const [minPay, setMinPay] = useState('0');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getPreference(db, user.id, 'smoothing_target_pct'),
      getPreference(db, user.id, 'smoothing_buffer_months'),
      getPreference(db, user.id, 'smoothing_min_pay'),
    ]).then(([t, b, m]) => {
      setTargetPct(t || '70');
      setBufferMonths(b || '3');
      setMinPay(m || '0');
      setLoaded(true);
    });
  }, [user, db]);

  const persistTarget = useCallback(
    (val: string) => {
      const sanitized = val.replace(/[^0-9]/g, '').slice(0, 3);
      setTargetPct(sanitized);
      if (user) setPreference(db, user.id, 'smoothing_target_pct', sanitized || '70');
    },
    [user, db],
  );

  const persistBuffer = useCallback(
    (val: string) => {
      const sanitized = val.replace(/[^0-9]/g, '').slice(0, 2);
      setBufferMonths(sanitized);
      if (user) setPreference(db, user.id, 'smoothing_buffer_months', sanitized || '3');
    },
    [user, db],
  );

  const persistMinPay = useCallback(
    (val: string) => {
      const sanitized = val.replace(/[^0-9]/g, '');
      setMinPay(sanitized);
      if (user) setPreference(db, user.id, 'smoothing_min_pay', sanitized || '0');
    },
    [user, db],
  );

  const targetNum = parseInt(targetPct || '70', 10);
  const bufferNum = parseInt(bufferMonths || '3', 10);
  const minPayNum = parseInt(minPay || '0', 10);
  const annualPayPct = 100 - targetNum;

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={22}
            tintColor={theme.text}
          />
        </Pressable>
        <ThemedText type="title" style={styles.headerTitle}>
          Safe Monthly Pay
        </ThemedText>
      </View>

      <ThemedText style={styles.description} themeColor="textSecondary">
        Configure how the income smoothing algorithm calculates your safe
        monthly draw. This determines how much of each client payment is
        available for monthly living expenses vs. held for taxes and dry
        months.
      </ThemedText>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* Target percentage card */}
        <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
          <View style={styles.parameterHeader}>
            <ThemedText type="callout" style={{ fontWeight: '600' }}>
              Target Take-Home Rate
            </ThemedText>
            <SymbolView
              name={{ ios: 'percent', android: 'percent', web: 'percent' }}
              size={18}
              tintColor={theme.primary}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.parameterDesc}>
            Percentage of each payment you want to take home as salary. The
            remainder is held for taxes.
          </ThemedText>

          <View style={styles.controlRow}>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.inputBackground }]}
              value={targetPct}
              onChangeText={persistTarget}
              keyboardType="number-pad"
              maxLength={3}
              placeholder="70"
              placeholderTextColor={theme.placeholder}
            />
            <ThemedText type="title" style={styles.unit}>%</ThemedText>
          </View>

          {/* Visual bar */}
          <View style={styles.barOuter}>
            <View style={[styles.barFill, { width: `${targetNum}%`, backgroundColor: theme.primary }]} />
          </View>

          <View style={styles.barLabels}>
            <ThemedText type="small" themeColor="textSecondary">
              {targetNum}% take-home
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {annualPayPct}% tax reserve
            </ThemedText>
          </View>
        </View>

        {/* Buffer months card */}
        <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
          <View style={styles.parameterHeader}>
            <ThemedText type="callout" style={{ fontWeight: '600' }}>
              Dry-Month Buffer
            </ThemedText>
            <SymbolView
              name={{ ios: 'calendar.badge.clock', android: 'calendar_month', web: 'calendar_month' }}
              size={18}
              tintColor={theme.primary}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.parameterDesc}>
            How many months of expenses to keep in reserve for periods with
            no client payments.
          </ThemedText>

          <View style={styles.controlRow}>
            <Pressable
              onPress={() => persistBuffer(String(Math.max(0, bufferNum - 1)))}
              style={[styles.stepper, { borderColor: theme.cardBorder }]}>
              <SymbolView
                name={{ ios: 'minus', android: 'remove', web: 'remove' }}
                size={18}
                tintColor={theme.text}
              />
            </Pressable>
            <ThemedText type="title" style={styles.value}>
              {bufferNum}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.valueLabel}>
              {bufferNum === 1 ? 'month' : 'months'}
            </ThemedText>
            <Pressable
              onPress={() => persistBuffer(String(Math.min(12, bufferNum + 1)))}
              style={[styles.stepper, { borderColor: theme.cardBorder }]}>
              <SymbolView
                name={{ ios: 'plus', android: 'add', web: 'add' }}
                size={18}
                tintColor={theme.text}
              />
            </Pressable>
          </View>
        </View>

        {/* Minimum pay card */}
        <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
          <View style={styles.parameterHeader}>
            <ThemedText type="callout" style={{ fontWeight: '600' }}>
              Minimum Monthly Floor
            </ThemedText>
            <SymbolView
              name={{ ios: 'hand.raised', android: 'safety_check', web: 'safety_check' }}
              size={18}
              tintColor={theme.primary}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.parameterDesc}>
            A minimum monthly pay amount in cents. The algorithm will never
            suggest less than this, even during dry months. Set to 0 for no
            floor.
          </ThemedText>

          <View style={styles.controlRow}>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.inputBackground }]}
              value={minPay}
              onChangeText={persistMinPay}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={theme.placeholder}
            />
            <ThemedText type="default" themeColor="textSecondary">cents</ThemedText>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  backBtn: {
    padding: Spacing.one,
    marginRight: Spacing.one,
  },
  headerTitle: {
    flex: 1,
  },
  description: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    lineHeight: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  parameterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  parameterDesc: {
    lineHeight: 18,
    marginBottom: Spacing.three,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minWidth: 80,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
  },
  unit: {
    fontSize: 24,
    fontWeight: '600',
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'center',
  },
  valueLabel: {
    flex: 1,
  },
  stepper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barOuter: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
    marginTop: Spacing.two,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
});
