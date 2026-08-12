import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { NeumorphicCard, NeumorphicPressable, NeumorphicSurface } from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createStripePaymentIntent } from "@/lib/payments";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Integration {
  id: string;
  name: string;
  description: string;
  logo: string;
}

// ---------------------------------------------------------------------------
// Integration Row
// ---------------------------------------------------------------------------

function IntegrationRow({ integration }: { integration: Integration }) {
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
              backgroundColor: `${theme.warning}18`,
            },
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
// Static catalog
// ---------------------------------------------------------------------------

const SUPPORTED_INTEGRATIONS: Integration[] = [
  {
    id: "stripe",
    name: "Stripe",
    description:
      "Payment gateway for credit card invoicing and recurring billing.",
    logo: "💳",
  },
  {
    id: "paypal",
    name: "PayPal",
    description: "Accept PayPal payments on client invoices.",
    logo: "🅿️",
  },
  {
    id: "wise",
    name: "Wise",
    description:
      "Multi-currency invoice payments with real-time exchange rates.",
    logo: "🌍",
  },
  {
    id: "venmo",
    name: "Venmo / Zelle",
    description: "US peer-to-peer payment links for invoices.",
    logo: "💸",
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    description:
      "Two-way sync of invoices and payments with QuickBooks Online.",
    logo: "📒",
  },
  {
    id: "xero",
    name: "Xero",
    description: "Two-way sync of invoices and payments with Xero.",
    logo: "📘",
  },
  {
    id: "freshbooks",
    name: "FreshBooks",
    description: "Two-way sync of invoices and payments with FreshBooks.",
    logo: "📗",
  },
];

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function InvoicingIntegrationsScreen() {
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
                Payment integrations are not available yet. This screen is a
                preview of the providers we plan to support.
              </ThemedText>
            </View>
          </NeumorphicCard>

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
                {SUPPORTED_INTEGRATIONS.length} integrations planned
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Payment gateways and accounting platforms we plan to support.
              </ThemedText>
            </View>
          </NeumorphicCard>

          {/* Integration cards */}
          {SUPPORTED_INTEGRATIONS.map((integration) => (
            <IntegrationRow key={integration.id} integration={integration} />
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
              No payment links or API keys are generated yet — enabling an
              integration here only previews how it will appear once real
              support ships.
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
  soonCard: {
    borderWidth: 1,
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
  infoBox: {
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.three,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, lineHeight: 18 },
});
