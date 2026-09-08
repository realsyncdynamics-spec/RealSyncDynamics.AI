# CLAUDE.md
# RealSyncDynamicsAI — AI Governance Runtime Platform

Diese Datei ist der zentrale Kontext für Claude Code (claude.ai/code).
Sie beschreibt **den tatsächlichen Zustand des Repositories**, nicht den Zielzustand.
Abweichungen zwischen Doku und Code sind Bugs in dieser Datei — bitte hier korrigieren, nicht umgekehrt.

---

## 0. Kontext- und Token-Budget

Diese Datei wird bei **jedem** Session-Start und nach **jeder** Kompaktierung
vollständig geladen. Jede Zeile hier kostet in jeder Sitzung erneut. Deshalb:
**Der Kern trägt nur, was für eine Entscheidung im Repo verbindlich ist.**
Herleitung, Messprotokolle, Vorfälle und Freigabe-Umfänge liegen ausgelagert
und werden **bei Bedarf** gelesen — nicht auf Vorrat.

### Landkarte: wo die Details liegen

| Datei | Inhalt | Lesen, wenn … |
|---|---|---|
| `docs/context/architektur-messungen.md` | Edge-Function- und Migrations-Zählungen mit Datum und Methode | eine Aussage zum Deploy-/Ledger-Stand ansteht |
| `docs/context/betrieb-und-drift.md` | Messprotokolle, Drift-Guards, Cron-Befund, Out-of-Band-Vorfälle | Produktionsstand, Drift oder ein roter Guard zu klären ist |
| `docs/context/datenmodell-befunde.md` | `profiles`-Erzeugungspfad, die sieben Tabellennamen ins Leere | ein Tabellenname oder ein stiller Schreibpfad zu prüfen ist |
| `docs/context/pdp-enforcement.md` | Begründungen der Schalter, Bot-Governance P2-5 | ein Enforcement-Schalter umgestellt werden soll |
| `docs/context/pricing-regeln.md` | Kontingent-Kanonizität, Add-on-Mechanik, AP2-Herleitung | an Preisen, Limits oder Entitlements gearbeitet wird |
| `docs/context/design-freigaben.md` | Umfang **jeder** erteilten Design-Freigabe | Bestehendes am Frontend geändert werden soll (§10) |
| `docs/context/platform-monorepo.md` | Details zum Python-Stack unter `platform/` | in `platform/` gearbeitet wird |

### Arbeitsregeln (gelten für jede Sitzung)

- **Gezielt lesen statt vollständig.** `grep -n` / `rg` mit Trefferfenster,
  `sed -n 'a,bp'` für Bereiche. Eine 2000-Zeilen-Datei ganz zu lesen, um eine
  Funktion zu ändern, ist der teuerste Weg zum Ziel.
- **Breite Suchen an einen Subagenten geben** — er liefert das Ergebnis, nicht
  die Dateiberge, durch die er dafür gegangen ist.
- **Keine Ausgabe ohne Grenze.** `| head`, `--max-count`, `-o` statt ganzer
  Zeilen; `npm test` auf die betroffene Datei einschränken statt der Suite.
- **Doku nicht in den Chat spiegeln.** Auf Datei und Zeile verweisen, statt
  Passagen zu wiederholen, die der Eigentümer bereits hat.
- **Neues in dieser Datei nur, wenn es eine Entscheidung bindet.** Alles andere
  — Hergang, Messung, Nachweis — gehört nach `docs/context/` und wird hier mit
  einer Zeile verlinkt. Nach dem Ergänzen `npm run check:context` ausführen.

### Budget-Wächter

`npm run check:context` misst den bei jedem Start geladenen Kontext
(`CLAUDE.md` plus `.claude/`-Konfiguration) und schlägt bei Überschreitung des
Budgets aus `.claude/context-budget.json` fehl. Er ist eine **Ratsche**: Wächst
der Kern, muss ausgelagert werden — nicht das Budget erhöht.


## 1. Projektidentität

RealSyncDynamicsAI ist eine **EU-souveräne AI Governance Runtime** für Unternehmen,
Agenten-Systeme und Creator-Verifikation.

**Ziele**
- Verwaltung autonomer KI-Agenten
- Governance, Policies und Compliance
- Auditierbare Entscheidungen (Prüfpfad)
- Schutz gegen Deepfakes
- Nachweisbare Daten- und Content-Provenienz (Herkunftsnachweis)

**Module (Phase 2)**
- **Audit Module** (95%) — DSGVO-Scan, Recheck-Cron, Email-Drip, Share-Token
- **Policy Packs** (100%) — DSGVO, EU AI Act, Industrie-spezifisch; Auto-Empfehlung nach Tenant-Branche
- **Evidence Vault** (90%) — Ingestion, Retrieval, Hash-Chain-Verifizierung, PDF/JSON-Export, Compliance-Hold
- **Governance Runtime** (85%) — Sentinel-Loop, SLO-Tracking, Auto-Mapping (Asset → Control-Status), Incident-Dispatch
- **Provenance (C2PA)** (80%) — Ed25519-Signatur, Custody-Auto-Capture, Externe Verifizierung
- **SiteOS** (Phase 1) — AI-native Website-Ebene: AI Builder (Prompt → geprüfter Blueprint), 8 Runtime-Analysen, 5 Live-Scores, 7 asynchrone Agenten. Kern in `packages/siteos-core` (abhängigkeitsfrei, läuft in Browser/Deno/Node). Architektur + bewusste Abweichungen vom Auftrag: `docs/SITEOS_ARCHITECTURE.md`. **Regel**: Befund-Codes und Scoring-Gewichte sind versionsrelevant — nicht ohne Entscheidung ändern.

