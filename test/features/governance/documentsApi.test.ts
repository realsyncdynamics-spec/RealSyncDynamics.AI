/**
 * documentsApi — pure-logic tests for the helpers used by DocumentsView.
 * The supabase-js wrappers (fetchTenantDocuments / generateDocument) are thin
 * pass-throughs and exercised via integration; here we test the pure helpers.
 */
import { describe, expect, it } from 'vitest';
import {
  buildDocFilename,
  isGeneratableDocType,
  GENERATABLE_DOC_TYPES,
  DOC_TYPE_LABELS,
} from '@/src/features/governance/documents/documentsApi';

describe('documentsApi / isGeneratableDocType', () => {
  it('accepts the four generator doc types', () => {
    for (const dt of ['dse', 'avv', 'vvt', 'tom']) {
      expect(isGeneratableDocType(dt)).toBe(true);
    }
  });

  it('rejects non-generator types', () => {
    for (const dt of ['impressum', 'dsfa', 'ai-act', 'consent', '']) {
      expect(isGeneratableDocType(dt)).toBe(false);
    }
  });

  it('has a label for every generatable type', () => {
    for (const dt of GENERATABLE_DOC_TYPES) {
      expect(DOC_TYPE_LABELS[dt]).toBeTruthy();
    }
  });
});

describe('documentsApi / buildDocFilename', () => {
  it('builds a safe filename with version', () => {
    expect(buildDocFilename('dse', 'example.com', '2026.05.0')).toBe(
      'dse_example.com_2026.05.0.html',
    );
  });

  it('sanitises unsafe characters in the domain', () => {
    expect(buildDocFilename('avv', 'Foo Bar/Baz?', '1.0')).toBe('avv_foo-bar-baz_1.0.html');
  });

  it('omits the version segment when not provided', () => {
    expect(buildDocFilename('tom', 'site.de')).toBe('tom_site.de.html');
  });

  it('falls back to a placeholder for an empty domain', () => {
    expect(buildDocFilename('vvt', '')).toBe('vvt_dokument.html');
  });
});
