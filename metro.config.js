const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("wasm");

// ---------------------------------------------------------------------------
// Notification Stub
// ---------------------------------------------------------------------------
// From SDK 53, Expo Go removed Android push notification support.
// expo-notifications has a top-level side effect in
// DevicePushTokenAutoRegistration.fx.js that throws on import in Expo Go.
//
// We intercept resolution of "expo-notifications" and serve a stub module
// instead. The stub has matching exports but no side effects.
//
// When building with expo-dev-client or EAS, set the env var to use the real
// module:
//   EXPO_PUBLIC_USE_REAL_NOTIFICATIONS=true npx expo run:android
// ---------------------------------------------------------------------------

if (process.env.EXPO_PUBLIC_USE_REAL_NOTIFICATIONS !== "true") {
  const NOTIFICATIONS_STUB = path.resolve(
    __dirname,
    "src/lib/expo-notifications-stub.ts"
  );

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === "expo-notifications") {
      return context.resolveRequest(context, NOTIFICATIONS_STUB, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
