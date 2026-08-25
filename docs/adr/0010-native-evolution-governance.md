# ADR 0010 — Native Evolution Governance Gate

**Status:** Accepted  
**Date:** 2026-08-25  
**Author:** Dominik Steiner (Architecture / Agent OS)  
**Supersedes / amends:** none  
**Related:** CLAUDE.md (Projektkontext), `docs/architecture/`, `apps/mcp-server/`, `apps/agent-runtime/`, zukünftige Evolution-Tools (Headroom, Claude Code Setup, Task Observer, Claude-Mem)

## Context

RealSyncDynamics.AI ist eine EU-souveräne AI-Governance-Runtime. Das Repository wird aktiv mit Claude Code und weiteren Agenten-Werkzeugen entwickelt. Es existieren bereits eigene Governance-Bausteine (`apps/mcp-server`, `apps/agent-runtime`, Evidence-Vault, Policy-Engine).

Gleichzeitig stehen externe Evolution-Tools zur Verfügung (Context-Compression, Repo-Analyse, Skill-Discovery, Session-Memory). Diese Tools können Entwicklungsgeschwindigkeit erhöhen, bergen aber das Risiko unkontrollierter Selbstveränderung:

- Direkte Schreibzugriffe auf `CLAUDE.md`, Skills, MCP-Konfigurationen oder Governance-Regeln
- Ungeprüfte Änderungen an produktionsrelevanten Pfaden
- Fehlende Auditierbarkeit und fehlender Rollback-Pfad
- Verletzung der eigenen Anforderungen an Nachweisbarkeit und Kontrollierbarkeit

Ohne eine harte, versionierte Architekturentscheidung würden Evolution-Tools ad-hoc und inkonsistent eingesetzt. Das widerspricht dem Kernversprechen der Plattform: kontrollierte, auditierbare Governance.

Die Entscheidung muss vor der Aufnahme jeglicher Evolution-Tools getroffen werden.

## Decision

Wir etablieren eine **native Evolution Governance Pipeline** als verbindliche Architekturregel:

```
Observe → Analyze → Proposal → Governance Review → Human Approval → Versioned Change → Audit Evidence
```

### Unveränderliche Prinzipien

1. **Observation is read-only**  
   Evolution-Tools dürfen den Systemzustand und Session-Verhalten beobachten. Sie dürfen keine Dateien, Policies, Skills, MCP-Konfigurationen oder Runtime-Zustände verändern.

2. **Analysis produces no side effects**  
   Analyse-Schritte erzeugen ausschließlich strukturierte Outputs (Statistiken, Muster, Empfehlungen). Keine Schreibzugriffe.

3. **Proposals are data, not changes**  
   Jeder Verbesserungsvorschlag ist ein Artefakt (Markdown/JSON). Er enthält Beschreibung, Begründung, betroffene Bereiche, Risiko-Einschätzung und Review-Kriterien. Ein Proposal ist niemals selbst eine Änderung.

4. **Only the Governance Gate may authorize change**  
   Kein Evolution-Tool erhält direkten Schreibzugriff auf governance-kritische Bereiche, insbesondere:
   - `CLAUDE.md`
   - `.claude/` (Skills, Hooks, Rules, Settings)
   - `apps/mcp-server/`
   - `apps/agent-runtime/`
   - Governance-, Policy- und Evidence-relevante Pfade
   - `supabase/functions/`, `supabase/migrations/`
   - Produktions-Skills und Control-Definitionen

5. **Approved changes must be versioned**  
   Freigegebene Änderungen erfolgen ausschließlich über versionierte Commits (mit referenzierbarer Proposal-ID).

6. **Every change produces Audit Evidence**  
   Jede freigegebene Änderung erzeugt einen nachweisbaren Eintrag im Evidence-/Audit-Trail (Wer, Was, Wann, welcher Proposal, betroffene Artefakte).

7. **No Evolution Tool receives direct write access to governance-critical areas**  
   Headroom, Claude Code Setup, Task Observer, Claude-Mem und vergleichbare Werkzeuge operieren ausschließlich im Evolution Path.

