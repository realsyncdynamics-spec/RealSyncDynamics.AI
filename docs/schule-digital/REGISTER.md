# Master Registry – Schule DIGITAL (vorläufig)

**Status:** KONZEPT  
**Stand:** 27.11.2026, 23:55 (Europe/Berlin), `main` @ `a53dce7c`

Dieses Register ist **vorläufig, abgeleitet aus dem Master-Prompt t30u, nicht aus V3.1**. Die Master Infrastructure V3.1 (17 Blöcke) und die acht Projektdateien wurden nicht gefunden. Die IDs `SD-B01` bis `SD-B17` sind eigene Nummern und müssen später gegen `B01`–`B17` aus V3.1 abgeglichen werden. B01–B17 aus V3.1 wurden nicht erfunden.

**Bestand** bezieht sich auf die Eignung für Schule DIGITAL, nicht auf den allgemeinen Produktstatus von RealSync:

- **vorhanden** – Baustein liegt im Repo oder ist live und ist ohne Schul-Neubau nutzbar.
- **teilweise** – verwandter Baustein vorhanden, Schulbezug, Rollen oder Isolation fehlen oder sind unvollständig.
- **fehlt** – im geprüften `main` kein passender Baustein gefunden.

Agentenzuordnung: bestehende Bots sind RealSync Chief, REA (Recherche/Analyse), Software Factory (Implementierung/Baumeister) und NOVA (Governance/Sicherheit, nur lesend). VIO, DATA und MIRA sind Vorschläge und nicht angelegt. ATLAS wird durch REA abgedeckt (Vorschlag).

