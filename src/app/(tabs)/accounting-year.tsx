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

const YEAR_TYPES = [
  { value: 'calendar', label: 'Calendar Year (Jan\u2013Dec)' },
  { value: 'fiscal', label: 'Fiscal Year' },
] as const;

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AccountingYearScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const theme = useTheme();

  const [yearType, setYearType] = useState<string>('calendar');
  const [startMonth, setStartMonth] = useState<string>('1');
  const [startDay, setStartDay] = useState<string>('1');
  const [saving, setSaving] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const [fyType, fyMonth, fyDay] = await Promise.all([
        getPreference(db, user.id, 'fy_type'),
        getPreference(db, user.id, 'fy_start_month'),
        getPreference(db, user.id, 'fy_start_day'),
      ]);

      if (!cancelled) {
        setYearType(fyType || 'calendar');
        setStartMonth(fyMonth || '1');
        setStartDay(fyDay || '1');
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
        setPreference(db, user.id, 'fy_type', yearType),
        setPreference(db, user.id, 'fy_start_month', startMonth),
        setPreference(db, user.id, 'fy_start_day', startDay),
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
  }, [db, user, yearType, startMonth, startDay, router]);

  // ── Render ────────────────────────────────────────────────────────────

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
                  Accounting Year
                </ThemedText>
              </View>

              {/* ── Form ───────────────────────────────────────── */}
              <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled">

                {/* Year type */}
                <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
                  <ThemedText type="callout" style={styles.fieldLabel}>
                    Accounting Year Type
                  </ThemedText>
                  <View style={styles.chipRow}>
                    {YEAR_TYPES.map((opt) => (
                      <Pressable
                        key={opt.value}
                        onPress={() => setYearType(opt.value)}
                        style={[
                          styles.chip,
                          {
                            borderColor: yearType === opt.value ? theme.primary : theme.divider,
                            backgroundColor: yearType === opt.value ? theme.primary + '15' : 'transparent',
                          },
                        ]}>
                        <ThemedText
                          type="small"
                          style={{
                            color: yearType === opt.value ? theme.primary : theme.textSecondary,
                            fontWeight: yearType === opt.value ? '600' : '400',
                          }}>
                          {opt.label}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Fiscal year start (only shown when fiscal is selected) */}
                {yearType === 'fiscal' && (
                  <>
                    <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
                      <ThemedText type="callout" style={styles.fieldLabel}>
                        Fiscal Year Start Month
                      </ThemedText>
                      <View style={styles.chipRow}>
                        {MONTHS.map((opt) => (
                          <Pressable
                            key={opt.value}
                            onPress={() => setStartMonth(opt.value)}
                            style={[
                              styles.monthChip,
                              {
                                borderColor: startMonth === opt.value ? theme.primary : theme.divider,
                                backgroundColor: startMonth === opt.value ? theme.primary + '15' : 'transparent',
                              },
                            ]}>
                            <ThemedText
                              type="small"
                              style={{
                                color: startMonth === opt.value ? theme.primary : theme.textSecondary,
                                fontWeight: startMonth === opt.value ? '600' : '400',
                              }}>
                              {opt.label}
                            </ThemedText>
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
                      <ThemedText type="callout" style={styles.fieldLabel}>
                        Fiscal Year Start Day
                      </ThemedText>
                      <View style={styles.chipRow}>
                        {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((day) => (
                          <Pressable
                            key={day}
                            onPress={() => setStartDay(day)}
                            style={[
                              styles.dayChip,
                              {
                                borderColor: startDay === day ? theme.primary : theme.divider,
                                backgroundColor: startDay === day ? theme.primary + '15' : 'transparent',
                              },
                            ]}>
                            <ThemedText
                              type="small"
                              style={{
                                color: startDay === day ? theme.primary : theme.textSecondary,
                                fontWeight: startDay === day ? '600' : '400',
                              }}>
                              {day}
                            </ThemedText>
                          </Pressable>
                        ))}
                      </View>
                      <ThemedText type="small" themeColor="textTertiary" style={{ marginTop: Spacing.half }}>
                        Day 29\u201331 default to the 1st of the next month for simplicity.
                      </ThemedText>
                    </View>
                  </>
                )}

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

  /* Fields */
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
  monthChip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  dayChip: {
    width: 36,
    height: 32,
    borderRadius: Spacing.two,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
