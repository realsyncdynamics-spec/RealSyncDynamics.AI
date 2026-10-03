// Twilio-Webhook-Signatur (X-Twilio-Signature).
//
// Twilio signiert jeden Webhook: Base64(HMAC-SHA1(AuthToken, URL + Parameter)).
// Die Parameter des form-encoded POST-Bodys werden nach Namen sortiert und
// als name+wert ohne Trennzeichen an die vollständige, von Twilio aufgerufene
// URL (inkl. Query) gehängt. Doppelte Namen: Werte ebenfalls sortiert.
//
// Ohne diese Prüfung kann jeder, der die Webhook-URL kennt, Anrufe im Namen
// eines fremden Mandanten simulieren (Minuten buchen, KI-Antworten auslösen).
//
// Rein und importfrei (nur Web Crypto) — läuft in Deno und Vitest.

export function twilioSignaturePayload(
  url: string,
  params: Iterable<[string, string]>,
): string {
  const pairs = [...params].sort(([ak, av], [bk, bv]) =>
    ak < bk ? -1 : ak > bk ? 1 : av < bv ? -1 : av > bv ? 1 : 0
  );
  return url + pairs.map(([k, v]) => k + v).join('');
}

export async function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Iterable<[string, string]>,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(authToken), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(twilioSignaturePayload(url, params)));
  let bin = '';
  for (const b of new Uint8Array(mac)) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Fail-closed: fehlender Token, fehlende URL oder fehlender Header → false. */
export async function verifyTwilioSignature(
  authToken: string | null | undefined,
  url: string | null | undefined,
  params: Iterable<[string, string]>,
  header: string | null | undefined,
): Promise<boolean> {
  if (!authToken || !url || !header) return false;
  const expected = await computeTwilioSignature(authToken, url, params);
  // Konstante Vergleichszeit — kein frühes Abbrechen auf ungleichen Zeichen.
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}
