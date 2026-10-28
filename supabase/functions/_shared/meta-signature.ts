// Meta-Webhook-Signatur (X-Hub-Signature-256) für den WhatsApp-Kanal.
//
// Meta signiert den Roh-Body mit HMAC-SHA256 und dem App-Secret und sendet
// `sha256=<hex>`. Fail-closed: fehlendes Secret, fehlender oder falsch
// formatierter Header → false. Vor PR A ließ whatsapp-webhook ohne Secret
// jede Anfrage durch (Webhook fälschbar).
//
// Rein und importfrei (nur Web Crypto) — läuft in Deno und Vitest.

export async function computeMetaSignatureHex(appSecret: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  return Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyMetaSignature(
  appSecret: string | null | undefined,
  rawBody: string,
  header: string | null | undefined,
): Promise<boolean> {
  if (!appSecret) return false;
  if (!header || !header.startsWith('sha256=')) return false;
  const expectedHex = header.slice('sha256='.length).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expectedHex)) return false;

  const actualHex = await computeMetaSignatureHex(appSecret, rawBody);
  // Konstante Vergleichszeit — kein frühes Abbrechen auf ungleichen Zeichen.
  let diff = 0;
  for (let i = 0; i < actualHex.length; i++) diff |= actualHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  return diff === 0;
}
