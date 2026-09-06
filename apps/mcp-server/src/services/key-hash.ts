/**
 * Ableitung und Prüfung der MCP-API-Key-Hashes.
 *
 * Format: `pbkdf2-sha512$<iterationen>$<salt-hex>$<ableitung-hex>`
 *
 * **Warum PBKDF2 und nicht scrypt.** scrypt wäre kryptografisch die bessere
 * Wahl — speicherhart, bei gleicher Wartezeit teurer für den Angreifer
 * (gemessen: 47 ms bei N=16384 gegenüber 137 ms für PBKDF2-SHA512 mit 210 000
 * Runden). Der Ausschlag gab die Laufzeitfrage: Dieselbe Ableitung muss in
 * zwei Umgebungen **bitgleich** laufen — im MCP Server unter Node und in der
 * Edge Function unter Deno. Weichen sie ab, validiert kein einziger Key mehr.
 * PBKDF2 gibt es in beiden über dieselbe W3C-WebCrypto-Schnittstelle; scrypt
 * nur über Denos Node-Kompatibilitätsschicht, die sich hier nicht prüfen
 * lässt. Ein Verfahren zu wählen, dessen Übereinstimmung man nicht testen
 * kann, wäre an dieser Stelle das größere Risiko.
 *
 * **Warum zusätzlich ein Pepper.** Der Pepper geht in das Passwortmaterial ein
 * und liegt nur in der Umgebung von Server und Edge Function, nie in der
 * Datenbank. Wer allein die Datenbank erbeutet, hat damit weder Klartext noch
 * eine offline angreifbare Ableitung. Salt und Pepper adressieren
 * verschiedene Dinge und ersetzen einander nicht: Das Salt verhindert, dass
 * eine Vorberechnung mehrere Keys zugleich trifft, der Pepper verhindert den
 * Offline-Angriff überhaupt.
 *
 * **Was das kostet.** Rund 137 ms je Prüfung, gemessen auf dem Build-Runner.
 * Bezahlt wird das erst, wenn das Präfix eines echten Keys getroffen wurde —
 * `mcp_key_candidates` liefert sonst null Zeilen und es läuft keine Runde.
 * Ein Angreifer ohne gültiges Präfix erzeugt also keine Rechenlast.
 */

import type { webcrypto } from 'node:crypto';

/**
 * Die WebCrypto-Schnittstelle, über die abgeleitet wird.
 *
 * Typ bewusst aus `node:crypto` statt aus der DOM-Bibliothek: Dieses Paket
 * bindet `lib.dom` nicht ein, und der Server läuft ohnehin unter Node. Zur
 * Laufzeit ist es dieselbe W3C-Schnittstelle, die die Edge Function unter Deno
 * benutzt — darauf beruht die Gleichheit beider Seiten.
 */
type Subtle = webcrypto.SubtleCrypto;

/** Iterationszahl nach OWASP-Empfehlung für PBKDF2-SHA512. */
export const PBKDF2_ITERATIONS = 210_000;

/** Länge des Salts in Byte. */
const SALT_BYTES = 16;

/** Länge der Ableitung in Bit. */
const DERIVED_BITS = 512;

const ALGORITHM = 'pbkdf2-sha512';

/** Mindestlänge des Peppers — kurz genug geraten ist so gut wie keiner. */
const MIN_PEPPER_LENGTH = 32;

function bufToHex(buf: Uint8Array): string {
  let out = '';
  for (let i = 0; i < buf.length; i++) out += buf[i].toString(16).padStart(2, '0');
  return out;
}

function hexToBuf(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/**
 * Leitet den Ableitungswert ab.
 *
 * Bewusst als eigene Funktion mit explizitem Salt und expliziter Iterationszahl:
 * Beim Prüfen müssen genau die Werte verwendet werden, die beim Anlegen galten,
 * sonst schlägt jeder Vergleich fehl, sobald die Voreinstellung sich ändert.
 */
export async function derive(
  key: string,
  pepper: string,
  salt: Uint8Array,
  iterations: number,
  subtle: Subtle,
): Promise<string> {
  const material = await subtle.importKey(
    'raw',
    new TextEncoder().encode(`${pepper}:${key}`),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-512' },
    material,
    DERIVED_BITS,
  );
  return bufToHex(new Uint8Array(bits));
}

/** Erzeugt den zu speichernden Wert für einen frisch ausgestellten Key. */
export async function hashNewKey(
  key: string,
  pepper: string,
  subtle: Subtle,
  randomBytes: (n: number) => Uint8Array,
): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await derive(key, pepper, salt, PBKDF2_ITERATIONS, subtle);
  return `${ALGORITHM}$${PBKDF2_ITERATIONS}$${bufToHex(salt)}$${derived}`;
}

/**
 * Vergleicht zwei Hex-Zeichenketten in konstanter Zeit.
 *
 * Ein früher abbrechender Vergleich verriete über die Laufzeit, wie viele
 * Stellen bereits stimmen. Beim Ableitungswert ist das zwar kein praktischer
 * Angriff — wer ihn kennt, hat ihn schon —, aber ein zeitabhängiger Vergleich
 * an einer Authentifizierung ist eine Gewohnheit, die man sich nicht angewöhnt.
 */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Prüft einen Klartext-Key gegen einen gespeicherten Wert.
 *
 * Iterationszahl und Salt kommen aus dem gespeicherten Wert, nicht aus der
 * Voreinstellung — nur so bleiben Keys gültig, die vor einer Anhebung der
 * Iterationszahl ausgestellt wurden.
 */
export async function verifyAgainstStored(
  key: string,
  pepper: string,
  stored: string,
  subtle: Subtle,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== ALGORITHM) return false;

  const iterations = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  if (!/^[0-9a-f]+$/.test(parts[2]) || !/^[0-9a-f]+$/.test(parts[3])) return false;

  const derived = await derive(key, pepper, hexToBuf(parts[2]), iterations, subtle);
  return timingSafeEqualHex(derived, parts[3]);
}

/**
 * Liest den Pepper aus der Umgebung.
 *
 * Wirft statt still auf einen ungepfefferten Wert zurückzufallen: Ein solcher
 * Rückfall erzeugte zwei unvereinbare Bestände und entwertete den Schutz, ohne
 * dass es auffiele.
 */
export function pepper(): string {
  const secret = process.env.MCP_KEY_PEPPER ?? '';
  if (secret.length < MIN_PEPPER_LENGTH) {
    throw new Error(
      `MCP_KEY_PEPPER fehlt oder ist kürzer als ${MIN_PEPPER_LENGTH} Zeichen — Key-Prüfung nicht möglich.`,
    );
  }
  return secret;
}
