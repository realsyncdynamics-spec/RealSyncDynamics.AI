// ConsentTimingAnalysis — Das Alleinstellungsmerkmal:
// Prüft welche Requests VOR Consent abgefeuert wurden (§ 25 TTDSG Verstoß).
// Nutzt den cookie-scan-deep / Playwright-Scanner-Microservice.
//
// Route: /consent-timing
// Auth: nicht erforderlich für Quick-Scan (Free-Tier)

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Clock, AlertTriangle, CheckCircle2, Loader2,
  Globe, ExternalLink, ShieldCheck, Info, ZapOff,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

interface ConsentTimingRequest {
  url: string;
  method: string;
  resource_type: string;
  timing_ms: number;
  before_consent: boolean;
  third_party: boolean;
  tracker_name?: string;
}

interface ConsentTimingResult {
  ok: boolean;
  domain: string;
  scan_id: string;
  consent_banner_detected: boolean;
  consent_banner_timing_ms: number | null;
  requests_before_consent: ConsentTimingRequest[];
  requests_after_consent: ConsentTimingRequest[];
  total_requests: number;
  violations: number;
  score: number; // 0-100: 100 = kein Verstoß
  summary: string;
  error?: string;
}

type Phase =
  | { type: 'idle' }
  | { type: 'scanning'; step: string }
  | { type: 'done'; result: ConsentTimingResult }
  | { type: 'error'; message: string };

const STEPS = [
  'Browser startet …',
  'Seite wird geladen …',
  'Requests werden protokolliert …',
  'Consent-Banner wird erkannt …',
  'Timing analysiert …',
  'Report wird generiert …',
];

