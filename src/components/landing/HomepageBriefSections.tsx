import {
  HOMEPAGE_AUDIENCES,
  HOMEPAGE_EU_TRUST,
  HOMEPAGE_EVIDENCE_FLOW,
  HOMEPAGE_MODULES,
  HOMEPAGE_PROBLEM_PAINS,
} from '../governance-frontend/hero-content';
import { SectionEyebrow, SectionHeading } from './GovernanceSectionChrome';
import {
  GA_LINE_SOFT,
  GA_MONO,
  GA_MUTED,
  GA_SANS,
  GA_SILVER,
} from './governance-ai-theme';

export function HomepageBriefSections() {
  return (
    <>
      <section
        id="problem"
        className="ga-band relative z-[1] border-t px-[4vw] py-[clamp(56px,6vw,88px)]"
        style={{ borderColor: GA_LINE_SOFT }}
        aria-labelledby="problem-heading"
      >
        <div className="mx-auto w-full max-w-[1100px]">
          <SectionEyebrow>DAS PROBLEM</SectionEyebrow>
          <span id="problem-heading">
            <SectionHeading>KI ohne Kontrolle ist Schattenbetrieb.</SectionHeading>
          </span>
          <p className="mt-4 max-w-[40rem] text-pretty leading-[1.7]" style={{ color: GA_MUTED, fontFamily: GA_SANS }}>
            Europäische Organisationen brauchen eine Control- und Evidence-Layer — nicht nur
            Scanner oder Checklisten. Die typischen Schmerzen:
          </p>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {HOMEPAGE_PROBLEM_PAINS.map((pain) => (
              <li
                key={pain.title}
                className="ga-card rounded-2xl border p-5"
                style={{ borderColor: GA_LINE_SOFT, backgroundColor: 'rgba(255,255,255,0.03)' }}
              >
                <h3 className="text-[1.05rem] font-semibold" style={{ color: 'var(--ga-text)', fontFamily: GA_SANS }}>
                  {pain.title}
                </h3>
                <p className="mt-2 text-[0.95rem] leading-[1.65]" style={{ color: GA_MUTED }}>
                  {pain.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="modules"
        className="ga-band relative z-[1] border-t px-[4vw] py-[clamp(56px,6vw,88px)]"
        style={{ borderColor: GA_LINE_SOFT }}
        aria-labelledby="modules-heading"
      >
        <div className="mx-auto w-full max-w-[1100px]">
          <SectionEyebrow>VIER MODULE</SectionEyebrow>
          <span id="modules-heading">
            <SectionHeading>Scan. Build. Automate. Govern.</SectionHeading>
          </span>
          <ol className="mt-10 grid gap-4 md:grid-cols-2">
            {HOMEPAGE_MODULES.map((mod, index) => (
              <li
                key={mod.id}
                className="ga-card rounded-2xl border p-5"
                style={{ borderColor: GA_LINE_SOFT, backgroundColor: 'rgba(255,255,255,0.03)' }}
              >
                <p
                  className="text-[11px] uppercase tracking-[0.16em]"
                  style={{ fontFamily: GA_MONO, color: 'var(--ga-titan)' }}
                >
                  {String(index + 1).padStart(2, '0')} · {mod.id.toUpperCase()}
                </p>
                <h3 className="mt-2 text-[1.15rem] font-semibold" style={{ color: 'var(--ga-text)', fontFamily: GA_SANS }}>
                  {mod.title}
                </h3>
                <p className="mt-2 text-[0.95rem] leading-[1.65]" style={{ color: GA_MUTED }}>
                  {mod.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="audit-trail"
        className="ga-band relative z-[1] border-t px-[4vw] py-[clamp(56px,6vw,88px)]"
        style={{ borderColor: GA_LINE_SOFT }}
        aria-labelledby="evidence-heading"
      >
        <div className="mx-auto w-full max-w-[1100px]">
          <SectionEyebrow>EVIDENCE FLOW</SectionEyebrow>
          <span id="evidence-heading">
            <SectionHeading>Vom Signal zur Audit Evidence.</SectionHeading>
          </span>
          <p className="mt-4 max-w-[40rem] text-pretty leading-[1.7]" style={{ color: GA_MUTED, fontFamily: GA_SANS }}>
            Jede Entscheidung bleibt nachvollziehbar — für interne Reviews und externe Prüfungen.
          </p>
          <ol className="mt-10 flex flex-wrap items-center gap-2 sm:gap-3" aria-label="Evidence Flow">
            {HOMEPAGE_EVIDENCE_FLOW.map((step, i) => (
              <li key={step} className="flex items-center gap-2 sm:gap-3">
                <span
                  className="rounded-full border px-4 py-2 text-[0.85rem] font-medium"
                  style={{
                    fontFamily: GA_MONO,
                    borderColor: 'rgba(228,207,162,0.45)',
                    color: 'var(--ga-text)',
                    backgroundColor: 'rgba(228,207,162,0.08)',
                  }}
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
        </div>
      </section>

      <section
        id="eu-trust"
        className="ga-band relative z-[1] border-t px-[4vw] py-[clamp(56px,6vw,88px)]"
        style={{ borderColor: GA_LINE_SOFT }}
        aria-labelledby="eu-trust-heading"
      >
        <div className="mx-auto w-full max-w-[1100px]">
          <SectionEyebrow>EU TRUST</SectionEyebrow>
          <span id="eu-trust-heading">
            <SectionHeading>Europäische Control-Layer — by design.</SectionHeading>
          </span>
          <ul className="mt-8 flex flex-wrap gap-2.5">
            {HOMEPAGE_EU_TRUST.map((item) => (
              <li
                key={item}
                className="rounded border px-3 py-[7px] text-[11px] uppercase tracking-[0.14em]"
                style={{ fontFamily: GA_MONO, borderColor: GA_LINE_SOFT, color: GA_SILVER }}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="audiences"
        className="ga-band relative z-[1] border-t px-[4vw] py-[clamp(56px,6vw,88px)]"
        style={{ borderColor: GA_LINE_SOFT }}
        aria-labelledby="audiences-heading"
      >
        <div className="mx-auto w-full max-w-[1100px]">
          <SectionEyebrow>ZIELGRUPPEN</SectionEyebrow>
          <span id="audiences-heading">
            <SectionHeading>Für Teams mit Nachweispflicht.</SectionHeading>
          </span>
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {HOMEPAGE_AUDIENCES.map((aud) => (
              <li
                key={aud.title}
                className="ga-card rounded-2xl border p-5"
                style={{ borderColor: GA_LINE_SOFT, backgroundColor: 'rgba(255,255,255,0.03)' }}
              >
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
