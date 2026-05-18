# CLAUDE.md — Repo-Kontext für Claude-Code-Agents

Diese Datei ist der erste Einstiegspunkt für jeden späteren
Claude-Code-Lauf. Sie fasst zusammen, was hier gebaut wird, welche
Entscheidungen gelten, und was bewusst **nicht** angefasst werden darf.

---

## 1. Projektkontext

**RealSync Dynamics AI** ist eine EU-souveräne Compliance- und Governance-
Runtime für KI- und Tracking-Systeme. Multi-Tenant, gehostet in
Frankfurt (eu-central-1).

- **Regulatorischer Fokus:** EU AI Act, DSGVO, TTDSG, BDSG, DSG (CH/AT).
- **Positionierung:** Governance-Runtime, **kein** Cookie-Scanner. Wir
  klassifizieren, monitoren und beweisen, was im Kunden-System läuft —
  agentisch, nicht statisch. Siehe `docs/positioning/positioning-onepager-de.md`.
- **Sprache:** Code und Doku auf Deutsch, wo Standard-Englisch nicht
  zwingend ist. „Prüfpfad" statt „Audit Trail", „Herkunftsnachweis"
  statt „Provenance".
- **Design-System (UI):** Hard-Edge Industrial — keine abgerundeten Ecken,
  Monospace für Metadaten. Farben: Obsidian `#0A0A0B`, Titanium
  `#E2E2E2`, Security-Blue `#0052FF`.

## 2. Architektur

### 2.1 Stack (heute, verifiziert)

- **Frontend:** Vite 6 + React 19 (SPA), TypeScript, Tailwind 4
- **Routing:** react-router-dom 7
- **Hosting (SPA):** GitHub Pages — keine `/api`-Routes verfügbar
- **Backend:** Supabase (Auth, Postgres mit RLS, Edge Functions, Storage)
- **AI:** Anthropic / Google / OpenAI (Cloud) · Ollama qwen3:4b (EU-lokal)
- **Automation:** n8n · **Billing:** Stripe · **Monitoring:** Sentry
- **Tests:** Vitest (Unit) + Playwright (E2E)
- **VPS:** Hostinger `srv1622293` mit PM2 + systemd für Long-Running-Worker
  (Playwright-Scanner, Ollama)

### 2.2 Produkt-Pillars (intendierte Architektur)

Vier konzeptionelle Pillars. Heute teilweise im Code abgebildet,
teilweise geplant — das Mapping markiert, was bereits liegt.

| Pillar | Zweck | Repo-Mapping (heute) |
|---|---|---|
| **Creator** | Compliance-Artefakte (Datenschutz-Erklärung, AVV, DPIA, Evidence-Bundles) erzeugen und versiegeln | `supabase/functions/generate-document`, `evidence-vault-export`, `governance-dpias`, `src/pdf/` |
| **Promotion** | Customer-Acquisition und Lead-Funnel über Free-Audit, niche-spezifische Landing-Pages, Vergleichsseiten | `src/pages/Audit*`, `src/pages/*Alternative.tsx`, Marketing-Pages |
| **Market** | Wettbewerbs-Analyse, Pricing-Intelligence, externe Discovery (Sales-Lead-Erkennung) | `supabase/functions/market-scanner`, `marketing-analytics-runtime` |
| **Social** | Outbound-Kanäle (Email-Drip, Webhooks, Sub-Processor-Notifications, Affiliate-Tracking) | `supabase/functions/audit-drip-cron`, `governance-webhooks`, `welcome-email`, Affiliates-Migration |

Die **Governance/Classification-Schicht** liegt quer zu den Pillars und
enthält den `ai-risk-agent` (siehe §4) sowie `governance-risk-score`,
`governance-approvals`, `governance-ingest`, das Evidence-Vault und die
RLS-geschützten Telemetrie-Tabellen (`ai_runtime_events`,
`runtime_events`, `ai_evidence_events`).

### 2.3 Wichtige Ordner

