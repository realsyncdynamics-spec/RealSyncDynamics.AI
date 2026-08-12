# REALSYNC DYNAMICS AI — CODE REALITY AUDIT

**Datum:** 2026-08-09 · **Commit:** `c828ea1` · **Branch:** `claude/realsync-code-audit-u4ly5o`
**Modus:** READ-ONLY. Keine Migration, kein Deploy, keine Dependency, keine Korrektur.
**Regel:** Bei Widerspruch zwischen Doku und Code **gewinnt der Code**.

**Messmethode.** Alle Zahlen stammen aus Analysatoren über den Repo-Inhalt, nicht aus
Dokumentation. Die SQL-Auswertung spielt die Migrationen in Dateinamens-Reihenfolge ab und
berücksichtigt `RENAME TO`, `DROP POLICY` und `ALTER POLICY` — eine reine `grep`-Zählung
liefert hier falsche Ergebnisse (z. B. meldet sie `organizations` als „Tabelle ohne RLS",
obwohl sie längst zu `tenants` umbenannt wurde, und meldet `document_vault` als offen,
obwohl die offene Policy nachträglich ersetzt wurde).

---

## 0. Nachtrag vom 2026-08-09 — Prod-Abgleich und Korrekturen

Der ursprüngliche Bericht (Abschnitte 1–16) entstand rein aus dem Repo-Stand und schloss
mit der Empfehlung, als **Stufe 0** den Live-Zustand zu prüfen. Das ist inzwischen geschehen:
der Supabase-Connector war in der Folgesitzung verfügbar. Die Ergebnisse ändern die
Priorisierung erheblich und korrigieren drei Zahlen. Der Rest des Berichts bleibt unverändert
stehen, damit nachvollziehbar bleibt, was aus welcher Quelle stammt.

### 0.1 Produktion war zum Prüfzeitpunkt sauber

| Messung (Live-DB `ebljyceifhnlzhjfyxup`, 2026-08-09) | Wert |
|---|---|
| Angewendete Migrationen | **137** von 270 im Repo |
| Neueste angewendete Migration | `20260802192603` |
| Tabellen in `public` | 177 |
| davon mit RLS | **177 — also keine einzige ohne** |
| Policies | 291 |
| Existenz der 7 C-01-Funktionen | **keine einzige vorhanden** |
| `subscriptions_tenant_id_key` | **nicht vorhanden** |
| Free-Tier-Trigger | **nicht vorhanden** |
| `subscriptions` / `tenants` | 0 / 4 Zeilen |

**C-01, C-02 und C-03 waren damit nicht produktiv wirksam.** Kein Datenschutzvorfall, keine
Art.-33-Meldepflicht, kein aktuell blockierter Umsatz (es gibt schlicht noch keine
Subscriptions).

### 0.2 Das macht die Befunde nicht kleiner, sondern verschiebt sie

Alle drei liegen im **nicht angewendeten Migrations-Rückstand**. Die offene P0.2-Reconciliation
(`docs/runbooks/p0-2-migration-reconciliation.md`) ist damit kein reines Aufräumen: Sie würde
in einem Zug 33 Tabellen ohne RLS anlegen, 7 anon-freigegebene IDOR-RPCs einführen, 10 Policies
für `PUBLIC` öffnen und den C-02-Deadlock scharf schalten. Der Rückstand ist geladen, nicht harmlos.

Die Reihenfolge in §16 gilt deshalb weiter — aber als **Vorbedingung für die Reconciliation**,
nicht als Reparatur an laufender Produktion.

### 0.3 C-04 war live und ausnutzbar

Ein einzelner Probe-Request ohne jeden Header an die Produktions-Function:

```
POST https://<ref>.supabase.co/functions/v1/ai-gateway   {"op":"health"}
→ HTTP 200
  {"ok":true,
   "primary": {"ok":false, "error":"… lmstudio.internal … dns error …"},
   "fallback":[{"id":"anthropic","health":{"ok":true,"models":["claude-haiku-4-5-…"]}}]}
```

Zum Vergleich lieferte `ai-invoke` ohne Header korrekt `HTTP 401`.

Zwei Dinge zugleich: Die Function nahm unauthentifizierte Requests an (C-04 bestätigt), **und**
der EU-lokale Primärpfad war per DNS gar nicht erreichbar (`lmstudio.internal`), während der
Anthropic-Fallback als gesund gemeldet wurde. C-05 war damit nicht theoretisch — zum
Prüfzeitpunkt ging **jeder** Gateway-Request in die US-Cloud.

### 0.4 Drei Korrekturen an Zahlen des Berichts

| Stelle | Bericht | Tatsächlich | Ursache |
|---|---|---|---|
| M-03: `SECURITY DEFINER` ohne `search_path` | 5 | **18** | Der Parser erkannte `SECURITY DEFINER` nur vor dem `$$`-Body. Funktionen der Form `… AS $$ … $$ LANGUAGE plpgsql SECURITY DEFINER;` fielen durch. |
| C-01: für `anon` ausführbare `SECURITY DEFINER`-RPCs | 7 | **73** | Der Bericht zählte nur explizite `GRANT … TO anon`. Postgres vergibt `EXECUTE` auf jede neue Funktion per Default an `PUBLIC` — ein vergessenes `REVOKE` genügt. Betroffen u. a. `tenant_entitlements(uuid)`, `has_feature(uuid,text)`, `recommend_governance_plan(uuid)`. |
| §5.2: Policies, die `PUBLIC` treffen | 10 als Fehler gelistet | 10 bestätigt, **plus** eine Gruppe fälschlich unauffälliger | Policies wie `"vps_ssh_keys ist nur für Service-Role lesbar" … USING (false)` heißen nach Service-Role, gelten für `PUBLIC` und sind **korrekt** (fail-closed; `service_role` kommt über `BYPASSRLS` daran vorbei). Sie sind kein Befund. |

Alle drei Korrekturen stammen daher, dass die Befunde in einer echten Datenbank gegengeprüft
wurden statt nur in den Migrationsdateien. Das ist die Lehre aus M-01 in eigener Sache.

### 0.5 Was daraufhin umgesetzt wurde

Siehe `supabase/migrations/20260820000000_p0_security_hardening.sql`,
`test/runtime/db/p0-hardening.db.test.ts`, `supabase/config.toml`,
`supabase/functions/stripe-webhook/index.ts` und `.github/workflows/ci.yml`.
Nachweis nach Anwendung gegen ein vollständig repliziertes Schema: **0 Tabellen ohne RLS**,
**0 anon-ausführbare tenant-parametrisierte RPCs**, **0 SECURITY-DEFINER-Funktionen ohne
`search_path`**, 8/8 Härtungstests grün.

---

**Nicht geprüft (Grenze des ursprünglichen Audits):** der Live-Zustand von Datenbank und Edge
Functions. Die Abschnitte 1–16 bewerten ausschließlich den Repo-Stand; der Prod-Abgleich steht
in §0. `CLAUDE.md` dokumentiert eine erhebliche Lücke zwischen Repo und Produktion (69 nie
deployte Functions, 118 nie angewendete Migrationen) — nach eigener Messung sind es 133 nie
angewendete Migrationen.

---

## 1. Executive Summary

Der Code ist **substanzieller als erwartet** und in der Substanz sauber gebaut: `npm run lint`
ist grün, 2851 Tests laufen ohne einen einzigen Fehlschlag durch, das Frontend hat fast keine
Platzhalter-Elemente, der Evidence-Vault-Hash-Chain ist echt implementiert (nicht simuliert),
und die Kern-Mandantentrennung (`tenants` / `memberships` / `subscriptions`) hat korrekte,
durchdachte RLS-Policies.

