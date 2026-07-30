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

interface Device {
  id: string;
  name: string;
  type: string;
  os: string;
  ip: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

const DEVICES: Device[] = [
  { id: '1', name: 'My iPhone', type: 'iPhone 16 Pro', os: 'iOS 19.2', ip: '192.168.1.42', location: 'New York, NY', lastActive: 'Now', isCurrent: true },
  { id: '2', name: 'Work MacBook', type: 'MacBook Pro 16"', os: 'macOS 15.1', ip: '192.168.1.15', location: 'New York, NY', lastActive: '2 hours ago', isCurrent: false },
  { id: '3', name: 'Chrome Browser', type: 'Web', os: 'Chrome 125 / Windows 11', ip: '203.0.113.42', location: 'Brooklyn, NY', lastActive: 'Yesterday', isCurrent: false },
];

export default function ConnectedDevicesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [devices, setDevices] = useState(DEVICES);

  const handleRevoke = (id: string) => {
    const device = devices.find((d) => d.id === id);
    if (!device || device.isCurrent) return;
    Alert.alert(
      'Revoke Access',
      `Sign out ${device.name} (${device.type}) from this account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => setDevices((prev) => prev.filter((d) => d.id !== id)),
        },
      ],
    );
  };

  const currentDevice = devices.find((d) => d.isCurrent);
  const otherDevices = devices.filter((d) => !d.isCurrent);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor={theme.primary} />
          </Pressable>
          <ThemedText type="title" style={styles.headerTitle}>Connected Devices</ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={{ fontWeight: '500' }}>
            {devices.length}
          </ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Current device */}
          {currentDevice && (
            <View style={styles.section}>
              <ThemedText type="callout" style={styles.sectionTitle}>This Device</ThemedText>
              <View style={[styles.deviceCard, { borderColor: theme.primary, backgroundColor: theme.card }]}>
                <View style={styles.deviceTop}>
                  <SymbolView name={{ ios: 'iphone', android: 'phone_android', web: 'phone_android' }} size={28} tintColor={theme.primary} />
                  <View style={styles.deviceInfo}>
                    <ThemedText type="default" style={{ fontWeight: '600' }}>{currentDevice.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">{currentDevice.type} — {currentDevice.os}</ThemedText>
                  </View>
                  <View style={[styles.badge, { backgroundColor: `${theme.success}15` }]}>
                    <ThemedText type="small" style={{ color: theme.success, fontWeight: '600' }}>Current</ThemedText>
                  </View>
                </View>
                <View style={styles.deviceMeta}>
                  <ThemedText type="small" themeColor="textSecondary">IP: {currentDevice.ip}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{currentDevice.location}</ThemedText>
                </View>
              </View>
            </View>
          )}

          {/* Other devices */}
          {otherDevices.length > 0 && (
            <View style={styles.section}>
              <ThemedText type="callout" style={styles.sectionTitle}>Other Sessions</ThemedText>
              {otherDevices.map((device) => (
                <View key={device.id} style={[styles.deviceCard, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
                  <View style={styles.deviceTop}>
                    <SymbolView
                      name={device.type === 'Web' ? { ios: 'globe', android: 'language', web: 'language' } : { ios: 'laptopcomputer', android: 'computer', web: 'computer' }}
                      size={24} tintColor={theme.text}
                    />
                    <View style={styles.deviceInfo}>
                      <ThemedText type="default" style={{ fontWeight: '500' }}>{device.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{device.type} — {device.os}</ThemedText>
                    </View>
                  </View>
                  <View style={styles.deviceMeta}>
                    <ThemedText type="small" themeColor="textSecondary">IP: {device.ip}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">{device.location}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">Last active: {device.lastActive}</ThemedText>
                  </View>
                  <Pressable
                    onPress={() => handleRevoke(device.id)}
                    style={[styles.revokeBtn, { borderColor: theme.danger }]}>
                    <ThemedText type="default" style={{ color: theme.danger, fontWeight: '600' }}>Revoke Access</ThemedText>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <View style={styles.infoBox}>
            <SymbolView name={{ ios: 'info.circle', android: 'info', web: 'info' }} size={16} tintColor={theme.primary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.infoText}>
              Devices shown are sessions authenticated with your account. Revoking a device signs it out immediately.
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
  deviceCard: { padding: Spacing.three, borderRadius: Spacing.three, borderWidth: 1, gap: Spacing.two },
  deviceTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  deviceInfo: { flex: 1, gap: 1 },
  badge: { paddingVertical: 2, paddingHorizontal: Spacing.two, borderRadius: Spacing.one },
  deviceMeta: { gap: 1, marginLeft: 24 + Spacing.two },
  revokeBtn: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.three, borderWidth: 1, alignSelf: 'flex-end' },
  infoBox: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, alignItems: 'flex-start' },
  infoText: { flex: 1, lineHeight: 18 },
});
