import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";
import { create } from "zustand";

import {
  createUser,
  findFirstUser,
  findUserByEmail,
  updatePasswordHash,
  updateUserEmail,
} from "@/db/user-repo";
import { setPreference } from "@/db/preferences-repo";
import { hashPassword, verifyPassword } from "@/lib/password-hash";
import { syncMarketingContact } from "@/lib/email-service";
import { supabase } from "@/lib/supabase";
import { performFullSync, refreshFromCloud } from "@/lib/sync-service";

export interface LocalUser {
  id: string;
  email: string;
}

/** Shape stored in SecureStore for offline credential recovery. */
interface StoredCredentials {
  email: string;
  passwordHash: string;
}

interface AuthState {
  user: LocalUser | null;
  isLoading: boolean;
  isSupabaseConfigured: boolean;

  /**
   * Sign in with email + password.
   *
   * Primary path: Supabase Auth (when configured).
   * Fallback path: local SQLite password hash verification when:
   *  - Supabase is not configured
   *  - Network is unavailable
   *  - Supabase service is down
   *
   * Real auth errors (wrong credentials) from Supabase are propagated.
   * Only connectivity failures trigger the local fallback.
   */
  signIn: (
    db: SQLite.SQLiteDatabase,
    email: string,
    password: string,
  ) => Promise<void>;

  /**
   * Sign up via Supabase Auth AND store a local password hash
   * for offline access recovery. Requires Supabase to be configured.
   */
  signUp: (
    db: SQLite.SQLiteDatabase,
    email: string,
    password: string,
    marketingOptIn?: boolean,
  ) => Promise<void>;

  signOut: () => Promise<void>;

  /**
   * Initialize auth state on app launch.
   *
   * Recovery chain (tries in order):
   *  1. Supabase session → user found → done + background full sync
   *  2. SecureStore cached credentials → verify against SQLite → done
   *  3. Any user exists in SQLite → don't auto-auth (user must re-enter password)
   *  4. No user → null (show auth screens)
   */
  init: (db: SQLite.SQLiteDatabase) => Promise<void>;

  updateEmail: (db: SQLite.SQLiteDatabase, newEmail: string) => Promise<void>;
}

// Check if Supabase is configured
const isSupabaseConfigured =
  !!process.env.EXPO_PUBLIC_SUPABASE_URL &&
  !!process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// SecureStore keys
const SS_USER_ID = "userId";
const SS_CREDENTIALS = "userCredentials";

