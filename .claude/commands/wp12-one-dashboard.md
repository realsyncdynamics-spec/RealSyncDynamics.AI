---
description: WP12 Ein Kunden-Dashboard: Command Center, übrige als Tabs oder Redirect (M2)
---

# WP12 — Ein Dashboard

**Voraussetzung:** Owner-Entscheid „Welche Dashboards stillgelegt werden" (Masterplan §9) · WP4 gemerged · **Masterplan:** §3 M2 · **Branch:** `feat/wp12-one-dashboard`

## Rahmen (gilt für jede WP-Session)

Repository: realsyncdynamics-spec/RealSyncDynamics.AI
Lies zuerst: CLAUDE.md, docs/strategy/MASTERPLAN_2026-2027.md (nur den genannten Abschnitt),
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

Befund: /app/dashboard (DashboardRouter → CommandCenterDashboard, echte RPCs
governance_kpi_*, governance_24h_summary) konkurriert mit ca. 12 weiteren Flächen, u. a.:
- /app/intelligence (DashboardView), /app/cockpit (CeoCockpitView), /app/mein-geschaeft (SmbDashboardView)
- /dashboard/enterprise-ai-os (src/pages/EnterpriseAiOsDashboard.tsx, Mock), /dashboard/business,
  /dashboard/audit, /dashboard/agents (ohne AppGate)

Ziel: /app/dashboard ist das einzige Kunden-Dashboard. Alles andere ist Tab/Modul darin oder Redirect.

Aufgaben:
1. Inventar-Tabelle im PR: Route · Komponente · Datenquelle (RPC/Mock) · Entscheidung
   (Tab | Redirect | bleibt Admin). Entscheidung nur gemäß Owner-Freigabe.
2. Tabs im Command Center (bestehende Tab-/Panel-Struktur nutzen, kein neues Layout):
   echte Inhalte aus Cockpit/Intelligence als Module, wenn sie echte Daten haben. Sonst Redirect.
3. Redirects per `<Navigate replace>`: /app/intelligence, /app/cockpit, /app/mein-geschaeft
   → /app/dashboard (ggf. ?tab=…). /app/cockpit/brief (Print) bleibt, falls genutzt.
4. Mock-Dashboards entfernen: EnterpriseAiOsDashboard + Discovery, wenn nichts Echtes daran hängt.
   Route → Redirect auf /app/dashboard oder /design/* (noindex).
5. /dashboard/*-Routen ohne AppGate: entweder Redirect oder in AppGate legen (Abgleich mit M7).
6. Sidebar/Navigation: nur noch ein Dashboard-Eintrag.

Nicht tun: KPIs erfinden, neue RPCs, Admin-Dashboards (/admin/*) umbauen, Design-Tokens ändern.

Akzeptanz:
- Genau ein Dashboard-Eintrag in der Kunden-Navigation
- Alle stillgelegten Routen leiten um (Route-Test)
- Kein Import mehr auf entfernte Mock-Dateien (`npm run build` grün, check:fabrication grün)
- npm run lint, npm test grün
