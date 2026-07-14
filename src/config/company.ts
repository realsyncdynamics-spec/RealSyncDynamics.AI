/**
 * Zentrale Unternehmenskonfiguration für RealSyncDynamics.AI
 *
 * Diese Datei ist die Single Source of Truth für alle Unternehmensdaten:
 * - Rechtliche Form (aktuell: UG, später: GmbH)
 * - Firmennamen und Kontaktinformationen
 * - Impressum- und Rechnungsdaten
 * - Stripe-Integration
 * - DSGVO/EU-AI-Act-Compliance-Hinweise
 *
 * Änderungen hier propagieren überall — niemals duplizieren.
 *
 * Umwandlung auf GmbH: Setzen Sie einfach legalForm: 'GmbH' und companyName
 * wird automatisch angepasst. Kein Code-Redeploy nötig.
 */

export type LegalForm = 'UG' | 'GmbH';

export interface CompanyConfig {
  // ─── Legal Identity ──────────────────────────────────────────────────────
  companyName: string;
  legalForm: LegalForm;
  futureLegalForm: LegalForm;

  // ─── Contact & Headquarters ──────────────────────────────────────────────
  country: string;
  headquartersAddress: {
    street: string;
    postalCode: string;
    city: string;
  };
  supportEmail: string;
  supportPhoneOptional?: string;

  // ─── Legal Registration (Impressum §5 TMG / §18 MStV) ────────────────────
  /** Handelsregister-Eintrag (z.B. "HRB 12345 (Amtsgericht Jena)") */
  registryEntry: string | null;
  /** Umsatzsteuer-Identifikationsnummer */
  vatId: string | null;
  /** Wirtschafts-Identifikationsnummer */
  economicId: string | null;

  // ─── Billing & Stripe ────────────────────────────────────────────────────
  billingAddress: {
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
  /** Stripe Account ID oder "test"/"live" */
  stripeAccountMode: 'test' | 'live';
  /** Stripe Publishable Key (public) */
  stripePublishableKey: string;

  // ─── Tax & Compliance ────────────────────────────────────────────────────
  /** Tax mode: "EU_STANDARD" (VAT) oder "EXEMPT" (non-profit) */
  taxMode: 'EU_STANDARD' | 'EXEMPT';
  /** DSGVO/EU-AI-Act Compliance Hinweis */
  complianceDisclaimer: string;

  // ─── Branding ────────────────────────────────────────────────────────────
  website: string;
  socialLinks?: {
    twitter?: string;
    linkedin?: string;
    github?: string;
  };
}

/**
 * Zentrale Company Config — ändern Sie hier, um bundesweit auszurollen.
 *
 * WICHTIG:
 * - Alle VAT/Registry-Felder müssen vor Production-Go-Live gesetzt sein
 * - Stripe-Keys kommen aus .env: VITE_STRIPE_PUBLISHABLE_KEY
 * - legalForm muss 'UG' oder 'GmbH' sein (definiert Impressum, Verträge, etc.)
 */
export const COMPANY: CompanyConfig = {
  companyName: 'RealSync Dynamics AI',
  legalForm: 'UG',
  futureLegalForm: 'GmbH',

  country: 'Germany',
  headquartersAddress: {
    street: 'Lutherstr. 32',
    postalCode: '07743',
    city: 'Jena',
  },
  supportEmail: 'support@realsyncdynamicsai.de',
  supportPhoneOptional: '+49 (0) 3641 ???',

  // Will be loaded from env
  registryEntry: null,
  vatId: null,
  economicId: null,

  billingAddress: {
    street: 'Lutherstr. 32',
    postalCode: '07743',
    city: 'Jena',
    country: 'Germany',
  },

  stripeAccountMode: 'test', // Switch to 'live' for production
  stripePublishableKey: (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string) || '',

  taxMode: 'EU_STANDARD',
  complianceDisclaimer:
    'RealSync Dynamics AI ist eine Compliance-Support-Plattform. Keine Rechtsberatung. ' +
    'Die Ergebnisse dienen der technischen und organisatorischen Compliance-Unterstützung.',

  website: 'https://realsyncdynamicsai.de',
  socialLinks: {
    linkedin: 'https://linkedin.com/company/realsyncdynamicsai',
    github: 'https://github.com/realsyncdynamics',
  },
};

/**
 * Vollständiger Company-Display-Name mit Legal Form
 * z.B. "RealSync Dynamics AI UG (haftungsbeschränkt)"
 */
export function getCompanyDisplayName(includeEntity = true): string {
  const base = COMPANY.companyName;
  if (!includeEntity) return base;

  if (COMPANY.legalForm === 'UG') {
    return `${base} UG (haftungsbeschränkt)`;
  }
  if (COMPANY.legalForm === 'GmbH') {
    return `${base} GmbH`;
  }
  return base;
}

/**
 * Gibt die vollständige Adresse als Single-String für Impressum/Rechnung
 */
export function getCompanyAddress(): string {
  const { street, postalCode, city } = COMPANY.headquartersAddress;
  return `${street}, ${postalCode} ${city}, ${COMPANY.country}`;
}

/**
 * Gibt die Abrechnungsadresse als String aus
 */
export function getBillingAddress(): string {
  const { street, postalCode, city, country } = COMPANY.billingAddress;
  return `${street}, ${postalCode} ${city}, ${country}`;
}

/**
 * Validiert, ob die Konfiguration für Production-Start bereit ist
 */
export function isProductionReady(): boolean {
  return (
    COMPANY.vatId !== null &&
    COMPANY.registryEntry !== null &&
    COMPANY.stripeAccountMode === 'live' &&
    COMPANY.stripePublishableKey !== ''
  );
}

/**
 * Validiert, ob die Konfiguration für Beta/Pre-Launch bereit ist
 */
export function isBetaReady(): boolean {
  return (
    COMPANY.stripePublishableKey !== '' &&
    COMPANY.stripeAccountMode === 'test'
  );
}

/**
 * Gibt Fehler zurück, wenn kritische Felder fehlen
 */
export function getProductionValidationErrors(): string[] {
  const errors: string[] = [];

  if (!COMPANY.vatId) {
    errors.push('VAT ID (USt-IdNr.) ist erforderlich');
  }
  if (!COMPANY.registryEntry) {
    errors.push('Handelsregister-Eintrag (HRB) ist erforderlich');
  }
  if (COMPANY.stripeAccountMode !== 'live') {
    errors.push('Stripe muss im Live-Modus sein');
  }
  if (!COMPANY.stripePublishableKey) {
    errors.push('Stripe Publishable Key fehlt');
  }

  return errors;
}
