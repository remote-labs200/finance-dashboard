/**
 * Network error detection utilities.
 * Distinguishes connectivity failures from actual API errors
 * so the app can fall back to offline-queue mode gracefully.
 */

export function isNetworkError(error: unknown): boolean {
  if (!error) return false;

  const msg =
    (error as any)?.message?.toLowerCase?.() ??
    (typeof error === 'string' ? error.toLowerCase() : '');

  return (
    msg.includes('network') ||
    msg.includes('fetch failed') ||
    msg.includes('fetch is not connected') ||
    msg.includes('connection') ||
    msg.includes('timeout') ||
    msg.includes('offline') ||
    msg.includes('internet') ||
    msg.includes('dns') ||
    msg.includes('enotfound') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('network request failed') ||
    (error as any)?.code === 'NETWORK_ERROR' ||
    (error as any)?.code === 'ERR_NETWORK'
  );
}

/**
 * Check if the device has network connectivity by attempting
 * a lightweight fetch to Supabase's health endpoint.
 */
export async function checkConnectivity(supabaseUrl?: string): Promise<boolean> {
  if (!supabaseUrl) return false;
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(supabaseUrl.replace(/\/+$/, '') + '/health', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(id);
    return res.ok;
  } catch {
    return false;
  }
}
