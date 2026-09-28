/**
 * Governance Tools der Vorschau — dieselben Kanäle, andere Optik.
 *
 * Die Kanalliste und ihre Registry-Anbindung teilt sich die Sektion mit
 * `LandingChannelTools` (`CHANNEL_TOOLS`). Live/Preview entscheidet weiter die
 * Produkt-Registry, nicht diese Datei: Ein Modul, das nicht live ist, führt auf
 * die Warteliste und trägt seinen echten Status als Chip — sonst verspräche die
 * Vorschau Dinge, die es nicht gibt.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  getImplementation,
  isImplementationLive,
  STATUS_LABEL,
} from '../../product/implementation-status';
import { CHANNEL_TOOLS } from './LandingChannelTools';
import { GA_DISPLAY, GA_LINE_SOFT, GA_MONO, GA_MUTED, GA_TEXT, GA_TITAN } from './governance-ai-theme';
import { SectionEyebrow, SectionHeading, SectionIndex } from './GovernanceSectionChrome';

export function GovernanceToolsSection() {
  return (
    <section
      id="tools"
      className="ga-band-alt relative z-[1] border-t px-[4vw] py-[clamp(60px,6vw,92px)]"
      style={{ borderColor: GA_LINE_SOFT }}
      aria-labelledby="tools-heading"
    >
      <div className="mx-auto w-full max-w-[1500px]">
        <SectionIndex number="02" label="TOOLS" />
        <SectionEyebrow>GOVERNANCE TOOLS</SectionEyebrow>
        <span id="tools-heading">
          <SectionHeading accent="Eine Governance-Ebene.">Ihre KI-Kanäle.</SectionHeading>
        </span>
        <p className="mt-4 max-w-[660px] text-pretty leading-[1.7]" style={{ color: GA_MUTED }}>
          Live-Module führen in den Konfigurator. Preview-Module sind als solche gekennzeichnet.
        </p>

        <div className="mt-[38px] grid gap-3.5 sm:grid-cols-2">
          {CHANNEL_TOOLS.map(({ eyebrow, title, icon: Icon, text, bullets, href, cta, registryId }) => {
            const live = isImplementationLive(registryId);
            const status = getImplementation(registryId)?.status ?? 'coming-soon';

            return (
              <article key={title} className="ga-card ga-glass flex min-h-[280px] flex-col p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-md border"
                      style={{
                        borderColor: 'var(--ga-accent-border)',
                        backgroundColor: 'var(--ga-chip-face)',
                      }}
                    >
                      <Icon
                        className="h-5 w-5"
                        style={{ color: 'var(--ga-accent)' }}
                        aria-hidden="true"
                      />
                    </span>
                    <div>
                      <p
                        className="text-[11px] tracking-[.2em]"
                        style={{ fontFamily: GA_MONO, color: 'var(--ga-accent)' }}
                      >
                        {eyebrow}
                      </p>
                      <h3
                        className="mt-1 text-[20px] font-medium tracking-[-.01em]"
                        style={{ fontFamily: GA_DISPLAY, color: GA_TEXT }}
                      >
                        {title}
                      </h3>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 whitespace-nowrap rounded border px-2.5 py-1 text-[11px] tracking-[.12em] ${
                      live ? '' : 'border-dashed'
                    }`}
                    style={{
                      fontFamily: GA_MONO,
                      borderColor: live ? 'var(--ga-accent-border)' : GA_LINE_SOFT,
                      color: live ? 'var(--ga-accent)' : GA_TITAN,
                    }}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                </div>

                <p className="mt-5 flex-1 text-[14px] leading-[1.6]" style={{ color: GA_MUTED }}>
                  {text}
                </p>

                <div className="mb-5 mt-5 flex flex-wrap gap-2">
                  {bullets.map((bullet) => (
                    <span
                      key={bullet}
                      className="rounded border px-3 py-1.5 text-[11px]"
                      style={{
                        fontFamily: GA_MONO,
                        borderColor: GA_LINE_SOFT,
                        color: GA_TITAN,
                      }}
                    >
                      {bullet}
                    </span>
                  ))}
                </div>

                <Link
                  to={live ? href : '/warteliste'}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[13px] font-semibold transition hover:brightness-[1.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ga-accent-lite)]"
                  style={
                    live
                      ? {
                          backgroundImage: 'var(--ga-pill-face)',
                          color: 'var(--ga-pill-ink)',
                          boxShadow: 'var(--ga-pill-shadow)',
                        }
                      : {
                          backgroundColor: 'rgba(0,0,0,.6)',
                          color: GA_TEXT,
                          border: '1px solid var(--ga-ghost-border)',
                        }
                  }
                >
                  {live ? cta : 'Auf die Warteliste'}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </article>
            );
          })}
        </div>

        <p
          className="mt-8 text-center text-[11px] tracking-[.18em]"
          style={{ fontFamily: GA_MONO, color: GA_TITAN }}
        >
          ONE GOVERNANCE PLANE · WEB · CODE · POLICY · EVIDENCE
        </p>
      </div>
    </section>
  );
}
