/**
 * Bedarfs-Check (/check) — gemeinsames Modell für Client, Tests und Server.
 *
 * Eine Quelle für:
 *   - erlaubte Angaben (Ziel, Bereich, Website ja/nein, optionale Adresse),
 *   - Eingabeprüfung,
 *   - Empfehlungslogik je Modellversion,
 *   - den versionierten Textkatalog, mit dem gespeicherte Ergebnisse später
 *     wieder angezeigt werden.
 *
 * Serverseitig gilt dieselbe Logik als SQL-Funktion
 * `public.needs_check_recommend(model_version, goal, has_website)` in
 * supabase/migrations/20261117190000_needs_check_results_hardening.sql. Der Server
 * berechnet die gespeicherten Empfehlungen selbst; was der Client schickt,
 * zählt dafür nicht. Ein DB-Test vergleicht beide Seiten für jede
 * Kombination (test/runtime/db/needs-check-results.db.test.ts).
 *
 * VERSIONSREGEL: Katalog und Logik einer veröffentlichten Version werden nicht
 * mehr geändert. Neue Texte oder andere Empfehlungen → neue Version anlegen,
 * die alte stehen lassen. Gespeicherte Ergebnisse zeigen immer die Texte der
 * Version, mit der sie gespeichert wurden. test/needs-check/model.test.ts
 * hält Version 1 per Prüfsumme fest.
 *
 * Bewusst NICHT im Katalog: Preise und Verfügbarkeit. Die Oberfläche liest
 * den heutigen Stand aus `src/product/implementation-status.ts` und zeigt ihn
 * als „aktueller Stand“, nicht als historische Zusage.
 *
 * Keine Abhängigkeiten auf Browser- oder Node-APIs außer `URL`.
 */

export const NEEDS_CHECK_MODEL_VERSION = 1 as const;
export const NEEDS_CHECK_MODEL_VERSIONS = [1] as const;
export type NeedsCheckModelVersion = (typeof NEEDS_CHECK_MODEL_VERSIONS)[number];

export const GOALS = ['website', 'inquiries', 'rules', 'unsure'] as const;
export type Goal = (typeof GOALS)[number];

export const AREAS = ['handwerk', 'praxis', 'kanzlei', 'handel', 'dienstleistung', 'agentur', 'sonstiges'] as const;
export type Area = (typeof AREAS)[number];

export const RECOMMENDATION_IDS = [
  'build.new_site',
  'build.modernize',
  'automate.chat',
  'govern.website_scan',
  'govern.runtime',
] as const;
export type RecommendationId = (typeof RECOMMENDATION_IDS)[number];

export type Section = 'build' | 'automate' | 'govern';

/** Höchstlänge der optionalen Adresse — identisch mit dem CHECK in der Migration. */
export const WEBSITE_URL_MAX = 300;

export interface Answers {
  goal: Goal;
  area: Area;
  hasWebsite: boolean;
  /** Nur gesetzt, wenn hasWebsite und der Nutzer eine Adresse angibt. */
  websiteUrl: string | null;
}

/**
 * Muster der gespeicherten Adresse. Identisch mit `needs_check_results_url_chk`:
 * http(s), ein Host mit Punkt, kein `@` im Host (keine Zugangsdaten), keine Leerzeichen.
 */
export const WEBSITE_URL_PATTERN = '^https?://[^\\s/@]+\\.[^\\s]+$';
const URL_RE = new RegExp(WEBSITE_URL_PATTERN, 'i');

export function isGoal(v: unknown): v is Goal {
  return typeof v === 'string' && (GOALS as readonly string[]).includes(v);
}
export function isArea(v: unknown): v is Area {
  return typeof v === 'string' && (AREAS as readonly string[]).includes(v);
}
export function isRecommendationId(v: unknown): v is RecommendationId {
  return typeof v === 'string' && (RECOMMENDATION_IDS as readonly string[]).includes(v);
}
export function isModelVersion(v: unknown): v is NeedsCheckModelVersion {
  return typeof v === 'number' && (NEEDS_CHECK_MODEL_VERSIONS as readonly number[]).includes(v);
}

/** Normalisiert eine Adresse; ergänzt https:// und lehnt alles andere ab. */
export function normalizeWebsiteUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  if (withScheme.length > WEBSITE_URL_MAX || !URL_RE.test(withScheme)) return null;
  try {
    const u = new URL(withScheme);
    if (u.username || u.password) return null;
    return withScheme;
  } catch {
    return null;
  }
}

