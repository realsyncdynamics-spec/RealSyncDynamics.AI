# Orchestrator-Status (P0-Gates)

Quelle: `docs/product/release-evidence-2026-11-17.md`, Abschnitt 5.
Orchestrator-Session: `session_01HPrkwK2BF1ebwqrGMSFogB`. Stand: 17.11.2026, Runde 1.

## P0-Gates

| Gate | Umsetzung | Session | Branch / PR | Prüfstatus (Head) | Blocker |
|---|---|---|---|---|---|
| Deploy-Kapazität 402 (#2281) | nicht im Code lösbar | – | Issue #2281 | – | Entscheidung: Supabase-Plan/Function-Limit oder Slots freigeben |
| Gezielter Edge-Deploy | umgesetzt | – | `fix/p0-targeted-edge-deploy-20261117` / #2279 | 16 success, 4 skipped, 0 failure | Merge-Freigabe (Workflow-Änderung) |
| Telegram-Webhook fail-closed | umgesetzt | – | `fix/p0-telegram-webhook-fail-closed-20261117` / #2280 | 17 success, 11 skipped, 2 cancelled, 0 failure | Security-Merge-Freigabe |
| Audit-Claim Multi-Tenant | umgesetzt | – | `fix/audit-claim-tenant-selection-20261117` / #2276 | 18 success, 4 skipped, 0 failure; Branch `behind` | Branch per Merge aktualisieren, dann Merge-Freigabe |
| Security/Isolation RPC-Grants (#2273) | Migration als Draft | – | `fix/p0-live-grants-and-rls` / #2224 (+ #2225, #2238) | #2224: 1 failure (`Cloudflare Pages: realsync-landing`), Rest grün/skipped | Migrations-Freigabe, Staging-Negativtests |
| Bedarfs-Check Folge-Migration | in Arbeit | `session_01HPrkwJykeBFPf8pPGiCVqp` | #2263, Fix #2290 | #2263: `Migration validation` failure | Fix #2290 abwarten |
| Monetarisierung (#1980, #923/#1039) | offen | – | – | – | Stripe-Staging und signierte E2E-Abnahme (Zugang/Secrets beim Inhaber) |

## Aufrufanalyse zu #2224 (Repo, nur Lesen)

Geprüft: Aufrufe der REVOKE-Kandidaten in `src/`, `supabase/functions/`, `apps/`, `scripts/`, `shared/`.

| Routine | Aufrufer im Repo | Client | Wirkung des REVOKE in #2224 |
|---|---|---|---|
| `verify_api_key` | `supabase/functions/api-gateway/index.ts:44` | Service Role | keine, `service_role` behält Execute |
| `get_tenant_branding_by_domain` | `supabase/functions/tenant-branding-get/index.ts:41` | Service Role | REVOKE in #2224 auskommentiert |
| `ai_evidence_verify_chain` | `supabase/functions/evidence-anchor/index.ts:126` | Service Role (`admin`) | keine |
| `connector_enforcement_summary`, `m365_reaction_summary`, `pdp_shadow_readiness` | `src/features/governance/gatesApi.ts` | Nutzersitzung | keine, `authenticated` behält Execute |
| `update_onboarding_progress` | `src/pages/Welcome.tsx` | Nutzersitzung | keine, `authenticated` behält Execute |
| `creatorseal.*`, `agentos.*`, `verify_c2pa_assertion`, `can_set_membership_role` | kein Aufruf per `.rpc()` im Repo gefunden | – | Aufrufer außerhalb dieses Repos nicht geprüft |

Grenze: reine Textsuche im Repository. Aufrufe aus anderen Repositories, pg_cron oder SQL-Funktionen
sind damit nicht ausgeschlossen. Staging-Negativtests aus #2273 bleiben nötig.

## Sessions

Runde 1: keine Session archiviert, keine neue Arbeits-Session angelegt. Alle offenen P0-Punkte hängen an
Freigaben oder Zugängen; parallele Umsetzung ist derzeit nicht möglich.
