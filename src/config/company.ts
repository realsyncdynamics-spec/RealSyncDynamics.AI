/**
 * Zentrale Unternehmenskonfiguration für RealSyncDynamics.AI
 *
 * Diese Datei ist die Single Source of Truth für alle Unternehmensdaten:
 * - Rechtliche Form (aktuell: Einzelunternehmen; später optional UG/GmbH)
 * - Firmennamen und Kontaktinformationen
 * - Impressum- und Rechnungsdaten
 * - Stripe-Integration
 * - DSGVO/EU-AI-Act-Compliance-Hinweise
 *
 * Änderungen hier propagieren überall — niemals duplizieren.
 *
 * Bindend abgeglichen mit /legal/impressum (src/features/legal/Impressum.tsx).
 * Umwandlung auf UG/GmbH: legalForm setzen und registryEntry ergänzen.
 */

export type LegalForm = 'Einzelunternehmen' | 'UG' | 'GmbH';

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
  /** Handelsregister-Eintrag (z.B. "HRB 12345 (Amtsgericht Jena)") — null bei Einzelunternehmen */
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
  /** Tax mode: "EU_STANDARD" (VAT) oder "EXEMPT" (Kleinunternehmer / non-profit) */
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
 * - Abgleich mit Impressum: Einzelunternehmen, Neuhaus am Rennweg, kein HRB
 * - Stripe-Keys kommen aus .env: VITE_STRIPE_PUBLISHABLE_KEY
 * - registryEntry bleibt null, solange legalForm === 'Einzelunternehmen'
 */
export const COMPANY: CompanyConfig = {
  companyName: 'RealSync Dynamics',
  legalForm: 'Einzelunternehmen',
  futureLegalForm: 'GmbH',

  country: 'Germany',
  headquartersAddress: {
    street: 'Schwarzburger Str. 31',
    postalCode: '98724',
    city: 'Neuhaus am Rennweg',
  },
  supportEmail: 'info@realsyncdynamicsai.de',
  supportPhoneOptional: '+49 176 4013 2161',

  // Will be loaded from env / bleibt null für Einzelunternehmen
  registryEntry: null,
  vatId: null,
  economicId: null,

  billingAddress: {
    street: 'Schwarzburger Str. 31',
    postalCode: '98724',
    city: 'Neuhaus am Rennweg',
    country: 'Germany',
  },

  stripeAccountMode: 'test', // Switch to 'live' for production
  stripePublishableKey: (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string) || '',

  taxMode: 'EXEMPT',
  complianceDisclaimer:
    'RealSync Dynamics / RealSyncDynamics.AI ist eine Compliance-Support-Plattform. Keine Rechtsberatung. ' +
    'Die Ergebnisse dienen der technischen und organisatorischen Compliance-Unterstützung.',

  website: 'https://realsyncdynamicsai.de',
  socialLinks: {
    linkedin: 'https://linkedin.com/company/realsyncdynamicsai',
    github: 'https://github.com/realsyncdynamics',
  },
};

/**
 * Vollständiger Company-Display-Name mit Legal Form
 * z.B. "RealSync Dynamics · Einzelunternehmen" bzw. "… UG (haftungsbeschränkt)"
 */
export function getCompanyDisplayName(includeEntity = true): string {
  const base = COMPANY.companyName;
  if (!includeEntity) return base;

  if (COMPANY.legalForm === 'Einzelunternehmen') {
    return `${base} · Einzelunternehmen`;
  }
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

/** Einzelunternehmen braucht keinen Handelsregister-Eintrag. */
export function requiresRegistryEntry(legalForm: LegalForm = COMPANY.legalForm): boolean {
  return legalForm === 'UG' || legalForm === 'GmbH';
}

/**
 * Validiert, ob die Konfiguration für Production-Start bereit ist.
 * HRB ist nur bei UG/GmbH Pflicht; Kleinunternehmer ohne USt-IdNr. ist zulässig.
 */
export function isProductionReady(): boolean {
  const registryOk = !requiresRegistryEntry() || COMPANY.registryEntry !== null;
  return (
    registryOk &&
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
 * Gibt Fehler zurück, wenn kritische Felder fehlen.
 * Fehlendes HRB ist kein Blocker für Einzelunternehmen.
 */
export function getProductionValidationErrors(): string[] {
  const errors: string[] = [];

  if (requiresRegistryEntry() && !COMPANY.registryEntry) {
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
