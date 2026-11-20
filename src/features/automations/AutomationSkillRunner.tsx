import { useEffect, useState } from 'react';
import { Loader2, PlayCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { getSupabase } from '../../lib/supabase';
import { getSupabaseUrl } from '../../lib/supabaseUrl';
import {
  isHttpTarget, isTerminalAutomationStatus, parseAutomationAuditResult,
  type AuditResult, type AutomationRunStatus,
} from './automationRunContract';

const SEVERITY_CLS: Record<string, string> = {
  critical: 'text-red-300 border-red-500/40 bg-red-500/10',
  high: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
  medium: 'text-amber-200 border-amber-500/30 bg-amber-500/5',
  low: 'text-titanium-300 border-titanium-700 bg-obsidian-950',
  info: 'text-titanium-400 border-titanium-800 bg-obsidian-950',
};

type BindingState = 'checking' | 'linked' | 'unlinked' | 'error';

/**
 * Automation trigger is asynchronous. It returns a run_id, not an audit report.
 * Do not display "success" before a tenant-scoped automation_runs record is terminal.
 * Without a configured workflow, direct execution is unavailable; /audit remains the
 * separate, existing website-audit entry point (shown in the card footer).
 */
export function AutomationSkillRunner({ tenantId }: { tenantId: string }) {
  const [url, setUrl] = useState('');
  const [binding, setBinding] = useState<BindingState>('checking');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<AutomationRunStatus | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setBinding('checking');
    // Authenticated RLS read; neither an unbound skill nor a failed lookup may launch n8n.
    void (async () => {
      try {
        const { data, error: lookupError } = await getSupabase()
          .from('automation_skills')
          .select('status, n8n_workflow_id')
          .eq('id', 'dsgvo-audit')
          .maybeSingle();
        if (!active) return;
        if (lookupError || !data) {
          setBinding('error');
        } else {
          setBinding(
            data.status !== 'planned' && typeof data.n8n_workflow_id === 'string' &&
            data.n8n_workflow_id.trim() !== '' ? 'linked' : 'unlinked',
          );
        }
      } catch {
        if (active) setBinding('error');
      }
    })();
    return () => { active = false; };
  }, [tenantId]);

  useEffect(() => {
    if (!runId) return;
    let active = true;
    let inFlight = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const fetchRun = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const { data, error: readError } = await getSupabase()
          .from('automation_runs')
          .select('status, result, error_code, error_message')
          .eq('id', runId)
          .eq('tenant_id', tenantId)
          .single();
        if (!active) return;
        if (readError || !data) {
          setStatusError('Laufstatus nicht lesbar. Bitte Berechtigung prüfen und erneut laden.');
          return;
        }
        const status = data.status as string;
        if (!['queued', 'running', 'success', 'error', 'timeout', 'cancelled'].includes(status)) {
          setStatusError('Unbekannter Laufstatus. Keine erfolgreiche Ausführung bestätigt.');
          return;
        }
        setRunStatus(status as AutomationRunStatus);
        setStatusError(null);
        setResult(status === 'success' ? parseAutomationAuditResult(data.result) : null);
        if (status === 'error' || status === 'timeout' || status === 'cancelled') {
          setError(data.error_message || data.error_code || 'Der Workflow wurde nicht erfolgreich abgeschlossen.');
        }
        if (isTerminalAutomationStatus(status) && timer) clearInterval(timer);
      } catch {
        if (active) setStatusError('Laufstatus konnte nicht geladen werden. Erneut versuchen.');
      } finally {
        inFlight = false;
      }
    };

    timer = setInterval(() => { void fetchRun(); }, 4000);
    void fetchRun();
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [runId, tenantId, refreshKey]);

  async function run() {
    const target = url.trim();
    if (!isHttpTarget(target)) {
      setError('Bitte eine vollständige HTTP- oder HTTPS-URL angeben.');
      return;
    }
    if (binding !== 'linked' || loading || (runStatus && !isTerminalAutomationStatus(runStatus))) return;

    setLoading(true);
    setError(null);
    setStatusError(null);
    setResult(null);
    setRunId(null);
    setRunStatus(null);

    try {
      const sb = getSupabase();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setError('Bitte erneut anmelden.'); return; }
      const resp = await fetch(getSupabaseUrl() + '/functions/v1/automation-trigger', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          skill_id: 'dsgvo-audit',
          input: { url: target },
        }),
      });
      const body: {
        ok?: boolean; run_id?: unknown;
        error?: { code?: string; message?: string };
      } = await resp.json();
      if (!resp.ok || body.ok !== true) {
        setError(body.error?.message ?? 'Workflow konnte nicht gestartet werden (HTTP ' + resp.status + ').');
        if (body.error?.code === 'skill_not_linked') setBinding('unlinked');
        return;
      }
      if (typeof body.run_id !== 'string' || !body.run_id) {
        setError('Server hat keine Laufkennung geliefert. Ergebnis nicht bestätigt.');
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

  const executing = loading || (!!runStatus && !isTerminalAutomationStatus(runStatus));
  return (
    <div className="border-t border-titanium-800 p-4">
      {binding === 'checking' && (
        <p className="text-sm text-titanium-400">Workflow-Verknüpfung wird geprüft …</p>
      )}
      {binding === 'error' && (
        <p role="alert" className="text-sm text-amber-300">
          Workflow-Verfügbarkeit konnte nicht geprüft werden. Ausführung gesperrt.
        </p>
      )}
      {binding === 'unlinked' && (
        <p className="text-sm text-amber-300">
          Dieser Automations-Skill ist noch nicht mit einem ausführbaren Workflow verknüpft.
          Für den bestehenden Website-Audit bitte den Einstieg „Skill aktivieren“ unten verwenden.
        </p>
      )}
      {binding === 'linked' && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://ihre-domain.de"
            aria-label="Website für DSGVO-Audit"
            className="flex-1 border border-titanium-800 bg-obsidian-950 px-3 py-2 text-sm text-titanium-100 outline-none focus:border-security-500"
          />
          <button
            type="button"
            onClick={() => void run()}
            disabled={executing}
            className="flex items-center justify-center gap-1.5 border border-security-500 bg-security-500 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-white hover:bg-security-600 disabled:opacity-60"
          >
            {executing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
            {executing ? 'Lauf aktiv' : 'Workflow starten'}
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="mt-3 flex items-start gap-2 border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {runId && (
        <div className="mt-3 space-y-2 border border-titanium-800 bg-obsidian-950 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-xs text-titanium-200">
              Lauf {runId.slice(0, 8)} · {runStatus === 'success' ? 'Abgeschlossen' :
                runStatus === 'running' ? 'In Bearbeitung' :
                runStatus === 'queued' ? 'In Warteschlange' :
                runStatus === 'error' ? 'Fehlgeschlagen' :
                runStatus === 'timeout' ? 'Zeitüberschreitung' :
                runStatus === 'cancelled' ? 'Abgebrochen' : 'Status unbekannt'}
            </p>
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="inline-flex items-center gap-1 text-xs text-titanium-300 hover:text-white"
            >
              <RefreshCw className="h-3 w-3" /> Status erneut prüfen
            </button>
          </div>
          {statusError && <p role="alert" className="text-xs text-amber-300">{statusError}</p>}
          {runStatus === 'success' && !result && (
            <p role="alert" className="text-sm text-amber-300">
              Der Lauf ist abgeschlossen, aber kein validierbarer DSGVO-Auditbericht
              im Ergebnissatz vorhanden. Keine Report-Freigabe.
            </p>
          )}
        </div>
      )}

      {runStatus === 'success' && result && (
        <div className="mt-3 space-y-2 border border-titanium-800 bg-obsidian-950 p-3">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">{result.domain}</p>
            <span className={'border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ' +
              (SEVERITY_CLS[result.severity] ?? SEVERITY_CLS.info)}>
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
                  <span className={'mt-0.5 shrink-0 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ' +
                    (SEVERITY_CLS[issue.severity] ?? SEVERITY_CLS.info)}>
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
