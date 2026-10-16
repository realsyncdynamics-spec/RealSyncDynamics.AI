import { getSupabase } from '../../lib/supabase';

export type Role = 'owner' | 'admin' | 'editor' | 'viewer_auditor';

export interface Invite {
  id: string;
  tenant_id: string;
  email: string;
  role: Role;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface CreateInviteResult {
  ok: boolean;
  invite?: Invite;
  token?: string;
  error?: { code: string; message: string };
}
export interface BareResult { ok: boolean; error?: { code: string; message: string } }

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('tenant-invite', { body });
  if (error) {
    // Bei 4xx/5xx liefert supabase-js nur „non-2xx status code“; Code und
    // Begründung der Function (z. B. SEAT_LIMIT_REACHED) stehen im Body.
    const context = (error as { context?: Response }).context;
    if (context && typeof context.clone === 'function') {
      try {
        const parsed = await context.clone().json() as { error?: { code?: unknown; message?: unknown } };
        if (typeof parsed?.error?.code === 'string' && typeof parsed.error.message === 'string') {
          return { ok: false, error: { code: parsed.error.code, message: parsed.error.message } } as T;
        }
      } catch {
        // Kein lesbarer Body — dann bleibt es beim Netzfehler.
      }
    }
    return { ok: false, error: { code: 'NETWORK', message: error.message } } as T;
  }
  return data as T;
}

export const createInvite = (tenant_id: string, email: string, role: Role, ttl_hours = 168) =>
  call<CreateInviteResult>({ op: 'create', tenant_id, email, role, ttl_hours });

export const listInvites = (tenant_id: string) =>
  call<{ ok: boolean; invites: Invite[]; error?: { code: string; message: string } }>({ op: 'list', tenant_id });

export const revokeInvite = (invite_id: string) =>
  call<BareResult>({ op: 'revoke', invite_id });

export const acceptInvite = (token: string) =>
  call<{ ok: boolean; tenant_id?: string; role?: Role; error?: { code: string; message: string } }>(
    { op: 'accept', token },
  );
