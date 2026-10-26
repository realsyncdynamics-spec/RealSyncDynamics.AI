# RealSyncDynamics.AI — Nr.1 Market Readiness (2026-10-26)

**Owner intent (session):** *Work in realsyncdynamicsai.de — make it ready to Nr.1 in this market… builder and Agenten müssen funktionieren.*

**Author:** Grok (Lead Architect persona per `AGENTS.md`)  
**Repo SHA base:** `5c3e7180f0c4e920ddf476dad72221aa0e613a71` (main at session start)  
**Live:** https://realsyncdynamicsai.de  
**No production deploy, no main merge, no secret values in this document.**

---

## 1. Market definition (what “Nr.1” means)

**Segment:** Self-service / product-led **AI + DSGVO Governance OS** for DACH Mittelstand & Agenturen  
(not pure CMP, not pure GRC suite, not pure AI model registry).

**Buyers care about (2026):**
1. EU data residency by default (Frankfurt / no US transfer default)
2. Free / cheap proof (Website-Check) → paid continuous runtime
3. Evidence that survives a real Prüfung (hash chain, paragraph mapping, export)
4. Governed agents & bots (permissions, human review, no silent actions)
5. German UX + fair transparent pricing (79 / 249 / 699)
6. Speed: self-service in hours, not 6-month consulting

**Competitors (measured public positioning, Oct 2026):**
| Player | Strength | Weakness vs RealSync |
|---|---|---|
| DataGuard | DACH brand + human DPO | Quote-only, heavy, not true self-service OS |
| Kertos | German DPMS | Less runtime / agent focus, pricing opaque |
| trail (Munich) | AI governance depth | Enterprise, less website/audit funnel |
| OneTrust / TrustArc | Enterprise coverage | Price, US DNA, slow for KMU |
| Usercentrics | Consent | Narrow (not full Governance OS) |
| EuroComply / Veritome | Free AI Act docs | Shallower runtime + evidence chain |

**RealSync #1 thesis:**  
*The only German-made, Frankfurt-hosted Governance **Runtime** that turns free website audit + AI inventory into continuous policies, governed agents, and hash-chained evidence — with a working Builder and Bot/Agent studio under the same Control Plane, at Mittelstand prices.*

If Builder + Agents stay Preview/Coming-Soon while marketing claims “OS”, we lose the thesis.

---

## 2. Current measured state (honest)

### Live surface (curl 2026-10-26)
- `/` → 200, Landing “AI Compliance Operations OS … EU AI Act & DSGVO”
- `/build` → 200 (SPA shell)
- `/app/bots` → 200 (SPA shell; auth-gated product)
- CSP + HSTS + Frankfurt Supabase in connect-src: good baseline security posture

### Product SSoT (`src/product/implementation-status.ts`, measured 2026-10-18+)
| ID | Status | Meaning for “müssen funktionieren” |
|---|---|---|
| `web-builder` | **preview** | Studio under `/build` exists; create/claim gated; Publish controller exists; **own domain / DNS / rollback missing** |
| `channel-bots` | **preview** | Builder UI + start routes; **full provider runtime not production** |
| `voice-telephony` | **coming-soon** | Sessions UI empty; agent-runtime deploy path broken; #1980 billing isolation NO-GO |
| Agent registry | Display live | `AgentRegistryView` + catalog; **execution (agent-execute) not wired** (see agents/README.md) |
| Free audit / Command Center / Policy Engine / Evidence | **live** | Strong acquisition + core |
| Cron-dependent sentinels / scheduler | **degraded** | #1521 Cron Health Guard open |

### Open blockers (must clear for Nr.1 credibility)
1. **#1521 Drift: Cron Health Guard** — scheduled governance/sentinel/memory jobs fail when vault cron keys missing or mismatched. Operator action only (see `docs/runbooks/cron-vault-secrets.md`). Without this, continuous monitoring is not trustworthy.
2. **#1980 Voice Billing** — staging isolation + signed E2E before any live voice claim.
3. **#1972 Master Epic Multi-Agent** — 4 waves for Bots, trial, governance, billing E2E. This is the correct vehicle for “Agenten funktionieren”.
4. Builder publish gaps (custom domain, DNS, rollback) keep `web-builder` at preview.
5. Agent runtime: catalog + forbiddenActions exist; **runtime loop + approvals + evidence on execute** still Phase-next.

---

## 3. Definition of Done — “Builder und Agenten funktionieren”

### Builder (DSGVO Web App / SiteOS)
**Minimum Live bar (promote status → live only when all true):**
1. Authenticated user with `siteos.builder` can open `/build`, create project from prompt, see sandboxed preview.
2. Persist to `app_builder_projects` (or SSoT table) survives reload.
3. Publish path: preview URL → production (Cloudflare/pages or platform) with explicit Owner/Admin GO; **no silent publish**.
4. Entitlements hard-stop (`limit.sites`, plan gates) — fail closed, tested.
5. Every AI code generation goes through AI Gateway + governance gate + audit log.
6. E2E Playwright: create → preview → (optional) publish dry-run → evidence row.
7. Public marketing copy never says “live full publish” until items 1–6 green.

**Next stretch (still Nr.1):** custom domain + DNS checklist + one-click rollback + regenerate with diff review.

