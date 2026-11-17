/**
 * Öffentlicher Produktkatalog: jedes Produkt mit eigenem Einstieg auf der
 * Landingpage und eigenem Modul in der Schaltzentrale (/app/dashboard).
 *
 * Zielbild (Founder-Entscheid 17.11.2026): Produkte sind einzeln über die
 * Landingpage erreichbar. Nach der Anmeldung laufen alle in einem Dashboard,
 * einem Konto und einem Billing zusammen (vgl. docs/PRODUCT_PRIORITIZATION.md,
 * „Ein Produkt, ein Dashboard, ein Billing“).
 *
 * Regeln:
 * - Der Status kommt ausschließlich aus `implementation-status.ts`. Hier wird
 *   kein Status gepflegt, damit Landing und Registry nicht auseinanderlaufen.
 * - Reihenfolge nach K4 (AGENTS.md): zuerst der KI-Empfang (AI Receptionist),
 *   danach die übrigen Produkte. Governance ist eingebaute Absicherung, kein
 *   eigenes Hero-Produkt.
 * - Keine Preise hier (nur `shared/pricing.ts`), keine Kennzahlen, keine
 *   Kontakt-CTAs.
 */
import {
  getImplementation,
  type ImplementationStatus,
} from './implementation-status';
import { PUBLIC_STATUS_LABEL } from './implementation-status-public';

export interface ProductEntry {
  /** Stabile Produkt-ID, auch für `?product=` beim Einstieg in /app. */
  id: string;
  /** Eintrag in IMPLEMENTATION_ITEMS, aus dem der Status gelesen wird. */
  implementationId: string;
  /** Öffentlicher Name. */
  name: string;
  /** Nutzen in einem Satz, aus Sicht des Betriebs. */
  promise: string;
  /** Öffentliche Produktseite. */
  landingPath: string;
  /** Modul in der Schaltzentrale nach dem Login. */
  appPath: string;
}

export const PRODUCT_CATALOG: readonly ProductEntry[] = [
  {
    id: 'ki-empfang-telefon',
    implementationId: 'voice-telephony',
    name: 'KI-Empfang am Telefon',
    promise:
      'Anrufe annehmen, Anliegen und Terminwunsch erfassen und an Ihr Team übergeben.',
    landingPath: '/phonebot/start',
    appPath: '/app/voice',
  },
  {
    id: 'ki-empfang-chat',
    implementationId: 'channel-bots',
    name: 'KI-Empfang im Chat & WhatsApp',
    promise:
      'Anfragen auf Website und WhatsApp beantworten, Kontakt aufnehmen, bei Bedarf an einen Menschen übergeben.',
    landingPath: '/chatbot/start',
    appPath: '/app/bots',
  },
  {
    id: 'websites',
    implementationId: 'web-builder',
    name: 'Website für Ihren Betrieb',
    promise:
      'Eine datenschutzgerechte Website erstellen und pflegen, ohne eigene Agentur.',
    landingPath: '/frontend-builder',
    appPath: '/app/websites',
  },
  {
    id: 'governance-scan',
    implementationId: 'free-audit',
    name: 'Governance-Scan',
    promise:
      'Die eigene Website kostenlos auf Cookies, Tracker und Einwilligung prüfen, mit klarem Befund.',
    landingPath: '/audit',
    appPath: '/app/scans',
  },
  {
    id: 'ki-inventar',
    implementationId: 'ai-act-classify',
    name: 'KI-Inventar & EU-AI-Act-Einordnung',
    promise:
      'Erfassen, welche KI im Betrieb läuft, und jedes System nach Risikoklasse einordnen.',
    landingPath: '/ai-act-klassifikator',
    appPath: '/app/ai-systems',
  },
  {
    id: 'automationen',
    implementationId: 'automation-n8n',
    name: 'Automationen',
    promise:
      'Wiederkehrende Abläufe automatisieren, mit Freigabe an den Stellen, an denen ein Mensch entscheidet.',
    landingPath: '/automations',
    appPath: '/app/automations',
  },
  {
    id: 'ai-gateway',
    implementationId: 'ai-gateway',
    name: 'AI Gateway',
    promise:
      'Jeden KI-Aufruf über eine kontrollierte Schicht führen, mit Protokoll, Kosten und EU-Option.',
    landingPath: '/claude-code-optimizer',
    appPath: '/app/costs',
  },
];

/** Status eines Produkts, gelesen aus der Registry. Unbekannt = 'coming-soon' (fail-closed). */
export function productStatus(product: ProductEntry): ImplementationStatus {
  return getImplementation(product.implementationId)?.status ?? 'coming-soon';
}

/** Öffentliches Status-Label (Live / In Arbeit / Geplant). */
export function productStatusLabel(product: ProductEntry): string {
  return PUBLIC_STATUS_LABEL.de[productStatus(product)];
}

export function getProduct(id: string): ProductEntry | undefined {
  return PRODUCT_CATALOG.find((p) => p.id === id);
}
