import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  LANDING_ACCENT,
  LANDING_BUTTON,
  LANDING_BUTTON_TEXT,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_SERIF,
  LANDING_TEXT,
} from './landing-theme';

/**
 * Dark band zwischen Kanal-Tools und Plattform — Entwurfsabschnitt
 * „ONE OPERATIONAL PLANE / Detect. Govern. Prove."
 *
 * Die Sektion traegt die Anker-ID `one-plane`. Die naheliegende ID
 * `runtime` gehoert in `MainLanding` bereits dem Abschnitt „DAS
 * BETRIEBSSYSTEM" — zwei gleiche IDs auf einer Seite brechen den
 * Ankersprung, und der Header verlinkt diesen Anker.
 */
export function LandingDarkBand() {
  return (
    <section
      id="one-plane"
      className="grid items-center gap-10 border-y border-white/[0.06] bg-[#070a10] px-[4vw] py-[65px] lg:grid-cols-[1.2fr_.9fr_auto]"
    >
      <div>
        <p
          className="text-[9px] tracking-[.22em]"
          style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
        >
          ONE OPERATIONAL PLANE
        </p>
        <h2
          className="mt-3 text-[clamp(32px,4vw,52px)] leading-none tracking-[-.03em]"
          style={{ fontFamily: LANDING_SERIF, fontWeight: 500, color: LANDING_TEXT }}
        >
          Detect. Govern. Prove.
        </h2>
      </div>
      <p className="max-w-md text-[13px] leading-[1.7]" style={{ color: LANDING_MUTED }}>
        Runtime für KI-Risiken, Policies und Evidence — für Module mit Status
        LIVE. Preview und Next stehen auf der Roadmap.
      </p>
      <Link
        to="/governance-runtime"
        className="inline-flex items-center justify-center gap-2 px-[18px] py-[13px] text-[11px] font-semibold transition hover:brightness-105"
        style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
      >
        Explore the Runtime <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}
