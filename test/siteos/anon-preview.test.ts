// Vorschau-Persistenz des anonymen Pfads — Verhalten, nicht Quelltext.
//
// Diese Datei ist der Grund, warum `supabase/functions/siteos/preview.ts`
// getrennt vom Handler liegt: Sie prüft den Schreibpfad **ohne** KV, ohne
// deployten Worker und ohne Cloudflare-Konto. Was hier grün ist, ist damit
// unabhängig von dem offenen Infrastruktur-Punkt geprüft
// (`PREVIEW_WRITE_TOKEN`, siehe `docs/product/siteos-anonymous-build.md`).
//
// Was diese Datei NICHT zeigt: dass die Ablage in Produktion erreichbar ist.
// Das kann nur ein Lauf gegen den deployten Worker — und der ist bis dahin
// offen. Diese Grenze steht ausdrücklich hier, damit ein grüner Lauf nicht
// als Nachweis für etwas gelesen wird, das er nicht prüft.

import { describe, it, expect, vi } from 'vitest';

import {
  PREVIEW_ORIGIN_ENV,
  PREVIEW_TOKEN_ENV,
  buildPreviewPayload,
  payloadBytes,
  previewUrl,
  publishPreview,
  readPreviewTarget,
  revokePreview,
  ttlUntil,
  type PreviewPayload,
} from '../../supabase/functions/siteos/preview';
import {
  ANONYMOUS_PREVIEW_MAX_BYTES,
  ANONYMOUS_PREVIEW_TTL_SECONDS,
  MIN_PREVIEW_TTL_SECONDS,
} from '../../src/lib/preview-sandbox';
import { buildSiteFromPrompt, type SiteBlueprint } from '../../packages/siteos-core/src/index';

const VALID_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const TARGET = { origin: 'https://siteos-preview.example.workers.dev', token: 'secret-token' };

let cached: SiteBlueprint | null = null;
async function blueprint(): Promise<SiteBlueprint> {
  if (!cached) {
    const built = await buildSiteFromPrompt(
      'Website für eine Zahnarztpraxis in Hamburg mit Prophylaxe und Kontaktformular.',
      { locale: 'de', model: null },
    );
    cached = built.blueprint;
  }
  return cached;
}

/** Antwort-Attrappe. Nur die drei Felder, die `publishPreview` liest. */
function response(status: number): Response {
  return { ok: status >= 200 && status < 300, status } as Response;
}

describe('Ziel aus der Umgebung', () => {
  it('liefert null, solange eines von beiden fehlt', () => {
    expect(readPreviewTarget(() => undefined)).toBeNull();
    expect(readPreviewTarget((k) => (k === PREVIEW_ORIGIN_ENV ? 'https://x.dev' : undefined))).toBeNull();
    expect(readPreviewTarget((k) => (k === PREVIEW_TOKEN_ENV ? 'tok' : undefined))).toBeNull();
  });

  it('nimmt den Schrägstrich am Ende der Herkunft weg', () => {
    const target = readPreviewTarget((k) =>
      k === PREVIEW_ORIGIN_ENV ? 'https://x.dev/' : 'tok');
    // Sonst entstünde `https://x.dev//p/<id>` — ein Pfad, den der Worker
    // nicht kennt, und der Fehler läge in der Konfiguration, nicht im Code.
    expect(target?.origin).toBe('https://x.dev');
    expect(previewUrl(target!.origin, VALID_ID)).toBe(`https://x.dev/p/${VALID_ID}`);
  });
});

describe('Lebensdauer folgt der Sitzung, nicht dem Kalender', () => {
  const now = Date.UTC(2026, 7, 23, 12, 0, 0);

  it('nimmt die Restzeit bis expires_at', () => {
    const in3Days = new Date(now + 3 * 24 * 3600 * 1000).toISOString();
    expect(ttlUntil(in3Days, now)).toBe(3 * 24 * 3600);
  });

  it('überschreitet nie die Obergrenze von sieben Tagen', () => {
    const in30Days = new Date(now + 30 * 24 * 3600 * 1000).toISOString();
    expect(ttlUntil(in30Days, now)).toBe(ANONYMOUS_PREVIEW_TTL_SECONDS);
  });

  it('ist 0, sobald die Sitzung abgelaufen oder fast abgelaufen ist', () => {
    expect(ttlUntil(new Date(now - 1000).toISOString(), now)).toBe(0);
    // Unterhalb der KV-Untergrenze wird gar nicht erst abgelegt.
    expect(ttlUntil(new Date(now + (MIN_PREVIEW_TTL_SECONDS - 5) * 1000).toISOString(), now)).toBe(0);
  });

  it('ist 0 bei einem unbrauchbaren Zeitstempel', () => {
    expect(ttlUntil('kein datum', now)).toBe(0);
  });
});

