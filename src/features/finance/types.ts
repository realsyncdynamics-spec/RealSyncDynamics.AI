// Shared types for the Tax Evidence Runtime. Mirror DB columns from
// supabase/migrations/20260518000000_tax_evidence_runtime.sql.
//
// Positioning: this module PREPARES tax-relevant documentation. It
// does NOT provide tax advice and does NOT file tax returns. Keep
// types and naming aligned with that boundary.

export type TaxYearStatus = 'open' | 'locked' | 'exported' | 'archived';

export interface TaxYear {
  id: string;
  tenant_id: string;
  year: number;
  status: TaxYearStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type TaxSourceType =
  | 'invoice_inbound' | 'invoice_outbound' | 'payment'
  | 'inventory' | 'payroll' | 'receipt' | 'contract' | 'other';

export type TaxClassificationStatus = 'pending' | 'classified' | 'needs_review';

export interface TaxDocument {
  id: string;
  tenant_id: string;
  tax_year_id: string;
  source_type: TaxSourceType;
  document_date: string;        // YYYY-MM-DD
  file_name: string;
  file_path: string | null;
  mime_type: string | null;
  amount_net: number | null;
  amount_gross: number | null;
  currency: string;
  counterparty_name: string | null;
  ai_summary: string | null;
  classification_status: TaxClassificationStatus;
  created_at: string;
  updated_at: string;
}

export type TaxRelatedEntityType =
  | 'inventory_movement' | 'purchase_order' | 'supplier'
  | 'customer' | 'payment' | 'manual';

export interface TaxDocumentLink {
  id: string;
  tenant_id: string;
  tax_document_id: string;
  related_entity_type: TaxRelatedEntityType;
  related_entity_id: string;
  note: string | null;
  created_at: string;
}

export type TaxExportType = 'steuerberater_package' | 'management_review' | 'audit_archive';
export type TaxExportStatus = 'preparing' | 'ready' | 'downloaded' | 'failed';

export interface TaxEvidenceExport {
  id: string;
  tenant_id: string;
  tax_year_id: string;
  export_type: TaxExportType;
  status: TaxExportStatus;
  export_path: string | null;
  checksum: string | null;
  document_count: number;
  total_amount: number | null;
  notes: string | null;
  created_at: string;
  ready_at: string | null;
  downloaded_at: string | null;
}

export type TaxReminderType =
  | 'monthly_review' | 'quarterly_review' | 'year_end' | 'export_ready';
export type TaxReminderStatus = 'open' | 'sent' | 'dismissed' | 'completed';

export interface TaxReminder {
  id: string;
  tenant_id: string;
  tax_year_id: string;
  reminder_type: TaxReminderType;
  title: string;
  due_at: string;
  status: TaxReminderStatus;
  created_at: string;
}

export interface TaxAuditEvent {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  source: 'ui' | 'api' | 'import' | 'agent' | 'migration';
  created_at: string;
}

export const SOURCE_TYPE_LABELS: Record<TaxSourceType, string> = {
  invoice_inbound:  'Eingangsrechnung',
  invoice_outbound: 'Ausgangsrechnung',
  payment:          'Zahlung',
  inventory:        'Inventur / Warenbewegung',
  payroll:          'Lohn / Gehalt',
  receipt:          'Quittung / Beleg',
  contract:         'Vertrag',
  other:            'Sonstiges',
};

export const SOURCE_TYPE_ORDER: TaxSourceType[] = [
  'invoice_inbound', 'invoice_outbound', 'payment',
  'inventory', 'payroll', 'receipt', 'contract', 'other',
];

export const EXPORT_TYPE_LABELS: Record<TaxExportType, string> = {
  steuerberater_package: 'Export für Steuerberater',
  management_review:     'Management Review',
  audit_archive:         'Audit-Archiv',
};

export const REMINDER_TYPE_LABELS: Record<TaxReminderType, string> = {
  monthly_review:    'Monats-Review',
  quarterly_review:  'Quartals-Review',
  year_end:          'Jahresabschluss-Vorbereitung',
  export_ready:      'Exportpaket bereit',
};
