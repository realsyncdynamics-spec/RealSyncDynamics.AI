import { LAYERS } from '../../content/runtimeVocab';
import { GA_GOLD, GA_GOLD_LITE, GA_LINE_SOFT, GA_MONO, GA_MUTED, GA_TITAN } from './governance-ai-theme';
import { SectionEyebrow, SectionHeading, SectionIndex } from './GovernanceSectionChrome';

/**
 * Produkt-Spine — die vier Ebenen der Runtime.
 *
 * Vollständig aus `runtimeVocab.LAYERS`: Nummer, Titel, Rolle, Blurb und
 * Bullets. Kein Wort dieser Sektion steht als Literal in der Datei, damit
 * Produktsprache an genau einer Stelle gepflegt wird — dieselbe Quelle, aus
 * der auch der Governance-Loop seine Ebenennamen zieht.
 */
export function RuntimeLayersSection() {
  return (
    <section
      id="product"
      className="ga-band-alt relative z-[1] border-t px-[4vw] py-[clamp(60px,6vw,92px)]"
      style={{ borderColor: GA_LINE_SOFT }}
    >
      <div className="mx-auto w-full max-w-[1500px]">
        <SectionIndex number="02" label="RUNTIME" />
        <SectionEyebrow>PRODUKT</SectionEyebrow>

        <SectionHeading accent="Vier Ebenen.">Eine Runtime.</SectionHeading>

        <p className="mt-4 max-w-[660px] text-[14px] leading-[1.7] text-pretty" style={{ color: GA_MUTED }}>
          Detect, Monitor, Govern und Automate greifen ineinander: Was der Scan findet, wird
          laufend überwacht, nach AI-Act-Risiko und DSGVO-Artikel klassifiziert und als Evidence
          versiegelt.
        </p>

        <div className="mt-[38px] grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {LAYERS.map((layer) => (
            <article
              key={layer.id}
              className="ga-card flex flex-col rounded-lg border p-6 transition-colors hover:border-[rgba(214,220,228,.3)]"
              style={{
                borderColor: GA_LINE_SOFT,
                background: 'linear-gradient(150deg, rgba(40,43,48,.72), rgba(20,22,25,.82))',
              }}
            >
              <p
                className="text-[11px] tracking-[.2em]"
                style={{ fontFamily: GA_MONO, color: GA_GOLD_LITE }}
              >
                {layer.short} · {layer.title.toUpperCase()}
              </p>
              <p
                className="mt-3.5 text-[11px] tracking-[.12em]"
                style={{ fontFamily: GA_MONO, color: GA_TITAN }}
              >
                {layer.role}
              </p>
              <p className="mb-[18px] mt-3 text-[13.5px] leading-[1.65] text-pretty" style={{ color: '#d8dee6' }}>
                {layer.blurb}
              </p>
              <ul
                className="mt-auto flex flex-col gap-2.5 border-t pt-[18px]"
                style={{ borderColor: GA_LINE_SOFT }}
              >
                {layer.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex gap-2.5 text-[12.5px] leading-[1.5]"
                    style={{ color: GA_MUTED }}
                  >
                    <span aria-hidden="true" style={{ color: GA_GOLD }}>
                      +
                    </span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
