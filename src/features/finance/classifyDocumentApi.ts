import { getSupabase } from '../../lib/supabase';
import type { TaxSourceType } from './types';

// Frontend wrapper around the `classify-document` Edge Function.
//
// Mirror of supabase/functions/classify-document/index.ts — keeps the
// pure normaliseOutput / fallbackResult helpers here so they are
// unit-testable in Node-land and the UI can apply the same shape
// guarantees if a downstream caller hands it raw model output.

export type ClassificationCategory =
  | 'INVOICE_OUTGOING'
  | 'INVOICE_INCOMING'
  | 'RECEIPT'
  | 'BANK_STATEMENT'
  | 'CONTRACT'
  | 'PAYROLL'
  | 'OTHER'
  | 'UNKNOWN';

export const CATEGORY_LABELS: Record<ClassificationCategory, string> = {
  INVOICE_OUTGOING: 'Ausgangsrechnung',
  INVOICE_INCOMING: 'Eingangsrechnung',
  RECEIPT:          'Quittung / Kassenbon',
  BANK_STATEMENT:   'Kontoauszug',
  CONTRACT:         'Vertrag',
  PAYROLL:          'Lohnabrechnung',
  OTHER:            'Sonstiger Beleg',
  UNKNOWN:          'Unklar / nicht klassifizierbar',
};

export const CATEGORY_TO_SOURCE_TYPE: Record<ClassificationCategory, TaxSourceType> = {
  INVOICE_OUTGOING: 'invoice_outbound',
  INVOICE_INCOMING: 'invoice_inbound',
  RECEIPT:          'receipt',
  BANK_STATEMENT:   'payment',
  CONTRACT:         'contract',
  PAYROLL:          'payroll',
  OTHER:            'other',
  UNKNOWN:          'other',
};

const KNOWN_CATEGORIES = new Set<ClassificationCategory>([
  'INVOICE_OUTGOING', 'INVOICE_INCOMING', 'RECEIPT', 'BANK_STATEMENT',
  'CONTRACT', 'PAYROLL', 'OTHER', 'UNKNOWN',
]);

export interface ClassificationMetadata {
  document_date?: string;
  counterparty?:  string;
  amount_gross?:  number;
  currency?:      string;
  ai_summary?:    string;
}

export interface ClassificationResult {
  ok: true;
  category:               ClassificationCategory;
  confidence:             number;
  metadata:               ClassificationMetadata;
  suggested_source_type:  TaxSourceType;
  fallback?: { reason: string };
}

// ── Pure helpers (mirror of edge-side) ────────────────────────────

export function normalizeOutput(raw: unknown): ClassificationResult {
  const obj = (raw ?? {}) as Partial<{
    category: string;
    confidence: number;
    document_date: string;
    counterparty: string;
    amount_gross: number;
    currency: string;
    ai_summary: string;
  }>;

  const candidate = String(obj.category ?? '').toUpperCase() as ClassificationCategory;
  const category: ClassificationCategory = KNOWN_CATEGORIES.has(candidate) ? candidate : 'UNKNOWN';

  const rawConf = Number(obj.confidence);
  const confidence = Number.isFinite(rawConf)
    ? Math.max(0, Math.min(1, rawConf))
    : (category === 'UNKNOWN' ? 0 : 0.5);

  // amount_gross: only adopt if the field is actually present and
  // numeric. `Number(null)` is 0 and `Number('')` is 0 too, so we
  // can't rely on `Number.isFinite` alone — that would coerce absent
  // values to 0.00 and corrupt downstream amount fields for documents
  // (contracts, statements, low-confidence extracts) that have no
  // monetary total.
  const rawAmount: unknown = obj.amount_gross;
  const amountIsPresent = rawAmount != null && rawAmount !== ''
                       && Number.isFinite(Number(rawAmount));

  const metadata: ClassificationMetadata = {
    document_date: typeof obj.document_date === 'string' ? obj.document_date : undefined,
    counterparty:  typeof obj.counterparty  === 'string' ? obj.counterparty  : undefined,
    amount_gross:  amountIsPresent ? Number(rawAmount) : undefined,
    currency:      typeof obj.currency      === 'string' ? obj.currency      : undefined,
    ai_summary:    typeof obj.ai_summary    === 'string' ? obj.ai_summary    : undefined,
  };

  return {
    ok: true,
    category,
    confidence,
    metadata,
    suggested_source_type: CATEGORY_TO_SOURCE_TYPE[category],
  };
}

export function fallbackResult(reason: string): ClassificationResult {
  return {
    ok: true,
    category: 'UNKNOWN',
    confidence: 0,
    metadata: {},
    suggested_source_type: 'other',
    fallback: { reason },
  };
}

// ── Call the classify-document Edge Function ──────────────────────

export interface ClassifyDocumentArgs {
  text:  string;
  hint?: string;
  tenant_id?: string;
}

export interface ClassifyDocumentDeps {
  /** Test/SSR hook: bypass Supabase functions.invoke with a typed stub. */
  invoke?: (args: ClassifyDocumentArgs) => Promise<{
    data?: unknown;
    error?: { message: string; context?: { status?: number } } | null;
  }>;
}

export async function classifyDocument(
  args: ClassifyDocumentArgs,
  deps?: ClassifyDocumentDeps,
): Promise<ClassificationResult> {
  if (!args.text || !args.text.trim()) {
    return fallbackResult('text required');
  }

  const invoke = deps?.invoke ?? (async (body: ClassifyDocumentArgs) => {
    const sb = getSupabase();
    return sb.functions.invoke('classify-document', { body });
  });

  try {
    const { data, error } = await invoke(args);
    if (error) {
      const status = error.context?.status;
      return fallbackResult(`classify-document HTTP ${status ?? '?'}: ${error.message}`);
    }
    if (!data || typeof data !== 'object') {
      return fallbackResult('classify-document returned empty body');
    }
    // The Edge Function already normalises; we re-normalise so a
    // misbehaving response cannot bypass the shape guarantees of the
    // ClassificationResult type.
    const dataRecord = data as Record<string, unknown>;
    const result = normalizeOutput({
      category:      dataRecord.category,
      confidence:    dataRecord.confidence,
      ...((dataRecord.metadata as ClassificationMetadata | undefined) ?? {}),
    });
    if (dataRecord.fallback && typeof dataRecord.fallback === 'object') {
      const fb = dataRecord.fallback as { reason?: unknown };
      const reason = typeof fb.reason === 'string' ? fb.reason : 'unknown';
      return { ...result, fallback: { reason } };
    }
    return result;
  } catch (err) {
    return fallbackResult(err instanceof Error ? err.message : 'classify-document network error');
  }
}
