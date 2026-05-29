# Infrastruktur- & Runtime-Systemcheck — 2026-05-28

**Prüfmethode:** Black-Box-Probes (DNS via lokalem Resolver + Cloudflare DoH, HTTP-Header-Probes
aller öffentlichen Hosts, Inspektion des ausgelieferten Produktions-JS-Bundles) sowie
authentifizierte Reads von Supabase (Projekt-Status, aktive API-Keys, Auth-Logs,
Security-Advisors) und GitHub (offene PRs). **Kein VPS-Shell-Zugang** vorhanden — daher sind
Aussagen zu Container-State, Volumes, OpenClaw/SQLite, Host-Port-Konflikten oder der
Live-Traefik-Router-Tabelle **aus Repo-Config abgeleitet**, nicht direkt beobachtet.

Dieses Dokument hält den *gemessenen* Live-Zustand am 2026-05-28 ~23:10 UTC fest. Wo es
[`production-runtime.md`](./production-runtime.md) widerspricht, sind die Messungen hier neuer
— siehe „Korrekturen an früheren Docs" am Ende.

---

## Kurzfassung

| Bereich | Zustand | Anmerkung |
|---|---|---|
| Frontend `realsyncdynamicsai.de` | ✅ gesund | Wird **direkt von GitHub Pages** ausgeliefert (`server: GitHub.com`), HTTP 200, kein VPS-Hop |
| Supabase `ebljyceifhnlzhjfyxup` | ✅ gesund | `ACTIVE_HEALTHY`, eu-central-1, PG17; Bundle-Key = aktiver Publishable-Key |
| **Login (Google OAuth)** | 🟢 erholt | War `invalid_client`; Auth-Config-Reload ~22:11 fixte es; Prod-Login um 22:14 erfolgreich |
| **Kodee-Subdomains** (`ollama/chat/n8n`) | 🔴 down | DNS → `187.77.89.1` (= dokumentierter VPS), aber Host **nicht erreichbar** (Timeout :80/:443) |
| **Zweiter Host** `194.163.130.123` | 🟠 stale? | Antwortet `nginx 404` (:80) / `503` (:443) — vom `ollama-traefik`-Compose referenziert; mögliche konkurrierende/Legacy-Deployment |

---

## 1. Frontend / DNS-Topologie

```
realsyncdynamicsai.de   A → 185.199.108–111.153   (GitHub Pages)
                        HTTPS → 200, server: GitHub.com, via Fastly   ← KEIN Redirect-Hop
www.realsyncdynamicsai.de  CNAME → realsyncdynamics-spec.github.io → 301 → Apex
public/CNAME = realsyncdynamicsai.de   ·   Pipeline deploy-pages.yml (VITE_BASE=/)
```

**Wichtige Korrektur:** Ein einfaches `curl -sI https://realsyncdynamicsai.de/` liefert
**HTTP 200 direkt von GitHub.com** — *kein* `301` von einem VPS-Traefik-Redirect. Der
Apex-A-Record zeigt jetzt direkt auf die GitHub-Pages-Anycast-IPs. Der in
`production-runtime.md` und im `deploy-pages.yml`-Header beschriebene Fluss „Apex → VPS →
`kodee-apex` Traefik-301 → github.io" ist **nicht mehr die Realität**; der `kodee-apex`-Router
in `deploy/ollama-traefik/docker-compose.yml` ist faktisch toter Code.

## 2. Supabase / Auth

- Projekt **RealSyncDynamicsLive** (`ebljyceifhnlzhjfyxup`), Region **eu-central-1**, Status
  **ACTIVE_HEALTHY**, Postgres 17.6. ✅ (korrekte DSGVO-Region)
- Das Produktions-Bundle enthält URL + `sb_publishable_BqKKWFM8…`. Gegen die Live-Key-Liste
  geprüft: dieser Publishable-Key ist **aktiv, nicht disabled**. Das Legacy-anon-JWT ist
  ebenfalls aktiv. → **Kein stale/falscher Key im Bundle.**
