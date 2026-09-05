import assert from 'node:assert/strict';
import test from 'node:test';

// Der Supabase-Client wird beim Import initialisiert und bricht ohne diese
// Variablen ab. Die Werte werden nie kontaktiert — geprüft wird nur Logik,
// die vor jedem Netzwerkzugriff greift.
process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
process.env.MCP_KEY_PEPPER ??= 'test-pepper-mit-mindestens-32-zeichen-laenge';

const { validateApiKey } = await import('../src/services/api-keys-db.js');
const { validateApiKeyFormat } = await import('../src/auth/api-key.js');
const { pepper } = await import('../src/services/key-hash.js');

// Ableitung, Format und Vergleich der Key-Hashes stehen in key-hash.test.ts.
// Hier bleibt, was die Auth-Schicht davor abfängt.

test('Fehlender oder zu kurzer Pepper wirft, statt still zurückzufallen', () => {
  const alt = process.env.MCP_KEY_PEPPER;
  for (const schwach of ['', 'zu-kurz']) {
    process.env.MCP_KEY_PEPPER = schwach;
    assert.throws(() => pepper(), /MCP_KEY_PEPPER/);
  }
  process.env.MCP_KEY_PEPPER = alt;
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
