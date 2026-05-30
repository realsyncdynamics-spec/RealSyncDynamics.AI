// MFA-Recovery-Codes — reine, abhängigkeitsfreie Logik (Web Crypto).
//
// ADR 0006: Recovery-Codes sind der Lockout-Schutz. Klartext wird NUR einmalig
// clientseitig angezeigt; persistiert wird ausschließlich der SHA-256-Hash.
// Dieselbe Hash-Funktion nutzt die Edge Function `mfa-recovery-redeem`.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne 0/O/1/I — verwechslungsarm
const GROUPS = 3;
const GROUP_LEN = 4;

/** Normalisiert Eingabe (Leerzeichen/Bindestriche raus, Großschreibung). */
export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[\s-]+/g, '').toUpperCase();
}

/** Erzeugt `count` zufällige Recovery-Codes im Format `XXXX-XXXX-XXXX`. */
export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const groups: string[] = [];
    for (let g = 0; g < GROUPS; g++) {
      const buf = new Uint8Array(GROUP_LEN);
      crypto.getRandomValues(buf);
      let s = '';
      for (let j = 0; j < GROUP_LEN; j++) s += ALPHABET[buf[j] % ALPHABET.length];
      groups.push(s);
    }
    codes.push(groups.join('-'));
  }
  return codes;
}

/** SHA-256-Hex über den normalisierten Code. Identisch in Client & Edge Function. */
export async function hashRecoveryCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(normalizeRecoveryCode(code));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
