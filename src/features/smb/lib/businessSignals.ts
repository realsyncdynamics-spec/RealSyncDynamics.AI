/**
 * SMB Experience Layer — pure Übersetzungslogik.
 *
 * Übersetzt technische Signale der bestehenden Enterprise-Module
 * (Audit-Scores, Runtime-Severities, Evidence-Zähler) in
 * Business-Sprache für Einzelunternehmer. Keine Fetches, keine
 * Seiteneffekte — vollständig unit-testbar.
 */

import {
  SMB_ALL_CLEAR_RECOMMENDATIONS,
  SMB_GENERIC_RECOMMENDATION,
  SMB_INDUSTRY_PACKS,
  SMB_MAX_RECOMMENDATIONS,
  SMB_TERM_TRANSLATIONS,
} from '../../../config/smb-experience';

/** Ampel-Bewertung in Alltagssprache statt Severity-Levels. */
export type BusinessGrade = 'gut' | 'okay' | 'handeln';

export interface BusinessSignal {
  grade: BusinessGrade;
  /** Kurze Statuszeile für die Kachel, z.B. "Alles in Ordnung". */
  headline: string;
  /** Ein erklärender Satz darunter. */
  detail: string;
  /** Optionale Kennzahl (0–100 bzw. Zähler) für die große Anzeige. */
  value?: number;
}

/** Score-Schwellen: >= 80 gut, >= 55 okay, darunter handeln. */
export function gradeFromScore(score: number): BusinessGrade {
  if (score >= 80) return 'gut';
  if (score >= 55) return 'okay';
  return 'handeln';
}

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export const EMPTY_SEVERITIES: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };

/**
 * Gesamtnote "Website-Gesundheit": Audit-Score als Basis, abzüglich
 * Malus für offene ernste Warnungen. Ohne Audit-Score (noch kein Scan)
 * wird kein Wert vorgetäuscht.
 */
export function websiteHealth(input: {
  auditScore: number | null;
  severities: SeverityCounts;
}): BusinessSignal {
  const { auditScore, severities } = input;
  if (auditScore === null) {
    return {
      grade: 'okay',
      headline: 'Erster Check steht noch aus',
      detail: 'Starten Sie den kostenlosen Website-Check — danach sehen Sie hier Ihre Gesamtnote.',
    };
  }
  // Malus: kritische Warnungen wiegen schwer, hohe moderat. Score bleibt in [0, 100].
  const malus = severities.critical * 15 + severities.high * 5;
  const value = Math.max(0, Math.min(100, Math.round(auditScore - malus)));
  const grade = gradeFromScore(value);
  const headline =
    grade === 'gut' ? 'Alles in Ordnung' : grade === 'okay' ? 'Ein paar Kleinigkeiten' : 'Bitte kümmern';
  const detail =
    grade === 'gut'
      ? 'Ihre Website ist technisch und rechtlich in gutem Zustand.'
      : grade === 'okay'
        ? 'Ihre Website ist solide — mit den Empfehlungen unten holen Sie noch mehr heraus.'
        : 'Einige Punkte sollten zeitnah behoben werden. Die Empfehlungen unten zeigen, wie.';
  return { grade, headline, detail, value };
}

/** Sicherheitsstatus aus Runtime-Severity-Zählern der letzten 30 Tage. */
export function securityStatus(severities: SeverityCounts): BusinessSignal {
  if (severities.critical > 0) {
    return {
      grade: 'handeln',
      headline: 'Wichtige Warnung',
      detail: 'Es gibt eine dringende Sicherheitswarnung. Wir zeigen Ihnen Schritt für Schritt, was zu tun ist.',
      value: severities.critical + severities.high,
    };
  }
  if (severities.high > 0 || severities.medium > 2) {
    return {
      grade: 'okay',
      headline: 'Hinweise vorhanden',
      detail: 'Es gibt Hinweise, die Sie bei Gelegenheit ansehen sollten. Nichts davon ist akut.',
      value: severities.high + severities.medium,
    };
  }
  return {
    grade: 'gut',
    headline: 'Keine Auffälligkeiten',
    detail: 'In den letzten 30 Tagen gab es keine ernsten Sicherheitswarnungen zu Ihrer Website.',
    value: 0,
  };
}

