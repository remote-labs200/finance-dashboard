import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  NeumorphicButton,
  NeumorphicInput,
  NeumorphicPressable,
} from "@/components/ui";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { setPreference } from "@/db/preferences-repo";
import { useSQLiteContext } from "@/db/provider";
import { useThemeColors } from "@/hooks/use-theme";
import { useAuthStore } from "@/stores/use-auth-store";
import * as SecureStore from "expo-secure-store";

const STEPS = [
  {
    title: "Welcome to PaySmooth",
    subtitle: "Let's set up your profile in a few quick steps.",
    icon: "sparkles",
  },
  {
    title: "Your Business",
    subtitle: "Tell us about your freelance work.",
    icon: "briefcase",
  },
  {
    title: "Tax Setup",
    subtitle: "Configure your tax settings for accurate estimates.",
    icon: "doc.text",
  },
  {
    title: "Currencies",
    subtitle: "Which currencies do you work with?",
    icon: "dollarsign.circle",
  },
  {
    title: "All Set!",
    subtitle: "You're ready to start tracking your finances.",
    icon: "checkmark.seal",
  },
] as const;

const ENTITY_TYPES = [
  {
    id: "sole_proprietor",
    label: "Sole Proprietor",
    desc: "Individual freelancer",
  },
  { id: "llc", label: "LLC", desc: "Limited Liability Company" },
  { id: "s_corp", label: "S-Corp", desc: "S-Corporation" },
];

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"];

