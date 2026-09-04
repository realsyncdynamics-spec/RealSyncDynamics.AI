/**
 * Banner-Gestaltung prüfen — nicht nur, ob ein Banner da ist.
 *
 * Warum dieses Modul existiert: Der Scan konnte bisher zwei Fragen
 * beantworten — „gibt es ein Consent-Tool?" (CMP-Erkennung) und „werden
 * Tracker vor der Einwilligung gesetzt?". Beides sagt nichts darüber, ob das
 * Banner selbst zulässig ist. Eine Seite konnte alle Prüfungen bestehen und
 * trotzdem abmahnfähig sein, weil „Alles akzeptieren" ein großer Knopf ist
 * und „Ablehnen" ein grauer Link in der zweiten Ebene.
 *
 * Maßstab: § 25 TDDDG i. V. m. Art. 4 Nr. 11 und Art. 7 Abs. 3 DSGVO — die
 * Einwilligung muss freiwillig und ebenso leicht widerruflich wie erteilbar
 * sein. Die BfDI-Empfehlungen zu Einwilligungsbannern vom 13.08.2026
 * konkretisieren das: Eine Ablehnen-Möglichkeit gehört auf die **erste
 * Ebene** und in **gleicher Deutlichkeit** wie die Zustimmung.
 *
 * Bewusst getrennt vom Browser-Teil: Hier steckt die Bewertung, in
 * `scanner.ts` nur das Einsammeln der Schaltflächen aus dem DOM. Damit ist
 * die Regel ohne Chromium testbar — und das ist der Teil, der sich ändert,
 * wenn die Aufsichtsbehörden nachschärfen.
 *
 * **Kein Einfluss auf `score` und `severity` des Scans.** Die Gewichte sind
 * versionsrelevant: Würden sie sich hier ändern, bekäme jede zuvor gescannte
 * Seite still ein anderes Ergebnis, ohne dass sich an ihr etwas geändert hat.
 * Dieses Modul misst und berichtet; ob daraus eine Punktzahl wird, ist eine
 * eigene Entscheidung.
 */

export type ConsentButtonRole = 'accept' | 'reject' | 'settings' | 'other';

/** Was `scanner.ts` je Schaltfläche aus dem DOM holt. Reine Messwerte. */
export interface ConsentButtonDescriptor {
  text: string;
  /** Breite × Höhe in CSS-Pixeln, aus getBoundingClientRect(). */
  width: number;
  height: number;
  fontSizePx: number;
  /** Numerisch normalisiert; 'bold' → 700, 'normal' → 400. */
  fontWeight: number;
  /** computedStyle, z. B. 'rgb(0, 82, 255)' oder 'rgba(0, 0, 0, 0)'. */
  backgroundColor: string;
  /** true, wenn das Element sichtbar und nicht zusammengeklappt ist. */
  visible: boolean;
}

export interface ClassifiedConsentButton extends ConsentButtonDescriptor {
  role: ConsentButtonRole;
  /** Fläche in px² — das Hauptmaß für „gleiche Deutlichkeit". */
  area: number;
}

export type ConsentFindingCode =
  | 'CB_NO_BANNER_DETECTED'
  | 'CB_NO_REJECT_ON_FIRST_LAYER'
  | 'CB_REJECT_LESS_PROMINENT';

export interface ConsentBannerFinding {
  code: ConsentFindingCode;
  severity: 'low' | 'medium' | 'high';
  title: string;
  detail: string;
  /** Norm, an der der Befund hängt — gehört in den Bericht, nicht in den Code. */
  legal_basis: string;
}

export interface ConsentBannerAnalysis {
  /** Wurde überhaupt eine Schaltfläche gefunden, die nach Consent aussieht? */
  banner_detected: boolean;
  buttons: Array<{ text: string; role: ConsentButtonRole; area: number }>;
  accept_present: boolean;
  reject_on_first_layer: boolean;
  /**
   * Fläche Ablehnen ÷ Fläche Zustimmen. 1.0 = gleich groß, < 1 = kleiner.
   * `null`, wenn eine der beiden Schaltflächen fehlt.
   */
  prominence_ratio: number | null;
  /** Erfüllt das Banner „gleiche Deutlichkeit"? `null` ohne Vergleichsbasis. */
  equal_prominence: boolean | null;
  findings: ConsentBannerFinding[];
}

