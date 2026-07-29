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
  const resolvedTheme = useResolvedThemeName();

  useEffect(() => {
    let mounted = true;
    Promise.all([
      init(db),
      loadThemePreference(),
      setupNotificationChannels(),
      requestNotificationPermission().then((granted) => {
        if (granted) console.log('Notification permission granted');
      }),
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

  return (
    <ThemeProvider value={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar
        barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={Colors[resolvedTheme].background}
      />
      <Stack screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="(tabs)" />
        ) : (
          <Stack.Screen name="(auth)" />
        )}
      </Stack>
    </ThemeProvider>
  );
}
