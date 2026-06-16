import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { AuditResultView, type AuditResultFinding } from '../features/audit/AuditResultView';

// AuditResultPage — sharable permalink for an audit result.
//
// Datenfluss:
//   1. Warm-Navigation aus dem Audit-Chat: AuditChatHero passt den vollen
//      Report per `navigate(..., { state })` durch — wir nehmen ihn direkt.
//      Inklusive PII (email), die in der Permalink-RPC bewusst fehlt.
//   2. Cold-Load (Reload, Deep-Link, Bookmark, Share, neuer Tab): die
//      `audit_share_get(uuid)` RPC liefert non-PII Felder (score, severity,
//      issues, domain, created_at) fuer jede `is_shareable=true` Audit-Row.
//
// Damit verschwindet die alte "Keine Befunde geladen" Anzeige bei jedem
// Reload — vorausgesetzt der Audit existiert und ist nicht revoked.

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL     as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

interface AuditReportState {
  domain?:          string;
  score?:           number;
  email?:           string;
  created_at?:      string;
  coverage?:        'full' | 'limited' | 'failed';
  coverage_notice?: string | null;
  findings?:        AuditResultFinding[];
}

interface SharedAuditRow {
  share_token: string;
  domain:      string;
  score:       number;
  severity:    AuditResultFinding['severity'];
  issues:      AuditResultFinding[];
  created_at:  string;
}

export function AuditResultPage() {
  const { auditId = '' } = useParams<{ auditId: string }>();
  const { state }        = useLocation();
  const initialReport    = (state ?? {}) as AuditReportState;

  const hasWarmReport =
    typeof initialReport.score === 'number' &&
    Array.isArray(initialReport.findings) &&
    initialReport.findings.length > 0;

  const [domain,    setDomain]    = useState<string | undefined>(initialReport.domain);
  const [score,     setScore]     = useState<number | undefined>(initialReport.score);
  const [createdAt, setCreatedAt] = useState<string | undefined>(initialReport.created_at);
  const [findings,  setFindings]  = useState<AuditResultFinding[]>(initialReport.findings ?? []);
  const [loading,   setLoading]   = useState(!hasWarmReport);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (hasWarmReport)           return;
    if (!auditId)                { setError('Audit-ID fehlt in der URL.'); setLoading(false); return; }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setError('Audit-Daten koennen aktuell nicht geladen werden.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/audit_share_get`, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            apikey:          SUPABASE_ANON_KEY,
            Authorization:   `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ p_id: auditId }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const rows = await resp.json() as SharedAuditRow[] | unknown;
        if (!Array.isArray(rows) || rows.length === 0) {
          throw new Error('Dieser Audit ist nicht (mehr) verfuegbar.');
        }
        const row = rows[0] as SharedAuditRow;
        if (cancelled) return;
        setDomain(row.domain);
        setScore(row.score);
        setCreatedAt(row.created_at);
        setFindings(Array.isArray(row.issues) ? row.issues : []);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Unbekannter Fehler.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // hasWarmReport ist abgeleitet aus initialReport, das sich pro Navigation aendert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditId]);

  return (
    <AuditResultView
      auditId={auditId}
      domain={domain}
      score={score}
      email={initialReport.email}
      createdAt={createdAt}
      coverage={initialReport.coverage}
      coverageNotice={initialReport.coverage_notice ?? undefined}
      findings={findings}
      loading={loading}
      error={error}
    />
  );
}
