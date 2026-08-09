import { ComplianceStatus, GovernanceControl } from '../types/index.js';

/**
 * Signalisiert, dass ein Tool noch keine echten Daten liefert.
 *
 * Bewusst ein Fehler statt eines Platzhalter-Ergebnisses: Diese Tools werden
 * von KI-Agenten aufgerufen, die ihre Antwort ungeprüft weitergeben. Ein
 * zurückgegebenes `score: 0, compliant: false` liest sich wie ein Befund
 * ("nicht konform"), obwohl nichts gemessen wurde — in einem Compliance-
 * Produkt ist eine erfundene Bewertung schädlicher als eine klare Fehlermeldung.
 */
export class NotImplementedError extends Error {
  constructor(tool: string, blockedBy: string) {
    super(`${tool} ist noch nicht implementiert (offen: ${blockedBy})`);
    this.name = 'NotImplementedError';
  }
}

/**
 * Compliance-Stand eines Frameworks (ISO 42001, EU AI Act, …).
 *
 * Noch nicht implementiert — erfordert die Auswertung von `ai_policies` und
 * `governance_controls` inklusive der Gewichtung, aus der sich der Score ergibt.
 */
export async function getGovernanceStatus(
  _tenantId: string,
  frameworkId: string = 'iso-42001',
): Promise<ComplianceStatus> {
  throw new NotImplementedError(
    `governance.get_status(${frameworkId})`,
    'Auswertung von ai_policies/governance_controls',
  );
}

/**
 * Controls eines Frameworks.
 *
 * Noch nicht implementiert — erfordert die Abbildung der Control-Kataloge auf
 * `governance_controls`.
 */
export async function listControls(
  _tenantId: string,
  frameworkId: string = 'iso-42001',
): Promise<GovernanceControl[]> {
  throw new NotImplementedError(
    `governance.list_controls(${frameworkId})`,
    'Abbildung der Control-Kataloge',
  );
}

/**
 * Erfüllungsstand eines einzelnen Controls.
 *
 * Noch nicht implementiert — erfordert die Verknüpfung von Evidence-Items mit
 * Controls, die es im Schema bisher nicht gibt.
 */
export async function checkComplianceStatus(
  _tenantId: string,
  controlId: string,
): Promise<{ compliant: boolean; evidence_count: number; last_verified: Date | null }> {
  throw new NotImplementedError(
    `governance.check_compliance(${controlId})`,
    'Verknüpfung Evidence ↔ Control',
  );
}
