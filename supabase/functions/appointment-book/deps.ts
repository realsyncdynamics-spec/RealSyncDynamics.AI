// Datenbank-Bausteine für appointment-book. Ohne Deno-Imports, damit sie mit
// einem nachgebildeten PostgREST-Client getestet werden können.

import type { AppointmentBot, GateResult, InsertResult, StoredAppointment } from './handler.ts';
import type { AppointmentInput } from './validate.ts';

/** Ausschnitt der supabase-js-Query-API, den diese Datei nutzt. */
export interface QueryBuilder {
  select(cols: string): QueryBuilder;
  eq(col: string, value: unknown): QueryBuilder;
  is(col: string, value: null): QueryBuilder;
  order(col: string, opts: { ascending: boolean }): QueryBuilder;
  limit(n: number): QueryBuilder;
  maybeSingle(): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
  single(): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
  insert(row: Record<string, unknown>): QueryBuilder;
}
export interface TableClient {
  from(table: string): QueryBuilder;
}

/** Entitlement-Gate: nur ein Entitlement-Fehler bedeutet „fehlt“, alles andere wirft weiter. */
export function makeGate(
  call: (bot: AppointmentBot) => Promise<unknown>,
  isEntitlementError: (e: unknown) => boolean,
): (bot: AppointmentBot) => Promise<GateResult> {
  return async (bot) => {
    try {
      await call(bot);
      return 'ok';
    } catch (e) {
      if (isEntitlementError(e)) return 'missing';
      throw e;
    }
  };
}

/**
 * Konversation holen oder anlegen. Scheitert das Anlegen, weil eine
 * gleichzeitige Anfrage sie gerade angelegt hat, wird sie neu gelesen.
 */
export function makeUpsertConversation(
  upsert: (bot: AppointmentBot, externalRef: string, contactLabel: string) => Promise<string>,
  findExisting: (bot: AppointmentBot, externalRef: string) => Promise<string | null>,
): (bot: AppointmentBot, externalRef: string, contactLabel: string) => Promise<string> {
  return async (bot, externalRef, contactLabel) => {
    try {
      return await upsert(bot, externalRef, contactLabel);
    } catch (e) {
      const existing = await findExisting(bot, externalRef);
      if (existing) return existing;
      throw e;
    }
  };
}

/** Offene Anfrage mit derselben Regel wie der Unique-Index (Migration 20261125190000). */
export function makeFindDuplicate(admin: TableClient) {
  return async (bot: AppointmentBot, conversationId: string, input: AppointmentInput): Promise<StoredAppointment | null> => {
    let q = admin.from('bot_appointments')
      .select('id, status')
      .eq('tenant_id', bot.tenant_id)
      .eq('bot_id', bot.id)
      .eq('conversation_id', conversationId)
      .eq('customer_name', input.customerName)
      .eq('status', 'requested');
    q = input.requestedAt ? q.eq('requested_at', input.requestedAt) : q.is('requested_at', null);
    const { data, error } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(`duplicate lookup failed: ${error.message}`);
    return (data as StoredAppointment | null) ?? null;
  };
}

/** Termin anlegen; 23505 am Unique-Index → { conflict: true }. Mandant immer aus dem Bot. */
export function makeInsertAppointment(admin: TableClient) {
  return async (bot: AppointmentBot, conversationId: string | null, input: AppointmentInput): Promise<InsertResult> => {
    const { data, error } = await admin.from('bot_appointments').insert({
      tenant_id: bot.tenant_id,
      bot_id: bot.id,
      conversation_id: conversationId,
      customer_name: input.customerName,
      contact: input.contact,
      service: input.service,
      requested_at: input.requestedAt,
      notes: input.notes,
      metadata: { source: 'bot' },
    }).select('id, status').single();
    if (error && error.code === '23505') return { conflict: true };
    if (error) throw new Error(`insert failed: ${error.message}`);
    return data as StoredAppointment;
  };
}
