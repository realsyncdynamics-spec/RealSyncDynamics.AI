/**
 * Kanonische Empfehlung — Customer Reality → Angebot.
 *
 * ## Warum diese Datei existiert (und keine dritte Engine ist)
 *
 * Vor diesem Schritt lagen zwei Empfehlungslogiken nebeneinander, die
 * einander nicht kannten:
 *
 *  - `src/core/onboarding/recommendationEngine.ts` rechnet aus **Befunden**
 *    einen Plan. Sie kennt keine buchbaren Module.
 *  - `shared/onboarding.ts` rechnet aus **Q&A-Antworten** Plan *und* Module.
 *    Sie kennt keine Befunde — und hatte bis hierher keinen einzigen
 *    Aufrufer ausserhalb der Tests.
 *
 * Diese Datei ersetzt **keine** von beiden. Sie ruft beide auf und legt das
 * fest, was in keiner von beiden stand: **welches buchbare Modul ein
 * konkreter Befund nach sich zieht**. Das war die eigentliche Lücke — eine
 * Empfehlung ohne Modul ist kein Angebot, sondern eine Planbehauptung.
 *
 * Rangfolge, nicht verhandelbar: **Der Scan führt, die Q&A ergänzt.**
 * Ein Modul aus den Antworten darf nichts überschreiben, was die Befunde
 * bereits begründet haben; ein Modul aus den Befunden verschwindet nicht,
 * weil der Kunde eine Frage anders beantwortet hat.
 *
 * ## Was hier bewusst *nicht* passiert
 *
 * Es entsteht kein Preis. Beträge, Plan-Leiter und Modulkatalog kommen
 * ausschliesslich aus `shared/pricing.ts` (`CLAUDE.md` §6). Diese Datei
 * wählt aus, sie rechnet nicht.
 */

import type {
  ClassifiedFinding,
  GovernanceDimension,
  GovernanceProfile,
  RiskLevel,
  ScanFinding,
  Sector,
} from './types';
import { generateRecommendation, estimateTimeToValue } from './recommendationEngine';
import {
  recommendFromAnswers,
  type OnboardingChoiceId,
} from '@/shared/onboarding';
import {
  bookableModuleById,
  monthlyBaseTotalEur,
  normalizeModuleSelection,
  planRank,
  type BookableModule,
  type BookableModuleId,
  type ModulePriceModel,
  type PlanId,
  type ProductTrack,
} from '@/shared/pricing';
import { cheapestPlanFor } from '../../features/market/moduleCatalog';

// ── Customer Reality ──────────────────────────────────────────────────────

/**
 * Was über den Kunden **gemessen** wurde, plus das, was er selbst gesagt hat.
 *
 * `findings` und `dimensions` stammen aus dem Scan und sind die belastbare
 * Grundlage. `businessNeeds` sind Selbstauskünfte aus der Q&A — sie stehen
 * hier bewusst getrennt daneben und nicht vermischt, damit im Angebot
 * nachvollziehbar bleibt, was gemessen und was behauptet ist.
 */
export interface CustomerReality {
  scanId: string;
  domain: string;
  findings: ClassifiedFinding[];
  riskLevel: RiskLevel;
  dimensions: GovernanceProfile['dimensions'];
  sector: Sector;
  businessNeeds: OnboardingChoiceId[];
}

// ── Empfehlung ────────────────────────────────────────────────────────────

/**
 * Kann der Kunde das Modul heute kaufen?
 *
 * `bookable` heisst: Es gibt einen wählbaren Plan, der **alle**
 * Entitlement-Keys des Moduls trägt (`cheapestPlanFor()`). Alles andere ist
 * `coming_soon` — dazu gehört heute `ai_frontend`, das mit `unlocks: []`
 * keinen Key freischaltet und deshalb über keinen Plan erwerbbar ist.
 *
 * `coming_soon` heisst **nicht** „nicht benutzbar": `entryRoute` nennt den
 * Weg, auf dem das Modul heute tatsächlich erreichbar ist, sofern es einen
 * gibt. Beim AI Frontend ist das der Builder — bauen und ansehen geht,
 * kaufen noch nicht. Beides getrennt zu benennen ist der einzige Weg, der
 * `CLAUDE.md` §14 genügt: kein Element vortäuschen, das nichts tut, und
 * nichts verschweigen, was es gibt.
 */
