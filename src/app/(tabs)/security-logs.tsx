import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

interface LogEntry {
  id: string;
  type: 'sign-in' | 'sign-out' | '2fa' | 'biometric' | 'device' | 'export';
  title: string;
  detail: string;
  date: string;
  location?: string;
}

const LOGS: LogEntry[] = [
  { id: '1', type: 'sign-in', title: 'Sign-In from New Device', detail: 'iPhone 16 Pro, iOS 19.2', date: 'Today, 08:32 AM', location: 'New York, NY' },
  { id: '2', type: 'biometric', title: 'Biometric Authentication', detail: 'Face ID — successful', date: 'Today, 08:32 AM' },
  { id: '3', type: '2fa', title: '2FA Code Requested', detail: 'Authenticator app code verified', date: 'Today, 08:32 AM' },
  { id: '4', type: 'sign-in', title: 'Sign-In Successful', detail: 'Web browser, Chrome 125', date: 'Yesterday, 09:15 PM', location: 'New York, NY' },
  { id: '5', type: 'export', title: 'Data Export', detail: 'CSV export of all transactions (247 records)', date: 'Yesterday, 02:30 PM' },
  { id: '6', type: 'sign-out', title: 'Sign-Out', detail: 'Signed out from Account screen', date: '27 Jul 2026, 06:00 PM' },
  { id: '7', type: 'device', title: 'New Device Connected', detail: 'MacBook Pro, macOS 15.1', date: '25 Jul 2026, 11:20 AM', location: 'Brooklyn, NY' },
  { id: '8', type: 'sign-in', title: 'Sign-In via Magic Link', detail: 'Email link authentication', date: '22 Jul 2026, 07:45 AM', location: 'San Francisco, CA' },
];

function LogIcon({ type }: { type: LogEntry['type'] }) {
  const theme = useTheme();
  const config: Record<string, { ios: string; android: string; web: string; color: string }> = {
    'sign-in': { ios: 'arrow.right.to.line', android: 'login', web: 'login', color: theme.success },
    'sign-out': { ios: 'arrow.left.to.line', android: 'logout', web: 'logout', color: theme.placeholder },
    '2fa': { ios: 'checkmark.shield', android: 'verified_user', web: 'verified_user', color: theme.primary },
    'biometric': { ios: 'faceid', android: 'fingerprint', web: 'fingerprint', color: theme.primary },
    'device': { ios: 'laptopcomputer.and.iphone', android: 'devices', web: 'devices', color: theme.warning },
    'export': { ios: 'square.and.arrow.up', android: 'share', web: 'share', color: theme.text },
  };
  const c = config[type] as any;
  const { color, ...iconName } = c;
  return <SymbolView name={iconName} size={20} tintColor={color} />;
}

export default function SecurityLogsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [filter, setFilter] = useState<'all' | keyof typeof import('@/app/(tabs)/security-logs')>('all');

  // Inline filter type
  const [activeFilter, setActiveFilter] = useState<'all' | LogEntry['type']>('all');

  const filtered = activeFilter === 'all' ? LOGS : LOGS.filter((l) => l.type === activeFilter);
  const filters: { key: 'all' | LogEntry['type']; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'sign-in', label: 'Sign-Ins' },
    { key: 'biometric', label: 'Biometric' },
    { key: '2fa', label: '2FA' },
    { key: 'device', label: 'Devices' },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor={theme.primary} />
          </Pressable>
          <ThemedText type="title" style={styles.headerTitle}>Security Logs</ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={{ fontWeight: '500' }}>
            {LOGS.length}
          </ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Filters */}
          <View style={styles.chipRow}>
            {filters.map((f) => (
              <Pressable
                key={f.key}
                onPress={() => setActiveFilter(f.key)}
                style={[styles.chip, {
                  borderColor: activeFilter === f.key ? theme.primary : theme.inputBorder,
                  backgroundColor: activeFilter === f.key ? `${theme.primary}15` : 'transparent',
                }]}>
                <ThemedText type="default" style={{
                  color: activeFilter === f.key ? theme.primary : theme.text,
                  fontWeight: activeFilter === f.key ? '600' : '400',
                }}>
                  {f.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {/* Info banner */}
          <View style={[styles.infoBanner, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
            <SymbolView name={{ ios: 'clock.badge.checkmark', android: 'history', web: 'history' }} size={20} tintColor={theme.primary} />
            <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1, lineHeight: 18 }}>
              Security logs are stored locally and never transmitted. Only the last 90 days are retained.
            </ThemedText>
          </View>

          {/* Log entries */}
          {filtered.map((log) => (
            <View key={log.id} style={[styles.logCard, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
              <View style={styles.logTop}>
                <LogIcon type={log.type} />
                <View style={styles.logBody}>
                  <ThemedText type="default" style={{ fontWeight: '500' }}>{log.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{log.detail}</ThemedText>
                </View>
              </View>
              <View style={styles.logMeta}>
                <ThemedText type="small" themeColor="textSecondary">{log.date}</ThemedText>
                {log.location && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {log.location}
                  </ThemedText>
                )}
              </View>
            </View>
          ))}

          <View style={{ height: BottomTabInset + Spacing.six }} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two },
  headerTitle: { flex: 1 },
  backBtn: { padding: Spacing.one },
  scroll: { paddingHorizontal: Spacing.four, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%', paddingBottom: Spacing.three },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.three, borderWidth: 1 },
  infoBanner: { flexDirection: 'row', padding: Spacing.three, borderRadius: Spacing.three, borderWidth: 1, gap: Spacing.two, alignItems: 'center' },
  logCard: { padding: Spacing.three, borderRadius: Spacing.three, borderWidth: 1, gap: Spacing.one },
  logTop: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  logBody: { flex: 1, gap: 1 },
  logMeta: { flexDirection: 'row', justifyContent: 'space-between', marginLeft: 20 + Spacing.two },
});
