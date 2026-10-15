/**
 * Funnel-Lead-Erfassung für den Governance-Scan.
 *
 * Liegt neben gdpr-audit (nicht in `_shared/`), damit eine Änderung nur
 * diese Function neu ausrollt — `_shared/` löst einen Deploy aller Functions
 * aus. Deno-frei, damit Vitest die Logik direkt prüfen kann.
 *
 * Der Lead wird VOR dem Abruf der fremden Seite gespeichert. Der Scan darf
 * ihn danach nur noch anreichern (Audit-ID, Status) — nie überschreiben oder
 * löschen. Schreibweg ist die RPC `capture_funnel_lead` (Migration
 * 20261015120000), die über lower(email)|domain dedupliziert.
 *
 * Datenschutz: E-Mail-Adressen gehen nie in Logs oder `marketing_events`.
 */

export const FUNNEL_LEAD_SOURCES = [
  'landing',
  'governance_scan',
  'pricing',
  'agency',
  'voice_agent',
  'siteos_builder',
] as const;

export type FunnelLeadSource = typeof FUNNEL_LEAD_SOURCES[number];

/** Minimale Client-Form — supabase-js erfüllt sie, Tests mocken sie. */
export interface FunnelDbClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
  from(table: string): {
    insert(row: Record<string, unknown>): PromiseLike<{ error: { code?: string; message?: string } | null }>;
  };
}

/**
 * Kanonische Lead-Quelle aus dem `?source=`-Tag der Seite.
 *
 * Der Tag kommt aus der Adresszeile (`/audit?source=landing-v6`) und ist
 * Fremdeingabe. Er wird auf die erlaubte Liste abgebildet; der rohe Wert
 * landet höchstens gekürzt und bereinigt in den Metadaten.
 */
export function resolveFunnelSource(raw: unknown): FunnelLeadSource {
  if (typeof raw !== 'string') return 'governance_scan';
  const s = raw.trim().toLowerCase();
  if ((FUNNEL_LEAD_SOURCES as readonly string[]).includes(s)) return s as FunnelLeadSource;
  if (s.startsWith('landing') || s === 'home' || s === 'hero') return 'landing';
  if (s.startsWith('pricing') || s.startsWith('checkout')) return 'pricing';
  if (s.startsWith('agenc') || s.startsWith('partner')) return 'agency';
  if (s.startsWith('voice')) return 'voice_agent';
  if (s.startsWith('siteos') || s.startsWith('builder')) return 'siteos_builder';
  return 'governance_scan';
}

/** Roher Tag nur als bereinigtes Kürzel — kein Freitext in die Datenbank. */
export function sanitizeEntryTag(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 64);
  return s || null;
}

/** Host → Lead-Domain: klein, ohne `www.` und ohne abschließenden Punkt. */
export function normalizeLeadDomain(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
}

/**
 * Honeypot: ein für Menschen unsichtbares Feld. Ist es gefüllt, hat ein
 * Skript das Formular ausgefüllt. Kein Lead, kein Scan.
 */
export function isHoneypotTripped(body: { company_website?: unknown }): boolean {
  return typeof body.company_website === 'string' && body.company_website.trim().length > 0;
}

export type CaptureResult =
  | { ok: true; leadId: string; isNew: boolean }
  | { ok: false; reason: 'rpc_missing' | 'rejected' | 'error'; code?: string };

/** RPC fehlt (Migration noch nicht ausgerollt) — dann Altpfad nutzen. */
export function isMissingRpcError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  const code = err.code ?? '';
  return code === 'PGRST202' || code === '42883';
}

export interface CaptureInput {
  email: string;
  domain: string;
  company: string | null;
  source: FunnelLeadSource;
  entryTag: string | null;
  path: string;
  ipHash: string;
  userAgent: string | null;
  marketingConsent: boolean;
  consentVersion: string | null;
}

