import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

export default function AppVersionScreen() {
  const router = useRouter();
  const theme = useTheme();

  const buildInfo = [
    { label: 'App Version', value: '1.0.0 (Build 1)' },
    { label: 'Expo SDK', value: '56.0.0' },
    { label: 'React Native', value: '0.76.9' },
    { label: 'Supabase Client', value: '2.111.0' },
    { label: 'Bundle Type', value: __DEV__ ? 'Development' : 'Production' },
    { label: 'Build Date', value: '29 Jul 2026' },
    { label: 'Last Updated', value: '28 Jul 2026' },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor={theme.primary} />
          </Pressable>
          <ThemedText type="title" style={styles.headerTitle}>App Version</ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* App icon + version */}
          <View style={[styles.heroCard, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
            <View style={[styles.appIcon, { backgroundColor: theme.primary }]}>
              <ThemedText style={{ color: theme.primaryText, fontSize: 32, fontWeight: '700' }}>ST</ThemedText>
            </View>
            <ThemedText type="default" style={{ fontWeight: '600', fontSize: 20, marginTop: Spacing.two }}>
              SmoothTax
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Version 1.0.0 (Build 1)
            </ThemedText>
          </View>

          {/* Build details */}
          <View style={[styles.detailsCard, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
            {buildInfo.map((info, idx) => (
              <View key={info.label}>
                {idx > 0 && <View style={[styles.divider, { backgroundColor: theme.divider }]} />}
                <View style={styles.detailRow}>
                  <ThemedText type="default" themeColor="textSecondary">{info.label}</ThemedText>
                  <ThemedText type="default" style={{ fontWeight: '500', textAlign: 'right' }}>{info.value}</ThemedText>
                </View>
              </View>
            ))}
          </View>

          {/* Repository */}
          <View style={[styles.linksCard, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
            <Pressable
              onPress={() => Linking.openURL('https://github.com/remote-labs200/smoothtax')}
              style={styles.linkRow}>
              <ThemedText type="default" style={{ color: theme.primary, fontWeight: '500' }}>
                View on GitHub
              </ThemedText>
              <SymbolView name={{ ios: 'arrow.up.forward', android: 'open_in_new', web: 'open_in_new' }} size={16} tintColor={theme.primary} />
            </Pressable>
            <View style={[styles.divider, { backgroundColor: theme.divider }]} />
            <Pressable
              onPress={() => Linking.openURL('https://github.com/remote-labs200/smoothtax/releases')}
              style={styles.linkRow}>
              <ThemedText type="default" style={{ color: theme.primary, fontWeight: '500' }}>
                Release Notes
              </ThemedText>
              <SymbolView name={{ ios: 'arrow.up.forward', android: 'open_in_new', web: 'open_in_new' }} size={16} tintColor={theme.primary} />
            </Pressable>
            <View style={[styles.divider, { backgroundColor: theme.divider }]} />
            <Pressable
              onPress={() => Linking.openURL('https://github.com/remote-labs200/smoothtax/issues')}
              style={styles.linkRow}>
              <ThemedText type="default" style={{ color: theme.primary, fontWeight: '500' }}>
                Report an Issue
              </ThemedText>
              <SymbolView name={{ ios: 'arrow.up.forward', android: 'open_in_new', web: 'open_in_new' }} size={16} tintColor={theme.primary} />
            </Pressable>
          </View>

          {/* License */}
          <View style={[styles.licenseCard, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
            <SymbolView name={{ ios: 'doc.text', android: 'article', web: 'article' }} size={20} tintColor={theme.placeholder} />
            <View style={{ flex: 1, gap: 1 }}>
              <ThemedText type="default" style={{ fontWeight: '500' }}>MIT License</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Copyright (c) 2026 SmoothTax. See LICENSE file for full license text.
              </ThemedText>
            </View>
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
  heroCard: { alignItems: 'center', padding: Spacing.five, borderRadius: Spacing.three, borderWidth: 1 },
  appIcon: { width: 80, height: 80, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  detailsCard: { paddingHorizontal: Spacing.three, borderRadius: Spacing.three, borderWidth: 1 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.two, gap: Spacing.four },
  divider: { height: StyleSheet.hairlineWidth },
  linksCard: { paddingHorizontal: Spacing.three, borderRadius: Spacing.three, borderWidth: 1 },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.three },
  licenseCard: { flexDirection: 'row', padding: Spacing.three, borderRadius: Spacing.three, borderWidth: 1, gap: Spacing.two, alignItems: 'center' },
});
