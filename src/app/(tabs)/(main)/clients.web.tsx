import { FlashList } from "@shopify/flash-list";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  NeumorphicButton,
  NeumorphicCard,
  NeumorphicInput,
  NeumorphicPressable,
} from "@/components/ui";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import {
  createClient,
  deleteClient,
  getClientSummaries,
  updateClient,
  type ClientSummary,
} from "@/db/client-repo";
import { useSQLiteContext } from "@/db/provider";
import { useThemeColors } from "@/hooks/use-theme";
import { formatCurrency } from "@/lib/format";
import { useAuthStore } from "@/stores/use-auth-store";

export default function ClientsScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const colors = useThemeColors();

  const [summary, setSummary] = useState<ClientSummary[]>([]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ClientSummary["client"] | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getClientSummaries(db, user.id, {
        search: search || undefined,
      });
      setSummary(data);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("closed")) return;
      console.warn("load clients error:", e);
    }
  }, [db, user, search]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openAdd = useCallback(() => {
    setEditing(null);
    setName("");
    setEmail("");
    setCompany("");
    setPhone("");
    setNotes("");
    setShowAdd(true);
  }, []);

  const openEdit = useCallback((c: ClientSummary["client"]) => {
    setEditing(c);
    setName(c.name);
    setEmail(c.email ?? "");
    setCompany(c.company ?? "");
    setPhone(c.phone ?? "");
    setNotes(c.notes ?? "");
    setShowAdd(true);
  }, []);

  const handleSaveClient = useCallback(async () => {
    if (!user) return;
    if (!name.trim()) {
      Alert.alert("Name required", "Please enter a client name.");
      return;
    }
    try {
      if (editing) {
        await updateClient(db, editing.id, {
          name: name.trim(),
          email: email.trim() || undefined,
          company: company.trim() || undefined,
          phone: phone.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        await createClient(db, {
          userId: user.id,
          name: name.trim(),
          email: email.trim() || undefined,
          company: company.trim() || undefined,
          phone: phone.trim() || undefined,
          notes: notes.trim() || undefined,
          currencyCode: "USD",
        });
      }
      setShowAdd(false);
      await load();
    } catch (e: unknown) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Could not save client",
      );
    }
  }, [db, user, editing, name, email, company, phone, notes, load]);

  const confirmDelete = useCallback(
    (c: ClientSummary["client"]) => {
      Alert.alert(
        "Delete Client",
        `Delete "${c.name}"? Linked transactions will keep their data but be unlinked.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteClient(db, c.id);
                await load();
              } catch (e: unknown) {
                Alert.alert(
                  "Error",
                  e instanceof Error ? e.message : "Could not delete",
                );
              }
            },
          },
        ],
      );
    },
    [db, load],
  );

  const totalBilled = summary.reduce((acc, s) => acc + s.totalIncomeCents, 0);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safeArea}>
        <FlashList
          data={summary}
          keyExtractor={(item) => item.client.id}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="title">Clients</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {summary.length} client{summary.length !== 1 ? "s" : ""} —{" "}
                    {formatCurrency(totalBilled, "USD")} total billed
                  </ThemedText>
                </View>
                <NeumorphicPressable
                  onPress={openAdd}
                  style={[styles.addBtn, { backgroundColor: colors.primary }]}
                >
                  <SymbolView
                    name={{ ios: "plus", android: "add", web: "add" }}
                    size={18}
                    tintColor={colors.primaryText}
                  />
                  <ThemedText
                    type="small"
                    style={{ color: colors.primaryText }}
                  >
                    Add Client
                  </ThemedText>
                </NeumorphicPressable>
              </View>
              <NeumorphicInput
                containerStyle={styles.searchBox}
                placeholder="Search clients"
                value={search}
                onChangeText={setSearch}
                leftIcon={
                  <SymbolView
                    name={{
                      ios: "magnifyingglass",
                      android: "search",
                      web: "search",
                    }}
                    size={18}
                    tintColor={colors.textSecondary}
                  />
                }
                rightIcon={
                  search !== "" ? (
                    <Pressable onPress={() => setSearch("")}>
                      <SymbolView
                        name={{
                          ios: "xmark.circle.fill",
                          android: "cancel",
                          web: "cancel",
                        }}
                        size={18}
                        tintColor={colors.textSecondary}
                      />
                    </Pressable>
                  ) : undefined
                }
              />
            </View>
          }
          renderItem={({ item }) => (
            <NeumorphicCard style={styles.clientCard}>
              <View style={styles.clientHeader}>
                <View
                  style={[
                    styles.clientAvatar,
                    {
                      backgroundColor:
                        (item.client.color ?? colors.primary) + "26",
                    },
                  ]}
                >
                  <ThemedText
                    type="headline"
                    style={{ color: item.client.color ?? colors.primary }}
                  >
                    {item.client.name.charAt(0).toUpperCase()}
                  </ThemedText>
                </View>
                <View style={styles.clientInfo}>
                  <ThemedText type="callout" style={{ fontWeight: "600" }}>
                    {item.client.name}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    numberOfLines={1}
                  >
                    {item.client.company ||
                      item.client.email ||
                      "No contact info"}
                  </ThemedText>
                </View>
                <View style={styles.incomeCol}>
                  <ThemedText type="headline" style={{ color: colors.success }}>
                    {formatCurrency(item.totalIncomeCents, item.currencies[0])}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.transactionCount} txn
                    {item.transactionCount !== 1 ? "s" : ""}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.clientFooter}>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.lastTransactionDate
                    ? `Last: ${item.lastTransactionDate}`
                    : "No activity"}
                </ThemedText>
                <View style={styles.footerBtns}>
                  <Pressable onPress={() => openEdit(item.client)} hitSlop={8}>
                    <ThemedText type="small" style={{ color: colors.primary }}>
                      Edit
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => confirmDelete(item.client)}
                    hitSlop={8}
                  >
                    <ThemedText type="small" style={{ color: colors.danger }}>
                      Delete
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            </NeumorphicCard>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <SymbolView
                name={{ ios: "person.2", android: "group", web: "group" }}
                size={48}
                tintColor={colors.placeholder}
              />
              <ThemedText type="default" themeColor="textSecondary">
                No clients yet
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.emptySub}
              >
                Add a client to track income, billings, and work per contact.
              </ThemedText>
              <Pressable
                onPress={openAdd}
                style={[styles.addBtn, { backgroundColor: colors.primary }]}
              >
                <ThemedText type="small" style={{ color: colors.primaryText }}>
                  Add your first client
                </ThemedText>
              </Pressable>
            </View>
          }
        />
      </View>

      {showAdd && (
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalCard}>
            <ThemedView type="card" style={styles.modalBody}>
              <ThemedText type="subtitle">
                {editing ? "Edit Client" : "Add Client"}
              </ThemedText>
              <NeumorphicInput
                placeholder="Client name *"
                value={name}
                onChangeText={setName}
              />
              <NeumorphicInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <NeumorphicInput
                placeholder="Company"
                value={company}
                onChangeText={setCompany}
              />
              <NeumorphicInput
                placeholder="Phone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <NeumorphicInput
                placeholder="Notes"
                value={notes}
                onChangeText={setNotes}
                multiline
                containerStyle={styles.textArea}
              />
              <View style={styles.modalActions}>
                <NeumorphicButton
                  variant="secondary"
                  onPress={() => setShowAdd(false)}
                >
                  Cancel
                </NeumorphicButton>
                <NeumorphicButton onPress={handleSaveClient}>
                  Save
                </NeumorphicButton>
              </View>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.six,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  header: { gap: Spacing.two, paddingBottom: Spacing.two },
  headerRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  searchBox: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  searchInput: { flex: 1, fontSize: 16 },
  clientCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.two,
    gap: Spacing.two,
  },
  clientHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  clientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  clientInfo: { flex: 1, gap: 2 },
  incomeCol: { alignItems: "flex-end" },
  clientFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.15)",
    paddingTop: Spacing.two,
  },
  footerBtns: { flexDirection: "row", gap: Spacing.three },
  empty: {
    alignItems: "center",
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
  emptySub: { textAlign: "center", maxWidth: 320 },
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.four,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalCard: { width: "100%", maxWidth: 480 },
  modalBody: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  textArea: { minHeight: 72, alignItems: "flex-start" },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  modalBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
  },
});
