import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { NeumorphicCard, NeumorphicPressable } from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TermsPrivacyScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [acceptedDate] = useState<string | null>("28 Jul 2026");

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safe}>
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
            Terms &amp; Privacy
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
          {/* Acceptance status */}
          <NeumorphicCard style={styles.statusCard}>
            <SymbolView
              name={
                acceptedDate
                  ? {
                      ios: "checkmark.circle.fill",
                      android: "check_circle",
                      web: "check_circle",
                    }
                  : {
                      ios: "circle",
                      android: "radio_button_unchecked",
                      web: "radio_button_unchecked",
                    }
              }
              size={24}
              tintColor={acceptedDate ? theme.success : theme.placeholder}
            />
            <View style={styles.statusBody}>
              <ThemedText type="default" style={{ fontWeight: "500" }}>
                {acceptedDate ? "Terms Accepted" : "Not Yet Accepted"}
              </ThemedText>
              {acceptedDate && (
                <ThemedText type="small" themeColor="textSecondary">
                  Accepted on {acceptedDate}
                </ThemedText>
              )}
            </View>
          </NeumorphicCard>

          {/* Terms section */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Terms of Service
            </ThemedText>
            <NeumorphicCard style={styles.contentCard}>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.paragraph}
              >
                PaySmooth provides financial estimation and tracking tools for
                freelance professionals. The app is designed to assist with
                income smoothing, tax estimation, and expense tracking — it is
                not a replacement for professional tax advice.
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.paragraph}
              >
                By using PaySmooth, you agree that:
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.bullet}
              >
                • All financial data you enter is your responsibility.
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.bullet}
              >
                • Tax estimates are for planning purposes only and should be
                verified by a qualified tax professional.
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.bullet}
              >
                • You will not use the app for illegal activities or tax
                evasion.
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.bullet}
              >
                • The developers are not liable for financial losses arising
                from reliance on app estimates.
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.paragraph}
              >
                We reserve the right to update these terms. Continued use after
                changes constitutes acceptance.
              </ThemedText>
            </NeumorphicCard>
          </View>

          {/* Privacy section */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Privacy Policy
            </ThemedText>
            <NeumorphicCard style={styles.contentCard}>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.paragraph}
              >
                PaySmooth takes data privacy seriously. Here's how we handle
                your information:
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.bullet}
              >
                • Local Storage: Your financial data is stored on-device in an
                encrypted SQLite database. The encryption key stays on your
                device.
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.bullet}
              >
                • Cloud Backup: If you enable cloud sync, data is encrypted in
                transit (TLS 1.3) and at rest (AES-256) on Supabase
                infrastructure.
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.bullet}
              >
                • No Third-Party Sharing: We do not sell, rent, or share your
                financial data with third parties.
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.bullet}
              >
                • Analytics: Only anonymized crash and usage data is collected
                (if you opt in) to improve the app.
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.bullet}
              >
                • Data Deletion: You can delete all your data at any time from
                Settings &gt; Delete Account.
              </ThemedText>
            </NeumorphicCard>
          </View>

          {/* Links */}
          <NeumorphicCard style={styles.linksCard}>
            <NeumorphicPressable
              onPress={() => Linking.openURL("https://example.com/privacy")}
              style={styles.linkRow}
            >
              <ThemedText
                type="default"
                style={{ color: theme.primary, fontWeight: "500" }}
              >
                Full Privacy Policy
              </ThemedText>
              <SymbolView
                name={{
                  ios: "arrow.up.forward",
                  android: "open_in_new",
                  web: "open_in_new",
                }}
                size={16}
                tintColor={theme.primary}
              />
            </NeumorphicPressable>
            <View
              style={[styles.divider, { backgroundColor: theme.divider }]}
            />
            <NeumorphicPressable
              onPress={() => Linking.openURL("https://example.com/terms")}
              style={styles.linkRow}
            >
              <ThemedText
                type="default"
                style={{ color: theme.primary, fontWeight: "500" }}
              >
                Full Terms of Service
              </ThemedText>
              <SymbolView
                name={{
                  ios: "arrow.up.forward",
                  android: "open_in_new",
                  web: "open_in_new",
                }}
                size={16}
                tintColor={theme.primary}
              />
            </NeumorphicPressable>
            <View
              style={[styles.divider, { backgroundColor: theme.divider }]}
            />
            <NeumorphicPressable
              onPress={() =>
                Linking.openURL("https://example.com/cookie-policy")
              }
              style={styles.linkRow}
            >
              <ThemedText
                type="default"
                style={{ color: theme.primary, fontWeight: "500" }}
              >
                Cookie Policy
              </ThemedText>
              <SymbolView
                name={{
                  ios: "arrow.up.forward",
                  android: "open_in_new",
                  web: "open_in_new",
                }}
                size={16}
                tintColor={theme.primary}
              />
            </NeumorphicPressable>
          </NeumorphicCard>

          <View style={{ height: BottomTabInset + Spacing.six }} />
        </ScrollView>
      </View>
    </ThemedView>
  );
}

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
    paddingBottom: Spacing.three,
  },
  statusCard: {
    flexDirection: "row",
    padding: Spacing.three,
    gap: Spacing.three,
    alignItems: "center",
  },
  statusBody: { flex: 1, gap: 1 },
  section: { gap: Spacing.one },
  sectionTitle: { fontWeight: "600" },
  contentCard: {
    padding: Spacing.three,
  },
  paragraph: { lineHeight: 20, marginBottom: Spacing.two },
  bullet: {
    lineHeight: 20,
    paddingLeft: Spacing.half,
    marginBottom: Spacing.half,
  },
  linksCard: {
    paddingHorizontal: Spacing.three,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.one,
    borderRadius: 12,
  },
  divider: { height: StyleSheet.hairlineWidth },
});
