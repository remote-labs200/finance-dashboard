import { useRouter } from "expo-router";
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
import { useAuthStore } from "@/stores/use-auth-store";
import {
  createRecurringTransaction,
  deleteRecurringTransaction,
  findRecurringTransactions,
  generateRecurringTransactions,
} from "@/db/recurring-transaction-repo";
import { findAccountsByUser } from "@/db/account-repo";
import { findCategoriesByUser } from "@/db/category-repo";
import { Account, Category, RecurringTransaction } from "@/db/schema";
import { useTheme } from "@/hooks/use-theme";
import { parseCurrencyInput } from "@/lib/format";

const FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"] as const;

export default function RecurringTransactionsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const user = useAuthStore((s) => s.user);

  const [templates, setTemplates] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [isIncome, setIsIncome] = useState(true);
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] =
    useState<RecurringTransaction["frequency"]>("monthly");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState("");
  const [timesPlanned, setTimesPlanned] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const loadTemplates = useCallback(async () => {
    if (!user) return;
    try {
      const data = await findRecurringTransactions(db, user.id);
      setTemplates(data);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("closed")) return;
      console.warn("load recurring error:", e);
    } finally {
      setLoading(false);
    }
  }, [db, user]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [accs, cats] = await Promise.all([
        findAccountsByUser(db, user.id),
        findCategoriesByUser(db, user.id),
      ]);
      setAccounts(accs);
      setCategories(cats);
    })();
  }, [db, user]);

  const handleAdd = useCallback(async () => {
    if (!user || !name.trim()) return;
    const cents = parseCurrencyInput(amount);
    if (cents <= 0) {
      Alert.alert("Invalid Amount", "Enter an amount greater than zero.");
      return;
    }
    setSaving(true);
    try {
      await createRecurringTransaction(db, {
        userId: user.id,
        name: name.trim(),
        isIncome,
        amountCents: cents,
        categoryId: categoryId ?? undefined,
        accountId: accountId ?? undefined,
        frequency,
        startDate: startDate.trim(),
        endDate: endDate.trim() || undefined,
        timesPlanned: timesPlanned
          ? parseInt(timesPlanned, 10) || undefined
          : undefined,
      });

      setName("");
      setAmount("");
      setEndDate("");
      setTimesPlanned("");
      setCategoryId(null);
      setAccountId(null);
      setShowForm(false);
      await loadTemplates();
    } catch (e: unknown) {
      Alert.alert(
        "Save Failed",
        e instanceof Error ? e.message : "Could not save the template.",
      );
    } finally {
      setSaving(false);
    }
  }, [
    db,
    user,
    name,
    isIncome,
    amount,
    categoryId,
    accountId,
    frequency,
    startDate,
    endDate,
    timesPlanned,
    loadTemplates,
  ]);

  const handleGenerate = useCallback(async () => {
    if (!user || generating) return;
    setGenerating(true);
    try {
      const created = await generateRecurringTransactions(db, user.id);
      await loadTemplates();
      Alert.alert(
        "Recurring Transactions",
        created > 0
          ? `Created ${created} transaction${created !== 1 ? "s" : ""} from your templates.`
          : "No transactions were due yet. Run again later, or check your templates.",
      );
    } catch (e: unknown) {
      Alert.alert(
        "Generate Failed",
        e instanceof Error ? e.message : "Could not generate transactions.",
      );
    } finally {
      setGenerating(false);
    }
  }, [db, user, generating, loadTemplates]);

  const handleDelete = useCallback(
    (tpl: RecurringTransaction) => {
      Alert.alert(
        "Delete Template",
        `Delete "${tpl.name}"? Future transactions will not be generated.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await deleteRecurringTransaction(db, tpl.id);
              await loadTemplates();
            },
          },
        ],
      );
    },
    [db, loadTemplates],
  );

  const incomeCategories = categories.filter((c) => c.isIncome);
  const expenseCategories = categories.filter((c) => !c.isIncome);
  const shownCategories = isIncome ? incomeCategories : expenseCategories;

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
            Recurring Transactions
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
          {/* Info banner */}
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
              Set up automatic income or expenses (retainers, subscriptions,
              rent). Tap "Generate" to create any transactions that are due,
              and they'll count toward your income smoothing automatically.
            </ThemedText>
          </View>

          {/* Generate button */}
          {templates.length > 0 && (
            <NeumorphicButton
              onPress={handleGenerate}
              disabled={generating}
              style={styles.generateBtn}
            >
              <ThemedText
                type="default"
                style={{ color: theme.primaryText, fontWeight: "600" }}
              >
                {generating ? "Generating…" : "Generate Due Transactions"}
              </ThemedText>
            </NeumorphicButton>
          )}

          {/* Templates list */}
          {loading ? (
            <ThemedText type="small" themeColor="textSecondary">
              Loading templates…
            </ThemedText>
          ) : templates.length === 0 ? (
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.empty}
            >
              No recurring templates yet. Add your first one below.
            </ThemedText>
          ) : (
            templates.map((tpl) => (
              <NeumorphicCard key={tpl.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <ThemedText
                    type="default"
                    style={{ flex: 1, fontWeight: "600" }}
                  >
                    {tpl.name}
                  </ThemedText>
                  <NeumorphicPressable
                    onPress={() => handleDelete(tpl)}
                    style={styles.deleteBtn}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: theme.danger }}
                    >
                      Delete
                    </ThemedText>
                  </NeumorphicPressable>
                </View>
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                >
                  {tpl.isIncome ? "Income" : "Expense"} ·{" "}
                  {tpl.frequency.charAt(0).toUpperCase() +
                    tpl.frequency.slice(1)}
                </ThemedText>
                <ThemedText type="headline" style={{ color: theme.text }}>
                  {tpl.isIncome
                    ? "+"
                    : "-"}
                  {((tpl.amountCents / 100).toFixed(2))}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Next: {tpl.nextRunDate} · Ran {tpl.timesRun}
                  {tpl.timesPlanned ? `/${tpl.timesPlanned}` : ""} times
                </ThemedText>
              </NeumorphicCard>
            ))
          )}

          {/* Add form toggle */}
          {!showForm && (
            <NeumorphicButton
              variant="secondary"
              onPress={() => setShowForm(true)}
              style={styles.addToggleBtn}
            >
              <ThemedText type="default" style={{ color: theme.primary }}>
                + Add Recurring Template
              </ThemedText>
            </NeumorphicButton>
          )}

          {/* Add form */}
          {showForm && (
            <NeumorphicCard style={styles.formCard}>
              <ThemedText type="callout" style={{ fontWeight: "600" }}>
                New Recurring Template
              </ThemedText>

              <View style={styles.toggleRow}>
                <NeumorphicPressable
                  inset={!isIncome}
                  onPress={() => setIsIncome(false)}
                  style={[
                    styles.toggleBtn,
                    !isIncome && { backgroundColor: theme.danger },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: !isIncome ? theme.primaryText : theme.danger,
                    }}
                  >
                    Expense
                  </ThemedText>
                </NeumorphicPressable>
                <NeumorphicPressable
                  inset={isIncome}
                  onPress={() => setIsIncome(true)}
                  style={[
                    styles.toggleBtn,
                    isIncome && { backgroundColor: theme.success },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: isIncome ? theme.primaryText : theme.success,
                    }}
                  >
                    Income
                  </ThemedText>
                </NeumorphicPressable>
              </View>

              <NeumorphicInput
                placeholder="Name (e.g. Client retainer)"
                value={name}
                onChangeText={setName}
                underlineColorAndroid="transparent"
              />

              <NeumorphicInput
                placeholder="Amount (e.g. 1200.00)"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                underlineColorAndroid="transparent"
              />

              {/* Frequency */}
              <View style={styles.freqRow}>
                {FREQUENCIES.map((f) => {
                  const selected = frequency === f;
                  return (
                    <NeumorphicPressable
                      key={f}
                      inset={selected}
                      onPress={() => setFrequency(f)}
                      style={[
                        styles.freqChip,
                        selected && { backgroundColor: theme.primary },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color: selected ? theme.primaryText : theme.text,
                          fontWeight: selected ? "600" : "400",
                        }}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </ThemedText>
                    </NeumorphicPressable>
                  );
                })}
              </View>

              <NeumorphicInput
                placeholder="Start date (YYYY-MM-DD)"
                value={startDate}
                onChangeText={setStartDate}
                autoCapitalize="none"
                underlineColorAndroid="transparent"
              />
              <NeumorphicInput
                placeholder="End date (optional, YYYY-MM-DD)"
                value={endDate}
                onChangeText={setEndDate}
                autoCapitalize="none"
                underlineColorAndroid="transparent"
              />
              <NeumorphicInput
                placeholder="Times to run (optional, leave empty for unlimited)"
                value={timesPlanned}
                onChangeText={setTimesPlanned}
                keyboardType="number-pad"
                underlineColorAndroid="transparent"
              />

              {/* Category */}
              <ThemedText type="small" themeColor="textSecondary">
                Category (optional)
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                <NeumorphicPressable
                  inset={categoryId === null}
                  onPress={() => setCategoryId(null)}
                  style={styles.chip}
                >
                  <ThemedText type="small">None</ThemedText>
                </NeumorphicPressable>
                {shownCategories.map((c) => (
                  <NeumorphicPressable
                    key={c.id}
                    inset={categoryId === c.id}
                    onPress={() => setCategoryId(c.id)}
                    style={[
                      styles.chip,
                      categoryId === c.id && { backgroundColor: theme.primary },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{
                        color:
                          categoryId === c.id
                            ? theme.primaryText
                            : theme.text,
                      }}
                    >
                      {c.name}
                    </ThemedText>
                  </NeumorphicPressable>
                ))}
              </ScrollView>

              {/* Account */}
              {accounts.length > 0 && (
                <>
                  <ThemedText type="small" themeColor="textSecondary">
                    Account (optional)
                  </ThemedText>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                  >
                    <NeumorphicPressable
                      inset={accountId === null}
                      onPress={() => setAccountId(null)}
                      style={styles.chip}
                    >
                      <ThemedText type="small">None</ThemedText>
                    </NeumorphicPressable>
                    {accounts.map((a) => (
                      <NeumorphicPressable
                        key={a.id}
                        inset={accountId === a.id}
                        onPress={() => setAccountId(a.id)}
                        style={[
                          styles.chip,
                          accountId === a.id && { backgroundColor: theme.primary },
                        ]}
                      >
                        <ThemedText
                          type="small"
                          style={{
                            color:
                              accountId === a.id
                                ? theme.primaryText
                                : theme.text,
                          }}
                        >
                          {a.name}
                        </ThemedText>
                      </NeumorphicPressable>
                    ))}
                  </ScrollView>
                </>
              )}

              <View style={styles.formActions}>
                <NeumorphicButton
                  onPress={handleAdd}
                  disabled={saving || !name.trim()}
                  style={styles.saveBtn}
                >
                  <ThemedText
                    type="default"
                    style={{ color: theme.primaryText, fontWeight: "600" }}
                  >
                    {saving ? "Saving…" : "Save Template"}
                  </ThemedText>
                </NeumorphicButton>
                <NeumorphicPressable
                  onPress={() => setShowForm(false)}
                  style={styles.cancelBtn}
                >
                  <ThemedText
                    type="default"
                    style={{ color: theme.textSecondary }}
                  >
                    Cancel
                  </ThemedText>
                </NeumorphicPressable>
              </View>
            </NeumorphicCard>
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
  infoBox: {
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.three,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, lineHeight: 18 },
  generateBtn: {
    paddingVertical: Spacing.three,
    minHeight: 48,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  deleteBtn: {
    padding: Spacing.half,
  },
  empty: {
    textAlign: "center",
    paddingVertical: Spacing.four,
  },
  addToggleBtn: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: "center",
  },
  formCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  toggleRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: "center",
  },
  freqRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.one,
  },
  freqChip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    marginRight: Spacing.one,
  },
  formActions: {
    gap: Spacing.one,
  },
  saveBtn: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: "center",
  },
  cancelBtn: {
    paddingVertical: Spacing.two,
    alignItems: "center",
  },
});
