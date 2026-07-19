/**
 * SMB Experience Layer — zentrale Konfiguration (Single Source of Truth).
 *
 * Grundsatz: Diese Schicht ERSETZT nichts. Sie übersetzt bestehende
 * Enterprise-Module (Audit, Governance Runtime, Evidence Vault, Policy
 * Packs, Monitoring) in geschäftlichen Mehrwert für Einzelunternehmer und
 * kleine Unternehmen (1–10 Mitarbeiter). Es entstehen keine doppelten
 * Funktionen: Die SMB-Ansicht konsumiert ausschließlich vorhandene
 * Tabellen und Edge Functions der Plattform.
 *
 * Sprachregel: Auf der SMB-Oberfläche erscheinen KEINE technischen
 * Begriffe (DSGVO, AI Act, Evidence Vault, Runtime, Policy Engine,
 * Prüfpfad). Das Feld `sourceModule` dokumentiert nur intern, welches
 * Enterprise-Modul die Daten liefert — es wird niemals gerendert.
 */

export type SmbTileId =
  | 'website-health'
  | 'monitoring'
  | 'security'
  | 'privacy-autopilot'
  | 'visibility'
  | 'trust';

export interface SmbTileDefinition {
  id: SmbTileId;
  /** Business-Titel der Kachel — bewusst ohne Fachbegriffe. */
  title: string;
  /** Ein Satz, der die Kachel für Laien erklärt ("Was heißt das?"). */
  explanation: string;
  /** Internes Mapping auf das Enterprise-Modul, das die Daten liefert. Wird nie gerendert. */
  sourceModule: string;
}

/**
 * Die Hauptkacheln des SMB-Dashboards. Maximal 8, aktuell 6 —
 * das Dashboard muss in unter 60 Sekunden verständlich sein.
 */
export const SMB_TILES: SmbTileDefinition[] = [
  {
    id: 'website-health',
    title: 'Website-Gesundheit',
    explanation:
      'Eine Gesamtnote für Ihre Website: Technik, Sicherheit und rechtliche Pflichten — zusammengefasst in einer Zahl.',
    sourceModule: 'Audit Module (audit_jobs.result_summary)',
  },
  {
    id: 'monitoring',
    title: 'Website-Überwachung',
    explanation:
      'Wir schauen rund um die Uhr auf Ihre Website. Wenn etwas nicht stimmt, erfahren Sie es — bevor Ihre Kunden es merken.',
    sourceModule: 'Governance Runtime (runtime_events, Sentinel-Loop)',
  },
  {
    id: 'security',
    title: 'Sicherheitsstatus',
    explanation:
      'Zeigt, ob es aktuell Warnungen zu Ihrer Website gibt und wie ernst sie sind — in Ampelfarben statt Fachsprache.',
    sourceModule: 'Governance Runtime (runtime_events.severity) + Incident-Dispatch',
  },
  {
    id: 'privacy-autopilot',
    title: 'Datenschutz im Hintergrund',
    explanation:
      'Rechtliche Pflichten rund um Kundendaten erledigt die Plattform automatisch. Hier sehen Sie, was zuletzt für Sie erledigt wurde.',
    sourceModule: 'Policy Packs + Governance Auto-Mapping (ai_evidence_events)',
  },
  {
    id: 'visibility',
    title: 'Google-Sichtbarkeit',
    explanation:
      'Wie gut Neukunden Ihre Website über Google finden können — und was die Sichtbarkeit gerade bremst.',
    sourceModule: 'Audit Module (SEO-/Erreichbarkeits-Signale aus result_summary)',
  },
  {
    id: 'trust',
    title: 'Vertrauen & Nachweise',
    explanation:
      'Für alles, was die Plattform prüft und erledigt, wird ein fälschungssicherer Nachweis abgelegt. Das schafft Vertrauen bei Kunden und Behörden.',
    sourceModule: 'Evidence Vault (ai_evidence_events, Hash-Chain)',
  },
];

/**
 * Übersetzungstabelle: technische Befund-Kategorien → konkrete
 * Handlungsempfehlungen in Alltagssprache. Schlüssel werden per
 * Teilstring-Match (lowercase) auf rohe Befunde angewendet.
 *
 * Bewusst breite Schlüssel (z.B. "cookie" fängt "cookie-banner",
 * "cookie_consent", "Cookies ohne Einwilligung" gleichermaßen).
 */
