---
description: WP4 Command Center: Inventar, Agenten, Freigaben, Evidence
---

# WP4 — Command Center: Inventar · Agenten · Freigaben · Evidence

**Voraussetzung:** WP5 gemerged (Register-Quelle), WP3 gemerged (aiSetup) · **Branch:** `feat/wp4-command-center-os-tiles`

## Rahmen (gilt für jede WP-Session)

Repository: realsyncdynamics-spec/RealSyncDynamics.AI
Lies zuerst: CLAUDE.md, .claude/os-funnel/PLAN.md (§1 Ist-Befund, §5 Leitplanken).

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

Ziel: /app/dashboard bleibt die eine Hauptfläche. Es bekommt eine Kachelreihe
„Mandant · Policy · Risiko · Freigabe · Evidence", die das OS sichtbar macht.
Kein zweites Dashboard.

Bestand:
- src/features/governance/dashboard/CommandCenterDashboard.tsx
  (TrialBanner → HandoffOverview → BrowserRuntimePanel → ComplianceStatusView → DashboardExecuteStrip)
- src/features/governance/cockpit/cockpitData.ts (score, riskIndex, evidenceHealth,
  actions, summary24h, recentEvents — echte RPCs)
- src/features/ai-governance/useAiGovernanceData.ts (ai_systems)
- src/features/governance/aiActRiskInventoryApi.ts (ai_act_risk_inventory)
- src/features/governance/approvalsApi.ts (governance_approvals)
- src/features/activation/activationApi.ts (organization.aiSetup aus WP3)
- Agent-Register-Quelle aus WP5

Aufgaben:
1. Eine Komponente OsControlStrip.tsx im dashboard-Ordner, eingehängt direkt nach
   HandoffOverview. Fünf Kacheln:
   - KI-Inventar: Anzahl ai_systems des Mandanten; 0 → Empty State mit Link
     /app/activation
   - Bot-/Agent-Register: Einträge je Status live/preview/coming-soon aus WP5;
     Link /app/ai-systems/agents
   - Offene Risiken: aus cockpitData.riskIndex (keine neue Abfrage)
   - Wartende Freigaben: governance_approvals mit offenem Status; Tabelle leer
     → „Keine Freigaben offen", nicht „0 %"
   - Evidence-Status: aus cockpitData.evidenceHealth
2. Jede Kachel: Quelle im Code dokumentiert; Fehler einer Quelle blockiert die
   anderen nicht (allSettled-Muster wie cockpitData).
3. Copy: „Command Center"; Nächste Maßnahmen bleiben menschlich ausgelöst
   (NextBestActionCard), keine Auto-Ausführung.

Nicht tun: neue RPC/Migration, Zahlen schätzen, Demo-Daten im Mandanten-Dashboard.

Akzeptanz:
- Frischer Mandant ohne Daten sieht fünf ehrliche Empty States
- Mandant mit Daten sieht echte Zahlen, jede auf eine Quelle rückführbar
- Unit-Tests für Empty/Fehler/Daten-Zustand je Kachel
- npm run lint, npm test grün
