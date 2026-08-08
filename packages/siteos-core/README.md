# @realsync/siteos-core

Framework- und laufzeitfreier Kern von RealSync SiteOS. Läuft unverändert in der
SPA (Browser), in Supabase Edge Functions (Deno) und in Vitest (Node).

Architekturbegründung: [`docs/SITEOS_ARCHITECTURE.md`](../../docs/SITEOS_ARCHITECTURE.md).

## Warum dieses Paket keine Abhängigkeiten hat

Der Kern berechnet die Hashes, auf denen jeder Nachweis beruht, und die Scores,
die in Kundenberichten stehen. Beides muss in allen drei Laufzeiten
bit-identisch sein. Jede Abhängigkeit wäre eine weitere Stelle, an der die
Laufzeiten auseinanderlaufen können. Einzige Voraussetzung ist `crypto.subtle`.

Relative Importe tragen deshalb explizite `.ts`-Endungen: Deno verlangt sie,
Vite und `tsc` (`allowImportingTsExtensions`) akzeptieren sie.

## Verwendung

```ts
import { buildSiteFromPrompt } from '@realsync/siteos-core';

const result = await buildSiteFromPrompt(
  'Erstelle eine Website für einen Zahnarzt in Hamburg.',
  { model: 'claude-opus-4', createdAt: new Date().toISOString() },
);

result.blueprint;        // vollständige Site-Beschreibung
result.blueprintSha256;  // kanonischer Hash — Anker im Evidence Vault
result.findings;         // Befunde mit Rechtsnorm und Behebungsschritt
result.scores;           // Health, Risk, Compliance, Performance, AI-Risk
result.tasks;            // Arbeitspakete für die asynchronen Agenten
```

Die Reihenfolge in `buildSiteFromPrompt` ist verbindlich: Brief → Blueprint →
Hash → Prüfung → Bewertung. Wer die Prüfung nach dem Hash einsetzt, erhält einen
Nachweis über eine ungeprüfte Struktur.

### Live-Analyse

```ts
import { analyzeObservation, computeScores } from '@realsync/siteos-core';

const findings = analyzeObservation(observation, {
  expectsAiDisclosure: true,
  expectedLang: 'de',
});
const scores = computeScores(findings);
```

### Behebung

```ts
import { analyzeBlueprint, applyRemediations } from '@realsync/siteos-core';

const { blueprint, applied, skipped, changed } = applyRemediations(
  current,
  analyzeBlueprint(current),
);
```

`skipped` enthält die Befunde, die eine menschliche Entscheidung verlangen —
mit Begründung. Ein automatisch erfundener Alternativtext wäre schlimmer als ein
offener Befund, weil er ihn verdeckt.

### Rendern

```ts
import { renderSite } from '@realsync/siteos-core';

const pages = renderSite(blueprint, { baseUrl: 'https://beispiel.de' });
// [{ path: '/', html: '<!doctype html>…' }, …]
```

Der Renderer ist gegen die Live-Analysatoren gebaut: sein Output erzeugt in
`analyzeObservation` **null Befunde**. Was der Blueprint zusagt, wird auch
ausgeliefert — `lang`, Titel, Canonical, genau eine `<h1>`, Footer-Links auf
Impressum/Datenschutz, `data-ai-disclosure`, Labels an jedem Eingabefeld und
Drittanbieter erst nach Einwilligung.

**Escaping ist die gesamte Sicherheitsgrenze.** Der Renderer baut Strings, kein
DOM. Jeder Wert läuft durch `escapeHtml` bzw. `safeUrl`; `javascript:`,
`data:` und protokollrelative Ziele werden verworfen statt escaped.

## Zusicherungen

Diese Eigenschaften sind durch 155 Tests abgesichert (`test/siteos/`) und dürfen
nicht ohne Versionsentscheidung gebrochen werden:

1. **Determinismus** — gleicher Brief ⇒ gleicher Blueprint ⇒ gleicher Hash.
   Nicht-deterministisch sind allein `origin.createdAt` und `origin.model`.
2. **Kanonisierung** — Schlüsselreihenfolge ohne Einfluss, Array-Reihenfolge
   bedeutungstragend, nicht darstellbare Zahlen werfen statt still zu verfälschen.
3. **Stabile Befund-Codes** — sie sind Fremdschlüssel in `governance_controls`
   und in Kundenberichten. Nie umbenennen.
4. **Modellunabhängiges Compliance-Gerüst** — `mergeBrief` lässt nur
   `name`, `summary`, `services`, `locality` zu.
5. **Nachvollziehbare Kennzahlen** — jeder Score ist eine reine Funktion von
   `RuntimeFinding[]`.

## Tests

```bash
npx vitest run test/siteos/
```
