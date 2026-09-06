/**
 * Reality → Action: von Befunden zu belegbaren Handlungsempfehlungen.
 *
 * ## Der Produktgrundsatz
 *
 * > Ein Finding ohne Handlung ist unvollständig.
 *
 * Ein Bericht, der mit einer Mängelliste endet, überlässt dem Kunden die
 * Übersetzung in Wirkung, Priorität und nächsten Schritt. Diese Datei nimmt
 * ihm das ab: Jeder Befund bekommt eine geschäftliche Auswirkung, eine
 * konkrete Massnahme und — wo es eines gibt — das Produkt, das sie umsetzt.
 *
 * ## Der Gegengrundsatz, der genauso wichtig ist
 *
 * > Keine generischen Upsells.
 *
 * Eine Empfehlung darf nur aus dem folgen, was der Scan **beobachtet** hat.
 * Deshalb steht hier eine Abbildung je **Befund-Code**, nicht je Severity
 * und nicht je Branche. Ein Code, den der Scanner nie liefert, hat hier
 * nichts zu suchen; `test/product/reality-decision.test.ts` prüft die
 * Abbildung gegen `test/fixtures/gdpr-audit-production-contract.json` in
 * beide Richtungen.
 *
 * ## Warum die AUTOMATE-Spur leer ist
 *
 * Das Produktbild kennt drei Spuren: BUILD, AUTOMATE, GOVERN. Zwei davon
 * lassen sich aus diesem Scan belegen, eine nicht.
 *
 * Der Scan liest das ausgelieferte HTML **einer** Seite. Daraus ist
 * ablesbar, wie die Website gebaut ist (BUILD) und welche Rechts- und
 * Vertrauensrisiken sichtbar sind (GOVERN). Nicht ablesbar ist, wie das
 * Unternehmen **arbeitet**: Antwortzeiten, Anfragevolumen, verlorene Leads,
 * Anteil wiederkehrender Fragen, CRM-Anbindung, Terminaufkommen.
 *
 * „Sie haben ein Kontaktformular, also brauchen Sie einen Chatbot" ist
 * genau der generische Upsell, den der Grundsatz oben verbietet — die
 * Prämisse trägt die Empfehlung nicht.
 *
 * {@link AUTOMATE_EVIDENCE_GAP} benennt, welche Signale fehlen. Die Spur
 * bleibt bis dahin leer. Das ist ein **Messergebnis über den Scan**, kein
 * Versäumnis dieser Datei — und die ehrlichere Auskunft als eine Empfehlung,
 * die auf nichts beruht.
 */
import type { BookableModuleId } from './pricing';

/** Die drei Spuren des Produktbilds: Scan → BUILD · AUTOMATE · GOVERN. */
export type ActionTrack = 'build' | 'automate' | 'govern';

/** Wann die Massnahme ansteht. Ergibt sich aus der Severity des Befunds. */
export type ActionHorizon = 'now' | 'soon' | 'ongoing';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Ein Befund, wie ihn `gdpr_audits.issues` liefert. */
export interface DecisionInput {
  id: string;
  severity: FindingSeverity;
}

/**
 * Die Abbildung eines Befunds auf eine Handlung.
 *
 * `module: null` heisst **nicht** „kein Produkt gefunden", sondern: Dafür
 * gibt es nichts zu verkaufen. Ein TLS-Zertifikat oder ein
 * Security-Header ist Sache des Hosters; ein Produkt daranzuhängen wäre
 * ein erfundener Bedarf.
 */
export interface ActionMapping {
  track: ActionTrack;
  /** Was der Befund geschäftlich bedeutet — nicht was er technisch ist. */
  impact: string;
  /** Die konkrete Massnahme, in der Sprache des Auftraggebers. */
  action: string;
  module: BookableModuleId | null;
}

export interface ActionItem extends ActionMapping {
  findingCode: string;
  severity: FindingSeverity;
  horizon: ActionHorizon;
}

export interface ActionPlan {
  /** Kritisch und hoch — was zuerst angefasst gehört. */
  now: ActionItem[];
  /** Mittel — die Woche danach. */
  soon: ActionItem[];
  /** Niedrig und Hinweise — laufend, nicht dringend. */
  ongoing: ActionItem[];
  /** Module, die aus dem Befundbild folgen, nach Häufigkeit gewichtet. */
  recommendedModules: BookableModuleId[];
  /** Befunde ohne Abbildung. Leer, solange der Vertrag geschlossen ist. */
  unmapped: string[];
}

/**
 * Signale, die eine AUTOMATE-Empfehlung tragen würden — und die dieser Scan
 * nicht erhebt. Wer die Spur füllen will, erhebt zuerst diese, nicht mehr
 * Befunde über HTML.
 */
