// Anonyme Build-Sitzung.
//
// Die neue Reihenfolge des Produkts ist: Idee → Bau → vollständige Vorschau
// → Konto → Übernahme. Der Account steht damit nicht mehr vor dem Ergebnis,
// sondern hinter dem Besitz daran. Damit dabei nichts verlorengeht, muss der
// Entwurf **vor** jeder Anmeldung irgendwo liegen.
//
// ## Warum das im Browser liegt und nicht in der Datenbank
//
// Ein anonymer Entwurf in der Datenbank hieße: eine Tabelle, die ohne
// Anmeldung beschreibbar ist. Genau das ist die Sorte Fläche, die die
// Plattform anderswo mit RLS ausschließt — und sie käme mit Rate-Limit,
// Aufbewahrungsfrist und Löschpflicht für Daten, die noch niemandem
// zugeordnet sind.
//
// Der Entwurf ist stattdessen vollständig durch **Prompt + Anweisungsfolge**
// beschrieben. Beides ist kurz, enthält keine personenbezogenen Daten und
// erzeugt über `packages/siteos-core` immer wieder denselben Blueprint. Damit
// reicht der lokale Speicher, und beim Übernehmen wird nicht der Blueprint
// übertragen, sondern die Folge, aus der er entsteht (siehe
// `supabase/functions/siteos/handlers/builder.ts`).
//
// Folge, die man kennen muss: Ein Entwurf überlebt keinen Gerätewechsel und
// keinen privaten Modus. Das ist der Preis dafür, vor der Anmeldung nichts
// über den Besucher zu speichern — und er wird in der Oberfläche benannt,
// nicht verschwiegen.

import {
  buildSiteFromPrompt,
  refineBlueprint,
  type RefinementChange,
  type RuntimeFinding,
  type ScoreBreakdown,
  type SiteBlueprint,
} from '../../../packages/siteos-core/src/index';

const STORAGE_KEY = 'rsd.siteos.build-session.v1';
const MAX_REFINEMENTS = 40;

/** Ein Schritt der Sitzung — Anweisung samt dem, was daraus folgte. */
export interface BuildStep {
  instruction: string;
  changes: RefinementChange[];
  refusals: string[];
  understood: boolean;
  at: string;
}

/**
 * Der gespeicherte Zustand. Bewusst ohne Blueprint: Er wird aus `prompt` und
 * `steps` neu erzeugt. Ein mitgespeicherter Blueprint wäre eine zweite
 * Wahrheit, die nach dem nächsten Kernupdate von der ersten abweicht.
 */
export interface BuildSession {
  id: string;
  prompt: string;
  /**
   * Firmenname, falls genannt. Getrennt vom Prompt geführt, weil er als
   * Anreicherung in den Brief geht (`mergeBrief`) und dort — anders als der
   * Prompt — keine Branchen- oder Compliance-Wirkung hat.
   */
  brand: string | null;
  steps: BuildStep[];
  createdAt: string;
  updatedAt: string;
}

/** Das Ergebnis eines Laufs — alles, was die Oberfläche anzeigt. */
export interface BuildOutcome {
  session: BuildSession;
  blueprint: SiteBlueprint;
  blueprintSha256: string;
  findings: RuntimeFinding[];
  scores: ScoreBreakdown;
}

