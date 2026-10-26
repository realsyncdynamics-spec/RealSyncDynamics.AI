---
description: WP12 Ein Agenten-Register mit Lebenszyklus und ehrlicher Public-Seite (Masterplan M5, M8)
---

# WP12 — Agenten-Lebenszyklus

**Voraussetzung:** WP5 (gemergt, #1658) · **Branch:** `feat/wp12-agent-lifecycle`

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

Befund (26.10.2026): Sechs Agenten-Oberflächen mit eigenen Datenquellen:
`/app/ai-systems/agents` (Register, `agentCatalog.ts`), `/app/agents` (`AgentsCenterView`, Runs über
`enterprise-ai-os-agents-run`), `/app/agents/{automation,support,susi,screenshot}`, `/dashboard/agents`,
`/app/bots/*`, öffentlich `/agents` (`AgentsPage.tsx`, alles hart `status: 'demo'`).
`src/features/agents/AgentsView.tsx` ist nicht geroutet. Für die Registrierung eines Agenten gibt es keinen Freigabeschritt.

Ziel-Lebenszyklus: Erfassen → Klassifizieren (AI Act) → Freigeben (`governance_approvals`) → Ausführen → Nachweisen.

Aufgaben:
1. `/app/ai-systems/agents` ist die einzige Register-Oberfläche. `/app/agents` und `/app/bots` werden dort
   als Tabs „Ausführungen“ und „Bots“ verlinkt, nicht dupliziert.
2. Agent ohne Freigabe kann nicht gestartet werden: Start-Button in `AgentRunForm.tsx` nur aktiv, wenn ein
   genehmigter Eintrag in `governance_approvals` existiert (über `approvalsApi.ts`); sonst „Freigabe anfordern“.
3. `AgentsPage.tsx` (öffentlich): Status aus `src/product/implementation-status.ts` statt `demo`.
4. `AgentsView.tsx` entfernen, wenn nirgends importiert.
5. Tests: Start ohne Freigabe gesperrt; öffentlicher Status stimmt mit implementation-status überein.

Nicht in diesem WP: neue Tabellen, echte Agentenaktionen, Credits (WP-5 Beta-Plan).
