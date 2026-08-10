import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  NeumorphicButton,
  NeumorphicCard,
  NeumorphicSurface,
} from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useSQLiteContext } from "@/db/provider";
import { bankSettings } from "@/db/settings-repo";
import { useTheme } from "@/hooks/use-theme";
import { useAuthStore } from "@/stores/use-auth-store";
import { useFocusEffect, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type BankStatus = "connected" | "disconnected" | "expired";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BankProvider {
  id: string;
  name: string;
  logo: string; // emoji fallback
  status: BankStatus;
  lastSync: string | null;
}

// Key helpers for app_settings (composite id = user_id_key)
const keyFor = (id: string) => `bank_${id}`;
const statusKeyFor = (id: string) => `${keyFor(id)}_status`;
const lastSyncKeyFor = (id: string) => `${keyFor(id)}_last_sync`;

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
// Static catalog of supported providers (connection state comes from app_settings)
const BANK_CATALOG: Omit<BankProvider, "status" | "lastSync">[] = [
  { id: "plaid", name: "Plaid", logo: "🏦" },
  { id: "teller", name: "Teller", logo: "🏛️" },
  { id: "yodlee", name: "Yodlee / Finicity", logo: "📊" },
  { id: "salt-edge", name: "Salt Edge", logo: "🧂" },
  { id: "gocardless", name: "GoCardless", logo: "💳" },
  { id: "open-banking-uk", name: "Open Banking (UK/EU)", logo: "🇪🇺" },
];

const DEFAULT_PROVIDERS: BankProvider[] = BANK_CATALOG.map((p) => ({
  ...p,
  status: "disconnected",
  lastSync: null,
}));

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function BankConnectionsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const user = useAuthStore((s) => s.user);
  const [providers, setProviders] = useState<BankProvider[]>(DEFAULT_PROVIDERS);
  const [loaded, setLoaded] = useState(false);

  // Load persisted provider state from app_settings
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let active = true;
      (async () => {
        try {
          const settings = await bankSettings.getAll(db, user.id);
          if (!active) return;
          setProviders((prev) =>
            prev.map((p) => {
              const raw = settings[statusKeyFor(p.id)];
              const status: BankStatus =
                raw === "connected" || raw === "expired"
                  ? raw
                  : raw === "disconnected"
                    ? "disconnected"
                    : "disconnected";
              return {
                ...p,
                status,
                lastSync: settings[lastSyncKeyFor(p.id)] ?? null,
              };
            }),
          );
          setLoaded(true);
        } catch (e: unknown) {
          if (e instanceof Error && e.message.includes("closed")) return;
          console.warn("Failed to load bank connections:", e);
        }
      })();
      return () => {
        active = false;
      };
    }, [db, user]),
  );

  // Persist a single provider's state to app_settings
  const persistProvider = useCallback(
    async (id: string, status: BankStatus, lastSync: string | null) => {
      if (!user) return;
      try {
        await bankSettings.set(db, user.id, statusKeyFor(id), status);
        await bankSettings.set(db, user.id, lastSyncKeyFor(id), lastSync ?? "");
        setProviders((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status, lastSync } : p)),
        );
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes("closed")) return;
        console.warn("Failed to save bank connection:", e);
      }
    },
    [db, user],
  );

  const handleConnect = useCallback(
    (id: string) => {
      const name = providers.find((p) => p.id === id)?.name ?? id;
      Alert.alert(
        "Connect Bank",
        `This will open the OAuth 2.0 flow for ${name}. A real connection requires an API key from the provider and is configured in a future release.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Connect",
            onPress: () => {
              const now = new Date();
              persistProvider(
                id,
                "connected",
                now.toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }),
              );
            },
          },
        ],
      );
    },
    [providers, persistProvider],
  );

  const handleDisconnect = useCallback(
    (id: string) => {
      Alert.alert(
        "Disconnect Bank",
        "Are you sure? This will remove the linked bank account.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disconnect",
            style: "destructive",
            onPress: () => {
              persistProvider(id, "disconnected", null);
            },
          },
        ],
      );
    },
    [persistProvider],
  );

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
