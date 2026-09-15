# RealSync OS — Kernel v0.1

## Product contract

RealSync OS is the operating/control plane for building, running and governing digital systems. The agent loop is:

`Intent → Policy → Plan → Execute → Observe → Verify → Evidence`

The platform is not a clone of Claude Code. Claude Code is a benchmark for agentic software engineering; RealSync extends that mechanism across frontend, infrastructure, business operations and governance.

## Existing capabilities to reuse

The repository already contains Supabase Auth, tenant membership/RLS, Governance Runtime, Policy Engine, Evidence Vault, Risk Engine, Audit, C2PA/provenance, SiteOS blueprints, SiteOS runtime scans, SiteOS discovery, SiteOS agents and real preview rendering. These are reused rather than duplicated.

The measured reality audit also identifies publishing and a formal publish gate as missing. Therefore no production deployment is implied by a plan or preview until a dedicated gate exists.

## Kernel layers

1. **Experience** — Command Center, Code, Build, Agents, Growth, Governance.
2. **Agent Runtime** — orchestrator, planner, specialist agents, reviewer.
3. **Tool Runtime** — MCP, APIs, integrations and plugins.
4. **Data** — project context, knowledge, files and memory.
5. **Governance Runtime** — policy, permissions, risk and approvals.
6. **Evidence** — audit events, hashes, provenance and immutable evidence.

## Permission model

Every agent action is evaluated against a versioned policy before execution. Unknown actions are denied by default. Production deployment is approval-gated. Sensitive data classes remain restricted and production databases/secrets are denied to the website agent by default.

## SiteOS integration

The existing SiteOS pipeline remains the implementation substrate for Build. Its append-only blueprint/version model and existing agent runs are reused. The new OS kernel is an orchestration and policy contract around those capabilities, not a second builder database.

## Product surfaces

### Command Center

Single intent entry point. The user describes an outcome; RealSync produces an execution plan with agents, dependencies, risk and approval gates.

### RealSync Code

Browser-native engineering surface: Chat, Plan, Files, Changes, Preview, Tests, Logs and Deploy. It must operate through controlled tools and a sandbox, not unrestricted browser-side mutation.

### RealSync Build

Prompt-to-frontend and landing-page builder using SiteOS blueprints plus a visual design system. Inputs: prompt, URL, screenshot, existing code, uploaded assets and supported design sources.

### RealSync Governance

Governance is runtime behavior, not a separate post-processing report. The system evaluates AI Act/GDPR implications, data classification, permissions and evidence requirements during execution.

## Non-negotiables

- No fake integrations, fake scores or simulated deployment success.
- Tenant isolation remains enforced through existing RLS and membership checks.
- Every material agent action is observable.
- Mutating operations produce versioned artifacts and evidence.
- High/critical-risk operations require explicit approval according to policy.
- Preview is not production.
- Stripe entitlements remain the commercial source of truth; do not introduce `tenant_modules`.
- Cloudflare remains the preferred deployment target; do not introduce Vercel.

## DesignOS

> DesignOS is a capability of the RealSync OS Kernel, not an independent application runtime. SiteOS remains the canonical web artifact, rendering and execution substrate. All AI-driven design mutations must pass through the RealSync OS planning, policy, approval, execution, observation and verification lifecycle.

Phase A is kernel-only: semantic `DesignProject` / `DesignNode` / tokens, a design plan, deny-by-default design policy, and a pure `designToBlueprint` mapping. No editor, no second builder, no own deploy, no fake scores. Screenshot / URL / code extractors stay `NOT IMPLEMENTED` until bound.

See `docs/product/designos-architecture.md`.

