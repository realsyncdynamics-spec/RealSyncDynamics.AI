/** Öffentliche Reife einer Fläche auf der Landing v8. */
export type MarketingStatus = 'vorhanden' | 'vorschau' | 'in-entwicklung';

export type ProductLetter = 'A' | 'B' | 'C' | 'D' | 'E';

export type LiveShowcase = 'governance-runtime' | 'company-voice';

export type Showcase =
  | { kind: 'live'; component: LiveShowcase }
  | { kind: 'screenshot'; src: string; alt: string }
  | { kind: 'none' };

export interface MarketingFeature {
  id: string;
  name: string;
  summary: string;
  status: MarketingStatus;
  /**
   * Sichtbares Demo-Kennzeichen. Pflicht, sobald die Fläche keine
   * produktive Anbindung ist und trotzdem gezeigt wird.
   */
  demo: boolean;
  /** Vorhandene Route der App, falls es eine gibt. */
  href?: string;
  showcase: Showcase;
  /** Datei oder Eintrag, aus dem die Zuordnung kommt. */
  evidence: string;
}

export interface ProductArea {
  letter: ProductLetter;
  slug: string;
  name: string;
  /** Kurze Rolle, z. B. Grundlage. */
  role: string;
  summary: string;
  features: readonly MarketingFeature[];
}

export interface SolutionLink {
  id: string;
  name: string;
  href: string;
  summary: string;
}
