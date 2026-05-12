import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Globe, AlertTriangle, CheckCircle2, ShieldCheck,
  Search, Wrench, Activity, Loader2, Send, RefreshCw, ExternalLink,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'pass';
interface Issue {
  id: string;
  severity: Exclude<Severity, 'pass'>;
  title: string;
  detail: string;
  paragraph_ref?: string;
}
interface ScanReport {
  audit_id: string;
  domain: string;
  score: number;
  severity: Severity;
  issues: Issue[];
}

type ScanPhase =
  | { type: 'idle' }
  | { type: 'scanning'; url: string; step: string }
  | { type: 'done'; report: ScanReport; inputUrl: string }
  | { type: 'error'; message: string };

const SCAN_STEPS = [
  'Cookies & Tracker analysieren …',
  'Consent-Timing prüfen …',
  'Security-Header scannen …',
  'Rechtsdokumente prüfen …',
  'Score berechnen …',
];

export function DsgvoWebsiteLanding() {
  const [searchParams] = useSearchParams();
  const [url, setUrl] = useState(searchParams.get('url') ?? '');
  const [phase, setPhase] = useState<ScanPhase>({ type: 'idle' });

  async function runScan(e?: React.FormEvent) {
    e?.preventDefault();
    if (!url.trim()) return;
    const normalizedUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;

    // Animate through steps while real scan runs
    let stepIdx = 0;
    setPhase({ type: 'scanning', url: normalizedUrl, step: SCAN_STEPS[0] });
    const stepInterval = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, SCAN_STEPS.length - 1);
      setPhase((prev) =>
        prev.type === 'scanning' ? { ...prev, step: SCAN_STEPS[stepIdx] } : prev
      );
    }, 900);

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/gdpr-audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizedUrl }),
      });
      const data = await resp.json();
      clearInterval(stepInterval);
      if (!resp.ok || !data.ok) throw new Error(data.error?.message ?? `HTTP ${resp.status}`);
      setPhase({ type: 'done', report: data as ScanReport, inputUrl: normalizedUrl });
    } catch (err) {
      clearInterval(stepInterval);
      setPhase({ type: 'error', message: (err as Error).message });
    }
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-fuchsia-600 to-amber-600 flex items-center justify-center">
            <Globe className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">DSGVO-Website-as-a-Service</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">

          {/* Hero + Scan-Form */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-amber-900 bg-amber-950/30 text-amber-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <ShieldCheck className="h-3 w-3" /> Audit · Rebuild · Managed · EU-Hosted
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Ihre Website — in 30 Sekunden auf{' '}
              <span className="text-security-400">DSGVO-Konformität</span> geprüft.
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed mb-6">
              Geben Sie Ihre Domain ein. Wir scannen sofort auf Tracker, fehlenden Consent,
              Security-Header und Rechtsdokumente — kostenlos, kein Account.
            </p>

            {/* Scan Box */}
            {(phase.type === 'idle' || phase.type === 'error') && (
              <form onSubmit={runScan} className="max-w-xl mx-auto">
                <div className="flex gap-0">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-titanium-500 pointer-events-none" />
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="ihre-firma.de"
                      className="w-full bg-obsidian-900 border border-titanium-700 border-r-0 pl-9 pr-3 py-3 text-sm rounded-none outline-none focus:border-titanium-300 text-titanium-100"
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!url.trim()}
                    className="px-5 py-3 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none disabled:opacity-40 flex items-center gap-2 whitespace-nowrap"
                  >
                    <Search className="h-4 w-4" /> Quick-Scan
                  </button>
                </div>
                {phase.type === 'error' && (
                  <p className="mt-2 text-sm text-red-400 text-left flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 shrink-0" /> {phase.message}
                  </p>
                )}
                <p className="mt-2 text-xs text-titanium-500">
                  Kein Account. Kein Tracking. Kein Datenspeicher auf unserer Seite.
                </p>
              </form>
            )}

            {/* Scanning Animation */}
            {phase.type === 'scanning' && (
              <div className="max-w-xl mx-auto bg-obsidian-900 border border-titanium-800 p-6 rounded-none">
                <div className="flex items-center gap-3 mb-4">
                  <Loader2 className="h-5 w-5 text-security-400 animate-spin shrink-0" />
                  <div className="text-left">
                    <div className="text-xs text-titanium-500 mb-0.5 font-mono">{phase.url}</div>
                    <div className="text-sm font-bold text-titanium-50">{phase.step}</div>
                  </div>
                </div>
                <div className="w-full bg-obsidian-800 h-1 rounded-none overflow-hidden">
                  <div className="h-full bg-security-500 animate-pulse w-2/3" />
                </div>
              </div>
            )}
          </div>

          {/* Scan-Ergebnis */}
          {phase.type === 'done' && (
            <ScanResult
              report={phase.report}
              inputUrl={phase.inputUrl}
              onRescan={() => setPhase({ type: 'idle' })}
            />
          )}

          {/* Pakete — immer sichtbar */}
          <Section title="Drei Pakete · klar getrennt">
            <div className="grid sm:grid-cols-3 gap-3 mt-2">
              <PackageCard
                icon={<Search className="h-4 w-4 text-emerald-400" />}
                badge="Einstieg"
                title="Audit"
                price="ab 249 €"
                priceNote="einmalig"
                bullets={[
                  'Voll-Scan auf 12+ DSGVO/TTDSG-Befunde',
                  'PDF-Report mit Priorisierung + Paragraphen-Refs',
                  'Drittanbieter-Karte + Header-Analyse',
                  '30-Min-Befund-Call inklusive',
                ]}
                cta={{ to: '/audit?source=dsgvo-website', label: 'Quick-Scan starten' }}
              />
              <PackageCard
                icon={<Wrench className="h-4 w-4 text-amber-400" />}
                badge="Projekt"
                title="Rebuild"
                price="1.500 – 4.000 €"
                priceNote="einmalig"
                bullets={[
                  'Audit inklusive + Befund-Behebung',
                  'Modernes Layout · lokale Fonts · Consent-Banner',
                  'Security-Header · Impressum/DS-Templates',
                  'Übergabe oder Direkt-Übernahme in Managed',
                ]}
                cta={{ to: '/contact-sales?source=dsgvo-website-rebuild', label: 'Beratung anfragen' }}
                accent
              />
              <PackageCard
                icon={<Activity className="h-4 w-4 text-fuchsia-400" />}
                badge="Laufend"
                title="Managed"
                price="ab 99 €"
                priceNote="pro Monat"
                bullets={[
                  'EU-Hosting · TLS · Backups · Monitoring',
                  'Security-Updates · Header-Pflege · Consent-Updates',
                  '2× Re-Audit pro Jahr inkl. Fix-Plan',
                  'Audit-Trail · jederzeit kündbar',
                ]}
                cta={{ to: '/contact-sales?source=dsgvo-website-managed', label: 'Tarif anfragen' }}
                directCheckoutTier="managed"
              />
            </div>
          </Section>

          <Section title="Was wir typischerweise finden">
            <ul className="space-y-1.5 text-sm">
              {[
                ['Google Fonts remote eingebunden', 'LG München I, 3 O 17493/20 — 100 € pro Verstoß plus Abmahnrisiko'],
                ['GA4 / Pixel ohne Consent', '§ 25 TTDSG — Einwilligung vor jedem Tracking-Cookie zwingend'],
                ['HSTS / Security-Header fehlen', 'BSI-Empfehlung verfehlt — leicht prüfbar, schwer zu ignorieren'],
                ['Kein Datenschutz-Link auf Startseite', 'Art. 13 DSGVO + § 5 TMG — direkter UWG-Abmahngrund'],
                ['Kein HTTPS-only oder mixed Content', 'HSTS fehlt — Browser warnen, Suchmaschinen bestrafen'],
              ].map(([t, d]) => (
                <li key={t} className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <span><strong className="text-titanium-50 mr-1">{t}:</strong>{d}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Was wir nicht versprechen">
            <ul className="space-y-1.5 text-sm">
              {[
                'Keine Rechtsberatung — wir liefern technische Compliance-Härtung, kein Anwaltsschreiben.',
                'Keine Garantie gegen Abmahnung — wir reduzieren Angriffsfläche, nicht juristisches Risiko in Gänze.',
                'Keine Inhaltspflege — Texte/Bilder bleibt bei Ihnen, wir pflegen Technik und Pflicht-Layer.',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-titanium-400 shrink-0 mt-0.5" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              Erst der Quick-Scan, dann reden wir.
            </h2>
            <p className="text-titanium-400 text-sm leading-relaxed">
              In 30 Sekunden sehen Sie, wo Ihre Site steht. Wenn die Befunde klar sind, schicken wir Ihnen ein passendes Paket — ohne Vorab-Verpflichtung.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <button
                onClick={() => { setPhase({ type: 'idle' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none"
              >
                Jetzt scannen <ArrowRight className="h-4 w-4" />
              </button>
              <Link to="/contact-sales?source=dsgvo-website" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Beratung anfragen
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/impressum" className="hover:text-titanium-300">Impressum</Link>
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Scan Result ─────────────────────────────────────────────────────────

interface ScanResultProps {
  report: ScanReport;
  inputUrl: string;
  onRescan: () => void;
}

function ScanResult({ report, inputUrl, onRescan }: ScanResultProps) {
  const critCount = report.issues.filter((i) => i.severity === 'critical').length;
  const highCount = report.issues.filter((i) => i.severity === 'high').length;
  const scoreColor =
    report.score >= 80 ? 'text-emerald-400' :
    report.score >= 50 ? 'text-amber-400' :
    'text-red-400';
  const scoreBorder =
    report.score >= 80 ? 'border-emerald-800' :
    report.score >= 50 ? 'border-amber-800' :
    'border-red-900';

  return (
    <div className="space-y-5">
      {/* Score Header */}
      <div className={`p-6 bg-obsidian-900 border ${scoreBorder} rounded-none`}>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="text-xs text-titanium-500 font-mono mb-1">{report.domain}</div>
            <h2 className="text-xl font-display font-bold text-titanium-50">Compliance-Score</h2>
            <p className="text-sm text-titanium-300 mt-1">
              {report.issues.length} Befunde
              {critCount > 0 && <span className="text-red-400 font-bold ml-2">· {critCount} kritisch</span>}
              {highCount > 0 && <span className="text-amber-400 ml-2">· {highCount} hoch</span>}
            </p>
          </div>
          <div className={`text-6xl font-display font-bold tabular-nums ${scoreColor}`}>
            {report.score}
            <span className="text-base text-titanium-500"> / 100</span>
          </div>
        </div>

        {/* Score Bar */}
        <div className="w-full bg-obsidian-800 h-2 rounded-none overflow-hidden mb-4">
          <div
            className={`h-full transition-all ${
              report.score >= 80 ? 'bg-emerald-500' :
              report.score >= 50 ? 'bg-amber-500' :
              'bg-red-500'
            }`}
            style={{ width: `${report.score}%` }}
          />
        </div>

        {/* Quick upgrade CTA if bad score */}
        {report.score < 60 && (
          <div className="flex flex-col sm:flex-row gap-2">
            <DirectCheckoutButton
              sourceUrl={inputUrl}
              label="DSGVO-Rebuild jetzt buchen"
              tier="managed"
            />
            <Link
              to={`/contact-sales?source=dsgvo-scan&domain=${report.domain}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-obsidian-950 border border-titanium-700 hover:border-titanium-300 text-titanium-200 text-xs font-bold rounded-none"
            >
              Kostenlose Beratung anfragen
            </Link>
          </div>
        )}
      </div>

      {/* Issue List */}
      {report.issues.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">
            Befunde ({report.issues.length})
          </h3>
          <ul className="space-y-2">
            {report.issues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </ul>
        </div>
      )}

      {report.issues.length === 0 && (
        <div className="p-5 bg-obsidian-900 border border-emerald-900 rounded-none flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-titanium-50">Keine Befunde — saubere Site!</div>
            <p className="text-sm text-titanium-300 mt-1">
              Alle 12 Standard-Checks bestanden. Das ist selten — Glückwunsch.
              Für laufendes Monitoring empfehlen wir den Managed-Tarif.
            </p>
          </div>
        </div>
      )}

      {/* Full audit CTA */}
      <div className="p-5 bg-obsidian-900 border border-titanium-700 rounded-none flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-titanium-300 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="font-bold text-titanium-50 mb-1">Vollständiger Audit mit PDF-Report</div>
          <p className="text-sm text-titanium-300 mb-3">
            Der Quick-Scan ist eine Momentaufnahme. Der vollständige Audit prüft 40+ Checkpoints,
            liefert Paragraphen-Refs, Vorher/Nachher-Screenshots und ein druckbares PDF.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/audit?source=dsgvo-website&url=${encodeURIComponent(inputUrl)}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-security-500 hover:bg-security-600 text-white text-xs font-bold rounded-none"
            >
              Voll-Audit starten <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              onClick={onRescan}
              className="inline-flex items-center gap-2 px-4 py-2 border border-titanium-700 hover:border-titanium-400 text-titanium-400 hover:text-titanium-200 text-xs rounded-none"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Andere URL scannen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Issue Row ────────────────────────────────────────────────────────────

function IssueRow({ issue }: { issue: Issue }) {
  const sevStyle: Record<string, string> = {
    critical: 'border-red-900 bg-red-950/20',
    high: 'border-titanium-700 bg-obsidian-900',
    medium: 'border-titanium-800 bg-obsidian-900',
    low: 'border-titanium-800 bg-obsidian-900',
    info: 'border-titanium-800 bg-obsidian-900',
  };
  const sevLabel: Record<string, string> = {
    critical: 'KRITISCH', high: 'HOCH', medium: 'MITTEL', low: 'NIEDRIG', info: 'INFO',
  };
  const sevColor: Record<string, string> = {
    critical: 'text-red-400', high: 'text-amber-400', medium: 'text-titanium-200',
    low: 'text-titanium-400', info: 'text-titanium-500',
  };
  return (
    <li className={`p-4 border ${sevStyle[issue.severity] ?? 'border-titanium-800 bg-obsidian-900'} rounded-none`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${sevColor[issue.severity]}`}>
          {sevLabel[issue.severity] ?? issue.severity}
        </span>
        {issue.paragraph_ref && (
          <span className="text-[10px] text-titanium-500 font-mono">{issue.paragraph_ref}</span>
        )}
      </div>
      <div className="font-bold text-titanium-50 text-sm mb-0.5">{issue.title}</div>
      <div className="text-sm text-titanium-400 leading-relaxed">{issue.detail}</div>
    </li>
  );
}

// ─── Direct Checkout Button ───────────────────────────────────────────────

function DirectCheckoutButton({
  sourceUrl,
  label,
  tier = 'managed',
}: {
  sourceUrl: string;
  label: string;
  tier?: 'managed' | 'premium' | 'enterprise';
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/checkout-website-rebuild`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source_url: sourceUrl, tier, return_url: window.location.origin }),
      });
      const data = await r.json();
      if (!r.ok || !data.url) {
        setErr(data?.error?.code === 'PRICE_NOT_CONFIGURED'
          ? 'Tarif nicht konfiguriert — Beratung anfragen.'
          : 'Checkout fehlgeschlagen.');
        setBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-obsidian-950 text-xs font-bold rounded-none disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
        {label}
      </button>
      {err && <p className="text-[11px] text-red-400 mt-1">{err}</p>}
    </div>
  );
}

// ─── Package Card ─────────────────────────────────────────────────────────

interface PackageCardProps {
  icon: React.ReactNode;
  badge: string;
  title: string;
  price: string;
  priceNote: string;
  bullets: string[];
  cta: { to: string; label: string };
  accent?: boolean;
  directCheckoutTier?: 'managed' | 'premium' | 'enterprise';
}

function PackageCard({ icon, badge, title, price, priceNote, bullets, cta, accent, directCheckoutTier }: PackageCardProps) {
  return (
    <div className={`p-4 bg-obsidian-900 border ${accent ? 'border-amber-700' : 'border-titanium-900'} rounded-none flex flex-col`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[10px] uppercase tracking-wider text-titanium-500 font-bold">{badge}</span>
      </div>
      <div className="font-display font-bold text-titanium-50 text-lg">{title}</div>
      <div className="mt-1 mb-3">
        <span className="text-2xl font-display font-bold text-titanium-50">{price}</span>
        <span className="text-xs text-titanium-500 ml-1.5">{priceNote}</span>
      </div>
      <ul className="space-y-1.5 text-xs text-titanium-300 mb-4 flex-1">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      {directCheckoutTier && (
        <DirectCheckoutButton
          sourceUrl=""
          label="Direkt buchen"
          tier={directCheckoutTier}
        />
      )}
      <Link
        to={cta.to}
        className={`mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-none ${
          accent
            ? 'bg-amber-500 hover:bg-amber-600 text-obsidian-950'
            : 'bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200'
        }`}
      >
        {cta.label} <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-display font-bold text-titanium-50 mb-3">{title}</h2>
      <div className="text-titanium-300 text-sm sm:text-base leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}
