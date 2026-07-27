import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSQLiteContext } from '@/db/provider';
import { useAuthStore } from '@/stores/use-auth-store';
import { Account } from '@/db/schema';
import {
  findAccountsByUser,
  createAccount,
  deleteAccount,
} from '@/db/account-repo';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { formatCurrency } from '@/lib/format';
import { useThemeColors } from '@/hooks/use-theme';

export default function AccountsScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const colors = useThemeColors();
  const presetColors = [colors.primary, colors.success, colors.danger, colors.warning, colors.purple, colors.pink];
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadAccounts = useCallback(async () => {
    if (!user) return;
    try {
      const accs = await findAccountsByUser(db, user.id);
      setAccounts(accs);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('closed')) return;
      console.warn('loadAccounts error:', e);
    }
  }, [db, user]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAccounts();
    setRefreshing(false);
  }, [loadAccounts]);

  const handleAdd = useCallback(() => {
    Alert.prompt?.(
      'New Account',
      'Account name',
      async (name) => {
        if (!name?.trim() || !user) return;
        const color = presetColors[accounts.length % presetColors.length];
        await createAccount(db, {
          userId: user.id,
          name: name.trim(),
          type: 'checking',
          balanceCents: 0,
          currencyCode: 'USD',
          color,
          isHidden: false,
        });
        await loadAccounts();
      }
    ) ??
      Alert.alert('New Account', 'Tap "Add Default Account" to create an account with a default name.');
  }, [db, user, accounts.length, loadAccounts]);

  const handleQuickAdd = useCallback(async () => {
    if (!user) return;
    const name = `Account ${accounts.length + 1}`;
    const color = presetColors[accounts.length % presetColors.length];
    await createAccount(db, {
      userId: user.id,
      name,
      type: 'checking',
      balanceCents: 0,
      currencyCode: 'USD',
      color,
      isHidden: false,
    });
    await loadAccounts();
  }, [db, user, accounts.length, loadAccounts]);

  const handleDelete = useCallback(
    (acc: Account) => {
      Alert.alert('Delete Account', `Delete "${acc.name}"? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteAccount(db, acc.id);
            await loadAccounts();
          },
        },
      ]);
    },
    [db, loadAccounts]
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <FlatList
          data={accounts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <View style={styles.header}>
              <ThemedText type="title">Accounts</ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: colors.cardBorder }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.dot, { backgroundColor: item.color ?? colors.primary }]} />
                <ThemedText type="default" style={{ flex: 1, fontWeight: '600' }}>{item.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{item.type}</ThemedText>
              </View>
              <ThemedText type="headline">
                {formatCurrency(item.balanceCents, item.currencyCode)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.currencyCode} \u00B7 {item.isHidden ? 'Hidden' : 'Active'}
              </ThemedText>
              <Pressable onPress={() => handleDelete(item)} style={styles.deleteBtn}>
                <ThemedText type="small" style={{ color: colors.danger }}>Delete</ThemedText>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <ThemedText type="small" themeColor="textSecondary">
                No accounts yet. Tap the button below to create one.
              </ThemedText>
            </View>
          }
        />

        <Pressable onPress={handleQuickAdd} style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.text }]}>
          <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={24} tintColor={colors.primaryText} />
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  deleteBtn: {
    marginTop: Spacing.one,
    alignSelf: 'flex-end',
  },
  empty: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: BottomTabInset + Spacing.four,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
