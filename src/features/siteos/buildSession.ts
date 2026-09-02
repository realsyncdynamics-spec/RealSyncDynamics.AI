// Anonyme Build-Sitzung — Client-Seite.
//
// Die neue Reihenfolge des Produkts ist: Idee → Bau → vollständige Vorschau
// → Konto → Übernahme. Der Account steht damit nicht mehr vor dem Ergebnis,
// sondern hinter dem Besitz daran.
//
// ## Wo der Entwurf liegt — und warum das entscheidend ist
//
// **Auf dem Server** (`siteos_anonymous_builds`). Eine frühere Fassung hielt
// ihn im Browser und spielte die Anweisungsfolge beim Übernehmen
// serverseitig nach. Deterministisch — aber der Blueprint wurde beim Claim
// **neu erzeugt**. Ändert sich `packages/siteos-core` zwischen Vorschau und
// Anmeldung, bekommt der Kunde etwas anderes als das, was er gesehen hat,
// und niemand merkt es: Beide Ergebnisse sind für sich „richtig".
//
// Jetzt hält der Server den Entwurf, und der Claim **verschiebt** ihn.
// Deshalb speichert diese Datei auch keinen Blueprint mehr, sondern nur die
// Sitzungskennung — der angezeigte Stand wird gelesen, nicht rekonstruiert.
//
// ## Der Rückfall, und warum er benannt ist
//
// Die Endpunkte des anonymen Pfads sind noch nicht ausgerollt. Bis dahin
// baut der Kern im Browser weiter, damit `/build` überhaupt etwas zeigt —
// aber dieser Zustand kann **nicht übernommen werden**, weil es serverseitig
// keine Sitzung gibt. Das steht in `mode` und wird in der Oberfläche gesagt,
// statt beim Klick auf „Übernehmen" als Fehler aufzutauchen.
//
// Der Rückfall ist Übergang, nicht Architektur: Sobald der Router deployt
// ist, greift er nicht mehr, und er gehört dann entfernt.

import {
  buildSiteFromPrompt,
  refineBlueprint,
  type RefinementChange,
  type RuntimeFinding,
  type ScoreBreakdown,
  type SiteBlueprint,
} from '../../../packages/siteos-core/src/index';
import {
  buildAnon,
  errorMessage,
  getAnonSession,
  refineAnon,
  type PreviewState,
  type SiteOsError,
} from './siteOsApi';

const STORAGE_KEY = 'rsd.siteos.build-session.v2';

/**
 * `server` — Entwurf liegt serverseitig, übernehmbar.
 * `local`  — Rückfall ohne ausgerollten Endpunkt: sichtbar, nicht übernehmbar.
 */
export type BuildMode = 'server' | 'local';

export interface BuildStep {
  instruction: string;
  changes: RefinementChange[];
  refusals: string[];
  understood: boolean;
  at: string;
}

/** Was der Browser behält. Bewusst wenig: die Wahrheit steht auf dem Server. */
export interface StoredSession {
  id: string;
  mode: BuildMode;
  /** Nur für den Rückfall nötig — dort gibt es keinen Server, der baut. */
  prompt: string;
  brand: string | null;
  createdAt: string;
}

/** Der Stand, den die Oberfläche anzeigt. */
export interface BuildState {
  session: StoredSession;
  blueprint: SiteBlueprint;
  findings: RuntimeFinding[];
  scores: ScoreBreakdown;
  version: number;
  contentSha256: string;
  expiresAt: string | null;
  claimed: boolean;
  /**
   * Die teilbare Vorschau — oder der Grund, warum es keine gibt.
   *
   * Sie ist bewusst kein Teil des Entwurfs, sondern eine Aussage über ihn:
   * Der Rahmen auf `/build` rendert weiterhin aus dem Blueprint. Fällt die
   * Ablage aus, fehlt der Link, nicht die Vorschau.
   */
  preview: PreviewState;
}

export interface RefineResult {
  state: BuildState;
  step: BuildStep;
}