describe('Das abgelegte Dokument', () => {
  it('führt die Startseite getrennt und alle Unterseiten mit', async () => {
    const payload = buildPreviewPayload(await blueprint(), 3600);
    const bp = await blueprint();

    expect(payload.html).toContain('<!doctype html>');
    // Jede Seite des Blueprints ausser '/' muss erreichbar sein — sonst
    // enden die Navigationslinks der erzeugten Website im 404.
    for (const page of bp.pages) {
      if (page.path === '/') continue;
      expect(Object.keys(payload.pages)).toContain(page.path);
    }
    expect(Object.keys(payload.pages)).not.toContain('/');
  });

  it('trägt die CSP in jedem Dokument, nicht nur in der Startseite', async () => {
    const payload = buildPreviewPayload(await blueprint(), 3600);
    const documents = [payload.html, ...Object.values(payload.pages)];
    expect(documents.length).toBeGreaterThan(1);
    for (const doc of documents) {
      expect(doc).toContain('http-equiv="Content-Security-Policy"');
    }
  });

  it('ist die gestaltete Fassung, nicht das nackte Analyse-Markup', async () => {
    const payload = buildPreviewPayload(await blueprint(), 3600);
    // `showcase` hängt die Layoutschicht an. Ohne sie sähe der geteilte Link
    // anders aus als das, was der Kunde im Studio gesehen hat.
    expect(payload.html.length).toBeGreaterThan(2000);
    expect(payload.isolation).toBe('static');
  });
});

describe('Ablegen', () => {
  it('meldet not_configured statt zu scheitern, wenn kein Ziel gesetzt ist', async () => {
    const fetchImpl = vi.fn();
    const outcome = await publishPreview(null, VALID_ID, await blueprint(), 3600, fetchImpl as never);
    expect(outcome).toEqual({ status: 'not_configured' });
    // Und es wird nichts versucht: Ohne Ziel gibt es keinen Aufruf, der in
    // ein Zeitlimit laufen und den Bau verzögern könnte.
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('legt nichts ab, wenn die Sitzung abgelaufen ist', async () => {
    const fetchImpl = vi.fn();
    const outcome = await publishPreview(TARGET, VALID_ID, await blueprint(), 0, fetchImpl as never);
    expect(outcome).toEqual({ status: 'failed', reason: 'session_expired' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('lehnt eine unbrauchbare Kennung ab, bevor sie über das Netz geht', async () => {
    const fetchImpl = vi.fn();
    const outcome = await publishPreview(TARGET, '../../etc', await blueprint(), 3600, fetchImpl as never);
    expect(outcome).toEqual({ status: 'failed', reason: 'invalid_preview_id' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('schreibt mit Bearer-Token, Lebensdauer und allen Seiten', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(201));
    const outcome = await publishPreview(TARGET, VALID_ID, await blueprint(), 4242, fetchImpl as never);

    expect(outcome).toEqual({
      status: 'stored',
      previewId: VALID_ID,
      url: `${TARGET.origin}/p/${VALID_ID}`,
      expiresInSeconds: 4242,
    });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${TARGET.origin}/p/${VALID_ID}`);
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TARGET.token}`);

    const body = JSON.parse(init.body as string) as PreviewPayload;
    expect(body.ttl).toBe(4242);
    expect(body.isolation).toBe('static');
    expect(Object.keys(body.pages).length).toBeGreaterThan(0);
  });

  it('macht aus einer Ablehnung des Workers einen Zustand, keinen Absturz', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(401));
    const outcome = await publishPreview(TARGET, VALID_ID, await blueprint(), 3600, fetchImpl as never);
    expect(outcome).toEqual({ status: 'failed', reason: 'http_401' });
  });

  it('fängt einen nicht erreichbaren Worker ab', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const outcome = await publishPreview(TARGET, VALID_ID, await blueprint(), 3600, fetchImpl as never);
    expect(outcome.status).toBe('failed');
    expect(outcome.status === 'failed' && outcome.reason).toContain('unreachable');
  });

  it('lehnt ein zu grosses Dokument ab, bevor der Worker es tut', async () => {
    const bp = await blueprint();
    // Ein Blueprint mit einer absurd langen Beschreibung — der Weg, auf dem
    // ein Dokument realistisch zu gross wird.
    const bloated: SiteBlueprint = {
      ...bp,
      pages: bp.pages.map((page) => ({ ...page, description: 'x'.repeat(ANONYMOUS_PREVIEW_MAX_BYTES) })),
    };
    const fetchImpl = vi.fn();
    const outcome = await publishPreview(TARGET, VALID_ID, bloated, 3600, fetchImpl as never);

    expect(outcome.status).toBe('failed');
    expect(outcome.status === 'failed' && outcome.reason.startsWith('payload_too_large')).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('misst die Grösse über den ganzen Eintrag', async () => {
    const payload = buildPreviewPayload(await blueprint(), 3600);
    // Eine Messung, die nur `html` prüft, sähe hier deutlich weniger — genau
    // die Lücke, durch die Unterseiten beliebig wachsen könnten.
    expect(payloadBytes(payload)).toBeGreaterThan(
      new TextEncoder().encode(payload.html).byteLength,
    );
  });
});

describe('Zurücknehmen', () => {
  it('löscht mit demselben Geheimnis', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200));
    expect(await revokePreview(TARGET, VALID_ID, fetchImpl as never)).toBe(true);

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${TARGET.origin}/p/${VALID_ID}`);
    expect(init.method).toBe('DELETE');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TARGET.token}`);
  });

  it('meldet false, statt den Claim scheitern zu lassen', async () => {
    expect(await revokePreview(null, VALID_ID, vi.fn() as never)).toBe(false);
    expect(await revokePreview(TARGET, null, vi.fn() as never)).toBe(false);
    const failing = vi.fn().mockRejectedValue(new Error('down'));
    expect(await revokePreview(TARGET, VALID_ID, failing as never)).toBe(false);
  });
});