| Pfad | Inhalt |
|---|---|
| `src/` | React-SPA |
| `src/core/runtime/` | Runtime-Code (Event-Bus, Approvals, Evidence-Hashing, Agent-Contracts) |
| `supabase/functions/` | Edge Functions (Deno) — Auth-Sensitives, AI-Aufrufe, externe Webhooks |
| `supabase/migrations/` | DB-Migrations, `YYYYMMDDHHMMSS_name.sql`-Konvention |
| `worker/` | Node-Worker für Long-Running-Jobs (Playwright) |
| `deploy/` | VPS-Stack (Traefik, Ollama, n8n) |
| `services/`, `connectors/` | Standalone-Services außerhalb der SPA (excluded aus root-tsconfig) |
| `docs/adr/` | Architecture Decision Records |
| `docs/qa/` | Qualitätssicherungs-Doku, inkl. Goldset-Setup |
| `test/`, `e2e/` | Vitest + Playwright |

### 2.4 Befehle

| Zweck | Befehl |
|---|---|
| Dev-Server (Port 3000) | `npm run dev` |
| Build | `npm run build` |
| Type-Check | `npm run lint` (`tsc --noEmit`) |
| Unit-Tests | `npm test` (`vitest run`) |
| E2E | `npm run e2e` (Playwright) |
| Production-Readiness | `npm run check:production` |
| Eval ai-risk gegen Goldset | `npm run eval:risk-agent` (braucht Env-Vars, siehe `docs/qa/ai-risk-eval.md`) |

## 3. ADRs

Aktuell im Repo:

| ID | Datei | Status |
|---|---|---|
| 0001 | `docs/adr/0001-stay-on-supabase-gh-pages-for-v1.md` | Accepted — Lean-Stack, kein Vercel/Next bis Trigger |
| 0002 | `docs/adr/0002-future-monorepo-migration.md` | **Deferred** — Monorepo-Migration auf Fastify+Coolify, wartet auf 0001-Trigger |
| 0003 | `docs/adr/0003-governance-bus-postgres-outbox.md` | Accepted — Postgres-Outbox über Event-Sourced Topic |
| ADR-001 | `docs/adr/ADR-001-event-backbone.md` | Accepted — Event-Backbone, Graph-Layer, Tenancy mit vier numerischen Migrations-Triggern (A/B/C/D) |

### Geplant, noch nicht geschrieben

| ID | Thema | Trigger |
|---|---|---|
| ADR-002 | Evidence-Chain & Inference-Region (Ed25519 + RFC-3161-Timestamping; Anthropic → Bedrock-EU) | Wenn Enterprise-Kunde vertraglich AWS-Only fordert ODER Evidence-Chain für Audit-Behörde nachweispflichtig wird |
| ADR-003 | LLM-Klassifikator-Strategie (heute Anthropic Haiku 4.5; ggf. Hybrid Rule-Based + LLM, ggf. Fine-tuning) | Wenn Baseline-Eval-Werte F1(high) oder F1(prohibited) wiederholt unterschreiten |

**Regel:** Änderungen an Prompt, Goldset, Modell oder Interpretations-
Policy müssen gegen die ADR-Liste geprüft werden. Wenn die Änderung eine
bestehende Entscheidung berührt oder eine neue Festlegung trifft, wird
sie zum Folge-ADR — nicht stillschweigend committet.

## 4. ai-risk-agent

**Zweck:** Klassifikation von AI-Systemen nach EU AI Act in vier Tiers:
`minimal | limited | high | prohibited`.

### 4.1 Dateien

| Datei | Rolle |
|---|---|
| `supabase/functions/ai-risk/index.ts` | Edge-Function-Handler: Bearer-Auth (`AI_RISK_AGENT_TOKEN`), CORS, Body-Validation, Error-Mapping (400/401/405/500/503) |
| `supabase/functions/ai-risk/classifier.ts` | Anthropic-Transport, Tool-Use-Erzwingung, defensive Response-Validierung, 25-Sekunden-Timeout, Healthcheck-Shortcut |
| `supabase/functions/ai-risk/prompt.ts` | System-Prompt mit 4-Stufen-Decision-Rule. **Teil der Agent-Version** — Änderung erzwingt neuen `prompt_version`-Bump und Eval-Run |
| `supabase/functions/ai-risk/index.test.ts` | Deno-Mock-Tests gegen Contract und Fehlerpfade — **nicht** gegen Klassifikationsqualität. Letztere misst das Goldset im CI-Workflow |
| `supabase/functions/ai-risk/deno.json` | Tasks: `test` (ohne Netz), `test:integration` (`--allow-net=api.anthropic.com`), `check`, `fmt` |

