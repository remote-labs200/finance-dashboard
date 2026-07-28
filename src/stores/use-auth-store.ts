import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

import { findUserByEmail, createUser, findUserById, updateUserEmail } from '@/db/user-repo';
import { supabase } from '@/lib/supabase';
import { performFullSync } from '@/lib/sync-service';

export interface LocalUser {
  id: string;
  email: string;
}

interface AuthState {
  user: LocalUser | null;
  isLoading: boolean;
  isSupabaseConfigured: boolean;
  signIn: (db: SQLite.SQLiteDatabase, email: string, password: string) => Promise<void>;
  signUp: (db: SQLite.SQLiteDatabase, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  init: (db: SQLite.SQLiteDatabase) => Promise<void>;
  updateEmail: (db: SQLite.SQLiteDatabase, newEmail: string) => Promise<void>;
}

// Check if Supabase is configured
const isSupabaseConfigured = !!process.env.EXPO_PUBLIC_SUPABASE_URL && !!process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isSupabaseConfigured,

  init: async (db) => {
    try {
      if (isSupabaseConfigured && supabase) {
        // Restore Supabase session (auto-refresh happens via the client)
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Sync the Supabase-authenticated user to a local reference
          const email = session.user.email ?? '';
          let localUser = await findUserByEmail(db, email);
          if (!localUser) {
            localUser = await createUser(db, email, session.user.id);
          }
          set({ user: { id: localUser.id, email: localUser.email } });

          // Warm the local SQLite cache from Supabase (fire and forget)
          performFullSync(db).catch(() => {});

          set({ isLoading: false });
          return;
        }
      }

    // No Supabase session — check SecureStore for last user (dev convenience)
      const storedUserId = await SecureStore.getItemAsync('userId');
      if (storedUserId) {
        const user = await findUserById(db, storedUserId);
        if (user) {
          set({ user: { id: user.id, email: user.email }, isLoading: false });
        } else {
          set({ user: null, isLoading: false });
        }
      } else {
        set({ user: null, isLoading: false });
      }
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  signIn: async (db, email, password) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and ' +
        'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in your .env file.'
      );
    }

    // Authenticate via Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    if (data.user) {
      // Create or update local user reference
      let localUser = await findUserByEmail(db, email);
      if (!localUser) {
        localUser = await createUser(db, email, data.user.id);
      }
      await SecureStore.setItemAsync('userId', localUser.id);
      set({ user: { id: localUser.id, email: localUser.email } });

      // Warm the local SQLite cache from Supabase
      performFullSync(db).catch(() => {});
    }
  },

  signUp: async (db, email, password) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and ' +
        'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in your .env file.'
      );
    }

    // Sign up via Supabase Auth
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);

    if (data.user) {
      // Create local user reference
      let localUser = await findUserByEmail(db, email);
      if (!localUser) {
        localUser = await createUser(db, email, data.user.id);
      }
      await SecureStore.setItemAsync('userId', localUser.id);
      set({ user: { id: localUser.id, email: localUser.email } });

      // Warm the local SQLite cache from Supabase
      performFullSync(db).catch(() => {});
    }
  },

  signOut: async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    await SecureStore.deleteItemAsync('userId');
    set({ user: null });
  },

  updateEmail: async (db, newEmail) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) throw new Error('Not signed in');

    // Update email in Supabase
    if (supabase) {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw new Error(error.message);
    }

    // Update local reference
    await updateUserEmail(db, currentUser.id, newEmail);
    set({ user: { ...currentUser, email: newEmail } });
  },
}));
