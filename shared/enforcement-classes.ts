/**
 * Durchsetzbarkeits-Klassen (P2-1) — die kanonische Quelle.
 *
 * WOZU: Der Auftrag verbietet ausdrücklich, eine Kontrolle so aussehen zu
 * lassen, als würde sie funktionieren, wenn sie es technisch nicht kann.
 * Diese Datei ist der Ort, an dem für jedes angebundene System steht, was die
 * Plattform dort **wirklich** vermag — und was nicht.
 *
 * SICHERHEITSRELEVANZ: Die Klasse ist **keine Kundeneinstellung**. Könnte ein
 * Mandant seinen Microsoft-365-Connector auf „A" setzen, behauptete die
 * Oberfläche eine Blockierfähigkeit, die es nicht gibt — genau die
 * Scheinimplementierung, die der Auftrag untersagt. Die Klasse wird deshalb
 * **abgeleitet**, nie eingegeben: hier im Frontend, und in der Datenbank durch
 * `public.connector_enforcement_class()`. Ein Trigger überschreibt jeden
 * mitgeschickten Wert.
 *
 * EU AI Act Art. 14 (menschliche Aufsicht setzt voraus, dass der Mensch weiß,
 * worauf er sich verlassen kann) · Art. 13 (Transparenz über die Fähigkeiten
 * des Systems). DSGVO Art. 5 Abs. 2 (Rechenschaftspflicht — eine zugesagte
 * technische Maßnahme muss belegbar sein).
 *
 * ⚠️ REGEL: Diese Tabelle steht doppelt — hier und in der Migrations-SQL
 * (`20260904100000_connector_registry.sql`). Nie einseitig ändern;
 * `test/governance/enforcement-class-parity.test.ts` bricht sonst. Dasselbe
 * Verfahren wie bei RFC-003 (`CLAUDE.md` §5).
 */

/** A = inline anhaltbar · B = Schranke · C = nur nachgelagert · D = kein Zugriff. */
export type EnforcementClass = 'A' | 'B' | 'C' | 'D';

/** Verdikte, die eine Klasse technisch hergibt. */
export type Verdict = 'allow' | 'log_only' | 'warn' | 'block' | 'require_approval' | 'react';

export interface EnforcementClassDefinition {
  readonly klasse: EnforcementClass;
  readonly titel: string;
  /** Was die Plattform an dieser Stelle tatsächlich tut. */
  readonly bedeutung: string;
  /** Woran es hängt — die Bedingung, unter der die Klasse gilt. */
  readonly voraussetzung: string;
  /** Nur diese Verdikte sind hier ehrlich. */
  readonly verdikte: readonly Verdict[];
  /** Kann die Plattform eine Aktion in dieser Klasse verhindern? */
  readonly kannBlockieren: boolean;
}

export const ENFORCEMENT_CLASSES: Readonly<Record<EnforcementClass, EnforcementClassDefinition>> = {
  A: {
    klasse: 'A',
    titel: 'Inline — anhaltbar',
    bedeutung: 'Die Aktion läuft durch uns. Wir können sie vor der Ausführung anhalten.',
    voraussetzung: 'Wir liegen im Datenpfad (Gateway, SDK-Preflight, eigene Agenten-Schleife).',
    verdikte: ['allow', 'log_only', 'warn', 'block', 'require_approval'],
    kannBlockieren: true,
  },
  B: {
    klasse: 'B',
    titel: 'Schranke — anhaltbar am Übergang',
    bedeutung: 'Die Aktion passiert eine Schranke, die uns gehört. Wir öffnen sie oder nicht.',
    voraussetzung: 'Wir kontrollieren den Übergang (Veröffentlichung, Auslieferung, Versand).',
    verdikte: ['allow', 'log_only', 'warn', 'block', 'require_approval'],
    kannBlockieren: true,
  },
  C: {
    klasse: 'C',
    titel: 'Nachgelagert — feststellen und reagieren',
    bedeutung:
      'Wir erfahren die Aktion, nachdem sie geschehen ist. Wir können sie belegen, melden, '
      + 'eskalieren und Folgen auslösen — verhindern können wir sie nicht.',
    voraussetzung: 'Zugriff nur über API, Webhook oder Prüfprotokoll des Fremdsystems.',
    verdikte: ['log_only', 'warn', 'react'],
    kannBlockieren: false,
  },
  D: {
    klasse: 'D',
    titel: 'Nicht erreichbar',
    bedeutung:
      'Es gibt keinen technischen Zugriff. Die Regel steht auf dem Papier und gilt '
      + 'organisatorisch, nicht technisch.',
    voraussetzung: 'Ein Endpunkt-Agent oder Unternehmensproxy wäre nötig — beides gibt es nicht.',
    verdikte: ['log_only'],
    kannBlockieren: false,
  },
} as const;

