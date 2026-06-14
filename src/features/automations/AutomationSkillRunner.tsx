import { useState } from 'react';
import { Loader2, PlayCircle, AlertTriangle } from 'lucide-react';
import { getSupabase } from '../../lib/supabase';

interface AuditIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  detail: string;
}

interface AuditResult {
  audit_id: string;
  score: number;
  severity: string;
  domain: string;
  issues: AuditIssue[];
  coverage: string;
  coverage_notice?: string | null;
}

const SEVERITY_CLS: Record<string, string> = {
  critical: 'text-red-300 border-red-500/40 bg-red-500/10',
  high: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
  medium: 'text-amber-200 border-amber-500/30 bg-amber-500/5',
  low: 'text-titanium-300 border-titanium-700 bg-obsidian-950',
  info: 'text-titanium-400 border-titanium-800 bg-obsidian-950',
};

/**
 * Direct-Execution-Runner für den DSGVO Audit Skill — ruft `automation-trigger`
 * auf, die den Run synchron gegen `gdpr-audit` ausführt (kein n8n nötig) und
 * das Ergebnis als automation_outputs speichert.
 */
export function AutomationSkillRunner({ tenantId }: { tenantId: string }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);

  async function run() {
    const target = url.trim();
    if (!target) { setError('Bitte eine URL angeben (z. B. https://example.com).'); return; }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const sb = getSupabase();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setError('Bitte erneut anmelden.'); return; }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/automation-trigger`, {
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
      setResult(body.result as AuditResult);
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
          disabled={loading}
          className="flex items-center justify-center gap-1.5 border border-security-500 bg-security-500 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-white hover:bg-security-600 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
          Skill aktivieren
        </button>
      </div>

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
