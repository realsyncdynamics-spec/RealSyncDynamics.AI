// Datenschicht für das Bots-Feature.
//
// Lesepfade + Bot-CRUD laufen direkt über PostgREST; RLS erzwingt die
// Tenant-Scope-Prüfung (is_tenant_member). Bot-Konversationen, -Nachrichten,
// -Termine und -Bestellungen werden von den öffentlichen Edge Functions
// (Service-Role) geschrieben und hier nur gelesen.

import { getSupabase } from '../../lib/supabase';
import type {
  Bot, BotConversation, BotConversationIntake, BotConversationStatus, BotMessage, BotAppointment, BotOrder,
  CreateBotArgs, UpdateBotArgs, WhatsAppChannel, CreateWhatsAppChannelArgs, InboxRpcResult, SiteInboxBinding,
} from './types';

export async function listBots(tenant_id: string): Promise<Bot[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('bots').select('*')
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listBots: ${error.message}`);
  return (data ?? []) as Bot[];
}

export async function getBot(tenant_id: string, bot_id: string): Promise<Bot | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('bots').select('*')
    .eq('tenant_id', tenant_id).eq('id', bot_id).maybeSingle();
  if (error) throw new Error(`getBot: ${error.message}`);
  return (data as Bot | null) ?? null;
}

export async function createBot(args: CreateBotArgs): Promise<Bot> {
  const sb = getSupabase();
  const { data, error } = await sb.from('bots').insert({
    tenant_id: args.tenant_id,
    name: args.name,
    description: args.description ?? null,
    channel: args.channel ?? 'chat',
    persona: args.persona ?? null,
    greeting: args.greeting ?? null,
    capabilities: args.capabilities ?? { appointments: false, orders: false },
    config: args.config ?? {},
    enabled: args.enabled ?? true,
  }).select('*').single();
  if (error) throw new Error(`createBot: ${error.message}`);
  return data as Bot;
}

export async function updateBot(tenant_id: string, bot_id: string, patch: UpdateBotArgs): Promise<Bot> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('bots').update(patch)
    .eq('tenant_id', tenant_id).eq('id', bot_id)
    .select('*').single();
  if (error) throw new Error(`updateBot: ${error.message}`);
  return data as Bot;
}

export async function deleteBot(tenant_id: string, bot_id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('bots').delete().eq('tenant_id', tenant_id).eq('id', bot_id);
  if (error) throw new Error(`deleteBot: ${error.message}`);
}

export async function listConversations(
  tenant_id: string, limit = 100, status?: BotConversationStatus,
): Promise<BotConversation[]> {
  const sb = getSupabase();
  let q = sb
    .from('bot_conversations').select('*')
    .eq('tenant_id', tenant_id);
  if (status) q = q.eq('status', status);
  const { data, error } = await q
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`listConversations: ${error.message}`);
  return (data ?? []) as BotConversation[];
}

// ── Posteingang (PR C) ─────────────────────────────────────────────────────
// Statuswechsel laufen ausschliesslich über die RPCs (Compare-and-Set, Prüfpfad);
// ein direktes UPDATE der Inbox-Felder sperrt der DB-Guard auch für Owner/Admin.

export async function getConversationIntake(
  tenant_id: string, conversation_id: string,
): Promise<BotConversationIntake | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('bot_conversation_intake').select('*')
    .eq('tenant_id', tenant_id).eq('conversation_id', conversation_id)
    .maybeSingle();
  if (error) throw new Error(`getConversationIntake: ${error.message}`);
  return (data ?? null) as BotConversationIntake | null;
}

async function inboxRpc(fn: 'inbox_take_over' | 'inbox_resolve', conversation_id: string): Promise<InboxRpcResult> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc(fn, { p_conversation_id: conversation_id });
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data === 'ok' || data === 'conflict' ? data : 'not_found';
}

/** open → in_bearbeitung; Zuständigkeit = angemeldete Person. */
export const takeOverConversation = (conversation_id: string) => inboxRpc('inbox_take_over', conversation_id);
/** in_bearbeitung → erledigt. */
export const resolveConversation = (conversation_id: string) => inboxRpc('inbox_resolve', conversation_id);

// ── Seite ↔ Empfangsassistent (site_inbox_bindings) ────────────────────────
// Lesen jedes Mitglied; Anlegen/Ändern nur Owner/Admin (RLS + Guard). Kein
// DELETE — Abschalten über enabled = false. site_ref entsteht nur in der DB.

export async function listSiteInboxBindings(tenant_id: string): Promise<SiteInboxBinding[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('site_inbox_bindings').select('*')
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listSiteInboxBindings: ${error.message}`);
  return (data ?? []) as SiteInboxBinding[];
}

