import { useFocusEffect, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
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
import { getPreference, setPreference } from "@/db/preferences-repo";
import { useSQLiteContext } from "@/db/provider";
import { findTransactionsByUser } from "@/db/transaction-repo";
import { sendTransactionalEmail, syncMarketingContact } from "@/lib/email-service";
import { downloadTextFile } from "@/lib/export-utils";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/lib/supabase";
import { checkSupabaseConnection, getLastSyncedAt } from "@/lib/sync-service";
import { useAuthStore } from "@/stores/use-auth-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubMenuItem {
  icon: React.ComponentProps<typeof SymbolView>["name"];
  label: string;
  description: string;
  onPress: () => void;
}

interface SectionGroup {
  icon: React.ComponentProps<typeof SymbolView>["name"];
  title: string;
  items: SubMenuItem[];
}

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

// ---------------------------------------------------------------------------
// Reusable row components
// ---------------------------------------------------------------------------

function SubMenuRow({ icon, label, description, onPress }: SubMenuItem) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
    >
      <SymbolView name={icon} size={22} tintColor={theme.text} />
      <View style={styles.rowBody}>
        <ThemedText type="default" style={{ fontWeight: "500" }}>
          {label}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {description}
        </ThemedText>
      </View>
      <SymbolView
        name={{
          ios: "chevron.right",
          android: "chevron_right",
          web: "chevron_right",
        }}
        size={14}
        tintColor={theme.placeholder}
      />
    </Pressable>
  );
}

function SectionDivider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.divider }]} />;
}

