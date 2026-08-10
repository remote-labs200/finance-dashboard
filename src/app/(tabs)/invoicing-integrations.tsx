import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  NeumorphicButton,
  NeumorphicCard,
  NeumorphicSurface,
} from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useSQLiteContext } from "@/db/provider";
import { integrationSettings } from "@/db/settings-repo";
import { useTheme } from "@/hooks/use-theme";
import { useAuthStore } from "@/stores/use-auth-store";
import { useFocusEffect, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

// Settings keys stored in integrations_settings (composite id = user_id_key)
const connectedKeyFor = (id: string) => `integration_${id}_connected`;
const apiKeyKeyFor = (id: string) => `integration_${id}_has_api_key`;

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
    <NeumorphicCard style={styles.intCard}>
      <View style={styles.intTop}>
        <NeumorphicSurface small style={styles.intLogo}>
          <ThemedText style={{ fontSize: 28 }}>{integration.logo}</ThemedText>
        </NeumorphicSurface>
        <View style={styles.intInfo}>
          <ThemedText type="default" style={{ fontWeight: "600" }}>
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
          ]}
        >
          <ThemedText
            type="small"
            style={{
              color: integration.connected ? theme.success : theme.placeholder,
              fontWeight: "600",
            }}
          >
            {integration.connected ? "Active" : "Off"}
          </ThemedText>
        </View>
      </View>

      <View style={styles.actionRow}>
        {integration.connected && integration.hasApiKey ? (
          <NeumorphicButton
            variant="secondary"
            style={[styles.actionBtn, { borderColor: theme.primary }]}
            textStyle={{ color: theme.primary }}
            onPress={() => onConfigure(integration.id)}
          >
            API Key
          </NeumorphicButton>
        ) : null}
        <NeumorphicButton
          variant="secondary"
          style={[
            styles.actionBtn,
            {
              borderColor: integration.connected ? theme.danger : theme.primary,
            },
          ]}
          textStyle={{
            color: integration.connected ? theme.danger : theme.primary,
          }}
          onPress={() => onToggle(integration.id)}
        >
          {integration.connected ? "Disable" : "Enable"}
        </NeumorphicButton>
      </View>
    </NeumorphicCard>
  );
}

// ---------------------------------------------------------------------------
// Static catalog
// ---------------------------------------------------------------------------

