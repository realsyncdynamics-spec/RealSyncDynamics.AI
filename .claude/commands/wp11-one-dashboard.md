---
description: WP11 Ein Kunden-Dashboard plus Router-Guards (Masterplan M2, M7)
---

# WP11 — Ein Dashboard

**Voraussetzung:** Owner bestätigt die Stilllegungsliste unten · **Branch:** `feat/wp11-one-dashboard`

## Rahmen (gilt für jede WP-Session)

Repository: realsyncdynamics-spec/RealSyncDynamics.AI
Lies zuerst: CLAUDE.md, docs/strategy/MASTERPLAN_2026-2027.md (§3 Must-haves, §8 Owner-Entscheidungen).

Ein Arbeitspaket pro Session. Eigener Branch von origin/main. Ein PR, Squash.

Verboten ohne separates GO:
- Deploy, Merge, Push auf main
- Supabase-Migration, Stripe-Änderung, Cloudflare/Worker/KV
- echte Provider- oder Agentenaktionen

Immer:
- Tenant nur über JWT user → memberships → tenant_id. Nie aus URL, Body, localStorage.
- Keine Service-Role im Browser.
- Keine Fake-KPIs. Fehlt eine Quelle: Empty State oder Preview-Label.
- Status nur aus src/product/implementation-status.ts: live · preview · coming-soon.
- Nur die im WP genannten Dateien ändern. Keine Repo-weiten Refactors.

Prüfung: npm run lint · npm test (betroffene Suites) · npm run build. Nicht ausführbar → im PR begründen.

PR-Text: geänderte Dateien · wiederverwendete Strukturen · live · preview · coming soon · Checks.

## Auftrag

Befund (26.10.2026): `/app/dashboard` (`DashboardRouter` → `CommandCenterDashboard`) ist echt verdrahtet.
Daneben: `/app/intelligence`, `/app/cockpit`, `/app/mein-geschaeft`, `/app/governance/start`,
`/dashboard/enterprise-ai-os` (Mock aus `src/unified-entry/mock-data.ts`), `/dashboard/business`,
`/dashboard/audit`, `/dashboard/agents`. `/admin/*` und `/dashboard/*` haben keinen Router-Guard.

Aufgaben:
1. Stilllegungsliste im PR vorschlagen: pro Route behalten (als Tab/Modul im Command Center) · umleiten · nur Admin.
2. Kunden-Routen, die umgeleitet werden: `<Navigate replace>` auf `/app/dashboard` (ggf. mit Tab-Parameter).
3. `EnterpriseAiOsDashboard` und `MOCK_DASHBOARD_DATA` entfernen bzw. Route umleiten; Imports prüfen.
4. Router-Guard-Komponente für `/admin/*` und `/dashboard/*` (super-admin über bestehende Prüfung,
   die die Views heute einzeln machen). Server-RLS bleibt die eigentliche Sperre, der Guard verhindert nur das Rendern.
5. Command Center: Block „Compliance-Ampel“ mit drei echten Zählern (KI-Systeme erfasst, klassifiziert,
   Nachweise vorhanden) aus vorhandenen Quellen (`osControlStripData.ts`). Fehlt eine Quelle: Empty State.
6. Tests: Guard leitet Nicht-Admins um; umgeleitete Routen landen im Dashboard.
