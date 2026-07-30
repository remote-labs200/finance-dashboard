import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
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
// Types
// ---------------------------------------------------------------------------

const BUSINESS_STRUCTURES = [
  { value: 'sole_prop', label: 'Sole Proprietorship' },
  { value: 'llc', label: 'LLC' },
  { value: 's_corp', label: 'S-Corporation' },
  { value: 'partnership', label: 'Partnership' },
] as const;

interface BusinessFields {
  legalName: string;
  structure: string;
  ein: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BusinessInfoScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const theme = useTheme();

  const [fields, setFields] = useState<BusinessFields>({
    legalName: '',
    structure: 'sole_prop',
    ein: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zip: '',
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // ── Load existing values ──────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const [
        legalName, structure, ein,
        addressLine1, addressLine2, city, state, zip,
      ] = await Promise.all([
        getPreference(db, user.id, 'business_legal_name'),
        getPreference(db, user.id, 'business_structure'),
        getPreference(db, user.id, 'business_ein'),
        getPreference(db, user.id, 'business_address_line1'),
        getPreference(db, user.id, 'business_address_line2'),
        getPreference(db, user.id, 'business_city'),
        getPreference(db, user.id, 'business_state'),
        getPreference(db, user.id, 'business_zip'),
      ]);

      if (!cancelled) {
        setFields({
          legalName, structure: structure || 'sole_prop',
          ein, addressLine1, addressLine2, city, state, zip,
        });
        setLoaded(true);
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
        setPreference(db, user.id, 'business_legal_name', fields.legalName.trim()),
        setPreference(db, user.id, 'business_structure', fields.structure),
        setPreference(db, user.id, 'business_ein', fields.ein.trim()),
        setPreference(db, user.id, 'business_address_line1', fields.addressLine1.trim()),
        setPreference(db, user.id, 'business_address_line2', fields.addressLine2.trim()),
        setPreference(db, user.id, 'business_city', fields.city.trim()),
        setPreference(db, user.id, 'business_state', fields.state.trim()),
        setPreference(db, user.id, 'business_zip', fields.zip.trim()),
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

  const update = useCallback((patch: Partial<BusinessFields>) => {
    setFields((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Render helpers ────────────────────────────────────────────────────

  function renderTextRow(
    label: string,
    value: string,
    onChangeText: (v: string) => void,
    opts?: { placeholder?: string; keyboardType?: 'default' | 'email-address' | 'phone-pad'; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'; last?: boolean },
  ) {
    return (
      <>
        <View style={styles.fieldGroup}>
          <ThemedText type="callout" style={styles.fieldLabel}>{label}</ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.inputBorder, backgroundColor: theme.inputBackground }]}
            placeholder={opts?.placeholder}
            placeholderTextColor={theme.placeholder}
            value={value}
            onChangeText={onChangeText}
            autoCapitalize={opts?.autoCapitalize ?? 'sentences'}
            autoCorrect={false}
            keyboardType={opts?.keyboardType ?? 'default'}
            returnKeyType="next"
          />
        </View>
        {!opts?.last && <View style={[styles.divider, { backgroundColor: theme.divider }]} />}
      </>
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
                  Business Information
                </ThemedText>
              </View>

              {/* ── Form ───────────────────────────────────────── */}
              <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled">

                {/* Legal name / structure card */}
                <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
                  {renderTextRow('Legal Business Name', fields.legalName, (v) => update({ legalName: v }), { placeholder: 'Acme Consulting LLC' })}
                  {renderTextRow('EIN / Tax ID', fields.ein, (v) => update({ ein: v }), { placeholder: 'XX-XXXXXXX', keyboardType: 'default', autoCapitalize: 'characters' })}
                </View>

                {/* Business structure picker */}
                <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
                  <ThemedText type="callout" style={styles.fieldLabel}>
                    Business Structure
                  </ThemedText>
                  <View style={styles.structureRow}>
                    {BUSINESS_STRUCTURES.map((opt) => (
                      <Pressable
                        key={opt.value}
                        onPress={() => update({ structure: opt.value })}
                        style={[
                          styles.structureChip,
                          {
                            borderColor: fields.structure === opt.value ? theme.primary : theme.divider,
                            backgroundColor: fields.structure === opt.value ? theme.primary + '15' : 'transparent',
                          },
                        ]}>
                        <ThemedText
                          type="small"
                          style={{
                            color: fields.structure === opt.value ? theme.primary : theme.textSecondary,
                            fontWeight: fields.structure === opt.value ? '600' : '400',
                          }}>
                          {opt.label}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Address card */}
                <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
                  <ThemedText type="callout" style={[styles.fieldLabel, { marginBottom: Spacing.one }]}>
                    Business Address
                  </ThemedText>
                  {renderTextRow('Address Line 1', fields.addressLine1, (v) => update({ addressLine1: v }), { placeholder: '123 Main St' })}
                  {renderTextRow('Address Line 2', fields.addressLine2, (v) => update({ addressLine2: v }), { placeholder: 'Suite 100' })}
                  {renderTextRow('City', fields.city, (v) => update({ city: v }), { placeholder: 'San Francisco' })}
                  {renderTextRow('State', fields.state, (v) => update({ state: v }), { placeholder: 'CA', autoCapitalize: 'characters' })}
                  {renderTextRow('ZIP Code', fields.zip, (v) => update({ zip: v }), { placeholder: '94105', keyboardType: 'phone-pad', last: true })}
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

  /* Field */
  fieldGroup: { gap: Spacing.one },
  fieldLabel: { fontWeight: '600', fontSize: 15 },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.OS === 'ios' ? Spacing.three : Spacing.two,
    fontSize: 16,
  },
  divider: { height: StyleSheet.hairlineWidth },

  /* Structure chips */
  structureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    paddingTop: Spacing.half,
  },
  structureChip: {
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
