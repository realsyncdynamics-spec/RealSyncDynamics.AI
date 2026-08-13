# RealSyncDynamics.AI — Current Architecture

**Stand:** 2026-08-13

This document describes the current product shape after the landing-page integration work. The key architectural rule is: **the landing page is an acquisition and product-entry surface; the Governance Runtime remains the core.**

## 1. Product layers

```text
┌─────────────────────────────────────────────────────────────────────┐
│ PUBLIC EXPERIENCE / ACQUISITION                                    │
│                                                                     │
│  MainLanding                                                        │
│  ├─ Free Governance Audit                                          │
│  ├─ DSGVO Web App Builder entry                                    │
│  ├─ Claude Code Optimizer entry                                    │
│  ├─ WhatsApp Bot entry                                             │
│  └─ Telefonbot / Voice entry                                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ UNIFIED PRODUCT ENTRY                                              │
│                                                                     │
│  Scan → Preview → Trial → Register → Onboarding                    │
│  /unified-entry/*                                                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ GOVERNANCE RUNTIME — CORE                                          │
│                                                                     │
│  DISCOVER → ASSESS → GOVERN → ENFORCE → EVIDENCE → AUDIT           │
│                                                                     │
│  Event Bus · Policy Engine · Risk · Remediation · Evidence Chain   │
│  AI System Registry · Monitoring · Approvals · Audit Trail         │
└─────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼────────────────┐
              ▼               ▼                ▼
┌──────────────────┐ ┌──────────────────┐ ┌────────────────────────┐
│ APPLICATIONS      │ │ CHANNELS         │ │ ENGINEERING            │
│                   │ │                  │ │                        │
│ Website Builder   │ │ WhatsApp         │ │ Claude Code Optimizer  │
│ DSGVO Audit       │ │ Voice / Phone    │ │ Repository Audit       │
│ AI Act            │ │ Chat             │ │ Fix / Remediation      │
│ Compliance Tools  │ │ Telegram         │ │ PR / Evidence          │
└──────────────────┘ └──────────────────┘ └────────────────────────┘
              │               │                │
              └───────────────┼────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ EVIDENCE / DATA / BILLING                                          │
│                                                                     │
│ Supabase Postgres + RLS · Edge Functions · Storage                  │
│ Evidence Vault · Audit Logs · Usage / Entitlements · Stripe        │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Repository layers

```text
RealSyncDynamics.AI/
├── src/                         # Main Vite/React product SPA
│   ├── pages/                   # Public pages + product entry flows
│   │   ├── MainLanding.tsx      # Current public homepage
│   │   ├── optimizer/           # Claude Code Optimizer flow
│   │   ├── product-entry-points/# Scan/chat/phone entry points
│   │   └── ...
│   ├── features/                # Auth-gated product modules
│   │   ├── bots/                # Bot CRUD, Builder, Inbox
│   │   ├── governance/          # Runtime governance modules
│   │   ├── siteos/              # Website/site governance
│   │   ├── evidence-vault/      # Evidence UI
│   │   ├── billing/             # Pricing, usage, checkout
│   │   └── ...
│   ├── unified-entry/           # Free Audit → Trial → Account funnel
│   ├── core/                    # Runtime, access, tenant and contracts
│   ├── components/              # Shared UI
│   ├── lib/                     # Infrastructure utilities / Supabase
│   └── App.tsx                  # Route composition root
│
├── supabase/                    # Backend contract
│   ├── functions/               # Edge Functions
│   │   ├── bot-chat
│   │   ├── bot-voice-webhook
│   │   ├── appointment-book
│   │   ├── order-intake
│   │   ├── governance-*
│   │   ├── evidence-*
│   │   ├── gdpr-*
│   │   └── stripe-*
│   └── migrations/               # Additive Postgres/RLS schema evolution
│
├── apps/                        # Containerized application services
│   └── agent-runtime/
├── services/                    # Runtime / evidence / scanner / agent services
├── packages/                    # Shared SDK and packages
│
├── platform/                    # Builder + governance microservice suite
│   ├── builder_orchestrator/    # Website generation/task graph
│   ├── governance_backend/      # Risk / governance backend
│   ├── nextjs_frontend/         # Platform builder frontend
│   └── docker-compose.yml
│
└── docs/                        # Architecture, product and operational docs
```

## 3. Landing-page product surface

`src/pages/MainLanding.tsx` is intentionally thin at the product boundary. It owns positioning, visual composition, the Free Audit CTA and the initial domain handoff. The reusable tool cards live in `src/components/landing/LandingChannelTools.tsx`.

The current tool surface is:

| Landing entry | Product destination | Role |
|---|---|---|
| Free Audit | `/unified-entry/scan` | Primary acquisition funnel |
| DSGVO Web App Builder | `/website-builder` | Website analysis / transformation entry |
| Claude Code Optimizer | `/claude-code-optimizer` | Code governance / remediation entry |
| WhatsApp Bot | `/app/bots` | Bot management / builder |
| Telefonbot | `/app/bots` / voice channel | Bot management / voice configuration |

The landing page should **not** duplicate the implementation of these products. It should expose them, preserve the premium visual system, and hand off into the existing runtime/application surfaces.

## 4. Bot architecture

Bots are a governed application surface, not a second runtime:

```text
Landing CTA
   ↓
/app/bots
   ↓
BotBuilderView
   ↓
Postgres bots (RLS)
   ↓
Edge Functions
   ├─ bot-chat
   ├─ appointment-book
   ├─ order-intake
   └─ bot-voice-webhook
   ↓
AI tool pipeline + usage + audit/evidence
```

Supported channels currently include `chat`, `voice`, `telegram`, and `whatsapp`. Voice is entitlement-controlled and uses the existing voice webhook path.

## 5. Governance core

The runtime is the architectural center. New features should attach to one or more of these primitives:

1. **Governance Event** — normalized, append-oriented event.
2. **Policy / Control** — deterministic governance decision.
3. **Risk / Finding** — severity and control context.
4. **Remediation** — typed action or proposed fix.
5. **Evidence** — immutable/auditable proof of what happened.
6. **Audit Trail** — chronological operational history.

The website builder, Claude Code optimizer, WhatsApp bot and telephone bot therefore become **governed surfaces** rather than independent products with separate compliance logic.

## 6. Platform boundary

The repository contains both the main Vite/React SPA and a `platform/` microservice suite. The latter contains a builder orchestrator, governance backend and Next.js frontend. This is intentional: the public SPA is the product shell and customer experience, while the platform suite provides specialized builder/governance workloads.

Do not introduce a third frontend stack for the same customer workflow. New public entry points should route into an existing surface or explicitly extend the platform boundary.

## 7. Immediate implementation priorities

1. Keep the landing page visually consistent with the new black/cyan/editorial design.
2. Make every landing CTA resolve to a real product route — never a placeholder.
3. Connect builder results to Governance Runtime evidence rather than leaving them as isolated reports.
4. Connect bot conversations and voice events to the same governance/evidence model.
5. Make Claude Code findings and remediation runs first-class governance events/evidence.
6. Verify public routes and production build before declaring a feature live.
7. Keep `PRODUCT_FOCUS.md` authoritative for what belongs in the core versus acquisition/application surfaces.