// ─── Klassifikation ──────────────────────────────────────────────────────────

/**
 * Reihenfolge ist bedeutungstragend, nicht kosmetisch: „Nur notwendige
 * akzeptieren" enthält *akzeptieren* und ist trotzdem eine Ablehnung. Wer
 * zuerst auf Zustimmung prüft, klassifiziert genau die Schaltfläche falsch,
 * um die es geht. Deshalb: reject → settings → accept.
 */
const REJECT_PATTERNS = [
  'ablehnen', 'alle ablehnen', 'nur notwendig', 'nur erforderlich',
  'nur essenziell', 'nur essentiell', 'nur technisch', 'ohne einwilligung',
  'nicht einverstanden', 'widersprechen',
  'reject', 'decline', 'deny', 'refuse', 'necessary only', 'essential only',
  'only necessary', 'only essential', 'continue without',
];

const SETTINGS_PATTERNS = [
  'einstellungen', 'anpassen', 'konfigurieren', 'verwalten', 'auswahl',
  'mehr optionen', 'details', 'individuell', 'selbst entscheiden',
  'settings', 'preferences', 'manage', 'customize', 'options', 'configure',
  'more choices', 'let me choose',
];

const ACCEPT_PATTERNS = [
  'akzeptieren', 'zustimmen', 'einverstanden', 'alle erlauben', 'alle zulassen',
  'annehmen', 'verstanden', 'zustimmung',
  'accept', 'agree', 'allow all', 'allow cookies', 'got it', 'i understand',
  'okay', 'ok',
];

