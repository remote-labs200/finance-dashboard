import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { NeumorphicCard, NeumorphicSurface } from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BankProvider {
  id: string;
  name: string;
  logo: string; // emoji fallback
}

// ---------------------------------------------------------------------------
// Bank Row
// ---------------------------------------------------------------------------

function BankRow({ provider }: { provider: BankProvider }) {
  const theme = useTheme();

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
        </View>
        <View
          style={[
            styles.badge,
            { backgroundColor: `${theme.warning}18` },
          ]}
        >
          <ThemedText
            type="small"
            style={{ color: theme.warning, fontWeight: "600" }}
          >
            Coming soon
          </ThemedText>
        </View>
      </View>
    </NeumorphicCard>
  );
}

// ---------------------------------------------------------------------------
// Static catalog of supported providers (no connections are real yet)
// ---------------------------------------------------------------------------
const BANK_CATALOG: BankProvider[] = [
  { id: "plaid", name: "Plaid", logo: "🏦" },
  { id: "teller", name: "Teller", logo: "🏛️" },
  { id: "yodlee", name: "Yodlee / Finicity", logo: "📊" },
  { id: "salt-edge", name: "Salt Edge", logo: "🧂" },
  { id: "gocardless", name: "GoCardless", logo: "💳" },
  { id: "open-banking-uk", name: "Open Banking (UK/EU)", logo: "🇪🇺" },
];

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function BankConnectionsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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
          {/* Coming soon banner */}
          <NeumorphicCard style={[styles.summaryCard, styles.soonCard]}>
            <SymbolView
              name={{
                ios: "hammer.fill",
                android: "construction",
                web: "construction",
              }}
              size={28}
              tintColor={theme.warning}
            />
            <View style={styles.summaryBody}>
              <ThemedText type="default" style={{ fontWeight: "600" }}>
                Coming soon
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Bank connections are not available yet. This screen previews
                the providers we plan to support.
              </ThemedText>
            </View>
          </NeumorphicCard>

          {/* Provider cards */}
          {BANK_CATALOG.map((provider) => (
            <BankRow key={provider.id} provider={provider} />
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
              No bank data is fetched yet. Real connections require OAuth 2.0
              and API keys from each provider, which will ship in a future
              release.
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
  soonCard: {
    borderWidth: 1,
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
  badge: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.two,
  },
  infoBox: {
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.three,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, lineHeight: 18 },
});
