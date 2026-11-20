import type { ComponentType } from 'react';
import { DEMO_STEPS } from './kiBotsContent';
import { PRODUCT_CONTENT } from './productContent';

/**
 * Eigene Hero-Szene je Produkt-Landingpage (Entwurf, 19.11.2026).
 *
 * SYNC bleibt die gemeinsame Figur, jede Seite inszeniert ihn anders:
 * Kamerawinkel, Ruhepose, Seite der Bühne und eine Produktkarte daneben.
 *   - empfang     → Chatverlauf aus dem Beispielgespräch (kiBotsContent.ts)
 *   - builder     → Website-Vorschau mit offener Freigabe
 *   - governance  → Prüfpfad aus den Ablaufschritten von Governance OS
 *   - optimizer   → Befundliste nach Schweregrad
 * Alle Karten sind als Beispiel gekennzeichnet; Texte kommen aus den
 * Inhaltsdateien, keine Kennzahlen oder Kundenangaben.
 */

export type StageVariant = 'empfang' | 'builder' | 'governance' | 'optimizer';

export interface StageScene {
  /** Kamerawinkel in Grad. */
  orbit: { theta: number; phi: number };
  /** Ruhepose als Anteil der Winken-Animation. */
  poseAt: number;
  /** Seite, auf der SYNC steht; die Produktkarte steht gegenüber. */
  side: 'left' | 'right';
}

export const STAGE_SCENES: Record<StageVariant, StageScene> = {
  // Negativer Winkel: SYNC schaut nach rechts, positiver: nach links, jeweils zur Karte.
  empfang: { orbit: { theta: -32, phi: 80 }, poseAt: 0, side: 'left' },
  builder: { orbit: { theta: 28, phi: 74 }, poseAt: 0, side: 'right' },
  governance: { orbit: { theta: -12, phi: 86 }, poseAt: 0, side: 'left' },
  optimizer: { orbit: { theta: 40, phi: 66 }, poseAt: 0, side: 'right' },
};

/** Zuordnung Produktseite → Szene. */
export const STAGE_VARIANT_BY_PRODUCT = {
  'ki-bots': 'empfang',
  'landingpage-builder': 'builder',
  'app-builder': 'builder',
  'governance-os': 'governance',
  'claude-code-optimizer': 'optimizer',
} as const satisfies Record<string, StageVariant>;

function EmpfangCard() {
  return (
    <>
      <span className="pl-prop-label">Chat · Beispiel</span>
      {DEMO_STEPS.slice(0, 2).map((step) => (
        <p key={step.text} className="pl-prop-bubble" data-speaker={step.speaker}>{step.text}</p>
      ))}
    </>
  );
}

function BuilderCard() {
  return (
    <>
      <span className="pl-prop-label">Vorschau · Beispiel</span>
      <div className="pl-prop-browser" aria-hidden="true">
        <span className="pl-prop-bar"><i /><i /><i /></span>
        <span className="pl-prop-block pl-prop-block--hero" />
        <span className="pl-prop-cols"><span className="pl-prop-block" /><span className="pl-prop-block" /><span className="pl-prop-block" /></span>
      </div>
      <p className="pl-prop-row"><span>Veröffentlichung</span><span className="pl-pill">Freigabe offen</span></p>
    </>
  );
}

function GovernanceCard() {
  const steps = PRODUCT_CONTENT['governance-os'].flow.steps;
  const last = steps.length - 1;
  return (
    <>
      <span className="pl-prop-label">Prüfpfad · Beispiel</span>
      <ol className="pl-prop-list">
        {steps.map((s, i) => (
          <li key={s.title} className="pl-prop-row" data-state={i < last ? 'done' : 'open'}>
            <span>{s.title}</span>
            <span className="pl-prop-mark">{i < last ? 'erledigt' : 'offen'}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

/** Themen aus dem Optimizer-Ablauf: Datenschutz, Tracking, Einwilligung. */
const OPTIMIZER_FINDINGS = [
  { topic: 'Einwilligung', level: 'Hoch' },
  { topic: 'Tracking', level: 'Mittel' },
  { topic: 'Datenschutz', level: 'Niedrig' },
] as const;

function OptimizerCard() {
  return (
    <>
      <span className="pl-prop-label">Befunde · Beispiel</span>
      <ul className="pl-prop-list">
        {OPTIMIZER_FINDINGS.map((f) => (
          <li key={f.topic} className="pl-prop-row" data-level={f.level}>
            <span>{f.topic}</span>
            <span className="pl-prop-mark">{f.level}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

const CARDS: Record<StageVariant, ComponentType> = {
  empfang: EmpfangCard,
  builder: BuilderCard,
  governance: GovernanceCard,
  optimizer: OptimizerCard,
};

/** Produktkarte neben SYNC. */
export function StageProp({ variant }: { variant: StageVariant }) {
  const Card = CARDS[variant];
  // Karte steht gegenüber von SYNC.
  const side = STAGE_SCENES[variant].side === 'left' ? 'right' : 'left';
  return (
    <div className={`pl-prop pl-prop--${side}`} data-testid="pl-stage-prop">
      <Card />
    </div>
  );
}
