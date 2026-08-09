import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { NeumorphicCard, NeumorphicPressable } from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
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
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // --- Handler factory ---

  const navigateTo = useCallback(
    (route: string) => router.push(route as any),
    [router],
  );

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

          {/* ── Section cards ────────────────────────────────────── */}

          {sections.map((section) => (
            <SectionCard key={section.title} {...section} />
          ))}

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
});