export type ModulePurchaseState = 'bookable' | 'coming_soon';

/** Woher die Empfehlung dieses Moduls stammt. Der Scan wiegt schwerer. */
export type RecommendationSource = 'scan' | 'answers';

/**
 * Ein Modulvorschlag in Angebotsform: Problem → Lösung → Nutzen → Preis.
 * Genau die vier Zeilen, die der Kunde nach dem Reality Report sehen soll.
 */
export interface RecommendedModule {
  id: BookableModuleId;
  name: string;
  /** Erkannte Ursache — aus den Befunden formuliert, nicht aus dem Katalog. */
  problem: string;
  /** Was das Modul konkret tut. Aus `BOOKABLE_MODULES`, nicht neu getextet. */
  solution: string;
  /** Erwartetes Ergebnis. */
  benefit: string;
  priceEur: number;
  priceModel: ModulePriceModel;
  usageNote: string | null;
  purchase: ModulePurchaseState;
  /** Günstigster wählbarer Plan, der das Modul trägt. `null` bei `coming_soon`. */
  unlockedByPlan: PlanId | null;
  /** Wo der Kunde das Modul heute erreicht — `null`, wenn es keinen Weg gibt. */
  entryRoute: string | null;
  /** Befund-Kennungen, die diesen Vorschlag tragen. Leer bei Q&A-Herkunft. */
  evidence: string[];
  source: RecommendationSource;
}

export interface RecommendedAction {
  /** Kurzform für die Liste. */
  label: string;
  /** Warum — in Geschäftssprache, nicht in Befund-Codes. */
  reason: string;
  urgency: 'immediate' | 'soon' | 'eventual';
}

export interface CanonicalRecommendation {
  recommendedPlan: PlanId;
  recommendedModules: RecommendedModule[];
  recommendedActions: RecommendedAction[];
  /** Umsetzungspfad: bestehende Website behalten oder neu aufbauen. */
  implementationTrack: ProductTrack;
  reasoning: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  estimatedValue: {
    /** Summe der Festpreise der empfohlenen Module — aus der Pricing-SSoT. */
    monthlyBaseEur: number;
    timeToValueMonths: number;
    reasoning: string;
  };
}

// ── Befund → Modul ────────────────────────────────────────────────────────

/**
 * Befund-Codes, die ein neu gebautes Frontend tatsächlich behebt.
 *
 * Die Liste ist **keine Schätzung**. Sie stammt aus der gemessenen
 * Befund→Schritt-Matrix in `docs/architecture/canonical-builder-target-matrix.md`
 * §3 (26 Codes über 159 Audits) und enthält genau die Codes, denen dort ein
 * Schritt der `rebuild-website`-Pipeline zugeordnet ist.
 *
 * Bewusst **nicht** enthalten: `fetch_failed`. Dieser Befund bedeutet, dass
 * die Quelle nie geladen wurde — ein Neubau auf dieser Grundlage baut aus
 * nichts. Die Matrix nennt ihn ausdrücklich als Abbruchbedingung, und was
 * ein Abbruch ist, darf kein Verkaufsargument werden.
 */
