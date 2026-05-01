import { getSupabase } from '../../../lib/supabase';

export interface VpsConnection {
  id: string;
  label: string;
  host: string;
  port: number;
  username: string;
  owner_id: string;
  tenant_id: string | null;
  known_host_fingerprint: string | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

export interface CreateConnectionInput {
  label: string;
  host: string;
  port?: number;
  username: string;
  private_key: string;
  known_host_fingerprint?: string;
  /** Optional tenant scope. null/undefined = personal connection (owner-only). */
  tenant_id?: string | null;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('kodee-onboard', { body });
  if (error) throw new Error(error.message);
  if (!data?.ok) {
    const msg = data?.error?.message ?? 'Unbekannter Fehler';
    throw new Error(msg);
  }
  return data as T;
}

export async function listConnections() {
  const r = await call<{ ok: true; connections: VpsConnection[] }>({ op: 'list' });
  return r.connections;
}

export async function createConnection(input: CreateConnectionInput) {
  const r = await call<{ ok: true; connection: VpsConnection }>({ op: 'create', ...input });
  return r.connection;
}

export async function deleteConnection(connection_id: string) {
  await call({ op: 'delete', connection_id });
}

export async function updateConnection(
  connection_id: string,
  patch: Partial<Omit<CreateConnectionInput, 'private_key'>> & { private_key?: string },
) {
  await call({ op: 'update', connection_id, ...patch });
}
