import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  NeumorphicButton,
  NeumorphicCard,
  NeumorphicPressable,
  NeumorphicSurface,
} from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function DataEncryptionKeyScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [keySource, setKeySource] = useState<"local" | "cloud">("local");
  const [isKeyGenerated, setIsKeyGenerated] = useState(true);

  const handleRegenerate = () => {
    Alert.alert(
      "Regenerate Encryption Key",
      "This will generate a new encryption key. Existing encrypted data will be re-encrypted with the new key.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Regenerate",
          style: "destructive",
          onPress: () => Alert.alert("Done", "New encryption key generated."),
        },
      ],
    );
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
            Data Encryption Key
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
          {/* Key status */}
          <NeumorphicCard style={styles.statusCard}>
            <SymbolView
              name={
                isKeyGenerated
                  ? { ios: "key.fill", android: "key", web: "key" }
                  : { ios: "key.slash", android: "key_off", web: "key_off" }
              }
              size={40}
              tintColor={isKeyGenerated ? theme.success : theme.danger}
            />
            <ThemedText
              type="default"
              style={{ fontWeight: "600", marginTop: Spacing.two }}
            >
              {isKeyGenerated ? "Encryption Key Active" : "No Encryption Key"}
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={{ textAlign: "center" }}
            >
              {isKeyGenerated
                ? "All local data is encrypted at rest using AES-256."
                : "Generate a key to enable data encryption."}
            </ThemedText>
            {isKeyGenerated && (
              <NeumorphicSurface small style={styles.keyFingerprint}>
                <ThemedText
                  type="small"
                  style={{ fontFamily: "monospace", color: theme.primary }}
                >
                  SHA-256: A3:F2:1B:9C:4D:E7:81:0F
                </ThemedText>
              </NeumorphicSurface>
            )}
          </NeumorphicCard>

          {/* Key source */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Key Management
            </ThemedText>
            <NeumorphicCard style={styles.card}>
              <NeumorphicPressable
                inset={keySource === "local"}
                onPress={() => setKeySource("local")}
                style={styles.sourceRow}
              >
                <SymbolView
                  name={{
                    ios: "iphone",
                    android: "phone_android",
                    web: "phone_android",
                  }}
                  size={24}
                  tintColor={keySource === "local" ? theme.primary : theme.text}
                />
                <View style={styles.sourceBody}>
                  <ThemedText type="default" style={{ fontWeight: "500" }}>
                    Device-Only (Self-Custody)
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Encryption key is stored in the device Secure Enclave. No
                    cloud backup.
                  </ThemedText>
                </View>
                {keySource === "local" && (
                  <SymbolView
                    name={{
                      ios: "checkmark.circle.fill",
                      android: "check_circle",
                      web: "check_circle",
                    }}
                    size={22}
                    tintColor={theme.primary}
                  />
                )}
              </NeumorphicPressable>
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <NeumorphicPressable
                inset={keySource === "cloud"}
                onPress={() => setKeySource("cloud")}
                style={styles.sourceRow}
              >
                <SymbolView
                  name={{ ios: "icloud", android: "cloud", web: "cloud" }}
                  size={24}
                  tintColor={keySource === "cloud" ? theme.primary : theme.text}
                />
                <View style={styles.sourceBody}>
                  <ThemedText type="default" style={{ fontWeight: "500" }}>
                    Cloud-Managed
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Key is synced via iCloud Keychain / platform keystore.
                    Recoverable on new devices.
                  </ThemedText>
                </View>
                {keySource === "cloud" && (
                  <SymbolView
                    name={{
                      ios: "checkmark.circle.fill",
                      android: "check_circle",
                      web: "check_circle",
                    }}
                    size={22}
                    tintColor={theme.primary}
                  />
                )}
              </NeumorphicPressable>
            </NeumorphicCard>
          </View>

          {/* Actions */}
          <NeumorphicButton
            variant="ghost"
            style={[styles.actionBtn, { borderColor: theme.warning }]}
            textStyle={{ color: theme.warning }}
            onPress={handleRegenerate}
          >
            Regenerate Key
          </NeumorphicButton>

          {!isKeyGenerated && (
            <NeumorphicButton
              variant="secondary"
              style={[styles.actionBtn, { borderColor: theme.primary }]}
              textStyle={{ color: theme.primary }}
              onPress={() => {
                setIsKeyGenerated(true);
                Alert.alert(
                  "Done",
                  "Encryption key generated. All data will be encrypted at rest.",
                );
              }}
            >
              Generate Key
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
              The encryption key never leaves your device in self-custody mode.
              In cloud-managed mode, the key is stored in your platform keystore
              (iCloud Keychain / Google Password Manager).
            </ThemedText>
          </View>

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
  section: { gap: Spacing.one },
  sectionTitle: { fontWeight: "600" },
  statusCard: {
    alignItems: "center",
    padding: Spacing.five,
    gap: Spacing.half,
  },
  keyFingerprint: { marginTop: Spacing.one, padding: Spacing.two },
  card: { paddingHorizontal: Spacing.three },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    borderRadius: 12,
    gap: Spacing.three,
  },
  sourceBody: { flex: 1, gap: 1 },
  divider: { height: StyleSheet.hairlineWidth },
  actionBtn: { paddingVertical: Spacing.three, minHeight: 48 },
  infoBox: {
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.three,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, lineHeight: 18 },
});
