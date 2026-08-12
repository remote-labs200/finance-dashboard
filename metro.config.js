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

// ---------------------------------------------------------------------------
// exceljs -> bare build
// ---------------------------------------------------------------------------
// exceljs's browser bundle (dist/exceljs.min.js, selected via its package.json
// "browser" field) executes `require('core-js/modules/es.promise')` at import
// time, which REPLACES the global Promise with a core-js implementation. That
// polyfill recurses infinitely inside @supabase/auth-js's retryable token
// refresh ("RangeError: Maximum call stack size exceeded").
//
// `dist/exceljs.bare.js` is the identical library WITHOUT the global Promise
// patch (verified: it references core-js internals but never runs
// es.promise/es.promise.finally). Resolve exceljs to that build instead.
// ---------------------------------------------------------------------------
const EXCELJS_BARE = path.resolve(
  __dirname,
  "node_modules/exceljs/dist/exceljs.bare.js"
);

if (process.env.EXPO_PUBLIC_USE_REAL_NOTIFICATIONS !== "true") {
  const NOTIFICATIONS_STUB = path.resolve(
    __dirname,
    "src/lib/expo-notifications-stub.ts"
  );

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === "exceljs") {
      return context.resolveRequest(context, EXCELJS_BARE, platform);
    }
    if (moduleName === "expo-notifications") {
      return context.resolveRequest(context, NOTIFICATIONS_STUB, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
