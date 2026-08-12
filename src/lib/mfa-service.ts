/**
 * MFA service — real TOTP two-factor authentication via Supabase Auth.
 *
 * Enrollment flow:
 *   1. `enrollTotp()`        → creates an unverified factor, returns QR + secret + recovery codes
 *   2. `challengeFactor()`   → creates a challenge for the pending factor
 *   3. `verifyFactor()`      → checks the 6-digit code, then the factor becomes active
 *   4. `unenrollFactor()`    → removes a factor (used for "Disable 2FA" and cleanup)
 *
 * Sign-in flow (see use-auth-store.verifyMfaCode):
 *   1. `challengeFactor()` on the user's verified TOTP factor
 *   2. `verifyFactor()` with the 6-digit code → returns fresh access/refresh tokens
 *   3. `supabase.auth.setSession()` completes the sign-in
 *
 * These functions no-op/throw clearly when Supabase is not configured.
 */

import { supabase } from "@/lib/supabase";

export interface MfaTotpFactor {
  id: string;
  friendlyName: string | null;
}

export interface EnrollTotpResult {
  factorId: string;
  /** Raw SVG markup of the QR code (render with react-native-svg SvgXml). */
  qrCodeSvg: string;
  /** TOTP secret for manual entry into an authenticator app. */
  secret: string;
  /** otpauth:// URI encoded in the QR code. */
  uri: string;
  /** One-time recovery codes. Show once and tell the user to save them. */
  recoveryCodes: string[];
}

/**
 * List the user's verified TOTP factors.
 * Returns an empty array when Supabase is not configured.
 */
export async function listVerifiedTotpFactors(): Promise<MfaTotpFactor[]> {
  if (!supabase) return [];

  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error(error.message);

  return (data.totp ?? [])
    .filter((f) => f.status === "verified")
    .map((f) => ({ id: f.id, friendlyName: f.friendly_name }));
}

/** Enroll a new TOTP factor. The factor is unverified until `verifyFactor` succeeds. */
export async function enrollTotp(): Promise<EnrollTotpResult> {
  if (!supabase) {
    throw new Error("Supabase is not configured. Sign in to enable 2FA.");
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
  });
  if (error) throw new Error(error.message);

  return {
    factorId: data.id,
    qrCodeSvg: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
    recoveryCodes: data.recovery_codes ?? [],
  };
}

/** Create a challenge for a factor. Returns the challenge id used by `verifyFactor`. */
export async function challengeFactor(
  factorId: string,
): Promise<{ challengeId: string }> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.auth.mfa.challenge({ factorId });
  if (error) throw new Error(error.message);

  return { challengeId: data.id };
}

/**
 * Verify a 6-digit TOTP code against a challenge.
 * On success, the factor becomes active (verified).
 */
export async function verifyFactor(
  factorId: string,
  challengeId: string,
  code: string,
): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId,
    code: code.replace(/\s/g, ""),
  });
  if (error) throw new Error(error.message);
}

/** Remove a factor (disables 2FA for it). */
export async function unenrollFactor(factorId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw new Error(error.message);
}
