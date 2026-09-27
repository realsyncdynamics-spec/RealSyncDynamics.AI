# Agent-Register

Kontrollierte Sicht auf alle Governance-Agenten.

## Was ist das?

Ein **Register** im Sinne einer Governance-Disziplin: jeder Agent wird mit Typ, Status, Risiko-Level, erlaubten Werkzeugen, ausdrücklich **verbotenen** Aktionen und zwingenden Human-Review-Punkten dokumentiert.

Phase A (dieser PR): reine **Anzeige**. Der View **führt keine Agenten aus**.

Spätere Phasen: Die Runtime-Ausführung (n8n, Edge-Functions) liest dieselbe Datenstruktur (`GovernedAgentEntry`) und ist an die hier dokumentierten Restriktionen gebunden — `forbiddenActions` und `reviewPoints` werden als Constraints in den Runtime-Loop einprogrammiert.

## Warum brauchen Agenten Permissions?

Agentic AI ist eine **neue** Compliance-Disziplin. Aktuelle Forschung (u. a. EU-Kommissionsstudien) macht klar, dass Unternehmen künftig nachweisen müssen, welche Werkzeuge ein Agent benutzt, welche Daten er sehen darf und welche Systeme er verändern darf.

Konsequenz: Jeder Agent hat eine **expliziter Whitelist** (`tools`, `permissions`). Wer nicht in der Whitelist steht, ist verboten — Default-Deny.

## Warum gibt es `forbiddenActions`?

Whitelist + Restricted-List ist Redundanz mit Absicht. Die Whitelist sagt „darf X". Die Restricted-List sagt „darf NIE Y" — auch dann nicht, wenn Y „in der Nähe" eines erlaubten Tools liegt. Beispiele:

- **Evidence Agent** darf evidence schreiben — aber **NIE** historische evidence manipulieren
- **Remediation Agent** darf PRs entwerfen — aber **NIE** Merges ausführen oder Deploys triggern
- **AI Risk Agent** darf klassifizieren — aber **NIE** an Aufsichtsbehörden melden

## Warum ist Human Review Pflicht?

Aus dem Direktiv: **keine automatische Rechtsfreigabe**. Konkret:
- Risiko-Einstufungen als `high_risk` oder `prohibited` → Review erforderlich
- Policy-Änderungen vor Publish → Review erforderlich
- Evidence-Export an externe Dritte → Review erforderlich
- Jeder Code-PR vor Merge → Review erforderlich (Developer Remediation Agent)

`requiresHumanReview` ist pro Agent eine Liste mit Trigger-Punkten — kein freier Text, sondern feste Schritte, die der Runtime-Loop erkennt und vor Ausführung pausiert.

## Katalog (WP5, 2026-09-27)

Quelle: `src/features/governance/agents/agentCatalog.ts` (`AGENT_CATALOG`, Typ `GovernedAgentEntry`).
Genutzt von `/app/ai-systems/agents` und `/governance-browser`.

Reifegrad wird **abgeleitet**, nie gesetzt: Mesh-Agenten aus `AGENT_MESH`,
übrige aus `src/product/implementation-status.ts`, ohne Beleg `coming-soon`.
Ausführbar (`runnable`) ist nur, was `AGENT_MESH` als Preview-Lauf belegt.

| Eintrag | Art | Statusquelle |
|---|---|---|
| Compliance Agent | Agent | `agentMesh:compliance` |
| Evidence / Security / Onboarding Agent | Agent | `agentMesh:*` |
| Website Chatbot · Voice Bot · WhatsApp Bot | Bot | `implementation-status:channel-bots` |
| Browser Agent | Agent | `implementation-status:agent-os-chrome-side-panel` |
| Builder Agent | Agent | `implementation-status:web-builder` |
| Workflow Agent | Agent | keine → `coming-soon` |

Browser- und Builder-Agent tragen fest `publish_without_approval`,
`submit_forms`, `trigger_purchase`, `transfer_customer_data` als verbotene
Aktionen und `reviewMode: 'always'` (Test: `test/governance/agentRegistry.test.ts`).

Abgelöst: `demoAgents.ts` (`DEMO_AGENTS`, Status „active") und der Typ
`GovernanceAgent`; `AgentPeekPanel` war unbenutzt und ist entfallen.

## Wie wird die Runtime-Ausführung angebunden?

Plan (nicht Teil dieses PRs):

1. **Mandanten-Tabelle** mit RLS pro Tenant, die Katalog-Einträge (`GovernedAgentEntry.id`)
   einem Mandanten zuordnet — Migration, separates GO. `governance_agent_registry`
   (Migration `20260817000000`) trägt die nötigen Felder heute nicht.
2. **Edge Function** `agent-execute`, die einen Agent-Lauf triggert:
   - Lädt den Katalog-Eintrag und die Mandanten-Zuordnung
   - Validiert die geplante Aktion gegen `allowedActions[]` (Default-Deny)
   - Lehnt jede Aktion aus `forbiddenActions[]` ab
   - `reviewMode: 'always'` oder ein getroffener `reviewPoints`-Punkt → pausiert und legt
     einen Eintrag in `governance_approvals` an
   - Schreibt Nachweise gemäß `evidenceRequirement` in den Evidence Vault
3. **Lauf-Datensatz** (eigenes Modell, nicht Teil von `GovernedAgentEntry`): Start, Ende,
   Ergebnis, Evidence-Referenzen — der Katalog selbst kennt keine Läufe.
4. **Approval-View** (existiert bereits unter `/governance/approvals`) zeigt offene Reviews

## Route

`/app/ai-systems/agents` (lazy-loaded, siehe `src/App.tsx`); öffentliche Vorschau des Katalogs unter `/governance-browser`
