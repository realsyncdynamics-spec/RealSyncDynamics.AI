# Plan A — Current Architecture Inventory

**Stand:** 2026-09-17  
**Basis:** `main` @ `eda569cc` + bestehendes Audit `docs/audit/01_INVENTORY.md` (2026-08-24)  
**Branch:** `docs/governance-computing-os-2026-09-17`  
**Modus:** Read-only. Kein Merge, kein Deploy, keine Migration.

Status: `VERIFIED` Datei belegt · `PARTIAL` vorhanden aber lückenhaft · `NOT_FOUND` · `UNKNOWN` nur Live messbar.

---

## 1. Was das Repo heute ist

Kein leeres Dashboard. Es ist bereits ein Governance-/Agent-OS-Monorepo:

| Schicht | Ort |
| --- | --- |
| Vite/React App | `src/` (`App.tsx`, `features/`, `core/`, `enterprise-os/`, `governance/`) |
| Feature-Sliced Domains | `src/features/*` (dashboard, evidence-vault, agents, integrations, workspace, finance, …) |
| Enterprise-OS UI (Teil) | `src/enterprise-os/pages` — Home, Compliance, Evidence, Risks, Monitoring, Websites, AI Governance |
| AI Gateway | `src/core/ai-gateway` + `supabase/functions/ai-gateway` + `_shared/aiGateway` + `_shared/providers.ts` |
| Auth | `src/features/supabase/SupabaseAuthContext.tsx`, `src/core/access/` (AAL2 frontend HARD) |
| Edge | sehr große Function-Fläche unter `supabase/functions/` |
| Connectors (früh) | `connectors/` (Anthropic/OpenAI wrapper, n8n, make) + `governance-connectors` + `seed-integrations` |
| Workers | `worker/`, `workers/`, `wrangler.toml`, `wrangler-workers.toml` — Freeze gilt |

`ARCHITECTURE.md` im Root ist veraltet (MVP-Sprache). Die reale Struktur ist breiter als dieses File.

---

## 2. Mapping Ziel-OS → Ist

