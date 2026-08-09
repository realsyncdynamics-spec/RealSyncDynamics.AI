import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function testConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('tenants').select('id').limit(1);
    return !error;
  } catch (err) {
    console.error('Supabase connection test failed:', err);
    return false;
  }
}
