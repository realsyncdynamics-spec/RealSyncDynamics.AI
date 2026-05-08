import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Cookie, AlertTriangle, CheckCircle2, Globe, Send, Loader2,
  ShieldCheck, Eye, Activity,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'pass';

interface CookieRow {
  name: string;
  value_preview: string;
  domain: string | null;
  path: string | null;
  expires: string | null;
  http_only: boolean;
  secure: boolean;
  same_site: string | null;
  category: 'essential' | 'tracking' | 'unknown';
  third_party: boolean;
  set_before_consent: boolean;
}

interface Tracker {
  id: string;
  name: string;
  category: 'analytics' | 'advertising' | 'ux' | 'consent_manager';
  pattern_matched: string;
  consent_compliant: boolean;
}

interface ScanResult {
  ok: true;
  url: string;
  domain: string;
  fetched_status: number | null;
  fetch_error: string | null;
  scanned_at: string;
  cookies: CookieRow[];
  trackers: Tracker[];
  consent_manager_detected: boolean;
  score: number;
  severity: Severity;
  summary: string;
}

/**
 * /cookie-scanner — Erstes öffentliches Free-Tool.
 *
 * Single-purpose Cookie-Scanner: URL eingeben → Scan-Result mit Cookies +
 * Trackers + Score. Kein Email-Gate, kein Account, kein DB-Eintrag.
 * Reine Pre-Lead-Erfahrung; voll-Audit (mit Email + Methodik-Report) ist
 * der CTA am Ende.
 */
