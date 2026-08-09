import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { ImageBackground, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SplashLogo } from "@/components/splash-logo";
import { ThemedText } from "@/components/themed-text";
import { NeumorphicButton } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme";

const bgImage = require("../../../assets/images/welcome.png");

export default function WelcomeScreen() {
  const colors = useThemeColors();

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <ImageBackground source={bgImage} style={styles.bgImage}>
        <SafeAreaView style={styles.safeArea}>
          {/* Top 65% — text content overlaid on wave */}
          <View style={styles.topSection}>
            <SplashLogo
              compact
              wordmarkColor="#ffffff"
              taglineColor="rgba(255,255,255,0.8)"
            />

            <View style={styles.featuresContainer}>
              <View style={styles.featureBadge}>
                <SymbolView
                  name={{
                    ios: "checkmark.circle.fill",
                    android: "check_circle",
                    web: "check_circle",
                  }}
                  size={14}
                  tintColor="rgba(255,255,255,0.7)"
                />
                <ThemedText
                  type="small"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  Track Income &amp; Expenses
                </ThemedText>
              </View>
              <View style={styles.featureBadge}>
                <SymbolView
                  name={{
                    ios: "checkmark.circle.fill",
                    android: "check_circle",
                    web: "check_circle",
                  }}
                  size={14}
                  tintColor="rgba(255,255,255,0.7)"
                />
                <ThemedText
                  type="small"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  Quarterly Tax Estimates
                </ThemedText>
              </View>
              <View style={styles.featureBadge}>
                <SymbolView
                  name={{
                    ios: "checkmark.circle.fill",
                    android: "check_circle",
                    web: "check_circle",
                  }}
                  size={14}
                  tintColor="rgba(255,255,255,0.7)"
                />
                <ThemedText
                  type="small"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  Income Smoothing Engine
                </ThemedText>
              </View>
            </View>
          </View>

          {/* Bottom 35% — white card */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Link href="/(auth)/sign-up" asChild>
              <NeumorphicButton style={styles.primaryBtn}>
                Create Account
              </NeumorphicButton>
            </Link>

            <Link href="/(auth)/sign-in" asChild>
              <NeumorphicButton
                variant="secondary"
                textStyle={{ color: colors.textSecondary }}
                style={styles.secondaryBtn}
              >
                I already have an account
              </NeumorphicButton>
            </Link>

            <ThemedText
              type="small"
              themeColor="textTertiary"
              style={styles.footer}
            >
              PaySmooth &middot; v1.0.0
            </ThemedText>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgImage: {
    flex: 1,
    width: "100%",
  },
  safeArea: {
    flex: 1,
  },
  topSection: {
    flex: 0.65,
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
  },
  featuresContainer: {
    marginTop: Spacing.six,
    gap: Spacing.two,
  },
  featureBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  card: {
    flex: 0.35,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
    justifyContent: "center",
  },
  primaryBtn: {
    paddingVertical: Spacing.two + 2,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryBtn: {
    paddingVertical: Spacing.two + 2,
    borderRadius: 14,
    alignItems: "center",
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
  },
});
