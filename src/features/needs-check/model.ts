/**
 * Bedarfs-Check (/check) — Angaben, Prüfung und Empfehlungen.
 *
 * Grundlage ist ausschließlich, was der Nutzer angibt. Eine technische
 * Prüfung der Website findet nur statt, wenn er sie ausdrücklich startet
 * (gdpr-audit, siehe api.ts); das Ergebnis trägt dann `basis: 'answers_and_scan'`.
 *
 * Die erlaubten Werte spiegeln die CHECK-Constraints in
 * supabase/migrations/20261115200000_needs_check_results.sql.
 */

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

export const GOAL_LABEL: Record<Goal, string> = {
  website: 'Eine neue oder bessere Website',
  inquiries: 'Kundenanfragen schneller beantworten',
  rules: 'Regeln und Nachweise für KI und Website',
  unsure: 'Noch unklar – ich möchte Orientierung',
};

export const AREA_LABEL: Record<Area, string> = {
  handwerk: 'Handwerk',
  praxis: 'Praxis',
  kanzlei: 'Kanzlei',
  handel: 'Handel',
  dienstleistung: 'Dienstleistung',
  agentur: 'Agentur',
  sonstiges: 'Sonstiges',
};

export interface Answers {
  goal: Goal;
  area: Area;
  hasWebsite: boolean;
  /** Nur gesetzt, wenn hasWebsite und der Nutzer eine Adresse angibt. */
  websiteUrl: string | null;
}

export interface Recommendation {
  id: RecommendationId;
  section: Section;
  title: string;
  /** Warum diese Empfehlung — immer mit Bezug auf die Angaben. */
  reason: string;
  cta: { label: string; href: string };
  /** Ehrlicher Status, falls die Funktion nicht vollständig in Betrieb ist. */
  status?: string;
}

const URL_RE = /^https?:\/\/[^\s/]+\.[^\s]+$/i;

export function isGoal(v: unknown): v is Goal {
  return typeof v === 'string' && (GOALS as readonly string[]).includes(v);
}
export function isArea(v: unknown): v is Area {
  return typeof v === 'string' && (AREAS as readonly string[]).includes(v);
}

/** Normalisiert eine Adresse; ergänzt https:// und lehnt alles andere ab. */
export function normalizeWebsiteUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  if (withScheme.length > 300 || !URL_RE.test(withScheme)) return null;
  try {
    const u = new URL(withScheme);
    if (u.username || u.password) return null;
    return withScheme;
  } catch {
    return null;
  }
}

export type ValidationResult = { ok: true; answers: Answers } | { ok: false; field: 'goal' | 'area' | 'hasWebsite' | 'websiteUrl'; message: string };

export function validateAnswers(input: {
  goal?: unknown;
  area?: unknown;
  hasWebsite?: unknown;
  websiteUrl?: unknown;
}): ValidationResult {
  if (!isGoal(input.goal)) return { ok: false, field: 'goal', message: 'Bitte wählen Sie ein Ziel.' };
  if (!isArea(input.area)) return { ok: false, field: 'area', message: 'Bitte wählen Sie Ihren Bereich.' };
  if (typeof input.hasWebsite !== 'boolean') return { ok: false, field: 'hasWebsite', message: 'Bitte geben Sie an, ob es schon eine Website gibt.' };
  let websiteUrl: string | null = null;
  if (input.hasWebsite && typeof input.websiteUrl === 'string' && input.websiteUrl.trim()) {
    websiteUrl = normalizeWebsiteUrl(input.websiteUrl);
    if (!websiteUrl) {
      return { ok: false, field: 'websiteUrl', message: 'Bitte eine gültige Adresse wie ihr-betrieb.de eingeben – oder das Feld leer lassen.' };
    }
  }
  return { ok: true, answers: { goal: input.goal, area: input.area, hasWebsite: input.hasWebsite, websiteUrl } };
}