export function CookieScanner() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/cookie-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        setError(data?.error?.message ?? `Scan fehlgeschlagen (HTTP ${resp.status})`);
        return;
      }
      setResult(data as ScanResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Netzwerkfehler beim Scan.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
            <Cookie className="h-4 w-4 text-obsidian-950" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Cookie-Scanner</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto">
          {!result && (
            <>
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 border border-amber-900 bg-amber-950/30 text-amber-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
                  <Cookie className="h-3 w-3" /> Kostenlos · Kein Email · 15 Sekunden
                </div>
                <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
                  Welche Cookies setzt Ihre Website <span className="text-amber-400">vor Consent</span>?
                </h1>
                <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
                  Wir laden Ihre URL einmalig ohne Einwilligung und zeigen, welche Cookies dabei gesetzt
                  und welche Tracker geladen werden — mit Klassifizierung essential / tracking / unknown.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3 mb-4">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /><span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="bg-obsidian-900 border border-titanium-900 p-6 sm:p-8 rounded-none space-y-4">
                <label className="block">
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500">
                    Website-URL
                  </span>
                  <div className="mt-2 flex items-center gap-2">
                    <Globe className="h-4 w-4 text-titanium-400 shrink-0" />
                    <input
                      type="text" required value={url} onChange={(e) => setUrl(e.target.value)}
                      placeholder="kanzlei-mueller.de"
                      className="flex-1 bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-sm rounded-none outline-none focus:border-amber-500"
                    />
                  </div>
                </label>

                <button
                  type="submit" disabled={loading || !url}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-obsidian-950 font-bold rounded-none"
                >
                  {loading
                    ? (<><Loader2 className="h-4 w-4 animate-spin" /> Scanne …</>)
                    : (<><Send className="h-4 w-4" /> Cookies scannen</>)}
                </button>

                <p className="text-[11px] text-titanium-500 text-center pt-1">
                  Wir laden die Seite einmalig serverseitig, parsen Set-Cookie-Header + Tracker-Scripts.
                  Keine Speicherung, kein Account.
                </p>
              </form>

              {/* What we detect — Trust-Anker */}
              <section className="mt-12">
                <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-4 text-center">Was wir erkennen</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { Icon: Cookie,      title: 'Cookies vor Consent',       body: 'Alle Set-Cookie-Header beim ersten Page-Load — name, domain, expires, http-only, same-site.' },
                    { Icon: Eye,         title: '7 Tracker-Familien',         body: 'GA4 / Meta Pixel / LinkedIn / TikTok / Hotjar / Microsoft Clarity / Matomo.' },
                    { Icon: ShieldCheck, title: 'Consent-Manager-Detection', body: 'Cookiebot / Usercentrics / Borlabs / Klaro / OneTrust / CookieYes / Real Cookie Banner / Iubenda.' },
                    { Icon: Activity,    title: 'First-/Third-Party Split',  body: 'Cookies werden klassifiziert als essential / tracking / unknown und mit Cross-Domain-Markierung.' },
                  ].map((it) => (
                    <div key={it.title} className="p-4 bg-obsidian-900 border border-titanium-900 rounded-none">
                      <div className="flex items-center gap-2 mb-1.5">
                        <it.Icon className="h-3.5 w-3.5 text-amber-400" />
                        <div className="font-display font-bold text-sm text-titanium-50">{it.title}</div>
                      </div>
                      <div className="text-xs text-titanium-400">{it.body}</div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {result && <ResultView result={result} onRetry={() => { setResult(null); setUrl(''); }} />}
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/audit"             className="hover:text-titanium-300">Voll-Audit</Link>
            <Link to="/legal/methodology" className="hover:text-titanium-300">Methodik</Link>
            <Link to="/grenzen"           className="hover:text-titanium-300">Grenzen</Link>
            <Link to="/legal/privacy"     className="hover:text-titanium-300">Datenschutz</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Result View ───────────────────────────────────────────────── */

const SEVERITY_STYLES: Record<Severity, { bg: string; border: string; color: string; label: string }> = {
  pass:     { bg: 'bg-emerald-950/30', border: 'border-emerald-700', color: 'text-emerald-300', label: 'PASS · sauber' },
  low:      { bg: 'bg-amber-950/20',   border: 'border-amber-700',   color: 'text-amber-300',   label: 'LOW · kleine Befunde' },
  medium:   { bg: 'bg-amber-950/30',   border: 'border-amber-700',   color: 'text-amber-200',   label: 'MEDIUM · Aufmerksamkeit nötig' },
  high:     { bg: 'bg-red-950/30',     border: 'border-red-700',     color: 'text-red-300',     label: 'HIGH · Pre-Consent-Tracking aktiv' },
  critical: { bg: 'bg-red-950/40',     border: 'border-red-600',     color: 'text-red-200',     label: 'CRITICAL · klare Verstöße' },
};

function ResultView({ result, onRetry }: { result: ScanResult; onRetry: () => void }) {
  const config = SEVERITY_STYLES[result.severity];
  const trackingCount = result.cookies.filter((c) => c.category === 'tracking').length;
  const thirdPartyCount = result.cookies.filter((c) => c.third_party).length;

  return (
    <div className="space-y-6">
      <div className={`p-6 sm:p-8 ${config.bg} border ${config.border} rounded-none`}>
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <div className="text-xs text-titanium-400 mb-1">{result.domain}</div>
            <h1 className={`text-2xl sm:text-3xl font-display font-bold ${config.color}`}>
              Cookie-Scan · {config.label}
            </h1>
          </div>
          <div className={`text-5xl sm:text-6xl font-display font-bold tabular-nums ${config.color}`}>
            {result.score}
            <span className="text-base text-titanium-500"> / 100</span>
          </div>
        </div>
        <p className="text-sm text-titanium-300 mt-3 leading-relaxed">{result.summary}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono uppercase tracking-wider text-titanium-500">
          <span>HTTP {result.fetched_status ?? '—'}</span>
          <span>{result.cookies.length} Cookies</span>
          <span>{trackingCount} Tracking-Cookies</span>
          <span>{thirdPartyCount} Third-Party</span>
          <span>{result.trackers.length} Tracker-Scripts</span>
          <span>{result.consent_manager_detected ? '✓ Consent-Manager' : '✗ Kein Consent-Manager'}</span>
        </div>
      </div>

      {result.cookies.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">
            {result.cookies.length} Cookie{result.cookies.length === 1 ? '' : 's'} vor Consent gesetzt
          </h2>
          <div className="overflow-x-auto border border-titanium-900">
            <table className="w-full text-sm">
              <thead className="bg-obsidian-900 text-[10px] uppercase tracking-wider text-titanium-400">
                <tr>
                  <th className="px-3 py-2 text-left font-bold">Name</th>
                  <th className="px-3 py-2 text-left font-bold">Domain</th>
                  <th className="px-3 py-2 text-left font-bold">Kategorie</th>
                  <th className="px-3 py-2 text-left font-bold">Flags</th>
                  <th className="px-3 py-2 text-left font-bold">Expires</th>
                </tr>
              </thead>
              <tbody>
                {result.cookies.map((c, i) => (
                  <tr key={i} className="border-t border-titanium-900">
                    <td className="px-3 py-2.5 font-mono text-titanium-200">{c.name}</td>
                    <td className="px-3 py-2.5 text-titanium-300">
                      {c.domain ?? '—'}
                      {c.third_party && <span className="ml-1.5 text-[10px] text-amber-400">3rd</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <CategoryBadge cat={c.category} />
                    </td>
                    <td className="px-3 py-2.5 text-[11px] font-mono text-titanium-500">
                      {[c.http_only && 'HttpOnly', c.secure && 'Secure', c.same_site].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-titanium-400">{c.expires ?? 'Session'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {result.trackers.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">
            {result.trackers.length} Tracker erkannt
          </h2>
          <ul className="space-y-2">
            {result.trackers.map((t) => (
              <li key={t.id} className="p-3 bg-obsidian-900 border border-titanium-900 border-l-2 border-l-red-700 rounded-none">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-display font-bold text-sm text-titanium-50">{t.name}</span>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-red-300">{t.category}</span>
                </div>
                <code className="text-[11px] font-mono text-titanium-500 break-all">{t.pattern_matched}</code>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.cookies.length === 0 && result.trackers.length === 0 && (
        <div className="p-5 bg-emerald-950/30 border border-emerald-900 rounded-none flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <div className="font-display font-bold text-titanium-50 mb-0.5">Saubere Site!</div>
            <div className="text-sm text-titanium-300">
              Keine Cookies vor Consent, keine Tracker erkannt. Glückwunsch — das ist seltener als Sie denken.
            </div>
          </div>
        </div>
      )}

      <div className="bg-obsidian-900 border border-amber-700 p-6 rounded-none">
        <h3 className="font-display font-bold text-titanium-50 text-lg mb-2">Voll-Audit für 12 weitere Compliance-Checks</h3>
        <p className="text-sm text-titanium-300 mb-4 leading-relaxed">
          Der Cookie-Scan zeigt einen Ausschnitt. Unser <strong className="text-titanium-50">DSGVO-Quick-Audit</strong>{' '}
          prüft zusätzlich Security-Header, Drittanbieter, Datenschutzerklärung, AVV-Pflicht, Drittlandtransfer
          und liefert einen PDF-Report mit Paragraph-Bezug.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            to={`/audit?source=cookie-scanner&domain=${encodeURIComponent(result.domain)}`}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none"
          >
            Voll-Audit starten <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-amber-500 text-titanium-200 text-sm font-bold rounded-none"
          >
            Andere URL scannen
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryBadge({ cat }: { cat: CookieRow['category'] }) {
  const map = {
    essential: { color: 'border-emerald-700 text-emerald-300 bg-emerald-950/30', label: 'essential' },
    tracking:  { color: 'border-red-700 text-red-300 bg-red-950/30',             label: 'tracking'  },
    unknown:   { color: 'border-titanium-700 text-titanium-400',                  label: 'unknown'   },
  } as const;
  const { color, label } = map[cat];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider border rounded-none ${color}`}>
      {label}
    </span>
  );
}
