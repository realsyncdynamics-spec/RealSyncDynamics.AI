import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * PROVIDER BOUNDARY CONTRACT — der Zaun um die Kostenkontrolle.
 *
 * Invariante (docs/architecture/ai-router-economics-rfc.md §3.3, I-2):
 *
 *   Kein AI-Provider-Request findet ausserhalb des zentralen
 *   Cost-Gate-/Reserve-/Settle-Pfades statt.
 *
 * Warum das ein Test ist und keine Konvention: Die erste Fassung des RFC
 * zaehlte drei Umgehungen. Eine Nachpruefung ueber die Provider-SDK-Importe
 * fand fuenf. Eine dritte Suche, diesmal zusaetzlich ueber die direkten
 * `fetch`-Aufrufe gegen Provider-Hosts, fand zehn. Die Zahl ist jedes Mal
 * gestiegen, weil niemand sie gegen den Baum nachgerechnet hat.
 *
 * Genau deshalb prueft dieser Test den Baum, nicht eine Liste:
 *
 *   1. Wer einen Provider direkt anspricht, muss in der kanonischen
 *      Provider-Schicht liegen — oder als dokumentierte Altlast eingetragen
 *      sein. Ein NEUER Pfad bricht CI.
 *   2. Wer einen Provider erreicht, muss auch das Cost-Gate erreichen.
 *   3. Ein fehlender Entitlement-Schluessel darf die Kostenkontrolle nie
 *      STILLSCHWEIGEND ueberspringen.
 *
 * Die Altlastenlisten unten sind der Ist-Zustand, damit der Test ab Tag eins
 * gruen ist. Sie duerfen nur schrumpfen. Jeder Eintrag, der verschwindet, ist
 * ein geschlossener Pfad; jeder Eintrag, der hinzukommt, ist ein bewusster,
 * im Diff sichtbarer Rueckschritt — und genau das soll er sein.
 *
 * Grenzen, damit niemand mehr erwartet als der Test leistet: er ist statisch.
 * Ein Provider-Call ueber eine zur Laufzeit zusammengesetzte URL entgeht ihm,
 * ebenso alles ausserhalb von `supabase/functions/` — etwa
 * `services/openclaw-agent/`, das eine eigene `cost-cap.js` mitbringt.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const FUNCTIONS_ROOT = resolve(__dirname, '..', '..', 'supabase', 'functions');

// ── Was als „einen Provider ansprechen" zaehlt ──────────────────────────────

/**
 * Ein Provider-SDK wird ueber den ENTPACKTEN Spezifizierer erkannt, nicht ueber
 * ein Prefix. Der Baum enthaelt heute vier Schreibweisen desselben SDK:
 * `npm:@anthropic-ai/sdk@0.32.1`, `npm:@google/genai@1.29.0`,
 * `npm:openai@4.77.0` und `https://esm.sh/@anthropic-ai/sdk@0.20.6`.
 *
 * Die esm.sh-Variante hat eine erste Fassung dieses Tests uebersehen — genau
 * die Sorte Luecke, gegen die er gedacht ist. Relative Pfade (`./openaiAdapter.ts`)
 * duerfen dabei NICHT treffen, sonst gilt jeder Importeur der Provider-Schicht
 * faelschlich als direkter Aufrufer.
 */
const PROVIDER_SDK_SPECIFIER =
  /^(?:npm:|jsr:|https?:\/\/(?:esm\.sh|cdn\.skypack\.dev|cdn\.jsdelivr\.net\/npm)\/)?(?:@anthropic-ai\/sdk|@google\/genai|@mistralai\/mistralai|openai|cohere-ai)(?:@[\d.^~-]+)?(?:\/.*)?$/;

/** Bekannte Cloud-Provider-Hosts. LM Studio/Ollama laufen ueber konfigurierte
 *  Base-URLs und sind hier bewusst nicht gelistet — sie kosten pro Call nichts. */
const PROVIDER_HOST = /https:\/\/(?:api\.anthropic\.com|api\.openai\.com|api\.x\.ai|generativelanguage\.googleapis\.com)/;

