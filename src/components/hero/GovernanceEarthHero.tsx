/**
 * GovernanceEarthHero — rechte visuelle Hero-Bühne: dynamische 3D-Erde
 * (DynamicEarthScene) + Glassmorphism-Governance-Labels (FloatingGovernanceLabels).
 *
 * Reine Dekoration → `aria-hidden`. Die conversion-relevanten Texte/CTAs bleiben
 * als HTML in der linken Hero-Spalte (GovernanceOsHome). Diese Komponente ersetzt
 * ausschließlich die rechte visuelle Fläche.
 */
import { DynamicEarthScene } from './DynamicEarthScene';
import { FloatingGovernanceLabels } from './FloatingGovernanceLabels';

export function GovernanceEarthHero({ className = '' }: { className?: string }) {
  return (
    <div className={`relative h-full w-full ${className}`} aria-hidden>
      <DynamicEarthScene />
      <FloatingGovernanceLabels />
    </div>
  );
}

export default GovernanceEarthHero;
