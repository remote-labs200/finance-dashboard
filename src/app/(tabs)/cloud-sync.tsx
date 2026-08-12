import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { NeumorphicButton, NeumorphicCard } from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useSQLiteContext } from "@/db/provider";
import { useTheme } from "@/hooks/use-theme";
import {
  checkSupabaseConnection,
  getLastSyncedAt,
  getPendingSyncEntries,
  performFullSync,
} from "@/lib/sync-service";
import { supabaseConfig } from "@/lib/supabase";
import { useAuthStore } from "@/stores/use-auth-store";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CloudSyncScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const refreshStatus = useCallback(
    async (signal?: { aborted: boolean }) => {
      try {
        const connected = await checkSupabaseConnection();
        if (signal?.aborted) return;
        setIsConnected(connected);

        if (connected) {
          const pending = await getPendingSyncEntries(db, 100);
          if (signal?.aborted) return;
          setPendingCount(pending.filter((e) => e.status === "pending").length);
          const last = await getLastSyncedAt(db);
          if (signal?.aborted) return;
          setLastSynced(last);
        } else {
          setPendingCount(0);
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes("closed")) return;
        console.warn("Failed to refresh sync status:", e);
      }
    },
    [db],
  );

  useEffect(() => {
    const signal = { aborted: false };
    refreshStatus(signal);
    return () => {
      signal.aborted = true;
    };
  }, [refreshStatus]);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const result = await performFullSync(db);
      const msg = [
        `Pushed: ${result.pushed}`,
        `Pulled: ${result.pulled}`,
        result.conflicts > 0 ? `Conflicts: ${result.conflicts}` : null,
        result.errors.length > 0 ? `Errors: ${result.errors.length}` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      setSyncResult(msg);
      await refreshStatus();
    } catch (e: any) {
      setSyncResult(`Sync failed: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  }, [db, refreshStatus]);

  const handleSaveConfig = useCallback(() => {
    // Credentials are baked in from .env at build time and cannot be
    // changed from inside the app. Show a plain explanation instead of a
    // fake "save" flow.
    if (supabaseConfig.isConfigured) {
      Alert.alert(
        "Supabase Configuration",
        "This build is connected to:\n\n" +
          supabaseConfig.projectUrl +
          "\n\nCloud credentials are set at build time in the .env file and cannot be changed from the app.",
        [{ text: "OK" }],
      );
    } else {
      Alert.alert(
        "Supabase Configuration",
        "This build is not connected to Supabase. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to the .env file and rebuild.",
        [{ text: "OK" }],
      );
    }
  }, []);

  const formatDate = (iso: string | null) => {
    if (!iso) return "Never";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safeArea}>
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
            Cloud Sync
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
          {/* Status Card */}
          <NeumorphicCard style={styles.card}>
            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <ThemedText type="callout" style={{ fontWeight: "600" }}>
                  Connection Status
                </ThemedText>
                <View style={styles.statusBadgeRow}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          isConnected === null
                            ? theme.warning
                            : isConnected
                              ? theme.success
                              : theme.danger,
                      },
                    ]}
                  />
                  <ThemedText
                    type="default"
                    style={{
                      color:
                        isConnected === null
                          ? theme.warning
                          : isConnected
                            ? theme.success
                            : theme.danger,
                      fontWeight: "600",
                    }}
                  >
                    {isConnected === null
                      ? "Checking..."
                      : isConnected
                        ? "Connected"
                        : "Not Configured"}
                  </ThemedText>
                </View>
              </View>
              <SymbolView
                name={{
                  ios: isConnected ? "icloud.fill" : "icloud.slash",
                  android: isConnected ? "cloud" : "cloud_off",
                  web: "cloud_off",
                }}
                size={32}
                tintColor={isConnected ? theme.success : theme.placeholder}
              />
            </View>

            <View
              style={[styles.divider, { backgroundColor: theme.divider }]}
            />

            <View style={styles.detailRow}>
              <ThemedText type="default" themeColor="textSecondary">
                Last Synced
              </ThemedText>
              <ThemedText type="default" style={{ fontWeight: "500" }}>
                {formatDate(lastSynced)}
              </ThemedText>
            </View>
            <View
              style={[styles.divider, { backgroundColor: theme.divider }]}
            />
            <View style={styles.detailRow}>
              <ThemedText type="default" themeColor="textSecondary">
                Pending Changes
              </ThemedText>
              <ThemedText
                type="default"
                style={{
                  fontWeight: "500",
                  color: pendingCount > 0 ? theme.warning : theme.text,
                }}
              >
                {pendingCount > 0 ? `${pendingCount} items` : "None"}
              </ThemedText>
            </View>

            {/* Sync Button */}
            <NeumorphicButton
              onPress={handleSync}
              disabled={isSyncing || !isConnected}
              style={[styles.syncBtn, !isConnected && { opacity: 0.5 }]}
            >
              {isSyncing ? "Syncing..." : "Sync Now"}
            </NeumorphicButton>

            {/* Sync Result */}
            {syncResult && (
              <View
                style={[
                  styles.resultBox,
                  {
                    backgroundColor: syncResult.includes("failed")
                      ? `${theme.danger}10`
                      : `${theme.success}10`,
                  },
                ]}
              >
                <ThemedText
                  type="small"
                  style={{
                    color: syncResult.includes("failed")
                      ? theme.danger
                      : theme.success,
                  }}
                >
                  {syncResult}
                </ThemedText>
              </View>
            )}
          </NeumorphicCard>

          {/* Configure Section */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Configuration
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.sectionSubtitle}
            >
              Cloud sync uses Supabase for authentication and data backup. The
              project connection is set at build time via the .env file and
              cannot be changed from inside the app.
            </ThemedText>

            <NeumorphicCard style={styles.card}>
              <Pressable
                onPress={handleSaveConfig}
                style={styles.configRow}
              >
                <View style={styles.configLeft}>
                  <ThemedText type="default">Supabase Project</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {supabaseConfig.isConfigured
                      ? supabaseConfig.projectUrl
                      : "Not configured — add EXPO_PUBLIC_SUPABASE_URL to .env"}
                  </ThemedText>
                </View>
                <SymbolView
                  name={{
                    ios: "info.circle",
                    android: "info",
                    web: "info",
                  }}
                  size={16}
                  tintColor={theme.placeholder}
                />
              </Pressable>
            </NeumorphicCard>
          </View>

          {/* Info */}
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
              Sync uses an offline-first approach: all data is saved locally
              first, then synced to the cloud when connected. Conflicts are
              resolved with last-write-wins.
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
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  headerTitle: {
    flex: 1,
  },
  backBtn: {
    padding: Spacing.one,
  },
  scroll: {
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.one,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  sectionSubtitle: {
    lineHeight: 20,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.two,
  },
  statusLeft: {
    gap: Spacing.one,
  },
  statusBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.two,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  syncBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    marginTop: Spacing.three,
  },
  resultBox: {
    padding: Spacing.two,
    borderRadius: Spacing.two,
    marginTop: Spacing.two,
  },
  configRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  configLeft: {
    flex: 1,
    gap: 2,
  },
  infoBox: {
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.three,
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    lineHeight: 18,
  },
});
