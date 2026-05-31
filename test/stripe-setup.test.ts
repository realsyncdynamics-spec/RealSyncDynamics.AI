import { describe, it, expect } from 'vitest';
import {
  parseArgs,
  resolveSecretKey,
  resolveWebhookUrl,
  lookupKeyFor,
  renderMappingMarkdown,
  renderSeedSql,
} from '../scripts/stripe-setup.mjs';

describe('stripe-setup · parseArgs', () => {
  it('hat sinnvolle Defaults', () => {
    const a = parseArgs([]);
    expect(a.mode).toBe('test');
    expect(a.dryRun).toBe(false);
    expect(a.confirmLive).toBe(false);
  });

  it('parst Flags', () => {
    const a = parseArgs(['--mode', 'live', '--dry-run', '--sql', '--mapping-md', '--confirm-live']);
    expect(a.mode).toBe('live');
    expect(a.dryRun).toBe(true);
    expect(a.sql).toBe(true);
    expect(a.mappingMd).toBe(true);
    expect(a.confirmLive).toBe(true);
  });

  it('lehnt ungültigen Modus ab', () => {
    expect(() => parseArgs(['--mode', 'prod'])).toThrow(/test.*oder.*live/);
  });

  it('lehnt unbekannte Argumente ab', () => {
    expect(() => parseArgs(['--frobnicate'])).toThrow(/Unbekanntes Argument/);
  });
});

describe('stripe-setup · resolveSecretKey', () => {
  it('bevorzugt den modus-spezifischen Key', () => {
    const env = { STRIPE_SECRET_KEY_TEST: 'sk_test_abc', STRIPE_SECRET_KEY: 'sk_test_fallback' };
    expect(resolveSecretKey('test', env)).toBe('sk_test_abc');
  });

  it('fällt auf STRIPE_SECRET_KEY zurück', () => {
    expect(resolveSecretKey('test', { STRIPE_SECRET_KEY: 'sk_test_xyz' })).toBe('sk_test_xyz');
  });

  it('akzeptiert restricted keys mit passendem Modus', () => {
    expect(resolveSecretKey('live', { STRIPE_SECRET_KEY_LIVE: 'rk_live_123' })).toBe('rk_live_123');
  });

  it('verweigert Key/Modus-Mismatch (Sicherheits-Gate)', () => {
    expect(() => resolveSecretKey('live', { STRIPE_SECRET_KEY: 'sk_test_oops' })).toThrow(/passt nicht zum Modus/);
  });

  it('wirft bei fehlendem Key', () => {
    expect(() => resolveSecretKey('test', {})).toThrow(/Kein Stripe-Key/);
  });
});

describe('stripe-setup · resolveWebhookUrl', () => {
  const suffix = '/functions/v1/stripe-webhook';

  it('Flag hat Vorrang', () => {
    const url = resolveWebhookUrl({ webhookUrl: 'https://x/hook' }, {}, suffix);
    expect(url).toBe('https://x/hook');
  });

  it('leitet aus SUPABASE_URL ab', () => {
    const url = resolveWebhookUrl({ webhookUrl: null }, { SUPABASE_URL: 'https://abc.supabase.co' }, suffix);
    expect(url).toBe('https://abc.supabase.co/functions/v1/stripe-webhook');
  });

  it('ignoriert Platzhalter-URL', () => {
    const url = resolveWebhookUrl({ webhookUrl: null }, { VITE_SUPABASE_URL: 'MY_SUPABASE_URL' }, suffix);
    expect(url).toBeNull();
  });

  it('gibt null zurück ohne Quelle', () => {
    expect(resolveWebhookUrl({ webhookUrl: null }, {}, suffix)).toBeNull();
  });
});

describe('stripe-setup · lookupKeyFor', () => {
  it('recurring → <key>_monthly', () => {
    expect(lookupKeyFor({ key: 'starter', interval: 'month' })).toBe('starter_monthly');
  });
  it('one-time → <key>', () => {
    expect(lookupKeyFor({ key: 'rebuild_1500' })).toBe('rebuild_1500');
  });
  it('sentinel → null', () => {
    expect(lookupKeyFor({ key: 'free', stripe: false })).toBeNull();
  });
});

describe('stripe-setup · Ausgabe-Renderer', () => {
  const rows = [
    { key: 'free', name: 'Free Audit (sentinel)', type: 'sentinel', amount: null, interval: null, productId: null, priceId: 'internal_default_free_audit', lookupKey: null },
    { key: 'starter', name: 'Starter', type: 'recurring', amount: 7900, interval: 'month', productId: 'prod_1', priceId: 'price_1', lookupKey: 'starter_monthly' },
  ];

  it('Markdown enthält Header und Zeilen', () => {
    const md = renderMappingMarkdown(rows, 'test');
    expect(md).toContain('# Stripe Mapping — TEST');
    expect(md).toContain('| `starter` |');
    expect(md).toContain('`price_1`');
    expect(md).toContain('79,00 €/Mt.');
  });

  it('SQL ist idempotent und enthält alle Zeilen', () => {
    const sql = renderSeedSql(rows, 'test');
    expect(sql).toContain('ON CONFLICT (stripe_price_id) DO NOTHING;');
    expect(sql).toContain("('price_1', 'Starter', 'starter')");
    expect(sql).toContain("('internal_default_free_audit', 'Free Audit (sentinel)', 'free')");
  });

  it('SQL escaped einfache Anführungszeichen', () => {
    const sql = renderSeedSql([{ key: 'x', name: "O'Brien", priceId: 'price_x' }], 'live');
    expect(sql).toContain("'O''Brien'");
  });
});
