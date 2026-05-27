import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Activity, AlertCircle, CheckCircle2, Clock, Globe,
  ShieldCheck, TrendingDown, TrendingUp, Plus, RefreshCw, Bell, BellOff,
} from 'lucide-react';
import { getSupabase } from '../lib/supabase';

/**
 * /risk-dashboard — Compliance Monitoring Dashboard
 *
 * Zeigt für alle monitored_domains des Tenants:
 * - Aktuellen Compliance-Score + Risk-Level
 * - Score-Timeline (letzten 30 Scans als Mini-Chart)
 * - Erkannte Tracker
 * - Drift-Alerts (neue Tracker seit letztem Scan)
 * - Manueller Re-Scan-Button
 *
 * Tier: Growth/Business (199€/Monat) und höher
 * Route: /risk-dashboard
 */

const supabase = getSupabase();

// ─── Types ───────────────────────────────────────────────────────────────────

interface MonitoredDomain {
  id: string;
  domain: string;
  tier: string;
  active: boolean;
  alert_email: string | null;
  last_scan_at: string | null;
  last_risk_score: number | null;
  last_trackers: string[];
}

interface TimelineEntry {
  scanned_at: string;
  risk_score: number;
  risk_level: string;
  trackers: string[];
  drift: boolean;
  new_t: string[];
  scan_type: string;
}

// ─── Risk-Level Styling ───────────────────────────────────────────────────────

function riskColor(score: number | null): string {
  if (score === null) return 'text-titanium-500';
  if (score < 40) return 'text-red-400';
  if (score < 60) return 'text-orange-400';
  if (score < 80) return 'text-yellow-400';
  return 'text-emerald-400';
}

function riskBg(score: number | null): string {
  if (score === null) return 'border-titanium-800';
  if (score < 40) return 'border-red-800 bg-red-950/20';
  if (score < 60) return 'border-orange-800 bg-orange-950/20';
  if (score < 80) return 'border-yellow-800 bg-yellow-950/20';
  return 'border-emerald-800 bg-emerald-950/20';
}

function riskLabel(score: number | null): string {
  if (score === null) return 'Kein Scan';
  if (score < 40) return 'Kritisch';
  if (score < 60) return 'Hoch';
  if (score < 80) return 'Mittel';
  return 'Niedrig';
}

// ─── Mini Score Chart (SVG Sparkline) ─────────────────────────────────────────

