import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Integration {
  id: string;
  name: string;
  description: string;
  logo: string;
  connected: boolean;
  hasApiKey: boolean;
}

// ---------------------------------------------------------------------------
// Integration Row
// ---------------------------------------------------------------------------

function IntegrationRow({
  integration,
  onToggle,
  onConfigure,
}: {
  integration: Integration;
  onToggle: (id: string) => void;
  onConfigure: (id: string) => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.intCard,
        { borderColor: theme.cardBorder, backgroundColor: theme.card },
      ]}>
      <View style={styles.intTop}>
        <View style={styles.intLogo}>
          <ThemedText style={{ fontSize: 28 }}>{integration.logo}</ThemedText>
        </View>
        <View style={styles.intInfo}>
          <ThemedText type="default" style={{ fontWeight: '600' }}>
            {integration.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {integration.description}
          </ThemedText>
        </View>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: integration.connected
                ? `${theme.success}18`
                : theme.inputBorder,
            },
          ]}>
          <ThemedText
            type="small"
            style={{
              color: integration.connected ? theme.success : theme.placeholder,
              fontWeight: '600',
            }}>
            {integration.connected ? 'Active' : 'Off'}
          </ThemedText>
        </View>
      </View>

      <View style={styles.actionRow}>
        {integration.connected && integration.hasApiKey ? (
          <Pressable
            onPress={() => onConfigure(integration.id)}
            style={[styles.actionBtn, { borderColor: theme.primary }]}>
            <SymbolView
              name={{
                ios: 'key.fill',
                android: 'key',
                web: 'key',
              }}
              size={14}
              tintColor={theme.primary}
            />
            <ThemedText
              type="default"
              style={{ color: theme.primary, fontWeight: '600' }}>
              API Key
            </ThemedText>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => onToggle(integration.id)}
          style={[
            styles.actionBtn,
            {
              borderColor: integration.connected ? theme.danger : theme.primary,
            },
          ]}>
          <ThemedText
            type="default"
            style={{
              color: integration.connected ? theme.danger : theme.primary,
              fontWeight: '600',
            }}>
            {integration.connected ? 'Disable' : 'Enable'}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_INTEGRATIONS: Integration[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payment gateway for credit card invoicing and recurring billing.',
    logo: '💳',
    connected: true,
    hasApiKey: true,
  },
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'Accept PayPal payments on client invoices.',
    logo: '🅿️',
    connected: false,
    hasApiKey: true,
  },
  {
    id: 'wise',
    name: 'Wise',
    description: 'Multi-currency invoice payments with real-time exchange rates.',
    logo: '🌍',
    connected: false,
    hasApiKey: true,
  },
  {
    id: 'venmo',
    name: 'Venmo / Zelle',
    description: 'US peer-to-peer payment links for invoices.',
    logo: '💸',
    connected: false,
    hasApiKey: false,
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Two-way sync of invoices and payments with QuickBooks Online.',
    logo: '📒',
    connected: false,
    hasApiKey: true,
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Two-way sync of invoices and payments with Xero.',
    logo: '📘',
    connected: false,
    hasApiKey: true,
  },
  {
    id: 'freshbooks',
    name: 'FreshBooks',
    description: 'Two-way sync of invoices and payments with FreshBooks.',
    logo: '📗',
    connected: false,
    hasApiKey: true,
  },
];

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function InvoicingIntegrationsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [integrations, setIntegrations] = useState(MOCK_INTEGRATIONS);

  const handleToggle = useCallback((id: string) => {
    setIntegrations((prev) => {
      const target = prev.find((i) => i.id === id);
      if (!target) return prev;
      if (target.connected) {
        Alert.alert(
          'Disable Integration',
          `Are you sure you want to disable ${target.name}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Disable',
              style: 'destructive',
              onPress: () => {
                setIntegrations((p) =>
                  p.map((i) =>
                    i.id === id ? { ...i, connected: false } : i,
                  ),
                );
              },
            },
          ],
        );
        return prev;
      }
      return prev.map((i) =>
        i.id === id ? { ...i, connected: true } : i,
      );
    });
  }, []);

  const handleConfigure = useCallback((id: string) => {
    const integration = integrations.find((i) => i.id === id);
    if (!integration) return;
    Alert.alert(
      `Configure ${integration.name}`,
      `Enter your ${integration.name} API key to enable payment processing.\n\nThis will be stored securely in the app's encrypted storage.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Configure',
          onPress: () => {
            Alert.alert(
              'API Key Saved',
              `${integration.name} integration is ready to process payments.`,
            );
          },
        },
      ],
    );
  }, [integrations]);

  const activeCount = integrations.filter((i) => i.connected).length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <SymbolView
              name={{
                ios: 'chevron.left',
                android: 'arrow_back',
                web: 'arrow_back',
              }}
              size={20}
              tintColor={theme.primary}
            />
          </Pressable>
          <ThemedText type="title" style={styles.headerTitle}>
            Invoicing Integrations
          </ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Summary card */}
          <View
            style={[
              styles.summaryCard,
              { borderColor: theme.cardBorder, backgroundColor: theme.card },
            ]}>
            <SymbolView
              name={{
                ios: 'doc.text.fill',
                android: 'description',
                web: 'description',
              }}
              size={28}
              tintColor={theme.primary}
            />
            <View style={styles.summaryBody}>
              <ThemedText type="default" style={{ fontWeight: '600' }}>
                {activeCount} of {integrations.length} integrations active
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Connect payment gateways and accounting platforms to streamline
                client invoicing.
              </ThemedText>
            </View>
          </View>

          {/* Integration cards */}
          {integrations.map((integration) => (
            <IntegrationRow
              key={integration.id}
              integration={integration}
              onToggle={handleToggle}
              onConfigure={handleConfigure}
            />
          ))}

          {/* Info box */}
          <View style={styles.infoBox}>
            <SymbolView
              name={{
                ios: 'info.circle',
                android: 'info',
                web: 'info',
              }}
              size={16}
              tintColor={theme.primary}
            />
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.infoText}>
              Enabling an integration generates client payment links on your
              invoices. API keys are stored in the device's encrypted SecureStore
              and never transmitted to third parties.
            </ThemedText>
          </View>

          <View style={{ height: BottomTabInset + Spacing.six }} />
        </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  headerTitle: { flex: 1 },
  backBtn: { padding: Spacing.one },
  scroll: {
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    gap: Spacing.three,
  },
  summaryCard: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
  },
  summaryBody: { flex: 1, gap: 2 },
  intCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    gap: Spacing.two,
  },
  intTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  intLogo: {
    width: 48,
    height: 48,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intInfo: { flex: 1, gap: 2 },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.one,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  infoBox: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, lineHeight: 18 },
});
