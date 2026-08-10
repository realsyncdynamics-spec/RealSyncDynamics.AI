# 18 — Findings

**Klassifikation**
`P0` katastrophal / sofortiger Produktions-Blocker · `P1` schwerwiegend (Security, Daten, Billing, Tenant) ·
`P2` größerer Funktions-/Reliability-Mangel · `P3` moderat · `P4` Verbesserung

**Status-Legende (Exponierung)**
`LIVE` = in Produktion deployt und erreichbar · `LATENT` = Code vorhanden, aktuell nicht deployt,
wird beim nächsten vollständigen Deploy scharf · `PROD-DB` = betrifft die laufende Datenbank

---

## P0

### F-01 · 47 % der Backend-Funktionalität ist nicht in Produktion · LIVE
**Beweis:** Nebenwirkungsfreie `OPTIONS`-Probe gegen alle 178 Functions
(`https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/<name>`):
95 deployt, **83 liefern HTTP 404**. Darunter `evidence-vault`, `policy-packs`,
`provenance`, `governance-memory`, alle `iso42001-*`, `api-gateway`, `webhook-deliver`,
`scheduler`, `report-generator`, `partner-provision-tenant`, `tenant-branding-*`, `plans`.

**Impact:** Die Module Evidence Vault, Policy Packs, Provenance/C2PA, Memory Governance,
ISO 42001, SiteOS, öffentliche API, Webhooks, Scheduler, White Label und Partner Mode
existieren in Produktion **nicht** — sie werden auf der Website beworben und in
`CLAUDE.md` mit 80–100 % Fertigstellung geführt. **33 dieser Functions werden vom
Frontend aufgerufen**, d. h. eingeloggte Nutzer treffen auf harte Fehler.

**Fix:** Runbook `docs/runbooks/p0-2-migration-reconciliation.md` ausführen, danach
`supabase functions deploy` für alle 83. Vorher F-04/F-05 beheben — sonst werden mit dem
Deploy gleichzeitig mehrere Auth-Bypässe scharf geschaltet.

**Test:** `npm run check:edge-functions` muss mit gesetztem `SUPABASE_ACCESS_TOKEN`
in CI laufen und bei Drift **fehlschlagen** (heute: stiller No-op, siehe F-06).

---

### F-02 · Produktions-Datenbank fehlen die Tabellen der beworbenen Kernmodule · PROD-DB
**Beweis:** PostgREST mit dem öffentlichen Publishable-Key liefert `PGRST205` für
`evidence_vault_items`, `policy_pack_catalog`, `governance_memory`, `audit_jobs`,
`entitlement_grants`, `iso_control_definitions`, `website_projects`,
`governance_incidents`, `organizations`, `organization_members`, `integrations`,
`memory_retention_policies`.

