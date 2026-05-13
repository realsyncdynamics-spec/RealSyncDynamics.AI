import { ContentPageLayout, H2, P, UL } from './ContentPageLayout';

export function AgentGovernancePage() {
  return (
    <ContentPageLayout
      eyebrow="Agent Governance"
      title="Agenten regieren — nicht nur ausführen lassen."
      description="Wie RealSyncDynamics.AI Agenten mit Scope, Permissions, Approval-Gates, Audit-Trails und Risk-Budgets in produktive Workflows einsetzt."
      intro="Eine Agent-Runtime ist nur dann enterprise-tauglich, wenn jede Aktion erklärbar, scoped und revertibel ist. Dieser Hub beschreibt das Governance-Modell, das die Agent-Fleet von RealSyncDynamics.AI ermöglicht — und welche Annahmen drunter liegen."
      related={[
        { to: '/ai-act-governance', label: 'AI Act Governance →' },
        { to: '/governance-graph', label: 'Governance Graph →' },
        { to: '/evidence-vault', label: 'Evidence Vault →' },
        { to: '/policy-engine', label: 'Policy Engine →' },
      ]}
    >
      <H2>Warum Agenten Governance brauchen</H2>
      <P>
        Ein LLM, das Tools aufruft, ist kein Agent — es ist eine Pipeline. Ein Agent ist eine
        Pipeline plus die Erlaubnis, eigenständig zu entscheiden, welcher Tool-Call als Nächstes
        kommt. Genau diese Eigenständigkeit ist der Punkt, an dem Compliance, Audit und
        Risikomanagement andocken müssen. Wer einen Agenten ohne Permission-Scope deployt,
        bekommt einen schnellen ersten Erfolg und einen unhaltbaren Audit-Befund im Quartal danach.
      </P>

      <H2>Sechs Säulen der Agent Governance</H2>
      <UL>
        <li><strong>Tenant-Scope</strong> — jeder Run-Token ist an <code>(tenant_id, agent_id, run_id)</code> gebunden. Cross-Tenant-Reads werden auf DB-Ebene durch RLS verworfen, nicht nur durch App-Logik.</li>
        <li><strong>Permission-Vocabulary</strong> — eine einheitliche Capability-Sprache (<code>graph:read</code>, <code>graph:propose</code>, <code>evidence:write</code>, <code>integration:write:ticket</code>, ...) statt ad-hoc Boolean-Flags pro Agent.</li>
        <li><strong>Approval-Gates</strong> — der Orchestrator suspendiert den Run am Gate, persistiert den Zustand, und resumed auf <em>approved</em>, <em>rejected</em> oder <em>timeout</em>. SLA-Bewachung pro Gate.</li>
        <li><strong>Risk-Budgets</strong> — jeder Run hat Token-, Tool-Call-, Wall-Clock- und Money-Budget. Über-Budget-Runs werden gekillt mit <code>agent.run.budget_exceeded</code> event.</li>
        <li><strong>Trace + Replay</strong> — jeder Step (plan, tool_call, llm_call, proposal, escalation, approval, commit) wird in <code>agent_runs.tool_calls</code> persistiert. SHA-keyed Payloads ermöglichen Replay ohne PII-Re-Materialisierung.</li>
        <li><strong>Meta-Agent</strong> — die Agent-Governance-Agentin beobachtet alle anderen Agents, flaggt Eskalations-Raten, Approval-Quoten und Tool-Call-Loops, und kann individuelle Agents pausieren.</li>
      </UL>

      <H2>Trust-Stufen</H2>
      <P>
        Agenten haben drei mögliche Trust-Stufen. <em>Read-only</em> Agents dürfen lesen und
        vorschlagen — niemals committen. <em>Propose-with-approval</em> Agents dürfen Mutations-PRs
        in den Graph oder in externe Systeme (Jira, GitHub) entwerfen, brauchen aber eine
        menschliche Bestätigung. <em>Auto-commit</em> Agents (bisher nur Evidence-Generation für
        nicht-PII-Inhalte) dürfen ohne Mensch in der Loop committen, aber jede Aktion ist
        signiert und in der Hash-Chain verankert.
      </P>

      <H2>Wenn Agenten miteinander reden</H2>
      <P>
        Agenten können andere Agenten triggern via <code>orchestrator.chain(target_agent, payload)</code>.
        Chains haben eine maximale Tiefe (default 4) und ein Budget von 16 Agent-Runs pro Chain.
        Beispiel-Kette nach einem kritischen Policy-Violation-Event:
      </P>
      <UL>
        <li>Runtime Telemetry Agent erkennt das Event</li>
        <li>→ AI Risk Classification Agent re-klassifiziert die Usecase</li>
        <li>→ Evidence Generation Agent sealed einen Snapshot</li>
        <li>→ Remediation Agent öffnet Jira + Slack-Alert</li>
        <li>→ Workflow Engine startet den Incident-Workflow</li>
      </UL>
      <P>
        Der Meta-Agent beobachtet die Chain. Überschreitet ein Agent sein Tool-Call-Budget, wird
        die ganze Chain pausiert. Der Orchestrator bietet ein UI, in dem der zuständige DPO die
        Chain manuell weiter durchwinken oder abbrechen kann.
      </P>

      <H2>Kill-Switch + Forensik</H2>
      <P>
        Jeder Agent kann individuell von der Plattform-Seite und vom Tenant-Owner pausiert werden.
        Pausierung gilt sofort: bereits laufende Runs werden mit <code>outcome=cancelled</code>
        beendet, neue Trigger landen in der Deferred-Queue. Forensik ist über die Trace persistent:
        Prompt-Hash + Completion-Hash + Tool-Output-Hash lassen sich aus S3 re-materialisieren,
        solange die Retention nicht abgelaufen ist (default 90 Tage, konfigurierbar).
      </P>

      <H2>Was bewusst nicht passiert</H2>
      <P>
        Agenten genehmigen keine Hochrisiko-AI-Systeme. Sie produzieren auch keine
        AVV-Verträge automatisch und schreiben keine DPIA-Inhalte ohne menschlichen Review.
        Diese Trennung ist nicht technisch limitiert, sondern bewusst gesetzt: Rechtsakte
        und Compliance-Entscheidungen müssen von einem identifizierbaren Menschen mit
        Auditspur verantwortet werden.
      </P>
    </ContentPageLayout>
  );
}
