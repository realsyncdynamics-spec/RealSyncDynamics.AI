---
description: WP5 Ein Agent-/Bot-Register mit ehrlichem Status
---

# WP5 — Ein Agent-/Bot-Register

**Voraussetzung:** keine · **Branch:** `feat/wp5-agent-registry-single-source`

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

Befund: Agenten stehen in vier Quellen.
- src/core/realsync-os/agentMesh.ts — AGENT_MESH, ehrlich (nur Compliance preview-runnable)
- src/features/governance/agents/demoAgents.ts — DEMO_AGENTS, 4 × status 'active';
  AgentRegistryView zählt sie als „Aktiv" → Overclaim, auch mit Demo-Hinweis
- src/features/governance/agents/AgentsCenterView.tsx — Skills-Sicht
- DB governance_agent_registry (status active|archived|deprecated) — nicht angebunden

Ziel: Eine typisierte Register-Quelle für die UI. Bots und Agenten als
kontrollierte OS-Objekte. Status bleibt ehrlich.

Aufgaben:
1. Typ GovernedAgentEntry in src/features/governance/agents/types.ts:
   id, kind ('agent'|'bot'), agentType, name, owner (Rolle), purpose,
   dataAccess[], allowedActions[], forbiddenActions[],
   reviewMode ('always'|'on_risk'|'none'), riskLevel,
   evidenceRequirement ('every_action'|'on_decision'|'none'),
   maturity: ImplementationStatus (live|preview|coming-soon), runnable: boolean.
   Bestehende Felder von GovernanceAgent (restrictedActions, requiresHumanReview,
   ownerRole) mappen, nicht verdoppeln.
2. Einträge (Katalog, kein Mandanten-Datenbestand):
   Compliance Agent (preview, runnable), Evidence Agent, Security Agent,
   Onboarding Agent, Website Chatbot, Voice Bot, WhatsApp Bot, Browser Agent,
   Builder Agent, Workflow Agent — alle außer Compliance coming-soon, sofern
   implementation-status.ts nichts anderes belegt.
   maturity für Mesh-Agenten AUS AGENT_MESH ableiten, nicht neu setzen.
3. Browser Agent und Builder Agent: forbiddenActions enthält fest
   publish_without_approval, submit_forms, trigger_purchase, transfer_customer_data;
   reviewMode 'always'. Unit-Test sichert das ab.
4. AgentRegistryView: Zähler nach maturity (Live/Preview/Coming Soon) statt
   „Aktiv/Pausiert"; Karte zeigt Owner, Zweck, Datenzugriff, erlaubt/verboten,
   Review-Modus, Risiko, Evidence-Anforderung. Keine Status-Hochstufung.
5. DEMO_AGENTS: entweder in den Katalog überführen oder löschen, wenn nichts mehr
   importiert. Abgelöstes im PR benennen.

Nicht tun: DB-Anbindung an governance_agent_registry (braucht Schema-Erweiterung
= Migration = separates GO), Agenten ausführbar machen.

Akzeptanz:
- Genau eine Register-Quelle für AgentRegistryView und (später) WP4
- Kein Eintrag „live" ohne Beleg in implementation-status.ts
- Test: Browser/Builder-Verbote; Test: maturity == AGENT_MESH für gemeinsame IDs
- npm run lint, npm test grün
