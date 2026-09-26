/**
 * Startseite `/` — Folgesektionen nach dem Hero (Positionierung 2026-09-26).
 *
 * Funnel: Problem → Governance-Modell → Governance-Check → Agent Governance
 * → Provider-Neutralität → Evidence → Prinzipien → Zielgruppen. Inhalte
 * stehen in `hero-content.ts`; hier nur Darstellung.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  HOMEPAGE_AGENT_PRINCIPLES,
  HOMEPAGE_AUDIENCES,
  HOMEPAGE_AUTHORITY_CHAIN,
  HOMEPAGE_EVIDENCE_FLOW,
  HOMEPAGE_GOVERNANCE_STAGES,
  HOMEPAGE_PROBLEM_PAINS,
  HOMEPAGE_PROVIDERS,
  HOMEPAGE_TRUST_PRINCIPLES,
  type HomepageStageStatus,
} from '../governance-frontend/hero-content';
import { SectionEyebrow, SectionHeading } from './GovernanceSectionChrome';
import { GovernanceSelfCheck } from './GovernanceSelfCheck';
import {
  GA_LINE_SOFT,
  GA_MONO,
  GA_MUTED,
  GA_SANS,
  GA_SILVER,
} from './governance-ai-theme';

const SECTION = 'ga-band relative z-[1] border-t px-[4vw] py-[clamp(56px,6vw,88px)]';
const CARD_FACE = { borderColor: GA_LINE_SOFT, backgroundColor: 'rgba(255,255,255,0.03)' };
const ACCENT_FACE = { borderColor: 'var(--ga-accent-border)', backgroundColor: 'rgba(0,184,212,0.06)' };

function StatusTag({ status }: { status: HomepageStageStatus }) {
  const live = status === 'live';
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-[3px] text-[10px] uppercase tracking-[0.14em]"
      style={{
        fontFamily: GA_MONO,
        borderColor: live ? 'rgba(16,185,129,0.45)' : 'var(--ga-line)',
        color: live ? 'var(--ga-green)' : GA_SILVER,
      }}
    >
      {live ? 'Live' : 'Preview'}
    </span>
  );
}

function Lede({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 max-w-[44rem] text-pretty leading-[1.7]" style={{ color: GA_MUTED, fontFamily: GA_SANS }}>
      {children}
    </p>
  );
}

export function HomepageBriefSections() {
  return (
    <>
      <section id="problem" className={SECTION} style={{ borderColor: GA_LINE_SOFT }} aria-labelledby="problem-heading">
        <div className="mx-auto w-full max-w-[1100px]">
          <SectionEyebrow>DAS PROBLEM</SectionEyebrow>
          <span id="problem-heading">
            <SectionHeading accent="als Ihre Kontrolle darüber.">KI wächst schneller</SectionHeading>
          </span>
          <Lede>Erkennen Sie sich wieder? Die meisten Unternehmen sind längst mitten im KI-Betrieb — nur ohne gemeinsame Regeln.</Lede>
          <ul className="mt-10 grid gap-px border sm:grid-cols-2" style={{ borderColor: GA_LINE_SOFT, backgroundColor: GA_LINE_SOFT }}>
            {HOMEPAGE_PROBLEM_PAINS.map((pain, i) => (
              <li key={pain} className="flex gap-4 p-5" style={{ backgroundColor: 'var(--ga-void)' }}>
                <span className="pt-[2px] text-[11px] tracking-[0.14em]" style={{ fontFamily: GA_MONO, color: 'var(--ga-accent)' }} aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[0.98rem] leading-[1.6]" style={{ color: 'var(--ga-text)', fontFamily: GA_SANS }}>
                  {pain}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="governance-model" className={SECTION} style={{ borderColor: GA_LINE_SOFT }} aria-labelledby="model-heading">
        <div className="mx-auto w-full max-w-[1100px]">
          <SectionEyebrow>DAS GOVERNANCE-MODELL</SectionEyebrow>
          <span id="model-heading">
            <SectionHeading accent="eine Kontrollschicht.">Viele KI-Systeme,</SectionHeading>
          </span>
          <Lede>
            Erkennen Sie eingesetzte KI-Systeme, bewerten Sie Risiken, definieren Sie verbindliche Regeln und
            dokumentieren Sie Entscheidungen und Ausführungen nachvollziehbar — über Anbieter und Agenten hinweg.
          </Lede>
          <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {HOMEPAGE_GOVERNANCE_STAGES.map((stage, i) => (
              <li key={stage.id} className="ga-card flex flex-col rounded-2xl border p-5" style={CARD_FACE}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] tracking-[0.16em]" style={{ fontFamily: GA_MONO, color: 'var(--ga-accent)' }}>
                    {String(i + 1).padStart(2, '0')} · {stage.step}
                  </p>
                  <StatusTag status={stage.status} />
                </div>
                <h3 className="mt-3 text-[1.02rem] font-semibold leading-[1.35]" style={{ color: 'var(--ga-text)', fontFamily: GA_SANS }}>
                  {stage.title}
                </h3>
                <p className="mt-2 text-[0.92rem] leading-[1.6]" style={{ color: GA_MUTED }}>
                  {stage.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <GovernanceSelfCheck />

      <section id="agent-governance" className={SECTION} style={{ borderColor: GA_LINE_SOFT }} aria-labelledby="agents-heading">
        <div className="mx-auto grid w-full max-w-[1100px] gap-12 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <SectionEyebrow>AGENT GOVERNANCE</SectionEyebrow>
            <span id="agents-heading">
              <SectionHeading accent="Aber nicht unkontrolliert.">KI-Agenten dürfen arbeiten.</SectionHeading>
            </span>
            <Lede>
              Jede Aktion eines Agenten durchläuft dieselbe Kette — bevor ein Provider etwas ausführt. Identitätsprüfung,
              Tenant-Zuordnung, Policy-Entscheidung, Freigaben und Nachweiskette laufen serverseitig; die durchgängige
              Agent-Runtime ist als Preview verfügbar.
            </Lede>
            <ul className="mt-8 space-y-3">
              {HOMEPAGE_AGENT_PRINCIPLES.map((principle) => (
                <li key={principle} className="flex gap-3 border-l-2 pl-4 text-[0.98rem] leading-[1.6]" style={{ borderColor: 'var(--ga-accent)', color: 'var(--ga-text)', fontFamily: GA_SANS }}>
                  {principle}
                </li>
              ))}
            </ul>
            <Link
              to="/agent-governance"
              className="mt-8 inline-flex items-center gap-2 text-[0.95rem] font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ga-accent-lite)]"
              style={{ color: 'var(--ga-accent-lite)', fontFamily: GA_SANS }}
            >
              Governance-Modell für Agenten im Detail
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.16em]" style={{ fontFamily: GA_MONO, color: GA_SILVER }}>
                Authority Chain
              </p>
              <StatusTag status="preview" />
            </div>
            <ol className="border" style={{ borderColor: GA_LINE_SOFT }} aria-label="Authority Chain einer Agenten-Aktion">
              {HOMEPAGE_AUTHORITY_CHAIN.map((link, i) => (
                <li
                  key={link.step}
                  className="grid grid-cols-[2.2rem_7.5rem_1fr] items-baseline gap-3 border-b px-4 py-3 last:border-b-0"
                  style={{
                    borderColor: GA_LINE_SOFT,
                    borderStyle: link.conditional ? 'dashed' : 'solid',
                    backgroundColor: link.step === 'Execution' ? 'rgba(255,255,255,0.03)' : 'transparent',
                  }}
                >
                  <span className="text-[11px]" style={{ fontFamily: GA_MONO, color: 'var(--ga-accent)' }} aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[0.85rem] font-medium" style={{ fontFamily: GA_MONO, color: 'var(--ga-text)' }}>
                    {link.step}
                    {link.conditional ? <span style={{ color: GA_SILVER }}> *</span> : null}
                  </span>
                  <span className="text-[0.88rem] leading-[1.5]" style={{ color: GA_MUTED }}>
                    {link.body}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[0.8rem]" style={{ color: GA_SILVER }}>
              * nur wenn die Policy eine menschliche Freigabe verlangt.
            </p>
          </div>
        </div>
      </section>

      <section id="providers" className={SECTION} style={{ borderColor: GA_LINE_SOFT }} aria-labelledby="providers-heading">
        <div className="mx-auto w-full max-w-[1100px]">
          <SectionEyebrow>PROVIDER-NEUTRAL</SectionEyebrow>
          <span id="providers-heading">
            <SectionHeading accent="über Ihren AI-Providern.">Ein Governance Layer</SectionHeading>
          </span>
          <Lede>Modelle liefern Intelligence. RealSyncDynamics.AI definiert die Governance.</Lede>

          <div className="mt-10">
            <div className="border p-5 sm:p-6" style={ACCENT_FACE}>
              <p className="text-[11px] uppercase tracking-[0.16em]" style={{ fontFamily: GA_MONO, color: 'var(--ga-accent)' }}>
                Policy Authority
              </p>
              <p className="mt-2 text-[1.05rem] font-semibold" style={{ color: 'var(--ga-text)', fontFamily: GA_SANS }}>
                RealSyncDynamics.AI — Identity · Tenant · Policy · Approval · Evidence
              </p>
              <p className="mt-1 text-[0.9rem]" style={{ color: GA_MUTED }}>
                Entscheidet, ob eine Anfrage einen Provider erreichen darf — und dokumentiert das Ergebnis.
              </p>
            </div>
            <div className="mx-auto h-8 w-px" style={{ backgroundColor: 'var(--ga-accent-border)' }} aria-hidden="true" />
            <div className="border p-5 sm:p-6" style={CARD_FACE}>
              <p className="text-[11px] uppercase tracking-[0.16em]" style={{ fontFamily: GA_MONO, color: GA_SILVER }}>
                Intelligence- &amp; Execution-Provider · keine Policy Authority
              </p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {HOMEPAGE_PROVIDERS.map((provider) => (
                  <li key={provider.name} className="border px-4 py-3" style={{ borderColor: GA_LINE_SOFT }}>
                    <span className="block text-[0.95rem] font-medium" style={{ color: 'var(--ga-text)', fontFamily: GA_SANS }}>
                      {provider.name}
                    </span>
                    <span className="mt-1 block text-[11px] uppercase tracking-[0.12em]" style={{ fontFamily: GA_MONO, color: GA_SILVER }}>
                      {provider.note}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[0.85rem]" style={{ color: GA_MUTED }}>
                Weitere Provider auf Anfrage. Modellaufrufe über das AI Gateway werden protokolliert — Provider-Antworten verändern nie die geltenden Regeln.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="evidence" className={SECTION} style={{ borderColor: GA_LINE_SOFT }} aria-labelledby="evidence-heading">
        <div className="mx-auto w-full max-w-[1100px]">
          <SectionEyebrow>EVIDENCE</SectionEyebrow>
          <span id="evidence-heading">
            <SectionHeading accent="was tatsächlich passiert ist.">Nachweisen,</SectionHeading>
          </span>
          <Lede>
            Entscheidungen, Freigaben und Ausführungen lassen sich in einer SHA-256-verketteten Nachweiskette
            dokumentieren — für interne Reviews und externe Prüfungen, exportierbar statt kurz vor dem Audit
            zusammengesucht.
          </Lede>
          <ol className="mt-10 flex flex-wrap items-center gap-2 sm:gap-3" aria-label="Evidence Flow">
            {HOMEPAGE_EVIDENCE_FLOW.map((step, i) => (
              <li key={step} className="flex items-center gap-2 sm:gap-3">
                <span
                  className="rounded-full border px-4 py-2 text-[0.85rem] font-medium"
                  style={{ fontFamily: GA_MONO, color: 'var(--ga-text)', ...ACCENT_FACE }}
                >
                  {step}
                </span>
                {i < HOMEPAGE_EVIDENCE_FLOW.length - 1 ? (
                  <span aria-hidden="true" style={{ color: GA_SILVER }}>
                    →
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
          <Link
            to="/evidence-vault"
            className="mt-8 inline-flex items-center gap-2 text-[0.95rem] font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ga-accent-lite)]"
            style={{ color: 'var(--ga-accent-lite)', fontFamily: GA_SANS }}
          >
            So funktioniert der Evidence Vault
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section id="principles" className={SECTION} style={{ borderColor: GA_LINE_SOFT }} aria-labelledby="principles-heading">
        <div className="mx-auto w-full max-w-[1100px]">
          <SectionEyebrow>VERTRAUEN</SectionEyebrow>
          <span id="principles-heading">
            <SectionHeading accent="statt Siegel.">Technische Prinzipien</SectionHeading>
          </span>
          <Lede>
            Keine Zertifikats-Logos, sondern nachprüfbare Architektur. RealSyncDynamics.AI unterstützt Ihre technischen und
            organisatorischen Kontrollen — die rechtliche Bewertung bleibt bei Ihnen.
          </Lede>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HOMEPAGE_TRUST_PRINCIPLES.map((item) => (
              <li key={item.title} className="ga-card rounded-2xl border p-5" style={CARD_FACE}>
                <h3 className="text-[1rem] font-semibold" style={{ color: 'var(--ga-text)', fontFamily: GA_SANS }}>
                  {item.title}
                </h3>
                <p className="mt-2 text-[0.92rem] leading-[1.6]" style={{ color: GA_MUTED }}>
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="audiences" className={SECTION} style={{ borderColor: GA_LINE_SOFT }} aria-labelledby="audiences-heading">
        <div className="mx-auto w-full max-w-[1100px]">
          <SectionEyebrow>FÜR WEN</SectionEyebrow>
          <span id="audiences-heading">
            <SectionHeading accent="und ersten Agenten.">Für Teams mit mehreren KI-Systemen</SectionHeading>
          </span>
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {HOMEPAGE_AUDIENCES.map((aud) => (
              <li key={aud.title} className="ga-card rounded-2xl border p-5" style={CARD_FACE}>
                <h3 className="text-[1.05rem] font-semibold" style={{ color: 'var(--ga-text)', fontFamily: GA_SANS }}>
                  {aud.title}
                </h3>
                <p className="mt-2 text-[0.95rem] leading-[1.65]" style={{ color: GA_MUTED }}>
                  {aud.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