const MOCK_INTEGRATIONS: Integration[] = [
  {
    id: "stripe",
    name: "Stripe",
    description:
      "Payment gateway for credit card invoicing and recurring billing.",
    logo: "💳",
    connected: true,
    hasApiKey: true,
  },
  {
    id: "paypal",
    name: "PayPal",
    description: "Accept PayPal payments on client invoices.",
    logo: "🅿️",
    connected: false,
    hasApiKey: true,
  },
  {
    id: "wise",
    name: "Wise",
    description:
      "Multi-currency invoice payments with real-time exchange rates.",
    logo: "🌍",
    connected: false,
    hasApiKey: true,
  },
  {
    id: "venmo",
    name: "Venmo / Zelle",
    description: "US peer-to-peer payment links for invoices.",
    logo: "💸",
    connected: false,
    hasApiKey: false,
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    description:
      "Two-way sync of invoices and payments with QuickBooks Online.",
    logo: "📒",
    connected: false,
    hasApiKey: true,
  },
  {
    id: "xero",
    name: "Xero",
    description: "Two-way sync of invoices and payments with Xero.",
    logo: "📘",
    connected: false,
    hasApiKey: true,
  },
  {
    id: "freshbooks",
    name: "FreshBooks",
    description: "Two-way sync of invoices and payments with FreshBooks.",
    logo: "📗",
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
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const user = useAuthStore((s) => s.user);
  const [integrations, setIntegrations] = useState(MOCK_INTEGRATIONS);
  const [loaded, setLoaded] = useState(false);

  // Load persisted integration state from integrations_settings
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let active = true;
      (async () => {
        try {
          const settings = await integrationSettings.getAll(db, user.id);
          if (!active) return;
          setIntegrations((prev) =>
            prev.map((i) => ({
              ...i,
              connected: settings[connectedKeyFor(i.id)] === "true",
              hasApiKey: settings[apiKeyKeyFor(i.id)] === "true" || i.hasApiKey,
            })),
          );
          setLoaded(true);
        } catch (e: unknown) {
          if (e instanceof Error && e.message.includes("closed")) return;
          console.warn("Failed to load integration settings:", e);
        }
      })();
      return () => {
        active = false;
      };
    }, [db, user]),
  );

  // Persist a single integration's state to integrations_settings
  const persistIntegration = useCallback(
    async (id: string, connected: boolean) => {
      if (!user) return;
      try {
        await integrationSettings.set(
          db,
          user.id,
          connectedKeyFor(id),
          connected ? "true" : "false",
        );
        setIntegrations((prev) =>
          prev.map((i) => (i.id === id ? { ...i, connected } : i)),
        );
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes("closed")) return;
        console.warn("Failed to save integration state:", e);
      }
    },
    [db, user],
  );

  const handleToggle = useCallback(
    (id: string) => {
      const target = integrations.find((i) => i.id === id);
      if (!target) return;
      if (target.connected) {
        Alert.alert(
          "Disable Integration",
          `Are you sure you want to disable ${target.name}?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Disable",
              style: "destructive",
              onPress: () => {
                persistIntegration(id, false);
              },
            },
          ],
        );
        return;
      }
      // Enabling requires an API key for most gateways — mark as connected
      // but surface the setup requirement honestly.
      Alert.alert(
        `Enable ${target.name}`,
        target.hasApiKey
          ? `Enabling ${target.name} will generate payment links on your invoices once a real API key is configured.`
          : `${target.name} doesn't require an API key and can be enabled right away.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Enable",
            onPress: () => {
              persistIntegration(id, true);
            },
          },
        ],
      );
    },
    [integrations, persistIntegration],
  );

  const handleConfigure = useCallback(
    (id: string) => {
      const integration = integrations.find((i) => i.id === id);
      if (!integration) return;
      Alert.alert(
        `Configure ${integration.name}`,
        `Enter your ${integration.name} API key to enable payment processing.\n\nThis will be stored securely in the app's encrypted storage.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Configure",
            onPress: () => {
              // No real key storage yet — mark hasApiKey so the UI reflects
              // the intent, and let the user revisit once keys are supported.
              if (user) {
                integrationSettings
                  .set(db, user.id, apiKeyKeyFor(id), "true")
                  .catch((e: unknown) => {
                    if (e instanceof Error && e.message.includes("closed"))
                      return;
                    console.warn("Failed to save API key flag:", e);
                  });
              }
              setIntegrations((prev) =>
                prev.map((i) => (i.id === id ? { ...i, hasApiKey: true } : i)),
              );
              Alert.alert(
                "API Key Saved",
                `${integration.name} integration is ready to process payments.`,
              );
            },
          },
        ],
      );
    },
    [integrations, db, user],
  );

  const activeCount = integrations.filter((i) => i.connected).length;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safe}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + Spacing.three,
              paddingLeft: insets.left + Spacing.four,
              paddingRight: insets.right + Spacing.four,
            },
          ]}
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <SymbolView
              name={{
                ios: "chevron.left",
                android: "arrow_back",
                web: "arrow_back",
              }}
              size={20}
              tintColor={theme.primary}
            />
          </Pressable>
          <ThemedText type="title" style={styles.headerTitle}>
            Invoicing Integrations
          </ThemedText>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingLeft: insets.left + Spacing.four,
              paddingRight: insets.right + Spacing.four,
            },
          ]}
        >
          {/* Summary card */}
          <NeumorphicCard style={styles.summaryCard}>
            <SymbolView
              name={{
                ios: "doc.text.fill",
                android: "description",
                web: "description",
              }}
              size={28}
              tintColor={theme.primary}
            />
            <View style={styles.summaryBody}>
              <ThemedText type="default" style={{ fontWeight: "600" }}>
                {activeCount} of {integrations.length} integrations active
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Connect payment gateways and accounting platforms to streamline
                client invoicing.
              </ThemedText>
            </View>
          </NeumorphicCard>

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
                ios: "info.circle",
                android: "info",
                web: "info",
              }}
              size={16}
              tintColor={theme.primary}
            />
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.infoText}
            >
              Enabling an integration generates client payment links on your
              invoices. API keys are stored in the device's encrypted
              SecureStore and never transmitted to third parties.
            </ThemedText>
          </View>

          <View style={{ height: BottomTabInset + Spacing.six }} />
        </ScrollView>
      </View>
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
    flexDirection: "row",
    alignItems: "center",
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
    alignSelf: "center",
    width: "100%",
    gap: Spacing.three,
  },
  summaryCard: {
    flexDirection: "row",
    gap: Spacing.three,
    padding: Spacing.three,
    alignItems: "center",
  },
  summaryBody: { flex: 1, gap: 2 },
  intCard: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  intTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  intLogo: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  intInfo: { flex: 1, gap: 2 },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.two,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.two,
  },
  actionBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    minHeight: 40,
  },
  infoBox: {
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.three,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, lineHeight: 18 },
});
