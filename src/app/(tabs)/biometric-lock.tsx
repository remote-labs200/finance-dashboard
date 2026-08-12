import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  NeumorphicButton,
  NeumorphicCard,
  NeumorphicPressable,
} from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Keys must match the ones read by the root layout (src/app/_layout.tsx).
const BIOMETRIC_ENABLED_KEY = "biometric_enabled";
const BIOMETRIC_REQUIRE_LAUNCH_KEY = "biometric_require_launch";
const BIOMETRIC_REQUIRE_RETURN_KEY = "biometric_require_return";
const BIOMETRIC_TIMEOUT_KEY = "biometric_timeout_minutes";

function persist(key: string, value: string) {
  SecureStore.setItemAsync(key, value).catch(() => {
    /* persist silently */
  });
}

export default function BiometricLockScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [faceId, setFaceId] = useState(false);
  const [requireOnLaunch, setRequireOnLaunch] = useState(true);
  const [requireOnReturn, setRequireOnReturn] = useState(false);
  const [timeoutMinutes, setTimeoutMinutes] = useState(5);
  const [available, setAvailable] = useState(false);
  const [biometryLabel, setBiometryLabel] = useState("Biometrics");

  const timeoutOptions = [1, 5, 15, 30, 60];

  // Load persisted preferences + check hardware support on mount.
  useEffect(() => {
    (async () => {
      try {
        const hardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setAvailable(hardware && enrolled);
        if (hardware && enrolled) {
          const types =
            await LocalAuthentication.supportedAuthenticationTypesAsync();
          const type = types.length > 0 ? types[0] : null;
          setBiometryLabel(
            type === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
              ? "Face ID"
              : "Biometrics",
          );
        }
      } catch {
        setAvailable(false);
      }

      const [enabled, launch, ret, timeout] = await Promise.all([
        SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY),
        SecureStore.getItemAsync(BIOMETRIC_REQUIRE_LAUNCH_KEY),
        SecureStore.getItemAsync(BIOMETRIC_REQUIRE_RETURN_KEY),
        SecureStore.getItemAsync(BIOMETRIC_TIMEOUT_KEY),
      ]);
      if (enabled !== null) setFaceId(enabled === "true");
      if (launch !== null) setRequireOnLaunch(launch === "true");
      if (ret !== null) setRequireOnReturn(ret === "true");
      if (timeout !== null) setTimeoutMinutes(Number(timeout) || 5);
    })();
  }, []);

  const toggleBiometrics = (value: boolean) => {
    setFaceId(value);
    persist(BIOMETRIC_ENABLED_KEY, value ? "true" : "false");
  };

  const toggleRequireOnLaunch = (value: boolean) => {
    setRequireOnLaunch(value);
    persist(BIOMETRIC_REQUIRE_LAUNCH_KEY, value ? "true" : "false");
  };

  const toggleRequireOnReturn = (value: boolean) => {
    setRequireOnReturn(value);
    persist(BIOMETRIC_REQUIRE_RETURN_KEY, value ? "true" : "false");
  };

  const selectTimeout = (minutes: number) => {
    setTimeoutMinutes(minutes);
    persist(BIOMETRIC_TIMEOUT_KEY, String(minutes));
  };

  const handleTest = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock PaySmooth",
        fallbackLabel: "Enter passcode",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });
      Alert.alert(
        result.success ? "Success" : "Not Verified",
        result.success
          ? "Biometric authentication verified."
          : "Authentication was not completed.",
      );
    } catch {
      Alert.alert("Not Available", "Biometrics are not available on this device.");
    }
  };

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
            Biometric Lock
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
          {/* Status card */}
          <NeumorphicCard style={styles.statusCard}>
            <SymbolView
              name={{
                ios: "faceid",
                android: "fingerprint",
                web: "fingerprint",
              }}
              size={40}
              tintColor={faceId ? theme.primary : theme.placeholder}
            />
            <ThemedText
              type="default"
              style={{ fontWeight: "600", marginTop: Spacing.two }}
            >
              {faceId
                ? `${biometryLabel} Enabled`
                : "Biometric Lock Disabled"}
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={{ textAlign: "center", lineHeight: 18 }}
            >
              {faceId
                ? "Your device biometrics secure access to the app."
                : "Enable biometric authentication for quick, secure access."}
            </ThemedText>
            {!available && (
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={{ textAlign: "center", lineHeight: 18, marginTop: Spacing.one }}
              >
                This device has no enrolled biometrics (Face ID, Touch ID, or
                fingerprint).
              </ThemedText>
            )}
          </NeumorphicCard>

          {/* Settings */}
          <NeumorphicCard style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleBody}>
                <ThemedText type="default" style={{ fontWeight: "500" }}>
                  Use Biometrics
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Face ID, Touch ID, or fingerprint.
                </ThemedText>
              </View>
              <Switch
                value={faceId}
                onValueChange={toggleBiometrics}
                trackColor={{ false: theme.inputBorder, true: theme.primary }}
                thumbColor="#fff"
              />
            </View>
            {faceId && (
              <>
                <View
                  style={[styles.divider, { backgroundColor: theme.divider }]}
                />
                <View style={styles.toggleRow}>
                  <View style={styles.toggleBody}>
                    <ThemedText type="default" style={{ fontWeight: "500" }}>
                      Require on Launch
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Prompt for biometrics when app starts.
                    </ThemedText>
                  </View>
                  <Switch
                    value={requireOnLaunch}
                    onValueChange={toggleRequireOnLaunch}
                    trackColor={{
                      false: theme.inputBorder,
                      true: theme.primary,
                    }}
                    thumbColor="#fff"
                  />
                </View>
                <View
                  style={[styles.divider, { backgroundColor: theme.divider }]}
                />
                <View style={styles.toggleRow}>
                  <View style={styles.toggleBody}>
                    <ThemedText type="default" style={{ fontWeight: "500" }}>
                      Require on Return
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Re-authenticate after backgrounding the app.
                    </ThemedText>
                  </View>
                  <Switch
                    value={requireOnReturn}
                    onValueChange={toggleRequireOnReturn}
                    trackColor={{
                      false: theme.inputBorder,
                      true: theme.primary,
                    }}
                    thumbColor="#fff"
                  />
                </View>
              </>
            )}
          </NeumorphicCard>

          {/* Auto-lock timeout */}
          {faceId && (
            <View style={styles.section}>
              <ThemedText type="callout" style={styles.sectionTitle}>
                Auto-Lock Timeout
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.sectionSub}
              >
                After how long of inactivity should the app lock?
              </ThemedText>
              <View style={styles.chipRow}>
                {timeoutOptions.map((t) => {
                  const isSelected = timeoutMinutes === t;
                  return (
                    <NeumorphicPressable
                      key={t}
                      inset={isSelected}
                      onPress={() => selectTimeout(t)}
                      style={[
                        styles.chip,
                        isSelected && { backgroundColor: theme.primary },
                      ]}
                    >
                      <ThemedText
                        type="default"
                        style={{
                          color: isSelected ? theme.surface : theme.text,
                          fontWeight: isSelected ? "600" : "400",
                        }}
                      >
                        {t === 1 ? "1 min" : t >= 60 ? "1 hour" : `${t} min`}
                      </ThemedText>
                    </NeumorphicPressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Test */}
          {faceId && (
            <NeumorphicButton
              variant="secondary"
              style={[styles.testBtn, { borderColor: theme.primary }]}
              textStyle={{ color: theme.primary }}
              onPress={handleTest}
            >
              Test Biometrics
            </NeumorphicButton>
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
  section: { gap: Spacing.one },
  sectionTitle: { fontWeight: "600" },
  sectionSub: { lineHeight: 18 },
  statusCard: {
    alignItems: "center",
    padding: Spacing.five,
    gap: Spacing.half,
  },
  card: { paddingHorizontal: Spacing.three },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  toggleBody: { flex: 1, gap: 1 },
  divider: { height: StyleSheet.hairlineWidth },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.one },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  testBtn: { paddingVertical: Spacing.three },
});
