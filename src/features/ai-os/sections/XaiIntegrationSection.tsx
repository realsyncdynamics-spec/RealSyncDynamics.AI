// Operator-only integration inventory. No model calls, media uploads, billing,
// or browser-side xAI keys. The existing /build and bot surfaces stay canonical.
import React from 'react';
import { Link } from 'react-router-dom';
import { Note, Panel, Pill } from '../ui';

export const XAI_INTEGRATION_STATE = {
  image: 'adapter-only',
  video: 'adapter-only',
  build: 'isolated-runner-required',
  voice: 'existing-implementation-requires-live-validation',
} as const;

export function XaiIntegrationSection() {
  return (
    <>
      <div>
        <h1 className="aios-h1">Grok & Imagine</h1>
        <p className="aios-lead">
          xAI-Erweiterungen für die bestehende RealSync-Architektur.
          Dies ist ein prüfbares Integrationsregister, keine zweite Builder-
          oder Abrechnungsoberfläche. Die kostenpflichtigen Medienaktionen
          sind nicht produktiv freigeschaltet.
        </p>
      </div>
      <Note tone="warn">
        <strong>Keine Live-Freigabe:</strong> Die serverseitigen Adapter und
        Budget-Verträge befinden sich in der Implementierungsprüfung.
        Mandantenberechtigungen, Datenschutzfreigaben, langlebige Video-Jobs
        und E2E-Prüfungen müssen vor einem Echtbetrieb abgeschlossen sein.
      </Note>
      <div className="aios-grid-wide">
        <Panel title="Grok Imagine · Bilder" actions={<Pill tone="info">Adapter vorbereitet</Pill>} source="supabase/functions/_shared/xaiImagine">
          <p className="text-sm aios-fg2">
            Text-zu-Bild mit grok-imagine-image-2.0. Ein Bild pro Anfrage,
            Eingabeprüfung und serverseitiger Transport. Noch kein Kunden-Endpoint.
          </p>
          <p className="text-xs aios-muted">
            Geplant: bestehende Auth-/Entitlement-/PDP-Prüfung, kontrollierte Medienablage und Evidence.
          </p>
        </Panel>
        <Panel title="Grok Imagine · Video" actions={<Pill tone="info">Adapter vorbereitet</Pill>} source="supabase/functions/_shared/xaiImagine">
          <p className="text-sm aios-fg2">
            Text-zu-Video mit 1.5 und 1.5 Lite, asynchronem Start und
            Statusabfrage. Vorerst maximal acht Sekunden und 720p.
          </p>
          <p className="text-xs aios-muted">
            Vor Freigabe: dauerhafte, tenantgebundene Job-Verwaltung und Abrechnung.
          </p>
        </Panel>
        <Panel title="Grok Build · Code" actions={<Pill tone="neutral">Runner offen</Pill>} source="src/features/build-studio">
          <p className="text-sm aios-fg2">
            Grok Build ist ein Coding-Agent, kein austauschbarer Image-Endpunkt.
            Anbindung nur über isolierte ACP-/Headless-Worker und den
            bestehenden GitHub-Freigabeprozess.
          </p>
          <Link className="aios-link text-sm" to="/build">Bestehendes Build Studio öffnen</Link>
        </Panel>
        <Panel title="Grok Voice" actions={<Pill tone="warn">Live-Test offen</Pill>} source="src/lib/company-voice/grok-relay.ts">
          <p className="text-sm aios-fg2">
            Bestehender Grok-Realtime-Relay und Agent-Runtime-Provider.
            Produktionsaktivierung und Ende-zu-Ende-Funktion sind hier nicht bestätigt.
          </p>
        </Panel>
      </div>
      <Panel title="Architekturentscheidung" source="docs/ai-os/xai-imagine-gateway-2026-11-13.md">
        <p className="text-sm aios-fg2">
          React/Vite (Oberfläche) → vorhandene Supabase Auth, Tenant-Entitlements,
          Governance und atomare Kostenreservierung → separater xAI-Medienadapter
          → tenantgebundener Storage / Evidence. Cloudflare Pages enthält
          keine xAI-Secrets. Stripe-Preise werden hier nicht verändert.
        </p>
      </Panel>
    </>
  );
}
