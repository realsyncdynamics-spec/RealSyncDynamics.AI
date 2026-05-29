# Architektur — RealSyncDynamics.AI

> **Hinweis:** Diese Datei war ein veralteter Stand („RealSync Agent OS" /
> Creator / C2PA) und widersprach der aktuellen Positionierung. Sie wurde auf
> den heutigen Stand gebracht und verweist auf die maßgeblichen Dokumente.

RealSyncDynamics.AI ist eine **EU-souveräne Compliance-Infrastruktur**:
automatisierte DSGVO- und EU-AI-Act-Überwachung, kontinuierliches Monitoring,
typisierte Remediation und prüfsichere Evidence — Multi-Tenant.

## Maßgebliche Dokumente

| Thema | Quelle |
|---|---|
| **Positionierung** (USP, ICP, GTM) | [`docs/POSITIONING_STRATEGY.md`](docs/POSITIONING_STRATEGY.md) |
| **Scope-Disziplin** (Kern vs. außerhalb) | [`docs/PRODUCT_FOCUS.md`](docs/PRODUCT_FOCUS.md) |
| **Zielarchitektur** (Domänen, Tech-Stack, ADRs) | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| **System- & Datenfluss** (Edge Functions, Residency) | [`README.md`](README.md) |
| **Roadmap & Preisstruktur** | [`ROADMAP.md`](ROADMAP.md) |

## Kurzüberblick

- **Frontend:** Vite + React 19 (SPA), hinter Traefik auf Hostinger-DE-VPS.
- **Backend:** Supabase (Auth, Postgres mit RLS, Edge Functions, Storage), EU-Region.
- **AI-Inferenz:** Cloud-Pfad (Anthropic / Google / OpenAI) **oder** EU-lokaler
  Pfad (Ollama `gemma3:4b`), per-User/Tenant wählbar (Residency-Routing).
- **Kern-Runtime:** Event-Bus → Evidence-Chain (SHA-256) → Remediation-Layer
  (`src/core/runtime/`). Jeder externe Call wird in `ai_tool_runs` /
  `workflow_runs` geloggt.

Detaillierte Domänen-Schnitte und die Feature-Sliced-Ordnerstruktur sind in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) beschrieben.
