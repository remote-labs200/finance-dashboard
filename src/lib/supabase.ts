import 'expo-sqlite/localStorage/install';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

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
 * In-memory fallback storage when localStorage is not available
 * (e.g. web SSR / Node.js render context).
 */
function getStorage(): StorageAdapter {
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  // Simple in-memory store for environments without localStorage
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  };
}

/**
 * Supabase client. Returns null when env vars are missing or invalid,
 * so the app can still run in local-only mode.
 */
export const supabase: SupabaseClient | null = isConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        storage: getStorage(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/**
 * Read-only view of the Supabase configuration baked into this build.
 * Credentials come from .env at build time and cannot be changed at
 * runtime — screens show this instead of a fake "save credentials" form.
 */
export const supabaseConfig = {
  isConfigured,
  projectUrl: supabaseUrl ?? "",
  hasPublishableKey: !!supabasePublishableKey,
} as const;