**Compliance-Fokus**
- EU AI Act
- DSGVO
- TDDDG / TTDSG
- C2PA Content Credentials (Ed25519)
- ISO-27001-orientierte Sicherheitsprinzipien

**Produktprinzip**
RealSyncDynamicsAI ist **kein Chatbot**. Es ist eine Governance-Schicht zwischen
Menschen · Unternehmen · KI-Agenten · Daten · Entscheidungen.

**Phase**: 2 Production-Ready | **Go-live**: 2026-08-01

---

## 2. Architektur (Ist-Zustand)

> **Zielarchitektur**: `docs/architecture/target-architecture.md` — Fünf-Ebenen-Modell,
> Asset Lifecycle, Governance Engine, normativer SiteOS-Publish-Gate-Contract und
> Pricing-Achsen (BASE + MODULE + SCALE). Das ist das **Zielbild**; dieser Abschnitt
> bleibt der Ist-Zustand. Bei Widerspruch gilt für Implementierungsfragen dieser
> Abschnitt, für Richtungsfragen das Zieldokument.

### Frontend — Vite SPA, **kein Next.js**

| Baustein | Stand |
|---|---|
| Build | **Vite 6.2** (`vite.config.ts`, Output → `dist/`) |
| UI | **React 19** + TypeScript 5.8 (`"strict": true`) |
| Routing | **react-router-dom 7.17** (Client-Side, `src/App.tsx`) |
| Styling | **Tailwind 4.1** (`@tailwindcss/vite`, `tailwind.config.ts`) |
| Icons / Motion / 3D | lucide-react · framer-motion, motion · @react-three/* |
| PDF | @react-pdf/renderer |
| Monitoring | Sentry 8.55 (`@sentry/react`, Release-Tracking) |
| Billing | Stripe (Edge Functions, Metered Billing) |
| Automation | n8n (Webhook-Trigger, `governance-incidents` → `workflow_runs`) |

> ⚠️ **Es gibt keine Server Components, kein `app/`-Verzeichnis, kein Next.js und kein shadcn/ui.**
> Vorschläge mit „Server Component", „RSC", „`use client`" oder „shadcn add" passen nicht zu diesem Repo.
> SEO wird über **Prerendering** gelöst (`scripts/prerender.mjs`, `npm run build:full`).

**Prinzipien**
- Public Pages (`src/pages/`) → **eager imports** in `src/App.tsx` (kritischer Rendering-Pfad, SEO)
- Auth-gated Features (`src/features/`) → **`lazy()`** hinter `ProtectedRoute` / `RequireAal2`
- Keine Secrets im Frontend. Nur `VITE_*`-Variablen sind clientseitig — und die sind **per Definition public**.
- Keine Admin-/Service-Role-Zugriffe aus dem Browser.

### Backend

**Primär: Supabase Cloud (EU / Frankfurt)**
- PostgreSQL 17 (Live-Projekt, Stand 2026-08-16)
- **188 Edge Functions** im Repo (`supabase/functions/`, Deno/V8; `_shared` ist
  Bibliothek, keine Function). Deploy-Stand und offene Lücken:
  `docs/context/architektur-messungen.md`
- **328 Migrations** (`supabase/migrations/`, Stand 2026-09-06, keine doppelte
  Versionsnummer). Zahlen und Ledger-Abgleich altern mit jedem Merge — vor jeder
  Aussage neu messen: `docs/context/architektur-messungen.md`

- RLS auf allen App-Tabellen · Realtime Subscriptions

**Node/TypeScript-Services** (containerisiert — **kein Go im Repo**)
- `apps/agent-runtime` — Agent Runtime
- `services/realsync-runtime-core` — Runtime-Kern
- `services/realsync-evidence-runtime` — Evidence-/Beweis-Verarbeitung
- `services/openclaw-agent` — Agent-Worker (systemd-Unit vorhanden)
- `services/playwright-scanner` — Scan-Service (DSGVO-Audit)
- `packages/sdk` — öffentliches SDK (CJS + ESM Builds)
- `packages/evidence-chain` — Hash-Chain-Verifizierung des Evidence Vault
  (abhängigkeitsfrei, Hash-Funktion injiziert). Genutzt von der SPA **und** vom
  MCP Server. **Regel**: Die Kanonisierung in `serializeSnapshotForHash` muss
  zeichengenau zu `supabase/functions/evidence-vault` passen — eine Abweichung
  meldet unversehrte Ketten als manipuliert.
- `connectors/` — externe Integrationen · `worker/` — Legacy-Jobs (deprecated → Edge Functions + Cron)

**Architekturprinzip**
```
Frontend (SPA) → Edge Functions / Service-APIs → Services → PostgreSQL
```
Der Browser spricht **nie** direkt mit privilegierten Ressourcen.

### AI-Provider
Anthropic SDK (Claude) · Google GenAI · OpenAI · **Ollama (EU-lokal, Fallback)**.
Jeder externe Call wird in `ai_tool_runs` / `workflow_runs` geloggt.

### Deployment

**Production: Cloudflare**
- **Cloudflare Pages** (`wrangler.toml` → `pages_build_output_dir = "dist"`)
- Deploy via GitHub Actions → `wrangler pages deploy dist`
- Cloudflare Workers / KV / R2 wo sinnvoll (Phase 3, siehe `PHASE_3_CLOUDFLARE_OPTIMIZATION.md`)
- Edge-Config: `_headers`, `_redirects`

**Infrastructure**
- Docker (`docker/`, `Dockerfile.frontend`, `deploy/`, `infra/`)
- Traefik Reverse Proxy · Hostinger VPS für Services · n8n für Automation
- Secrets: Pages via GitHub-Actions-Env (`VITE_*`) · Workers via `wrangler secret put`

**❌ NICHT verwenden**
- Vercel · `@vercel/analytics` · `@vercel/speed-insights` · Vercel-spezifische APIs
- Kein `vercel.json`, keine Vercel-Deploy-Tools — auch nicht „nur zum Testen".

---

## 3. Datenarchitektur

### Multi-Tenancy — nicht verhandelbar

Jede business-relevante Tabelle:
```sql
tenant_id UUID NOT NULL REFERENCES tenants(id)
```
Und **immer**: RLS aktiviert · Policies definiert · Änderungen auditierbar.

**RLS-Pattern**: Zugriff nur, wenn `tenant_id` zum Tenant des `auth.uid()` gehört.
Service-Role umgeht RLS — deshalb **ausschließlich in Edge Functions**.

### Kern-Tabellen (Auszug)

- **Registry**: `ai_systems`, `tenants`, `profiles`

  > ⚠️ **`profiles` hatte bis zum 2026-09-06 keinen Erzeugungspfad** (6 Nutzer,
  > 1 Profil) — behoben durch `20260906200000_profiles_on_signup.sql`. Der
  > Insert steht **vor** dem Mitgliedschafts-Wächter, sonst greift der
  > Early-Return für Bestandsnutzer (`test/db/profiles-on-signup.test.ts`).
  > **Lehre**: Ein `.update()` ohne Treffer ist kein Fehler — PostgREST liefert
  > `error: null`, die Oberfläche meldet „gespeichert" und behält nichts.
  > Hergang: `docs/context/datenmodell-befunde.md`
- **Policy Engine**: `ai_policies`, `policy_pack_catalog`, `policy_pack_controls`, `policy_pack_activations`
- **Framework-Katalog**: `compliance_frameworks`, `framework_controls`, `custom_controls`;
  Erfüllungsstand je Tenant in `framework_implementations` und `asset_control_mappings`
- **Evidence Stream**: `ai_evidence_events`, `audit_jobs`, `evidence_snapshots`, `evidence_items`,
  `governance_evidence`, `ai_evidence_retention`, `evidence_legal_holds`
- **Governance**: `governance_approvals`, `governance_webhooks`, `governance_incidents`, `runtime_events`
- **Integration**: `workflow_runs`, `ai_tool_runs`, `integration_connectors`, `enterprise_connectors`,
  `vendors`, `dpias`, `dsr_requests`
- **Operations**: `incidents`, `inventory_items` (und die übrige `inventory_*`-Familie),
  `enterprise_agent_runs`, `vps_connections`

> ⚠️ **Sieben Namen dieser Liste zeigten am 2026-08-31 ins Leere** — sie
> existieren in Produktion nicht. Statt `governance_controls` →
> `framework_controls` + `compliance_frameworks`; `policy_packs` →
> `policy_pack_catalog` / `policy_pack_controls`; `evidence_retention` →
> `ai_evidence_retention`; `connectors` → `integration_connectors` /
> `enterprise_connectors`; `dsr_tracker` → `dsr_requests`;
> `operations_inventory` → `inventory_items`. `audit_evidence` war der
> Sonderfall (Ledger sagte „angewendet", Tabelle und Bucket fehlten) — behoben
> durch `20260906000000_reconcile_audit_evidence.sql`.
>
> **Regel**: Vor dem Hinzufügen eines Namens hier gegen `pg_tables` prüfen,
> nicht gegen die Erinnerung. Hergang: `docs/context/datenmodell-befunde.md`

### Migrations

- Ort: `supabase/migrations/`, Format `YYYYMMDDHHMMSS_description.sql`
- **Immer additiv.** Keine destruktiven Änderungen ohne ausdrückliche Bestätigung.
- Bestehende RLS-Policies und öffentliche API-Contracts **niemals** brechen.
- Lokal testen: `supabase db reset` → `npm run test:db`

> **Blinder Fleck bei Funktions-Migrationen**: `Migration validation` wendet
> Migrationen an, **ruft** die erzeugten Funktionen aber nie auf. PL/pgSQL
> prüft den Rumpf erst zur Laufzeit — eine Migration mit fehlerhaftem
> Funktionskörper läuft in CI deshalb grün durch. Am 2026-09-04 belegt:
> `v_packs || 'literal'` ohne `::text` wählt `anyarray || anyarray` und wirft
> `malformed array literal`, sobald der Zweig erreicht wird. Der Fehler lag
> latent im Bestand, weil kein Mandant den Zweig erreichte — und wäre durch
> die Korrektur des Branchen-Vokabulars (`20260902000011`) erstmals scharf
> geworden, also genau für die Mandanten, denen sie helfen sollte.
> **Regel**: Wer eine Funktion per Migration anlegt oder ändert, spielt sie
> lokal gegen echtes Postgres ein **und ruft sie auf**. Grün in CI heißt hier
> nichts.

---

## 4. Security — harte Regeln

**NIEMALS**
- API-Keys / Secrets / Credentials committen (`.env.local` nutzen, nie `.env`)
- Service-Role-Keys in Client-Code
- Auth oder RLS „temporär" umgehen
- Tabellen ohne RLS anlegen

**IMMER**
- Environment Variables verwenden
- RLS aktivieren und Tenant-Isolation prüfen
- Input an jeder Vertrauensgrenze validieren
  (**zod ist derzeit keine Dependency** — nicht ohne Absprache einführen)
- Multi-Tenant-Queries mit `tenant_id`-Filter

---

## 5. AI Governance Modell

Jeder Agent braucht vier Dimensionen — fehlt eine, ist er nicht governance-fähig:

- **Identity** — Wer ist der Agent? Wem gehört er? Welche Berechtigungen?
- **Runtime** — Welche Modelle? Welche Tools? Welche Aktionen wurden ausgeführt?
- **Policy** — Welche Regeln gelten? Welches Risiko-Level?
- **Observability** — Logs, Events, Entscheidungen, Kosten.

### Modulstand, Messungen und Betrieb

> **Repo-Stand ≠ Produktions-Stand.** Die Prozentangaben in §1 beschreiben das
> Repository. Vor jeder Aussage zum Produktionsstand **messen** — gegen
> `supabase_migrations.schema_migrations`, `supabase functions list` bzw.
> `src/config/production-edge-functions.ts` — und Mengen in **beide** Richtungen
> vergleichen (`comm -23` **und** `comm -13`). Zahlengleichheit ist kein Beleg.
>
> **Zuerst in den Actions-Tab sehen**: `Migration Drift Guard`,
> `Edge Function Drift Guard`, `Function ACL Drift Guard` und `Cron Health Guard`
> messen täglich; `drift-alert.yml` legt bei Rot ein Issue an. Ein roter Guard
> ist der schnellere Weg zum Befund als jede eigene Messung.
>
> Datierte Messprotokolle, die drei Out-of-Band-Vorfälle und die Lehren daraus:
> **`docs/context/betrieb-und-drift.md`**

**Regeln, die aus diesen Befunden gelten:**

- **Audit**: Befund-Codes, Severities und Scoring-Gewichte (25/12/6/2/0) sind
  **versionsrelevant** — sie entscheiden über die Vergleichbarkeit aller
  bisherigen Kundenberichte. Vertrag:
  `test/fixtures/gdpr-audit-production-contract.json`. Fakten müssen
  **verschachtelt** zurückkommen; flach schweigt die ganze Rule Engine still.
- **Memory Governance / RFC-003**: Schwellen (0.5 / 0.2 / 0.8),
  Aufbewahrungsklassen und Grace-Perioden stehen doppelt — in
  `src/core/governance/rfc003-memory.ts` und in der Migrations-SQL. Nie
  einseitig ändern (`test/governance/rfc003-sql-parity.test.ts`).
- **pg_cron**: Nicht an `cron.job` prüfen, sondern an
  `cron.job_run_details.status`. Vier Jobs scheitern seit dem 2026-08-12 am
  fehlenden Vault-Secret `service_role_key` (u. a. `scan-scheduler-dispatch`,
  `memory-decay-hourly`) — **offener Betreiberschritt**, nicht im Repo lösbar:
  `docs/runbooks/cron-vault-secrets.md`.
- **CI-Schema darf strenger sein als Produktion, niemals lockerer.** Ein Test,
  der eine Sperre nachweist, ist sonst nichts wert.
- **Migrationen im Test nur über `applyMigration()`** aus `db-helpers.ts` — ein
  eigenes `COMMIT;` schließt die äußere Transaktion und verseucht die
  Testdatenbank dauerhaft.
- Ein Modul, dessen Backend nie deployt wurde, ist in Produktion **nicht**
  verfügbar, egal wie vollständig der Code im Repo ist.

### Enforcement-Schalter — der PDP entscheidet erst, wenn jemand ihn lässt

Sechs Pfade hängen am PDP. **Alle stehen auf `shadow`** — beabsichtigter
Zwischenzustand, aber keine Durchsetzung:

| Schalter | Wirkt auf | In `enforce` |
|---|---|---|
| `AI_GATEWAY_ENFORCEMENT` | `ai-gateway` | blockt |
| `AGENT_PDP_ENFORCEMENT` | Agent-Runtime | fail **closed** |
| `SITEOS_PUBLISH_PDP` | Publish Gate (P2-3) | fail **closed** |
| `GOVERNANCE_PDP_MODE` | CI/CD-Gate (P2-4) | verschärft nur |
| `BOT_PDP_ENFORCEMENT` | Chat · WhatsApp · Voice (P2-5) | fail **closed** |
| `M365_PDP_ENFORCEMENT` | Microsoft 365 (P2-2) | **löst die Reaktion aus** |

**`enforce` heißt nicht überall dasselbe**: Bei den ersten fünf wird die
Handlung angehalten, bei M365 (Klasse C, nachgelagert) kann nichts angehalten
werden — ein `block` wird dort zu `react` mit Vermerk.

**Vor dem Umschalten `pdp_shadow_log` auswerten** — über
`pdp_shadow_readiness()` bzw. `/app/governance/shadow`. Ein leeres
Shadow-Protokoll heißt zuerst „nachsehen, ob überhaupt geschrieben wird".
**Regel**: Die Kanalliste steht doppelt (`pdp_shadow_known_sources()` und der
CHECK `pdp_shadow_log_source_check`) — nie einseitig ändern.

**Bot-Governance (P2-5)**: Alle drei Kanäle laufen durch **einen** PEP
(`_shared/pdp/botmessage.ts`). Den Prozess verlassen nur Merkmale, **nie der
Nachrichtentext** (`verify_jwt = false` — der Text stammt von Fremden).

Begründungen und offene Produktentscheidung: `docs/context/pdp-enforcement.md`

## 6. Code Standards

**TypeScript**
- Strict Mode ist aktiv (`tsconfig.json: "strict": true`) — nicht abschalten.
- Kein `any` ohne Begründung im Kommentar.
- Alle Funktionsparameter typisiert.

**React**
- Funktionale Komponenten, Hooks sauber gekapselt (`src/hooks/`)
- Wiederverwendbare Komponenten in `src/components/`
- Bestehende Patterns wiederverwenden statt neue erfinden

**SQL**
- Jede Migration nachvollziehbar und additiv
- RLS-Logik kommentieren: *warum*, nicht *was*

**Daten**
- **Single Source of Truth**: `src/config/*.ts` (`pricing.ts`, `seo.ts`, `industries.ts`, `competitor-comparisons.ts`)
- Niemals duplizieren — Änderungen in der Config propagieren überall
- Config-Objekte sind immutable `const` — nicht mutieren

---

## 7. Repository-Struktur

Vor jeder Änderung erst analysieren:

```
RealSyncDynamics.AI/
├── src/
│   ├── pages/         108 Seiten (1 Datei = 1 Route), public, eager imports
│   ├── features/      Auth-gated Module (billing, governance, …), lazy-loaded
│   ├── components/    Shared UI
│   ├── config/        Zentrale Konfiguration (seo, industries) — Preise siehe shared/
│   ├── core/          Provider (TenantProvider, DemoModeProvider, …)
│   ├── lib/           Utilities (auth, tracking)
│   ├── hooks/         React Hooks
│   ├── enterprise-os/ Workspace-Layouts, Governance-Branding
│   ├── flow/          Seitenbasierter Flow (/flow/*)
│   ├── governance/    Governance-UI
│   ├── runtime/       Agent-Integration, Telemetry-Typen
│   ├── security/      Security-Utilities
│   └── sdk/           Client-SDK-Anbindung
├── shared/
│   └── pricing.ts     Single Source of Truth für Produkt-, Preis- und Berechtigungsmodell
├── supabase/
│   ├── functions/     188 Edge Functions (einziger Ort für Service-Role-Keys)
│   └── migrations/    328 Migrations
├── apps/
│   ├── agent-runtime/ Agent Runtime (Node/TS, Docker)
│   └── mcp-server/    MCP Governance Server — Lesezugriff für KI-Agenten auf
│                      Evidence/Governance über MCP-Protokoll (JSON-RPC) und
│                      HTTP; API-Key-Auth, Scopes, Kontingent, Prüfpfad
│                      (eigenes tsconfig, aus dem Root-Lint ausgenommen)
├── services/          runtime-core · evidence-runtime · openclaw-agent · playwright-scanner
├── packages/
│   ├── sdk            Öffentliches SDK (CJS + ESM)
│   └── evidence-chain Hash-Chain-Verifizierung (SPA + MCP Server)
├── connectors/        Externe Integrationen
├── deploy/ docker/ infra/ VPS-Stack (Traefik, Ollama, n8n)
├── platform/          🏗️ **WEBSITE BUILDER MONOREPO** (siehe unten)
├── scripts/           Build-, Release-, QA-Skripte
└── test/ tests/ e2e/  Vitest + Playwright
```

### 🏗️ Platform-Monorepo (`platform/`) — Website Builder + Governance

Eigenständiger Python/FastAPI-Stack (`builder_orchestrator`,
`governance_backend`, `nextjs_frontend`, `migrations`), koordiniert von
`docker compose` — **nicht** von der Root-`package.json`, dem Root-npm oder den
Root-CI-Workflows. Start: `cd platform && cp .env.example .env && docker compose up --build`.

- Keine Node-Dependencies · OpenAPI-First (Pydantic) · RLS und Migrations wie im
  Hauptrepo · Prüfpfad in `audit_log` + `workflow_runs`
- **Der PDP ist auch hier der Entscheider** (P2-4): `app/services/pdp_client.py`
  ruft `governance-decide`; er kann nur **verschärfen**, nie lockern.
  `GOVERNANCE_PDP_MODE=off|shadow|enforce`, Default `shadow`.
- Tests laufen mit `pytest`, nicht mit Vitest. Stand 2026-09-04: 93 passed,
  14 skipped, **7 vorbestehend rot** (Umgebungsvariablen bzw. Datenbank) —
  nicht für eigene Fehler halten.

Details: `docs/context/platform-monorepo.md`, `platform/README.md`

### Preise, Pläne und Berechtigungen

`shared/pricing.ts` ist die **einzige** Quelle für Plan-Namen, Preise,
Runtime-Limits, Module, Berechtigungen, Feature-Listen und Add-ons.
`src/config/pricing.ts` ist nur eine Projektion davon.

- Änderungen nur in `shared/pricing.ts`, danach `npm run sync:pricing`;
  `npm run check:pricing` prüft Deno-Zwilling und DB-Katalog gegen die Quelle
- Zugriff **nie** über Plan-Namen (`if (plan === 'agency')`), sondern über
  `hasPermission()`, `hasModule()`, `limitOf()`
- Genau sechs Abo-Pläne: Free Audit · Starter · Growth · Agency · Enterprise ·
  Partner. Der Name **„Scale" ist untersagt**.
- `availability` (`self_service` · `contract` · `legacy`) sagt, ob ein Plan neu
  wählbar ist; `purchaseMode` sagt, welche Stripe-Session entsteht — nicht
  dasselbe. **Verkaufslisten nehmen `SALES_PLANS` / `SELF_SERVICE_PLANS`, nie
  `ORDERED_PLANS`** (Rangvergleiche brauchen die volle Leiter).
- Einmalprodukte (`purchaseMode: 'one_time'`) sind kein Rang der Abo-Leiter:
  Persistenz als Grant in `entitlement_grants`, nicht in `subscriptions`.
- **Kontingente**: Für Self-Service gilt `plan.limits.*`, für Vertragspläne der
  Vertrag — dort bedeutet `-1` „das System begrenzt nicht". **Kein Gate gegen
  einen divergierenden Wert**, keine stillschweigende Kürzung bei
  Bestandskunden. `npm run check:limits` ist eine Ratsche gegen *neue*
  Divergenzen.
- Add-on-Grants **addieren** Kontingente auf den Plan (`tenant_entitlements()`).
- **Dashboard-Gates** kommen aus einem Register:
  `src/core/access/featureAccess.ts`, geprüft von `RouteEntitlementGate`.

Herleitung, Kontingent-Kanonizität und Add-on-Mechanik:
`docs/context/pricing-regeln.md`. Vollständige Regeln:
`docs/product/pricing-governance.md`

### Routing-Struktur
- `/` → MainLanding (**Design eingefroren**, Ergänzen frei, Ändern nur nach Rückfrage — siehe §10)
- `/app/*` → Auth-gated Dashboard (Onboarding-First-Gate)
- `/flow/*` → Seitenbasierter Flow (Trial, Onboarding, Assessment)
- `/governance-runtime` · `/governance-score` · `/governance-browser` ·
  `/governance-graph` · `/governance-complexity-score` · `/governance-os-pricing`
  → Public Features. **Bindestrich, kein Schrägstrich.**
- `/governance/*` (mit Schrägstrich) → auth-gated Governance-Modul
  (`admin`, `approvals`, `dpias`, `dsr`, `incidents`, `scans`, `vendors`, …);
  die meisten dieser Routen sind Weiterleitungen nach `/app/*`.

  > Bis 2026-09-01 stand hier „`/governance/*` → Public Features (Runtime,
  > Docs, Score, Browser)". Das war vertauscht: `/governance/runtime` und
  > `/governance/score` existieren nicht und liefern „Seite nicht gefunden" —
  > im Browser gegen die Live-Seite geprüft. Wer der Doku folgte, verlinkte
  > ins Leere.
- `/<branche>-landing` → Branchen-LPs
- `/preview` · `/pricing` · `/contact-sales`

### Neue Seite hinzufügen
1. **Public**: Datei in `src/pages/`, eager import in `src/App.tsx`, `<Route path="…" element={<NewPage />} />`
2. **Protected**: Modul in `src/features/<name>/`, `lazy()`-Import, `<ProtectedRoute>`-Wrapper
3. **Dynamisch** (`/branchen/:slug`): `useParams()` + zentrale Config aus `src/config/`

---

## 8. Befehle

| Zweck | Befehl |
|---|---|
| Dev-Server | `npm run dev` (http://localhost:3000, HMR) |
| Build | `npm run build` (Vite → `dist/` + Legal-Pages) |
| Build inkl. Prerender | `npm run build:full` |
| Lint / Types | `npm run lint` (`tsc --noEmit`) |
| Tests | `npm test` (Vitest) |
| Tests (Watch) | `npm run test:watch` |
| Einzelner Test | `npm test -- pfad/zur/datei.test.ts` |
| DB-Tests | `npm run test:db` (lokale Supabase) |
| E2E | `npm run e2e` (Playwright) |
| E2E interaktiv | `npm run test:e2e:ui` · Report: `npm run test:e2e:report` |
| Prod-Check | `npm run check:production` |
| Smoke (deployed) | `npm run smoke:production` |
| QA Smoke | `npm run qa:smoke` · Governance: `npm run qa:governance` · Load: `npm run qa:load` |
| Edge-Function-Drift | `npm run check:edge-functions` |
| Kontingent-Kanonizität | `npm run check:limits` |
| Cron-Gesundheit (Prod) | `npm run check:cron-health` |
| Kontext-Budget | `npm run check:context` |

### Nach jeder Änderung
```bash
npm run lint      # tsc --noEmit — muss grün sein
npm run build     # muss durchlaufen
npm test          # betroffene Tests
```
Bei UI-Änderungen zusätzlich `npm run e2e`.

---

## 9. Git Workflow & Arbeitsweise

**Keine direkten Änderungen an `main`.** Branch-Format: `<task-type>/<short-desc>` (z. B. `feature/agent-registry`).

**Vor jedem Commit**: Diff zeigen · Änderungen erklären · Tests ausführen.
PR als Draft öffnen, Review anfordern, dann mergen. Deploy erfolgt via GitHub Actions.

### Vorgehen bei komplexen Aufgaben
1. Architektur analysieren (bestehende Patterns lesen)
2. Plan erstellen und zeigen
3. Modular umsetzen
4. Diff zeigen
5. Tests ausführen
6. **Erst danach** committen

Bei Governance-Code zusätzlich dokumentieren: Zweck der Funktion · Sicherheitsrelevanz ·
betroffene EU-AI-Act-Anforderung · DSGVO-Bezug.

### Doku-Hygiene: erledigte Aufgaben dürfen gelöscht werden

Abgearbeitete und veraltete Aufgaben-Dokumente werden **ohne Rückfrage entfernt** —
die Git-History bleibt als Archiv erhalten.

- **Löschen**: erledigte Checklisten · Tages-/Wochenpläne mit vergangenem Datum ·
  Status-Snapshots abgeschlossener Arbeiten · Dokumente mit ✅-COMPLETE- oder
  ERLEDIGT-Markierung, deren Inhalt nicht mehr gebraucht wird
- **Behalten**: Runbooks, Playbooks, Templates, Specs, Architektur- und
  Compliance-Nachweise — auch wenn die zugehörige Aufgabe erledigt ist
- **Vor dem Löschen prüfen**: Wird die Datei noch referenziert (`grep -rl <name> .`)?
  Bei Verweisen aus bleibenden Dateien entweder Referenz mitkorrigieren oder Datei behalten.
  Keine toten Links hinterlassen.

---

## 10. Design-System & Design-Freeze

### 🔒 Design-Freeze — verbindlich seit 2026-08-19

**Baseline: Commit `339b08e7`** auf `main` — „feat(landing): Enterprise Ultra
Plus frontend". Das ist der Stand, der vom Eigentümer abgenommen wurde und
seit dem 2026-08-19 auf `realsyncdynamicsai.de` ausgeliefert wird. Er gilt als
eingefroren.

> Die erste Fassung dieser Regel nannte `f0c03bd` — den Commit auf dem Branch
> `claude/enterprise-frontend-capability-truth`. PR #1091 wurde als **Squash**
> gemergt, wodurch die fünfzehn Einzel-Commits zu `339b08e7` zusammengefasst
> wurden. `f0c03bd` existiert in `main` deshalb nicht; die Baseline zeigte auf
> einen Commit, den dort niemand findet.
>
> Lehre für den nächsten Freeze: Ein Baseline-Verweis gehört erst gesetzt,
> wenn der Stand auf `main` liegt — vorher ist die SHA nicht die endgültige.

#### 1. Am Design wird nichts mehr geändert

Gesperrt sind: Layout, Grid, Sektionsreihenfolge, Farben, Theme, Typografie-
Skala, Schriftgrößen, Spacing, Radien, Schatten, Verläufe, Animationen,
Icon-Set, Austausch oder Neubau von UI-Komponenten, Neuentwurf einer Seite.

Das gilt **ausnahmslos** und unabhängig davon, wie gut eine Idee erscheint.
Ein Design, das eingefroren ist, wird nicht „nur kurz verbessert".

#### 2. Ergänzungen sind frei

Neue Funktionen, neue Sektionen, neue Texte und neue Buttons dürfen **ohne
Rückfrage hinzugefügt** werden — aber ausschließlich mit den vorhandenen
Komponenten, Klassen und Tokens. Wer etwas hinzufügt, erfindet dafür keine
neue Optik.

#### 3. Bestehendes ändern oder entfernen → vorher fragen

Für jede Änderung **an bereits vorhandenem** Text, Button, Link oder einer
backend-gebundenen Funktion gilt Fragepflicht. Wortlaut des Hinweises:

> **Achtung, Textänderung — sollen wir dies machen? Ja oder nein?**

Bei Funktionen entsprechend „Funktionsänderung". Danach wird **gewartet**, bis
eine Antwort vorliegt. Keine Vorab-Umsetzung „zum Zeigen".

#### 4. Freigabe für Design-Änderungen — die Drei-Fragen-Regel

Soll doch etwas am Design geändert werden, ist das nur über diesen Weg
möglich: Es werden dem Eigentümer **genau drei Fragen** gestellt, die die
geplante Änderung vollständig beschreiben. Erst wenn **alle drei mit Ja**
beantwortet sind, ist die Änderung freigegeben — für genau diesen Umfang, nicht
darüber hinaus.

Ein „Ja" zu einer früheren Änderung gilt nicht für die nächste.

#### Erteilte Freigaben

Damit die nächste Sitzung nicht für einen Regelbruch hält, was abgestimmt war,
wird jede erteilte Freigabe hier festgehalten — mit ihrem Umfang, denn sie gilt
nur für diesen.

| Datum | Umfang (Kurzform) |
|---|---|
| 2026-08-19 | Enterprise-Ebene der Startseite (Material, eigene Sektion, Parallax; **kein** zweiter Farbakzent) |
| 2026-08-23 | CTA-Hierarchie der Startseite auf den Scan-Trichter |
| 2026-08-23 (2) | Landing-CTA von `/scan` auf `/audit` |
| 2026-08-24 | AP2 — Paketumbau auf drei Self-Service-Stufen |
| 2026-08-24 (2) | Preisseite auf drei Stufen (`lg:grid-cols-5` → `lg:grid-cols-3`) |
| 2026-08-30 | Texte und Buttons an Route- und Pricing-Infrastruktur |
| 2026-08-30 (2) | WhatsApp-Preisseite auf drei Stufen |
| 2026-08-30 (3) | DORA-Karte als „In Vorbereitung" |
| 2026-08-31 | Build Studio — Speicherort und Übernehmbarkeit am Sitzungsmodus |
| 2026-09-01 | Vorschau-Inhalte: nichts behaupten, was der Scan nicht hergibt |
| 2026-09-01 (2) | Zusammenfassung im Brief: sachlich statt werbend |
| 2026-09-01 (3) | Hero-Überschrift: `overflow-wrap:break-word` |
| 2026-09-01 (4) | Ein Flow für den Start — drei Freigaben nach der Add-on-Buchung |
| 2026-09-04 | AP11 Aufräumen — verwaiste Dateien |

**Der Umfang jeder Freigabe steht in `docs/context/design-freigaben.md`** — mit
Vorher/Nachher-Tabelle und dem, was ausdrücklich *nicht* freigegeben ist. Vor
einer Änderung an bereits Vorhandenem dort nachsehen: Eine Freigabe gilt nur
für ihren Umfang, ein „Ja" zu einer früheren gilt nicht für die nächste.

#### Faustregel

**Hinzufügen ja, Ändern nur nach Rückfrage, Design gar nicht.**
Im Zweifel: fragen, nicht ändern.

### Aktive Design-Tokens (`tailwind.config.ts` — verbindlich)
- **App / Dashboard**: Hard-Edge Industrial UI, keine abgerundeten Ecken
  Obsidian `#0A0A0B` · Titanium `#E2E2E2` · Security-Blue `#0052FF`
- **Public Landing Pages**: „European Enterprise Trust" Light-Theme
  Slate-Neutrals `#F8FAFC–#0F172A` · Petrol `#0F766E` als Akzent
  Ruhige Karten/Chips/Panels, 10–14px Radius (`rounded-chip`, `rounded-card`, `rounded-panel`)
  Eigene, weiße `LandingNavbar`
- **Monospace** durchgängig für Metadaten (IDs, Codes, Technisches)

### Vorgeschlagene Richtung (noch NICHT im Token-Set)
Eine Amazon-inspirierte Enterprise-Variante (Dark Header, klare Navigation,
Amazon-Orange `#FF9900`, Dark `#131921`, Neon-Cyan `#4DF2FF`, Neon-Magenta `#FF2FCF`)
ist als Richtung diskutiert, aber **nicht implementiert** — diese Farben existieren
weder in `tailwind.config.ts` noch im CSS. Vor Verwendung: erst Tokens definieren
und Design-Lock-Freigabe einholen. Nicht ad hoc in einzelne Komponenten einstreuen.

---

## 11. Auth & Multi-Tenancy

1. Sign-up über Supabase Auth (Email/Password oder OAuth)
2. Geschützte Routen via `ProtectedRoute` / `RequireAal2`
3. Session in localStorage, validiert über `useSupabaseAuth()`
4. Service-Role-Operationen **ausschließlich** in Edge Functions

- `TenantProvider` umschließt geschützte Routen
- Ein User gehört zu genau einem Tenant (Workspace)
- Alle Queries über RLS nach `tenant_id` gefiltert
- Kontext: `useAuth()` → `{ id, email, tenantId }` · `useTenant()` → Workspace, Members, Plan
- Einladungen: `InvitesView`, `AcceptInviteView`

---

## 12. Konventionen

- **Sprache**: Deutsch für Kommentare und Doku (Standard-Englisch, wo etabliert)
- **Terminologie**: „Prüfpfad" statt „Audit Trail" · „Herkunftsnachweis" statt „Provenance"
- Kommentare erklären **warum**, nicht **was** — besonders bei RLS-Logik und Compliance-Regeln
- E2E-Tests für kritische Flows (Sign-up, Checkout, Compliance-Pfade)

### ✅ DO
- Public-Page-Imports eager halten · Auth-gated Features lazy laden
- Daten zentral in `src/config/`
- `npm run lint` und `npm run check:production` vor dem Commit
- Bestehende Patterns wiederverwenden

### ❌ DON'T
- Shared Config mutieren · Service-Role-Keys im Client
- Tabellen ohne RLS · öffentliche Route-Contracts brechen (Redirects OK, URL-Änderungen nicht)
- Daten duplizieren · Secrets committen
- Vercel-Abhängigkeiten einführen · Next.js-Patterns in die Vite-SPA tragen

---

## 13. Debugging

- **RLS**: Policies via `supabase db pull` inspizieren · lokal `supabase db reset && npm run test:db`
- **Edge Functions**: `supabase functions serve` zeigt Fehler lokal · Logs im Supabase Dashboard
- **Routing (Prod)**: `npm run diagnose:domain` · `npm run smoke:production`
- **Frontend-Fehler**: Sentry (Release-Tracking, Error-Aggregation)

---

## 14. Arbeitsprinzip & Aktuelle Ziele

### 🎯 Leitprinzip: Unsichtbares sichtbar, Funktionen funktionsfähig

Gilt für **alle Repos** dieses Projekts. Bei jeder Aufgabe mitprüfen:

- **Unsichtbares sichtbar machen** — fertiger Code, den niemand erreichen kann, ist
  verschwendete Arbeit. Verwaiste Seiten ohne Route, Routen ohne Link, Features ohne
  Einstiegspunkt: einbinden und verlinken. Links und Buttons hinzufügen ist laut §10
  **Inhalt** und damit ohne Rückfrage erlaubt.
- **Funktionen funktionsfähig machen** — Buttons ohne Handler, `href="#"`, dauerhaft
  `disabled` ohne Grund, „coming soon" ohne Termin, TODO-Stubs in Produktionspfaden:
  entweder fertigstellen oder entfernen. Kein Element vortäuschen, das nichts tut.
  **Achtung, Vorrang §10**: Fertigstellen ist eine Ergänzung und damit frei.
  Entfernen oder Umschreiben greift in Bestehendes ein — dafür gilt die
  Fragepflicht. Also melden, nicht stillschweigend abräumen.
- **Abgelöstes benennen** — wird eine Seite durch einen Redirect ersetzt, gehört die
  alte Datei entfernt, nicht als toter Code liegengelassen.

Befunde, die den Rahmen der aktuellen Aufgabe sprengen, werden **berichtet**, nicht
stillschweigend übergangen.

### Aktuelle Ziele

- 🔄 **Phase 3 vorbereiten**: Cloudflare-Optimierung (Cache, KV, R2), Social-Orchestrator, Dashboard-UI-Rest
- 🎯 **Zielarchitektur umsetzen** (`docs/architecture/target-architecture.md`) in dieser
  Reihenfolge: Asset-Objektebene + Lebenszyklus → Publish Gate → Workflows →
  Integrationen → Pricing-Achsen. Der **Publish Gate muss vor dem ersten
  SiteOS-Publish-Pfad** stehen, nicht danach.
- ⚠️ Migrations sauber additiv halten (RLS nicht brechen)
- ⚠️ Tests (Vitest/Playwright) für neue Features ergänzen
- ⚠️ Refactorings ohne Breaking Changes an öffentlichen Routen