- `src/lib/supabase.ts` ist ein korrekter Singleton (`detectSessionInUrl`, `autoRefreshToken`).

## 3. Login-Ausfall — Ursache + Behebung

Die Auth-Logs sind eindeutig:

```
20:53–20:57 UTC  /callback (referer http://localhost:3000)
   ERROR  oauth2: "invalid_client" "The provided client secret is invalid."
   → 500: Unable to exchange external code            ← falsches Google-OAuth-Client-Secret
~22:09–22:12     "reloading api with new configuration" (×N)   ← Auth-Provider neu konfiguriert
22:14:02 UTC     /callback (referer https://realsyncdynamicsai.de)
   auth_event login  realsyncdynamics@gmail.com  provider=google  → 302   ✅
22:14:06/07      /user → 200, 200                    ← Session gültig, Login erfolgreich
```

- **Ursache:** ein ungültiges **Google-OAuth-Client-Secret** in der Supabase-Auth-Config.
- Die `invalid_client`-Fehler kamen von **`localhost:3000`** (Dev-Debugging).
- Nach dem ~22:11-Config-Reload lief der **Production**-Google-Login um 22:14 durch.
- **Fazit:** Der akute Ausfall scheint ~1 h vor diesem Check behoben. **Bitte prüfen**, ob der
  Fix stabil ist und ob der **Dev/localhost-Google-Client** + die **Auth-Redirect-URL-Allowlist**
  ebenfalls korrigiert wurden.

**Latenter Bug:** `src/lib/auth-redirect.ts` hardcodet `APEX_DOMAIN =
'https://RealSyncDynamicsAI.de'` (Mixed-Case). Magic-Link-`emailRedirectTo` nutzt das, und
Supabase' Redirect-Allowlist matcht teils case-sensitiv → Magic-Links können brechen.
**PR #463 (draft) fixt das auf lowercase.** Verwandte offene Auth-PRs: **#416** (defensives
OAuth-`validation_failed`-Handling), **#461** (`getSupabase()`-Singleton).

## 4. VPS-Schicht — zwei verschiedene Hosts, beide für ihre Rolle ungesund

Das Repo referenziert **zwei verschiedene VPS-IPs**, die sich widersprechen:

| IP | Referenziert in | Live-Probe |
|---|---|---|
| `187.77.89.1` | `production-runtime.md` (VPS `srv1622293`, Rollback-SSH) | **Timeout** auf :80 und :443 — Host nicht erreichbar |
| `194.163.130.123` | `deploy/ollama-traefik/docker-compose.yml`-Kommentar (Z. 25) | **Up:** `nginx/1.18.0` → 404 (:80), **503** (:443) |

Die Kodee-Subdomains (`ollama/chat/n8n`) lösen (autoritativ via Cloudflare DoH) auf
**`187.77.89.1`** auf — DNS passt also zum *dokumentierten* VPS, aber dieser Host antwortet
nicht. `194.163.130.123` antwortet, jedoch mit nacktem `nginx 404` / Traefik-typischem `503`
(keine gesunde Route/Backend). Das ist die klassische „konkurrierende/stale Deployment"-Lage:
**der vorgesehene kodee-stack-Host ist down, und ein zweiter Host liefert Überreste.**

> Aus dieser Umgebung nicht lösbar (kein SSH). Siehe Runbook unten.

## 5. Supabase Security-Advisors

- 🔴 **ERROR** — `security_definer_view`: `public.ai_evidence_retention_status` läuft mit
  Creator-Rechten (umgeht RLS). → auf `SECURITY INVOKER` umstellen.
- 🟡 **WARN** — Leaked-Password-Schutz deaktiviert; `pg_trgm` / `vector` / `pg_net` im
  `public`-Schema; viele `SECURITY DEFINER`-Funktionen via REST durch `anon`/`authenticated`
  aufrufbar (`is_tenant_member`, `tenant_entitlements`, `admin_customers_list`,
  `admin_system_health`, `affiliate_validate`, …).
