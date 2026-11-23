// Reine Zusammenfassungslogik für „Mein Betrieb“ (/app/betrieb).
//
// Keine Datenzugriffe: Die View lädt über die bestehenden Funktionen aus
// `features/bots/api.ts` und `features/siteos/siteOsApi.ts` (RLS greift dort)
// und übergibt die Zeilen hierher. So bleibt die Zähllogik testbar.

import type { Bot, BotAppointment, BotConversation, BotOrder } from '../bots/types';
import type { SiteOverviewRow } from '../siteos/siteOsApi';

/** Obergrenze der Listenabfragen für Eingänge (entspricht dem Default in bots/api.ts). */
export const INBOX_FETCH_LIMIT = 100;

export const SITE_STATUS_LABEL: Record<SiteOverviewRow['status'], string> = {
  draft: 'Entwurf',
  approved: 'Freigegeben',
  deployed: 'Veröffentlicht',
  archived: 'Archiviert',
};

export interface SiteItem {
  slug: string;
  name: string;
  statusLabel: string;
  editPath: string;
}

export interface BotItem {
  id: string;
  name: string;
  channel: Bot['channel'];
  enabled: boolean;
  editPath: string;
}

export interface InboxCounts {
  openConversations: number;
  requestedAppointments: number;
  newOrders: number;
  /** true, wenn mindestens eine Liste die Abfragegrenze erreicht hat. */
  truncated: boolean;
}

/** Aktive Seiten (ohne Archiv), neueste zuerst. */
export function summarizeSites(rows: SiteOverviewRow[]): SiteItem[] {
  return rows
    .filter((r) => r.status !== 'archived')
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
    .map((r) => ({
      slug: r.slug,
      name: r.name || r.slug,
      statusLabel: SITE_STATUS_LABEL[r.status] ?? r.status,
      editPath: `/builder/${encodeURIComponent(r.slug)}`,
    }));
}

export function summarizeBots(bots: Bot[]): BotItem[] {
  return bots.map((b) => ({
    id: b.id,
    name: b.name,
    channel: b.channel,
    enabled: b.enabled,
    editPath: `/app/bots/${encodeURIComponent(b.id)}`,
  }));
}

export function countInbox(
  conversations: BotConversation[],
  appointments: BotAppointment[],
  orders: BotOrder[],
  limit = INBOX_FETCH_LIMIT,
): InboxCounts {
  return {
    openConversations: conversations.filter((c) => c.status === 'open').length,
    requestedAppointments: appointments.filter((a) => a.status === 'requested').length,
    newOrders: orders.filter((o) => o.status === 'new').length,
    truncated: conversations.length >= limit || appointments.length >= limit || orders.length >= limit,
  };
}

/** Zahl für die Anzeige; bei abgeschnittener Abfrage ehrlich als „mind.“ kennzeichnen. */
export function formatCount(n: number, truncated: boolean): string {
  return truncated && n > 0 ? `mind. ${n}` : String(n);
}
