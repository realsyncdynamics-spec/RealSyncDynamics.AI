/**
 * siteos-preview — liefert erzeugte Vorschauen von einer **eigenen Herkunft**.
 *
 * ── Wozu ein eigener Worker ──────────────────────────────────────────────
 *
 * Bis hierher wurden Vorschauen als `srcDoc` in einem Rahmen der Anwendung
 * angezeigt. Das ist abgesichert (siehe `src/lib/preview-sandbox.ts`), hat
 * aber drei Grenzen, die sich im Frontend nicht aufheben lassen:
 *
 *  1. Ein `srcDoc`-Dokument liegt im Dokumentbaum der Anwendung. Die
 *     Trennung entsteht erst im Browser und hängt an einem Attribut.
 *  2. `frame-ancestors` wirkt nur als HTTP-Header, nie als `<meta>`. Ohne
 *     eigene Auslieferung lässt sich also nicht begrenzen, wer eine Vorschau
 *     einbetten darf.
 *  3. Eine Vorschau ohne URL ist nicht teilbar — und „Sieh dir an, was aus
 *     deiner Seite geworden ist" ist der Kern des Trichters.
 *
 * Dieser Worker löst alle drei: Er läuft auf einer anderen Registrierdomain
 * (`*.workers.dev`, später eine eigene Subdomain), setzt echte Header und
 * gibt jeder Vorschau eine Adresse.
 *
 * ── Warum KV und nicht die Datenbank ─────────────────────────────────────
 *
 * Ein anonymer Entwurf gehört zu **keinem** Mandanten. Er in `public.*` zu
 * legen hiesse, eine Zeile ohne `tenant_id` in ein Schema zu schreiben, das
 * genau darauf aufgebaut ist — und RLS hätte nichts, woran sie greifen könnte.
 * KV mit Ablaufzeit passt zur Sache: unauffindbar ohne Kennung, verfällt von
 * selbst, keine Beziehung zu Mandantendaten.
 *
 * Beim Project Claim wandert der Entwurf in die Datenbank und bekommt dort
 * Mandant, RLS und Prüfpfad. Erst dann ist er dauerhaft.
 *
 * ── Was dieser Worker NICHT tut ──────────────────────────────────────────
 *
 * Er erzeugt nichts. Er kennt weder Modell noch Blueprint noch Mandanten und
 * hat keinen Zugriff auf Supabase, Stripe oder irgendein Geheimnis der
 * Anwendung. Er nimmt fertiges HTML entgegen und gibt es wieder aus. Diese
 * Enge ist der Punkt: Auf dieser Herkunft läuft erzeugter Code, deshalb darf
 * hier nichts liegen, das er erreichen könnte.
 */

import {
  ANONYMOUS_PREVIEW_TTL_SECONDS,
  isPreviewId,
  servedPreviewHeaders,
  type PreviewIsolation,
} from '../../../src/lib/preview-sandbox';

/**
 * Minimale Beschreibung der KV-Schnittstelle, die dieser Worker benutzt.
 *
 * Bewusst hier im Modul statt in einer ambienten `.d.ts` und ohne
 * `@cloudflare/workers-types`: Die Root-`package.json` führt keine
 * Cloudflare-Abhängigkeiten (wrangler läuft über `npx`), und eine ambiente
 * Deklaration in diesem Verzeichnis wäre für den Root-Typecheck unsichtbar —
 * der Worker wird vom Test importiert und damit mitgeprüft.
 *
 * Der Nebeneffekt ist erwünscht: Die drei Methoden hier sind die vollständige
 * Aussenwelt dieses Workers.
 */
interface KVNamespacePutOptions {
  /** Lebensdauer in Sekunden. Trägt den Verfall anonymer Entwürfe. */
  expirationTtl?: number;
}

