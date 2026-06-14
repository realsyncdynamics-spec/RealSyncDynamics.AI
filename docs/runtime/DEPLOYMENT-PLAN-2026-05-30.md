# Deployment-Plan & Session-Analyse — 2026-05-30

> **Zweck:** Tiefe Analyse des Gesamtzustands aller parallelen Entwicklungs-Sessions
> (40 offene PRs + Live-Infrastruktur) und ein konkreter, sequenzierter Plan, um die
> bereits gebauten Funktionen **vollständig zu deployen und nutzbar zu machen**.
>
> **Prüfmethode:** Live-Reads gegen Supabase-Projekt `ebljyceifhnlzhjfyxup`
> (`RealSyncDynamicsLive`, eu-central-1, PG17, `ACTIVE_HEALTHY`) via MCP —
> Edge-Function-Liste, Migration-History, Security-Advisors; GitHub-PR-Inventur;
> Repo-Stand auf `claude/session-analysis-deployment-O1sDQ`. Kein VPS-Shell-Zugang.
>
> Dieses Dokument schreibt **keinen** Code und ändert **kein** Schema. Es ist die
> Entscheidungs- und Ausführungsgrundlage. Operator-pflichtige Schritte sind als
> solche markiert (🔐 = braucht Operator-Go).

---

## 0. Kurzfassung (TL;DR)

Die Plattform ist **technisch zu ~90 % deployt** — 80 Edge Functions laufen live,
~95 Tabellen mit RLS, Frontend gesund auf GitHub Pages. „Nicht nutzbar" ist sie
nicht wegen fehlendem Code, sondern wegen **vier Deployment-Schulden aus paralleler
Session-Arbeit**:

| # | Blocker | Schweregrad | Lösbar von hier? |
|---|---|---|---|
| **B1** | **40 offene PRs** — fertige Features hängen ungemmerged, blockieren sich teils gegenseitig (Migrations-Kollisionen) | 🟠 Prozess | Ja (Triage + Merge-Reihenfolge) |
| **B2** | **Migrations-History divergiert** Repo↔Live; letzte ~5 Härtungs-Migrationen nicht in History | 🔴 Hoch | Teils (🔐 für `db push`) |
| **B3** | **Edge-Function-Drift** — 8 Orphans live, die nicht im Repo sind (inkl. ehem. P0-Token-Leak) | 🟠 Mittel | Teils (🔐 für `delete`) |
| **B4** | **Security-Advisor-Regression** — 7 `SECURITY DEFINER`-View-ERRORs (waren am 28.05. auf 0) + Leaked-PW-Schutz aus | 🔴 Hoch | Ja (Migration) + 🔐 (Toggle) |
| **B5** | **VPS down / Scanner-Microservice nicht deployt** — `cookie-scan-deep`/Consent-Timing ohne Playwright-Backend; 2-Host-IP-Konflikt | 🟠 Mittel | Nein (🔐 SSH) |

**Kernaussage:** Es muss fast nichts mehr *gebaut*, sondern **konsolidiert, gemerged
und sauber durchdeployt** werden. Der Engpass ist Koordination, nicht Implementierung.

---

## 1. Was bereits live & nutzbar ist (Ist-Zustand)

### 1.1 Edge Functions — 80 aktiv in Prod
Alle 74 Repo-Functions sind deployt und `ACTIVE`. Funktionsfähige Produktflächen:

- **Audit-Engine (Lead-Magnet):** `gdpr-audit`, `cookie-scan`, `ai-act-classify`,
  `audit-report-pdf`, `audit-report-email`, `audit-drip-cron`, `audit-monitor-cron`,
  `audit-recheck-weekly`, `tenant-audit` (v1, neueste).
- **Billing:** `stripe-checkout`, `stripe-webhook`, `stripe-portal`,
  `stripe-meter-sync`, `usage-increment` — alle aktuell (v22–v37).
- **AI-Layer:** `ai-invoke`, `ai-gateway`, `generate-document`, `classify-document`,
  `telemetry-ai-event`.
- **Governance-Suite:** `governance-{agent,ingest,keys,resources,webhooks,approvals,
  risk-score,dpias,incidents,connectors,remediate}` (11 Functions, live).
- **Enterprise-AI-OS:** 8 `enterprise-ai-os-*` Functions.
- **Website-Rebuild-Pipeline:** `rebuild-website`, `checkout-website-rebuild`.
- **Kodee (VPS-Assistent):** `kodee`, `kodee-{advise,diagnose,onboard}`.
- **Shopify-Integration:** `shopify-{install,callback,scan,webhooks}`.
- **GDPR/DSGVO:** `gdpr-{audit,export,delete}`, `evidence-export`,
  `evidence-vault-export`, `sub-processor-notify`.
