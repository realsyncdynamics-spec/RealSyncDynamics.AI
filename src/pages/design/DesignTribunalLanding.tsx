/**
 * Tribunal — design preview at `/design/tribunal`.
 *
 * Light paper OS: parchment ground, ink type, one burgundy seal.
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

const PAPER = '#f4efe6';
const INK = '#121212';
const SEAL = '#6b1d2a';
const MUTED = '#4a4540';
const LINE = 'rgba(18,18,18,0.14)';
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";
const SANS = "'Inter', system-ui, sans-serif";
const MONO = "'DM Mono', 'JetBrains Mono', ui-monospace, monospace";

const NAV = [
  { label: 'Runtime', to: '/governance-runtime' },
  { label: 'AI', to: '/ai-act' },
  { label: 'Privacy', to: '/audit' },
  { label: 'Agents', to: '/agents' },
  { label: 'Evidence', to: '/evidence' },
  { label: 'Preise', to: '/pricing' },
  { label: 'Kontakt', to: '/kontakt' },
  { label: 'Login', to: '/welcome' },
] as const;

export function DesignTribunalLanding() {
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
      style={{
        backgroundColor: PAPER,
        color: INK,
        fontFamily: SANS,
        backgroundImage:
          'radial-gradient(ellipse at 12% 0%, rgba(107,29,42,0.05), transparent 42%), linear-gradient(180deg, #f7f3ec 0%, #f4efe6 48%, #efe8dc 100%)',
      }}
    >
      <SEOHead
        title="Tribunal (Preview) — RealSyncDynamics.AI"
        description={`${CONTINUOUS_COMPLIANCE_NARRATIVE} Design-Preview.`}
        canonical="/design/tribunal"
        noIndex
      />

      <header className="border-b" style={{ borderColor: LINE }}>
        <div className="mx-auto flex max-w-[980px] flex-wrap items-center gap-4 px-[5vw] py-5">
          <Link to="/" className="flex items-center gap-2.5" style={{ color: INK }}>
            <span
              aria-hidden
              className="inline-flex h-7 w-7 items-center justify-center text-[11px] font-semibold tracking-[.08em]"
              style={{
                fontFamily: MONO,
                backgroundColor: SEAL,
                color: PAPER,
              }}
            >
              RS
            </span>
            <span className="text-[14px] font-medium tracking-tight">
              RealSync Dynamics.AI
            </span>
          </Link>
          <span
            className="border px-2 py-0.5 text-[9px] tracking-[.16em]"
            style={{ fontFamily: MONO, borderColor: `${SEAL}55`, color: SEAL }}
          >
            {STATUS_LABEL.preview.toUpperCase()}
          </span>
          <nav
            aria-label="Hauptnavigation"
            className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2"
          >
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-[12px] transition hover:opacity-80"
                style={{ color: MUTED }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[780px] px-[5vw] pb-24 pt-16 lg:pt-24">
        <p
          className="text-[10px] tracking-[.22em]"
          style={{ fontFamily: MONO, color: SEAL }}
        >
          AI GOVERNANCE OPERATING SYSTEM · {STATUS_LABEL.preview.toUpperCase()}
        </p>
        <p className="mt-4 text-[13px] leading-relaxed" style={{ color: MUTED }}>
          {HERO_EN_KICKER}
        </p>

        <h1
          className="mt-8 max-w-[18ch] leading-[1.08] tracking-[-.02em]"
          style={{
            fontFamily: SERIF,
            fontWeight: 600,
            fontSize: 'clamp(2.25rem, 1.4rem + 3.8vw, 3.75rem)',
            color: INK,
          }}
        >
          {HERO_HEADLINE.map((segments, line) => (
            <span key={line} className="block">
              {segments.map((segment) => segment.text).join('')}
            </span>
          ))}
        </h1>

        <p
          className="mt-6 text-[11px] tracking-[.12em]"
          style={{ fontFamily: MONO, color: MUTED }}
        >
          {HERO_OPERATING_LOOP}
        </p>

        <p className="mt-8 max-w-[34rem] text-[17px] font-medium leading-[1.55]">
          {SCAN_FUNNEL_MESSAGE}
        </p>
        <p className="mt-4 max-w-[36rem] text-[16px] leading-[1.65]" style={{ color: MUTED }}>
          {HERO_SUBLINE}
        </p>

        <ul className="mt-10 max-w-[36rem] space-y-3">
          {HERO_OUTCOMES.map((outcome) => (
            <li key={outcome} className="flex gap-3 text-[15px] leading-snug" style={{ color: MUTED }}>
              <span style={{ color: SEAL }} aria-hidden>
                —
              </span>
              <span>{outcome}</span>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-[12px]" style={{ fontFamily: MONO, color: MUTED }}>
          {HERO_EU_LINE}
        </p>

        <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Link
            to="/audit"
            className="inline-flex items-center justify-center px-7 py-3.5 text-[14px] font-semibold transition hover:opacity-92"
            style={{ backgroundColor: INK, color: PAPER }}
          >
            {HERO_SCAN_CTA_LONG}
          </Link>
          <Link
            to="/contact-sales?source=design-tribunal&intent=enterprise"
            className="inline-flex items-center justify-center border px-7 py-3.5 text-[14px] font-medium transition hover:bg-black/[0.03]"
            style={{ borderColor: INK, color: INK }}
          >
            {CTA.enterprise}
          </Link>
        </div>

        <form onSubmit={startScan} className="mt-14 max-w-[520px]">
          <p className="mb-3 text-[15px]">{HERO_SCAN_PROMISE_LINE}</p>
          <label className="sr-only" htmlFor="tribunal-domain">
            Domain
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <input
              id="tribunal-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              type="url"
              placeholder="Ihre Website"
              className="min-w-0 flex-1 border bg-transparent px-4 py-3 text-[15px] outline-none"
              style={{ borderColor: LINE, color: INK }}
            />
            <button
              type="submit"
              className="px-5 py-3 text-[13px] font-semibold"
              style={{ backgroundColor: INK, color: PAPER }}
            >
              Scan →
            </button>
          </div>
          <p className="mt-3 text-[13px]" style={{ color: MUTED }}>
            {HERO_SCAN_CTA_PROMISE}
          </p>
          <p className="mt-2 text-[11px] tracking-[.04em]" style={{ fontFamily: MONO, color: MUTED }}>
            Funnel: /audit?domain= · Preise €79 / €249 / €699
          </p>
        </form>

        <p className="mt-16 max-w-[36rem] text-[14px] leading-relaxed" style={{ color: MUTED }}>
          {CONTINUOUS_COMPLIANCE_NARRATIVE} Diese Fläche ist ein Design-Preview und ersetzt
          nicht die Live-Startseite.
        </p>
      </main>

      <footer
        className="border-t px-[5vw] py-8 text-[12px]"
        style={{ borderColor: LINE, color: MUTED }}
      >
        <div className="mx-auto flex max-w-[980px] flex-col gap-3 sm:flex-row sm:justify-between">
          <span>© 2026 RealSync Dynamics.AI · Design Preview</span>
          <nav className="flex flex-wrap gap-x-4 gap-y-2">
            <Link to="/">Live Landing</Link>
            <Link to="/design/ledger">Evidence Ledger Preview</Link>
            <Link to="/impressum">Impressum</Link>
            <Link to="/datenschutz">Datenschutz</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
