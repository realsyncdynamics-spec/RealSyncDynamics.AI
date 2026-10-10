/**
 * readCappedText — Body-Grenze beim Streamen (CodeRabbit auf #1759).
 *
 * Vorher las telemetry-ai-event den Body mit `req.text()` und prüfte die
 * Größe danach: Ein Aufrufer mit gültigem Ingest-Key hätte beliebig große
 * (chunked) Bodies in den Speicher der Function schieben können.
 */
import { describe, expect, it } from 'vitest';
import { readCappedText } from '../../supabase/functions/_shared/readCappedBody';

function streamingRequest(chunks: Uint8Array[], onPull?: () => void): { req: Request; cancelled: () => boolean } {
  let cancelled = false;
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      onPull?.();
      if (i < chunks.length) controller.enqueue(chunks[i++]!);
      else controller.close();
    },
    cancel() { cancelled = true; },
  });
  // Ohne Content-Length — wie ein chunked Upload.
  const req = new Request('https://x.test/', { method: 'POST', body, duplex: 'half' } as RequestInit);
  return { req, cancelled: () => cancelled };
}

describe('readCappedText', () => {
  it('liest Bodies bis zur Grenze vollständig', async () => {
    const r = await readCappedText(new Request('https://x.test/', { method: 'POST', body: '{"a":1}' }), 64);
    expect(r).toEqual({ ok: true, text: '{"a":1}' });
  });

  it('zählt Bytes, nicht Zeichen', async () => {
    const r = await readCappedText(new Request('https://x.test/', { method: 'POST', body: 'äää' }), 5);
    expect(r).toEqual({ ok: false, reason: 'too_large' });
  });

  it('bricht einen chunked Body beim Überschreiten ab, ohne den Rest zu lesen', async () => {
    const chunk = new Uint8Array(1024);
    let pulls = 0;
    const { req, cancelled } = streamingRequest(Array.from({ length: 100 }, () => chunk), () => { pulls += 1; });
    const r = await readCappedText(req, 4096);
    expect(r).toEqual({ ok: false, reason: 'too_large' });
    expect(cancelled()).toBe(true);
    expect(pulls).toBeLessThan(10);
  });

  it('lehnt eine zu große Content-Length ab, bevor gelesen wird', async () => {
    const req = new Request('https://x.test/', { method: 'POST', body: 'x', headers: { 'content-length': '999999' } });
    expect(await readCappedText(req, 1024)).toEqual({ ok: false, reason: 'too_large' });
  });

  it('ohne Body: leerer Text', async () => {
    expect(await readCappedText(new Request('https://x.test/', { method: 'POST' }), 10)).toEqual({ ok: true, text: '' });
  });
});
