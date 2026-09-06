// Vorschau-Persistenz des anonymen Build-Pfads.
//
//   Sitzung (Datenbank)  →  gerendertes Dokument  →  siteos-preview (KV)
//
// ## Warum diese Datei getrennt vom Handler liegt
//
// Der Handler läuft nur unter Deno mit `service_role`. Dieses Modul hat
// weder Datenbank noch Geheimnis im Modulraum: Es bekommt Ziel, `fetch` und
// Kennung als Argumente. Damit ist genau der Teil prüfbar, der über das Netz
// hinausgeht — ohne KV, ohne deployten Worker, ohne Cloudflare-Konto.
//
// ## Was hier NICHT passiert
//
// Es wird nichts erzeugt und nichts entschieden. Der Blueprint kommt aus der
// Sitzung, das HTML aus `packages/siteos-core` — dieselbe Datei, die auch im
// Deploy-Artefakt landet. Dieses Modul legt sie nur ab.
//
// ## Die Vorschau ist zweitrangig, die Sitzung ist die Wahrheit
//
// Schlägt die Ablage fehl, ist der Entwurf trotzdem gebaut, gespeichert und
// übernehmbar. Deshalb wirft hier nichts: Jeder Ausgang ist ein Wert, den
// der Aufrufer weiterreicht (`status`), statt eines Fehlers, der den
// Bau-Pfad mitreisst. Eine fehlende Vorschau ist ein fehlendes Fenster, kein
// verlorenes Haus.
//
// ## Verfall
//
// Die Vorschau darf den Entwurf **nicht überleben**. Ihre Lebensdauer ist
// deshalb kein fester Wert, sondern die Restzeit der Sitzung bis
// `expires_at` (siehe `ttlUntil`). Eine Verfeinerung am sechsten Tag
// verlängert die Vorschau nicht auf sieben weitere — sonst stünde nach dem
// Verfall der Sitzung noch ein Dokument im Netz, zu dem es keinen Entwurf
// mehr gibt.

import {
  ANONYMOUS_PREVIEW_MAX_BYTES,
  ANONYMOUS_PREVIEW_TTL_SECONDS,
  MIN_PREVIEW_TTL_SECONDS,
  isPreviewId,
  withPreviewCsp,
  type PreviewIsolation,
} from '../../../src/lib/preview-sandbox.ts';
import { renderSite, type SiteBlueprint } from '../../../packages/siteos-core/src/index.ts';

/** Ziel des Schreibpfads. Beide Teile zusammen oder gar nicht. */
export interface PreviewTarget {
  /** Herkunft des Workers, ohne Pfad, ohne Schrägstrich am Ende. */
  origin: string;
  /** Dasselbe Geheimnis, das im Worker als `PREVIEW_WRITE_TOKEN` steht. */
  token: string;
}

/**
 * Ausgang eines Ablageversuchs.
 *
 * `not_configured` ist bewusst von `failed` getrennt: Das eine heisst „diese
 * Umgebung hat keinen Vorschau-Worker" — ein bekannter, dokumentierter
 * Zustand (siehe `docs/product/siteos-anonymous-build.md`). Das andere heisst
 * „es gibt einen, und er hat abgelehnt". Zusammengefasst wäre der offene
 * Infrastruktur-Punkt von einem echten Fehler nicht mehr unterscheidbar.
 */
export type PreviewOutcome =
  | { status: 'stored'; previewId: string; url: string; expiresInSeconds: number }
  | { status: 'not_configured' }
  | { status: 'failed'; reason: string };

/** Was der Worker entgegennimmt. Feld für Feld geprüft, siehe `workers/siteos-preview`. */
export interface PreviewPayload {
  /** Startseite. Bleibt eigenes Feld — ältere Worker-Stände kennen nur dieses. */
  html: string;
  /** Alle übrigen Seiten nach Pfad. Ohne sie führt jeder Navigationslink ins Leere. */
  pages: Record<string, string>;
  isolation: PreviewIsolation;
  /** Lebensdauer in Sekunden. Der Worker begrenzt sie zusätzlich selbst. */
  ttl: number;
}

export const PREVIEW_ORIGIN_ENV = 'SITEOS_PREVIEW_ORIGIN';
export const PREVIEW_TOKEN_ENV = 'SITEOS_PREVIEW_WRITE_TOKEN';

/**
 * Liest das Ziel aus der Umgebung.
 *
 * `null`, sobald eines von beiden fehlt. Ein halb konfiguriertes Ziel wäre
 * der gefährlichere Fall: eine Herkunft ohne Geheimnis erzeugt bei jedem
 * Aufruf einen 401 und sieht im Protokoll aus wie ein Angriff.
 */
export function readPreviewTarget(getEnv: (key: string) => string | undefined): PreviewTarget | null {
  const origin = getEnv(PREVIEW_ORIGIN_ENV)?.trim().replace(/\/+$/, '') ?? '';
  const token = getEnv(PREVIEW_TOKEN_ENV)?.trim() ?? '';
  if (origin === '' || token === '') return null;
  return { origin, token };
}

/** Öffentliche Adresse einer Vorschau. Einmal hier, nicht in jeder Antwort neu. */
export function previewUrl(origin: string, previewId: string): string {
  return `${origin.replace(/\/+$/, '')}/p/${previewId}`;
}