- ℹ️ **INFO** — ~12 Tabellen mit RLS aktiviert, aber **ohne Policy** (`ai_systems`,
  `ai_policies`, `enterprise_*`, …) → faktisch nur Service-Role. Wahrscheinlich gewollt;
  **bitte bestätigen**.

*(Diese Punkte sind dokumentiert, nicht geändert — Schema-Änderungen brauchen explizites Sign-off.)*

## 6. GitHub-Zustand

- 20 offene PRs. Drei sind auth-bezogen (#463, #416, #461 — siehe §3).
- Migrations-Timestamp-Kollisionen werden behoben (#438 ready, #441 draft für
  `20260610000000`). Eine Parallel-Session pusht ~35 Migrationen → **koordinieren, um weitere
  Kollisionen / Drift zu vermeiden.**
- `#402` (openclaw Hostinger One-Shot-Setup) und `#335` (infrastructure restructure) betreffen
  genau den VPS/DNS-Bereich aus §4.

---

## VPS-Investigations-Runbook (Operator, braucht SSH)

Die zwei Punkte aus §4 sind die einzigen **live-kritischen** Probleme und brauchen beide Shell-Zugang.

```bash
# 1) Lebt der vorgesehene kodee-stack-Host überhaupt?
ping -c3 187.77.89.1
ssh deploy@187.77.89.1            # wenn das hängt, ist der Host/Firewall das Problem

# Auf 187.77.89.1 (dem dokumentierten VPS):
docker ps -a                      # laufen kodee-ollama / kodee-chat / kodee-n8n?
docker compose -f /var/www/kodee-stack/docker-compose.yml ps   # Pfad anpassen
ss -tlnp | grep -E ':(80|443|11434|5678|8080)'   # wer lauscht?
docker logs --tail=100 traefik    # warum keine Route / kein Cert?

# 2) Was ist 194.163.130.123 und warum antwortet es 503?
ssh root@194.163.130.123
docker ps -a ; ss -tlnp | grep -E ':(80|443)'
nginx -t ; systemctl status nginx # ist Host-nginx das 404/:80?
# 503 auf :443 = Reverse-Proxy ohne gesundes Upstream. Identifizieren und entscheiden:
#   behalten (und Subdomains hierher zeigen) ODER abschalten (stale Parallel-Deployment).

# 3) Kanonische VPS-IP festlegen und Repo + DNS in Einklang bringen:
#    - production-runtime.md sagt 187.77.89.1
#    - ollama-traefik/docker-compose.yml-Kommentar sagt 194.163.130.123
#    Eine wählen, die andere aktualisieren, dann verifizieren:
curl -sI --resolve ollama.realsyncdynamicsai.de:443:<IP> https://ollama.realsyncdynamicsai.de/
```

**KEINE** `docker compose up`, `restart`, `prune`, `rm` oder Secret-Rotation ausführen, bevor
die Zwei-Host-Frage geklärt ist — sonst beförderst du versehentlich das stale Deployment.

---

## Korrekturen an früheren Docs

`production-runtime.md` (zuletzt geprüft 2026-05-16) wird durch die Live-Messungen hier
teilweise überholt:

1. Der Apex **fließt nicht mehr durch einen VPS-Traefik-301** — er löst direkt auf GitHub Pages
   auf und liefert 200 von `GitHub.com`. Das „How a request flows"-Diagramm (VPS →
   `kodee-apex` → 301 → Pages) ist veraltet.
2. Der Kodee-Subdomain-Host (`187.77.89.1`) ist aktuell **nicht erreichbar**, und ein zweiter
   Host (`194.163.130.123`) antwortet stattdessen — die IP-Referenzen im Repo widersprechen sich.

Ein Banner mit Verweis hierher wurde in `production-runtime.md` und im `deploy-pages.yml`-Header
ergänzt. Die Routing-Config selbst wurde unangetastet gelassen (Verhaltensänderung → braucht Sign-off).

---

# Teil 2 — Erweiterter A-bis-Z-Check (2026-05-28, Nachtrag)

