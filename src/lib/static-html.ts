/**
 * Statische HTML-Dokumente sicher anzeigen, öffnen und herunterladen.
 *
 * ── Warum es diese Datei gibt ────────────────────────────────────────────
 *
 * Generierte Dokumente (DSE, AVV, VVT, TOM, Audit-, Evidence- und CEO-Berichte)
 * kommen als vollständiges HTML vom Server. Ihr Inhalt enthält Werte, die
 * nicht von uns stammen: Domain, Firmenname, Befunde eines gescannten
 * Fremd-Webauftritts, manuelle Bearbeitungen.
 *
 * Bisher wurde dieses HTML als `blob:`-URL in einem neuen Tab geöffnet. Eine
 * `blob:`-URL erbt die **Herkunft der Anwendung**. Ein eingeschleustes
 * `<script>` oder `onerror=` liefe also in unserer Herkunft und erreichte
 * `localStorage` — dort liegt die Supabase-Sitzung.
 *
 * ── Was hier passiert ────────────────────────────────────────────────────
 *
 * 1. Das HTML wird mit `DOMParser` geparst. Dabei wird kein Skript
 *    ausgeführt und nichts nachgeladen.
 * 2. Aktive Inhalte werden entfernt: Skripte, eingebettete Rahmen und Objekte,
 *    `<base>`, `<link>`, jedes `<meta http-equiv>` (Weiterleitung, fremde CSP),
 *    alle `on*`-Attribute und Adressen mit `javascript:`, `vbscript:` oder
 *    nicht-bildlichem `data:`.
 * 3. Als **erstes** Element im Kopf wird die strenge Vorschau-CSP aus
 *    `preview-sandbox.ts` gesetzt (`script-src 'none'`, `default-src 'none'`).
 *    Weil das über das DOM geschieht und nicht per Textersetzung, kann kein
 *    Inhalt vor der Richtlinie stehen.
 *
 * Bereinigung und CSP sind bewusst doppelt: Jede Schicht allein hätte
 * bekannte Lücken (Parser-Tricks bzw. Inhalte vor dem `<meta>`).
 *
 * Es gibt absichtlich keinen Schalter, der Skripte wieder zulässt. Wer ein
 * interaktives Dokument braucht, nutzt `SandboxedPreviewFrame` mit opaker
 * Herkunft — nicht diesen Pfad.
 */
import { previewCsp } from './preview-sandbox';

/** Elemente, die samt Inhalt entfernt werden. */
export const BLOCKED_ELEMENTS = [
  'script',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'base',
  'link',
  'portal',
  // MathML ist der klassische Träger von Mutation-XSS (Namespace-Verwechslung
  // beim erneuten Parsen). Generierte Dokumente brauchen es nicht.
  'math',
  // Wird je nach Scripting-Flag als Text oder als Elemente geparst — der
  // zweite bekannte mXSS-Träger. Ohne Skripte ohnehin ohne Funktion.
  'noscript',
  // SVG-Animationen können `href` zur Laufzeit auf `javascript:` setzen.
  // Selektoren für SVG-Elemente unterscheiden Groß-/Kleinschreibung.
  'animate',
  'set',
  'animateMotion',
  'animateTransform',
] as const;

/** Attribute, die Adressen tragen und deshalb geprüft werden. */
const URL_ATTRIBUTES = new Set([
  'href',
  'src',
  'xlink:href',
  'action',
  'formaction',
  'poster',
  'background',
  'cite',
  'data',
  'ping',
]);

/**
 * Druck-Buttons der Berichte (`onclick="window.print()"`) sollen weiter
 * funktionieren. Statt Code bleibt nur dieses Kennzeichen stehen; den Klick
 * bindet `openStaticHtmlInNewTab` aus der Anwendung heraus an.
 */
export const PRINT_MARKER = 'data-print';
const PRINT_HANDLER = /^\s*(window\.)?print\(\)\s*;?\s*$/;

/** Attribute, die immer entfernt werden. */
const ALWAYS_REMOVED_ATTRIBUTES = new Set(['srcdoc', 'srcset']);

/**
 * Prüft, ob eine Adresse aktiven Inhalt auslösen kann.
 *
 * Browser ignorieren Steuerzeichen und Leerraum im Schema
 * (`java\tscript:`), deshalb wird vor der Prüfung alles davon entfernt.
 * `data:` ist nur für Rasterbilder in `src` erlaubt.
 */
export function isDangerousUrl(value: string, attribute: string): boolean {
  const normalized = value.replace(/[\u0000- \u007f-\u009f]/g, '').toLowerCase();
  if (normalized.startsWith('javascript:') || normalized.startsWith('vbscript:')) return true;
  if (normalized.startsWith('data:')) {
    const isRasterImage = /^data:image\/(png|jpe?g|gif|webp|avif);/.test(normalized);
    return !(attribute === 'src' && isRasterImage);
  }
  return false;
}

