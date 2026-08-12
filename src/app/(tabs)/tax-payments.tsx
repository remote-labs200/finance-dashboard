import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
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
import { useSQLiteContext } from "@/db/provider";
import { getPreference } from "@/db/preferences-repo";
import {
  createTaxPayment,
  deleteTaxPayment,
  findTaxPaymentsByUser,
  getTaxYearPaidCents,
} from "@/db/tax-payment-repo";
import { TaxPayment } from "@/db/schema";
import { useTheme } from "@/hooks/use-theme";
import { formatCurrency, getTodayISO, parseCurrencyInput } from "@/lib/format";
import { useAuthStore } from "@/stores/use-auth-store";
import { useRouter } from "expo-router";

const QUARTER_OPTIONS = [
  { value: 1, label: "Q1" },
  { value: 2, label: "Q2" },
  { value: 3, label: "Q3" },
  { value: 4, label: "Q4" },
  { value: 0, label: "Other" },
] as const;

export default function TaxPaymentsScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const now = new Date();
  const currentYear = now.getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [payments, setPayments] = useState<TaxPayment[]>([]);
  const [yearTotal, setYearTotal] = useState(0);
  const [baseCurrency, setBaseCurrency] = useState("USD");

  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [quarter, setQuarter] = useState<number | null>(null);
  const [paymentDate, setPaymentDate] = useState(getTodayISO());
  const [method, setMethod] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [list, total] = await Promise.all([
        findTaxPaymentsByUser(db, user.id, selectedYear),
        getTaxYearPaidCents(db, user.id, selectedYear),
      ]);
      setPayments(list);
      setYearTotal(total);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("closed")) return;
      console.warn("load tax payments error:", e);
    }
  }, [db, user, selectedYear]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    getPreference(db, user.id, "base_currency").then((value) => {
      if (mounted) setBaseCurrency(value);
    });
    return () => {
      mounted = false;
    };
  }, [db, user]);

  const handleSave = useCallback(async () => {
    if (!user) return;
    const cents = parseCurrencyInput(amount);
    if (cents <= 0) {
      Alert.alert("Invalid Amount", "Enter the amount you paid.");
      return;
    }
    if (!paymentDate.trim()) {
      Alert.alert("Invalid Date", "Enter the payment date (YYYY-MM-DD).");
      return;
    }
    setSaving(true);
    try {
      await createTaxPayment(db, {
        userId: user.id,
        amountCents: cents,
        taxYear: selectedYear,
        quarter: quarter ?? undefined,
        paymentDate: paymentDate.trim(),
        method: method.trim() || undefined,
      });
      setAmount("");
      setQuarter(null);
      setMethod("");
      setShowForm(false);
      await load();
    } catch (e: unknown) {
      Alert.alert(
        "Save Failed",
        e instanceof Error ? e.message : "Could not save the payment.",
      );
    } finally {
      setSaving(false);
    }
  }, [db, user, amount, quarter, paymentDate, method, selectedYear, load]);

  const handleDelete = useCallback(
    (p: TaxPayment) => {
      Alert.alert(
        "Delete Payment",
        "Remove this tax payment? This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await deleteTaxPayment(db, p.id);
              await load();
            },
          },
        ],
      );
    },
    [db, load],
  );

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
            Tax Payments
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
          {/* Year selector */}
          <View style={styles.chipRow}>
            {years.map((y) => {
              const isSelected = selectedYear === y;
              return (
                <NeumorphicPressable
                  key={y}
                  inset={isSelected}
                  onPress={() => setSelectedYear(y)}
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
                    {y}
                  </ThemedText>
                </NeumorphicPressable>
              );
            })}
          </View>

          {/* Paid total */}
          <NeumorphicCard style={styles.totalCard}>
            <ThemedText type="small" themeColor="textSecondary">
              Total estimated-tax paid in {selectedYear}
            </ThemedText>
            <ThemedText type="headline" style={{ color: theme.success }}>
              {formatCurrency(yearTotal, baseCurrency)}
            </ThemedText>
          </NeumorphicCard>

          {/* Add form */}
          {showForm && (
            <NeumorphicCard style={styles.formCard}>
              <ThemedText type="callout" style={{ fontWeight: "600" }}>
                Record a Tax Payment
              </ThemedText>
              <NeumorphicInput
                placeholder="Amount (e.g. 1250.00)"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                underlineColorAndroid="transparent"
              />
              <View style={styles.chipRow}>
                {QUARTER_OPTIONS.map((q) => {
                  const isSelected = quarter === q.value;
                  return (
                    <NeumorphicPressable
                      key={q.value}
                      inset={isSelected}
                      onPress={() => setQuarter(isSelected ? null : q.value)}
                      style={[
                        styles.chip,
                        isSelected && { backgroundColor: theme.primary },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color: isSelected ? theme.surface : theme.text,
                          fontWeight: isSelected ? "600" : "400",
                        }}
                      >
                        {q.label}
                      </ThemedText>
                    </NeumorphicPressable>
                  );
                })}
              </View>
              <NeumorphicInput
                placeholder="Payment date (YYYY-MM-DD)"
                value={paymentDate}
                onChangeText={setPaymentDate}
                autoCapitalize="none"
                underlineColorAndroid="transparent"
              />
              <NeumorphicInput
                placeholder="Method (e.g. IRS Direct Pay) — optional"
                value={method}
                onChangeText={setMethod}
                autoCapitalize="none"
                underlineColorAndroid="transparent"
              />
              <NeumorphicButton
                onPress={handleSave}
                disabled={saving}
                style={saving ? { opacity: 0.6 } : undefined}
              >
                <ThemedText
                  type="default"
                  style={{ color: theme.primaryText, fontWeight: "600" }}
                >
                  {saving ? "Saving…" : "Add Payment"}
                </ThemedText>
              </NeumorphicButton>
            </NeumorphicCard>
          )}

          {/* Payments list */}
          {payments.length > 0 ? (
            payments.map((p) => (
              <NeumorphicCard key={p.id} style={styles.paymentCard}>
                <View style={styles.paymentRow}>
                  <View style={styles.paymentBody}>
                    <ThemedText type="default" style={{ fontWeight: "600" }}>
                      {formatCurrency(p.amountCents, baseCurrency)}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {p.paymentDate}
                      {p.quarter ? ` · Q${p.quarter}` : " · Other"}
                      {p.method ? ` · ${p.method}` : ""}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => handleDelete(p)}
                    style={styles.deleteBtn}
                  >
                    <ThemedText type="small" style={{ color: theme.danger }}>
                      Delete
                    </ThemedText>
                  </Pressable>
                </View>
              </NeumorphicCard>
            ))
          ) : (
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.empty}
            >
              No tax payments recorded for {selectedYear} yet.
            </ThemedText>
          )}

          {!showForm && (
            <NeumorphicButton
              variant="secondary"
              onPress={() => setShowForm(true)}
              style={styles.addBtn}
            >
              <ThemedText type="default" style={{ color: theme.primary }}>
                + Record a Tax Payment
              </ThemedText>
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
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.one },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  totalCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.half,
  },
  formCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  paymentCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  paymentBody: { flex: 1, gap: 1 },
  deleteBtn: { padding: Spacing.one },
  empty: {
    textAlign: "center",
    paddingVertical: Spacing.four,
  },
  addBtn: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: "center",
  },
});
