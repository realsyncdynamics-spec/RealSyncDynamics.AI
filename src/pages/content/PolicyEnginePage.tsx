import { ContentPageLayout, H2, H3, P, UL } from './ContentPageLayout';

export function PolicyEnginePage() {
  return (
    <ContentPageLayout
      eyebrow="Policy Engine"
      title="Policy als Code, nicht als PDF."
      description="Zwei Schichten: YAML zur Authoring, Rego zur Execution. Eval-Lifecycle, Multi-Framework-Mapping, Inline-Enforcement für AI-Runtime-SDKs."
      intro="Eine Compliance-Tabelle, die nie ausgeführt wird, ist Theorie. Eine Policy, die bei jedem Event evaluiert wird und ein Decision-Tupel zurückgibt, ist Runtime. Dieser Hub erklärt, wie die Policy Engine in RealSyncDynamics.AI authored, kompiliert und in unter 50ms gegen den Event-Stream evaluiert wird — und warum dieselbe Policy gleichzeitig GDPR, AI Act und ISO 27001 belegen kann."
      related={[
        { to: '/governance-graph', label: 'Governance Graph →' },
        { to: '/evidence-vault', label: 'Evidence Vault →' },
        { to: '/agent-governance', label: 'Agent Governance →' },
        { to: '/ai-act-governance', label: 'AI Act Governance →' },
      ]}
    >
      <H2>Zwei Schichten DSL</H2>
      <P>
        Policies werden in einer YAML-DSL geschrieben, die für Compliance- und Engineering-Teams
        gleichermaßen lesbar bleibt. Beim Save kompiliert die Engine das YAML deterministisch nach
        Rego (OPA), das von einer in-process eingebetteten OPA-Bibliothek evaluiert wird.
        Reviewer:innen sehen beide Seiten in der PR — YAML für die Intention, Rego für die
        Ausführung.
      </P>

      <H3>YAML-Beispiel</H3>
      <P>
        Eine Policy, die Tracking ohne Consent verbietet (TTDSG §25):
      </P>
      <UL>
        <li><strong>id</strong>: policy.tracker_without_consent</li>
        <li><strong>applies_to</strong>: asset_type [website, page]; environment [production]</li>
        <li><strong>when</strong>: event.event_type = scanner.tracker_added</li>
        <li><strong>require</strong>: exists event.event_type = consent.granted within session, category ∈ analytics, marketing</li>
        <li><strong>on_violation</strong>: severity high, action require_approval, capture page_url + script_src + session_id</li>
        <li><strong>references</strong>: TTDSG_25, GDPR_ART_6, GDPR_ART_7</li>
      </UL>

      <H2>Eval-Lifecycle</H2>
      <P>
        Ein Event durchläuft pro Tenant: Telemetry-Collector → Policy-Eval-Queue → in-process OPA
        mit Bundle aus Object Storage (Cache 30s, mtime-Reload) → Policy-Decision persistieren →
        <code>policy.decision.made</code> auf Event-Bus. Downstream konsumiert: Risk-Engine
        adjustiert Asset-Score, Workflow-Engine startet Approval bei <code>require_approval</code>,
        Notification routet Alerts, Evidence Engine sealed Decision + Event zusammen.
      </P>
      <P>
        Latenzen: p50 4ms, p99 35ms. Inline-Mode (synchron für AI-Runtime-SDK) bleibt unter 50ms
        p99 als hartes SLO.
      </P>

      <H2>Policy-Inheritance</H2>
      <P>
        Policies erben in vier Schichten:
      </P>
      <UL>
        <li>RSD-shipped Default Policies (Plattform-Floor)</li>
        <li>Industry-Pack-Policies (Healthcare, FinTech, HR — Tenant opt-in)</li>
        <li>Tenant-Custom-Policies (im Produkt oder via Git-PR)</li>
        <li>Environment-Overrides (Production strenger als Staging)</li>
      </UL>
      <P>
        Höhere Schichten dürfen niedrigere <em>verschärfen</em> (Severity rauf, Allow-Conditions
        enger), aber nicht abschwächen. Der Compiler weigert sich, ein Bundle zu emittieren, das
        diese Invariante verletzt.
      </P>

      <H2>Eine Policy belegt vier Frameworks</H2>
      <P>
        Ein Hochrisiko-AI-System wird ohne abgeschlossene DPIA deployed. Das eine Event triggert
        vier Frameworks:
      </P>
      <UL>
        <li><strong>GDPR Art. 35</strong> → <code>policy.dpia_required_before_deploy</code>, Action: block.</li>
        <li><strong>EU AI Act Art. 9 + 11</strong> → <code>policy.ai_act_high_risk_obligations</code>, Action: block.</li>
        <li><strong>ISO 27001 A.5.34</strong> → <code>policy.iso_privacy_assessment</code>, Action: require_approval.</li>
        <li><strong>SOC2 CC9.1</strong> → <code>policy.soc2_change_management</code>, Action: warn.</li>
      </UL>
      <P>
        Strictest action wins: <code>block</code>. Der Evidence-Record verlinkt auf alle vier
        matched Policies — ein gemeinsames Deployment-Blocked-Event belegt vier Frameworks
        gleichzeitig.
      </P>

      <H2>Observe-Mode vs Inline-Mode</H2>
      <P>
        Default ist Observe: Policy evaluiert async auf dem Event-Bus, Decision wird geschrieben,
        kein In-line-Block. Für AI-Runtime-Calls mit hartem Compliance-Anspruch (z. B. Modell-Calls,
        die personenbezogene Daten als Prompt mitschicken könnten) kann der SDK auf den
        synchronen Endpoint <code>/policy/decide</code> wechseln und auf die Decision warten. Das
        SLO bleibt strikt: p99 &lt;50ms.
      </P>
    </ContentPageLayout>
  );
}