function matches(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

export function classifyConsentButton(rawText: string): ConsentButtonRole {
  const text = rawText.toLowerCase().replace(/\s+/g, ' ').trim();
  if (text.length === 0) return 'other';
  if (matches(text, REJECT_PATTERNS)) return 'reject';
  if (matches(text, SETTINGS_PATTERNS)) return 'settings';
  if (matches(text, ACCEPT_PATTERNS)) return 'accept';
  return 'other';
}

// ─── Bewertung ───────────────────────────────────────────────────────────────

/**
 * Ab wann gilt Ablehnen als „ebenso deutlich"? 80 % der Fläche der
 * Zustimmung. Die Zahl ist eine Konvention, keine Norm — das Gesetz sagt
 * „gleiche Deutlichkeit", nicht „≥ 0,8". Der Schwellwert lässt Layout-Rauschen
 * durch (unterschiedlich lange Beschriftungen bei gleichem Stil) und greift
 * bei dem, worum es geht: der bewusst kleiner gehaltenen Ablehnung.
 */
export const PROMINENCE_THRESHOLD = 0.8;

/** Eine Schaltfläche ohne Hintergrund neben einer gefüllten liest sich als Link. */
function isTransparent(backgroundColor: string): boolean {
  const bg = backgroundColor.toLowerCase().replace(/\s+/g, '');
  return bg === 'transparent' || bg === 'rgba(0,0,0,0)' || bg.endsWith(',0)');
}

export function assessConsentBanner(
  descriptors: ConsentButtonDescriptor[],
): ConsentBannerAnalysis {
  const classified: ClassifiedConsentButton[] = descriptors
    .filter((d) => d.visible)
    .map((d) => ({
      ...d,
      role: classifyConsentButton(d.text),
      area: Math.max(0, d.width) * Math.max(0, d.height),
    }));

  const consentButtons = classified.filter((b) => b.role !== 'other');
  const findings: ConsentBannerFinding[] = [];

  if (consentButtons.length === 0) {
    return {
      banner_detected: false,
      buttons: [],
      accept_present: false,
      reject_on_first_layer: false,
      prominence_ratio: null,
      equal_prominence: null,
      findings: [{
        code: 'CB_NO_BANNER_DETECTED',
        severity: 'low',
        title: 'Kein Einwilligungsbanner auf der ersten Ebene gefunden',
        detail:
          'Auf der geladenen Seite war keine Schaltfläche zu erkennen, die eine ' +
          'Einwilligung erteilt oder verweigert. Das ist zulässig, wenn die Seite ' +
          'keine einwilligungspflichtigen Cookies oder Tracker setzt — dann ist ein ' +
          'Banner sogar überflüssig. Werden im selben Scan Tracker vor der ' +
          'Einwilligung gemeldet, ist es dagegen ein Befund.',
        legal_basis: '§ 25 Abs. 1 TDDDG',
      }],
    };
  }

  // Die größte Fläche je Rolle ist maßgeblich: Manche Banner blenden dieselbe
  // Schaltfläche mehrfach ein (Desktop- und Mobil-Variante im selben DOM), von
  // denen nur eine wirklich sichtbar ist.
  const largestOf = (role: ConsentButtonRole): ClassifiedConsentButton | null =>
    consentButtons
      .filter((b) => b.role === role)
      .sort((a, b) => b.area - a.area)[0] ?? null;

  const accept = largestOf('accept');
  const reject = largestOf('reject');

  let prominenceRatio: number | null = null;
  let equalProminence: boolean | null = null;

  if (accept && !reject) {
    findings.push({
      code: 'CB_NO_REJECT_ON_FIRST_LAYER',
      severity: 'high',
      title: 'Ablehnen fehlt auf der ersten Ebene',
      detail:
        'Das Banner bietet eine Zustimmung, aber keine gleichrangige Ablehnung ' +
        `auf derselben Ebene${largestOf('settings') ? ' — die Ablehnung ist allenfalls über „Einstellungen“ erreichbar' : ''}. ` +
        'Eine Einwilligung ist damit nicht freiwillig: Wer sie verweigern will, ' +
        'muss dafür mehr Aufwand treiben als wer zustimmt.',
      legal_basis: '§ 25 Abs. 1 TDDDG · Art. 4 Nr. 11, Art. 7 Abs. 3 DSGVO · BfDI-Empfehlungen vom 13.08.2026',
    });
  }

  if (accept && reject) {
    // Division durch null vermeiden: Eine Zustimmung ohne Fläche ist kein
    // Vergleichsmaßstab, sondern ein kaputter Messwert.
    prominenceRatio = accept.area > 0 ? reject.area / accept.area : null;

    const reasons: string[] = [];
    if (prominenceRatio !== null && prominenceRatio < PROMINENCE_THRESHOLD) {
      reasons.push(
        `die Ablehnen-Schaltfläche belegt nur ${Math.round(prominenceRatio * 100)} % der Fläche der Zustimmung`,
      );
    }
    if (reject.fontSizePx < accept.fontSizePx) {
      reasons.push(`kleinere Schrift (${reject.fontSizePx} px gegenüber ${accept.fontSizePx} px)`);
    }
    if (isTransparent(reject.backgroundColor) && !isTransparent(accept.backgroundColor)) {
      reasons.push('ohne Hintergrundfläche neben einer gefüllten Zustimmung — sie liest sich als Link, nicht als gleichwertige Wahl');
    }

    equalProminence = reasons.length === 0;

    if (reasons.length > 0) {
      findings.push({
        code: 'CB_REJECT_LESS_PROMINENT',
        severity: 'medium',
        title: 'Ablehnen ist weniger deutlich als Zustimmen',
        detail:
          'Beide Möglichkeiten stehen auf der ersten Ebene, aber nicht gleichwertig: ' +
          `${reasons.join('; ')}. Die Einwilligung muss ebenso leicht zu verweigern wie zu erteilen sein.`,
        legal_basis: '§ 25 Abs. 1 TDDDG · Art. 7 Abs. 3 DSGVO · BfDI-Empfehlungen vom 13.08.2026',
      });
    }
  }

  return {
    banner_detected: true,
    buttons: consentButtons.map((b) => ({ text: b.text, role: b.role, area: b.area })),
    accept_present: accept !== null,
    reject_on_first_layer: reject !== null,
    prominence_ratio: prominenceRatio,
    equal_prominence: equalProminence,
    findings,
  };
}
