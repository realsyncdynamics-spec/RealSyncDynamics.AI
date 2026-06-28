// Typen für das Bots-Feature (Frontend).
// Spiegelt die Tabellen aus 20260628120000_bots_foundation.sql.

export type BotChannel = 'chat' | 'voice' | 'telegram' | 'whatsapp';

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
  config: Record<string, unknown>;
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
  status: 'open' | 'closed';
  metadata: Record<string, unknown>;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
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
  name: string;
  qty?: number;
  price?: number;
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
  enabled?: boolean;
}

export type UpdateBotArgs = Partial<Omit<Bot, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>;
