// Datenschicht für das Bots-Feature.
//
// Lesepfade + Bot-CRUD laufen direkt über PostgREST; RLS erzwingt die
// Tenant-Scope-Prüfung (is_tenant_member). Bot-Konversationen, -Nachrichten,
// -Termine und -Bestellungen werden von den öffentlichen Edge Functions
// (Service-Role) geschrieben und hier nur gelesen.

import { getSupabase } from '../../lib/supabase';
import type {
  Bot, BotConversation, BotMessage, BotAppointment, BotOrder,
  CreateBotArgs, UpdateBotArgs,
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

export async function listConversations(tenant_id: string, limit = 100): Promise<BotConversation[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('bot_conversations').select('*')
    .eq('tenant_id', tenant_id)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`listConversations: ${error.message}`);
  return (data ?? []) as BotConversation[];
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
