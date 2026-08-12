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
import {
  Animated,
  AppState,
  Pressable,
  StatusBar,
  StyleSheet,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/error-boundary";
import { OfflineIndicator } from "@/components/offline-indicator";
import { SplashLogo } from "@/components/splash-logo";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { DatabaseProvider, useSQLiteContext } from "@/db/provider";
import { ensureDefaultCategories } from "@/db/category-repo";
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
  const [biometricRequireLaunch, setBiometricRequireLaunch] = useState(true);
  const [biometricRequireReturn, setBiometricRequireReturn] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [navReady, setNavReady] = useState(false);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const resolvedTheme = useResolvedThemeName();
  const netInfo = useNetInfo();
  const prevAppState = useRef(AppState.currentState);

  const {
    isAvailable: bioAvailable,
    isAuthenticated: bioAuthed,
    authenticate: bioAuth,
    relock: bioRelock,
  } = useBiometricAuth(biometricEnabled);

  // Seed a sensible starter category set once per user (no-op if already seeded).
  useEffect(() => {
    if (!user) return;
    ensureDefaultCategories(db, user.id).catch(() => {});
  }, [db, user]);

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
      if (!route) return;
      // Defer to next tick so the navigator has a chance to mount before
      // we attempt to dispatch a navigation action.
      setTimeout(() => router.push(route as any), 0);
    });

    // Warm taps while the app is running
    const unsubscribeTap = addNotificationTapListener((payload) => {
      const route = routeForNotification(payload);
      if (!route) return;
      // Defer to next tick so navigation happens after the navigator mounts.
      setTimeout(() => router.push(route as any), 0);
    });

    // Live feed updates via Supabase Realtime
    const unsubscribeRealtime = subscribeToRealtimePushEvents(user.id);

    return () => {
      unsubscribeTap();
      unsubscribeRealtime();
    };
  }, [db, user, router]);

  // Biometrics gate the app only when at least one prompt trigger is on.
  const shouldRequireBiometric =
    biometricEnabled && (biometricRequireLaunch || biometricRequireReturn);
  const unlocked =
    !bioAvailable || !shouldRequireBiometric || bioAuthed || !user;

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
    Promise.all([
      SecureStore.getItemAsync("biometric_enabled"),
      SecureStore.getItemAsync("biometric_require_launch"),
      SecureStore.getItemAsync("biometric_require_return"),
    ]).then(([enabled, launch, ret]) => {
      setBiometricEnabled(enabled === "true");
      if (launch !== null) setBiometricRequireLaunch(launch === "true");
      if (ret !== null) setBiometricRequireReturn(ret === "true");
    });
  }, [user]);

  // Prompt for biometrics on launch (when the user opted in).
  useEffect(() => {
    if (!user || !biometricEnabled || !bioAvailable || bioAuthed) return;
    if (!biometricRequireLaunch) return;
    bioAuth();
  }, [
    user,
    biometricEnabled,
    biometricRequireLaunch,
    bioAvailable,
    bioAuthed,
    bioAuth,
  ]);

  // Re-lock and re-authenticate when the app returns to the foreground
  // and "Require on Return" is enabled.
  useEffect(() => {
    if (!user || !biometricEnabled || !biometricRequireReturn) return;
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && prevAppState.current !== "active") {
        bioRelock();
        if (bioAvailable) bioAuth();
      }
      prevAppState.current = nextState;
    });
    return () => sub.remove();
  }, [user, biometricEnabled, biometricRequireReturn, bioAvailable, bioAuth, bioRelock]);

  useEffect(() => {
    if (prevUser.current === user) return;
    prevUser.current = user;

    if (!user) {
      if (navReady) router.replace("/(auth)/welcome");
    }
  }, [user, router, navReady]);

  useEffect(() => {
    if (!user || onboardingDone === null || !navReady) return;

    if (onboardingDone) {
      router.replace("/(tabs)" as any);
    } else {
      router.replace("/(auth)/onboarding");
    }
  }, [user, onboardingDone, router, navReady]);

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
        <Pressable
          onPress={() => bioAuth()}
          style={({ pressed }) => ({
            marginTop: 24,
            paddingVertical: 14,
            paddingHorizontal: 32,
            borderRadius: 14,
            backgroundColor: Colors[resolvedTheme].primary,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <ThemedText
            type="smallBold"
            style={{ color: Colors[resolvedTheme].primaryText }}
          >
            Unlock
          </ThemedText>
        </Pressable>
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
          <Stack screenOptions={{ headerShown: false }} onLayout={() => setNavReady(true)}>
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
