import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

export default function BiometricLockScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [faceId, setFaceId] = useState(true);
  const [requireOnLaunch, setRequireOnLaunch] = useState(true);
  const [requireOnReturn, setRequireOnReturn] = useState(false);
  const [timeoutMinutes, setTimeoutMinutes] = useState(5);

  const timeoutOptions = [1, 5, 15, 30, 60];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor={theme.primary} />
          </Pressable>
          <ThemedText type="title" style={styles.headerTitle}>Biometric Lock</ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Status card */}
          <View style={[styles.statusCard, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
            <SymbolView name={{ ios: 'faceid', android: 'fingerprint', web: 'fingerprint' }} size={40} tintColor={faceId ? theme.primary : theme.placeholder} />
            <ThemedText type="default" style={{ fontWeight: '600', marginTop: Spacing.two }}>
              {faceId ? 'Face ID / Touch ID Enabled' : 'Biometric Lock Disabled'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              {faceId
                ? 'Your device biometrics secure access to the app.'
                : 'Enable biometric authentication for quick, secure access.'}
            </ThemedText>
          </View>

          {/* Settings */}
          <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleBody}>
                <ThemedText type="default" style={{ fontWeight: '500' }}>Use Biometrics</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Face ID, Touch ID, or fingerprint.</ThemedText>
              </View>
              <Switch value={faceId} onValueChange={setFaceId} trackColor={{ false: theme.inputBorder, true: theme.primary }} thumbColor="#fff" />
            </View>
            {faceId && (
              <>
                <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                <View style={styles.toggleRow}>
                  <View style={styles.toggleBody}>
                    <ThemedText type="default" style={{ fontWeight: '500' }}>Require on Launch</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">Prompt for biometrics when app starts.</ThemedText>
                  </View>
                  <Switch value={requireOnLaunch} onValueChange={setRequireOnLaunch} trackColor={{ false: theme.inputBorder, true: theme.primary }} thumbColor="#fff" />
                </View>
                <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                <View style={styles.toggleRow}>
                  <View style={styles.toggleBody}>
                    <ThemedText type="default" style={{ fontWeight: '500' }}>Require on Return</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">Re-authenticate after backgrounding the app.</ThemedText>
                  </View>
                  <Switch value={requireOnReturn} onValueChange={setRequireOnReturn} trackColor={{ false: theme.inputBorder, true: theme.primary }} thumbColor="#fff" />
                </View>
              </>
            )}
          </View>

          {/* Auto-lock timeout */}
          {faceId && (
            <View style={styles.section}>
              <ThemedText type="callout" style={styles.sectionTitle}>Auto-Lock Timeout</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.sectionSub}>
                After how long of inactivity should the app lock?
              </ThemedText>
              <View style={styles.chipRow}>
                {timeoutOptions.map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setTimeoutMinutes(t)}
                    style={[styles.chip, {
                      borderColor: timeoutMinutes === t ? theme.primary : theme.inputBorder,
                      backgroundColor: timeoutMinutes === t ? `${theme.primary}15` : 'transparent',
                    }]}>
                    <ThemedText type="default" style={{
                      color: timeoutMinutes === t ? theme.primary : theme.text,
                      fontWeight: timeoutMinutes === t ? '600' : '400',
                    }}>
                      {t === 1 ? '1 min' : t >= 60 ? '1 hour' : `${t} min`}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Test */}
          {faceId && (
            <Pressable
              onPress={() => Alert.alert('Biometric Test', 'Device biometrics are configured and ready.')}
              style={[styles.testBtn, { borderColor: theme.primary }]}>
              <SymbolView name={{ ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' }} size={18} tintColor={theme.primary} />
              <ThemedText type="default" style={{ color: theme.primary, fontWeight: '600' }}>Test Biometrics</ThemedText>
            </Pressable>
          )}

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
  section: { gap: Spacing.one },
  sectionTitle: { fontWeight: '600' },
  sectionSub: { lineHeight: 18 },
  statusCard: { alignItems: 'center', padding: Spacing.five, borderRadius: Spacing.three, borderWidth: 1, gap: Spacing.half },
  card: { paddingHorizontal: Spacing.three, borderRadius: Spacing.three, borderWidth: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.two, gap: Spacing.three },
  toggleBody: { flex: 1, gap: 1 },
  divider: { height: StyleSheet.hairlineWidth },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.three, borderWidth: 1 },
  testBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.three, borderRadius: Spacing.three, borderWidth: 1 },
});
