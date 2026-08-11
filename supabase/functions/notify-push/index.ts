/**
 * notify-push — Supabase Edge Function
 *
 * Sends a push notification to a user's device(s) via the Expo Push API and
 * records it in `public.push_notifications` so the app's realtime feed shows
 * it immediately (and the in-app history survives restarts).
 *
 * Invocation:
 *   supabase.functions.invoke('notify-push', {
 *     body: {
 *       user_id: '<optional — defaults to the caller when authenticated>',
 *       title: 'Payment received',
 *       body: 'Acme Corp paid you $1,200',
 *       type: 'payment_reminder',          // optional, default 'system'
 *       action_route: '/tabs/cloud-sync',  // optional deep link on tap
 *       data: { clientId: '...' },         // optional extra payload
 *     },
 *   })
 *
 * Auth:
 *   - An authenticated user may push to themselves only.
 *   - The service role (other edge functions / DB webhooks) may push to any
 *     user by passing `user_id`.
 *
 * The device push token is read from `user_preferences` (key `push_token`),
 * which the app writes when it registers its Expo push token.
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getAuthUser, getAuthPayload } from '../_shared/auth.ts';

// ---------------------------------------------------------------------------
// CORS headers — required for Supabase Edge Functions
// ---------------------------------------------------------------------------
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const ALLOWED_TYPES = new Set([
  'tax_deadline',
  'payment_reminder',
  'weekly_summary',
  'anomaly',
  'sync_status',
  'feature',
  'system',
]);

interface PushRequest {
  user_id?: string;
  title: string;
  body: string;
  type?: string;
  action_route?: string;
  data?: Record<string, unknown>;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    });

  // --- Auth: authenticated user (self only) or service role (any user) ---
  const authUser = getAuthUser(req);
  const payload = getAuthPayload(req);
  const isServiceRole = payload?.role === 'service_role';

  if (!authUser && !isServiceRole) {
    return json(401, { error: 'Unauthorized' });
  }

  try {
    const body = (await req.json()) as PushRequest;

    if (!body || typeof body.title !== 'string' || !body.title.trim()) {
      return json(400, { error: 'title is required and must be a string' });
    }

    // Resolve the target user.
    let targetUserId = body.user_id ?? authUser?.id ?? null;
    if (authUser && body.user_id && body.user_id !== authUser.id) {
      // Authenticated callers may only notify themselves.
      return json(403, { error: 'Not allowed to notify another user' });
    }
    if (!targetUserId) {
      return json(400, { error: 'user_id is required for service-role calls' });
    }

    const type = ALLOWED_TYPES.has(body.type ?? '')
      ? (body.type as string)
      : 'system';
    const title = body.title.trim().slice(0, 120);
    const text = (body.body ?? '').trim().slice(0, 240);
    const actionRoute = typeof body.action_route === 'string'
      ? body.action_route
      : null;
    const data = body.data && typeof body.data === 'object' ? body.data : null;

    // Service-role client (bypasses RLS for the push token lookup + write).
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    // --- Respect the user's notification preferences -----------------------
    // Master switch (`notifications_enabled`) gates everything; the per-type
    // key (`notif_<type>`) gates this alert type. When disabled, we neither
    // send a device push nor record it in the in-app feed.
    const { data: prefRows, error: prefError } = await admin
      .from('user_preferences')
      .select('key, value')
      .eq('user_id', targetUserId)
      .in('key', ['notifications_enabled', `notif_${type}`]);

    if (prefError) {
      return json(500, { error: `Failed to read preferences: ${prefError.message}` });
    }

    const prefMap: Record<string, string> = {};
    for (const row of prefRows ?? []) {
      prefMap[row.key as string] = (row.value as string | null) ?? 'true';
    }

    const masterEnabled = prefMap['notifications_enabled'] !== 'false';
    const typeEnabled = (prefMap[`notif_${type}`] ?? 'true') !== 'false';

    if (!masterEnabled || !typeEnabled) {
      return json(200, {
        ok: true,
        skipped: true,
        reason: `Notification preferences disabled type "${type}"`,
      });
    }

    // --- Look up the device push token(s) ---
    const { data: tokenRows, error: tokenError } = await admin
      .from('user_preferences')
      .select('value')
      .eq('user_id', targetUserId)
      .eq('key', 'push_token');

    if (tokenError) {
      return json(500, { error: `Failed to read push token: ${tokenError.message}` });
    }

    const tokens = (tokenRows ?? [])
      .map((r) => r.value)
      .filter((t): t is string => !!t && t.startsWith('ExponentPushToken'));

    let pushSent = 0;
    let pushDetails: Array<Record<string, unknown>> = [];

    if (tokens.length > 0) {
      // --- Send via Expo Push API ---
      const expoResult = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(
          tokens.map((to) => ({
            to,
            title,
            body: text,
            sound: 'default',
            data: { type, actionRoute, ...(data ?? {}) },
          })),
        ),
      });

      const resultBody = await expoResult.json().catch(() => ({}));
      const receipts: Array<{ status: string; message?: string }> = resultBody?.data ?? [];
      pushDetails = receipts;
      pushSent = receipts.filter((r) => r.status === 'ok').length;
    }

    // --- Record for the in-app feed / history ---
    const recordId = crypto.randomUUID();
    const { error: insertError } = await admin
      .from('push_notifications')
      .insert({
        id: recordId,
        user_id: targetUserId,
        type,
        title,
        body: text,
        action_route: actionRoute,
        data: data ?? null,
      });

    if (insertError) {
      return json(500, { error: `Failed to record notification: ${insertError.message}` });
    }

    return json(200, {
      ok: true,
      notification_id: recordId,
      push_sent: pushSent,
      push_details: pushDetails,
    });
  } catch (error) {
    return json(400, { error: error instanceof Error ? error.message : 'Unknown error' });
  }
});
