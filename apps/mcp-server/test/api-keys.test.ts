import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import test from 'node:test';

// Der Supabase-Client wird beim Import initialisiert und bricht ohne diese
// Variablen ab. Die Werte werden nie kontaktiert — geprüft wird nur Logik,
// die vor jedem Netzwerkzugriff greift.
process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';

const { hashApiKey, validateApiKey } = await import('../src/services/api-keys-db.js');
const { validateApiKeyFormat } = await import('../src/auth/api-key.js');

test('hashApiKey ist deterministisch', () => {
  const key = 'rsmcp_' + 'a'.repeat(64);
  assert.equal(hashApiKey(key), hashApiKey(key));
});

test('hashApiKey trennt unterschiedliche Keys', () => {
  assert.notEqual(hashApiKey('rsmcp_aaa'), hashApiKey('rsmcp_aab'));
});

test('hashApiKey entspricht dem SHA-256 der Edge Function', () => {
  // Die Edge Function berechnet crypto.subtle.digest('SHA-256', utf8(key)).
  // Weichen beide Implementierungen ab, validiert kein einziger Key mehr —
  // deshalb wird der Wert hier unabhängig nachgerechnet.
  const key = 'rsmcp_0123456789abcdef';
  const expected = createHash('sha256').update(Buffer.from(key, 'utf8')).digest('hex');
  assert.equal(hashApiKey(key), expected);
  assert.match(hashApiKey(key), /^[0-9a-f]{64}$/);
});

test('hashApiKey gibt den Klartext-Key nicht preis', () => {
  const key = 'rsmcp_' + randomBytes(32).toString('hex');
  assert.ok(!hashApiKey(key).includes(key.slice(6)));
});

test('validateApiKeyFormat akzeptiert nur das rsmcp_-Präfix', () => {
  assert.equal(validateApiKeyFormat('rsmcp_abc123'), true);
  assert.equal(validateApiKeyFormat('sk_live_abc123'), false);
  assert.equal(validateApiKeyFormat('rsmcp_'), false);
  assert.equal(validateApiKeyFormat(''), false);
});

test('validateApiKey weist Schrott ohne Datenbankzugriff ab', async () => {
  // Die Supabase-URL zeigt ins Leere. Käme es zu einem Netzwerkaufruf, liefe
  // der Test in einen Verbindungsfehler statt in ein sauberes Ergebnis.
  for (const bad of ['', 'nope', 'sk_live_deadbeef', 'rsmcp_kurz']) {
    const result = await validateApiKey(bad);
    assert.equal(result.valid, false, `"${bad}" hätte abgelehnt werden müssen`);
    assert.equal(result.error, 'Invalid key format');
  }
});
