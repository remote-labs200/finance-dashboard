import { DarkTheme, DefaultTheme, ThemeProvider, Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { DatabaseProvider, useSQLiteContext } from '@/db/provider';
import { useAuthStore } from '@/stores/use-auth-store';
import { useThemeStore } from '@/stores/use-theme-store';
import { useResolvedThemeName } from '@/hooks/use-theme';
import { Colors } from '@/constants/theme';
import {
  setupNotificationChannels,
  requestNotificationPermission,
} from '@/lib/notification-service';
import { ErrorBoundary } from '@/components/error-boundary';
import { OfflineIndicator } from '@/components/offline-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useBiometricAuth } from '@/hooks/use-biometric';

SplashScreen.preventAutoHideAsync();

const ONBOARDING_KEY = 'onboarding_completed';

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <RootLayoutInner />
    </DatabaseProvider>
  );
}

function RootLayoutInner() {
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const init = useAuthStore((state) => state.init);
  const loadThemePreference = useThemeStore((s) => s.loadPreference);
  const router = useRouter();
  const prevUser = useRef(user);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const resolvedTheme = useResolvedThemeName();

  const { isAvailable: bioAvailable, isAuthenticated: bioAuthed, authenticate: bioAuth } = useBiometricAuth(biometricEnabled);

  const unlocked = !bioAvailable || !biometricEnabled || bioAuthed || !user;

  useEffect(() => {
    let mounted = true;
    Promise.all([
      init(db),
      loadThemePreference(),
      // Notification channels and permissions are lazy-loaded internally —
      // they gracefully no-op if expo-notifications is unavailable (Expo Go
      // SDK 53+, web, etc.). The static import at the top only brings in the
      // wrapper functions; the actual expo-notifications module is loaded via
      // dynamic import() inside each function call.
      setupNotificationChannels().catch(() => {}),
      requestNotificationPermission().catch(() => {}),
    ]).finally(() => {
      if (mounted) SplashScreen.hideAsync();
    });
    return () => { mounted = false; };
  }, [init, db, loadThemePreference]);

  // Check onboarding status when user signs in
  useEffect(() => {
    let mounted = true;
    if (!user) {
      if (mounted) setOnboardingDone(null);
      return;
    }
    SecureStore.getItemAsync(ONBOARDING_KEY).then((val) => {
      if (mounted) setOnboardingDone(val === 'true');
    });
    return () => { mounted = false; };
  }, [user]);

  // Check if biometric is preferred by user
  useEffect(() => {
    if (!user) return;
    SecureStore.getItemAsync('biometric_enabled').then((val) => {
      setBiometricEnabled(val === 'true');
    });
  }, [user]);

  // Auto-trigger biometric auth when user is signed in and biometric is enabled
  useEffect(() => {
    if (!user || !biometricEnabled || !bioAvailable || bioAuthed) return;
    bioAuth();
  }, [user, biometricEnabled, bioAvailable, bioAuthed, bioAuth]);

  useEffect(() => {
    if (prevUser.current === user) return;
    prevUser.current = user;

    if (user) {
      // Don't navigate yet -- wait for onboarding check
    } else {
      router.replace('/(auth)/welcome');
    }
  }, [user, router]);

  useEffect(() => {
    if (!user || onboardingDone === null) return;

    if (onboardingDone) {
      router.replace('/(tabs)' as any);
    } else {
      router.replace('/(auth)/onboarding');
    }
  }, [user, onboardingDone, router]);

  if (!unlocked) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <ThemedText type="title">SmoothTax</ThemedText>
        <ThemedText type="callout" themeColor="textSecondary" style={{ marginTop: 12 }}>
          Authenticate to unlock the app
        </ThemedText>
        <StatusBar
          barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={Colors[resolvedTheme].background}
        />
      </ThemedView>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider value={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar
          barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={Colors[resolvedTheme].background}
        />
        {user && <OfflineIndicator />}
        <Stack screenOptions={{ headerShown: false }}>
          {user ? (
            <Stack.Screen name="(tabs)" />
          ) : (
            <Stack.Screen name="(auth)" />
          )}
        </Stack>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
