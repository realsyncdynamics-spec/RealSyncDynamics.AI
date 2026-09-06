import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';

const { secondsUntilQuotaReset } = await import('../src/services/api-keys-db.js');

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
