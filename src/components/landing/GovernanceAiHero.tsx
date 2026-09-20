/**
 * Hero der Governance-AI-Vorschau.
 *
 * Linke Textspalte vor der Erde: Eyebrow, Wortmarke, Operating Loop, Lede,
 * Einstieg über den Audit-Funnel, Proof-Chips und die Trust-Rail der sechs
 * Policy Packs.
 *
 * ## Copy kommt ausschließlich aus `hero-content.ts`
 *
 * Kein Satz steht hier fest verdrahtet. FE-001 und das CTA-Gate
 * (`.github/workflows/cta-enforcement.yml`) lesen aus derselben Quelle — wer
 * hier Text einsetzt statt zu importieren, bricht beides.
 *
 * ## Was bewusst fehlt
 *
 * Der Prototyp trug über den CTAs eine „Seal-Line" („Letzter Nachweis
 * verankert vor n s · Chain-Height 1.284") und eine Kachel „99,9 % Uptime
 * SLA". Beides ist hier nicht übernommen: Ein anonymer Besucher hat keine
 * Chain, und ein SLA ist eine Vertragszusage an Enterprise-Kunden, keine
 * Eigenschaft der öffentlichen Seite (#1352). Laufende Beispielwerte zeigt
 * ausschließlich die Workspace-Vorschau — dort stehen sie unter
 * „DEMO · BEISPIELDATEN".
 */
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  GOVERNANCE_AI_HERO_HEADLINE,
  GOVERNANCE_AI_HERO_KICKER,
  GOVERNANCE_AI_HERO_MICRO,
  GOVERNANCE_AI_HERO_SUBLINE,
  HERO_PROOF_CHIPS,
  HERO_SCAN_CTA_LONG,
  HERO_SCAN_CTA_PROMISE,
  HERO_SCAN_PROMISE_LINE,
  HERO_DASHBOARD_CTA_LABEL,
} from '../governance-frontend/hero-content';
import { PUBLIC_CTA } from '../../config/public-nav';
import {
  GA_DISPLAY,
  GA_GOLD_LITE,
  GA_GREEN,
  GA_LINE,
  GA_LINE_SOFT,
  GA_MONO,
  GA_MUTED,
  GA_PILL_GHOST,
  GA_PILL_PRIMARY,
  GA_SILVER,
  GA_TEXT,
  GA_TITAN,
} from './governance-ai-theme';
import { POLICY_PACKS, POLICY_PACKS_NEXT, POLICY_PACK_COUNT } from './policy-packs';

/** Strukturelle Kennzahlen — Eigenschaften der Plattform, keine Messwerte. */
const FACTS: readonly (readonly [string, string])[] = [
  [String(POLICY_PACK_COUNT), 'POLICY PACKS'],
  ['EU', 'DATENRESIDENZ'],
  ['LAUFEND', 'NACHWEISFÜHRUNG'],
];