- **Marketing/Growth:** `newsletter-{subscribe,confirm}`, `welcome-email`,
  `sales-lead`, `track-pageview`, `marketing-event`, `daily-digest`,
  `market-scanner`, `business-metrics-cron`.

### 1.2 Datenschicht
~95 Tabellen im `public`-Schema, **alle `rls_enabled: true`**. Produktiv befüllt:
`page_views` (~16,6k), `sales_leads` (51), `gdpr_audits` (47),
`product_entitlements` (146) — der Rest ist Schema-Vorbau.

### 1.3 Frontend
`realsyncdynamicsai.de` → **GitHub Pages** (Apex-A-Record direkt auf Pages-Anycast,
HTTP 200, kein VPS-Hop). Publishable-Key im Bundle = aktiver Live-Key. Auth (Google
OAuth) seit 28.05. ~22:14 UTC wieder funktionsfähig.

**Fazit Ist-Zustand:** Der Kern ist live. Die Lücken sind Konsolidierung + Härtung.

---

## 2. Die fünf Deployment-Blocker im Detail

### B1 — 40 offene PRs (Session-Fragmentierung)

40 Branches, fast alle aus parallelen `claude/*`-Sessions. Mehrere überlappen
thematisch (Positionierung 4×, DNS/VPS 3×, Runtime-Kernel 4×, Bundle-Splitting 2×)
und einige blockieren sich über Migrations-Timestamps. Vollständige Triage in §4.

### B2 — Migrations-Drift Repo ↔ Live 🔴

- **Repo:** 139 Migrations-Dateien, jüngste `20260620000004_governance_policy_versions`.
- **Live-History:** endet bei `20260601100000_ai_governance_rls_policies`. Eine frühere
  „parallele `db push`-Session" hat einen großen Block auf **gestauchte
  `20260529xxxxxx`-Timestamps** umnummeriert (Namen wie `business_metrics_cron`,
  `agent_os_substrate` tauchen 2–3× auf).
