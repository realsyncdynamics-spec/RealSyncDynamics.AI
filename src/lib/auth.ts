import { getSupabase } from './supabase';

export async function getAuthToken(): Promise<string> {
  const supabase = getSupabase();
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new Error('No valid session or access token');
  }

  return session.access_token;
}