| Ziel-Workspace | Ist | Status |
| --- | --- | --- |
| CEO Command Center | `features/dashboard`, `dashboard-intelligence`, `dashboard-digest-generate`, `ceo-brief-pdf`, `enterprise-os/pages/AppHomePage.tsx` | PARTIAL — governance-lastig, KPI-Fabrication ist offenes Thema (eigene Branches) |
| Work (Tasks/Projects/Approvals) | `governance-approvals`, `features/workflows`, `features/automations` | PARTIAL — kein einheitliches Task/Project-Modell |
| CRM (Companies/Contacts/Leads/Opps) | `features/company`, `features/outreach`, `sales-lead`, `save-company-profile` | PARTIAL / dünn — kein Pipeline-Objekt mit Audit je Stage |
| People | `tenant-members`, `update-member-role`, `features/tenants` | PARTIAL — Membership ≠ Employee-Stammdaten; 3 Rollen-Vokabulare parallel |
| Documents / Knowledge | `classify-document`, `generate-document`, `legal-retrieve`, `features/legal-rag` | PARTIAL — kein volles document_id/hash/version/ACL-Retrieval-Modell |
| AI Workspace | `features/workspace`, `features/assistant`, `kodee*` | PARTIAL — Chat/Agent, kein Modus-Modell ASK…EXECUTE mit Gate |
| Agents | `features/agents`, `enterprise-ai-os-agents-*`, `governance-agent`, `agent-os-runner` | PARTIAL — mehrere Run-Pfade, kein einheitliches run_id-Evidence-Schema |
| Governance | `src/features/governance`, Policy Packs, DPIA/DSR, Risk, Incidents | VERIFIED als Kern — zwei Policy-Engines parallel |
| Evidence | `evidence-vault*`, hash chain, legal hold | PARTIAL — HMAC nicht Ed25519; PDF = HTML |
| Connectors | `governance-connectors`, `integration-credentials`, `microsoft365-*`, Shopify, Stripe, `connectors/` | PARTIAL — keine einheitliche Tool-Allowlist-Schicht |
| Browser Workspace | `browser-action-log`, Extensions (`extension*`) | PARTIAL — nicht als OS-Workspace integriert |
| Administration | billing/stripe/*, settings, tenant-branding | PARTIAL |

---

## 3. Auth / Tenant / Policy (kritisch für Freeze-Reihenfolge)

Aus `docs/audit/01_INVENTORY.md` (weiterhin zutreffend, nicht neu gemessen in Live-DB):

1. **Zwei Membership-Tabellen** (`memberships` vs `tenant_memberships`), kein Sync-Trigger → Drift.
2. **Drei Rollen-Vokabulare** parallel (owner/admin/dpo/editor/viewer_auditor vs owner/admin/member/viewer vs owner/editor/viewer/approver).
3. **AAL2:** Frontend blockiert, Edge `observeAal2` blockt nie.
4. **Policy:** Engine A `_shared/policy-engine.ts` (getestet) und Engine B `_shared/policyEngine.ts` (produktiv, ungetestet) + toter `PolicyEvaluationService`.
5. **AI Gateway:** zwei Pfade (ai-gateway/LM-Studio-Router vs providers.ts/ai_tools). Frontend `cloud-fallback` → openai, Edge → anthropic.
6. **RLS:** breit vorhanden; DB-Tests nicht in CI (`TEST_DB_URL` skip).
7. **`requireAuthAndTenant`:** in `_shared/auth.ts` und mehreren Functions — das ist der wiederzuverwendende Gate, nicht neu bauen.

Live-Zustände (KV-IDs, deployte Worker, `ai_policies` Query-Semantik, DNS) bleiben **UNKNOWN**. Freeze: erst Ist-Infra außerhalb Repo, dann Auth/Tenant, dann Policy-Query, dann KV.

---

## 4. AI-Aufruf — Soll vs Ist

Soll: Browser → AI Gateway → Tenant/Policy/Entitlement/Context/Audit/Cost/Tools → Provider → MCP → Evidence.

Ist:

- Gateway existiert, aber **zwei** Provider-Router.
- Claude/Anthropic ist ein Backend im Fallback, nicht die abstrahierte Primary-Runtime mit MCP-Allowlist.
- `connectors/anthropic-wrapper.ts` liegt neben der Edge, nicht als einzige Tool-Schicht.
- Agent-Runs: `enterprise-ai-os-agents-run`, `log-tool-run`, `ai_tool_runs` — nicht ein Run-Modell.
- EXECUTE-Gate mit `approval_id` als Pflicht: **NOT_FOUND** als durchgängiges Muster (`governance-approvals` existiert separat).

---

## 5. Was für das Computing-OS *nicht* neu erfunden werden darf

Wiederverwenden:

- `requireAuthAndTenant` / AppGate / `RequireAal2`
- bestehender React-Router in `App.tsx` (nicht zweites Auth)
- `ai-gateway` Edge + Entitlements/usage
- Evidence Vault + hash chain
- Policy Packs / `ai_policies` (nach Semantik-Klärung)
- `governance-connectors` + `integration-credentials` als Keim der Connector-Abstraktion
- Stripe-Billing

Nicht anfassen ohne Freeze-Aufhebung:

- `main`
- wrangler KV create / Policy-Worker activate
- Production-Migrationen
- parallele Auth-Keys

---

## 6. Größte Lücken zum Zielbild

1. Keine einheitliche Top-Nav Human+AI Workspace — Governance ist noch die App.
2. Kein CRM-Pipeline-Audit-Modell.
3. People = Membership, nicht Employee-Graph.
4. Documents ohne Retrieval-nach-ACL als harte Gateway-Regel.
5. Zwei AI-Pfade, zwei Policy-Engines, drei Rollenlisten.
6. Connector-Tools nicht allowgelistet auf Tool-Ebene.
7. KPI-Command-Center ohne verbindliche `NO DATA / NOT CONNECTED`-Regel im Ist-UI (eigene Fix-PRs offen: #1420/#1421 IDOR).

---

## 7. Offene PRs gegen main (nicht mergen)

- #1421 / #1420 KPI RPC IDOR
- #1418 ai-gateway rate-limit (draft)
- #1417 Sentry
- #1416 Suspense/ErrorBoundary
- weitere Perf/CI-PRs

Diese PRs sind **nicht** Teil dieses Docs-Branches.

---

## 8. Nächste Deliverables auf diesem Branch

- B Target architecture (Soll auf Ist-Schnitt gelegt)
- C Route map aus `src/App.tsx` + enterprise-os (Datei:Zeile)
- H Permission model — muss die drei Rollen-Vokabulare adressieren, bevor CRM/People-Tabellen vorgeschlagen werden
- F/G Connector + AI tool model — auf `governance-connectors` / `ai-gateway` aufsetzen, nicht neu

Production-Unknowns bleiben Unknown. Kein Worker, kein KV, kein PR.
