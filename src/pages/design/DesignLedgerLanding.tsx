/**
 * Evidence Ledger — design preview at `/design/ledger`.
 *
 * Steel-black chrome, ice type, single institutional blue accent.
 * Not live `/`. Honest Preview. Same DE copy + `/audit` acquisition funnel.
 */
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { CTA } from '../../content/runtimeVocab';
import {
  CONTINUOUS_COMPLIANCE_NARRATIVE,
  HERO_EN_KICKER,
  HERO_EU_LINE,
  HERO_HEADLINE,
  HERO_OPERATING_LOOP,
  HERO_OUTCOMES,
  HERO_SCAN_CTA_LONG,
  HERO_SCAN_CTA_PROMISE,
  HERO_SCAN_PROMISE_LINE,
  HERO_SUBLINE,
  SCAN_FUNNEL_MESSAGE,
} from '../../components/governance-frontend/hero-content';
import { STATUS_LABEL } from '../../product/implementation-status';

const BG = '#0a0c10';
const ICE = '#f4f7fb';
const MUTED = '#9aa3b2';
const BLUE = '#2f5fa8';
const PANEL = '#10141c';
const LINE = 'rgba(244,247,251,0.12)';
const MONO = "'DM Mono', 'JetBrains Mono', ui-monospace, monospace";
const SANS = "'Inter', system-ui, sans-serif";

const COMMAND_NAV = [
  { label: 'Runtime', to: '/governance-runtime' },
  { label: 'AI', to: '/ai-act' },
  { label: 'Privacy', to: '/audit' },
  { label: 'Agents', to: '/agents' },
  { label: 'Evidence', to: '/evidence' },
] as const;

/** Structural evidence stages — no fake KPIs or timestamps. */
const EVIDENCE_STAGES = [
  'Detect — Systeme und Schattennutzung erfassen',
  'Analyze — Risiken und Kontrolllücken bewerten',
  'Govern — Policies als ausführbare Kontrollen',
  'Remediate — Massnahmen mit Freigabe führen',
  'Evidence — Nachweise laufend erzeugen',
  'Monitor — Drift und Wiederholung beobachten',
] as const;