**Impact:** Selbst nach Deploy der Functions wären die Module funktionslos.
`audit_jobs` fehlt → die Job-Queue des Audit-Moduls (in CLAUDE.md „95 %") existiert
in Produktion nicht. `governance_incidents` fehlt, **obwohl die Function
`governance-incidents` deployt ist** → jeder Aufruf endet in HTTP 400.

**Fix:** Migrations-Ledger reconcilen (Runbook `p0-2`), 118 offene Migrationen anwenden.
**Test:** `migration-drift.yml` als blockierender Required Check gegen Prod.

---

### F-03 · Einmalprodukt „Governance Launch" (349 €) kann in Produktion nicht ausgeliefert werden · PROD-DB
**Beweis:** `shared/pricing.ts` definiert `purchaseMode: 'one_time'`; laut
`docs/product/pricing-governance.md` wird die Berechtigung als Grant in
`entitlement_grants` persistiert. Diese Tabelle liefert in Produktion `PGRST205`.

**Impact:** Kunde zahlt, der Webhook kann den Grant nicht schreiben → **bezahlte
Leistung ohne Freischaltung**, ohne Fehlermeldung an den Kunden. Reine Zahlungs-
richtung Stripe funktioniert (F-B1 grün), nur die Entitlement-Seite fehlt.

**Fix:** Migration für `entitlement_grants` anwenden; bis dahin das Einmalprodukt im
Checkout deaktivieren.
**Test:** Stripe-Test-Event `checkout.session.completed` mit `purchaseMode=one_time`
→ Assertion, dass ein Grant existiert. Fehlt heute.

---

### F-04 · Auth-Bypass-Klasse: `Bearer <beliebig>` genügt, danach `service_role` mit client-gelieferter `tenant_id` · LATENT (1× LIVE)
**Beweis:** Die Functions prüfen ausschließlich das Präfix und validieren das Token nie:
```ts
// supabase/functions/governance-risk-score/index.ts:70
const auth = req.headers.get('Authorization');
if (!auth?.startsWith('Bearer ')) return jsonError(401, ...);
const admin = createClient(SUPABASE_URL, SRK, ...);   // service_role
// ... body.tenant_id / body.asset_id werden ungeprüft übernommen
```
Betroffen (identisches Muster, verifiziert):

| Function | Wirkung bei Ausnutzung | Deploy-Status |
|---|---|---|
| `governance-risk-score` | Risiko-Scores **jedes** Tenants überschreiben + `asset_risk_history` fälschen | **LIVE** (401 bestätigt) |
| `oauth2-apps` | `rotate_secret` / `delete_app` gegen fremde Tenants | LATENT |
| `report-generator` | Compliance-Report eines fremden Tenants erzeugen (Datenabfluss) | LATENT |
| `governance-score-calculator` | Compliance-Scores **aller** Tenants neu schreiben | LATENT |
| `governance-deadline-monitor` | NIS2-/Fristen-Alarme fremd auslösen | LATENT |
| `automation-trigger-trial-webhook` | Trial-/Abo-Zustand fremder Tenants manipulieren | LATENT |

**Impact:** Vollständiger Verlust der Mandantentrennung auf der Schreibseite und —
bei `report-generator` — auf der Leseseite. Für ein Produkt, dessen Kernversprechen
manipulationssichere Governance-Nachweise sind, ist die Fälschbarkeit von Risiko-Scores
und Score-Historie besonders schwerwiegend.

**Nicht ausgenutzt:** Ich habe keine Schreib-Requests gegen Produktion gesendet
(Regel 12/16). Die Klassifikation stützt sich auf den Code-Pfad und auf `401` als
Beleg für das Deployment von `governance-risk-score`.

**Fix:** Einheitlicher Auth-Helfer in `_shared/`, der (a) `auth.getUser()` gegen den
Anon-Client ausführt **und** (b) die Mitgliedschaft `user → tenant_id` in `memberships`
prüft — exakt das Muster, das `governance-keys`, `governance-approvals`,
`governance-resources` und `governance-dsr` bereits korrekt umsetzen. Für
Cron-Endpunkte stattdessen Vault-Token wie in `governance-erasure-sweeper`.

**Test:** Pro Function ein Test „`Bearer invalid` → 401" und „Tenant A → Tenant B → 403".
Existiert heute für keine der sechs.

---

### F-05 · Unauthentifizierte Endpunkte mit `service_role` und client-gelieferter Tenant-ID · teils LIVE
**Beweis:** 18 Functions haben `verify_jwt = false` in `supabase/config.toml`, verwenden
`SUPABASE_SERVICE_ROLE_KEY` und prüfen **weder** JWT noch Shared Secret:

`appointment-book` · `bot-chat` · `bot-voice-webhook` · `browser-action-log` ·
`cookie-scan-deep` · `enterprise-ai-os-agents-run` · `enterprise-ai-os-discovery-intake` ·
`enterprise-ai-os-discovery-pending` · `enterprise-ai-os-feedback` ·
`enterprise-ai-os-founding-access` · `governance-agents-list` ·
`governance-analytics-aggregator` · `governance-connectors` · `governance-incidents` ·
`governance-risk-score` · `health` · `order-intake` · `sales-lead`

Zwei Fälle stechen heraus:

**(a) `enterprise-ai-os-discovery-pending` — LIVE, globaler Dump.**
```ts
if (tenantId) query = query.eq('tenant_id', tenantId);   // ← optional!
```
Ohne `tenantId` liefert der Endpunkt die **noch nicht freigegebenen KI-Systeme aller
Mandanten** — inklusive `contains_personal_data`, `contains_sensitive_data`, `department`.
Live-Probe bestätigt Deployment (HTTP 405 auf POST, GET-only). Ich habe den Dump
**nicht** abgerufen, um keine Kundendaten zu exfiltrieren.

**(b) `governance-agents-list` — PostgREST-Filter-Injection.**
```ts
.or(`tenant_id.eq.${tenantId},tenant_id.is.null`)   // tenantId aus Query-String
```
`tenantId` wird unescaped in die PostgREST-`or`-Grammatik interpoliert. Ein Wert wie
`x,status.neq.zzz` erweitert den Filter. Gleiches Muster in `telemetry-ai-event:168`.

**Fix:** JWT+Membership-Prüfung wie F-04; `tenant_id` serverseitig aus der Session
ableiten, nie aus Query/Body. `.or()`-Interpolation durch `.in()`/parametrisierte
Filter ersetzen.
**Test:** „Aufruf ohne `tenantId` → 401" und „Injection-String → 400".

---

## P1

### F-06 · Der Drift-Guard, der F-01 hätte verhindern müssen, ist ein stiller No-op · LIVE
**Beweis:**
```
$ npm run check:edge-functions
ℹ️  Prod-Drift-Check uebersprungen (kein SUPABASE_ACCESS_TOKEN/PROJECT_ID).
✅ Kein blockierender Edge-Function-Drift.
```
Exit-Code 0. Der Check meldet Erfolg, obwohl er nichts geprüft hat — deshalb konnte
die Lücke auf 83 Functions anwachsen, während CI durchgehend grün war.
**Fix:** Ohne Credentials `exit 1` (oder Job als `required` mit Secret).

---

### F-07 · DB-Sicherheitstests und die App-interne E2E-Suite laufen in keinem CI-Workflow · LIVE
**Beweis:**
```
$ grep -rn 'test:db|runtime/db|TEST_DB_URL' .github/workflows/   → keine Treffer
```
`test/runtime/db/` enthält 18 DB-Tests, darunter `rls.db.test.ts`,
`hash-chain.db.test.ts`, `hash-chain-corruption.db.test.ts`, `append-only.db.test.ts`,
`entitlement-grants.db.test.ts` — **keiner davon läuft**.

Bei Playwright ist die Lage differenzierter: `e2e.yml` führt `npm run test:e2e` aus,
das über `playwright.catalog.config.ts` **nur `tests/e2e/` (9 Specs)** gegen einen
lokalen Preview-Build abdeckt — öffentliche Routen, Navigation, Consent, Checkout,
AI-Act, Audit, Rechtstexte. Das läuft und ist grün. ✅

**Nicht abgedeckt sind die 38 Specs in `e2e/`** (`npm run e2e`, `playwright.config.ts`)
— die App-interne Suite: `governance-workflow`, `governance-memory`,
`governance-evidence`, `evidence-vault-export`, `provenance-external-verification`,
`workspace`, `tenant-admin`, `onboarding`, `api-endpoints`, `feature-oauth2-api`,
`partners`, `phase2`–`phase6`.

**Impact:** Die Tests für Mandantentrennung, Evidenz-Integrität und Entitlements
werden nie ausgeführt. Die E2E-Suite, die genau die in F-01 fehlenden Module prüft,
läuft ebenfalls nicht — sonst wäre die Deployment-Lücke aufgefallen. `npm test` (in
CI) sind reine Unit-Tests ohne Datenbank.

**Fix:** `test:db` mit dem vorhandenen `scripts/test-db/up.sh` als CI-Job; `npm run e2e`
(App-Suite) als Nightly + Pre-Deploy-Gate ergänzend zur bestehenden Katalog-Suite.

**Korrektur gegenüber einer früheren Fassung dieses Berichts:** dort stand, Playwright
laufe in keinem Workflow. Das war falsch — `e2e.yml` existiert und ist grün; die
Aussage gilt nur für die 38 App-internen Specs und die 18 DB-Tests.

---

### F-08 · 35 Tabellen ohne RLS — in Produktion anonym erreichbar, aktuell leer · PROD-DB
**Beweis:** Statische Analyse aller 270 Migrationen: 341 `CREATE TABLE`, davon 35 ohne
jedes `ENABLE ROW LEVEL SECURITY` **und** ohne `CREATE POLICY`. Betroffen u. a.:
`tax_documents`, `tax_years`, `tax_audit_events`, `tax_advisor_reviews`,
`tax_evidence_exports`, `orders`, `order_items`, `appointments`, `bot_agents`,
`voice_channels`, `provenance_records`, `inventory_*` (9 Tabellen),
`subscription_addons`, `seo_marketing_audit_log`.

Live-Probe mit dem **anonymen** Publishable-Key:
```
tax_documents      | http=200 | content-range: */0
orders             | http=200 | content-range: */0
provenance_records | http=200 | content-range: */0
appointments       | http=200 | content-range: */0
```
Die Requests werden **nicht abgewiesen** — der `anon`-Rolle fehlt keine Berechtigung.
Alle betroffenen Tabellen sind derzeit leer (`*/0`), es sind heute keine Daten
abgeflossen.

**Impact:** Latent kritisch. Sobald ein Kunde das erste Steuerdokument, die erste
Bestellung oder den ersten Herkunftsnachweis anlegt, ist der Datensatz **weltweit
lesbar**. `tax_documents` und `provenance_records` sind besonders sensibel.

**Einschränkung:** Der RLS-Zustand (`pg_class.relrowsecurity`) ist von außen nicht
lesbar. Die Bewertung stützt sich auf die Migrations-Evidenz plus die Tatsache, dass
anonyme Requests durchgehen. Verifikation im Projekt:
```sql
select relname, relrowsecurity from pg_class
 where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity;
```
**Fix:** RLS + Tenant-Policy für alle 35 Tabellen, additive Migration.
**Test:** Ein generischer Test „jede Tabelle in `public` hat `relrowsecurity = true`" —
das ist ein Einzeiler und hätte alle 35 gefunden.

---

### F-09 · Drei RLS-Policies mit `USING (true)` ohne Rollen-Einschränkung · PROD-DB
**Beweis:** Parser über alle 620 `CREATE POLICY`-Statements:
```sql
-- 20260706011047_agent_token_budget.sql
CREATE POLICY "Service role can manage agent config" ON agent_configuration
  FOR ALL USING (true);                       -- kein TO service_role
CREATE POLICY "Service role can view token usage" ON agent_token_usage
  FOR SELECT USING (true);
-- 20260717191000_website_operations_core.sql
CREATE POLICY "Service role can update reports" ON public.website_compliance_reports
  FOR UPDATE USING (true) WITH CHECK (true);
```
Ohne `TO service_role` gelten Policies für **alle** Rollen, also auch `anon` und
`authenticated`. Der Policy-Name behauptet das Gegenteil.

**Impact:** Jeder eingeloggte Nutzer kann die Agent-Konfiguration global verändern
(`FOR ALL`) und fremde Compliance-Reports überschreiben — direkter Angriff auf die
Nachweis-Integrität.
**Fix:** `TO service_role` ergänzen. Die 15 übrigen `USING(true)`-Policies sind
Referenzdaten (Framework-Kataloge, ISO-Definitionen) und vertretbar.
**Positiv:** `document_vault` hatte denselben Fehler und wurde in
`20260720124405_restrict_document_vault_to_super_admin.sql` korrekt behoben — das
Muster ist im Team bekannt.

---

### F-10 · „Unveränderlich / revisionssicher" ist ohne externe Verankerung nicht belegbar · LIVE
**Beweis (positiv):** Die Hash-Chain in `20260602100000_runtime_events_backbone.sql`
ist echt und gut gebaut — deterministische Kanonisierung
(`runtime_events_canonical_bytes`, `IMMUTABLE`), SHA-256 über Envelope + `prev_hash`,
Vergabe unter `pg_advisory_xact_lock` pro Tenant, `BEFORE UPDATE`/`BEFORE DELETE`
Reject-Trigger, Verifier-RPC `runtime_events_verify_chain`. Ed25519-Signatur für
Provenance ist in `_shared/crypto.ts` real implementiert.

**Beweis (Lücke):** Es existiert **keine externe Verankerung** — kein RFC-3161-Zeitstempel,
kein OpenTimestamps, kein Write-Once-Storage, kein Off-Site-Anchor der Chain-Spitze.
Die Kanonisierungsfunktion ist öffentlich und deterministisch; wer `service_role` oder
DB-Superuser-Rechte hat, kann die Tabelle leeren und eine **vollständig
selbstkonsistente** Ersatzkette einfügen, die der Verifier als gültig bestätigt.

**Impact:** Das System ist *tamper-evident gegen Anwendungsfehler und einzelne
Row-Manipulation*, aber nicht *tamper-proof gegen einen privilegierten Insider*.
Die Marketing-Begriffe „unveränderlich" und „revisionssicher" gehen weiter, als der
Code trägt. Rule 6 verbietet die Einstufung als „immutable" ohne Nachweis.

**Fix:** Chain-Spitze periodisch extern verankern (signierter Digest an einen
unabhängigen Zeitstempeldienst / append-only Log) und im Verifier ausweisen.
Bis dahin die Formulierung auf „manipulationserkennend / kryptografisch verkettet"
zurücknehmen.

---

### F-11 · `governance-incidents` ist deployt, seine Tabelle nicht — und der Insert ist tenant-los · LIVE
**Beweis:** Function deployt (OPTIONS ≠ 404), `governance_incidents` liefert `PGRST205`.
Zusätzlich im Code:
```ts
.insert([{ title, description, severity, status: 'open', created_at }])  // kein tenant_id
```
Kein `tenant_id`, keine Auth, kein `user_id`.
**Impact:** Endpunkt ist heute kaputt (HTTP 400); nach Anwendung der Migration wäre er
ein unauthentifizierter, mandantenloser Insert. Incident-Dispatch der
Governance-Runtime (CLAUDE.md: 85 %) funktioniert in Produktion nicht.

---

### F-12 · Abhängigkeiten: 27 Schwachstellen, 6 hoch · LIVE
**Beweis:** `npm audit` → `{low: 2, moderate: 19, high: 6, critical: 0, total: 27}`.
Hervorzuheben: `react-router` 7.12.0–7.18.1 — GHSA-qwww-vcr4-c8h2 (CSRF-Bypass,
High); `postcss` GHSA-fxqj-rqcc-2cmp.
**Einordnung:** Die React-Router-Lücke betrifft den RSC-Modus, der in dieser
Vite-SPA nicht verwendet wird — die praktische Ausnutzbarkeit ist gering, das
Advisory bleibt offen. Kein blindes `npm audit fix --force` (React 19 / Router 7
sind eng gekoppelt).

---

## P2

### F-13 · `vercel.json` im Root — explizit untersagt · LIVE
`CLAUDE.md` §2 verbietet Vercel-Abhängigkeiten ausdrücklich. Die Datei setzt zwar nur
`git.deploymentEnabled = false` (also entschärfend), widerspricht aber der eigenen
Regel und dem Trust-Narrativ „100 % EU-Hosting auf Cloudflare". Entfernen.

### F-14 · CSP erlaubt `script-src 'unsafe-inline'` · LIVE
Aus dem Produktions-Header. Entwertet CSP als XSS-Schutz weitgehend. Ursache sind die
inline eingebetteten Pixel-Loader (`src/lib/pixels.ts`). Fix: Nonce- oder
Hash-basierte CSP.

### F-15 · `Access-Control-Allow-Origin: *` auf 17 Edge Functions und auf dem Site-Root · LIVE
`_shared/gateway.ts` setzt den Wildcard als Standard. Für tenant-bezogene, JWT-
geschützte Endpunkte sollte eine Origin-Allowlist gelten; ohne Credentials-Flag ist
die Auswirkung begrenzt, die Angriffsfläche aber unnötig.

### F-16 · 16 Migrationen mit `SECURITY DEFINER` ohne `SET search_path` · PROD-DB
Klassischer Privilege-Escalation-Vektor bei schreibbarem Schema-Pfad. Betroffen u. a.
`00001_initial_schema.sql`, `20260625000000_governance_analytics_schema.sql`.
Der Großteil des Codes pinnt korrekt (`20260530210241_pin_remaining_function_search_paths.sql`);
diese 16 sind Nachzügler.

### F-17 · Hauptbundle 4,5 MB (1,1 MB übertragen) · LIVE
Gemessen: `/assets/index-ChiO7Xjt.js` = 4 558 912 Bytes roh, 1 101 579 Bytes Transfer.
Ursache: 119 Public Pages werden per Design eager importiert (SEO), plus
`three`/`@react-three/*` und `@react-pdf/renderer` im Hauptchunk. LCP-relevant.
Fix: 3D- und PDF-Abhängigkeiten aus dem Entry-Chunk lösen (`manualChunks`), ohne die
eager-Import-Regel für SEO zu brechen.

### F-18 · Eigene Marketing-Pixel auf einer DSGVO-Compliance-Plattform · LIVE
Die Produktions-CSP erlaubt `connect.facebook.net`, `googletagmanager.com`,
`analytics.tiktok.com`, `snap.licdn.com`. **Positiv verifiziert:** `src/lib/pixels.ts`
lädt sie ausschließlich nach explizitem Consent, mit Google Consent Mode v2 auf
`denied` als Default — technisch sauber umgesetzt. Bleibt ein Reputationsrisiko für ein
Produkt, das Pre-Consent-Tracking bei Kunden anprangert; TikTok/Meta bedeuten zudem
Drittlandtransfer, was der Aussage „100 % EU" widerspricht.

### F-19 · 17 von 21 Workflows ohne explizite `permissions:` · LIVE
Default-Token-Rechte statt Least Privilege. Positiv: kein `pull_request_target`,
`actions/*` und die meisten Drittanbieter-Actions sind SHA-gepinnt. Nachziehen:
`docker/*@v5`, `slackapi/slack-github-action@v1`.

### F-20 · 13 verwaiste `.sql.bak`-Dateien im Repository-Root · LIVE
`.20260705*.sql.bak` — versteckte Backups nicht angewendeter Migrationen. Verwirrend
gegenüber dem Migrations-Ledger; entfernen (Git-History bleibt).

---

## P3 / P4

| ID | Sev | Befund |
|---|---|---|
| F-21 | P3 | `enterprise-ai-os-*`-Familie (6 Functions) ohne Auth — teils deployt; gleiche Klasse wie F-05, geringere Datenkritikalität |
| F-22 | P3 | `evidence-export`: AAL2-Prüfung ist bewusst „OBSERVE ONLY, nicht blockend" (Kommentar Zeile 71) — dokumentierte, aber offene P0d-Schuld |
| F-23 | P3 | `optimize-execute` nimmt `tenantId` **und** `userId` aus dem Body und schreibt mit `service_role`; nicht deployt, aber beim Deploy scharf |
| F-24 | P3 | 104 übersprungene + 96 `todo` Tests — unklarer Abdeckungsstand in Kernpfaden |
| F-31 | P3 | Zwei parallele Playwright-Configs (`playwright.config.ts` / `playwright.catalog.config.ts`) mit ähnlichen Skriptnamen (`e2e` / `test:e2e`) — leicht zu verwechseln; genau diese Doppelung hat in einer früheren Fassung dieses Audits zu einer Fehlbewertung geführt |
| F-25 | P3 | `package.json` heißt `"react-example"`, Version `0.0.0` — kein Release-Versioning für ein Compliance-Produkt mit Nachweispflicht |
| F-26 | P4 | Fünf verschiedene CORS-Implementierungen parallel (`_shared/gateway.ts` + Einzelkopien) — Migration unvollständig |
| F-27 | P4 | `governance-agents-list` dupliziert Logik, die RLS-seitig günstiger wäre |
| F-28 | P4 | Kein SBOM / keine Lockfile-Signatur trotz ISO-27001-Orientierung |
| F-29 | P4 | 21 Deploy-Workflows mit teils überlappender Zuständigkeit (Pages, VPS, Hostinger, Docker) — Konfigurations-Drift-Risiko |
| F-30 | P4 | `README`/`CLAUDE.md` führen Modul-Reifegrade in Prozent, die den Repo-Stand messen, nicht den Produktionsstand — die Tabelle in CLAUDE.md warnt korrekt davor, die Modul-Liste darunter wiederholt die Zahlen aber ungefiltert |

---

## Zählung

| Severity | Anzahl |
|---|---|
| P0 | 5 |
| P1 | 7 |
| P2 | 8 |
| P3 | 6 |
| P4 | 5 |
| **Gesamt** | **31** |

---

## Was ausdrücklich in Ordnung ist

Diese Punkte wurden gezielt angegriffen und haben gehalten:

1. **RLS auf den Kern-Tabellen** — anonyme PostgREST-Reads gegen `tenants`,
   `memberships`, `governance_assets`, `governance_events`, `runtime_events`,
   `ai_evidence_events`, `dsr_requests`, `findings`, `scan_runs`, `subscriptions`,
   `profiles`, `document_vault` liefern durchgehend `[]`. Kein Datenabfluss.
2. **Stripe-Webhook** — `constructEventAsync` mit echter HMAC-Prüfung, Idempotenz per
   `ON CONFLICT DO NOTHING` mit Rollback bei Fehlern, Tenant-Zuordnung über
   `metadata.tenant_id` mit Ablehnung bei Fehlen. Vorbildlich.
3. **Hash-Chain** — Kanonisierung, Advisory-Lock, Append-Only-Trigger, Verifier-RPC.
   Handwerklich stark (Einschränkung nur F-10: keine externe Verankerung).
4. **`kodee` SSH-Zugriff** — JWT-Auth, Action-Allowlist, `shellQuote()`,
   Timeout und Output-Cap. Keine Command-Injection gefunden.
5. **Governance-Function-Familie** (`governance-keys`, `-approvals`, `-resources`,
   `-dsr`) — korrekte zweistufige Prüfung: `auth.getUser()` gegen Anon-Client, dann
   Membership-Lookup vor jedem `service_role`-Zugriff. Das ist das Referenzmuster,
   an dem F-04/F-05 gemessen werden sollten.
6. **Keine Secrets im Repository oder in der Git-History** — Scan über Live-Key-Muster
   (Stripe, Slack, GitHub, Anthropic, Google, Supabase-JWT) fand ausschließlich
   Platzhalter (`sk_live_PLACEHOLDER`, `whsec_1234…`) und Testfixtures.
7. **Consent-Gating der eigenen Pixel** — Google Consent Mode v2, Default `denied`,
   Laden erst nach expliziter Einwilligung.
8. **Typecheck grün** (`tsc --noEmit`, strict), **2867 Unit-Tests grün** und eine
   **in CI laufende Playwright-Katalog-Suite** (`tests/e2e/`, 9 Specs) für die
   öffentliche Oberfläche — inklusive eines Consent-Tests, der mit Dummy-Pixel-IDs
   arbeitet, damit das Gating scharf gemessen wird statt trivial zu bestehen.
9. **Security-Header in Produktion** — HSTS mit `preload`, `X-Content-Type-Options`,
   `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'self'`, `object-src 'none'`.
10. **Pricing Single Source of Truth** — `npm run check:pricing` bestätigt Synchronität
    zwischen `shared/pricing.ts`, dem Deno-Zwilling und dem DB-Katalog.
