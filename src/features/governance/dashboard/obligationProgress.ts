/**
 * Fortschritt der Pflichten aus „Ihre Pflichten heute".
 *
 * Zwei Arten von „erledigt", die im UI getrennt beschriftet bleiben:
 *   - automatisch erkannt: aus echten Mandantendaten (KI-Inventar,
 *     Anbieter mit AVV, DSFA). Diese Pflichten lassen sich NICHT von Hand
 *     abhaken, sonst könnte ein Haken einer leeren Tabelle widersprechen.
 *   - von Ihnen markiert: Pflichten ohne Datenquelle im Produkt
 *     (KI-Kompetenz, Transparenzhinweis, VVT …). Gespeichert mit Datum in
 *     `governance_activations.organization.obligationProgress`.
 *
 * Speicherort: bewusst NICHT Teil von `ActivationOrganization`. Die
 * Activation-Ansicht hält ihre Org-Felder im Formularzustand und speichert
 * sie zurück. Läge der Fortschritt dort, würde ein älterer Tab einen
 * frischen Haken überschreiben. `mergeOrganizationForSave` behält
 * unbekannte Schlüssel bei, also bleibt der Fortschritt dort unberührt.
 *
 * Fehler bleiben Fehler: Ist eine Quelle nicht lesbar, heisst der Status
 * „nicht lesbar", nie „offen" und nie „erledigt".
 */

import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';
import { fetchTenantVendors, type DbVendor } from '../vendorsApi';
import { countAiSystems } from './osControlStripData';
import type { Obligation } from './obligationsFromSetup';

// ── Datenquellen ──────────────────────────────────────────────────────

type Settled<T> = { ok: true; value: T } | { ok: false };

export interface ObligationSignals {
  aiSystems: Settled<number>;
  vendors: Settled<Pick<DbVendor, 'name' | 'legal_name' | 'dpa_status'>[]>;
  dpias: Settled<{ total: number; open: number }>;
}

async function countDpias(tenantId: string): Promise<{ total: number; open: number }> {
  const sb = getSupabase();
  const [all, open] = await Promise.all([
    sb.from('dpias').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    sb.from('dpias').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).in('status', ['draft', 'in_review']),
  ]);
  if (all.error) throw new Error(all.error.message);
  if (open.error) throw new Error(open.error.message);
  return { total: all.count ?? 0, open: open.count ?? 0 };
}

function settled<T>(r: PromiseSettledResult<T>): Settled<T> {
  return r.status === 'fulfilled' ? { ok: true, value: r.value } : { ok: false };
}

/** Lädt alle Quellen nebeneinander. Ein Fehler leert die anderen nicht. */
export async function loadObligationSignals(tenantId: string): Promise<ObligationSignals> {
  const [aiSystems, vendors, dpias] = await Promise.allSettled([
    countAiSystems(tenantId),
    fetchTenantVendors(tenantId),
    countDpias(tenantId),
  ]);
  return { aiSystems: settled(aiSystems), vendors: settled(vendors), dpias: settled(dpias) };
}

// ── Von Hand markierter Fortschritt ───────────────────────────────────

export type ObligationProgress = Record<string, { doneAt: string }>;

export function asObligationProgress(raw: unknown): ObligationProgress {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: ObligationProgress = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v && typeof v === 'object' && typeof (v as { doneAt?: unknown }).doneAt === 'string') {
      out[id] = { doneAt: (v as { doneAt: string }).doneAt };
    }
  }
  return out;
}

function asJsonObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? { ...(raw as Record<string, unknown>) }
    : {};
}

async function readOrganization(tenantId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await getSupabase()
    .from('governance_activations')
    .select('organization')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return asJsonObject((data as { organization?: unknown }).organization);
}

export async function loadObligationProgress(tenantId: string): Promise<ObligationProgress> {
  if (!isSupabaseConfigured() || !tenantId) return {};
  const org = await readOrganization(tenantId);
  return asObligationProgress(org?.obligationProgress);
}

/**
 * Setzt oder entfernt einen Haken. Liest den Bestand frisch und ändert nur
 * `obligationProgress` — alle anderen Org-Felder (inkl. aiSetup) bleiben.
 * `update` statt `upsert`: ohne Activation-Zeile gibt es nichts abzuhaken.
 */
export async function setObligationDone(
  tenantId: string,
  obligationId: string,
  done: boolean,
  now: Date = new Date(),
): Promise<ObligationProgress> {
  if (!isSupabaseConfigured()) throw new Error('Supabase ist nicht konfiguriert.');
  const org = await readOrganization(tenantId);
  if (!org) throw new Error('Noch keine Angaben gespeichert.');
  const progress = asObligationProgress(org.obligationProgress);
  if (done) progress[obligationId] = { doneAt: now.toISOString() };
  else delete progress[obligationId];
  const { error } = await getSupabase()
    .from('governance_activations')
    .update({ organization: { ...org, obligationProgress: progress }, updated_at: now.toISOString() })
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  return progress;
}

