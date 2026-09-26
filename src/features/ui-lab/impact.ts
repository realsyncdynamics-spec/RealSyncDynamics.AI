import {
  BINDINGS,
  CONSTRAINTS,
  FORBIDDEN_PATHS,
  KPI_SISTERS,
  bindingsFor,
  surfacesFor,
  tokenDef,
} from './manifest';
import type { Draft, ImpactCard, ImpactRisk, ImpactStatus } from './types';

function riskFor(card: Omit<ImpactCard, 'risk'>): ImpactRisk {
  if (card.status === 'blocked' || card.token === '--context-radius-card') return 'high';
  if (card.bindings.length > 1 || card.sisters.length > 0) return 'medium';
  return 'low';
}

function statusOf(card: {
  bindings: ImpactCard['bindings'];
  forbiddenHits: string[];
  constraintFails: string[];
}): ImpactStatus {
  if (card.forbiddenHits.length || card.constraintFails.length) return 'blocked';
  if (!card.bindings.length) return 'unmapped';
  if (card.bindings.some((b) => b.kind === 'override')) return 'override';
  if (card.bindings.every((b) => b.kind === 'selector')) return 'legacy';
  return 'ok';
}

export function analyzeDraft(draft: Draft): ImpactCard[] {
  const keys = new Set<string>();
  for (const scope of ['shared', 'light', 'dark'] as const) {
    for (const key of Object.keys(draft[scope])) keys.add(key);
  }

  return [...keys].sort().map((token) => {
    const def = tokenDef(token);
    const bindings = bindingsFor(token);
    const surfaces = surfacesFor(token);
    const sisters = token === '--dash-kpi-min-height' ? [...KPI_SISTERS] : [];
    const value =
      draft.shared[token] ?? draft.light[token] ?? draft.dark[token] ?? def?.baseline ?? '';
    const constraintFails = CONSTRAINTS.filter((c) => c.token === token)
      .map((c) => c.check(value))
      .filter((reason): reason is string => Boolean(reason));
    const forbiddenHits = bindings
      .map((b) => b.file)
      .filter((file) => FORBIDDEN_PATHS.some((path) => file.startsWith(path)));

    const reasons = [...constraintFails];
    if (!def) reasons.push('Token is not in the registered catalog');
    if (!bindings.length) reasons.push('No registered binding');
    if (bindings.some((b) => b.kind === 'selector')) {
      reasons.push('Legacy selector still owns the visual. Tokenize the component before deleting density.css');
    }

    const base = {
      token,
      from: def?.baseline ?? 'unknown',
      to: value,
      scope: def?.scope ?? 'shared',
      targetBlock: def?.targetBlock ?? '.dashboard-context',
      surfaces: surfaces.map((s) => s.id),
      bindings,
      sisters,
      forbiddenHits,
      status: statusOf({ bindings, forbiddenHits, constraintFails }),
      reasons,
    };

    return { ...base, risk: riskFor(base) };
  });
}

export function mergeBlocked(cards: ImpactCard[]): boolean {
  return cards.some((card) => card.status === 'blocked' || card.status === 'unmapped');
}

/** Guard: a density patch must not invent per-KPI selectors. */
export function sistersIntact(cards: ImpactCard[]): boolean {
  const kpi = cards.find((card) => card.token === '--dash-kpi-min-height');
  if (!kpi) return true;
  return KPI_SISTERS.every((id) => kpi.sisters.includes(id));
}

export const REGISTERED_BINDING_COUNT = BINDINGS.length;
