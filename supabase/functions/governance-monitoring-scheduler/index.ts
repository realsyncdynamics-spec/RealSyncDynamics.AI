/**
 * governance-monitoring-scheduler — Governance OS Continuous Monitoring
 *
 * Cron-Schedule (pg_cron, täglich 02:00 + stündlich für hourly-Quellen):
 *   SELECT cron.schedule(
 *     'governance-monitoring-daily',
 *     '0 2 * * *',
 *     $$ SELECT net.http_post(
 *       url := current_setting('app.supabase_url') || '/functions/v1/governance-monitoring-scheduler',
 *       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
 *     ) $$
 *   );
 *
 * Was dieser Job tut:
 * 1. Holt alle monitoring_sources mit status='active' und next_scan_at <= NOW()
 * 1a. **Plan-Gate je Quelle** (seit 2026-08-24): Ohne `monitoring.monthly`
 *     oder `monitoring.daily` wird nicht gescannt, sondern ein SCAN_SKIPPED
 *     in den Prüfpfad geschrieben. Mit Plan wird die Kadenz auf das
 *     gedrosselt, was er trägt. Der Drift-Alert hängt zusätzlich an
 *     `monitoring.drift`.
 *     Vorher lief dieser Job über jede aktive Quelle, unabhängig vom Plan —
 *     die Überwachung war damit als einzige Kernleistung nicht durchgesetzt.
 * 2. Löst Scan aus (cookie-scan Edge Function) pro Quelle
 * 3. Vergleicht Ergebnis mit letztem Score (Change Detection)
 * 4. Erzeugt governance_alerts bei Drift / neuen Risiken
 * 5. Schreibt governance_events (SCAN_STARTED, SCAN_COMPLETED, SCAN_FAILED)
 * 6. Aktualisiert last_scan_at, next_scan_at und current_score
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/gateway.ts';
import { loadEntitlementsForTenant, hasFeature, type Entitlements } from '../_shared/entitlements.ts';
import {
  erlaubteKadenz,
  naechsterLauf,
  wirksameKadenz,
  type Kadenz,
} from '../_shared/monitoring-cadence.ts';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ── Typen ────────────────────────────────────────────────────────────────────
interface MonitoringSource {
  id: string;
  tenant_id: string;
  type: string;
  name: string;
  url: string | null;
  scan_frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  current_score: number | null;
  previous_score: number | null;
}

interface ScanResponse {
  risk_score?: number;
  score?: number;
  trackers?: string[];
  cookie_count?: number;
  issues?: Array<{ risk: string; issue: string }>;
  error?: string;
}

const FREQUENCY_INTERVAL: Record<string, string> = {
  hourly:  '1 hour',
  daily:   '24 hours',
  weekly:  '7 days',
  monthly: '30 days',
};

// ── Plan-Gate ───────────────────────────────────────────────────────────────
//
// Bis zum Claims-Reality-Audit (2026-08-24) lief dieser Job über **jede**
// aktive Quelle, unabhängig vom Plan. Damit war die Überwachung — die
// eigentliche Ware, denn der Scan ist kostenlos — als einzige Kernleistung
// nicht durchgesetzt: `monitoring.monthly`, `monitoring.daily` und
// `monitoring.drift` hatten im gesamten Function-Verzeichnis keine
// Prüfstelle.
//
// Die Kadenz kommt aus zwei Quellen, und beide müssen gelten:
//   * `monitoring_sources.scan_frequency` — was der Kunde eingestellt hat
//   * sein Plan — wie oft er das darf
// Maßgeblich ist die **langsamere** von beiden. Eine Einstellung, die der
// Plan nicht trägt, wird gedrosselt statt abgelehnt: Der Kunde verliert die
// Überwachung nicht, sie läuft nur in der Frequenz, die er bezahlt.

// Die Kadenz-Regel selbst steht in `_shared/monitoring-cadence.ts` — dort
// ohne Importe, damit sie von Vitest geprüft werden kann.
function planKadenz(ent: Entitlements): Kadenz | null {
  return erlaubteKadenz(
    hasFeature(ent, 'monitoring.daily'),
    hasFeature(ent, 'monitoring.monthly'),
  );
}

/**
 * Entitlements je Mandant, einmal pro Lauf.
 *
 * Ohne den Zwischenspeicher entstünde ein RPC je Quelle; bei 50 Quellen
 * desselben Mandanten wären das 50 identische Abfragen.
 */
