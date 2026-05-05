import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase nicht konfiguriert: VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY in .env.local setzen.',
    );
  }
  if (!cached) {
    cached = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}