function ScoreSparkline({ data }: { data: TimelineEntry[] }) {
  if (data.length < 2) return <div className="text-xs text-titanium-600">Zu wenig Daten</div>;

  const scores = data.map(d => d.risk_score).reverse(); // älteste zuerst
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const w = 200;
  const h = 48;
  const pts = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * w;
    const y = h - ((s - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  const lastScore = scores[scores.length - 1];
  const prevScore = scores[scores.length - 2];
  const trend = lastScore > prevScore ? 'up' : lastScore < prevScore ? 'down' : 'flat';

  return (
    <div className="flex items-end gap-3">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        <polyline
          points={pts}
          fill="none"
          stroke={lastScore >= 80 ? '#34d399' : lastScore >= 60 ? '#facc15' : lastScore >= 40 ? '#fb923c' : '#f87171'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Letzter Punkt */}
        <circle
          cx={(scores.length - 1) / (scores.length - 1) * w}
          cy={h - ((lastScore - min) / range) * h}
          r="3"
          fill={lastScore >= 80 ? '#34d399' : lastScore >= 60 ? '#facc15' : lastScore >= 40 ? '#fb923c' : '#f87171'}
        />
      </svg>
      <div className="flex items-center gap-1 text-xs text-titanium-400">
        {trend === 'up'
          ? <TrendingUp className="h-3 w-3 text-emerald-400" />
          : trend === 'down'
            ? <TrendingDown className="h-3 w-3 text-red-400" />
            : null}
        <span>{scores.length} Scans</span>
      </div>
    </div>
  );
}

// ─── Domain Card ──────────────────────────────────────────────────────────────

function DomainCard({
  domain,
  onRescan,
}: {
  domain: MonitoredDomain;
  onRescan: (id: string, url: string) => void;
}) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    async function loadTimeline() {
      setLoading(true);
      const { data } = await supabase.rpc('get_compliance_timeline', {
        p_domain: domain.domain,
        p_tenant_id: (await supabase.auth.getUser()).data.user?.id ?? '',
        p_limit: 30,
      });
      setTimeline(data ?? []);
      setLoading(false);
    }
    loadTimeline();
  }, [domain.domain]);

  const latestDrift = timeline.find(t => t.drift && t.new_t?.length > 0);
  const score = domain.last_risk_score;
  const lastScan = domain.last_scan_at
    ? new Date(domain.last_scan_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
    : null;

  return (
    <div className={`border rounded-none p-5 sm:p-6 ${riskBg(score)}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <Globe className="h-4 w-4 text-titanium-400 shrink-0" />
          <div className="min-w-0">
            <div className="font-mono text-sm font-bold text-titanium-50 truncate">{domain.domain}</div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 mt-0.5">
              {domain.tier} · {domain.active ? 'Aktiv' : 'Inaktiv'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={async () => {
              setScanning(true);
              onRescan(domain.id, domain.domain);
              setTimeout(() => setScanning(false), 10000);
            }}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-titanium-700 hover:border-titanium-400 text-titanium-300 hover:text-titanium-100 text-xs font-semibold rounded-none transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Läuft…' : 'Re-Scan'}
          </button>
        </div>
      </div>

      {/* Score + Level */}
      <div className="flex items-baseline gap-3 mb-4">
        <span className={`text-4xl font-display font-bold tabular-nums ${riskColor(score)}`}>
          {score ?? '—'}
        </span>
        <div>
          <div className={`text-sm font-bold ${riskColor(score)}`}>{riskLabel(score)}</div>
          <div className="text-[10px] text-titanium-500 font-mono">Compliance-Score / 100</div>
        </div>
      </div>

      {/* Sparkline */}
      {!loading && <ScoreSparkline data={timeline} />}

      {/* Tracker */}
      {domain.last_trackers?.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 mb-1.5">
            Erkannte Tracker ({domain.last_trackers.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {domain.last_trackers.slice(0, 8).map(t => (
              <span
                key={t}
                className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-obsidian-900 border border-titanium-800 text-titanium-300 rounded-none"
              >
                {t}
              </span>
            ))}
            {domain.last_trackers.length > 8 && (
              <span className="text-[10px] text-titanium-500">+{domain.last_trackers.length - 8} mehr</span>
            )}
          </div>
        </div>
      )}

      {/* Drift Alert */}
      {latestDrift && latestDrift.new_t?.length > 0 && (
        <div className="mt-4 p-3 bg-red-950/40 border border-red-800/60">
          <div className="flex items-center gap-2 text-red-300 text-xs font-bold mb-1">
            <AlertCircle className="h-3.5 w-3.5" />
            Neue Tracker seit letztem Scan
          </div>
          <div className="flex flex-wrap gap-1.5">
            {latestDrift.new_t.map(t => (
              <span key={t} className="text-[10px] font-mono text-red-300 bg-red-950/40 px-1.5 py-0.5 border border-red-800/40">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-titanium-900 flex items-center gap-2 text-[10px] text-titanium-600 font-mono">
        <Clock className="h-3 w-3" />
        {lastScan ? `Letzter Scan: ${lastScan}` : 'Noch kein Scan'}
        {domain.alert_email && (
          <span className="ml-auto flex items-center gap-1">
            <Bell className="h-3 w-3" /> {domain.alert_email}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Add Domain Modal ─────────────────────────────────────────────────────────

function AddDomainModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function handleAdd() {
    if (!domain.trim()) { setErr('Domain erforderlich'); return; }
    setLoading(true); setErr('');
    const user = await supabase.auth.getUser();
    const { data: tenant } = await supabase
      .from('tenant_users').select('tenant_id').eq('user_id', user.data.user?.id ?? '').single();

    const { error } = await supabase.from('monitored_domains').insert({
      tenant_id: tenant?.tenant_id,
      domain: domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, ''),
      alert_email: email.trim() || null,
      tier: 'growth',
    });

    if (error) { setErr(error.message); setLoading(false); return; }
    onAdded();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-obsidian-900 border border-titanium-700 p-6 w-full max-w-md rounded-none">
        <h2 className="font-display font-bold text-titanium-50 text-lg mb-4">Domain hinzufügen</h2>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 block mb-1">
              Domain / URL
            </label>
            <input
              type="text"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="example.com"
              className="w-full bg-obsidian-950 border border-titanium-700 text-titanium-50 px-3 py-2 text-sm rounded-none focus:border-titanium-400 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 block mb-1">
              Alert-E-Mail (optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="alerts@example.com"
              className="w-full bg-obsidian-950 border border-titanium-700 text-titanium-50 px-3 py-2 text-sm rounded-none focus:border-titanium-400 outline-none"
            />
          </div>
          {err && <p className="text-red-400 text-xs">{err}</p>}
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={handleAdd}
            disabled={loading}
            className="flex-1 bg-white text-obsidian-950 px-4 py-2.5 text-sm font-bold rounded-none hover:bg-titanium-200 transition-colors disabled:opacity-50"
          >
            {loading ? 'Speichern…' : 'Domain hinzufügen'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-titanium-700 text-titanium-300 text-sm rounded-none hover:border-titanium-400 transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function RiskDashboard() {
  const [domains, setDomains] = useState<MonitoredDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function loadDomains() {
    setLoading(true);
    const { data } = await supabase
      .from('monitored_domains')
      .select('*')
      .order('last_risk_score', { ascending: true, nullsFirst: true });
    setDomains(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadDomains(); }, []);

  async function handleRescan(id: string, domain: string) {
    await supabase.functions.invoke('cookie-scan', {
      body: { url: `https://${domain}`, includeDetails: true },
    });
    setTimeout(loadDomains, 5000);
  }

  const criticalCount = domains.filter(d => (d.last_risk_score ?? 0) < 40).length;
  const avgScore = domains.length
    ? Math.round(domains.filter(d => d.last_risk_score !== null).reduce((a, d) => a + (d.last_risk_score ?? 0), 0)
      / Math.max(1, domains.filter(d => d.last_risk_score !== null).length))
    : null;

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      {/* Header */}
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4 gap-3">
        <Link to="/dashboard" className="p-1.5 hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <ShieldCheck className="h-5 w-5 text-brass-400" />
        <span className="font-display font-bold text-sm text-titanium-50">Risk Dashboard</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={loadDomains}
            className="p-1.5 hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200"
            title="Aktualisieren"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-obsidian-950 text-xs font-bold rounded-none hover:bg-titanium-200 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Domain hinzufügen
          </button>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-8 max-w-7xl mx-auto">
        {/* Summary Bar */}
        {domains.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-titanium-900 mb-8">
            <StatBox label="Domains" value={domains.length.toString()} />
            <StatBox label="Ø Score" value={avgScore !== null ? `${avgScore}/100` : '—'} accent={avgScore !== null && avgScore < 60} />
            <StatBox label="Kritisch" value={criticalCount.toString()} accent={criticalCount > 0} />
            <StatBox label="Aktiv" value={domains.filter(d => d.active).length.toString()} />
          </div>
        )}

        {/* Domain Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-titanium-500 text-sm">
            <Activity className="h-5 w-5 animate-pulse mr-2" /> Lade Domains…
          </div>
        ) : domains.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Globe className="h-12 w-12 text-titanium-700 mb-4" />
            <h2 className="font-display font-bold text-titanium-300 text-xl mb-2">Noch keine Domains</h2>
            <p className="text-titanium-500 text-sm mb-6 max-w-sm">
              Füge deine erste Domain hinzu — wir scannen sie täglich auf Compliance-Verstösse.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-obsidian-950 text-sm font-bold rounded-none hover:bg-titanium-200 transition-colors"
            >
              <Plus className="h-4 w-4" /> Erste Domain hinzufügen
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {domains.map(d => (
              <DomainCard key={d.id} domain={d} onRescan={handleRescan} />
            ))}
          </div>
        )}
      </main>

      {showAdd && (
        <AddDomainModal onClose={() => setShowAdd(false)} onAdded={loadDomains} />
      )}
    </div>
  );
}

function StatBox({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-obsidian-950 px-5 py-4">
      <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 mb-1">{label}</div>
      <div className={`text-2xl font-display font-bold ${accent ? 'text-red-400' : 'text-titanium-50'}`}>{value}</div>
    </div>
  );
}