/** Ein Bereinigungsdurchgang: parsen, aktive Inhalte entfernen, serialisieren. */
function sanitizeOnce(html: string): Document {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  doc.querySelectorAll(BLOCKED_ELEMENTS.join(',')).forEach((el) => el.remove());
  doc.querySelectorAll('meta[http-equiv]').forEach((el) => el.remove());

  for (const el of Array.from(doc.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name === 'onclick' && PRINT_HANDLER.test(attr.value)) {
        // Einziger erhaltener „Handler": als Kennzeichen, nicht als Code.
        el.setAttribute(PRINT_MARKER, '');
      }
      if (name.startsWith('on') || ALWAYS_REMOVED_ATTRIBUTES.has(name)) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (URL_ATTRIBUTES.has(name) && isDangerousUrl(attr.value, name)) {
        el.removeAttribute(attr.name);
      }
    }
  }
  return doc;
}

/** Enthält das Dokument noch etwas, das nie im Ergebnis stehen darf? */
function hasActiveContent(doc: Document): boolean {
  if (doc.querySelector(`${BLOCKED_ELEMENTS.join(',')},meta[http-equiv]`)) return true;
  for (const el of Array.from(doc.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || ALWAYS_REMOVED_ATTRIBUTES.has(name)) return true;
      if (URL_ATTRIBUTES.has(name) && isDangerousUrl(attr.value, name)) return true;
    }
  }
  return false;
}

/** Höchstzahl an Durchgängen, bis die Ausgabe stabil sein muss. */
const MAX_PASSES = 4;

/** Fail-closed-Ergebnis, wenn kein stabiles, sauberes Dokument entsteht. */
const BLOCKED_DOCUMENT_BODY =
  '<body><p>Dieses Dokument enthält aktive Inhalte und wurde aus Sicherheitsgründen nicht angezeigt.</p></body>';

function withCspHead(bodyAndHead: Document): string {
  const meta = bodyAndHead.createElement('meta');
  meta.setAttribute('http-equiv', 'Content-Security-Policy');
  meta.setAttribute('content', previewCsp('static'));
  bodyAndHead.head.prepend(meta);
  return `<!doctype html>\n${bodyAndHead.documentElement.outerHTML}`;
}

/**
 * Macht aus beliebigem HTML ein statisches, skriptfreies Dokument mit
 * strenger CSP als erstem Kopf-Element.
 *
 * Bereinigt wird bis zum **Fixpunkt**: Das Ergebnis wird erneut geparst und
 * geprüft, bis es sich nicht mehr ändert. So greift auch Mutation-XSS nicht,
 * bei dem erst das erneute Parsen der Ausgabe ein aktives Element erzeugt.
 * Wird kein stabiler, sauberer Stand erreicht, kommt ein leeres Dokument mit
 * Hinweis zurück (fail-closed).
 */
export function toStaticHtmlDocument(html: string): string {
  let current = sanitizeOnce(html).documentElement.outerHTML;
  for (let pass = 1; pass < MAX_PASSES; pass += 1) {
    const reparsed = new DOMParser().parseFromString(current, 'text/html');
    if (!hasActiveContent(reparsed) && reparsed.documentElement.outerHTML === current) {
      return withCspHead(reparsed);
    }
    current = sanitizeOnce(current).documentElement.outerHTML;
  }
  return withCspHead(new DOMParser().parseFromString(BLOCKED_DOCUMENT_BODY, 'text/html'));
}

/**
 * Bindet Druck-Buttons im geöffneten Tab an. Der Code läuft in der Anwendung,
 * nicht im Dokument — dort bleiben Skripte gesperrt. Schlägt das Anbinden fehl,
 * bleibt der Browser-Druck (Strg/⌘ + P) verfügbar.
 */
function bindPrintButtons(win: Window): void {
  const attach = () => {
    try {
      win.document.querySelectorAll(`[${PRINT_MARKER}]`).forEach((el) => {
        el.addEventListener('click', () => win.print());
      });
    } catch {
      /* fremde Herkunft oder bereits geschlossen — kein Druck-Button, kein Fehler */
    }
  };
  try {
    if (win.document.readyState === 'complete' && win.document.querySelector(`[${PRINT_MARKER}]`)) attach();
    else win.addEventListener('load', attach, { once: true });
  } catch {
    /* siehe oben */
  }
}

/** Wie lange eine `blob:`-Adresse gültig bleibt, damit der neue Tab laden kann. */
const DEFAULT_REVOKE_MS = 30_000;

/**
 * Öffnet ein Dokument bereinigt in einem neuen Tab (Druck → PDF bleibt möglich).
 *
 * Gibt `false` zurück, wenn der Browser das Fenster blockiert hat. Der
 * Verweis auf die Anwendung (`opener`) wird sofort gekappt.
 */
export function openStaticHtmlInNewTab(html: string, revokeAfterMs = DEFAULT_REVOKE_MS): boolean {
  const blob = new Blob([toStaticHtmlDocument(html)], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    try {
      win.opener = null;
    } catch {
      /* einige Browser verweigern das Setzen — unkritisch, Inhalt ist skriptfrei */
    }
    bindPrintButtons(win);
  }
  setTimeout(() => URL.revokeObjectURL(url), revokeAfterMs);
  return win !== null;
}

/** Lädt ein Dokument bereinigt als HTML-Datei herunter. */
export function downloadStaticHtml(html: string, filename: string): void {
  const blob = new Blob([toStaticHtmlDocument(html)], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
