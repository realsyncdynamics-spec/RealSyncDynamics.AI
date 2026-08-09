# Enterprise-AI-OS: Agentensystem

Referenz für das Enterprise-Agenten-System — die acht Governance-Agenten, ihr
Zusammenspiel, der Ausführungs-, Persistierungs- und Abrechnungspfad sowie die
Oberfläche unter `/app/agents` („Enterprise Skills").

Stand: 2026-07 · Code: `src/lib/enterprise-ai-os/agents/`,
`src/features/governance/agents/`, `supabase/functions/enterprise-ai-os-*`.

## Überblick

Das System stellt spezialisierte, EU-souveräne Governance-Agenten bereit. Jeder
Agent ist deterministisch, prüfpfad-pflichtig und über eine typsichere Registry
definiert. Agenten sind entlang eines Ablaufs angeordnet — Entdeckung → Risiko →
Policy → Audit → Intelligenz → Remediation → Orchestrierung → Infrastruktur — und
teilen sich gemeinsame Datenstrukturen (Findings, Empfehlungen, Audit-Events).

## Die acht Agenten

| Agent-ID | Kurzname | Layer | Autonomie | Status | Zweck |
|---|---|---|---|---|---|
| `ai-discovery-agent` | Discovery | discovery | observe_only | aktiv | Erkennt KI-Systeme + Shadow-AI aus Signalen |
| `risk-classification-agent` | Risk | governance | recommend_only | aktiv | Multi-Faktor-Risikoklassifizierung (DSGVO/AI Act) |
| `policy-enforcement-agent` | Policy | policy | human_approval_required | aktiv | Prüft Aktionen gegen Tenant-Policies, blockiert |
| `audit-agent` | Audit | audit | limited_execution | aktiv | Schreibt revisionssichere Audit-Events |
| `feedback-intelligence-agent` | Feedback | intelligence | recommend_only | experimentell | Clustert Feedback, priorisiert Roadmap |
| `remediation-agent` | Remediation | remediation | recommend_only | aktiv | Erstellt risikostufen-spezifische Maßnahmenpläne |
| `workflow-agent` | Workflow | orchestration | human_approval_required | experimentell | Plant Ausführungsphasen für interne Aufgaben |
| `infrastructure-agent` | Infrastructure | infrastructure | limited_execution | aktiv | VPS-Health, Docker, Security, Deploys, DNS, Backups |

**Autonomiestufen** (aufsteigende Eigenständigkeit): `observe_only` →
`recommend_only` → `human_approval_required` → `limited_execution`. Sie steuern,
ob ein Agentenergebnis direkt gilt (`success`), Freigabe braucht
(`requires_approval`) oder blockiert wird (`blocked`).

## Ausführungspfad

```
UI (AgentsCenterView)
  └─ runAgent(agentId, tenantId, payload)          src/features/governance/agents/agentsApi.ts
       └─ POST enterprise-ai-os-agents-run          supabase/functions/…/index.ts
            ├─ Agent-Logik ausführen  → { status, findings, recommendations, auditEvents, metadata }
            ├─ persist → enterprise_agent_runs      (RLS, Audit-Trigger → ai_tool_runs)
            └─ recordUsage(limit.agent_runs_monthly) (nur status !== 'error', Tenant vorhanden)
```

- **Ausführung**: Die Edge Function `enterprise-ai-os-agents-run` validiert die
  Agent-ID gegen die Registry und ruft die agent-spezifische Logik auf.
- **Persistierung**: Jeder Lauf wird in `enterprise_agent_runs` gespeichert
  (Findings, Empfehlungen, Audit-Events, Metadata). Ein DB-Trigger loggt nach
  `ai_tool_runs`.
- **Abrechnung**: Ausgeführte Läufe (`status !== 'error'`) melden ein
  Nutzungs-Event über den geteilten `recordUsage`-Helper. Metering-Fehler
  werden in `metadata` geschluckt — die Abrechnung bricht nie die Antwort.

## Historie & Detail

`enterprise-ai-os-agent-runs-list` liefert vergangene Läufe (Filter nach Tenant,
Agent, Status; Pagination) inklusive `findings`, `recommendations` und
`metadata`. In der UI öffnet ein Klick auf eine Verlaufszeile das vollständige
Ergebnis über `AgentRunOutput` (`runRowToResult` adaptiert die Zeile in die
`AgentRunResult`-Form).

## Oberfläche (`/app/agents`)

| Komponente | Rolle |
|---|---|
| `AgentsCenterView` | Zentrale Ansicht: Agenten-Karten, Kennzahlen, Modals |
| `AgentRunForm` + `agentInputSchemas` | Parameter-Eingabe je Agent (text/textarea/tags/select/boolean) |
| `FeedbackReportsInput` | Strukturierte Report-Zeilen für den Feedback-Agenten |
| `AgentRunOutput` | Lesbare Darstellung eines Laufergebnisses (Status-, Schweregrad-, Prioritäts-Badges) |
| `AgentActivityPanel` | Aktivitätsübersicht |

Kennzahlen im Kopf: Agenten gesamt · aktiv · **Läufe (Monat, abgerechnet)** ·
Läufe gesamt · erfolgreich. Der Monatswert kommt aus `countRunsThisMonth`.

## Abrechnung (Monetarisierung)

Agentenläufe sind **metered** über das Entitlement `limit.agent_runs_monthly`
(Migration `20260721000000_agent_runs_metering.sql`):

- `usage_limits_config.billing_mode = 'metered'`
- Pro-Plan-Kontingente in `product_entitlements`: free 0 · starter/bronze 100 ·
  silver 500 · gold 2000 · business 5000 · enterprise unbegrenzt (−1)
- `stripe-meter-sync` überträgt die monatlichen Totale als Overage an Stripe
- Der Preis pro Lauf ist Stripe-seitig am metered subscription item konfiguriert

Modell: **im Plan enthaltenes Kontingent + metered Overage**, analog zu
`limit.ai_tokens_monthly` / `limit.api_calls_monthly`.

## Datenbank

| Tabelle | Zweck |
|---|---|
| `enterprise_agent_runs` | Lauf-Historie (RLS: Tenant-Isolation, Audit-Trigger) |
| `usage_events` / `usage_totals` | Nutzungs-Log + aggregierter Monatszähler (Trigger) |
| `usage_limits_config` | Billing-Mode je Entitlement |
| `product_entitlements` | Pro-Plan-Kontingente |

Migrationen: `20260720110000_enterprise_agents_runs.sql` (Historie),
`20260721000000_agent_runs_metering.sql` (Abrechnung).

## Tests

- `test/enterprise-ai-os/agents.test.ts` — Registry + Agent-Logik
- `test/features/governance/agentsApi.test.ts` — Label-Maps + Registry-Konsistenz
- `test/features/governance/agentRunOutput.test.tsx` — Ergebnis-Rendering
- `test/features/governance/agentRunForm.test.tsx` — Parameter-Formular
- `test/features/governance/feedbackReportsInput.test.tsx` — Report-Zeilen
- `test/features/governance/runRowToResult.test.ts` — Verlauf → Detail
- `test/features/governance/countRunsThisMonth.test.ts` — Monats-Zähler
- `test/edge/agent-runs-metering.test.ts` — Migration/Edge-Konsistenz-Contract

## Einen neuen Agenten hinzufügen

1. **Typ**: Agent-ID zu `AgentId` in `agents/types.ts` ergänzen.
2. **Registry**: Definition (Position, Autonomie, Capabilities, erlaubte/
   verbotene Aktionen) in `agents/registry.ts`.
3. **Implementierung**: Klasse in `agents/<name>-agent.ts` (erbt
   `BaseEnterpriseAgent`), plus `case` in `agents/factory.ts`.
4. **Edge**: Ausführungs-Zweig in `enterprise-ai-os-agents-run` ergänzen und die
   ID in die `validAgentIds`-Liste aufnehmen.
5. **UI (optional)**: Eingabe-Schema in `agentInputSchemas.ts`, falls der Agent
   `payload`-Parameter liest.
6. **Tests**: Registry-Count-Test aktualisieren + Agent-Logik-Test ergänzen.
