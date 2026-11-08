// inbox-form-submit — Datenzugriff (service_role). Nur hier wird supabase-js
// berührt; handler.ts kennt ausschliesslich das Interface `InboxRepo`.

export interface ResolvedInbox {
  binding_id: string;
  tenant_id: string;
  bot_id: string;
  website_project_id: string;
}

export interface NewConversation {
  tenant_id: string;
  bot_id: string;
  external_ref: string;
  contact_label: string;
  metadata: Record<string, unknown>;
  now: string;
}

export interface NewIntake {
  conversation_id: string;
  tenant_id: string;
  anliegen: string;
  kontakt_name: string | null;
  kontakt_telefon: string | null;
  kontakt_email: string | null;
  terminwunsch: string | null;
  einwilligung_at: string;
}

export type InsertConversationResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'duplicate'; id: string }
  | { ok: false; reason: 'error'; message: string };

export interface InboxRepo {
  /** public.resolve_site_inbox — fail-closed, null wenn nicht aktiv/live. */
  resolveSiteInbox(siteRef: string): Promise<ResolvedInbox | null>;
  /** Konversationen desselben Mandanten mit diesem ip_hash seit `sinceIso`. */
  countRecentByIpHash(tenantId: string, ipHash: string, sinceIso: string): Promise<number>;
  /**
   * Alle Formular-Konversationen dieses Bindings seit `sinceIso` — IP-unabhängig.
   * Zweite Bremse gegen Flooding mit wechselnden Absenderadressen.
   */
  countRecentByBinding(tenantId: string, bindingId: string, sinceIso: string): Promise<number>;
  /** INSERT; bei 23505 auf (bot_id, external_ref) die vorhandene Zeile. */
  insertConversation(c: NewConversation): Promise<InsertConversationResult>;
  insertIntake(i: NewIntake): Promise<{ ok: true } | { ok: false; message: string }>;
  insertUserMessage(m: { tenant_id: string; conversation_id: string; bot_id: string; content: string }): Promise<{ ok: true } | { ok: false; message: string }>;
  /** Kompensation, wenn Intake/Nachricht nach dem Anlegen scheitern. */
  deleteConversation(id: string): Promise<void>;
}

// Minimaler Typ für den Supabase-Client, damit repo.ts ohne jsr-Import bleibt
// und vitest die Datei laden kann. index.ts übergibt den echten Client.
// deno-lint-ignore no-explicit-any
export type AdminClient = any;

export function createSupabaseRepo(admin: AdminClient): InboxRepo {
  return {
    async resolveSiteInbox(siteRef) {
      const { data, error } = await admin.rpc('resolve_site_inbox', { p_site_ref: siteRef });
      if (error) throw new Error(`resolve_site_inbox: ${error.message}`);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || !row.tenant_id || !row.bot_id) return null;
      return {
        binding_id: String(row.binding_id),
        tenant_id: String(row.tenant_id),
        bot_id: String(row.bot_id),
        website_project_id: String(row.website_project_id),
      };
    },

    async countRecentByIpHash(tenantId, ipHash, sinceIso) {
      const { count, error } = await admin
        .from('bot_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('channel', 'form')
        .contains('metadata', { ip_hash: ipHash })
        .gte('created_at', sinceIso);
      if (error) throw new Error(`count: ${error.message}`);
      return count ?? 0;
    },

    async countRecentByBinding(tenantId, bindingId, sinceIso) {
      const { count, error } = await admin
        .from('bot_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('channel', 'form')
        .contains('metadata', { binding_id: bindingId })
        .gte('created_at', sinceIso);
      if (error) throw new Error(`count: ${error.message}`);
      return count ?? 0;
    },

    async insertConversation(c) {
      const { data, error } = await admin
        .from('bot_conversations')
        .insert({
          tenant_id: c.tenant_id,
          bot_id: c.bot_id,
          channel: 'form',
          status: 'open',
          external_ref: c.external_ref,
          contact_label: c.contact_label,
          metadata: c.metadata,
          last_message_at: c.now,
        })
        .select('id')
        .single();
      if (!error && data?.id) return { ok: true, id: String(data.id) };
      if (error?.code === '23505') {
        const { data: existing } = await admin
          .from('bot_conversations')
          .select('id')
          .eq('bot_id', c.bot_id)
          .eq('external_ref', c.external_ref)
          .maybeSingle();
        if (existing?.id) return { ok: false, reason: 'duplicate', id: String(existing.id) };
      }
      return { ok: false, reason: 'error', message: error?.message ?? 'insert failed' };
    },

    async insertIntake(i) {
      const { error } = await admin.from('bot_conversation_intake').insert({ ...i, quelle: 'form' });
      return error ? { ok: false, message: error.message } : { ok: true };
    },

    async insertUserMessage(m) {
      const { error } = await admin
        .from('bot_messages')
        .insert({ ...m, role: 'user', metadata: { source: 'site_form' } });
      return error ? { ok: false, message: error.message } : { ok: true };
    },

    async deleteConversation(id) {
      await admin.from('bot_conversations').delete().eq('id', id);
    },
  };
}