- **Konsequenz:** Inhaltlich ist Live ≈ Repo bis `ai_governance_rls_policies`, aber die
  **History-Timestamps weichen ab** → ein naives `supabase db push` sieht Migrationen als
  „nicht angewendet" und versucht Re-Apply → nicht-idempotente `CREATE POLICY`/`CREATE
  VIEW` brechen.
- **Die letzten ~5 Migrationen** (`20260620000000`–`0004`: `lockdown_internal_functions`,
  `advisor_safe_cleanups`, `rls_initplan_optimization`, `pin_evidence_chain_search_path`,
  `governance_policy_versions`) sind **nicht in der History**. Teile davon wurden am
  28.05. **per `execute_sql` live angewendet, aber nie als Migration registriert** — das
  ist genau die History-Vergiftung, die das `db push` jetzt riskant macht.

### B3 — Edge-Function-Drift (8 Orphans) 🟠

Live, aber nicht im Repo (aus `/tmp/` deployt, in Code-Reviews unsichtbar):
`vault-set-secret`, `vault-key-setter`, `debug-secret-shape`, `stripe-webhook-fixer`,
`governance-dsr`, `governance-incidents`, `governance-connectors`, `governance-vendors`.

- Die drei `vault-*`/`debug-*` waren ein **P0-Token-Leak** (öffentlicher
  `vault-key-setter` gab den `market_scanner_token` im Klartext aus). Am 28.05. mit
  410-Gone-Stub + `verify_jwt=true` **neutralisiert** (Re-Probe: HTTP 401) und Token
  rotiert — aber die Function-Hüllen existieren noch und gehören **gelöscht**.
- `governance-{dsr,vendors}` stehen in `config.toml` mit `verify_jwt=false`, haben aber
  **keine Repo-Source** → totes Config. `governance-{incidents,connectors}` existieren
  inzwischen *auch* im Repo (Commits `c67b54f`, `55a0375`) — diese gehören sauber aus dem
  Repo neu deployt, um den `/tmp`-Stand zu überschreiben.
- Guard existiert bereits: `scripts/check-edge-function-drift.mjs` +
  `edge-function-drift.yml` (grandfathered die 8 Altbestände).

### B4 — Security-Advisor-Regression 🔴

Aktueller Live-Stand (137 Security-Lints: **7 ERROR**, 113 WARN, 17 INFO):

- **7× `security_definer_view` (ERROR)** — am 28.05. waren es **0**. Regression durch
  zwischenzeitlich gepushte Economic-Intelligence-Migrationen:
  `v_cost_per_agent`, `v_cost_per_tenant`, `v_cost_per_feature`,
  `v_tenant_risk_cost_quadrant`, `v_tenant_risk_score`, `v_compliance_signals_open`
  **und** `ai_evidence_retention_status` (der 28.05.-`execute_sql`-Fix war **nicht
  durabel** — ein späteres `create or replace view` hat ihn überholt).
- **`auth_leaked_password_protection` (WARN)** — weiterhin **deaktiviert** (Auth-Toggle).
- **17× `rls_enabled_no_policy` (INFO)** — Tabellen nur per `service_role` erreichbar
  (`enterprise_*`, `runtime_events_2026xx`-Partitionen, `ai_runtime_events`,
  `ai_evidence_retention`). Wahrscheinlich gewollt → **bestätigen**.
- WARN-Masse (`*_security_definer_function_executable` ×88, `function_search_path_mutable`
  ×15) ist am 28.05. als **by-design / RLS-Helper / self-gated** eingestuft worden.

### B5 — VPS & Scanner-Microservice 🟠 (🔐 nur per SSH)

- Kodee-Subdomains (`ollama/chat/n8n`) lösen auf `187.77.89.1` auf — Host **Timeout**
  (:80/:443). Zweiter Host `194.163.130.123` antwortet `nginx 404`/`503` (stale).
  → kanonische VPS-IP festlegen, Repo+DNS angleichen (Runbook in
  `SYSTEMCHECK-2026-05-28.md` §VPS-Investigations-Runbook).
- **Playwright-Scanner** (`deploy/playwright-scanner/`) ist **nicht deployt** →
  `cookie-scan-deep` und die als Differenzierer beworbene **Consent-Timing-Analyse**
  haben kein Backend. Das ist der einzige *funktionale* (nicht nur Hygiene-) Gap im
  Phase-1-Produkt.

---

## 3. Konkreter Deployment-Plan (sequenziert)

> Reihenfolge ist bewusst: erst History entgiften, dann mergen, dann härten. Schritte
> mit 🔐 brauchen Operator-Ausführung (Secrets/Dashboard/SSH oder `db push` mit
> DB-Passwort). Schritte ohne 🔐 sind PR-/Repo-Arbeit, die hier passieren kann.

### Phase 0 — Migrations-History entgiften (Voraussetzung für alles) 🔐

Ziel: `supabase db push` wieder vertrauenswürdig machen, **bevor** PRs mit neuen
Migrationen gemerged werden.

```bash
# 1) History-Diff sichtbar machen
supabase migration list --project-ref ebljyceifhnlzhjfyxup   # remote vs local

# 2) Bereits-inhaltlich-angewendete Migrationen als "applied" markieren,
#    OHNE sie erneut auszuführen (repariert die History, kein Schema-Write):
#    für jede Migration, deren DDL live schon existiert (20260602..20260620er Block):
supabase migration repair --status applied <version> --project-ref ebljyceifhnlzhjfyxup

