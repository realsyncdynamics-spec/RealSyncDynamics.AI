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

