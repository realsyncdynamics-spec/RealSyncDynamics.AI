import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';

const { secondsUntilQuotaReset, decideQuota, countsAgainstQuota, QUOTA_UNAVAILABLE_RETRY_SECONDS } =
  await import('../src/services/api-keys-db.js');

test('Retry-After zeigt auf den Beginn des Folgemonats', () => {
  // Mitte des Monats: bis zum 1. des Folgemonats sind es noch gut 16 Tage.
  const mitteAugust = new Date('2026-08-15T12:00:00.000Z');
  const erwartet = Math.ceil(
    (Date.UTC(2026, 8, 1) - mitteAugust.getTime()) / 1000,
  );
  assert.equal(secondsUntilQuotaReset(mitteAugust), erwartet);
});

test('Jahreswechsel wird korrekt überschritten', () => {
  // Regressionsschutz: Monat 11 + 1 muss auf Januar des Folgejahres fallen,
  // nicht auf „Monat 12" desselben Jahres.
  const silvester = new Date('2026-12-31T23:00:00.000Z');
  assert.equal(secondsUntilQuotaReset(silvester), 3600);
});

test('Retry-After ist nie null oder negativ', () => {
  // Genau auf der Monatsgrenze darf kein Retry-After von 0 herauskommen —
  // ein Agent würde sofort erneut anfragen und in dieselbe Sperre laufen.
  const grenze = new Date('2026-09-01T00:00:00.000Z');
  assert.ok(secondsUntilQuotaReset(grenze) >= 1);
});

test('Kurz vor Monatsende bleibt die Wartezeit klein', () => {
  const kurzVor = new Date('2026-08-31T23:59:00.000Z');
  assert.equal(secondsUntilQuotaReset(kurzVor), 60);
});

// ── decideQuota: fail-closed ────────────────────────────────────────────────

const ok = (over: Partial<{ allowed: boolean; apiAccess: boolean; used: number; limitCalls: number }> = {}) => ({
  status: 'ok' as const,
  state: { allowed: true, apiAccess: true, used: 10, limitCalls: 1000, planKey: 'agency', ...over },
});

test('RPC-Fehler laesst nicht mehr durch: 503 mit kurzem Retry-After', () => {
  const r = decideQuota({ status: 'error' });
  assert.ok(r);
  assert.equal(r.status, 503);
  assert.equal(r.body.error, 'QUOTA_UNAVAILABLE');
  assert.equal(r.headers['Retry-After'], String(QUOTA_UNAVAILABLE_RETRY_SECONDS));
});

test('kein Plan in plan_catalog: 403 statt ungeprueft durch', () => {
  const r = decideQuota({ status: 'no_plan' });
  assert.ok(r);
  assert.equal(r.status, 403);
  assert.equal(r.body.error, 'PLAN_WITHOUT_API');
});

test('Plan ohne API-Zugriff: 403 PLAN_WITHOUT_API', () => {
  const r = decideQuota(ok({ allowed: false, apiAccess: false }));
  assert.ok(r);
  assert.equal(r.status, 403);
  assert.equal(r.body.error, 'PLAN_WITHOUT_API');
});

test('Kontingent erschoepft: 429 mit Retry-After bis Monatsende', () => {
  const jetzt = new Date('2026-08-31T23:59:00.000Z');
  const r = decideQuota(ok({ allowed: false, used: 1000 }), jetzt);
  assert.ok(r);
  assert.equal(r.status, 429);
  assert.equal(r.body.error, 'QUOTA_EXCEEDED');
  assert.equal(r.headers['Retry-After'], '60');
});

test('erlaubt: durchlassen', () => {
  assert.equal(decideQuota(ok()), null);
});

test('unbegrenzt (-1): durchlassen', () => {
  assert.equal(decideQuota(ok({ limitCalls: -1, used: 999999 })), null);
});

test('429 und 503 zaehlen nicht gegen das Kontingent, 200/403 schon', () => {
  assert.equal(countsAgainstQuota(429), false);
  assert.equal(countsAgainstQuota(503), false);
  assert.equal(countsAgainstQuota(200), true);
  assert.equal(countsAgainstQuota(403), true);
});
