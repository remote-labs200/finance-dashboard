import { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
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
import { findTransactionsByUser } from '@/db/transaction-repo';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

type MenuItemProps = {
  icon: React.ComponentProps<typeof SymbolView>['name'];
  label: string;
  description?: string;
  onPress: () => void;
  destructive?: boolean;
  right?: React.ReactNode;
};

function MenuItem({ icon, label, description, onPress, destructive, right }: MenuItemProps) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <SymbolView name={icon} size={22} tintColor={destructive ? theme.danger : theme.text} />
      <View style={styles.rowCenter}>
        <ThemedText type="default" style={destructive ? { color: theme.danger, fontWeight: '600' } : { fontWeight: '500' }}>
          {label}
        </ThemedText>
        {description ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {description}
          </ThemedText>
        ) : null}
      </View>
      {right ?? (
        <SymbolView
          name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          size={14}
          tintColor={theme.placeholder}
        />
      )}
    </Pressable>
  );
}

function SectionDivider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.divider }]} />;
}

export default function AccountScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const router = useRouter();
  const theme = useTheme();
  const themePreference = useThemeStore((s) => s.preference);
  const setThemePreference = useThemeStore((s) => s.setPreference);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

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

  const handleExportData = useCallback(async () => {
    if (!user) return;
    try {
      const txns = await findTransactionsByUser(db, user.id, { limit: 10000 });
      const header = 'Date,Amount,Note,Category,Account,Currency\n';
      const rows = txns
        .map((t) =>
          [
            t.date,
            (t.amountCents / 100).toFixed(2),
            `"${(t.note ?? '').replace(/"/g, '""')}"`,
            `"${(t.categoryName ?? '').replace(/"/g, '""')}"`,
            `"${(t.accountName ?? '').replace(/"/g, '""')}"`,
            t.currencyCode,
          ].join(',')
        )
        .join('\n');
      const csv = header + rows;
      await Share.share({
        message: csv,
        title: `SmoothTax Export - ${new Date().toISOString().slice(0, 10)}.csv`,
      });
    } catch (e: any) {
      if (e?.message === 'User did not share') return;
      Alert.alert('Export Error', e.message ?? 'Failed to export data.');
    }
  }, [db, user]);

  const handleHelpCenter = useCallback(() => {
    Alert.alert(
      'Help Center',
      'Need assistance with SmoothTax? Here are your options:',
      [
        {
          text: 'FAQs',
          onPress: () =>
            Alert.alert(
              'Frequently Asked Questions',
              'Q: How does tax estimation work?\nA: SmoothTax uses your marginal tax rates and income data to estimate quarterly tax obligations.\n\nQ: Is my data synced to the cloud?\nA: Yes, when Supabase is configured, your data syncs automatically.\n\nQ: How do I export my data?\nA: Go to Settings via the Account menu and tap "Export Data (CSV)".'
            ),
        },
        {
          text: 'Contact Support',
          onPress: () => {
            Linking.openURL('mailto:support@smoothtax.app').catch(() =>
              Alert.alert('Error', 'Could not open email client.')
            );
          },
        },
        { text: 'Close', style: 'cancel' },
      ]
    );
  }, []);

  const handleFeedback = useCallback(() => {
    Alert.alert('Give Feedback', 'How would you like to share your feedback?', [
      {
        text: 'Report a Bug',
        onPress: () => {
          Linking.openURL('mailto:bugs@smoothtax.app?subject=Bug Report').catch(() =>
            Alert.alert('Error', 'Could not open email client.')
          );
        },
      },
      {
        text: 'Suggest a Feature',
        onPress: () => {
          Linking.openURL('mailto:feedback@smoothtax.app?subject=Feature Request').catch(() =>
            Alert.alert('Error', 'Could not open email client.')
          );
        },
      },
      {
        text: 'Rate the App',
        onPress: () => {
          Alert.alert('Rate SmoothTax', 'Your ratings help us improve!');
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, []);

  const handlePaymentMethods = useCallback(() => {
    Alert.alert(
      'Payment Methods',
      'You have no saved payment methods yet.\n\nUpgrade to Pro and add a credit card or PayPal to manage your subscription.',
      [{ text: 'Got it', style: 'default' }]
    );
  }, []);

  const handleManageSubscription = useCallback(() => {
    Alert.alert(
      'Subscription & Billing',
      'You\'re currently on the Free Plan.\n\n\u2022 Unlimited transactions\n\u2022 Up to 5 accounts\n\u2022 Basic tax estimates\n\nUpgrade to Pro for $4.99/month to unlock AI insights, receipt OCR, unlimited accounts, and priority cloud sync.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upgrade to Pro',
          onPress: () =>
            Alert.alert('Coming Soon', 'Pro subscription will be available in a future update.'),
        },
      ]
    );
  }, []);

  const userInitial = (user?.email ?? '?').charAt(0).toUpperCase();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header */}
          <ThemedText type="title">Account</ThemedText>

          {/* Profile Card */}
          <View style={[styles.profileCard, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <ThemedText style={{ color: theme.primaryText, fontSize: 24, fontWeight: '700' }}>
                {userInitial}
              </ThemedText>
            </View>
            <View style={styles.profileInfo}>
              <ThemedText type="default" style={{ fontWeight: '600', fontSize: 17 }}>
                {user?.email?.split('@')[0] ?? 'User'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {user?.email ?? 'Not signed in'}
              </ThemedText>
            </View>
          </View>

          {/* Section: Settings & Preferences */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Settings &amp; Preferences
            </ThemedText>
            <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
              <MenuItem
                icon={{ ios: 'gearshape', android: 'settings', web: 'settings' }}
                label="All Settings"
                description="App configuration, accounts, categories, and more"
                onPress={() => router.push('/(tabs)/(main)/settings')}
              />

              <SectionDivider />

              {/* Theme Picker (inline) */}
              <View style={styles.row}>
                <SymbolView name={{ ios: 'paintpalette', android: 'palette', web: 'palette' }} size={22} tintColor={theme.text} />
                <View style={styles.rowCenter}>
                  <ThemedText type="default" style={{ fontWeight: '500' }}>
                    Appearance
                  </ThemedText>
                </View>
              </View>
              <View style={styles.themePicker}>
                {THEME_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => setThemePreference(opt.value)}
                    style={[
                      styles.themeOption,
                      { borderColor: theme.inputBorder, backgroundColor: theme.inputBackground },
                      themePreference === opt.value && {
                        borderColor: theme.primary,
                        backgroundColor: `${theme.primary}15`,
                      },
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

              <SectionDivider />

              <MenuItem
                icon={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
                label="Notifications"
                description="Push alerts, payment reminders, and tax deadlines"
                right={
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={setNotificationsEnabled}
                    trackColor={{ false: theme.inputBorder, true: theme.primary }}
                  />
                }
                onPress={() => setNotificationsEnabled((v) => !v)}
              />

              <SectionDivider />

              <MenuItem
                icon={{ ios: 'cloud', android: 'cloud', web: 'cloud' }}
                label="Cloud Sync"
                description="Manage sync status and conflict resolution"
                onPress={() => router.push('/(tabs)/cloud-sync')}
              />

              <SectionDivider />

              <MenuItem
                icon={{ ios: 'dollarsign.circle', android: 'attach_money', web: 'attach_money' }}
                label="Default Currency"
                description="Set your preferred currency for transactions"
                onPress={() => router.push('/(tabs)/currency-settings')}
              />
            </View>
          </View>

          {/* Section: Subscription & Billing */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Subscription &amp; Billing
            </ThemedText>
            <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
              <MenuItem
                icon={{ ios: 'crown', android: 'star', web: 'star' }}
                label="Subscription Plan"
                description="Free Plan \u2014 Upgrade to unlock premium features"
                onPress={handleManageSubscription}
              />

              <SectionDivider />

              <MenuItem
                icon={{ ios: 'creditcard', android: 'credit_card', web: 'credit_card' }}
                label="Payment Methods"
                description="Manage saved cards and billing details"
                onPress={handlePaymentMethods}
              />
            </View>
          </View>

          {/* Section: Support */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Support
            </ThemedText>
            <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
              <MenuItem
                icon={{ ios: 'questionmark.circle', android: 'help', web: 'help' }}
                label="Help Center"
                description="FAQs, customer support, and troubleshooting"
                onPress={handleHelpCenter}
              />

              <SectionDivider />

              <MenuItem
                icon={{ ios: 'envelope', android: 'email', web: 'email' }}
                label="Give Feedback"
                description="Report bugs, suggest features, or rate the app"
                onPress={handleFeedback}
              />
            </View>
          </View>

          {/* Section: Data */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Data
            </ThemedText>
            <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
              <MenuItem
                icon={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
                label="Export Data"
                description="Download all transactions as CSV"
                onPress={handleExportData}
              />
            </View>
          </View>

          {/* Sign Out */}
          <Pressable
            onPress={handleSignOut}
            style={[styles.signOutBtn, { borderColor: theme.danger }]}>
            <SymbolView name={{ ios: 'arrow.backward.circle', android: 'logout', web: 'logout' }} size={20} tintColor={theme.danger} />
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
  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: 1,
    gap: Spacing.three,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  // Section
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
    alignItems: 'center',
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  rowCenter: {
    flex: 1,
    gap: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 22 + Spacing.three, // aligns with text after icon
  },
  // Theme picker
  themePicker: {
    flexDirection: 'row',
    gap: Spacing.one,
    paddingBottom: Spacing.two,
    paddingLeft: 22 + Spacing.three, // aligns with content after icon
  },
  themeOption: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    alignItems: 'center',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  appInfo: {
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.three,
  },
});
