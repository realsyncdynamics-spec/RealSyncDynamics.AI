# Agent-Register

Kontrollierte Sicht auf alle Governance-Agenten.

## Was ist das?

Ein **Register** im Sinne einer Governance-Disziplin: jeder Agent wird mit Typ, Status, Risiko-Level, erlaubten Werkzeugen, ausdrücklich **verbotenen** Aktionen und zwingenden Human-Review-Punkten dokumentiert.

Phase A (dieser PR): reine **Anzeige**. Der View **führt keine Agenten aus**.

Spätere Phasen: Die Runtime-Ausführung (n8n, Edge-Functions) liest dieselbe Datenstruktur (`GovernanceAgent`) und ist an die hier dokumentierten Restriktionen gebunden — `restrictedActions` und `requiresHumanReview` werden als Constraints in den Runtime-Loop einprogrammiert.

## Warum brauchen Agenten Permissions?

Agentic AI ist eine **neue** Compliance-Disziplin. Aktuelle Forschung (u. a. EU-Kommissionsstudien) macht klar, dass Unternehmen künftig nachweisen müssen, welche Werkzeuge ein Agent benutzt, welche Daten er sehen darf und welche Systeme er verändern darf.

Konsequenz: Jeder Agent hat eine **expliziter Whitelist** (`tools`, `permissions`). Wer nicht in der Whitelist steht, ist verboten — Default-Deny.

## Warum gibt es `restrictedActions`?

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

## Initial-Set (6 Agenten)

Quelle: `src/features/governance/agents/demoAgents.ts`

| Agent | Typ | Risk | Status (Default) |
|---|---|---|---|
| Website Drift Agent | detection | medium | active |
| AI Risk Agent | classification | high | review_required |
| Evidence Agent | evidence | low | active |
| Policy Agent | policy | medium | active |
| Triage Agent | triage | low | active |
| Developer Remediation Agent | remediation | high | paused |

## Wie wird die Runtime-Ausführung angebunden?

Plan (nicht Teil dieses PRs):

1. **Tabelle** `governance_agents` mit RLS pro Tenant.
2. **Edge Function** `agent-execute`, die einen Agent-Lauf triggert:
   - Lädt den Agent-Record
   - Validiert das geplante Tool gegen `tools[]`
   - Validiert die geplante Aktion **nicht** in `restrictedActions[]`
   - Lädt die Run-Daten, prüft ob `requiresHumanReview`-Punkte getroffen sind → wenn ja, pausiert und legt einen `approvals`-Eintrag an
   - Schreibt jeden Schritt in den Evidence Vault
3. **Approval-View** (existiert bereits unter `/governance/approvals`) zeigt offene Reviews
4. **lastRunAt** wird beim Abschluss aktualisiert

## Route

`/governance/agents` (lazy-loaded, siehe `src/App.tsx`)
