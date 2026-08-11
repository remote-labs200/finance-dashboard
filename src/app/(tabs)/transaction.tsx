import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import TransactionAnalytics from "@/components/transaction-analytics";
import {
  NeumorphicButton,
  NeumorphicInput,
  NeumorphicPressable,
} from "@/components/ui";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { findAccountsByUser } from "@/db/account-repo";
import { findCategoriesByUser } from "@/db/category-repo";
import { findClientsByUser } from "@/db/client-repo";
import { useSQLiteContext } from "@/db/provider";
import { getPreference } from "@/db/preferences-repo";
import { Account, Category, Client } from "@/db/schema";
import {
  createTransaction,
  findTransactionById,
  updateTransaction,
} from "@/db/transaction-repo";
import { useThemeColors } from "@/hooks/use-theme";
import { parseCurrencyInput } from "@/lib/format";
import { useAuthStore } from "@/stores/use-auth-store";

export default function TransactionScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const [activeTab, setActiveTab] = useState<"form" | "analytics">("form");

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [isIncome, setIsIncome] = useState(false);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      try {
        const [accs, cats, clis, baseCurrency] = await Promise.all([
          findAccountsByUser(db, user.id),
          findCategoriesByUser(db, user.id),
          findClientsByUser(db, user.id),
          getPreference(db, user.id, "base_currency"),
        ]);
        if (!mounted) return;
        setAccounts(accs);
        setCategories(cats);
        setClients(clis);
        if (!isEditing) setCurrencyCode(baseCurrency);
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes("closed")) return;
        console.warn("load form data error:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [db, user, isEditing]);

  useEffect(() => {
    if (isEditing && id) {
      (async () => {
        const txn = await findTransactionById(db, id);
        if (txn) {
          setAmount(String(Math.abs(txn.amountCents) / 100));
          setNote(txn.note ?? "");
          setDate(txn.date);
          setIsIncome(txn.amountCents > 0);
          setCurrencyCode(txn.currencyCode);
          setAccountId(txn.accountId ?? null);
          setCategoryId(txn.categoryId ?? null);
          setClientId(txn.clientId ?? null);
        }
      })();
    }
  }, [db, isEditing, id]);

  const handleSave = useCallback(async () => {
    if (!user) return;

    const cents = parseCurrencyInput(amount);
    if (cents === 0) {
      Alert.alert("Invalid amount", "Please enter a valid amount.");
      return;
    }

    if (isEditing && id) {
      await updateTransaction(db, id, {
        amountCents: isIncome ? Math.abs(cents) : -Math.abs(cents),
        note: note || undefined,
        date,
        currencyCode,
        accountId: accountId || undefined,
        categoryId: categoryId || undefined,
        clientId: clientId || undefined,
      });
    } else {
      await createTransaction(db, {
        userId: user.id,
        amountCents: isIncome ? Math.abs(cents) : -Math.abs(cents),
        currencyCode,
        accountId: accountId || undefined,
        categoryId: categoryId || undefined,
        clientId: clientId || undefined,
        note: note || undefined,
        date,
      });
    }

    router.back();
  }, [
    db,
    user,
    id,
    isEditing,
    amount,
    note,
    date,
    isIncome,
    currencyCode,
    accountId,
    categoryId,
    clientId,
    router,
  ]);

  const filteredCategories = categories.filter((c) =>
    isIncome ? c.isIncome : !c.isIncome,
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safeArea}>
        {/* ── Tab switcher ── */}
        <View
          style={[
            styles.tabBar,
            {
              paddingTop: insets.top + Spacing.two,
              paddingLeft: insets.left + Spacing.four,
              paddingRight: insets.right + Spacing.four,
            },
          ]}
        >
          <NeumorphicPressable
            inset
            onPress={() => setActiveTab("form")}
            style={[
              styles.tabBtn,
              activeTab === "form" && { backgroundColor: colors.primary },
            ]}
          >
            <ThemedText
              type="small"
              style={{
                color:
                  activeTab === "form" ? colors.primaryText : colors.text,
                fontWeight: "600",
              }}
            >
              {isEditing ? "Edit" : "New"}
            </ThemedText>
          </NeumorphicPressable>
          <NeumorphicPressable
            inset
            onPress={() => setActiveTab("analytics")}
            style={[
              styles.tabBtn,
              activeTab === "analytics" && {
                backgroundColor: colors.primary,
              },
            ]}
          >
            <ThemedText
              type="small"
              style={{
                color:
                  activeTab === "analytics"
                    ? colors.primaryText
                    : colors.text,
                fontWeight: "600",
              }}
            >
              Analytics
            </ThemedText>
          </NeumorphicPressable>
        </View>

        {activeTab === "analytics" ? (
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              {
                paddingTop: Spacing.three,
                paddingLeft: insets.left + Spacing.four,
                paddingRight: insets.right + Spacing.four,
                paddingBottom: insets.bottom + Spacing.five,
              },
            ]}
          >
            <TransactionAnalytics />
          </ScrollView>
        ) : (
          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "android" ? 20 : 0}
          >
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              {
                paddingTop: insets.top + Spacing.three,
                paddingLeft: insets.left + Spacing.four,
                paddingRight: insets.right + Spacing.four,
                paddingBottom: insets.bottom + Spacing.five,
              },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <ThemedText type="title">
              {isEditing ? "Edit Transaction" : "New Transaction"}
            </ThemedText>

            {/* Amount */}
            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary">
                Amount
              </ThemedText>
              <NeumorphicInput
                style={[styles.amountInput]}
                placeholder="0.00"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                underlineColorAndroid="transparent"
              />
            </View>

            {/* Income / Expense toggle */}
            <View style={styles.toggleRow}>
              <NeumorphicPressable
                inset
                onPress={() => setIsIncome(false)}
                style={[
                  styles.toggleBtn,
                  !isIncome && { backgroundColor: colors.danger },
                ]}
              >
                <ThemedText
                  type="small"
                  style={{
                    color: !isIncome ? colors.primaryText : colors.danger,
                  }}
                >
                  Expense
                </ThemedText>
              </NeumorphicPressable>
              <NeumorphicPressable
                inset
                onPress={() => setIsIncome(true)}
                style={[
                  styles.toggleBtn,
                  isIncome && { backgroundColor: colors.success },
                ]}
              >
                <ThemedText
                  type="small"
                  style={{
                    color: isIncome ? colors.primaryText : colors.success,
                  }}
                >
                  Income
                </ThemedText>
              </NeumorphicPressable>
            </View>

            {/* Note */}
            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary">
                Note
              </ThemedText>
              <NeumorphicInput
                placeholder="What was this for?"
                value={note}
                onChangeText={setNote}
                underlineColorAndroid="transparent"
              />
            </View>

            {/* Date */}
            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary">
                Date (YYYY-MM-DD)
              </ThemedText>
              <NeumorphicInput
                placeholder="2025-01-15"
                value={date}
                onChangeText={setDate}
                underlineColorAndroid="transparent"
              />
            </View>

            {/* Account picker */}
            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary">
                Account
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipScroll}
              >
                <NeumorphicPressable
                  inset
                  onPress={() => setAccountId(null)}
                  style={[
                    styles.chip,
                    !accountId && { backgroundColor: colors.primary },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: !accountId ? colors.primaryText : undefined,
                    }}
                  >
                    None
                  </ThemedText>
                </NeumorphicPressable>
                {accounts.map((acc) => (
                  <NeumorphicPressable
                    key={acc.id}
                    inset
                    onPress={() => setAccountId(acc.id)}
                    style={[
                      styles.chip,
                      accountId === acc.id && {
                        backgroundColor: colors.primary,
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{
                        color:
                          accountId === acc.id ? colors.primaryText : undefined,
                      }}
                    >
                      {acc.name}
                    </ThemedText>
                  </NeumorphicPressable>
                ))}
              </ScrollView>
            </View>

            {/* Category picker */}
            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary">
                Category
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipScroll}
              >
                <NeumorphicPressable
                  inset
                  onPress={() => setCategoryId(null)}
                  style={[
                    styles.chip,
                    !categoryId && { backgroundColor: colors.primary },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: !categoryId ? colors.primaryText : undefined,
                    }}
                  >
                    None
                  </ThemedText>
                </NeumorphicPressable>
                {filteredCategories.map((cat) => (
                  <NeumorphicPressable
                    key={cat.id}
                    inset
                    onPress={() => setCategoryId(cat.id)}
                    style={[
                      styles.chip,
                      categoryId === cat.id && {
                        backgroundColor: colors.primary,
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{
                        color:
                          categoryId === cat.id
                            ? colors.primaryText
                            : undefined,
                      }}
                    >
                      {cat.name}
                    </ThemedText>
                  </NeumorphicPressable>
                ))}
              </ScrollView>
            </View>

            {/* Client picker */}
            {clients.length > 0 && (
              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary">
                  Client (optional)
                </ThemedText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipScroll}
                >
                  <NeumorphicPressable
                    inset
                    onPress={() => setClientId(null)}
                    style={[
                      styles.chip,
                      !clientId && { backgroundColor: colors.primary },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{
                        color: !clientId ? colors.primaryText : undefined,
                      }}
                    >
                      None
                    </ThemedText>
                  </NeumorphicPressable>
                  {clients.map((c) => (
                    <NeumorphicPressable
                      key={c.id}
                      inset
                      onPress={() => setClientId(c.id)}
                      style={[
                        styles.chip,
                        clientId === c.id && {
                          backgroundColor: colors.primary,
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color:
                            clientId === c.id ? colors.primaryText : undefined,
                        }}
                      >
                        {c.name}
                      </ThemedText>
                    </NeumorphicPressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Save button */}
            <NeumorphicButton onPress={handleSave} style={[styles.saveButton]}>
              <ThemedText
                type="default"
                style={{ color: colors.primaryText, fontWeight: "600" }}
              >
                {isEditing ? "Save Changes" : "Add Transaction"}
              </ThemedText>
            </NeumorphicButton>

            <View style={{ height: 40 }} />
          </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardAvoid: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: "center",
  },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.half,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  amountInput: {
    fontSize: 28,
    fontWeight: "700",
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
  chipScroll: {
    flexGrow: 0,
  },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    marginRight: Spacing.one,
  },
  saveButton: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: "center",
  },
});
