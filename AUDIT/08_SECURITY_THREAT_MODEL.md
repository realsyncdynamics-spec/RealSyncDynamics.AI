# 08 — Security Threat Model & Attack Matrix

## 1. Angreifer-Profile

| ID | Angreifer | Ausgangslage |
|---|---|---|
| AT-1 | Anonym | Internet, kennt nur die öffentliche URL + Publishable-Key |
| AT-2 | Registrierter Nutzer | gültiges JWT für Tenant A |
| AT-3 | Böswilliger Tenant-Admin | Owner-Rechte in Tenant A |
| AT-4 | Kompromittierter API-Key | `rsd_gov_`-Ingest-Key eines Tenants |
| AT-5 | Kompromittierter `service_role` | Env-Leak einer Edge Function |
| AT-6 | Böswilliges Repository / Dokument | Inhalte, die die KI verarbeitet |
| AT-7 | Insider (DB-Zugriff) | Supabase-Projektzugang |

---

## 2. Angriffsmatrix

| Ziel | AT-1 | AT-2 | AT-3 | AT-4 | AT-5 | AT-6 | AT-7 |
|---|---|---|---|---|---|---|---|
| Fremden Tenant **lesen** | ⚠️ F-05(a) | ⚠️ F-04 | ⚠️ F-04 | ✅ blockiert | ❌ trivial | — | ❌ trivial |
| Fremden Tenant **ändern** | ⚠️ F-05 | ⚠️ F-04 | ⚠️ F-04 | ✅ | ❌ | — | ❌ |
| Evidenz **löschen** | ✅ Trigger | ✅ Trigger | ✅ Trigger | ✅ | ❌ Partition-DROP | — | ❌ |
| Prüfpfad **fälschen** | ⚠️ F-04 (Risk-Score) | ⚠️ F-04 | ⚠️ F-04 | ✅ | ❌ | — | ❌ |
| **Befehl ausführen** | ✅ | ✅ Allowlist | ⚠️ eigener VPS | ✅ | ❌ | ⚠️ ungeprüft | ❌ |
| **Secret stehlen** | ✅ | ✅ | ✅ | ✅ | ❌ | ⚠️ Prompt-Injection | ❌ |
| **Billing umgehen** | ✅ | ⚠️ F-B3 Race | ⚠️ F-B3 | ✅ | ❌ | — | ❌ |
| **Quota umgehen** | ✅ | ⚠️ F-B3 | ⚠️ F-B3 | ⚠️ | ❌ | — | ❌ |
| **Rechte eskalieren** | ✅ | ⚠️ F-09 (`agent_configuration`) | ⚠️ | ✅ | ❌ | — | ❌ |

Legende: ✅ verhindert · ⚠️ teilweise/bedingt möglich · ❌ nicht verhindert

---

## 3. Klassische Webanwendungs-Risiken

