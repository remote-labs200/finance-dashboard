/**
 * OfflineIndicator
 *
 * A banner that appears at the top of the screen when the device has no
 * network connectivity. Uses the network detection logic from network-utils.
 *
 * Wire this into _layout.tsx once (inside DatabaseProvider) so it shows
 * across all screens.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from './themed-text';
import { useThemeColors } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

const POLL_INTERVAL_MS = 10_000;

/** Lightweight connectivity check via Google's 204 endpoint. */
async function checkOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://clients3.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(id);
    return res.ok;
  } catch {
    return false;
  }
}

export function OfflineIndicator() {
  const [offline, setOffline] = useState(false);
  const colors = useThemeColors();

  const check = useCallback(async () => {
    const connected = await checkOnline();
    setOffline(!connected);
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [check]);

  if (!offline) return null;

  return (
    <View style={[styles.banner, { backgroundColor: colors.danger }]}>
      <SymbolView
        name={{ ios: 'wifi.slash', android: 'signal_wifi_off', web: 'signal_wifi_off' }}
        size={14}
        tintColor="#FFFFFF"
        style={styles.icon}
      />
      <ThemedText type="small" style={styles.text}>
        No internet connection — changes will sync when you're back online
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.four,
    gap: Spacing.one,
  },
  icon: {
    marginTop: Platform.OS === 'ios' ? 1 : 0,
  },
  text: {
    color: '#FFFFFF',
    textAlign: 'center',
    flexShrink: 1,
  },
});
