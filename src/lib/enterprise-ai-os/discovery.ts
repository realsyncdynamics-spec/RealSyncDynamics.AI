// Enterprise AI OS · Discovery — Client für Meldung (Intake) und offene Meldungen.
//
// Beide Edge Functions verlangen eine echte Sitzung (supabase-js hängt den
// Nutzer-JWT an). Der Mandant ist der im TenantProvider aktive — er stammt aus
// den eigenen Mitgliedschaften und wird serverseitig erneut gegen die
// Mitgliedschaft geprüft (Schreiben nur mit schreibender Rolle). Er begründet
// nie Zugriff.

import { getSupabase } from '../supabase';

export interface DiscoveryIntakeInput {
  systemName: string;
  provider: string;
  model?: string;
  usageContext?: string;
  department?: string;
  dataCategories: string[];
  externalUsage: boolean;
  containsPersonalData: boolean;
  containsSensitiveData: boolean;
  comment?: string;
}

export interface DiscoveryIntakeResult {
  registryId: string;
  riskLevel: string;
}

/** Fehlertext aus einer Function-Antwort — beide Formen: `{error: "…"}` und `{error: {message}}`. */
export async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: unknown } | null)?.context;
  if (ctx instanceof Response) {
    try {
      const body = (await ctx.clone().json()) as { error?: string | { message?: string } } | null;
      if (typeof body?.error === 'string' && body.error) return body.error;
      if (body?.error && typeof body.error === 'object' && body.error.message) return body.error.message;
    } catch {
      /* kein JSON */
    }
    if (ctx.status === 401) return 'Bitte anmelden.';
    if (ctx.status === 403) return 'Keine Schreibberechtigung in diesem Mandanten.';
    return `${fallback} (HTTP ${ctx.status})`;
  }
  return fallback;
}

export async function submitDiscoveryIntake(
  tenantId: string,
  input: DiscoveryIntakeInput,
): Promise<DiscoveryIntakeResult> {
  const { data, error } = await getSupabase().functions.invoke('enterprise-ai-os-discovery-intake', {
    body: { ...input, tenantId },
  });
  if (error) throw new Error(await functionErrorMessage(error, 'Meldung konnte nicht gespeichert werden'));
  const body = data as { ok?: boolean; registry?: { id?: string }; runs?: { risk?: { riskLevel?: string } } } | null;
  if (!body?.ok || !body.registry?.id) throw new Error('Meldung konnte nicht gespeichert werden');
  return { registryId: body.registry.id, riskLevel: body.runs?.risk?.riskLevel ?? 'unknown' };
}

export async function listPendingDiscovery<T>(tenantId: string): Promise<T[]> {
  const { data, error } = await getSupabase().functions.invoke(
    `enterprise-ai-os-discovery-pending?tenantId=${encodeURIComponent(tenantId)}&limit=100`,
    { method: 'GET' },
  );
  if (error) throw new Error(await functionErrorMessage(error, 'Offene Meldungen konnten nicht geladen werden'));
  return (data as { pending?: T[] } | null)?.pending ?? [];
}
