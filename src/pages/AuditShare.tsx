import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, AlertTriangle, CheckCircle2, Loader2, ArrowRight, Share2, Linkedin,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface SharedAudit {
  share_token: string;
  domain: string;
  score: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'pass';
  issues: { id: string; severity: string; title: string; detail: string; paragraph_ref?: string }[];
  created_at: string;
}

export function AuditShare() {
  const { token } = useParams<{ token: string }>();
  const [audit, setAudit] = useState<SharedAudit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setError('Kein Share-Token in der URL.'); setLoading(false); return; }
    (async () => {
      try {
        const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/audit_share_get`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ p_id: token }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const rows = await resp.json();
        if (!Array.isArray(rows) || rows.length === 0) throw new Error('Audit nicht gefunden oder nicht öffentlich.');
        setAudit(rows[0] as SharedAudit);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <Header />

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto">
          {loading && (
            <div className="flex items-center justify-center gap-3 py-20 text-titanium-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Audit-Report wird geladen …
            </div>
          )}

          {!loading && error && (
            <div className="bg-red-950/30 border border-red-900 p-6 rounded-none">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <h1 className="text-lg font-display font-bold text-titanium-50 mb-2">Audit nicht verfügbar</h1>
                  <p className="text-sm text-titanium-300 mb-4">{error}</p>
                  <Link to="/audit" className="inline-flex items-center gap-2 px-4 py-2 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                    Eigenen Scan starten <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {!loading && audit && <SharedReport audit={audit} />}
        </div>
      </main>

      <Footer />
    </div>
  );
}

function SharedReport({ audit }: { audit: SharedAudit }) {
  const config = severityConfig(audit.severity, audit.score);
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`;
  const xText = `${audit.domain} hat ${audit.score}/100 im DSGVO-Audit. Wie schneidet Deine Site ab?`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(xText)}&url=${encodeURIComponent(window.location.href)}`;

  return (
    <article className="space-y-6">
      <div className="text-center mb-8">
        <div className="text-xs text-titanium-400 uppercase tracking-wider mb-2">Geteilter Audit-Report</div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 mb-1">{audit.domain}</h1>
        <div className="text-xs text-titanium-500">geprüft am {new Date(audit.created_at).toLocaleDateString('de-DE')}</div>
      </div>

      <div className={`p-6 sm:p-8 ${config.bg} border ${config.border} rounded-none`}>
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h2 className="text-xs text-titanium-500 uppercase tracking-wider mb-1">DSGVO-Score</h2>
            <div className={`text-base font-display font-bold ${config.color}`}>{config.label}</div>
          </div>
          <div className={`text-5xl sm:text-6xl font-display font-bold tabular-nums ${config.color}`}>
            {audit.score}<span className="text-base text-titanium-500"> / 100</span>
          </div>
        </div>
        <p className="text-sm text-titanium-300 mt-3 leading-relaxed">
          {audit.issues.length === 0
            ? 'Keine Befunde — saubere Site.'
            : `${audit.issues.length} ${audit.issues.length === 1 ? 'Befund' : 'Befunde'} aus 19 DSGVO-Heuristik-Checks.`}
        </p>
      </div>

      {audit.issues.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Befunde</h2>
          <ul className="space-y-3">
            {audit.issues.slice(0, 10).map((iss) => (
              <li key={iss.id} className="p-4 bg-obsidian-900 border border-titanium-900 rounded-none">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-display font-bold text-titanium-50 text-sm mb-1">{iss.title}</div>
                    <div className="text-sm text-titanium-300 leading-relaxed mb-2">{iss.detail}</div>
                    {iss.paragraph_ref && <div className="text-[11px] text-titanium-500 font-mono">{iss.paragraph_ref}</div>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {audit.issues.length > 10 && (
            <div className="mt-3 text-xs text-titanium-500 text-center">
              … und {audit.issues.length - 10} weitere Befunde im vollen Report.
            </div>
          )}
        </div>
      )}

      <div className="bg-obsidian-900 border border-security-700 p-6 rounded-none">
        <div className="flex items-start gap-3 mb-3">
          <ShieldCheck className="h-5 w-5 text-security-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-display font-bold text-titanium-50 text-base mb-1">Wie schneidet Deine Website ab?</h3>
            <p className="text-sm text-titanium-300 leading-relaxed">
              Kostenloser DSGVO-Scan in 30 Sekunden — ohne Account, mit konkreter Fix-Liste.
            </p>
          </div>
        </div>
        <Link
          to="/audit"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none"
        >
          Eigene Site prüfen <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="bg-obsidian-900 border border-titanium-800 p-5 rounded-none">
        <div className="flex items-center gap-2 mb-3">
          <Share2 className="h-4 w-4 text-titanium-400" />
          <div className="font-display font-bold text-titanium-100 text-sm">Weiter teilen</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-semibold rounded-none">
            <Linkedin className="h-3.5 w-3.5" /> LinkedIn
          </a>
          <a href={xUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 bg-obsidian-950 border border-titanium-700 hover:border-titanium-500 text-titanium-200 text-xs font-semibold rounded-none">
            X / Twitter
          </a>
        </div>
      </div>
    </article>
  );
}

function severityConfig(severity: SharedAudit['severity'], score: number) {
  if (score >= 80) return { label: 'Sehr gut', color: 'text-emerald-300', bg: 'bg-emerald-950/30', border: 'border-emerald-900' };
  if (score >= 60) return { label: 'Verbesserungsbedarf', color: 'text-amber-300', bg: 'bg-amber-950/30', border: 'border-amber-900' };
  if (score >= 40) return { label: 'Erhebliche Mängel', color: 'text-orange-300', bg: 'bg-orange-950/30', border: 'border-orange-900' };
  void severity;
  return { label: 'Kritisch', color: 'text-red-300', bg: 'bg-red-950/30', border: 'border-red-900' };
}

function Header() {
  return (
    <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
      <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
          <ShieldCheck className="h-4 w-4 text-white" />
        </div>
        <div className="leading-tight">
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Audit-Report</div>
          <div className="text-[11px] text-titanium-400 font-medium">Geteilte Ansicht</div>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
        <div>© 2026 RealSync Dynamics · Made in Germany</div>
        <div className="flex flex-wrap gap-3">
          <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
          <Link to="/legal/sub-processors" className="hover:text-titanium-300">Impressum</Link>
        </div>
      </div>
    </footer>
  );
}

void CheckCircle2;
