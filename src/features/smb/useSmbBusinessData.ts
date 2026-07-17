import { useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { EMPTY_SEVERITIES, type SeverityCounts } from './lib/businessSignals';

/**
 * useSmbBusinessData — Daten-Adapter der SMB Experience Layer.
 *
 * Konsumiert AUSSCHLIESSLICH bestehende, RLS-geschützte Tabellen der
 * Enterprise-Plattform (kein neues Backend, keine doppelten Funktionen):
 *   - audit_jobs        → letzter erfolgreicher Website-Check (Score, Befund-Zahl)
 *   - runtime_events    → Überwachungs-/Sicherheitssignale der letzten 30 Tage
 *   - ai_evidence_events→ automatisch abgelegte Nachweise der letzten 30 Tage
 *
 * Alle Queries laufen unter dem eingeloggten Nutzer; RLS begrenzt die
 * Sicht auf den eigenen Tenant. Best-effort: Fehler einzelner Quellen
 * führen nie zu einem Render-Fehler, sondern zu Demo-/Leerwerten
 * (live=false), analog zu useAiGovernanceData.
 */

export interface SmbBusinessData {
  /** Score des letzten erfolgreichen Website-Checks (0–100) oder null. */
  auditScore: number | null;
  /** Geprüfte Domain des letzten Checks. */
  auditDomain: string | null;
  /** Abschluss-Zeitpunkt des letzten Checks (ISO). */
  auditCompletedAt: string | null;
  /** Severity-Zähler der Runtime-Events (letzte 30 Tage). */
  severities: SeverityCounts;
  /** Gesamtzahl Runtime-Events (letzte 30 Tage) → "Überwachung aktiv". */
  eventsLast30d: number;
  /** Rohe Befund-/Event-Typen als Input für die Empfehlungs-Übersetzung. */
  rawFindings: string[];
  /** Anzahl abgelegter Nachweise (letzte 30 Tage). */
  evidenceCount: number;
  /** true → echte Tenant-Daten, false → Demo-Fallback (z.B. frischer Account). */
  live: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Demo-Fallback für frische Accounts ohne Daten: zeigt ein realistisches,
 * positives Beispiel, damit das Dashboard sofort verständlich ist.
 */
const DEMO_DATA: Omit<SmbBusinessData, 'loading' | 'error' | 'live'> = {
  auditScore: 82,
  auditDomain: 'ihre-website.de',
  auditCompletedAt: null,
  severities: { critical: 0, high: 1, medium: 2, low: 3 },
  eventsLast30d: 46,
  rawFindings: ['cookie_banner missing', 'seo meta description'],
  evidenceCount: 12,
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface AuditJobRow {
  domain: string | null;
  completed_at: string | null;
  result_summary: { score?: number; finding_count?: number } | null;
}

interface RuntimeEventRow {
  type: string;
  severity: string;
}

export function useSmbBusinessData(): SmbBusinessData {
  const [state, setState] = useState<SmbBusinessData>({
    ...DEMO_DATA,
    live: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const sb = getSupabase();
        const since = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

        const [jobRes, eventsRes, evidenceRes] = await Promise.all([
          sb
            .from('audit_jobs')
            .select('domain, completed_at, result_summary')
            .eq('status', 'success')
            .order('completed_at', { ascending: false })
            .limit(1),
          sb
            .from('runtime_events')
            .select('type, severity')
            .gte('ts', since)
            .order('ts', { ascending: false })
            .limit(500),
          sb
            .from('ai_evidence_events')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', since),
        ]);

        if (cancelled) return;

        const job = (jobRes.data?.[0] ?? null) as AuditJobRow | null;
        const events = (eventsRes.data ?? []) as RuntimeEventRow[];
        const evidenceCount = evidenceRes.count ?? 0;

        const severities: SeverityCounts = { ...EMPTY_SEVERITIES };
        for (const ev of events) {
          if (ev.severity === 'critical') severities.critical += 1;
          else if (ev.severity === 'high') severities.high += 1;
          else if (ev.severity === 'medium') severities.medium += 1;
          else if (ev.severity === 'low') severities.low += 1;
        }

        // Empfehlungs-Input: Event-Typen der ernsteren Signale (medium+),
        // damit die Übersetzung konkrete Kategorien (consent, ssl, seo …) trifft.
        const rawFindings = events
          .filter((ev) => ev.severity === 'critical' || ev.severity === 'high' || ev.severity === 'medium')
          .map((ev) => ev.type)
          .slice(0, 20);

        const live = job !== null || events.length > 0 || evidenceCount > 0;
        if (!live) {
          // Frischer Account: Demo-Beispiel behalten, aber nicht als live markieren.
          setState({ ...DEMO_DATA, live: false, loading: false, error: null });
          return;
        }

        setState({
          auditScore: typeof job?.result_summary?.score === 'number' ? job.result_summary.score : null,
          auditDomain: job?.domain ?? null,
          auditCompletedAt: job?.completed_at ?? null,
          severities,
          eventsLast30d: events.length,
          rawFindings,
          evidenceCount,
          live: true,
          loading: false,
          error: jobRes.error?.message ?? eventsRes.error?.message ?? null,
        });
      } catch (e) {
        if (cancelled) return;
        setState((prev) => ({ ...prev, loading: false, error: (e as Error).message }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
