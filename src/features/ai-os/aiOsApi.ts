// Client für die Edge Function `ai-os-control`. Der Browser hält weder
// GitHub-Token noch Service-Role; er schickt nur den Nutzer-JWT (supabase-js)
// und die Operation. Berechtigungen entscheidet ausschließlich der Server.

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';

export type AiOsOp =
  | 'session'
  | 'devops'
  | 'ci_failures'
  | 'security'
  | 'routines'
  | 'routine_dispatch'
  | 'routine_toggle'
  | 'knowledge_list'
  | 'knowledge_propose'
  | 'costs'
  | 'audit';

export type AiOsResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number | null; code: string; message: string };

type Invoke = (body: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

let invokeOverride: Invoke | null = null;
/** Nur für Tests. */
export function __setAiOsInvoke(fn: Invoke | null): void {
  invokeOverride = fn;
}

async function readErrorBody(error: unknown): Promise<{ status: number | null; body: Record<string, unknown> | null }> {
  const ctx = (error as { context?: unknown })?.context;
  if (ctx && typeof (ctx as Response).json === 'function') {
    const res = ctx as Response;
    try {
      return { status: res.status, body: (await res.clone().json()) as Record<string, unknown> };
    } catch {
      return { status: res.status, body: null };
    }
  }
  return { status: null, body: null };
}

export async function callAiOs<T>(op: AiOsOp, params: Record<string, unknown> = {}): Promise<AiOsResult<T>> {
  if (!invokeOverride && !isSupabaseConfigured()) {
    return { ok: false, status: null, code: 'supabase_not_configured', message: 'Supabase ist in dieser Umgebung nicht konfiguriert.' };
  }
  const invoke: Invoke = invokeOverride ?? ((body) => getSupabase().functions.invoke('ai-os-control', { body }));
  try {
    const { data, error } = await invoke({ ...params, op });
    if (error) {
      const { status, body } = await readErrorBody(error);
      const code = String(body?.reason ?? body?.error ?? 'request_failed');
      const message = String(body?.message ?? (error as Error).message ?? 'Anfrage fehlgeschlagen');
      return { ok: false, status, code, message };
    }
    return { ok: true, data: data as T };
  } catch (e) {
    return { ok: false, status: null, code: 'network_error', message: (e as Error).message };
  }
}

export interface Resource<T> {
  loading: boolean;
  result: AiOsResult<T> | null;
  reload: () => void;
}

/** Lädt eine lesende Operation; `enabled=false` hält den Aufruf zurück. */
export function useAiOsResource<T>(op: AiOsOp, enabled = true): Resource<T> {
  const [loading, setLoading] = useState(enabled);
  const [result, setResult] = useState<AiOsResult<T> | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    const r = await callAiOs<T>(op);
    if (mine !== seq.current) return;
    setResult(r);
    setLoading(false);
  }, [op]);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  return { loading, result, reload: () => void load() };
}

export const DENY_HINT: Record<string, string> = {
  mfa_required: 'Diese Aktion verlangt eine Anmeldung mit zweitem Faktor. Unter Einstellungen → Sicherheit aktivieren und neu anmelden.',
  confirmation_required: 'Die Aktion wurde nicht bestätigt.',
  not_operator: 'Nur aktive Plattform-Operatoren.',
  agent_not_allowed: 'Der zuständige Agent darf diese Aktion nicht auslösen.',
  critical_requires_release: 'Kritische Aktion — nur über den dokumentierten Freigabeweg.',
  audit_unavailable: 'Das Aktionsprotokoll ist nicht erreichbar; die Aktion wurde aus Sicherheitsgründen nicht ausgeführt.',
};
