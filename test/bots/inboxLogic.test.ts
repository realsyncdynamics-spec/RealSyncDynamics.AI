/**
 * Posteingang des AI Receptionist (/app/bots/inbox) — reine Hilfslogik.
 *
 * Geprüft wird, was der Betrieb sieht: deutsche Status statt Rohwerte,
 * offene Terminwünsche zuerst, Zähler für „wartet auf Entscheidung“ und dass
 * ein von RLS still verweigertes Update als Fehler sichtbar wird.
 */
import { describe, expect, it } from 'vitest';
import {
  appointmentStatusLabel, orderStatusLabel, conversationStatusLabel, channelLabel,
  statusTone, openCounts, sortAppointmentsOpenFirst, appointmentsForConversation,
  contactLabel, assertUpdated, nextHumanReview, sortConversationsForReview,
} from '../../src/features/bots/inboxLogic';

describe('Status-Beschriftung', () => {
  it('zeigt Terminstatus auf Deutsch und verspricht keine Kundenzusage', () => {
    expect(appointmentStatusLabel('requested')).toBe('Terminwunsch offen');
    expect(appointmentStatusLabel('confirmed')).toBe('Als bestätigt markiert');
    expect(appointmentStatusLabel('cancelled')).toBe('Abgelehnt');
  });

  it('zeigt Bestell- und Konversationsstatus auf Deutsch', () => {
    expect(orderStatusLabel('new')).toBe('Neu');
    expect(orderStatusLabel('fulfilled')).toBe('Erfüllt');
    expect(conversationStatusLabel('open')).toBe('Offen');
    expect(conversationStatusLabel('closed')).toBe('Abgeschlossen');
  });

  it('lässt unbekannte Werte sichtbar statt sie zu verschlucken', () => {
    expect(appointmentStatusLabel('rescheduled')).toBe('rescheduled');
    expect(orderStatusLabel('')).toBe('');
  });

  it('benennt Kanäle verständlich', () => {
    expect(channelLabel('voice')).toBe('Telefon');
    expect(channelLabel('whatsapp')).toBe('WhatsApp');
    expect(channelLabel('sms')).toBe('sms');
  });
});

describe('statusTone', () => {
  it('trennt offen, erledigt und geschlossen', () => {
    expect(statusTone('requested')).toBe('open');
    expect(statusTone('new')).toBe('open');
    expect(statusTone('confirmed')).toBe('done');
    expect(statusTone('fulfilled')).toBe('done');
    expect(statusTone('cancelled')).toBe('closed');
    expect(statusTone('closed')).toBe('closed');
  });

  it('behandelt unbekannte Status als offen (nichts geht still unter)', () => {
    expect(statusTone('irgendwas')).toBe('open');
  });
});

describe('openCounts', () => {
  it('zählt nur Einträge, die eine menschliche Entscheidung brauchen', () => {
    expect(openCounts(
      [{ status: 'requested' }, { status: 'confirmed' }, { status: 'requested' }, { status: 'cancelled' }],
      [{ status: 'new' }, { status: 'fulfilled' }],
    )).toEqual({ appointments: 2, orders: 1 });
  });

  it('kommt mit fehlenden Daten (noch nicht geladen) zurecht', () => {
    expect(openCounts(null, undefined)).toEqual({ appointments: 0, orders: 0 });
  });
});