export function DesignLedgerLanding() {
  const navigate = useNavigate();
  const [domain, setDomain] = useState('');

  const startScan = (event: FormEvent) => {
    event.preventDefault();
    const value = domain.trim();
    navigate(value ? `/audit?domain=${encodeURIComponent(value)}` : '/audit');
  };

  return (
    <div
      className="min-h-screen antialiased"
      style={{ backgroundColor: BG, color: ICE, fontFamily: SANS }}
    >
      <SEOHead
        title="Evidence Ledger (Preview) — RealSyncDynamics.AI"
        description={`${CONTINUOUS_COMPLIANCE_NARRATIVE} Design-Preview.`}
        canonical="/design/ledger"
        noIndex
      />

      <header className="border-b" style={{ borderColor: LINE }}>
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-4 px-[4vw] py-4">
          <Link to="/" className="text-[14px] font-medium tracking-tight" style={{ color: ICE }}>
            RealSync Dynamics<span style={{ color: BLUE }}>.AI</span>
          </Link>
          <span
            className="rounded-sm border px-2 py-0.5 text-[9px] tracking-[.16em]"
            style={{ fontFamily: MONO, borderColor: `${BLUE}66`, color: BLUE }}
          >
            {STATUS_LABEL.preview.toUpperCase()}
          </span>
          <nav
            aria-label="Command bar"
            className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2"
          >
            {COMMAND_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-[11px] tracking-[.08em] transition hover:opacity-90"
                style={{ fontFamily: MONO, color: MUTED }}
              >
                {item.label}
              </Link>
            ))}
            <Link to="/pricing" className="text-[11px]" style={{ color: MUTED }}>
              Preise
            </Link>
            <Link to="/kontakt" className="text-[11px]" style={{ color: MUTED }}>
              Kontakt
            </Link>
            <Link to="/welcome" className="text-[11px]" style={{ color: ICE }}>
              Login
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1200px] gap-10 px-[4vw] py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-16">
        <section>
          <p
            className="text-[10px] tracking-[.2em]"
            style={{ fontFamily: MONO, color: BLUE }}
          >
            AI GOVERNANCE OPERATING SYSTEM · {STATUS_LABEL.preview.toUpperCase()}
          </p>
          <p className="mt-3 text-[12px] tracking-[.06em]" style={{ fontFamily: MONO, color: MUTED }}>
            {HERO_EN_KICKER}
          </p>
          <h1
            className="mt-5 max-w-[22ch] text-[clamp(1.85rem,1.2rem+2.8vw,2.85rem)] font-semibold leading-[1.12] tracking-[-.02em]"
          >
            {HERO_HEADLINE.map((segments, line) => (
              <span key={line} className="block">
                {segments.map((segment, i) => (
                  <span key={i} style={{ color: segment.accent ? BLUE : ICE }}>
                    {segment.text}
                  </span>
                ))}
              </span>
            ))}
          </h1>
          <p className="mt-4 text-[12px] tracking-[.1em]" style={{ fontFamily: MONO, color: MUTED }}>
            {HERO_OPERATING_LOOP}
          </p>
          <p className="mt-4 max-w-[36rem] text-[15px] font-medium leading-relaxed" style={{ color: ICE }}>
            {SCAN_FUNNEL_MESSAGE}
          </p>
          <p className="mt-3 max-w-[36rem] text-[15px] leading-relaxed" style={{ color: MUTED }}>
            {HERO_SUBLINE}
          </p>
          <ul className="mt-6 space-y-2.5">
            {HERO_OUTCOMES.map((outcome) => (
              <li key={outcome} className="flex gap-2.5 text-[14px] leading-snug" style={{ color: MUTED }}>
                <span style={{ color: BLUE }} aria-hidden>
                  —
                </span>
                <span>{outcome}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[11px]" style={{ fontFamily: MONO, color: MUTED }}>
            {HERO_EU_LINE}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/audit"
              className="inline-flex items-center justify-center px-6 py-3 text-[13px] font-semibold transition hover:brightness-110"
              style={{ backgroundColor: ICE, color: BG }}
            >
              {HERO_SCAN_CTA_LONG}
            </Link>
            <Link
              to="/contact-sales?source=design-ledger&intent=enterprise"
              className="text-[13px] underline underline-offset-4"
              style={{ color: MUTED }}
            >
              {CTA.enterprise}
            </Link>
          </div>

          <form onSubmit={startScan} className="mt-10 max-w-[520px]">
            <p className="mb-2 text-[13px]" style={{ color: ICE }}>
              {HERO_SCAN_PROMISE_LINE}
            </p>
            <label className="sr-only" htmlFor="ledger-domain">
              Domain
            </label>
            <div
              className="flex flex-col border sm:flex-row"
              style={{ borderColor: LINE, backgroundColor: PANEL, fontFamily: MONO }}
            >
              <span
                className="hidden items-center border-r px-3 text-[11px] sm:inline-flex"
                style={{ borderColor: LINE, color: BLUE }}
                aria-hidden
              >
                $ scan
              </span>
              <input
                id="ledger-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                type="url"
                placeholder="domain.example"
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[13px] outline-none placeholder:opacity-50"
                style={{ color: ICE }}
              />
              <button
                type="submit"
                className="border-t px-4 py-3 text-[11px] tracking-[.08em] transition hover:bg-white/5 sm:border-l sm:border-t-0"
                style={{ borderColor: LINE, color: BLUE }}
              >
                RUN →
              </button>
            </div>
            <p className="mt-2 text-[11px]" style={{ color: MUTED }}>
              {HERO_SCAN_CTA_PROMISE}
            </p>
            <p className="mt-1 text-[10px] tracking-[.06em]" style={{ fontFamily: MONO, color: MUTED }}>
              → /audit?domain= · Acquisition · Produkt = Activation + OS
            </p>
          </form>
        </section>

        <aside
          className="border p-6 lg:p-7"
          style={{ borderColor: LINE, backgroundColor: PANEL }}
          aria-label="Evidence timeline preview"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] tracking-[.18em]" style={{ fontFamily: MONO, color: BLUE }}>
              EVIDENCE TIMELINE
            </p>
            <span
              className="border px-2 py-0.5 text-[9px] tracking-[.14em]"
              style={{ fontFamily: MONO, borderColor: `${BLUE}66`, color: BLUE }}
            >
              {STATUS_LABEL.preview.toUpperCase()}
            </span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed" style={{ color: MUTED }}>
            Strukturelle Nachweisschritte — keine erfundenen KPIs, Scores oder Zeitstempel.
            Live-Daten entstehen nach Scan und Activation.
          </p>
          <ol className="mt-6 space-y-0 border-l" style={{ borderColor: `${BLUE}55` }}>
            {EVIDENCE_STAGES.map((stage, index) => (
              <li key={stage} className="relative pl-5 py-3">
                <span
                  className="absolute left-[-4px] top-4 h-2 w-2 rounded-full"
                  style={{ backgroundColor: index === 0 ? BLUE : MUTED }}
                  aria-hidden
                />
                <p className="text-[13px] leading-snug" style={{ color: ICE }}>
                  {stage}
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-[11px]" style={{ fontFamily: MONO, color: MUTED }}>
            Preise unverändert · Starter €79 · Growth €249 · Agency €699
          </p>
          <Link
            to="/pricing"
            className="mt-2 inline-block text-[12px] underline underline-offset-4"
            style={{ color: BLUE }}
          >
            Preise öffnen
          </Link>
        </aside>
      </main>

      <footer
        className="border-t px-[4vw] py-6 text-[11px]"
        style={{ borderColor: LINE, color: MUTED }}
      >
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 RealSync Dynamics.AI · Design Preview (nicht Live-/)</span>
          <nav className="flex flex-wrap gap-x-3 gap-y-2">
            <Link to="/">Live Landing</Link>
            <Link to="/design/tribunal">Tribunal Preview</Link>
            <Link to="/impressum">Impressum</Link>
            <Link to="/datenschutz">Datenschutz</Link>
            <Link to="/kontakt">Kontakt</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
