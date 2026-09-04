import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';

process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
process.env.MCP_KEY_PEPPER ??= 'test-pepper-mit-mindestens-32-zeichen-laenge';

const { derive, hashNewKey, verifyAgainstStored, PBKDF2_ITERATIONS } = await import(
  '../src/services/key-hash.js'
);

const PEPPER = process.env.MCP_KEY_PEPPER!;
const subtle = webcrypto.subtle;
const randomBytes = (n: number) => webcrypto.getRandomValues(new Uint8Array(n));

/**
 * Kürzere Iterationszahl, wo die Zahl selbst nicht geprüft wird.
 * 210 000 Runden kosten ~137 ms; bei zwanzig Prüfungen wäre die Suite sonst
 * mehrere Sekunden nur mit Warten beschäftigt.
 */
const FAST = 1000;

test('derive ist deterministisch', async () => {
  const salt = new Uint8Array(16).fill(7);
  const a = await derive('rsmcp_abc', PEPPER, salt, FAST, subtle);
  const b = await derive('rsmcp_abc', PEPPER, salt, FAST, subtle);
  assert.equal(a, b);
});

test('derive trennt unterschiedliche Keys', async () => {
  const salt = new Uint8Array(16).fill(7);
  assert.notEqual(
    await derive('rsmcp_aaa', PEPPER, salt, FAST, subtle),
    await derive('rsmcp_aab', PEPPER, salt, FAST, subtle),
  );
});

test('derive trennt unterschiedliche Salts', async () => {
  const a = await derive('rsmcp_abc', PEPPER, new Uint8Array(16).fill(1), FAST, subtle);
  const b = await derive('rsmcp_abc', PEPPER, new Uint8Array(16).fill(2), FAST, subtle);
  assert.notEqual(a, b);
});

test('ohne den richtigen Pepper stimmt nichts überein', async () => {
  const salt = new Uint8Array(16).fill(7);
  const echt = await derive('rsmcp_abc', PEPPER, salt, FAST, subtle);
  const falsch = await derive('rsmcp_abc', 'anderer-pepper-mit-32-zeichen-laenge!', salt, FAST, subtle);
  assert.notEqual(echt, falsch);
});

test('hashNewKey erzeugt das vereinbarte Format', async () => {
  const stored = await hashNewKey('rsmcp_' + 'a'.repeat(64), PEPPER, subtle, randomBytes);
  const parts = stored.split('$');
  assert.equal(parts.length, 4);
  assert.equal(parts[0], 'pbkdf2-sha512');
  assert.equal(Number(parts[1]), PBKDF2_ITERATIONS);
  assert.equal(parts[2].length, 32, 'Salt: 16 Byte als Hex');
  assert.equal(parts[3].length, 128, 'Ableitung: 64 Byte als Hex');
});

test('zwei Aufrufe für denselben Key ergeben verschiedene Werte', async () => {
  // Das Salt ist je Key neu. Ohne diese Eigenschaft träfe eine einzige
  // Vorberechnung alle Keys mit demselben Klartext zugleich.
  const key = 'rsmcp_' + 'b'.repeat(64);
  const a = await hashNewKey(key, PEPPER, subtle, randomBytes);
  const b = await hashNewKey(key, PEPPER, subtle, randomBytes);
  assert.notEqual(a, b);
});

test('verifyAgainstStored nimmt den richtigen Key an', async () => {
  const key = 'rsmcp_' + 'c'.repeat(64);
  const stored = await hashNewKey(key, PEPPER, subtle, randomBytes);
  assert.equal(await verifyAgainstStored(key, PEPPER, stored, subtle), true);
});

test('verifyAgainstStored weist einen falschen Key ab', async () => {
  const stored = await hashNewKey('rsmcp_' + 'c'.repeat(64), PEPPER, subtle, randomBytes);
  assert.equal(await verifyAgainstStored('rsmcp_' + 'd'.repeat(64), PEPPER, stored, subtle), false);
});

test('verifyAgainstStored weist bei falschem Pepper ab', async () => {
  const key = 'rsmcp_' + 'c'.repeat(64);
  const stored = await hashNewKey(key, PEPPER, subtle, randomBytes);
  const falsch = 'anderer-pepper-mit-mindestens-32-zeichen';
  assert.equal(await verifyAgainstStored(key, falsch, stored, subtle), false);
});

test('verifyAgainstStored achtet die gespeicherte Iterationszahl', async () => {
  // Ein Key, der vor einer Anhebung ausgestellt wurde, muss gültig bleiben.
  // Würde die Prüfung stur die Voreinstellung nehmen, verfielen beim nächsten
  // Parameterwechsel schlagartig alle bestehenden Keys.
  const key = 'rsmcp_' + 'e'.repeat(64);
  const salt = new Uint8Array(16).fill(3);
  const derived = await derive(key, PEPPER, salt, FAST, subtle);
  const salzHex = Array.from(salt, (b) => b.toString(16).padStart(2, '0')).join('');
  const alt = `pbkdf2-sha512$${FAST}$${salzHex}$${derived}`;

  assert.equal(await verifyAgainstStored(key, PEPPER, alt, subtle), true);
});

test('verifyAgainstStored weist unbrauchbare gespeicherte Werte ab, statt zu werfen', async () => {
  // Ein beschädigter oder fremdformatiger Wert darf die Authentifizierung nicht
  // mit einer Ausnahme abbrechen — sonst wird aus einer einzelnen kaputten
  // Zeile ein 500er für jeden Aufruf mit demselben Präfix.
  const key = 'rsmcp_abc';
  for (const kaputt of [
    '',
    'nur-text',
    'pbkdf2-sha512$210000$nurdreiteile',
    'sha256$210000$aabb$ccdd',
    'pbkdf2-sha512$keinezahl$aabb$ccdd',
    'pbkdf2-sha512$0$aabb$ccdd',
    'pbkdf2-sha512$210000$ZZZZ$ccdd',
    'pbkdf2-sha512$210000$aabb$ZZZZ',
  ]) {
    assert.equal(
      await verifyAgainstStored(key, PEPPER, kaputt, subtle),
      false,
      `sollte false ergeben, nicht werfen: ${JSON.stringify(kaputt)}`,
    );
  }
});

test('die Edge Function rechnet zeichengleich', async () => {
  // Die Edge Function läuft unter Deno und bildet den Wert mit crypto.subtle
  // nach demselben Rezept. Hier wird dieses Rezept unabhängig nachgebaut —
  // ohne die Hilfsfunktionen des Servers —, damit eine einseitige Änderung
  // auffällt, bevor sie in Produktion jeden Key entwertet.
  const key = 'rsmcp_0123456789abcdef';
  const salt = new Uint8Array(16).fill(9);
  const iterations = FAST;

  const material = await subtle.importKey(
    'raw',
    new TextEncoder().encode(`${PEPPER}:${key}`),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-512' },
    material,
    512,
  );
  const erwartet = Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('');

  assert.equal(await derive(key, PEPPER, salt, iterations, subtle), erwartet);
});