### 4.2 Modell und API

- **Modell:** `claude-haiku-4-5-20251001` (Anthropic Messages API)
- **Tool-Use ist Pflicht** zur Schema-Erzwingung. `tool_choice: { type:"tool", name:"classify_ai_system" }` zwingt strukturierte Antwort.
- **Tool-Schema:** `{ risk_tier: enum, reasons: string[] (1–4, snake_case via /^[a-z0-9_]+$/) }`.
- **Runtime-Validierung doppelt:** Tool-Schema im Request + `parseAnthropicResponse()` validiert Tool-Name, `risk_tier`-Enum, `reasons`-Form. Schema-Hint ist keine Garantie.

### 4.3 Eval-Infrastruktur

| Datei | Rolle |
|---|---|
| `supabase/migrations/20260602000000_ai_risk_goldset.sql` | 3 Tabellen (`ai_risk_goldset`, `ai_risk_eval_runs`, `ai_risk_eval_cases`), service_role-RLS, 30 Seed-Cases |
| `scripts/eval-ai-risk-agent.ts` | Node-Runner: Goldset laden → Agent rufen → Metriken berechnen → persistieren → Markdown-Report |
| `.github/workflows/risk-agent-eval.yml` | PR-trigger pfadgefiltert, Nightly 02:30 UTC, Dispatch. Skippt sauber wenn Secrets fehlen |
| `docs/qa/ai-risk-eval.md` | Setup, Schwellen, Smoke-Test-Sequenz |

## 5. Versionsachsen

Die folgenden vier Achsen müssen bei jeder Eval-Output-Interpretation
nebeneinander dokumentiert werden:

| Achse | Wo gepflegt | Wie inkrementiert |
|---|---|---|
| `prompt_version` | `prompt.ts` (heute implizit über git-SHA des Files) | Bei jeder Änderung am System-Prompt |
| `goldset_version` | Migration-Filename + Seeds | Bei Hinzufügen / Deaktivieren von Cases |
| `model_version` | `MODEL_ID`-Konstante in `classifier.ts` | Bei Modell-Wechsel (z. B. Haiku 4.5 → 5.0) |
| `interpretation_policy_version` | Pro `interpretive_case` im Goldset (siehe §7) | Bei juristischer Neueinordnung |

**Status:** Heute werden alle vier indirekt über git-SHA + Goldset-
`source_reference` erfasst. Eine explizite Versions-Tabelle
`agent_versions` ist Folge-PR.

## 6. Eval-Regeln (Hard Rules)

Diese Regeln gelten ausnahmslos. Verstöße führen zu Revert.

1. **Keine Prompt-Optimierung vor erster stabiler Baseline.** „Stabil"
   heißt: mindestens drei aufeinanderfolgende Runs mit `passed`-Status
   auf identischem Goldset.
2. **Confusion Matrix sagt _wo_ das Problem liegt.** Bei Schwellen-
   Verletzung zuerst die Matrix lesen, nicht den Prompt anfassen.
3. **Misklassifizierte Cases plus `agent_raw_output` sagen _warum_.**
   Nach jedem Baseline-Run einmalig alle Fehlklassifikationen manuell
   durchgehen — `SELECT * FROM ai_risk_eval_cases WHERE run_id =
   '<latest>' AND is_correct = false`. Bei n=30 dauert das ~10 Minuten.
4. **`F1(prohibited)` ≥ 0.90 ist nicht verhandelbar.** Wird der Wert
   nicht erreicht, wird das **Goldset systematisch ausgebaut**
   (Art. 5(1)(a)–(h) durchgehen), nicht die Schwelle gesenkt.
5. **Bei wiederholter Schwellen-Verletzung** in dieser Reihenfolge
   prüfen: (a) Goldset auf Fehl-Labelung prüfen, (b) Prompt auf
   Disambiguierungs-Lücke prüfen, (c) Tool-Schema auf zu lose
   Validierung prüfen. Erst dann Modell-Wechsel oder Hybrid-Architektur
   erwägen (→ ADR-003).