const REBUILD_FIXABLE_CODES: ReadonlySet<string> = new Set([
  // legal_pages
  'sub_imprint_no_legal_form',
  'sub_imprint_no_address',
  'sub_imprint_no_contact',
  'no_imprint_link',
  'no_imprint_link_non_de',
  'no_privacy_link',
  'sub_privacy_third_country_no_legal_basis',
  'sub_privacy_no_complaint_right',
  'sub_privacy_no_avv_list',
  'sub_privacy_no_dpo_contact',
  'rule:MISSING_AVV_REFERENCE',
  // strip_trackers / inject_consent
  'tracker_no_consent',
  'social_pixel_no_consent',
  'ga_no_ip_anon',
  'cookies_pre_consent',
  'rule:COOKIE_BANNER_DARK_PATTERN',
  // ai_ready
  'no_og_tags',
  'rule:AI_ACT_LIMITED_RISK_CHATBOT',
  // package_deploy (Header und Transport)
  'no_xframe',
  'no_hsts',
  'no_csp',
  'no_https',
  'mixed_content',
]);

/**
 * Befunde, die belegen, dass auf der Seite **bereits** ein KI-Dialog läuft.
 *
 * Das ist der einzige Fall, in dem ein Scan einen Automatisierungskanal
 * begründen kann: Wer einen Chat betreibt, für den ihm der Art.-50-Hinweis
 * fehlt, braucht nicht „vielleicht mal einen Bot" — er betreibt einen
 * ungeregelten. Alles Übrige an Kanälen ist Selbstauskunft und kommt aus
 * der Q&A, nie aus dem Scan.
 */
const GOVERNED_CHAT_CODES: ReadonlySet<string> = new Set([
  'rule:AI_ACT_LIMITED_RISK_CHATBOT',
]);

/**
 * Dimension → Modul, als Auffangnetz für Codes, die in keiner gemessenen
 * Liste stehen (neue Regeln, neue Prüfungen). Die Zuordnung läuft über die
 * **bestehende** Klassifikation aus `findingClassifier.ts` — hier entsteht
 * keine zweite Einteilung von Befunden.
 *
 * `team_collaboration` und `api_integration` fehlen absichtlich: Beides sind
 * Plan-Eigenschaften, kein buchbares Modul. Sie erzeugen weiter unten eine
 * Massnahme statt eines Kaufvorschlags.
 */
const DIMENSION_MODULE: Partial<Record<GovernanceDimension, BookableModuleId>> = {
  website_compliance: 'governance_core',
  monitoring: 'governance_core',
  evidence: 'governance_core',
  aiact_governance: 'advanced_ai_governance',
  policy_automation: 'advanced_ai_governance',
  industry_specifics: 'advanced_ai_governance',
};

/**
 * Wo ein Modul heute erreichbar ist.
 *
 * Die Routen stammen aus der erhobenen Capability-Matrix
 * (`docs/product/capability-matrix.md` §1) — jede davon existiert und hat
 * ein deploytes Backend. Module ohne Eintrag haben keine eigene Route;
 * `booking` ist der gemessene Fall (Backend vorhanden, keine App-Route).
 * Für sie bleibt `entryRoute` `null`, statt einen Knopf ins Leere zu bauen.
 */
const MODULE_ENTRY_ROUTE: Partial<Record<BookableModuleId, string>> = {
  governance_core: '/app/dashboard',
  ai_frontend: '/build',
  website_chat: '/app/bots',
  whatsapp_bot: '/app/bots/whatsapp',
  voice_bot: '/app/agents/susi',
  advanced_ai_governance: '/app/governance/ai-act-assessment',
  additional_domain: '/app/websites',
};