export type ValidationResult =
  | { ok: true; answers: Answers }
  | { ok: false; field: 'goal' | 'area' | 'hasWebsite' | 'websiteUrl'; message: string };

export function validateAnswers(input: {
  goal?: unknown;
  area?: unknown;
  hasWebsite?: unknown;
  websiteUrl?: unknown;
}): ValidationResult {
  if (!isGoal(input.goal)) return { ok: false, field: 'goal', message: 'Bitte wählen Sie ein Ziel.' };
  if (!isArea(input.area)) return { ok: false, field: 'area', message: 'Bitte wählen Sie Ihren Bereich.' };
  if (typeof input.hasWebsite !== 'boolean') {
    return { ok: false, field: 'hasWebsite', message: 'Bitte geben Sie an, ob es schon eine Website gibt.' };
  }
  let websiteUrl: string | null = null;
  if (input.hasWebsite && typeof input.websiteUrl === 'string' && input.websiteUrl.trim()) {
    websiteUrl = normalizeWebsiteUrl(input.websiteUrl);
    if (!websiteUrl) {
      return {
        ok: false,
        field: 'websiteUrl',
        message: 'Bitte eine gültige Adresse wie ihr-betrieb.de eingeben – oder das Feld leer lassen.',
      };
    }
  }
  return { ok: true, answers: { goal: input.goal, area: input.area, hasWebsite: input.hasWebsite, websiteUrl } };
}

// ── Empfehlungslogik ────────────────────────────────────────────────────────

/**
 * Version 1: bis zu drei Empfehlungen, Reihenfolge = Priorität. Hängt nur von
 * Ziel und „Website ja/nein“ ab, nicht vom Bereich und nicht von der Adresse.
 * Spiegel: `public.needs_check_recommend(1, goal, has_website)`.
 */
function recommendV1(goal: Goal, hasWebsite: boolean): RecommendationId[] {
  const ids: RecommendationId[] = [];
  const push = (id: RecommendationId) => {
    if (!ids.includes(id)) ids.push(id);
  };

  if (goal === 'website') push(hasWebsite ? 'build.modernize' : 'build.new_site');
  if (goal === 'inquiries') push('automate.chat');
  if (goal === 'rules') push('govern.runtime');
  if (goal === 'unsure') push(hasWebsite ? 'govern.website_scan' : 'build.new_site');

  if (hasWebsite) push('govern.website_scan');
  else if (goal !== 'website') push('build.new_site');
  if (goal === 'inquiries' || goal === 'unsure') push('govern.runtime');
  if (goal === 'website' || goal === 'rules') push('automate.chat');

  return ids.slice(0, 3);
}

/** Empfehlungs-IDs für eine Modellversion. */
export function recommendIds(
  answers: Pick<Answers, 'goal' | 'hasWebsite'>,
  version: NeedsCheckModelVersion = NEEDS_CHECK_MODEL_VERSION,
): RecommendationId[] {
  switch (version) {
    case 1:
      return recommendV1(answers.goal, answers.hasWebsite);
  }
}

// ── Versionierter Textkatalog ───────────────────────────────────────────────

interface CatalogEntry {
  section: Section;
  title: string;
  /** Platzhalter: {area}. Bezieht sich immer auf die Angaben. */
  reason: string;
  cta: { label: string; href: string };
}

interface CatalogVersion {
  goalLabel: Record<Goal, string>;
  areaLabel: Record<Area, string>;
  recommendations: Record<RecommendationId, CatalogEntry>;
}

/**
 * Version 1 — eingefroren. Siehe VERSIONSREGEL oben.
 * Der Platzhalter `{prompt}` im Link wird beim Anzeigen aus den Angaben gebildet.
 */