| Klasse | Befund |
|---|---|
| **IDOR / BOLA** | ⚠️ In `oauth2-apps`, `report-generator`, `governance-risk-score` ist die Objekt-ID vollständig client-kontrolliert und die Auth wertlos (F-04). In der korrekt gebauten Governance-Familie sauber gelöst. |
| **Privilege Escalation** | ⚠️ `agent_configuration` `FOR ALL USING(true)` (F-09); 16 `SECURITY DEFINER` ohne `search_path` (F-16) |
| **Tenant Breakout** | ⚠️ Nicht über PostgREST (live verifiziert), sondern über die Edge-Function-Schicht (F-04/F-05) |
| **Fehlende Authentifizierung** | ⚠️ 18 Functions ohne jede Prüfung (F-05) |
| **Mass Assignment** | ⚠️ Mehrere Functions übernehmen `body` teilweise ungeprüft; Whitelists sind die Ausnahme. `zod` ist bewusst keine Dependency (CLAUDE.md) — Validierung ist handgeschrieben und uneinheitlich |
| **SQL Injection** | ✅ Keine gefunden — durchgehend PostgREST-Builder / parametrisierte RPCs |
| **PostgREST-Filter-Injection** | ⚠️ 2 Stellen: `governance-agents-list:41`, `telemetry-ai-event:168` (F-05b) |
| **SSRF** | ⚠️ `cookie-scan-deep`, `gdpr-audit`, `market-scanner` holen client-gelieferte URLs. `cookie-scan-deep` ist **ohne Auth** erreichbar → unauthentifizierter Fetch-Proxy. Kein Allowlist-/Private-IP-Blocker gefunden |
| **Open Redirect** | nicht geprüft (Frontend-Routing) — GRAU |
| **Path Traversal** | ✅ keine Dateipfad-Konstruktion aus Nutzereingabe gefunden |
| **Command Injection** | ✅ `kodee/ssh.ts` nutzt `shellQuote()` konsequent; Allowlist auf Actions |
| **XSS (stored/reflected/DOM)** | React escapt per Default; `dangerouslySetInnerHTML` nicht in Nutzerpfaden gefunden. **CSP mit `unsafe-inline` entwertet die zweite Verteidigungslinie** (F-14) |
| **CSRF** | Bearer-Token-Auth statt Cookies → strukturell unanfällig. `react-router` GHSA-qwww-vcr4-c8h2 betrifft nur den RSC-Modus (nicht genutzt) |
| **Replay** | ✅ Stripe idempotent; ⚠️ Provenance-Signaturen ohne Nonce |
| **Webhook-Fälschung** | ✅ Stripe HMAC; ✅ n8n Shared Secret; ⚠️ `telegram-webhook`, `shopify-webhooks` — Secret vorhanden, Prüftiefe nicht einzeln verifiziert |
| **Race Conditions** | ⚠️ Quota-Zählung ohne Lock (F-B3). ✅ Hash-Chain korrekt über Advisory-Lock serialisiert |
| **Rate-Limit-Bypass** | ⚠️ `ai-gateway` limitiert **pro Instanz im Speicher** (`Map`) — horizontal skalierende Deno-Isolates teilen den Zustand nicht; effektives Limit = N × Limit. Im Code als bewusste Vereinfachung kommentiert |
| **API-Key-Leak** | ✅ Keys nur als sha256-Hash gespeichert; Raw-Token einmalig bei Erstellung |
| **JWT-Schwächen** | ✅ Supabase-Standard; ⚠️ **die Prüfung wird in 6 Functions gar nicht durchgeführt** (F-04) |
| **Session-Fixation / -Invalidierung** | nicht dynamisch geprüft — GRAU |

---

## 4. Die zentrale Schwachstelle

Alle P0-Sicherheitsbefunde haben **eine gemeinsame Ursache**:

> `verify_jwt = false` am Gateway verlagert die Authentifizierung in den
> Function-Code — und dort ist sie **nicht einheitlich implementiert**.

Es existieren vier verschiedene Muster nebeneinander:

1. **Korrekt:** `auth.getUser()` + Membership-Lookup
   (`governance-keys`, `-approvals`, `-resources`, `-dsr`) ✅
2. **Korrekt:** Vault-Bearer-Token für Cron (`governance-erasure-sweeper`) ✅
3. **Korrekt:** gehashter API-Key (`governance-ingest`, `api-gateway`, `partner-provision-tenant`) ✅
4. **Kaputt:** nur Präfix-Prüfung `startsWith('Bearer ')` (6 Functions) ❌
5. **Kaputt:** gar keine Prüfung (18 Functions) ❌

**Ein einziger geteilter Auth-Helfer in `_shared/` würde F-04 und F-05 vollständig
beseitigen.** Das Referenzmuster ist im Repo bereits vorhanden — es muss nur
durchgesetzt statt neu erfunden werden. Ein CI-Check „jede Function importiert
entweder `requireUser()`, `requireServiceToken()` oder `requireApiKey()`" würde
Rückfälle verhindern.
