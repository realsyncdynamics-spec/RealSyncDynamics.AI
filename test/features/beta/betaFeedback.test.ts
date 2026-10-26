// WP-4: Beta-Feedback — Entwurfsprüfung und Tabellenzugriff.
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  FEEDBACK_MAX_LENGTH,
  isPlatformOperator,
  listBetaFeedback,
  normalizeRoute,
  prepareFeedback,
  submitBetaFeedback,
} from '../../../src/features/beta/betaFeedback';

describe('prepareFeedback', () => {
  it('lehnt leeren Text ab', () => {
    expect(prepareFeedback('   \n ', '/app/dashboard')).toEqual({ ok: false, reason: 'empty' });
  });

  it('lehnt zu langen Text ab', () => {
    expect(prepareFeedback('x'.repeat(FEEDBACK_MAX_LENGTH + 1), '/app')).toEqual({ ok: false, reason: 'too_long' });
  });

  it('kürzt Leerraum und übernimmt die Route', () => {
    expect(prepareFeedback('  Scan hängt  ', '/app/scans')).toEqual({ ok: true, text: 'Scan hängt', route: '/app/scans' });
  });
});

describe('normalizeRoute', () => {
  it('entfernt Query und Hash, in denen Tokens stehen können', () => {
    expect(normalizeRoute('/welcome?beta=1&token=abc#x')).toBe('/welcome');
  });

  it('erzwingt den führenden Schrägstrich und kappt auf 200 Zeichen', () => {
    expect(normalizeRoute('app')).toBe('/app');
    expect(normalizeRoute(`/${'a'.repeat(300)}`)).toHaveLength(200);
  });
});

function clientWith(result: { data?: unknown; error: { message: string } | null }) {
  const chain = {
    insert: vi.fn().mockResolvedValue(result),
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
  const sb = {
    from: vi.fn().mockReturnValue(chain),
    rpc: vi.fn().mockResolvedValue(result),
  };
  return { sb: sb as unknown as SupabaseClient, raw: sb, chain };
}

describe('submitBetaFeedback', () => {
  it('schreibt Mandant, Text und Route, aber nie user_id (setzt die Datenbank)', async () => {
    const { sb, raw, chain } = clientWith({ error: null });
    await submitBetaFeedback(sb, { tenantId: 't-1', text: 'Gut', route: '/app/dashboard' });
    expect(raw.from).toHaveBeenCalledWith('beta_feedback');
    expect(chain.insert).toHaveBeenCalledWith({ tenant_id: 't-1', text: 'Gut', route: '/app/dashboard' });
  });

  it('wirft bei RLS-Fehler', async () => {
    const { sb } = clientWith({ error: { message: 'new row violates row-level security policy' } });
    await expect(submitBetaFeedback(sb, { tenantId: 't-2', text: 'x', route: '/app' })).rejects.toThrow(/row-level/);
  });
});

describe('listBetaFeedback / isPlatformOperator', () => {
  it('liest neueste zuerst', async () => {
    const rows = [{ id: '1', tenant_id: 't', user_id: 'u', route: '/app', text: 'a', created_at: '2026-10-25T10:00:00Z' }];
    const { sb, chain } = clientWith({ data: rows, error: null });
    await expect(listBetaFeedback(sb)).resolves.toEqual(rows);
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('zählt nur ein echtes true als Betreiber', async () => {
    expect(await isPlatformOperator(clientWith({ data: true, error: null }).sb)).toBe(true);
    expect(await isPlatformOperator(clientWith({ data: null, error: null }).sb)).toBe(false);
  });
});
