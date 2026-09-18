/**
 * Compliance-Knoten der Startseite — Pins auf dem Europa-Relief und Zeilen
 * der Evidence-Chain in der Dashboard-Vorschau.
 *
 * Gestaltungsdaten, keine Betriebsmetrik: Die Rollen beschreiben, welche
 * Governance-Funktion an welchem europäischen Standort verankert ist. Weder
 * Pins noch Chain-Zeilen behaupten Live-Zustände — die Vorschau trägt
 * durchgehend die Kennzeichnung „DEMO · BEISPIELDATEN".
 *
 * Koordinaten decken sich mit `governance-frontend/geo/capitals.ts`
 * (Frankfurt ist dort nicht enthalten — keine Hauptstadt, aber die
 * eu-central-Region).
 */
export type ComplianceNode = {
  city: string;
  role: string;
  lon: number;
  lat: number;
};

export const COMPLIANCE_NODES: readonly ComplianceNode[] = [
  { city: 'BERLIN', role: 'AI Act Registry', lon: 13.4, lat: 52.52 },
  { city: 'BRÜSSEL', role: 'Risk Classification', lon: 4.35, lat: 50.85 },
  { city: 'FRANKFURT', role: 'EU Runtime · eu-central', lon: 8.68, lat: 50.11 },
  { city: 'STOCKHOLM', role: 'Evidence Node', lon: 18.07, lat: 59.33 },
  { city: 'PARIS', role: 'Policy Engine', lon: 2.35, lat: 48.86 },
  { city: 'WIEN', role: 'Conformity Review', lon: 16.37, lat: 48.21 },
] as const;

/** Frankfurt trägt die eu-central-Runtime — Ausgangspunkt der Datenströme. */
export const HUB_NODE = COMPLIANCE_NODES[2];