function entitlementCache(sb: SupabaseClient) {
  const gespeichert = new Map<string, Entitlements>();
  return async (tenantId: string): Promise<Entitlements> => {
    const vorhanden = gespeichert.get(tenantId);
    if (vorhanden) return vorhanden;
    const geladen = await loadEntitlementsForTenant(sb, tenantId);
    gespeichert.set(tenantId, geladen);
    return geladen;
  };
}

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────

/**
 * Nächster Lauf. Die Abstände stehen in `_shared/monitoring-cadence.ts` —
 * zwei Tabellen mit denselben Werten wären genau die Doppelung, an der die
 * Kadenz später auseinanderliefe.
 */
function nextScanAt(kadenz: Kadenz): string {
  return naechsterLauf(kadenz, Date.now());
}

async function scanSource(source: MonitoringSource): Promise<ScanResponse> {
  if (!source.url) return { error: 'Keine URL konfiguriert' };

  try {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/cookie-scan`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ url: source.url, fast: true }),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!res.ok) return { error: `Scan HTTP ${res.status}` };
    return await res.json();
  } catch (err) {
    return { error: String(err) };
  }
}

async function emitEvent(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
  sourceId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  await sb.from('governance_events').insert({
    tenant_id:    tenantId,
    event_type:   eventType,
    event_source: 'monitoring-scheduler',
    risk_level:   'low',
    payload,
    asset_id:     sourceId,
  });
}

async function createAlert(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
  sourceId: string,
  opts: {
    severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
    category: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  },
) {
  await sb.from('governance_alerts').insert({
    tenant_id: tenantId,
    source_id: sourceId,
    severity:  opts.severity,
    category:  opts.category,
    title:     opts.title,
    message:   opts.message,
    metadata:  opts.metadata ?? {},
    status:    'open',
  });
}

// ── Hauptlogik ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // Alle fälligen Quellen holen
  const { data: sources, error: fetchErr } = await sb
    .from('monitoring_sources')
    .select('*')
    .eq('status', 'active')
    .or('next_scan_at.is.null,next_scan_at.lte.' + new Date().toISOString())
    .limit(50);

  if (fetchErr) {
    return jsonResponse({ error: fetchErr.message }, 500);
  }

  if (!sources || sources.length === 0) {
    return jsonResponse({ processed: 0, message: 'Keine fälligen Quellen' });
  }

  const results: Array<{ id: string; name: string; status: string; score?: number }> = [];
  const entitlementsFuer = entitlementCache(sb);

  for (const source of sources as MonitoringSource[]) {
    // ── Plan-Gate, vor jedem Scan ──────────────────────────────────────────
    const ent = await entitlementsFuer(source.tenant_id);
    const erlaubt = planKadenz(ent);

    if (erlaubt === null) {
      // Kein Überwachungs-Entitlement. Der Prüfpfad hält fest, dass der Lauf
      // ausgelassen wurde — stilles Überspringen wäre in einem
      // Governance-Produkt der falsche Umgang damit.
      await emitEvent(sb, source.tenant_id, source.id, 'SCAN_SKIPPED', {
        source_name: source.name,
        reason: 'plan_without_monitoring',
      });
      // Um einen Tag vertagen, damit nicht entitlementfreie Quellen bei jedem
      // Lauf die Auswahl von 50 füllen und bezahlte Quellen verdrängen.
      // `status` bleibt `active`: Der Kunde hat die Quelle nicht abgeschaltet,
      // sein Plan trägt sie nur nicht. Nach einem Upgrade läuft sie weiter.
      await sb.from('monitoring_sources').update({
        next_scan_at: nextScanAt('daily'),
      }).eq('id', source.id);
      results.push({ id: source.id, name: source.name, status: 'skipped' });
      continue;
    }

    const kadenz = wirksameKadenz(source.scan_frequency, erlaubt);
    const driftErlaubt = hasFeature(ent, 'monitoring.drift');

    // SCAN_STARTED
    await emitEvent(sb, source.tenant_id, source.id, 'SCAN_STARTED', {
      source_name: source.name,
      source_type: source.type,
      url: source.url,
      scan_frequency: kadenz,
      requested_frequency: source.scan_frequency,
    });

    // Scan ausführen
    const result = await scanSource(source);

    if (result.error) {
      // SCAN_FAILED
      await emitEvent(sb, source.tenant_id, source.id, 'SCAN_FAILED', {
        error: result.error,
        source_name: source.name,
      });

      await sb.from('monitoring_sources').update({
        status:       'error',
        last_error:   result.error,
        last_scan_at: new Date().toISOString(),
        next_scan_at: nextScanAt(kadenz),
      }).eq('id', source.id);

      await createAlert(sb, source.tenant_id, source.id, {
        severity: 'high',
        category: 'scan',
        title:    `Scan fehlgeschlagen: ${source.name}`,
        message:  `Der Scan für "${source.name}" ist fehlgeschlagen: ${result.error}`,
        metadata: { source_url: source.url },
      });

      results.push({ id: source.id, name: source.name, status: 'error' });
      continue;
    }

    const newScore = result.risk_score ?? result.score ?? null;
    const scoreDelta = (newScore !== null && source.current_score !== null)
      ? newScore - source.current_score
      : null;

    // SCAN_COMPLETED
    await emitEvent(sb, source.tenant_id, source.id, 'SCAN_COMPLETED', {
      source_name:  source.name,
      score:        newScore,
      score_delta:  scoreDelta,
      trackers:     result.trackers ?? [],
      cookie_count: result.cookie_count ?? 0,
    });

    // Score-Drift-Alert bei Verschlechterung > 10 Punkte.
    //
    // `monitoring.drift` liegt ab Growth. Starter bekommt den Scan und die
    // Findings, aber nicht die Drift-Erkennung — genau so steht es in der
    // Plan-Leiter. Der Score selbst wird trotzdem fortgeschrieben, damit ein
    // späteres Upgrade auf einer echten Historie aufsetzt statt bei null.
    if (driftErlaubt && scoreDelta !== null && scoreDelta > 10) {
      await createAlert(sb, source.tenant_id, source.id, {
        severity: scoreDelta > 30 ? 'critical' : 'high',
        category: 'compliance',
        title:    `Score verschlechtert: ${source.name}`,
        message:  `Der Compliance-Score für "${source.name}" hat sich um ${scoreDelta} Punkte verschlechtert (${source.current_score} → ${newScore}).`,
        metadata: { score_before: source.current_score, score_after: newScore, score_delta: scoreDelta },
      });
    }

    // Neue kritische Issues als Alerts
    if (result.issues && result.issues.length > 0) {
      const critIssues = result.issues.filter((i) => i.risk === 'high' || i.risk === 'critical');
      for (const issue of critIssues.slice(0, 5)) {
        await createAlert(sb, source.tenant_id, source.id, {
          severity: issue.risk as 'high' | 'critical',
          category: 'compliance',
          title:    issue.issue,
          message:  `Kritisches Finding in "${source.name}": ${issue.issue}`,
          metadata: { source_url: source.url, issue },
        });
      }
    }

    // Monitoring-Quelle aktualisieren
    await sb.from('monitoring_sources').update({
      status:         'active',
      last_error:     null,
      last_scan_at:   new Date().toISOString(),
      next_scan_at:   nextScanAt(kadenz),
      previous_score: source.current_score,
      current_score:  newScore,
      scan_count:     (source as MonitoringSource & { scan_count: number }).scan_count + 1,
    }).eq('id', source.id);

    results.push({ id: source.id, name: source.name, status: 'ok', score: newScore ?? undefined });
  }

  return jsonResponse({ processed: results.length, results });
});