export function ConsentTimingAnalysis() {
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<Phase>({ type: 'idle' });

  async function runScan(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    const normalized = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;

    let stepIdx = 0;
    setPhase({ type: 'scanning', step: STEPS[0] });
    const interval = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, STEPS.length - 1);
      setPhase((p) => p.type === 'scanning' ? { ...p, step: STEPS[stepIdx] } : p);
    }, 2500);

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/cookie-scan-deep`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: normalized, scan_type: 'consent_timing' }),
      });
      const data = await resp.json();
      clearInterval(interval);
      if (!resp.ok || !data.ok) throw new Error(data.error?.message ?? `HTTP ${resp.status}`);
      setPhase({ type: 'done', result: data as ConsentTimingResult });
    } catch (err) {
      clearInterval(interval);
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
          <div className="w-8 h-8 rounded-none bg-obsidian-950 border border-titanium-700 flex items-center justify-center">
            <Clock className="h-4 w-4 text-security-400" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Consent-Timing-Analyse</div>
            <div className="text-[11px] text-titanium-400">§ 25 TTDSG · Pre-Consent-Request-Nachweis</div>
          </div>
        </div>
        <div className="ml-auto">
          <span className="text-[10px] px-2 py-1 border border-amber-900 bg-amber-950/30 text-amber-400 font-bold uppercase tracking-wider">
            Business+
          </span>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12">
        <div className="max-w-3xl mx-auto space-y-8">

          {/* Hero */}
          <div>
            <h1 className="text-3xl font-display font-bold text-titanium-50 mb-3">
              Welche Requests liefen <span className="text-security-400">vor dem Consent?</span>
            </h1>
            <p className="text-titanium-300 leading-relaxed max-w-2xl">
              Die meisten DSGVO-Tools prüfen nur: "Ist ein Banner vorhanden?"
              Wir prüfen: <strong className="text-titanium-50">"Welche Tracking-Requests feuerten bevor der Nutzer geklickt hat?"</strong>{' '}
              Das ist der tatsächliche § 25 TTDSG Verstoß — und der, der Bußgelder auslöst.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-titanium-500">
              <span className="flex items-center gap-1 px-2 py-1 bg-obsidian-900 border border-titanium-800">
                <Clock className="h-3 w-3" /> Playwright Headless
              </span>
              <span className="flex items-center gap-1 px-2 py-1 bg-obsidian-900 border border-titanium-800">
                <ShieldCheck className="h-3 w-3" /> Network-Interception
              </span>
              <span className="flex items-center gap-1 px-2 py-1 bg-obsidian-900 border border-titanium-800">
                <Info className="h-3 w-3" /> Millisekunden-Präzision
              </span>
            </div>
          </div>

          {/* Scan Form */}
          {(phase.type === 'idle' || phase.type === 'error') && (
            <form onSubmit={runScan} className="bg-obsidian-900 border border-titanium-800 p-6 rounded-none">
              <label className="block mb-4">
                <span className="text-xs font-bold text-titanium-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" /> Website-URL
                </span>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="ihre-firma.de"
                  className="w-full bg-obsidian-950 border border-titanium-800 px-3 py-2.5 text-sm rounded-none outline-none focus:border-titanium-300"
                  autoFocus
                />
              </label>
              {phase.type === 'error' && (
                <div className="flex items-start gap-2 text-sm text-red-400 mb-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {phase.message}
                </div>
              )}
              <button
                type="submit"
                disabled={!url.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none disabled:opacity-40"
              >
                <Clock className="h-4 w-4" /> Consent-Timing analysieren
              </button>
              <p className="text-[11px] text-titanium-500 mt-2 text-center">
                Headless-Browser öffnet Ihre Seite und protokolliert alle Netzwerk-Requests mit Zeitstempel.
                Dauert 15–30 Sekunden.
              </p>
            </form>
          )}

          {/* Scanning */}
          {phase.type === 'scanning' && (
            <div className="bg-obsidian-900 border border-titanium-800 p-6 rounded-none">
              <div className="flex items-center gap-3 mb-4">
                <Loader2 className="h-5 w-5 text-security-400 animate-spin shrink-0" />
                <div>
                  <div className="font-bold text-titanium-50 text-sm">{phase.step}</div>
                  <div className="text-xs text-titanium-500 mt-0.5">Playwright Browser läuft …</div>
                </div>
              </div>
              <div className="w-full bg-obsidian-800 h-1 overflow-hidden">
                <div className="h-full bg-security-500 animate-pulse w-1/2" />
              </div>
              <p className="text-xs text-titanium-500 mt-3">
                Hinweis: Headless-Browser muss starten — erste Analyse kann 20–30s dauern.
              </p>
            </div>
          )}

          {/* Result */}
          {phase.type === 'done' && (
            <ConsentTimingResult
              result={phase.result}
              onRescan={() => setPhase({ type: 'idle' })}
            />
          )}

          {/* Erklärung */}
          {phase.type !== 'done' && (
            <ExplanationBlock />
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Result ──────────────────────────────────────────────────────────────

function ConsentTimingResult({
  result,
  onRescan,
}: {
  result: ConsentTimingResult;
  onRescan: () => void;
}) {
  const hasViolations = result.violations > 0;
  const scoreColor =
    result.score >= 80 ? 'text-emerald-400' :
    result.score >= 50 ? 'text-amber-400' :
    'text-red-400';

  return (
    <div className="space-y-5">
      {/* Score Card */}
      <div className={`p-6 bg-obsidian-900 border ${hasViolations ? 'border-red-900' : 'border-emerald-900'} rounded-none`}>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="text-xs font-mono text-titanium-500 mb-1">{result.domain}</div>
            <h2 className="text-xl font-display font-bold text-titanium-50">Consent-Timing-Score</h2>
            {result.consent_banner_detected ? (
              <p className="text-sm text-emerald-400 mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Banner erkannt nach{' '}
                {result.consent_banner_timing_ms !== null
                  ? `${result.consent_banner_timing_ms} ms`
                  : 'unbekannt'}
              </p>
            ) : (
              <p className="text-sm text-red-400 mt-1 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Kein Consent-Banner erkannt
              </p>
            )}
          </div>
          <div className={`text-5xl font-display font-bold tabular-nums ${scoreColor}`}>
            {result.score}
            <span className="text-sm text-titanium-500"> / 100</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4 text-center">
          <div className="p-3 bg-obsidian-950 border border-titanium-800">
            <div className="text-2xl font-bold text-red-400">{result.violations}</div>
            <div className="text-[10px] uppercase tracking-wider text-titanium-500 mt-0.5">Verstöße</div>
          </div>
          <div className="p-3 bg-obsidian-950 border border-titanium-800">
            <div className="text-2xl font-bold text-titanium-200">{result.requests_before_consent.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-titanium-500 mt-0.5">Vor Consent</div>
          </div>
          <div className="p-3 bg-obsidian-950 border border-titanium-800">
            <div className="text-2xl font-bold text-titanium-400">{result.total_requests}</div>
            <div className="text-[10px] uppercase tracking-wider text-titanium-500 mt-0.5">Requests gesamt</div>
          </div>
        </div>

        <p className="text-sm text-titanium-300 leading-relaxed">{result.summary}</p>
      </div>

      {/* Violations List */}
      {result.requests_before_consent.filter(r => r.before_consent && r.third_party).length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            Tracking-Requests VOR Consent ({result.requests_before_consent.filter(r => r.third_party).length})
          </h3>
          <ul className="space-y-2">
            {result.requests_before_consent
              .filter(r => r.third_party)
              .map((req, i) => (
                <RequestRow key={i} req={req} isViolation />
              ))}
          </ul>
        </div>
      )}

      {/* First-Party before consent */}
      {result.requests_before_consent.filter(r => !r.third_party).length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">
            Eigene Requests vor Consent ({result.requests_before_consent.filter(r => !r.third_party).length})
          </h3>
          <ul className="space-y-1.5">
            {result.requests_before_consent
              .filter(r => !r.third_party)
              .slice(0, 10)
              .map((req, i) => (
                <RequestRow key={i} req={req} isViolation={false} />
              ))}
          </ul>
        </div>
      )}

      {/* No violations */}
      {result.violations === 0 && result.consent_banner_detected && (
        <div className="p-5 bg-obsidian-900 border border-emerald-900 rounded-none flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-titanium-50">Kein Pre-Consent-Tracking!</div>
            <p className="text-sm text-titanium-300 mt-1">
              Alle Tracking-Requests laufen erst nach Consent-Interaktion. § 25 TTDSG eingehalten.
              Für laufendes Monitoring empfehlen wir den Growth-Tarif.
            </p>
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="p-5 bg-obsidian-900 border border-titanium-700 rounded-none flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <div className="font-bold text-titanium-50 text-sm mb-1">Nachweis sichern</div>
          <p className="text-xs text-titanium-400">
            PDF mit Timestamps + Screenshots als Audit-Beweis — Growth-Tarif.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 px-4 py-2 bg-security-500 hover:bg-security-600 text-white text-xs font-bold rounded-none"
          >
            Growth freischalten
          </Link>
          <button
            onClick={onRescan}
            className="inline-flex items-center gap-2 px-4 py-2 border border-titanium-700 hover:border-titanium-400 text-titanium-400 text-xs rounded-none"
          >
            Andere URL
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Request Row ─────────────────────────────────────────────────────────

function RequestRow({ req, isViolation }: { req: ConsentTimingRequest; isViolation: boolean }) {
  let shortUrl = req.url;
  try { const u = new URL(req.url); shortUrl = u.hostname + u.pathname.substring(0, 40); }
  catch { /* ok */ }

  return (
    <li className={`p-3 border ${isViolation ? 'border-red-900 bg-red-950/10' : 'border-titanium-800 bg-obsidian-900'} rounded-none`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          {isViolation
            ? <ZapOff className="h-3.5 w-3.5 text-red-400 shrink-0" />
            : <Globe className="h-3.5 w-3.5 text-titanium-500 shrink-0" />}
          <span className="text-xs font-mono text-titanium-300 truncate">{shortUrl}</span>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {req.timing_ms > 0 && (
            <span className="text-[10px] font-mono text-titanium-500">T+{req.timing_ms}ms</span>
          )}
          {req.tracker_name && (
            <span className="text-[10px] px-1.5 py-0.5 bg-red-950 border border-red-800 text-red-300 font-bold uppercase">
              {req.tracker_name}
            </span>
          )}
          {req.third_party && !req.tracker_name && (
            <span className="text-[10px] px-1.5 py-0.5 bg-obsidian-800 border border-titanium-700 text-titanium-400">
              3rd-party
            </span>
          )}
        </div>
      </div>
      <div className="text-[10px] text-titanium-600 font-mono">{req.resource_type} · {req.method}</div>
    </li>
  );
}

// ─── Explanation ─────────────────────────────────────────────────────────

function ExplanationBlock() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-display font-bold text-titanium-50">Warum Timing entscheidend ist</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          {
            icon: <AlertTriangle className="h-4 w-4 text-red-400" />,
            title: 'Das Problem der meisten Tools',
            text: 'Sie prüfen nur ob ein Cookie-Banner auf der Seite vorhanden ist. Das sagt nichts darüber aus, ob Cookies bereits gesetzt wurden bevor der Nutzer interagiert hat.',
          },
          {
            icon: <Clock className="h-4 w-4 text-security-400" />,
            title: 'Was wirklich zählt',
            text: '§ 25 TTDSG verbietet das Setzen von Cookies und Tracking-Requests ohne vorherige Einwilligung. Entscheidend ist der Zeitpunkt — nicht das Vorhandensein eines Banners.',
          },
          {
            icon: <ShieldCheck className="h-4 w-4 text-emerald-400" />,
            title: 'Unser Ansatz',
            text: 'Wir öffnen Ihre Seite mit einem frischen Browser ohne Cookies, protokollieren alle Netzwerk-Requests mit Millisekunden-Timestamp und messen wann der Consent-Banner erscheint.',
          },
          {
            icon: <ExternalLink className="h-4 w-4 text-titanium-400" />,
            title: 'Nachweisbarkeit',
            text: 'Das Ergebnis enthält URLs, Timestamps, Resource-Types und Tracker-Namen — alles was Sie für eine Dokumentation bei der Aufsichtsbehörde oder als Gegen-Beweis brauchen.',
          },
        ].map(({ icon, title, text }) => (
          <div key={title} className="p-4 bg-obsidian-900 border border-titanium-800 rounded-none">
            <div className="flex items-center gap-2 mb-2">{icon}<span className="font-bold text-titanium-50 text-sm">{title}</span></div>
            <p className="text-xs text-titanium-400 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
