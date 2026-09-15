import { GA_GOLD, GA_GOLD_LITE, GA_LINE_SOFT, GA_MONO, GA_MUTED, GA_SILVER } from './governance-ai-theme';

/**
 * Laufband der regulatorischen Anker unter dem Hero.
 *
 * Zeigt, gegen welche Normstellen die Runtime prüft — Artikel, nicht Claims.
 * „ANCHORED" bezieht sich auf den Anker in der Evidence-Chain, also darauf,
 * dass zu dieser Fundstelle Nachweise geführt werden; es ist keine Aussage
 * über den Compliance-Status eines Besuchers.
 *
 * Die Spur ist zweimal gerendert und wandert um exakt 50 % — so entsteht die
 * nahtlose Schleife. Bei `prefers-reduced-motion` steht sie still (CSS in
 * `src/index.css`), bei Hover pausiert sie, damit man mitlesen kann.
 */
const ANCHORS: readonly (readonly [string, string])[] = [
  ['DSGVO Art. 5', 'Grundsätze der Verarbeitung'],
  ['DSGVO Art. 6', 'Rechtmäßigkeit'],
  ['DSGVO Art. 28', 'Auftragsverarbeiter'],
  ['DSGVO Art. 30', 'Verzeichnis (VVT)'],
  ['DSGVO Art. 35', 'DSFA'],
  ['TTDSG §25', 'Endeinrichtungen · Consent'],
  ['AI Act Art. 6', 'Hochrisiko-Einstufung'],
  ['AI Act Art. 9', 'Risikomanagement'],
  ['AI Act Art. 13', 'Transparenz'],
  ['AI Act Art. 50', 'Kennzeichnungspflicht'],
  ['AI Act Annex III', 'Hochrisiko-Bereiche'],
  ['ISO 27001 A.5', 'Organisatorische Kontrollen'],
  ['ISO 27001 A.8', 'Technologische Kontrollen'],
  ['NIS2 Art. 21', 'Risikomanagementmaßnahmen'],
  ['C2PA 2.x', 'Content Credentials'],
];

function Anchor({ article, topic }: { article: string; topic: string }) {
  return (
    <span
      className="inline-flex items-center gap-3.5 whitespace-nowrap px-[22px] text-[11px] tracking-[.16em]"
      style={{ fontFamily: GA_MONO, color: GA_MUTED }}
    >
      <i
        className="h-1 w-1 rounded-full not-italic"
        style={{ backgroundColor: GA_GOLD }}
        aria-hidden="true"
      />
      <b className="font-medium" style={{ color: GA_SILVER }}>
        {article}
      </b>
      {topic}
      <u className="no-underline" style={{ color: GA_GOLD_LITE }}>
        ANCHORED
      </u>
    </span>
  );
}

export function RegulatoryTicker() {
  return (
    <div
      className="ga-ticker relative z-[1] h-[44px] overflow-hidden border-y bg-[rgba(14,15,18,.82)] backdrop-blur-[6px]"
      style={{ borderColor: GA_LINE_SOFT }}
      aria-label="Regulatorische Anker"
    >
      <div className="ga-ticker-track flex h-full w-max items-center">
        {/* Zweite Spur ist die Kopie, die die Lücke schließt — für
            Screenreader daher ausgeblendet. */}
        {ANCHORS.map(([article, topic]) => (
          <Anchor key={article} article={article} topic={topic} />
        ))}
        <span className="flex" aria-hidden="true">
          {ANCHORS.map(([article, topic]) => (
            <Anchor key={`dup-${article}`} article={article} topic={topic} />
          ))}
        </span>
      </div>
    </div>
  );
}
