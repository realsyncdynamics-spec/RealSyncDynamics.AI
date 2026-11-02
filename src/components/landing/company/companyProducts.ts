import {
  getImplementation,
  STATUS_LABEL,
  type ImplementationItem,
} from '../../../product/implementation-status';

/**
 * Produkt-Tafeln der Unternehmens-Landing (/unternehmen).
 *
 * GERÜST bis zum Design-Handoff v5: Texte und Status kommen ausschließlich aus
 * `src/product/implementation-status.ts` (SSoT). Keine eigenen Claims hier
 * ergänzen. Sobald `design_handoff_realsync_landing_v5/` vorliegt, werden die
 * Tab-Inhalte (Prüf-Simulation, Anruf, Builder-Vorschau) gegen die Referenz
 * ersetzt; der Status bleibt an die SSoT gebunden.
 */

export interface CompanyProductPage {
  title: string;
  body: string;
}

export interface CompanyProductTab {
  id: 'ueberblick' | 'vorschau' | 'zugang';
  label: string;
  pages: readonly CompanyProductPage[];
}

export interface CompanyProduct {
  id: string;
  name: string;
  status: ImplementationItem['status'];
  statusLabel: string;
  /** Interne Route (nur bei `live`) — als <Link> rendern. */
  route?: string;
  ctaLabel?: string;
  tabs: readonly CompanyProductTab[];
}

/** Öffentliche Kurztexte. Für nicht-live Einträge bewusst knapp (SSoT-Text ist intern). */
const PUBLIC_SUMMARY: Record<string, string> = {
  'free-audit':
    'Kostenloser Governance Scan: öffentlicher Website-Scan auf DSGVO- und Governance-Aspekte als Einstieg.',
  'voice-telephony':
    'Telefonie-Kanal (Voice Agent) ist geplant und noch nicht produktiv angebunden.',
  'public-frontend-builder':
    'Frontend Builder: Ein Assistent nimmt Ihre Anforderungen auf und leitet eine qualifizierte Anfrage weiter. Kein Self-Service-Deploy.',
};

const PRODUCT_IDS = ['free-audit', 'voice-telephony', 'public-frontend-builder'] as const;

const PREVIEW_PENDING: CompanyProductPage = {
  title: 'Vorschau folgt',
  body: 'Die interaktive Vorschau wird mit dem Design-Handoff v5 ergänzt. Sie läuft vollständig im Browser und sendet keine Daten.',
};

function buildProduct(item: ImplementationItem): CompanyProduct {
  const isLive = item.status === 'live';
  const summary = PUBLIC_SUMMARY[item.id] ?? item.name;
  return {
    id: item.id,
    name: item.name,
    status: item.status,
    statusLabel: STATUS_LABEL[item.status],
    route: isLive ? item.route : undefined,
    ctaLabel: isLive ? item.ctaLabel ?? 'Öffnen' : undefined,
    tabs: [
      {
        id: 'ueberblick',
        label: 'Überblick',
        pages: [
          { title: item.name, body: summary },
          {
            title: 'Status',
            body: isLive
              ? `Status laut Implementierungsstand: ${STATUS_LABEL[item.status]}.`
              : `Status laut Implementierungsstand: ${STATUS_LABEL[item.status]}. Noch nicht buchbar.`,
          },
        ],
      },
      { id: 'vorschau', label: 'Vorschau', pages: [PREVIEW_PENDING] },
      {
        id: 'zugang',
        label: 'Zugang',
        pages: [
          {
            title: isLive ? 'Direkt starten' : 'Noch nicht verfügbar',
            body: isLive
              ? 'Der Einstieg ist öffentlich erreichbar.'
              : 'Sobald der Kanal live ist, erscheint hier der Einstieg.',
          },
        ],
      },
    ],
  };
}

export const COMPANY_PRODUCTS: readonly CompanyProduct[] = PRODUCT_IDS.map((id) => getImplementation(id))
  .filter((item): item is ImplementationItem => Boolean(item))
  .map(buildProduct);
