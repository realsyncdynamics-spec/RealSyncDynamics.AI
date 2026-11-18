import { ContentPageLayout, H2, H3, P, UL } from './ContentPageLayout';

export function AiActGovernancePage() {
  return (
    <ContentPageLayout
      eyebrow="AI Act Governance"
      title="EU AI Act Governance ohne Excel."
      description="Technische Umsetzung der EU-AI-Act-Pflichten: Risikoklassifizierung nach Annex III, Obligation-Engine, Annex-IV-Generator, Post-Market-Monitoring."
      intro="Der EU AI Act ist seit dem 1. August 2024 in Kraft und seit dem 2. August 2026 allgemein anwendbar. Die zentralen Hochrisiko-Pflichten nach Anhang III gelten ab dem 2. Dezember 2027, nach Anhang I ab dem 2. August 2028 (Art. 113 in der Fassung der Verordnung (EU) 2026/1744). Für Anbieter und Betreiber von Hochrisiko-KI-Systemen entstehen konkrete technische Pflichten — Risikomanagement (Art. 9), Datenqualität (Art. 10), technische Dokumentation (Art. 11), Logging (Art. 12), Transparenz (Art. 13), Human Oversight (Art. 14), Robustheit (Art. 15). Dieser Hub erläutert das technische Governance-Konzept; der tatsächliche Funktionsstatus ist unter /roadmap dokumentiert."
      related={[
        { to: '/agent-governance', label: 'Agent Governance →' },
        { to: '/evidence-vault', label: 'Evidence Vault →' },
        { to: '/policy-engine', label: 'Policy Engine →' },
        { to: '/governance-graph', label: 'Governance Graph →' },
      ]}
    >
      <H2>Klassifizierung statt Vermutung</H2>
      <P>
        Entscheidend ist die konkrete Zweckbestimmung des KI-Systems. Anhang III nennt acht
        Anwendungsbereiche, darunter Biometrik, Bildung und Beschäftigung. Die Einstufung als
        Hochrisiko-KI folgt aus Art. 6 Abs. 2 in Verbindung mit Anhang III; Art. 6 Abs. 3
        sieht eng begrenzte Ausnahmen vor, die dokumentiert werden müssen. Systeme, die
        ein Profiling natürlicher Personen durchführen, bleiben im Anhang-III-Kontext
        stets hochriskant. Auch für KI in regulierten Produkten nach Anhang I gelten
        gesonderte Voraussetzungen gemäß Art. 6 Abs. 1.
      </P>
      <P>
        Das technische Konzept für den AI-Risk-Classifier in RealSyncDynamics.AI ist regelbasiert: Annex I und III sind als
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
        laufendes Monitoring. Als technische Bausteine sind folgende Detektoren vorgesehen; ihr Produktivstatus ist der Roadmap zu entnehmen:
      </P>
      <UL>
        <li><strong>Drift-Detector</strong> — vergleicht die rollende 7-Tage-Verteilung von Inputs/Outputs gegen eine Release-Baseline. KS-Test plus Population Stability Index. Bei <code>PSI &gt; 0.25</code> wird <code>model.drift.detected</code> emittiert.</li>
        <li><strong>Performance-Regression-Detector</strong> — vergleicht die aktuelle Accuracy auf Canary-Inputs gegen die Release-Zeit-Accuracy.</li>
      </UL>
      <P>
        Auffälligkeiten wie Model-Drift sind nicht automatisch ein meldepflichtiger
        schwerwiegender Vorfall. Für solche Vorfälle regelt Art. 73 AI Act
        differenzierte Meldefristen (grundsätzlich spätestens 15 Tage, in bestimmten
        Fällen 2 bzw. 10 Tage). Die 72-Stunden-Frist nach Art. 33 DSGVO betrifft
        gesondert meldepflichtige Verletzungen des Schutzes personenbezogener Daten.
        Eine technische Alarmierung ersetzt die rechtliche Einzelfallprüfung nicht.
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
        Dieser Hub ist keine Rechtsberatung. Ob und in welcher Form eine
        Konformitätsbewertung durch Dritte erforderlich ist, ergibt sich aus der
        konkreten Einstufung und dem Verfahren nach Art. 43 AI Act. RealSyncDynamics.AI
        ersetzt die rechtliche Bewertung nicht. Für jede konkrete
        Pflichteinordnung sollte ein Fachanwalt oder zertifizierter DSB konsultiert werden.
      </P>
    </ContentPageLayout>
  );
}
