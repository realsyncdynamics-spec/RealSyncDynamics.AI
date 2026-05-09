// Signal-Extraction-Layer — wandelt Free-Text-Beschreibungen eines KI-Systems
// in strukturierte Annex-III-Trigger-Matches um.
//
// Zwei Modi:
//   1. extractSignalsLocal()  — deterministisch, regex-basiert, immer
//      verfügbar. Sucht in der Beschreibung nach den 'triggers' jedes
//      Use-Cases aus der Registry.
//   2. extractSignalsLLM()   — optional, ruft eine Supabase Edge-Function
//      'ai-act-classify' auf die OpenAI/Anthropic Structured-Extraction
//      macht. Genauer für nuancierte Beschreibungen, braucht aber
//      OPENAI_API_KEY/ANTHROPIC_API_KEY in Supabase Vault.
//
// Beide Modi liefern dasselbe Output-Format — Frontend kann ohne
// Sonderbehandlung einen oder beide nutzen.

import { REGISTRY, type AnnexIIIUseCase } from './registry';

export interface SignalMatch {
  useCaseId: string;
  category: string;
  matchedTriggers: string[];   // welche Trigger-Strings haben getroffen
  confidence: 'low' | 'medium' | 'high';
}

export interface ExtractionResult {
  matches: SignalMatch[];
  suggestedCategories: string[];  // dedupliziert aus matches
  hint: string | null;             // ggf. Hinweis fuer User
  source: 'local' | 'llm';
}

/**
 * Lokale, deterministische Signal-Extraktion.
 *
 * Strategie: Lowercase-Vergleich von Description-Text gegen die `triggers`-
 * Felder jedes Use-Cases. Wenn ein Trigger als Substring vorkommt, gilt der
 * Use-Case als getroffen. Mehr getroffene Trigger = höhere Confidence.
 *
 * Sehr simpel — fängt Common-Cases (z.B. "wir machen CV-Screening") aber
 * verfehlt nuanciertere Formulierungen. Daher die LLM-Variante als
 * Upgrade-Path.
 */
export function extractSignalsLocal(text: string): ExtractionResult {
  if (!text || text.trim().length < 10) {
    return { matches: [], suggestedCategories: [], hint: 'Bitte mindestens 10 Zeichen beschreiben.', source: 'local' };
  }

  const lower = text.toLowerCase();
  const matches: SignalMatch[] = [];

  for (const uc of REGISTRY.use_cases) {
    const hit: string[] = [];
    for (const trig of uc.triggers) {
      // Trigger sind oft kurze deutsche Phrasen wie "CV-Screening mit ML-Ranking".
      // Wir matchen Substring-Vergleich auf Lower-Case.
      if (lower.includes(trig.toLowerCase())) {
        hit.push(trig);
        continue;
      }
      // Heuristik: matched auch wenn signifikante Teile des Triggers (>=2
      // wichtige Wörter) im Text sind.
      const trigWords = trig.toLowerCase()
        .split(/[\s\-/(),:.]+/)
        .filter((w) => w.length >= 4);
      const wordHits = trigWords.filter((w) => lower.includes(w)).length;
      if (trigWords.length >= 2 && wordHits >= 2) {
        hit.push(trig);
      }
    }

    if (hit.length === 0) continue;

    const confidence: SignalMatch['confidence'] =
      hit.length >= 3 ? 'high' : hit.length >= 2 ? 'medium' : 'low';

    matches.push({
      useCaseId: uc.id,
      category: uc.category,
      matchedTriggers: hit,
      confidence,
    });
  }

  // Sortieren nach Confidence + Anzahl Matches
  matches.sort((a, b) => {
    const cMap = { high: 3, medium: 2, low: 1 };
    return (cMap[b.confidence] - cMap[a.confidence]) || (b.matchedTriggers.length - a.matchedTriggers.length);
  });

  const suggestedCategories = [...new Set(matches.map((m) => m.category))];

  let hint: string | null = null;
  if (matches.length === 0) {
    hint = 'Keine eindeutigen Annex-III-Trigger gefunden. Wählen Sie die Kategorien manuell — oder beschreiben Sie genauer (Use-Case, betroffene Personengruppe, Entscheidungs-Art).';
  } else if (matches.every((m) => m.confidence === 'low')) {
    hint = 'Nur schwache Trigger gefunden — bitte auch manuelle Auswahl prüfen.';
  }

  return { matches, suggestedCategories, hint, source: 'local' };
}

/**
 * LLM-basierte Extraktion via Supabase Edge-Function.
 *
 * Erwartet eine Edge-Function `ai-act-classify` die einen System-Prompt
 * mit der Annex-III-Registry baut und OpenAI/Anthropic mit
 * Structured-Output (JSON-Schema) aufruft. Falls die Function nicht
 * deployed/konfiguriert ist, fällt der Aufruf auf extractSignalsLocal()
 * zurück.
 */
export async function extractSignalsLLM(text: string, supabaseUrl: string): Promise<ExtractionResult> {
  if (!text || text.trim().length < 10) {
    return extractSignalsLocal(text);
  }

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/ai-act-classify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ description: text, registry_version: REGISTRY.version }),
    });

    if (resp.status === 404) {
      // Function noch nicht deployed — graceful fallback
      const local = extractSignalsLocal(text);
      return { ...local, hint: (local.hint ?? '') + ' (LLM-Extraktion nicht verfügbar — lokaler Fallback)' };
    }

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      if (data?.error?.code === 'LLM_NOT_CONFIGURED') {
        const local = extractSignalsLocal(text);
        return { ...local, hint: (local.hint ?? '') + ' (LLM-Key fehlt in Vault — lokaler Fallback)' };
      }
      throw new Error(data?.error?.message ?? `HTTP ${resp.status}`);
    }

    const json = await resp.json();
    if (!json.matches) {
      // Unerwartetes Format — fallback
      return extractSignalsLocal(text);
    }

    const matches: SignalMatch[] = (json.matches as SignalMatch[]).filter((m) => {
      // Sanity check: useCaseId muss in Registry existieren
      return REGISTRY.use_cases.some((uc) => uc.id === m.useCaseId);
    });
    const suggestedCategories = [...new Set(matches.map((m) => m.category))];

    return {
      matches,
      suggestedCategories,
      hint: json.hint ?? null,
      source: 'llm',
    };
  } catch (e) {
    // Network/parse error — fallback
    const local = extractSignalsLocal(text);
    return { ...local, hint: (local.hint ?? '') + ` (LLM-Aufruf fehlgeschlagen: ${(e as Error).message})` };
  }
}

/**
 * Liefert die zugehörigen Use-Case-Objekte zu Matches.
 */
export function matchedUseCases(matches: SignalMatch[]): AnnexIIIUseCase[] {
  return matches
    .map((m) => REGISTRY.use_cases.find((uc) => uc.id === m.useCaseId))
    .filter(Boolean) as AnnexIIIUseCase[];
}
