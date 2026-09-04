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
  ANONYMOUS_PREVIEW_MAX_BYTES,
  ANONYMOUS_PREVIEW_TTL_SECONDS,
  MIN_PREVIEW_TTL_SECONDS,
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
  /** Startseite. Eigenes Feld, damit ältere Einträge weiter gelesen werden. */
  html: string;
  /**
   * Unterseiten nach Pfad (`/kontakt` → HTML).
   *
   * Ohne sie zeigt eine geteilte Vorschau zwar die Startseite, aber jeder
   * Navigationslink endet im 404 des Workers — und der Besucher hält die
   * erzeugte Website für kaputt, obwohl nur die Ablage unvollständig war.
   *
   * Optional, weil Einträge aus der Zeit vor der Mehrseiten-Ablage im KV
   * liegen können. Sie bleiben lesbar, statt beim Abruf zu scheitern.
   */
  pages?: Record<string, string>;
  isolation: PreviewIsolation;
  /** Nur zur Fehlersuche — enthält bewusst keine Nutzerdaten. */
  created_at: string;
}

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

    const match = /^\/p\/([^/]+)(\/.*)?$/.exec(url.pathname);
    if (!match) return json(404, { error: 'not_found' });

    const previewId = match[1];
    // Alles hinter der Kennung ist der Seitenpfad innerhalb der Vorschau.
    // Ein Schrägstrich am Ende („/p/<id>/") meint die Startseite.
    const subPath = match[2] && match[2] !== '/' ? match[2].replace(/\/+$/, '') : null;
    // Vor jedem Speicherzugriff geprüft: Die Kennung ist der einzige
    // Zugangsschutz eines anonymen Entwurfs.
    if (!isPreviewId(previewId)) return json(400, { error: 'invalid_preview_id' });

    if (request.method === 'GET' || request.method === 'HEAD') {
      const raw = await env.PREVIEWS.get(previewId, 'json') as StoredPreview | null;
      // Abgelaufen und nie existiert sind bewusst dieselbe Antwort — sonst
      // liesse sich über die Statuscodes herausfinden, welche Kennungen es
      // einmal gab.
      if (!raw) return json(404, { error: 'not_found' });

      const html = subPath === null ? raw.html : raw.pages?.[subPath];
      // Eine Unterseite, die es in diesem Entwurf nicht gibt, ist ein 404 der
      // Vorschau — nicht die Startseite unter fremdem Pfad. Sonst zeigte
      // jeder Tippfehler dasselbe Dokument und die Vorschau behauptete
      // Seiten, die die erzeugte Website nicht hat.
      if (typeof html !== 'string') return json(404, { error: 'not_found' });

      const headers = servedPreviewHeaders(raw.isolation);
      return new Response(request.method === 'HEAD' ? null : html, { status: 200, headers });
    }

    if (request.method === 'PUT') {
      if (!authorizeWrite(request, env)) return json(401, { error: 'unauthorized' });
      // Geschrieben wird immer die Vorschau als Ganzes, nie eine einzelne
      // Unterseite: Ein Entwurf ist ein Stand, kein Bestand aus Teilen, die
      // aus verschiedenen Fassungen stammen dürften.
      if (subPath !== null) return json(404, { error: 'not_found' });

      let body: { html?: unknown; isolation?: unknown; pages?: unknown; ttl?: unknown };
      try {
        // `request.json()` liefert `unknown` — der Inhalt kommt von aussen und
        // wird unten Feld für Feld geprüft, nicht per Zusicherung geglaubt.
        const parsed: unknown = await request.json();
        if (typeof parsed !== 'object' || parsed === null) {
          return json(400, { error: 'invalid_json' });
        }
        body = parsed as { html?: unknown; isolation?: unknown; pages?: unknown; ttl?: unknown };
      } catch {
        return json(400, { error: 'invalid_json' });
      }

      const html = typeof body.html === 'string' ? body.html : '';
      if (!html) return json(400, { error: 'html_required' });

      // Unterseiten: nur Zeichenketten unter absoluten Pfaden. Was diese
      // Prüfung nicht passiert, wird verworfen und nicht etwa als leere Seite
      // abgelegt — eine Vorschau, die eine Seite behauptet und nichts zeigt,
      // ist schlechter als eine, die sie gar nicht führt.
      const pages: Record<string, string> = {};
      if (body.pages && typeof body.pages === 'object' && !Array.isArray(body.pages)) {
        for (const [path, value] of Object.entries(body.pages as Record<string, unknown>)) {
          if (path.startsWith('/') && path !== '/' && typeof value === 'string' && value !== '') {
            pages[path.replace(/\/+$/, '')] = value;
          }
        }
      }

      // Unbekannte Werte fallen auf die strengere Stufe zurück, nicht auf die
      // lockerere. Ein Tippfehler darf keine Skripte freischalten.
      const isolation: PreviewIsolation = body.isolation === 'interactive' ? 'interactive' : 'static';

      const stored: StoredPreview = {
        html, pages, isolation, created_at: new Date().toISOString(),
      };
      const serialized = JSON.stringify(stored);
      // Gemessen wird der ganze Eintrag. Eine Grenze, die nur die Startseite
      // prüft, liesse sich mit Unterseiten beliebig überschreiten.
      if (new TextEncoder().encode(serialized).byteLength > ANONYMOUS_PREVIEW_MAX_BYTES) {
        return json(413, { error: 'html_too_large' });
      }

      // Die Lebensdauer kommt vom Schreiber, weil nur er sie kennt: Sie ist
      // die **Restzeit der Sitzung**, nicht sieben feste Tage. Ohne Angabe
      // gilt die Obergrenze; ausserhalb des erlaubten Bereichs wird geklemmt,
      // nicht abgelehnt — der Worker ist die zweite Grenze, nicht die erste.
      const requested = typeof body.ttl === 'number' && Number.isFinite(body.ttl)
        ? Math.floor(body.ttl)
        : ANONYMOUS_PREVIEW_TTL_SECONDS;
      const ttl = Math.min(
        Math.max(requested, MIN_PREVIEW_TTL_SECONDS),
        ANONYMOUS_PREVIEW_TTL_SECONDS,
      );

      await env.PREVIEWS.put(previewId, serialized, { expirationTtl: ttl });

      return json(201, { ok: true, preview_id: previewId, expires_in: ttl });
    }

    if (request.method === 'DELETE') {
      if (!authorizeWrite(request, env)) return json(401, { error: 'unauthorized' });
      if (subPath !== null) return json(404, { error: 'not_found' });
      await env.PREVIEWS.delete(previewId);
      return json(200, { ok: true });
    }

    return json(405, { error: 'method_not_allowed' });
  },
};