/**
 * Restlebensdauer der Sitzung in Sekunden, auf den erlaubten Bereich begrenzt.
 *
 * `0` heisst: Die Sitzung ist abgelaufen — dann wird nichts abgelegt. Der
 * Aufrufer prüft den Verfall ohnehin vorher; diese Funktion ist die zweite,
 * unabhängige Stelle, an der eine abgelaufene Sitzung kein Dokument mehr
 * erzeugt.
 */
export function ttlUntil(expiresAt: string, now: number = Date.now()): number {
  const remaining = Math.floor((new Date(expiresAt).getTime() - now) / 1000);
  if (!Number.isFinite(remaining) || remaining < MIN_PREVIEW_TTL_SECONDS) return 0;
  return Math.min(remaining, ANONYMOUS_PREVIEW_TTL_SECONDS);
}

/**
 * Baut das abzulegende Dokument.
 *
 * `showcase`, weil die Vorschau zeigt, was der Kunde bekommt — dieselbe
 * Stufe, die `/build` im Rahmen anzeigt. Der Hash der Sitzung hängt daran
 * nicht: Er wird über den Blueprint gebildet, nicht über das Markup.
 *
 * Die CSP steht zusätzlich im Dokument, obwohl der Worker sie als Header
 * setzt. Beide stammen aus derselben Datei, die strengere gilt — und ein
 * Dokument, das seine Richtlinie mitbringt, bleibt auch dann abgesichert,
 * wenn es jemals über einen anderen Weg ausgeliefert wird.
 */
export function buildPreviewPayload(blueprint: SiteBlueprint, ttl: number): PreviewPayload {
  const isolation: PreviewIsolation = 'static';
  const rendered = renderSite(blueprint, { presentation: 'showcase' });

  const pages: Record<string, string> = {};
  let root = '';
  for (const page of rendered) {
    const html = withPreviewCsp(page.html, isolation);
    if (page.path === '/') root = html;
    else pages[page.path] = html;
  }
  // Kein '/' im Blueprint wäre ein Fehler weiter vorn; die Vorschau macht
  // daraus keine leere Seite, sondern nimmt die erste vorhandene.
  if (root === '') root = withPreviewCsp(rendered[0]?.html ?? '', isolation);

  return { html: root, pages, isolation, ttl };
}

/** Grösse des Dokuments in Bytes — dieselbe Messung wie im Worker. */
export function payloadBytes(payload: PreviewPayload): number {
  return new TextEncoder().encode(JSON.stringify(payload)).byteLength;
}

/**
 * Legt die Vorschau unter einer Kennung ab (`PUT /p/:id`).
 *
 * Überschreiben ist gewollt: Eine Verfeinerung behält die Kennung und
 * ersetzt den Inhalt. Ein geteilter Link zeigt danach den neuen Stand, statt
 * ins Leere zu führen — und es entsteht nicht bei jeder Anweisung eine
 * weitere Kopie des Entwurfs im Netz.
 */
export async function publishPreview(
  target: PreviewTarget | null,
  previewId: string,
  blueprint: SiteBlueprint,
  ttl: number,
  fetchImpl: typeof fetch = fetch,
): Promise<PreviewOutcome> {
  if (!target) return { status: 'not_configured' };
  if (!isPreviewId(previewId)) return { status: 'failed', reason: 'invalid_preview_id' };
  if (ttl <= 0) return { status: 'failed', reason: 'session_expired' };

  const payload = buildPreviewPayload(blueprint, ttl);
  const bytes = payloadBytes(payload);
  if (bytes > ANONYMOUS_PREVIEW_MAX_BYTES) {
    // Vorab abgelehnt statt in einen 413 zu laufen: Der Grund ist hier
    // bekannt und benennbar, im Statuscode des Workers wäre er es nicht mehr.
    return { status: 'failed', reason: `payload_too_large:${bytes}` };
  }

  try {
    const response = await fetchImpl(previewUrl(target.origin, previewId), {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${target.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) return { status: 'failed', reason: `http_${response.status}` };

    return {
      status: 'stored',
      previewId,
      url: previewUrl(target.origin, previewId),
      expiresInSeconds: ttl,
    };
  } catch (e) {
    return { status: 'failed', reason: `unreachable:${(e as Error)?.message ?? 'unknown'}` };
  }
}

/**
 * Entfernt eine Vorschau (`DELETE /p/:id`).
 *
 * Gebraucht bei der Übernahme: Ab da gehört der Entwurf einem Mandanten und
 * unterliegt dessen Aufbewahrung. Eine daneben weiterlaufende, anonym
 * abrufbare Kopie wäre eine zweite Auslieferung desselben Inhalts, die
 * niemand mehr zurücknehmen kann — der Zweck der anonymen Ablage endet mit
 * dem Claim (Art. 5 Abs. 1 lit. b DSGVO).
 *
 * Bestätigt oder nicht — der Claim hängt nicht daran (`false` wird
 * protokolliert, nicht geworfen).
 */
export async function revokePreview(
  target: PreviewTarget | null,
  previewId: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!target || !previewId || !isPreviewId(previewId)) return false;
  try {
    const response = await fetchImpl(previewUrl(target.origin, previewId), {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${target.token}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}
