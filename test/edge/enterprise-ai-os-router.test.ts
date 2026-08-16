/**
 * K1 — Pfad-Auflösung des enterprise-ai-os-Routers.
 *
 * Warum das getestet wird: Der Router ersetzt sieben einzelne Function-Slugs.
 * Löst er einen Pfad falsch auf, liefert ein bisher funktionierender Endpunkt
 * 404 — für die aufrufenden Formulare (Discovery, Founding Access, Feedback)
 * wäre das ein stiller Ausfall der öffentlichen Ingress-Fläche.
 *
 * Die Handler selbst sind unverändert aus den Einzel-Functions extrahiert und
 * über die bestehende Abdeckung bzw. das Verhalten in Produktion abgesichert;
 * hier steht ausschließlich die Routing-Schicht unter Test (reine Funktion,
 * keine Deno-Imports — Muster wie test/edge/schedule-assets.test.ts).
 */
import { describe, expect, it } from 'vitest';
import {
  resolveEndpoint,
  ROUTER_SLUG,
} from '../../supabase/functions/enterprise-ai-os/resolve';

const ENDPOINTS = [
  'agents-list',
  'agents-run',
  'agent-runs-list',
  'discovery-intake',
  'evaluate',
  'feedback',
  'founding-access',
];

describe('enterprise-ai-os Router — resolveEndpoint', () => {
  it.each(ENDPOINTS)('löst /%s auf den Endpunkt auf', (ep) => {
    expect(resolveEndpoint(`/${ROUTER_SLUG}/${ep}`)).toBe(ep);
  });

  it('versteht den vollen Pfad inklusive /functions/v1-Präfix', () => {
    expect(resolveEndpoint(`/functions/v1/${ROUTER_SLUG}/agents-run`)).toBe('agents-run');
  });

  it('ignoriert Query-fremde Pfadvarianten (Trailing Slash)', () => {
    expect(resolveEndpoint(`/${ROUTER_SLUG}/agent-runs-list/`)).toBe('agent-runs-list');
  });

  it('liefert null ohne Endpunkt — Root des Routers ist kein Handler', () => {
    expect(resolveEndpoint(`/${ROUTER_SLUG}`)).toBeNull();
    expect(resolveEndpoint(`/${ROUTER_SLUG}/`)).toBeNull();
  });

  it('liefert null, wenn der Router-Slug fehlt', () => {
    expect(resolveEndpoint('/agents-run')).toBeNull();
  });

  it('reicht unbekannte Unterpfade durch, statt sie zu erraten', () => {
    // Der Router-Lookup schlägt damit fehl → 404 mit Endpunktliste.
    expect(resolveEndpoint(`/${ROUTER_SLUG}/a/b`)).toBe('a/b');
    expect(resolveEndpoint(`/${ROUTER_SLUG}/unbekannt`)).toBe('unbekannt');
  });

  it('der alte Bindestrich-Slug ist KEIN Router-Pfad — Alt-URLs bleiben eigenständig', () => {
    // enterprise-ai-os-agents-run (alte Function) darf nicht zufällig im
    // Router landen: bis zur Löschung antworten alte und neue URL parallel.
    expect(resolveEndpoint('/enterprise-ai-os-agents-run')).toBeNull();
  });
});
