import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

import { findUserByEmail, createUser, hashPassword, verifyPassword, findUserById, updateUserEmail, updateUserPassword } from '@/db/user-repo';
import { supabase } from '@/lib/supabase';

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
  updatePassword: (db: SQLite.SQLiteDatabase, currentPassword: string, newPassword: string) => Promise<void>;
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
        // Try Supabase session first
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Sync Supabase user to local DB
          const email = session.user.email ?? '';
          let localUser = await findUserByEmail(db, email);
          if (!localUser) {
            // Create local user from Supabase
            localUser = await createUser(db, email, 'supabase-auth');
          }
          set({ user: { id: localUser.id, email: localUser.email }, isLoading: false });
          return;
        }
      }

      // Fallback to local auth
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
      // Failed to restore session — treat as logged out
      set({ user: null, isLoading: false });
    }
  },

  signIn: async (db, email, password) => {
    if (isSupabaseConfigured && supabase) {
      // Try Supabase auth
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      if (data.user) {
        // Sync to local DB
        let localUser = await findUserByEmail(db, email);
        if (!localUser) {
          localUser = await createUser(db, email, 'supabase-auth');
        }
        set({ user: { id: localUser.id, email: localUser.email } });
        return;
      }
    }

    // Fallback to local auth
    const user = await findUserByEmail(db, email);
    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid password');
    }

    await SecureStore.setItemAsync('userId', user.id);
    set({ user: { id: user.id, email: user.email } });
  },

  signUp: async (db, email, password) => {
    if (isSupabaseConfigured && supabase) {
      // Try Supabase auth
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw new Error(error.message);
      if (data.user) {
        // Sync to local DB
        let localUser = await findUserByEmail(db, email);
        if (!localUser) {
          localUser = await createUser(db, email, 'supabase-auth');
        }
        set({ user: { id: localUser.id, email: localUser.email } });
        return;
      }
    }

    // Fallback to local auth
    const existing = await findUserByEmail(db, email);
    if (existing) {
      throw new Error('User already exists');
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser(db, email, passwordHash);
    await SecureStore.setItemAsync('userId', user.id);
    set({ user: { id: user.id, email: user.email } });
  },

  signOut: async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    await SecureStore.deleteItemAsync('userId');
    set({ user: null });
  },

  updateEmail: async (db, newEmail) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) throw new Error('Not signed in');
    await updateUserEmail(db, currentUser.id, newEmail);
    set({ user: { ...currentUser, email: newEmail } });
  },

  updatePassword: async (db, currentPassword, newPassword) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) throw new Error('Not signed in');

    // Verify current password
    const user = await findUserById(db, currentUser.id);
    if (!user) throw new Error('User not found');
    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) throw new Error('Current password is incorrect');

    // Update to new password
    const newHash = await hashPassword(newPassword);
    await updateUserPassword(db, currentUser.id, newHash);
  },
}));