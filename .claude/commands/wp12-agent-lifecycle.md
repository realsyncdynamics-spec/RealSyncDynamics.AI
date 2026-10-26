---
description: WP12 Agenten-Lebenszyklus Erfassen → Freigeben → Ausführen → Nachweisen (Masterplan M5)
---

# WP12 — Agenten-Lebenszyklus

**Voraussetzung:** WP5 gemerged (eine Register-Quelle), WP9 gemerged · **Branch:** `feat/wp12-agent-lifecycle`

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

Befund: 6 Agenten-Oberflächen, 5 Datenquellen — /app/ai-systems/agents (AgentRegistryView),
/app/agents (GovernanceAgentsCenterView, Runs über enterprise-ai-os-agents-run),
/app/agents/{automation,support,susi,screenshot}, /app/bots/*, /dashboard/agents,
öffentliche /agents (AgentsPage, komplett Demo). src/features/agents/AgentsView.tsx ist toter Code.
Agenten können ohne Freigabeschritt registriert werden.

Ziel: Ein Lebenszyklus
`Erfassen → Klassifizieren (AI Act) → Freigeben → Ausführen → Nachweisen`,
/app/ai-systems/agents als einzige Register-Oberfläche, /app/agents und /app/bots als
Ausführungs-Tabs darunter.

Aufgaben:
1. Lebenszyklus-Status als Typ (erfasst · klassifiziert · freigegeben · gesperrt) im
   Register-Typ aus WP5 — abgeleitet aus vorhandenen Daten (Risiko aus ai_act_risk_inventory,
   Freigabe aus governance_approvals). Fehlt eine Quelle: Status „erfasst“, kein Hochstufen.
2. Ausführen-Buttons in /app/agents und /app/bots nur aktiv bei Status „freigegeben“;
   sonst Hinweis mit Link zur Freigabe. Serverseitige Prüfung NICHT im Client vortäuschen —
   fehlt sie in enterprise-ai-os-agents-run, im PR als offene Lücke benennen.
3. Freigabe anfordern über bestehende approvalsApi.ts (governance_approvals), kein neuer Endpoint.
4. Nachweis: Agentenlauf-Evidence aus WP9/ai_evidence_events im Register-Detail verlinken.
5. Öffentliche /agents: Demo-Karten durch Status aus implementation-status.ts ersetzen (M8).
6. AgentsView.tsx löschen, wenn nichts importiert; /dashboard/agents auf
   /app/ai-systems/agents umleiten.

Nicht tun: Agenten ausführbar machen, die heute nicht laufen; Migration; Status hochstufen.

Akzeptanz:
- Nicht freigegebener Agent kann im UI nicht gestartet werden (Unit-Test)
- Kein „live“ ohne Beleg in implementation-status.ts; /agents ohne Demo-Daten
- npm run build, npm run lint, npm test, check:fabrication grün