## 🔴 P0-INCIDENT — öffentlich geleakter Master-Token

**Bestätigt live (HTTP 200, ohne Auth):**
`https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/vault-key-setter` liefert eine
HTML-Seite, in der der **`market_scanner_token` im Klartext hartkodiert** ist (Token-Wert
hier bewusst **nicht** eingetragen, um ihn nicht erneut zu leaken — er ist am Endpoint
einsehbar).

**Angriffskette:**
1. `vault-key-setter` (`verify_jwt=false`, keinerlei Auth) → gibt den Master-Token an jeden aus.
2. Mit dem Token → `vault-set-secret` (`verify_jwt=false`): erlaubt **Überschreiben** der
   Vault-Secrets `anthropic_api_key`, `openai_api_key`, `gemini_api_key`, `ollama_url`,
   `ollama_auth_token`.
3. Mit dem Token → `debug-secret-shape` (`verify_jwt=false`): leakt **Prefix/Suffix/Länge**
   des `ANTHROPIC_API_KEY`.

Alle drei Functions sind **nicht im Repo** (manuell aus `/tmp/` deployt) → unsichtbar in
Code-Reviews. **Remediation-Plan unten.**

## A. Codebase-Gesundheit

| Check | Ergebnis |
|---|---|
| `tsc --noEmit` | ✅ 0 Fehler |
| `vitest run` | ✅ 1256 passed · 0 failed · 93 skipped · 96 todo (124 Files) |
| `vite build` | ✅ 13,3 s |
| CI PR #466 | ✅ build / Lint-infra / Migration-validation alle grün |

🟡 Bundle: `vendor-BnZMt3LQ.js` 2,10 MB (658 KB gzip) + `index` 1,34 MB (319 KB gzip) →
`manualChunks`-Splitting empfohlen.

## B. Supabase-Datenschicht

- **95+ Tabellen im `public`-Schema — alle `rls_enabled: true`** ✓. Weitere Schemas:
  `creatorseal`, `agentos`.
- Produktiv befüllt: `page_views` (16.636), `sales_leads` (51), `gdpr_audits` (47),
  `product_entitlements` (146), Rest überwiegend leer (Schema-Vorbau).

## C. Edge Functions — Repo↔Prod-Drift

- **72 Function-Ordner im Repo vs. 80 aktiv in Prod → 8 Orphans** (nur in Prod, aus `/tmp/`):
  `vault-set-secret`, `vault-key-setter`, `debug-secret-shape`, `stripe-webhook-fixer`,
  `governance-dsr`, `governance-incidents`, `governance-connectors`, `governance-vendors`.

## D. Secret-Hygiene (Repo)

✅ Keine committeten Klartext-Secrets im Repo (Scan auf live/test-Keys, JWTs, Private Keys).
⚠️ Aber: geleakter Token im **deployten** (nicht-committeten) `vault-key-setter` — siehe Incident.

## E. Supabase Performance-Advisors

| Anzahl | Level | Typ |
|---|---|---|
| 208 | INFO | `unused_index` |
| 90 | WARN | `auth_rls_initplan` (`auth.<fn>()` pro Zeile statt `(select …)`) |
| 73 | WARN | `multiple_permissive_policies` (inkl. ä/ae-Umlaut-Duplikate aus Migrationen) |
| 63 | INFO | `unindexed_foreign_keys` |
| 1 | WARN | `duplicate_index` (`creatorseal.plans`) |

## F. Backend-Flotte (services/worker/connectors/apps/extensions)

Deploy-ready, aber **un-getestet und nicht in CI** — Live-Status je Service unbekannt:

- `services/{openclaw-agent, playwright-scanner, realsync-runtime-core, realsync-evidence-runtime}`
  — Hono/Fastify, Docker vorhanden, **0 Tests**, viel Stub, hartkodierte Inter-Service-URLs,
  Secrets via Env statt Vault.
