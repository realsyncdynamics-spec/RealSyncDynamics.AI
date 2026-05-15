import { getSupabase } from '../../lib/supabase';
import type {
  InventoryItem, InventoryLocation, InventorySupplier,
  InventoryStockLevel, InventoryMovement, InventoryBarcode,
  InventoryAuditEvent, MovementKind, AuditAction,
} from './types';

// Thin Supabase wrappers for the Operations Runtime. Every call is
// tenant-scoped via RLS — the client passes the user session, Supabase
// enforces the `tenant_id IN (memberships of auth.uid())` policy server-
// side. We still filter explicitly by tenant_id in queries so the
// resulting query plans are tight + we get clear typing.

async function logAudit(input: {
  tenant_id: string;
  action: AuditAction;
  target_type: string;
  target_id?: string | null;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  reason?: string | null;
}): Promise<void> {
  const sb = getSupabase();
  await sb.from('inventory_audit_events').insert({
    tenant_id:    input.tenant_id,
    action:       input.action,
    target_type:  input.target_type,
    target_id:    input.target_id ?? null,
    old_value:    input.old_value ?? null,
    new_value:    input.new_value ?? null,
    reason:       input.reason ?? null,
    source:       'ui',
  });
}

// ── Items ────────────────────────────────────────────────────────

export async function listItems(tenantId: string): Promise<InventoryItem[]> {
  const sb = getSupabase();
  const { data } = await sb.from('inventory_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name');
  return (data as InventoryItem[] | null) ?? [];
}

export async function createItem(tenantId: string, payload: {
  sku: string; name: string; description?: string; unit?: string; reorder_level?: number;
  default_supplier_id?: string | null;
}): Promise<InventoryItem> {
  const sb = getSupabase();
  const { data, error } = await sb.from('inventory_items').insert({
    tenant_id: tenantId,
    sku:           payload.sku,
    name:          payload.name,
    description:   payload.description ?? null,
    unit:          payload.unit ?? 'pcs',
    reorder_level: payload.reorder_level ?? 0,
    default_supplier_id: payload.default_supplier_id ?? null,
  }).select('*').single();
  if (error) throw new Error(error.message);
  await logAudit({
    tenant_id: tenantId,
    action: 'item.create',
    target_type: 'item',
    target_id: (data as InventoryItem).id,
    new_value: data as unknown as Record<string, unknown>,
  });
  return data as InventoryItem;
}

// ── Locations ────────────────────────────────────────────────────

export async function listLocations(tenantId: string): Promise<InventoryLocation[]> {
  const sb = getSupabase();
  const { data } = await sb.from('inventory_locations')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name');
  return (data as InventoryLocation[] | null) ?? [];
}

export async function createLocation(tenantId: string, payload: {
  code: string; name: string; kind?: InventoryLocation['kind']; address?: string; notes?: string;
}): Promise<InventoryLocation> {
  const sb = getSupabase();
  const { data, error } = await sb.from('inventory_locations').insert({
    tenant_id: tenantId,
    code: payload.code,
    name: payload.name,
    kind: payload.kind ?? 'warehouse',
    address: payload.address ?? null,
    notes:   payload.notes ?? null,
  }).select('*').single();
  if (error) throw new Error(error.message);
  await logAudit({
    tenant_id: tenantId,
    action: 'location.create',
    target_type: 'location',
    target_id: (data as InventoryLocation).id,
    new_value: data as unknown as Record<string, unknown>,
  });
  return data as InventoryLocation;
}

// ── Suppliers ────────────────────────────────────────────────────

export async function listSuppliers(tenantId: string): Promise<InventorySupplier[]> {
  const sb = getSupabase();
  const { data } = await sb.from('inventory_suppliers')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name');
  return (data as InventorySupplier[] | null) ?? [];
}