/**
 * Determine if a Supabase auth error is a recoverable network error
 * vs. an authentication error (wrong password, user not found, etc.).
 *
 * Network errors are typically TypeErrors or have no HTTP status code.
 * Auth errors have a structured status code from the server.
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    // fetch failed, network unavailable, DNS resolution failure, etc.
    return true;
  }
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message: string }).message.toLowerCase();
    if (
      msg.includes("fetch") ||
      msg.includes("network") ||
      msg.includes("econnrefused") ||
      msg.includes("enotfound")
    ) {
      return true;
    }
  }
  // Auth errors have a numeric status; network errors typically don't
  if (error && typeof error === "object" && "status" in error) {
    return false; // Has a structured API error status — not a network issue
  }
  // Anything else — treat as non-recoverable (e.g., invalid API key format)
  return false;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isSupabaseConfigured,

  // ──────────────────────────────────────────────
  //  init — auth recovery chain
  // ──────────────────────────────────────────────
  init: async (db) => {
    try {
      // --- Attempt 1: Supabase session ---
      if (isSupabaseConfigured && supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          const email = session.user.email ?? "";
          let localUser = await findUserByEmail(db, email);
          if (!localUser) {
            // First time seeing this Supabase user on this device
            localUser = await createUser(db, email, session.user.id);
          } else if (localUser.id !== session.user.id) {
            // Handle potential ID mismatch if user re-signed up with same email
            // For now, just update the local user ID to match Supabase
            await db.runAsync(
              "UPDATE users SET id = ? WHERE email = ?",
              session.user.id,
              email,
            );
            localUser.id = session.user.id;
          }
          set({ user: { id: localUser.id, email: localUser.email } });

          // Warm local cache from Supabase (fire and forget)
          performFullSync(db).catch(() => {});

          set({ isLoading: false });
          return;
        }
      }

      // --- Attempt 2: SecureStore cached credentials ---
      const credentialsJson = await SecureStore.getItemAsync(SS_CREDENTIALS);
      if (credentialsJson) {
        const creds: StoredCredentials = JSON.parse(credentialsJson);
        const localUser = await findUserByEmail(db, creds.email);
        if (localUser && localUser.passwordHash === creds.passwordHash) {
          set({ user: { id: localUser.id, email: localUser.email } });
          // Background sync to refresh cache from cloud
          performFullSync(db).catch(() => {});
          set({ isLoading: false });
          return;
        }
        // Credentials stale — remove them
        await SecureStore.deleteItemAsync(SS_CREDENTIALS);
      }

      // --- Attempt 3: Any user in SQLite (data intact, but no cached session) ---
      // the user must re-enter their password to sign in.
      const anyUser = await findFirstUser(db);
      if (anyUser) {
        // Don't auto-auth; set isLoading false so the sign-in screen shows.
        set({ user: null, isLoading: false });
        return;
      }

      // --- No user at all ---
      set({ user: null, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  // ──────────────────────────────────────────────
  //  signIn — Supabase-first with local fallback + cloud refresh
  // ──────────────────────────────────────────────
  signIn: async (db, email, password) => {
    const trimmedEmail = email.trim().toLowerCase();

    // --- Try Supabase Auth (when configured) ---
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (error) {
          // Propagate real auth errors (wrong password, user not found)
          throw error;
        }

        if (data.user) {
          let localUser = await findUserByEmail(db, trimmedEmail);
          if (!localUser) {
            // Fresh device / data was cleared — create local user ref
            localUser = await createUser(db, trimmedEmail, data.user.id);
          }

          // Store password hash locally for future offline fallback
          const pwHash = await hashPassword(trimmedEmail, password);
          await updatePasswordHash(db, localUser.id, pwHash);
          await storeCredentialsInSecureStore(
            trimmedEmail,
            pwHash,
            localUser.id,
          );

          // Cloud-first: pull data before showing the app so the user
          // lands on a fully populated dashboard.
          const syncResult = await refreshFromCloud(db);
          if (syncResult.errors.length > 0) {
            console.warn("[Auth] Cloud refresh had errors:", syncResult.errors);
          }

          set({ user: { id: localUser.id, email: localUser.email } });
          return;
        }
      } catch (err) {
        // Network errors → try local fallback
        // Auth errors → propagate
        if (!isNetworkError(err)) {
          throw err; // Wrong password, user doesn't exist, etc.
        }
        // Network error — fall through to local verification
      }
    }

    // --- Local fallback (offline / Supabase not configured / network error) ---
    const localUser = await findUserByEmail(db, trimmedEmail);
    if (!localUser) {
      throw new Error(
        "No account found with this email. Please check your email or " +
          "connect to the internet and try again.",
      );
    }

    const valid = await verifyPassword(
      trimmedEmail,
      password,
      localUser.passwordHash,
    );
    if (!valid) {
      throw new Error(
        "Incorrect password. If you recently changed your password online, " +
          "connect to the internet and try again.",
      );
    }

    // Success — cache credentials and restore
    const pwHash = await hashPassword(trimmedEmail, password);
    await storeCredentialsInSecureStore(trimmedEmail, pwHash, localUser.id);

    // Still try to refresh from cloud in the background
    refreshFromCloud(db).catch(() => {});

    set({ user: { id: localUser.id, email: localUser.email } });
  },

  // ──────────────────────────────────────────────
  //  signUp — requires Supabase, stores local hash
  // ──────────────────────────────────────────────
  signUp: async (db, email, password, marketingOptIn = false) => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        "Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and " +
          "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in your .env file to create an account.",
      );
    }

    // Sign up via Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
    });

    if (error) throw new Error(error.message);

    if (data.user) {
      // Create local user reference with password hash for offline fallback
      const pwHash = await hashPassword(trimmedEmail, password);
      let localUser = await findUserByEmail(db, trimmedEmail);
      if (!localUser) {
        localUser = await createUser(db, trimmedEmail, data.user.id, pwHash);
      } else {
        await updatePasswordHash(db, localUser.id, pwHash);
      }

      await storeCredentialsInSecureStore(trimmedEmail, pwHash, localUser.id);

      // Persist marketing consent (cloud-first) BEFORE syncing so the edge
      // function can enforce it server-side.
      await setPreference(
        db,
        localUser.id,
        "marketing_consent",
        marketingOptIn ? "true" : "false",
      );

      // Cloud-first: refresh cache (new user = nothing to pull yet)
      await refreshFromCloud(db);

      set({ user: { id: localUser.id, email: localUser.email } });

      // Fire-and-forget: subscribe opted-in users to the marketing list
      // (Sender.net). Must never block signup — it no-ops if unconfigured
      // or when consent was not given (also enforced by the edge function).
      if (marketingOptIn) {
        syncMarketingContact({ email: trimmedEmail }).catch(() => {});
      }
    }
  },

  // ──────────────────────────────────────────────
  //  signOut
  // ──────────────────────────────────────────────
  signOut: async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    await SecureStore.deleteItemAsync(SS_CREDENTIALS);
    set({ user: null });
  },

  // ──────────────────────────────────────────────
  //  updateEmail
  // ──────────────────────────────────────────────
  updateEmail: async (db, newEmail) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) throw new Error("Not signed in");

    // Update email in Supabase
    if (supabase) {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw new Error(error.message);
    }

    // Update local reference
    await updateUserEmail(db, currentUser.id, newEmail);

    // Clear cached credentials — the email change changes the hashing salt,
    // so the old hash is invalid. User will re-cache on next sign-in.
    await SecureStore.deleteItemAsync(SS_CREDENTIALS);

    set({ user: { ...currentUser, email: newEmail } });
  },
}));

// ──────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────

async function storeCredentialsInSecureStore(
  email: string,
  passwordHash: string,
  userId: string,
): Promise<void> {
  const creds: StoredCredentials = { email, passwordHash };
  await Promise.all([
    SecureStore.setItemAsync(SS_CREDENTIALS, JSON.stringify(creds)),
    SecureStore.setItemAsync(SS_USER_ID, userId),
  ]);
}
