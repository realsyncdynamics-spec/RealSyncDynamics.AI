import { ContentPageLayout, H2, P, UL } from './ContentPageLayout';

export function GovernanceGraphPage() {
  return (
    <ContentPageLayout
      eyebrow="Governance Graph"
      title="Beziehungen statt Findings."
      description="Der Governance Graph verbindet Websites, KI-Systeme, Vendors, Policies und Evidence zu einem konsistenten Modell — der eigentliche Burggraben."
      intro="Die meisten Compliance-Tools liefern Findings: einen Tracker, eine offene DPIA, einen abgelaufenen DPA. Was fehlt, ist der Kontext — welcher KI-Usecase nutzt den Tracker, welche Regulation greift, welches Evidence-Pack belegt die Maßnahme. Genau diese Beziehungs-Schicht ist der Governance Graph. Sie macht aus einem Befund einen nachvollziehbaren Pfad."
      related={[
        { to: '/ai-act-governance', label: 'AI Act Governance →' },
        { to: '/agent-governance', label: 'Agent Governance →' },
        { to: '/evidence-vault', label: 'Evidence Vault →' },
        { to: '/policy-engine', label: 'Policy Engine →' },
      ]}
    >
      <H2>Entitäten</H2>
      <P>
        Der Graph speichert 22 Entitätstypen: <em>Tenant, User, Website, Page, Script, Cookie,
        Tracker, Vendor, AiUsecase, Model, Dataset, Prompt, Agent, Policy, Control, Regulation,
        Risk, Evidence, Workflow, Deployment, ApiEndpoint, CloudResource</em>. Jede Entität trägt
        <code> tenant_id</code> als Partition-Key — Cross-Tenant-Traversal ist nur mit einer
        explizit auditbaren <code>cross_tenant_admin</code>-Rolle möglich.
      </P>

      <H2>Beziehungen, die zählen</H2>
      <UL>
        <li><code>(:Page)-[:LOADS]-&gt;(:Script)</code> und <code>(:Script)-[:SERVED_BY]-&gt;(:Vendor)</code> ergeben den vollen Tracking-Pfad einer Seite.</li>
        <li><code>(:AiUsecase)-[:USES_MODEL]-&gt;(:Model)</code> und <code>(:AiUsecase)-[:CONSUMES_DATASET]-&gt;(:Dataset)</code> ergeben die Abhängigkeitskette einer KI-Anwendung.</li>
        <li><code>(:AiUsecase)-[:GOVERNED_BY]-&gt;(:Policy)-[:IMPLEMENTS]-&gt;(:Control)-[:REQUIRED_BY]-&gt;(:Regulation)</code> ist der Pflicht-Pfad: vom konkreten System bis zur Rechtsgrundlage.</li>
        <li><code>(:Evidence)-[:PROVES]-&gt;(:Control)</code> verknüpft Belege mit dem, was sie belegen sollen.</li>
      </UL>

      <H2>Drei Anfragen, die ein Audit-Tool nicht beantworten kann</H2>
      <P>
        <strong>Blast-Radius:</strong> "Was bricht, wenn Vendor X seinen Adequacy-Status verliert?" —
        eine Traversierung von <code>:Vendor</code> rückwärts über <code>:SERVED_BY</code>,
        <code>:USES_VENDOR</code> liefert die betroffenen Websites + Usecases in einer Query.
      </P>
      <P>
        <strong>Compliance-Lineage:</strong> "Welche Evidence belegt Art. 13 für Usecase Y?" —
        Pfad von <code>:AiUsecase</code> über <code>:GOVERNED_BY</code>, <code>:IMPLEMENTS</code>,
        <code>:PROVES</code> auf die Evidence-Records mit ihren Hashes und Sealed-Timestamps.
      </P>
      <P>
        <strong>Shadow AI:</strong> "Welche Usecases sind deployed, haben aber keine Policy?" —
        eine NOT-EXISTS-Cypher-Query findet die Lücken, bevor der Auditor sie findet.
      </P>

      <H2>Tech-Choice: Postgres + Apache AGE</H2>
      <P>
        Der Graph läuft nicht in Neo4j oder Neptune, sondern als Apache-AGE-Extension auf demselben
        Postgres, der auch Relationen, RLS und Audit-Log hält. Drei Gründe: ein transaktionaler
        Store für relationale und Graph-Daten, native RLS für Tenant-Isolation, ein
        Backup-Restore-Pfad statt zwei. Die Skalierungsgrenze (≥10⁸ Edges) wird durch die
        Implementierungs-Roadmap überwacht; ab dort kommt ein per-Tenant-Mirror in Neptune dazu.
      </P>

      <H2>Wie die Daten in den Graph kommen</H2>
      <P>
        Direkt schreiben in den Graph dürfen nur Service-Role-Connections. Telemetrie-Events
        landen über den Graph-Projector — eine idempotente Pipeline, die das Kafka-Topic
        <code>telemetry.events</code> liest, dedupliziert, rate-limitiert und schließlich
        Apache-AGE-Upserts ausführt. Replays des Topics ergeben deterministisch denselben
        Graph-State; das ist eine harte Invariante, keine Option.
      </P>

      <H2>Was Agents sehen dürfen</H2>
      <P>
        Agenten lesen den Graph über eine Cypher-über-HTTP-API mit drei Guards: Tenant-Scope wird
        in jede Query injiziert, Traversal-Tiefe ist auf 5 Hops gecapped (außer für
        <code>auditor</code>-Agents), Result-Sets sind auf 1000 Zeilen gecapped. Schreiben dürfen
        Agenten nur über <code>graph.propose</code> — der Proposal landet in einer Pending-Queue
        und braucht entweder einen Higher-Trust-Agent oder einen Menschen, der bestätigt.
      </P>
    </ContentPageLayout>
  );
}
