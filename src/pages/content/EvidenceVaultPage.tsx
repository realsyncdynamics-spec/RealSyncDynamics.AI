import { ContentPageLayout, H2, P, UL } from './ContentPageLayout';

export function EvidenceVaultPage() {
  return (
    <ContentPageLayout
      eyebrow="Evidence Vault"
      title="Belege, die einer Re-Berechnung standhalten."
      description="Hash-gechainte, Ed25519-signierte, RFC-3161-getimestampte Evidence-Records — die Grundlage für regulator-fähige Audit-Pakete."
      intro="Eine PDF mit einem Stempel ist kein Audit-Beweis. Audit-fähige Evidence muss drei Eigenschaften haben: sie muss unveränderlich sein, sie muss sich auf einen bestimmten Zeitpunkt festnageln lassen, und sie muss von einem zurechenbaren Akteur signiert sein. Der Evidence Vault in RealSyncDynamics.AI implementiert alle drei — nicht als Marketing-Begriff, sondern als technische Konstruktion."
      related={[
        { to: '/policy-engine', label: 'Policy Engine →' },
        { to: '/ai-act-governance', label: 'AI Act Governance →' },
        { to: '/governance-graph', label: 'Governance Graph →' },
        { to: '/deployment-governance', label: 'Deployment Governance →' },
      ]}
    >
      <H2>Was im Vault liegt</H2>
      <P>
        Jeder Evidence-Record ist ein Tupel aus Artefakt-URL (S3 in eu-central-1), Artefakt-SHA-256,
        verknüpften Controls (z. B. <code>aiact.art11.annex_iv</code>), Subject-Pointer (welche
        Usecase, welcher Vendor, welches Deployment), Retention-Datum und Signatur. Das Artefakt
        selbst kann eine Annex-IV-PDF sein, ein Scan-Ergebnis als HAR, ein Consent-Snapshot oder
        ein Agent-Run-Trace.
      </P>

      <H2>Hash-Chain pro Tenant</H2>
      <P>
        Innerhalb eines Tenants haben Evidence-Records eine monoton steigende <code>chain_index</code>.
        Jeder Record speichert <code>artefact_sha256</code> seines Vorgängers in
        <code> prev_sha256</code>. Eine SQL-Verifikation in einem Schritt deckt Tampering auf:
      </P>
      <UL>
        <li>LAG-Fenster über <code>artefact_sha256</code> ordered by <code>chain_index</code></li>
        <li>WHERE <code>prev_sha256 IS DISTINCT FROM expected_prev</code></li>
        <li>Leeres Result-Set = Kette unversehrt. Nicht-leer = P1-Incident.</li>
      </UL>

      <H2>Ed25519-Signaturen mit per-Tenant-Key</H2>
      <P>
        Bei Tenant-Creation wird ein Ed25519-Schlüsselpaar generiert und der private Key in
        AWS-KMS (eu-central-1, HSM-backed) gehalten. Der Public Key wird im Tenant-eigenen
        Trust-Portal veröffentlicht. Signatur eines Records ist <code>Ed25519(artefact_sha256 ||
        prev_sha256 || sealed_at)</code>. Jeder Auditor mit dem Public Key kann jede Signatur
        verifizieren — die Plattform muss dafür nicht angerufen werden.
      </P>

      <H2>RFC-3161-Timestamps</H2>
      <P>
        Für Records mit hoher Stake (Annex-IV-Sections, signierte DPIA, Incident-Report,
        Regulator-Export) wird der Artefakt-SHA-256 zusätzlich an zwei unabhängige
        EU-RFC-3161-TSAs (Bundesdruckerei, Swiss Post) gesendet. Der Doppel-Timestamp + die
        beiden TSA-Signaturen landen in <code>metadata.tsa</code>. Kosten pro Record: ~€0.01 —
        wir wenden es selektiv auf alle <code>kind IN
        (annex_iv_section, dpia_signed, incident_report, regulator_export)</code> an.
      </P>

      <H2>Audit-Rekonstruktion</H2>
      <P>
        "Welche Policy war am 2026-04-15 14:00 aktiv? Was hat sie auf Event X entschieden?" — diese
        Frage ist nur durch das Zusammenspiel von Audit-Log + Policy-Bundle-Versionierung +
        Evidence-Vault beantwortbar. Der Audit-Log nennt jede Policy-Mutation per Zeitstempel.
        Policy-Bundles im Object Storage sind versioniert mit ihrem SHA. Evidence-Records für
        Policy-Decisions speichern den <code>policy_bundle_sha</code>. Aus einer event_id heraus
        rekonstruiert die Plattform: welcher Bundle aktiv war, welche Regeln getroffen haben, was
        zurückkam, wer eskaliert hat.
      </P>

      <H2>Regulator-Export-Pack</H2>
      <P>
        Wenn eine Behörde ein Audit-Pack anfordert, generiert die Reporting-Service ein ZIP mit
        deterministischem Namen: <code>regulator-export-&lt;tenant&gt;-&lt;from&gt;-&lt;to&gt;.zip</code>.
        Es enthält Inventory-JSONs, Policy-Snapshots, Policy-Decisions als Parquet, Evidence-Records
        + Artefakte, Audit-Log als Parquet, und das Verification-Output der Chain-Query. Das ZIP
        wird mit zwei Schlüsseln signiert: dem Tenant-Key (Beweis "wir bestätigen unsere
        Aussagen") und dem Plattform-Key (Beweis "die Plattform bestätigt, was sie geliefert hat").
        Two-of-two-Signatur.
      </P>

      <H2>Was bewusst nicht im Vault liegt</H2>
      <P>
        Personenbezogene Daten in raw form gehören nicht in den Vault. Der Vault hält den Hash
        der Daten, der Beweis ist die Konsistenz mit anderen Records. Ein DSR-Löschantrag erreicht
        die Source-Tabellen, der Vault bleibt unangetastet — die Hashes referenzieren keine
        personenbezogenen Inhalte mehr.
      </P>
    </ContentPageLayout>
  );
}
