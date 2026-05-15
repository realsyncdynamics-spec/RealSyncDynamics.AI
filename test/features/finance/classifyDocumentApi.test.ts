import { describe, it, expect, vi } from 'vitest';
import {
  classifyDocument,
  normalizeOutput,
  fallbackResult,
  CATEGORY_TO_SOURCE_TYPE,
  type ClassificationResult,
} from '../../../src/features/finance/classifyDocumentApi';

describe('normalizeOutput', () => {
  it('parses a well-formed invoice payload', () => {
    const r = normalizeOutput({
      category: 'INVOICE_INCOMING',
      confidence: 0.91,
      document_date: '2026-04-12',
      counterparty: 'ACME GmbH',
      amount_gross: 119.0,
      currency: 'EUR',
      ai_summary: 'Eingangsrechnung über Büromaterial.',
    });
    expect(r.category).toBe('INVOICE_INCOMING');
    expect(r.confidence).toBe(0.91);
    expect(r.suggested_source_type).toBe('invoice_inbound');
    expect(r.metadata.counterparty).toBe('ACME GmbH');
    expect(r.metadata.amount_gross).toBe(119);
    expect(r.fallback).toBeUndefined();
  });

  it('clamps confidence into [0, 1]', () => {
    expect(normalizeOutput({ category: 'RECEIPT', confidence: 1.5 }).confidence).toBe(1);
    expect(normalizeOutput({ category: 'RECEIPT', confidence: -0.4 }).confidence).toBe(0);
  });

  it('falls back to UNKNOWN when category is missing or unknown', () => {
    expect(normalizeOutput({}).category).toBe('UNKNOWN');
    expect(normalizeOutput({ category: 'FOOBAR' }).category).toBe('UNKNOWN');
    expect(normalizeOutput({ category: 'FOOBAR' }).confidence).toBe(0);
  });

  it('uppercases lowercase category strings', () => {
    expect(normalizeOutput({ category: 'contract', confidence: 0.8 }).category).toBe('CONTRACT');
  });

  // Regression: prior `Number.isFinite(Number(amount_gross))` coerced
  // `null` and `''` to 0 because `Number(null) === 0`, so docs without
  // a total (contracts, statements) ended up with amount_gross=0.00.
  it('keeps amount_gross undefined when source is null or empty', () => {
    const r1 = normalizeOutput({ category: 'CONTRACT', confidence: 0.8, amount_gross: null });
    expect(r1.metadata.amount_gross).toBeUndefined();
    const r2 = normalizeOutput({ category: 'CONTRACT', confidence: 0.8, amount_gross: '' });
    expect(r2.metadata.amount_gross).toBeUndefined();
    const r3 = normalizeOutput({ category: 'CONTRACT', confidence: 0.8 /* absent */ });
    expect(r3.metadata.amount_gross).toBeUndefined();
  });

  it('drops non-string metadata fields silently', () => {
    const r = normalizeOutput({
      category: 'RECEIPT',
      confidence: 0.7,
      document_date: 42,         // wrong type → dropped
      counterparty: { foo: 1 },  // wrong type → dropped
      amount_gross: '12,50',     // not finite numeric → dropped
    });
    expect(r.metadata.document_date).toBeUndefined();
    expect(r.metadata.counterparty).toBeUndefined();
    expect(r.metadata.amount_gross).toBeUndefined();
  });

  it('maps every known category to a TaxSourceType', () => {
    for (const cat of Object.keys(CATEGORY_TO_SOURCE_TYPE) as Array<keyof typeof CATEGORY_TO_SOURCE_TYPE>) {
      expect(CATEGORY_TO_SOURCE_TYPE[cat]).toBeDefined();
    }
  });
});

describe('fallbackResult', () => {
  it('returns a UNKNOWN result with fallback metadata', () => {
    const r = fallbackResult('AI Gateway down');
    expect(r.category).toBe('UNKNOWN');
    expect(r.confidence).toBe(0);
    expect(r.suggested_source_type).toBe('other');
    expect(r.fallback).toEqual({ reason: 'AI Gateway down' });
  });
});

describe('classifyDocument', () => {
  it('returns text-required fallback when text is empty', async () => {
    const r = await classifyDocument({ text: '' });
    expect(r.category).toBe('UNKNOWN');
    expect(r.fallback?.reason).toBe('text required');
  });

  it('passes through a healthy classification response', async () => {
    const invoke = vi.fn(async () => ({
      data: {
        ok: true,
        category: 'INVOICE_INCOMING',
        confidence: 0.88,
        suggested_source_type: 'invoice_inbound',
        metadata: { document_date: '2026-03-01', amount_gross: 250 },
      },
      error: null,
    }));
    const r = await classifyDocument({ text: 'Rechnung ACME GmbH …' }, { invoke });
    expect(r.category).toBe('INVOICE_INCOMING');
    expect(r.confidence).toBe(0.88);
    expect(r.metadata.amount_gross).toBe(250);
    expect(invoke).toHaveBeenCalledOnce();
  });

  it('preserves a fallback envelope from the edge function', async () => {
    const invoke = vi.fn(async () => ({
      data: {
        ok: true,
        category: 'UNKNOWN',
        confidence: 0,
        suggested_source_type: 'other',
        metadata: {},
        fallback: { reason: 'AI_GATEWAY_NOT_CONFIGURED' },
      },
      error: null,
    }));
    const r = await classifyDocument({ text: 'kurz' }, { invoke });
    expect(r.fallback?.reason).toBe('AI_GATEWAY_NOT_CONFIGURED');
  });

  it('returns a network fallback when invoke throws', async () => {
    const invoke = vi.fn(async () => { throw new Error('network down'); });
    const r = await classifyDocument({ text: 'x' }, { invoke });
    expect(r.category).toBe('UNKNOWN');
    expect(r.fallback?.reason).toMatch(/network down/);
  });

  it('returns a structured fallback on Supabase error', async () => {
    const invoke = vi.fn(async () => ({
      data: null,
      error: { message: 'boom', context: { status: 503 } },
    }));
    const r = await classifyDocument({ text: 'x' }, { invoke });
    expect(r.category).toBe('UNKNOWN');
    expect(r.fallback?.reason).toMatch(/HTTP 503/);
    expect(r.fallback?.reason).toMatch(/boom/);
  });

  it('handles a malformed edge-function body without crashing', async () => {
    const invoke = vi.fn(async () => ({ data: undefined, error: null }));
    const r: ClassificationResult = await classifyDocument({ text: 'x' }, { invoke });
    expect(r.category).toBe('UNKNOWN');
    expect(r.fallback?.reason).toBe('classify-document returned empty body');
  });
});
