import type { Capability } from './types';

/**
 * effective_capabilities(child)
 *   ⊆ delegated_capabilities
 *   ⊆ effective_capabilities(parent)
 *
 * Provider, model, name, depth MUST NOT appear here.
 */
export function isSubset(
  inner: readonly Capability[],
  outer: readonly Capability[],
): boolean {
  const outerSet = new Set(outer);
  return inner.every((c) => outerSet.has(c));
}

export function subtractCapabilities(
  granted: readonly Capability[],
  denied: readonly Capability[] | undefined,
): readonly Capability[] {
  if (!denied?.length) return granted;
  const deny = new Set(denied);
  return granted.filter((c) => !deny.has(c));
}

export function intersectCapabilities(
  a: readonly Capability[],
  b: readonly Capability[],
): readonly Capability[] {
  const bSet = new Set(b);
  return a.filter((c) => bSet.has(c));
}

export function uniqueSorted(caps: readonly Capability[]): readonly Capability[] {
  return [...new Set(caps)].sort() as Capability[];
}

export function assertNarrowing(args: {
  parentEffective: readonly Capability[];
  delegated: readonly Capability[];
  childEffective: readonly Capability[];
}): { ok: true } | { ok: false; violated: 'delegated_gt_parent' | 'child_gt_delegated' } {
  if (!isSubset(args.delegated, args.parentEffective)) {
    return { ok: false, violated: 'delegated_gt_parent' };
  }
  if (!isSubset(args.childEffective, args.delegated)) {
    return { ok: false, violated: 'child_gt_delegated' };
  }
  return { ok: true };
}
