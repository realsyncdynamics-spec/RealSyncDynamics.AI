// Übergabe an Menschen im Bot-Posteingang — reine Helfer (testbar ohne DOM).

import type { BotConversation, BotHandoffAction, BotHandoffReason, BotHandoffStatus } from './types';

export function handoffStatusOf(c: Pick<BotConversation, 'handoff_status'>): BotHandoffStatus {
  return c.handoff_status ?? 'none';
}

export function isOpenHandoff(c: Pick<BotConversation, 'handoff_status'>): boolean {
  const s = handoffStatusOf(c);
  return s === 'requested' || s === 'accepted';
}

export const HANDOFF_STATUS_LABEL: Record<BotHandoffStatus, string> = {
  none: 'Bot',
  requested: 'Übergabe angefordert',
  accepted: 'In Bearbeitung',
  resolved: 'Übergabe erledigt',
};

export const HANDOFF_REASON_LABEL: Record<BotHandoffReason, string> = {
  customer_request: 'Kunde möchte einen Menschen sprechen',
  assistant_uncertain: 'Assistent war unsicher',
  manual: 'Manuell übergeben',
};

/** Erlaubte Aktionen je Status — spiegelt die Übergänge der RPC. */
export function handoffActions(status: BotHandoffStatus): BotHandoffAction[] {
  switch (status) {
    case 'requested': return ['accept', 'resolve'];
    case 'accepted':  return ['resolve'];
    default:          return ['request'];
  }
}

export const HANDOFF_ACTION_LABEL: Record<BotHandoffAction, string> = {
  request: 'An Mensch übergeben',
  accept: 'Übernehmen',
  resolve: 'Erledigt',
};

const RANK: Record<BotHandoffStatus, number> = { requested: 0, accepted: 1, none: 2, resolved: 2 };

/**
 * Offene Übergaben zuerst (angefordert vor in Bearbeitung), danach die
 * bestehende Reihenfolge (letzte Nachricht). Stabil, verändert die Eingabe nicht.
 */
export function sortForInbox<T extends Pick<BotConversation, 'handoff_status'>>(convos: T[]): T[] {
  return convos
    .map((c, i) => ({ c, i }))
    .sort((a, b) => RANK[handoffStatusOf(a.c)] - RANK[handoffStatusOf(b.c)] || a.i - b.i)
    .map(({ c }) => c);
}
