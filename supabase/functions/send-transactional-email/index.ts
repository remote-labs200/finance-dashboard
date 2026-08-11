/**
 * send-transactional-email — Supabase Edge Function
 *
 * Sends a transactional (non-auth) email through Brevo's Transactional Email
 * API and records it in `public.email_log`.
 *
 * Auth emails (signup confirmations, password resets, …) are handled by
 * Supabase Auth's SMTP provider — configure Brevo SMTP there:
 *   https://supabase.com/dashboard/project/_/auth/smtp
 *   host: smtp-relay.brevo.com · port: 587 (STARTTLS) or 465 (SSL)
 *
 * This function covers everything else (receipts, exports, payment
 * confirmations, system notices).
 *
 * Invocation (from the app):
 *   supabase.functions.invoke('send-transactional-email', {
 *     body: { subject: 'Your export', text: '…', html: '<p>…</p>' },
 *   })
 *
 * Auth / abuse protection:
 *   - An authenticated user may only send to their own auth email address
 *     (derived from the JWT `email` claim — the address is not user-supplied).
 *   - The service role (other edge functions / webhooks) may send to any
 *     `to` address.
 *
 * Secrets (set via `supabase secrets set`):
 *   BREVO_API_KEY        — Brevo API key (Settings → API keys)
 *   BREVO_SENDER_EMAIL   — verified from address, e.g. no-reply@…
 *   BREVO_SENDER_NAME    — display name, default "PaySmooth"
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getAuthUser, getAuthPayload } from '../_shared/auth.ts';

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';

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

  // --- Auth: authenticated user (self only) or service role (any `to`) ---
  const authUser = getAuthUser(req);
  const payload = getAuthPayload(req);
  const isServiceRole = payload?.role === 'service_role';
  const authedEmail =
    typeof payload?.email === 'string' ? (payload.email as string).toLowerCase() : null;

  if (!authUser && !isServiceRole) {
    return json(401, { error: 'Unauthorized' });
  }

  // --- Brevo config (gate everything) ---
  const apiKey = Deno.env.get('BREVO_API_KEY');
  const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL');
  const senderName = Deno.env.get('BREVO_SENDER_NAME') ?? 'PaySmooth';

  if (!apiKey || !senderEmail) {
    return json(200, { ok: true, skipped: true, reason: 'Brevo is not configured' });
  }

  try {
    const body = (await req.json()) as {
      to?: string;
      toName?: string;
      subject?: string;
      html?: string;
      text?: string;
      user_id?: string;
    };

    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const htmlContent = typeof body.html === 'string' ? body.html : '';
    const textContent = typeof body.text === 'string' ? body.text : '';

    // Resolve + validate the recipient.
    let toEmail = (body.to ?? '').trim().toLowerCase();
    if (authUser && !isServiceRole) {
      // Users may only email themselves.
      if (toEmail && toEmail !== authedEmail) {
        return json(403, { error: 'Not allowed to email another address' });
      }
      toEmail = authedEmail ?? '';
    }
    if (!toEmail) {
      return json(400, { error: 'to is required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      return json(400, { error: 'to is not a valid email address' });
    }
    if (!subject || (!htmlContent && !textContent)) {
      return json(400, { error: 'subject and a body (html/text) are required' });
    }

    // --- Send via Brevo ---
    const brevoResponse = await fetch(BREVO_SEND_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: toEmail, name: body.toName ?? senderName }],
        subject,
        htmlContent: htmlContent || undefined,
        textContent: textContent || undefined,
        tags: ['paysmooth-app'],
      }),
    });

    const brevoBody = await brevoResponse.json().catch(() => ({}));
    const sent = brevoResponse.ok;

    // --- Record in the audit log (service role bypasses RLS) ---
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const logUserId = authUser?.id ?? body.user_id ?? null;
    await admin.from('email_log').insert({
      id: crypto.randomUUID(),
      user_id: logUserId,
      to_email: toEmail,
      subject,
      provider: 'brevo',
      status: sent ? 'sent' : 'failed',
      error_message: sent
        ? null
        : JSON.stringify(brevoBody).slice(0, 500),
    });

    return json(sent ? 200 : 502, {
      ok: sent,
      messageId: (brevoBody as { messageId?: string })?.messageId ?? null,
      ...(sent ? {} : { error: brevoBody }),
    });
  } catch (error) {
    return json(400, { error: error instanceof Error ? error.message : 'Unknown error' });
  }
});