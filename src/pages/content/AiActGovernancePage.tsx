import { ContentPageLayout, H2, H3, P, UL } from './ContentPageLayout';

export function AiActGovernancePage() {
  return (
    <ContentPageLayout
      eyebrow="AI Act Governance"
      title="EU AI Act Governance ohne Excel."
      description="Technische Umsetzung der EU-AI-Act-Pflichten: Risikoklassifizierung nach Annex III, Obligation-Engine, Annex-IV-Generator, Post-Market-Monitoring."
      intro="Der EU AI Act tritt schrittweise ab August 2026 in Kraft. Für Anbieter und Betreiber von Hochrisiko-KI-Systemen entstehen konkrete technische Pflichten — Risikomanagement (Art. 9), Datenqualität (Art. 10), technische Dokumentation (Art. 11), Logging (Art. 12), Transparenz (Art. 13), Human Oversight (Art. 14), Robustheit (Art. 15). Dieser Hub beschreibt, wie RealSyncDynamics.AI diese Pflichten als laufende Governance-Runtime abbildet — nicht als jährlichen Word-Export."
      related={[
        { to: '/agent-governance', label: 'Agent Governance →' },
        { to: '/evidence-vault', label: 'Evidence Vault →' },
        { to: '/policy-engine', label: 'Policy Engine →' },
        { to: '/governance-graph', label: 'Governance Graph →' },
      ]}
    >
      <H2>Klassifizierung statt Vermutung</H2>
      <P>
        Der Kern der AI-Act-Compliance ist nicht der Output — es ist die Frage: <em>welche Risikoklasse hat
        dieser Usecase?</em> Annex III listet acht Bereiche, die automatisch als Hochrisiko gelten:
        Biometrik, kritische Infrastruktur, Bildung, Beschäftigung, essentielle private und
        öffentliche Dienste, Strafverfolgung, Migration und Justizverwaltung. Wer ein Recruiting-Tool
        mit Auto-Screening betreibt, ist nach §4(a) automatisch in Annex III. Wer ein Modell für
        Krisen-Triage in der Telemedizin laufen lässt, ist in §5.
      </P>
      <P>
        Der AI-Risk-Classifier in RealSyncDynamics.AI ist deterministisch: Annex I und III sind als
        Entscheidungsbaum kodiert. Ein KI-Usecase wird über sieben Felder beschrieben (Purpose,
        Domain, Model-Kind, Decision-Autonomy, Affected-Subjects, Training-Data-PII, Geo-Scope), und
        die Klasse fällt eindeutig. Bei Edge-Cases (Confidence unter 0.95) wird eine LLM-Review
        getriggert, die <strong>flaggt</strong>, aber nicht entscheidet. Die finale Klassifikation
        landet als <code>ai_act_class</code>-Spalte am Asset und ist an die nachgelagerten
        Obligations gekoppelt.
      </P>

      <H2>Obligation-Engine</H2>
      <P>
        Für jeden Hochrisiko-Usecase instanziiert die Obligation-Engine eine Pflichtenliste mit
        Owner-Role und maschinenprüfbarer Verifikationsmethode. Konkret:
      </P>
      <UL>
        <li><strong>Art. 9 (Risikomanagement)</strong> — Workflow <code>risk_management_plan</code> muss signiert sein, einmal pro Release.</li>
        <li><strong>Art. 10 (Data Governance)</strong> — jedes Dataset braucht <code>lawful_basis</code>, <code>provenance_url</code>, <code>pii_review_passed</code>.</li>
        <li><strong>Art. 11 (Annex IV)</strong> — Reporting-Service generiert das Pack on demand, aus Live-Graph-State, nicht aus Templates.</li>
        <li><strong>Art. 12 (Record Keeping)</strong> — Telemetrie-Retention mindestens 6 Monate.</li>
        <li><strong>Art. 13 (Transparenz)</strong> — Deployment-Manifest muss <code>transparency_notice_url</code> enthalten, die 200 zurückgibt.</li>
        <li><strong>Art. 14 (Human Oversight)</strong> — Deployment exponiert <code>/override</code> oder ist mit der Approval-Queue verbunden.</li>
        <li><strong>Art. 15 (Accuracy + Robustness)</strong> — Eval-Suite-Ergebnisse mit Mindest-Schwellen pro Release.</li>
      </UL>
      <P>
        Fehlgeschlagene Checks öffnen einen Workflow im Workflow-Engine. Owner-Role wird per RBAC
        zugewiesen. Approval-SLA und Eskalations-Pfad sind konfigurierbar pro Tenant.
      </P>

      <H2>Post-Market-Monitoring</H2>
      <P>
        Der AI Act verlangt nicht nur eine Inbetriebnahme-Konformitäts­erklärung — er verlangt
        laufendes Monitoring. Zwei Detektoren laufen kontinuierlich gegen den Telemetrie-Stream:
      </P>
      <UL>
        <li><strong>Drift-Detector</strong> — vergleicht die rollende 7-Tage-Verteilung von Inputs/Outputs gegen eine Release-Baseline. KS-Test plus Population Stability Index. Bei <code>PSI &gt; 0.25</code> wird <code>model.drift.detected</code> emittiert.</li>
        <li><strong>Performance-Regression-Detector</strong> — vergleicht die aktuelle Accuracy auf Canary-Inputs gegen die Release-Zeit-Accuracy.</li>
      </UL>
      <P>
        Beide Detektoren öffnen bei Hochrisiko-Usecases automatisch einen AI-Act-Art.-62-Incident.
        Der Incident-Workflow hat einen 72-Stunden-Timer für die Meldung an die zuständige
        Behörde (kombiniert mit GDPR Art. 33, wenn personenbezogene Daten betroffen sind).
      </P>

      <H2>Annex IV als Live-Dokument</H2>
      <P>
        Anstatt jährlich ein Word-Dokument zu pflegen, generiert das Reporting-Service die Annex IV
        technische Dokumentation aus dem Live-Graph. Sektion 1 (allgemeine Beschreibung) liest aus
        <code> AiUsecase</code>-Properties. Sektion 2 (Elemente) joint Model, Dataset, Prompt mit
        Version-Pins. Sektion 3 (Monitoring) zieht die letzten 90 Tage Drift-/Performance-Findings.
        Sektion 5 (Changes) ist der gefilterte Audit-Log. Sektion 6 (harmonisierte Normen) sind
        die <code>Control</code>-Nodes mit <code>framework=&apos;EN_ISO_*&apos;</code>.
      </P>
      <P>
        Output ist eine deterministisch benannte ZIP-Datei (<code>annex-iv-&lt;usecase_id&gt;-&lt;sealed_at&gt;.zip</code>)
        mit Manifest, SHA-256 pro Datei, signiert. Regenerieren mit identischem Snapshot ergibt
        eine byte-stabile Datei. Eine Behörde kann den Hash unabhängig nachrechnen — der Pack ist
        verifizierbar, nicht nur vorgelegt.
      </P>

      <H2>Was diese Page nicht ist</H2>
      <P>
        Dieser Hub ist keine Rechtsberatung. Wer in Annex III §1 (Biometrik) operiert, braucht eine
        Konformitätsbewertung durch eine notifizierte Stelle — RealSyncDynamics.AI bereitet die
        technischen Belege auf, ersetzt aber die juristische Prüfung nicht. Für jede konkrete
        Pflichteinordnung sollte ein Fachanwalt oder zertifizierter DSB konsultiert werden.
      </P>
    </ContentPageLayout>
  );
}
