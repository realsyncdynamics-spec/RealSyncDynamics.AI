// classify-document — text → tax-document classification via AI Gateway.
//
// POST /functions/v1/classify-document
// Body:
//   {
//     text:        string;        // plain-text extract of a document
//     hint?:       string;        // optional caller hint, e.g. file name
//     tenant_id?:  string;        // for audit / future commit flow
//   }
//
// Returns:
//   {
//     ok: true,
//     category:   ClassificationCategory,
//     confidence: number (0..1),
//     metadata:   { document_date?, counterparty?, amount_gross?, currency?, ai_summary? },
//     suggested_source_type: TaxSourceType,   // maps category → existing enum
//     fallback?: { reason: string }           // present when AI Gateway unreachable
//   }
//
// Failure-mode contract: this function NEVER returns 5xx for "the AI is
// down". Instead it returns `200 { ok: true, category: 'UNKNOWN',
// fallback: { reason } }` so callers can proceed with manual
// classification. Validation / shape errors still return 4xx.
//
// This function is auth-gated (verify_jwt: true is the deploy default).
// Tenant-isolation is enforced upstream — the function does NOT write
// to tax_documents directly; callers do the INSERT through the regular
// `createTaxDocument` API which is RLS-scoped.

import { AiGatewayEdgeClient, AiGatewayEdgeError } from '../_shared/aiGateway/edgeClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_TEXT_LENGTH = 20_000;

export type ClassificationCategory =
  | 'INVOICE_OUTGOING'
  | 'INVOICE_INCOMING'
  | 'RECEIPT'
  | 'BANK_STATEMENT'
  | 'CONTRACT'
  | 'PAYROLL'
  | 'OTHER'
  | 'UNKNOWN';

export type TaxSourceType =
  | 'invoice_inbound' | 'invoice_outbound' | 'payment'
  | 'inventory' | 'payroll' | 'receipt' | 'contract' | 'other';

export const CATEGORY_TO_SOURCE_TYPE: Record<ClassificationCategory, TaxSourceType> = {
  INVOICE_OUTGOING:  'invoice_outbound',
  INVOICE_INCOMING:  'invoice_inbound',
  RECEIPT:           'receipt',
  BANK_STATEMENT:    'payment',
  CONTRACT:          'contract',
  PAYROLL:           'payroll',
  OTHER:             'other',
  UNKNOWN:           'other',
};

interface ClassificationOutput {
  category:    ClassificationCategory;
  confidence:  number;
  document_date?:    string;
  counterparty?:     string;
  amount_gross?:     number;
  currency?:         string;
  ai_summary?:       string;
}

const SYSTEM_PROMPT = `Du bist ein Belegklassifikator für DSGVO-konforme Steuer-Vorbereitung.

Aufgabe: Klassifiziere den gegebenen Dokumenttext in EINE der folgenden Kategorien:
- INVOICE_OUTGOING   (vom Unternehmen ausgestellte Rechnung an Kunde)
- INVOICE_INCOMING   (vom Lieferanten erhaltene Eingangsrechnung)
- RECEIPT            (Quittung, Kassenbon, kleines Belegformat)
- BANK_STATEMENT     (Kontoauszug, Zahlungsbeleg)
- CONTRACT           (Vertrag, Mietvertrag, Dienstleistungsvertrag)
- PAYROLL            (Lohnabrechnung, Gehaltsabrechnung)
- OTHER              (Dokument ist steuerrelevant aber passt in keine der obigen Kategorien)
- UNKNOWN            (Nicht klassifizierbar — Text zu kurz, kein Beleg, Spam, etc.)

Regeln:
- Antworte AUSSCHLIESSLICH mit gültigem JSON. Kein Markdown.
- Schema: {
    "category": string,
    "confidence": number zwischen 0 und 1,
    "document_date": "YYYY-MM-DD" oder weglassen,
    "counterparty": string oder weglassen,
    "amount_gross": number oder weglassen,
    "currency": "EUR" / "USD" / "GBP" / "CHF" oder weglassen,
    "ai_summary": kurzer technischer 1-Satz-Hinweis ohne Beratung
  }
- confidence niedrig (< 0.5) bei kurzem/unklaren Text; verwende dann UNKNOWN.
- KEINE Rechtsberatung. KEINE Empfehlungen. NUR Klassifikation + extrahierte Felder.
- Beträge: nur die Gesamtsumme (brutto), keine Zwischensummen.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST required');

  let body: { text?: unknown; hint?: unknown; tenant_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return jsonError(400, 'BAD_REQUEST', 'text required');
  if (text.length > MAX_TEXT_LENGTH) {
    return jsonError(400, 'TEXT_TOO_LONG', `max ${MAX_TEXT_LENGTH} chars`);
  }
  const hint = typeof body.hint === 'string' ? body.hint.trim() : '';

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey    = Deno.env.get('SUPABASE_ANON_KEY')
                  ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey) {
    return jsonOk(fallbackResult('AI_GATEWAY_NOT_CONFIGURED — SUPABASE_URL/ANON_KEY missing'));
  }

  const client = new AiGatewayEdgeClient({ supabaseUrl, apiKey: anonKey });

  const input = [
    hint ? `Dateiname / Hinweis: ${hint}` : '',
    '',
    'Dokumenttext:',
    text,
  ].filter(Boolean).join('\n');

  try {
    const resp = await client.extractJson<ClassificationOutput>({
      feature:       'document_classification',
      task_type:     'extract_json',
      model_profile: 'strict-json',
      input,
      system_prompt: SYSTEM_PROMPT,
      max_tokens:    600,
      temperature:   0.1,
      metadata:      hint ? { hint } : undefined,
    });

    const result = normalizeOutput(resp.output);
    return jsonOk(result);
  } catch (err) {
    const reason = err instanceof AiGatewayEdgeError
      ? `${err.code}: ${err.message}`
      : err instanceof Error
        ? err.message
        : 'unknown';
    return jsonOk(fallbackResult(reason));
  }
});

// ── Helpers ────────────────────────────────────────────────────────

const KNOWN_CATEGORIES = new Set<ClassificationCategory>([
  'INVOICE_OUTGOING', 'INVOICE_INCOMING', 'RECEIPT', 'BANK_STATEMENT',
  'CONTRACT', 'PAYROLL', 'OTHER', 'UNKNOWN',
]);

interface ClassificationResult {
  ok: true;
  category:               ClassificationCategory;
  confidence:             number;
  metadata: {
    document_date?:    string;
    counterparty?:     string;
    amount_gross?:     number;
    currency?:         string;
    ai_summary?:       string;
  };
  suggested_source_type: TaxSourceType;
  fallback?: { reason: string };
}

export function normalizeOutput(raw: unknown): ClassificationResult {
  const obj = (raw ?? {}) as Partial<ClassificationOutput>;

  const candidate = String(obj.category ?? '').toUpperCase() as ClassificationCategory;
  const category: ClassificationCategory = KNOWN_CATEGORIES.has(candidate) ? candidate : 'UNKNOWN';

  const rawConf = Number(obj.confidence);
  const confidence = Number.isFinite(rawConf)
    ? Math.max(0, Math.min(1, rawConf))
    : (category === 'UNKNOWN' ? 0 : 0.5);

  const metadata = {
    document_date: typeof obj.document_date === 'string' ? obj.document_date : undefined,
    counterparty:  typeof obj.counterparty  === 'string' ? obj.counterparty  : undefined,
    amount_gross:  Number.isFinite(Number(obj.amount_gross)) ? Number(obj.amount_gross) : undefined,
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

function jsonOk(body: ClassificationResult): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
