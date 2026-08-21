import type { AboKey, FeatureId, RungKey } from './quote';

export const PENDING_KEY = 'rsd_pending_rebuild';

export type PendingRebuild = {
  company: string;
  domain: string;
  sourceUrl: string;
  knowledge: string;
  extras: FeatureId[];
  cents: number;
  setup: RungKey;
  abo: AboKey;
  variant: string;
};

export function savePending(next: PendingRebuild) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
}

export function loadPending(): PendingRebuild | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingRebuild;
  } catch {
    return null;
  }
}

export function clearPending() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}