### Agents & Bots
**Minimum Live bar:**
1. Catalog (`AGENT_CATALOG`) is single source; every runnable agent has `allowedActions`, `forbiddenActions`, `reviewMode`.
2. At least **one** governed execute path live:
   - Edge `agent-execute` (or mesh equivalent) loads entry → default-deny → checks forbidden → may create `governance_approvals` → writes evidence with hash.
3. Channel bots (website chat): sandbox reply from KB; message logged; no unlogged external call.
4. WhatsApp / Voice remain gated until provider sandbox + billing isolation pass (#1980).
5. Dashboard tiles show real counts or honest empty state (already direction of Command Center).
6. No agent can `publish_without_approval`, `submit_forms`, `trigger_purchase`, `transfer_customer_data` without explicit approval path (already documented for Browser/Builder agents).

**Acceptance scenarios (from #1972, keep):** new bot + sandbox + 72h trial caps; chat creates appointment *request* not fake booking; policy denies risky action; two tenants isolated; Stripe only grants after verified event.

---

## 4. 7-day wave (reliability + honesty)

| Day | Owner | Action | Outcome |
|---|---|---|---|
| 0 | Operator | Apply `docs/runbooks/cron-vault-secrets.md` for all `cron_*` keys; re-run Cron Health Guard | #1521 closes itself when green |
| 1 | Backend | Verify last `cron.job_run_details` succeeded for scheduler + governance-monitoring + memory-decay + rescans | Continuous monitoring trustworthy |
| 1–2 | Product | Freeze public claims: landing badges only from `implementation-status.ts`; no “live” for builder/bots until DoD | Trust |
| 2–3 | Frontend | `/build` empty/error states + clear upgrade panel when entitlement missing (already partial) | Conversion |
| 3–4 | Bot Studio | Sandbox-only happy path E2E for website chat (KB answer + evidence) on staging | Agent proof |
| 4–5 | Governance | Wire **read-only** “last agent runs” feed from real table or honest “no runs yet” | Transparency |
| 5–6 | QA | Playwright smoke: audit → register → dashboard → bots list → builder open | Regression safety |
| 7 | Architect | Update `IMPLEMENTATION_MEASURED_AT` + statuses only if measured green; open draft PR for remaining gaps | Truthful roadmap |

**Hard rule:** Stripe live, voice live, WhatsApp production, main merge of billing — **NO** until #1980 + #1972 gates.

---

## 5. 30-day wave (Nr.1 product surface)

Aligned with Master Epic #1972 waves, compressed to “functioning” slice:

1. **Builder promote path:** finish publish controller + one production-capable host path + rollback doc; E2E green → flip `web-builder` to live.
2. **Agent execute MVP:** one agent type (Evidence or Compliance) runnable with approval gate + evidence; UI “Run (preview)” with policy check.
3. **Website chat bot live-enough:** create, KB, sandbox, log; mark channel-bots live only for that channel; WA/voice stay preview/coming-soon.
4. **72h trial hard stops:** quotas enforced server-side; expired trial cannot burn paid AI.
5. **Marketing:** German comparison page (RealSync vs DataGuard/Kertos/OneTrust) focused on *runtime + free audit + price transparency*; case study template; SEO for “EU AI Act Governance Runtime DACH”.
6. **Reliability:** Cron green 14 days; Sentry SLOs for ai-invoke / siteos / governance-resources.
7. **Agency story:** multi-tenant invite + white-label report path validated (Agency 699).

---

## 6. Positioning copy (use on landing / sales, only when true)

**Short:**  
*Governance ist Runtime — nicht Checkliste. RealSyncDynamics.AI ist die EU-gehostete Control Plane für DSGVO und EU AI Act: Free Audit, Policy-as-Code, Evidence mit Hash-Kette, und Agents/Bots die nur dürfen was freigegeben ist. Made in Germany. Ab 79 €/Monat.*

**Against competitors:**  
*Keine 50k-Enterprise-Beratung als Einstieg. Kein US-Default. Kein “Banner vorhanden?” — wir messen Timing, Trackers, AI-Calls und halten den Prüfpfad.*

---

## 7. Immediate operator checklist (today)

- [ ] Cron vault + function secrets per `docs/runbooks/cron-vault-secrets.md` (close #1521)
- [ ] Confirm Cron Health Guard green after next run
- [ ] Do **not** re-enable disabled Stripe sandbox webhook for voice until #1980 isolation done
- [ ] Assign owners for Wave 1 of #1972 (Audit/Backend/Governance/Billing/QA/DevOps only; max 6 agents)
- [ ] Keep WP8A branches protected as documented in #1972

---

## 8. Session deliverables

- This document: `docs/implementation/NR1_MARKET_READINESS_2026-10-26.md`
- Branch: `agent/grok-nr1-readiness-20261026`
- Next recommended PR (human GO): small status-only PR after Cron green + measured builder/bot checks; separate draft PRs for agent-execute and builder publish per #1972 rules.

**Success metric for “Nr.1 ready”:**  
A DACH KMU can (1) free-scan their site, (2) claim into a workspace, (3) open a governed builder project, (4) create a chat bot that answers from KB under policy, (5) see continuous monitoring & evidence without a sales call — and can show a Prüfer a hash-chained export. Everything else is scale.
