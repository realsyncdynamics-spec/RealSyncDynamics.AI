/**
 * Heutiger Stand der Bausteine, auf die eine Empfehlung verweist.
 *
 * Kommt aus der Status-Registry (`src/product/implementation-status.ts`),
 * nicht aus dem gespeicherten Ergebnis: Ein altes Ergebnis darf keine damals
 * gültige Verfügbarkeit als Zusage weitertragen. Die Oberfläche kennzeichnet
 * den Hinweis deshalb als „aktueller Stand“.
 */
import { IMPLEMENTATION_ITEMS, type ImplementationStatus } from '../../product/implementation-status';
import type { RecommendationId } from '../../../shared/needs-check';

const REGISTRY_ID: Record<RecommendationId, string> = {
  'build.new_site': 'web-builder',
  'build.modernize': 'web-builder',
  'automate.chat': 'channel-bots',
  'govern.website_scan': 'free-audit',
  'govern.runtime': 'governance-runtime-core',
};

const LABEL: Record<ImplementationStatus, string> = {
  live: 'In Betrieb',
  preview: 'Vorschau',
  'coming-soon': 'In Vorbereitung',
};

export function currentStatus(id: RecommendationId): { status: ImplementationStatus; label: string } | null {
  const item = IMPLEMENTATION_ITEMS.find((i) => i.id === REGISTRY_ID[id]);
  if (!item) return null;
  return { status: item.status, label: LABEL[item.status] };
}

/** Text nur für Bausteine, die nicht voll in Betrieb sind. */
export function currentStatusNote(id: RecommendationId): string | null {
  const s = currentStatus(id);
  if (!s || s.status === 'live') return null;
  return `Aktueller Stand: ${s.label}`;
}
