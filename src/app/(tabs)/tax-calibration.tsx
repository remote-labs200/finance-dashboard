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

export default function TaxCalibrationScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const theme = useTheme();

  const [stateRate, setStateRate] = useState('0');
  const [priorYearTax, setPriorYearTax] = useState('0');
  const [currentQuarter, setCurrentQuarter] = useState('1');
  const [safeHarbor, setSafeHarbor] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getPreference(db, user.id, 'calibration_state_rate'),
      getPreference(db, user.id, 'calibration_prior_year_tax'),
      getPreference(db, user.id, 'calibration_current_quarter'),
      getPreference(db, user.id, 'calibration_safe_harbor'),
    ]).then(([rate, prior, quarter, harbor]) => {
      setStateRate(rate || '0');
      setPriorYearTax(prior || '0');
      setCurrentQuarter(quarter || '1');
      setSafeHarbor(harbor !== 'false');
      setLoaded(true);
    });
  }, [user, db]);

  const persistStateRate = useCallback(
    (val: string) => {
      const sanitized = val.replace(/[^0-9.]/g, '');
      setStateRate(sanitized);
      if (user) setPreference(db, user.id, 'calibration_state_rate', sanitized || '0');
    },
    [user, db],
  );

  const persistPriorYear = useCallback(
    (val: string) => {
      const sanitized = val.replace(/[^0-9]/g, '');
      setPriorYearTax(sanitized);
      if (user) setPreference(db, user.id, 'calibration_prior_year_tax', sanitized || '0');
    },
    [user, db],
  );

  const persistQuarter = useCallback(
    (q: string) => {
      setCurrentQuarter(q);
      if (user) setPreference(db, user.id, 'calibration_current_quarter', q);
    },
    [user, db],
  );

  const persistSafeHarbor = useCallback(
    (val: boolean) => {
      setSafeHarbor(val);
      if (user) setPreference(db, user.id, 'calibration_safe_harbor', val ? 'true' : 'false');
    },
    [user, db],
  );

  const rateNum = parseFloat(stateRate || '0');

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
          Tax Calibration
        </ThemedText>
      </View>

      <ThemedText style={styles.description} themeColor="textSecondary">
        Fine-tune how the tax engine calculates your estimated quarterly taxes.
        These settings adjust the formula inputs for more accurate projections
        based on your specific situation.
      </ThemedText>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* State rate card */}
        <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
          <View style={styles.parameterHeader}>
            <ThemedText type="callout" style={{ fontWeight: '600' }}>
              State Income Tax Rate
            </ThemedText>
            <SymbolView
              name={{ ios: 'building.2', android: 'account_balance', web: 'account_balance' }}
              size={18}
              tintColor={theme.primary}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.parameterDesc}>
            Your effective state income tax rate as a percentage (e.g., 5 for
            5%). The tax engine applies this on top of federal estimates. Set
            to 0 if your state has no income tax.
          </ThemedText>

          <View style={styles.controlRow}>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.inputBackground }]}
              value={stateRate}
              onChangeText={persistStateRate}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={theme.placeholder}
            />
            <ThemedText type="title" style={styles.unit}>%</ThemedText>
          </View>
        </View>

        {/* Prior year tax card */}
        <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
          <View style={styles.parameterHeader}>
            <ThemedText type="callout" style={{ fontWeight: '600' }}>
              Prior Year Total Tax
            </ThemedText>
            <SymbolView
              name={{ ios: 'doc.text', android: 'description', web: 'description' }}
              size={18}
              tintColor={theme.primary}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.parameterDesc}>
            Your total tax liability from the prior year, in cents. Used for
            safe harbor calculations. The IRS safe harbor rule allows you to
            pay 100% (110% if AGI {'>'} $150K) of this amount to avoid penalties.
          </ThemedText>

          <View style={styles.controlRow}>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.inputBackground }]}
              value={priorYearTax}
              onChangeText={persistPriorYear}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={theme.placeholder}
            />
            <ThemedText type="default" themeColor="textSecondary">cents</ThemedText>
          </View>
        </View>

        {/* Current quarter card */}
        <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
          <View style={styles.parameterHeader}>
            <ThemedText type="callout" style={{ fontWeight: '600' }}>
              Current Quarter
            </ThemedText>
            <SymbolView
              name={{ ios: 'number', android: 'looks_one', web: 'looks_one' }}
              size={18}
              tintColor={theme.primary}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.parameterDesc}>
            Which quarter you're currently estimating. This affects the
            annualization of year-to-date income.
          </ThemedText>

          <View style={styles.quarterRow}>
            {['1', '2', '3', '4'].map((q) => (
              <Pressable
                key={q}
                onPress={() => persistQuarter(q)}
                style={[
                  styles.quarterBtn,
                  {
                    borderColor: currentQuarter === q ? theme.primary : theme.cardBorder,
                    backgroundColor: currentQuarter === q ? theme.primary + '15' : 'transparent',
                  },
                ]}>
                <ThemedText
                  type="default"
                  style={{
                    fontWeight: currentQuarter === q ? '700' : '400',
                    color: currentQuarter === q ? theme.primary : theme.text,
                  }}>
                  Q{q}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Safe harbor toggle card */}
        <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
          <View style={styles.parameterHeader}>
            <ThemedText type="callout" style={{ fontWeight: '600' }}>
              Safe Harbor Rule
            </ThemedText>
            <SymbolView
              name={{ ios: 'shield.checkered', android: 'shield', web: 'shield' }}
              size={18}
              tintColor={safeHarbor ? theme.primary : theme.placeholder}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.parameterDesc}>
            When enabled, the tax engine uses the lower of your calculated
            quarterly estimate or the safe harbor minimum (100%/110% of prior
            year tax). This prevents penalties even if your estimate is off.
          </ThemedText>

          <View style={styles.toggleRow}>
            <Pressable
              onPress={() => persistSafeHarbor(true)}
              style={[
                styles.toggleSide,
                safeHarbor && { backgroundColor: theme.primary + '15', borderColor: theme.primary },
              ]}>
              <ThemedText style={{ fontWeight: safeHarbor ? '600' : '400', color: safeHarbor ? theme.primary : theme.text }}>
                On
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => persistSafeHarbor(false)}
              style={[
                styles.toggleSide,
                !safeHarbor && { backgroundColor: theme.primary + '15', borderColor: theme.primary },
              ]}>
              <ThemedText style={{ fontWeight: !safeHarbor ? '600' : '400', color: !safeHarbor ? theme.primary : theme.text }}>
                Off
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Summary card */}
        <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
          <ThemedText type="callout" style={{ fontWeight: '600', marginBottom: Spacing.one }}>
            How This Affects Your Estimate
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ lineHeight: 20 }}>
            {safeHarbor
              ? 'Safe harbor is active. Your quarterly payment will be the lower of the calculated estimate or the safe harbor minimum based on your prior year tax.'
              : 'Safe harbor is disabled. Your quarterly payment is based entirely on the calculated estimate using current year income projections.'}
            {rateNum > 0
              ? ` A ${rateNum}% state rate is included in the estimate.`
              : ' No state tax is included.'}
          </ThemedText>
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
    minWidth: 100,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
  },
  unit: {
    fontSize: 24,
    fontWeight: '600',
  },
  quarterRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  quarterBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  toggleRow: {
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  toggleSide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
