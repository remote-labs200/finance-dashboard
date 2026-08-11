import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
} from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { Animated, StatusBar, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/error-boundary";
import { OfflineIndicator } from "@/components/offline-indicator";
import { SplashLogo } from "@/components/splash-logo";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { DatabaseProvider, useSQLiteContext } from "@/db/provider";
import { useBiometricAuth } from "@/hooks/use-biometric";
import { useResolvedThemeName } from "@/hooks/use-theme";
import {
  addNotificationTapListener,
  fetchNotificationHistory,
  getInitialNotificationResponse,
  refreshTaxDeadlineReminders,
  registerPushToken,
  requestNotificationPermission,
  routeForNotification,
  setupNotificationChannels,
  subscribeToRealtimePushEvents,
} from "@/lib/notification-service";
import { performFullSync } from "@/lib/sync-service";
import { useAuthStore } from "@/stores/use-auth-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { useNetInfo } from "@react-native-community/netinfo";

SplashScreen.preventAutoHideAsync();

const ONBOARDING_KEY = "onboarding_completed";
const SPLASH_BG = "#208AEF";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        <RootLayoutInner />
      </DatabaseProvider>
    </SafeAreaProvider>
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
  const [showSplash, setShowSplash] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const resolvedTheme = useResolvedThemeName();
  const netInfo = useNetInfo();

  const {
    isAvailable: bioAvailable,
    isAuthenticated: bioAuthed,
    authenticate: bioAuth,
  } = useBiometricAuth(biometricEnabled);

  // Sync on network change
  useEffect(() => {
    if (netInfo.isConnected && user) {
      performFullSync(db).catch(console.error);
    }
  }, [netInfo.isConnected, user, db]);

  // Push notification lifecycle: register token, restore history, listen for
  // live events, and deep-link when a notification is tapped.
  useEffect(() => {
    if (!user) return;

    registerPushToken(db, user.id).catch(() => {});
    fetchNotificationHistory(user.id).catch(() => {});

    // Schedule on-device tax-deadline reminders (respects user prefs).
    refreshTaxDeadlineReminders(db, user.id).catch(() => {});

    // Cold start: app opened by tapping a notification
    getInitialNotificationResponse().then((payload) => {
      if (!payload) return;
      const route = routeForNotification(payload);
      if (route) router.push(route as any);
    });

    // Warm taps while the app is running
    const unsubscribeTap = addNotificationTapListener((payload) => {
      const route = routeForNotification(payload);
      if (route) router.push(route as any);
    });

    // Live feed updates via Supabase Realtime
    const unsubscribeRealtime = subscribeToRealtimePushEvents(user.id);

    return () => {
      unsubscribeTap();
      unsubscribeRealtime();
    };
  }, [db, user, router]);

  const unlocked = !bioAvailable || !biometricEnabled || bioAuthed || !user;

  // On cold boot: init DB, load preferences, then hide native splash.
  // After that, fade out the custom splash overlay to reveal the app.
  useEffect(() => {
    let mounted = true;
    Promise.all([
      init(db),
      loadThemePreference(),
      setupNotificationChannels().catch(() => {}),
      requestNotificationPermission().catch(() => {}),
    ]).finally(() => {
      if (!mounted) return;
      // Keep custom splash visible for at least 1.2 s so the user sees the logo.
      setTimeout(() => {
        SplashScreen.hideAsync();
        Animated.timing(splashOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => {
          if (mounted) setShowSplash(false);
        });
      }, 1200);
    });
    return () => {
      mounted = false;
    };
  }, [init, db, loadThemePreference, splashOpacity]);

  // Check onboarding status when user signs in
  useEffect(() => {
    let mounted = true;
    if (!user) {
      if (mounted) setOnboardingDone(null);
      return;
    }
    SecureStore.getItemAsync(ONBOARDING_KEY).then((val) => {
      if (mounted) setOnboardingDone(val === "true");
    });
    return () => {
      mounted = false;
    };
  }, [user]);

  // Check if biometric is preferred by user
  useEffect(() => {
    if (!user) return;
    SecureStore.getItemAsync("biometric_enabled").then((val) => {
      setBiometricEnabled(val === "true");
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
      router.replace("/(auth)/welcome");
    }
  }, [user, router]);

  useEffect(() => {
    if (!user || onboardingDone === null) return;

    if (onboardingDone) {
      router.replace("/(tabs)" as any);
    } else {
      router.replace("/(auth)/onboarding");
    }
  }, [user, onboardingDone, router]);

  // ── Biometric lock screen ─────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <ThemedView
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 32,
        }}
      >
        <SplashLogo
          wordmarkColor={Colors[resolvedTheme].text}
          taglineColor={Colors[resolvedTheme].textSecondary}
        />
        <ThemedText
          type="callout"
          themeColor="textSecondary"
          style={{ marginTop: 48 }}
        >
          Authenticate to unlock the app
        </ThemedText>
        <StatusBar
          barStyle={resolvedTheme === "dark" ? "light-content" : "dark-content"}
          backgroundColor={Colors[resolvedTheme].background}
        />
      </ThemedView>
    );
  }

  // ── App shell ─────────────────────────────────────────────────────────────
  return (
    <>
      <ErrorBoundary>
        <ThemeProvider
          value={resolvedTheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <StatusBar
            barStyle={
              resolvedTheme === "dark" ? "light-content" : "dark-content"
            }
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

      {/* Custom splash overlay — fades out after init completes */}
      {showSplash && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.splashOverlay,
            { opacity: splashOpacity },
          ]}
        >
          <SplashLogo />
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  splashOverlay: {
    backgroundColor: SPLASH_BG,
    justifyContent: "center",
    alignItems: "center",
  },
});