**Die Architekturangaben in `CLAUDE.md` sind im Wesentlichen korrekt** — Cloudflare Pages,
Vite/React SPA ohne Next.js, Supabase mit RLS. Die Annahme aus der vorherigen Zusammenfassung
(„Vite + React SPA hinter Traefik / Hostinger / Docker-Stacks") stammt aus **`README.md`, und
diese Datei ist veraltet**: Sie beschreibt einen VPS-Deploy hinter Traefik, den es im aktiven
CI/CD-Pfad nicht mehr gibt. Der Code bestätigt Cloudflare.

Gefunden wurden dennoch **fünf kritische Befunde**, die inhaltlich zusammenhängen und alle aus
derselben Ursache stammen: **Feature-Migrationen, die eine eigene, schwächere Sicherheitsnorm
mitbringen als der Kern.**

1. **C-01 — Cross-Tenant-IDOR über anon-freigegebene RPCs.** Sieben `SECURITY DEFINER`-Funktionen
   nehmen `p_tenant_id` als Parameter vom Aufrufer entgegen, prüfen keine Mitgliedschaft und
   sind an `anon` freigegeben. Der Anon-Key liegt per Definition im Browser-Bundle. Mit einer
   Tenant-UUID lassen sich fremde Compliance-Scores lesen — und überschreiben.
2. **C-02 — Erste bezahlte Subscription schlägt strukturell fehl.** Der Free-Tier-Trigger und
   `UNIQUE(tenant_id)` auf `subscriptions` kollidieren mit dem `onConflict`-Ziel des
   Stripe-Webhooks. Kein neu angelegter Tenant kann zahlender Kunde werden.
3. **C-03 — 33 Tabellen ohne RLS**, darunter das komplette Steuer-Evidence- und Inventory-Modul.
4. **C-04 — `ai-gateway` ist ein unauthentifizierter LLM-Endpunkt** auf Kosten des Betreibers.
5. **C-05 — Zwei parallele AI-Stacks**, von denen einer die `eu_local`-Datenresidenz kennt und
   der andere nicht. Der residenz-blinde Stack fällt still auf Anthropic/OpenAI zurück.

**Der wichtigste strukturelle Befund** ist nicht ein einzelner Fehler, sondern das Muster:
Der Kern (`20260430180000_tenant_rls_and_webhook_events.sql`) macht es richtig — `is_tenant_member()`,
saubere Rollen-Scopes. Die Feature-Familie `20260705*` („Phase 5") macht es durchgängig falsch —
`GRANT ... TO anon`, `USING (true)` ohne `TO service_role`, kein Membership-Check. Es fehlt eine
Norm, die das beim Merge verhindert. Solange die fehlt, reproduziert sich das Muster mit jedem
neuen Feature-Batch.

**Empfehlung zur Reihenfolge:** C-02 zuerst (blockiert Umsatz, ist ein Einzeiler-Fix plus
Datenmigration), dann C-01 (Datenschutzvorfall-Potenzial), dann C-03/C-04. Details in §16.

---

## 2. Actual Architecture

Aus dem Code rekonstruiert, nicht aus der Doku abgeleitet.

```
[Browser — Vite 6.2 / React 19 SPA]
  │  src/main.tsx → src/App.tsx (react-router-dom 7.17, Client-Side)
  │  src/lib/supabase.ts · src/lib/supabaseUrl.ts   (nur VITE_* / anon key)
  │  src/lib/sentry.ts        (init nur wenn VITE_SENTRY_DSN gesetzt)
  ▼
[Cloudflare Pages]
  │  wrangler.toml → pages_build_output_dir = "dist", name = realsyncdynamics-ai
  │  public/_headers · public/_redirects   (Root-Varianten existieren NICHT)
  │  .github/workflows/deploy-cloudflare-pages.yml
  │     Live-Pfad = Cloudflare Git-Integration; Actions-Deploy ist opt-in
  ▼
[Supabase — 178 Edge Functions (Deno), 270 Migrationen]
  │
  ├── Auth: supabase.auth  →  ProtectedRoute / RequireAal2 (src/App.tsx)
  │        Edge-seitig: supabase/functions/_shared/requireAal2.ts (8 Functions)
  │
  ├── Tenancy-Wurzel:
  │        tenants ← memberships ← auth.users
  │        RLS-Helper: public.is_tenant_member(uuid)
  │                    public.is_tenant_owner_or_admin(uuid)
  │        20260430180000_tenant_rls_and_webhook_events.sql
  │        20260516400000_fix_memberships_rls_recursion.sql
  │
  ├── AI-Pfad A  (residenz-bewusst):
  │        _shared/ai.ts → resolve_ai_residency() RPC
  │                      → _shared/providers.ts (anthropic|google|openai|ollama)
  │                      → ai_tool_runs INSERT + recordUsage + cost-cap
  │        Aufrufer: ai-invoke, bot-chat, bot-voice-webhook,
  │                  kodee-advise, kodee-diagnose
  │
  ├── AI-Pfad B  (residenz-BLIND):
  │        _shared/aiGateway/router.ts  LM Studio → Anthropic → OpenAI
  │        Aufrufer: ai-gateway, ai-act-classify, classify-document,
  │                  governance-agent, telegram-webhook
  │        kein tenant_id, kein ai_tool_runs, kein Residency-Check
  │
  ├── Evidence:
  │        evidence-vault/index.ts → evidence_snapshots
  │           prev_hash → event_hash (SHA-256 über geordnetes JSON)
  │           _shared/provenanceCore.ts → Ed25519 (HMAC-Legacy-Fallback)
  │        Immutability-Trigger: evidence_snapshots,
  │           provenance_custody_events, audit_evidence, pii_redaction_log
  │
  ├── Billing:
  │        src → stripe-checkout → Stripe → stripe-webhook
  │           → subscriptions (Abos)  |  entitlement_grants (Einmalkäufe)
  │           → tenant_entitlements() RPC → hasPermission/hasModule/limitOf
  │        Quelle: shared/pricing.ts → npm run sync:pricing
  │
  └── Externe Ziele: Anthropic · Google GenAI · OpenAI · Ollama (Hostinger EU)
                     n8n · Stripe · Shopify · Telegram

[Nebenläufig, NICHT im Root-CI]
  platform/          67 Python-Dateien, FastAPI + Next.js, eigenes docker compose
  services/          runtime-core · evidence-runtime · openclaw-agent
                     playwright-scanner · perplexity-mcp
  apps/              agent-runtime · mcp-server
  packages/          sdk · siteos-core
```

---

## 3. README vs Reality

| Bereich | Doku behauptet | Code tatsächlich | Status |
|---|---|---|---|
| Frontend | Vite 6.2 + React 19 + TS strict, kein Next.js (CLAUDE.md) | `vite.config.ts`, React 19.0, `tsconfig.json: "strict": true`, kein `app/` | **MATCH** |
| Deployment Frontend | Cloudflare Pages (CLAUDE.md) / **Hostinger-VPS hinter Traefik (README.md)** | `wrangler.toml` + `deploy-cloudflare-pages.yml` aktiv; VPS-Jobs seit 2026-08-03 `workflow_dispatch`-only | **MISMATCH — README veraltet, CLAUDE.md korrekt** |
| Vercel | „NICHT verwenden" | `vercel.json` existiert, aber `{"git":{"deploymentEnabled":false}}` — bewusster Opt-out, keine Abhängigkeit | **MATCH (mit Nuance)** |
| Backend | 169 Edge Functions | **178** (+ `_shared`) | MISMATCH (Zahl veraltet) |
| Migrationen | 243/244 | **270** | MISMATCH (Zahl veraltet) |
| Database | PostgreSQL, `major_version = 15` in `config.toml` | CLAUDE.md sagt „PostgreSQL 16" | MISMATCH (klein) |
| Auth | Supabase Auth, ProtectedRoute/RequireAal2, Service-Role nur in Edge Functions | bestätigt; kein Service-Role-Key in `src/` | **MATCH** |
| RLS | „Alle Tabellen RLS-geschützt" (README), „RLS auf allen App-Tabellen" (CLAUDE.md) | **305 von 338 Tabellen. 33 ohne RLS, 25 mit RLS aber ohne jede Policy** | **MISMATCH — C-03** |
| Multi-Tenancy | `tenant_id` + RLS überall | Kern korrekt; `organizations`→`tenants` sauber migriert (20260430160000) | **MATCH im Kern** |
| AI Routing | „Jeder externe Call wird in `ai_tool_runs`/`workflow_runs` geloggt" | gilt nur für Pfad A (5 Functions). Pfad B + 4 Direktaufrufer loggen nichts | **MISMATCH — C-05** |
| Ollama `gemma3:4b` | dokumentiert | **echt konfiguriert**: `20260608000002_ollama_gemma3.sql` setzt `ai_tools.ollama_model_id='gemma3:4b'`; `docker-compose.yml:118` Service; `deploy/ollama-traefik/` | **MATCH** |
| Evidence Vault | Hash-Chain-Verifizierung, Ed25519 | echt: `prev_hash`→`event_hash`, Ed25519 mit HMAC-Fallback, Immutability-Trigger | **MATCH** |
| n8n | Webhook-Trigger → `workflow_runs` | `workflow-trigger` / `workflow-callback` schreiben `workflow_runs` | **MATCH** |
| Stripe | Metered Billing, Entitlements | vorhanden — aber strukturell blockiert | **MISMATCH — C-02** |
| Cloudflare | Pages; Workers/KV/R2 „wo sinnvoll (Phase 3)" | nur Pages. Kein `workers/`, kein `functions/`, keine KV/R2-Bindings, kein zweites wrangler-toml | MATCH (Phase 3 korrekt als offen markiert) |
| Hostinger | VPS für Services, Traefik, Ollama | `docker-compose.yml`, `deploy/ollama-traefik/`, `traefik/` real; SSH-Deploy manuell (Host über Port 22 nicht erreichbar) | MATCH (degradiert) |
| Testing | Vitest + Playwright | 245 Vitest-Dateien, 46 Playwright-Specs — 0 Fehlschläge | **MATCH** |
| Pricing SSoT | `shared/pricing.ts` (CLAUDE.md) / `src/config/pricing.ts` (README) | `shared/pricing.ts` + `sync:pricing`-Skript | **MISMATCH — README veraltet** |
| Pläne | 6 Abos inkl. Partner (CLAUDE.md) | README listet nur 5, ohne Partner | MISMATCH — README veraltet |
| `ARCHITECTURE.md` | „RealSync Agent OS", „V1.0 MVP", „UI/UX Mockups für alle SaaS-Module" | beschreibt ein anderes Produkt in einem anderen Reifegrad | **MISMATCH — vollständig veraltet** |
| Go (Sprache) | „kein Go im Repo" | bestätigt | MATCH |
| zod | „keine Dependency" | bestätigt, nicht in `package.json` | MATCH |

---

## 4. Multi-Tenant Security

Die acht Leitfragen, beantwortet am Code.

**1. Kann User A Daten von Organization B lesen?**
**Ja — auf drei Wegen.** (a) Über die anon-freigegebenen `SECURITY DEFINER`-RPCs (C-01);
dafür braucht es nicht einmal ein Konto. (b) Über die 33 Tabellen ohne RLS (C-03) — Supabase
vergibt für neue Tabellen in `public` per Default-Privileges Rechte an `anon`/`authenticated`,
und im Repo gibt es kein `REVOKE` auf Tabellen (nur auf Funktionen). (c) Über
`agent_token_usage` (H-01), dessen `FOR SELECT USING (true)` ohne `TO`-Klausel für PUBLIC gilt.

**2. Kann User A Daten von Organization B verändern?**
**Ja.** `update_compliance_score`, `add_dashboard_insight`, `log_compliance_alert`,
`resolve_compliance_alert`, `partner_increment_quota` (C-01) schreiben ohne Membership-Prüfung.
`agent_configuration` hat `FOR ALL USING (true)` ohne Rollen-Scope. Für ein Compliance-Produkt
ist die Schreibrichtung der schwerere Teil: Scores und Alerts sind der Prüfnachweis.

**3. Gibt es Tabellen ohne RLS?** Ja, 33. Liste in §5.

**4. Gibt es RLS-Policies mit falscher Ownership-Logik?**
Ja, aber der Fehler ist fast immer derselbe und mechanisch: Die Policy ist als
Service-Role-Policy *gemeint* — der Name sagt es („Service role can …") — aber die
`TO service_role`-Klausel fehlt. In Postgres gilt eine Policy ohne `TO` für `PUBLIC`. Zehn
Policies sind so gebaut (§5). Die Absicht war korrekt, die Umsetzung nicht.

**5. Gibt es Service-Role-Bypasses?**
Im Frontend: **nein.** `grep` über `src/` findet keinen Service-Role-Key — nur zwei
Kommentare, die die Regel erklären. Das ist sauber eingehalten.
Serverseitig sind 148 Funktionen `SECURITY DEFINER`; 143 davon setzen `search_path` (gut),
5 nicht (M-03).

**6. Gibt es IDOR-Risiken?** Ja — C-01 ist ein Lehrbuch-IDOR: Ressourcen-ID als Parameter,
kein Autorisierungscheck, an `anon` freigegeben.

**7. Gibt es Edge Functions ohne ausreichende Auth-Prüfung?**
61 von 178 Functions laufen mit `verify_jwt = false`. Für die Mehrheit ist das begründet und
in `config.toml` auch dokumentiert (Stripe-/Shopify-Webhooks mit HMAC, OAuth-Callbacks,
Cron-Jobs mit Shared Secret, öffentliche Free-Tools). Auffällig sind die, bei denen die
Begründung selbst einräumt, dass die Auth fehlt — allen voran `ai-gateway` (C-04), dessen
Kommentar in `config.toml:130` die Prüfung explizit auf „a follow-up PR" verschiebt.

**8. Gibt es Cross-Tenant-Leaks?** Ja: C-01, C-03, H-01.

**Was gut ist, und warum es zählt.** Der Kern der Mandantentrennung ist richtig gebaut. Die
Policies auf `tenants`, `memberships`, `subscriptions`, `assets`, `audit_events`,
`usage_counters`, `entitlement_grants` gehen alle über `is_tenant_member()` bzw. eine
`memberships`-Subquery; `20260516400000_fix_memberships_rls_recursion.sql` zeigt, dass sogar
das Rekursionsproblem bei self-referencing Policies erkannt und behandelt wurde. Der Umbau
`organizations` → `tenants` (20260430160000) ist idempotent und FK-erhaltend geschrieben.
Das ist überdurchschnittliche Arbeit. Die Befunde unten betreffen die *Peripherie*, nicht den
Kern — was die Reparatur realistisch macht.

---

## 5. RLS Findings

### 5.1 — 33 Tabellen ohne `ENABLE ROW LEVEL SECURITY`

| Cluster | Tabellen | Herkunft |
|---|---|---|
| Steuer-Evidence (8) | `tax_years`, `tax_documents`, `tax_document_links`, `tax_audit_events`, `tax_evidence_exports`, `tax_reminders`, `tax_advisor_reviews`, `tax_advisor_review_comments` | `20260518000000`, `20260523000000` |
| Inventory (9) | `inventory_items`, `inventory_locations`, `inventory_suppliers`, `inventory_movements`, `inventory_stock_levels`, `inventory_barcodes`, `inventory_audit_events`, `inventory_purchase_orders`, `inventory_purchase_order_items` | `20260517000000:11 ff.` |
| Bots/Commerce (7) | `bot_agents`, `bot_question_catalog`, `voice_channels`, `appointments`, `availability_rules`, `orders`, `order_items` | `20260628193744:31 ff.` |
| Infrastruktur (3) | `_rate_limits`, `_circuit_breakers`, `_operation_metrics` | `20260717192000` |
| Sonstige (6) | `integrations` (`20260706010000:136`), `provenance_records`, `subscription_addons` (`20260406000000`), `memory_retention_policies`, `seo_marketing_audit_log`, `social_publishing_metrics_hourly` | diverse |

Besonders schwer wiegen `tax_documents` und `tax_audit_events`: personenbezogene Steuerdaten
in einem DSGVO-Produkt. `provenance_records` enthält Signaturen und Hash-Digests — die
Integritätsschicht selbst ist ungeschützt.

### 5.2 — 10 Policies, die `PUBLIC` statt `service_role` treffen

Alle heißen „Service role can …", keine hat `TO service_role`.

| Tabelle | Policy | Datei:Zeile | Effekt |
|---|---|---|---|
| `agent_configuration` | `FOR ALL USING (true)` | `20260706011047:67` | jeder liest/ändert jede Tenant-Agent-Konfiguration |
| `agent_token_usage` | `FOR SELECT USING (true)` | `20260706011047:22` | Token-/Kostenverbrauch aller Tenants lesbar |
| `agent_token_usage` | `FOR INSERT WITH CHECK (true)` | `20260706011047:27` | Verbrauchsdaten fälschbar |
| `governance_audit_log` | `FOR INSERT WITH CHECK (true)` | `20260705170000:221` | **Prüfpfad-Einträge fälschbar** |
| `website_compliance_reports` | `FOR UPDATE USING (true)` | `20260717191000:308` | Compliance-Berichte überschreibbar |
| `website_compliance_reports` | `FOR INSERT WITH CHECK (true)` | `20260717191000` | dito |
| `api_calls` | `FOR INSERT WITH CHECK (true)` | `20260705120000` | Usage-Logs fälschbar |
| `webhook_deliveries` | `FOR INSERT WITH CHECK (true)` | `20260705130000` | Zustell-Log fälschbar |
| `email_notifications` | `FOR INSERT WITH CHECK (true)` | `20260705140000` | Mail-Log fälschbar |
| `dashboard_notifications` | `FOR INSERT WITH CHECK (true)` | `20260706010616` | Fremd-Benachrichtigungen einschleusbar |
| `deployment_logs` | `FOR INSERT WITH CHECK (true)` | `20260717191000` | Deploy-Log fälschbar |

Ein fälschbarer Prüfpfad (`governance_audit_log`) ist in einem Governance-Produkt kein
Logging-Bug, sondern ein Produktversprechen, das nicht hält.

### 5.3 — 25 Tabellen mit RLS, aber ohne jede Policy

`agent_events`, `agent_inputs`, `agent_memory`, `agent_outputs`, `ai_evidence_retention`,
`ai_runtime_events`, `app_secrets`, `compliance_escalation_chain`, `decision_agent_routings`,
6× `enterprise_*`, 6× `hermes_*`, `output_agent_deliveries`, 3× `planning_agent_*`.

**Das ist kein Sicherheitsloch** — RLS ohne Policy heißt „deny all" für `anon`/`authenticated`,
also fail-closed. Es ist ein *Funktionsbefund*: Diese Tabellen sind ausschließlich über
Service-Role erreichbar. Jede Frontend-Komponente, die sie direkt abfragt, bekommt eine leere
Liste ohne Fehlermeldung — ein Symptom, das leicht als „keine Daten" fehlgedeutet wird.
`app_secrets` ist so korrekt.

### 5.4 — Bewusst öffentliche Kataloge (kein Befund)

`compliance_frameworks`, `framework_controls`, `policy_pack_catalog`, `policy_pack_controls`,
`iso_control_definitions`, `iso_control_mappings`, `webhook_event_types`: Referenzdaten ohne
Tenant-Bezug, `FOR SELECT USING (true)` ist hier angemessen. `sub_processor_subscriptions`
erlaubt `anon`-INSERT — als Newsletter-Anmeldung gewollt, aber ohne Rate-Limit (L-01).

### 5.5 — Positiv: `document_vault` wurde korrigiert

`20260715105402` legte eine `FOR ALL USING(true)`-Policy an. `20260720124405` hat sie ersetzt
(super_admin + service_role). Die alte Migration bleibt bewusst unverändert stehen, mit einem
erklärenden Kommentar, damit `supabase db reset` die reale Historie nachspielt. Genau so soll
man mit append-only Migrationen umgehen.

---

## 6. AI Routing

**Es gibt zwei Stacks, nicht einen.** Das ist der Kern des Befunds.

| | **Pfad A** `_shared/ai.ts` | **Pfad B** `_shared/aiGateway/` |
|---|---|---|
| Aufrufer | `ai-invoke`, `bot-chat`, `bot-voice-webhook`, `kodee-advise`, `kodee-diagnose` | `ai-gateway`, `ai-act-classify`, `classify-document`, `governance-agent`, `telegram-webhook` |
| Provider-Wahl | `ai_tools.model_provider` + Residency-Override | `PROVIDER_BY_PROFILE` (statische Map, `router.ts:23`) |
| Tenant bekannt? | ja (`tenantId` Pflichtparameter) | **nein** |
| Residenz erzwungen? | **ja** — `resolve_ai_residency(tenant, user)`; Tenant-Policy schlägt User-Pref | **nein** |
| `eu_local` ohne lokales Modell | harter Fehler `LOCAL_UNAVAILABLE` (503) — kein stiller Cloud-Fallback | n/a |
| Logging | `ai_tool_runs` INSERT + `recordUsage` | **keines** |
| Kosten | `cost-cap.ts`: Reservierung vor Call, Settle danach; Ollama = 0 | **keine** |
| Quota | Token- + Call-Limit vor dem Call geprüft | **keine** |

**Kann ein EU-local-Tenant versehentlich Cloud-AI verwenden? Ja.** Nicht in Pfad A — der ist
korrekt und verweigert lieber den Dienst, als still in die Cloud zu fallen. Aber Pfad B kennt
den Tenant gar nicht und hat in `router.ts` eine fest verdrahtete Fallback-Kette
LM Studio → Anthropic → OpenAI. Jedes Feature, das über Pfad B läuft — darunter
`ai-act-classify` und `governance-agent`, also ausgerechnet die Governance-Funktionen —
ignoriert `enforce_eu_local`. Der Betreiber kann die Kette zwar verkürzen, indem er die
API-Keys weglässt, aber das ist eine globale Betreiberentscheidung, keine Tenant-Policy.

**Wo laufen Prompts?** Pfad A: Ollama auf Hostinger EU (`docker-compose.yml:118`, hinter
Traefik-BasicAuth) oder Anthropic/Google/OpenAI. Pfad B: LM Studio (`LM_STUDIO_BASE_URL`, in
keiner Compose-Datei definiert — externe Konfiguration) mit Cloud-Fallback.

**Werden personenbezogene Daten vor Cloud-Inferenz entfernt? Nein.** `_shared/redact.ts` wird
von genau fünf Functions genutzt: `evidence-export`, `evidence-vault-export`,
`audit-report-pdf`, `gdpr-export`, `governance-erasure-sweeper` — also ausschließlich beim
**Export**, nie vor einem Provider-Call. Beide AI-Pfade schicken den Input unverändert raus.

**Ist `gemma3:4b` konfiguriert oder nur dokumentiert? Konfiguriert.** Die Kette ist
nachvollziehbar: `qwen2.5:7b` (20260501) → `qwen2.5:3b` (20260503, RAM-Limit) → `qwen3:4b`
(20260503) → `gemma3:4b` (`20260608000002_ollama_gemma3.sql:12`). Gilt für `ai_tools`, also
Pfad A. Pfad B nutzt LM Studio und weiß von `gemma3:4b` nichts.

---

## 7. Evidence / Audit

**Backend-real (A).** Der Evidence-Vault ist keine Attrappe.
`supabase/functions/evidence-vault/index.ts` baut eine echte Kette: Version + `prev_hash` aus
dem letzten Snapshot (Z. 105–111), `event_hash = SHA-256` über ein **geordnetes** JSON-Objekt
(Z. 35–37, die Feldreihenfolge ist fixiert — ohne das wäre die Kette nicht reproduzierbar),
Ed25519-Signatur mit HMAC-Legacy-Fallback (`_shared/provenanceCore.ts:56–64`), und
`appendCustodyEvent` verknüpft in denselben Vorgang. Datenbankseitig verhindern
`BEFORE UPDATE OR DELETE`-Trigger nachträgliche Änderungen an `evidence_snapshots`,
`provenance_custody_events`, `audit_evidence` und `pii_redaction_log`.

**Nur Schema, kein Code (C).** `20260720100000_audit_evidence_integrity.sql` legt auf
`audit_findings` die Spalten `finding_hash`, `chain_hash`, `evidence_root_hash` und
`parent_finding_id` an — mit dem ausdrücklichen Hinweis „computed by application layer",
Trigger „deferred to Phase 3". Eine Suche über `src/`, `supabase/functions/` und `services/`
findet **keinen einzigen Schreiber** dieser Spalten; der einzige Treffer ist ein Kommentar in
`src/lib/export-bundle.ts:104`. Die Spalten sind seit dem Anlegen leer und die Indizes darauf
ohne Funktion. Wer `audit_findings.chain_hash` für einen Integritätsnachweis hält, irrt.

**Fälschbar (siehe §5.2).** `governance_audit_log` nimmt INSERTs von PUBLIC entgegen.

---

## 8. Stripe / Entitlements

Der Fluss ist vollständig gebaut: `stripe-checkout` → Stripe → `stripe-webhook` (798 Zeilen,
Signaturprüfung über `constructEventAsync` mit `STRIPE_WEBHOOK_SECRET`, Z. 65–81) →
`subscriptions` bzw. `entitlement_grants` → `tenant_entitlements()` → `hasPermission()`.
Die Trennung Abo/Einmalkauf ist im Code ausführlich begründet (Z. 226–240) und stimmt mit
`CLAUDE.md` überein. Die Idempotenz über `UNIQUE(source, purchase_reference)` ist korrekt.

**Aber der Pfad ist strukturell unterbrochen.** Der bekannte Architekturkonflikt ist nicht
theoretisch, er ist deterministisch reproduzierbar:

1. `20260802000000_fix_free_tier_entitlements.sql:101–105` legt einen `AFTER INSERT`-Trigger
   auf `tenants` an. Jeder neue Tenant bekommt sofort eine `subscriptions`-Zeile:
   `tenant_id = X`, `plan_key='free_tier'`, `stripe_customer_id='free_tier_no_stripe_X'`,
   **`stripe_subscription_id = NULL`**.
2. `20260711000001_subscription_tenant_unique.sql:12` erzwingt `UNIQUE (tenant_id)`.
3. Der Kunde zahlt. `stripe-webhook/index.ts:219–220` führt aus:
   `.upsert(row, { onConflict: 'stripe_subscription_id' })`.
4. Die vorhandene Zeile hat dort `NULL`. Postgres behandelt NULLs in Unique-Indizes als
   verschieden — der Konflikt greift **nicht**, der Upsert wird zum reinen INSERT.
5. Das INSERT verletzt `subscriptions_tenant_id_key`. Fehler 23505.
6. `if (error) throw error;` (Z. 221) → HTTP 500 → Stripe retryt → schlägt jedes Mal erneut fehl.

**Ergebnis: Ein Tenant, der nach dem 2026-08-02 angelegt wurde, kann nicht zahlender Kunde
werden.** Das Geld wird bei Stripe eingezogen, die Berechtigung erreicht das Produkt nie.
Es gibt keine spätere Migration, die den Trigger entfernt, die Constraint ändert oder das
`onConflict`-Ziel korrigiert — geprüft über alle 13 Migrationen nach `20260802`.

`create-trial-subscription/index.ts:68` schreibt ebenfalls in `subscriptions` und ist derselben
Kollision ausgesetzt.

---

## 9. Cloudflare / Deployment

**Tatsächlich implementiert:** ausschließlich Cloudflare **Pages**.
`wrangler.toml` enthält genau die drei für Pages erlaubten Felder (`name`,
`pages_build_output_dir`, `compatibility_date`) und dokumentiert im Kommentar korrekt, dass
`build_command` dort still ignoriert würde. `public/_headers` und `public/_redirects`
existieren; die früheren Root-Varianten wurden entfernt, weil Vite nur `public/` nach `dist/`
kopiert — sie hätten das Build-Ergebnis nie erreicht.

**Nicht implementiert:** Workers, KV, R2, Hyperdrive, D1. Kein `workers/`-Verzeichnis, kein
`functions/`-Verzeichnis, kein zweites `wrangler-workers.toml`, keine Bindings.
`CLAUDE.md` markiert das korrekt als Phase 3 — hier gibt es keine Diskrepanz, nur eine offene
Aufgabe.

**Zwei Deploy-Pfade, sauber entschärft.** Die Cloudflare-Git-Integration ist der Live-Pfad;
der Actions-Deploy läuft nur, wenn beide Repo-Secrets gesetzt sind, und wird sonst *skipped*
statt *failed*. Die Opt-in-Variable `CLOUDFLARE_ACTIONS_DEPLOY` macht ein fehlendes Secret zum
harten Fehler, sobald Actions der einzige Pfad ist. Das ist gut durchdacht.

**Prerender:** `build` (Dashboard-Pfad) nutzt `prerender:safe` — non-fatal, fällt im
Fehlerfall auf die SPA-Shell zurück. `build:full` (Actions) nutzt `PRERENDER_STRICT=1`.
Die Asymmetrie ist absichtlich und im `wrangler.toml`-Kommentar begründet.

**Hostinger/VPS:** real vorhanden (`docker-compose.yml`, `traefik/`, `deploy/ollama-traefik/`),
aber degradiert — die SSH-Jobs wurden am 2026-08-03 auf `workflow_dispatch` umgestellt, weil
Port 22 nicht erreichbar ist. `deploy-hostinger.yml` läuft bei jedem Push, aber nur der
Build-Job; der Deploy-Job ist per `if: github.event_name == 'workflow_dispatch'` gesperrt.

---

## 10. CI/CD

**Was gut ist.** `ci.yml` ist ernsthaft gebaut: Typecheck, Edge-Function-Syntaxcheck
(als direkte Konsequenz aus `DEBUG_ROOT_CAUSE_2026-08-02.md`), Unit-Tests, Build. Der `db`-Job
fährt ein pgvector-Postgres hoch, stubbt die Supabase-Schemas (`auth`, `vault`, `cron`, `net`,
`storage`) und spielt **alle 270 Migrationen einzeln mit `ON_ERROR_STOP=1`** durch — das ist
eine echte Migrationsvalidierung, nicht nur ein Lint. Dazu eine Append-only-Prüfung, die das
Editieren gemergter Migrationen blockiert (mit `[hotfix]`-Ausnahme). Alle Actions sind auf
SHA gepinnt. Node 20 durchgängig.

**Der Deploy-Workflow ist ehrlich.** `deploy.yml` dokumentiert im Kommentar seine eigene
Vorgeschichte: Erst `|| true` (schluckte jeden Fehler), dann `::error::` ohne Exit-Code
(Job blieb grün, obwohl nichts deployte), jetzt harter Exit. Der Kommentar sagt ausdrücklich:
„Migrationen deployen derzeit NICHT". Der Function-Deploy läuft inzwischen pro Function statt
über einen gemeinsamen Modulgraphen — die Ursache dafür, dass ein Syntaxfehler wochenlang
73 Functions blockierte, ist behoben.

**Die Lücke:** Der `db`-Job validiert Migrationen, setzt aber **nie `TEST_DB_URL`**. Damit
laufen die 18 DB-Integrationstests — inklusive des einzigen echten RLS-Tests — in CI nie.
Das Schema wird geprüft, das Sicherheitsverhalten des Schemas nicht. Siehe M-01.

---

## 11. Testing

Ausgeführt am 2026-08-09 gegen `c828ea1`.

```
npm run lint   → tsc --noEmit, Exit 0, keine Fehler
npx vitest run → Test Files  225 passed | 20 skipped (245)
                 Tests      2851 passed | 104 skipped | 96 todo (3051)
                 Duration   94.22s
```

| Kategorie | Gefunden | Bestanden | Skipped | Failing |
|---|---|---|---|---|
| Vitest gesamt | 3051 | 2851 | 104 (+96 todo) | **0** |
| Vitest-Dateien | 245 | 225 | 20 | 0 |
| Playwright E2E | 46 Specs | nicht ausgeführt (braucht laufenden Dev-Server) | — | — |
| DB-Integration (`test/runtime/db/`) | 18 Dateien | **0 ausgeführt** | 18 | — |
| RLS-Tests | **1 Datei, 4 Assertions** | 0 ausgeführt | 1 | — |
| Security-Tests | 2 Dateien (`InputValidator`, `OutputSanitizer`) | bestanden | — | 0 |
| Stripe-Tests | `test/stripe-checkout.test.ts` + `test/billing/` | bestanden | — | 0 |
| Edge-Function-Tests | `test/edge/` + `npm run check:edge-syntax` | bestanden | — | 0 |

**Null Fehlschläge bei 2851 Tests ist ein starkes Signal** — die Suite ist gepflegt, nicht
verrottet. Aber sie misst nicht, was dieses Audit findet.

Die 20 skipped Dateien sind exakt die DB-Integrationstests. `test/runtime/db/db-helpers.ts:8`
erklärt es: „If `TEST_DB_URL` is not set, `getDb()` returns null and the test files gracefully
skip. CI without a DB still passes." Das ist als Design gewollt und dokumentiert — nur setzt
weder CI noch der lokale Default-Lauf die Variable, also läuft es faktisch nie.

Selbst wenn es liefe: `test/runtime/db/rls.db.test.ts` deckt **4 Assertions** ab, alle auf
`runtime_events` / `subject_ref`. Bei 338 Tabellen entspricht das rund **0,6 % Abdeckung** der
Mandantentrennung. Kein einziger der 33 RLS-losen Tabellen und keine der 10 PUBLIC-Policies
wäre von einem bestehenden Test erfasst worden. Das erklärt, warum eine grüne Suite und die
Befunde aus §5 nebeneinander existieren können.

---

## 12. Feature Reality Matrix

| Feature | Kategorie | Belegt durch |
|---|---|---|
| Multi-Tenancy (Kern) | **A — REAL** | `is_tenant_member()`, Policies auf `tenants`/`memberships`/`subscriptions` |
| Evidence Vault (Hash-Chain, Ed25519) | **A — REAL** | `evidence-vault/index.ts`, `provenanceCore.ts`, Immutability-Trigger |
| Provenance / C2PA | **A — REAL** | Ed25519 `provenanceCore.ts:56–64`, `c2pa-manifest-generate`, `provenance_custody_events` |
| AI-Tools mit Quota + Cost-Tracking | **A — REAL** | `_shared/ai.ts`, `cost-cap.ts`, `usage.ts`, `ai_tool_runs` |
| EU-Datenresidenz (Pfad A) | **A — REAL** | `resolve_ai_residency()`, `20260501120000`, `gemma3:4b` konfiguriert |
| DSGVO-Selfservice (Art. 15/17) | **A — REAL** | `gdpr-export`, `gdpr-delete` mit `requireAal2` |
| n8n-Workflows | **A — REAL** | `workflow-trigger`/`workflow-callback` → `workflow_runs` |
| Policy Packs | **A — REAL** | `20260701150000_policy_packs.sql`, `policy_pack_catalog`, Recommender in `src/lib/governance/` |
| Prerendering / SEO | **A — REAL** | `scripts/prerender.mjs`, Build-Gate prüft `dist/pricing/index.html` |
| MFA / AAL2 | **A — REAL** | `_shared/requireAal2.ts` in 8 Functions, `RequireAal2` in `src/App.tsx` |
| Billing / Entitlements | **B — PARTIAL** | vollständig gebaut, aber durch C-02 im Erstkauf blockiert |
| AI Governance (Pfad B) | **B — PARTIAL** | Klassifikation läuft, aber ohne Tenant/Residenz/Logging/Kosten |
| Risk Score | **B — PARTIAL** | `compute_tenant_risk_score` real; `update_compliance_score` von anon schreibbar (C-01) |
| Audit-Modul (DSGVO-Scan) | **B — PARTIAL** | `gdpr-audit`, `cookie-scan` real; `audit_findings`-Hash-Chain nur Schema |
| Vendor Management | **B — PARTIAL** | `vendors`, `asset_vendor_links` mit RLS; nur Service-Role-Policies, kein Member-Zugriff |
| Monitoring | **B — PARTIAL** | `monitored_domains`, `audit_monitor_results` real; `_operation_metrics`/`_circuit_breakers` ohne RLS |
| Steuer-Evidence | **B — PARTIAL** | Schema + Runtime vorhanden, **8 Tabellen ohne RLS** (C-03) |
| Inventory / Bots / Commerce | **B — PARTIAL** | 16 Tabellen ohne RLS (C-03) |
| `audit_findings` Hash-Chain | **C — SCHEMA ONLY** | Spalten ohne jeden Schreiber (§7) |
| Team-Verwaltung (`workspace_members`) | **C — BROKEN** | Tabelle existiert in keiner Migration (M-02) |
| Compliance-Prüfpfad-UI (`compliance_audit_log`) | **C — BROKEN** | Tabelle existiert nicht (M-02) |
| Report Builder | **C — BROKEN** | `report_configurations`, `generated_reports` existieren nicht (M-02) |
| Compliance-Trends | **C — BROKEN** | `compliance_snapshots` existiert nicht (M-02) |
| Scan-Limits (Billing-Gate) | **C — BROKEN** | `scans` existiert nicht (M-02) |
| ISO 42001 Certification Hub | **C — UI ONLY** | „Coming Soon" in `Iso42001CertificationHubView.tsx:427` |
| Cloudflare Workers / KV / R2 | **C — NICHT VORHANDEN** | korrekt als Phase 3 offen markiert |

**Frontend-Hygiene ist gut.** Nur 1× `href="#"`, 4 TODO/FIXME in ganz `src/`, 7 „Coming
soon"-Stellen, davon die meisten legitime Status-Labels in Agent-Karten. Gemessen am
Leitprinzip „Funktionen funktionsfähig machen" ist das Frontend in Ordnung — die kaputten
Features (M-02) sind nicht vorgetäuscht, ihnen fehlt die Datenbankseite.

---

## 13. Critical Findings

---

**ID:** C-01
**Severity:** CRITICAL
**File:** `supabase/migrations/20260705300000_dashboard_intelligence_layer.sql:304,355,388`;
`20260705240000_compliance_monitoring_alerts.sql:222,258,288`;
`20260705210000_partner_provisioning.sql:147`
**Finding:** Sieben `SECURITY DEFINER`-Funktionen nehmen `p_tenant_id` (bzw. `p_alert_id`,
`p_partner_id`) als Aufrufer-Parameter, führen **keine Membership-Prüfung** durch und sind per
`GRANT EXECUTE … TO anon` freigegeben. `SECURITY DEFINER` umgeht RLS per Definition.
**Impact:** Cross-Tenant-Lesen **und -Schreiben** ohne Konto. `get_dashboard_summary` liefert
Compliance-Score, Risikozahlen, offene Incidents, Insights und KPIs eines beliebigen Tenants.
`update_compliance_score` schreibt einen fremden Compliance-Score neu. `add_dashboard_insight`
und `log_compliance_alert` schleusen Einträge in fremde Mandanten. `resolve_compliance_alert`
schließt fremde Alerts (nimmt nur `p_alert_id` — nicht einmal ein Tenant-Bezug nötig).
`partner_increment_quota` manipuliert fremde Provisioning-Kontingente.
Der Anon-Key ist per Definition öffentlich (er steht im Browser-Bundle jeder SPA); die einzige
Hürde ist die Kenntnis einer Tenant-UUID, und die wandert durch URLs, Support-Tickets, Exporte
und Webhook-Payloads. Für ein DSGVO-Produkt ist das ein meldepflichtiger Vorfall nach Art. 33.
**Evidence:**
```sql
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(p_tenant_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
  ...  WHERE tenant_id = p_tenant_id     -- ← Parameter, kein auth.uid()-Bezug
$$;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(UUID) TO anon, authenticated, service_role;
```
**Recommendation:** `GRANT` auf `service_role` (+ ggf. `authenticated`) reduzieren und in jeder
Funktion zu Beginn prüfen:
`IF NOT public.is_tenant_member(p_tenant_id) THEN RAISE EXCEPTION 'forbidden'; END IF;`
Für `resolve_compliance_alert` den Tenant erst aus `compliance_alert_log` auflösen, dann prüfen.
Der Helper existiert bereits und wird im Kern durchgängig genutzt — es fehlt nur seine Anwendung.

---

**ID:** C-02
**Severity:** CRITICAL
**File:** `supabase/functions/stripe-webhook/index.ts:219–221`;
`supabase/migrations/20260711000001_subscription_tenant_unique.sql:12`;
`supabase/migrations/20260802000000_fix_free_tier_entitlements.sql:101–105`
**Finding:** Der Free-Tier-Trigger legt bei jedem neuen Tenant eine `subscriptions`-Zeile mit
`stripe_subscription_id = NULL` an. Der Stripe-Webhook upsertet mit
`onConflict: 'stripe_subscription_id'`. Da Postgres NULLs in Unique-Indizes als verschieden
behandelt, greift der Konflikt nicht — der Upsert wird zum INSERT und verletzt
`subscriptions_tenant_id_key UNIQUE (tenant_id)`.
**Impact:** Die erste bezahlte Subscription eines Tenants schlägt mit 23505 fehl. `throw error`
liefert HTTP 500, Stripe wiederholt, das Ergebnis bleibt identisch. Die Zahlung wird eingezogen,
die Berechtigung erreicht das Produkt nie — der Kunde bleibt auf `free_tier`. Betroffen ist
jeder Tenant, der nach Anwendung von `20260802000000` angelegt wurde. Das ist ein direkter,
vollständiger Umsatzblocker.
**Evidence:**
```ts
// stripe-webhook/index.ts:219
const { error } = await admin
  .from('subscriptions')
  .upsert(row, { onConflict: 'stripe_subscription_id' });
if (error) throw error;
```
```sql
-- 20260802000000:88  Trigger-Insert, stripe_subscription_id bleibt NULL
INSERT INTO public.subscriptions (tenant_id, stripe_customer_id, plan_key, status, billing_interval)
VALUES (NEW.id, 'free_tier_no_stripe_' || NEW.id, 'free_tier', 'active', 'month')
ON CONFLICT DO NOTHING;
```
Geprüft: keine der 13 Migrationen nach `20260802` entfernt den Trigger, ändert die Constraint
oder korrigiert das `onConflict`-Ziel.
**Recommendation:** `onConflict` auf `tenant_id` umstellen (deckt sich mit der fachlichen Regel
„genau ein Abo pro Tenant" und mit dem Kommentar der Constraint), plus Bestandsprüfung, ob
bereits fehlgeschlagene Checkouts nachgezogen werden müssen. `create-trial-subscription:68`
im selben Zug prüfen. Vorher ein DB-Integrationstest, der genau diese Sequenz durchspielt —
ohne ihn kommt der Fehler zurück.

---

**ID:** C-03
**Severity:** CRITICAL
**File:** `supabase/migrations/20260518000000_tax_evidence_runtime.sql`;
`20260517000000_operations_inventory.sql:11 ff.`; `20260628193744_bots_foundation.sql:31 ff.`;
`20260706010000_api_and_webhooks.sql:136`; `20260406000000_entitlements_schema.sql`;
`20260717192000_add_monitoring_tables.sql`
**Finding:** 33 Tabellen haben nie `ENABLE ROW LEVEL SECURITY` erhalten (vollständige Liste §5.1).
Das Repo enthält keine `REVOKE`-Anweisung auf Tabellenebene — Supabase-Default-Privileges
gewähren `anon` und `authenticated` Zugriff auf neue Tabellen in `public`.
**Impact:** Vollständiger mandantenübergreifender Lese- und Schreibzugriff auf die betroffenen
Module. Am schwersten: `tax_documents`, `tax_document_links`, `tax_audit_events`
(personenbezogene Steuerdaten in einem DSGVO-Produkt) und `provenance_records`, das Hash-Digests
und Signaturen enthält — die Integritätsschicht selbst ist ungeschützt. `orders`/`order_items`
enthalten Bestelldaten. Widerspricht direkt der Zusage in `README.md` („Alle Tabellen
RLS-geschützt") und der harten Regel in `CLAUDE.md` („Tabellen ohne RLS anlegen — NIEMALS").
**Evidence:** Replay aller 270 Migrationen: 338 effektive Tabellen, 305 mit `ENABLE ROW LEVEL
SECURITY`, 0 mit `FORCE`. Die 33 Differenz-Tabellen tauchen in keiner `ALTER TABLE … ENABLE
ROW LEVEL SECURITY` auf.
**Recommendation:** Eine additive Migration pro Cluster (Tax / Inventory / Bots / Infra /
Sonstige), jeweils `ENABLE ROW LEVEL SECURITY` plus tenant-basierte Policies nach dem Muster
aus `20260430180000`. Die Infra-Tabellen (`_rate_limits`, `_circuit_breakers`,
`_operation_metrics`) brauchen nur RLS ohne Policy (Service-Role-only) — das ist der
schnellste Teilschritt. Anschließend eine CI-Regel, die neue `CREATE TABLE` ohne begleitendes
`ENABLE ROW LEVEL SECURITY` blockiert; sonst wächst die Liste weiter.

---

**ID:** C-04
**Severity:** CRITICAL
**File:** `supabase/functions/ai-gateway/index.ts:84–110`; `supabase/config.toml:126–131`
**Finding:** `ai-gateway` läuft mit `verify_jwt = false` und führt selbst **keinerlei**
Authentifizierung durch. Der einzige Schutz ist ein In-Memory-Rate-Limit (`MINUTE_WINDOWS`,
`HOUR_WINDOWS` als `Map` im Modul-Scope), gekeyt auf einen gesalzenen IP-Hash. Die Funktion
bedient zusätzlich eine OpenAI-kompatible Schnittstelle (`/v1/chat/completions`, `/v1/models`).
**Impact:** Jeder mit der Function-URL kann unbegrenzt Inferenz auf Kosten des Betreibers
ausführen — die Fallback-Kette nutzt `ANTHROPIC_API_KEY` und `OPENAI_API_KEY` aus dem Vault.
Das Rate-Limit ist wirkungslos: Es lebt pro Isolate (mehrere Isolates teilen den Zustand nicht),
verfällt bei jedem Cold Start, und IP-Rotation umgeht es ohnehin. Die OpenAI-Kompatibilität
macht den Missbrauch trivial — jeder OpenAI-SDK-Client funktioniert ohne Anpassung. Zusätzlich:
kein `ai_tool_runs`-Eintrag, keine Kostenzuordnung, kein Tenant — Missbrauch wäre auch
nachträglich nicht zuzuordnen.
**Evidence:** `config.toml:126–131` benennt die Lücke selbst:
> „AI Gateway — provider-neutral inference endpoint. Public per spec (frontend talks to it
> directly without bearer tokens). The actual auth + rate-limit + tenant-scope checks live
> inside the function once it starts handling tenant-scoped traffic **in a follow-up PR**."

Der Follow-up-PR ist im Code nicht angekommen.
**Recommendation:** Kurzfristig `verify_jwt = true` setzen (der Frontend-Client
`src/core/ai-gateway/edgeClient.ts` schickt bereits einen `Authorization`-Header) oder ein
Shared-Secret vorschalten. Mittelfristig Tenant-Auflösung + persistentes Rate-Limit
(`_rate_limits` existiert bereits) + `ai_tool_runs`-Logging + Anbindung an `cost-cap.ts`.
Bis dahin gehört die Function nicht öffentlich erreichbar.

---

**ID:** C-05
**Severity:** CRITICAL (Compliance) / HIGH (technisch)
**File:** `supabase/functions/_shared/aiGateway/router.ts:15–17,23–29`; Aufrufer:
`ai-act-classify`, `classify-document`, `governance-agent`, `telegram-webhook`, `ai-gateway`
**Finding:** Zwei parallele AI-Stacks. Pfad A (`_shared/ai.ts`) erzwingt Datenresidenz über
`resolve_ai_residency(tenant, user)` und verweigert bei `eu_local` ohne lokales Modell den
Dienst (`LOCAL_UNAVAILABLE`, 503) statt still in die Cloud zu fallen — vorbildlich. Pfad B
(`_shared/aiGateway/`) kennt weder Tenant noch Residenz und hat eine fest verdrahtete
Fallback-Kette LM Studio → Anthropic → OpenAI.
**Impact:** Ein Tenant mit `ai_data_residency_policy = 'enforce_eu_local'` bekommt für jedes
über Pfad B laufende Feature US-Cloud-Inferenz. Betroffen sind ausgerechnet
`ai-act-classify` und `governance-agent` — die Funktionen, deren Zweck EU-AI-Act-Konformität
ist. Da Pfad B nichts in `ai_tool_runs` schreibt, ist der Vorgang auch nicht nachweisbar.
Das kollidiert mit der Zusage in `src/features/legal/AVVTemplate.tsx:132` („Der Kunde kann pro
Tenant erzwingen, dass alle KI-Aufrufe ausschließlich auf EU-Servern verarbeitet werden") und
in `SubProcessors.tsx` — also mit vertraglich zugesicherten Aussagen gegenüber Kunden.
Verschärfend: `_shared/redact.ts` wird vor **keinem** Provider-Call angewendet, auf keinem
der beiden Pfade; personenbezogene Daten gehen unverändert an den Provider.
**Evidence:** `router.ts:15–17` beschreibt die Umgehung als Feature:
> „Strict-EU-locality deployments disable a step by simply not setting its API key in Vault."

Das ist eine globale Betreiber-Einstellung, keine Tenant-Policy — genau das, was
`enforce_eu_local` pro Tenant leisten soll.
**Recommendation:** Entscheidung erzwingen: entweder Pfad B um `tenantId` + Residency-Check
erweitern (dann kann `resolveAdapter` bei `eu_local` die Cloud-Kette überspringen), oder die
fünf Pfad-B-Aufrufer auf Pfad A umstellen. Zusätzlich `redact.ts` vor jedem Cloud-Call
anwenden. Bis zur Klärung sollte die AVV-Zusage geprüft werden — das ist eine juristische,
keine technische Frage.

---

## 14. High Findings

**ID:** H-01 · **Severity:** HIGH
**File:** `supabase/migrations/20260706011047_agent_token_budget.sql:22,27,67`
**Finding:** Drei Policies mit `USING (true)` / `WITH CHECK (true)` und **ohne** `TO
service_role` — sie gelten damit für `PUBLIC`. Die Namen („Service role can view token
usage", „Service role can manage agent config") zeigen die Absicht; sie ist nicht umgesetzt.
**Impact:** `agent_token_usage` ist tenant-übergreifend lesbar (Token-Verbrauch, Kosten,
Nutzungsmuster aller Kunden — Geschäftsdaten) und beschreibbar (Verbrauchsdaten fälschbar,
mit Auswirkung auf Metered Billing). `agent_configuration` (`FOR ALL`) ist von jedem lesbar
**und änderbar** — inklusive Budget-Limits fremder Tenants.
**Evidence:** `CREATE POLICY "Service role can manage agent config" ON agent_configuration FOR ALL USING (true);`
**Recommendation:** `TO service_role` ergänzen; für Nutzer-Lesezugriff eine zweite Policy mit
`is_tenant_member(tenant_id)`.

**ID:** H-02 · **Severity:** HIGH
**File:** `supabase/migrations/20260705170000_phase5c_analytics_collaboration.sql:221`
**Finding:** `governance_audit_log` erlaubt INSERT von `PUBLIC` (`WITH CHECK (true)`, kein `TO`).
**Impact:** Der Prüfpfad — das zentrale Produktversprechen — ist von außen befüllbar. Beliebige
Einträge mit fremder `tenant_id`, fremder `user_id` und frei gewählter `action` sind möglich.
Ein Prüfpfad, dessen Einträge nicht authentisch sind, ist als Nachweis wertlos; für
EU-AI-Act-Art.-12-Protokollierung ist das disqualifizierend. Die Tabelle hat zudem keinen
Immutability-Trigger (anders als `audit_evidence`).
**Recommendation:** `TO service_role`; zusätzlich `BEFORE UPDATE OR DELETE`-Trigger nach dem
Muster von `audit_evidence_block_modification()`.

**ID:** H-03 · **Severity:** HIGH
**File:** `supabase/migrations/20260717191000_website_operations_core.sql:308`
**Finding:** `website_compliance_reports` erlaubt UPDATE (`USING (true) WITH CHECK (true)`) und
INSERT von `PUBLIC`. Analog `deployment_logs` (INSERT).
**Impact:** Compliance-Berichte sind nachträglich von jedem änderbar. Ein Bericht, der
manipuliert werden kann, trägt keine Beweiskraft.
**Recommendation:** `TO service_role`.

**ID:** H-04 · **Severity:** HIGH
**File:** `supabase/migrations/20260705120000_api_usage_logging.sql`;
`20260705130000_webhook_notifications.sql`; `20260705140000_email_notifications.sql`;
`20260706010616_dashboard_notifications.sql`
**Finding:** Vier weitere INSERT-Policies mit `WITH CHECK (true)` ohne Rollen-Scope.
**Impact:** `api_calls` steuert Usage-basiertes Billing — fälschbare Einträge verzerren die
Abrechnung. `dashboard_notifications` erlaubt das Einschleusen von Benachrichtigungen in fremde
Mandanten (Phishing-Vektor innerhalb des Produkts). `webhook_deliveries` und
`email_notifications` verfälschen Zustellnachweise.
**Recommendation:** durchgängig `TO service_role`.

**ID:** H-05 · **Severity:** HIGH
**File:** `supabase/functions/_shared/middleware.ts:110–127`
**Finding:** `extractContext()` liest `userId` und `tenantId` aus den Client-Headern
`X-User-ID` / `X-Tenant-ID` und gibt sie ungeprüft als Kontext zurück. `validateAuth()` prüft
nur die *Form* des `Authorization`-Headers (`Bearer <irgendwas>`), verifiziert aber kein Token.
**Impact:** Wer `withErrorHandling` als Auth-Schicht versteht, baut eine Function, in der die
Mandanten-Identität vom Aufrufer frei wählbar ist. Aktuell nutzt nur
`website-operations-agent` diesen Helper (die Function ist `verify_jwt = true`, was den
Schaden begrenzt) — das Risiko liegt in der Wiederverwendung. `tenant-audit/index.ts:91` liest
`x-tenant-id` ebenfalls direkt aus dem Header.
**Recommendation:** `extractContext` auf `supabase.auth.getUser()` + `memberships`-Lookup
umstellen, oder die beiden Funktionen entfernen, damit sie nicht als Vorbild dienen.
Kommentar an `validateAuth` klarstellen, dass sie *keine* Authentifizierung ist.

**ID:** H-06 · **Severity:** HIGH
**File:** `supabase/functions/_shared/middleware.ts:5`
**Finding:** `import { retryWithBackoff } from '../../src/lib/circuit-breaker';` — eine
Deno-Edge-Function importiert aus dem Browser-`src/`-Baum, ohne `.ts`-Endung.
**Impact:** Bricht die Trennung Frontend/Edge-Runtime. Deno verlangt explizite
Dateiendungen; der Import ist ein Kandidat für genau die Modulgraph-Fehler, die laut
`DEBUG_ROOT_CAUSE_2026-08-02.md` schon einmal 73 Function-Deploys blockiert haben. Zudem kann
so unbeabsichtigt Browser-Code (inkl. dessen Annahmen über `window`) in die Serverumgebung
gelangen.
**Recommendation:** Die benötigte Logik nach `supabase/functions/_shared/` duplizieren oder
in ein von beiden Seiten importierbares Paket ziehen. `npm run check:edge-syntax` sollte
solche Cross-Boundary-Imports melden.

---

## 15. Medium Findings

**ID:** M-01 · **Severity:** MEDIUM
**File:** `.github/workflows/ci.yml` (db-Job); `test/runtime/db/db-helpers.ts:8`
**Finding:** CI spielt alle 270 Migrationen gegen ein echtes Postgres, setzt aber nie
`TEST_DB_URL`. Damit skippen alle 18 DB-Integrationstests, inklusive
`test/runtime/db/rls.db.test.ts`. Dieser deckt zudem nur 4 Assertions auf `runtime_events` ab
— rund 0,6 % der 338 Tabellen.
**Impact:** Das erklärt, warum 2851 grüne Tests und die Befunde C-01/C-03/H-01…H-04
koexistieren: Es gibt schlicht keinen Test, der Mandantentrennung prüft. Die Infrastruktur ist
vorhanden (Helper, Transaktions-Rollback, `withClaims`) — sie wird nur nicht ausgeführt.
**Recommendation:** Im `db`-Job nach dem Migrations-Schritt `TEST_DB_URL` auf den
Service-Container setzen und `npm run test:db` ergänzen. Danach die RLS-Suite um je einen
Cross-Tenant-Test pro Tabellenfamilie erweitern. Das ist die Maßnahme mit dem höchsten
Dauerwert, weil sie Rückfälle verhindert.

**ID:** M-02 · **Severity:** MEDIUM
**File:** `src/core/audit/useAuditTrail.ts:62,142`; `src/features/governance/collaboration/useTeamMembers.ts:40,82`;
`src/pages/RiskDashboard.tsx:274`; `src/features/governance/reporting/useReportBuilder.ts`;
`src/core/analytics/useComplianceTrends.ts`; `src/core/billing/useScanLimits.ts`;
`src/lib/governance/policyPackRecommender.ts`
**Finding:** Das Frontend fragt 9 Tabellen ab, die in **keiner** der 270 Migrationen definiert
sind (weder als Tabelle noch als View): `compliance_audit_log`, `workspace_members`,
`tenant_users`, `report_configurations`, `generated_reports`, `compliance_snapshots`, `scans`,
`asset_policy_pack_mappings`, `governance_admin_audit_log`.
**Impact:** Diese Features sind unabhängig vom Prod-Drift aus `CLAUDE.md` kaputt — sie würden
auch nach einem perfekten Migrations-Deploy `PGRST205` liefern. Die Call-Sites werfen
(`throw fetchError`), zeigen also Fehler statt Daten. `RiskDashboard.tsx:274` ist der
unangenehmste Fall: `tenant_users` liefert nichts, `tenant?.tenant_id` wird `undefined`, und
das folgende `monitored_domains`-INSERT läuft in eine NOT-NULL-Verletzung — der Nutzer sieht
einen unverständlichen Fehler beim Anlegen einer überwachten Domain.
**Recommendation:** Pro Tabelle entscheiden: fehlende Migration nachziehen, oder auf die real
existierende Tabelle umbiegen. Bei `tenant_users` → `memberships` und bei `workspace_members`
→ `memberships` liegt eine Umbenennung nahe (Kandidat für einen einfachen Fix). Passend zum
Leitprinzip „Funktionen funktionsfähig machen".

**ID:** M-03 · **Severity:** MEDIUM
**File:** `20260509020000_monitoring_tables.sql` (`get_compliance_timeline`);
`20260625000000_governance_analytics_schema.sql` (`governance_kpi_latest_snapshot`,
`governance_kpi_range`, `governance_kpi_timeseries_data`);
`20260625200001_legal_rag_hybrid_rpc.sql` (`legal_retrieve_chunks_hybrid`)
**Finding:** 5 von 148 `SECURITY DEFINER`-Funktionen setzen kein `SET search_path`.
**Impact:** `search_path`-Hijacking: Wer in einem für ihn beschreibbaren Schema ein Objekt mit
passendem Namen anlegt, kann Code mit Definer-Rechten ausführen. Das Risiko ist hier gedämpft,
weil `public` in Supabase nicht frei beschreibbar ist — der Befund ist Härtung, kein akutes Loch.
**Positiv:** 143 Funktionen setzen `search_path` korrekt; es gibt sogar eine eigene Migration
dafür (`20260530210241_pin_remaining_function_search_paths.sql`). Diese 5 sind Nachzügler.
**Recommendation:** `SET search_path = ''` bzw. `= public` ergänzen — analog zur bestehenden
Pin-Migration.

**ID:** M-04 · **Severity:** MEDIUM
**File:** `supabase/migrations/20260720100000_audit_evidence_integrity.sql`
**Finding:** Die Spalten `finding_hash`, `chain_hash`, `evidence_root_hash` auf `audit_findings`
haben keinen Schreiber im gesamten Repo (`src/`, `supabase/functions/`, `services/` geprüft).
Die Migration verweist auf „application layer", der Code existiert nicht.
**Impact:** Ein Integritätsnachweis, der als vorhanden gelesen werden kann, aber leer ist. Die
drei Indizes darauf kosten Schreibleistung ohne Nutzen. Gefährlich wird es, wenn ein
Export- oder Reportpfad diese Spalten künftig ungeprüft als Nachweis ausgibt.
**Recommendation:** Entweder die Berechnung implementieren (das Muster steht fertig in
`evidence-vault/index.ts:35–37`), oder Spalten und Indizes entfernen und den Anspruch
zurücknehmen. Beides ist besser als der jetzige Zwischenzustand.

**ID:** M-05 · **Severity:** MEDIUM
**File:** `README.md`, `ARCHITECTURE.md`
**Finding:** `README.md` beschreibt Deploy auf Hostinger-VPS hinter Traefik, nennt
`src/config/pricing.ts` als Single Source of Truth, listet 5 statt 6 Pläne und behauptet „Alle
Tabellen RLS-geschützt". `ARCHITECTURE.md` beschreibt ein anderes Produkt („RealSync Agent OS",
„V1.0 MVP", „UI/UX Mockups für alle SaaS-Module").
**Impact:** Genau diese Dateien haben die falsche Architekturannahme erzeugt, die dieses Audit
ausgelöst hat. Solange sie stehenbleiben, wiederholt sich das bei jedem neuen Kontext — ob
Mensch oder Agent.
**Recommendation:** `README.md` auf den Cloudflare-Stand ziehen (Deploy-Abschnitt,
Pricing-SSoT, Plan-Liste, RLS-Aussage). `ARCHITECTURE.md` löschen oder durch einen Verweis auf
`CLAUDE.md` / `MONOREPO.md` ersetzen — die Git-History bleibt als Archiv (Doku-Hygiene §9).

**ID:** M-06 · **Severity:** MEDIUM
**File:** `supabase/config.toml` (61 Einträge); `supabase/functions/browser-action-log`,
`enterprise-ai-os-agents-run`, `governance-risk-score`, `governance-agents-list`
**Finding:** 61 von 178 Functions laufen mit `verify_jwt = false`. Der überwiegende Teil ist
begründet und dokumentiert (HMAC-Webhooks, OAuth-Callbacks, Cron mit Shared Secret, öffentliche
Tools). Bei einigen ist die Begründung selbst unsicher — `browser-action-log` etwa: „browser
passes tenantId, which is validated by RLS", aber die Function nutzt Service-Role und umgeht
RLS damit gerade.
**Impact:** Der Kommentar beschreibt einen Schutz, den es an dieser Stelle nicht gibt.
`governance-agents-list` verlässt sich auf „tenant_id filtering in endpoint logic" ohne
Authentifizierung des Aufrufers.
**Recommendation:** Die vier genannten Functions einzeln nachprüfen und die Kommentare in
`config.toml` an die tatsächliche Prüfung angleichen. Die Datei ist sonst vorbildlich
dokumentiert — der Wert liegt darin, dass man ihr glauben kann.

**ID:** M-07 · **Severity:** MEDIUM
**File:** `.github/workflows/deploy-hostinger.yml:37–40`
**Finding:** Der Build-Job übergibt `ANTHROPIC_API_KEY` als Env-Variable an `npm run build`.
Vite inlined nur `VITE_*`-Variablen, der Key landet also **nicht** im Bundle — geprüft.
Zusätzlich: `npm run test --if-present` mit `continue-on-error: true`.
**Impact:** Kein Leak, aber unnötige Secret-Exposition gegenüber einem Build-Schritt, der ihn
nicht braucht. Die Tests im selben Job können nichts blockieren.
**Recommendation:** Env-Zeile entfernen; `continue-on-error` streichen (`ci.yml` gated bereits
korrekt, der doppelte weiche Lauf stiftet nur Verwirrung).

---

## 16. Recommended Implementation Order

Kein Code geschrieben. Reihenfolge nach Schadenshöhe pro Aufwand.

**Stufe 0 — sofort, ohne Codeänderung**
Prüfen, welche der Migrationen `20260705*`, `20260706011047`, `20260717191000` und
`20260802000000` in Produktion tatsächlich angewendet sind (`supabase migration list`,
`select proname, proacl from pg_proc where proname='get_dashboard_summary'`). Das entscheidet,
ob C-01 ein akuter Vorfall oder ein latenter Repo-Fehler ist — und damit, ob Art. 33 greift.
Diese Frage ist mit den vorhandenen Zugangsdaten in Minuten beantwortet.

**Stufe 1 — C-02 (Umsatz)**
Kleinster Fix mit größter Wirkung: `onConflict` auf `tenant_id`. Vorher ein
DB-Integrationstest, der Tenant-Anlage → Checkout → Webhook durchspielt. Dann prüfen, ob
bereits bezahlte, aber nicht provisionierte Tenants nachzuziehen sind.

**Stufe 2 — C-01 + H-01…H-04 (Cross-Tenant)**
Eine Migration, ein Muster, mechanisch abarbeitbar: `GRANT` einsammeln, `TO service_role`
ergänzen, `is_tenant_member()`-Guard in die 7 RPCs. Alles additiv, keine Vertragsbrüche an
öffentlichen Routen.

**Stufe 3 — C-04 (Kosten- und Missbrauchsrisiko)**
`ai-gateway` auf `verify_jwt = true` — laut `edgeClient.ts` schickt das Frontend bereits einen
Auth-Header, der Aufwand ist gering. Persistentes Rate-Limit und Logging danach.

**Stufe 4 — C-03 (33 Tabellen)**
Clusterweise, beginnend mit Tax und Inventory (personenbezogen). Die drei Infra-Tabellen sind
ein Fünfminuten-Schritt. Am Ende die CI-Regel, die neue Tabellen ohne RLS blockiert — ohne sie
wächst die Liste weiter.

**Stufe 5 — M-01 (Testabdeckung)**
`TEST_DB_URL` in CI setzen, `npm run test:db` ergänzen, RLS-Suite ausbauen. Das ist die
Maßnahme, die die Stufen 2 und 4 dauerhaft absichert. Ohne sie sind alle Fixes darüber
einmalig statt bleibend.

**Stufe 6 — C-05 (Datenresidenz)**
Braucht eine Produktentscheidung, nicht nur einen Patch: Pfad B um Tenant/Residenz erweitern
oder auf Pfad A konsolidieren. Parallel juristisch klären, ob die AVV-Zusage in
`AVVTemplate.tsx:132` aktuell gedeckt ist.

**Stufe 7 — M-02, M-05, M-03, M-04, M-06, M-07**
Aufräumen: fehlende Tabellen, veraltete Doku, `search_path`-Nachzügler, tote Hash-Spalten.

---

## Anhang — Reproduktion

Die Analysatoren dieses Audits liegen unter `/tmp/claude-0/aud/` (Session-Scratchpad,
nicht committet):

| Skript | Zweck |
|---|---|
| `sql2.py` | Replay aller Migrationen inkl. `RENAME TO` / `DROP POLICY` / `ALTER POLICY`; ermittelt Tabellen ohne RLS, RLS ohne Policy und die effektiv **lebenden** Policies |
| `p2.py` | isoliert permissive Policies (`USING(true)`), die nicht auf `service_role` beschränkt sind |
| `fn.py` | `SECURITY DEFINER`-Funktionen, `search_path`-Pinning, `GRANT`/`REVOKE`-Bilanz je Funktion |
| `ef.py` | Auth-Posture aller 178 Edge Functions gegen `verify_jwt` aus `config.toml` |

Ausgeführte Kommandos (read-only): `npm run lint` (Exit 0), `npx vitest run` (Exit 0),
`git log`, diverse `grep`/`python3`-Analysen. Keine Migration, kein Deploy, keine
Dependency-Installation, keine Datei des Produktivcodes geändert.
