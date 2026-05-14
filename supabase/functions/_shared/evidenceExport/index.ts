// Deno mirror of src/features/finance/evidenceExport.ts.
// Keep in sync. Tests run against the frontend mirror via vitest.

export type TaxSourceType =
  | 'invoice_inbound' | 'invoice_outbound' | 'payment'
  | 'inventory' | 'payroll' | 'receipt' | 'contract' | 'other';

export type TaxExportType = 'steuerberater_package' | 'management_review' | 'audit_archive';

export interface TaxDocument {
  id: string;
  tenant_id: string;
  tax_year_id: string;
  source_type: TaxSourceType;
  document_date: string;
  file_name: string;
  file_path: string | null;
  mime_type: string | null;
  amount_net: number | null;
  amount_gross: number | null;
  currency: string;
  counterparty_name: string | null;
  ai_summary: string | null;
  classification_status: string;
  created_at: string;
  updated_at: string;
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

export const CSV_HEADER: readonly string[] = [
  'beleg_id',
  'beleg_datum',
  'kategorie',
  'kategorie_label',
  'datei',
  'gegenueber',
  'betrag_netto',
  'betrag_brutto',
  'waehrung',
  'klassifikation',
  'erstellt_am',
];

export function csvEscape(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  if (s === '') return '';
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsvIndex(documents: TaxDocument[]): string {
  const lines: string[] = [];
  lines.push(CSV_HEADER.join(','));
  for (const d of documents) {
    lines.push([
      csvEscape(d.id),
      csvEscape(d.document_date),
      csvEscape(d.source_type),
      csvEscape(SOURCE_TYPE_LABELS[d.source_type] ?? d.source_type),
      csvEscape(d.file_name),
      csvEscape(d.counterparty_name ?? ''),
      csvEscape(d.amount_net   != null ? d.amount_net.toFixed(2)   : ''),
      csvEscape(d.amount_gross != null ? d.amount_gross.toFixed(2) : ''),
      csvEscape(d.currency),
      csvEscape(d.classification_status),
      csvEscape(d.created_at),
    ].join(','));
  }
  return lines.join('\n') + '\n';
}

export interface ManifestEntry {
  id: string;
  source_type: TaxSourceType;
  document_date: string;
  file_name: string;
  amount_gross: number | null;
  currency: string;
  classification_status: string;
  zip_path: string;
}

export interface ExportManifest {
  schema_version: 1;
  tenant_id:      string;
  tax_year:       number;
  export_id:      string;
  export_type:    TaxExportType;
  generated_at:   string;
  document_count: number;
  total_gross:    number;
  currency:       string;
  by_category:    Record<string, number>;
  entries:        ManifestEntry[];
  disclaimer:     string;
}

const DISCLAIMER =
  'Diese Dokumentation ist eine technische Vorbereitung. RealSyncDynamicsAI ' +
  'klassifiziert und exportiert Belege; die finale steuerliche Prüfung, ' +
  'Bewertung und Einreichung erfolgt durch Geschäftsführung oder Steuerberater.';

export function zipPathFor(doc: TaxDocument): string {
  return `documents/${doc.source_type}/${doc.id}.json`;
}

export function buildManifest(params: {
  tenant_id:   string;
  tax_year:    number;
  export_row:  { id: string; export_type: TaxExportType };
  documents:   TaxDocument[];
  generated_at?: string;
}): ExportManifest {
  const generatedAt = params.generated_at ?? new Date().toISOString();
  const byCategory: Record<string, number> = {};
  let totalGross = 0;
  let currency = 'EUR';
  for (const d of params.documents) {
    byCategory[d.source_type] = (byCategory[d.source_type] ?? 0) + 1;
    if (d.amount_gross != null) totalGross += Number(d.amount_gross);
    if (d.currency) currency = d.currency;
  }
  return {
    schema_version: 1,
    tenant_id:      params.tenant_id,
    tax_year:       params.tax_year,
    export_id:      params.export_row.id,
    export_type:    params.export_row.export_type,
    generated_at:   generatedAt,
    document_count: params.documents.length,
    total_gross:    +totalGross.toFixed(2),
    currency,
    by_category:    byCategory,
    entries: params.documents.map((d) => ({
      id:                    d.id,
      source_type:           d.source_type,
      document_date:         d.document_date,
      file_name:             d.file_name,
      amount_gross:          d.amount_gross != null ? Number(d.amount_gross) : null,
      currency:              d.currency,
      classification_status: d.classification_status,
      zip_path:              zipPathFor(d),
    })),
    disclaimer: DISCLAIMER,
  };
}

export function buildReadme(manifest: ExportManifest): string {
  const lines: string[] = [];
  lines.push('RealSyncDynamicsAI — Steuer-Vorbereitungs-Paket');
  lines.push('================================================');
  lines.push('');
  lines.push(`Steuerjahr:        ${manifest.tax_year}`);
  lines.push(`Export-Typ:        ${manifest.export_type}`);
  lines.push(`Erzeugt:           ${manifest.generated_at}`);
  lines.push(`Belegzahl:         ${manifest.document_count}`);
  lines.push(`Brutto-Summe:      ${manifest.total_gross.toFixed(2)} ${manifest.currency}`);
  lines.push('');
  lines.push('Inhalt:');
  lines.push('  /index.csv             — tabellarische Übersicht aller Belege');
  lines.push('  /manifest.json         — strukturierte Metadaten + Checksumme');
  lines.push('  /documents/<kategorie>/<beleg_id>.json');
  lines.push('                         — Belegdaten je Beleg als JSON');
  lines.push('');
  lines.push('Wichtig:');
  lines.push(`  ${manifest.disclaimer}`);
  lines.push('');
  return lines.join('\n');
}

export function buildDocumentJson(doc: TaxDocument): string {
  return JSON.stringify({
    id:                    doc.id,
    tax_year_id:           doc.tax_year_id,
    source_type:           doc.source_type,
    source_type_label:     SOURCE_TYPE_LABELS[doc.source_type] ?? doc.source_type,
    document_date:         doc.document_date,
    file_name:             doc.file_name,
    file_path:             doc.file_path,
    mime_type:             doc.mime_type,
    counterparty_name:     doc.counterparty_name,
    amount_net:            doc.amount_net,
    amount_gross:          doc.amount_gross,
    currency:              doc.currency,
    ai_summary:            doc.ai_summary,
    classification_status: doc.classification_status,
    created_at:            doc.created_at,
    updated_at:            doc.updated_at,
  }, null, 2);
}
