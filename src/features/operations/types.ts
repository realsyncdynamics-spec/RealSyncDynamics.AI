// Shared types for the Operations Runtime module. Mirror DB columns
// from supabase/migrations/20260517000000_operations_inventory.sql.

export type LocationKind = 'warehouse' | 'shop' | 'mobile' | 'virtual';

export interface InventoryLocation {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  kind: LocationKind;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventorySupplier {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  reorder_level: number;
  default_supplier_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryStockLevel {
  id: string;
  tenant_id: string;
  item_id: string;
  location_id: string;
  quantity: number;
  updated_at: string;
}

export type MovementKind = 'inbound' | 'outbound' | 'adjustment' | 'transfer';

export interface InventoryMovement {
  id: string;
  tenant_id: string;
  item_id: string;
  location_id: string;
  kind: MovementKind;
  /** Signed: positive = inbound, negative = outbound. */
  quantity: number;
  reason: string | null;
  reference: string | null;
  occurred_at: string;
  created_at: string;
}

export type BarcodeSymbology = 'ean13' | 'code128' | 'code39' | 'qr' | 'datamatrix' | 'custom';

export interface InventoryBarcode {
  id: string;
  tenant_id: string;
  item_id: string;
  code: string;
  symbology: BarcodeSymbology;
  is_primary: boolean;
  created_at: string;
}

export type AuditAction =
  | 'item.create' | 'item.update' | 'item.deactivate'
  | 'location.create' | 'location.update'
  | 'supplier.create' | 'supplier.update'
  | 'movement.book' | 'barcode.create';

export interface InventoryAuditEvent {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  action: AuditAction;
  target_type: string;
  target_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  source: 'ui' | 'api' | 'import' | 'agent' | 'migration';
  occurred_at: string;
}