/**
 * Systemtyp → Klasse, mit Begründung.
 *
 * Die Begründung ist Teil der Zusage: Wer die Klasse anzweifelt, soll den Grund
 * lesen können, statt ihn erfragen zu müssen. Die Einordnung stammt aus §2.3 des
 * Enforcement-Plans und ist dort gegen Repo und Plattform-Mechanik geprüft.
 */
export interface SystemClassification {
  readonly systemType: string;
  readonly label: string;
  readonly klasse: EnforcementClass;
  readonly begruendung: string;
}

export const SYSTEM_CLASSIFICATIONS: readonly SystemClassification[] = [
  // ── Klasse A: eigene Pfade ────────────────────────────────────────────────
  {
    systemType: 'ai_gateway',
    label: 'AI-Gateway',
    klasse: 'A',
    begruendung: 'Wir sind der Endpunkt — der Aufruf erreicht den Anbieter nur durch uns.',
  },
  {
    systemType: 'agent_runtime',
    label: 'Agenten-Laufzeit',
    klasse: 'A',
    begruendung: 'Wir betreiben die Werkzeug-Schleife und entscheiden vor jedem Tool-Aufruf.',
  },
  {
    systemType: 'sdk_preflight',
    label: 'SDK mit Vorabprüfung',
    klasse: 'A',
    begruendung:
      'Der Vorabruf liegt im Datenpfad — aber nur, solange der Kunde den Wrapper '
      + 'tatsächlich einsetzt. Freiwillige Anbindung, kein erzwungener Pfad.',
  },
  {
    systemType: 'chatbot',
    label: 'Chatbot',
    klasse: 'A',
    begruendung: 'Läuft über unsere Edge Functions.',
  },
  {
    systemType: 'whatsapp',
    label: 'WhatsApp-Kanal',
    klasse: 'A',
    begruendung: 'Läuft über unsere Edge Functions.',
  },
  {
    systemType: 'voice',
    label: 'Sprachkanal',
    klasse: 'A',
    begruendung: 'Läuft über unsere Edge Functions.',
  },

  // ── Klasse B: Schranken, die uns gehören ──────────────────────────────────
  {
    systemType: 'siteos_publish',
    label: 'SiteOS-Veröffentlichung',
    klasse: 'B',
    begruendung: 'Die Veröffentlichung geht durch unser Publish Gate.',
  },
  {
    systemType: 'cicd_gate',
    label: 'CI/CD-Schranke',
    klasse: 'B',
    begruendung: 'Der Deploy passiert die Gate-Engine, die wir betreiben.',
  },

  // ── Klasse C: nur nachgelagert ────────────────────────────────────────────
  {
    systemType: 'microsoft365',
    label: 'Microsoft 365',
    klasse: 'C',
    begruendung:
      'Microsoft Graph liefert Prüfereignisse erst nach der Aktion. Ein echter Block '
      + 'bräuchte Microsoft Purview DLP oder eine Netzwerk-/Geräteebene — beides ist '
      + 'nicht Teil dieses Produkts.',
  },
  {
    systemType: 'crm',
    label: 'CRM',
    klasse: 'C',
    begruendung: 'Zugriff über API und Webhook, kein Punkt zum Abfangen.',
  },
  {
    systemType: 'erp',
    label: 'ERP',
    klasse: 'C',
    begruendung: 'Zugriff über API und Webhook, kein Punkt zum Abfangen.',
  },
  {
    systemType: 'warenwirtschaft',
    label: 'Warenwirtschaft',
    klasse: 'C',
    begruendung: 'Zugriff über API und Webhook, kein Punkt zum Abfangen.',
  },
  {
    systemType: 'logistik',
    label: 'Logistik',
    klasse: 'C',
    begruendung: 'Zugriff über API und Webhook, kein Punkt zum Abfangen.',
  },
  {
    systemType: 'ticketing',
    label: 'Ticketsystem',
    klasse: 'C',
    begruendung:
      'Wir schreiben hinein und lesen heraus. Was im Fremdsystem geschieht, '
      + 'erfahren wir nachgelagert.',
  },
  {
    systemType: 'messaging',
    label: 'Nachrichtendienst',
    klasse: 'C',
    begruendung:
      'Ausgehende Benachrichtigung und nachgelagerte Auswertung — kein Abfangpunkt '
      + 'für das, was Menschen dort tun.',
  },
  {
    systemType: 'custom_api',
    label: 'Eigene API',
    klasse: 'C',
    begruendung:
      'Vorsichtig eingestuft: Ohne Kenntnis des Integrationspunkts ist nur die '
      + 'nachgelagerte Feststellung belegbar. Wer nachweist, dass der Aufruf durch '
      + 'uns läuft, kann höher eingestuft werden — aber erst dann.',
  },

  // ── Klasse D: kein Zugriff ────────────────────────────────────────────────
  {
    systemType: 'browser_direct',
    label: 'Direkter Browser-Zugriff der Mitarbeitenden',
    klasse: 'D',
    begruendung:
      'Öffnet jemand einen KI-Dienst direkt im Browser, führt kein Weg durch uns. '
      + 'Ohne Endpunkt-Agent oder Unternehmensproxy ist das technisch nicht abfangbar.',
  },
] as const;

