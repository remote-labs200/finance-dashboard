import { useFocusEffect, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  NeumorphicButton,
  NeumorphicCard,
  NeumorphicInput,
  NeumorphicPressable,
} from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { getAllPreferences, setPreference } from "@/db/preferences-repo";
import { useSQLiteContext } from "@/db/provider";
import { findTransactionsByUser } from "@/db/transaction-repo";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/lib/supabase";
import { checkSupabaseConnection, getLastSyncedAt } from "@/lib/sync-service";
import { useAuthStore } from "@/stores/use-auth-store";
import { useThemeStore, type ThemePreference } from "@/stores/use-theme-store";
import * as SecureStore from "expo-secure-store";

type ModalType = "email" | "password" | null;

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const FILING_STATUS_LABELS: Record<string, string> = {
  single: "Single",
  married_joint: "Married Filing Jointly",
  head_of_household: "Head of Household",
};

function formatDate(iso: string | null): string {
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
}

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const updateEmail = useAuthStore((state) => state.updateEmail);
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const themePreference = useThemeStore((s) => s.preference);
  const setThemePreference = useThemeStore((s) => s.setPreference);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Live preference values loaded from the cloud-first preferences repo
  const [filingStatus, setFilingStatus] = useState("single");
  const [selectedState, setSelectedState] = useState("");
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [defaultCurrency, setDefaultCurrency] = useState("USD");

  // Live Supabase connection state
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // Email form
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Load biometric preference on mount
  useEffect(() => {
    SecureStore.getItemAsync("biometric_enabled").then((val) => {
      setBiometricEnabled(val === "true");
    });
  }, []);

  const handleBiometricToggle = useCallback(async (value: boolean) => {
    setBiometricEnabled(value);
    await SecureStore.setItemAsync(
      "biometric_enabled",
      value ? "true" : "false",
    );
  }, []);

  // Load live preference values from the cloud-first data layer
  const loadSettingsData = useCallback(async () => {
    if (!user) return;
    try {
      const prefs = await getAllPreferences(db, user.id);
      setFilingStatus(prefs.filing_status ?? "single");
      setSelectedState(prefs.state ?? "");
      setTaxYear(Number(prefs.tax_year) || new Date().getFullYear());
      setDefaultCurrency(prefs.default_currency ?? "USD");
      setNotificationsEnabled(prefs.notifications_enabled !== "false");
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("closed")) return;
      console.warn("Failed to load settings preferences:", e);
    }
  }, [db, user]);

  const refreshConnection = useCallback(async () => {
    try {
      const connected = await checkSupabaseConnection();
      setIsConnected(connected);
      if (connected) {
        const last = await getLastSyncedAt(db);
        setLastSynced(last);
      } else {
        setLastSynced(null);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("closed")) return;
      console.warn("Failed to check sync status:", e);
    }
  }, [db]);

  // Re-load whenever the Settings screen regains focus so values reflect
  // changes made in sub-screens (profile, tax-config, currency, etc.).
  useFocusEffect(
    useCallback(() => {
      loadSettingsData();
      refreshConnection();
    }, [loadSettingsData, refreshConnection]),
  );

  const handleNotificationsToggle = useCallback(
    async (value: boolean) => {
      setNotificationsEnabled(value);
      if (!user) return;
      try {
        await setPreference(
          db,
          user.id,
          "notifications_enabled",
          value ? "true" : "false",
        );
      } catch (e: unknown) {
        console.warn("Failed to save notifications preference:", e);
      }
    },
    [db, user],
  );

  const handleSignOut = useCallback(() => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/sign-in");
        },
      },
    ]);
  }, [signOut, router]);

  const handleClearData = useCallback(() => {
    Alert.alert(
      "Clear All Data",
      "This will permanently delete all your transactions, accounts, and categories. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Everything",
          style: "destructive",
          onPress: async () => {
            await db.execAsync(`
              DELETE FROM transactions;
              DELETE FROM accounts;
              DELETE FROM categories;
              DELETE FROM tax_settings;
            `);
            Alert.alert("Done", "All data has been cleared.");
          },
        },
      ],
    );
  }, [db]);

  const handleUpdateEmail = useCallback(async () => {
    if (!newEmail.trim()) {
      Alert.alert("Error", "Please enter a new email address.");
      return;
    }
    if (!newEmail.includes("@")) {
      Alert.alert("Error", "Please enter a valid email address.");
      return;
    }
    setEmailLoading(true);
    try {
      await updateEmail(db, newEmail.trim());
      setActiveModal(null);
      setNewEmail("");
      Alert.alert("Success", "Your email has been updated.");
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to update email.");
    } finally {
      setEmailLoading(false);
    }
  }, [db, newEmail, updateEmail]);

  const handleUpdatePassword = useCallback(async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert("Error", "Please fill in all password fields.");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Error", "New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert("Error", "New passwords do not match.");
      return;
    }
    setPasswordLoading(true);
    try {
      if (!supabase) throw new Error("Supabase is not configured");
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw new Error(error.message);
      setActiveModal(null);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      Alert.alert("Success", "Your password has been updated.");
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to update password.");
    } finally {
      setPasswordLoading(false);
    }
  }, [currentPassword, newPassword, confirmNewPassword]);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setNewEmail("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
  }, []);

  const handleExportData = useCallback(async () => {
    if (!user) return;
    try {
      const txns = await findTransactionsByUser(db, user.id, { limit: 10000 });

      // Build CSV
      const header = "Date,Amount,Note,Category,Account,Currency\n";
      const rows = txns
        .map((t) =>
          [
            t.date,
            (t.amountCents / 100).toFixed(2),
            `"${(t.note ?? "").replace(/"/g, '""')}"`,
            `"${(t.categoryName ?? "").replace(/"/g, '""')}"`,
            `"${(t.accountName ?? "").replace(/"/g, '""')}"`,
            t.currencyCode,
          ].join(","),
        )
        .join("\n");
      const csv = header + rows;

      await Share.share({
        message: csv,
        title: `PaySmooth Export - ${new Date().toISOString().slice(0, 10)}.csv`,
      });
    } catch (e: any) {
      if (e?.message === "User did not share") return; // user cancelled
      Alert.alert("Export Error", e.message ?? "Failed to export data.");
    }
  }, [db, user]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all associated data from the cloud. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you sure?",
              "All of your data will be permanently removed. Type DELETE to confirm.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "DELETE",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      // Sign out from Supabase — this revokes the session
                      await signOut();

                      // Attempt to delete auth user via admin API (requires service_role key).
                      // For client-side deletion, Supabase requires the user to be recently
                      // authenticated. If this fails, instruct the user to contact support.
                      if (supabase) {
                        const { error } = await supabase.rpc(
                          "delete_user_account",
                        );
                        if (error)
                          console.warn(
                            "Account deletion RPC failed:",
                            error.message,
                          );
                      }

                      // Clear local data
                      await db.execAsync(`
                        DELETE FROM transactions;
                        DELETE FROM accounts;
                        DELETE FROM categories;
                        DELETE FROM tax_settings;
                        DELETE FROM user_preferences;
                        DELETE FROM users;
                        DELETE FROM sync_log;
                      `);

                      Alert.alert(
                        "Account Deleted",
                        supabase
                          ? "Your account has been scheduled for deletion. You will receive a confirmation email."
                          : "Local data cleared. Since Supabase is not configured, there is no cloud account to delete.",
                      );
                    } catch (e: any) {
                      Alert.alert(
                        "Error",
                        e.message ?? "Failed to delete account.",
                      );
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }, [db, signOut]);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + Spacing.three,
              paddingLeft: insets.left + Spacing.four,
              paddingRight: insets.right + Spacing.four,
            },
          ]}
        >
          <ThemedText type="title">Settings</ThemedText>

          {/* Profile Section */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Account
            </ThemedText>
            <NeumorphicCard>
              <Pressable
                onPress={() => {
                  setNewEmail(user?.email ?? "");
                  setActiveModal("email");
                }}
                style={styles.row}
              >
                <View style={styles.rowLeft}>
                  <ThemedText type="default" style={{ fontWeight: "600" }}>
                    Email
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {user?.email ?? "Not signed in"}
                  </ThemedText>
                </View>
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  size={16}
                  tintColor={theme.placeholder}
                />
              </Pressable>
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <Pressable
                onPress={() => setActiveModal("password")}
                style={styles.row}
              >
                <View style={styles.rowLeft}>
                  <ThemedText type="default" style={{ fontWeight: "600" }}>
                    Password
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Change your password
                  </ThemedText>
                </View>
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  size={16}
                  tintColor={theme.placeholder}
                />
              </Pressable>
            </NeumorphicCard>
          </View>

          {/* Subscription */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Subscription
            </ThemedText>
            <NeumorphicCard>
              <View style={styles.planHeader}>
                <View
                  style={[styles.planBadge, { backgroundColor: theme.primary }]}
                >
                  <ThemedText
                    type="small"
                    style={{ color: theme.primaryText, fontWeight: "700" }}
                  >
                    FREE
                  </ThemedText>
                </View>
                <ThemedText type="default" style={{ fontWeight: "600" }}>
                  Free Plan
                </ThemedText>
              </View>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={{ marginTop: Spacing.one }}
              >
                You're on the free plan. Upgrade to Pro for advanced features.
              </ThemedText>
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <View style={styles.planFeatures}>
                <ThemedText
                  type="small"
                  style={{ color: theme.success, paddingLeft: Spacing.two }}
                >
                  Unlimited transactions
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.success, paddingLeft: Spacing.two }}
                >
                  Up to 5 accounts
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.success, paddingLeft: Spacing.two }}
                >
                  Basic tax estimates
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.placeholder, paddingLeft: Spacing.two }}
                >
                  AI insights and forecasting
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.placeholder, paddingLeft: Spacing.two }}
                >
                  Receipt OCR scanning
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.placeholder, paddingLeft: Spacing.two }}
                >
                  Unlimited accounts
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.placeholder, paddingLeft: Spacing.two }}
                >
                  Priority cloud sync
                </ThemedText>
              </View>
              <NeumorphicButton
                onPress={() =>
                  Alert.alert(
                    "Coming Soon",
                    "Pro subscription will be available soon.",
                  )
                }
              >
                <ThemedText
                  type="default"
                  style={{ color: theme.primaryText, fontWeight: "600" }}
                >
                  Upgrade to Pro — $4.99/mo
                </ThemedText>
              </NeumorphicButton>
            </NeumorphicCard>
          </View>

          {/* Tax Settings */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Tax Configuration
            </ThemedText>
            <NeumorphicCard>
              <Pressable
                onPress={() => router.push("/(tabs)/tax-config")}
                style={styles.row}
              >
                <View style={styles.rowLeft}>
                  <ThemedText type="default">Filing Status</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {FILING_STATUS_LABELS[filingStatus] ?? filingStatus}
                  </ThemedText>
                </View>
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  size={16}
                  tintColor={theme.placeholder}
                />
              </Pressable>
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <Pressable
                onPress={() => router.push("/(tabs)/tax-config")}
                style={styles.row}
              >
                <View style={styles.rowLeft}>
                  <ThemedText type="default">State</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {selectedState
                      ? selectedState.toUpperCase()
                      : "No state tax"}
                  </ThemedText>
                </View>
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  size={16}
                  tintColor={theme.placeholder}
                />
              </Pressable>
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <Pressable
                onPress={() => router.push("/(tabs)/tax-config")}
                style={styles.row}
              >
                <View style={styles.rowLeft}>
                  <ThemedText type="default">Tax Year</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {taxYear}
                  </ThemedText>
                </View>
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  size={16}
                  tintColor={theme.placeholder}
                />
              </Pressable>
            </NeumorphicCard>
          </View>

          {/* Manage */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Manage
            </ThemedText>
            <NeumorphicCard>
              <Pressable
                onPress={() => router.push("/(tabs)/accounts")}
                style={styles.row}
              >
                <View style={styles.rowLeft}>
                  <ThemedText type="default">Accounts</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Manage bank accounts and wallets
                  </ThemedText>
                </View>
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  size={16}
                  tintColor={theme.placeholder}
                />
              </Pressable>
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <Pressable
                onPress={() => router.push("/(tabs)/categories")}
                style={styles.row}
              >
                <View style={styles.rowLeft}>
                  <ThemedText type="default">Categories</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Manage income and expense categories
                  </ThemedText>
                </View>
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  size={16}
                  tintColor={theme.placeholder}
                />
              </Pressable>
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <Pressable
                onPress={() => router.push("/(tabs)/clients")}
                style={styles.row}
              >
                <View style={styles.rowLeft}>
                  <ThemedText type="default">Clients</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Track invoices and payments per client
                  </ThemedText>
                </View>
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  size={16}
                  tintColor={theme.placeholder}
                />
              </Pressable>
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <Pressable
                onPress={() => router.push("/(tabs)/mileage")}
                style={styles.row}
              >
                <View style={styles.rowLeft}>
                  <ThemedText type="default">Mileage</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Log business miles for tax deductions
                  </ThemedText>
                </View>
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  size={16}
                  tintColor={theme.placeholder}
                />
              </Pressable>
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <Pressable
                onPress={() => router.push("/(tabs)/forecast")}
                style={styles.row}
              >
                <View style={styles.rowLeft}>
                  <ThemedText type="default">Cash Flow Forecast</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    AI-powered income projections
                  </ThemedText>
                </View>
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  size={16}
                  tintColor={theme.placeholder}
                />
              </Pressable>
            </NeumorphicCard>
          </View>

          {/* Preferences */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Preferences
            </ThemedText>
            <NeumorphicCard>
              {/* Theme Picker */}
              <View style={styles.row}>
                <ThemedText type="default">Appearance</ThemedText>
              </View>
              <View style={styles.themePicker}>
                {THEME_OPTIONS.map((opt) => (
                  <NeumorphicPressable
                    key={opt.value}
                    inset
                    onPress={() => setThemePreference(opt.value)}
                    style={[
                      styles.themeOption,
                      themePreference === opt.value && {
                        backgroundColor: theme.primary,
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{
                        color:
                          themePreference === opt.value
                            ? theme.primaryText
                            : theme.text,
                        fontWeight:
                          themePreference === opt.value ? "700" : "500",
                      }}
                    >
                      {opt.label}
                    </ThemedText>
                  </NeumorphicPressable>
                ))}
              </View>
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <View style={styles.row}>
                <ThemedText type="default">Notifications</ThemedText>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleNotificationsToggle}
                  trackColor={{ false: theme.inputBorder, true: theme.primary }}
                />
              </View>
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <ThemedText type="default">Face ID / Biometric</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Unlock the app with biometrics
                  </ThemedText>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleBiometricToggle}
                  trackColor={{ false: theme.inputBorder, true: theme.primary }}
                />
              </View>
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <Pressable
                onPress={() => router.push("/(tabs)/currency-settings")}
                style={styles.row}
              >
                <ThemedText type="default">Default Currency</ThemedText>
                <View style={styles.rowRight}>
                  <ThemedText type="default" themeColor="textSecondary">
                    {defaultCurrency}
                  </ThemedText>
                  <SymbolView
                    name={{
                      ios: "chevron.right",
                      android: "chevron_right",
                      web: "chevron_right",
                    }}
                    size={16}
                    tintColor={theme.placeholder}
                  />
                </View>
              </Pressable>
            </NeumorphicCard>
          </View>

          {/* Sync Status */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Cloud Sync
            </ThemedText>
            <NeumorphicCard>
              <Pressable
                onPress={() => router.push("/(tabs)/cloud-sync")}
                style={styles.row}
              >
                <View style={styles.rowLeft}>
                  <ThemedText type="default">Status</ThemedText>
                  <ThemedText
                    type="small"
                    style={{
                      color:
                        isConnected === null
                          ? theme.warning
                          : isConnected
                            ? theme.success
                            : theme.warning,
                    }}
                  >
                    {isConnected === null
                      ? "Checking..."
                      : isConnected
                        ? "Connected"
                        : "Not configured"}
                  </ThemedText>
                </View>
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  size={16}
                  tintColor={theme.placeholder}
                />
              </Pressable>
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <Pressable
                onPress={() => router.push("/(tabs)/cloud-sync")}
                style={styles.row}
              >
                <ThemedText type="default">Last Synced</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDate(lastSynced)}
                </ThemedText>
              </Pressable>
            </NeumorphicCard>
          </View>

          {/* Data Management */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Data
            </ThemedText>
            <NeumorphicCard>
              <Pressable onPress={handleExportData} style={styles.row}>
                <View style={styles.rowLeft}>
                  <ThemedText type="default">Export Data (CSV)</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Download all transactions
                  </ThemedText>
                </View>
                <SymbolView
                  name={{
                    ios: "square.and.arrow.up",
                    android: "share",
                    web: "share",
                  }}
                  size={16}
                  tintColor={theme.primary}
                />
              </Pressable>
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <Pressable onPress={handleClearData} style={styles.row}>
                <ThemedText type="default" style={{ color: theme.danger }}>
                  Clear All Data
                </ThemedText>
                <SymbolView
                  name={{ ios: "trash", android: "delete", web: "delete" }}
                  size={16}
                  tintColor={theme.danger}
                />
              </Pressable>
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <Pressable onPress={handleDeleteAccount} style={styles.row}>
                <View style={styles.rowLeft}>
                  <ThemedText type="default" style={{ color: theme.danger }}>
                    Delete Account
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Permanently remove everything
                  </ThemedText>
                </View>
                <SymbolView
                  name={{
                    ios: "person.badge.minus",
                    android: "person_remove",
                    web: "person_remove",
                  }}
                  size={16}
                  tintColor={theme.danger}
                />
              </Pressable>
            </NeumorphicCard>
          </View>

          {/* Sign Out */}
          <NeumorphicButton
            variant="secondary"
            onPress={handleSignOut}
            style={styles.signOutBtn}
          >
            <ThemedText
              type="default"
              style={{ color: theme.danger, fontWeight: "600" }}
            >
              Sign Out
            </ThemedText>
          </NeumorphicButton>

          {/* App Info */}
          <View style={styles.appInfo}>
            <ThemedText type="small" themeColor="textSecondary">
              PaySmooth v1.0.0
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Built with Expo SDK 56
            </ThemedText>
          </View>

          <View style={{ height: BottomTabInset + Spacing.six }} />
        </ScrollView>
      </View>

      {/* Email Edit Modal */}
      <Modal
        visible={activeModal === "email"}
        animationType="slide"
        transparent
      >
        <View
          style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.modalBackground },
            ]}
          >
            <ThemedText
              type="callout"
              style={{ fontWeight: "700", fontSize: 18 }}
            >
              Change Email
            </ThemedText>
            <NeumorphicInput
              placeholder="New email address"
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              underlineColorAndroid="transparent"
            />
            <View style={styles.modalActions}>
              <Pressable onPress={closeModal} style={styles.modalCancelBtn}>
                <ThemedText type="default">Cancel</ThemedText>
              </Pressable>
              <NeumorphicButton
                onPress={handleUpdateEmail}
                disabled={emailLoading}
                style={[styles.modalSaveBtn, emailLoading && { opacity: 0.5 }]}
              >
                <ThemedText
                  type="default"
                  style={{ color: theme.primaryText, fontWeight: "600" }}
                >
                  {emailLoading ? "Saving..." : "Save"}
                </ThemedText>
              </NeumorphicButton>
            </View>
          </View>
        </View>
      </Modal>

      {/* Password Edit Modal */}
      <Modal
        visible={activeModal === "password"}
        animationType="slide"
        transparent
      >
        <View
          style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.modalBackground },
            ]}
          >
            <ThemedText
              type="callout"
              style={{ fontWeight: "700", fontSize: 18 }}
            >
              Change Password
            </ThemedText>
            <NeumorphicInput
              placeholder="Current password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              underlineColorAndroid="transparent"
            />
            <NeumorphicInput
              placeholder="New password (8+ characters)"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              underlineColorAndroid="transparent"
            />
            <NeumorphicInput
              placeholder="Confirm new password"
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              secureTextEntry
              underlineColorAndroid="transparent"
            />
            <View style={styles.modalActions}>
              <Pressable onPress={closeModal} style={styles.modalCancelBtn}>
                <ThemedText type="default">Cancel</ThemedText>
              </Pressable>
              <NeumorphicButton
                onPress={handleUpdatePassword}
                disabled={passwordLoading}
                style={[
                  styles.modalSaveBtn,
                  passwordLoading && { opacity: 0.5 },
                ]}
              >
                <ThemedText
                  type="default"
                  style={{ color: theme.primaryText, fontWeight: "600" }}
                >
                  {passwordLoading ? "Saving..." : "Save"}
                </ThemedText>
              </NeumorphicButton>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
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
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.two,
  },
  rowLeft: {
    flex: 1,
    gap: 2,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  signOutBtn: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: "center",
  },
  appInfo: {
    alignItems: "center",
    gap: Spacing.half,
    paddingVertical: Spacing.three,
  },
  // Theme picker
  themePicker: {
    flexDirection: "row",
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  themeOption: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: "center",
  },
  // Subscription styles
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  planBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.one,
  },
  planFeatures: {
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    padding: Spacing.five,
    borderTopLeftRadius: Spacing.five,
    borderTopRightRadius: Spacing.five,
    gap: Spacing.three,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.two,
  },
  modalCancelBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
  },
  modalSaveBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
  },
});
