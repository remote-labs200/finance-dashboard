/**
 * Shared auth guard for PaySmooth edge functions.
 *
 * With `verify_jwt = true` (supabase/config.toml) the gateway already
 * validates the JWT signature before this code runs, so decoding the payload
 * here is safe. We additionally require an *authenticated* user (role
 * "authenticated" with a `sub` claim) rather than merely the public anon /
 * publishable key, so that unauthenticated callers cannot invoke cost-bearing
 * AI endpoints.
 */

export function getAuthUser(req: Request): { id: string } | null {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const payload = decodePayload(token);
  if (!payload) return null;

  if (payload.role !== "authenticated") return null;
  const sub = typeof payload.sub === "string" ? payload.sub : null;
  if (!sub) return null;

  return { id: sub };
}

/**
 * Returns the decoded JWT payload for a request, or null when the
 * Authorization header is missing / not a valid JWT.
 */
export function getAuthPayload(
  req: Request,
): Record<string, unknown> | null {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  return decodePayload(token);
}

function decodePayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  let payload: Record<string, unknown>;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    payload = JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
  return payload;
}