6. **Keine Metrik weichzeichnen.** Wenn Baseline-Werte deutlich besser
   als die Vorhersage-Bandbreite (Accuracy > 0.95) sind, ist das ein
   Goldset-zu-leicht-Signal — Plan ist derselbe wie bei zu niedrig:
   harte Edge-Cases an Tier-Grenzen ergänzen.

## 7. Goldset-Kategorien

Jeder Goldset-Eintrag fällt in genau eine der drei Kategorien. Heute
existiert das Feld noch nicht als Spalte in `ai_risk_goldset` — wird
über `notes` ausgedrückt; explizite Spalte `case_category` ist
Folge-PR.

### 7.1 `objective_case`
- Klare Art./Annex-Zuordnung (z. B. CV-Screening → Annex III(4)(a)).
- Stabil für Regression. Falsche Klassifikation = Bug, nicht
  Interpretationsfrage.
- Bildet die Mehrheit des Goldsets (heute 27 von 30).

### 7.2 `interpretive_case`
- Juristisch auslegungsabhängig (z. B. AI-Generated Product Description
  ist Borderline minimal/limited).
- Pflicht-Felder: `legal_basis` (Artikel-/Annex-Referenz), `notes`
  (Begründung), `interpretation_policy_version`.
- Falsche Klassifikation ist Signal für Prompt-Disambiguierung oder
  Policy-Update, **nicht** Modell-Bug.
- Heute im Goldset markiert als „Borderline minimal/limited je nach
  Public-Interest-Charakter" (1 Case).

### 7.3 `excluded_case`
- Bewusst nicht evaluiert. Wartet auf Legal- oder Governance-
  Entscheidung.
- `is_active = false`.
- Beispiel-Kandidaten: General-Purpose AI Systems (GPAI) — Art. 51-55
  sind als eigene Kategorie zu modellieren, nicht in die 4-Tier-
  Klassifikation pressen.

## 8. Typische AI-Act-Auslegungsfallen

Diese sechs Punkte sind bekannt fehlinterpretiert — bei Prompt-
Änderungen oder Goldset-Ausbau zuerst gegenchecken:

1. **Customer Service Voice Bot mit Human Handoff** — Human Handoff
   allein macht aus einem Chatbot keinen `minimal`. Solange
   `interacts_with_humans=true` ohne klare Disclosure, bleibt es
   `limited` (Art. 50(1)).
2. **Assistive HR tooling vs. employment decision support** — „Hilft
   beim Bewerber-Vergleich" ist Annex III(4)(a), auch wenn nicht-
   bindend. Die Empfehlungs-Eigenschaft reicht.
3. **Emotion recognition außerhalb Arbeitsplatz/Bildung** — Außerhalb
   Art. 5-Verbotskontext ist Emotion Recognition `limited`
   (Art. 50(3)), nicht automatisch `prohibited`.
4. **Synthetic content disclosure scope** — Art. 50(4) gilt für
   „künstlich erzeugten oder manipulierten Bild-, Audio- oder
   Videoinhalt, der einer existierenden Person ähnelt". Interne
   Marketing-Mockups ohne Personen-Bezug fallen nicht zwingend darunter.
5. **Human oversight downgraded nicht automatisch Annex III high-risk** —
   Auch mit `human_oversight: "manager_approves"` bleibt CV-Screening
   `high`. Oversight ist Pflicht-Element, kein Tier-Wechsel-Hebel.
6. **Real-time Remote Biometric Identification** — Nur `prohibited`,
   wenn keine der engen Ausnahmen aus Art. 5(1)(h) greift (entführte
   Person, terroristischer Anschlag, schwerste Straftat). Standard ist
   `prohibited`, Ausnahme dokumentieren.

## 9. Repo-Regeln

- **Lean Stack beibehalten** — keine neuen Server, keine Hyperscale-
  Migration, ohne dass ADR-001-Trigger feuern.
