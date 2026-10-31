/**
 * COSMOS: visual demonstration distances/radii/speeds, NOT physical scale.
 * Earth textures: public/textures/README.md (Solar System Scope CC BY 4.0).
 */
export const CELESTIAL_BODIES = [
  { id: 'mercury', name: 'Merkur', orbit: 4.8, radius: 0.24, speed: 0.54, phase: 1.1, color: '#b7aea4' },
  { id: 'venus', name: 'Venus', orbit: 7.3, radius: 0.48, speed: 0.40, phase: 2.5, color: '#e7c18c' },
  { id: 'earth', name: 'Erde', orbit: 10.1, radius: 0.55, speed: 0.31, phase: 0.5, color: '#4e9bdf' },
  { id: 'mars', name: 'Mars', orbit: 12.9, radius: 0.35, speed: 0.25, phase: 3.7, color: '#c86745' },
  { id: 'jupiter', name: 'Jupiter', orbit: 17.3, radius: 1.33, speed: 0.14, phase: 0.9, color: '#d9b891' },
  { id: 'saturn', name: 'Saturn', orbit: 22, radius: 1.1, speed: 0.10, phase: 4.2, color: '#d7c48f' },
  { id: 'uranus', name: 'Uranus', orbit: 27, radius: 0.86, speed: 0.075, phase: 5.1, color: '#98dada' },
  { id: 'neptune', name: 'Neptun', orbit: 32, radius: 0.82, speed: 0.055, phase: 2.1, color: '#4e77d6' },
] as const;

export type PlanetId = (typeof CELESTIAL_BODIES)[number]['id'];

export function orbitPosition(
  orbit: number,
  phase: number,
  angularSpeed: number,
  elapsed: number,
): [number, number, number] {
  const angle = phase + angularSpeed * elapsed;
  return [orbit * Math.cos(angle), 0, orbit * Math.sin(angle)];
}

export function clampSimulationSpeed(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(3, Math.max(0, value));
}
