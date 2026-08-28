import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  PLATFORM_FLOW,
  PLATFORM_LAYERS,
  PLATFORM_POSITIONING,
  PLATFORM_TAGLINE,
} from '@/shared/platform';
import { formatPriceEur, planById } from '@/shared/pricing';

/** Schriftliche Darstellung der Zielarchitektur. Keine eigenen Preise. */
export function PlatformOsSection({ source = 'landing' }: { source?: string }) {
  const starter = planById('starter');
  const growth = planById('growth');

  return (
    <section
      id="platform-os"
      className="border-t border-white/10 px-4 py-20 sm:px-6 md:py-28 lg:px-10"
      aria-labelledby="platform-os-heading"
    >
      <div className="mx-auto max-w-7xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#e8c98a]">
          {PLATFORM_POSITIONING}
        </p>
        <h2
          id="platform-os-heading"
          className="mt-3 max-w-3xl text-3xl tracking-tight text-white sm:text-5xl"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500 }}
        >
          {PLATFORM_TAGLINE}
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/55">
          Create, Operate und Govern sitzen auf derselben Runtime. Der Plan ist
          die Kapazitätsdecke. Features schalten Sie im Dashboard — Aus, Test, Live.
        </p>
        <ol className="mt-6 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
          {PLATFORM_FLOW.map((step, i) => (
            <li key={step} className="rounded-full border border-white/15 px-3 py-1">
              {String(i + 1).padStart(2, '0')} {step}
            </li>
          ))}
        </ol>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-4">
          {PLATFORM_LAYERS.map((layer) => (
            <article key={layer.id} className="bg-[rgb(3,7,18)] p-6" data-testid={`platform-layer-${layer.id}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[10px] tracking-[0.22em] text-[#e8c98a]">{layer.label}</p>
                {layer.status === 'building' && (
                  <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[9px] text-white/40">FOLGT</span>
                )}
              </div>
              <h3 className="mt-3 text-base font-semibold text-white">{layer.headline}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/50">{layer.summary}</p>
              <ul className="mt-4 space-y-1 text-xs text-white/45">
                {layer.items.map((item) => (
                  <li key={item}>+ {item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 p-6">
            <p className="font-mono text-[10px] tracking-[0.22em] text-[#e8c98a]">EINSTIEG</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {starter.name} {formatPriceEur(starter.price.monthlyEur)}
            </p>
            <p className="mt-2 text-sm text-white/50">
              Eine Domain, Website-Chat, Nachweis. WhatsApp und Telefon bleiben aus, bis Sie sie im Dashboard setzen.
            </p>
          </div>
          <div className="rounded-2xl border border-[#e8c98a]/35 p-6">
            <p className="font-mono text-[10px] tracking-[0.22em] text-[#e8c98a]">BETRIEB</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {growth.name} {formatPriceEur(growth.price.monthlyEur)}
              <span className="ml-2 font-mono text-[10px] uppercase text-[#e8c98a]">Empfohlen</span>
            </p>
            <p className="mt-2 text-sm text-white/50">
              Kanäle, Drift, mehr Domains. Meta-Takte und Telefonminuten bleiben Verbrauch — nicht im Planpreis versteckt.
            </p>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to={`/start?source=${encodeURIComponent(source)}`}
            className="inline-flex items-center gap-2 rounded-full bg-[#f0e6d2] px-6 py-3 text-sm font-semibold text-[#1a1714]"
          >
            Betrieb einrichten <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/pricing" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm text-white/80">
            Preise im Raster
          </Link>
        </div>
      </div>
    </section>
  );
}