// ── Status je Pflicht (rein) ──────────────────────────────────────────

export type ObligationState = 'done' | 'partial' | 'open' | 'unknown';

export interface ObligationStatus {
  state: ObligationState;
  /** `auto` = aus Daten erkannt, `manual` = vom Mandanten markiert/abhakbar. */
  source: 'auto' | 'manual';
  detail: string;
}

/** Namensmuster, an denen ein Anbieter im Anbieterverzeichnis erkannt wird. */
const PROVIDER_PATTERNS: Record<string, { label: string; re: RegExp }> = {
  openai: { label: 'OpenAI', re: /openai|chatgpt/i },
  anthropic: { label: 'Anthropic', re: /anthropic|claude/i },
  google: { label: 'Google', re: /google|gemini/i },
  microsoft_copilot: { label: 'Microsoft', re: /microsoft|copilot|azure/i },
  xai: { label: 'xAI', re: /\bxai\b|x\.ai|grok/i },
  automation_make_zapier_n8n: { label: 'Make/Zapier/n8n', re: /\bmake\b|zapier|n8n/i },
};

const DPA_OK = new Set(['signed', 'not_required']);

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function manual(id: string, progress: ObligationProgress | null): ObligationStatus {
  if (!progress) return { state: 'unknown', source: 'manual', detail: 'Status nicht lesbar' };
  const p = progress[id];
  return p
    ? { state: 'done', source: 'manual', detail: `Von Ihnen als erledigt markiert am ${formatDate(p.doneAt)}` }
    : { state: 'open', source: 'manual', detail: 'Offen' };
}

const UNKNOWN: ObligationStatus = { state: 'unknown', source: 'auto', detail: 'Status nicht lesbar' };

/**
 * Status einer Pflicht. `externalProviders` sind die Katalog-IDs der
 * Cloud-Anbieter aus dem Setup (für den AVV-Abgleich).
 */
export function obligationStatus(
  o: Obligation,
  signals: ObligationSignals | null,
  /** `null` = Fortschritt nicht lesbar (nicht: „nichts markiert"). */
  progress: ObligationProgress | null,
  externalProviders: readonly string[],
): ObligationStatus {
  switch (o.id) {
    case 'ai_inventory': {
      if (!signals) return { ...UNKNOWN, detail: 'Wird geprüft…' };
      if (!signals.aiSystems.ok) return UNKNOWN;
      const n = signals.aiSystems.value;
      return n > 0
        ? { state: 'done', source: 'auto', detail: `${n} ${n === 1 ? 'KI-System' : 'KI-Systeme'} im Inventar` }
        : { state: 'open', source: 'auto', detail: 'Noch kein KI-System im Inventar' };
    }
    case 'processor_contract': {
      if (!signals) return { ...UNKNOWN, detail: 'Wird geprüft…' };
      if (!signals.vendors.ok) return UNKNOWN;
      const vendors = signals.vendors.value;
      const providers = externalProviders.filter((id) => PROVIDER_PATTERNS[id]);
      const missing: string[] = [];
      const noDpa: string[] = [];
      for (const id of providers) {
        const { label, re } = PROVIDER_PATTERNS[id];
        const match = vendors.filter((v) => re.test(v.name) || re.test(v.legal_name ?? ''));
        if (match.length === 0) missing.push(label);
        else if (!match.some((v) => DPA_OK.has(v.dpa_status))) noDpa.push(label);
      }
      if (missing.length === 0 && noDpa.length === 0) {
        return { state: 'done', source: 'auto', detail: 'Alle KI-Anbieter erfasst, AVV vorhanden' };
      }
      const parts = [
        ...(missing.length ? [`nicht erfasst: ${missing.join(', ')}`] : []),
        ...(noDpa.length ? [`AVV fehlt: ${noDpa.join(', ')}`] : []),
      ];
      const anyDone = providers.length - missing.length - noDpa.length > 0;
      return { state: anyDone || noDpa.length ? 'partial' : 'open', source: 'auto', detail: parts.join(' · ') };
    }
    case 'dpia_health': {
      if (!signals) return { ...UNKNOWN, detail: 'Wird geprüft…' };
      if (!signals.dpias.ok) return UNKNOWN;
      const { total, open } = signals.dpias.value;
      if (total === 0) return { state: 'open', source: 'auto', detail: 'Noch keine DSFA angelegt' };
      if (open > 0) return { state: 'partial', source: 'auto', detail: `${open} DSFA in Bearbeitung` };
      return { state: 'done', source: 'auto', detail: `${total} DSFA abgeschlossen` };
    }
    default:
      return manual(o.id, progress);
  }
}

/** „x von y erledigt" — zählt nur `done`. */
export function countDone(statuses: readonly ObligationStatus[]): number {
  return statuses.filter((s) => s.state === 'done').length;
}
