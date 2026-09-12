import type { ReactNode } from 'react';
import {
  GA_DISPLAY,
  GA_GOLD_LITE,
  GA_GOLD_TEXT_H2,
  GA_H2,
  GA_LINE_SOFT,
  GA_MONO,
  GA_TEXT,
  GA_TITAN,
} from './governance-ai-theme';

/**
 * Wiederkehrende Sektionsauszeichnung der Governance-AI-Landing.
 *
 * Der nummerierte Index (01–05) mit auslaufender Haarlinie ist das Element,
 * das der Seite ihre Enterprise-Anmutung gibt: Die Startseite liest sich
 * dadurch wie ein Dokument mit Gliederung, nicht wie eine Abfolge von
 * Marketing-Blöcken. Weil er auf jeder Sektion identisch auftritt, liegt er
 * hier statt fünfmal kopiert in den Sektionen.
 */

export function SectionIndex({ number, label }: { number: string; label: string }) {
  return (
    <div
      className="mb-[22px] flex items-center gap-4 text-[11px] tracking-[.2em]"
      style={{ fontFamily: GA_MONO, color: GA_TITAN }}
    >
      <b className="font-medium" style={{ color: GA_GOLD_LITE }}>
        {number}
      </b>
      <span>{label}</span>
      <span className="h-px flex-1" style={{ backgroundColor: GA_LINE_SOFT }} aria-hidden="true" />
    </div>
  );
}

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p
      className="m-0 inline-block whitespace-nowrap rounded-full border px-[13px] py-[7px] text-[11px] tracking-[.2em]"
      style={{
        fontFamily: GA_MONO,
        borderColor: 'rgba(201,162,74,.42)',
        color: GA_GOLD_LITE,
      }}
    >
      {children}
    </p>
  );
}

/**
 * H2 im Seitenduktus: Silber-Text mit einem Gold-Verlauf auf dem Akzentteil.
 * `accent` ist der Halbsatz, der die Aussage trägt — er steht immer am Ende.
 */
export function SectionHeading({
  children,
  accent,
  centered = false,
}: {
  children: ReactNode;
  accent?: ReactNode;
  centered?: boolean;
}) {
  return (
    <h2
      className={`mt-5 leading-[1.06] tracking-[-.03em] ${centered ? 'mx-auto max-w-none' : 'max-w-[24ch]'}`}
      style={{ fontFamily: GA_DISPLAY, fontWeight: 600, fontSize: GA_H2, color: GA_TEXT }}
    >
      {children}
      {accent && (
        <>
          {' '}
          <em
            className="not-italic"
            style={{
              backgroundImage: GA_GOLD_TEXT_H2,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {accent}
          </em>
        </>
      )}
    </h2>
  );
}
