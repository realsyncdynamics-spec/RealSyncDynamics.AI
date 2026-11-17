// Reine Hilfsfunktionen für den Posteingang (/app/bots/inbox).
// Keine React-, Supabase- oder Netzwerkabhängigkeiten, damit sie isoliert
// testbar bleiben (test/bots/inboxLogic.test.ts).

import type { BotAppointment, BotConversation, BotOrder } from './types';

export type StatusTone = 'open' | 'done' | 'closed';

const APPOINTMENT_LABELS: Record<BotAppointment['status'], string> = {
  requested: 'Terminwunsch offen',
  confirmed: 'Als bestätigt markiert',
  cancelled: 'Abgelehnt',
};

const ORDER_LABELS: Record<BotOrder['status'], string> = {
  new: 'Neu',
  confirmed: 'Bestätigt',
  fulfilled: 'Erfüllt',
  cancelled: 'Storniert',
};

const CONVERSATION_LABELS: Record<BotConversation['status'], string> = {
  open: 'Offen',
  closed: 'Abgeschlossen',
};

const CHANNEL_LABELS: Record<string, string> = {
  chat: 'Web-Chat',
  voice: 'Telefon',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
};

/** Deutsche Anzeige für einen Termin-Status; unbekannte Werte bleiben sichtbar. */
export function appointmentStatusLabel(status: string): string {
  return (APPOINTMENT_LABELS as Record<string, string>)[status] ?? status;
}

/** Deutsche Anzeige für einen Bestell-Status; unbekannte Werte bleiben sichtbar. */
export function orderStatusLabel(status: string): string {
  return (ORDER_LABELS as Record<string, string>)[status] ?? status;
}

/** Deutsche Anzeige für einen Konversations-Status. */
export function conversationStatusLabel(status: string): string {
  return (CONVERSATION_LABELS as Record<string, string>)[status] ?? status;
}

/** Lesbarer Kanalname (Telefon statt „voice“). */
export function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

/**
 * Farbton eines Status: „open“ braucht eine menschliche Entscheidung,
 * „done“ ist erledigt, „closed“ ist abgelehnt/storniert/abgeschlossen.
 * Unbekannte Werte gelten als offen, damit nichts still untergeht.
 */
export function statusTone(status: string): StatusTone {
  if (status === 'confirmed' || status === 'fulfilled') return 'done';
  if (status === 'cancelled' || status === 'closed') return 'closed';
  return 'open';
}

/** Anzahl der Einträge, die auf eine menschliche Entscheidung warten. */
export function openCounts(
  appointments: readonly Pick<BotAppointment, 'status'>[] | null | undefined,
  orders: readonly Pick<BotOrder, 'status'>[] | null | undefined,
): { appointments: number; orders: number } {
  return {
    appointments: (appointments ?? []).filter((a) => a.status === 'requested').length,
    orders: (orders ?? []).filter((o) => o.status === 'new').length,
  };
}

function timeOf(ts: string | null | undefined): number {
  if (!ts) return 0;
  const t = Date.parse(ts);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Offene Terminwünsche zuerst, innerhalb jeder Gruppe die neuesten zuerst.
 * Gibt eine neue Liste zurück und verändert die Eingabe nicht.
 */
export function sortAppointmentsOpenFirst<T extends Pick<BotAppointment, 'status' | 'created_at'>>(
  appointments: readonly T[],
): T[] {
  return [...appointments].sort((a, b) => {
    const aOpen = a.status === 'requested' ? 0 : 1;
    const bOpen = b.status === 'requested' ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    return timeOf(b.created_at) - timeOf(a.created_at);
  });
}

/** Terminwünsche, die aus einer bestimmten Konversation entstanden sind. */
export function appointmentsForConversation<T extends Pick<BotAppointment, 'conversation_id'>>(
  appointments: readonly T[] | null | undefined,
  conversationId: string,
): T[] {
  return (appointments ?? []).filter((a) => a.conversation_id === conversationId);
}

/** Anzeigename des Kontakts einer Konversation. */
export function contactLabel(c: Pick<BotConversation, 'contact_label' | 'external_ref'>): string {
  const label = c.contact_label?.trim();
  if (label) return label;
  const ref = c.external_ref?.trim();
  if (ref) return ref;
  return 'Unbekannter Kontakt';
}

/**
 * Wirft, wenn ein Update keine Zeile getroffen hat. PostgREST meldet ein von
 * RLS gefiltertes Update nicht als Fehler, sondern liefert 0 Zeilen — ohne
 * diese Prüfung sähe ein verweigertes Speichern wie ein erfolgreiches aus.
 */
export function assertUpdated(rows: readonly unknown[] | null | undefined, fn: string): void {
  if (!rows || rows.length === 0) {
    throw new Error(`${fn}: Keine Änderung gespeichert (Eintrag nicht gefunden oder keine Berechtigung).`);
  }
}
