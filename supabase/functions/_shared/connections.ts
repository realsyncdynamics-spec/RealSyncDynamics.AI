// Shared loader for vps_connections that respects the new owner-or-tenant
// scope. Use the service role to fetch the row, then check authorization
// explicitly so we can return a clean 403/404 distinction.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { VpsConnectionRow } from '../kodee/types.ts';

export async function loadConnectionForUser(
  admin: SupabaseClient,
  userId: string,
  connectionId: string,
): Promise<VpsConnectionRow | null> {
  const { data: conn, error } = await admin
    .from('vps_connections')
    .select('*')
    .eq('id', connectionId)
    .maybeSingle<VpsConnectionRow & { tenant_id: string | null }>();
  if (error || !conn) return null;

  // Owner always wins
  if (conn.owner_id === userId) return conn;

  // Otherwise the caller must be a member of the connection's tenant
  if (!conn.tenant_id) return null;
  const { count } = await admin
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', conn.tenant_id)
    .eq('user_id', userId);
  if (!count) return null;

  return conn;
}
