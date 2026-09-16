/**
 * Browser client for siteos/code-persist.
 * JWT comes from the existing Supabase session. Tenant is a claim that the
 * Edge Function verifies via memberships — it never wins over Authz.
 */
import { getSupabase } from '../../../lib/supabase';
import type { BuilderProjectRecord, PersistOp, ProjectListItem } from './contract';

export type PersistApiError = {
  kind: 'error';
  status?: number;
  code?: string;
  message: string;
};

export type PersistApiResult<T> = { kind: 'ok'; data: T } | PersistApiError;

export interface SavePayload {
  id?: string;
  slug: string;
  title: string;
  files: Record<string, string>;
  merkle: string;
  audit: BuilderProjectRecord['audit'];
  messages: BuilderProjectRecord['messages'];
}

interface EnvelopeOk {
  ok: true;
  project?: BuilderProjectRecord;
  projects?: ProjectListItem[];
  unchanged?: boolean;
}

interface EnvelopeErr {
  ok: false;
  error?: { code?: string; message?: string };
}

async function invoke(
  tenantId: string,
  op: PersistOp,
  extra: object = {},
): Promise<PersistApiResult<EnvelopeOk>> {
  if (!tenantId) {
    return { kind: 'error', status: 403, code: 'FORBIDDEN', message: 'no verified tenant' };
  }
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('siteos/code-persist', {
    body: { op, tenant_id: tenantId, ...extra },
  });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    const context = (error as { context?: Response }).context;
    let code: string | undefined;
    let message = (error as { message?: string }).message ?? 'Persistenz fehlgeschlagen';
    if (context) {
      try {
        const body = (await context.clone().json()) as EnvelopeErr;
        code = body?.error?.code;
        if (body?.error?.message) message = body.error.message;
      } catch {
        /* keep */
      }
    }
    if (status === 404 && code === 'UNKNOWN_ENDPOINT') {
      return {
        kind: 'error',
        status,
        code,
        message: 'Der Endpunkt siteos/code-persist ist im Router noch nicht ausgerollt.',
      };
    }
    return { kind: 'error', status, code, message };
  }
  const envelope = data as EnvelopeOk | EnvelopeErr | null;
  if (!envelope || (envelope as EnvelopeErr).ok === false) {
    const err = envelope as EnvelopeErr | null;
    return {
      kind: 'error',
      code: err?.error?.code,
      message: err?.error?.message ?? 'Ungültige Server-Antwort',
    };
  }
  return { kind: 'ok', data: envelope as EnvelopeOk };
}

export async function listBuilderProjects(tenantId: string): Promise<PersistApiResult<ProjectListItem[]>> {
  const res = await invoke(tenantId, 'list');
  if (res.kind !== 'ok') return res;
  return { kind: 'ok', data: res.data.projects ?? [] };
}

export async function loadBuilderProject(
  tenantId: string,
  id: string,
): Promise<PersistApiResult<BuilderProjectRecord>> {
  const res = await invoke(tenantId, 'load', { id });
  if (res.kind !== 'ok') return res;
  if (!res.data.project) return { kind: 'error', status: 404, code: 'NOT_FOUND', message: 'project not found' };
  return { kind: 'ok', data: res.data.project };
}

export async function saveBuilderProject(
  tenantId: string,
  payload: SavePayload,
): Promise<PersistApiResult<BuilderProjectRecord & { unchanged?: boolean }>> {
  const res = await invoke(tenantId, 'save', payload);
  if (res.kind !== 'ok') return res;
  if (!res.data.project) return { kind: 'error', message: 'save returned no project' };
  return { kind: 'ok', data: { ...res.data.project, unchanged: res.data.unchanged } };
}

export async function deleteBuilderProject(tenantId: string, id: string): Promise<PersistApiResult<{ ok: true }>> {
  const res = await invoke(tenantId, 'delete', { id });
  if (res.kind !== 'ok') return res;
  return { kind: 'ok', data: { ok: true } };
}