/** Alle `from '<spec>'`-Spezifizierer einer Datei. */
function specifiersOf(source: string): string[] {
  return [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

/**
 * Die kanonische Provider-Schicht. NUR hier darf ein Provider direkt
 * angesprochen werden. Wer diese Liste erweitert, verschiebt die
 * Architekturgrenze — das ist eine Entscheidung, kein Nebeneffekt.
 */
const PROVIDER_LAYER = new Set([
  '_shared/providers.ts',
  '_shared/aiGateway/anthropicAdapter.ts',
  '_shared/aiGateway/openaiAdapter.ts',
]);

/**
 * Kein Provider-Aufruf, sondern eine Erkennungstabelle: `detectors.ts` sucht
 * diese Hosts im HTML fremder Websites, um zu melden, welche AI-Dienste eine
 * gescannte Seite einbindet. Die Zeichenketten sehen aus wie ein Call, sind
 * aber das Gegenteil davon.
 */
const NOT_A_PROVIDER_CALL = new Set([
  '_shared/public-scan/detectors.ts',
]);

// ── Was als „das Cost-Gate erreichen" zaehlt ────────────────────────────────

/**
 * Erreicht ueber einen IMPORT des Gates oder einen Aufruf seiner Symbole.
 *
 * Bewusst nicht ueber die blosse Erwaehnung des Pfades: `governance-router`
 * enthaelt den Kommentar „Fail-open analog zu _shared/ai.ts" und galt in einer
 * ersten Fassung dieses Tests deshalb faelschlich als abgesichert.
 */
const COST_GATE_IMPORT = /from\s+['"][^'"]*_shared\/(?:cost-cap|cost-writer|ai)\.ts['"]/;
const COST_GATE_SYMBOL = /\b(?:reserveLlmBudget|settleLlmBudget|writeLlmCost|runAiTool)\b/;
const hitsCostGate = (source: string): boolean =>
  COST_GATE_IMPORT.test(source) || COST_GATE_SYMBOL.test(source);

// ── Altlasten (Ist-Zustand). Duerfen nur schrumpfen. ────────────────────────

/** Spricht einen Provider an, liegt aber nicht in der Provider-Schicht. */
const BYPASSES_PROVIDER_LAYER: Record<string, string> = {
  'governance-agent/index.ts':
    'RFC Pfad 4 — eigene Preisrechnung aus MODEL_PRICING statt ai_model_prices.',
  'optimize-analyze/index.ts':
    'RFC Pfad 5 — Anthropic direkt, tenantId liegt in derselben Funktion vor.',
  'ai-act-classify/index.ts':
    'fetch gegen OpenAI und Anthropic, ohne Provider-Schicht.',
  'legal-embed/index.ts':
    'OpenAI-Embeddings direkt. Guenstig, aber nicht kostenlos.',
  'legal-retrieve/index.ts':
    'OpenAI-Embeddings direkt, wie legal-embed.',
  'website-maintenance-agent/index.ts':
    'Anthropic direkt.',
  'website-operations-agent/index.ts':
    'Anthropic direkt.',
};

/** Erreicht einen Provider, aber nicht das Cost-Gate. */
const BYPASSES_COST_GATE: Record<string, string> = {
  ...BYPASSES_PROVIDER_LAYER,
  'market-scanner/index.ts':
    'Geht korrekt ueber callProvider aus der Provider-Schicht — aber ohne '
    + 'Reserve/Settle. Der Beleg dafuer, dass die richtige Schicht allein '
    + 'nicht genuegt: Cost-Gate ist eine zweite, eigene Zusicherung.',
  'ai-gateway/index.ts':
    'RFC Pfad 2 — tenant-los (index.ts: tenant_id: null). In config.toml als offene Luecke notiert.',
  'governance-router/index.ts':
    'RFC Pfad 3 — schreibt cost_usd: 0 in ai_tool_runs.',
};

/**
 * Stellen, die einen fehlenden Entitlement-Schluessel als „kein Limit" lesen.
 *
 * `typeof x === 'number'` ist bei einem fehlenden Schluessel `false` — die
 * Pruefung wird uebersprungen statt abzulehnen. `usage.ts` dokumentiert die
 * Semantik ausdruecklich: „-1 = unlimited, 0 / missing = no quota."
 *
 * Das ist die Fail-Open-Semantik, durch die `starter` heute ohne
 * AI-Kostenschluessel auf den 250-USD-Default faellt (RFC Befund B). Der
 * Wechsel auf Fail-Closed ist ein eigener, riskanter Schritt (RFC S5) — bis
 * dahin haelt dieser Test wenigstens fest, dass das Ueberspringen NICHT
 * STILLSCHWEIGEND passiert: jede Stelle steht hier, neue brechen CI.
 */
const FAIL_OPEN_LIMIT_CHECKS: Record<string, string> = {
  '_shared/ai.ts': 'callLimit und tokenLimit — die AI-Hauptpipeline.',
  '_shared/usage.ts': 'planLimit in consumeUsage, die kanonische Quota-Pruefung.',
  'automation-trigger/index.ts': 'runsLimit.',
  'workflow-trigger/index.ts': 'runsLimit.',
};

const FAIL_OPEN_PATTERN = /typeof\s+\w*[Ll]imit\s*===\s*'number'|planLimit\s*!==\s*null/;

// ── Baum einlesen ──────────────────────────────────────────────────────────

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (entry.endsWith('.ts')) acc.push(full);
  }
  return acc;
}