const CATALOG_V1: CatalogVersion = {
  goalLabel: {
    website: 'Eine neue oder bessere Website',
    inquiries: 'Kundenanfragen schneller beantworten',
    rules: 'Regeln und Nachweise für KI und Website',
    unsure: 'Noch unklar – ich möchte Orientierung',
  },
  areaLabel: {
    handwerk: 'Handwerk',
    praxis: 'Praxis',
    kanzlei: 'Kanzlei',
    handel: 'Handel',
    dienstleistung: 'Dienstleistung',
    agentur: 'Agentur',
    sonstiges: 'Sonstiges',
  },
  recommendations: {
    'build.new_site': {
      section: 'build',
      title: 'Website-Entwurf erstellen',
      reason:
        'Sie haben angegeben, dass es noch keine Website gibt. Der App Builder erzeugt aus einer kurzen Beschreibung einen ersten Entwurf für Ihren {area}-Betrieb.',
      cta: { label: 'Entwurf erzeugen', href: '/build?prompt={prompt}' },
    },
    'build.modernize': {
      section: 'build',
      title: 'Bestehende Website neu aufbauen',
      reason:
        'Sie möchten eine bessere Website und haben schon eine. Der App Builder erstellt einen neuen Entwurf, den Sie mit Ihrer aktuellen Seite vergleichen.',
      cta: { label: 'Neuen Entwurf erzeugen', href: '/build?prompt={prompt}' },
    },
    'automate.chat': {
      section: 'automate',
      title: 'Chat-Assistent für Kundenanfragen',
      reason:
        'Sie möchten Anfragen schneller beantworten. Ein Chat-Assistent beantwortet Fragen auf Ihrer Website nach Ihren Vorgaben.',
      cta: { label: 'Chat-Assistent ansehen', href: '/chatbot/start?source=needs-check' },
    },
    'govern.website_scan': {
      section: 'govern',
      title: 'Website technisch prüfen',
      reason:
        'Sie haben eine Website. Der kostenlose Scan ruft sie ab und prüft Sicherheit, Einwilligung, Impressum und Datenschutzerklärung. Er startet auf einer eigenen Seite und ist nicht Teil dieses Ergebnisses.',
      cta: { label: 'Kostenlosen Scan öffnen', href: '/audit?source=needs-check' },
    },
    'govern.runtime': {
      section: 'govern',
      title: 'Regeln, Freigaben und Nachweise',
      reason:
        'Sie möchten Regeln und Nachweise für KI und Website. Das Governance OS prüft Aktionen gegen Ihre Regeln; Warnungen, Freigaben und Blockaden werden als Nachweis gespeichert.',
      cta: { label: 'Governance OS ansehen', href: '/governance-runtime?source=needs-check' },
    },
  },
};

export const NEEDS_CHECK_CATALOG: Readonly<Record<NeedsCheckModelVersion, CatalogVersion>> = {
  1: CATALOG_V1,
};

/** Beschriftungen der aktuellen Version für das Formular. */
export const GOAL_LABEL = CATALOG_V1.goalLabel;
export const AREA_LABEL = CATALOG_V1.areaLabel;
export const SECTION_LABEL: Record<Section, string> = { build: 'Build', automate: 'Automate', govern: 'Govern' };

export interface Recommendation {
  id: RecommendationId;
  section: Section;
  title: string;
  reason: string;
  cta: { label: string; href: string };
}

function buildPrompt(a: Answers, labels: Record<Area, string>): string {
  const area = labels[a.area];
  return a.hasWebsite
    ? `${area}-Betrieb, bestehende Website${a.websiteUrl ? ` ${a.websiteUrl}` : ''} modernisieren. Kunden sollen Leistungen sehen und Anfragen stellen können.`
    : `Neue Website für einen ${area}-Betrieb. Kunden sollen Leistungen sehen und Anfragen stellen können.`;
}

/**
 * Texte zu gespeicherten oder frisch berechneten IDs — immer aus dem Katalog
 * der angegebenen Version. Unbekannte IDs werden übersprungen.
 */
export function renderRecommendations(
  ids: readonly string[],
  answers: Answers,
  version: NeedsCheckModelVersion = NEEDS_CHECK_MODEL_VERSION,
): Recommendation[] {
  const cat = NEEDS_CHECK_CATALOG[version];
  const area = cat.areaLabel[answers.area];
  return ids.filter(isRecommendationId).map((id) => {
    const e = cat.recommendations[id];
    return {
      id,
      section: e.section,
      title: e.title,
      reason: e.reason.replaceAll('{area}', area),
      cta: { label: e.cta.label, href: e.cta.href.replace('{prompt}', encodeURIComponent(buildPrompt(answers, cat.areaLabel))) },
    };
  });
}

/** Berechnet und rendert die Empfehlungen der aktuellen Version. */
export function recommend(answers: Answers): Recommendation[] {
  return renderRecommendations(recommendIds(answers), answers);
}