/** "Datenschutz im Hintergrund": Anzahl automatisch erledigter Aufgaben (Evidence-Events, 30 Tage). */
export function privacyAutopilot(handledCount: number): BusinessSignal {
  if (handledCount <= 0) {
    return {
      grade: 'okay',
      headline: 'Startet nach dem ersten Check',
      detail: 'Sobald Ihre Website verbunden ist, erledigt die Plattform Pflichtaufgaben automatisch im Hintergrund.',
      value: 0,
    };
  }
  return {
    grade: 'gut',
    headline: `${handledCount} Aufgaben automatisch erledigt`,
    detail: 'Diese Pflichtaufgaben rund um Kundendaten hat die Plattform in den letzten 30 Tagen für Sie übernommen.',
    value: handledCount,
  };
}

/** Google-Sichtbarkeit aus den SEO-/Erreichbarkeits-Signalen des letzten Audits. */
export function visibilitySignal(seoScore: number | null): BusinessSignal {
  if (seoScore === null) {
    return {
      grade: 'okay',
      headline: 'Noch keine Messung',
      detail: 'Nach dem ersten Website-Check sehen Sie hier, wie gut Neukunden Sie über Google finden.',
    };
  }
  const grade = gradeFromScore(seoScore);
  return {
    grade,
    headline:
      grade === 'gut' ? 'Gut auffindbar' : grade === 'okay' ? 'Luft nach oben' : 'Kaum auffindbar',
    detail:
      grade === 'gut'
        ? 'Ihre Website ist für Google gut aufbereitet — Neukunden können Sie finden.'
        : 'Mit wenigen Anpassungen wird Ihre Website bei Google deutlich besser gefunden.',
    value: Math.round(seoScore),
  };
}

/** "Vertrauen & Nachweise": Anzahl abgelegter, fälschungssicherer Nachweise. */
export function trustSignal(evidenceCount: number): BusinessSignal {
  if (evidenceCount <= 0) {
    return {
      grade: 'okay',
      headline: 'Noch keine Nachweise',
      detail: 'Mit jedem Check und jeder erledigten Aufgabe sammelt die Plattform Nachweise für Sie.',
      value: 0,
    };
  }
  return {
    grade: 'gut',
    headline: `${evidenceCount} Nachweise gesammelt`,
    detail: 'Falls Kunden oder Behörden nachfragen: Alles ist dokumentiert und mit einem Klick abrufbar.',
    value: evidenceCount,
  };
}

/** Website-Überwachung: läuft die Beobachtung, und wie viele Prüfungen liefen zuletzt? */
export function monitoringSignal(eventsLast30d: number): BusinessSignal {
  if (eventsLast30d <= 0) {
    return {
      grade: 'okay',
      headline: 'Überwachung startet bald',
      detail: 'Nach dem ersten Check beobachten wir Ihre Website rund um die Uhr.',
      value: 0,
    };
  }
  return {
    grade: 'gut',
    headline: 'Überwachung aktiv',
    detail: `${eventsLast30d} automatische Prüfungen in den letzten 30 Tagen — Sie müssen nichts tun.`,
    value: eventsLast30d,
  };
}

/**
 * Übersetzt einen rohen technischen Befund (Issue-Kategorie, Event-Typ,
 * Freitext) in eine Handlungsempfehlung in Alltagssprache.
 */
export function translateFindingToRecommendation(rawFinding: string): string {
  const normalized = rawFinding.toLowerCase();
  const hit = SMB_TERM_TRANSLATIONS.find((t) => normalized.includes(t.match));
  return hit ? hit.recommendation : SMB_GENERIC_RECOMMENDATION;
}

/**
 * Baut die Empfehlungsliste des Dashboards: übersetzte Befunde,
 * dedupliziert, maximal SMB_MAX_RECOMMENDATIONS. Bleibt Platz, wird mit
 * Branchen-Tipps (falls Branche bekannt) bzw. positiven Hinweisen aufgefüllt.
 */
export function buildRecommendations(rawFindings: string[], industryId?: string): string[] {
  const translated = rawFindings.map(translateFindingToRecommendation);
  const unique = [...new Set(translated)].slice(0, SMB_MAX_RECOMMENDATIONS);

  if (unique.length < SMB_MAX_RECOMMENDATIONS) {
    const industry = SMB_INDUSTRY_PACKS.find((p) => p.id === industryId);
    const fillers = [...(industry?.extraRecommendations ?? []), ...SMB_ALL_CLEAR_RECOMMENDATIONS];
    for (const filler of fillers) {
      if (unique.length >= SMB_MAX_RECOMMENDATIONS) break;
      if (!unique.includes(filler)) unique.push(filler);
    }
  }
  return unique;
}
