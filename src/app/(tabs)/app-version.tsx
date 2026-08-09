import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  NeumorphicCard,
  NeumorphicPressable,
  NeumorphicSurface,
} from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AppVersionScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const buildInfo = [
    { label: "App Version", value: "1.0.0 (Build 1)" },
    { label: "Expo SDK", value: "56.0.0" },
    { label: "React Native", value: "0.76.9" },
    { label: "Supabase Client", value: "2.111.0" },
    { label: "Bundle Type", value: __DEV__ ? "Development" : "Production" },
    { label: "Build Date", value: "29 Jul 2026" },
    { label: "Last Updated", value: "28 Jul 2026" },
  ];

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
            App Version
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
          {/* App icon + version */}
          <NeumorphicCard style={styles.heroCard}>
            <NeumorphicSurface
              small
              style={[styles.appIcon, { backgroundColor: theme.primary }]}
            >
              <ThemedText
                style={{
                  color: theme.primaryText,
                  fontSize: 32,
                  fontWeight: "700",
                }}
              >
                ST
              </ThemedText>
            </NeumorphicSurface>
            <ThemedText
              type="default"
              style={{
                fontWeight: "600",
                fontSize: 20,
                marginTop: Spacing.two,
              }}
            >
              PaySmooth
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Version 1.0.0 (Build 1)
            </ThemedText>
          </NeumorphicCard>

          {/* Build details */}
          <NeumorphicCard style={styles.detailsCard}>
            {buildInfo.map((info, idx) => (
              <View key={info.label}>
                {idx > 0 && (
                  <View
                    style={[styles.divider, { backgroundColor: theme.divider }]}
                  />
                )}
                <View style={styles.detailRow}>
                  <ThemedText type="default" themeColor="textSecondary">
                    {info.label}
                  </ThemedText>
                  <ThemedText
                    type="default"
                    style={{ fontWeight: "500", textAlign: "right" }}
                  >
                    {info.value}
                  </ThemedText>
                </View>
              </View>
            ))}
          </NeumorphicCard>

          {/* Repository */}
          <NeumorphicCard style={styles.linksCard}>
            <NeumorphicPressable
              onPress={() =>
                Linking.openURL("https://github.com/remote-labs200/PaySmooth")
              }
              style={styles.linkRow}
            >
              <ThemedText
                type="default"
                style={{ color: theme.primary, fontWeight: "500" }}
              >
                View on GitHub
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
                Linking.openURL(
                  "https://github.com/remote-labs200/PaySmooth/releases",
                )
              }
              style={styles.linkRow}
            >
              <ThemedText
                type="default"
                style={{ color: theme.primary, fontWeight: "500" }}
              >
                Release Notes
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
                Linking.openURL(
                  "https://github.com/remote-labs200/PaySmooth/issues",
                )
              }
              style={styles.linkRow}
            >
              <ThemedText
                type="default"
                style={{ color: theme.primary, fontWeight: "500" }}
              >
                Report an Issue
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

          {/* License */}
          <NeumorphicCard style={styles.licenseCard}>
            <SymbolView
              name={{ ios: "doc.text", android: "article", web: "article" }}
              size={20}
              tintColor={theme.placeholder}
            />
            <View style={{ flex: 1, gap: 1 }}>
              <ThemedText type="default" style={{ fontWeight: "500" }}>
                MIT License
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Copyright (c) 2026 PaySmooth. See LICENSE file for full license
                text.
              </ThemedText>
            </View>
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
  heroCard: {
    alignItems: "center",
    padding: Spacing.five,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsCard: {
    paddingHorizontal: Spacing.three,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.two,
    gap: Spacing.four,
  },
  divider: { height: StyleSheet.hairlineWidth },
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
  licenseCard: {
    flexDirection: "row",
    padding: Spacing.three,
    gap: Spacing.two,
    alignItems: "center",
  },
});
