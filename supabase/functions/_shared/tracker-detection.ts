/**
 * Tracker-Detection-Helfer für den DSGVO-Audit-Scanner.
 *
 * Hintergrund (False-Positive-Bug „immer 28/100"):
 * Der statische Scanner matchte Tracker-Domains (googletagmanager.com,
 * connect.facebook.net, analytics.tiktok.com, snap.licdn.com, …) im
 * GESAMTEN Roh-HTML. Damit zählten auch Vorkommen, die gar kein Laden
 * eines Trackers bedeuten:
 *
 *   1. Content-Security-Policy als <meta http-equiv> — eine CSP-Allowlist
 *      LISTET erlaubte Origins auf. Das Auflisten einer Domain ist das
 *      GEGENTEIL eines Verstoßes; es heißt nicht, dass der Tracker geladen
 *      wird. Eine Seite mit
 *        script-src 'self' https://www.googletagmanager.com https://analytics.tiktok.com …
 *      wurde so fälschlich als „lädt GA + TikTok ohne Consent" gewertet.
 *   2. Resource-Hints (<link rel="preconnect" | "dns-prefetch">) — reine
 *      Verbindungs-Hinweise, kein Script-Load.
 *
 * Folge: Jede Seite mit ähnlicher CSP-Allowlist erzeugte denselben
 * Befund-Mix (GA + Meta + LinkedIn + TikTok + „kein CSP") und denselben
 * Score (~28/100) — der Output wirkte „hardcoded", obwohl die Engine
 * dynamisch ist.
 *
 * `stripPolicyDeclarations` entfernt diese Deklarationen, BEVOR die
 * Tracker-Heuristik läuft. Echte Treffer — `<script src="…tracker…">` und
 * Runtime-Aufrufe (gtag(, fbq(, ttq(, lintrk(, _paq) — bleiben erhalten.
 *
 * Die Funktion ist bewusst pure (kein Fetch, kein Network) damit sie
 * direkt aus der Edge-Function aufgerufen und unter Vitest getestet
 * werden kann — analog zu `jurisdiction.ts`.
 *
 * ─── ReDoS, behoben am 2026-08-30 ───────────────────────────────────────
 *
 * Beide Funktionen liefen ueber `<meta[^>]*http-equiv=…>`. Weil `[^>]` auch
 * `h`, `t`, `p` matcht, probiert die Maschine an jeder Fundstelle jede
 * Aufteilung durch. Gemessen auf `'<meta '.repeat(60_000)` — 360 kB ohne
 * ein einziges `>`, also nur Fast-Treffer:
 *
 *   stripPolicyDeclarations  8 815 ms
 *   effectiveCspValue        9 233 ms
 *
 * Das ist ueber einen oeffentlichen, nicht authentifizierten Endpunkt
 * erreichbar (`/audit`, `cookie-scan`) und mit einer einzigen praeparierten
 * Seite ausloesbar — eine Denial-of-Service-Luecke, keine Stilfrage.
 * CodeQL hat sie als `polynomial ReDoS` gemeldet.
 *
 * Beide arbeiten jetzt ueber `_shared/html-tags.ts`: ein `indexOf`-Durchlauf
 * ohne Wildcard-Quantor. Dieselbe Eingabe: unter 5 ms. Festgenagelt in
 * `test/edge/tracker-detection.test.ts`.
 */
import { tagMatches, attrOf, cutRanges } from './html-tags.ts';

/**
 * Entfernt nicht-ladende Policy-/Hint-Deklarationen aus dem HTML.
 *
 * Entfernt werden:
 *   - <meta http-equiv="Content-Security-Policy" content="…"> (Allowlist)
 *   - <link rel="preconnect"> / <link rel="dns-prefetch"> (Connection-Hints)
 *
 * Bewusst NICHT entfernt: <link rel="preload" | "prefetch">, da diese
 * eine Ressource tatsächlich anfordern und damit näher an einem Load sind.
 */
export function stripPolicyDeclarations(html: string): string {
  if (!html) return html;

  const cuts: Array<{ start: number; end: number }> = [];

  // CSP via <meta http-equiv="Content-Security-Policy" …> (Allowlist).
  for (const m of tagMatches(html, 'meta')) {
    const he = (attrOf(m.tag, 'http-equiv') ?? '').trim().toLowerCase();
    if (he === 'content-security-policy' || he === 'content-security-policy-report-only') {
      cuts.push(m);
    }
  }

  // Reine Verbindungs-Hints. Bewusst NICHT entfernt: rel="preload" /
  // "prefetch" — die fordern eine Ressource tatsaechlich an.
  for (const m of tagMatches(html, 'link')) {
    const rel = (attrOf(m.tag, 'rel') ?? '').trim().toLowerCase();
    if (rel === 'preconnect' || rel === 'dns-prefetch') cuts.push(m);
  }

  return cutRanges(html, cuts);
}

/**
 * Extrahiert den effektiven Content-Security-Policy-Wert aus HTTP-Header
 * ODER <meta http-equiv="Content-Security-Policy">.
 *
 * Hinweis zur Browser-Semantik: Ein per <meta> ausgelieferter CSP wird für
 * die meisten Direktiven (script-src, style-src, default-src, …) vom Browser
 * durchgesetzt — daher zählt er für den „CSP vorhanden"-Check. NICHT
 * durchgesetzt werden per <meta> die Direktiven `frame-ancestors`, `sandbox`
 * und `report-uri`; der Clickjacking-Check (X-Frame-Options /
 * frame-ancestors) muss deshalb header-basiert bleiben und darf den
 * Meta-Wert NICHT akzeptieren.
 *
 * `-report-only` zählt hier bewusst **nicht**: Ein Report-Only-CSP meldet,
 * erzwingt aber nichts.
 */
export function effectiveCspValue(headerCsp: string | null | undefined, html: string): string {
  if (headerCsp && headerCsp.trim()) return headerCsp;
  for (const m of tagMatches(html, 'meta')) {
    const he = (attrOf(m.tag, 'http-equiv') ?? '').trim().toLowerCase();
    if (he !== 'content-security-policy') continue;
    const content = attrOf(m.tag, 'content');
    if (content !== null) return content.trim();
  }
  return '';
}