export default function OnboardingScreen() {
  const user = useAuthStore((state) => state.user);
  const db = useSQLiteContext();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);

  // Business info
  const [businessName, setBusinessName] = useState("");
  const [entityType, setEntityType] = useState("sole_proprietor");
  const [stateCode, setStateCode] = useState("");

  // Tax info
  const [filingStatus, setFilingStatus] = useState("single");
  const [taxYear, setTaxYear] = useState(new Date().getFullYear().toString());

  // Currency
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [extraCurrencies, setExtraCurrencies] = useState<string[]>([]);

  const toggleCurrency = useCallback((code: string) => {
    setExtraCurrencies((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }, []);

  const handleFinish = useCallback(async () => {
    if (!user) return;

    // Save settings to database
    await setPreference(
      db,
      user.id,
      "business_legal_name",
      businessName || "My Freelance Business",
    );
    await setPreference(db, user.id, "business_structure", entityType);
    await setPreference(db, user.id, "business_state", stateCode || "none");
    await setPreference(db, user.id, "tax_filing_status", filingStatus);
    await setPreference(db, user.id, "tax_year", taxYear);
    await setPreference(db, user.id, "base_currency", baseCurrency);
    await setPreference(
      db,
      user.id,
      "secondary_currencies",
      extraCurrencies.join(","),
    );

    // Save settings to SecureStore for the onboarding completion flag
    await SecureStore.setItemAsync("onboarding_completed", "true");

    router.replace("/(tabs)" as any);
  }, [
    user,
    db,
    businessName,
    entityType,
    stateCode,
    filingStatus,
    taxYear,
    baseCurrency,
    extraCurrencies,
    router,
  ]);

  const canProceed = () => {
    if (step === 1) return businessName.trim().length > 0;
    if (step === 2) return taxYear.length === 4;
    return true;
  };

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
              paddingBottom: insets.bottom + Spacing.six,
            },
          ]}
        >
          {/* Progress indicator */}
          <View style={styles.progress}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  i <= step && { backgroundColor: colors.primary, width: 24 },
                ]}
              />
            ))}
          </View>

          {/* Step content */}
          <View style={styles.stepContent}>
            <SymbolView
              name={{
                ios: STEPS[step].icon as any,
                android: STEPS[step].icon as any,
                web: STEPS[step].icon as any,
              }}
              size={48}
              tintColor={colors.primary}
            />
            <ThemedText type="title">{STEPS[step].title}</ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              {STEPS[step].subtitle}
            </ThemedText>
          </View>

          {/* Step 0: Welcome */}
          {step === 0 && (
            <View style={styles.stepBody}>
              <ThemedText
                type="default"
                style={[styles.welcomeText, { color: colors.textSecondary }]}
              >
                PaySmooth helps freelancers track income, smooth irregular
                payments, estimate quarterly taxes, and export-ready reports --
                all from your phone.
              </ThemedText>
            </View>
          )}

          {/* Step 1: Business */}
          {step === 1 && (
            <View style={styles.stepBody}>
              <ThemedText type="callout" style={styles.label}>
                Business Name
              </ThemedText>
              <NeumorphicInput
                placeholder="e.g., Acme Design Co"
                value={businessName}
                onChangeText={setBusinessName}
                underlineColorAndroid="transparent"
              />

              <ThemedText type="callout" style={styles.label}>
                Entity Type
              </ThemedText>
              {ENTITY_TYPES.map((et) => (
                <NeumorphicPressable
                  key={et.id}
                  inset
                  onPress={() => setEntityType(et.id)}
                  style={[
                    styles.optionCard,
                    entityType === et.id && {
                      backgroundColor: colors.primary,
                    },
                  ]}
                >
                  <ThemedText
                    type="default"
                    style={{
                      color: entityType === et.id ? colors.surface : undefined,
                      fontWeight: entityType === et.id ? "600" : "400",
                    }}
                  >
                    {et.label}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    themeColor={
                      entityType === et.id ? "primaryText" : "textSecondary"
                    }
                  >
                    {et.desc}
                  </ThemedText>
                </NeumorphicPressable>
              ))}

              <ThemedText type="callout" style={styles.label}>
                State (optional)
              </ThemedText>
              <NeumorphicInput
                placeholder="e.g., CA, NY, TX"
                value={stateCode}
                onChangeText={(t) => setStateCode(t.toUpperCase())}
                maxLength={2}
                underlineColorAndroid="transparent"
              />
            </View>
          )}

          {/* Step 2: Tax */}
          {step === 2 && (
            <View style={styles.stepBody}>
              <ThemedText type="callout" style={styles.label}>
                Filing Status
              </ThemedText>
              {[
                { id: "single", label: "Single" },
                { id: "married_joint", label: "Married Filing Jointly" },
                { id: "head_of_household", label: "Head of Household" },
              ].map((fs) => (
                <NeumorphicPressable
                  key={fs.id}
                  inset
                  onPress={() => setFilingStatus(fs.id)}
                  style={[
                    styles.optionCard,
                    filingStatus === fs.id && {
                      backgroundColor: colors.primary,
                    },
                  ]}
                >
                  <ThemedText
                    type="default"
                    style={{
                      color:
                        filingStatus === fs.id ? colors.surface : undefined,
                      fontWeight: filingStatus === fs.id ? "600" : "400",
                    }}
                  >
                    {fs.label}
                  </ThemedText>
                </NeumorphicPressable>
              ))}

              <ThemedText type="callout" style={styles.label}>
                Tax Year
              </ThemedText>
              <NeumorphicInput
                placeholder={new Date().getFullYear().toString()}
                value={taxYear}
                onChangeText={setTaxYear}
                keyboardType="number-pad"
                maxLength={4}
                underlineColorAndroid="transparent"
              />
            </View>
          )}

          {/* Step 3: Currency */}
          {step === 3 && (
            <View style={styles.stepBody}>
              <ThemedText type="callout" style={styles.label}>
                Base Currency
              </ThemedText>
              <View style={styles.currencyGrid}>
                {COMMON_CURRENCIES.map((code) => (
                  <NeumorphicPressable
                    key={code}
                    inset
                    onPress={() => setBaseCurrency(code)}
                    style={[
                      styles.currencyChip,
                      baseCurrency === code && {
                        backgroundColor: colors.primary,
                      },
                    ]}
                  >
                    <ThemedText
                      type="default"
                      style={{
                        color:
                          baseCurrency === code ? colors.surface : undefined,
                        fontWeight: "600",
                      }}
                    >
                      {code}
                    </ThemedText>
                  </NeumorphicPressable>
                ))}
              </View>

              <ThemedText type="callout" style={styles.label}>
                Additional Currencies (optional)
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={{ marginBottom: Spacing.two }}
              >
                Select any other currencies your clients pay in.
              </ThemedText>
              <View style={styles.currencyGrid}>
                {COMMON_CURRENCIES.filter((c) => c !== baseCurrency).map(
                  (code) => (
                    <NeumorphicPressable
                      key={code}
                      inset
                      onPress={() => toggleCurrency(code)}
                      style={[
                        styles.currencyChip,
                        extraCurrencies.includes(code) && {
                          backgroundColor: colors.primary,
                        },
                      ]}
                    >
                      <ThemedText
                        type="default"
                        style={{
                          color: extraCurrencies.includes(code)
                            ? colors.surface
                            : undefined,
                          fontWeight: "600",
                        }}
                      >
                        {code}
                      </ThemedText>
                    </NeumorphicPressable>
                  ),
                )}
              </View>
            </View>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <View style={styles.stepBody}>
              <ThemedText
                type="default"
                style={[styles.welcomeText, { color: colors.textSecondary }]}
              >
                Here's what you can do now:
              </ThemedText>
              {[
                {
                  icon: "plus.circle",
                  text: "Add your bank accounts and start tracking",
                },
                {
                  icon: "arrow.triangle.2.circlepath",
                  text: "Log income and expenses",
                },
                {
                  icon: "chart.bar",
                  text: "View dashboard with tax estimates",
                },
                {
                  icon: "doc.text",
                  text: "Export reports for your accountant",
                },
              ].map((item, i) => (
                <View key={i} style={styles.featureRow}>
                  <SymbolView
                    name={{
                      ios: item.icon as any,
                      android: item.icon as any,
                      web: item.icon as any,
                    }}
                    size={20}
                    tintColor={colors.success}
                  />
                  <ThemedText type="default">{item.text}</ThemedText>
                </View>
              ))}
            </View>
          )}

          {/* Navigation buttons */}
          <View style={styles.navRow}>
            {step > 0 && (
              <NeumorphicButton
                variant="secondary"
                onPress={() => setStep((s) => s - 1)}
                style={styles.backBtn}
              >
                Back
              </NeumorphicButton>
            )}
            <NeumorphicButton
              onPress={() => {
                if (step < STEPS.length - 1) {
                  setStep((s) => s + 1);
                } else {
                  handleFinish();
                }
              }}
              disabled={step === 1 && !canProceed()}
              style={styles.nextBtn}
            >
              {step === STEPS.length - 1 ? "Get Started" : "Continue"}
            </NeumorphicButton>
          </View>

          {/* Skip */}
          {step < STEPS.length - 1 && (
            <Pressable onPress={handleFinish} style={styles.skipBtn}>
              <ThemedText type="small" themeColor="textSecondary">
                Skip Setup
              </ThemedText>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
    gap: Spacing.three,
  },
  progress: {
    flexDirection: "row",
    gap: Spacing.one,
    justifyContent: "center",
    paddingVertical: Spacing.two,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(128,128,128,0.3)",
  },

  stepContent: {
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  stepBody: {
    gap: Spacing.two,
  },
  welcomeText: {
    lineHeight: 24,
    textAlign: "center",
  },
  label: {
    fontWeight: "600",
    marginTop: Spacing.one,
  },
  input: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  optionCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: 2,
  },

  currencyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  currencyChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    minWidth: 60,
    alignItems: "center",
  },

  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  navRow: {
    flexDirection: "row",
    gap: Spacing.two,
    paddingTop: Spacing.four,
  },
  backBtn: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  nextBtn: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: "center",
  },
  nextBtnDisabled: {
    backgroundColor: "rgba(128,128,128,0.3)",
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: Spacing.two,
  },
});