export function newBuildSession(prompt: string, brand: string | null = null): BuildSession {
  const now = new Date().toISOString();
  const trimmed = brand?.trim() ?? '';
  return {
    id: sessionId(),
    prompt: prompt.trim(),
    brand: trimmed === '' ? null : trimmed,
    steps: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Baut die Site aus Prompt und Anweisungsfolge — vollständig im Browser,
 * ohne Netzzugriff. Deshalb funktioniert die Vorschau auch dann, wenn kein
 * Modell erreichbar ist; sie ist nicht die Zugabe zum Modell, sondern der
 * belastbare Kern.
 */
export async function runBuildSession(session: BuildSession): Promise<BuildOutcome> {
  const built = await buildSiteFromPrompt(session.prompt, {
    locale: 'de',
    enrichment: session.brand ? { name: session.brand } : undefined,
    // Kein Modell beteiligt: `origin.model` bleibt `null`. Ein Modellname,
    // der nie gerufen wurde, wäre eine falsche Angabe im Herkunftsnachweis
    // (Art. 50 EU AI Act).
    model: null,
  });

  let blueprint = built.blueprint;
  for (const step of session.steps) {
    blueprint = refineBlueprint(blueprint, step.instruction).blueprint;
  }

  if (session.steps.length === 0) {
    return {
      session,
      blueprint,
      blueprintSha256: built.blueprintSha256,
      findings: built.findings,
      scores: built.scores,
    };
  }

  // Nach Verfeinerungen müssen Hash, Befunde und Bewertung neu entstehen —
  // dieselbe Regel wie im Backend.
  const { analyzeBlueprint, canonicalHash, computeScores } = await import(
    '../../../packages/siteos-core/src/index'
  );
  const findings = analyzeBlueprint(blueprint);

  return {
    session,
    blueprint,
    blueprintSha256: await canonicalHash(blueprint),
    findings,
    scores: computeScores(findings),
  };
}

/**
 * Wendet eine Anweisung an und schreibt sie fort. Auch eine nicht
 * verstandene Anweisung wird protokolliert — der Verlauf soll zeigen, was
 * der Kunde versucht hat, nicht nur, was geklappt hat.
 */
export function appendInstruction(
  session: BuildSession,
  instruction: string,
  blueprint: SiteBlueprint,
): { session: BuildSession; step: BuildStep } {
  const trimmed = instruction.trim();
  const result = refineBlueprint(blueprint, trimmed);
  const step: BuildStep = {
    instruction: trimmed,
    changes: result.changes,
    refusals: result.refusals,
    understood: result.understood,
    at: new Date().toISOString(),
  };

  // Nur wirksame Schritte gehen in die Folge ein, die später nachgespielt
  // wird. Eine Anweisung ohne Wirkung dort mitzuführen, verlängerte den
  // Nachbau ohne Ergebnis.
  const steps = result.changes.length > 0 ? [...session.steps, step].slice(-MAX_REFINEMENTS) : session.steps;

  return {
    session: { ...session, steps, updatedAt: new Date().toISOString() },
    step,
  };
}

/** Anweisungsfolge für die serverseitige Übernahme. */
export function refinementList(session: BuildSession): string[] {
  return session.steps.map((step) => step.instruction);
}

// ─────────────────────────────────────────────────────────────────────
// Persistenz
// ─────────────────────────────────────────────────────────────────────
//
// Jeder Zugriff ist gekapselt: `localStorage` wirft in privaten Fenstern und
// bei blockierten Website-Daten. Eine Vorschau darf daran nicht scheitern —
// sie läuft dann eben ohne Gedächtnis weiter.

export function loadBuildSession(): BuildSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BuildSession>;
    if (typeof parsed?.prompt !== 'string' || parsed.prompt.trim() === '') return null;
    return {
      id: typeof parsed.id === 'string' ? parsed.id : sessionId(),
      prompt: parsed.prompt,
      brand: typeof parsed.brand === 'string' && parsed.brand.trim() !== '' ? parsed.brand : null,
      steps: Array.isArray(parsed.steps) ? (parsed.steps as BuildStep[]) : [],
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveBuildSession(session: BuildSession): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Kein Gedächtnis ist kein Fehlerfall der Vorschau.
  }
}

export function clearBuildSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // s. o.
  }
}

function sessionId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  // Fallback für ältere Umgebungen. Die ID ist eine Sitzungskennung, kein
  // Sicherheitsmerkmal — sie schützt nichts und wird nicht geprüft.
  return `bs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