- `worker/audit-worker` — SCAFFOLD, **nicht aktiviert** (2 TODOs).
- `apps/agent-runtime` — Gateway-only, kein echtes Tool-Calling, Audit nur nach stdout.
- `connectors/` — OpenAI/Anthropic-Telemetrie-Wrapper (Lib); n8n/make nur Platzhalter.
- `tools/realsync-cli` — Python, **einziges Projekt mit Tests (37)**; CI nur nach Subtree-Split.
- `extension*` (3×) — Chrome MV3; kein HMAC-Signing, Token in `storage.local`, kein Dedup.

---

## Remediation-Plan — unsichere Edge Functions (P0)

> Ausführung braucht Operator-Go (Löschen + Secret-Rotation = destruktiv). Befehle nutzen die
> Supabase-CLI gegen `--project-ref ebljyceifhnlzhjfyxup`.

**Sofort (Incident eindämmen):**
```bash
# 1) Den leakenden Endpoint entfernen — HÖCHSTE Priorität
supabase functions delete vault-key-setter --project-ref ebljyceifhnlzhjfyxup

# 2) Master-Token rotieren (alter Token ist kompromittiert: öffentlich + in Logs)
#    Neuen Token generieren und in Vault setzen (Quelle von get_market_scanner_token):
#    z.B. via SQL: select set_app_secret('market_scanner_token', '<neuer-random>');

# 3) Die zwei verbleibenden Token-Functions löschen (nicht im Repo, Einmal-Zweck)
supabase functions delete vault-set-secret  --project-ref ebljyceifhnlzhjfyxup
supabase functions delete debug-secret-shape --project-ref ebljyceifhnlzhjfyxup

# 4) Vorsichtshalber rotieren: ANTHROPIC_API_KEY (Shape war via debug-secret-shape abgreifbar),
#    sowie OPENAI/GEMINI (waren via vault-set-secret überschreibbar).
```

**Danach (Drift schließen):**
- `stripe-webhook-fixer` löschen (Einmal-Tool).
- `governance-{dsr,incidents,connectors,vendors}` aus Prod-Source ins Repo zurückführen
  (`supabase functions download …`) oder sauber aus dem Repo neu deployen.
- CI-Guard in `deploy.yml`: Prod-Function-Liste gegen `supabase/functions/*` diffen und bei
  Orphans/`verify_jwt=false`-Drift fehlschlagen.

---

# Teil 3 — Ausgeführte Fixes (2026-05-28, live)

## ✅ Erledigt (verifiziert)

1. **P0-Token-Leak geschlossen** — `vault-key-setter`, `vault-set-secret`, `debug-secret-shape`
   per MCP mit 410-Gone-Stub + `verify_jwt=true` überschrieben. Re-Probe des öffentlichen
   Endpoints: **HTTP 401** (vorher 200 + Klartext-Token). Token wird nicht mehr ausgegeben.
2. **Cross-Tenant-Leak der Evidence-View geschlossen** — `ALTER VIEW
   public.ai_evidence_retention_status SET (security_invoker = true)` (idempotent, via
   `execute_sql`, **ohne** Migration-History/laufenden Push zu stören). Verifiziert:
   `security_invoker=true`. **Der einzige Security-`ERROR` des Advisors ist damit weg.**
   - Befund: Der Repo-Fix `20260524100000_fix_evidence_retention_view_invoker.sql` war in
     der DB **nicht wirksam** (vermutlich durch ein späteres `create or replace view`
     überholt). Keine der 27 ausstehenden Migrationen erstellt die View neu → Fix ist durabel.

## ⚠️ Blockiert / muss von dir im Dashboard erfolgen

3. **`market_scanner_token` rotiert ✅** — **erledigt** über die offizielle
   `vault.update_secret(id, new)`-API (mehr Rechte als der direkte UPDATE; `set_app_secret`
   selbst bleibt im UPDATE-Zweig defekt → separater Bug, Repo-Fix empfohlen). Der alte,
   geleakte Token ist **ungültig**. In-DB-Consumer (`market-scanner`) lesen den Wert zur
   Laufzeit via `get_market_scanner_token` → übernehmen automatisch, keine Rekonfiguration.
