import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  NeumorphicButton,
  NeumorphicCard,
  NeumorphicPressable,
  NeumorphicInput,
  NeumorphicSurface,
} from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  challengeFactor,
  enrollTotp,
  listVerifiedTotpFactors,
  unenrollFactor,
  verifyFactor,
  type EnrollTotpResult,
} from "@/lib/mfa-service";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Step =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "enrolling"; pending: EnrollTotpResult }
  | { kind: "recovery"; pending: EnrollTotpResult };

export default function TwoFactorAuthScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const factors = await listVerifiedTotpFactors();
      setFactorId(factors.length > 0 ? factors[0].id : null);
      setStep({ kind: "idle" });
    } catch (e) {
      setStep({ kind: "idle" });
      Alert.alert(
        "2FA Unavailable",
        e instanceof Error ? e.message : "Could not check your 2FA status.",
      );
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isEnabled = step.kind !== "loading" && factorId !== null;

  const handleStartEnroll = async () => {
    setBusy(true);
    try {
      const pending = await enrollTotp();
      setStep({ kind: "enrolling", pending });
      setVerifyCode("");
    } catch (e) {
      Alert.alert(
        "Setup Failed",
        e instanceof Error ? e.message : "Could not start 2FA setup.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCancelEnroll = async () => {
    const pending = step.kind === "enrolling" || step.kind === "recovery"
      ? step.pending
      : null;
    setStep({ kind: "loading" });
    if (pending) {
      unenrollFactor(pending.factorId).catch(() => {});
    }
    await refresh();
  };

  const handleVerifyEnroll = async () => {
    if (step.kind !== "enrolling") return;
    if (verifyCode.replace(/\s/g, "").length < 6) {
      Alert.alert("Invalid Code", "Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    try {
      const { challengeId } = await challengeFactor(step.pending.factorId);
      await verifyFactor(step.pending.factorId, challengeId, verifyCode);
      setFactorId(step.pending.factorId);
      setStep({ kind: "recovery", pending: step.pending });
      setVerifyCode("");
    } catch (e) {
      Alert.alert(
        "Verification Failed",
        e instanceof Error ? e.message : "The code was not accepted. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleFinishEnroll = () => {
    setStep({ kind: "idle" });
  };

  const handleDisable = async () => {
    if (!factorId) return;
    Alert.alert(
      "Disable Two-Factor Auth",
      "Your authenticator app will no longer be required to sign in. This weakens account security.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disable",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await unenrollFactor(factorId);
              setFactorId(null);
              setStep({ kind: "idle" });
            } catch (e) {
              Alert.alert(
                "Disable Failed",
                e instanceof Error ? e.message : "Could not disable 2FA.",
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const enrolling = step.kind === "enrolling";
  const showingRecovery = step.kind === "recovery";

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
            Two-Factor Auth
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
          {step.kind === "loading" ? (
            <ThemedText type="small" themeColor="textSecondary">
              Checking your security settings…
            </ThemedText>
          ) : showingRecovery ? (
            <>
              {/* Recovery codes */}
              <NeumorphicCard style={styles.statusCard}>
                <SymbolView
                  name={{
                    ios: "checkmark.shield.fill",
                    android: "verified_user",
                    web: "verified_user",
                  }}
                  size={40}
                  tintColor={theme.success}
                />
                <ThemedText
                  type="default"
                  style={{ fontWeight: "600", marginTop: Spacing.two }}
                >
                  2FA Enabled
                </ThemedText>
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={{ textAlign: "center", lineHeight: 18 }}
                >
                  Save these recovery codes in a secure place. If you lose
                  access to your authenticator app, they are the only way back
                  into your account.
                </ThemedText>
              </NeumorphicCard>

              <NeumorphicSurface small style={styles.recoveryBox}>
                {step.pending.recoveryCodes.length > 0 ? (
                  step.pending.recoveryCodes.map((code) => (
                    <ThemedText
                      key={code}
                      type="default"
                      style={[styles.recoveryCode, { color: theme.primary }]}
                    >
                      {code}
                    </ThemedText>
                  ))
                ) : (
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    style={{ textAlign: "center" }}
                  >
                    No recovery codes were generated. If you lose your
                    authenticator app, contact support to regain access.
                  </ThemedText>
                )}
              </NeumorphicSurface>

              <NeumorphicButton
                onPress={handleFinishEnroll}
                style={styles.actionBtn}
              >
                <ThemedText
                  type="default"
                  style={{ color: theme.primaryText, fontWeight: "600" }}
                >
                  I've Saved My Recovery Codes
                </ThemedText>
              </NeumorphicButton>
            </>
          ) : enrolling ? (
            <>
              {/* Enroll QR */}
              <NeumorphicCard style={styles.statusCard}>
                <SymbolView
                  name={{
                    ios: "apps.iphone",
                    android: "phone_iphone",
                    web: "phone_iphone",
                  }}
                  size={40}
                  tintColor={theme.primary}
                />
                <ThemedText
                  type="default"
                  style={{ fontWeight: "600", marginTop: Spacing.two }}
                >
                  Scan with Your Authenticator App
                </ThemedText>
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={{ textAlign: "center", lineHeight: 18 }}
                >
                  Open Google Authenticator or Authy, tap add, and scan this QR
                  code.
                </ThemedText>

                <View style={styles.qrWrap}>
                  {step.pending.qrCodeSvg ? (
                    <SvgXml
                      xml={step.pending.qrCodeSvg}
                      width={200}
                      height={200}
                    />
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      QR unavailable
                    </ThemedText>
                  )}
                </View>

                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={{ textAlign: "center" }}
                >
                  Can't scan? Enter this key manually:
                </ThemedText>
                <NeumorphicSurface small style={styles.secretBox}>
                  <ThemedText
                    type="small"
                    selectable
                    style={{ fontFamily: "monospace", color: theme.primary }}
                  >
                    {step.pending.secret}
                  </ThemedText>
                </NeumorphicSurface>
              </NeumorphicCard>

              {/* Verify code */}
              <NeumorphicCard style={styles.card}>
                <ThemedText
                  type="default"
                  style={{ fontWeight: "600", marginBottom: Spacing.one }}
                >
                  Enter the 6-Digit Code
                </ThemedText>
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={{ marginBottom: Spacing.two, lineHeight: 18 }}
                >
                  After scanning, your app will show a code. Enter it below to
                  verify setup.
                </ThemedText>
                <NeumorphicInput
                  placeholder="000 000"
                  value={verifyCode}
                  onChangeText={setVerifyCode}
                  keyboardType="number-pad"
                  maxLength={7}
                  underlineColorAndroid="transparent"
                />
              </NeumorphicCard>

              <NeumorphicButton
                onPress={handleVerifyEnroll}
                disabled={busy}
                style={styles.actionBtn}
              >
                <ThemedText
                  type="default"
                  style={{ color: theme.primaryText, fontWeight: "600" }}
                >
                  {busy ? "Verifying…" : "Verify & Enable 2FA"}
                </ThemedText>
              </NeumorphicButton>

              <NeumorphicButton
                variant="ghost"
                onPress={handleCancelEnroll}
                style={styles.actionBtn}
              >
                <ThemedText
                  type="default"
                  style={{ color: theme.textSecondary }}
                >
                  Cancel Setup
                </ThemedText>
              </NeumorphicButton>
            </>
          ) : (
            <>
              {/* Status */}
              <NeumorphicCard style={styles.statusCard}>
                <SymbolView
                  name={
                    isEnabled
                      ? {
                          ios: "checkmark.shield.fill",
                          android: "verified_user",
                          web: "verified_user",
                        }
                      : { ios: "shield", android: "shield", web: "shield" }
                  }
                  size={40}
                  tintColor={isEnabled ? theme.success : theme.placeholder}
                />
                <ThemedText
                  type="default"
                  style={{ fontWeight: "600", marginTop: Spacing.two }}
                >
                  {isEnabled
                    ? "Two-Factor Auth Active"
                    : "Not Configured"}
                </ThemedText>
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={{ textAlign: "center", lineHeight: 18 }}
                >
                  {isEnabled
                    ? "Sign-ins require a code from your authenticator app."
                    : "Add an extra layer of security to your account with an authenticator app."}
                </ThemedText>
              </NeumorphicCard>

              {/* Methods */}
              <NeumorphicCard style={styles.card}>
                <NeumorphicPressable
                  inset={isEnabled}
                  onPress={isEnabled ? undefined : handleStartEnroll}
                  style={styles.methodRow}
                >
                  <SymbolView
                    name={{
                      ios: "apps.iphone",
                      android: "phone_iphone",
                      web: "phone_iphone",
                    }}
                    size={24}
                    tintColor={isEnabled ? theme.success : theme.text}
                  />
                  <View style={styles.methodBody}>
                    <ThemedText type="default" style={{ fontWeight: "500" }}>
                      Authenticator App
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Google Authenticator, Authy, or similar.
                    </ThemedText>
                  </View>
                  {isEnabled && (
                    <SymbolView
                      name={{
                        ios: "checkmark.circle.fill",
                        android: "check_circle",
                        web: "check_circle",
                      }}
                      size={22}
                      tintColor={theme.success}
                    />
                  )}
                </NeumorphicPressable>
              </NeumorphicCard>

              {/* Disable */}
              {isEnabled && (
                <NeumorphicButton
                  variant="ghost"
                  style={[styles.actionBtn, { borderColor: theme.danger }]}
                  textStyle={{ color: theme.danger }}
                  onPress={handleDisable}
                  disabled={busy}
                >
                  Disable Two-Factor Auth
                </NeumorphicButton>
              )}

              <View style={styles.infoBox}>
                <SymbolView
                  name={{ ios: "info.circle", android: "info", web: "info" }}
                  size={16}
                  tintColor={theme.primary}
                />
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={styles.infoText}
                >
                  Two-factor authentication adds a verification step during
                  sign-in. Once enabled, you'll need your password and a code
                  from your authenticator app to log in.
                </ThemedText>
              </View>
            </>
          )}

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
    gap: Spacing.three,
  },
  statusCard: {
    alignItems: "center",
    padding: Spacing.five,
    gap: Spacing.half,
  },
  card: { padding: Spacing.three, gap: Spacing.two },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    borderRadius: 12,
    gap: Spacing.three,
  },
  methodBody: { flex: 1, gap: 1 },
  qrWrap: {
    marginTop: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: "#ffffff",
  },
  secretBox: { padding: Spacing.two, alignSelf: "stretch" },
  recoveryBox: {
    padding: Spacing.four,
    alignItems: "center",
    gap: Spacing.one,
  },
  recoveryCode: {
    fontFamily: "monospace",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 1,
    paddingVertical: Spacing.half,
  },
  actionBtn: {
    paddingVertical: Spacing.three,
    minHeight: 48,
  },
  infoBox: {
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.three,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, lineHeight: 18 },
});
