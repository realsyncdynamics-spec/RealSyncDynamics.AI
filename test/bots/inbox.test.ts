/**
 * PR C, Schritt 4 — reine Logik des Posteingangs (src/features/bots/inbox.ts).
 *
 * Die Statusmaschine selbst liegt in Postgres und ist in
 * test/runtime/db/inbox-handoff.db.test.ts geprüft. Hier geht es darum, dass
 * die Oberfläche nur anbietet, was der Server erlaubt, und Antworten ehrlich
 * wiedergibt.
 */
import { describe, expect, it } from 'vitest';
import {
  ACTION_LABEL, INBOX_FILTERS, availableAction, bindingBlockers, canManageBindings,
  channelLabel, conversationTitle, isMissingSchemaError, rpcFeedback, statusLabel,
  statusTone, statusesForFilter,
} from '../../src/features/bots/inbox';

describe('Status und Filter', () => {
  it('„Neu“ ist der Bestandswert open (E10), kein eigener Wert', () => {
    expect(statusLabel('open')).toBe('Neu');
    expect(statusLabel('in_bearbeitung')).toBe('In Bearbeitung');
    expect(statusLabel('erledigt')).toBe('Erledigt');
    expect(statusLabel('closed')).toBe('Geschlossen');
    expect(statusesForFilter('open')).toEqual(['open']);
  });

  it('Standardfilter „Offen“ umfasst Neu und In Bearbeitung, nicht Erledigt', () => {
    expect(INBOX_FILTERS[0].id).toBe('aktiv');
    expect(statusesForFilter('aktiv')).toEqual(['open', 'in_bearbeitung']);
    expect(statusesForFilter('erledigt')).toEqual(['erledigt']);
    expect(statusesForFilter('alle')).toBeNull();
  });

  it('unbekannte Werte werden unverändert angezeigt statt verschluckt', () => {
    expect(statusLabel('irgendwas')).toBe('irgendwas');
    expect(channelLabel('fax')).toBe('fax');
  });

  it('Statusfarben sind semantisch getrennt', () => {
    expect(statusTone('open')).toBe('attention');
    expect(statusTone('in_bearbeitung')).toBe('progress');
    expect(statusTone('erledigt')).toBe('done');
    expect(statusTone('closed')).toBe('muted');
  });

  it('Kanal form heißt „Formular“', () => {
    expect(channelLabel('form')).toBe('Formular');
    expect(channelLabel('voice')).toBe('Telefon');
  });
});

describe('Übergabe-Aktionen folgen der Statusmaschine', () => {
  it('open → Übernehmen, in_bearbeitung → Erledigen, sonst nichts', () => {
    expect(availableAction('open')).toBe('take_over');
    expect(availableAction('in_bearbeitung')).toBe('resolve');
    expect(availableAction('erledigt')).toBeNull();
    expect(availableAction('closed')).toBeNull();
    expect(ACTION_LABEL.take_over).toBe('Übernehmen');
  });

  it('ok wird bestätigt', () => {
    expect(rpcFeedback('take_over', 'ok').tone).toBe('ok');
    expect(rpcFeedback('resolve', 'ok').text).toMatch(/erledigt/);
  });

  it('conflict sagt, dass jemand anderes schneller war', () => {
    const f = rpcFeedback('take_over', 'conflict');
    expect(f.tone).toBe('warn');
    expect(f.text).toMatch(/schon übernommen/);
    expect(rpcFeedback('resolve', 'conflict').tone).toBe('warn');
  });

  it('not_found unterscheidet nicht zwischen fremd und unbekannt', () => {
    expect(rpcFeedback('take_over', 'not_found')).toEqual({ tone: 'error', text: 'Anfrage nicht gefunden oder kein Zugriff.' });
  });

  it('unerwartete Antworten gelten nicht als Erfolg', () => {
    expect(rpcFeedback('take_over', 'maybe').tone).toBe('error');
  });
});

describe('Titel einer Anfrage', () => {
  const base = { contact_label: null, external_ref: null, channel: 'chat' as const };

  it('Name aus dem Intake hat Vorrang', () => {
    expect(conversationTitle({ ...base, contact_label: 'Label' }, '  Erika Muster ')).toBe('Erika Muster');
  });

  it('Formular-Nonce wird nie als Name angezeigt', () => {
    expect(conversationTitle({ ...base, channel: 'form', external_ref: 'form:abcdefghijklmnop' })).toBe('Formular-Anfrage');
  });

  it('fällt auf contact_label, dann external_ref, dann „Anonym“ zurück', () => {
    expect(conversationTitle({ ...base, contact_label: 'Kunde A' })).toBe('Kunde A');
    expect(conversationTitle({ ...base, external_ref: '+49 30 1' })).toBe('+49 30 1');
    expect(conversationTitle(base)).toBe('Anonym');
  });
});

describe('Fehlende Migration wird erkannt, echte Fehler nicht', () => {
  it('fehlende Tabelle/Funktion', () => {
    expect(isMissingSchemaError('listIntakes: relation "public.bot_conversation_intake" does not exist')).toBe(true);
    expect(isMissingSchemaError("listSiteInboxBindings: Could not find the table 'public.site_inbox_bindings' in the schema cache")).toBe(true);
    expect(isMissingSchemaError('PGRST205')).toBe(true);
  });

  it('Rechte- und Netzwerkfehler bleiben Fehler', () => {
    expect(isMissingSchemaError('new row violates row-level security policy for table "site_inbox_bindings"')).toBe(false);
    expect(isMissingSchemaError('Failed to fetch')).toBe(false);
  });
});

describe('Binding-Panel', () => {
  it('nur Owner/Admin dürfen verwalten (= RLS-Policy)', () => {
    expect(canManageBindings('owner')).toBe(true);
    expect(canManageBindings('admin')).toBe(true);
    expect(canManageBindings('editor')).toBe(false);
    expect(canManageBindings('viewer_auditor')).toBe(false);
    expect(canManageBindings(null)).toBe(false);
  });

  it('spiegelt die fail-closed-Bedingungen von resolve_site_inbox', () => {
    expect(bindingBlockers({ enabled: true }, { status: 'live' }, { enabled: true })).toEqual([]);
    expect(bindingBlockers({ enabled: false }, { status: 'live' }, { enabled: true })).toHaveLength(1);
    expect(bindingBlockers({ enabled: true }, { status: 'draft' }, { enabled: true })[0]).toMatch(/nicht veröffentlicht/);
    expect(bindingBlockers({ enabled: true }, { status: 'live' }, { enabled: false })[0]).toMatch(/deaktiviert/);
    expect(bindingBlockers({ enabled: false }, undefined, undefined)).toHaveLength(3);
  });
});
