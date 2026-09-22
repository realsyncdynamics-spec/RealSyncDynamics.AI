import type { BotRow } from './bots.ts';
import {
  executeRestaurantOrder,
  initialRestaurantExecutionState,
  type RestaurantExecutionAdapter,
  type RestaurantExecutionOrder,
  type RestaurantExecutionState,
  type RestaurantExecutionTarget,
  type RestaurantExecutionTargetState,
} from './restaurant-execution.ts';
import {
  createConfiguredRestaurantWebhookAdapter,
  RestaurantWebhookError,
} from './restaurant-webhook.ts';

// Deliberately structural: these shared modules are checked by both Deno and
// the Node/Vitest TypeScript graph. A jsr: type-only import breaks the latter.
interface SupabaseAdmin {
  // Query builders are runtime-validated by the existing Supabase client.
  // deno-lint-ignore no-explicit-any
  from(table: string): any;
  // deno-lint-ignore no-explicit-any
  rpc(name: string, args?: Record<string, unknown>): any;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

interface ExecutionBinding {
  integrationConfigId: string;
  posEnabled: boolean;
  kitchenEnabled: boolean;
}

function bindingFromBot(bot: BotRow): ExecutionBinding | null {
  const restaurant = asRecord(bot.config?.restaurant);
  const execution = asRecord(restaurant?.execution);
  const integrationConfigId = text(execution?.integration_config_id);
  if (!integrationConfigId) return null;

  const posEnabled = execution?.pos_enabled === true;
  const kitchenEnabled = execution?.kitchen_enabled === true;
  if (!posEnabled && !kitchenEnabled) return null;

  return { integrationConfigId, posEnabled, kitchenEnabled };
}

function pendingState(adapterId: string | null): RestaurantExecutionTargetState {
  if (!adapterId) {
    return {
      status: 'not_configured',
      adapter_id: null,
      external_id: null,
      submitted_at: null,
      verified_at: null,
      error_code: null,
    };
  }
  return {
    status: 'pending',
    adapter_id: adapterId,
    external_id: null,
    submitted_at: null,
    verified_at: null,
    error_code: null,
  };
}

function failedAdapter(
  id: string,
  target: RestaurantExecutionTarget,
  code: string,
): RestaurantExecutionAdapter {
  return {
    id,
    target,
    async submit() {
      throw Object.assign(new Error(code), { code });
    },
    async verify() {
      return { status: 'failed', error_code: code };
    },
  };
}

async function loadAdapter(
  admin: SupabaseAdmin,
  bot: BotRow,
  configId: string,
  target: RestaurantExecutionTarget,
): Promise<RestaurantExecutionAdapter> {
  const adapterId = `restaurant-webhook:${configId}:${target}`;
  try {
    return await createConfiguredRestaurantWebhookAdapter(
      admin,
      bot.tenant_id,
      configId,
      target,
    );
  } catch (error) {
    const code = error instanceof RestaurantWebhookError
      ? error.code
      : 'INTEGRATION_LOAD_FAILED';
    return failedAdapter(adapterId, target, code);
  }
}

function parseExistingExecution(value: unknown): RestaurantExecutionState | null {
  const row = asRecord(value);
  if (!row || row.version !== 1) return null;
  const pos = asRecord(row.pos);
  const kitchen = asRecord(row.kitchen);
  const statuses = new Set(['not_configured', 'pending', 'accepted', 'failed']);
  if (!pos || !kitchen || !statuses.has(String(pos.status)) || !statuses.has(String(kitchen.status))) {
    return null;
  }
  return row as unknown as RestaurantExecutionState;
}

function executionStarted(state: RestaurantExecutionState): boolean {
  return state.pos.status !== 'not_configured' || state.kitchen.status !== 'not_configured';
}

export async function executeConfiguredRestaurantOrder(
  admin: SupabaseAdmin,
  bot: BotRow,
  order: RestaurantExecutionOrder,
): Promise<RestaurantExecutionState> {
  const binding = bindingFromBot(bot);
  if (!binding) return initialRestaurantExecutionState();

  const { data: row, error: loadError } = await admin
    .from('bot_orders')
    .select('metadata')
    .eq('id', order.order_id)
    .eq('tenant_id', bot.tenant_id)
    .eq('bot_id', bot.id)
    .maybeSingle();

  if (loadError || !row) return initialRestaurantExecutionState();

  const metadata = asRecord((row as { metadata?: unknown }).metadata) ?? {};
  const existing = parseExistingExecution(metadata.execution) ?? initialRestaurantExecutionState();

  // Nie denselben Auftrag aus einem Retry erneut submitten. Pending/failed/accepted
  // werden später über einen expliziten Retry-/Verify-Pfad weiterbehandelt.
  if (executionStarted(existing)) return existing;

  const posId = binding.posEnabled
    ? `restaurant-webhook:${binding.integrationConfigId}:pos`
    : null;
  const kitchenId = binding.kitchenEnabled
    ? `restaurant-webhook:${binding.integrationConfigId}:kitchen`
    : null;

  const preflight: RestaurantExecutionState = {
    version: 1,
    pos: pendingState(posId),
    kitchen: pendingState(kitchenId),
  };

  // Erst Evidence schreiben, dann Seiteneffekt. Schlägt das fehl, geht kein
  // Request an ein Fremdsystem.
  const { error: preflightError } = await admin
    .from('bot_orders')
    .update({ metadata: { ...metadata, execution: preflight } })
    .eq('id', order.order_id)
    .eq('tenant_id', bot.tenant_id)
    .eq('bot_id', bot.id);

  if (preflightError) return initialRestaurantExecutionState();

  const [pos, kitchen] = await Promise.all([
    binding.posEnabled
      ? loadAdapter(admin, bot, binding.integrationConfigId, 'pos')
      : Promise.resolve(null),
    binding.kitchenEnabled
      ? loadAdapter(admin, bot, binding.integrationConfigId, 'kitchen')
      : Promise.resolve(null),
  ]);

  const result = await executeRestaurantOrder(order, { pos, kitchen });

  // Bei einem finalen DB-Fehler bleibt der zuvor gespeicherte Zustand "pending".
  // Damit wird nie ein externer Erfolg behauptet, der intern nicht belegt ist.
  const { error: finalEvidenceError } = await admin
    .from('bot_orders')
    .update({ metadata: { ...metadata, execution: result } })
    .eq('id', order.order_id)
    .eq('tenant_id', bot.tenant_id)
    .eq('bot_id', bot.id);

  // Externer Erfolg ohne gespeicherten Nachweis darf nicht als bestätigt
  // zurückgegeben werden. Der persistierte Preflight bleibt "pending".
  return finalEvidenceError ? preflight : result;
}


export function restaurantExecutionCustomerNote(state: RestaurantExecutionState): string {
  const active = [
    ['POS', state.pos] as const,
    ['Küche', state.kitchen] as const,
  ].filter(([, target]) => target.status !== 'not_configured');

  if (active.length === 0) return '';

  if (active.every(([, target]) => target.status === 'accepted')) {
    const names = active.map(([name]) => name).join(' und ');
    return ` Die Übergabe an ${names} wurde bestätigt.`;
  }

  return ' Die Bestellung ist in RealSync erfasst; die externe Übergabe ist noch nicht vollständig bestätigt.';
}
