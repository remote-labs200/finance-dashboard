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

type MFAMethod = 'app' | 'sms' | 'none';

export default function TwoFactorAuthScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [method, setMethod] = useState<MFAMethod>('none');
  const [isEnabled, setIsEnabled] = useState(false);

  const handleEnable = (m: MFAMethod) => {
    if (m === 'none') {
      setIsEnabled(false);
      setMethod('none');
      return;
    }
    Alert.alert(
      'Setup Two-Factor Auth',
      m === 'app'
        ? 'Generate a QR code to scan with Google Authenticator or Authy.'
        : 'Send verification codes via SMS to your registered phone number.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enable',
          onPress: () => {
            setMethod(m);
            setIsEnabled(true);
          },
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
          <ThemedText type="title" style={styles.headerTitle}>Two-Factor Auth</ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Status */}
          <View style={[styles.statusCard, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
            <SymbolView
              name={isEnabled ? { ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' } : { ios: 'shield', android: 'shield', web: 'shield' }}
              size={40}
              tintColor={isEnabled ? theme.success : theme.placeholder}
            />
            <ThemedText type="default" style={{ fontWeight: '600', marginTop: Spacing.two }}>
              {isEnabled ? 'Two-Factor Auth Active' : 'Not Configured'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              {isEnabled
                ? `Using ${method === 'app' ? 'authenticator app' : 'SMS codes'}.`
                : 'Add an extra layer of security to your account.'}
            </ThemedText>
          </View>

          {/* Methods */}
          <View style={[styles.card, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
            <Pressable
              onPress={() => handleEnable(isEnabled && method === 'app' ? 'none' : 'app')}
              style={styles.methodRow}>
              <SymbolView name={{ ios: 'apps.iphone', android: 'phone_iphone', web: 'phone_iphone' }} size={24} tintColor={isEnabled && method === 'app' ? theme.success : theme.text} />
              <View style={styles.methodBody}>
                <ThemedText type="default" style={{ fontWeight: '500' }}>Authenticator App</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Google Authenticator, Authy, or similar.</ThemedText>
              </View>
              {(isEnabled && method === 'app') && (
                <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={22} tintColor={theme.success} />
              )}
            </Pressable>
            <View style={[styles.divider, { backgroundColor: theme.divider }]} />
            <Pressable
              onPress={() => handleEnable(isEnabled && method === 'sms' ? 'none' : 'sms')}
              style={styles.methodRow}>
              <SymbolView name={{ ios: 'message.fill', android: 'message', web: 'message' }} size={24} tintColor={isEnabled && method === 'sms' ? theme.success : theme.text} />
              <View style={styles.methodBody}>
                <ThemedText type="default" style={{ fontWeight: '500' }}>SMS Codes</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Receive codes via text message.</ThemedText>
              </View>
              {(isEnabled && method === 'sms') && (
                <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={22} tintColor={theme.success} />
              )}
            </Pressable>
          </View>

          {/* Recovery */}
          {isEnabled && (
            <View style={[styles.recoveryCard, { borderColor: theme.warning, backgroundColor: `${theme.warning}08` }]}>
              <SymbolView name={{ ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' }} size={20} tintColor={theme.warning} />
              <View style={styles.recoveryBody}>
                <ThemedText type="default" style={{ fontWeight: '600', color: theme.warning }}>Recovery Codes</ThemedText>
                <ThemedText type="small" style={{ color: theme.warning, lineHeight: 18 }}>
                  Save your recovery codes in a secure place. If you lose access to your 2FA method, recovery codes are the only way back in.
                </ThemedText>
                <Pressable
                  onPress={() => Alert.alert('Recovery Codes', 'ABCD-1234-EFGH-5678\nIJKL-9012-MNOP-3456\nQRST-7890-UVWX-1234')}
                  style={[styles.showCodesBtn, { borderColor: theme.warning }]}>
                  <ThemedText type="default" style={{ color: theme.warning, fontWeight: '600' }}>Show Recovery Codes</ThemedText>
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.infoBox}>
            <SymbolView name={{ ios: 'info.circle', android: 'info', web: 'info' }} size={16} tintColor={theme.primary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.infoText}>
              Two-factor authentication adds an extra verification step during sign-in. Once enabled, you'll need your password and a verification code to log in.
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
  statusCard: { alignItems: 'center', padding: Spacing.five, borderRadius: Spacing.three, borderWidth: 1, gap: Spacing.half },
  card: { paddingHorizontal: Spacing.three, borderRadius: Spacing.three, borderWidth: 1 },
  methodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.three, gap: Spacing.three },
  methodBody: { flex: 1, gap: 1 },
  divider: { height: StyleSheet.hairlineWidth },
  recoveryCard: { flexDirection: 'row', padding: Spacing.three, borderRadius: Spacing.three, borderWidth: 1, gap: Spacing.two },
  recoveryBody: { flex: 1, gap: Spacing.one },
  showCodesBtn: { marginTop: Spacing.one, paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.three, borderWidth: 1, alignItems: 'center' },
  infoBox: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, alignItems: 'flex-start' },
  infoText: { flex: 1, lineHeight: 18 },
});
