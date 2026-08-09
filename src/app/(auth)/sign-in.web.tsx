import { Link } from "expo-router";
import { useState } from "react";
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PasswordInput } from "@/components/password-input";
import { ThemedText } from "@/components/themed-text";
import { NeumorphicButton, NeumorphicInput } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useSQLiteContext } from "@/db/provider";
import { useThemeColors } from "@/hooks/use-theme";
import { useAuthStore } from "@/stores/use-auth-store";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const signIn = useAuthStore((state) => state.signIn);
  const db = useSQLiteContext();
  const colors = useThemeColors();

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signIn(db, email, password);
    } catch (error: any) {
      Alert.alert("Sign In Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top 65% — Wave background */}
      <ImageBackground
        source={require("@/assets/images/signin.png")}
        style={styles.waveBg}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.waveSafeArea}>
          <ThemedText type="title" style={styles.waveTitle}>
            Welcome Back
          </ThemedText>
          <ThemedText type="callout" style={styles.waveTagline}>
            Sign in to your account
          </ThemedText>
        </SafeAreaView>
      </ImageBackground>

      {/* Bottom 35% — White card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "android" ? 20 : 0}
        style={[styles.card, { backgroundColor: colors.card }]}
      >
        <View style={styles.cardContent}>
          <NeumorphicInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            underlineColorAndroid="transparent"
            leftIcon={
              <ThemedText style={{ color: colors.textTertiary, fontSize: 18 }}>
                @
              </ThemedText>
            }
          />
          <PasswordInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />
          <NeumorphicButton
            onPress={handleSignIn}
            disabled={loading}
            style={styles.button}
          >
            {loading ? "Signing In..." : "Sign In"}
          </NeumorphicButton>

          <Link href="/(auth)/sign-up" asChild>
            <ThemedText
              type="link"
              style={[styles.linkButton, { color: colors.primary }]}
            >
              Don&apos;t have an account? Sign Up
            </ThemedText>
          </Link>

          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.footer}
          >
            PaySmooth &middot; v1.0.0
          </ThemedText>
        </View>
      </KeyboardAvoidingView>
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
    paddingBottom: Spacing.four,
  },
  waveTitle: { color: "#ffffff", lineHeight: 48 },
  waveTagline: { color: "rgba(255,255,255,0.8)", marginTop: Spacing.one },
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
    gap: Spacing.two,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.two + 4,
    fontSize: 16,
  },
  button: {
    paddingVertical: Spacing.two,
    borderRadius: 14,
    alignItems: "center",
    marginTop: Spacing.one,
  },
  linkButton: {
    marginTop: Spacing.one,
    textAlign: "center",
  },
  footer: {
    textAlign: "center",
    paddingTop: Spacing.four,
    fontSize: 12,
  },
});
