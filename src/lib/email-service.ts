/**
 * Email service — client wrappers for the transactional / marketing edge
 * functions. Fire-and-forget callers should `.catch()` — these must never
 * block a user action when Supabase isn't configured or the edge functions
 * are unreachable.
 */

import { supabase } from './supabase';

export interface TransactionalEmailPayload {
  /** Defaults to the caller's own auth email when omitted. */
  to?: string;
  toName?: string;
  subject: string;
  html?: string;
  text?: string;
}

export interface MarketingContactPayload {
  /** For authenticated callers the server uses the JWT email instead. */
  email?: string;
  firstname?: string;
  lastname?: string;
  triggerAutomation?: boolean;
  /** When true, the subscriber is removed from the marketing list (opt-out). */
  optOut?: boolean;
}

/**
 * Send a transactional email through Brevo (records an entry in email_log).
 * Resolves silently when the edge function isn't reachable.
 */
export async function sendTransactionalEmail(
  payload: TransactionalEmailPayload,
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.functions.invoke('send-transactional-email', {
      body: {
        to: payload.to,
        toName: payload.toName,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      },
    });
  } catch (err) {
    console.warn('sendTransactionalEmail failed:', err);
  }
}

/**
 * Subscribe a user to the marketing list after signup (Sender.net).
 * Resolves silently when Sender isn't configured yet.
 */
export async function syncMarketingContact(
  payload: MarketingContactPayload,
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.functions.invoke('sync-marketing-contact', {
      body: {
        email: payload.email,
        firstname: payload.firstname,
        lastname: payload.lastname,
        trigger_automation: payload.triggerAutomation,
        opt_out: payload.optOut,
      },
    });
  } catch (err) {
    console.warn('syncMarketingContact failed:', err);
  }
}