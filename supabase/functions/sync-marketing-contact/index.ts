/**
 * sync-marketing-contact — Supabase Edge Function
 *
 * Adds a new user to your Sender.net marketing list when they sign up, so
 * they receive your welcome automation / newsletter.
 *
 * Sender API (v2):
 *   POST https://api.sender.net/v2/subscribers
 *   Authorization: Bearer <token>   (Settings → API access tokens)
 *
 * The app calls this right after a successful signup:
 *   supabase.functions.invoke('sync-marketing-contact', {
 *     body: { email: 'user@example.com', firstname: 'Jane', lastname: 'Doe' },
 *   })
 *
 * Auth:
 *   - An authenticated user may only subscribe their own email (derived from
 *     the JWT `email` claim, so the address is not client-supplied).
 *   - The service role may subscribe any address (bulk imports, admin).
 *
 * Secrets (set via `supabase secrets set`):
 *   SENDER_API_KEY    — Sender access token
 *   SENDER_GROUP_ID   — optional group id to add the subscriber to
 *
 * When SENDER_API_KEY is not set, the function is a no-op so signup never
 * fails because marketing isn't configured yet.
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getAuthUser, getAuthPayload } from '../_shared/auth.ts';

const SENDER_SUBSCRIBERS_URL = 'https://api.sender.net/v2/subscribers';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    });

  const authUser = getAuthUser(req);
  const payload = getAuthPayload(req);
  const isServiceRole = payload?.role === 'service_role';
  const authedEmail =
    typeof payload?.email === 'string' ? (payload.email as string).toLowerCase() : null;

  if (!authUser && !isServiceRole) {
    return json(401, { error: 'Unauthorized' });
  }

  const apiToken = Deno.env.get('SENDER_API_KEY');
  if (!apiToken) {
    return json(200, { ok: true, skipped: true, reason: 'Sender is not configured' });
  }

  try {
    const body = (await req.json()) as {
      email?: string;
      firstname?: string;
      lastname?: string;
      user_id?: string;
      trigger_automation?: boolean;
      opt_out?: boolean;
    };

    // Resolve the subscriber email (never trust a client-supplied address for
    // authenticated callers — use the address from their JWT).
    let email = (body.email ?? '').trim().toLowerCase();
    if (authUser && !isServiceRole) {
      if (email && email !== authedEmail) {
        return json(403, { error: 'Not allowed to subscribe another email' });
      }
      email = authedEmail ?? '';
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(400, { error: 'email is required and must be valid' });
    }

    // --- Opt-out: remove the subscriber from Sender -------------------------
    // Called when the user disables marketing in Settings. Deleting requires
    // their own email (already enforced above), no consent check needed.
    if (body.opt_out) {
      const removeResponse = await fetch(SENDER_SUBSCRIBERS_URL, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ subscribers: [email] }),
      });

      const removeBody = await removeResponse.json().catch(() => ({}));

      if (!removeResponse.ok) {
        return json(502, { ok: false, error: removeBody });
      }
      return json(200, { ok: true, unsubscribed: true, result: removeBody });
    }

    // --- Consent gate (server-side enforcement) -----------------------------
    // Only subscribe users who opted in at signup (`marketing_consent` pref,
    // persisted by the client just before calling this function). This keeps
    // the guarantee server-side even if the client is bypassed.
    const targetUserId = authUser?.id ?? body.user_id ?? null;
    if (targetUserId) {
      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        { auth: { persistSession: false } },
      );

      const { data: prefRow } = await admin
        .from('user_preferences')
        .select('value')
        .eq('user_id', targetUserId)
        .eq('key', 'marketing_consent')
        .maybeSingle();

      if (prefRow?.value !== 'true') {
        return json(200, {
          ok: true,
          skipped: true,
          reason: 'Marketing consent was not given',
        });
      }
    }

    const groupId = Deno.env.get('SENDER_GROUP_ID');
    const triggerAutomation =
      typeof body.trigger_automation === 'boolean'
        ? body.trigger_automation
        : true;

    const senderResponse = await fetch(SENDER_SUBSCRIBERS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email,
        firstname: body.firstname ?? '',
        lastname: body.lastname ?? '',
        groups: groupId ? [groupId] : undefined,
        trigger_automation: triggerAutomation,
      }),
    });

    const senderBody = await senderResponse.json().catch(() => ({}));

    if (!senderResponse.ok) {
      return json(502, {
        ok: false,
        error: senderBody,
      });
    }

    return json(200, {
      ok: true,
      subscriber: (senderBody as { data?: unknown })?.data ?? senderBody,
    });
  } catch (error) {
    return json(400, { error: error instanceof Error ? error.message : 'Unknown error' });
  }
});