export const SMB_TERM_TRANSLATIONS: ReadonlyArray<{ match: string; recommendation: string }> = [
  { match: 'cookie', recommendation: 'Ihr Cookie-Hinweis sollte angepasst werden, damit Besucher der Website vertrauen können.' },
  { match: 'consent', recommendation: 'Holen Sie die Zustimmung Ihrer Besucher ein, bevor Daten erfasst werden — das erledigt unser Assistent für Sie.' },
  { match: 'ssl', recommendation: 'Die sichere Verbindung (Schloss-Symbol im Browser) Ihrer Website sollte geprüft werden.' },
  { match: 'tls', recommendation: 'Die sichere Verbindung (Schloss-Symbol im Browser) Ihrer Website sollte geprüft werden.' },
  { match: 'impressum', recommendation: 'Ihr Impressum ist unvollständig — das lässt sich in wenigen Minuten beheben.' },
  { match: 'datenschutz', recommendation: 'Ihre Datenschutzerklärung sollte aktualisiert werden — wir bereiten den Text für Sie vor.' },
  { match: 'privacy', recommendation: 'Ihre Datenschutzerklärung sollte aktualisiert werden — wir bereiten den Text für Sie vor.' },
  { match: 'tracking', recommendation: 'Auf Ihrer Website laufen Statistik-Dienste, die angepasst werden sollten, damit Besucher geschützt sind.' },
  { match: 'analytics', recommendation: 'Auf Ihrer Website laufen Statistik-Dienste, die angepasst werden sollten, damit Besucher geschützt sind.' },
  { match: 'performance', recommendation: 'Ihre Website lädt langsamer als nötig — schnellere Seiten bringen mehr Kunden und ein besseres Google-Ranking.' },
  { match: 'seo', recommendation: 'Mit kleinen Anpassungen wird Ihre Website bei Google besser gefunden.' },
  { match: 'meta', recommendation: 'Mit kleinen Anpassungen wird Ihre Website bei Google besser gefunden.' },
  { match: 'security', recommendation: 'Es gibt einen Sicherheitshinweis zu Ihrer Website — wir zeigen Ihnen Schritt für Schritt, was zu tun ist.' },
  { match: 'header', recommendation: 'Es gibt einen Sicherheitshinweis zu Ihrer Website — wir zeigen Ihnen Schritt für Schritt, was zu tun ist.' },
  { match: 'font', recommendation: 'Ihre Website lädt Schriftarten von fremden Servern — das lässt sich kundenfreundlicher lösen.' },
];

/** Generische Empfehlung, wenn ein Befund keiner Kategorie zugeordnet werden kann. */
export const SMB_GENERIC_RECOMMENDATION =
  'Wir haben eine Kleinigkeit auf Ihrer Website gefunden. Öffnen Sie die Detailansicht, um sie mit einem Klick zu beheben.';

/** Empfehlungen, wenn aktuell nichts zu tun ist — positiv formuliert. */
export const SMB_ALL_CLEAR_RECOMMENDATIONS: readonly string[] = [
  'Alles erledigt — Ihre Website ist auf dem aktuellen Stand.',
  'Tipp: Bitten Sie zufriedene Kunden um eine Google-Bewertung. Das verbessert Ihre Sichtbarkeit spürbar.',
];

export interface SmbIndustryPack {
  id: string;
  label: string;
  /** Branchenspezifische Zusatz-Empfehlungen (Erweiterungspunkt für spätere Branchen-Pakete). */
  extraRecommendations: string[];
}

/**
 * Erweiterungspunkt: Branchen-Pakete. Neue Branchen werden ausschließlich
 * hier ergänzt — UI und Logik lesen nur aus dieser Liste (kein Duplizieren).
 */
export const SMB_INDUSTRY_PACKS: SmbIndustryPack[] = [
  {
    id: 'tattoo',
    label: 'Tattoo-Studio',
    extraRecommendations: [
      'Zeigen Sie Ihre Arbeiten in einer Galerie — Kunden entscheiden bei Tattoos nach Bildern.',
    ],
  },
  {
    id: 'friseur',
    label: 'Friseur-Salon',
    extraRecommendations: [
      'Eine Online-Terminbuchung spart Telefonzeit und bringt nachweislich mehr Buchungen.',
    ],
  },
  {
    id: 'handwerk',
    label: 'Handwerksbetrieb',
    extraRecommendations: [
      'Ein einfaches Anfrageformular mit Foto-Upload macht es Kunden leicht, Aufträge anzufragen.',
    ],
  },
  {
    id: 'gastronomie',
    label: 'Gastronomie',
    extraRecommendations: [
      'Halten Sie Öffnungszeiten und Speisekarte aktuell — das ist der häufigste Grund für Google-Suchen.',
    ],
  },
];

/** Maximale Anzahl gleichzeitig angezeigter Handlungsempfehlungen. */
export const SMB_MAX_RECOMMENDATIONS = 3;