describe('sortAppointmentsOpenFirst', () => {
  const rows = [
    { id: 'a', status: 'confirmed' as const, created_at: '2026-11-17T10:00:00Z' },
    { id: 'b', status: 'requested' as const, created_at: '2026-11-15T10:00:00Z' },
    { id: 'c', status: 'requested' as const, created_at: '2026-11-16T10:00:00Z' },
    { id: 'd', status: 'cancelled' as const, created_at: '2026-11-18T10:00:00Z' },
  ];

  it('zeigt offene Terminwünsche zuerst, jeweils neueste oben', () => {
    expect(sortAppointmentsOpenFirst(rows).map((r) => r.id)).toEqual(['c', 'b', 'd', 'a']);
  });

  it('verändert die Eingabe nicht', () => {
    const before = rows.map((r) => r.id);
    sortAppointmentsOpenFirst(rows);
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});

describe('appointmentsForConversation', () => {
  it('liefert nur Terminwünsche der gewählten Anfrage', () => {
    const rows = [
      { id: '1', conversation_id: 'k1' },
      { id: '2', conversation_id: 'k2' },
      { id: '3', conversation_id: null },
      { id: '4', conversation_id: 'k1' },
    ];
    expect(appointmentsForConversation(rows, 'k1').map((r) => r.id)).toEqual(['1', '4']);
    expect(appointmentsForConversation(null, 'k1')).toEqual([]);
  });
});

describe('contactLabel', () => {
  it('nimmt Kontaktnamen, sonst externe Referenz, sonst einen klaren Platzhalter', () => {
    expect(contactLabel({ contact_label: ' Familie Weber ', external_ref: '+49 170' })).toBe('Familie Weber');
    expect(contactLabel({ contact_label: '  ', external_ref: '+49 170' })).toBe('+49 170');
    expect(contactLabel({ contact_label: null, external_ref: null })).toBe('Unbekannter Kontakt');
  });
});

describe('assertUpdated', () => {
  it('akzeptiert ein Update mit getroffener Zeile', () => {
    expect(() => assertUpdated([{ id: 'x' }], 'setAppointmentStatus')).not.toThrow();
  });

  it('macht ein von RLS still gefiltertes Update (0 Zeilen) sichtbar', () => {
    expect(() => assertUpdated([], 'setAppointmentStatus')).toThrow(/Keine Änderung gespeichert/);
    expect(() => assertUpdated(null, 'setOrderStatus')).toThrow(/setOrderStatus/);
  });
});

describe('AI-Receptionist: nächste menschliche Entscheidung', () => {
  const appointment = (conversation_id: string, status: 'requested' | 'confirmed' | 'cancelled') => ({ conversation_id, status });
  const conversation = (id: string, status: 'open' | 'closed', last_message_at = '2026-11-19T10:00:00Z') => ({ id, status, last_message_at });

  it('zeigt einen Terminwunsch nur als zu prüfen, nicht als gebucht', () => {
    const step = nextHumanReview(conversation('c1', 'open'), [appointment('c1', 'requested')]);
    expect(step.kind).toBe('appointment');
    expect(step.label).toBe('Terminwunsch prüfen');
    expect(step.explanation).toMatch(/nicht nachgewiesen/);
  });

  it('verwechselt die eigene Bestätigung nicht mit menschlicher Übernahme', () => {
    const step = nextHumanReview(conversation('c1', 'open'), [appointment('c1', 'confirmed')]);
    expect(step.kind).toBe('conversation');
    expect(step.explanation).toMatch(/nicht bestätigt/);
  });

  it('zeigt bei nicht geladenen Terminen einen unbestätigten Status an', () => {
    expect(nextHumanReview(conversation('c1', 'closed'), null).kind).toBe('unverified');
    expect(nextHumanReview(conversation('c1', 'closed'), undefined).kind).toBe('unverified');
  });

  it('trennt fremde Konversationen und geschlossene Einträge sauber', () => {
    expect(nextHumanReview(conversation('c1', 'closed'), [appointment('c2', 'requested')]).kind).toBe('none');
  });

  it('behandelt unbekannte Konversationsstatus nicht als erledigt', () => {
    expect(nextHumanReview({ id: 'c1', status: 'unexpected' as 'open' }, []).kind).toBe('conversation');
  });

  it('sortiert offene Terminwünsche zuerst, dann offene Anfragen, dann geschlossene; ohne Mutation', () => {
    const rows = [
      conversation('closed', 'closed', '2026-11-19T12:00:00Z'),
      conversation('inquiry', 'open', '2026-11-19T11:00:00Z'),
      conversation('appointment', 'closed', '2026-11-18T11:00:00Z'),
    ];
    const sorted = sortConversationsForReview(rows, [appointment('appointment', 'requested')]);
    expect(sorted.map((r) => r.id)).toEqual(['appointment', 'inquiry', 'closed']);
    expect(rows.map((r) => r.id)).toEqual(['closed', 'inquiry', 'appointment']);
  });
});