function buildPrompt(a: Answers): string {
  const area = AREA_LABEL[a.area];
  return a.hasWebsite
    ? `${area}-Betrieb, bestehende Website${a.websiteUrl ? ` ${a.websiteUrl}` : ''} modernisieren. Kunden sollen Leistungen sehen und Anfragen stellen können.`
    : `Neue Website für einen ${area}-Betrieb. Kunden sollen Leistungen sehen und Anfragen stellen können.`;
}

function rec(id: RecommendationId, a: Answers): Recommendation {
  const area = AREA_LABEL[a.area];
  switch (id) {
    case 'build.new_site':
      return {
        id, section: 'build', title: 'Website-Entwurf erstellen',
        reason: `Sie haben angegeben, dass es noch keine Website gibt. Der App Builder erzeugt aus einer kurzen Beschreibung einen ersten Entwurf für Ihren ${area}-Betrieb.`,
        cta: { label: 'Entwurf erzeugen', href: `/build?prompt=${encodeURIComponent(buildPrompt(a))}` },
      };
    case 'build.modernize':
      return {
        id, section: 'build', title: 'Bestehende Website neu aufbauen',
        reason: 'Sie möchten eine bessere Website und haben schon eine. Der App Builder erstellt einen neuen Entwurf, den Sie mit Ihrer aktuellen Seite vergleichen.',
        cta: { label: 'Neuen Entwurf erzeugen', href: `/build?prompt=${encodeURIComponent(buildPrompt(a))}` },
      };
    case 'automate.chat':
      return {
        id, section: 'automate', title: 'Chat-Assistent für Kundenanfragen',
        reason: 'Sie möchten Anfragen schneller beantworten. Ein Chat-Assistent beantwortet Fragen auf Ihrer Website nach Ihren Vorgaben; jede Antwort zählt gegen ein festes Kontingent.',
        cta: { label: 'Chat-Assistent ansehen', href: '/chatbot/start?source=needs-check' },
        status: 'Vorschau – die Bot-Laufzeit ist noch nicht allgemein in Betrieb.',
      };
    case 'govern.website_scan':
      return {
        id, section: 'govern', title: 'Website technisch prüfen',
        reason: 'Sie haben eine Website. Der kostenlose Scan ruft sie ab und prüft Sicherheit, Einwilligung, Impressum und Datenschutzerklärung.',
        cta: { label: 'Kostenlosen Scan öffnen', href: '/audit?source=needs-check' },
      };
    case 'govern.runtime':
      return {
        id, section: 'govern', title: 'Regeln, Freigaben und Nachweise',
        reason: 'Sie möchten Regeln und Nachweise für KI und Website. Das Governance OS prüft Aktionen gegen Ihre Regeln; Warnungen, Freigaben und Blockaden werden als Nachweis gespeichert.',
        cta: { label: 'Governance OS ansehen', href: '/governance-runtime?source=needs-check' },
      };
  }
}

/** Leitet bis zu drei Empfehlungen aus den Angaben ab. Reihenfolge = Priorität. */
export function recommend(a: Answers): Recommendation[] {
  const ids: RecommendationId[] = [];
  const push = (id: RecommendationId) => { if (!ids.includes(id)) ids.push(id); };

  if (a.goal === 'website') push(a.hasWebsite ? 'build.modernize' : 'build.new_site');
  if (a.goal === 'inquiries') push('automate.chat');
  if (a.goal === 'rules') push('govern.runtime');
  if (a.goal === 'unsure') push(a.hasWebsite ? 'govern.website_scan' : 'build.new_site');

  if (a.hasWebsite) push('govern.website_scan');
  else if (a.goal !== 'website') push('build.new_site');
  if (a.goal === 'inquiries' || a.goal === 'unsure') push('govern.runtime');
  if (a.goal === 'website' || a.goal === 'rules') push('automate.chat');

  return ids.slice(0, 3).map((id) => rec(id, a));
}

export function recommendationsFromIds(ids: readonly string[], a: Answers): Recommendation[] {
  return ids
    .filter((id): id is RecommendationId => (RECOMMENDATION_IDS as readonly string[]).includes(id))
    .map((id) => rec(id, a));
}

export const SECTION_LABEL: Record<Section, string> = { build: 'Build', automate: 'Automate', govern: 'Govern' };
