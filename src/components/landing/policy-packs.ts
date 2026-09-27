/**
 * Die sechs Policy Packs der Landing — ein Prüfpfad.
 *
 * Die Namen standen bisher doppelt: einmal als Trust-Rail im Hero, einmal als
 * Reifegrad-Tafel in der Workspace-Vorschau. Zwei Listen derselben Rahmenwerke
 * laufen auseinander, sobald ein Pack dazukommt — deshalb stehen sie hier.
 *
 * ## Auswahl hier, Schreibweise dort
 *
 * **Welche** sechs Rahmenwerke die Startseite herausstellt, ist eine Aussage
 * der Seite und steht deshalb in dieser Datei. **Wie** sie heißen, entscheidet
 * das Produkt: `frameworkLabel()` aus `lib/policy-packs/coverage` liefert die
 * Schreibweise, die auch der eingeloggte Policy-Packs-Bereich verwendet.
 * Benennt das Produkt ein Rahmenwerk um, zieht die Landing mit.
 *
 * `next: true` heißt: angekündigt, aber nicht ausgeliefert. Die Seite zeichnet
 * es gestrichelt und ohne Reifegrad. Der Stand deckt sich mit
 * `implementation-status.ts` („TISAX / DORA Frameworks" → Coming Soon).
 */
import { frameworkLabel } from '../../lib/policy-packs/coverage';

export type PolicyPack = {
  /** Rahmenwerk-Code wie in `lib/policy-packs/coverage`. */
  readonly code: string;
  /** Anzeigename aus der Produkt-Vokabel. */
  readonly label: string;
  /** Angekündigt, nicht ausgeliefert — nie als verfügbar darstellen. */
  readonly next?: true;
};

const SELECTION: readonly (readonly [code: string, next?: true])[] = [
  ['GDPR'],
  ['EU_AI_ACT'],
  ['ISO_27001'],
  ['NIS2'],
  ['TISAX', true],
  ['DORA', true],
] as const;

export const POLICY_PACKS: readonly PolicyPack[] = SELECTION.map(([code, next]) =>
  next ? { code, label: frameworkLabel(code), next } : { code, label: frameworkLabel(code) },
);

export const POLICY_PACK_COUNT = POLICY_PACKS.length;

/** Angekündigte Packs, für den Coming-Soon-Hinweis unter der Rail. */
export const POLICY_PACKS_NEXT = POLICY_PACKS.filter((pack) => pack.next);