# 3) Erst danach echten Push der wirklich neuen Migrationen:
supabase db push --project-ref ebljyceifhnlzhjfyxup
```

PR **#468** (`migration-drift-guard`) als CI-Wächter danach mergen, damit Drift nicht
zurückkommt. PR **#454** (`DUPLICATE_TIMESTAMP_ALLOWLIST`) ist Voraussetzung, damit der
Lint die gestauchten Timestamps toleriert.

### Phase 1 — PR-Konsolidierung (Merge-Wellen, siehe §4)

Wellen-Reihenfolge: **Security/P0 → Migrations-Hygiene → Auth → Bundle/SEO →
Positionierung → Features → Infra/VPS**. Innerhalb jeder Welle: rebasen auf aktuelles
`main`, CI grün, dann mergen. Konkurrierende Positionierungs-PRs (4×) zu **einer**
zusammenführen, Rest schließen.

### Phase 2 — Edge-Function-Drift schließen 🔐

```bash
# Orphan-Hüllen des ehem. P0-Leaks endgültig entfernen:
supabase functions delete vault-key-setter   --project-ref ebljyceifhnlzhjfyxup
supabase functions delete vault-set-secret   --project-ref ebljyceifhnlzhjfyxup
supabase functions delete debug-secret-shape --project-ref ebljyceifhnlzhjfyxup
supabase functions delete stripe-webhook-fixer --project-ref ebljyceifhnlzhjfyxup
# governance-{incidents,connectors} sauber aus Repo neu deployen (überschreibt /tmp-Stand):
supabase functions deploy governance-incidents governance-connectors --project-ref ebljyceifhnlzhjfyxup
# governance-{dsr,vendors}: totes config.toml-Entry entfernen ODER Source nachliefern (entscheiden)
```

Danach `npm run check:edge-functions` → muss grün bleiben.

### Phase 3 — Security-Advisor-Regression schließen (durable Migration)

Eine **neue, additive** Migration `2026MMDD000000_security_definer_views_invoker.sql`,
die die 7 Views auf `security_invoker = true` setzt (idempotent, kein Re-Create):

```sql
alter view public.v_cost_per_agent              set (security_invoker = true);
alter view public.v_cost_per_tenant             set (security_invoker = true);
alter view public.v_cost_per_feature            set (security_invoker = true);
alter view public.v_tenant_risk_cost_quadrant   set (security_invoker = true);
alter view public.v_tenant_risk_score           set (security_invoker = true);
alter view public.v_compliance_signals_open     set (security_invoker = true);
alter view public.ai_evidence_retention_status  set (security_invoker = true);
```

> Als **Migration** (nicht `execute_sql`!), damit der Fix die History übersteht und
> nicht wie am 28.05. von einem späteren `create or replace view` überholt wird.

🔐 **Leaked-Password-Schutz** aktivieren: Workflow `enable-leaked-password-protection.yml`
einmal triggern (existiert bereits) oder Dashboard → Auth → Password security.

🔐 **`rls_enabled_no_policy` (17)** bestätigen: sind diese Tabellen bewusst nur
`service_role`? Falls ja → in der Function-Drift-Doku als „intentional" festhalten.
Falls nein → explizite Policies ergänzen.

### Phase 4 — Scanner-Microservice & VPS 🔐 (SSH)

1. Kanonische VPS-IP festlegen (`187.77.89.1` vs `194.163.130.123`), Repo
   (`production-runtime.md` ↔ `ollama-traefik/docker-compose.yml`) + DNS angleichen.
2. `deploy/playwright-scanner/` deployen (Docker-Compose vorhanden) → Backend für
   `cookie-scan-deep` + Consent-Timing freischalten. Damit ist **Phase 1 des
   Produkt-Roadmaps funktional vollständig**.
3. Verifizieren: `curl --resolve ollama.realsyncdynamicsai.de:443:<IP> …`.

### Phase 5 — Verifikation (Definition of Done)

- [ ] `supabase migration list` → remote == local, 0 Drift.
- [ ] `npm run check:edge-functions` → grün, 0 neue Orphans.
- [ ] Security-Advisor → **0 ERROR** (Re-Run `get_advisors`).
- [ ] Leaked-PW-Schutz aktiv.
- [ ] `cookie-scan-deep` liefert echten Deep-Scan (Playwright erreichbar).
- [ ] `tsc --noEmit` + `vitest run` + `vite build` grün (28.05.: 1256 passed).
- [ ] Offene PRs < 10 (Rest bewusst geparkt mit Begründung).

---

## 4. PR-Triage — 40 offene PRs

> Empfehlung pro PR. „Merge-Welle" = Reihenfolge aus Phase 1. Annahmen aus Titeln +
> Branch-Namen; vor Merge jeweils CI-Status + Rebase prüfen.

### Welle 1 — Security / P0 (zuerst)
| PR | Titel | Aktion |
|---|---|---|
| #471 | bump protobufjs (8 HIGH advisories) | **Merge** |
| #472 | Cloudflare security-headers runbook + CI watch | **Merge** |
| #480 | cost-cap RPC + view hardening | **Merge** (deckt evtl. B4 mit ab — prüfen) |
| #474 | CORS origin-allowlist helper | **Merge** |
| #470 | AVV: Sub-Prozessoren (Fontshare/Resend/Pages) | **Merge** (Compliance) |

### Welle 2 — Migrations-Hygiene (vor jedem Feature-Merge)
| PR | Titel | Aktion |
|---|---|---|
| #454 | DUPLICATE_TIMESTAMP_ALLOWLIST | **Merge zuerst** |
| #468 | migration-drift guard (remote-vs-repo) | **Merge** nach Phase 0 |

### Welle 3 — Auth
| PR | Titel | Aktion |
|---|---|---|
| #416 | defensive OAuth + Provider auf Google+GitHub | **Merge** |
| #461 | `getSupabase()`-Singleton in Risk-Dashboard | **Merge** |
| (#463 bereits gemerged: `36b99f0`-Reihe) | — | — |

### Welle 4 — Performance / SEO (klein, risikoarm)
| PR | Titel | Aktion |
|---|---|---|
| #482 | vendor-chunk split + lazy AssistentChip | **Merge** |
| #476 | lazy-load BusinessDashboard (recharts) | **Merge** (mit #482 abstimmen) |
| #473 | favicon + apple-touch-icon | **Merge** |
| #333 | Capture click-IDs / Enhanced Conversions | **Merge** |
| #336 | SEO JSON-LD aus pricing.ts ableiten | **Merge** |

### Welle 5 — Positionierung (konsolidieren!)
4 überlappende PRs — **zu einer zusammenführen**, Rest schließen:
| PR | Titel | Aktion |
|---|---|---|
| #475 | Kanonische Positionierungsstrategie | **Basis behalten** |
| #477 | Docs+SEO auf Compliance-Kategorie | in #475 mergen |
| #483 | App-interne Off-Message-Labels | in #475 mergen |
| #478 | Landing CTAs eindeutschen | in #475 mergen |
| #469 | Enterprise-Positioning Landing | in #475 mergen |
| #488 | Goals-Doc / Positionierung | in #475 mergen |
| #335 | README+ROADMAP+Matrix angleichen | **Merge** (Doku) |

### Welle 6 — Features (nach grüner Migrations-History)
| PR | Titel | Aktion |
|---|---|---|
| #464 | White-Label-Reports (Agency/Scale) | **Merge** (Umsatz-Upsell) |
| #455 | Feedback-Agent + Auto-Triage | **Merge** |
| #440 | EU-AI-Act Risk-Inventory (tenant-scoped) | **Merge** |
| #436 | stable fingerprint cross-scan dedup | **Merge** |
| #359 | runtime-derived Web&AI VVT slice | **Review → Merge** |
| #433 | governance knowledge repository | **Review** (Scope?) |
| #363 | Governance-Leitstand Design-System Migration | **Review** (groß, evtl. splitten) |
| #412 | Agency-Pilot-Paket | **Merge** |
| #334 | capability-layer PermissionChecker | **Review** (Runtime-Kernel) |
| #395 | kernel-v1 writer + tier-discipline | **Review** (Runtime-Kernel) |
| #332 | governance-event ingest endpoint | **Prüfen ob obsolet** (live existiert `governance-ingest`) |
| #331 | Positioning+Economics+ai-risk-agent | **Prüfen ob obsolet** (alt, #331) |

### Welle 7 — Infra / VPS / DNS (mit Phase 4)
| PR | Titel | Aktion |
|---|---|---|
| #487 | traefik stack cdn/preview/schemas | **Merge** mit Phase 4 |
| #486 | CLI-first VPS-Diagnose-Skripte | **Merge** (hilft B5) |
| #485 | Ollama auto-pull guard + warmup cron | **Merge** mit Phase 4 |
| #479 | DNS-Inventory pre-Cloudflare | **Merge** (Doku) |
| #402 | openclaw Hostinger One-Shot-Setup | **Review** mit Phase 4 |
| #453 | Deployment/Observability-Plan (Doku) | **Merge** (ergänzt dieses Doc) |
| #481 | PR-/Branch-Inventur (Cleanup-Doku) | **Merge** dann schließen |

**Geschätzte PR-Endzahl nach Konsolidierung:** ~6–8 offene (statt 40).

---

## 5. Was hier autonom passiert ist vs. Operator-Go

**Autonom (dieses Dokument):** Live-Read-Analyse, Drift-/Advisor-Diagnose, PR-Triage,
sequenzierter Plan. **Keine** Schema-Änderung, **kein** Function-Delete, **keine**
Secret-Rotation, **kein** `db push` — bewusst, weil diese auf einer
Produktions-Compliance-DB Sign-off brauchen und die History-Lage (B2) jeden blinden
Push riskant macht.

**🔐 Braucht Operator (DB-Passwort / Dashboard / SSH):**
Phase 0 (`migration repair` + `db push`), Phase 2 (Function-Deletes), Phase 3-Toggle
(Leaked-PW), Phase 4 (VPS/SSH + Scanner-Deploy).

**Kann als nächste Session-Arbeit gemacht werden (PR-only):**
Welle 1–6 der PR-Merges, die durable Security-Migration aus Phase 3, das Bestätigen der
`rls_enabled_no_policy`-Intention.

---

*Erstellt 2026-05-30 · ergänzt `SYSTEMCHECK-2026-05-28.md` (dort Live-Incident-Details
+ VPS-Runbook) und `runtime-status-matrix.md` (Modul-Reifegrade).*
