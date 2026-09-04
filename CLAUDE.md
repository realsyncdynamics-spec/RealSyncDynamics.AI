# CLAUDE.md
# RealSyncDynamicsAI — AI Governance Runtime Platform

Diese Datei ist der zentrale Kontext für Claude Code (claude.ai/code).
Sie beschreibt **den tatsächlichen Zustand des Repositories**, nicht den Zielzustand.
Abweichungen zwischen Doku und Code sind Bugs in dieser Datei — bitte hier korrigieren, nicht umgekehrt.

---

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
- **185 Edge Functions** im Repo (`supabase/functions/`, Deno/V8; `_shared` ist Bibliothek, keine Function) — gemessen am 2026-09-04 am Merge-Baum dieses Branches, nicht addiert. 181 davon sind deployt und deckungsgleich mit Produktion (mains Messung vom 2026-09-04 mit zwei unabhängigen Methoden, `comm` in beide Richtungen leer — siehe §5). Die vier aus diesem Branch warten auf den nächsten `deploy.yml`-Lauf und stehen so lange in `UNBACKED_CALLERS`: `governance-decide` und `integration-credentials` (P0), `governance-access` (P1-3), `evidence-anchor` (P1-6)
- **321 Migrations** (`supabase/migrations/`) — gemessen am 2026-09-04 am Merge-Baum, nach dem Nachziehen von 30 main-Commits. 314 davon sind verbucht bzw. kommen mit mains eigenem Deploy (`20260902000010`, `20260902000011` aus dem Onboarding-Vokabular); unverbucht aus **diesem** Branch sind sieben: `20260824090000_pdp_snapshots_shadow`, `20260824110000_integration_credentials_hardening`, `20260824120000_org_subject_model_approval_gates`, `20260901090000_evidence_append_only_anchors`, `20260904100000_connector_registry` (P2-1), `20260904110000_publish_gate_policy_trail` (P2-3) und `20260904120000_pdp_shadow_log_channels` (P2-3/P2-5)

  > **Zur Messmethode, weil die Zahlen mehrfach auseinanderliefen**: Die Repo-Zahlen hier stammen aus `ls`/`git ls-tree` auf dem Merge-Baum, nicht aus der Addition zweier Doku-Stände; die Produktionszahlen stammen aus mains Messung gegen das Live-Projekt, nicht aus den Repo-Zahlen abgeleitet. Beide Richtungen sind schon falsch dagewesen: `main` nannte am 2026-09-04 vormittags 180 Functions bei 181 im eigenen Baum, und `subscription-addons` stand zwölf Tage als „wartet auf den Deploy“, obwohl der Lauf längst da war — die Function antwortete mit `401`, nicht `404` (#1204). Wer eine dieser Zahlen fortschreibt statt sie nachzuzählen, schreibt den Fehler fort.
- RLS auf allen App-Tabellen · Realtime Subscriptions

**Node/TypeScript-Services** (containerisiert — **kein Go im Repo**)
- `apps/agent-runtime` — Agent Runtime
- `services/realsync-runtime-core` — Runtime-Kern
- `services/realsync-evidence-runtime` — Evidence-/Beweis-Verarbeitung
- `services/openclaw-agent` — Agent-Worker (systemd-Unit vorhanden)
- `services/playwright-scanner` — Scan-Service (DSGVO-Audit)
- `packages/sdk` — öffentliches SDK (CJS + ESM Builds)
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
- **Policy Engine**: `ai_policies`, `policy_packs`, `governance_controls`
- **Evidence Stream**: `ai_evidence_events`, `audit_jobs`, `audit_evidence`, `evidence_retention`
- **Governance**: `governance_approvals`, `governance_webhooks`, `governance_incidents`, `runtime_events`
- **Integration**: `workflow_runs`, `ai_tool_runs`, `connectors`, `vendors`, `dpias`, `dsr_tracker`
- **Operations**: `incidents`, `operations_inventory`, `enterprise_agent_runs`, `vps_connections`

### Migrations

- Ort: `supabase/migrations/`, Format `YYYYMMDDHHMMSS_description.sql`
- **Immer additiv.** Keine destruktiven Änderungen ohne ausdrückliche Bestätigung.
- Bestehende RLS-Policies und öffentliche API-Contracts **niemals** brechen.
- Lokal testen: `supabase db reset` → `npm run test:db`

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

### Module (Phase 2) — Repo-Vollständigkeit

> #### ⚠️ Repo-Stand ≠ Produktions-Stand
>
> Die Prozentangaben unten beschreiben den **Stand im Repository**, nicht was in
> Produktion läuft. Die Regel bleibt: vor jeder Aussage zum Produktionsstand
> gegen die Live-DB messen, nicht gegen diese Liste.
>
> **Messung vom 2026-08-30, nach dem Merge von PR #1171**, `main` @ `6e8b761`,
> per Management-API direkt gegen das Live-Projekt `RealSyncDynamicsLive`
> (`ebljyceifhnlzhjfyxup`, eu-central-1, PostgreSQL 17.6.1.104,
> `ACTIVE_HEALTHY`). Quellen: `list_edge_functions`,
> `supabase_migrations.schema_migrations`, `pg_tables` / `pg_class` /
> `pg_policy`. **Mengen in beide Richtungen verglichen, nicht nur Zahlen** —
> siehe die Lehre weiter unten.
>
> | | Repo (`main`) | in Produktion | Lücke |
> |---|---|---|---|
> | Migrationen | 297 Dateien | **299** verbucht (neueste `20260831020000`) | **2**¹ |
> | Edge Functions | 179 (+ `_shared`) | **179** aktiv | **0**² |
> | Tabellen in `public` | — | 351 (`pg_tables`, ohne Views) | — |
> | davon mit RLS | — | **351 / 351** | **0** |
> | Views · `public`-Funktionen | — | 19 · 227 | — |
>
> Frühere Stände nannten hier 369 Tabellen ohne Messmethode — vermutlich
> inklusive Views. Ab jetzt zählt `pg_tables`, damit die Zahl vergleichbar bleibt.
>
> **Keine Repo-Migration ist unverbucht.** Die 2026-08-24 dokumentierte Lücke
> in dieser Richtung ist geschlossen; die verbleibende Differenz zeigt in die
> *andere* Richtung — siehe ¹ und ².
>
> **RLS gilt lückenlos**: alle 351 Tabellen haben RLS aktiviert, keine
> einzige ohne. 28 davon haben RLS ohne eigene Policy; das ist bei 27 von
> ihnen richtig so — 11 sind Partitionen von `runtime_events` (die
> Elterntabelle trägt 3 Policies, die beim Zugriff über sie greifen) und 16
> werden ausschließlich von Edge Functions per Service-Role angefasst, für
> Clients also bewusst gesperrt. Der 28. Fall war ein Bug, siehe ³.
>
> **Lehre aus dieser Messung: Zahlengleichheit ist kein Beleg.** Repo und
> Produktion zeigten beide „179 Edge Functions" — die Mengen waren trotzdem
> verschieden, weil `_shared` im Repo keine Function ist und dafür eine
> Function live läuft, die es im Repo nie gab. Wer nur `wc -l` vergleicht,
> übersieht das. Deshalb ab jetzt: `comm -23` **und** `comm -13`.
>
> **Wirksam in Produktion, nicht nur im Repo**: `deploy.yml` lief am
> 2026-08-30 um 21:58 UTC grün auf `1533cf5` (Run 33337859594). Damit sind
> die drei Migrationen aus PR #1172 angewandt — die beiden nachgezogenen
> Out-of-Band-Versionen aus ¹ und
> `20260831030000_integrations_catalog_read_access` aus ³. Nachgezogen heißt
> nicht angekommen; dies ist der Beleg für Letzteres.
>
> **Zur Sperre durch die Migrations-Drift**: Sie bestand vom 2026-08-26 bis
> zum 2026-08-30, blieb aber folgenlos — in diesem Fenster berührte kein
> Commit `supabase/**`, also wurde `deploy.yml` gar nicht ausgelöst.
> Blockiert, aber niemand ist hineingelaufen. Der letzte grüne Lauf davor
> war am 2026-08-25 um 18:36 UTC auf `2e60a21`.
>
> **Nachmessung 2026-09-01**, `main` @ `310ab0e`, gleiche Methode und gleiche
> Quelle wie oben. Repo und Produktion sind weiterhin deckungsgleich — auf
> höheren Zahlen, weil seither fünf Migrationen dazugekommen sind:
>
> | | Repo (`main`) | in Produktion | Lücke |
> |---|---|---|---|
> | Migrationen | 305 Dateien | **305** verbucht (neueste `20260902000100`) | **0** |
> | Edge Functions | 179 (+ `_shared`) | **179** aktiv | **0** |
> | Tabellen in `public` | — | 354 | — |
> | davon mit RLS | — | **354 / 354** | **0** |
> | Views | — | 19 | — |
>
> `comm -23` und `comm -13` sind beide leer, bei Migrationen wie bei
> Functions. Die Zahlen in §2 und §7 sind damit nicht geschätzt, sondern
> nachgezogen. Dass Repo und Ledger beide 305 zeigen, war dabei nicht der
> Beleg — der Mengenvergleich war es.
>
> ¹ **Zwei Migrationen sind live, ohne dass es je eine Datei gab**:
> `20260825204748_fix_websites_authenticated_crud_rls` (2026-08-25) und
> `20260829011038_onboarding_orchestrator_hardening` (2026-08-29). Beide
> wurden am 2026-08-30 wortgleich aus dem Ledger ins Repo nachgezogen,
> mit unveränderter Version, damit `db push` sie als angewandt erkennt und
> ein frisches `db reset` denselben Stand herstellt. Die erste ist
> sicherheitsrelevant: Sie trägt die INSERT/UPDATE/DELETE-Policies auf
> `public.websites`. Solange sie fehlte, hatte eine lokale Datenbank eine
> **andere Sicherheitslage als Produktion**.
>
> ² **Eine Edge Function lief ohne Quellcode im Repo — inzwischen geborgen**:
> `onboarding-orchestrator`, Version 4, angelegt 2026-08-29 01:06 UTC,
> zuletzt 01:17. Keine Git-History, kein Aufruf im Code, nicht in
> `src/config/production-edge-functions.ts`. `verify_jwt: true`. Die
> Migration aus ¹ vom selben Zeitfenster (01:10) gehört dazu — ein
> vollständiges Feature ging an Repo und CI vorbei nach Produktion.
>
> Am 2026-08-30 wurde der Quellcode aus der laufenden Function
> zurückgeholt und unverändert nach
> `supabase/functions/onboarding-orchestrator/` gelegt, samt
> `README.md` mit Herkunft, `ezbr_sha256` der deployten Version und
> Sicherheitsbewertung. **Damit sind Repo und Produktion jetzt in beide
> Richtungen deckungsgleich: 179 = 179, `comm` in beide Richtungen leer.**
> Der Weg war bewusst der additive — eine laufende Production-Function zu
> löschen wäre nicht rückholbar gewesen.
>
> **Weiterhin offen, aber keine Drift mehr, sondern eine Produktfrage**: Die
> Function wird nirgends aufgerufen. Ob der Onboarding-Pfad noch kommt oder
> das Feature aufgegeben wurde, entscheidet der Eigentümer.
>
> ³ **`public.integrations`**: RLS an, null Policies, kein Leserecht für
> `authenticated` — bei fünf vorhandenen, aktiven Zeilen. Die clientseitige
> Abfrage in `IntegrationMarketplaceView.tsx` lief deshalb immer leer, ohne
> Fehlermeldung (`if (!error) …` verschluckt sie). Behoben durch
> `20260831030000_integrations_catalog_read_access.sql`: Leserecht für
> `authenticated`, Policy auf `enabled is true`, kein Schreibrecht. Die
> Tabelle ist ein globaler Produktkatalog ohne `tenant_id` und ohne
> Zugangsdaten — die liegen in `connectors`.
>
> **Der wiederkehrende Befund ist nicht die Zahl, sondern das Muster.** Nach
> dem ACL-Vorfall vom 2026-08-23 ist dies der zweite und dritte belegte
> Eingriff direkt in Produktion, vorbei an Repo und CI. Für ein Produkt, das
> Prüfpfad und Nachvollziehbarkeit zusagt, ist jede solche Änderung ein
> Governance-Befund, unabhängig davon, wie gut sie inhaltlich ist.
>
> #### Die Guards hatten recht, bevor die Messung lief
>
> Am 2026-08-30 nachträglich geprüft: **Die Automatik hatte alles schon
> gefunden.** Die manuelle Messung hat nichts entdeckt, was die Drift-Guards
> nicht Tage vorher gemeldet hätten — sie hat nur jemanden gefunden, der
> hinsieht.
>
> | Guard | Stand | Befund |
> |---|---|---|
> | `Migration Drift Guard` | rot **seit 2026-08-26**, fünf Tage | nennt `20260825204748` und `20260829011038` namentlich |
> | `Edge Function Drift Guard` | rot **seit 2026-08-29** | `ORPHAN: onboarding-orchestrator`, inkl. Handlungsanweisung |
> | `Function ACL Drift Guard` | durchgehend grün | prüft Funktions-Grants, **nicht** RLS-Flags auf Tabellen → blinder Fleck, kein Versagen |
>
> Beide roten Guards nannten exakt den Fix, für den sich die Sitzung dann
> unabhängig entschieden hat: „Quelle ins Repo committen".
>
> **Die Betriebsfolge, die dabei fast untergegangen wäre**: Solange
> Migrations-Drift offen ist, bricht `supabase db push` vollständig ab —
> dann erreicht **keine** Migration mehr die Produktion, auch keine
> unbeteiligte. Der Guard sagt das in seinem eigenen Protokoll.
>
> **Daraus folgt nicht „mehr Prüfungen bauen", sondern „Befunde zustellen".**
> Ein roter Scheduled-Run erzeugt bestenfalls eine E-Mail, die niemanden
> erreicht, der handelt. Deshalb `.github/workflows/drift-alert.yml`: Es
> beobachtet die drei Guards per `workflow_run` und legt bei Rot ein
> GitHub-Issue an (bzw. kommentiert ein bestehendes, statt ein zweites zu
> öffnen); wird der Guard wieder grün, schließt es das Issue selbst. Die
> Guards bleiben unverändert — ihre Aufgabe ist Messen, nicht Melden.
>
> **Nächste Sitzung, bevor du misst**: Sieh in den Actions-Tab. Ein roter
> Drift-Guard ist der schnellere Weg zum Befund als jede eigene Messung.
>
> ¹ **Migrations-Lücke und Versionskollision, gemessen 2026-08-24** (Ledger via
> `supabase_migrations.schema_migrations`, Deploy-Log Run 32705231581): PR #1131
> und PR #1124 vergaben unabhängig voneinander dieselbe Version `20260826000000`
> (`whatsapp_channel` bzw. `restore_client_function_grants`) — die PR-CI konnte
> das nicht sehen, weil beide gegen eine `main`-Basis ohne die jeweils andere
> Datei liefen. Der `deploy.yml`-Lauf nach dem #1124-Merge scheiterte daran
> (CLI führte `whatsapp_channel` erneut aus → `42710`, Trigger existiert).
> Fix: `restore_client_function_grants` → `20260826000001` umbenannt. Die zwei
> unverbuchten Migrationen (`20260826000001`, `20260827000000`) sind inhaltlich
> bereits wirksam (out-of-band-Hotfix, per ACL-Messung belegt); es fehlt nur die
> Verbuchung durch den nächsten grünen Deploy. Lehre: Vor dem Merge eines PRs
> mit Migration die Versionsnummer gegen den **aktuellen** `main`-Stand prüfen,
> nicht gegen die PR-Basis.
>
> **Diese Aussage galt am 2026-08-24 und gilt nicht mehr.** Die Messung vom
> 2026-08-30 oben zeigt eine deployte Function ohne Verzeichnis
> (`onboarding-orchestrator`). In der anderen Richtung stimmt es weiterhin:
> Es gibt keine Function im Repo, die nicht deployt wäre. Das war ein
> Momentzustand, kein Naturgesetz: Der
> nächste Merge, der eine Function hinzufügt, öffnet die Lücke wieder, bis
> `deploy.yml` gelaufen ist.
>
> **Die Function-Lücke ist geschlossen.** Frühere Stände dieser Datei nannten
> „103 deployt, 74 fehlend" und erklärten das mit dem Kontingent des
> Free-Tarifs (`HTTP 402: Max number of functions reached`). Diese Erklärung
> ist überholt. Die Vermutung einer harten Schranke bei 100 hat sich
> erledigt — sie war schon beim Deploy von Function 101 (`siteos`) widerlegt.
>
> **Auch die Migrations-Lücke von damals ist geschlossen.** `20260821000000_b2_website_asset_relation`
> ist angekommen; am Schema geprüft, nicht aus der Liste geschlossen:
> `websites.governance_asset_id`, `scan_runs.asset_id` und der Constraint
> `findings_scan_run_fk` existieren live.
>
> **Was daraus für die Arbeitsweise folgt.** Zweimal stand hier eine
> Erklärung, die aus einer Beobachtung geschlossen war (erst der alphabetische
> Schnitt, dann das Tarif-Kontingent), und zweimal war sie falsch. Beide Male
> hätte eine Messung die Frage sofort beantwortet. Deshalb: messen, nicht
> herleiten — und die Messung mit Datum und Methode hinschreiben, damit die
> nächste Sitzung sie prüfen statt glauben muss.
>
> **ACL-Vorfall 2026-08-23**: Ein Out-of-Band-Bulk-Revoke (nicht aus dem Repo,
> Actor unbekannt, älter als das 24h-Log-Fenster) hatte ~160 `public`-Funktionen
> in Prod auf `{postgres, service_role}` reduziert und `update_onboarding_progress`
> gedroppt — Symptom: „permission denied for function is_tenant_member" auf
> /welcome, damit RLS für alle eingeloggten Nutzer kaputt. Repariert durch
> `20260826000001_restore_client_function_grants.sql` (gezielte Grants nur für
> Client-Rollen, interne Funktionen bleiben gesperrt). Konsequenz: Auch
> Funktions-ACLs gehören zur Drift-Prüfung, nicht nur Existenz von Functions
> und Migrationen — seitdem geprüft durch `npm run check:function-acls`
> (`.github/workflows/function-acl-drift.yml`, täglich 06:30 UTC; Soll-Listen
> im Skript nachziehen, wenn eine Migration Client-Grants ändert).
>
> Der Free-Tarif bleibt davon unberührt und bleibt ein eigener Befund: keine
> täglichen Backups, kein Point-in-Time-Recovery, kein SLA, Projekt-Pausierung
> bei Inaktivität. Für ein Produkt, das Prüfpfad, Evidence-Hash-Ketten und
> ISO-orientierte Prozesse zusagt, ist das unabhängig von jedem Limit ein
> Problem.
>
> Ein Modul, dessen Backend nie deployt wurde, ist in Produktion **nicht**
> verfügbar, egal wie vollständig der Code im Repo ist. Vor Aussagen zum
> Produktionsstand daher gegen `src/config/production-edge-functions.ts` bzw.
> `supabase functions list` prüfen.

- **Audit** (95%) — DSGVO-Scan, Recheck-Cron, Email-Drip, Share-Token
  > ⚠️ **Ausfall 2026-08-11 bis 2026-08-30, behoben.** `gdpr-audit/index.ts`
  > rief sechs nirgends definierte Funktionen auf — im Repo **und** in
  > Produktion (Version 46). Jeder `/audit`-Aufruf endete in HTTP 500;
  > `gdpr_audits` blieb 18 Tage bei 159 Zeilen.
  >
  > **Ursache — geschlossen.** Ein Gate gab es, aber es konnte diesen Fall
  > nicht sehen: `check:edge-syntax` ist bewusst ein reiner Parse-Check, und
  > eine Datei, die `runChecks(...)` aufruft, ohne dass `runChecks`
  > existiert, ist syntaktisch einwandfrei. Die Lücke lag **oberhalb** des
  > Syntax-Gates, bei der Auflösung der Namen — geschlossen durch
  > `check:edge-refs` (`f94ebf4`).
  >
  > **Zwei unabhängige Rekonstruktionen.** Der Ausfall wurde zweimal
  > behoben: `2305e3f` (auf `main`, live) und PR #1167. Aufgelöst nach
  > Entscheid des Eigentümers vom 2026-08-31 — **Struktur von `2305e3f`
  > (`gdpr-audit/checks.ts`), Vertrag aus der Messung**: Befund-Vokabular,
  > Severities und Scoring-Gewichte (25/12/6/2/0) stammen aus den 159
  > historischen Audits, festgehalten in
  > `test/fixtures/gdpr-audit-production-contract.json`.
  >
  > Die zweite Fassung wich in 12 Codes ab und liess 19 weg (darunter alle
  > sieben Unterseiten-Prüfungen). Schwerer wog ein stiller Fehler: Sie gab
  > die Fakten **flach** (`{'consent.banner.detected': true}`) statt
  > verschachtelt zurück. `getFact()` in `_shared/rules/evaluator.ts` zerlegt
  > den Pfad an den Punkten — flach liefert das `undefined`, und die
  > **gesamte Rule Engine (14 Regeln, DSGVO und AI Act) schwieg**, ohne dass
  > etwas bricht. Beleg: 61 von 159 historischen Audits trugen einen
  > `rule:`-Befund, die drei vom 2026-08-31 keinen einzigen.
  >
  > **Regel daraus**: Befund-Codes, Severities und Scoring-Gewichte sind
  > versionsrelevant. Wer sie ändert, entscheidet über die Vergleichbarkeit
  > aller bisherigen Kundenberichte — das gehört entschieden, nicht
  > nebenbei. Hergang: `docs/product/free-scan-recovery.md`.
- **Policy Packs** (100%) — DSGVO, EU AI Act, branchenspezifisch; Auto-Empfehlung nach Tenant-Branche
- **Evidence Vault** (90%) — Ingestion, Retrieval, Hash-Chain-Verifizierung, PDF/JSON-Export, Compliance-Hold
- **Governance Runtime** (85%) — Sentinel-Loop, SLO-Tracking, Auto-Mapping (Asset → Control-Status), Incident-Dispatch
- **Provenance / C2PA** (80%) — Ed25519-Signatur, Custody-Auto-Capture, externe Verifizierung
- **Memory Governance / RFC-003** (Phase 3, im Repo vollständig) — temporaler Verfall,
  Klassifikations-Unveränderlichkeit, Aufbewahrung mit Holds. Tabelle `governance_memory`,
  Zustandsautomat `active → cooling → archived → expired → purged`.
  Edge Functions: `governance-memory` (User-API), `memory-decay-worker` (stündlicher Cron),
  `memory-confidence-trigger` (Re-Bewertung bei neuer Evidence).
  UI: `/app/governance/memory`. Spezifikation: `docs/architecture/governance-memory-policy-rfc.md`.
  **Regel**: Die Schwellen (0.5 / 0.2 / 0.8), Aufbewahrungsklassen und Grace-Perioden
  stehen doppelt — in `src/core/governance/rfc003-memory.ts` und in der Migrations-SQL.
  Nie einseitig ändern; `test/governance/rfc003-sql-parity.test.ts` bricht sonst.
  **Betrieb**: Der Decay-Worker tickt nur, wenn der pg_cron-Job `memory-decay-hourly`
  registriert ist (Migration `20260819000000`) — ohne ihn verfällt kein Memory.
  **Registriert reicht aber nicht**, und genau darauf hat dieser Satz vertraut:
  Am 2026-09-01 gegen die Live-DB gemessen ist der Job seit dem 2026-08-12
  registriert, aktiv **und in allen 470 Läufen gescheitert** — das Vault-Secret
  `service_role_key` fehlt (siehe `20260820000000_cron_dispatch_fix.sql`).
  In Produktion verfällt heute kein Memory. Ohne Schaden, weil
  `governance_memory` leer ist, aber die Zusage steht ungedeckt.
  Prüfen also nicht an `cron.job`, sondern an `cron.job_run_details.status`.

### Enforcement-Schalter — der PDP entscheidet erst, wenn jemand ihn lässt

Seit P2 hängen fünf Pfade am PDP. **Alle stehen auf Beobachtung**; das ist der
beabsichtigte Zwischenzustand aus P0, aber eben keine Durchsetzung:

| Schalter | Wirkt auf | Vorgabe | In `enforce` |
|---|---|---|---|
| `AI_GATEWAY_ENFORCEMENT` | `ai-gateway` | `shadow` | blockt |
| `AGENT_PDP_ENFORCEMENT` | Agent-Runtime | `shadow` | fail **closed** |
| `SITEOS_PUBLISH_PDP` | Publish Gate (P2-3) | `shadow` | fail **closed** (§7 G3) |
| `GOVERNANCE_PDP_MODE` | CI/CD-Gate (P2-4) | `shadow` | verschärft nur |
| `BOT_PDP_ENFORCEMENT` | Chat · WhatsApp · Voice (P2-5) | `shadow` | fail **closed**, per `BOT_PDP_FAILURE_MODE=allow` umstellbar |

**Vor dem Umschalten `pdp_shadow_log` auswerten** — dafür ist der
Beobachtungsbetrieb da. Und zwar wirklich auswerten: Die Tabelle blieb für den
Publish Gate bis zum 2026-09-04 leer, weil der Aufruf falsch war und der
Fehler in einem `catch` verschwand. Ein leeres Shadow-Protokoll bedeutet nicht
„keine Abweichungen", sondern zuerst „nachsehen, ob überhaupt geschrieben
wird".

**Zur Bot-Governance (P2-5)**: Chatbot, WhatsApp und Voice laufen durch **einen**
PEP (`_shared/pdp/botmessage.ts`, `enforceBotMessage()`) — drei eigene Auslegungen
derselben Regel wären der Fragmentierungsbefund eine Ebene tiefer. Den Prozess
verlassen nur Merkmale: Kanal, Bot-ID, Signalnamen und Zähler. **Nie der
Nachrichtentext** — `bot-chat` und `whatsapp-webhook` laufen mit `verify_jwt = false`,
der Text stammt also von einem beliebigen Fremden und wäre sonst ein Hebel auf die
Bewertung der eigenen Anfrage. Gesichert durch `test/governance/pdp-botmessage.test.ts`
und `test/governance/bot-pep-wiring.test.ts` (Letzterer prüft am Quelltext, dass alle
drei Kanäle denselben PEP **vor** dem Modellaufruf rufen — dass sie sich gleich
verhalten, ist kein Beleg dafür, dass sie dieselbe Stelle benutzen).

**Offen, weil Produktentscheidung**: Eine vom PDP gesperrte Bot-Nachricht verbraucht
trotzdem eine Einheit von `limit.bot_messages_monthly` — das Kontingent wird vor der
Prüfung gebucht. Ob eine blockierte Anfrage berechnet wird, gehört entschieden.

### Dashboard-Module (modulare Reihenfolge)
1. **Agent Registry** — Liste, Status, Risiko, Details
2. **Agent Identity** — Ownership, Permissions, Credentials
3. **Runtime Monitoring** — Sessions, Events, Tool Calls
4. **Policy Engine** — Regeln, Enforcement, Violations
5. **Audit System** — Immutable Logs, Hash Chains, Evidence
6. **Observability** — Metrics, Costs, Performance
7. **Integrations** — APIs, Webhooks, External Providers

---

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
│   ├── functions/     185 Edge Functions (einziger Ort für Service-Role-Keys)
│   └── migrations/    321 Migrations
├── apps/
│   └── agent-runtime/ Agent Runtime (Node/TS, Docker)
├── services/          runtime-core · evidence-runtime · openclaw-agent · playwright-scanner
├── packages/sdk       Öffentliches SDK (CJS + ESM)
├── connectors/        Externe Integrationen
├── deploy/ docker/ infra/ VPS-Stack (Traefik, Ollama, n8n)
├── platform/          🏗️ **WEBSITE BUILDER MONOREPO** (siehe unten)
├── scripts/           Build-, Release-, QA-Skripte
└── test/ tests/ e2e/  Vitest + Playwright
```

### 🏗️ Platform-Monorepo (`platform/`) — Website Builder + Governance

In-sich-geschlossener Microservice-Stack für **automatisierte Website-Generierung mit Compliance-Gating**:

**Struktur:**
```
platform/
├── builder_orchestrator/    Python/FastAPI — AI-App-Builder
│                             • Multi-Agent-Task-Graph
│                             • BuildSpec → Code-Generierung
│                             • OpenAPI: /docs
├── governance_backend/       Python/FastAPI — Risk & Compliance Engine
│                             • EU-AI-Act-Konformität
│                             • CI/CD-Gate-Engine
│                             • Audit-Log + Telemetrie
├── nextjs_frontend/          Next.js — Builder-Cockpit + Governance-UI
├── migrations/               SQL-Migrations (Postgres)
├── docker-compose.yml        Lokale Orchestrierung (alle 4 Services)
└── README.md                 Workflow, API-Nutzung, Start-Guide
```

**Start (lokal):**
```bash
cd platform
cp .env.example .env
docker compose up --build
```

**Zugang:**
- Builder-API: http://builder.localhost/docs (Port 8001)
- Governance-API: http://rsd.localhost/docs (Port 8002)
- Frontend: http://app.localhost (Port 3000)
- Traefik-Dashboard: http://localhost:8080

**Zweck:** Die Seite wird **weder** von der Root-package.json noch vom Root-npm noch in den
Root-CI/CD-Workflows verwaltet. Sie ist physisch ein eigenständiges Projekt, das
`docker compose` koordiniert. Änderungen dort brauchen weder `npm run lint` noch
`npm run build` in der Root — nur Docker.

**Modifikationen im `platform/`:**
- Keine Node-Dependencies (alles Python/Deno)
- RLS + Migrations wie im Hauptrepo (selbe DB-Conn in `docker-compose.yml`)
- OpenAPI-First: Endpoints mit `@app.post`, `@app.get` + Schemas in Pydantic
- Prüfpfad: `audit_log` + `workflow_runs` (selbe Tabellen wie Root-Governance)
- **Der PDP ist auch hier der Entscheider** (P2-4, seit 2026-09-04):
  `app/services/pdp_client.py` ruft `governance-decide`; die CI/CD-Gate-Engine
  faltet das Verdikt in ihre Entscheidung ein. Der PDP kann nur **verschärfen**,
  nie lockern — ein `allow` hebt keine lokale Sperre auf.
  `GOVERNANCE_PDP_MODE=off|shadow|enforce`, Default `shadow`.
- **Tests hier laufen mit `pytest`, nicht mit Vitest**:
  `cd platform/governance_backend && pip install -r requirements.txt && pytest`.
  Stand 2026-09-04: 93 passed, 14 skipped, **7 vorbestehend rot** in
  `test_config.py` und `test_security_headers.py` (erwarten Umgebungsvariablen
  bzw. eine Datenbank). Gegen den unveränderten Stand gegengeprüft — wer hier
  arbeitet, sollte sie nicht für eigene Fehler halten.

### Preise, Pläne und Berechtigungen

`shared/pricing.ts` ist die **einzige** Quelle für Plan-Namen, Preise,
Runtime-Limits, Module, Berechtigungen, Feature-Listen und Add-ons.
`src/config/pricing.ts` ist nur noch eine Projektion davon.

- Änderungen ausschließlich in `shared/pricing.ts`, danach `npm run sync:pricing`
- `npm run check:pricing` prüft Deno-Zwilling und DB-Katalog gegen die Quelle
- Zugriff **nie** über Plan-Namen (`if (plan === 'agency')`), sondern über
  `hasPermission()`, `hasModule()`, `limitOf()`
- Es gibt genau sechs **Abo-Pläne**: Free Audit · Starter · Growth · Agency ·
  Enterprise · Partner. Der Name „Scale" ist untersagt.
- Seit AP2 (2026-08-24) trägt jeder Plan zusätzlich `availability`:
  `self_service` (Free, Starter, Growth) · `contract` (Enterprise) ·
  `legacy` (Agency, Partner). Das ist **nicht** dasselbe wie `purchaseMode`:
  Jenes sagt, welche Art Stripe-Session entsteht, dieses, ob der Plan heute
  noch neu gewählt werden darf. Stillgelegte Pläne behalten Produkte, Preise,
  Entitlements und laufende Abos vollständig — sie stehen weiterhin in
  `PLAN_ORDER`, damit Rangvergleiche für Bestandskunden stimmen.
  **Verkaufslisten nehmen `SALES_PLANS` bzw. `SELF_SERVICE_PLANS`, nie
  `ORDERED_PLANS`.** Einzelheiten: `docs/product/ap2-paketumbau.md`.
- Daneben gibt es **Einmalprodukte** (`purchaseMode: 'one_time'`), derzeit
  Governance Launch (349 € einmalig). Sie sind kein Rang der Abo-Leiter:
  nicht in `PLAN_ORDER`, Preis in `price.oneTimeEur`, Persistenz als Grant in
  `entitlement_grants` (nicht `subscriptions` — dort gilt „genau ein Abo pro
  Tenant"), Anzeige über `ONE_TIME_PRICING_TIERS`.

- Bei **Kontingenten** (Zahlenwerte) hängt die kanonische Quelle seit dem
  2026-08-25 an der **Planart**: für Self-Service und öffentlich verkaufte
  Pläne gilt `plan.limits.*` (die Preisseite), für Vertragspläne
  (`availability: 'contract'`, heute Enterprise) gilt **der Vertrag**.
  `PLAN_ENTITLEMENTS['limit.*']` ist in beiden Fällen nur eine Ableitung.
  Seit dem **2026-08-31** ist die Kodierung für Vertragspläne festgelegt
  (Option A): dort bedeutet `-1` bei einem `limit.*`-Key **„das System
  begrenzt hier nicht, der Vertrag tut es"**. Die Quelle ist damit *benannt*,
  nicht *aufgelöst* — der Vertrag liegt dem System weiterhin nicht vor, es
  gibt keine Tabelle für tenant-spezifische Werte, und auf diesen acht
  Feldern ist **kein Gate erlaubt**. Ein Vertragsplan trägt deshalb
  ausschließlich `-1`; ein endlicher Wert wäre eine technisch durchgesetzte
  Obergrenze, die unter A nicht abbildbar ist. Der erste Enterprise-Vertrag
  mit vereinbarter Obergrenze ist der benannte Auslöser für Option B
  (Tenant-Overrides) — festgehalten in
  `test/billing/limit-canonicity.test.ts`. Beide Seiten
  weichen heute in 18 von 38 Paaren ab; `npm run check:limits` verhindert
  **neue** Divergenzen (Ratsche, Grundlinie in
  `scripts/limit-canonicity-baseline.json`). Es waren 21 — die drei Kürzungen
  auf Starter und Growth sind am 2026-09-01 an die Preisseite angeglichen
  worden, nachdem gemessen war, dass sie niemanden treffen (§4 Klasse B). **Kein neues Enforcement gegen
  einen divergierenden Wert**, solange er nicht bereinigt ist — und keine
  stillschweigende Kürzung bei Bestandskunden. Diff und Entscheidung:
  `docs/product/kanonische-kontingente.md` §1.2a,
  `docs/product/enterprise-quelle-entscheidungsvorlage.md`.

- **Add-ons** (seit 2026-09-01) sind Positionen des Stripe-Abos: `AddOn.grants`
  in `shared/pricing.ts` nennt die Keys, der Generator erzeugt daraus
  `products`/`product_entitlements`, die Function `subscription-addons` bucht
  und kündigt, `tenant_entitlements()` **addiert** Kontingente aus Add-on-Grants
  auf den Plan. Buchbar ist ein Add-on erst, wenn `plan_addons.stripe_price_id`
  eine echte Price trägt — das ist ein Betreiberschritt mit Freigabe. Vertrag
  und offene Entscheidungen: `docs/product/addon-booking.md`.
- **Dashboard-Gates** kommen aus **einem** Register:
  `src/core/access/featureAccess.ts` (Route → Entitlement-Key), geprüft von
  `RouteEntitlementGate` in der `GovernanceBrowserShell`. Neue bezahlte
  Fläche = ein Eintrag dort; `test/core/feature-access.test.ts` hält Register,
  `App.tsx` und Navigation zusammen. Kein Gate gegen einen divergierenden
  Kontingent-Wert.

Vollständige Regeln: `docs/product/pricing-governance.md`

### Routing-Struktur
- `/` → MainLanding (**Design eingefroren**, Ergänzen frei, Ändern nur nach Rückfrage — siehe §10)
- `/app/*` → Auth-gated Dashboard (Onboarding-First-Gate)
- `/flow/*` → Seitenbasierter Flow (Trial, Onboarding, Assessment)
- `/governance/*` → Public Features (Runtime, Docs, Score, Browser)
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

**2026-08-19 — Enterprise-Ebene der Startseite**

| Frage | Antwort |
|---|---|
| 1. Zweiter Akzent (Champagner/Gold) als neues Token, nur für VIP-Flächen | **Nein** |
| 2. Neues Materialbild für bestehende Panels (Glas, Haarlinien, gestaffelte Schatten) | **Ja** |
| 3. Eigene Enterprise-Sektion plus gestaffeltes Einblenden und Parallax auf der Weltkugel | **Ja** |

Zur ersten Frage kam der Zusatz „komplett next level Frontend und allgemeines
Webdesign". Der Umfang ist damit **breiter** als die drei Fragen, aber die
Farbentscheidung steht: Es bleibt bei Cyan auf Obsidian, ein zweiter
Farbakzent ist ausdrücklich abgelehnt.

Umgesetzt: `.surface-panel` / `.hairline` und die Reveal-Regeln in
`src/index.css`, `src/hooks/useStagedReveal.ts`, `src/hooks/useHeroParallax.ts`,
`src/components/landing/EnterpriseAccessSection.tsx`.

Was **nicht** freigegeben ist und weiterhin unter §10.1 fällt: Sektionsreihenfolge,
Grid, Typografie-Skala, Icon-Set, Farbpalette.

**2026-08-23 — CTA-Hierarchie der Startseite auf den Scan-Trichter**

Freigegeben durch die ausdrückliche Anweisung des Eigentümers im Auftrag
„Landingpage / Scan / Dashboard / Marketplace Refactor" (§2 und §24: „Der
wichtigste CTA der Landingpage ist: Website kostenlos scannen", Priorität 1
Scan, 2 Demo, 3 Preise).

Umfang — und **nur** dieser:

| Was | Vorher | Nachher |
|---|---|---|
| Reihenfolge im Hero | Schaltflächenreihe, darunter Scan-Formular | Scan-Formular zuerst, Schaltflächenreihe darunter |
| „Präsenz & App bauen" | gefüllte Fläche (primär) | Umriss (sekundär) — Text und Ziel unverändert |
| Scan-Schaltfläche | „Audit starten" | „Website kostenlos scannen" |
| Ziel des Scan-Formulars | `/unified-entry/scan` | `/scan` |
| Navigation oben rechts | „Free Audit starten" → `/unified-entry/scan` | „Kostenlos scannen" → `/scan` |

Nicht berührt und weiterhin gesperrt: Farben, Typografie, Grid,
Sektionsreihenfolge der Seite, Icon-Set, sämtliche Abschnitte unterhalb des
Hero. `/unified-entry/scan` bleibt bestehen und erreichbar — es ist nur nicht
mehr das Tor von der Startseite aus.

Damit ist auch die seit Phase 1 offene Freigabe aus
`docs/product/reality-matrix.md` §5.1 erteilt: Der Scan führt jetzt in den
Trichter statt in die Gestaltungsauswahl.

**2026-08-23 (2) — Landing-CTA von `/scan` auf `/audit`**

Auf die Fragepflicht nach §10.3 („Achtung, Funktionsänderung — sollen wir dies
machen?") hat der Eigentümer ausdrücklich mit **Ja** geantwortet, mit der
Begründung: „Das ist zwar eine Funktionsänderung, aber eine gewollte
Produktkorrektur, keine kosmetische Änderung. Der Funnel soll künftig eindeutig
sein. Nicht zwei parallele Scan-Einstiege weiter mitschleppen."

Umfang — und **nur** dieser:

| Was | Vorher | Nachher |
|---|---|---|
| Ziel des Scan-Formulars im Hero | `/scan` | `/audit` |
| Navigation oben rechts, „Kostenlos scannen" | `/scan` | `/audit` |

Die Freigabe vom selben Tag (Reihenfolge im Hero, Umriss statt Fläche,
Beschriftung „Website kostenlos scannen") bleibt unverändert gültig — es ändert
sich allein das Ziel. Farben, Typografie, Grid, Sektionsreihenfolge und
Icon-Set sind unberührt.

Die Freigabe wird **wirksam mit dem Schnitt von PR #1129**, weil `/scan` erst
dann entfällt. Hintergrund und Zielmatrix:
`docs/architecture/canonical-builder-target-matrix.md`.

**2026-08-24 — AP2, Paketumbau auf drei Self-Service-Stufen**

Freigegeben durch die ausdrückliche Anweisung des Eigentümers: „Paketmodell auf
drei bezahlte Pakete umbauen · `policy.packs` ab Starter · WhatsApp als
99-€-Add-on · AP1 als kanonische Entitlement-Basis verwenden · die beiden in
AP1 sichtbar gewordenen Widersprüche gezielt bereinigen."

Zwei Änderungen an bereits Sichtbarem sind darin enthalten und damit gedeckt:

| Was | Vorher | Nachher |
|---|---|---|
| WhatsApp-Kachel in `/app/marketplace` | 39 € | **99 €** — derselbe Betrag wie das Add-on |
| CTA der Enterprise-Karte | `/checkout/enterprise` | `/contact-sales?plan=enterprise` |

Alles Übrige ist Datenschicht: Entitlements, Katalog, Berechtigungen.

**2026-08-24 (2) — Preisseite auf drei Stufen**

Auf die Fragepflicht nach §10.1 (Grid) und §10.3 (Text) hat der Eigentümer
mit drei ausdrücklichen **Ja** geantwortet:

| Frage | Antwort |
|---|---|
| 1. Raster von fünf auf drei Spalten (`lg:grid-cols-5` → `lg:grid-cols-3`) | **Ja** |
| 2. Teaser-Überschrift ohne Agency und Partner | **Ja** |
| 3. Agency und Partner ganz aus dem Verkauf nehmen | **Ja** |

Umfang — und **nur** dieser:

| Was | Vorher | Nachher |
|---|---|---|
| Spaltenzahl in `PricingPage`, `PricingTeaserSection`, `RuntimeActivationSection`, `PlanSelector`, `GovernanceBotsSection`, `BillingView`, `UnifiedPricingGrid` | `lg:grid-cols-5` | `lg:grid-cols-3` |
| Überschrift `PricingTeaserSection` | „Free Audit · Starter · Growth · Agency · Enterprise · Partner" | „Free Audit · Starter · Growth · Enterprise" |
| Anzeige-Listen | `PUBLIC_PRICING_TIERS` / `ORDERED_PLANS` | `SELLABLE_PRICING_TIERS` / `SALES_PLANS` |

Kartengröße, Farben, Typografie, Abstände, Icon-Set und Sektionsreihenfolge
sind unberührt. Rangvergleiche (`PlanUpgradeModal`, `planRank()`) laufen
weiterhin über die vollständige Leiter — sonst bekäme ein Bestandskunde auf
Agency falsche Antworten. Hintergrund: `docs/product/ap2-paketumbau.md` §7.

**2026-08-30 — Texte und Buttons an die Route- und Pricing-Infrastruktur**

Auf die Fragepflicht nach §10.3 hat der Eigentümer dreimal mit **Ja**
geantwortet:

| Frage | Antwort |
|---|---|
| 1. Erfundene Plannamen (Scale, Pro, Business, Premium) auf echte Plannamen korrigieren | **Ja** |
| 2. Legacy-Pläne (Agency, Partner) auf die verkäuflichen Stufen umstellen | **Ja** |
| 3. Falsche Kontingente auf `/agenturen-conversion` an die SSoT angleichen | **Ja** |

Umfang — und **nur** dieser: Beschriftungen, Fließtext und Link-Ziele. Kein
Layout, kein Grid, keine Farben, keine Typografie, keine Sektionsreihenfolge.

Die Zuordnung ist aus `shared/pricing.ts` abgeleitet, nicht gewählt:
White-Label (`whitelabel.reports`) gibt es nur in Agency, Enterprise und
Partner — davon ist Enterprise der einzige verkäufliche Plan, deshalb geht
jede White-Label-Aussage dorthin. `provenance.advanced`, `bulk.jobs`,
`scheduler.enabled` und `evidence.advanced` beginnen bei Growth,
`policy.packs` seit AP2 bei Starter, die Kodee-Tools (`ai.tool.vps_*`) bei
Agency und damit verkäuflich erst bei Enterprise.

**2026-08-30 (2) — WhatsApp-Preisseite auf drei Stufen**

Auf die Drei-Fragen-Regel nach §10.4 hat der Eigentümer dreimal mit **Ja**
geantwortet:

| Frage | Antwort |
|---|---|
| 1. Karte „Agency WhatsApp" (699 €) aus `WHATSAPP_TIERS` entfernen | **Ja** |
| 2. Raster von `lg:grid-cols-4` auf `lg:grid-cols-3` | **Ja** |
| 3. Agency-Nennung in der FAQ derselben Seite auf Enterprise ziehen | **Ja** |

Umfang — und **nur** dieser:

| Was | Vorher | Nachher |
|---|---|---|
| Tarifkarten | Starter · Growth · Agency · Enterprise | Starter · Growth · Enterprise |
| Raster der Tarifsektion | `lg:grid-cols-4` | `lg:grid-cols-3` |
| FAQ „Setup-Dauer" | „Agency/Enterprise: Dedicated Onboarding" | „Enterprise: Dedicated Onboarding" |

Damit entfällt `/checkout/agency?channel=whatsapp` — die letzte Stelle im
Frontend, an der ein Legacy-Plan über Self-Service kaufbar war. Nichts geht
verloren: Die Enterprise-Karte führt bereits mehr Bots (20 statt 10), mehr
Antworten (50.000 statt 25.000) und White-Label. Kartengröße, Farben,
Typografie, Abstände, Icon-Set und Sektionsreihenfolge sind unberührt; die
beiden anderen Raster der Seite (`md:grid-cols-2`, `md:grid-cols-3`) ebenso.

**2026-08-30 (3) — DORA-Karte als „In Vorbereitung"**

Auf die Fragepflicht nach §10.3 hat der Eigentümer entschieden, die Karte
zu behalten und als noch nicht verfügbar auszuweisen, statt sie zu
entfernen. `path` ist jetzt `null` statt `/app/governance/dora` — diese
Route existiert im Repo nicht —, die Karte navigiert nicht mehr und trägt
das Abzeichen „In Vorbereitung". Das Schloss-Symbol entfällt dort, weil es
„per Tarif gesperrt" bedeutet und nicht „noch nicht gebaut". Kartenzahl und
Raster bleiben unverändert.

**Korrektur am selben Tag**: Die vier CTAs, die AP2 folgend auf
`/contact-sales?plan=enterprise` gelegt worden waren, lesen sich dort nicht
— `src/pages/ContactSales.tsx` wertet `tier`, `source` und `intent` aus,
**nicht** `plan`. Sie tragen jetzt `?tier=enterprise`. Der Eintrag zu AP2
oben nennt weiterhin `plan=enterprise`; das ist die dort dokumentierte
Absicht, nicht der Parameter, den die Seite liest.

**Erledigt, gemessen am 2026-08-31**: Der hier zuvor als offen geführte
Punkt zu `/realsync-landing` („fünf Plan-Karten mit hart codierten Preisen
im JSX, inklusive Agency und Partner") trifft auf den Code nicht mehr zu.
`src/marketing/landing/RealSyncDynamicsLanding.tsx` führt vier Karten —
Free Audit · Starter · Growth · Enterprise —, die Beträge kommen aus der
Quelle (`planById('starter').price.monthlyEur`, ebenso Growth), Agency und
Partner sind als Karten entfallen, Enterprise steht auf „Auf Anfrage".

**2026-08-31 — Build Studio: Speicherort und Übernehmbarkeit an den Sitzungsmodus**

Auf die Fragepflicht nach §10.3 hat der Eigentümer zweimal mit **Ja**
geantwortet:

| Frage | Antwort |
|---|---|
| 1. Textänderung: Den Satz zum Speicherort des Entwurfs an `session.mode` koppeln | **Ja** |
| 2. Funktionsänderung: „Website übernehmen" im Rückfallmodus sperren | **Ja** |

Umfang — und **nur** dieser, in `src/unified-entry/pages/BuildStudioPage.tsx`:

| Was | Vorher | Nachher |
|---|---|---|
| Hinweis zum Speicherort | fest „Der Entwurf liegt nur in diesem Browser." | je Modus: serverseitig gespeichert (`server`) bzw. nur im Browser (`local`) |
| „Website übernehmen" | immer aktiv | im Modus `local` deaktiviert, mit Begründung als `title` |
| Abzeichen im Kopf | — | neu: „Nur lokal — nicht übernehmbar", nur im Modus `local` |

Anlass ist kein Geschmack, sondern zwei Falschaussagen der Oberfläche. Der
feste Satz behauptete den **falschen Speicherort für Kundendaten**: Im
Servermodus liegt der Entwurf in `siteos_anonymous_builds` und wird beim
Claim nur verschoben — so sagen es `buildSession.ts` und `SiteOsClaimView.tsx`
übereinstimmend. Und der CTA lud im Rückfall zu einer Übernahme ein, die es
nicht gibt: `/app/siteos/claim` schickt zuerst nach `/welcome`, der Besucher
legt ein Konto an und erfährt **erst danach**, dass serverseitig keine
Sitzung existiert. `buildSession.ts` verlangt ausdrücklich das Gegenteil.

Farben, Typografie, Grid, Abstände, Icon-Set und Sektionsreihenfolge sind
unberührt; das Abzeichen nutzt die im Repo vorhandene Amber-Warnoptik. Der
Rückfall selbst bleibt, was er ist: Übergang, kein Dauerzustand — sobald der
anonyme Pfad überall ausgerollt ist, entfallen Sperre und Abzeichen mit ihm.
Gesichert durch `test/siteos/claim-moves-not-rebuilds.test.ts`.

**2026-09-01 — Vorschau-Inhalte: nichts behaupten, was der Scan nicht hergibt**

Anlass war ein Screenshot des Eigentümers: Die Live-Vorschau einer
AI-Governance-Plattform warb mit **„Termin anfragen"** und versprach unter
„Warum wir" eine **„Persönliche Betreuung — Feste Ansprechpartner statt
Warteschleife."** Urteil: „Das ist komplett am Ziel vorbei."

Zu Recht. Beide Texte standen fest in `blueprint/synthesize.ts` (Zeilen 157
und 177–181) und gingen unverändert an **jeden** Kunden **jeder** Branche.
Sie stammten nicht aus der gescannten Website. Für nahezu jeden Empfänger
waren sie damit falsch.

Auf die Fragepflicht nach §10.3 hat der Eigentümer entschieden: **„Ja — aus
dem Scan speisen"**, ausdrücklich mit der Maßgabe „wo der Scan nichts
hergibt, bleibt der Block leer statt falsch."

Umfang — und **nur** dieser:

| Was | Vorher | Nachher |
|---|---|---|
| Hero-CTA | fest „Termin anfragen" | folgt dem Ziel im Seitenplan: `/termin` → „Termin anfragen", `/reservierung` → „Tisch reservieren", `/anfrage` → „Anfrage senden", sonst „Kontakt aufnehmen" |
| Features-Block | drei erfundene Sätze | `brief.highlights` aus dem Scan; ohne Beleg leer und als `requiresRealContent` gemeldet |
| `SiteBrief` / `BriefEnrichment` | — | neues Feld `highlights` als Kanal für belegte Vorzüge |
| `sanitizeEnrichment` | ließ das Feld fallen | reicht `highlights` durch — in **beiden** Kopien (`builder.ts`, `anonymous.ts`) |

**Der Hash-Preis ist bekannt und akzeptiert**: `synthesize.ts` ist
deterministisch und gehasht („gleicher Brief ⇒ gleicher Blueprint ⇒ gleicher
Hash"). Jeder neu erzeugte Blueprint bekommt damit einen anderen Hash als
vor dem 2026-09-01. Bestehende Artefakte bleiben unangetastet — sie werden
nicht neu gebaut. Der Determinismus selbst bleibt: gleicher Brief ergibt
weiterhin byte-gleiches Ergebnis, geprüft.

**Was der Scan heute wirklich hergibt — gemessen, nicht vermutet**:
`handlers/discover.ts:77` bildet `services` als
`unique([...headings, ...extractServiceLikeText(visibleText)])`. Die
Überschriften sind also **vollständig in den Leistungen enthalten**; eine
zweite, unabhängige Quelle für „Warum wir" existiert im Scan nicht. Der
Block bleibt deshalb heute in der Regel leer — das ist der freigegebene
Zustand, nicht ein unfertiger. Der Kanal steht bereit, sobald Redaktion
oder ein Content-Agent echte Vorzüge liefert.

**Regel daraus**: Ein Vorschau-Block, der etwas über ein fremdes Unternehmen
behauptet, braucht eine Quelle. Ohne Quelle bleibt er leer und trägt
`requiresRealContent: true` — dieselbe Behandlung wie `testimonials`, und
aus demselben Grund (§ 5 UWG). Plausibel klingender Fülltext ist keine
Vorschau, sondern eine Behauptung, für die niemand einstehen kann.

Gesichert durch `test/siteos/preview-content-honesty.test.ts` — die Prüfung
fragt nach der **Herkunft** des Textes, weil erfundener Text technisch
genauso aussieht wie belegter und deshalb von keinem Render- oder
Typ-Test gefunden wird. Die beanstandeten Formulierungen sind dort
namentlich gesperrt.

**2026-09-01 (2) — Zusammenfassung im Brief: sachlich statt werbend**

Nachtrag zur Freigabe oben, gleiche Klasse an anderer Stelle. `parseBrief`
setzte die Zusammenfassung auf „… — persönliche Beratung, transparente
Leistungen und kurze Wege." Sie wird zur **Meta-Description und zur
Hero-Unterzeile**, landet also im ausgelieferten Dokument und im
Suchindex — aus einem Prompt allein ist keine der drei Zusagen belegbar.

Auf die Fragepflicht nach §10.3 hat der Eigentümer entschieden: **„Ja — nur
Zusammenfassung"**.

| Was | Vorher | Nachher |
|---|---|---|
| `parseBrief`-Zusammenfassung | „Zahnarztpraxis in Hamburg — persönliche Beratung, transparente Leistungen und kurze Wege." | „Zahnarztpraxis in Hamburg." |
| `defaultServices` | erfindet Leistungen je Branche | **unverändert** — ausdrücklich nicht freigegeben |

Leer wäre keine Option gewesen: Dann griffe `seo.missing-description`. Eine
Längenregel gibt es nicht — geprüft wird allein auf „vorhanden", am Code
nachgesehen (`analysis/blueprint.ts`, `analysis/observation.ts` führen nur
`missing-` bzw. `not-delivered`-Codes). `renameInSummary` greift weiter:
Ein echter Firmenname ersetzt weiterhin den führenden Katalogbegriff.
Der Scan-Pfad ist unberührt — `mergeBrief` ersetzt die Zusammenfassung
ohnehin durch die echte Beschreibung der Website.

**Weiterhin offen, nicht freigegeben**: `defaultServices` in `brief.ts`
erfindet die Leistungen je Branche (für eine Zahnarztpraxis „Prophylaxe,
Zahnerhaltung, Implantologie …"). Im Scan-Pfad überschreibt `mergeBrief`
sie mit echten Daten; im reinen Prompt-Pfad bleiben sie stehen. Bewusst
stehengelassen — der Leistungsblock ist zentral, und ohne ihn wäre die
Startseite im Prompt-Pfad deutlich leerer. Gehört entschieden, nicht
nebenbei geändert.

**2026-09-01 (3) — Hero-Überschrift: langer einteiliger Name wurde abgeschnitten**

Gefunden beim Nachstellen der reparierten Vorschau **mit einem echten
Browser** — nicht im Code, nicht in einem Test. Die Layoutschicht begrenzt
die Hero-Überschrift auf `max-width:16ch` und der Hero trägt
`overflow:hidden`. Ein Firmenname ohne Leerzeichen ist aber ein einziges
Wort, und ein Wort bricht bei `overflow-wrap:normal` nicht: Der Überhang
wurde nicht umgebrochen, sondern **weggeschnitten**.

Gemessen in Chromium bei 1280 px: „RealSyncDynamics.AI" ergab **648 px Text
in einem 570 px breiten Kasten — 78 px fehlten.** Bei Markennamen und
Domains ist der einteilige Name der Normalfall, nicht die Ausnahme.

Der Fehler ist **älter als PR #1194**: `BuildStudioPage` und
`siteos/preview.ts` rendern seit jeher `showcase` und waren gleich
betroffen. Der PR hat ihn nur sichtbar gemacht.

Auf die Fragepflicht nach §10.3: **„Ja — break-word ergänzen"**.

| Was | Vorher | Nachher |
|---|---|---|
| `[id*="--hero--"]>h1,>h2` | `max-width:16ch` ohne Umbruchregel | zusätzlich `overflow-wrap:break-word` |

**Warum `break-word` und nicht `anywhere`**: Der erste Versuch war
`anywhere` — die Messwerte sahen gut aus (kein Überlauf), das **Bild aber
nicht**. `anywhere` zählt beim Ermitteln der Mindestbreite mit und ließ die
Textspalte im Hero-Raster von 570 px auf 226 px zusammenfallen; die
Überschrift brach dann dreizeilig mitten im Wort. `break-word` bricht erst,
wenn es sonst überliefe, und lässt die Spaltenbreite in Ruhe. Auf 1280,
768 und 390 px geprüft: Spaltenbreite unverändert, nichts abgeschnitten,
kein Seitenüberlauf.

**Lehre, und sie ist die eigentliche**: Zwei Fehler dieser Sitzung waren
weder im Code noch in 3990 grünen Tests zu sehen — erst das gerenderte Bild
hat sie gezeigt. Und beim Fix hätten die Messwerte allein zur falschen
Lösung geführt. Bei einer Änderung an der Vorschau-Optik gehört ein Blick
auf das tatsächliche Rendering dazu, nicht nur eine grüne Suite.

Gesichert durch `test/siteos/hero-longword.test.ts`. Geprüft wird am CSS,
nicht am Pixel: Ein Pixel-Test hinge an der Schriftart des CI-Runners,
während die fehlerhafte Kombination — Begrenzung plus `overflow:hidden`
ohne Umbruchregel — eine Eigenschaft des Stylesheets ist.

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
