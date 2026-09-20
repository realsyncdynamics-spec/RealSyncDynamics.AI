import {
  RUNTIME_PREVIEW_CARDS,
  RUNTIME_PREVIEW_LABEL,
  RUNTIME_PREVIEW_NOTE,
  type RuntimePreviewCard,
} from '../../config/landing-runtime-preview';
import {
  LANDING_ACCENT,
  LANDING_GREEN,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_TEXT,
} from './landing-theme';

/**
 * Beispielansicht der Governance Runtime — der Abschnitt unter dem Hero.
 *
 * Er ersetzt den fruehere KPI-Streifen, der `1.284` Systeme, `48.902`
 * Evidence-Events und `93,7 %` Kontrollabdeckung als Zahlen zeigte und den
 * Vorbehalt nur in einem `sr-only`-Absatz trug. Wer die Seite ansieht, las
 * dort Messwerte; nur wer sie vorlesen laesst, erfuhr, dass keiner davon
 * gemessen war.
 *
 * Hier steht der Vorbehalt sichtbar: `DEMO / SIMULATED` neben der
 * Kopfzeile, die Fussnote darunter. Die Werte kommen aus
 * `config/landing-runtime-preview` — dort liegen sie mit der Begruendung,
 * warum sie Beispielwerte heissen muessen, und `platform-capabilities`
 * haelt fest, dass sie nicht in eine Seite zurueckwandern.
 */

/** Sichtbarer Vorbehalt neben der Kopfzeile. */
const DEMO_BADGE = 'DEMO / SIMULATED' as const;

/** Zweite Zeile der Fussnote — dieselbe Aussage auf Englisch. */
const DEMO_NOTE_EN = 'Simulated system state. No production KPIs.' as const;

function toneColor(tone: RuntimePreviewCard['tone']): string {
  return tone === 'ok' ? LANDING_GREEN : LANDING_ACCENT;
}

export function RuntimePreviewPanel() {
  return (
    <section
      aria-label={RUNTIME_PREVIEW_LABEL}
      className="border-b border-white/[0.06] bg-[#0e0e10]/90 py-[52px]"
      data-demo-kpis="true"
      data-runtime-preview="example"
    >
      <div className="mx-auto max-w-[1280px] px-[4vw]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p
            className="text-[10px] tracking-[0.22em]"
            style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
          >
            {RUNTIME_PREVIEW_LABEL}
          </p>
          <span
            className="rounded-full border px-2.5 py-1 text-[9px] tracking-[0.18em]"
            style={{
              fontFamily: LANDING_MONO,
              color: LANDING_MUTED,
              borderColor: 'rgba(255,255,255,0.18)',
            }}
          >
            {DEMO_BADGE}
          </span>
        </div>

        <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {RUNTIME_PREVIEW_CARDS.map((card) => (
            <li
              key={card.id}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-4"
              data-preview-card={card.id}
            >
              <p
                className="text-[9px] tracking-[0.2em]"
                style={{ fontFamily: LANDING_MONO, color: LANDING_MUTED }}
              >
                {card.label}
              </p>
              <p
                className="mt-2 text-[1.45rem] font-semibold leading-none tracking-tight"
                style={{ color: toneColor(card.tone) }}
              >
                {card.value}
              </p>
              {card.ratio === undefined ? null : (
                <div
                  className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.08]"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(card.ratio * 100)}%`,
                      backgroundColor: toneColor(card.tone),
                    }}
                  />
                </div>
              )}
              {card.detail ? (
                <p className="mt-2.5 text-[11px] leading-snug" style={{ color: LANDING_MUTED }}>
                  {card.detail}
                </p>
              ) : null}
            </li>
          ))}
        </ul>

        <p className="mt-6 text-[11px] leading-relaxed" style={{ color: LANDING_MUTED }}>
          {RUNTIME_PREVIEW_NOTE}{' '}
          <span style={{ color: LANDING_TEXT }}>{DEMO_NOTE_EN}</span>
        </p>
      </div>
    </section>
  );
}
