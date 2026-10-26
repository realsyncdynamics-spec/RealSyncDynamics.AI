---
description: WP13 Agenten-Lebenszyklus Erfassen → Klassifizieren → Freigeben → Ausführen → Nachweisen (M5)
---

# WP13 — Ein Agenten-Register mit Lebenszyklus

**Voraussetzung:** WP5 gemerged (eine Register-Quelle), WP9 gemerged (Evidence) · **Masterplan:** §3 M5 · **Branch:** `feat/wp13-agent-lifecycle`

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

Befund: 6 Agenten-Oberflächen, 5 Datenquellen (agent_*, autonomous_agents, bots, Katalog, Demo).
- /app/ai-systems/agents (AgentRegistryView) — Register, ehrlicher Status
- /app/agents (GovernanceAgentsCenterView) + /app/agents/{automation,support,susi,screenshot}
- /app/bots/* (BotsView, BotBuilderView, BotInboxView, WhatsAppChannelsView)
- /dashboard/agents (AgentOsAdminPage), öffentliche /agents (src/pages/AgentsPage.tsx, komplett demo)
- src/features/agents/AgentsView.tsx — toter Code
- kein Freigabeschritt bei Registrierung; governance_approvals existiert (src/features/governance/approvalsApi.ts)

Ziel: Ein Register (/app/ai-systems/agents), ein Lebenszyklus
`Erfassen → Klassifizieren (AI Act) → Freigeben → Ausführen → Nachweisen`.
/app/agents und /app/bots werden Ausführungs-Tabs desselben Registers.

Aufgaben:
1. Lebenszyklus-Typ `AgentLifecycleState` in src/features/governance/agents/types.ts
   (draft | classified | approval_pending | approved | rejected | retired), getrennt von maturity.
2. Register-Detail zeigt Zustand + nächsten Schritt. Klassifizieren nutzt den vorhandenen
   AI-Act-Klassifizierer (nur aufrufen, nicht umbauen).
3. Freigeben: Request über approvalsApi.ts → governance_approvals. Ausführen nur bei approved
   (UI-Guard; serverseitige Durchsetzung als offener Punkt im PR, falls Function-Änderung nötig).
4. Nachweisen: Run-Ansicht verlinkt die Evidence-Einträge aus WP9 (request_id/correlation).
5. /app/agents und /app/bots als Tabs im Register-Layout, alte Einstiege per Redirect.
   /dashboard/agents → Redirect oder AppGate (mit M7 abgleichen).
6. Öffentliche /agents: Status aus implementation-status.ts statt Demo (M8).
7. AgentsView.tsx löschen, wenn nichts importiert.

Nicht tun: Migration für Lebenszyklus-Spalten anlegen (Vorschlag im PR → Owner-GO),
Agenten echt ausführen, neue Agenten hinzufügen, Status hochstufen.

Akzeptanz:
- Test: Ausführen-Button deaktiviert, solange nicht approved
- Test: Ablehnung (rejected) blockiert Ausführung und erzeugt Approval-Eintrag
- Keine Demo-Agenten als „aktiv" auf /agents (check:landing-claims, check:fabrication grün)
- npm run lint, npm test, npm run build grün