export async function createSiteInboxBinding(args: {
  tenant_id: string; website_project_id: string; bot_id: string; enabled?: boolean;
}): Promise<SiteInboxBinding> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('site_inbox_bindings')
    .insert({
      tenant_id: args.tenant_id,
      website_project_id: args.website_project_id,
      bot_id: args.bot_id,
      enabled: args.enabled ?? false,
    })
    .select('*').single();
  if (error) throw new Error(`createSiteInboxBinding: ${error.message}`);
  return data as SiteInboxBinding;
}

export async function updateSiteInboxBinding(
  tenant_id: string, binding_id: string, patch: { bot_id?: string; enabled?: boolean },
): Promise<SiteInboxBinding> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('site_inbox_bindings').update(patch)
    .eq('tenant_id', tenant_id).eq('id', binding_id)
    .select('*').single();
  if (error) throw new Error(`updateSiteInboxBinding: ${error.message}`);
  return data as SiteInboxBinding;
}

export async function listMessages(tenant_id: string, conversation_id: string): Promise<BotMessage[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('bot_messages').select('*')
    .eq('tenant_id', tenant_id).eq('conversation_id', conversation_id)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`listMessages: ${error.message}`);
  return (data ?? []) as BotMessage[];
}

export async function listAppointments(tenant_id: string, limit = 100): Promise<BotAppointment[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('bot_appointments').select('*')
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listAppointments: ${error.message}`);
  return (data ?? []) as BotAppointment[];
}

export async function listOrders(tenant_id: string, limit = 100): Promise<BotOrder[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('bot_orders').select('*')
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listOrders: ${error.message}`);
  return (data ?? []) as BotOrder[];
}

export async function setAppointmentStatus(
  tenant_id: string, appointment_id: string, status: BotAppointment['status'],
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from('bot_appointments').update({ status })
    .eq('tenant_id', tenant_id).eq('id', appointment_id);
  if (error) throw new Error(`setAppointmentStatus: ${error.message}`);
}

export async function setOrderStatus(
  tenant_id: string, order_id: string, status: BotOrder['status'],
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from('bot_orders').update({ status })
    .eq('tenant_id', tenant_id).eq('id', order_id);
  if (error) throw new Error(`setOrderStatus: ${error.message}`);
}

// ── WhatsApp-Kanäle ────────────────────────────────────────────────────────
// Schreibzugriff erlaubt RLS nur Owner/Admin (Verknüpfen einer Geschäfts-
// nummer ist eine Governance-Entscheidung); Lesen jedes Tenant-Mitglied.

export async function listWhatsAppChannels(tenant_id: string): Promise<WhatsAppChannel[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('whatsapp_channels').select('*')
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listWhatsAppChannels: ${error.message}`);
  return (data ?? []) as WhatsAppChannel[];
}

export async function createWhatsAppChannel(args: CreateWhatsAppChannelArgs): Promise<WhatsAppChannel> {
  const sb = getSupabase();
  const { data, error } = await sb.from('whatsapp_channels').insert({
    tenant_id: args.tenant_id,
    bot_id: args.bot_id,
    phone_number_id: args.phone_number_id,
    display_phone_number: args.display_phone_number ?? null,
    waba_id: args.waba_id ?? null,
    greeting: args.greeting ?? null,
    is_active: args.is_active ?? false,
  }).select('*').single();
  if (error) throw new Error(`createWhatsAppChannel: ${error.message}`);
  return data as WhatsAppChannel;
}

export async function setWhatsAppChannelActive(
  tenant_id: string, channel_id: string, is_active: boolean,
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from('whatsapp_channels').update({ is_active })
    .eq('tenant_id', tenant_id).eq('id', channel_id);
  if (error) throw new Error(`setWhatsAppChannelActive: ${error.message}`);
}

export async function deleteWhatsAppChannel(tenant_id: string, channel_id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from('whatsapp_channels').delete()
    .eq('tenant_id', tenant_id).eq('id', channel_id);
  if (error) throw new Error(`deleteWhatsAppChannel: ${error.message}`);
}
