import { describe, it, expect } from 'vitest';
import {
  csvEscape,
  CSV_HEADER,
  buildCsvIndex,
  buildManifest,
  buildReadme,
  buildDocumentJson,
  zipPathFor,
} from '../../../src/features/finance/evidenceExport';
import type { TaxDocument } from '../../../src/features/finance/types';

function doc(overrides: Partial<TaxDocument> = {}): TaxDocument {
  return {
    id:                    'doc-1',
    tenant_id:             'tenant-1',
    tax_year_id:           'year-2026',
    source_type:           'invoice_inbound',
    document_date:         '2026-03-15',
    file_name:             'ER-2026-0001.pdf',
    file_path:             null,
    mime_type:             null,
    amount_net:            100,
    amount_gross:          119,
    currency:              'EUR',
    counterparty_name:     'ACME GmbH',
    ai_summary:            null,
    classification_status: 'classified',
    created_at:            '2026-03-16T10:00:00Z',
    updated_at:            '2026-03-16T10:00:00Z',
    ...overrides,
  };
}

describe('csvEscape', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
    expect(csvEscape('')).toBe('');
  });

  it('leaves plain strings untouched', () => {
    expect(csvEscape('hello')).toBe('hello');
    expect(csvEscape('ACME GmbH')).toBe('ACME GmbH');
    expect(csvEscape(42)).toBe('42');
  });

  it('quotes strings containing commas, quotes, or newlines', () => {
    expect(csvEscape('a, b')).toBe('"a, b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
    expect(csvEscape('with\r\nnewline')).toBe('"with\r\nnewline"');
  });
});

describe('buildCsvIndex', () => {
  it('returns header-only CSV for empty input', () => {
    const csv = buildCsvIndex([]);
    expect(csv.trim()).toBe(CSV_HEADER.join(','));
    expect(csv.endsWith('\n')).toBe(true);
  });

  it('emits one row per document', () => {
    const csv = buildCsvIndex([doc(), doc({ id: 'doc-2', file_name: 'b.pdf' })]);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[1]).toContain('doc-1');
    expect(lines[2]).toContain('doc-2');
  });

  it('formats amounts with two decimals', () => {
    const csv = buildCsvIndex([doc({ amount_net: 100.5, amount_gross: 119.555 })]);
    const dataLine = csv.trim().split('\n')[1]!;
    expect(dataLine).toContain('100.50');
    expect(dataLine).toContain('119.56');
  });

  it('handles null amounts as empty cells', () => {
    const csv = buildCsvIndex([doc({ amount_net: null, amount_gross: null })]);
    const dataLine = csv.trim().split('\n')[1]!;
    // Empty cells between commas — two adjacent commas next to each other
    expect(dataLine).toMatch(/,,,?/);
  });

  it('escapes commas in counterparty names', () => {
    const csv = buildCsvIndex([doc({ counterparty_name: 'ACME GmbH & Co, KG' })]);
    expect(csv).toContain('"ACME GmbH & Co, KG"');
  });

  it('uses the german label for the kategorie_label column', () => {
    const csv = buildCsvIndex([doc({ source_type: 'invoice_inbound' })]);
    expect(csv).toContain('Eingangsrechnung');
  });
});

describe('buildManifest', () => {
  it('aggregates totals and category counts', () => {
    const docs = [
      doc({ id: 'a', source_type: 'invoice_inbound',  amount_gross: 100 }),
      doc({ id: 'b', source_type: 'invoice_inbound',  amount_gross: 50  }),
      doc({ id: 'c', source_type: 'invoice_outbound', amount_gross: 200 }),
    ];
    const m = buildManifest({
      tenant_id: 't', tax_year: 2026,
      export_row: { id: 'exp-1', export_type: 'steuerberater_package' },
      documents: docs,
      generated_at: '2026-05-14T22:00:00Z',
    });
    expect(m.document_count).toBe(3);
    expect(m.total_gross).toBe(350);
    expect(m.by_category).toEqual({ invoice_inbound: 2, invoice_outbound: 1 });
    expect(m.entries).toHaveLength(3);
  });

  it('emits a zip_path per entry pointing into documents/<kategorie>/', () => {
    const m = buildManifest({
      tenant_id: 't', tax_year: 2026,
      export_row: { id: 'exp-1', export_type: 'steuerberater_package' },
      documents: [doc({ id: 'doc-x', source_type: 'receipt' })],
    });
    expect(m.entries[0]?.zip_path).toBe('documents/receipt/doc-x.json');
  });

  it('ships a disclaimer that forbids tax-advice reading', () => {
    const m = buildManifest({
      tenant_id: 't', tax_year: 2026,
      export_row: { id: 'exp-1', export_type: 'audit_archive' },
      documents: [],
    });
    expect(m.disclaimer).toMatch(/technische Vorbereitung/i);
    expect(m.disclaimer).toMatch(/Steuerberater/i);
  });

  it('rounds total_gross to two decimals', () => {
    const m = buildManifest({
      tenant_id: 't', tax_year: 2026,
      export_row: { id: 'exp-1', export_type: 'steuerberater_package' },
      documents: [doc({ amount_gross: 100.555 }), doc({ id: 'b', amount_gross: 0.1 })],
    });
    // 100.555 + 0.1 = 100.655 → 100.66
    expect(m.total_gross).toBeCloseTo(100.66, 2);
  });
});

describe('zipPathFor + buildDocumentJson', () => {
  it('keeps source_type as the folder name', () => {
    expect(zipPathFor(doc({ source_type: 'contract', id: 'c-7' }))).toBe('documents/contract/c-7.json');
  });

  it('emits a JSON file that round-trips the metadata', () => {
    const d = doc({ counterparty_name: 'ACME', amount_gross: 199.99 });
    const obj = JSON.parse(buildDocumentJson(d));
    expect(obj.id).toBe(d.id);
    expect(obj.amount_gross).toBe(199.99);
    expect(obj.source_type_label).toBe('Eingangsrechnung');
  });
});

describe('buildReadme', () => {
  it('mentions the disclaimer and the year', () => {
    const m = buildManifest({
      tenant_id: 't', tax_year: 2026,
      export_row: { id: 'exp-1', export_type: 'steuerberater_package' },
      documents: [doc()],
    });
    const readme = buildReadme(m);
    expect(readme).toMatch(/2026/);
    expect(readme).toMatch(/technische Vorbereitung/);
    expect(readme).toMatch(/index\.csv/);
    expect(readme).toMatch(/manifest\.json/);
  });
});
