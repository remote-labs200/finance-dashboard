import { Link } from "expo-router";
import { ImageBackground, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SplashLogo } from "@/components/splash-logo";
import { ThemedText } from "@/components/themed-text";
import { NeumorphicButton } from "@/components/ui";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme";

export default function WelcomeScreen() {
  const colors = useThemeColors();

  return (
    <View style={styles.container}>
      {/* Top 65% — Wave background */}
      <ImageBackground
        source={require("@/assets/images/welcome.png")}
        style={styles.waveBg}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.waveSafeArea}>
          <View style={styles.waveContent}>
            <SplashLogo
              compact
              wordmarkColor="#ffffff"
              taglineColor="rgba(255,255,255,0.8)"
            />
          </View>
        </SafeAreaView>
      </ImageBackground>

      {/* Bottom 35% — White card */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.cardContent}>
          <Link href="/(auth)/sign-up" asChild>
            <NeumorphicButton style={styles.primaryBtn}>
              Create Account
            </NeumorphicButton>
          </Link>

          <Link href="/(auth)/sign-in" asChild>
            <NeumorphicButton variant="secondary" style={styles.secondaryBtn}>
              I already have an account
            </NeumorphicButton>
          </Link>

          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.footer}
          >
            PaySmooth &middot; v1.0.0
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  waveBg: { flex: 0.65, justifyContent: "flex-end" },
  waveSafeArea: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
    paddingBottom: Spacing.four,
  },
  waveContent: { gap: Spacing.one },
  card: {
    flex: 0.35,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    paddingTop: Spacing.four,
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
    gap: Spacing.two,
  },
  primaryBtn: {
    paddingVertical: Spacing.two,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryBtn: {
    paddingVertical: Spacing.two,
    borderRadius: 14,
    alignItems: "center",
  },
  footer: { textAlign: "center", paddingTop: Spacing.four, fontSize: 12 },
});