export function GovernanceAiHero() {
  const navigate = useNavigate();
  const [domain, setDomain] = useState('');

  const startScan = (event: FormEvent) => {
    event.preventDefault();
    const value = domain.trim();
    navigate(value ? `${PUBLIC_CTA.to}?domain=${encodeURIComponent(value)}` : PUBLIC_CTA.to);
  };

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-[1500px] items-center px-[4vw] pb-[clamp(40px,5vw,80px)] pt-[clamp(48px,7vw,108px)]">
      <div className="relative max-w-[760px]">
        {/* Leseplatte: hält den Textkontrast, ohne die Szene global abzudunkeln. */}
        <div
          className="pointer-events-none absolute -bottom-11 -left-[60px] -top-14 -right-[180px] -z-10"
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(94deg, rgba(0,0,0,.72) 0%, rgba(0,0,0,.6) 42%, rgba(0,0,0,.3) 66%, rgba(0,0,0,.08) 84%, transparent 100%)',
          }}
        />

        <p
          className="m-0 mb-6 inline-flex w-max max-w-full items-center gap-2.5 whitespace-nowrap rounded-full border px-4 py-2 text-[11px] tracking-[.2em]"
          style={{
            fontFamily: GA_MONO,
            borderColor: 'var(--ga-accent-border)',
            backgroundColor: 'var(--ga-chip-face)',
            color: 'var(--ga-accent)',
          }}
        >
          <span
            className="h-[5px] w-[5px] shrink-0 rounded-full"
            style={{ backgroundColor: GA_GREEN }}
            aria-hidden="true"
          />
          {GOVERNANCE_AI_HERO_KICKER}
        </p>

        <h1
          className="m-0 max-w-[22ch] text-balance"
          style={{
            fontFamily: GA_DISPLAY,
            fontWeight: 'var(--ga-h1-weight)' as unknown as number,
            fontSize: 'var(--ga-h1-scale)',
            letterSpacing: 'var(--ga-h1-tracking)',
            lineHeight: 1.02,
            backgroundImage: 'var(--ga-h1-face)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            filter: 'drop-shadow(0 6px 18px rgba(0,0,0,.55))',
          }}
        >
          {GOVERNANCE_AI_HERO_HEADLINE.map((segments, line) => (
            <span key={segments.map((s) => s.text).join('')} className="block">
              {line > 0 && ' '}
              {segments.map((segment) =>
                segment.accent ? (
                  <em
                    key={segment.text}
                    className="not-italic"
                    style={{
                      backgroundImage: 'var(--ga-h1-accent)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      color: 'transparent',
                    }}
                  >
                    {segment.text}
                  </em>
                ) : (
                  <span key={segment.text}>{segment.text}</span>
                ),
              )}
            </span>
          ))}
        </h1>

        <p
          className="mt-7 max-w-[42rem] text-pretty text-[clamp(1.05rem,.95rem+.45vw,1.3rem)] leading-[1.58] tracking-[-.01em]"
          style={{ color: GA_MUTED }}
        >
          {GOVERNANCE_AI_HERO_SUBLINE}
        </p>

        <p
          className="mt-4 max-w-[42rem] text-[11px] font-medium uppercase tracking-[.2em]"
          style={{ fontFamily: GA_MONO, color: 'var(--ga-accent)' }}
        >
          {GOVERNANCE_AI_HERO_MICRO}
        </p>

        <div className="mt-[34px] flex flex-wrap gap-3.5">
          <Link
            to={PUBLIC_CTA.to}
            className={`${GA_PILL_PRIMARY} ga-pill-sheen`}
            style={{
              fontFamily: GA_DISPLAY,
              backgroundImage: 'var(--ga-pill-face)',
              color: 'var(--ga-pill-ink)',
              boxShadow: 'var(--ga-pill-shadow)',
            }}
          >
            {HERO_SCAN_CTA_LONG}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link to="/app/dashboard" className={GA_PILL_GHOST} style={{ fontFamily: GA_DISPLAY }}>
            {HERO_DASHBOARD_CTA_LABEL}
          </Link>
        </div>

        <form
          onSubmit={startScan}
          className="ga-glass mt-5 flex max-w-[620px] flex-wrap gap-2 p-2"
          aria-label={HERO_SCAN_PROMISE_LINE}
        >
          <input
            type="text"
            inputMode="url"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder={HERO_SCAN_PROMISE_LINE}
            aria-label={HERO_SCAN_PROMISE_LINE}
            className="min-w-0 flex-1 basis-[220px] border-0 bg-transparent px-4 py-3 text-[14px] outline-none"
            style={{ color: GA_TEXT }}
          />
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14px] font-semibold transition hover:brightness-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ga-accent-lite)]"
            style={{
              fontFamily: GA_DISPLAY,
              backgroundImage: 'var(--ga-pill-face)',
              color: 'var(--ga-pill-ink)',
              boxShadow: 'var(--ga-pill-shadow)',
            }}
          >
            {PUBLIC_CTA.shortLabel}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </form>

        <p className="mt-2 max-w-[620px] text-[11px] leading-[1.6]" style={{ color: GA_TITAN }}>
          {HERO_SCAN_CTA_PROMISE}
        </p>

        <div className="mt-[30px] flex flex-wrap gap-2.5">
          {HERO_PROOF_CHIPS.map((chip) => (
            <span
              key={chip}
              className="flex items-center gap-2.5 whitespace-nowrap rounded-full border px-3.5 py-[7px] text-[11px] tracking-[.1em] backdrop-blur-[6px]"
              style={{
                fontFamily: GA_MONO,
                borderColor: GA_LINE_SOFT,
                backgroundColor: 'var(--ga-chip-face)',
                color: GA_MUTED,
              }}
            >
              <span
                className="h-[5px] w-[5px] shrink-0 rounded-full"
                style={{ backgroundColor: GA_GREEN }}
                aria-hidden="true"
              />
              {chip}
            </span>
          ))}
        </div>

        <div
          className="mt-7 grid grid-cols-3 gap-px border"
          style={{ borderColor: GA_LINE, backgroundColor: GA_LINE_SOFT }}
        >
          {FACTS.map(([value, label]) => (
            <div key={label} className="px-4 py-3.5" style={{ backgroundColor: 'rgba(0,0,0,.72)' }}>
              <b
                className="block text-[30px] font-normal tracking-[-.02em]"
                style={{ fontFamily: GA_DISPLAY, color: GA_SILVER }}
              >
                {value}
              </b>
              <span
                className="text-[11px] tracking-[.14em]"
                style={{ fontFamily: GA_MONO, color: GA_TITAN }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-[34px] border-t pt-[22px]" style={{ borderColor: GA_LINE_SOFT }}>
          <p
            className="m-0 mb-3 text-[11px] tracking-[.18em]"
            style={{ fontFamily: GA_MONO, color: GA_TITAN }}
          >
            {POLICY_PACK_COUNT === 6 ? 'SECHS' : POLICY_PACK_COUNT} POLICY PACKS · EIN PRÜFPFAD
          </p>
          <div className="flex flex-wrap gap-2">
            {POLICY_PACKS.map((pack) => (
              <span
                key={pack.code}
                className={`whitespace-nowrap rounded border px-3 py-[7px] text-[11px] uppercase tracking-[.14em] ${
                  pack.next ? 'border-dashed' : ''
                }`}
                style={{
                  fontFamily: GA_MONO,
                  borderColor: pack.next ? GA_LINE_SOFT : GA_LINE,
                  backgroundColor: pack.next ? 'transparent' : 'rgba(0,0,0,.55)',
                  color: pack.next ? GA_TITAN : GA_SILVER,
                }}
                title={pack.next ? 'Angekündigt — noch nicht verfügbar' : undefined}
              >
                {pack.label}
              </span>
            ))}
          </div>
          {POLICY_PACKS_NEXT.length > 0 && (
            <p
              className="mt-2.5 text-[11px] uppercase"
              style={{ fontFamily: GA_MONO, color: GA_GOLD_LITE }}
            >
              {POLICY_PACKS_NEXT.map((pack) => pack.label).join(' · ')} — Coming Soon
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
