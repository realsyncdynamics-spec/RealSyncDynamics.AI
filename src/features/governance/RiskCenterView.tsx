import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, CheckCircle2, Loader2,
  RefreshCw, ShieldAlert, ShieldX, TrendingDown,
} from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { WorkspaceShell } from '../workspace/WorkspaceShell';
import { getSupabase } from '../../lib/supabase';

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface RiskItem {
  id: string;
  source: 'incident' | 'alert' | 'finding';
  severity: Severity;
  title: string;
  description: string | null;
  status: string;
  detected_at: string;
  link: string;
}

const SEV_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

const SEV_UI: Record<Severity, { label: string; dot: string; text: string; bg: string }> = {
  critical: { label: 'Kritisch', dot: 'bg-rose-500',    text: 'text-rose-300',    bg: 'border-rose-900 bg-rose-950/20' },
  high:     { label: 'Hoch',     dot: 'bg-orange-400',  text: 'text-orange-300',  bg: 'border-orange-900 bg-orange-950/20' },
  medium:   { label: 'Mittel',   dot: 'bg-amber-400',   text: 'text-amber-300',   bg: 'border-amber-900 bg-amber-950/20' },
  low:      { label: 'Niedrig',  dot: 'bg-sky-400',     text: 'text-sky-300',     bg: 'border-sky-900 bg-sky-950/10' },
  info:     { label: 'Info',     dot: 'bg-titanium-500', text: 'text-titanium-400', bg: 'border-titanium-800' },
};

const SOURCE_LABELS: Record<RiskItem['source'], string> = {
  incident: 'Vorfall',
  alert:    'Alert',
  finding:  'Finding',
};

function formatRel(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const h = Math.floor(d / 3_600_000);
  const days = Math.floor(d / 86_400_000);
  if (h < 1)    return 'Gerade eben';
  if (h < 24)   return `vor ${h} Std.`;
  return `vor ${days} Tag${days === 1 ? '' : 'en'}`;
}

function computeRiskScore(items: RiskItem[]): number {
  const open = items.filter((i) => i.status !== 'resolved' && i.status !== 'dismissed');
  const penalty =
    open.filter((i) => i.severity === 'critical').length * 25 +
    open.filter((i) => i.severity === 'high').length    * 12 +
    open.filter((i) => i.severity === 'medium').length  * 5  +
    open.filter((i) => i.severity === 'low').length     * 2;
  return Math.max(0, Math.min(100, 100 - penalty));
}

export function RiskCenterView() {
  return (
    <AuthGate>
      {() => (
        <WorkspaceShell title="Risk Center">
          <Inner />
        </WorkspaceShell>
      )}
    </AuthGate>
  );
}