4. **Leaked-Password-Protection aktivieren** — Auth-Setting, kein SQL/MCP-Weg
   (Dashboard → Auth → Password security).

## 🟦 Migrations-Drift (Kontext, nicht von mir angefasst)

- **132 Migrationen im Repo, 99 angewendet → 27–33 ausstehend.** Eine **parallele
  `supabase db push`-Session läuft aktiv** (zuletzt angewendet `20260528223438`). Deshalb
  wurden **keine eigenen Migrationen/DDL** erzeugt, die mit dem Push kollidieren würden.
- Die 12× `rls_enabled_no_policy` (INFO) werden voraussichtlich durch die ausstehende
  `20260601100000_ai_governance_rls_policies.sql` geschlossen, sobald der Push sie erreicht.

## ⏸️ Bewusst NICHT autonom gefixt (Risiko auf Compliance-DB)

| Advisor | Anzahl | Warum nicht auto-fixen |
|---|---|---|
| `function_search_path_mutable` (`tg_evidence_event_chain`) | 1 WARN | **Integritätskritisch** (Evidence-Hash-Kette, nutzt `digest`/unqualifizierte Namen) — falscher search_path bricht den Prüfpfad. |
| `*_security_definer_function_executable` | ~20 WARN | `EXECUTE`-Revoke auf RLS-Helper (`is_tenant_member`, `tenant_entitlements`) **bricht RLS-Auswertung** für `authenticated`. Pro Funktion zu entscheiden. |
| `extension_in_public` (pg_trgm/vector/pg_net) | 3 WARN | Schema-Verschiebung bricht unqualifizierte Referenzen. |
| `auth_rls_initplan` / `unused_index` / `unindexed_fk` | 90/208/63 (Perf) | Reine Performance bei aktuell ~0 Datenvolumen; Massen-Index-Drop / Bulk-RLS-Rewrite auf Multi-Tenant-DB = hohes Risiko/kein Nutzen jetzt. Gezielt nach Daten-Wachstum. |

**Security-Endstand:** keine `ERROR`-Findings mehr; verbleibende Punkte sind WARN/INFO,
abgedeckt durch (a) den laufenden Migrations-Push, (b) zwei Dashboard-Toggles oder
(c) bewusst zurückgestellte, risikobehaftete Optimierungen.

---

# Teil 4 — Härtung A/B/C (2026-05-28)

## A — Interne RPCs gegen REST gesperrt ✅
`REVOKE EXECUTE` (public/anon/authenticated), `service_role` behält Zugriff — für
`resolve_ai_residency` (nur Edge), `pii_redaction_log_block_modification` (Trigger),
`prune_business_metric_snapshots` (Cron). Live via `execute_sql` + durabel als Migration
`20260620000000_lockdown_internal_functions.sql` (Timestamp nach allen ausstehenden →
keine Kollision). Verifiziert: `anon=false, authenticated=false, service_role=true`.

**Korrektur eines vorherigen Fehlalarms:** `admin_customers_list` und alle `analytics_*`
**self-gaten bereits** via `WHERE EXISTS(… profiles.is_super_admin = true)` — **kein
PII-Leak**, kein Fix nötig (der frühere „has_internal_gate=false"-Befund war ein
Regex-Artefakt, weil `is_super_admin` nicht im Suchmuster war).

## B — Edge-Function-Drift-Guard ✅
`scripts/check-edge-function-drift.mjs` (+ Allowlist + Workflow `edge-function-drift.yml`,
`npm run check:edge-functions`): blockt **neue** Orphans (live deployt, nicht im Repo) und
undeklariertes `verify_jwt=false`; 8 bekannte Altbestände sind grandfathered → startet grün.
Hat dabei sofort echtes totes Config gefunden: `governance-{dsr,incidents,connectors,vendors}`
stehen in `config.toml` (verify_jwt=false), haben aber **keine Repo-Source**.

