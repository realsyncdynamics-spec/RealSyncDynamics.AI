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
 * 2. Löst Scan aus (cookie-scan Edge Function) pro Quelle
 * 3. Vergleicht Ergebnis mit letztem Score (Change Detection)
 * 4. Erzeugt governance_alerts bei Drift / neuen Risiken
 * 5. Schreibt governance_events (SCAN_STARTED, SCAN_COMPLETED, SCAN_FAILED)
 * 6. Aktualisiert last_scan_at, next_scan_at und current_score
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────

function nextScanAt(frequency: string): string {
  const now = Date.now();
  const ms = {
    hourly:  3_600_000,
    daily:   86_400_000,
    weekly:  604_800_000,
    monthly: 2_592_000_000,
  }[frequency] ?? 86_400_000;
  return new Date(now + ms).toISOString();
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
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // Alle fälligen Quellen holen
  const { data: sources, error: fetchErr } = await sb
    .from('monitoring_sources')
    .select('*')
    .eq('status', 'active')
    .or('next_scan_at.is.null,next_scan_at.lte.' + new Date().toISOString())
    .limit(50);

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  if (!sources || sources.length === 0) {
    return new Response(JSON.stringify({ processed: 0, message: 'Keine fälligen Quellen' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const results: Array<{ id: string; name: string; status: string; score?: number }> = [];

  for (const source of sources as MonitoringSource[]) {
    // SCAN_STARTED
    await emitEvent(sb, source.tenant_id, source.id, 'SCAN_STARTED', {
      source_name: source.name,
      source_type: source.type,
      url: source.url,
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
        next_scan_at: nextScanAt(source.scan_frequency),
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

    // Score-Drift-Alert bei Verschlechterung > 10 Punkte
    if (scoreDelta !== null && scoreDelta > 10) {
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
      next_scan_at:   nextScanAt(source.scan_frequency),
      previous_score: source.current_score,
      current_score:  newScore,
      scan_count:     (source as MonitoringSource & { scan_count: number }).scan_count + 1,
    }).eq('id', source.id);

    results.push({ id: source.id, name: source.name, status: 'ok', score: newScore ?? undefined });
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
});