function Inner() {
  const { activeTenantId } = useTenant();
  const [risks, setRisks]     = useState<RiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [filterSev, setFilterSev] = useState<Severity | 'all'>('all');

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    setLoading(true); setError(null);
    try {
      const sb = getSupabase();

      // Incidents (offene Vorfälle / Meldepflicht)
      const [incRes, alertRes] = await Promise.all([
        sb.from('incidents')
          .select('id,title,description,severity,status,detected_at')
          .eq('tenant_id', activeTenantId)
          .not('status', 'in', '("resolved","reported_to_authority")')
          .order('detected_at', { ascending: false })
          .limit(50),

        sb.from('governance_alerts')
          .select('id,title,message,severity,status,created_at')
          .eq('tenant_id', activeTenantId)
          .eq('status', 'open')
          .in('severity', ['critical', 'high', 'medium'])
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const items: RiskItem[] = [];

      for (const inc of (incRes.data ?? []) as Array<{
        id: string; title: string; description: string | null;
        severity: Severity; status: string; detected_at: string;
      }>) {
        items.push({
          id:          inc.id,
          source:      'incident',
          severity:    inc.severity,
          title:       inc.title,
          description: inc.description,
          status:      inc.status,
          detected_at: inc.detected_at,
          link:        '/app/incidents',
        });
      }

      for (const alert of (alertRes.data ?? []) as Array<{
        id: string; title: string; message: string;
        severity: Severity; status: string; created_at: string;
      }>) {
        items.push({
          id:          alert.id,
          source:      'alert',
          severity:    alert.severity,
          title:       alert.title,
          description: alert.message,
          status:      alert.status,
          detected_at: alert.created_at,
          link:        '/app/alerts',
        });
      }

      // Nach Schwere sortieren
      items.sort((a, b) => {
        const sa = SEV_ORDER.indexOf(a.severity);
        const sb2 = SEV_ORDER.indexOf(b.severity);
        if (sa !== sb2) return sa - sb2;
        return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime();
      });

      setRisks(items);
    } catch (e) {
      setError((e as Error)?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [activeTenantId]);

  useEffect(() => { load(); }, [load]);

  const score = computeRiskScore(risks);
  const scoreColor = score >= 75 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-rose-400';

  const bySeverity = (sev: Severity) => risks.filter((r) => r.severity === sev);
  const visible = filterSev === 'all' ? risks : risks.filter((r) => r.severity === filterSev);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-titanium-50 tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-400" />
            Risk Center
          </h2>
          <p className="text-sm text-titanium-400 mt-1">
            Priorisierte Risiken aus Vorfällen, Alerts und Findings.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-titanium-400 hover:text-titanium-100 border border-titanium-800 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </button>
      </div>

      {/* Risk Score */}
      <div className="border border-titanium-800 bg-obsidian-900 p-5 flex flex-wrap items-center gap-8">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mb-1">Live Risk Score</p>
          <div className="flex items-baseline gap-2">
            {loading
              ? <Loader2 className="h-8 w-8 animate-spin text-titanium-600" />
              : <>
                  <span className={`font-display font-bold text-5xl tabular-nums ${scoreColor}`}>{score}</span>
                  <span className="text-titanium-500">/ 100</span>
                </>}
          </div>
          <p className="text-xs text-titanium-600 mt-1">
            Abgeleitet aus offenen Risiken und Schwere-Gewichtung.
          </p>
        </div>

        {/* Severity-Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
          {SEV_ORDER.slice(0, 4).map((sev) => {
            const count = bySeverity(sev).length;
            const ui = SEV_UI[sev];
            return (
              <div key={sev} className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full shrink-0 ${ui.dot}`} />
                <div>
                  <p className={`font-display font-bold text-lg tabular-nums ${ui.text}`}>{count}</p>
                  <p className="font-mono text-[9px] text-titanium-600 uppercase tracking-widest">{ui.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 ml-auto">
          <Link to="/app/incidents" className="flex items-center gap-1.5 text-xs font-mono text-rose-300 hover:text-rose-200 border border-rose-900 px-2 py-1">
            <ShieldX className="h-3 w-3" /> Vorfälle <ArrowRight className="h-3 w-3" />
          </Link>
          <Link to="/app/alerts" className="flex items-center gap-1.5 text-xs font-mono text-amber-300 hover:text-amber-200 border border-amber-900 px-2 py-1">
            <AlertTriangle className="h-3 w-3" /> Alerts <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => setFilterSev('all')}
          className={`px-2 py-0.5 text-xs font-mono transition-colors ${filterSev === 'all' ? 'bg-cyan-900/50 text-cyan-300 border border-cyan-800' : 'text-titanium-500 border border-titanium-800 hover:text-titanium-200'}`}
        >
          Alle ({risks.length})
        </button>
        {SEV_ORDER.map((sev) => {
          const count = bySeverity(sev).length;
          if (count === 0) return null;
          return (
            <button
              key={sev}
              onClick={() => setFilterSev(sev)}
              className={`px-2 py-0.5 text-xs font-mono transition-colors ${filterSev === sev ? `${SEV_UI[sev].text} border border-current bg-current/10` : 'text-titanium-500 border border-titanium-800 hover:text-titanium-200'}`}
            >
              {SEV_UI[sev].label} ({count})
            </button>
          );
        })}
      </div>

      {error && (
        <div className="text-sm text-rose-300 bg-rose-950/30 border border-rose-900 px-3 py-2">{error}</div>
      )}

      {/* Risiko-Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-titanium-900">
          <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-3" />
          <p className="text-titanium-300 font-semibold">Keine offenen Risiken</p>
          <p className="text-sm text-titanium-600 mt-1">Das Governance OS überwacht kontinuierlich weiter.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {visible.map((risk) => {
            const ui = SEV_UI[risk.severity];
            return (
              <Link
                key={`${risk.source}-${risk.id}`}
                to={risk.link}
                className={`flex items-start gap-3 p-4 border transition-colors hover:opacity-80 ${ui.bg}`}
              >
                <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${ui.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className={`font-mono text-[9px] uppercase tracking-widest ${ui.text}`}>
                      {ui.label}
                    </span>
                    <span className="font-mono text-[9px] text-titanium-700">·</span>
                    <span className="font-mono text-[9px] text-titanium-600">
                      {SOURCE_LABELS[risk.source]}
                    </span>
                    <span className="font-mono text-[9px] text-titanium-700">·</span>
                    <span className="font-mono text-[9px] text-titanium-600">
                      {formatRel(risk.detected_at)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-titanium-100">{risk.title}</p>
                  {risk.description && (
                    <p className="text-xs text-titanium-500 mt-0.5 truncate">{risk.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <TrendingDown className={`h-3.5 w-3.5 ${ui.text}`} />
                  <ArrowRight className="h-3.5 w-3.5 text-titanium-700" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
