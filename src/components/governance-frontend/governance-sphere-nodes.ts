/**
 * Interactive Governance Sphere — node catalog.
 *
 * Values are **demo / simulated**. Anonymous visitors have no tenant;
 * nothing here is a live production metric (Truth Layer).
 */

export const SPHERE_DEMO_LABEL = 'GOVERNANCE SPHERE · DEMO / SIMULATED';

export const SPHERE_DEMO_NOTE =
  'Simulated system state for exploration. Live metrics appear after your first scan.';

export type SphereNodeState = 'operational' | 'attention';

export interface GovernanceSphereNode {
  id: string;
  label: string;
  phase: 'Detect' | 'Govern' | 'Prove' | 'Automate';
  state: SphereNodeState;
  summary: string;
  /** Spherical placement: latitude / longitude in degrees. */
  lat: number;
  lon: number;
  /** Optional demo detail — never presented as a live count. */
  detail?: string;
}

export const GOVERNANCE_SPHERE_NODES: readonly GovernanceSphereNode[] = [
  {
    id: 'detect-assets',
    label: 'Asset Discovery',
    phase: 'Detect',
    state: 'operational',
    summary: 'Discover AI systems, sites, agents, and data flows in scope.',
    detail: 'Demo · inventory scan path',
    lat: 28,
    lon: -40,
  },
  {
    id: 'detect-risk',
    label: 'Risk Signals',
    phase: 'Detect',
    state: 'attention',
    summary: 'Surface residual risk that needs human review before enforcement.',
    detail: 'Demo · attention queue',
    lat: -18,
    lon: -70,
  },
  {
    id: 'govern-policy',
    label: 'Policy Control',
    phase: 'Govern',
    state: 'operational',
    summary: 'Bind DSGVO and EU AI Act controls to operating policies.',
    detail: 'Demo · policy packs',
    lat: 42,
    lon: 20,
  },
  {
    id: 'govern-enforce',
    label: 'Enforcement',
    phase: 'Govern',
    state: 'operational',
    summary: 'Apply governance rules and handle deviations under control.',
    detail: 'Demo · enforce loop',
    lat: 8,
    lon: 55,
  },
  {
    id: 'prove-evidence',
    label: 'Evidence Vault',
    phase: 'Prove',
    state: 'operational',
    summary: 'Keep Prüfpfade, exports, and decision history audit-ready.',
    detail: 'Demo · evidence chain',
    lat: -32,
    lon: 35,
  },
  {
    id: 'prove-audit',
    label: 'Audit Ready',
    phase: 'Prove',
    state: 'attention',
    summary: 'Prepare a consistent governance history for boards and auditors.',
    detail: 'Demo · audit pack',
    lat: -8,
    lon: 110,
  },
  {
    id: 'automate-monitor',
    label: 'Continuous Monitor',
    phase: 'Automate',
    state: 'operational',
    summary: 'Recurring checks replace one-off compliance samples.',
    detail: 'Demo · monitor cycle',
    lat: 22,
    lon: 150,
  },
  {
    id: 'automate-remediate',
    label: 'Remediation',
    phase: 'Automate',
    state: 'attention',
    summary: 'Route findings into governed remediation without losing proof.',
    detail: 'Demo · fix queue',
    lat: -40,
    lon: -20,
  },
];

export function sphereNodePosition(
  lat: number,
  lon: number,
  radius: number,
): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return [x, y, z];
}
