import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PLATFORM_LIVE_ITEMS, STATUS_LABEL } from '../../product/implementation-status';
import {
  GA_DISPLAY,
  GA_GOLD_LITE,
  GA_LINE_SOFT,
  GA_MONO,
  GA_MUTED,
  GA_TEXT,
} from './governance-ai-theme';
import { SectionEyebrow, SectionHeading, SectionIndex } from './GovernanceSectionChrome';

/**
 * Module, die heute erreichbar sind — direkt aus dem Product-Registry.
 *
 * Gerendert werden ausschließlich Einträge mit Status `live` und
 * `showOnPlatform`. Wer ein Modul auf `preview` zurückstuft, nimmt es damit
 * automatisch von dieser Fläche — genau deshalb liegt hier keine eigene
 * Liste. Preview und Coming Soon stehen weiter unten in der Roadmap, klar
 * als solche ausgezeichnet.
 *
 * Der Produkt-Spine („Eine Runtime. Vier Ebenen.") beschreibt daneben, *wie*
 * die Runtime arbeitet; diese Sektion beantwortet, *was* davon erreichbar
 * ist. Die beiden Aussagen sind bewusst getrennt.
 */
export function PlatformCapabilitiesSection() {
  if (PLATFORM_LIVE_ITEMS.length === 0) return null;

  return (
    <section
      id="platform"
      className="ga-band relative z-[1] border-t px-[4vw] py-[clamp(60px,6vw,92px)]"
      style={{ borderColor: GA_LINE_SOFT }}
    >
      <div className="mx-auto w-full max-w-[1500px]">
        <SectionIndex number="03" label="MODULE" />
        <SectionEyebrow>DIE PLATTFORM</SectionEyebrow>
        <SectionHeading accent="live erreichbar sind.">Module, die</SectionHeading>
        <p className="mt-4 max-w-[660px] text-[14px] leading-[1.7] text-pretty" style={{ color: GA_MUTED }}>
          Nur Capabilities mit Status LIVE aus dem Product-Registry. Preview und Coming Soon stehen
          unter{' '}
          <a href="#roadmap" className="underline decoration-[#c9a24a]/40 underline-offset-2">
            Roadmap
          </a>
          .
        </p>

        <div
          className="mt-[38px] grid gap-px overflow-hidden border md:grid-cols-2 lg:grid-cols-3"
          style={{ borderColor: GA_LINE_SOFT, backgroundColor: GA_LINE_SOFT }}
        >
          {PLATFORM_LIVE_ITEMS.map((capability) => {
            const body = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className="text-[15.5px] font-semibold leading-snug tracking-[-.01em]"
                    style={{ fontFamily: GA_DISPLAY, color: GA_TEXT }}
                  >
                    {capability.name}
                  </h3>
                  <span
                    className="shrink-0 whitespace-nowrap border px-2 py-0.5 text-[11px] tracking-[.12em]"
                    style={{
                      fontFamily: GA_MONO,
                      borderColor: 'rgba(201,162,74,.42)',
                      color: GA_GOLD_LITE,
                    }}
                  >
                    {STATUS_LABEL.live}
                  </span>
                </div>
                <p className="mt-2.5 text-[13px] leading-[1.65]" style={{ color: GA_MUTED }}>
                  {capability.description}
                </p>
                {capability.route && (
                  <span
                    className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium"
                    style={{ color: GA_GOLD_LITE }}
                  >
                    Öffnen <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                )}
              </>
            );

            return capability.route ? (
              <Link
                key={capability.id}
                to={capability.route}
                className="ga-card block p-6 transition hover:bg-white/[.03]"
                style={{ backgroundColor: 'rgba(20,22,25,.88)' }}
              >
                {body}
              </Link>
            ) : (
              <div
                key={capability.id}
                className="ga-card p-6"
                style={{ backgroundColor: 'rgba(20,22,25,.88)' }}
              >
                {body}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
