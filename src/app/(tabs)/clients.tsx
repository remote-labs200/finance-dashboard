import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColors } from '@/hooks/use-theme';
import { useSQLiteContext } from '@/db/provider';
import { useAuthStore } from '@/stores/use-auth-store';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { formatCurrency } from '@/lib/format';

interface Client {
  id: string;
  name: string;
  totalIncomeCents: number;
  transactionCount: number;
  lastTransactionDate: string | null;
  currencies: string[];
}

export default function ClientsScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const colors = useThemeColors();
  const [clients, setClients] = useState<Client[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadClients = useCallback(async () => {
    if (!user) return;

    try {
      // Get clients from transactions (using note as client name for now)
      const rows = await db.getAllAsync<{
        client_name: string;
        total_income: number;
        txn_count: number;
        last_date: string;
        currencies: string;
      }>(
        `SELECT
          note as client_name,
          SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END) as total_income,
          COUNT(*) as txn_count,
          MAX(date) as last_date,
          GROUP_CONCAT(DISTINCT currency_code) as currencies
         FROM transactions
         WHERE user_id = ? AND note IS NOT NULL AND note != ''
         GROUP BY note
         ORDER BY total_income DESC`,
        user.id
      );

      setClients(
        rows.map((r, i) => ({
          id: `client_${i}`,
          name: r.client_name,
          totalIncomeCents: r.total_income,
          transactionCount: r.txn_count,
          lastTransactionDate: r.last_date,
          currencies: r.currencies?.split(',') ?? ['USD'],
        }))
      );
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('closed')) return;
      console.warn('loadClients error:', e);
    }
  }, [db, user]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadClients();
    setRefreshing(false);
  }, [loadClients]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <FlatList
          data={clients}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <View style={styles.header}>
              <ThemedText type="title">Clients</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Income by client / counterparty
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.clientCard, { borderColor: colors.cardBorder }]}>
              <View style={styles.clientHeader}>
                <View style={[styles.clientAvatar, { backgroundColor: colors.primary + '26' }]}>
                  <ThemedText type="headline" style={{ color: colors.primary }}>
                    {item.name.charAt(0).toUpperCase()}
                  </ThemedText>
                </View>
                <View style={styles.clientInfo}>
                  <ThemedText type="callout" style={{ fontWeight: '600' }}>{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.transactionCount} transaction{item.transactionCount !== 1 ? 's' : ''}
                    {item.lastTransactionDate ? ` \u00B7 Last: ${item.lastTransactionDate}` : ''}
                  </ThemedText>
                </View>
                <ThemedText type="headline" style={{ color: colors.success }}>
                  {formatCurrency(item.totalIncomeCents, item.currencies[0])}
                </ThemedText>
              </View>
              {item.currencies.length > 1 && (
                <View style={styles.currencyBadges}>
                  {item.currencies.map((c) => (
                    <View key={c} style={[styles.currencyBadge, { backgroundColor: colors.cardBorder }]}>
                      <ThemedText type="small">{c}</ThemedText>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <SymbolView name={{ ios: 'person.2', android: 'group', web: 'group' }} size={48} tintColor={colors.placeholder} />
              <ThemedText type="default" themeColor="textSecondary">
                No clients yet
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                When you add transactions with a note (client name), they'll appear here.
              </ThemedText>
            </View>
          }
        />
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
    gap: Spacing.one,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  clientCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    marginBottom: Spacing.two,
    gap: Spacing.two,
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  clientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientInfo: {
    flex: 1,
    gap: 2,
  },
  currencyBadges: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  currencyBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.two,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
});
