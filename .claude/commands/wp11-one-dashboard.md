---
description: WP11 Ein Kunden-Dashboard (Masterplan M2)
---

# WP11 — Ein Dashboard

**Voraussetzung:** WP4 gemerged (OsControlStrip) · **Branch:** `feat/wp11-one-dashboard`

## Rahmen (gilt für jede WP-Session)

Repository: realsyncdynamics-spec/RealSyncDynamics.AI
Lies zuerst: CLAUDE.md, docs/strategy/MASTERPLAN_2026-2027.md (nur §3 und den eigenen M-Punkt),
.claude/os-funnel/PLAN.md (§5 Leitplanken).

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
- Keine Claims „vollständig revisionssicher", „autonome Agenten live", „EU-konform garantiert".
- Design-Freeze auf /: keine Tokens umstylen.
- Nur die im WP genannten Dateien ändern. Keine Repo-weiten Refactors.

Prüfung: npm run lint · npm test (betroffene Suites). Nicht ausführbar → im PR begründen.

PR-Text: geänderte Dateien · wiederverwendete Strukturen · live · preview · coming soon · Checks.

## Auftrag

Befund: /app/dashboard (DashboardRouter → CommandCenterDashboard, echte RPCs) konkurriert mit
u. a. /app/intelligence (DashboardView), /app/cockpit (CeoCockpitView), /app/mein-geschaeft
(SmbDashboardView), /dashboard/business, /dashboard/audit, /dashboard/agents und
/dashboard/enterprise-ai-os (EnterpriseAiOsDashboard, Mock, ohne AppGate).

Ziel: /app/dashboard ist das einzige Kunden-Dashboard. Alles andere ist ein Modul darin,
eine Fachseite mit klarem Zweck oder ein Redirect.

Aufgaben:
1. Inventar-Tabelle im PR: Route · Komponente · Datenquelle (RPC/Mock) · Guard · Entscheidung
   (behalten als Fachseite / Modul im Command Center / Redirect / löschen).
2. Redirects (<Navigate replace> auf /app/dashboard) für reine Dashboard-Dubletten.
   /app/cockpit/brief (Druckansicht) bleibt.
3. /dashboard/enterprise-ai-os(+/discovery): Mock entfernen; Route auf /app/dashboard umleiten.
   EnterpriseAiOsDashboard.tsx nur löschen, wenn nichts mehr importiert.
4. /dashboard/business, /dashboard/audit, /dashboard/agents: entweder hinter AppGate
   oder Redirect — kein Kunden-Dashboard ohne Router-Guard (Teil von M7).
5. Navigation (GovernanceBrowserShell) zeigt nur noch einen Dashboard-Eintrag.

Nicht tun: /admin/* umbauen (eigenes WP mit Rollenprüfung), neue KPIs, RPC/Migration.

Akzeptanz:
- Keine Mock-Daten in einer Route unter /app/* oder /dashboard/*
- Alle stillgelegten Routen leiten um (Test je Route)
- npm run build, npm run lint, npm test, check:fabrication grün