const FILES = walk(FUNCTIONS_ROOT).map((full) => ({
  rel: relative(FUNCTIONS_ROOT, full).split('\\').join('/'),
  source: readFileSync(full, 'utf8'),
}));

const byRel = new Map(FILES.map((f) => [f.rel, f.source]));

/** Spricht diese Datei selbst einen Provider an? */
function callsProviderDirectly(rel: string): boolean {
  if (NOT_A_PROVIDER_CALL.has(rel)) return false;
  const source = byRel.get(rel) ?? '';
  return specifiersOf(source).some((spec) => PROVIDER_SDK_SPECIFIER.test(spec))
    || PROVIDER_HOST.test(source);
}

/** Relative Importe einer Datei, aufgeloest auf Pfade unterhalb von functions/. */
function importsOf(rel: string): string[] {
  const source = byRel.get(rel) ?? '';
  const out: string[] = [];
  for (const m of source.matchAll(/from\s+['"](\.[^'"]+\.ts)['"]/g)) {
    const resolved = relative(FUNCTIONS_ROOT, resolve(FUNCTIONS_ROOT, dirname(rel), m[1]))
      .split('\\')
      .join('/');
    if (byRel.has(resolved)) out.push(resolved);
  }
  return out;
}

/** Erreicht die Datei transitiv einen Provider? */
function reachesProvider(rel: string): boolean {
  const seen = new Set<string>();
  const queue = [rel];
  while (queue.length) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    if (callsProviderDirectly(current)) return true;
    queue.push(...importsOf(current));
  }
  return false;
}

/** Erreicht die Datei transitiv das Cost-Gate? */
function reachesCostGate(rel: string): boolean {
  const seen = new Set<string>();
  const queue = [rel];
  while (queue.length) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    if (hitsCostGate(byRel.get(current) ?? '')) return true;
    queue.push(...importsOf(current));
  }
  return false;
}

/** Einstiegspunkte: `<function>/index.ts`, nicht `_shared`. */
const ENTRYPOINTS = FILES
  .map((f) => f.rel)
  .filter((rel) => rel.endsWith('/index.ts') && !rel.startsWith('_shared/'))
  .sort();

// ── 1. Kein Provider-Aufruf ausserhalb der Provider-Schicht ────────────────

describe('Provider-Aufrufe liegen in der kanonischen Provider-Schicht', () => {
  it('kein neuer direkter Provider-Aufruf ausserhalb von Schicht und Altlasten', () => {
    const offenders = FILES
      .map((f) => f.rel)
      .filter(callsProviderDirectly)
      .filter((rel) => !PROVIDER_LAYER.has(rel))
      .filter((rel) => !(rel in BYPASSES_PROVIDER_LAYER))
      .sort();

    expect(
      offenders,
      `Diese Dateien sprechen einen AI-Provider direkt an, ohne in der ` +
        `Provider-Schicht zu liegen:\n  ${offenders.join('\n  ')}\n\n` +
        `Richtig ist der Weg ueber _shared/providers.ts — dort haengen ` +
        `Tenant, Policy, Quota und Cost-Reserve dran. Wenn das hier eine ` +
        `bewusste Ausnahme ist, gehoert sie mit Begruendung nach ` +
        `BYPASSES_PROVIDER_LAYER und damit in den Review.`,
    ).toEqual([]);
  });

  it('die Provider-Schicht spricht Provider auch tatsaechlich an', () => {
    // Haelt die Allowlist ehrlich: ein Eintrag, der keinen Provider mehr
    // anspricht, ist eine unnoetig offene Tuer.
    for (const rel of PROVIDER_LAYER) {
      expect(byRel.has(rel), `${rel} steht in PROVIDER_LAYER, existiert aber nicht`).toBe(true);
      expect(callsProviderDirectly(rel), `${rel} braucht die Ausnahme nicht mehr`).toBe(true);
    }
  });
});

