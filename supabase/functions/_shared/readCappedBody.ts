// Request-Body mit harter Obergrenze lesen (rein, ohne Deno-Importe).
//
// `await req.text()` zieht den ganzen Body in den Speicher, bevor eine
// Größenprüfung greifen kann — eine Grenze danach schützt den Speicher nicht.
// Hier wird beim Streamen gezählt und beim Überschreiten abgebrochen;
// `Content-Length` lehnt früh ab, ist aber nicht die einzige Prüfung
// (chunked Bodies haben keine).

export type CappedBody = { ok: true; text: string } | { ok: false; reason: 'too_large' };

export async function readCappedText(req: Request, maxBytes: number): Promise<CappedBody> {
  const declared = Number(req.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, reason: 'too_large' };
  if (!req.body) return { ok: true, text: '' };

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return { ok: false, reason: 'too_large' };
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(buf) };
}
