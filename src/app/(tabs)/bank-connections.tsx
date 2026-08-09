import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  NeumorphicButton,
  NeumorphicCard,
  NeumorphicSurface,
} from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BankProvider {
  id: string;
  name: string;
  logo: string; // emoji fallback
  status: "connected" | "disconnected" | "expired";
  lastSync: string | null;
}

// ---------------------------------------------------------------------------
// Bank Row
// ---------------------------------------------------------------------------

function BankRow({
  provider,
  onConnect,
  onDisconnect,
  onReconnect,
}: {
  provider: BankProvider;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  onReconnect: (id: string) => void;
}) {
  const theme = useTheme();

  const statusColor =
    provider.status === "connected"
      ? theme.success
      : provider.status === "expired"
        ? theme.warning
        : theme.placeholder;

  const statusLabel =
    provider.status === "connected"
      ? "Connected"
      : provider.status === "expired"
        ? "Re-auth Needed"
        : "Not Connected";

  return (
    <NeumorphicCard style={styles.bankCard}>
      <View style={styles.bankTop}>
        <NeumorphicSurface small style={styles.bankLogo}>
          <ThemedText style={{ fontSize: 28 }}>{provider.logo}</ThemedText>
        </NeumorphicSurface>
        <View style={styles.bankInfo}>
          <ThemedText type="default" style={{ fontWeight: "600" }}>
            {provider.name}
          </ThemedText>
          <View style={styles.statusRow}>
            <View
              style={[styles.statusDot, { backgroundColor: statusColor }]}
            />
            <ThemedText type="small" style={{ color: statusColor }}>
              {statusLabel}
            </ThemedText>
          </View>
        </View>
      </View>

      {provider.lastSync && (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={styles.lastSync}
        >
          Last synced: {provider.lastSync}
        </ThemedText>
      )}

      <View style={styles.actionRow}>
        {provider.status === "connected" ? (
          <NeumorphicButton
            variant="ghost"
            style={[styles.actionBtn, { borderColor: theme.danger }]}
            textStyle={{ color: theme.danger }}
            onPress={() => onDisconnect(provider.id)}
          >
            Disconnect
          </NeumorphicButton>
        ) : (
          <NeumorphicButton
            variant="secondary"
            style={[styles.actionBtn, { borderColor: theme.primary }]}
            textStyle={{ color: theme.primary }}
            onPress={() =>
              provider.status === "expired"
                ? onReconnect(provider.id)
                : onConnect(provider.id)
            }
          >
            {provider.status === "expired" ? "Reconnect" : "Connect"}
          </NeumorphicButton>
        )}
      </View>
    </NeumorphicCard>
  );
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_PROVIDERS: BankProvider[] = [
  {
    id: "plaid",
    name: "Plaid",
    logo: "🏦",
    status: "connected",
    lastSync: "Today, 09:32 AM",
  },
  {
    id: "teller",
    name: "Teller",
    logo: "🏛️",
    status: "disconnected",
    lastSync: null,
  },
  {
    id: "yodlee",
    name: "Yodlee / Finicity",
    logo: "📊",
    status: "expired",
    lastSync: "12 Jul 2026",
  },
  {
    id: "salt-edge",
    name: "Salt Edge",
    logo: "🧂",
    status: "disconnected",
    lastSync: null,
  },
  {
    id: "gocardless",
    name: "GoCardless",
    logo: "💳",
    status: "disconnected",
    lastSync: null,
  },
  {
    id: "open-banking-uk",
    name: "Open Banking (UK/EU)",
    logo: "🇪🇺",
    status: "disconnected",
    lastSync: null,
  },
];

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function BankConnectionsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [providers, setProviders] = useState(MOCK_PROVIDERS);

  const handleConnect = useCallback(
    (id: string) => {
      Alert.alert(
        "Connect Bank",
        `This will open the OAuth flow for ${
          providers.find((p) => p.id === id)?.name ?? id
        }.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Connect",
            onPress: () => {
              setProviders((prev) =>
                prev.map((p) =>
                  p.id === id
                    ? { ...p, status: "connected", lastSync: "Just now" }
                    : p,
                ),
              );
              Alert.alert("Connected", "Bank account linked successfully.");
            },
          },
        ],
      );
    },
    [providers],
  );

  const handleDisconnect = useCallback((id: string) => {
    Alert.alert(
      "Disconnect Bank",
      "Are you sure? This will remove the linked bank account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: () => {
            setProviders((prev) =>
              prev.map((p) =>
                p.id === id
                  ? { ...p, status: "disconnected", lastSync: null }
                  : p,
              ),
            );
          },
        },
      ],
    );
  }, []);

  const handleReconnect = useCallback(
    (id: string) => {
      handleConnect(id);
    },
    [handleConnect],
  );

  const connectedCount = providers.filter(
    (p) => p.status === "connected",
  ).length;

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
            Bank Connections
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
                ios: "building.2",
                android: "account_balance",
                web: "account_balance",
              }}
              size={28}
              tintColor={theme.primary}
            />
            <View style={styles.summaryBody}>
              <ThemedText type="default" style={{ fontWeight: "600" }}>
                {connectedCount} of {providers.length} providers connected
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Link your bank accounts via Open Banking or aggregator APIs to
                auto-import transactions.
              </ThemedText>
            </View>
          </NeumorphicCard>

          {/* Provider cards */}
          {providers.map((provider) => (
            <BankRow
              key={provider.id}
              provider={provider}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onReconnect={handleReconnect}
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
              Bank data feeds use secure OAuth 2.0 connections. Credentials are
              never stored on-device. Real connections require API keys from
              each provider.
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
    borderRadius: Spacing.three,
    alignItems: "center",
  },
  summaryBody: { flex: 1, gap: 2 },
  bankCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  bankTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  bankLogo: {
    width: 48,
    height: 48,
    borderRadius: Spacing.two,
    alignItems: "center",
    justifyContent: "center",
  },
  bankInfo: { flex: 1, gap: 2 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  lastSync: { marginTop: -Spacing.half },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.two,
  },
  actionBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
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
