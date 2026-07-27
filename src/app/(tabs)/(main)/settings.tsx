import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSQLiteContext } from '@/db/provider';
import { useAuthStore } from '@/stores/use-auth-store';
import { useThemeStore, type ThemePreference } from '@/stores/use-theme-store';
import { useTheme } from '@/hooks/use-theme';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

type ModalType = 'email' | 'password' | null;

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const updateEmail = useAuthStore((state) => state.updateEmail);
  const updatePassword = useAuthStore((state) => state.updatePassword);
  const router = useRouter();
  const theme = useTheme();
  const themePreference = useThemeStore((s) => s.preference);
  const setThemePreference = useThemeStore((s) => s.setPreference);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Email form
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/sign-in');
        },
      },
    ]);
  }, [signOut, router]);

  const handleClearData = useCallback(() => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your transactions, accounts, and categories. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: async () => {
            await db.execAsync(`
              DELETE FROM transactions;
              DELETE FROM accounts;
              DELETE FROM categories;
              DELETE FROM tax_settings;
            `);
            Alert.alert('Done', 'All data has been cleared.');
          },
        },
      ]
    );
  }, [db]);

  const handleUpdateEmail = useCallback(async () => {
    if (!newEmail.trim()) {
      Alert.alert('Error', 'Please enter a new email address.');
      return;
    }
    if (!newEmail.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }
    setEmailLoading(true);
    try {
      await updateEmail(db, newEmail.trim());
      setActiveModal(null);
      setNewEmail('');
      Alert.alert('Success', 'Your email has been updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to update email.');
    } finally {
      setEmailLoading(false);
    }
  }, [db, newEmail, updateEmail]);

  const handleUpdatePassword = useCallback(async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Error', 'Please fill in all password fields.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Error', 'New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }
    setPasswordLoading(true);
    try {
      await updatePassword(db, currentPassword, newPassword);
      setActiveModal(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      Alert.alert('Success', 'Your password has been updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to update password.');
    } finally {
      setPasswordLoading(false);
    }
  }, [db, currentPassword, newPassword, confirmNewPassword, updatePassword]);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setNewEmail('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="title">Settings</ThemedText>

          {/* Profile Section */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>Account</ThemedText>
            <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
              <Pressable onPress={() => { setNewEmail(user?.email ?? ''); setActiveModal('email'); }} style={styles.row}>
                <View style={styles.rowLeft}>
                  <ThemedText type="default" style={{ fontWeight: '600' }}>Email</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {user?.email ?? 'Not signed in'}
                  </ThemedText>
                </View>
                <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={theme.placeholder} />
              </Pressable>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />
              <Pressable onPress={() => setActiveModal('password')} style={styles.row}>
                <View style={styles.rowLeft}>
                  <ThemedText type="default" style={{ fontWeight: '600' }}>Password</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Change your password
                  </ThemedText>
                </View>
                <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={theme.placeholder} />
              </Pressable>
            </View>
          </View>

          {/* Subscription */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>Subscription</ThemedText>
            <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
              <View style={styles.planHeader}>
                <View style={[styles.planBadge, { backgroundColor: theme.primary }]}>
                  <ThemedText type="small" style={{ color: theme.primaryText, fontWeight: '700' }}>FREE</ThemedText>
                </View>
                <ThemedText type="default" style={{ fontWeight: '600' }}>Free Plan</ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.one }}>
                You're on the free plan. Upgrade to Pro for advanced features.
              </ThemedText>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />
              <View style={styles.planFeatures}>
                <ThemedText type="small" style={{ color: theme.success, paddingLeft: Spacing.two }}>Unlimited transactions</ThemedText>
                <ThemedText type="small" style={{ color: theme.success, paddingLeft: Spacing.two }}>Up to 5 accounts</ThemedText>
                <ThemedText type="small" style={{ color: theme.success, paddingLeft: Spacing.two }}>Basic tax estimates</ThemedText>
                <ThemedText type="small" style={{ color: theme.placeholder, paddingLeft: Spacing.two }}>AI insights and forecasting</ThemedText>
                <ThemedText type="small" style={{ color: theme.placeholder, paddingLeft: Spacing.two }}>Receipt OCR scanning</ThemedText>
                <ThemedText type="small" style={{ color: theme.placeholder, paddingLeft: Spacing.two }}>Unlimited accounts</ThemedText>
                <ThemedText type="small" style={{ color: theme.placeholder, paddingLeft: Spacing.two }}>Priority cloud sync</ThemedText>
              </View>
              <Pressable style={[styles.upgradeBtn, { backgroundColor: theme.primary }]} onPress={() => Alert.alert('Coming Soon', 'Pro subscription will be available soon.')}>
                <ThemedText type="default" style={{ color: theme.primaryText, fontWeight: '600' }}>
                  Upgrade to Pro — $4.99/mo
                </ThemedText>
              </Pressable>
            </View>
          </View>

          {/* Tax Settings */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>Tax Configuration</ThemedText>
            <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
              <Pressable onPress={() => router.push('/(tabs)/tax-config')} style={styles.row}>
                <View style={styles.rowLeft}>
                  <ThemedText type="default">Filing Status</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Single</ThemedText>
                </View>
                <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={theme.placeholder} />
              </Pressable>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />
              <Pressable onPress={() => router.push('/(tabs)/tax-config')} style={styles.row}>
                <View style={styles.rowLeft}>
                  <ThemedText type="default">State</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">No state tax</ThemedText>
                </View>
                <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={theme.placeholder} />
              </Pressable>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />
              <Pressable onPress={() => router.push('/(tabs)/tax-config')} style={styles.row}>
                <View style={styles.rowLeft}>
                  <ThemedText type="default">Tax Year</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{new Date().getFullYear()}</ThemedText>
                </View>
                <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={theme.placeholder} />
              </Pressable>
            </View>
          </View>

          {/* Manage */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>Manage</ThemedText>
            <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
              <Pressable onPress={() => router.push('/(tabs)/accounts')} style={styles.row}>
                <View style={styles.rowLeft}>
                  <ThemedText type="default">Accounts</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Manage bank accounts and wallets</ThemedText>
                </View>
                <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={theme.placeholder} />
              </Pressable>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />
              <Pressable onPress={() => router.push('/(tabs)/categories')} style={styles.row}>
                <View style={styles.rowLeft}>
                  <ThemedText type="default">Categories</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Manage income and expense categories</ThemedText>
                </View>
                <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={theme.placeholder} />
              </Pressable>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />
              <Pressable onPress={() => router.push('/(tabs)/clients')} style={styles.row}>
                <View style={styles.rowLeft}>
                  <ThemedText type="default">Clients</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Track invoices and payments per client</ThemedText>
                </View>
                <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={theme.placeholder} />
              </Pressable>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />
              <Pressable onPress={() => router.push('/(tabs)/mileage')} style={styles.row}>
                <View style={styles.rowLeft}>
                  <ThemedText type="default">Mileage</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Log business miles for tax deductions</ThemedText>
                </View>
                <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={theme.placeholder} />
              </Pressable>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />
              <Pressable onPress={() => router.push('/(tabs)/forecast')} style={styles.row}>
                <View style={styles.rowLeft}>
                  <ThemedText type="default">Cash Flow Forecast</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">AI-powered income projections</ThemedText>
                </View>
                <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={theme.placeholder} />
              </Pressable>
            </View>
          </View>

          {/* Preferences */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>Preferences</ThemedText>
            <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
              {/* Theme Picker */}
              <View style={styles.row}>
                <ThemedText type="default">Appearance</ThemedText>
              </View>
              <View style={styles.themePicker}>
                {THEME_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => setThemePreference(opt.value)}
                    style={[
                      styles.themeOption,
                      { borderColor: theme.inputBorder, backgroundColor: theme.inputBackground },
                      themePreference === opt.value && { borderColor: theme.primary, backgroundColor: `${theme.primary}15` },
                    ]}>
                    <ThemedText
                      type="small"
                      style={{
                        color: themePreference === opt.value ? theme.primary : theme.text,
                        fontWeight: themePreference === opt.value ? '700' : '500',
                      }}>
                      {opt.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />
              <View style={styles.row}>
                <ThemedText type="default">Notifications</ThemedText>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ false: theme.inputBorder, true: theme.primary }}
                />
              </View>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />
              <Pressable onPress={() => router.push('/(tabs)/currency-settings')} style={styles.row}>
                <ThemedText type="default">Default Currency</ThemedText>
                <View style={styles.rowRight}>
                  <ThemedText type="default" themeColor="textSecondary">USD</ThemedText>
                  <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={theme.placeholder} />
                </View>
              </Pressable>
            </View>
          </View>

          {/* Sync Status */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>Cloud Sync</ThemedText>
            <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
              <Pressable onPress={() => router.push('/(tabs)/cloud-sync')} style={styles.row}>
                <View style={styles.rowLeft}>
                  <ThemedText type="default">Status</ThemedText>
                  <ThemedText type="small" style={{ color: theme.warning }}>
                    Not configured
                  </ThemedText>
                </View>
                <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={theme.placeholder} />
              </Pressable>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />
              <Pressable onPress={() => router.push('/(tabs)/cloud-sync')} style={styles.row}>
                <ThemedText type="default">Last Synced</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Never</ThemedText>
              </Pressable>
            </View>
          </View>

          {/* Data Management */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>Data</ThemedText>
            <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
              <Pressable onPress={handleClearData} style={styles.row}>
                <ThemedText type="default" style={{ color: theme.danger }}>
                  Clear All Data
                </ThemedText>
                <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={16} tintColor={theme.danger} />
              </Pressable>
            </View>
          </View>

          {/* Sign Out */}
          <Pressable onPress={handleSignOut} style={[styles.signOutBtn, { borderColor: theme.danger }]}>
            <ThemedText type="default" style={{ color: theme.danger, fontWeight: '600' }}>
              Sign Out
            </ThemedText>
          </Pressable>

          {/* App Info */}
          <View style={styles.appInfo}>
            <ThemedText type="small" themeColor="textSecondary">
              SmoothTax v1.0.0
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Built with Expo SDK 56
            </ThemedText>
          </View>

          <View style={{ height: BottomTabInset + Spacing.six }} />
        </ScrollView>
      </SafeAreaView>

      {/* Email Edit Modal */}
      <Modal visible={activeModal === 'email'} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.modalBackground }]}>
            <ThemedText type="callout" style={{ fontWeight: '700', fontSize: 18 }}>Change Email</ThemedText>
            <TextInput
              style={[styles.modalInput, { borderColor: theme.inputBorder, backgroundColor: theme.inputBackground, color: theme.text }]}
              placeholder="New email address"
              placeholderTextColor={theme.placeholder}
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={closeModal} style={styles.modalCancelBtn}>
                <ThemedText type="default">Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleUpdateEmail}
                disabled={emailLoading}
                style={[styles.modalSaveBtn, { backgroundColor: theme.primary }, emailLoading && { opacity: 0.5 }]}>
                <ThemedText type="default" style={{ color: theme.primaryText, fontWeight: '600' }}>
                  {emailLoading ? 'Saving...' : 'Save'}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Password Edit Modal */}
      <Modal visible={activeModal === 'password'} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.modalBackground }]}>
            <ThemedText type="callout" style={{ fontWeight: '700', fontSize: 18 }}>Change Password</ThemedText>
            <TextInput
              style={[styles.modalInput, { borderColor: theme.inputBorder, backgroundColor: theme.inputBackground, color: theme.text }]}
              placeholder="Current password"
              placeholderTextColor={theme.placeholder}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />
            <TextInput
              style={[styles.modalInput, { borderColor: theme.inputBorder, backgroundColor: theme.inputBackground, color: theme.text }]}
              placeholder="New password (8+ characters)"
              placeholderTextColor={theme.placeholder}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <TextInput
              style={[styles.modalInput, { borderColor: theme.inputBorder, backgroundColor: theme.inputBackground, color: theme.text }]}
              placeholder="Confirm new password"
              placeholderTextColor={theme.placeholder}
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              secureTextEntry
            />
            <View style={styles.modalActions}>
              <Pressable onPress={closeModal} style={styles.modalCancelBtn}>
                <ThemedText type="default">Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleUpdatePassword}
                disabled={passwordLoading}
                style={[styles.modalSaveBtn, { backgroundColor: theme.primary }, passwordLoading && { opacity: 0.5 }]}>
                <ThemedText type="default" style={{ color: theme.primaryText, fontWeight: '600' }}>
                  {passwordLoading ? 'Saving...' : 'Save'}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
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
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  rowLeft: {
    flex: 1,
    gap: 2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  signOutBtn: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
  },
  appInfo: {
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.three,
  },
  // Theme picker
  themePicker: {
    flexDirection: 'row',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  themeOption: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    alignItems: 'center',
  },
  // Subscription styles
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  planBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.one,
  },
  planFeatures: {
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  upgradeBtn: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    padding: Spacing.five,
    borderTopLeftRadius: Spacing.five,
    borderTopRightRadius: Spacing.five,
    gap: Spacing.three,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  modalCancelBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
  },
  modalSaveBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
  },
});
