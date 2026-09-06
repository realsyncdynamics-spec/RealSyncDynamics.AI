/**
 * Klassifikations-PIP (Policy Information Point) — P1-2.
 *
 * Warum eigener Baustein: Der erste Planentwurf hat `data.classification`
 * schlicht unterstellt (Selbstkritik K5). Ohne Klassifikation ist jede
 * `data_transfer`-Policy zahnlos — und eine falsche Klassifikation erzeugt
 * entweder Fehlalarme (Mitarbeiter umgehen das System, Risiko R5) oder
 * Blindheit.
 *
 * Datenschutz by Design: Dieses Modul gibt NIEMALS gefundene Inhalte
 * zurueck — nur, WELCHE Detektoren angeschlagen haben und wie oft.
 * `detectSignals()` ist bewusst exportiert, damit sie DORT laeuft, wo der
 * Inhalt ohnehin liegt (SDK-Wrapper, Gateway, Scanner); an den PDP gehen
 * nur die Signalnamen. Das haelt die Zusage der Connectors ein
 * („weder Prompt noch Response-Text verlassen den Prozess").
 *
 * DSGVO: Art. 9 (besondere Kategorien) wird als eigene Stufe gefuehrt,
 * nicht mit „personenbezogen" vermischt. Art. 5 Abs. 1 lit. c
 * (Datenminimierung) ist der Grund fuer die Signal-statt-Inhalt-Bauweise.
 *
 * Rein und importfrei — laeuft in Deno und Vitest, wie core.ts.
 */

// ─── Stufen ──────────────────────────────────────────────────────────────────

export type DataClassification =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'personal_data'
  | 'special_category'
  | 'unknown';

/**
 * Schutzbedarf, aufsteigend. `unknown` liegt bewusst UNTER `internal`:
 * Nichtwissen ist kein Schutz und darf keine Regel ausloesen, die fuer
 * bekannte Daten gedacht ist — es fuehrt stattdessen ueber `uncertain`
 * zur Abschwaechung (siehe unten).
 */
const SENSITIVITY: Record<DataClassification, number> = {
  unknown: 0,
  public: 1,
  internal: 2,
  confidential: 3,
  personal_data: 4,
  special_category: 5,
};

export function strictestClassification(
  a: DataClassification,
  b: DataClassification,
): DataClassification {
  return SENSITIVITY[a] >= SENSITIVITY[b] ? a : b;
}

// ─── Signale ─────────────────────────────────────────────────────────────────

export type ClassificationSignal =
  | 'email'
  | 'phone'
  | 'iban'
  | 'tax_id_de'
  | 'card_number'
  | 'postal_address_de'
  | 'health_term'
  | 'religion_term'
  | 'union_term'
  | 'biometric_term';

interface Detector {
  signal: ClassificationSignal;
  pattern: RegExp;
  /** Klassifikation, die dieses Signal mindestens erzwingt. */
  implies: DataClassification;
  /** Beitrag zur Erkennungsguete (0..1). Starke, formatgepruefte
   *  Merkmale wiegen mehr als Wortlisten. */
  weight: number;
}

