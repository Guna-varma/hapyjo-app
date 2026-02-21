import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** No-op lock: auth expects a function (name, acquireTimeout, fn) => Promise. Run fn without locking to avoid Navigator LockManager timeout. */
async function noopLock<R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  return await fn();
}

function getSupabase(): SupabaseClient {
  const key = '__hapyjo_supabase';
  const g = typeof globalThis !== 'undefined' ? globalThis : (typeof global !== 'undefined' ? global : ({} as any));
  if (!(g as any)[key]) {
    (g as any)[key] = createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder-key',
      {
        auth: {
          lock: noopLock,
        },
      }
    );
  }
  return (g as any)[key];
}

/** Single Supabase client instance (avoids multiple GoTrueClient warnings on HMR). */
export const supabase = getSupabase();
