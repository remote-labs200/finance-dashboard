import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { NeumorphicCard, NeumorphicPressable } from "@/components/ui";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { getPreference, setPreference } from "@/db/preferences-repo";
import { useSQLiteContext } from "@/db/provider";
import { useTheme } from "@/hooks/use-theme";
import { useAuthStore } from "@/stores/use-auth-store";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type FilingStatus = "single" | "married_joint" | "head_of_household";

const FILING_STATUSES: { value: FilingStatus; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "married_joint", label: "Married Filing Jointly" },
  { value: "head_of_household", label: "Head of Household" },
];

const US_STATES = [
  { code: "", name: "No state tax" },
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

const TAX_YEARS = Array.from(
  { length: 5 },
  (_, i) => new Date().getFullYear() - 1 + i,
);

export default function TaxConfigScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [filingStatus, setFilingStatus] = useState<FilingStatus>("single");
  const [selectedState, setSelectedState] = useState("");
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  // Load saved preferences
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      try {
        const [savedStatus, savedState, savedYear] = await Promise.all([
          getPreference(db, user.id, "filing_status"),
          getPreference(db, user.id, "state"),
          getPreference(db, user.id, "tax_year"),
        ]);
        if (!mounted) return;
        setFilingStatus(savedStatus as FilingStatus);
        setSelectedState(savedState);
        setTaxYear(Number(savedYear));
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes("closed")) return;
        console.warn("Failed to load tax preferences:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user, db]);

  const handleSaveFilingStatus = useCallback(
    async (value: FilingStatus) => {
      if (!user) return;
      setFilingStatus(value);
      await setPreference(db, user.id, "filing_status", value);
    },
    [user, db],
  );

  const handleSaveState = useCallback(
    async (code: string) => {
      if (!user) return;
      setSelectedState(code);
      await setPreference(db, user.id, "state", code);
    },
    [user, db],
  );

  const handleSaveTaxYear = useCallback(
    async (year: number) => {
      if (!user) return;
      setTaxYear(year);
      await setPreference(db, user.id, "tax_year", String(year));
    },
    [user, db],
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View
          style={[
            styles.safeArea,
            {
              paddingTop: insets.top + Spacing.three,
              paddingLeft: insets.left,
              paddingRight: insets.right,
            },
          ]}
        >
          <View style={styles.loadingContainer}>
            <ThemedText type="default" themeColor="textSecondary">
              Loading...
            </ThemedText>
          </View>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safeArea}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + Spacing.three },
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
            Tax Configuration
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
          {/* Filing Status */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Filing Status
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.sectionSubtitle}
            >
              Your tax filing status determines your tax brackets and standard
              deduction.
            </ThemedText>
            <NeumorphicCard style={styles.card}>
              {FILING_STATUSES.map((status, index) => (
                <View key={status.value}>
                  <NeumorphicPressable
                    inset={filingStatus === status.value}
                    onPress={() => handleSaveFilingStatus(status.value)}
                    style={styles.optionRow}
                  >
                    <View
                      style={[
                        styles.radio,
                        {
                          borderColor:
                            filingStatus === status.value
                              ? theme.primary
                              : theme.inputBorder,
                          backgroundColor:
                            filingStatus === status.value
                              ? theme.primary
                              : "transparent",
                        },
                      ]}
                    >
                      {filingStatus === status.value && (
                        <SymbolView
                          name={{
                            ios: "checkmark",
                            android: "check",
                            web: "check",
                          }}
                          size={12}
                          tintColor="#fff"
                        />
                      )}
                    </View>
                    <ThemedText
                      type="default"
                      style={{
                        fontWeight:
                          filingStatus === status.value ? "600" : "400",
                      }}
                    >
                      {status.label}
                    </ThemedText>
                  </NeumorphicPressable>
                  {index < FILING_STATUSES.length - 1 && (
                    <View
                      style={[
                        styles.divider,
                        { backgroundColor: theme.divider },
                      ]}
                    />
                  )}
                </View>
              ))}
            </NeumorphicCard>
          </View>

          {/* State */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              State
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.sectionSubtitle}
            >
              Select your state for state income tax estimation.
            </ThemedText>
            <NeumorphicCard style={styles.card}>
              {US_STATES.map((state, index) => (
                <View key={state.code}>
                  <NeumorphicPressable
                    inset={selectedState === state.code}
                    onPress={() => handleSaveState(state.code)}
                    style={styles.optionRow}
                  >
                    <View
                      style={[
                        styles.radio,
                        {
                          borderColor:
                            selectedState === state.code
                              ? theme.primary
                              : theme.inputBorder,
                          backgroundColor:
                            selectedState === state.code
                              ? theme.primary
                              : "transparent",
                        },
                      ]}
                    >
                      {selectedState === state.code && (
                        <SymbolView
                          name={{
                            ios: "checkmark",
                            android: "check",
                            web: "check",
                          }}
                          size={12}
                          tintColor="#fff"
                        />
                      )}
                    </View>
                    <ThemedText
                      type="default"
                      style={{
                        fontWeight:
                          selectedState === state.code ? "600" : "400",
                      }}
                    >
                      {state.name ? state.name : state.code || "Select..."}
                    </ThemedText>
                  </NeumorphicPressable>
                  {index < US_STATES.length - 1 && (
                    <View
                      style={[
                        styles.divider,
                        { backgroundColor: theme.divider },
                      ]}
                    />
                  )}
                </View>
              ))}
            </NeumorphicCard>
          </View>

          {/* Tax Year */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Tax Year
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.sectionSubtitle}
            >
              The tax year for which you are estimating and filing.
            </ThemedText>
            <NeumorphicCard style={styles.card}>
              {TAX_YEARS.map((year, index) => (
                <View key={year}>
                  <NeumorphicPressable
                    inset={taxYear === year}
                    onPress={() => handleSaveTaxYear(year)}
                    style={styles.optionRow}
                  >
                    <View
                      style={[
                        styles.radio,
                        {
                          borderColor:
                            taxYear === year
                              ? theme.primary
                              : theme.inputBorder,
                          backgroundColor:
                            taxYear === year ? theme.primary : "transparent",
                        },
                      ]}
                    >
                      {taxYear === year && (
                        <SymbolView
                          name={{
                            ios: "checkmark",
                            android: "check",
                            web: "check",
                          }}
                          size={12}
                          tintColor="#fff"
                        />
                      )}
                    </View>
                    <ThemedText
                      type="default"
                      style={{ fontWeight: taxYear === year ? "600" : "400" }}
                    >
                      {year}
                      {year === new Date().getFullYear() ? " (Current)" : ""}
                    </ThemedText>
                  </NeumorphicPressable>
                  {index < TAX_YEARS.length - 1 && (
                    <View
                      style={[
                        styles.divider,
                        { backgroundColor: theme.divider },
                      ]}
                    />
                  )}
                </View>
              ))}
            </NeumorphicCard>
          </View>

          <View style={{ height: Spacing.six }} />
        </ScrollView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
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
    paddingTop: Spacing.one,
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
    marginBottom: Spacing.one,
  },
  card: {
    padding: Spacing.two,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    borderRadius: 12,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.five,
  },
});