/** Nutzenaussage je Modul — was der Kunde hinterher hat, nicht was es kann. */
const MODULE_BENEFIT: Record<BookableModuleId, string> = {
  governance_core:
    'Die Befunde bleiben nicht bei einer Momentaufnahme: Sie werden laufend geprüft, im Prüfpfad belegt und als Nachweis exportierbar.',
  ai_frontend:
    'Die beanstandeten Stellen entstehen im neuen Frontend gar nicht erst — Rechtstexte, Consent, Tracking und Auslieferungs-Header kommen aus dem Bau statt aus Nacharbeit.',
  website_chat:
    'Der Dialog auf der Website antwortet aus dem hinterlegten Unternehmenskontext, mit Art.-50-Hinweis und jeder Antwort im Prüfpfad.',
  voice_bot:
    'Anrufe werden angenommen und beantwortet, ohne dass jemand daneben sitzt — mit Eskalation an Menschen statt erfundener Auskunft.',
  whatsapp_bot:
    'WhatsApp wird zum geführten Kanal mit demselben Protokoll wie Website und Telefon — ein Bot, mehrere Kanäle, ein Prüfpfad.',
  booking:
    'Termine entstehen aus einer zentralen Slot-Berechnung statt aus der Zusage eines Bots.',
  advanced_ai_governance:
    'NIS2, ISO 27001, Risikoregister und Drift-Erkennung kommen hinzu — die Nachweisfähigkeit reicht über DSGVO und EU AI Act hinaus.',
  additional_domain:
    'Jede weitere Domain bekommt einen eigenen Governance Score im selben Konto.',
  additional_company:
    'Ein weiteres Unternehmen im selben Konto, datentechnisch getrennt über RLS.',
};

/** Modulvorschlag aus Katalogdaten bauen. Preise nur aus der SSoT. */
function toRecommendedModule(
  module: BookableModule,
  problem: string,
  evidence: string[],
  source: RecommendationSource,
): RecommendedModule {
  const unlockedByPlan = cheapestPlanFor(module);
  return {
    id: module.id,
    name: module.name,
    problem,
    solution: module.description,
    benefit: MODULE_BENEFIT[module.id],
    priceEur: module.priceEur,
    priceModel: module.priceModel,
    usageNote: module.usageNote,
    purchase: unlockedByPlan === null ? 'coming_soon' : 'bookable',
    unlockedByPlan,
    entryRoute: MODULE_ENTRY_ROUTE[module.id] ?? null,
    evidence,
    source,
  };
}

/** Befund-Kennung, wie sie im Angebot als Beleg auftaucht. */
function codeOf(finding: ClassifiedFinding): string {
  return finding.original.id;
}

// ── Aufbau ────────────────────────────────────────────────────────────────

/**
 * Customer Reality aus einem Governance-Profil und den Q&A-Antworten.
 *
 * Das Profil kommt unverändert aus `useGovernanceOnboarding()`; hier wird
 * nichts neu klassifiziert und nichts neu bewertet.
 */
export function buildCustomerReality(
  profile: GovernanceProfile,
  businessNeeds: readonly OnboardingChoiceId[] = [],
): CustomerReality {
  return {
    scanId: profile.scanId,
    domain: profile.domain,
    findings: profile.findings,
    riskLevel: profile.riskLevel,
    dimensions: profile.dimensions,
    sector: profile.sector,
    businessNeeds: [...businessNeeds],
  };
}

/**
 * Die eine Empfehlung.
 *
 * Reihenfolge der Quellen — sie ist die fachliche Aussage dieser Funktion:
 *
 *  1. **Befunde** bestimmen Module (Code-Treffer, sonst Dimension).
 *  2. **Bestehende Plan-Logik** (`generateRecommendation`) bestimmt Plan,
 *     Begründung und Dringlichkeit.
 *  3. **Q&A** ergänzt Module, die kein Scan erkennen kann (Kanäle, Skalierung),
 *     und darf den Plan nur **anheben**, nie senken.
 */
