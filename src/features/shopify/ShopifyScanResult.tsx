import { Link } from 'react-router-dom';
import { ArrowRight, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';

export interface ShopifyFindingView {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  recommendation: string;
}

export interface ShopifyScanResultView {
  score: number;
  summary: string;
  findings: ShopifyFindingView[];
  evidence: {
    scannedUrls: string[];
    headers: Record<string, Record<string, string>>;
    detectedVendors: string[];
    consentSignals: string[];
  };
}

const SEV_TONE: Record<ShopifyFindingView['severity'], string> = {
  critical: 'border-rose-400/40 bg-rose-400/10 text-rose-200',
  high:     'border-rose-400/30 bg-rose-400/5 text-rose-300',
  medium:   'border-amber-400/30 bg-amber-400/5 text-amber-300',
  low:      'border-silver-500/30 bg-silver-500/5 text-silver-300',
};

export function ShopifyScanResultView({ result }: { result: ShopifyScanResultView }) {
  const scoreTone =
    result.score >= 80 ? 'text-emerald-300'
    : result.score >= 60 ? 'text-amber-300'
    : 'text-rose-300';

  return (
    <div className="space-y-6">
      {/* Score + summary */}
      <section className="border border-titanium-900 bg-obsidian-900/60 p-5">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-silver-400">
              Storefront Score
            </div>
            <div className={`font-display font-bold text-4xl tabular-nums ${scoreTone}`}>
              {result.score}<span className="text-base text-titanium-500">/100</span>
            </div>
          </div>
          <div className="text-right text-[10px] font-mono uppercase tracking-[0.18em] text-silver-500">
            {result.findings.length} Befunde
          </div>
        </div>
        <p className="text-sm text-titanium-300 leading-relaxed">{result.summary}</p>
      </section>

      {/* Detected vendors + consent signals */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <article className="border border-titanium-900 bg-obsidian-900/60 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-silver-400 mb-2">
            Erkannte Vendor-Signale
          </div>
          {result.evidence.detectedVendors.length === 0 ? (
            <p className="text-sm text-titanium-400">Keine bekannten Tracker-/Analytics-Vendoren im initialen HTML.</p>
          ) : (
            <ul className="text-sm text-titanium-200 space-y-1">
              {result.evidence.detectedVendors.map((v) => (
                <li key={v} className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-amber-300 shrink-0" />
                  {v}
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="border border-titanium-900 bg-obsidian-900/60 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-silver-400 mb-2">
            Erkannte Consent-Signale
          </div>
          {result.evidence.consentSignals.length === 0 ? (
            <p className="text-sm text-titanium-400">
              Kein bekanntes Consent-Gate erkannt. Wenn Tracker im HTML stehen, ist das ein <em>möglicher</em> Hinweis auf Pre-Consent-Tracking — endgültig nur per JS-Headless-Browser klärbar.
            </p>
          ) : (
            <ul className="text-sm text-titanium-200 space-y-1">
              {result.evidence.consentSignals.map((c) => (
                <li key={c} className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-emerald-300 shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      {/* Findings */}
      <section className="space-y-3">
        {result.findings.length === 0 && (
          <div className="border border-emerald-400/30 bg-emerald-400/5 p-5 text-sm text-emerald-200">
            Keine Befunde aus dem Storefront-HTML + Response-Headers. Eine JS-headless-Analyse + Web-Pixel-Audit kann tiefer gehen — für den Pilot reichen diese Signale.
          </div>
        )}
        {result.findings.map((f) => (
          <article
            key={f.id}
            className="border border-titanium-900 bg-obsidian-900/60 p-4"
          >
            <header className="flex items-start justify-between gap-3 mb-2">
              <h3 className="font-display font-semibold text-titanium-50 text-base leading-snug">
                {f.title}
              </h3>
              <span className={`font-mono text-[10px] uppercase tracking-[0.18em] border px-2 py-0.5 ${SEV_TONE[f.severity]}`}>
                {f.severity}
              </span>
            </header>
            <p className="text-sm text-titanium-300 leading-relaxed mb-3">{f.description}</p>
            <div className="border-t border-titanium-900 pt-2 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-1.5 gap-x-3 text-[11px]">
              {(f.evidence.url as string | undefined) && (
                <>
                  <span className="font-mono uppercase tracking-[0.18em] text-silver-500">url</span>
                  <span className="font-mono text-silver-300 break-all">{String(f.evidence.url)}</span>
                </>
              )}
              {(f.evidence.header as string | undefined) && (
                <>
                  <span className="font-mono uppercase tracking-[0.18em] text-silver-500">header</span>
                  <span className="font-mono text-silver-300">{String(f.evidence.header)}</span>
                </>
              )}
              <span className="font-mono uppercase tracking-[0.18em] text-silver-500">empfehlung</span>
              <span className="text-silver-200">{f.recommendation}</span>
            </div>
          </article>
        ))}
      </section>

      {/* CTAs */}
      <section className="border border-titanium-100/20 bg-titanium-100/5 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-sm text-titanium-300">
          <ShieldCheck className="inline h-4 w-4 text-amber-300 mr-1.5" />
          Drift-Alerts + Re-Scan nach Theme-/App-Änderungen sind im Growth-Plan enthalten.
        </div>
        <div className="flex gap-2">
          <Link
            to="/checkout/growth?source=shopify-scan"
            className="inline-flex items-center gap-2 px-4 py-2 surface-gold text-sm font-bold rounded-none whitespace-nowrap"
          >
            Growth aktivieren <ArrowRight className="h-3 w-3" />
          </Link>
          <Link
            to="/contact-sales?intent=agency-shopify"
            className="inline-flex items-center gap-2 px-4 py-2 border border-titanium-100/30 hover:border-amber-400 text-titanium-100 hover:text-amber-300 text-sm font-medium transition-colors whitespace-nowrap"
          >
            Agency anfragen
          </Link>
        </div>
      </section>

      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-silver-500 text-center">
        Technische Compliance-Analyse · Keine Rechtsberatung · Keine automatischen Änderungen am Store
      </p>
    </div>
  );
}
