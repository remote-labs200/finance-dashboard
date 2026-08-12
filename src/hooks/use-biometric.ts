/**
 * useBiometricAuth
 *
 * Hook for biometric authentication (Face ID / Touch ID / Fingerprint).
 * Wraps expo-local-authentication for a clean API.
 *
 * Usage in _layout.tsx:
 *   - On app launch, check if biometric is enabled (stored in user_preferences)
 *   - If enabled, prompt the user to authenticate before showing the main UI
 *   - If the user cancels, hide the content (don't fall back to showing data)
 */

import * as LocalAuthentication from "expo-local-authentication";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

export interface BiometricState {
  /** Whether the device supports biometric auth */
  isAvailable: boolean;
  /** Biometric type names user-friendly, e.g. "Face ID", "Touch ID", "Fingerprint" */
  biometryType: string | null;
  /** Whether biometric auth is currently enabled by the user */
  isEnabled: boolean;
  /** Whether the user is currently authenticated for this session */
  isAuthenticated: boolean;
  /** Whether the user cancelled the prompt (app content should be hidden) */
  didCancel: boolean;
}

const initialState: BiometricState = {
  isAvailable: false,
  biometryType: null,
  isEnabled: false,
  isAuthenticated: false,
  didCancel: false,
};

/**
 * Check device hardware support for biometric authentication.
 */
export async function getBiometricSupport(): Promise<{
  available: boolean;
  type: LocalAuthentication.AuthenticationType | null;
}> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return { available: false, type: null };

  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) return { available: false, type: null };

  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  const type = types.length > 0 ? types[0] : null;

  return { available: true, type };
}

/**
 * Map authentication type to a human-readable string.
 */
export function biometryLabel(
  type: LocalAuthentication.AuthenticationType | null,
): string | null {
  if (Platform.OS === "ios") {
    return type === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
      ? "Face ID"
      : type === LocalAuthentication.AuthenticationType.FINGERPRINT
        ? "Touch ID"
        : null;
  }
  // Android
  return type === LocalAuthentication.AuthenticationType.FINGERPRINT
    ? "Fingerprint"
    : type === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
      ? "Face Unlock"
      : type === LocalAuthentication.AuthenticationType.IRIS
        ? "Iris"
        : null;
}

/**
 * React hook for biometric auth state management.
 *
 * @param preferencesKey - Key in user_preferences for storing enable/disable state
 * @param enabled - Whether biometric is enabled by user preference
 * @param onAuthenticate - Called when biometric auth completes successfully
 */
export function useBiometricAuth(
  enabled: boolean,
  onAuthenticate?: () => void,
) {
  const [state, setState] = useState<BiometricState>(initialState);
  const calledRef = useRef(false);

  // Check device support on mount
  useEffect(() => {
    (async () => {
      const { available } = await getBiometricSupport();
      setState((s) => ({ ...s, isAvailable: available }));
    })();
  }, []);

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!enabled) {
      setState((s) => ({ ...s, isAuthenticated: true, didCancel: false }));
      return true;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock PaySmooth",
        fallbackLabel: "Enter passcode",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });

      if (result.success) {
        setState((s) => ({ ...s, isAuthenticated: true, didCancel: false }));
        onAuthenticate?.();
        return true;
      }

      // User cancelled or failed
      setState((s) => ({
        ...s,
        isAuthenticated: false,
        didCancel: !result.error?.includes("not_available"),
      }));
      return false;
    } catch {
      setState((s) => ({ ...s, isAuthenticated: false, didCancel: false }));
      return false;
    }
  }, [enabled, onAuthenticate]);

  /**
   * Lock the app again (e.g. when it returns from the background and
   * "Require on Return" is enabled). The caller re-triggers `authenticate`.
   */
  const relock = useCallback(() => {
    setState((s) => ({ ...s, isAuthenticated: false, didCancel: false }));
  }, []);

  return {
    ...state,
    authenticate,
    relock,
  };
}