// ── 2. Wer einen Provider erreicht, erreicht auch das Cost-Gate ────────────

describe('Provider-Erreichbarkeit impliziert Cost-Gate-Erreichbarkeit', () => {
  it('keine neue Edge Function ruft einen Provider ohne Cost-Gate', () => {
    const offenders = ENTRYPOINTS
      .filter(reachesProvider)
      .filter((rel) => !reachesCostGate(rel))
      .filter((rel) => !(rel in BYPASSES_COST_GATE))
      .sort();

    expect(
      offenders,
      `Diese Edge Functions erreichen einen AI-Provider, aber kein ` +
        `Cost-Gate:\n  ${offenders.join('\n  ')}\n\n` +
        `Jeder Provider-Request muss vor Ausfuehrung einem Tenant, einer ` +
        `Policy und einem Kostenbudget zugeordnet sein (RFC I-2). Ohne ` +
        `reserveLlmBudget laeuft der Call gegen kein Budget.`,
    ).toEqual([]);
  });
});

// ── 3. Fehlender Schluessel ueberspringt die Kontrolle nie stillschweigend ──

describe('Fehlende Entitlement-Schluessel sind nie eine stille Freigabe', () => {
  it('keine neue Fail-Open-Limitpruefung', () => {
    const offenders = FILES
      .filter((f) => FAIL_OPEN_PATTERN.test(f.source))
      .map((f) => f.rel)
      .filter((rel) => !(rel in FAIL_OPEN_LIMIT_CHECKS))
      .sort();

    expect(
      offenders,
      `Diese Dateien lesen ein fehlendes Limit als „kein Limit":\n  ` +
        `${offenders.join('\n  ')}\n\n` +
        `Bei fehlendem Schluessel ist \`typeof x === 'number'\` false — die ` +
        `Pruefung wird uebersprungen statt abzulehnen. Genau so faellt ` +
        `\`starter\` heute auf den 250-USD-Default. Der Schluessel gehoert ` +
        `nach shared/pricing.ts, nicht die Pruefung uebersprungen.`,
    ).toEqual([]);
  });

  it('die dokumentierten Fail-Open-Stellen existieren noch', () => {
    // Verhindert, dass die Liste Eintraege behaelt, die laengst weg sind —
    // sonst sieht der Zaun groesser aus, als er ist.
    for (const rel of Object.keys(FAIL_OPEN_LIMIT_CHECKS)) {
      expect(byRel.has(rel), `${rel} steht in der Liste, existiert aber nicht`).toBe(true);
      expect(
        FAIL_OPEN_PATTERN.test(byRel.get(rel)!),
        `${rel} ist nicht mehr fail-open — Eintrag streichen`,
      ).toBe(true);
    }
  });
});

// ── 4. Die Altlastenlisten duerfen nur schrumpfen ──────────────────────────

describe('Altlasten schrumpfen, sie wachsen nicht', () => {
  it('jede eingetragene Altlast existiert noch', () => {
    for (const rel of Object.keys(BYPASSES_COST_GATE)) {
      expect(byRel.has(rel), `${rel} steht als Altlast drin, existiert aber nicht`).toBe(true);
    }
  });

  it('die Zahl der Altlasten ist festgenagelt', () => {
    // Eine Zahl, die im Diff auffaellt. Sie zu erhoehen ist erlaubt — aber
    // niemand tut es aus Versehen, und niemand tut es unbemerkt.
    expect(Object.keys(BYPASSES_PROVIDER_LAYER)).toHaveLength(7);
    expect(Object.keys(BYPASSES_COST_GATE)).toHaveLength(10);
    expect(Object.keys(FAIL_OPEN_LIMIT_CHECKS)).toHaveLength(4);
  });
});
