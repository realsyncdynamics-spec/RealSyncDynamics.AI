import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, AlertTriangle, CheckCircle2, Loader2, ArrowRight, Share2, Linkedin,
} from 'lucide-react';
import { ConfidenceScore } from '../components/ConfidenceScore';
import { HumanVerificationGate } from '../components/HumanVerificationGate';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Versions-Tags für Audit-Engine + Tracker-DB. Sichtbar im Report für
// Reproduzierbarkeit. Bei Major-Release in /changelog dokumentieren.
const AUDIT_ENGINE_VERSION = '2026.05.0';
const TRACKER_DB_VERSION = '2026.05.0 (EasyList + Disconnect.me + DACH-Custom)';

interface HistoryPoint {
  score: number;
  severity: string;
  created_at: string;
  issue_count: number;
}

interface SharedAudit {
  share_token: string;
  domain: string;
  score: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'pass';
  issues: { id: string; severity: string; title: string; detail: string; paragraph_ref?: string }[];
  created_at: string;
  previous_score: number | null;
  previous_at: string | null;
  history: HistoryPoint[] | null;
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
    <div className="min-h-screen bg-obsidian-950 text-titanium-100 print:bg-white print:text-zinc-900">
      <style>{`
        @media print {
          @page { size: A4; margin: 16mm 14mm; }
          body { background: white !important; color: #18181b !important; }
          .print\\:hidden { display: none !important; }
          a { text-decoration: none !important; color: inherit !important; }
          header { display: none !important; }
          footer { border-top: 1px solid #e4e4e7 !important; color: #71717a !important; }
        }
      `}</style>
      <Header />

      <main className="px-4 sm:px-6 py-12 sm:py-16 print:py-0">
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
        <div className="text-xs text-titanium-500">
          geprüft am {new Date(audit.created_at).toLocaleDateString('de-DE')}
        </div>
        <div className="mt-2 inline-flex flex-wrap items-center gap-2 text-[10px] text-titanium-500 font-mono">
          <span className="px-2 py-0.5 border border-titanium-800 bg-obsidian-900 rounded-none">
            audit-engine: {AUDIT_ENGINE_VERSION}
          </span>
          <span className="px-2 py-0.5 border border-titanium-800 bg-obsidian-900 rounded-none">
            tracker-db: {TRACKER_DB_VERSION}
          </span>
          <Link to="/legal/methodology" className="text-titanium-400 hover:text-titanium-200 underline">
            Methodik
          </Link>
        </div>
      </div>

      <div className={`p-6 sm:p-8 ${config.bg} border ${config.border} rounded-none`}>
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h2 className="text-xs text-titanium-500 uppercase tracking-wider mb-1">DSGVO-Score</h2>
            <div className={`text-base font-display font-bold ${config.color}`}>{config.label}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className={`text-5xl sm:text-6xl font-display font-bold tabular-nums ${config.color}`}>
              {audit.score}<span className="text-base text-titanium-500"> / 100</span>
            </div>
            {audit.previous_score !== null && audit.previous_score !== audit.score && (
              <ScoreDelta current={audit.score} previous={audit.previous_score} previousAt={audit.previous_at} />
            )}
          </div>
        </div>
        <p className="text-sm text-titanium-300 mt-3 leading-relaxed">
          {audit.issues.length === 0
            ? 'Keine Befunde — saubere Site.'
            : `${audit.issues.length} ${audit.issues.length === 1 ? 'Befund' : 'Befunde'} aus 29 DSGVO-Heuristik-Checks.`}
        </p>
      </div>

      {audit.history && audit.history.length > 1 && <HistoryStrip history={audit.history} />}

      <div className="print:hidden">
        <ConfidenceScore
          score={auditConfidence(audit)}
          flags={auditConfidenceFlags(audit)}
          methodologyVersion="audit:2026.05.0"
        />
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

      <div className="bg-obsidian-900 border border-titanium-800 p-5 rounded-none print:hidden">
        <div className="flex items-center gap-2 mb-3">
          <Share2 className="h-4 w-4 text-titanium-400" />
          <div className="font-display font-bold text-titanium-100 text-sm">Weiter teilen oder drucken</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-semibold rounded-none">
            <Linkedin className="h-3.5 w-3.5" /> LinkedIn
          </a>
          <a href={xUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 bg-obsidian-950 border border-titanium-700 hover:border-titanium-500 text-titanium-200 text-xs font-semibold rounded-none">
            X / Twitter
          </a>
        </div>
        <div className="mt-3">
          <HumanVerificationGate
            context="audit"
            proceedLabel="Bericht als PDF drucken"
            onProceed={() => window.print()}
          />
        </div>
      </div>
    </article>
  );
}