function SectionCard({ icon, title, items }: SectionGroup) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      {/* Section header with icon */}
      <View style={styles.sectionHeader}>
        <SymbolView name={icon} size={18} tintColor={theme.primary} />
        <ThemedText type="callout" style={styles.sectionTitle}>
          {title}
        </ThemedText>
      </View>

      {/* Card body */}
      <NeumorphicCard style={styles.card}>
        {items.map((item, idx) => (
          <View key={item.label}>
            {idx > 0 && <SectionDivider />}
            <SubMenuRow {...item} />
          </View>
        ))}
      </NeumorphicCard>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function AccountScreen() {
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const updateEmail = useAuthStore((state) => state.updateEmail);
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();

  const [activeModal, setActiveModal] = useState<
    "email" | "password" | null
  >(null);
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [marketingConsent, setMarketingConsent] = useState(false);

  // --- Handler factory ---

  const navigateTo = useCallback(
    (route: string) => router.push(route as any),
    [router],
  );

  const loadAccountStatus = useCallback(async () => {
    if (!user) return;
    try {
      const [connected, marketing = "false"] = await Promise.all([
        checkSupabaseConnection(),
        getPreference(db, user.id, "marketing_consent"),
      ]);
      setMarketingConsent(marketing === "true");
      setIsConnected(connected);
      if (connected) {
        const last = await getLastSyncedAt(db);
        setLastSynced(last);
      } else {
        setLastSynced(null);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("closed")) return;
      console.warn("Failed to load account status:", e);
    }
  }, [db, user]);

  const handleMarketingToggle = useCallback(
    async (value: boolean) => {
      if (!user) return;
      setMarketingConsent(value);
      try {
        // Persist consent first so the edge function honours it.
        await setPreference(
          db,
          user.id,
          "marketing_consent",
          value ? "true" : "false",
        );
        // Subscribe on opt-in; remove the contact on opt-out.
        await syncMarketingContact({
          email: user.email ?? undefined,
          optOut: !value,
        });
      } catch (e: unknown) {
        console.warn("Failed to update marketing preference:", e);
      }
    },
    [db, user],
  );

  // Refresh live values (sync status) on focus so they
  // reflect changes made in sub-screens.
  useFocusEffect(
    useCallback(() => {
      loadAccountStatus();
    }, [loadAccountStatus]),
  );

  const handleUpdateEmail = useCallback(async () => {
    if (!newEmail.trim() || !newEmail.includes("@")) {
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
      const header =
        "Date,Amount,Note,Category,Account,Currency";
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
      const fileName = `paysmooth-export-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      await downloadTextFile(
        fileName,
        csv,
        "text/csv",
        "Export Transactions",
      );
    } catch (e: any) {
      if (e?.message === "User did not share") return;
      Alert.alert("Export Error", e?.message ?? "Failed to export data.");
    }
  }, [db, user]);

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
                      // Delete the auth account first (while the session is
                      // still valid) — this revokes it server-side.
                      if (supabase) {
                        const { error } = await supabase.rpc(
                          "delete_user_account",
                        );
                        if (error) {
                          console.warn(
                            "Account deletion RPC failed:",
                            error.message,
                          );
                        }
                        await supabase.auth.signOut();
                      }

                      // Clear local cache
                      await db.execAsync(`
                        DELETE FROM transactions;
                        DELETE FROM accounts;
                        DELETE FROM categories;
                        DELETE FROM tax_settings;
                        DELETE FROM user_preferences;
                        DELETE FROM users;
                        DELETE FROM sync_log;
                      `);

                      setActiveModal(null);
                      Alert.alert(
                        "Account Deleted",
                        supabase
                          ? "Your account has been deleted. You will be signed out."
                          : "Local data cleared. Since Supabase is not configured, there is no cloud account to delete.",
                      );
                      router.replace("/(auth)/sign-in");
                    } catch (e: any) {
                      Alert.alert(
                        "Error",
                        e?.message ?? "Failed to delete account.",
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
  }, [db, supabase, router]);

  const handleSignOut = useCallback(() => {
    Alert.alert("Log Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/sign-in");
        },
      },
    ]);
  }, [signOut, router]);

  // --- Section data -------------------------------------------------------

  const sections: SectionGroup[] = [
    {
      icon: { ios: "person.circle", android: "person", web: "person" },
      title: "Account & Freelancer Profile",
      items: [
        {
          icon: {
            ios: "person.text.rectangle",
            android: "badge",
            web: "badge",
          },
          label: "Personal Profile",
          description: "Legal name, email, business phone, and avatar.",
          onPress: () => navigateTo("/(tabs)/personal-profile"),
        },
        {
          icon: {
            ios: "building.columns",
            android: "business",
            web: "business",
          },
          label: "Business Information",
          description:
            "Legal business name, structure, and registration numbers.",
          onPress: () => navigateTo("/(tabs)/business-info"),
        },
        {
          icon: {
            ios: "doc.text.magnifyingglass",
            android: "receipt_long",
            web: "receipt_long",
          },
          label: "Tax Profile",
          description: "Local tax residency jurisdiction selection.",
          onPress: () => navigateTo("/(tabs)/tax-profile"),
        },
        {
          icon: {
            ios: "calendar",
            android: "calendar_month",
            web: "calendar_month",
          },
          label: "Accounting Year",
          description: "Custom financial year start date settings.",
          onPress: () => navigateTo("/(tabs)/accounting-year"),
        },
      ],
    },
    {
      icon: { ios: "paintbrush", android: "palette", web: "palette" },
      title: "Customization",
      items: [
        {
          icon: {
            ios: "sun.max",
            android: "brightness_6",
            web: "brightness_6",
          },
          label: "App Theme",
          description:
            "Light, dark, or system theme with haptic feedback settings.",
          onPress: () => navigateTo("/(tabs)/app-theme"),
        },
        {
          icon: {
            ios: "rectangle.3.group",
            android: "view_quilt",
            web: "view_quilt",
          },
          label: "Navbar Position",
          description: "Move tab bar to the top or keep it at the bottom.",
          onPress: () => navigateTo("/(tabs)/navbar-position"),
        },
        {
          icon: {
            ios: "textformat.size",
            android: "format_size",
            web: "format_size",
          },
          label: "Font Size & Style",
          description: "Adjust text size scaling and preview changes live.",
          onPress: () => navigateTo("/(tabs)/font-size-style"),
        },
      ],
    },
    {
      icon: {
        ios: "dollarsign.circle",
        android: "attach_money",
        web: "attach_money",
      },
      title: "Financial Core & Currencies",
      items: [
        {
          icon: {
            ios: "dollarsign.circle.fill",
            android: "payments",
            web: "payments",
          },
          label: "Base Currency",
          description: "Main accounting currency for dashboard calculations.",
          onPress: () => navigateTo("/(tabs)/base-currency"),
        },
        {
          icon: {
            ios: "coloncurrencysign.circle",
            android: "currency_exchange",
            web: "currency_exchange",
          },
          label: "Secondary Currencies",
          description:
            "Toggle active currencies for irregular foreign incoming revenue.",
          onPress: () => navigateTo("/(tabs)/secondary-currencies"),
        },
        {
          icon: {
            ios: "arrow.up.arrow.down",
            android: "swap_vert",
            web: "swap_vert",
          },
          label: "Live Exchange Rates",
          description: "Manual override rates vs automatic internet API sync.",
          onPress: () => navigateTo("/(tabs)/exchange-rates"),
        },
        {
          icon: {
            ios: "chart.pie",
            android: "donut_small",
            web: "donut_small",
          },
          label: "Safe Monthly Pay Algorithm",
          description: "Custom volatility buffers and cash reserve targets.",
          onPress: () => navigateTo("/(tabs)/safe-monthly-pay"),
        },
        {
          icon: { ios: "slider.horizontal.3", android: "tune", web: "tune" },
          label: "Tax Estimate Calibration",
          description:
            "Localized income brackets and self-employment tax rate manual adjusters.",
          onPress: () => navigateTo("/(tabs)/tax-calibration"),
        },
      ],
    },
    {
      icon: {
        ios: "arrow.triangle.2.circlepath",
        android: "sync",
        web: "sync",
      },
      title: "Integrations & Sync",
      items: [
        {
          icon: {
            ios: "building.2",
            android: "account_balance",
            web: "account_balance",
          },
          label: "Bank Connections",
          description:
            "Bank data feed sync aggregators using secure Open Banking APIs.",
          onPress: () => navigateTo("/(tabs)/bank-connections"),
        },
        {
          icon: { ios: "icloud", android: "cloud_sync", web: "cloud_sync" },
          label: "Multi-Device Sync",
          description: "Expo cloud synchronization engine configurations.",
          onPress: () => navigateTo("/(tabs)/cloud-sync"),
        },
        {
          icon: {
            ios: "doc.text.fill",
            android: "description",
            web: "description",
          },
          label: "Invoicing Integrations",
          description:
            "Linked third-party payment gateways for client invoicing.",
          onPress: () => navigateTo("/(tabs)/invoicing-integrations"),
        },
        {
          icon: { ios: "square.and.arrow.up", android: "share", web: "share" },
          label: "Export Ledger",
          description:
            "Raw data downloads in CSV, XLSX, or tax-ready PDF formats.",
          onPress: () => navigateTo("/(tabs)/export-ledger"),
        },
      ],
    },
    {
      icon: { ios: "gearshape.2", android: "settings", web: "settings" },
      title: "Automation & Tools",
      items: [
        {
          icon: {
            ios: "doc.viewfinder",
            android: "document_scanner",
            web: "document_scanner",
          },
          label: "Receipt OCR Settings",
          description:
            "Auto-categorization toggles and storage compression levels.",
          onPress: () => navigateTo("/(tabs)/receipt-ocr-settings"),
        },
        {
          icon: {
            ios: "sparkles",
            android: "auto_awesome",
            web: "auto_awesome",
          },
          label: "AI Financial Insights",
          description:
            "Frequency toggles for automated cash-flow anomaly alerts.",
          onPress: () => navigateTo("/(tabs)/ai-financial-insights"),
        },
        {
          icon: {
            ios: "car",
            android: "directions_car",
            web: "directions_car",
          },
          label: "Mileage Tracker Settings",
          description:
            "GPS background permissions, vehicle profiles, and rate per mile tracking.",
          onPress: () => navigateTo("/(tabs)/mileage-tracker-settings"),
        },
        {
          icon: {
            ios: "chart.line.uptrend.xyaxis",
            android: "trending_up",
            web: "trending_up",
          },
          label: "Cash Flow Forecasting",
          description:
            "Time-horizon parameters spanning 3, 6, or 12 months ahead.",
          onPress: () => navigateTo("/(tabs)/cash-flow-forecasting"),
        },
      ],
    },
    {
      icon: { ios: "lock.shield", android: "security", web: "security" },
      title: "Privacy & Security",
      items: [
        {
          icon: { ios: "faceid", android: "fingerprint", web: "fingerprint" },
          label: "Biometric Lock",
          description: "Face ID or Touch ID security passcodes.",
          onPress: () => navigateTo("/(tabs)/biometric-lock"),
        },
        {
          icon: {
            ios: "checkmark.shield",
            android: "verified_user",
            web: "verified_user",
          },
          label: "Two-Factor Auth",
          description:
            "Secure secondary token authentication configuration panels.",
          onPress: () => navigateTo("/(tabs)/two-factor-auth"),
        },
        {
          icon: { ios: "key.fill", android: "key", web: "key" },
          label: "Data Encryption Key",
          description: "Self-custody or cloud-managed data security keys.",
          onPress: () => navigateTo("/(tabs)/data-encryption-key"),
        },
        {
          icon: {
            ios: "clock.badge.checkmark",
            android: "history",
            web: "history",
          },
          label: "Security Logs",
          description: "Recent security activity and authentication history.",
          onPress: () => navigateTo("/(tabs)/security-logs"),
        },
        {
          icon: {
            ios: "laptopcomputer.and.iphone",
            android: "devices_other",
            web: "devices_other",
          },
          label: "Connected Devices",
          description: "IP addresses, locations, device type, and model info.",
          onPress: () => navigateTo("/(tabs)/connected-devices"),
        },
      ],
    },
    {
      icon: { ios: "info.circle", android: "info", web: "info" },
      title: "Legal, Support & Version",
      items: [
        {
          icon: { ios: "questionmark.circle", android: "help", web: "help" },
          label: "Help & Tax FAQs",
          description:
            "Freelancer specific tax-deduction guidelines documentation.",
          onPress: () => navigateTo("/(tabs)/help-faqs"),
        },
        {
          icon: { ios: "doc.text", android: "article", web: "article" },
          label: "Terms & Privacy",
          description:
            "Freelancer data privacy terms and security compliance statements.",
          onPress: () => navigateTo("/(tabs)/terms-privacy"),
        },
        {
          icon: {
            ios: "iphone",
            android: "phone_android",
            web: "phone_android",
          },
          label: "App Version",
          description: "Active app release tracking numbers.",
          onPress: () => navigateTo("/(tabs)/app-version"),
        },
      ],
    },
  ];

  const userInitial = (user?.email ?? "?").charAt(0).toUpperCase();

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
          {/* ── Header ───────────────────────────────────────────── */}

          <ThemedText type="title">Account</ThemedText>

          {/* ── Profile card ─────────────────────────────────────── */}

          <NeumorphicCard style={styles.profileCard}>
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <ThemedText
                style={{
                  color: theme.primaryText,
                  fontSize: 24,
                  fontWeight: "700",
                }}
              >
                {userInitial}
              </ThemedText>
            </View>
            <View style={styles.profileInfo}>
              <ThemedText
                type="default"
                style={{ fontWeight: "600", fontSize: 17 }}
              >
                {user?.email?.split("@")[0] ?? "User"}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {user?.email ?? "Not signed in"}
              </ThemedText>
            </View>
          </NeumorphicCard>

          {/* ── Account actions ─────────────────────────────────── */}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <SymbolView
                name={{
                  ios: "person.crop.circle.badge.checkmark",
                  android: "manage_accounts",
                  web: "manage_accounts",
                }}
                size={18}
                tintColor={theme.primary}
              />
              <ThemedText type="callout" style={styles.sectionTitle}>
                Account
              </ThemedText>
            </View>
            <NeumorphicCard style={styles.card}>
              <Pressable
                onPress={() => {
                  setNewEmail(user?.email ?? "");
                  setActiveModal("email");
                }}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <SymbolView
                  name={{ ios: "envelope", android: "mail", web: "mail" }}
                  size={22}
                  tintColor={theme.text}
                />
                <View style={styles.rowBody}>
                  <ThemedText type="default" style={{ fontWeight: "500" }}>
                    Email
                  </ThemedText>
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    numberOfLines={1}
                  >
                    {user?.email ?? "Not signed in"}
                  </ThemedText>
                </View>
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  size={14}
                  tintColor={theme.placeholder}
                />
              </Pressable>
              <SectionDivider />
              <Pressable
                onPress={() => setActiveModal("password")}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <SymbolView
                  name={{ ios: "lock", android: "lock", web: "lock" }}
                  size={22}
                  tintColor={theme.text}
                />
                <View style={styles.rowBody}>
                  <ThemedText type="default" style={{ fontWeight: "500" }}>
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
                  size={14}
                  tintColor={theme.placeholder}
                />
              </Pressable>
              <SectionDivider />
              <Pressable
                onPress={() => navigateTo("/(tabs)/notification-preferences")}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <SymbolView
                  name={{
                    ios: "bell",
                    android: "notifications",
                    web: "notifications",
                  }}
                  size={22}
                  tintColor={theme.text}
                />
                <View style={styles.rowBody}>
                  <ThemedText type="default" style={{ fontWeight: "500" }}>
                    Notifications
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Manage alert types and reminders
                  </ThemedText>
                </View>
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  size={14}
                  tintColor={theme.placeholder}
                />
              </Pressable>
              <SectionDivider />
              <View style={styles.row}>
                <SymbolView
                  name={{
                    ios: "envelope.badge",
                    android: "mail",
                    web: "mail",
                  }}
                  size={22}
                  tintColor={theme.text}
                />
                <View style={styles.rowBody}>
                  <ThemedText type="default" style={{ fontWeight: "500" }}>
                    Marketing Emails
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Tax tips, product news & newsletter
                  </ThemedText>
                </View>
                <Switch
                  value={marketingConsent}
                  onValueChange={handleMarketingToggle}
                  trackColor={{
                    false: theme.inputBorder,
                    true: theme.primary,
                  }}
                />
              </View>
            </NeumorphicCard>
          </View>

          {/* ── Section cards ────────────────────────────────────── */}

          {sections.map((section) => (
            <SectionCard key={section.title} {...section} />
          ))}

          {/* ── Data & Sync ──────────────────────────────────────── */}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <SymbolView
                name={{ ios: "internaldrive", android: "storage", web: "storage" }}
                size={18}
                tintColor={theme.primary}
              />
              <ThemedText type="callout" style={styles.sectionTitle}>
                Data & Sync
              </ThemedText>
            </View>
            <NeumorphicCard style={styles.card}>
              <Pressable
                onPress={() => navigateTo("/(tabs)/cloud-sync")}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <SymbolView
                  name={{
                    ios: "arrow.triangle.2.circlepath",
                    android: "sync",
                    web: "sync",
                  }}
                  size={22}
                  tintColor={theme.text}
                />
                <View style={styles.rowBody}>
                  <ThemedText type="default" style={{ fontWeight: "500" }}>
                    Cloud Sync
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {isConnected === null
                      ? "Checking connection…"
                      : isConnected
                        ? `Connected · last synced ${formatDate(lastSynced)}`
                        : "Not configured"}
                  </ThemedText>
                </View>
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  size={14}
                  tintColor={theme.placeholder}
                />
              </Pressable>
              <SectionDivider />
              <Pressable
                onPress={handleExportData}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <SymbolView
                  name={{
                    ios: "square.and.arrow.up",
                    android: "ios_share",
                    web: "ios_share",
                  }}
                  size={22}
                  tintColor={theme.text}
                />
                <View style={styles.rowBody}>
                  <ThemedText type="default" style={{ fontWeight: "500" }}>
                    Export Data (CSV)
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Download all transactions
                  </ThemedText>
                </View>
              </Pressable>
              <SectionDivider />
              <Pressable
                onPress={handleClearData}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <SymbolView
                  name={{ ios: "trash", android: "delete", web: "delete" }}
                  size={22}
                  tintColor={theme.danger}
                />
                <View style={styles.rowBody}>
                  <ThemedText
                    type="default"
                    style={{ fontWeight: "500", color: theme.danger }}
                  >
                    Clear All Data
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Delete transactions, accounts, and categories
                  </ThemedText>
                </View>
              </Pressable>
              <SectionDivider />
              <Pressable
                onPress={handleDeleteAccount}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <SymbolView
                  name={{
                    ios: "person.badge.minus",
                    android: "person_remove",
                    web: "person_remove",
                  }}
                  size={22}
                  tintColor={theme.danger}
                />
                <View style={styles.rowBody}>
                  <ThemedText
                    type="default"
                    style={{ fontWeight: "500", color: theme.danger }}
                  >
                    Delete Account
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Permanently remove everything
                  </ThemedText>
                </View>
              </Pressable>
            </NeumorphicCard>
          </View>

          {/* ── Log Out ──────────────────────────────────────────── */}

          <NeumorphicPressable
            onPress={handleSignOut}
            style={styles.signOutBtn}
          >
            <SymbolView
              name={{
                ios: "arrow.backward.circle",
                android: "logout",
                web: "logout",
              }}
              size={20}
              tintColor={theme.danger}
            />
            <ThemedText
              type="default"
              style={{ color: theme.danger, fontWeight: "600" }}
            >
              Log Out
            </ThemedText>
          </NeumorphicPressable>

          {/* ── Footer ───────────────────────────────────────────── */}

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

      {/* ── Change Email Modal ─────────────────────────────────── */}
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

      {/* ── Change Password Modal ──────────────────────────────── */}
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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

  /* Profile ------------------------------------------------------------- */
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.three,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },

  /* Section ------------------------------------------------------------- */
  section: {
    gap: Spacing.one,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingLeft: Spacing.half,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  card: {
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },

  /* Row ----------------------------------------------------------------- */
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  rowBody: {
    flex: 1,
    gap: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 22 + Spacing.three,
  },

  /* Sign Out ------------------------------------------------------------ */
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },

  /* Footer -------------------------------------------------------------- */
  appInfo: {
    alignItems: "center",
    gap: Spacing.half,
    paddingVertical: Spacing.three,
  },

  /* Modal --------------------------------------------------------------- */
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