8. **Rollback must always be possible**  
   Jede freigegebene Änderung muss reversibel sein.

### Geltungsbereich

Diese Regel gilt für alle externen und internen Evolution-Mechanismen, die aus Beobachtung oder Analyse heraus Systemänderungen vorschlagen oder durchführen könnten. Sie ist Teil der Agent-OS-Architektur und nicht optional.

## Begründung

1. **Konsistenz mit dem Produktversprechen**  
   Eine Plattform, die Governance und Auditierbarkeit in den Mittelpunkt stellt, darf ihre eigene Evolution nicht unkontrolliert ablaufen lassen.

2. **Schutz der bestehenden Governance-Bausteine**  
   `apps/mcp-server` und `apps/agent-runtime` sind bereits als kontrollierte Surfaces konzipiert. Externe Tools dürfen diese Surfaces nicht unterlaufen.

3. **Unterstützung von Nachweisbarkeit und Kontrollierbarkeit**  
   Jede systemrelevante Änderung muss nachvollziehbar und reversibel sein. Die Pipeline erzwingt Evidence und Versionierung und unterstützt damit die Anforderungen an Nachweisbarkeit, Governance und Kontrollierbarkeit.

4. **Klare Trennung Production Path vs. Evolution Path**  
   Die Runtime bleibt immutable/audited. Evolution-Tools bleiben developer-only und produce nur Proposals.

5. **Zukunftssicherheit**  
   Neue Tools können gegen dieselbe Regel geprüft und aufgenommen werden, ohne die Architektur jedes Mal neu zu verhandeln.

## Consequences

### Positive

- Klare Sicherheitsgrenze vor der Aufnahme von Headroom, Claude Code Setup, Task Observer und Claude-Mem.
- Evolution bleibt möglich, aber immer kontrolliert und nachweisbar.
- CLAUDE.md und Skills bleiben geschützt.
- Rollback- und Audit-Anforderungen sind von Anfang an erfüllt.
- Die Regel selbst ist versioniert und referenzierbar.

### Negative / accepted trade-offs

- Höherer Prozessaufwand bei Skill- oder Architektur-Verbesserungen (Proposal + Review + Approval statt direkter Änderung).
- Evolution-Tools können nicht „selbstständig“ produktiv werden.
- Human-in-the-loop bleibt Pflicht für alle freigegebenen Änderungen.

Diese Trade-offs sind bewusst akzeptiert.

## Alternatives considered

### A. Evolution-Tools mit direktem Schreibzugriff (unter Beobachtung)

Abgelehnt. Widerspricht dem Governance-Anspruch und macht Auditierbarkeit und Rollback schwer bis unmöglich.

### B. Vollständiger Verzicht auf Evolution-Tools

Abgelehnt. Context-Compression, Architektur-Scanning und kontrollierte Skill-Discovery haben klaren Nutzen. Die Pipeline erlaubt den Nutzen ohne den Kontrollverlust.

### C. Tool-spezifische Ad-hoc-Regeln

Abgelehnt. Führt zu inkonsistenten Grenzen und erschwert spätere Erweiterung.

## Implementation notes (non-binding)

- Diese ADR ist die Schranke. Keine Produktions- oder Runtime-Code-Änderung wird mit diesem ADR ausgeliefert.
- Nächster Schritt nach Acceptance: Referenz in `CLAUDE.md` verankern.
- Danach: Headroom ausschließlich als MCP-only, read-only Evaluation gegen diese Policy.
- Proposals und spätere freigegebene Änderungen sollen die ADR-Nummer und eine Proposal-ID referenzieren.

## Acceptance

Dieses ADR ist **Accepted**.  
Es wurde nach Review und ausdrücklicher Zustimmung akzeptiert. Der Statuswechsel erfolgt in einem separaten versionierten Commit nach dem Merge des ursprünglichen Proposed-PRs.

Keine Code- oder Runtime-Änderung ist Teil dieses ADRs.
