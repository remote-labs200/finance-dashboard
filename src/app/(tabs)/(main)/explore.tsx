import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { NeumorphicInput, NeumorphicPressable } from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useSQLiteContext } from "@/db/provider";
import { Transaction } from "@/db/schema";
import {
  deleteTransaction,
  findTransactionsByUser,
} from "@/db/transaction-repo";
import { useThemeColors } from "@/hooks/use-theme";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { useAuthStore } from "@/stores/use-auth-store";

export default function TransactionsScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadTransactions = useCallback(async () => {
    if (!user) return;
    try {
      const txns = await findTransactionsByUser(db, user.id, { limit: 100 });
      setTransactions(txns);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("closed")) return;
      console.warn("loadTransactions error:", e);
    }
  }, [db, user]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  }, [loadTransactions]);

  const handleDelete = useCallback(
    (txn: Transaction) => {
      Alert.alert(
        "Delete Transaction",
        `Delete ${txn.note ?? "this transaction"}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await deleteTransaction(db, txn.id);
              await loadTransactions();
            },
          },
        ],
      );
    },
    [db, loadTransactions],
  );

  const filtered = transactions.filter((txn) => {
    const matchesType =
      filter === "all"
        ? true
        : filter === "income"
          ? txn.amountCents > 0
          : txn.amountCents < 0;

    if (!matchesType) return false;

    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase();
    return (
      (txn.note ?? "").toLowerCase().includes(q) ||
      (txn.categoryName ?? "").toLowerCase().includes(q) ||
      (txn.accountName ?? "").toLowerCase().includes(q) ||
      txn.date.includes(q)
    );
  });

  const renderItem = useCallback(
    ({ item }: { item: Transaction }) => (
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/(tabs)/transaction",
            params: { id: item.id },
          })
        }
        onLongPress={() => handleDelete(item)}
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: colors.divider },
          pressed && styles.rowPressed,
        ]}
      >
        <View style={styles.rowLeft}>
          <ThemedText type="default" numberOfLines={1}>
            {item.note ?? item.categoryName ?? "Transaction"}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {item.categoryName ?? "Uncategorized"}
            {item.accountName ? ` \u00B7 ${item.accountName}` : ""}
          </ThemedText>
        </View>
        <View style={styles.rowRight}>
          <ThemedText
            type="default"
            style={{
              color: item.amountCents >= 0 ? colors.success : colors.danger,
            }}
          >
            {item.amountCents >= 0 ? "+" : ""}
            {formatCurrency(item.amountCents, item.currencyCode)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatDateShort(item.date)}
          </ThemedText>
        </View>
      </Pressable>
    ),
    [router, handleDelete],
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safeArea}>
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
          <ThemedText type="title">Transactions</ThemedText>
          {/* Search bar */}
          <NeumorphicInput
            placeholder="Search transactions..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            underlineColorAndroid="transparent"
            leftIcon={
              <SymbolView
                name={{
                  ios: "magnifyingglass",
                  android: "search",
                  web: "search",
                }}
                size={16}
                tintColor={colors.placeholder}
              />
            }
            rightIcon={
              searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                  <SymbolView
                    name={{
                      ios: "xmark.circle.fill",
                      android: "cancel",
                      web: "cancel",
                    }}
                    size={16}
                    tintColor={colors.placeholder}
                  />
                </Pressable>
              ) : undefined
            }
          />
          <View style={styles.filters}>
            {(["all", "income", "expense"] as const).map((f) => (
              <NeumorphicPressable
                key={f}
                inset
                onPress={() => setFilter(f)}
                style={[
                  styles.filterButton,
                  filter === f && { backgroundColor: colors.primary },
                ]}
              >
                <ThemedText
                  type="small"
                  style={{
                    color: filter === f ? colors.primaryText : undefined,
                  }}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </ThemedText>
              </NeumorphicPressable>
            ))}
          </View>
        </View>

        <FlashList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            {
              paddingLeft: insets.left + Spacing.four,
              paddingRight: insets.right + Spacing.four,
            },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <ThemedText type="small" themeColor="textSecondary">
                No transactions yet. Tap + to add one.
              </ThemedText>
            </View>
          }
        />

        <NeumorphicPressable
          onPress={() => router.push("/(tabs)/transaction")}
          style={[
            styles.fab,
            { backgroundColor: colors.primary, bottom: insets.bottom + Spacing.two },
          ]}
        >
          <SymbolView
            name={{ ios: "plus", android: "add", web: "add" }}
            size={24}
            tintColor={colors.primaryText}
          />
        </NeumorphicPressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  filters: {
    flexDirection: "row",
    gap: Spacing.one,
  },
  filterButton: {
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  filterButtonActive: {},
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    gap: Spacing.one,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.one + 2,
    fontSize: 15,
  },
  list: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowLeft: {
    flex: 1,
    gap: 2,
  },
  rowRight: {
    alignItems: "flex-end",
    marginLeft: Spacing.two,
    gap: 2,
  },
  empty: {
    paddingVertical: Spacing.six,
    alignItems: "center",
  },
  fab: {
    position: "absolute",
    right: Spacing.four,
    bottom: Platform.OS === "android" ? Spacing.three : Spacing.two,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
