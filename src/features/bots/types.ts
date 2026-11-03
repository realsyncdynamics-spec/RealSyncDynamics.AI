// Typen für das Bots-Feature (Frontend).
// Spiegelt die Tabellen aus 20260628120000_bots_foundation.sql.

export type BotChannel = 'chat' | 'voice' | 'telegram' | 'whatsapp' | 'form';

/**
 * Posteingang (PR C, 20261103000000_inbox_handoff.sql):
 *   open (UI „Neu") → in_bearbeitung → erledigt; closed = Bestand.
 * Übergänge nur über die RPCs inbox_take_over / inbox_resolve.
 */
export type BotConversationStatus = 'open' | 'closed' | 'in_bearbeitung' | 'erledigt';
export type InboxRpcResult = 'ok' | 'conflict' | 'not_found';
export type BotVertical = 'general' | 'restaurant';

export interface RestaurantMenuItem {
  id: string;
  name: string;
  price: number;
  available?: boolean;
}

export interface RestaurantBotConfig {
  business_name?: string;
  order_mode?: 'pickup' | 'delivery' | 'both';
  minimum_order?: number;
  delivery_fee?: number;
  estimated_delivery_minutes?: number;
  currency?: string;
  menu?: RestaurantMenuItem[];
}

export interface BotConfig {
  vertical?: BotVertical;
  restaurant?: RestaurantBotConfig;
  [key: string]: unknown;
}

export interface BotCapabilities {
  appointments?: boolean;
  orders?: boolean;
}

export interface Bot {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  channel: BotChannel;
  persona: string | null;
  greeting: string | null;
  capabilities: BotCapabilities;
  config: BotConfig;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface BotConversation {
  id: string;
  tenant_id: string;
  bot_id: string;
  channel: BotChannel;
  external_ref: string | null;
  contact_label: string | null;
  status: BotConversationStatus;
  metadata: Record<string, unknown>;
  last_message_at: string | null;
  assigned_to: string | null;
  handed_off_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 1:1 zur Konversation. Terminwunsch ist ein Wunsch, nie ein bestätigter Termin. */
export interface BotConversationIntake {
  conversation_id: string;
  tenant_id: string;
  anliegen: string | null;
  kontakt_name: string | null;
  kontakt_telefon: string | null;
  kontakt_email: string | null;
  terminwunsch: string | null;
  terminwunsch_zeit: string | null;
  einwilligung_at: string | null;
  quelle: BotChannel;
  created_at: string;
  updated_at: string;
}

/** Seite ↔ Empfangsassistent (20261102220000_site_inbox_bindings.sql). */
export interface SiteInboxBinding {
  id: string;
  tenant_id: string;
  website_project_id: string;
  bot_id: string;
  site_ref: string;
  enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  disabled_at: string | null;
}

export interface BotMessage {
  id: string;
  tenant_id: string;
  conversation_id: string;
  bot_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  run_id: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface BotAppointment {
  id: string;
  tenant_id: string;
  bot_id: string;
  conversation_id: string | null;
  customer_name: string;
  contact: string | null;
  service: string | null;
  requested_at: string | null;
  status: 'requested' | 'confirmed' | 'cancelled';
  notes: string | null;
  created_at: string;
}

export interface BotOrderItem {
  item_id?: string;
  name: string;
  qty?: number;
  price?: number;
  unit_price?: number;
  line_total?: number;
}

export interface BotOrder {
  id: string;
  tenant_id: string;
  bot_id: string;
  conversation_id: string | null;
  customer_name: string;
  contact: string | null;
  items: BotOrderItem[];
  total_amount: number;
  currency: string;
  status: 'new' | 'confirmed' | 'fulfilled' | 'cancelled';
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateBotArgs {
  tenant_id: string;
  name: string;
  description?: string | null;
  channel?: BotChannel;
  persona?: string | null;
  greeting?: string | null;
  capabilities?: BotCapabilities;
  config?: BotConfig;
  enabled?: boolean;
}

export type UpdateBotArgs = Partial<Omit<Bot, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>;

// Spiegelt public.whatsapp_channels (20260826000000_whatsapp_channel.sql):
// Zuordnung Meta-Geschäftsnummer → Bot. Der Webhook (whatsapp-webhook)
// löst eingehende Nachrichten über phone_number_id auf.
export interface WhatsAppChannel {
  id: string;
  tenant_id: string;
  bot_id: string;
  phone_number_id: string;
  display_phone_number: string | null;
  waba_id: string | null;
  greeting: string | null;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateWhatsAppChannelArgs {
  tenant_id: string;
  bot_id: string;
  phone_number_id: string;
  display_phone_number?: string | null;
  waba_id?: string | null;
  greeting?: string | null;
  is_active?: boolean;
}
