import { describe, it, expect } from 'vitest';
import {
  countInbox, formatCount, summarizeBots, summarizeSites, INBOX_FETCH_LIMIT,
} from '../../../src/features/betrieb/betriebSummary';
import type { Bot, BotAppointment, BotConversation, BotOrder } from '../../../src/features/bots/types';
import type { SiteOverviewRow } from '../../../src/features/siteos/siteOsApi';

const site = (p: Partial<SiteOverviewRow>): SiteOverviewRow => ({
  slug: 's', name: 'Seite', industry: 'handwerk', blueprint_id: 'b', version: 1, status: 'draft',
  content_sha256: 'x', created_at: '2026-11-01T00:00:00Z', health: null, risk: null, compliance: null,
  performance: null, ai_risk: null, severity_max: null, last_scan_at: null, ...p,
} as SiteOverviewRow);

describe('summarizeSites', () => {
  it('leer bei keinen Seiten', () => {
    expect(summarizeSites([])).toEqual([]);
  });

  it('blendet archivierte Seiten aus und sortiert neueste zuerst', () => {
    const out = summarizeSites([
      site({ slug: 'alt', created_at: '2026-10-01T00:00:00Z', status: 'deployed' }),
      site({ slug: 'neu', created_at: '2026-11-20T00:00:00Z' }),
      site({ slug: 'weg', status: 'archived' }),
    ]);
    expect(out.map((s) => s.slug)).toEqual(['neu', 'alt']);
    expect(out[0].statusLabel).toBe('Entwurf');
    expect(out[1].statusLabel).toBe('Veröffentlicht');
  });

  it('Bearbeiten-Pfad zeigt auf den bestehenden Editor und ist kodiert', () => {
    const [s] = summarizeSites([site({ slug: 'mein betrieb' })]);
    expect(s.editPath).toBe('/builder/mein%20betrieb');
  });

  it('nutzt den Slug, wenn kein Name gesetzt ist', () => {
    const [s] = summarizeSites([site({ slug: 'ohne-name', name: '' })]);
    expect(s.name).toBe('ohne-name');
  });
});

describe('summarizeBots', () => {
  it('leer bei keinen Bots', () => {
    expect(summarizeBots([])).toEqual([]);
  });

  it('übernimmt Kanal, Aktivstatus und Editor-Pfad', () => {
    const [b] = summarizeBots([{ id: 'b1', name: 'Empfang', channel: 'voice', enabled: false } as Bot]);
    expect(b).toEqual({ id: 'b1', name: 'Empfang', channel: 'voice', enabled: false, editPath: '/app/bots/b1' });
  });
});

describe('countInbox', () => {
  const conv = (status: BotConversation['status']) => ({ status } as BotConversation);
  const appt = (status: BotAppointment['status']) => ({ status } as BotAppointment);
  const order = (status: BotOrder['status']) => ({ status } as BotOrder);

  it('zählt nur offene Gespräche, angefragte Termine und neue Bestellungen', () => {
    const c = countInbox(
      [conv('open'), conv('open'), conv('closed')],
      [appt('requested'), appt('confirmed'), appt('cancelled')],
      [order('new'), order('confirmed'), order('fulfilled'), order('new')],
    );
    expect(c).toEqual({ openConversations: 2, requestedAppointments: 1, newOrders: 2, truncated: false });
  });

  it('alles null bei leeren Listen', () => {
    expect(countInbox([], [], [])).toEqual({
      openConversations: 0, requestedAppointments: 0, newOrders: 0, truncated: false,
    });
  });

  it('markiert abgeschnittene Abfragen', () => {
    const many = Array.from({ length: INBOX_FETCH_LIMIT }, () => order('new'));
    expect(countInbox([], [], many).truncated).toBe(true);
  });
});

describe('formatCount', () => {
  it('zeigt die Zahl ohne Kürzung', () => {
    expect(formatCount(3, false)).toBe('3');
  });
  it('kennzeichnet abgeschnittene Zählung', () => {
    expect(formatCount(3, true)).toBe('mind. 3');
  });
  it('null bleibt null, auch bei abgeschnittener Abfrage anderer Listen', () => {
    expect(formatCount(0, true)).toBe('0');
  });
});