export function recommendForReality(reality: CustomerReality): CanonicalRecommendation {
  const profile: GovernanceProfile = {
    scanId: reality.scanId,
    domain: reality.domain,
    sector: reality.sector,
    riskLevel: reality.riskLevel,
    findings: reality.findings,
    answers: [],
    dimensions: reality.dimensions,
  };

  const base = generateRecommendation(profile);

  // ── 1. Module aus den Befunden ─────────────────────────────────────────
  const evidenceByModule = new Map<BookableModuleId, string[]>();
  const addEvidence = (id: BookableModuleId, code: string) => {
    const list = evidenceByModule.get(id) ?? [];
    if (!list.includes(code)) list.push(code);
    evidenceByModule.set(id, list);
  };

  for (const finding of reality.findings) {
    const code = codeOf(finding);
    if (REBUILD_FIXABLE_CODES.has(code)) addEvidence('ai_frontend', code);
    if (GOVERNED_CHAT_CODES.has(code)) addEvidence('website_chat', code);
    const byDimension = DIMENSION_MODULE[finding.dimension];
    if (byDimension) addEvidence(byDimension, code);
  }

  // Governance Core ist das Fundament und in jedem Checkout enthalten
  // (`required: true`). Es steht deshalb auch dann im Angebot, wenn kein
  // einzelner Befund es begründet — dann eben ohne Beleg.
  if (!evidenceByModule.has('governance_core')) evidenceByModule.set('governance_core', []);

  // ── 2. Module aus der Q&A — nur ergänzend ──────────────────────────────
  const fromAnswers = reality.businessNeeds.length > 0
    ? recommendFromAnswers(reality.businessNeeds)
    : null;

  const answerOnly: BookableModuleId[] = [];
  for (const id of fromAnswers?.modules ?? []) {
    if (evidenceByModule.has(id)) continue; // Der Scan hat es bereits begründet.
    answerOnly.push(id);
  }

  // ── 3. Angebotszeilen bauen ────────────────────────────────────────────
  const modules: RecommendedModule[] = [];
  // `normalizeModuleSelection` sortiert nach Katalogreihenfolge und zieht das
  // Pflichtmodul nach vorn — dieselbe Reihenfolge wie im Checkout.
  const scanIds = normalizeModuleSelection([...evidenceByModule.keys()]);
  for (const id of scanIds) {
    const module = bookableModuleById(id);
    if (!module) continue;
    const evidence = evidenceByModule.get(id) ?? [];
    modules.push(toRecommendedModule(module, problemFor(id, evidence, reality), evidence, 'scan'));
  }
  for (const id of answerOnly) {
    const module = bookableModuleById(id);
    if (!module) continue;
    modules.push(
      toRecommendedModule(module, 'Aus Ihren Angaben im Fragebogen, nicht aus dem Scan.', [], 'answers'),
    );
  }

  // ── 4. Plan: Befunde führen, Q&A darf nur anheben ──────────────────────
  const recommendedPlan = higherPlan(base.recommendedPlan, fromAnswers?.planId);

  // ── 5. Umsetzungspfad ──────────────────────────────────────────────────
  // Ein neu gebautes Frontend ist nur dann der Pfad, wenn es entweder
  // gewünscht ist oder die Befunde es tragen.
  const implementationTrack: ProductTrack =
    fromAnswers?.track === 'modernize_frontend' || evidenceByModule.has('ai_frontend')
      ? 'modernize_frontend'
      : 'keep_frontend';

  const topCriticality = reality.dimensions.reduce((max, d) => Math.max(max, d.criticalityScore), 0);
  const ttv = estimateTimeToValue(recommendedPlan, topCriticality);

  return {
    recommendedPlan,
    recommendedModules: modules,
    recommendedActions: buildActions(reality),
    implementationTrack,
    reasoning: base.reasoning,
    urgency: base.urgencyLevel,
    estimatedValue: {
      monthlyBaseEur: monthlyBaseTotalEur(modules.map((m) => m.id)),
      timeToValueMonths: ttv.months,
      reasoning: ttv.reasoning,
    },
  };
}

/** Kurzweg: Profil + Antworten → Empfehlung. */
export function recommendForProfile(
  profile: GovernanceProfile,
  businessNeeds: readonly OnboardingChoiceId[] = [],
): CanonicalRecommendation {
  return recommendForReality(buildCustomerReality(profile, businessNeeds));
}

// ── Hilfen ────────────────────────────────────────────────────────────────