// Wortlisten bewusst klein und eindeutig gehalten: ein Fehlalarm auf
// „Krankenkasse" ist teurer als eine Luecke, weil er Vertrauen kostet
// und zu Schatten-IT fuehrt (R5). Erweiterungen gehoeren getestet.
const DETECTORS: Detector[] = [
  { signal: 'email',    implies: 'personal_data', weight: 0.55,
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { signal: 'iban',     implies: 'personal_data', weight: 0.85,
    pattern: /\b[A-Z]{2}\d{2}[ ]?(?:[A-Z0-9]{4}[ ]?){2,7}[A-Z0-9]{1,4}\b/g },
  { signal: 'tax_id_de', implies: 'personal_data', weight: 0.8,
    pattern: /\b\d{2}[ ]?\d{3}[ ]?\d{3}[ ]?\d{3}\b/g },
  { signal: 'card_number', implies: 'confidential', weight: 0.8,
    pattern: /\b(?:\d{4}[ -]?){3}\d{4}\b/g },
  { signal: 'phone',    implies: 'personal_data', weight: 0.45,
    pattern: /(?:\+49|0049|\b0)[ -]?\d{2,5}[ -/]?\d{3,9}\b/g },
  { signal: 'postal_address_de', implies: 'personal_data', weight: 0.5,
    pattern: /\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+/g },
  { signal: 'health_term', implies: 'special_category', weight: 0.6,
    pattern: /\b(Diagnose|Krankschreibung|Arbeitsunfähigkeit|Befund|Medikation|Blutwerte|Patientenakte)\b/gi },
  { signal: 'religion_term', implies: 'special_category', weight: 0.6,
    pattern: /\b(Konfession|Religionszugehörigkeit|Kirchensteuer)\b/gi },
  { signal: 'union_term', implies: 'special_category', weight: 0.6,
    pattern: /\b(Gewerkschaftsmitglied|Betriebsratsmitglied|Tarifbindung)\b/gi },
  { signal: 'biometric_term', implies: 'special_category', weight: 0.6,
    pattern: /\b(Fingerabdruck|Gesichtserkennung|Iris-Scan|biometrisch)\b/gi },
];

export interface SignalHit {
  signal: ClassificationSignal;
  /** Anzahl Treffer — NIE der Treffer selbst. */
  count: number;
}

/**
 * Erkennt Signale in einem Text. Laeuft dort, wo der Inhalt ohnehin ist;
 * das Ergebnis enthaelt keinerlei Inhalt und darf gefahrlos an den PDP.
 */
export function detectSignals(text: string): SignalHit[] {
  if (!text) return [];
  const hits: SignalHit[] = [];
  for (const d of DETECTORS) {
    // Frisches RegExp je Aufruf: die Detektoren sind global (/g) und
    // wuerden sonst ueber lastIndex Zustand zwischen Aufrufen schleppen.
    const re = new RegExp(d.pattern.source, d.pattern.flags);
    const count = (text.match(re) ?? []).length;
    if (count > 0) hits.push({ signal: d.signal, count });
  }
  return hits;
}

/** Klassifikation und Guete aus erkannten Signalen. */
export function classifyFromSignals(hits: SignalHit[]): {
  classification: DataClassification;
  confidence: number;
} {
  if (hits.length === 0) return { classification: 'unknown', confidence: 0 };
  let classification: DataClassification = 'unknown';
  let strongest = 0;
  let combined = 0;
  for (const h of hits) {
    const d = DETECTORS.find((x) => x.signal === h.signal);
    if (!d) continue;
    classification = strictestClassification(classification, d.implies);
    strongest = Math.max(strongest, d.weight);
    // Mehrere unabhaengige Signale erhoehen die Guete, aber degressiv:
    // zwei schwache Treffer sind kein starker Treffer.
    combined = combined + d.weight * (1 - combined);
  }
  return {
    classification,
    confidence: Math.min(1, Math.max(strongest, combined)),
  };
}

// ─── Ableitung aus Metadaten ─────────────────────────────────────────────────

// Mapping der im Repo gebraeuchlichen data_types (governance_assets,
// ai_systems) auf Schutzstufen. Unbekannte Typen bleiben 'unknown' —
// lieber unsicher und sichtbar als falsch und still.
const DATA_TYPE_CLASS: Record<string, DataClassification> = {
  public_data: 'public',
  marketing_data: 'public',
  telemetry: 'internal',
  usage_data: 'internal',
  business_data: 'internal',
  financial_data: 'confidential',
  trade_secret: 'confidential',
  source_code: 'confidential',
  customer_data: 'personal_data',
  employee_data: 'personal_data',
  contact_data: 'personal_data',
  personal_data: 'personal_data',
  health_data: 'special_category',
  biometric_data: 'special_category',
  special_category: 'special_category',
};

export function classifyFromDataTypes(dataTypes: string[] | undefined): {
  classification: DataClassification;
  confidence: number;
} {
  if (!dataTypes || dataTypes.length === 0) {
    return { classification: 'unknown', confidence: 0 };
  }
  let classification: DataClassification = 'unknown';
  let known = 0;
  for (const t of dataTypes) {
    const mapped = DATA_TYPE_CLASS[t.toLowerCase()];
    if (!mapped) continue;
    known++;
    classification = strictestClassification(classification, mapped);
  }
  if (known === 0) return { classification: 'unknown', confidence: 0 };
  // Gepflegte Stammdaten sind verlaesslicher als Mustererkennung, aber
  // nur so weit, wie sie vollstaendig sind.
  return { classification, confidence: 0.7 * (known / dataTypes.length) + 0.2 };
}

// ─── Aufloesung ──────────────────────────────────────────────────────────────

export type ClassificationSource = 'declared' | 'metadata' | 'signals' | 'none';

export interface ClassificationResult {
  classification: DataClassification;
  confidence: number;
  /** Quelle, die den ausschlaggebenden (strengsten) Wert geliefert hat. */
  source: ClassificationSource;
  /** Unter der Schwelle: Policies duerfen darauf nicht blockieren. */
  uncertain: boolean;
  signals: ClassificationSignal[];
}

/**
 * Schwelle, ab der eine Klassifikation als belastbar gilt. Darunter wird
 * ein Block zur Warnung abgeschwaecht (siehe core.ts). Der Wert ist
 * absichtlich hier und nur hier definiert.
 */
export const CLASSIFICATION_CONFIDENCE_THRESHOLD = 0.6;

export interface ClassificationInput {
  /** Vom Aufrufer deklariert (data.classification). */
  declared?: string;
  /** Aus Asset-/System-Stammdaten (governance_assets.data_types o. ae.). */
  dataTypes?: string[];
  /** Vom PEP lokal erkannte Signale — nie Inhalte. */
  signals?: SignalHit[];
}

/**
 * Loest die Klassifikation aus allen verfuegbaren Quellen auf.
 *
 * Abweichung vom Planwortlaut, bewusst und begruendet: Der Plan nennt die
 * Quellen „in dieser Reihenfolge" (deklariert → Metadaten → erkannt). Eine
 * Deklaration ALS ERSTE UND LETZTE Instanz waere aber ein Loch — wer
 * `public` deklariert, haette jede data_transfer-Regel ausgehebelt.
 * Deshalb gilt: Die Reihenfolge bestimmt die Guete-Zuschreibung, den WERT
 * bestimmt die STRENGSTE Quelle. Eine Deklaration kann verschaerfen,
 * niemals abschwaechen.
 */
export function resolveClassification(input: ClassificationInput): ClassificationResult {
  const declared = normalizeDeclared(input.declared);
  const fromMeta = classifyFromDataTypes(input.dataTypes);
  const hits = input.signals ?? [];
  const fromSignals = classifyFromSignals(hits);

  type Candidate = {
    source: ClassificationSource;
    classification: DataClassification;
    confidence: number;
  };
  const candidates: Candidate[] = ([
    // Deklaration gilt als verlaesslich — sie ist eine Zusage des Aufrufers.
    { source: 'declared', classification: declared, confidence: declared === 'unknown' ? 0 : 0.9 },
    { source: 'metadata', classification: fromMeta.classification, confidence: fromMeta.confidence },
    { source: 'signals',  classification: fromSignals.classification, confidence: fromSignals.confidence },
  ] as Candidate[]).filter((c) => c.classification !== 'unknown');

  if (candidates.length === 0) {
    return {
      classification: 'unknown',
      confidence: 0,
      source: 'none',
      uncertain: true,
      signals: hits.map((h) => h.signal),
    };
  }

  // Strengster Wert gewinnt; bei Gleichstand die hoehere Guete.
  const winner = candidates.reduce((best, c) => {
    if (SENSITIVITY[c.classification] > SENSITIVITY[best.classification]) return c;
    if (SENSITIVITY[c.classification] === SENSITIVITY[best.classification]
        && c.confidence > best.confidence) return c;
    return best;
  });

  return {
    classification: winner.classification,
    confidence: winner.confidence,
    source: winner.source,
    uncertain: winner.confidence < CLASSIFICATION_CONFIDENCE_THRESHOLD,
    signals: hits.map((h) => h.signal),
  };
}

function normalizeDeclared(raw: string | undefined): DataClassification {
  if (!raw) return 'unknown';
  return (raw in SENSITIVITY ? raw : 'unknown') as DataClassification;
}
