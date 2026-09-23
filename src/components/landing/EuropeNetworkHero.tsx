/** Photoreal Europe still — no SVG node mesh (viewport stretch made ovals). */
import { LANDING_BG } from './landing-theme';

export function EuropeNetworkHero() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
      data-hero-visual="europe-network-static"
      data-hero-interactive="false"
    >
      <picture>
        <source srcSet="/europe-globe.webp" type="image/webp" />
        <img
          src="/europe-globe.jpg"
          alt=""
          width={1920}
          height={1080}
          className="absolute inset-0 h-full w-full scale-[1.04] object-cover object-[70%_46%] opacity-[0.92] brightness-[1.08] contrast-[1.08] saturate-[1.12]"
          decoding="async"
        />
      </picture>
      <div
        className="absolute inset-0"
        style={{
          background: [
            `linear-gradient(105deg, ${LANDING_BG} 0%, ${LANDING_BG}b3 26%, ${LANDING_BG}40 48%, transparent 68%)`,
            `linear-gradient(180deg, ${LANDING_BG}66 0%, transparent 22%, transparent 74%, ${LANDING_BG}cc 100%)`,
          ].join(','),
        }}
      />
    </div>
  );
}