function auditConfidence(a: SharedAudit): number {
  // Static-Audit ist limitiert. Mit historischen Vergleichen + mehr Befunden steigt Aussagekraft.
  let score = 70;
  if (a.history && a.history.length >= 2) score += 5;
  if (a.history && a.history.length >= 5) score += 3;
  if (a.issues.length === 0 && a.score >= 80) score += 5;       // saubere Site, plausibel
  if (a.issues.length >= 5) score += 5;                          // Kohärentes Bild
  return Math.min(score, 85); // Static-Audit kann nicht > 85, Server-Side-Tracking unbekannt
}

function auditConfidenceFlags(a: SharedAudit): string[] {
  const flags: string[] = [];
  flags.push('Static-Analyse — Server-Side-Tracking, dynamisch geladene Skripte und verschachtelte Tracker werden nicht erkannt');
  if (a.issues.some((i) => i.title.toLowerCase().includes('cookie'))) {
    flags.push('Cookie-Banner-Konformität: manuelle Klick-Pfad-Prüfung empfohlen (3 gleichberechtigte Buttons, Reject-Pfad)');
  }
  if (a.issues.some((i) => /google|meta|facebook|tiktok|linkedin/i.test(i.title))) {
    flags.push('Drittland-Tracker erkannt — Schrems-II-Bewertung + AVV-Status der Anbieter prüfen');
  }
  if (a.issues.length === 0) {
    flags.push('Keine Befunde — kann auch Detection-Limit bedeuten (z. B. Tracker erst nach Consent geladen)');
  }
  return flags;
}

function ScoreDelta({ current, previous, previousAt }: { current: number; previous: number; previousAt: string | null }) {
  const delta = current - previous;
  const positive = delta > 0;
  const color = positive ? 'text-emerald-300 border-emerald-700 bg-emerald-950/40'
                         : 'text-red-300 border-red-700 bg-red-950/40';
  const arrow = positive ? '↑' : '↓';
  const days = previousAt
    ? Math.max(1, Math.round((Date.now() - new Date(previousAt).getTime()) / 86400000))
    : null;
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 border ${color} text-xs font-bold tabular-nums rounded-none`}>
      {arrow} {Math.abs(delta)}
      {days !== null && <span className="opacity-70 font-normal">seit {days}d</span>}
    </div>
  );
}

function HistoryStrip({ history }: { history: { score: number; severity: string; created_at: string; issue_count: number }[] }) {
  return (
    <section>
      <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">
        Verlauf · {history.length} {history.length === 1 ? 'Audit' : 'Audits'}
      </h2>
      <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
        <div className="flex items-end gap-2 h-24 print:h-16">
          {history.map((h, i) => {
            const color = h.score >= 80 ? 'bg-emerald-500'
                        : h.score >= 60 ? 'bg-amber-500'
                        : h.score >= 40 ? 'bg-orange-500'
                        : 'bg-red-500';
            const heightPct = Math.max(10, h.score);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                <div className="text-[10px] text-titanium-400 font-mono opacity-0 group-hover:opacity-100 transition">
                  {h.score}
                </div>
                <div className={`${color} w-full transition-all`} style={{ height: `${heightPct}%`, minHeight: '4px' }} />
                <div className="text-[9px] text-titanium-500 tabular-nums">
                  {new Date(h.created_at).toLocaleDateString('de-DE', { month: '2-digit', day: '2-digit' })}
                </div>
              </div>
            );
          })}
        </div>
        {history.length >= 2 && (
          <p className="text-[11px] text-titanium-400 mt-3 leading-relaxed">
            {(() => {
              const first = history[0].score;
              const last = history[history.length - 1].score;
              const delta = last - first;
              if (delta > 0) return `↑ ${delta} Punkte verbessert seit dem ersten Scan. Weiter so!`;
              if (delta < 0) return `↓ ${Math.abs(delta)} Punkte verschlechtert seit dem ersten Scan. Zeit für einen Compliance-Refresh.`;
              return `Score stabil. Bleib am Ball.`;
            })()}
          </p>
        )}
      </div>
    </section>
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