export const AUTOMATE_EVIDENCE_GAP: readonly string[] = Object.freeze([
  'Antwortzeit auf Anfragen (E-Mail, Formular, Telefon)',
  'Anfragevolumen und Anteil wiederkehrender Fragen',
  'Ob Anfragen in ein CRM laufen oder in einem Postfach liegen bleiben',
  'Nachfassquote bei nicht beantworteten Anfragen',
  'Terminaufkommen und Anteil telefonischer Terminvereinbarung',
]);

/**
 * Befund-Code → Handlung.
 *
 * Die Codes stammen aus dem gemessenen Produktionsvertrag des Scanners
 * (`docs/product/free-scan-recovery.md` §3). Reihenfolge wie dort.
 */
export const ACTION_MAP: Readonly<Record<string, ActionMapping>> = Object.freeze({
  // ── GOVERN: Pflichtangaben ────────────────────────────────────────────
  no_privacy_link: {
    track: 'govern',
    impact: 'Pflichtangabe nach Art. 13 DSGVO nicht auffindbar — abmahnfähig und für Besucher ein sichtbarer Vertrauensmangel.',
    action: 'Datenschutzerklärung erstellen und aus dem Footer jeder Seite verlinken.',
    module: 'governance_core',
  },
  no_imprint_link: {
    track: 'govern',
    impact: 'Impressumspflicht nach § 5 TMG nicht erfüllt — der häufigste Abmahngrund für gewerbliche Websites.',
    action: 'Impressum mit Anbieter, Vertretung, Kontakt und Registereintrag anlegen und verlinken.',
    module: 'governance_core',
  },
  no_imprint_link_non_de: {
    track: 'govern',
    impact: 'Kein Impressum gefunden; deutsche Anbietersignale fehlen, § 5 TMG greift daher möglicherweise nicht.',
    action: 'Prüfen, ob der Anbieter in Deutschland sitzt. Wenn ja, gilt die Impressumspflicht.',
    module: null,
  },
  sub_imprint_no_legal_form: {
    track: 'govern',
    impact: 'Impressum ohne Rechtsform — die Angabe ist unvollständig und damit angreifbar.',
    action: 'Firma inklusive Rechtsform ergänzen (GmbH, UG, e.K.) bzw. Inhabernamen bei Einzelunternehmen.',
    module: 'governance_core',
  },
  sub_imprint_no_address: {
    track: 'govern',
    impact: 'Keine ladungsfähige Anschrift im Impressum — Zustellungen sind nicht möglich, die Pflicht ist nicht erfüllt.',
    action: 'Vollständige Anschrift ergänzen. Ein Postfach genügt nicht.',
    module: 'governance_core',
  },
  sub_imprint_no_contact: {
    track: 'govern',
    impact: 'Kein unmittelbarer Kontaktweg im Impressum — Pflicht nach § 5 Abs. 1 Nr. 2 TMG, und für Interessenten eine Hürde.',
    action: 'E-Mail-Adresse und Telefonnummer im Impressum nennen.',
    module: 'governance_core',
  },

  // ── GOVERN: Tracking und Einwilligung ─────────────────────────────────
  tracker_no_consent: {
    track: 'govern',
    impact: 'Tracker laden ohne sichtbare Einwilligung — Bussgeld- und Abmahnrisiko, und die erhobenen Daten sind rechtlich nicht verwertbar.',
    action: 'Einwilligungslösung einrichten und alle nicht notwendigen Skripte dahinter legen.',
    module: 'governance_core',
  },
  social_pixel_no_consent: {
    track: 'govern',
    impact: 'Social-Pixel ohne Einwilligung bedeutet Datentransfer in Drittländer ohne beobachtbare Rechtsgrundlage.',
    action: 'Pixel hinter die Einwilligung legen und den Drittlandtransfer dokumentieren.',
    module: 'governance_core',
  },
  cookies_pre_consent: {
    track: 'govern',
    impact: 'Cookies werden vor jeder Einwilligung gesetzt — direkter Verstoss gegen § 25 TTDSG.',
    action: 'Beim ersten Aufruf nur technisch notwendige Cookies setzen.',
    module: 'governance_core',
  },
  ga_no_ip_anon: {
    track: 'govern',
    impact: 'Analytics ohne IP-Anonymisierung — der US-Transfer bleibt auch mit Einwilligung begründungsbedürftig.',
    action: 'IP-Anonymisierung aktivieren und den Transfer in der Datenschutzerklärung benennen.',
    module: 'governance_core',
  },
  'rule:COOKIE_BANNER_DARK_PATTERN': {
    track: 'govern',
    impact: 'Banner ohne gleichrangige Ablehnen-Option — die eingeholte Einwilligung ist angreifbar und damit wertlos.',
    action: 'Banner so umbauen, dass Ablehnen genauso erreichbar ist wie Zustimmen.',
    module: 'governance_core',
  },
  form_no_consent: {
    track: 'govern',
    impact: 'Formular erhebt personenbezogene Daten ohne sichtbaren Hinweis — angreifbar, und es kostet Abschlüsse, weil Vertrauen fehlt.',
    action: 'Datenschutzhinweis samt Verlinkung direkt am Formular ergänzen.',
    module: 'governance_core',
  },

  // ── GOVERN: Inhalt der Datenschutzerklärung ───────────────────────────
  sub_privacy_third_country_no_legal_basis: {
    track: 'govern',
    impact: 'Drittlandtransfer erwähnt, Rechtsgrundlage fehlt — die Erklärung benennt ein Risiko, ohne es zu decken.',
    action: 'Standardvertragsklauseln oder Angemessenheitsbeschluss als Grundlage benennen.',
    module: 'governance_core',
  },
  sub_privacy_no_complaint_right: {
    track: 'govern',
    impact: 'Pflichthinweis auf das Beschwerderecht fehlt — die Erklärung ist unvollständig.',
    action: 'Hinweis auf das Beschwerderecht bei der Aufsichtsbehörde ergänzen.',
    module: 'governance_core',
  },
  sub_privacy_no_avv_list: {
    track: 'govern',
    impact: 'Keine Empfänger benannt — wer Daten verarbeitet, muss namentlich genannt werden.',
    action: 'Auftragsverarbeiter auflisten und den AVV-Status je Anbieter führen.',
    module: 'governance_core',
  },
  'rule:MISSING_AVV_REFERENCE': {
    track: 'govern',
    impact: 'Auftragsverarbeiter sind erkennbar im Einsatz, aber in der Erklärung nicht referenziert.',
    action: 'Unterauftragsverarbeiter-Liste anlegen und aus der Datenschutzerklärung verlinken.',
    module: 'governance_core',
  },
  sub_privacy_no_dpo_contact: {
    track: 'govern',
    impact: 'Kein Datenschutzbeauftragter genannt — sofern die Bestellpflicht greift, fehlt eine Pflichtangabe.',
    action: 'Prüfen, ob die Bestellpflicht besteht; wenn ja, Name und Kontakt aufnehmen.',
    module: 'governance_core',
  },

  // ── GOVERN: KI-Einsatz ────────────────────────────────────────────────
  'rule:AI_ACT_LIMITED_RISK_CHATBOT': {
    track: 'govern',
    impact: 'Ein KI-Dialogsystem ist im Einsatz, ohne dass Nutzer darüber informiert werden — Transparenzpflicht nach Art. 50 EU AI Act.',
    action: 'Hinweis „Sie sprechen mit einer KI" einblenden und das System ins KI-Register aufnehmen.',
    module: 'advanced_ai_governance',
  },

  // ── BUILD: Transport und Auslieferung ─────────────────────────────────
  // Kein Modul: Zertifikate und Header sind Sache des Hostings. Ein Produkt
  // daranzuhängen waere ein erfundener Bedarf.
  no_https: {
    track: 'build',
    impact: 'Unverschlüsselte Übertragung — Browser warnen sichtbar, und Art. 32 DSGVO verlangt Verschlüsselung.',
    action: 'TLS-Zertifikat einrichten und alle Aufrufe dauerhaft auf HTTPS umleiten.',
    module: null,
  },
  no_hsts: {
    track: 'build',
    impact: 'Ohne HSTS bleibt ein Rückfall auf HTTP möglich.',
    action: 'Strict-Transport-Security setzen (max-age=31536000; includeSubDomains).',
    module: null,
  },
  no_csp: {
    track: 'build',
    impact: 'Ohne Content-Security-Policy kann eingeschleuster Code ungehindert laufen.',
    action: 'Content-Security-Policy definieren und schrittweise verschärfen.',
    module: null,
  },
  no_xframe: {
    track: 'build',
    impact: 'Die Seite lässt sich fremd einbetten — Grundlage für Clickjacking gegen die eigenen Nutzer.',
    action: 'X-Frame-Options oder CSP frame-ancestors setzen.',
    module: null,
  },
  mixed_content: {
    track: 'build',
    impact: 'Unverschlüsselte Ressourcen auf verschlüsselter Seite — der Browser warnt, das Schloss verschwindet.',
    action: 'Alle eingebundenen Ressourcen auf HTTPS umstellen.',
    module: null,
  },

  // ── BUILD: Auffindbarkeit und Nutzererlebnis ──────────────────────────
  no_og_tags: {
    track: 'build',
    impact: 'Geteilte Links erscheinen ohne Vorschau — jede Empfehlung in sozialen Netzen verliert Wirkung.',
    action: 'Open-Graph-Titel, -Beschreibung und -Bild ergänzen.',
    module: 'ai_frontend',
  },
  meta_refresh: {
    track: 'build',
    impact: 'Automatische Weiterleitung per Meta-Refresh — problematisch für Screenreader und für die Indexierung.',
    action: 'Auf serverseitige 301-Weiterleitung umstellen.',
    module: 'ai_frontend',
  },

  // ── Kein Befund über die Seite, sondern über den Scan ──────────────────
  scan_coverage_limited: {
    track: 'build',
    impact: 'Die Seite wird erst im Browser aufgebaut — der Scan sieht nur das Grundgerüst, ein gutes Ergebnis ist hier kein gutes Zeichen.',
    action: 'Für ein belastbares Ergebnis einen Render-Scan anfordern.',
    module: null,
  },
  fetch_failed: {
    track: 'build',
    impact: 'Die Seite war nicht erreichbar — für Besucher und Suchmaschinen gilt dasselbe.',
    action: 'DNS, Firewall und WAF prüfen; danach erneut scannen.',
    module: null,
  },
});