// ─────────────────────────────────────────────────────────────────────
// Bauen
// ─────────────────────────────────────────────────────────────────────

export async function startBuild(prompt: string, brand: string | null): Promise<BuildState> {
  const trimmedPrompt = prompt.trim();
  const trimmedBrand = brand?.trim() ?? '';
  const enrichment = trimmedBrand === '' ? undefined : { name: trimmedBrand };

  const result = await buildAnon({ prompt: trimmedPrompt, locale: 'de', enrichment });

  if (result.kind === 'ok') {
    const session: StoredSession = {
      id: result.data.session_id,
      mode: 'server',
      prompt: trimmedPrompt,
      brand: trimmedBrand === '' ? null : trimmedBrand,
      createdAt: new Date().toISOString(),
    };
    save(session);
    return {
      session,
      blueprint: result.data.blueprint,
      findings: result.data.findings,
      scores: result.data.scores,
      version: result.data.version,
      contentSha256: result.data.content_sha256,
      expiresAt: result.data.expires_at,
      claimed: false,
      preview: result.data.preview ?? { status: 'none' },
    };
  }

  if (result.kind !== 'not_deployed') throw new Error(errorMessage(result));
  return await buildLocally(trimmedPrompt, trimmedBrand === '' ? null : trimmedBrand);
}

/**
 * Rückfall ohne Server. Erzeugt dieselbe Site mit demselben Kern — nur ohne
 * Sitzung, und damit ohne die Möglichkeit, sie zu übernehmen.
 */
