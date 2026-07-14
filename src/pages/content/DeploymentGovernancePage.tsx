import { ContentPageLayout, H2, P, UL } from './ContentPageLayout';

export function DeploymentGovernancePage() {
  return (
    <ContentPageLayout
      eyebrow="Deployment Governance"
      title="Governance an der CI/CD-Grenze."
      description="Wie RealSyncDynamicsAI Tracker-, Vendor- und KI-Modell-Änderungen pre-merge erkennt, Risk-Delta berechnet und das Gate steuert."
      intro="Compliance-Befunde, die erst nach dem Deploy auftauchen, sind teuer. Die meisten Tracker-vor-Consent-Issues, die meisten US-Transfer-Risiken, die meisten Modell-Wechsel landen ohne Prüfung in Production — schlicht weil das Tooling sie nicht sieht. Deployment Governance schiebt die Prüfung an die Stelle, wo eine Änderung bewertbar ist, ohne dass Produktion bereits betroffen ist."
      related={[
        { to: '/policy-engine', label: 'Policy Engine →' },
        { to: '/governance-graph', label: 'Governance Graph →' },
        { to: '/evidence-vault', label: 'Evidence Vault →' },
        { to: '/agent-governance', label: 'Agent Governance →' },
      ]}
    >
      <H2>Wann der Check feuert</H2>
      <P>
        Drei Trigger sind heute unterstützt: GitHub-PR-Hook (push, PR, release), Cloudflare-Pages-Deploy-Webhook
        (für statisch gebaute Sites) und GitLab-Pipeline-Hook. Die Check-Action liest den Diff,
        identifiziert Änderungen mit Governance-Relevanz und ruft die Policy-Engine an. Das
        Ergebnis landet als Check-Run auf der PR, plus ein strukturierter Kommentar mit
        Begründung.
      </P>

      <H2>Was als "governance-relevant" gilt</H2>
      <UL>
        <li>Neuer Third-Party-Vendor (Tracker, AI-API, Mail-Provider, Analytics)</li>
        <li>Veränderter Tracking-Stack: zusätzliches Script, anderes Tag-Manager-Configurierung</li>
        <li>AI-Modell-Switch (Provider, Version, Region) im Source</li>
        <li>Dataset-Erweiterung mit höherer PII-Klasse (Diff in der Dataset-Manifest-Datei)</li>
        <li>Consent-Bypass (Script ohne <code>data-consent</code>-Gate)</li>
        <li>Policy-Drift: lokale Policy-Files in einem Repo überschreiben Tenant-Policies</li>
      </UL>

      <H2>Risk-Delta</H2>
      <P>
        Die Engine berechnet drei Scores: Pre-Deploy-Risk (aktueller Stand), Post-Deploy-Risk
        (projiziert nach Merge), Delta. Konkret: ein neuer US-Vendor erhöht den Score um eine
        konfigurierte Konstante; ein neues Modell ohne <code>ai_act_class</code>-Tag triggert eine
        Reclassifikation; ein Tracker ohne Consent-Gate erhöht den Score um die TDDDG-§25-Penalty.
        Das Delta ist die Zahl, die in der Check-Box steht.
      </P>

      <H2>Gate-Outcomes</H2>
      <UL>
        <li><strong>allow</strong> — Delta unter konfiguriertem Schwellwert, kein Block, Evidence wird trotzdem sealed (für Audit-Lineage).</li>
        <li><strong>warn</strong> — Check ist grün, aber Kommentar weist auf die Änderung hin. Owner-Team sieht den Hinweis im Review.</li>
        <li><strong>require_approval</strong> — Check ist gelb. PR kann nicht gemerged werden ohne expliziten Approve-Klick vom Reviewer mit Compliance-Rolle.</li>
        <li><strong>block</strong> — Check ist rot. Merge ist gesperrt durch die Branch-Protection-Rule, bis die zugrunde liegende Policy-Violation entweder behoben oder mit signiertem Override umgangen wird.</li>
      </UL>

      <H2>Was die Action liest</H2>
      <P>
        Die Action liest aus dem Repo: <code>.well-known/governance.json</code> (optional, für
        Self-Description des Repos), <code>package.json</code> (Dependency-Diff), HTML/JSX
        (Tracker-Detection per Pattern-Match auf bekannte Vendor-URLs), <code>vercel.json</code> /
        <code>netlify.toml</code> (Deploy-Config-Diff), CI-Files (workflow-Änderungen).
      </P>
      <P>
        Was die Action <em>nicht</em> liest: produktive Datenbanken, Secrets, Source-Daten des
        Kunden. Die Analyse ist statisch und repo-lokal.
      </P>

      <H2>Override-Pfad</H2>
      <P>
        Manchmal muss man bewusst etwas mergen, das die Engine flaggt — z. B. ein experimentelles
        Feature-Flag, dessen Rollout policy-konform geplant ist. Der Override-Pfad ist explizit:
        Reviewer mit <code>compliance_override</code>-Permission klickt im PR-UI auf "Override",
        gibt einen Reason an, und der Event landet im Audit-Log mit <code>action=deployment.override</code>.
        Die Branch-Protection lässt den Merge zu. Aber: das Override ist auditbar, jeder zukünftige
        Auditor sieht <em>wer</em> wann was übersteuert hat.
      </P>

      <H2>Evidence für jeden Deploy</H2>
      <P>
        Jedes Gate-Outcome (allow, warn, require_approval, block, override) erzeugt einen
        Evidence-Record im Vault: <code>kind=deployment_decision</code>, mit dem PR-SHA als
        Subject, der Policy-Bundle-SHA, dem Risk-Delta, den verlinkten Controls. Bei Audits ist die
        Frage "wie habt ihr 2026-03-15 entschieden, dass dieser Tracker durchgewunken wurde?"
        in 30 Sekunden mit verifiable Hash beantwortbar.
      </P>

      <H2>Status der GitHub-Integration</H2>
      <P>
        Die Action ist im Blueprint §9 spezifiziert und Teil der Phase-2-Roadmap. Heute existiert
        die Policy-Engine, die Evidence-Vault-Anbindung und der Connector zu Jira/GitHub für
        Remediation-Tickets. Die PR-Check-Action selbst wird im nächsten Release-Zyklus
        veröffentlicht. Bis dahin können Tenants den Compliance-Loop manuell über die Connectors
        + den Telemetry-SDK abdecken.
      </P>
    </ContentPageLayout>
  );
}
