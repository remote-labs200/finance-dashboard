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
// Available currencies (subset for secondary)
// ---------------------------------------------------------------------------

interface CurrencyInfo {
  code: string;
  name: string;
  flag: string;
}

const AVAILABLE: CurrencyInfo[] = [
  { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', flag: '🇬🇧' },
  { code: 'JPY', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'CAD', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'AUD', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'CHF', name: 'Swiss Franc', flag: '🇨🇭' },
  { code: 'CNY', name: 'Chinese Yuan', flag: '🇨🇳' },
  { code: 'INR', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'BRL', name: 'Brazilian Real', flag: '🇧🇷' },
  { code: 'MXN', name: 'Mexican Peso', flag: '🇲🇽' },
  { code: 'SGD', name: 'Singapore Dollar', flag: '🇸🇬' },
  { code: 'HKD', name: 'Hong Kong Dollar', flag: '🇭🇰' },
  { code: 'NZD', name: 'New Zealand Dollar', flag: '🇳🇿' },
  { code: 'SEK', name: 'Swedish Krona', flag: '🇸🇪' },
  { code: 'KRW', name: 'South Korean Won', flag: '🇰🇷' },
  { code: 'NGN', name: 'Nigerian Naira', flag: '🇳🇬' },
  { code: 'ZAR', name: 'South African Rand', flag: '🇿🇦' },
  { code: 'AED', name: 'UAE Dirham', flag: '🇦🇪' },
  { code: 'SAR', name: 'Saudi Riyal', flag: '🇸🇦' },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SecondaryCurrenciesScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const theme = useTheme();

  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getPreference(db, user.id, 'base_currency'),
      getPreference(db, user.id, 'secondary_currencies'),
    ]).then(([base, raw]) => {
      setBaseCurrency(base || 'USD');
      if (raw) {
        setSelectedCodes(new Set(raw.split(',').filter(Boolean)));
      }
      setLoaded(true);
    });
  }, [user, db]);

  const persist = useCallback(
    (updated: Set<string>) => {
      if (!user) return;
      setSelectedCodes(updated);
      setPreference(db, user.id, 'secondary_currencies', [...updated].join(','));
    },
    [user, db],
  );

  const toggle = useCallback(
    (code: string) => {
      const next = new Set(selectedCodes);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      persist(next);
    },
    [selectedCodes, persist],
  );

  const selectAll = useCallback(() => {
    const all = new Set(AVAILABLE.map((c) => c.code));
    persist(all);
  }, [persist]);

  const clearAll = useCallback(() => {
    persist(new Set());
  }, [persist]);

  const filtered = AVAILABLE.filter((c) => c.code !== baseCurrency);

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
          Secondary Currencies
        </ThemedText>
      </View>

      <ThemedText style={styles.description} themeColor="textSecondary">
        Enable additional currencies for tracking foreign income and expenses.
        Transactions in these currencies will be converted to your base
        currency ({baseCurrency}) using exchange rates.
      </ThemedText>

      {/* Action bar */}
      {loaded && (
        <View style={styles.actionBar}>
          <Pressable onPress={selectAll} style={[styles.actionBtn, { backgroundColor: theme.cardBorder }]}>
            <ThemedText type="small" style={{ fontWeight: '600' }}>Select All</ThemedText>
          </Pressable>
          <Pressable onPress={clearAll} style={[styles.actionBtn, { backgroundColor: theme.cardBorder }]}>
            <ThemedText type="small" style={{ fontWeight: '600' }}>Clear All</ThemedText>
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary">
            {selectedCodes.size} selected
          </ThemedText>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {filtered.map((c) => {
          const isOn = selectedCodes.has(c.code);
          return (
            <Pressable
              key={c.code}
              onPress={() => toggle(c.code)}
              style={({ pressed }) => [
                styles.currencyRow,
                { borderBottomColor: theme.divider },
                pressed && { opacity: 0.6 },
              ]}>
              <ThemedText style={styles.flag}>{c.flag}</ThemedText>
              <View style={styles.currencyInfo}>
                <ThemedText type="default" style={{ fontWeight: '500' }}>
                  {c.code} — {c.name}
                </ThemedText>
              </View>
              <SymbolView
                name={
                  isOn
                    ? { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }
                    : { ios: 'circle', android: 'radio_button_unchecked', web: 'radio_button_unchecked' }
                }
                size={22}
                tintColor={isOn ? theme.primary : theme.placeholder}
              />
            </Pressable>
          );
        })}
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
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  actionBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.six,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  flag: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  currencyInfo: {
    flex: 1,
    gap: 2,
  },
});
