import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSQLiteContext } from '@/db/provider';
import { useAuthStore } from '@/stores/use-auth-store';
import { performFullSync, checkSupabaseConnection, getPendingSyncEntries } from '@/lib/sync-service';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

export default function CloudSyncScreen() {
  const db = useSQLiteContext();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const theme = useTheme();

  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Edit Supabase URL fields
  const [showConfig, setShowConfig] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');

  const refreshStatus = useCallback(async (signal?: { aborted: boolean }) => {
    try {
      const connected = await checkSupabaseConnection();
      if (signal?.aborted) return;
      setIsConnected(connected);

      if (connected) {
        const pending = await getPendingSyncEntries(db, 100);
        if (signal?.aborted) return;
        setPendingCount(pending.filter((e) => e.status === 'pending').length);
        const synced = pending.find((e) => e.status === 'synced' && e.syncedAt);
        setLastSynced(synced?.syncedAt ?? null);
      } else {
        setPendingCount(0);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('closed')) return;
      console.warn('Failed to refresh sync status:', e);
    }
  }, [db]);

  useEffect(() => {
    const signal = { aborted: false };
    refreshStatus(signal);
    return () => { signal.aborted = true; };
  }, [refreshStatus]);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const result = await performFullSync(db);
      const msg = [
        `Pushed: ${result.pushed}`,
        `Pulled: ${result.pulled}`,
        result.conflicts > 0 ? `Conflicts: ${result.conflicts}` : null,
        result.errors.length > 0 ? `Errors: ${result.errors.length}` : null,
      ]
        .filter(Boolean)
        .join(' | ');
      setSyncResult(msg);
      await refreshStatus();
    } catch (e: any) {
      setSyncResult(`Sync failed: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  }, [db, refreshStatus]);

  const handleSaveConfig = useCallback(() => {
    // This would save to .env or a config store in production.
    // For now, show a message explaining how to configure.
    Alert.alert(
      'Supabase Configuration',
      'To configure Supabase, create a .env file in the project root with:\n\n' +
      'EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co\n' +
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key\n\n' +
      'The app will automatically detect and use these credentials.'
    );
  }, []);

  const formatDate = (iso: string | null) => {
    if (!iso) return 'Never';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor={theme.primary} />
          </Pressable>
          <ThemedText type="title" style={styles.headerTitle}>Cloud Sync</ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Status Card */}
          <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <ThemedText type="callout" style={{ fontWeight: '600' }}>Connection Status</ThemedText>
                <View style={styles.statusBadgeRow}>
                  <View style={[styles.statusDot, {
                    backgroundColor: isConnected === null ? theme.warning :
                      isConnected ? theme.success : theme.danger,
                  }]} />
                  <ThemedText type="default" style={{
                    color: isConnected === null ? theme.warning :
                      isConnected ? theme.success : theme.danger,
                    fontWeight: '600',
                  }}>
                    {isConnected === null ? 'Checking...' :
                     isConnected ? 'Connected' : 'Not Configured'}
                  </ThemedText>
                </View>
              </View>
              <SymbolView
                name={{ ios: isConnected ? 'icloud.fill' : 'icloud.slash', android: isConnected ? 'cloud' : 'cloud_off', web: 'cloud_off' }}
                size={32}
                tintColor={isConnected ? theme.success : theme.placeholder}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.divider }]} />

            <View style={styles.detailRow}>
              <ThemedText type="default" themeColor="textSecondary">Last Synced</ThemedText>
              <ThemedText type="default" style={{ fontWeight: '500' }}>{formatDate(lastSynced)}</ThemedText>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.divider }]} />
            <View style={styles.detailRow}>
              <ThemedText type="default" themeColor="textSecondary">Pending Changes</ThemedText>
              <ThemedText type="default" style={{ fontWeight: '500', color: pendingCount > 0 ? theme.warning : theme.text }}>
                {pendingCount > 0 ? `${pendingCount} items` : 'None'}
              </ThemedText>
            </View>

            {/* Sync Button */}
            <Pressable
              onPress={handleSync}
              disabled={isSyncing || !isConnected}
              style={[
                styles.syncBtn,
                {
                  backgroundColor: isConnected ? theme.primary : theme.inputBorder,
                  opacity: isSyncing ? 0.6 : 1,
                },
              ]}>
              <SymbolView
                name={{ ios: 'arrow.triangle.2.circlepath', android: 'sync', web: 'sync' }}
                size={16}
                tintColor={theme.primaryText}
              />
              <ThemedText type="default" style={{ color: theme.primaryText, fontWeight: '600' }}>
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </ThemedText>
            </Pressable>

            {/* Sync Result */}
            {syncResult && (
              <View style={[styles.resultBox, {
                backgroundColor: syncResult.includes('failed') ? `${theme.danger}10` : `${theme.success}10`,
              }]}>
                <ThemedText type="small" style={{
                  color: syncResult.includes('failed') ? theme.danger : theme.success,
                }}>
                  {syncResult}
                </ThemedText>
              </View>
            )}
          </View>

          {/* Configure Section */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>Configuration</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionSubtitle}>
              Cloud sync uses Supabase for authentication and data backup. Configure your Supabase project credentials to enable cloud features.
            </ThemedText>

            <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
              {!showConfig ? (
                <Pressable onPress={() => setShowConfig(true)} style={styles.configRow}>
                  <View style={styles.configLeft}>
                    <ThemedText type="default">Supabase Project</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {isConnected ? 'Configured' : 'Not configured'}
                    </ThemedText>
                  </View>
                  <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={theme.placeholder} />
                </Pressable>
              ) : (
                <View style={styles.configForm}>
                  <ThemedText type="callout" style={{ fontWeight: '600', marginBottom: Spacing.two }}>
                    Supabase Credentials
                  </ThemedText>

                  <ThemedText type="small" themeColor="textSecondary">Project URL</ThemedText>
                  <TextInput
                    style={[styles.configInput, {
                      borderColor: theme.inputBorder,
                      backgroundColor: theme.inputBackground,
                      color: theme.text,
                    }]}
                    placeholder="https://your-project.supabase.co"
                    placeholderTextColor={theme.placeholder}
                    value={supabaseUrl}
                    onChangeText={setSupabaseUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    underlineColorAndroid="transparent"
                  />

                  <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.two }}>Anon Publishable Key</ThemedText>
                  <TextInput
                    style={[styles.configInput, {
                      borderColor: theme.inputBorder,
                      backgroundColor: theme.inputBackground,
                      color: theme.text,
                    }]}
                    placeholder="your-anon-key"
                    placeholderTextColor={theme.placeholder}
                    value={supabaseKey}
                    onChangeText={setSupabaseKey}
                    autoCapitalize="none"
                    autoCorrect={false}
                    underlineColorAndroid="transparent"
                  />

                  <Pressable onPress={handleSaveConfig} style={[styles.saveConfigBtn, { backgroundColor: theme.primary }]}>
                    <ThemedText type="default" style={{ color: theme.primaryText, fontWeight: '600' }}>
                      Save and Apply
                    </ThemedText>
                  </Pressable>

                  <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: Spacing.one }}>
                    Credentials are stored in your .env file.
                  </ThemedText>
                </View>
              )}
            </View>
          </View>

          {/* Info */}
          <View style={styles.infoBox}>
            <SymbolView name={{ ios: 'info.circle', android: 'info', web: 'info' }} size={16} tintColor={theme.primary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.infoText}>
              Sync uses an offline-first approach: all data is saved locally first, then synced to the cloud when connected. Conflicts are resolved with last-write-wins.
            </ThemedText>
          </View>

          <View style={{ height: BottomTabInset + Spacing.six }} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  headerTitle: {
    flex: 1,
  },
  backBtn: {
    padding: Spacing.one,
  },
  scroll: {
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.one,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  sectionSubtitle: {
    lineHeight: 20,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  statusLeft: {
    gap: Spacing.one,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  syncBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    marginTop: Spacing.three,
  },
  resultBox: {
    padding: Spacing.two,
    borderRadius: Spacing.two,
    marginTop: Spacing.two,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  configLeft: {
    flex: 1,
    gap: 2,
  },
  configForm: {
    gap: Spacing.one,
  },
  configInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 14,
  },
  saveConfigBtn: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    lineHeight: 18,
  },
});
