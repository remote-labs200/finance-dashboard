import { useState } from 'react';
import {
  Alert,
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

export default function DataEncryptionKeyScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [keySource, setKeySource] = useState<'local' | 'cloud'>('local');
  const [isKeyGenerated, setIsKeyGenerated] = useState(true);

  const handleRegenerate = () => {
    Alert.alert(
      'Regenerate Encryption Key',
      'This will generate a new encryption key. Existing encrypted data will be re-encrypted with the new key.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: () => Alert.alert('Done', 'New encryption key generated.'),
        },
      ],
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor={theme.primary} />
          </Pressable>
          <ThemedText type="title" style={styles.headerTitle}>Data Encryption Key</ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Key status */}
          <View style={[styles.statusCard, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
            <SymbolView
              name={isKeyGenerated ? { ios: 'key.fill', android: 'key', web: 'key' } : { ios: 'key.slash', android: 'key_off', web: 'key_off' }}
              size={40}
              tintColor={isKeyGenerated ? theme.success : theme.danger}
            />
            <ThemedText type="default" style={{ fontWeight: '600', marginTop: Spacing.two }}>
              {isKeyGenerated ? 'Encryption Key Active' : 'No Encryption Key'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              {isKeyGenerated
                ? 'All local data is encrypted at rest using AES-256.'
                : 'Generate a key to enable data encryption.'}
            </ThemedText>
            {isKeyGenerated && (
              <View style={styles.keyFingerprint}>
                <ThemedText type="small" style={{ fontFamily: 'monospace', color: theme.primary }}>
                  SHA-256: A3:F2:1B:9C:4D:E7:81:0F
                </ThemedText>
              </View>
            )}
          </View>

          {/* Key source */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>Key Management</ThemedText>
            <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
              <Pressable
                onPress={() => setKeySource('local')}
                style={styles.sourceRow}>
                <SymbolView name={{ ios: 'iphone', android: 'phone_android', web: 'phone_android' }} size={24} tintColor={keySource === 'local' ? theme.primary : theme.text} />
                <View style={styles.sourceBody}>
                  <ThemedText type="default" style={{ fontWeight: '500' }}>Device-Only (Self-Custody)</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Encryption key is stored in the device Secure Enclave. No cloud backup.</ThemedText>
                </View>
                {keySource === 'local' && (
                  <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={22} tintColor={theme.primary} />
                )}
              </Pressable>
              <View style={[styles.divider, { backgroundColor: theme.divider }]} />
              <Pressable
                onPress={() => setKeySource('cloud')}
                style={styles.sourceRow}>
                <SymbolView name={{ ios: 'icloud', android: 'cloud', web: 'cloud' }} size={24} tintColor={keySource === 'cloud' ? theme.primary : theme.text} />
                <View style={styles.sourceBody}>
                  <ThemedText type="default" style={{ fontWeight: '500' }}>Cloud-Managed</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Key is synced via iCloud Keychain / platform keystore. Recoverable on new devices.</ThemedText>
                </View>
                {keySource === 'cloud' && (
                  <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={22} tintColor={theme.primary} />
                )}
              </Pressable>
            </View>
          </View>

          {/* Actions */}
          <Pressable
            onPress={handleRegenerate}
            style={[styles.actionBtn, { borderColor: theme.warning }]}>
            <SymbolView name={{ ios: 'arrow.triangle.2.circlepath', android: 'refresh', web: 'refresh' }} size={18} tintColor={theme.warning} />
            <ThemedText type="default" style={{ color: theme.warning, fontWeight: '600' }}>Regenerate Key</ThemedText>
          </Pressable>

          {!isKeyGenerated && (
            <Pressable
              onPress={() => { setIsKeyGenerated(true); Alert.alert('Done', 'Encryption key generated. All data will be encrypted at rest.'); }}
              style={[styles.actionBtn, { borderColor: theme.primary }]}>
              <ThemedText type="default" style={{ color: theme.primary, fontWeight: '600' }}>Generate Key</ThemedText>
            </Pressable>
          )}

          <View style={styles.infoBox}>
            <SymbolView name={{ ios: 'info.circle', android: 'info', web: 'info' }} size={16} tintColor={theme.primary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.infoText}>
              The encryption key never leaves your device in self-custody mode. In cloud-managed mode, the key is stored in your platform keystore (iCloud Keychain / Google Password Manager).
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
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two },
  headerTitle: { flex: 1 },
  backBtn: { padding: Spacing.one },
  scroll: { paddingHorizontal: Spacing.four, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%', gap: Spacing.three },
  section: { gap: Spacing.one },
  sectionTitle: { fontWeight: '600' },
  statusCard: { alignItems: 'center', padding: Spacing.five, borderRadius: Spacing.three, borderWidth: 1, gap: Spacing.half },
  keyFingerprint: { marginTop: Spacing.one, padding: Spacing.two, borderRadius: Spacing.two },
  card: { paddingHorizontal: Spacing.three, borderRadius: Spacing.three, borderWidth: 1 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.three, gap: Spacing.three },
  sourceBody: { flex: 1, gap: 1 },
  divider: { height: StyleSheet.hairlineWidth },
  actionBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.three, borderRadius: Spacing.three, borderWidth: 1 },
  infoBox: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, alignItems: 'flex-start' },
  infoText: { flex: 1, lineHeight: 18 },
});
