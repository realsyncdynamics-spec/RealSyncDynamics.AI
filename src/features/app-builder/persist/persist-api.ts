/**
 * Browser client for siteos/code-persist.
 * JWT comes from the existing Supabase session. Tenant is a claim that the
 * Edge Function verifies via memberships — it never wins over Authz.
 */
import { getSupabase } from '../../../lib/supabase';
import { edgeFunctionUrl, fnFetchInit } from '../../../lib/fn-proxy';
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
  const { data: sessionData } = await sb.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    return { kind: 'error', status: 401, code: 'UNAUTHORIZED', message: 'not signed in' };
  }
  const url = edgeFunctionUrl('siteos/code-persist');
  let resp: Response;
  try {
    resp = await fetch(url, fnFetchInit(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ op, tenant_id: tenantId, ...extra }),
    }));
  } catch {
    return { kind: 'error', message: 'Persistenz nicht erreichbar' };
  }
  let parsed: EnvelopeOk | EnvelopeErr | null = null;
  try {
    parsed = (await resp.json()) as EnvelopeOk | EnvelopeErr;
  } catch {
    return { kind: 'error', status: resp.status, message: 'Ungültige Server-Antwort' };
  }
  if (!resp.ok || !parsed || (parsed as EnvelopeErr).ok === false) {
    const err = parsed as EnvelopeErr | null;
    const code = err?.error?.code;
    const message = err?.error?.message ?? 'Persistenz fehlgeschlagen';
    if (resp.status === 404 && code === 'UNKNOWN_ENDPOINT') {
      return {
        kind: 'error',
        status: 404,
        code,
        message: 'Der Endpunkt siteos/code-persist ist im Router noch nicht ausgerollt.',
      };
    }
    return { kind: 'error', status: resp.status, code, message };
  }
  return { kind: 'ok', data: parsed as EnvelopeOk };
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