Widerspruch REA: Im Repo definiert `.claude/agents/rea.md` (Commit [`3a58095e`](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/commit/3a58095e50e918479975e9675ec373a4a5d1d19e), #2418, 25.11.2026) REA als Claude-Code-Fachagent „Software Factory“. Im Bot-Team ist REA Recherche und Analyse, gebaut wird von Software Factory. Vorschlag: Im Register Rollen statt Namen verwenden (Baumeister = Software Factory bzw. der Repo-Agent; Recherche = REA-Bot). Ob der Repo-Agent umbenannt wird, entscheidet Dominik.

| ID | Block | Bestand | Beleg (auf `main` @ `a53dce7c`) | Agent |
|---|---|---|---|---|
| SD-B01 | Mandanten & Organisation (Tenancy) | teilweise | Zwei Modelle: `tenants`/`tenant_memberships` und `organizations`/`organization_members`. Details in [MANDANTENMODELL_ENTSCHEIDUNG.md](./MANDANTENMODELL_ENTSCHEIDUNG.md). | Software Factory · NOVA |
| SD-B01.1 | Mandant Schule, Schulträger, Klasse (Hierarchie) | teilweise | `org_units.parent_id` in `supabase/migrations/20260824120000_org_subject_model_approval_gates.sql:29`. Schulbezug fehlt. | Software Factory |
| SD-B01.2 | Einladungen | vorhanden | `tenant_invites` in `supabase/migrations/20260430300000_tenant_invites.sql:8`. | Software Factory |
| SD-B01.3 | Onboarding und Provisionierung | vorhanden | `tenant_onboarding` in `supabase/migrations/20260928132000_tenant_onboarding.sql:40`; `tenant_provisioning_runs` in `supabase/migrations/20260928150000_tenant_boot_provisioning.sql:19`. | Software Factory |
| SD-B02 | Identität, Rollen & Rechte | teilweise | Supabase Auth; MFA-Einstellungen in `tenant_security_settings` (`supabase/migrations/20260621000000_p0a_mfa_security.sql:40`). Schulrollen fehlen, siehe [ROLLEN_UND_SORGERECHT.md](./ROLLEN_UND_SORGERECHT.md). | NOVA · Software Factory |
| SD-B02.1 | Schulrollen (Schüler, Eltern, Lehrer, Schulleitung, Sekretariat, Förderverein, Schulträger, Dienstleister) | fehlt | Vorhanden nur `owner`/`admin`/`member`/`viewer` (`supabase/migrations/20260602100000_runtime_events_backbone.sql:78-79`) bzw. `owner`/`admin`/`editor`/`viewer_auditor` (`supabase/migrations/20260406000000_entitlements_schema.sql:21`). | Software Factory · NOVA |
| SD-B02.2 | Sorgerechts- und Vertretungsmodell (Eltern ↔ Kind) | fehlt | Keine Treffer für guardian/sorgerecht/student/schüler in `supabase/migrations` (Suche 27.11.2026 gegen `origin/main`). | NOVA (Konzept) · Software Factory |
| SD-B02.3 | RLS-Helper | vorhanden | `is_tenant_member` in `supabase/migrations/20260723000001_rls_recursion_fix_security_definer.sql:21`; `is_tenant_admin` in `supabase/migrations/20260621000000_p0a_mfa_security.sql:21`. | NOVA |
| SD-B03 | Kinderschutz & Datenschutz | teilweise | DSR-, Consent- und AI-Act-Bausteine vorhanden, Minderjährigen-Logik fehlt. | NOVA |
| SD-B03.1 | Einwilligungen (Eltern, altersabhängig) | teilweise | `user_consents` nur für Analytics-Consent (`supabase/migrations/20260608000001_user_consents.sql:1-22`). | NOVA |
| SD-B03.2 | Betroffenenrechte (Export, Löschung) | vorhanden | Edge Functions `gdpr-export`, `gdpr-delete`, `governance-dsr`, `governance-erasure-sweeper`; Tabelle `dsr_requests` in `supabase/migrations/20260515200000_dsr_tracker.sql:1`. | NOVA |
| SD-B03.3 | DSFA | teilweise | Seite `src/pages/DsfaWizard.tsx`. Eine formale DSFA der Plattform selbst fehlt laut NOVA (Bericht, Lücke 9). | NOVA |
| SD-B03.4 | AI-Act-Einstufung Bildung (Annex III) | vorhanden | `src/rules/annex-iii.json:20-21` (`education`, Label „Bildung & Berufsbildung“). | NOVA |
| SD-B03.5 | Löschfristen und Aufbewahrung | teilweise | `memory_retention_policies` (ohne RLS, siehe P0-1 / NOVA H1); `governance-erasure-sweeper`. | NOVA |
| SD-B04 | Governance OS & Evidence Vault | vorhanden | `src/product/implementation-status.ts:163-165` (`evidence-surfaces`, `live`) und `:253-255` (`governance-runtime-core`, `live`). Tabellen u. a. `evidence_items` in `supabase/migrations/20260705040000_evidence_vault_extended.sql:7`. Öffentliche Seite `/evidence-vault` HTTP 200 (27.11.2026). Registry-Status, kein eigener Funktionstest. | NOVA |
| SD-B05 | SYNC & KI-Gateway | teilweise | SYNC per #2439 gemergt (Commit [`bf8c1ff2`](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/commit/bf8c1ff257bb4d9692262061b93412ededceb796), 25.11.2026, 19:13 Europe/Berlin). AI Gateway `live` laut `src/product/implementation-status.ts:314-316`. | Software Factory · NOVA |
| SD-B05.1 | SYNC öffentlicher Assistent | vorhanden | `supabase/functions/governance-agent/index.ts:342` (`chat_anon`); Commit `bf8c1ff2`. Live-Antwortqualität NICHT VERIFIZIERT. | Software Factory |
| SD-B05.2 | Gateway erzwingt Login und `tenant_id` | fehlt | `src/config/featureFlags.ts:5-19`: KI-Workspace bleibt aus, bis das Gateway das für alle Aufrufe verlangt. | Software Factory · NOVA |
| SD-B05.3 | Antwortwächter im Antwortpfad | teilweise | `supabase/functions/_shared/syncReplyGuard.ts` vorhanden; laut #2439 noch nicht im Antwortpfad. | Software Factory |
| SD-B05.4 | Lernunterstützung, KI-Übungen | fehlt | Kein Bezug im Repo gefunden (Suche 27.11.2026). | Software Factory |
| SD-B06 | VOICE (Telefonassistent) | teilweise | Fünf Tools in `apps/agent-runtime/src/voice-tools.ts:14-46` (`lookup_kb`, `create_ticket`, `schedule_appointment`, `handoff_human`, `export_transcript`). Produktstatus `coming-soon` in `src/product/implementation-status.ts:294-296`. #2406 (Voice-Readiness-Report) ist geschlossen ohne Merge. Draft #2443 (KI-Offenlegung, „VIO-01a“) war am 27.11.2026 offen. Die Aussage „4 von 5 Tools ohne Backend“ stammt aus #2406 und ist auf `main` NICHT VERIFIZIERT. | VIO (Vorschlag) · Software Factory |
| SD-B07 | SCHOOL CONNECT (Elternbriefe, Krankmeldung, Termine) | teilweise | Nur Muster: `bot_conversations` / `bot_appointments` über #2414 („Mein Betrieb“); Channel-Bots laut Registry `preview` (`src/product/implementation-status.ts:264-266`). Schulfunktionen fehlen. | Software Factory |
| SD-B08 | SCHOOL ADMIN (Dashboards, Verwaltung) | teilweise | App-Shell und Command Center `live` (`src/product/implementation-status.ts:121-139`). „Mein Betrieb“ unter `/app/betrieb` (#2414, Commit [`2830da78`](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/commit/2830da7895fa1bf16f857fd9a531231b9711476d)). Schüler-, Klassen- und Raumverwaltung fehlen. KI-Sekretariat: #2435 offen, #2447 Draft (Stand 27.11.2026), nicht gemergt. | Software Factory |
| SD-B09 | SCHOOL LEARN | fehlt | Kein Bezug im Repo gefunden (Suche 27.11.2026). | Software Factory · REA |
| SD-B10 | SCHOOL PAY | teilweise | Stripe-/Checkout-Functions im Repo (u. a. `stripe-checkout`, `stripe-webhook`, `stripe-portal`). `stripe-checkout-e2e` steht auf `preview` (`src/product/implementation-status.ts:561-563`): ein erfolgreicher Live-Neukauf war am 17.11.2026 nicht nachgewiesen. Elternfreigaben und Schülerguthaben fehlen. Nur aus dem Repo belegt, kein Stripe-Connector. | Software Factory · DATA (Vorschlag) |
| SD-B11 | SCHOOL ID (Ausweis, QR, NFC) | fehlt | Kein Bezug im Repo gefunden (Suche 27.11.2026). | Software Factory · NOVA |
| SD-B12 | SCHOOL CLUB (Förderverein) | fehlt | Wiederverwendbar nur allgemeine `subscriptions` / Stripe. Kein Fördervereinsmodul gefunden. | Software Factory |
| SD-B13 | PHOTO, FOOD, SHOP, EVENTS | fehlt | Kein Schulbezug gefunden. C2PA-Herkunftsnachweis (`src/product/implementation-status.ts:379-381`, `live`) ist für PHOTO potenziell nutzbar. | Software Factory |
| SD-B14 | Billing & Entitlements | teilweise | `entitlements` in `supabase/migrations/20260430200000_entitlements_normalization.sql:30`; `subscriptions` in `supabase/migrations/20260406000000_entitlements_schema.sql:27`; ferner `tenant_cost_caps`. Live-Billing NICHT VERIFIZIERT (kein Connector). | Software Factory · DATA (Vorschlag) |
| SD-B15 | Infrastruktur & Hosting | vorhanden | Live-Header der Apex-Domain: `server: cloudflare` (27.11.2026). Supabase-Region `eu-central-1` laut `docs/runtime/production-runtime.md:14` (Doku vom 23.07.2026, Live NICHT VERIFIZIERT). Cloudflare-Pages-Deploy Lauf 4255 `success` am 26.11.2026, 07:53 Europe/Berlin, SHA `a53dce7c` ([Run 45771356114](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/actions/runs/45771356114)). Dieselbe Doku nennt noch GitHub Pages als Frontend-Ziel (`docs/runtime/production-runtime.md:14`) – Doku-Drift gegenüber dem Cloudflare-Header. | Software Factory · NOVA |
| SD-B15.1 | Edge-Function-Kapazität | teilweise | 205 Function-Verzeichnisse unter `supabase/functions/` (Zählung 27.11.2026 gegen `origin/main`). `docs/MCP_GOVERNANCE_SERVER.md:38-40` (Commit der Datei 27.09.2026) nennt den Free-Plan bei 100/100, neue Functions mit HTTP 402. Widerspruch; Live-Kontingent NICHT VERIFIZIERT. | Software Factory |
| SD-B16 | CI/CD, Tests & Qualität | teilweise | Vitest (`package.json` Script `test`); Playwright (`playwright.config.ts`, `playwright.catalog.config.ts`, 54 Dateien `*.spec.ts`, Scripts in `package.json:27-28`). CodeQL-Workflow vorhanden. `.github/dependabot.yml` fehlt (geprüft gegen `origin/main`). `vite` steht in `dependencies` (`package.json:94`). Eigene Zählung: 29 von 44 Workflows ohne `permissions:` auf oberster Ebene; NOVA nannte 27 (vermutlich zählt NOVA Rechte auf Job-Ebene mit, ANNAHME). | NOVA · Software Factory |
| SD-B17 | Öffentlicher Auftritt & Vertrieb | teilweise | `/schulen` HTTP 200, Titel „Schulen-Compliance — DSGVO + KMK + Schüler-Datenschutz“ (`src/App.tsx:776-778`, `src/config/seo.ts:818-822`). `/bildung` und `/education` per 301 auf `/schulen` (`public/_redirects:99-100`). `/schule-digital` HTTP 404 (27.11.2026). Die Seite positioniert Compliance für Schulen, keine Schulplattform. | MIRA (Vorschlag) · Chief |

## Phasen aus t30u (nur Einordnung, nicht als Plan freigegeben)

| Phase | Inhalt laut Master-Prompt | Bezug zum Register |
|---|---|---|
| 1 Fundament | Mandanten, Rollen, Schulverwaltung, Elternportal, Designsystem | SD-B01, SD-B02, SD-B08; blockiert durch P0-1 bis P0-4 |
| 2 Schulalltag | Stundenpläne, Hausaufgaben, Krankmeldungen, Elternbriefe | SD-B07, Teile von SD-B09 |
| 3 KI | SYNC, Telefonassistent, Lernunterstützung | SD-B05, SD-B06, SD-B05.4 |
| 4 Kommerzielle Module | Essen, Zahlungen, Förderverein, Foto, Bedarf | SD-B10, SD-B12, SD-B13 |
| 5 Physische Infrastruktur | Ausweise, NFC, Gebäudezugang | SD-B11 |
| 6 Markteinführung | Pilotschule, Sicherheitsabnahme, Lizenzierung | SD-B14, SD-B17, P0-7 |
