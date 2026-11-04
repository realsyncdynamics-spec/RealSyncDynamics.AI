/**
 * Übergabe an Menschen (AI Receptionist, K4 PR C):
 * Erkennung, Marker, Persistenz-Scope, Prompt-Opt-in und Verdrahtung.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  HANDOFF_MARKER, detectHandoffRequest, extractHandoffMarker, markHandoffRequested,
  type HandoffAdmin,
} from '../../supabase/functions/_shared/bot-handoff';
import { buildBotPrompt } from '../../supabase/functions/_shared/bots';

describe('detectHandoffRequest', () => {
  it.each([
    'Kann ich bitte mit einem Menschen sprechen?',
    'Ich möchte mit dem Chef reden.',
    'Bitte mit einem Mitarbeiter verbinden',
    'Ich will mit jemandem sprechen, der Ahnung hat',
    'Bitte um Rückruf unter 0151 1234567',
    'Können Sie mich zurückrufen?',
    'Ruf mich bitte zurück',
    'Ich will keinen Bot',
    'Gibt es da eine echte Person?',
    'Can I speak to a human?',
    'please call me back',
  ])('erkennt „%s“', (text: string) => {
    expect(detectHandoffRequest(text)).toBe(true);
  });

  it.each([
    'Wie viele Mitarbeiter habt ihr?',
    'Habt ihr am Samstag offen?',
    'Meine Heizung ist kaputt, wann könnt ihr kommen?',
    'Die Menschen in der Nachbarschaft empfehlen euch.',
    '',
  ])('löst bei „%s“ keine Übergabe aus', (text: string) => {
    expect(detectHandoffRequest(text)).toBe(false);
  });
});

describe('extractHandoffMarker', () => {
  it('entfernt den Marker und meldet ihn', () => {
    const out = extractHandoffMarker(`Ein Mitarbeiter meldet sich bei Ihnen. ${HANDOFF_MARKER}`);
    expect(out).toEqual({ reply: 'Ein Mitarbeiter meldet sich bei Ihnen.', flagged: true });
  });

  it('lässt Antworten ohne Marker unverändert', () => {
    expect(extractHandoffMarker('Wir haben Montag bis Freitag offen.'))
      .toEqual({ reply: 'Wir haben Montag bis Freitag offen.', flagged: false });
  });

  it('entfernt mehrfach vorkommende Marker vollständig', () => {
    const out = extractHandoffMarker(`${HANDOFF_MARKER}Hallo${HANDOFF_MARKER}`);
    expect(out.reply).toBe('Hallo');
    expect(out.reply).not.toContain('[[');
  });
});

function fakeAdmin(result: { error?: unknown } | Error) {
  const calls: { table?: string; patch?: Record<string, unknown>; eq: Array<[string, unknown]>; in: Array<[string, unknown[]]> } = { eq: [], in: [] };
  const settled = result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
  settled.catch(() => undefined); // keine unbehandelte Ablehnung vor dem await
  const chain: Record<string, unknown> = {
    eq(col: string, val: unknown) { calls.eq.push([col, val]); return chain; },
    in(col: string, vals: unknown[]) { calls.in.push([col, vals]); return chain; },
    then: settled.then.bind(settled),
  };
  const admin = {
    from(table: string) {
      calls.table = table;
      return { update(patch: Record<string, unknown>) { calls.patch = patch; return chain; } };
    },
  } as unknown as HandoffAdmin;
  return { admin, calls };
}

describe('markHandoffRequested', () => {
  const scope = { tenantId: 't-1', botId: 'b-1', conversationId: 'c-1' };

  it('schreibt nur in die eigene Konversation (Mandant + Bot) und nur ohne offene Übergabe', async () => {
    const { admin, calls } = fakeAdmin({ error: null });
    await expect(markHandoffRequested(admin, scope, 'customer_request')).resolves.toBe(true);
    expect(calls.table).toBe('bot_conversations');
    expect(calls.patch).toMatchObject({ handoff_status: 'requested', handoff_reason: 'customer_request' });
    expect(calls.eq).toEqual(expect.arrayContaining([
      ['id', 'c-1'], ['tenant_id', 't-1'], ['bot_id', 'b-1'],
    ]));
    expect(calls.in).toEqual([['handoff_status', ['none', 'resolved']]]);
  });

  it('meldet Schreibfehler mit false statt zu werfen', async () => {
    const { admin } = fakeAdmin({ error: { message: 'column does not exist' } });
    await expect(markHandoffRequested(admin, scope, 'assistant_uncertain')).resolves.toBe(false);
    const { admin: throwing } = fakeAdmin(new Error('network'));
    await expect(markHandoffRequested(throwing, scope, 'assistant_uncertain')).resolves.toBe(false);
  });
});

describe('buildBotPrompt – Übergabe-Abschnitt', () => {
  it('ist ohne Opt-in nicht enthalten (Voice/Restaurant lesen keinen Marker)', () => {
    const out = buildBotPrompt({ userMessage: 'Hallo' });
    expect(out).not.toContain('[Übergabe an Menschen]');
    expect(out).not.toContain(HANDOFF_MARKER);
  });

  it('enthält Regeln und Marker mit Opt-in; vermerkte Übergabe wird genannt', () => {
    const out = buildBotPrompt({ userMessage: 'Rückruf bitte', handoff: { alreadyRequested: true } });
    expect(out).toContain('[Übergabe an Menschen]');
    expect(out).toContain(HANDOFF_MARKER);
    expect(out).toContain('bereits eingetragen');
    expect(out).toContain('bestätige keinen Termin als gebucht');
    expect(out.indexOf('[Übergabe an Menschen]')).toBeLessThan(out.indexOf('[Neue Nachricht]'));
  });
});

describe('Verdrahtung in bot-chat und whatsapp-webhook', () => {
  const chat = readFileSync('supabase/functions/bot-chat/index.ts', 'utf8');
  const wa = readFileSync('supabase/functions/whatsapp-webhook/index.ts', 'utf8');

  it('bot-chat: Erkennung erst nach PEP-Freigabe und gespeicherter Kundennachricht', () => {
    const pep = chat.indexOf('const verdict = await enforceBotMessage(');
    const userInsert = chat.indexOf("await insertMessage(admin, bot, conversationId, 'user'");
    const detect = chat.indexOf('detectHandoffRequest(message)');
    expect(pep).toBeGreaterThan(-1);
    expect(detect).toBeGreaterThan(userInsert);
    expect(userInsert).toBeGreaterThan(pep);
  });

  it('bot-chat und whatsapp: Marker wird vor Speichern/Versand entfernt', () => {
    expect(chat).toContain('extractHandoffMarker(ai.output)');
    expect(chat).toContain("insertMessage(admin, bot, conversationId, 'assistant', reply,");
    expect(chat).not.toContain('reply: ai.output');
    expect(wa).toContain('extractHandoffMarker(ai.output)');
    expect(wa).toContain('sendWhatsAppText(channel.phone_number_id, msg.from, reply)');
    expect(wa).not.toContain('sendWhatsAppText(channel.phone_number_id, msg.from, ai.output)');
  });

  it('whatsapp: Erkennung nach dem PEP-Block', () => {
    const pep = wa.indexOf('const verdict = await enforceBotMessage(');
    const detect = wa.indexOf('detectHandoffRequest(msg.text)');
    expect(detect).toBeGreaterThan(pep);
  });
});

describe('Migration 20261104120000_bot_conversation_handoff', () => {
  const sql = readFileSync('supabase/migrations/20261104120000_bot_conversation_handoff.sql', 'utf8');

  it('ist rein additiv', () => {
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS handoff_status');
  });

  it('RPC: SECURITY DEFINER mit festem search_path, fail-closed, Mandant aus der Zeile', () => {
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain('SET search_path = public');
    expect(sql).toMatch(/IF v_uid IS NULL THEN\s+RAISE EXCEPTION/);
    expect(sql).toContain('NOT public.is_tenant_member(v_row.tenant_id)');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('handoff_accepted_by = v_uid');
    expect(sql).not.toMatch(/p_tenant_id|p_user_id/);
  });

  it('nur angemeldete Nutzer dürfen die RPC aufrufen', () => {
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.bot_conversation_handoff(UUID, TEXT) FROM PUBLIC;');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.bot_conversation_handoff(UUID, TEXT) FROM anon;');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.bot_conversation_handoff(UUID, TEXT) TO authenticated;');
  });
});
