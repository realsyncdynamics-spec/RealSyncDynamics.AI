---
name: aios-compliance-verification
description: AI-OS Compliance Agent — Produkt-/Marketingaussage gegen Code und Belege prüfen (implementation-status.ts), DSGVO/AI-Act-Bezug strukturieren, Status empfehlen.
---

# Compliance Feature Verification

**Agent:** Compliance · **Routine:** `claims-evidence-check` (`.github/workflows/ai-os-claims-evidence.yml`)
**Rechte:** `github.contents.read`

## Eingaben
- `claim` (Pflicht): Feature-ID aus `src/product/implementation-status.ts` oder eine Landing-Aussage

## Ablauf
1. Eintrag in `implementation-status.ts` finden; Belege (`evidence`) öffnen.
2. Route in `src/App.tsx` und Backend-Aufruf (`functions.invoke` / `.from()` / `.rpc()`) nachweisen.
3. Tests unter `test/` suchen, die das Verhalten belegen.
4. Aussage gegen `npm run check:landing-claims` und die verbotenen Claims prüfen.
5. DSGVO/AI-Act-Bezug als Anforderung → Umsetzung → Beleg strukturieren (Hinweis, keine Rechtsberatung).

## Ausgaben
- `evidence`: Dateien, Tests, Routen — oder ausdrücklich „kein Beleg"
- `status`: Empfehlung live · preview · coming-soon mit Begründung

## Qualität
- Verboten: „vollständig revisionssicher", „autonome Agenten live", „EU-konform garantiert".
- Statusänderungen nur per PR in `implementation-status.ts`.
