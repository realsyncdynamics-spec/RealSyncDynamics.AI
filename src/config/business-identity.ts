/**
 * Business-Identity-Konfig für § 5 TMG / § 18 MStV-Pflichtangaben.
 *
 * Diese Werte werden in /legal/impressum gerendert. Felder, die noch nicht
 * vergeben sind (USt-IdNr. nach Finanzamt-Fragebogen, HRB bei späterer
 * UG/GmbH-Umwandlung), bleiben in der ENV leer und werden dann als
 * sichtbare Lücken im Impressum-Banner markiert — sowohl in DEV als auch
 * in PROD. Damit bleibt der Fail-State sichtbar und niemand schaltet
 * versehentlich live, ohne die Lücken geschlossen zu haben.
 *
 * Sobald die Werte vorliegen, einfach in .env (oder im Build-Secret-Store)
 * setzen — kein Code-Deploy nötig:
 *   VITE_BUSINESS_VAT_ID=DE123456789
 *   VITE_BUSINESS_REGISTRY_ENTRY=HRB 12345 (Amtsgericht Jena)
 *   VITE_BUSINESS_ECONOMIC_ID=DE9876543210
 */

export interface BusinessIdentity {
  vatId: string | null;
  registryEntry: string | null;
  economicId: string | null;
}

function readOptional(name: string): string | null {
  const raw = (import.meta.env[name] as string | undefined)?.trim();
  return raw && raw.length > 0 ? raw : null;
}

export function loadBusinessIdentity(): BusinessIdentity {
  return {
    vatId: readOptional('VITE_BUSINESS_VAT_ID'),
    registryEntry: readOptional('VITE_BUSINESS_REGISTRY_ENTRY'),
    economicId: readOptional('VITE_BUSINESS_ECONOMIC_ID'),
  };
}

/**
 * USt-IdNr. ist der einzige Wert, der für eine Production-Schaltung
 * zwingend gesetzt sein muss (sobald Umsatzsteuer-pflichtig). HR-Eintrag
 * ist nur Pflicht bei UG/GmbH, Wirtschafts-ID erst ab Vergabe durch BZSt.
 */
export function isImpressumProductionReady(id: BusinessIdentity): boolean {
  return id.vatId !== null;
}
