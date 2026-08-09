import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  NeumorphicCard,
  NeumorphicInput,
  NeumorphicPressable,
} from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { getPreference, setPreference } from "@/db/preferences-repo";
import { useTheme } from "@/hooks/use-theme";
import { useAuthStore } from "@/stores/use-auth-store";

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function TaxCalibrationScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [stateRate, setStateRate] = useState("0");
  const [priorYearTax, setPriorYearTax] = useState("0");
  const [currentQuarter, setCurrentQuarter] = useState("1");
  const [safeHarbor, setSafeHarbor] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getPreference(db, user.id, "calibration_state_rate"),
      getPreference(db, user.id, "calibration_prior_year_tax"),
      getPreference(db, user.id, "calibration_current_quarter"),
      getPreference(db, user.id, "calibration_safe_harbor"),
    ]).then(([rate, prior, quarter, harbor]) => {
      setStateRate(rate || "0");
      setPriorYearTax(prior || "0");
      setCurrentQuarter(quarter || "1");
      setSafeHarbor(harbor !== "false");
      setLoaded(true);
    });
  }, [user, db]);

  const persistStateRate = useCallback(
    (val: string) => {
      const sanitized = val.replace(/[^0-9.]/g, "");
      setStateRate(sanitized);
      if (user)
        setPreference(db, user.id, "calibration_state_rate", sanitized || "0");
    },
    [user, db],
  );

  const persistPriorYear = useCallback(
    (val: string) => {
      const sanitized = val.replace(/[^0-9]/g, "");
      setPriorYearTax(sanitized);
      if (user)
        setPreference(
          db,
          user.id,
          "calibration_prior_year_tax",
          sanitized || "0",
        );
    },
    [user, db],
  );

  const persistQuarter = useCallback(
    (q: string) => {
      setCurrentQuarter(q);
      if (user) setPreference(db, user.id, "calibration_current_quarter", q);
    },
    [user, db],
  );

  const persistSafeHarbor = useCallback(
    (val: boolean) => {
      setSafeHarbor(val);
      if (user)
        setPreference(
          db,
          user.id,
          "calibration_safe_harbor",
          val ? "true" : "false",
        );
    },
    [user, db],
  );

  const rateNum = parseFloat(stateRate || "0");

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing.two,
            paddingLeft: insets.left + Spacing.three,
            paddingRight: insets.right + Spacing.three,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
        >
          <SymbolView
            name={{
              ios: "chevron.left",
              android: "arrow_back",
              web: "arrow_back",
            }}
            size={22}
            tintColor={theme.text}
          />
        </Pressable>
        <ThemedText type="title" style={styles.headerTitle}>
          Tax Calibration
        </ThemedText>
      </View>

      <ThemedText style={styles.description} themeColor="textSecondary">
        Fine-tune how the tax engine calculates your estimated quarterly taxes.
        These settings adjust the formula inputs for more accurate projections
        based on your specific situation.
      </ThemedText>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingLeft: insets.left + Spacing.three,
            paddingRight: insets.right + Spacing.three,
            paddingBottom: insets.bottom + Spacing.six,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* State rate card */}
        <NeumorphicCard style={styles.card}>
          <View style={styles.parameterHeader}>
            <ThemedText type="callout" style={{ fontWeight: "600" }}>
              State Income Tax Rate
            </ThemedText>
            <SymbolView
              name={{
                ios: "building.2",
                android: "account_balance",
                web: "account_balance",
              }}
              size={18}
              tintColor={theme.primary}
            />
          </View>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.parameterDesc}
          >
            Your effective state income tax rate as a percentage (e.g., 5 for
            5%). The tax engine applies this on top of federal estimates. Set to
            0 if your state has no income tax.
          </ThemedText>

          <View style={styles.controlRow}>
            <NeumorphicInput
              containerStyle={styles.inputContainer}
              style={styles.input}
              value={stateRate}
              onChangeText={persistStateRate}
              keyboardType="decimal-pad"
              placeholder="0"
            />
            <ThemedText type="title" style={styles.unit}>
              %
            </ThemedText>
          </View>
        </NeumorphicCard>

        {/* Prior year tax card */}
        <NeumorphicCard style={styles.card}>
          <View style={styles.parameterHeader}>
            <ThemedText type="callout" style={{ fontWeight: "600" }}>
              Prior Year Total Tax
            </ThemedText>
            <SymbolView
              name={{
                ios: "doc.text",
                android: "description",
                web: "description",
              }}
              size={18}
              tintColor={theme.primary}
            />
          </View>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.parameterDesc}
          >
            Your total tax liability from the prior year, in cents. Used for
            safe harbor calculations. The IRS safe harbor rule allows you to pay
            100% (110% if AGI {">"} $150K) of this amount to avoid penalties.
          </ThemedText>

          <View style={styles.controlRow}>
            <NeumorphicInput
              containerStyle={styles.inputContainer}
              style={styles.input}
              value={priorYearTax}
              onChangeText={persistPriorYear}
              keyboardType="number-pad"
              placeholder="0"
            />
            <ThemedText type="default" themeColor="textSecondary">
              cents
            </ThemedText>
          </View>
        </NeumorphicCard>

        {/* Current quarter card */}
        <NeumorphicCard style={styles.card}>
          <View style={styles.parameterHeader}>
            <ThemedText type="callout" style={{ fontWeight: "600" }}>
              Current Quarter
            </ThemedText>
            <SymbolView
              name={{ ios: "number", android: "looks_one", web: "looks_one" }}
              size={18}
              tintColor={theme.primary}
            />
          </View>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.parameterDesc}
          >
            Which quarter you're currently estimating. This affects the
            annualization of year-to-date income.
          </ThemedText>

          <View style={styles.quarterRow}>
            {["1", "2", "3", "4"].map((q) => (
              <NeumorphicPressable
                key={q}
                inset={currentQuarter === q}
                onPress={() => persistQuarter(q)}
                style={[
                  styles.quarterBtn,
                  currentQuarter === q && { backgroundColor: theme.primary },
                ]}
              >
                <ThemedText
                  type="default"
                  style={{
                    fontWeight: currentQuarter === q ? "700" : "400",
                    color: currentQuarter === q ? theme.surface : theme.text,
                  }}
                >
                  Q{q}
                </ThemedText>
              </NeumorphicPressable>
            ))}
          </View>
        </NeumorphicCard>

        {/* Safe harbor toggle card */}
        <NeumorphicCard style={styles.card}>
          <View style={styles.parameterHeader}>
            <ThemedText type="callout" style={{ fontWeight: "600" }}>
              Safe Harbor Rule
            </ThemedText>
            <SymbolView
              name={{
                ios: "shield.checkered",
                android: "shield",
                web: "shield",
              }}
              size={18}
              tintColor={safeHarbor ? theme.primary : theme.placeholder}
            />
          </View>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.parameterDesc}
          >
            When enabled, the tax engine uses the lower of your calculated
            quarterly estimate or the safe harbor minimum (100%/110% of prior
            year tax). This prevents penalties even if your estimate is off.
          </ThemedText>

          <View style={styles.toggleRow}>
            <NeumorphicPressable
              inset={safeHarbor}
              onPress={() => persistSafeHarbor(true)}
              style={[
                styles.toggleSide,
                safeHarbor && { backgroundColor: theme.primary },
              ]}
            >
              <ThemedText
                style={{
                  fontWeight: safeHarbor ? "600" : "400",
                  color: safeHarbor ? theme.surface : theme.text,
                }}
              >
                On
              </ThemedText>
            </NeumorphicPressable>
            <NeumorphicPressable
              inset={!safeHarbor}
              onPress={() => persistSafeHarbor(false)}
              style={[
                styles.toggleSide,
                !safeHarbor && { backgroundColor: theme.primary },
              ]}
            >
              <ThemedText
                style={{
                  fontWeight: !safeHarbor ? "600" : "400",
                  color: !safeHarbor ? theme.surface : theme.text,
                }}
              >
                Off
              </ThemedText>
            </NeumorphicPressable>
          </View>
        </NeumorphicCard>

        {/* Summary card */}
        <NeumorphicCard style={styles.card}>
          <ThemedText
            type="callout"
            style={{ fontWeight: "600", marginBottom: Spacing.one }}
          >
            How This Affects Your Estimate
          </ThemedText>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={{ lineHeight: 20 }}
          >
            {safeHarbor
              ? "Safe harbor is active. Your quarterly payment will be the lower of the calculated estimate or the safe harbor minimum based on your prior year tax."
              : "Safe harbor is disabled. Your quarterly payment is based entirely on the calculated estimate using current year income projections."}
            {rateNum > 0
              ? ` A ${rateNum}% state rate is included in the estimate.`
              : " No state tax is included."}
          </ThemedText>
        </NeumorphicCard>
      </ScrollView>
    </ThemedView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  backBtn: {
    padding: Spacing.one,
    marginRight: Spacing.one,
  },
  headerTitle: {
    flex: 1,
  },
  description: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    lineHeight: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  card: {
    borderRadius: 12,
    padding: Spacing.three,
  },
  parameterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.one,
  },
  parameterDesc: {
    lineHeight: 18,
    marginBottom: Spacing.three,
  },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  inputContainer: {
    minWidth: 100,
  },
  input: {
    textAlign: "center",
    fontSize: 24,
    fontWeight: "600",
  },
  unit: {
    fontSize: 24,
    fontWeight: "600",
  },
  quarterRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  quarterBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.two,
    borderRadius: 10,
    padding: 12,
  },
  toggleRow: {
    flexDirection: "row",
    borderRadius: 10,
    overflow: "hidden",
    gap: Spacing.two,
  },
  toggleSide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.two,
    borderRadius: 10,
    padding: 12,
  },
});
