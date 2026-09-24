/**
 * NIS2 Policy Pack — Control-Katalog (§ 30 Abs. 2 BSIG / Art. 21 Abs. 2 NIS2).
 *
 * Preview-only: keine Scores, keine Maturity, keine Compliance-Claims.
 * Coverage-Schlüssel: `framework::control_code` (z. B. NIS2::RM-01), kompatibel
 * zu `PackControlRef` in `src/lib/policy-packs/coverage.ts`.
 */
import packJson from './policy-pack-nis2.json';
import type { PackControlRef } from '../../lib/policy-packs/coverage';

export type Nis2ControlStatusDefault = 'preview';

export interface Nis2PackControl extends PackControlRef {
  id: string;
  title: string;
  legal_ref: string;
  description: string;
  evidence_hint: string;
  status_default: Nis2ControlStatusDefault;
}

export interface Nis2PolicyPack {
  pack_id: string;
  pack_name: string;
  version: string;
  frameworks: readonly string[];
  industry: string;
  legal_basis_version: string;
  status: 'preview';
  disclaimer: string;
  controls: readonly Nis2PackControl[];
}

export const nis2PolicyPack = packJson as Nis2PolicyPack;

/** Coverage-Referenzen (framework + control_code) für computeCoverage. */
export function nis2PackControlRefs(): PackControlRef[] {
  return nis2PolicyPack.controls.map(({ framework, control_code }) => ({
    framework,
    control_code,
  }));
}

/** Coverage-Schlüssel `NIS2::<control_code>`. */
export function nis2CoverageKey(control: Pick<PackControlRef, 'framework' | 'control_code'>): string {
  return `${control.framework}::${control.control_code}`;
}

export { packJson as nis2PackJson };
