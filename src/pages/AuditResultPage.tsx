import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { AuditResultView, type AuditResultFinding } from '../features/audit/AuditResultView';
import { rememberPendingAudit } from '../features/audit/pendingAudit';
import { SEOHead } from '../components/SEOHead';

// AuditResultPage — sharable permalink for an audit result.
//
// Datenfluss:
//   1. Warm-Navigation aus dem Audit-Chat: AuditChatHero reicht non-PII
//      Report-Felder per `navigate(..., { state })` durch (kein email).
//   2. Cold-Load (Reload, Deep-Link, Bookmark, Share, neuer Tab): die
//      `audit_share_get(uuid)` RPC liefert non-PII Felder (score, severity,
//      issues, domain, created_at) fuer jede `is_shareable=true` Audit-Row.
//   E-Mail kommt weder aus API (gdpr-audit / audit_share_get) noch aus
//   router-state — sharebare Views zeigen keine Report-E-Mail.
//
// Damit verschwindet die alte "Keine Befunde geladen" Anzeige bei jedem
// Reload — vorausgesetzt der Audit existiert und ist nicht revoked.

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL     as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

interface AuditReportState {
  domain?:          string;
  score?:           number;
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

  // Die Kennung merken, solange der Besucher sie hat: Zwischen Bericht und
  // Uebernahme liegen Registrierung und E-Mail-Bestaetigung, und danach ist
  // sie sonst weg. Nur die UUID, keine Befunde — siehe `pendingAudit.ts`.
  useEffect(() => { rememberPendingAudit(auditId); }, [auditId]);

  return (
    <>
      <SEOHead
        title={domain ? `Audit · ${domain}` : 'Audit-Ergebnis'}
        description="DSGVO-Audit-Ergebnis — nicht zur Indexierung bestimmt."
        noIndex
      />
      <AuditResultView
        auditId={auditId}
        domain={domain}
        score={score}
        createdAt={createdAt}
        coverage={initialReport.coverage}
        coverageNotice={initialReport.coverage_notice ?? undefined}
        findings={findings}
        loading={loading}
        error={error}
      />
    </>
  );
}