/** Severity → Zeithorizont. Risiko bestimmt die Reihenfolge, nicht die Spur. */
export function horizonFor(severity: FindingSeverity): ActionHorizon {
  if (severity === 'critical' || severity === 'high') return 'now';
  if (severity === 'medium') return 'soon';
  return 'ongoing';
}

const SEVERITY_RANK: Readonly<Record<FindingSeverity, number>> = Object.freeze({
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
});

/**
 * Baut den Massnahmenplan aus den Befunden eines Scans.
 *
 * Reihenfolge innerhalb eines Horizonts: nach Severity, bei Gleichstand
 * stabil in Eingangsreihenfolge. Der Kunde soll oben anfangen können.
 */
export function buildActionPlan(findings: readonly DecisionInput[]): ActionPlan {
  const items: ActionItem[] = [];
  const unmapped: string[] = [];

  for (const f of findings) {
    const mapping = ACTION_MAP[f.id];
    if (!mapping) { unmapped.push(f.id); continue; }
    items.push({ ...mapping, findingCode: f.id, severity: f.severity, horizon: horizonFor(f.severity) });
  }

  const byHorizon = (h: ActionHorizon) =>
    items.filter((i) => i.horizon === h)
      .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  // Module nach Anzahl der Befunde, die sie adressieren — was am meisten
  // traegt, steht vorn. Bei Gleichstand entscheidet die hoechste Severity.
  const weight = new Map<BookableModuleId, { count: number; best: number }>();
  for (const i of items) {
    if (!i.module) continue;
    const cur = weight.get(i.module) ?? { count: 0, best: Number.MAX_SAFE_INTEGER };
    weight.set(i.module, { count: cur.count + 1, best: Math.min(cur.best, SEVERITY_RANK[i.severity]) });
  }
  const recommendedModules = [...weight.entries()]
    .sort((a, b) => (b[1].count - a[1].count) || (a[1].best - b[1].best))
    .map(([id]) => id);

  return {
    now: byHorizon('now'),
    soon: byHorizon('soon'),
    ongoing: byHorizon('ongoing'),
    recommendedModules,
    unmapped,
  };
}

/**
 * Wohin ein Modul-CTA führt.
 *
 * Es gibt **keinen** Kaufweg je Modul: `stripe-checkout` nimmt
 * ausschliesslich einen `plan_key` entgegen (siehe
 * `src/features/market/moduleCatalog.ts`). Ein Knopf „Modul kaufen" griffe
 * ins Leere. Angemeldet führt der Weg deshalb in den Marketplace, der das
 * Modul und den Plan zeigt, der es enthält — sonst auf die Preisseite.
 */
export function moduleHref(isAuthenticated: boolean): string {
  return isAuthenticated ? '/app/marketplace' : '/pricing';
}

/**
 * Der eine nächste Schritt nach dem Bericht.
 *
 * Ohne Konto ist der Bericht eine Momentaufnahme: kein Verlauf, keine
 * Wiedervorlage, kein Nachweis. Die Übernahme des Scans ist deshalb der
 * ehrlichste primäre Aufruf — und ein Weg, den es im Repository gibt
 * (`/onboarding/:scanId`).
 */
export function primaryCta(auditId: string): { label: string; href: string } {
  return { label: 'Ergebnis übernehmen und Massnahmen starten', href: `/onboarding/${auditId}` };
}
