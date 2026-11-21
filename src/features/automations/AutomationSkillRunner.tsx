import { useEffect, useState } from 'react';
import { Loader2, PlayCircle, AlertTriangle } from 'lucide-react';
import { getSupabase } from '../../lib/supabase';
import { getSupabaseUrl } from '../../lib/supabaseUrl';
import { isTerminalRun, parseAuditRunResult, type AuditResult } from './automationRunContract';

const SEVERITY_CLS: Record<string, string> = {
  critical: 'text-red-300 border-red-500/40 bg-red-500/10',
  high: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
  medium: 'text-amber-200 border-amber-500/30 bg-amber-500/5',
  low: 'text-titanium-300 border-titanium-700 bg-obsidian-950',
  info: 'text-titanium-400 border-titanium-800 bg-obsidian-950',
};


/** Persisted async execution: trigger acknowledges a run_id, NOT a scan result. */
export function AutomationSkillRunner({ tenantId }: { tenantId: string }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [binding, setBinding] = useState<'checking' | 'connected' | 'unlinked' | 'unknown'>('checking');
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<'queued' | 'running'>('queued');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);

  // The catalog is readable by signed-in users. Do not advertise an unbound
  // n8n skill as executable (the server deliberately returns 409).
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const { data, error: catalogError } = await getSupabase()
          .from('automation_skills').select('status, n8n_workflow_id').eq('id', 'dsgvo-audit').maybeSingle();
        if (cancelled) return;
        if (catalogError) { setBinding('unknown'); return; }
        setBinding(data && data.status !== 'planned' &&
          typeof data.n8n_workflow_id === 'string' && data.n8n_workflow_id.trim()
          ? 'connected' : 'unlinked');
      } catch {
        if (!cancelled) setBinding('unknown');
      }
    };
    void check();
    return () => { cancelled = true; };
  }, []);

  // SELECT on automation_runs is protected by tenant RLS. Never use service_role
  // or accept the trigger acknowledgment as the final compliance report.
  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const poll = async () => {
      try {
        const { data, error: queryError } = await getSupabase()
          .from('automation_runs')
          .select('status, result, error_code, error_message')
          .eq('tenant_id', tenantId).eq('id', runId).maybeSingle();
        if (cancelled) return;
        if (queryError || !data) {
          setError('Der Laufstatus konnte nicht mandantenberechtigt geladen werden.');
          setRunId(null);
          return;
        }
        if (data.status === 'success') {
          const audit = parseAuditRunResult(data.result);
          if (audit) setResult(audit);
          else setError('Der Lauf ist abgeschlossen, enthält aber kein gültiges DSGVO-Auditergebnis.');
          setRunId(null);
          return;
        }
        if (isTerminalRun(data.status)) {
          setError(data.error_message || data.error_code || `Lauf beendet: ${data.status}`);
          setRunId(null);
          return;
        }
        setRunStatus(data.status === 'running' ? 'running' : 'queued');
        if (++attempts >= 180) {
          setError(`Die Ergebnisabfrage wurde beendet; der Lauf ${runId} kann weiterhin aktiv sein.`);
          setRunId(null);
          return;
        }
        timer = setTimeout(() => { void poll(); }, 2000);
      } catch (e) {
        if (!cancelled) {
          setError(`Die Ergebnisabfrage ist fehlgeschlagen: ${(e as Error).message}`);
          setRunId(null);
        }
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [runId, tenantId]);

  async function run() {
    const target = url.trim();
    if (!target) { setError('Bitte eine URL angeben (z. B. https://example.com).'); return; }
    if (binding !== 'connected') {
      setError('Dieser Skill ist noch nicht mit einem ausführbaren Workflow verbunden.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const sb = getSupabase();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setError('Bitte erneut anmelden.'); return; }

      const resp = await fetch(`${getSupabaseUrl()}/functions/v1/automation-trigger`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          skill_id: 'dsgvo-audit',
          input: { url: target },
        }),
      });
      const body = await resp.json();
      if (!resp.ok || !body.ok) {
        setError(body.error?.message ?? `Fehler ${resp.status}`);
        return;
      }
      if (typeof body.run_id !== 'string' || !body.run_id) {
        setError('Der Automationsserver hat keine gültige Run-ID geliefert.');
        return;
      }
      setRunStatus('queued');
      setRunId(body.run_id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-t border-titanium-800 p-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://ihre-domain.de"
          className="flex-1 border border-titanium-800 bg-obsidian-950 px-3 py-2 text-sm text-titanium-100 outline-none focus:border-security-500"
        />
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading || !!runId || binding !== 'connected'}
          className="flex items-center justify-center gap-1.5 border border-security-500 bg-security-500 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-white hover:bg-security-600 disabled:opacity-60"
        >
          {loading || !!runId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
          Skill aktivieren
        </button>
      </div>

      {binding !== 'connected' && (
        <p className="mt-2 text-xs text-amber-300" role="status">
          {binding === 'checking'
            ? 'Prüfe die Workflow-Anbindung …'
            : binding === 'unlinked'
              ? 'Vorschau: Der DSGVO-Audit-Skill ist noch nicht mit einem n8n-Workflow verbunden.'
              : 'Workflow-Anbindung kann derzeit nicht geprüft werden.'}
        </p>
      )}
      {runId && (
        <p className="mt-2 text-xs text-titanium-300" role="status">
          Lauf {runId} · {runStatus === 'queued' ? 'In Warteschlange' : 'Wird ausgeführt'}.
          Das Ergebnis wird nach Abschluss aus dem gespeicherten Run geladen.
        </p>
      )}
      {error && (
        <div className="mt-3 flex items-start gap-2 border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="mt-3 space-y-2 border border-titanium-800 bg-obsidian-950 p-3">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">{result.domain}</p>
            <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${SEVERITY_CLS[result.severity] ?? SEVERITY_CLS.info}`}>
              Score {result.score}/100 · {result.severity}
            </span>
          </div>
          {result.coverage_notice && (
            <p className="text-xs text-amber-300">{result.coverage_notice}</p>
          )}
          {result.issues.length === 0 ? (
            <p className="text-sm text-titanium-300">Keine Befunde.</p>
          ) : (
            <ul className="space-y-1">
              {result.issues.slice(0, 5).map((issue) => (
                <li key={issue.id} className="flex items-start gap-2 text-sm text-titanium-200">
                  <span className={`mt-0.5 shrink-0 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${SEVERITY_CLS[issue.severity] ?? SEVERITY_CLS.info}`}>
                    {issue.severity}
                  </span>
                  <span>{issue.title}</span>
                </li>
              ))}
              {result.issues.length > 5 && (
                <li className="text-[11px] text-titanium-500">
                  + {result.issues.length - 5} weitere Befunde
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