const BY_TYPE: ReadonlyMap<string, SystemClassification> = new Map(
  SYSTEM_CLASSIFICATIONS.map((s) => [s.systemType, s]),
);

/**
 * Klasse eines Systemtyps.
 *
 * Unbekannte Typen ergeben **'C'**, nicht 'A'. Ein unbekanntes System ist im
 * Zweifel eines, das wir nur beobachten können — die vorsichtige Annahme ist
 * hier die einzige ehrliche.
 */
export function enforcementClassOf(systemType: string): EnforcementClass {
  return BY_TYPE.get(systemType)?.klasse ?? 'C';
}

/** Begründung zur Klasse, für die Anzeige am Connector. */
export function enforcementReasonOf(systemType: string): string {
  return (
    BY_TYPE.get(systemType)?.begruendung
    ?? 'Unbekannter Systemtyp — vorsichtshalber als nachgelagert eingestuft, '
      + 'bis der Integrationspunkt belegt ist.'
  );
}

/** Anzeigename, fällt auf den Rohtyp zurück. */
export function systemLabelOf(systemType: string): string {
  return BY_TYPE.get(systemType)?.label ?? systemType;
}

/** Kann in dieser Klasse überhaupt blockiert werden? */
export function canBlock(klasse: EnforcementClass): boolean {
  return ENFORCEMENT_CLASSES[klasse].kannBlockieren;
}

/**
 * Ist dieses Verdikt für die Klasse überhaupt einlösbar?
 *
 * Der PDP darf für einen Klasse-C-Connector kein `block` versprechen. Wer das
 * prüft, verhindert die Zusage, die niemand halten kann.
 */
export function verdictIsHonest(klasse: EnforcementClass, verdict: Verdict): boolean {
  return ENFORCEMENT_CLASSES[klasse].verdikte.includes(verdict);
}
