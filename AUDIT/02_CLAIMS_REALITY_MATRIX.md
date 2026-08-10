# 02 — Claims vs. Code Reality

Quelle der Claims: ausgelieferte Produktionsseite https://realsyncdynamicsai.de
(`<title>`, `<meta description>`) sowie `src/pages/MainLanding.tsx` und
`src/components/sections/*.tsx`.

**Status:** `BELEGT` · `TEILWEISE` · `NICHT BELEGT` · `WIDERLEGT`

---

| # | Claim | Code-Evidenz | Runtime-Evidenz | Test-Evidenz | Status |
|---|---|---|---|---|---|
| C-01 | „DSGVO-konform" (4×) | DSR-Workflow, Erasure-Sweeper, subject_ref-HMAC vorhanden | `governance-dsr` deployt; `audit_jobs` fehlt | keine DSGVO-E2E in CI | **TEILWEISE** |
| C-02 | „AI-Act-ready" | `ai-act-classify` deployt, `governance_assets.ai_act_class` real | `ai-act-auto-classify` **nicht deployt** | Unit-Tests vorhanden | **TEILWEISE** |
| C-03 | „kontinuierliches Monitoring" (2×) | `audit-monitor-cron`, `audit-recheck-weekly` deployt | **`scheduler`, `scheduler-dispatch`, `agent-scheduler` nicht deployt** | keine | **TEILWEISE** |
| C-04 | „kryptografische Evidenz" | SHA-256-Chain + Ed25519 real implementiert | `evidence-vault` **nicht deployt**, `evidence_vault_items` fehlt in DB | `hash-chain.db.test.ts` — **läuft nicht in CI** | **NICHT BELEGT** (F-01/F-02/F-07) |
| C-05 | „unveränderlich" (2×) | Append-Only-Trigger real | keine externe Verankerung | Korruptions-Test existiert, läuft nicht | **TEILWEISE** — tamper-evident, nicht tamper-proof (F-10) |
| C-06 | „revisionssicher" | wie C-05 | wie C-05 | wie C-05 | **NICHT BELEGT** (F-10) |
| C-07 | „auditfähig" (2×) | `runtime_events` + Verifier-RPC | `export-audit`, `audit-determinism-verify` **nicht deployt** | — | **TEILWEISE** |
| C-08 | „100 % EU-Hosting" / „EU-Hosting" (6×) | Supabase EU, Sentry `ingest.de.sentry.io`, Ollama-Fallback | CSP erlaubt TikTok/Meta/LinkedIn (Drittland); Anthropic/OpenAI = US | — | **TEILWEISE** — Datenhaltung EU, Verarbeitung nicht durchgängig (F-18) |
| C-09 | „RLS schützt jede Tabelle" | 308/341 Tabellen mit RLS | **35 Tabellen ohne RLS, anonym erreichbar** | kein Coverage-Test | **WIDERLEGT** (F-08) |
| C-10 | „Claude-Code-auditiert" (3×) | 18 Functions mit `ANTHROPIC_API_KEY`; `claude-code-optimizer`-Seiten | Optimizer-Seiten sind Frontend-Flows; keine belegbare Repo-Analyse-Pipeline | — | **NICHT BELEGT** |
| C-11 | „automatisierte Code-Fixes" | `compliance-remediation-execute`, `optimize-execute` | **beide nicht deployt** | — | **NICHT BELEGT** |
| C-12 | „mandantengetrennt" | RLS-Pattern über `memberships` korrekt | Kern-Tabellen halten (anon = 0 Zeilen); aber F-04/F-05/F-08/F-09 | `rls.db.test.ts` läuft nicht in CI | **TEILWEISE** |
| C-13 | „Human Oversight" (2×) | `governance-approvals` deployt, Approval-Evidenz real | funktioniert | Unit-Tests vorhanden | **BELEGT** |
| C-14 | „C2PA" / „Chain-of-Custody" | `provenanceCore.ts`, Ed25519, `provenance_records` existiert | **`provenance`, `c2pa-manifest-generate` nicht deployt** | — | **NICHT BELEGT** (F-01) |
| C-15 | „14 Tage kostenlos" (2×) | `trialDays` in `shared/pricing.ts` | **`create-trial-subscription` nicht deployt** | `pricing-flow.spec.ts` läuft nicht in CI | **NICHT BELEGT** |
| C-16 | „15 Minuten Account-Zugang" | Onboarding-Flow vorhanden | nicht messbar ohne E2E | keine | **GRAU** |
| C-17 | „monatlich kündbar" | Stripe-Portal (`stripe-portal` deployt) | Portal erreichbar | keine | **BELEGT** |
| C-18 | „API" | `api-gateway`, `api-audit`, `verify_api_key`-RPC real und korrekt | **beide nicht deployt** | — | **NICHT BELEGT** (F-01) |
| C-19 | „Webhooks" | `webhook-deliver`, `-dispatcher`, `-retry-cron` real | **alle drei nicht deployt** | — | **NICHT BELEGT** (F-01) |
| C-20 | „Scheduler" | `scheduler`, `scheduler-dispatch` real | **nicht deployt** | — | **NICHT BELEGT** (F-01) |
| C-21 | „Voice" | `bot-voice-webhook`, `voice_channels` | deployt, aber **ohne Auth** (F-05) und Tabelle ohne RLS (F-08) | keine | **TEILWEISE / unsicher** |
| C-22 | „WhatsApp" | keine WhatsApp-Integration im Repo gefunden | — | — | **NICHT BELEGT** |
| C-23 | „Telegram" | `telegram-webhook` deployt, Secret-geprüft | funktioniert | keine | **BELEGT** |
| C-24 | „Slack/Teams" | nur Katalogeinträge in `seed-integrations` (nicht deployt) | keine Zustellungslogik | — | **NICHT BELEGT** |
| C-25 | „White Label" | `tenant-branding-get/update` real | **nicht deployt** | — | **NICHT BELEGT** |
| C-26 | „Partner Mode" | `partner-provision-tenant` real, Key-Hash-Auth korrekt | **nicht deployt** | — | **NICHT BELEGT** |
| C-27 | „Policy Packs" (CLAUDE.md: 100 %) | vollständige Implementierung im Repo | **Function + Tabelle fehlen in Prod** | — | **WIDERLEGT für Produktion** |
| C-28 | „Evidence Vault" (90 %) | vollständig im Repo | **Function + Tabelle fehlen in Prod** | — | **WIDERLEGT für Produktion** |
| C-29 | „Memory Governance RFC-003" | vollständig, inkl. SQL-Paritätstest | **3 Functions + Tabelle fehlen in Prod** | Paritätstest läuft (Unit) | **WIDERLEGT für Produktion** |
| C-30 | „ISO 42001" | 4 Functions + Control-Definitionen | **alle nicht deployt, Tabelle fehlt** | — | **NICHT BELEGT** |

---

## Zusammenfassung

| Status | Anzahl |
|---|---|
| BELEGT | 3 |
| TEILWEISE | 8 |
| NICHT BELEGT | 14 |
| WIDERLEGT | 4 |
| GRAU | 1 |

**Kernaussage:** Die Claims beschreiben präzise, was **im Repository** steht. Der
Bruch liegt nicht zwischen Marketing und Code, sondern zwischen **Code und Produktion**.
Das ist die gute Nachricht: die Substanz existiert überwiegend und ist teils sehr
sauber gebaut. Es ist ein Deployment- und Verifikationsproblem, kein Vaporware-Problem.

Bis zur Schließung von F-01/F-02 sind die Aussagen C-04, C-06, C-11, C-14, C-15,
C-18, C-19, C-20, C-25, C-26, C-27, C-28, C-29, C-30 auf der öffentlichen Website
nicht haltbar und sollten zurückgenommen oder als „in Vorbereitung" gekennzeichnet
werden.