async function buildLocally(prompt: string, brand: string | null): Promise<BuildState> {
  const built = await buildSiteFromPrompt(prompt, {
    locale: 'de',
    enrichment: brand ? { name: brand } : undefined,
    // Kein Modell beteiligt — ein Modellname, der nie gerufen wurde, wäre
    // eine falsche Angabe im Herkunftsnachweis (Art. 50 EU AI Act).
    model: null,
  });

  const session: StoredSession = {
    id: localId(),
    mode: 'local',
    prompt,
    brand,
    createdAt: new Date().toISOString(),
  };
  save(session);

  return {
    session,
    blueprint: built.blueprint,
    findings: built.findings,
    scores: built.scores,
    version: 1,
    contentSha256: built.blueprintSha256,
    expiresAt: null,
    claimed: false,
    // Ohne Sitzung gibt es auch keine geteilte Vorschau: Es liegt nichts,
    // worauf eine Adresse zeigen könnte.
    preview: { status: 'none' },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Verfeinern
// ─────────────────────────────────────────────────────────────────────

export async function applyInstruction(state: BuildState, instruction: string): Promise<RefineResult> {
  const trimmed = instruction.trim();

  if (state.session.mode === 'server') {
    const result = await refineAnon({ session_id: state.session.id, instruction: trimmed });
    if (result.kind !== 'ok') throw new Error(errorMessage(result));

    return {
      state: {
        ...state,
        blueprint: result.data.blueprint,
        findings: result.data.findings,
        scores: result.data.scores,
        version: result.data.version,
        contentSha256: result.data.content_sha256 ?? state.contentSha256,
        preview: result.data.preview ?? state.preview,
      },
      step: {
        instruction: trimmed,
        changes: result.data.changes,
        refusals: result.data.refusals,
        understood: result.data.understood,
        at: new Date().toISOString(),
      },
    };
  }

  // Rückfall: dieselbe Verfeinerung, nur im Browser.
  const step = refineBlueprint(state.blueprint, trimmed);
  const { analyzeBlueprint, canonicalHash, computeScores } = await import(
    '../../../packages/siteos-core/src/index'
  );
  const findings = step.changes.length > 0 ? analyzeBlueprint(step.blueprint) : state.findings;

  return {
    state: {
      ...state,
      blueprint: step.blueprint,
      findings,
      scores: step.changes.length > 0 ? computeScores(findings) : state.scores,
      version: step.changes.length > 0 ? state.version + 1 : state.version,
      contentSha256: step.changes.length > 0 ? await canonicalHash(step.blueprint) : state.contentSha256,
    },
    step: {
      instruction: trimmed,
      changes: step.changes,
      refusals: step.refusals,
      understood: step.understood,
      at: new Date().toISOString(),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Wiederaufnahme
// ─────────────────────────────────────────────────────────────────────

/**
 * Nimmt eine gespeicherte Sitzung wieder auf.
 *
 * Im Servermodus wird der Stand **gelesen**, nicht rekonstruiert: Was die
 * Vorschau zeigt, ist damit dasselbe, was der Claim überträgt.
 *
 * `null` heisst: keine brauchbare Sitzung — abgelaufen, unbekannt oder gar
 * nicht vorhanden. Der Aufrufer beginnt dann von vorn.
 */
export async function resumeBuild(): Promise<BuildState | null> {
  const stored = load();
  if (!stored) return null;

  if (stored.mode === 'server') {
    const result = await getAnonSession({ session_id: stored.id });
    if (result.kind === 'ok') {
      return {
        session: stored,
        blueprint: result.data.blueprint,
        findings: result.data.findings,
        scores: result.data.scores,
        version: result.data.version,
        contentSha256: result.data.content_sha256,
        expiresAt: result.data.expires_at,
        claimed: result.data.claimed,
        preview: result.data.preview ?? { status: 'none' },
      };
    }
    // Abgelaufen oder unbekannt: die lokale Kennung ist wertlos geworden.
    //
    // `gone` gehört ausdrücklich dazu. Ohne diesen Fall bliebe die Kennung
    // einer abgelaufenen Sitzung für immer im Browser stehen, und jede
    // Wiederaufnahme fragte den Server erneut nach einem Entwurf, den es
    // nicht mehr gibt.
    if (result.kind === 'not_found' || result.kind === 'gone' || result.kind === 'error') clear();
    if (result.kind !== 'not_deployed') return null;
    // Endpunkt (noch) nicht da — der Prompt liegt vor, also lokal aufbauen.
  }

  try {
    return await buildLocally(stored.prompt, stored.brand);
  } catch {
    clear();
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Persistenz
// ─────────────────────────────────────────────────────────────────────
//
// Jeder Zugriff ist gekapselt: `localStorage` wirft in privaten Fenstern und
// bei blockierten Website-Daten. Eine Vorschau darf daran nicht scheitern.

export function load(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof parsed?.id !== 'string' || typeof parsed?.prompt !== 'string') return null;
    return {
      id: parsed.id,
      mode: parsed.mode === 'server' ? 'server' : 'local',
      prompt: parsed.prompt,
      brand: typeof parsed.brand === 'string' && parsed.brand.trim() !== '' ? parsed.brand : null,
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function save(session: StoredSession): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Kein Gedächtnis ist kein Fehlerfall der Vorschau.
  }
}

export function clear(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // s. o.
  }
}

/** Fehlerlage in Worte fassen — einmal, statt in jeder Oberfläche neu. */
export function describeSessionError(e: SiteOsError): string {
  return errorMessage(e);
}

function localId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `local-${uuid}`;

  // Kein `Math.random()`. Diese Kennung benennt zwar nur einen Entwurf im
  // eigenen Browser, der ohnehin nicht übernehmbar ist — aber eine schwache
  // Zufallsquelle in einer Kennung ist ein Muster, das man nicht stehen
  // lässt, und CodeQL meldet es zu Recht als Befund.
  //
  // `getRandomValues` ist der richtige Rückfall: Es gibt die Funktion auch
  // dort, wo `randomUUID` fehlt — etwa im unsicheren Kontext (http). Fehlt
  // auch sie, bleiben die Bytes null und es trägt allein die Zeit; das
  // genügt, weil in einem Browser genau eine Sitzung liegt.
  const bytes = new Uint8Array(8);
  globalThis.crypto?.getRandomValues?.(bytes);
  const suffix = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `local-${Date.now().toString(36)}-${suffix}`;
}