export async function createSupplier(tenantId: string, payload: {
  code: string; name: string; contact_name?: string; email?: string; phone?: string; address?: string; notes?: string;
}): Promise<InventorySupplier> {
  const sb = getSupabase();
  const { data, error } = await sb.from('inventory_suppliers').insert({
    tenant_id: tenantId,
    code:        payload.code,
    name:        payload.name,
    contact_name: payload.contact_name ?? null,
    email:       payload.email ?? null,
    phone:       payload.phone ?? null,
    address:     payload.address ?? null,
    notes:       payload.notes ?? null,
  }).select('*').single();
  if (error) throw new Error(error.message);
  await logAudit({
    tenant_id: tenantId,
    action: 'supplier.create',
    target_type: 'supplier',
    target_id: (data as InventorySupplier).id,
    new_value: data as unknown as Record<string, unknown>,
  });
  return data as InventorySupplier;
}

// ── Stock levels ─────────────────────────────────────────────────

export async function listStockLevels(tenantId: string): Promise<InventoryStockLevel[]> {
  const sb = getSupabase();
  const { data } = await sb.from('inventory_stock_levels')
    .select('*')
    .eq('tenant_id', tenantId);
  return (data as InventoryStockLevel[] | null) ?? [];
}

// ── Movements ────────────────────────────────────────────────────

export async function listMovements(tenantId: string, limit = 200): Promise<InventoryMovement[]> {
  const sb = getSupabase();
  const { data } = await sb.from('inventory_movements')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  return (data as InventoryMovement[] | null) ?? [];
}

export async function bookMovement(tenantId: string, payload: {
  item_id: string; location_id: string; kind: MovementKind; quantity: number;
  reason?: string; reference?: string;
}): Promise<InventoryMovement> {
  // Caller passes a positive `quantity`. Convert to signed delta based
  // on kind, so the stock-level trigger applies it correctly.
  const delta = payload.kind === 'outbound'
    ? -Math.abs(payload.quantity)
    :  Math.abs(payload.quantity);

  const sb = getSupabase();
  const { data, error } = await sb.from('inventory_movements').insert({
    tenant_id:    tenantId,
    item_id:      payload.item_id,
    location_id:  payload.location_id,
    kind:         payload.kind,
    quantity:     delta,
    reason:       payload.reason ?? null,
    reference:    payload.reference ?? null,
  }).select('*').single();
  if (error) throw new Error(error.message);
  await logAudit({
    tenant_id: tenantId,
    action: 'movement.book',
    target_type: 'movement',
    target_id: (data as InventoryMovement).id,
    new_value: data as unknown as Record<string, unknown>,
  });
  return data as InventoryMovement;
}

// ── Barcodes ─────────────────────────────────────────────────────

export async function listBarcodes(tenantId: string): Promise<InventoryBarcode[]> {
  const sb = getSupabase();
  const { data } = await sb.from('inventory_barcodes')
    .select('*')
    .eq('tenant_id', tenantId);
  return (data as InventoryBarcode[] | null) ?? [];
}

export async function createBarcode(tenantId: string, payload: {
  item_id: string; code: string; symbology?: InventoryBarcode['symbology']; is_primary?: boolean;
}): Promise<InventoryBarcode> {
  const sb = getSupabase();
  const { data, error } = await sb.from('inventory_barcodes').insert({
    tenant_id: tenantId,
    item_id:   payload.item_id,
    code:      payload.code,
    symbology: payload.symbology ?? 'qr',
    is_primary: payload.is_primary ?? false,
  }).select('*').single();
  if (error) throw new Error(error.message);
  await logAudit({
    tenant_id: tenantId,
    action: 'barcode.create',
    target_type: 'barcode',
    target_id: (data as InventoryBarcode).id,
    new_value: data as unknown as Record<string, unknown>,
  });
  return data as InventoryBarcode;
}

// ── Audit events ─────────────────────────────────────────────────

export async function listAuditEvents(tenantId: string, limit = 200): Promise<InventoryAuditEvent[]> {
  const sb = getSupabase();
  const { data } = await sb.from('inventory_audit_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  return (data as InventoryAuditEvent[] | null) ?? [];
}
