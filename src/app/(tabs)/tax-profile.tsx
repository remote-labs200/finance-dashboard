import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSQLiteContext } from '@/db/provider';
import { useAuthStore } from '@/stores/use-auth-store';
import { useTheme } from '@/hooks/use-theme';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { getPreference, setPreference } from '@/db/preferences-repo';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const FILING_STATUSES = [
  { value: 'single', label: 'Single' },
  { value: 'married_joint', label: 'Married (Joint)' },
  { value: 'married_separate', label: 'Married (Separate)' },
  { value: 'head_of_household', label: 'Head of Household' },
] as const;

const ENTITY_TYPES = [
  { value: 'sole_prop', label: 'Sole Proprietorship' },
  { value: 'llc', label: 'LLC' },
  { value: 's_corp', label: 'S-Corporation' },
] as const;

const LOCALES = [
  { value: 'US', label: 'United States (Federal + State)' },
  { value: 'US_CA', label: 'California' },
  { value: 'US_TX', label: 'Texas' },
  { value: 'US_NY', label: 'New York' },
  { value: 'US_FL', label: 'Florida' },
  { value: 'US_IL', label: 'Illinois' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
] as const;

interface TaxProfileFields {
  filingStatus: string;
  entityType: string;
  locale: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TaxProfileScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const theme = useTheme();

  const [fields, setFields] = useState<TaxProfileFields>({
    filingStatus: 'single',
    entityType: 'sole_prop',
    locale: 'US',
  });
  const [saving, setSaving] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const [filingStatus, entityType, locale] = await Promise.all([
        getPreference(db, user.id, 'tax_filing_status'),
        getPreference(db, user.id, 'tax_entity_type'),
        getPreference(db, user.id, 'tax_locale'),
      ]);

      if (!cancelled) {
        setFields({
          filingStatus: filingStatus || 'single',
          entityType: entityType || 'sole_prop',
          locale: locale || 'US',
        });
      }
    })();

    return () => { cancelled = true; };
  }, [db, user]);

  // ── Save ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!user) return;

    Keyboard.dismiss();
    setSaving(true);

    try {
      await Promise.all([
        setPreference(db, user.id, 'tax_filing_status', fields.filingStatus),
        setPreference(db, user.id, 'tax_entity_type', fields.entityType),
        setPreference(db, user.id, 'tax_locale', fields.locale),
      ]);

      setSaving(false);
      router.back();
    } catch (err) {
      setSaving(false);
      Alert.alert(
        'Save Failed',
        err instanceof Error ? err.message : 'An unexpected error occurred.',
      );
    }
  }, [db, user, fields, router]);

  const update = useCallback((patch: Partial<TaxProfileFields>) => {
    setFields((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Render helpers ────────────────────────────────────────────────────

  function renderSelector<T extends string>(
    label: string,
    options: readonly { value: T; label: string }[],
    selected: T,
    onSelect: (v: T) => void,
  ) {
    return (
      <View style={styles.selectorGroup}>
        <ThemedText type="callout" style={styles.fieldLabel}>{label}</ThemedText>
        <View style={styles.chipRow}>
          {options.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => onSelect(opt.value)}
              style={[
                styles.chip,
                {
                  borderColor: selected === opt.value ? theme.primary : theme.divider,
                  backgroundColor: selected === opt.value ? theme.primary + '15' : 'transparent',
                },
              ]}>
              <ThemedText
                type="small"
                style={{
                  color: selected === opt.value ? theme.primary : theme.textSecondary,
                  fontWeight: selected === opt.value ? '600' : '400',
                }}>
                {opt.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.flex}>
              {/* ── Header bar ─────────────────────────────────── */}
              <View style={styles.header}>
                <Pressable
                  onPress={() => router.back()}
                  style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
                  <SymbolView
                    name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
                    size={22}
                    tintColor={theme.primary}
                  />
                  <ThemedText type="default" style={{ color: theme.primary, fontWeight: '500' }}>
                    Account
                  </ThemedText>
                </Pressable>
                <ThemedText type="title" style={{ fontSize: 24 }}>
                  Tax Profile
                </ThemedText>
              </View>

              {/* ── Form ───────────────────────────────────────── */}
              <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled">

                {/* Filing Status */}
                <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
                  {renderSelector('Filing Status', FILING_STATUSES, fields.filingStatus as any, (v) => update({ filingStatus: v }))}
                </View>

                {/* Entity Type */}
                <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
                  {renderSelector('Entity Type', ENTITY_TYPES, fields.entityType as any, (v) => update({ entityType: v }))}
                </View>

                {/* Tax Locale */}
                <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
                  {renderSelector('Tax Jurisdiction', LOCALES, fields.locale as any, (v) => update({ locale: v }))}
                  <ThemedText type="small" themeColor="textTertiary" style={{ marginTop: Spacing.half }}>
                    Your tax jurisdiction determines the tax brackets, deduction rules, and quarterly due dates used for estimation.
                  </ThemedText>
                </View>

                {/* Spacer for tab bar */}
                <View style={{ height: BottomTabInset + Spacing.six }} />
              </ScrollView>

              {/* ── Save button ────────────────────────────────── */}
              <View style={[styles.footer, { borderTopColor: theme.divider, backgroundColor: theme.background }]}>
                <Pressable
                  onPress={handleSave}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.saveBtn, { backgroundColor: theme.primary },
                    pressed && { opacity: 0.8 },
                    saving && { opacity: 0.6 },
                  ]}>
                  <ThemedText type="default" style={{ color: theme.primaryText, fontWeight: '600' }}>
                    {saving ? 'Saving\u2026' : 'Save Changes'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
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
  flex: { flex: 1 },

  /* Header */
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    gap: Spacing.two,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },

  /* Scroll */
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    gap: Spacing.three,
  },

  /* Card */
  card: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.two,
  },

  /* Selector */
  selectorGroup: { gap: Spacing.one },
  fieldLabel: { fontWeight: '600', fontSize: 15 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },

  /* Footer */
  footer: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveBtn: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
