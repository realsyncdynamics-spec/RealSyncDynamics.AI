/**
 * Rastermasse, Radien und Bewegung der App-Oberflaeche — der Teil des
 * Handoff-Entwurfs („RealSync Dynamics AI — Web + Mobile Prototyp"), der im
 * Repo noch fehlte.
 *
 * ## Warum hier keine Farben stehen
 *
 * Farben der App stehen an genau einer Stelle: `osChrome.ts` (Rollen-
 * Konstanten und Tailwind-Fragmente) mit der CSS-Bruecke
 * `governance-os-app.css` (`.os-chrome.rs-app`, `--color-rs-*`). Seit
 * Handoff v2 Phase 2 ist das die Handoff-Palette (Cyan/Primary) statt Gold.
 * Eine zweite Palette hier wuerde genau die Doppelung erzeugen, die
 * `osChrome.ts` verhindern soll.
 *
 * Diese Datei traegt, was der Entwurf beisteuert und was dort fehlt: die
 * Rastermasse der Shell, die Radienstaffel, die Bewegungskurve — alles
 * farbneutral und damit unabhaengig davon, welche Palette gilt.
 *
 * ## Was diese Datei nicht ist
 *
 * Der Entwurf ist UI-Spezifikation, kein Datenmodell. Die Zahlen, die im
 * Prototyp danebenstehen (acht Systeme `s1`–`s8`, Score-Formeln, simulierte
 * Hash-Ketten), sind ausdruecklich nicht uebernommen. Die Ansichten ziehen
 * ihre Daten weiter ueber `useTenant`, `fetchTenantAssets` und
 * `evidenceVaultApi`.
 */

// ── Radien ──────────────────────────────────────────────────────────────────

/** Eingaben, Klassen-Badges. */
export const APP_RADIUS_SM = 4;
/** Navigations-Chips. */
export const APP_RADIUS_CHIP = 6;
/** Schaltflaechen, Karten. */
export const APP_RADIUS_MD = 8;
/** Preis-Karten. */
export const APP_RADIUS_LG = 16;
/** Status-Pillen. */
export const APP_RADIUS_PILL = 9999;

// ── Rastermasse der Shell ───────────────────────────────────────────────────

/** Breite der Seitenleiste ab `lg`. */
export const APP_SIDEBAR_WIDTH = 248;
/** Hoehe eines Navigationseintrags in der Seitenleiste. */
export const APP_NAV_ITEM_HEIGHT = 38;
/** Hoehe der Kopfzeile. */
export const APP_HEADER_HEIGHT = 56;
/** Hoehe der Kopfzeile auf Mobilgeraeten. */
export const APP_HEADER_HEIGHT_MOBILE = 58;

// ── Bewegung ────────────────────────────────────────────────────────────────

/**
 * Der Entwurf schreibt eine einzige Kurve vor — keine Federn, kein
 * Hover-Zoom. 200 ms ist der Standard, 600 ms nur das Versiegeln der
 * Hash-Kette.
 */
export const APP_EASING = 'cubic-bezier(.2,.8,.2,1)';
export const APP_DURATION_MS = 200;
export const APP_DURATION_SEAL_MS = 600;

/** Abgeschaltete Bedienelemente. */
export const APP_DISABLED_OPACITY = 0.45;

// ── Durchsetzbarkeits-Klassen A–D ───────────────────────────────────────────

/**
 * Klasse → Tailwind-Klassenfragment.
 *
 * Die Zuordnung gehoert hierher und nicht in die Ansichten: Dashboard,
 * Systemliste und Klassifizierung zeigen dieselbe Klasse; traegt sie dort
 * drei Farben, liest man drei Aussagen. Die Klassen selbst kommen aus
 * `shared/enforcement-classes.ts`.
 *
 * Tailwind-Klassen statt Hex-Werte — dem Muster von
 * `lib/governance/severityPalette.ts` folgend, das fuer Finding-Severity
 * dieselbe Aufgabe loest. Die Farbfamilien sind von dort uebernommen, damit
 * ein Nutzer, der Befunde und Klassen nebeneinander sieht, nicht zwei
 * Farbsprachen lernen muss. B traegt `cyan` wie im Entwurf.
 */
export interface EnforcementClassStyle {
  /** Vollstaendige Badge-Klasse (border + bg + text). */
  badge: string;
  /** Nur die Textfarbe — fuer Inline-Zaehler und Legenden. */
  text: string;
  /** Flaeche fuer den gestapelten Balken. */
  bar: string;
}

export const APP_CLASS_STYLES: Readonly<Record<'A' | 'B' | 'C' | 'D', EnforcementClassStyle>> = {
  A: {
    badge: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    text: 'text-emerald-300',
    bar: 'bg-emerald-500',
  },
  B: {
    badge: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200',
    text: 'text-cyan-300',
    bar: 'bg-cyan-500',
  },
  C: {
    badge: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    text: 'text-amber-300',
    bar: 'bg-amber-500',
  },
  D: {
    badge: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
    text: 'text-rose-300',
    bar: 'bg-rose-500',
  },
};
