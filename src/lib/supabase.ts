import 'expo-sqlite/localStorage/install';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const isConfigured =
  !!supabaseUrl &&
  !!supabasePublishableKey &&
  isValidUrl(supabaseUrl) &&
  supabasePublishableKey.length > 20;

/**
 * Supabase client. Returns null when env vars are missing or invalid,
 * so the app can still run in local-only mode.
 */
export const supabase: SupabaseClient | null = isConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        storage: localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