## C — Migrations-Push / finaler Advisor-Recheck ⏳ (bewusst nicht via MCP)
Stand: **99/132 Migrationen angewendet** (latest `20260528223438`); 33 ausstehend.

**Entscheidung: Der Push wird NICHT via MCP ausgeführt.** Begründung:
- `apply_migration` vergibt eigene Versions-Timestamps → würde von den Datei-Versionen
  abweichen. Folge: ein späteres `supabase db push` sähe die Migrationen als „nicht
  angewendet", würde sie erneut anwenden → Fehler/Schema-Drift = **dauerhaft kaputte
  Migration-History** auf einer Produktions-Compliance-DB.
- Bekannte **Timestamp-Kollisionen** (`20260610000000`, PRs #438/#441) müssen zuerst
  gemerged sein, sonst kollidiert der Push strukturell.
- Migration-Bodies via `execute_sql` einzuspielen würde dieselbe History-Vergiftung
  verursachen (CLI re-applied später, nicht-idempotente `CREATE POLICY` → Fehler).

**Wichtig:** Die 33 ausstehenden sind **Feature-Migrationen**; die verbleibenden Advisor-
Findings sind **INFO** (`rls_enabled_no_policy` = Tabellen nur per service_role erreichbar
= sicher, nur evtl. unbeabsichtigt). **Sicherheitsseitig ist die DB bereits sauber** — der
Push ist Feature-Rollout, der über die reguläre `deploy.yml`-Pipeline (CLI + DB-Passwort)
laufen sollte, nachdem #438/#441 gemerged sind. Finaler Advisor-Recheck danach.

---

# Teil 5 — „Fix all" Endstand (2026-05-28)

Zusätzlich live angewandt + als idempotente Migrationen (`20260620000001..0003`) hinterlegt,
jeweils direkt verifiziert:

| Fix | Advisor | vorher → jetzt |
|---|---|---|
| RLS `auth.<fn>()` → `(select auth.<fn>())` (85 Policies) | `auth_rls_initplan` | **90 → 0** ✅ |
| Duplikat-Index `creatorseal.plans` entfernt | `duplicate_index` | **1 → 0** ✅ |
| 5 ä/ae-Mojibake-Duplikat-Policies entfernt | `multiple_permissive_policies` | **73 → 38** ✅ |
| `search_path` auf Evidence-Hash-Trigger gepinnt | `function_search_path_mutable` | **1 → 0** ✅ |
| `set_app_secret`-Bug (UPDATE→`vault.update_secret`) | — (Funktionsbug) | ✅ behoben |
| `market_scanner_token` rotiert | — (Incident) | ✅ |

**Bewusst NICHT geändert (Begründung):**
- `unused_index` (208 INFO) / `unindexed_foreign_keys` (63 INFO): bei ~0 Datenvolumen kein
  Nutzen; Massen-Index-Änderung ohne Last = unnötiges Risiko. Nach Daten-Wachstum gezielt.
- `multiple_permissive_policies` (38 Rest): **keine** Duplikate, sondern beabsichtigt
  überlappende Policies (z. B. „eigene Zeilen" + „Admin alle") — Zusammenlegen änderte Logik.
- `extension_in_public` (3): Schema-Verschiebung bräche unqualifizierte Referenzen.
- `*_security_definer_function_executable` (~16): RLS-Helper / absichtlich öffentlich /
  self-gated (is_super_admin) → by-design.

**Nur per Operator lösbar (von hier technisch unmöglich):**
- `auth_leaked_password_protection`: Workflow `enable-leaked-password-protection.yml` gebaut →
  einmal triggern (oder Dashboard-Toggle).
- `rls_enabled_no_policy` (12 INFO): löst der ausstehende Migrations-Push.
- VPS `187.77.89.1` down / Zwei-IP-Konflikt: braucht SSH.

**Security-Advisor: 0 ERROR.** Verbleibende Findings sind WARN/INFO und entweder by-design,
operator-gebunden oder bewusst zurückgestellt.