interface KVNamespace {
  get(key: string, type: 'json'): Promise<unknown>;
  put(key: string, value: string, options?: KVNamespacePutOptions): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Env {
  /** Ablage der Vorschau-Dokumente. Verfall über `expirationTtl`. */
  PREVIEWS: KVNamespace;
  /**
   * Gemeinsames Geheimnis für den Schreibpfad. Wird über
   * `wrangler secret put PREVIEW_WRITE_TOKEN` gesetzt, nie in der
   * Konfiguration hinterlegt.
   */
  PREVIEW_WRITE_TOKEN?: string;
}

interface StoredPreview {
  html: string;
  isolation: PreviewIsolation;
  /** Nur zur Fehlersuche — enthält bewusst keine Nutzerdaten. */
  created_at: string;
}

/** Obergrenze je Dokument. Eine Startseite liegt weit darunter. */
const MAX_HTML_BYTES = 2 * 1024 * 1024;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/**
 * Vergleicht zwei Geheimnisse in konstanter Zeit.
 *
 * Ein `===` auf Zeichenketten bricht beim ersten Unterschied ab und verrät
 * darüber, wie viele Zeichen stimmten. Bei einem Token, das über das Netz
 * geraten werden kann, ist das ein echter Angriffspfad.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorizeWrite(request: Request, env: Env): boolean {
  const expected = env.PREVIEW_WRITE_TOKEN;
  // Ohne gesetztes Geheimnis ist der Schreibpfad zu, nicht offen. Ein
  // fehlender Wert darf nie „alles erlaubt" bedeuten.
  if (!expected) return false;
  const header = request.headers.get('Authorization') ?? '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;
  return timingSafeEqual(header.slice(prefix.length), expected);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/healthz') {
      return json(200, { ok: true });
    }

    const match = /^\/p\/([^/]+)$/.exec(url.pathname);
    if (!match) return json(404, { error: 'not_found' });

    const previewId = match[1];
    // Vor jedem Speicherzugriff geprüft: Die Kennung ist der einzige
    // Zugangsschutz eines anonymen Entwurfs.
    if (!isPreviewId(previewId)) return json(400, { error: 'invalid_preview_id' });

    if (request.method === 'GET' || request.method === 'HEAD') {
      const raw = await env.PREVIEWS.get(previewId, 'json') as StoredPreview | null;
      // Abgelaufen und nie existiert sind bewusst dieselbe Antwort — sonst
      // liesse sich über die Statuscodes herausfinden, welche Kennungen es
      // einmal gab.
      if (!raw) return json(404, { error: 'not_found' });

      const headers = servedPreviewHeaders(raw.isolation);
      return new Response(request.method === 'HEAD' ? null : raw.html, { status: 200, headers });
    }

    if (request.method === 'PUT') {
      if (!authorizeWrite(request, env)) return json(401, { error: 'unauthorized' });

      let body: { html?: unknown; isolation?: unknown };
      try {
        // `request.json()` liefert `unknown` — der Inhalt kommt von aussen und
        // wird unten Feld für Feld geprüft, nicht per Zusicherung geglaubt.
        const parsed: unknown = await request.json();
        if (typeof parsed !== 'object' || parsed === null) {
          return json(400, { error: 'invalid_json' });
        }
        body = parsed as { html?: unknown; isolation?: unknown };
      } catch {
        return json(400, { error: 'invalid_json' });
      }

      const html = typeof body.html === 'string' ? body.html : '';
      if (!html) return json(400, { error: 'html_required' });
      if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) {
        return json(413, { error: 'html_too_large' });
      }

      // Unbekannte Werte fallen auf die strengere Stufe zurück, nicht auf die
      // lockerere. Ein Tippfehler darf keine Skripte freischalten.
      const isolation: PreviewIsolation = body.isolation === 'interactive' ? 'interactive' : 'static';

      const stored: StoredPreview = { html, isolation, created_at: new Date().toISOString() };
      await env.PREVIEWS.put(previewId, JSON.stringify(stored), {
        expirationTtl: ANONYMOUS_PREVIEW_TTL_SECONDS,
      });

      return json(201, { ok: true, preview_id: previewId, expires_in: ANONYMOUS_PREVIEW_TTL_SECONDS });
    }

    if (request.method === 'DELETE') {
      if (!authorizeWrite(request, env)) return json(401, { error: 'unauthorized' });
      await env.PREVIEWS.delete(previewId);
      return json(200, { ok: true });
    }

    return json(405, { error: 'method_not_allowed' });
  },
};
