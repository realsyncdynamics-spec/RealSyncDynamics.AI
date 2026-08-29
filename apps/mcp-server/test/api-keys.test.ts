import assert from 'node:assert/strict';
import { randomBytes, webcrypto } from 'node:crypto';
import test from 'node:test';

// Der Supabase-Client wird beim Import initialisiert und bricht ohne diese
// Variablen ab. Die Werte werden nie kontaktiert — geprüft wird nur Logik,
// die vor jedem Netzwerkzugriff greift.
process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
process.env.MCP_KEY_PEPPER ??= 'test-pepper-mit-mindestens-32-zeichen-laenge';

const { hashApiKey, validateApiKey } = await import('../src/services/api-keys-db.js');
const { validateApiKeyFormat } = await import('../src/auth/api-key.js');

test('hashApiKey ist deterministisch', () => {
  const key = 'rsmcp_' + 'a'.repeat(64);
  assert.equal(hashApiKey(key), hashApiKey(key));
});

test('hashApiKey trennt unterschiedliche Keys', () => {
  assert.notEqual(hashApiKey('rsmcp_aaa'), hashApiKey('rsmcp_aab'));
});

test('hashApiKey entspricht dem HMAC der Edge Function', async () => {
  // Die Edge Function bildet crypto.subtle.sign('HMAC'/SHA-256, pepper, utf8(key)).
  // Weichen beide Implementierungen ab, validiert kein einziger Key mehr —
  // deshalb wird der Wert hier unabhängig über die WebCrypto-API nachgerechnet,
  // also über denselben Weg wie in Deno, nicht über node:crypto.
  const key = 'rsmcp_0123456789abcdef';
  const secret = process.env.MCP_KEY_PEPPER!;
  const cryptoKey = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await webcrypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(key));
  const expected = Buffer.from(new Uint8Array(sig)).toString('hex');

  assert.equal(hashApiKey(key), expected);
  assert.match(hashApiKey(key), /^[0-9a-f]{64}$/);
});

test('Ein anderer Pepper ergibt einen anderen Hash', () => {
  // Der Kern des Peppers: Wer nur die Datenbank hat, kann geratene Keys nicht
  // nachrechnen. Wäre der Hash pepper-unabhängig, wäre der Schutz wirkungslos.
  const key = 'rsmcp_0123456789abcdef';
  const mitA = hashApiKey(key);
  const alt = process.env.MCP_KEY_PEPPER;
  process.env.MCP_KEY_PEPPER = 'ein-voellig-anderer-pepper-mit-32-zeichen';
  const mitB = hashApiKey(key);
  process.env.MCP_KEY_PEPPER = alt;
  assert.notEqual(mitA, mitB);
});

test('Fehlender oder zu kurzer Pepper wirft, statt still zurückzufallen', () => {
  const alt = process.env.MCP_KEY_PEPPER;
  for (const schwach of ['', 'zu-kurz']) {
    process.env.MCP_KEY_PEPPER = schwach;
    assert.throws(() => hashApiKey('rsmcp_abc'), /MCP_KEY_PEPPER/);
  }
  process.env.MCP_KEY_PEPPER = alt;
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
