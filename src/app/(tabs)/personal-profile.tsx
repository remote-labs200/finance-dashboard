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
import {
  getPreference,
  setPreference,
} from '@/db/preferences-repo';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileFields {
  firstName: string;
  lastName: string;
  businessPhone: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PersonalProfileScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const theme = useTheme();

  const [fields, setFields] = useState<ProfileFields>({
    firstName: '',
    lastName: '',
    businessPhone: '',
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // ── Load existing values ──────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const [firstName, lastName, businessPhone] = await Promise.all([
        getPreference(db, user.id, 'profile_first_name'),
        getPreference(db, user.id, 'profile_last_name'),
        getPreference(db, user.id, 'profile_business_phone'),
      ]);

      if (!cancelled) {
        setFields({ firstName, lastName, businessPhone });
        setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, user]);

  // ── Save ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!user) return;

    Keyboard.dismiss();
    setSaving(true);

    try {
      await Promise.all([
        setPreference(db, user.id, 'profile_first_name', fields.firstName.trim()),
        setPreference(db, user.id, 'profile_last_name', fields.lastName.trim()),
        setPreference(db, user.id, 'profile_business_phone', fields.businessPhone.trim()),
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

  // ── Derived ───────────────────────────────────────────────────────────

  const displayName = [fields.firstName.trim(), fields.lastName.trim()]
    .filter(Boolean)
    .join(' ')
    || (user?.email?.split('@')[0] ?? 'U');

  const userInitial = displayName.charAt(0).toUpperCase();

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
                  style={({ pressed }) => [
                    styles.backBtn,
                    pressed && { opacity: 0.6 },
                  ]}>
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
                  Personal Profile
                </ThemedText>
              </View>

              {/* ── Form ────────────────────────────────────────── */}
              <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled">

                {/* Avatar section */}
                <View style={styles.avatarSection}>
                  <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                    <ThemedText style={styles.avatarText}>
                      {userInitial}
                    </ThemedText>
                  </View>
                  <ThemedText type="default" style={{ fontWeight: '600', fontSize: 17 }}>
                    {displayName}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {user?.email ?? ''}
                  </ThemedText>
                </View>

                {/* Form card */}
                <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
                  {/* First Name */}
                  <View style={styles.fieldGroup}>
                    <ThemedText type="callout" style={styles.fieldLabel}>
                      First Name
                    </ThemedText>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          color: theme.text,
                          borderColor: theme.inputBorder,
                          backgroundColor: theme.inputBackground,
                        },
                      ]}
                      placeholder="Jane"
                      placeholderTextColor={theme.placeholder}
                      value={fields.firstName}
                      onChangeText={(text) =>
                        setFields((prev) => ({ ...prev, firstName: text }))
                      }
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="next"
                    />
                  </View>

                  <View style={[styles.divider, { backgroundColor: theme.divider }]} />

                  {/* Last Name */}
                  <View style={styles.fieldGroup}>
                    <ThemedText type="callout" style={styles.fieldLabel}>
                      Last Name
                    </ThemedText>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          color: theme.text,
                          borderColor: theme.inputBorder,
                          backgroundColor: theme.inputBackground,
                        },
                      ]}
                      placeholder="Doe"
                      placeholderTextColor={theme.placeholder}
                      value={fields.lastName}
                      onChangeText={(text) =>
                        setFields((prev) => ({ ...prev, lastName: text }))
                      }
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="next"
                    />
                  </View>

                  <View style={[styles.divider, { backgroundColor: theme.divider }]} />

                  {/* Business Phone */}
                  <View style={styles.fieldGroup}>
                    <ThemedText type="callout" style={styles.fieldLabel}>
                      Business Phone
                    </ThemedText>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          color: theme.text,
                          borderColor: theme.inputBorder,
                          backgroundColor: theme.inputBackground,
                        },
                      ]}
                      placeholder="+1 (555) 123-4567"
                      placeholderTextColor={theme.placeholder}
                      value={fields.businessPhone}
                      onChangeText={(text) =>
                        setFields((prev) => ({ ...prev, businessPhone: text }))
                      }
                      keyboardType="phone-pad"
                      returnKeyType="done"
                    />
                  </View>
                </View>

                {/* Email section (read-only) */}
                <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
                  <View style={styles.fieldGroup}>
                    <ThemedText type="callout" style={styles.fieldLabel}>
                      Email
                    </ThemedText>
                    <View
                      style={[
                        styles.emailDisplay,
                        { borderColor: theme.inputBorder, backgroundColor: theme.backgroundSelected },
                      ]}>
                      <ThemedText type="default" themeColor="textSecondary">
                        {user?.email ?? ''}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textTertiary">
                      Email changes are managed in Account Security settings.
                    </ThemedText>
                  </View>
                </View>

                {/* Spacer for tab bar */}
                <View style={{ height: BottomTabInset + Spacing.six }} />
              </ScrollView>

              {/* ── Save button (sticky footer) ──────────────────── */}
              <View
                style={[
                  styles.footer,
                  {
                    borderTopColor: theme.divider,
                    backgroundColor: theme.background,
                  },
                ]}>
                <Pressable
                  onPress={handleSave}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.saveBtn,
                    { backgroundColor: theme.primary },
                    pressed && { opacity: 0.8 },
                    saving && { opacity: 0.6 },
                  ]}>
                  <ThemedText
                    type="default"
                    style={{ color: theme.primaryText, fontWeight: '600' }}>
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

  /* Avatar */
  avatarSection: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
  },

  /* Card */
  card: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.two,
  },

  /* Field */
  fieldGroup: {
    gap: Spacing.one,
  },
  fieldLabel: {
    fontWeight: '600',
    fontSize: 15,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.OS === 'ios' ? Spacing.three : Spacing.two,
    fontSize: 16,
  },
  emailDisplay: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
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