export async function captureFunnelLead(db: FunnelDbClient, input: CaptureInput): Promise<CaptureResult> {
  const { data, error } = await db.rpc('capture_funnel_lead', {
    p_email: input.email,
    p_domain: input.domain,
    p_company: input.company,
    p_source: input.source,
    p_stage: 'scan_started',
    p_path: input.path,
    p_ip_hash: input.ipHash,
    p_user_agent: input.userAgent,
    p_marketing_consent: input.marketingConsent,
    p_consent_version: input.marketingConsent ? input.consentVersion : null,
    p_metadata: input.entryTag ? { entry: input.entryTag } : {},
  });
  if (error) {
    if (isMissingRpcError(error)) return { ok: false, reason: 'rpc_missing', code: error.code };
    // 22023 = Validierung in der RPC (z. B. Domain-Form). Nur den Code loggen.
    return { ok: false, reason: error.code === '22023' ? 'rejected' : 'error', code: error.code };
  }
  const row = Array.isArray(data) ? data[0] : data;
  const leadId = row && typeof row === 'object' ? (row as { lead_id?: unknown }).lead_id : null;
  if (typeof leadId !== 'string') return { ok: false, reason: 'error' };
  return { ok: true, leadId, isNew: (row as { is_new?: unknown }).is_new === true };
}

/** Scan-Status nachtragen. Wirft nie: Ein Fehler hier darf keinen Bericht kosten. */
export async function markFunnelLeadScan(
  db: FunnelDbClient,
  leadId: string,
  status: 'completed' | 'failed',
  auditId?: string | null,
): Promise<void> {
  try {
    const { error } = await db.rpc('mark_funnel_lead_scan', {
      p_lead_id: leadId,
      p_status: status,
      p_audit_id: auditId ?? null,
    });
    if (error && !isMissingRpcError(error)) {
      console.error('gdpr-audit: mark_funnel_lead_scan failed', { code: error.code });
    }
  } catch (e) {
    console.error('gdpr-audit: mark_funnel_lead_scan threw', { message: (e as Error)?.message });
  }
}

/** Serverseitige Trichter-Ereignisse. Keine E-Mail, keine Domain, keine IP. */
export const SERVER_FUNNEL_EVENTS = ['lead_saved', 'scan_started', 'scan_completed', 'scan_failed'] as const;
export type ServerFunnelEvent = typeof SERVER_FUNNEL_EVENTS[number];

export async function recordFunnelEvent(
  db: FunnelDbClient,
  event: ServerFunnelEvent,
  meta: { source: FunnelLeadSource; is_new_lead?: boolean },
): Promise<void> {
  try {
    const metadata: Record<string, unknown> = { origin: 'gdpr-audit', source: meta.source };
    if (typeof meta.is_new_lead === 'boolean') metadata.is_new_lead = meta.is_new_lead;
    const { error } = await db.from('marketing_events').insert({
      event_name: event,
      currency: 'EUR',
      metadata,
    });
    if (error) console.error('gdpr-audit: funnel event insert failed', { code: error.code });
  } catch (e) {
    console.error('gdpr-audit: funnel event threw', { message: (e as Error)?.message });
  }
}

/**
 * Double-Opt-in für Follow-up-E-Mails anfordern. Liefert Token und Adresse
 * nur, wenn eine Bestätigungs-Mail fällig ist (nicht bestätigt, nicht
 * widerrufen, letzte Mail älter als 24 h) — sonst `null`. Wirft nie.
 */
export async function requestFollowupDoi(
  db: FunnelDbClient,
  leadId: string,
): Promise<{ token: string; email: string } | null> {
  try {
    const { data, error } = await db.rpc('request_followup_doi', { p_lead_id: leadId });
    if (error) {
      if (!isMissingRpcError(error)) console.error('gdpr-audit: request_followup_doi failed', { code: error.code });
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== 'object') return null;
    const { token, email } = row as { token?: unknown; email?: unknown };
    return typeof token === 'string' && typeof email === 'string' ? { token, email } : null;
  } catch (e) {
    console.error('gdpr-audit: request_followup_doi threw', { message: (e as Error)?.message });
    return null;
  }
}
