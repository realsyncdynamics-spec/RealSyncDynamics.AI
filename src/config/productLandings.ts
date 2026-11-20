/**
 * RealSync Dachmarke: ein White-Designsystem, eigenständige Produkt-Landingpages.
 * Keine Preise / keine erfundenen Live-Claims. Runtime-Ziele bleiben vorhandene Routen.
 */
import { IMPLEMENTATION_ITEMS, type ImplementationStatus } from '../product/implementation-status';

export type ProductSlug =
  | 'governance-os'
  | 'voice-agent'
  | 'app-builder'
  | 'software-factory'
  | 'automation-os'
  | 'creative-studio';

export interface ProductLandingDefinition {
  slug: ProductSlug;
  name: string;
  label: string;
  headline: string;
  description: string;
  points: readonly string[];
  registryId: string | null;
  action: { label: string; href: string };
  secondary: { label: string; href: string };
  note: string;
}

/** Die Reihenfolge entspricht dem Dachmarken-Produktkatalog auf der Startseite. */
export const PRODUCT_LANDINGS: readonly ProductLandingDefinition[] = [
  {
    slug: 'governance-os',
    name: 'Governance OS',
    label: 'GOVERN',
    headline: 'KI steuern. Entscheidungen nachvollziehen.',
    description: 'Risiken, KI-Systeme, Freigaben und Nachweise an einem zentralen Ort verwalten.',
    points: ['KI-Register & Risikoklassifizierung', 'Freigaben & Richtlinien', 'Evidence & Prüfpfad'],
    registryId: 'app-shell',
    action: { label: 'Governance OS öffnen', href: '/welcome?next=%2Fapp' },
    secondary: { label: 'Kostenlosen Scan starten', href: '/audit' },
    note: 'Der Status bezieht sich auf die verfügbare App-Oberfläche, nicht auf einen vollständig abgenommenen Kundenprozess.',
  },
  {
    slug: 'voice-agent',
    name: 'Voice Agent',
    label: 'ENGAGE',
    headline: 'Anfragen annehmen. Menschen entlasten.',
    description: 'Ein geplanter Telefonassistent für Kundenanfragen, Kontakt- und Terminwünsche mit Übergabe an Mitarbeitende.',
    points: ['Anfrage und Anliegen erfassen', 'Kontakt & Terminwunsch aufnehmen', 'Übergabe an einen Menschen'],
    registryId: 'voice-telephony',
    action: { label: 'Auf die Warteliste', href: '/warteliste?interest=bots&source=product-voice-agent' },
    secondary: { label: 'Chat-Assistent ansehen', href: '/chatbot/start' },
    note: 'Telefonie ist noch nicht produktiv freigeschaltet. Der Chat-Kanal besitzt einen separaten Preview-Status.',
  },
  {
    slug: 'app-builder',
    name: 'App Builder',
    label: 'BUILD',
    headline: 'Aus einer Idee wird ein digitaler Auftritt.',
    description: 'Website- und App-Entwürfe in einem geführten Builder vorbereiten. Bestehende Backends bleiben bei Frontend-Modernisierungen erhalten.',
    points: ['Idee und Anforderungen erfassen', 'Frontend-Entwurf prüfen', 'Nach Freigabe gezielt erweitern'],
    registryId: 'web-builder',
    action: { label: 'Builder ansehen', href: '/build' },
    secondary: { label: 'Website prüfen', href: '/audit' },
    note: 'Builder und veröffentlichte Kunden-Websites sind nicht pauschal als End-to-End-Produkt abgenommen.',
  },
  {
    slug: 'software-factory',
    name: 'Software Factory',
    label: 'BUILD',
    headline: 'Von der Spezifikation zum überprüfbaren Code.',
    description: 'Die geplante KI-gestützte Entwicklungsstrecke verbindet Analyse, Coding-Agenten, Tests und menschliche Freigabe.',
    points: ['Aufgaben strukturiert spezifizieren', 'Änderungen isoliert prüfen', 'Reviews und Nachweise vorbereiten'],
    registryId: null,
    action: { label: 'Alle Produkte ansehen', href: '/#produkte' },
    secondary: { label: 'Governance entdecken', href: '/governance-os' },
    note: 'Entwicklungs- und Teststufen vorhanden; keine freigegebene autonome Produktionsauslieferung.',
  },
  {
    slug: 'automation-os',
    name: 'Automation OS',
    label: 'AUTOMATE',
    headline: 'Wiederkehrende Abläufe besser organisieren.',
    description: 'Workflows, Regeln und Aufgaben in einer gemeinsamen Plattform vorbereiten und kontrollieren.',
    points: ['Auslöser & Workflows', 'Kontrollierte Ausführung', 'Protokollierung & Freigaben'],
    registryId: 'automation-n8n',
    action: { label: 'Automatisierungen ansehen', href: '/automations' },
    secondary: { label: 'Governance entdecken', href: '/governance-os' },
    note: 'Die n8n-Provider-Laufzeit ist noch Preview; keine produktive Ausführung zugesichert.',
  },
  {
    slug: 'creative-studio',
    name: 'Creative Studio',
    label: 'CREATE',
    headline: 'Ideen sichtbar machen.',
    description: 'Ein geplanter Kreativbereich für Bild-, Video- und Marketinginhalte innerhalb der RealSync-Plattform.',
    points: ['Bildkonzepte vorbereiten', 'Video-Workflows planen', 'Inhalte im selben Workspace organisieren'],
    registryId: 'creative-studio',
    action: { label: 'Alle Produkte ansehen', href: '/#produkte' },
    secondary: { label: 'App Builder ansehen', href: '/app-builder' },
    note: 'Bild- und Videogenerierung sind derzeit nicht als Kundenfunktion freigegeben.',
  },
] as const;

export const PRODUCT_STATUS_LABELS: Record<ImplementationStatus, string> = {
  live: 'Oberfläche verfügbar',
  preview: 'Preview',
  'coming-soon': 'In Vorbereitung',
};

/** Ohne belegten Registry-Eintrag niemals als live markieren. */
export function productLandingStatus(product: ProductLandingDefinition): ImplementationStatus {
  if (!product.registryId) return 'coming-soon';
  return IMPLEMENTATION_ITEMS.find((item) => item.id === product.registryId)?.status ?? 'coming-soon';
}

export function findProductLanding(slug: string): ProductLandingDefinition | undefined {
  return PRODUCT_LANDINGS.find((product) => product.slug === slug);
}
