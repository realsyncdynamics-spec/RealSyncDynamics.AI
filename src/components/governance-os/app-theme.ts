/**
 * Gestaltungswerte der App-Oberflaeche — Cyan/Blau, aus dem Handoff-Entwurf
 * „RealSync Dynamics AI — Web + Mobile Prototyp".
 *
 * ## Warum eine eigene Datei neben `landing-theme.ts`
 *
 * Die oeffentliche Startseite traegt Gold auf Anthrazit (`landing-theme.ts`),
 * die App traegt Blau/Cyan auf Marineblau. Das ist kein Versehen, sondern die
 * Trennlinie: Marketing wirbt, die App arbeitet. Zwei Dateien halten diese
 * Trennung sichtbar — wer hier einen Goldwert eintraegt, merkt es.
 *
 * ## Was diese Datei nicht ist
 *
 * Der Entwurf ist **UI-Spezifikation, kein Datenmodell**. Farben, Abstaende
 * und Radien sind verbindlich; die Zahlen, die im Prototyp daneben stehen
 * (acht Systeme `s1`–`s8`, Score-Formeln, simulierte Hash-Ketten), sind es
 * ausdruecklich nicht. Die Ansichten ziehen ihre Daten weiter ueber
 * `useTenant`, `fetchTenantAssets` und `evidenceVaultApi`.
 */

// ── Flaechen ────────────────────────────────────────────────────────────────

/** Grundflaeche der App. */
export const APP_BG = '#070B14';
/** Erhoehte Flaeche: Sidebar, Header, Karten. */
export const APP_SURFACE = '#0D1322';
/** Aktiver Zustand — Nav-Item, Tabellenzeile unter dem Zeiger. */
export const APP_SURFACE_ACTIVE = '#14203A';
/** Gedaempfte Flaeche fuer Segmente und Chips. */
export const APP_SURFACE_MUTED = '#1D2B48';
/** Nur der Landing-Hero des Entwurfs — dunkler als die App. */
export const APP_HERO_BG = '#02050B';

// ── Schrift ─────────────────────────────────────────────────────────────────

export const APP_TEXT = '#F2F5FA';
export const APP_TEXT_SECONDARY = '#C9D1E0';
export const APP_MUTED = '#8A95AC';
/** Fussnoten, Platzhalter, abgeschaltete Beschriftungen. */
export const APP_FAINT = '#5A6684';

// ── Linien ──────────────────────────────────────────────────────────────────

export const APP_LINE = '#1F2B48';
/** Staerker: Umrandung von Eingaben und Sekundaer-Schaltflaechen. */
export const APP_LINE_STRONG = '#2E3C5E';

// ── Akzente ─────────────────────────────────────────────────────────────────

/** Primaerfarbe — Schaltflaechen, aktiver Nav-Zustand. */
export const APP_PRIMARY = '#1E5AFF';
export const APP_PRIMARY_HOVER = '#1641C4';
export const APP_PRIMARY_LIGHT = '#7FA0FF';
/** Zweitfarbe — Kennzeichnungen, Hashes, Fortschritt. */
export const APP_CYAN = '#00B8D4';
export const APP_CYAN_LIGHT = '#4FD4E8';

// ── Zustaende ───────────────────────────────────────────────────────────────

export const APP_SUCCESS = '#10B981';
export const APP_WARNING = '#F5A524';
export const APP_DANGER = '#E5484D';
export const APP_VIOLET = '#7C5CFF';

/**
 * Durchsetzbarkeits-Klassen A–D.
 *
 * Die Zuordnung Klasse → Farbe gehoert hierher, nicht in die Ansichten: Auf
 * dem Dashboard, in der Systemliste und in der Klassifizierung muss dieselbe
 * Klasse dieselbe Farbe tragen, sonst liest man drei verschiedene Aussagen.
 * Die Klassen selbst kommen aus `shared/enforcement-classes.ts`.
 */
export const APP_CLASS_COLORS: Readonly<Record<'A' | 'B' | 'C' | 'D', string>> = {
  A: APP_SUCCESS,
  B: APP_CYAN,
  C: APP_WARNING,
  D: APP_DANGER,
};

// ── Typografie ──────────────────────────────────────────────────────────────

/** Fliesstext und Bedienelemente. */
export const APP_SANS = "'Inter', system-ui, sans-serif";
/** Ueberschriften — enger gesetzt als Inter. */
export const APP_DISPLAY = "'Inter Tight', 'Inter', system-ui, sans-serif";
/** Hashes, Klassenkuerzel, Zeitstempel, Operating Loop. */
export const APP_MONO = "'JetBrains Mono', ui-monospace, monospace";
/** Ausschliesslich die H1 des Landing-Heros. */
export const APP_SERIF = "'Newsreader', Georgia, serif";
/** Inter-Stilsaetze des Entwurfs: einstoeckiges a, gerade Ziffern. */
export const APP_FONT_FEATURES = '"ss01", "cv11"';

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

// ── Rastermasse der Shell ────────────────────────────────────────────────────

/** Breite der Seitenleiste ab `lg`. */
export const APP_SIDEBAR_WIDTH = 248;
/** Hoehe der Kopfzeile. */
export const APP_HEADER_HEIGHT = 56;
/** Hoehe der Kopfzeile auf Mobilgeraeten. */
export const APP_HEADER_HEIGHT_MOBILE = 58;

/**
 * Bewegung. Der Entwurf schreibt eine einzige Kurve vor — keine Federn, kein
 * Hover-Zoom. 200 ms ist der Standard, 600 ms nur das Versiegeln der
 * Hash-Kette.
 */
export const APP_EASING = 'cubic-bezier(.2,.8,.2,1)';
export const APP_DURATION_MS = 200;
export const APP_DURATION_SEAL_MS = 600;

/** Abgeschaltete Bedienelemente. */
export const APP_DISABLED_OPACITY = 0.45;