- **Keine neuen Dependencies ohne zwingenden Grund.** Insbesondere kein
  zod/ajv-Import in den SPA-Bundle (~150 kB pro Lib).
- **Keine Prompt-Änderungen ohne Eval-Run.** Prompt ist Teil der
  Agent-Version (§5).
- **Keine Goldset-Änderungen ohne Begründung im Commit.** Cases werden
  hinzugefügt oder mit `is_active = false` deaktiviert, **nie gelöscht**
  (Audit-Trail).
- **Keine Migration zu Bedrock ohne ADR-002-Aktivierung.** Bedrock ist
  nicht „nur BASE_URL-Wechsel" — AWS SigV4-Signing (oder Bearer via
  `aws-bedrock-token-generator`), InvokeModel- oder Converse-API-Pfad,
  `anthropic_version: "bedrock-2023-05-31"` im Body, IAM-Model-Access
  pro Region. Migrationspfad im Kopfkommentar von `classifier.ts`.
- **Workflow-Skip-Logik respektieren.** `.github/workflows/risk-agent-eval.yml`
  skippt sauber wenn Secrets fehlen — Skip darf nicht durch „hartes
  Fail" ersetzt werden, sonst blockiert jeder Fork-PR die CI.
- **Migrations sind additiv.** RLS bleibt aktiv. `is_tenant_member`-
  Helper für tenant-bezogene Tabellen verwenden, `service_role`-only
  RLS nur für interne QA-Tabellen.
- **Service-Role-Keys ausschließlich in Edge Functions.** Nie im
  SPA-Bundle.
- **Pricing-Single-Source-of-Truth:** `src/config/pricing.ts`.
  Änderungen propagieren in JSON-LD (`src/config/seo.ts`, `index.html`),
  Stripe-Seed-Template, Marketing-Pages, `PLAN_CONFIG`, Contract-Test,
  WS2/WS3-Deliverables.

## 10. Claude-Code-Verhalten

### 10.1 Vor Änderungen
- **Erst lesen, dann ändern.** Existierende Datei mit Read-Tool öffnen,
  bevor mit Edit/Write losgelegt wird.
- **Business-Logik nicht erraten.** Wenn der semantische Inhalt einer
  Klassifikation, einer Policy oder einer Pricing-Entscheidung unklar
  ist: nachfragen, nicht raten.
- **Bei regulatorischen Unsicherheiten** Case als `interpretive_case`
  oder `excluded_case` (§7) markieren statt blind zu klassifizieren.

### 10.2 Nach Änderungen

| Geänderter Bereich | Pflicht-Befehle vor Commit |
|---|---|
| `supabase/functions/ai-risk/` | im Function-Verzeichnis: `deno fmt`, `deno check index.ts classifier.ts prompt.ts index.test.ts`, `deno task test` |
| SPA-Code (`src/`, `test/`) | im Repo-Root: `npm run lint && npm test` |
| Migrations (`supabase/migrations/`) | CI-Migration-Validation-Job läuft automatisch; lokal `psql -f` gegen frische Postgres prüfen |
| Marketing-/SEO-Texte | mindestens `npm run lint`; Contract-Test (`test/contracts/audit-contract.test.ts`) erfasst Pricing-Drift |

### 10.3 Commits
- **Keine Co-Authoring-Footer**, keine Emojis im Commit-Body.
- **Format:** `feat(scope): subject` / `fix(scope): subject` /
  `docs(scope): subject`. Scope folgt dem Ordner oder Modul.
- Bei Pricing-Änderungen: alle vom Drift betroffenen Files in **einem**
  Commit, damit `git revert` reversibel bleibt.

### 10.4 PR-Verhalten
- Drafts sind okay. Title und Body bei mehr als zwei Commits
  aktualisieren, damit ein späterer Reviewer den Scope ohne
  Commit-Lese-Marathon erfasst.
- PR-Activity-Events nicht polling — die Pipe weckt die Session bei
  Bedarf.

---

**Letzte Änderung:** 2026-05-18 — Initial-Schreibung im Rahmen der
WS1–WS4-Operationalisierung. Folge-Aktualisierungen nur durch
explizite ADR-Beschlüsse oder bewusste Repo-Konvention-Änderungen.
