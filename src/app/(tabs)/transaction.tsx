import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSQLiteContext } from '@/db/provider';
import { useThemeColors } from '@/hooks/use-theme';
import { useAuthStore } from '@/stores/use-auth-store';
import {
  createTransaction,
  findTransactionById,
  findTransactionsByUser,
  updateTransaction,
} from '@/db/transaction-repo';
import { Account, Category } from '@/db/schema';
import { findAccountsByUser } from '@/db/account-repo';
import { findCategoriesByUser } from '@/db/category-repo';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { parseCurrencyInput } from '@/lib/format';

export default function TransactionScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [isIncome, setIsIncome] = useState(false);
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      try {
        const [accs, cats] = await Promise.all([
          findAccountsByUser(db, user.id),
          findCategoriesByUser(db, user.id),
        ]);
        if (!mounted) return;
        setAccounts(accs);
        setCategories(cats);
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes('closed')) return;
        console.warn('load form data error:', e);
      }
    })();
    return () => { mounted = false; };
  }, [db, user]);

  useEffect(() => {
    if (isEditing && id) {
      (async () => {
        const txn = await findTransactionById(db, id);
        if (txn) {
          setAmount(String(Math.abs(txn.amountCents) / 100));
          setNote(txn.note ?? '');
          setDate(txn.date);
          setIsIncome(txn.amountCents > 0);
          setCurrencyCode(txn.currencyCode);
          setAccountId(txn.accountId);
          setCategoryId(txn.categoryId);
        }
      })();
    }
  }, [db, isEditing, id]);

  const handleSave = useCallback(async () => {
    if (!user) return;

    const cents = parseCurrencyInput(amount);
    if (cents === 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
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
      });
    } else {
      await createTransaction(db, {
        userId: user.id,
        amountCents: isIncome ? Math.abs(cents) : -Math.abs(cents),
        currencyCode,
        accountId: accountId || '',
        categoryId: categoryId || '',
        note: note || undefined,
        date,
      });
    }

    router.back();
  }, [db, user, id, isEditing, amount, note, date, isIncome, currencyCode, accountId, categoryId, router]);

  const filteredCategories = categories.filter((c) =>
    isIncome ? c.isIncome : !c.isIncome
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'android' ? 20 : 0}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled">

            <ThemedText type="title">
              {isEditing ? 'Edit Transaction' : 'New Transaction'}
            </ThemedText>

            {/* Amount */}
            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary">Amount</ThemedText>
              <TextInput
                style={[styles.input, styles.amountInput, { borderColor: colors.divider, color: colors.text }]}
                placeholder="0.00"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.placeholder}
              />
            </View>

            {/* Income / Expense toggle */}
            <View style={styles.toggleRow}>
              <Pressable
                onPress={() => setIsIncome(false)}
                style={[styles.toggleBtn, { borderColor: colors.divider }, !isIncome && { backgroundColor: colors.danger, borderColor: colors.danger }]}>
                <ThemedText
                  type="small"
                  style={{ color: !isIncome ? colors.primaryText : colors.danger }}>
                  Expense
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setIsIncome(true)}
                style={[styles.toggleBtn, { borderColor: colors.divider }, isIncome && { backgroundColor: colors.success, borderColor: colors.success }]}>
                <ThemedText
                  type="small"
                  style={{ color: isIncome ? colors.primaryText : colors.success }}>
                  Income
                </ThemedText>
              </Pressable>
            </View>

            {/* Note */}
            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary">Note</ThemedText>
              <TextInput
                style={[styles.input, { borderColor: colors.divider, color: colors.text }]}
                placeholder="What was this for?"
                value={note}
                onChangeText={setNote}
                placeholderTextColor={colors.placeholder}
              />
            </View>

            {/* Date */}
            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary">Date (YYYY-MM-DD)</ThemedText>
              <TextInput
                style={[styles.input, { borderColor: colors.divider, color: colors.text }]}
                placeholder="2025-01-15"
                value={date}
                onChangeText={setDate}
                placeholderTextColor={colors.placeholder}
              />
            </View>

            {/* Account picker */}
            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary">Account</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <Pressable
                  onPress={() => setAccountId(null)}
                  style={[styles.chip, { borderColor: colors.divider }, !accountId && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                  <ThemedText type="small" style={{ color: !accountId ? colors.primaryText : undefined }}>
                    None
                  </ThemedText>
                </Pressable>
                {accounts.map((acc) => (
                  <Pressable
                    key={acc.id}
                    onPress={() => setAccountId(acc.id)}
                    style={[styles.chip, { borderColor: colors.divider }, accountId === acc.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                    <ThemedText
                      type="small"
                      style={{ color: accountId === acc.id ? colors.primaryText : undefined }}>
                      {acc.name}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Category picker */}
            <View style={styles.field}>
              <ThemedText type="small" themeColor="textSecondary">Category</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <Pressable
                  onPress={() => setCategoryId(null)}
                  style={[styles.chip, { borderColor: colors.divider }, !categoryId && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                  <ThemedText type="small" style={{ color: !categoryId ? colors.primaryText : undefined }}>
                    None
                  </ThemedText>
                </Pressable>
                {filteredCategories.map((cat) => (
                  <Pressable
                    key={cat.id}
                    onPress={() => setCategoryId(cat.id)}
                    style={[styles.chip, { borderColor: colors.divider }, categoryId === cat.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                    <ThemedText
                      type="small"
                      style={{ color: categoryId === cat.id ? colors.primaryText : undefined }}>
                      {cat.name}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Save button */}
            <Pressable onPress={handleSave} style={[styles.saveButton, { backgroundColor: colors.primary }]}>
              <ThemedText type="default" style={{ color: colors.primaryText, fontWeight: '600' }}>
                {isEditing ? 'Save Changes' : 'Add Transaction'}
              </ThemedText>
            </Pressable>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardAvoid: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.half,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  amountInput: {
    fontSize: 28,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    borderWidth: 1,
  },
  chipScroll: {
    flexGrow: 0,
  },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    marginRight: Spacing.one,
  },
  saveButton: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
});
