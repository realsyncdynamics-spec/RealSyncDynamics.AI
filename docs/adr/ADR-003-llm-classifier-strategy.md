# ADR-003: LLM-Klassifikator-Strategie

- **Status:** Draft
- **Date:** 2026-05-18
- **Author:** Dominik Steiner
- **Scope:** ai-risk-agent — Modell-Wahl, Klassifikator-Architektur, Eval-Kalibrierung
- **Related:** [`ADR-001-event-backbone.md`](./ADR-001-event-backbone.md) · [`ADR-002-evidence-chain-inference-region.md`](./ADR-002-evidence-chain-inference-region.md) · `supabase/functions/ai-risk/classifier.ts` · `docs/qa/ai-risk-eval.md`

---

## 1. Context

Heute (Stand 2026-05-18) klassifiziert der `ai-risk-agent` mit
Anthropic Haiku 4.5 (`claude-haiku-4-5-20251001`) via Messages API
mit Tool-Use-Erzwingung. Prompt v1 enumeriert alle acht
Art. 5(1)-Verbots-Tatbestände und alle acht Annex-III-Kategorien. Eval
gegen 30 Goldset-Cases (10 minimal / 10 limited / 8 high / 2 prohibited)
liegt im Repo, Baseline noch nicht gemessen.

Vier mögliche Strategie-Wechsel-Pfade existieren als Optionen:

| Pfad | Was | Wann |
|---|---|---|
| **A. Status quo:** Anthropic Haiku 4.5, Prompt-only | — | Bis Baseline-Schwellen nicht reproduzierbar gehalten werden |
| **B. Modell-Upgrade:** Sonnet 4.6 / Opus 4.7 | Größeres Modell, höhere Genauigkeit, ~5–20× Kosten | F1(prohibited) oder F1(high) reproduzierbar < Schwelle |
| **C. Hybrid Rule-Based + LLM:** Deterministische Rules für eindeutige Annex-III/Art-5-Trigger, LLM nur für ambiguous cases | Reduziert Token-Cost und Latency, sortiert Quelle von Mis-Klassifikation klarer (Rule vs Modell) | Latency p95 > 3.5s sustained ODER 70%+ der Cases sind objektiv per Rule entscheidbar |
| **D. Fine-Tuning:** Eigenes Modell auf Goldset + ergänzten Cases | Maximale Kontrolle, aber benötigt n ≥ 500 Trainings-Cases | Nicht vor 200+ Kunden-Cases im Goldset |
| **E. Local Ollama qwen3:4b:** EU-On-Prem-Inferenz | Datenresidenz-Garantie ohne Cloud-Provider | EU-Only-Klausel + Kosten-Druck |

## 2. Decision

**Draft** — keine Entscheidung vor erstem stabilen Baseline-Run.

Dieser ADR existiert als Slot. Bei Trigger-Hit (siehe §3) wird hier die
konkrete Strategie-Wahl festgehalten, mit Begründung gegen die anderen
Pfade.

## 3. Triggers (wann diese ADR aktiviert wird)

Aktivierung wenn **einer** der folgenden Befunde aus mindestens
**drei aufeinanderfolgenden** Eval-Runs reproduziert wird:

| Befund | Implikation | Wahrscheinlicher Pfad |
|---|---|---|
| F1(prohibited) reproduzierbar < 0.90 nach Goldset-Erweiterung auf 5+ prohibited-Cases | Modell erkennt Art. 5 nicht zuverlässig | Pfad B oder C |
| F1(high) reproduzierbar < 0.85 trotz Annex-III-Subkategorien-Coverage im Goldset | Modell verwechselt high/limited | Pfad B oder C |
| Accuracy > 0.95 mit erkennbar zu leichtem Goldset | Modell zu gut für Test-Set, kein echtes Signal | Goldset ausbauen, nicht Modell wechseln |
| p95-Latency > 3.5s sustained über 14 Tage | UX-Blocker für synchrone Eval-Workflows | Pfad C (Rule-Bypass für Einfach-Fälle) |
| Token-Cost > $0.20 pro Run reproduzierbar | Eval-Budget-Blocker | Pfad C oder lokales Modell |
| Anthropic-Outage > 30 min in einem Run | Verfügbarkeits-Blocker für CI-Gate | Pfad B (Bedrock-EU via ADR-002) ODER Pfad E |
| Customer DPA fordert keine Cloud-LLMs | Datenresidenz-Blocker | Pfad E (Ollama on-prem) |

## 4. Consequences (allgemein, pfad-unabhängig)

### Bei jedem Strategie-Wechsel
- Prompt-Version, Goldset-Version, Model-Version werden in
  `agent_versions` neu erfasst (siehe CLAUDE.md §5).
- Baseline muss komplett neu gemessen werden — alte Eval-Runs sind
  nicht direkt vergleichbar.
- Mindestens drei stabile Runs auf der neuen Konfiguration vor
  Production-Rollout.
- ADR-Update mit den realen Cost-/Latency-/F1-Zahlen, nicht nur
  Vorhersagen.

### Spezifisch
- **Pfad B (Modell-Upgrade):** Token-Cost pro Run steigt ~5–20×.
  Pricing-Modell-Auswirkung: bei aktuellem 30-Case-Goldset und
  täglichem Nightly-Eval würde Sonnet 4.6 ~$1.50/Tag = ~$45/Monat
  kosten — vertretbar bis 60-Case-Goldset.
- **Pfad C (Hybrid):** Erfordert separates `rules.ts`-Modul mit
  testbarer Regel-Cascade. Eval-Runner muss pro Case dokumentieren,
  welcher Pfad gegriffen hat (Rule vs LLM) — neue Spalte
  `ai_risk_eval_cases.classification_path`.
- **Pfad D (Fine-Tuning):** Benötigt `agent_versions.training_dataset_hash`
  und Reproducible-Training-Pipeline. Kein Trigger-Hit vor Q4-2026
  erwartet.
- **Pfad E (Ollama):** Latency steigt (lokale Inferenz auf VPS ist
  langsamer als Cloud). Goldset-Schwellen müssen evtl. nachjustiert
  werden, weil qwen3:4b nicht denselben Reasoning-Level wie Haiku 4.5
  hat — könnte ein eigenes „sovereign tier"-Pricing mit eigenen
  Schwellen rechtfertigen.

## 5. Out of Scope

- Multi-Modell-Voting (mehrere Modelle parallel, Mehrheitsentscheid) —
  zu teuer pro Run, kein konkreter Use-Case.
- RAG-basierte Klassifikation mit AI-Act-Volltext im Context — heute
  nicht nötig, weil Prompt v1 die relevanten Artikel direkt enumeriert.
- Constitutional AI / Self-Refine-Loops — nicht vor Pfad B/C.

## 6. Hard-Rule (gilt vor jedem Strategie-Wechsel)

CLAUDE.md §6 Hard Rule #1 bleibt unverändert: **Keine
Prompt-Optimierung vor erster stabiler Baseline.** Diese ADR sortiert
*Strategien jenseits des Prompts* — Modell-Wechsel, Architektur-Wechsel,
Inferenz-Region-Wechsel — und greift erst nach Baseline.

## 7. Review-Kadenz

Dieser ADR wird **nach jedem Eval-Run** auf Trigger-Hits geprüft.
Bei sustained-Befund (drei Runs) wird die ADR auf Accepted gehoben und
der Strategie-Wechsel umgesetzt.

Letztes Review: 2026-05-18 (Initial Draft)
Nächstes Review: nach erstem Baseline-Run
