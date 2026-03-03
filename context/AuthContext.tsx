import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/types';
import { supabase } from '@/lib/supabase';
import { profileFromRow } from '@/lib/supabaseMappers';
import { showSystemNotification } from '@/lib/localNotifications';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  /** True until first session check completes (avoids blank screen). */
  authLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Fetches current user's profile via RPC (avoids RLS 500 on direct profiles SELECT). */
async function fetchMyProfile(): Promise<User | null> {
  const { data, error } = await supabase.rpc('get_my_profile').single();
  if (error || !data) return null;
  return profileFromRow(data as Record<string, unknown>);
}

/** True if the error is due to an invalid/expired refresh token (server no longer has it). */
function isInvalidRefreshTokenError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    /refresh token not found/i.test(msg) ||
    /invalid refresh token/i.test(msg) ||
    /refresh_token_not_found/i.test(msg) ||
    /refresh_token_already_used/i.test(msg)
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const profile = await fetchMyProfile();
          if (profile?.active === false) {
            await supabase.auth.signOut();
            setUser(null);
          } else {
            setUser(profile ?? null);
          }
        }
      } catch (e) {
        if (isInvalidRefreshTokenError(e)) {
          try {
            await supabase.auth.signOut();
          } catch {
            // ignore signOut errors
          }
        }
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user?.id) {
            const profile = await fetchMyProfile();
            if (profile?.active === false) {
              await supabase.auth.signOut();
              setUser(null);
            } else {
              setUser(profile ?? null);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      } catch (e) {
        if (isInvalidRefreshTokenError(e)) {
          try {
            await supabase.auth.signOut();
          } catch {
            // ignore
          }
        }
        setUser(null);
      }
    });
    // Handle refresh token errors from background auto-refresh (e.g. token expired on server).
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event?.reason;
      if (isInvalidRefreshTokenError(reason)) {
        event.preventDefault?.();
        supabase.auth.signOut().catch(() => {});
      }
    };
    if (typeof globalThis !== 'undefined' && 'addEventListener' in globalThis) {
      globalThis.addEventListener('unhandledrejection', onUnhandledRejection);
    }
    return () => {
      subscription?.unsubscribe();
      if (typeof globalThis !== 'undefined' && 'removeEventListener' in globalThis) {
        globalThis.removeEventListener('unhandledrejection', onUnhandledRejection);
      }
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(error.message || 'Invalid email or password');
    if (!data.user?.id) throw new Error('Invalid email or password');
    const profile = await fetchMyProfile();
    if (!profile) throw new Error('Profile not found');
    if (profile.active === false) {
      await supabase.auth.signOut();
      throw new Error('Account is deactivated. Contact your administrator.');
    }
    setUser(profile);
  };

  const logout = async () => {
    await showSystemNotification('Hapyjo', 'You are signed out.');
    await supabase.auth.signOut();
    setUser(null);
  };

  const refreshUser = (next: User | null) => {
    setUser(next);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        authLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