/**
 * Der höhere von zwei Plänen.
 *
 * Der Rang kommt aus der vollständigen Leiter (`PLAN_ORDER` über
 * `planRank()`), nicht aus einem Namensvergleich — sonst bekäme ein
 * Bestandskunde auf Agency falsche Antworten (`CLAUDE.md` §10, AP2).
 */
function higherPlan(a: PlanId, b: PlanId | undefined): PlanId {
  if (!b) return a;
  return planRank(b) > planRank(a) ? b : a;
}

/**
 * Die Problemzeile des Angebots.
 *
 * Sie nennt die **Zahl** der belegenden Befunde und den schwersten davon —
 * nicht eine Behauptung über Konformität. Die Sprachregel aus
 * `docs/product/public-scan-funnel.md` §3.3 gilt hier genauso: Es wird
 * beschrieben, was erkannt wurde, nie was zugesichert werden könnte.
 */
function problemFor(
  id: BookableModuleId,
  evidence: string[],
  reality: CustomerReality,
): string {
  if (evidence.length === 0) {
    return 'Fundament der Governance — enthalten, unabhängig von einzelnen Befunden.';
  }
  const relevant = reality.findings.filter((f) => evidence.includes(codeOf(f)));
  const worst = severestOf(relevant);
  const count = evidence.length;
  const noun = count === 1 ? 'Befund' : 'Befunde';
  const lead = relevant.find((f) => f.original.severity === worst)?.original.title ?? '';
  const scope = id === 'ai_frontend'
    ? 'die ein Neubau des Frontends direkt behebt'
    : 'die dieses Modul abdeckt';
  return `${count} ${noun}, ${scope} — schwerster: „${lead}" (${SEVERITY_WORD[worst]}).`;
}

const SEVERITY_WORD: Record<RiskLevel, string> = {
  critical: 'kritisch',
  high: 'hoch',
  medium: 'mittel',
  low: 'niedrig',
  info: 'Hinweis',
};

const SEVERITY_RANK: Record<RiskLevel, number> = {
  critical: 5, high: 4, medium: 3, low: 2, info: 1,
};

function severestOf(findings: ClassifiedFinding[]): RiskLevel {
  let worst: RiskLevel = 'info';
  for (const f of findings) {
    if (SEVERITY_RANK[f.original.severity] > SEVERITY_RANK[worst]) worst = f.original.severity;
  }
  return worst;
}

/**
 * Massnahmen, die **kein** Modul verkaufen.
 *
 * Sie entstehen aus den Dimensionen, für die es keine Verkaufseinheit gibt
 * (`team_collaboration`, `api_integration`) sowie aus jedem Befund mit
 * sofortiger Dringlichkeit. Ohne sie fiele genau der Teil des Reality
 * Reports weg, an dem nichts zu verdienen ist — und damit die
 * Glaubwürdigkeit des Rests.
 */
function buildActions(reality: CustomerReality): RecommendedAction[] {
  const actions: RecommendedAction[] = [];

  const immediate = reality.findings.filter((f) => f.urgency === 'immediate');
  if (immediate.length > 0) {
    actions.push({
      label: `${immediate.length} ${immediate.length === 1 ? 'Befund' : 'Befunde'} sofort beheben`,
      reason: immediate[0].businessContext,
      urgency: 'immediate',
    });
  }

  for (const dim of reality.dimensions) {
    if (dim.criticalityScore < 30) continue;
    if (dim.dimension === 'team_collaboration') {
      actions.push({
        label: 'Verantwortlichkeiten festlegen',
        reason: 'Governance ohne benannte Zuständigkeit ist nicht nachweisbar — das ist eine Rollenfrage, kein Modul.',
        urgency: dim.criticalityScore >= 60 ? 'soon' : 'eventual',
      });
    }
    if (dim.dimension === 'api_integration') {
      actions.push({
        label: 'Datenanbindung klären',
        reason: 'API- und Webhook-Zugriff hängt am Plan, nicht an einem zubuchbaren Modul.',
        urgency: 'eventual',
      });
    }
  }

  return actions;
}
