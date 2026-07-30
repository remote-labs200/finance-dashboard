import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
// Reference exchange rates (1 USD = X) for display
// ---------------------------------------------------------------------------

const REFERENCE_RATES: Record<string, number> = {
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.50,
  CAD: 1.36,
  AUD: 1.53,
  CHF: 0.88,
  CNY: 7.24,
  INR: 83.00,
  BRL: 4.95,
  MXN: 17.10,
  SGD: 1.34,
  NZD: 1.63,
  KRW: 1320.00,
  NGN: 1550.00,
  ZAR: 18.50,
  AED: 3.67,
};

type RateDisplay = {
  from: string;
  to: string;
  rate: number;
};

const PAIRS = Object.keys(REFERENCE_RATES);

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ExchangeRatesScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const theme = useTheme();

  const [base, setBase] = useState('USD');
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [intervalHrs, setIntervalHrs] = useState('24');
  const [rates, setRates] = useState<RateDisplay[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getPreference(db, user.id, 'base_currency'),
      getPreference(db, user.id, 'fx_auto_update'),
      getPreference(db, user.id, 'fx_auto_update_interval'),
    ]).then(([baseCurr, auto, interval]) => {
      const b = baseCurr || 'USD';
      setBase(b);
      setAutoUpdate(auto !== 'false');
      setIntervalHrs(interval || '24');

      // Load reference rates for display
      const allRates: RateDisplay[] = [];
      for (const code of PAIRS) {
        if (code === b) continue;
        allRates.push({ from: b, to: code, rate: REFERENCE_RATES[code] });
      }
      setRates(allRates);
      setLoaded(true);
    });
  }, [user, db]);

  const handleToggleAuto = useCallback(
    (val: boolean) => {
      if (!user) return;
      setAutoUpdate(val);
      setPreference(db, user.id, 'fx_auto_update', val ? 'true' : 'false');
    },
    [user, db],
  );

  const handleIntervalChange = useCallback(
    (val: string) => {
      if (!user) return;
      const sanitized = val.replace(/[^0-9]/g, '');
      setIntervalHrs(sanitized);
      setPreference(db, user.id, 'fx_auto_update_interval', sanitized || '24');
    },
    [user, db],
  );

  const handleOverride = useCallback(
    (code: string, val: string) => {
      if (!user) return;
      const num = parseFloat(val);
      if (isNaN(num) || num <= 0) return;
      setRates((prev) =>
        prev.map((r) => (r.to === code ? { ...r, rate: num } : r)),
      );
    },
    [user],
  );

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
          Exchange Rates
        </ThemedText>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* Auto-update toggle */}
        <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <ThemedText type="default" style={{ fontWeight: '500' }}>
                Auto-update from internet
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Fetch live rates from the FX API automatically
              </ThemedText>
            </View>
            <Switch
              value={autoUpdate}
              onValueChange={handleToggleAuto}
              trackColor={{ false: theme.placeholder, true: theme.primary }}
              thumbColor="#fff"
            />
          </View>

          {autoUpdate && (
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <ThemedText type="default" style={{ fontWeight: '500' }}>
                  Update interval
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  How often to refresh rates (hours)
                </ThemedText>
              </View>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.inputBackground },
                ]}
                value={intervalHrs}
                onChangeText={handleIntervalChange}
                keyboardType="number-pad"
                placeholder="24"
                placeholderTextColor={theme.placeholder}
              />
            </View>
          )}
        </View>

        {/* Rates list */}
        <View style={styles.sectionHeader}>
          <ThemedText type="callout" style={{ fontWeight: '600' }}>
            1 {base} =
          </ThemedText>
        </View>

        <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
          {rates.map((r, idx) => (
            <View key={r.to}>
              {idx > 0 && <View style={[styles.divider, { backgroundColor: theme.divider }]} />}
              <View style={styles.rateRow}>
                <ThemedText type="default" style={{ fontWeight: '500', minWidth: 40 }}>
                  {r.to}
                </ThemedText>
                <TextInput
                  style={[
                    styles.rateInput,
                    { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.inputBackground },
                    !autoUpdate && { borderColor: theme.primary, borderWidth: 1.5 },
                  ]}
                  value={r.rate.toFixed(4)}
                  onChangeText={(v) => handleOverride(r.to, v)}
                  keyboardType="decimal-pad"
                  editable={!autoUpdate}
                />
                {!autoUpdate && (
                  <SymbolView
                    name={{ ios: 'square.and.pencil', android: 'edit', web: 'edit' }}
                    size={16}
                    tintColor={theme.primary}
                  />
                )}
              </View>
            </View>
          ))}
        </View>

        {autoUpdate && (
          <ThemedText style={styles.hint} themeColor="textSecondary">
            Disable auto-update to manually override exchange rates.
          </ThemedText>
        )}
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
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  settingInfo: {
    flex: 1,
    gap: 2,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    minWidth: 60,
    textAlign: 'center',
    fontSize: 16,
  },
  sectionHeader: {
    paddingTop: Spacing.one,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  rateInput: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    fontSize: 15,
    textAlign: 'right',
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    paddingTop: Spacing.one,
  },
});
