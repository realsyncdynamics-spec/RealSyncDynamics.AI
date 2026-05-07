import { useState } from 'react';

/**
 * Interaktives Architektur-Diagramm für /security.
 *
 * Klickbare Schichten (Browser → CDN → Frontend → Edge Functions →
 * Postgres+Vault → Audit-Log + KI-Pfad). Pop-up-Erklärungen pro Schicht
 * mit Security-Controls, Sub-Processor-Hinweisen, Datenresidenz.
 *
 * Strategie: Enterprise-Käufer im Procurement wollen das verstehen.
 * Klare Visualisierung > ASCII-Block.
 */

type LayerId = 'browser' | 'cdn' | 'frontend' | 'edge' | 'db' | 'audit' | 'ai-cloud' | 'ai-local';

type Layer = {
  id: LayerId;
  label: string;
  sub: string;
  region: string;
  controls: string[];
  subProcessor?: string;
  highlight?: boolean;
};

const LAYERS: Layer[] = [
  {
    id: 'browser',
    label: 'Browser (Client)',
    sub: 'TLS 1.3 erzwungen · CSP-Header · HSTS',
    region: 'User-Device',
    controls: [
      'TLS 1.3 ist Pflicht — kein HTTP-Fallback',
      'Content-Security-Policy via Meta-Tag (frame-ancestors, script-src)',
      'Strict-Transport-Security via Meta',
      'Local Storage nur für Cookie-Consent-State, kein PII',
    ],
  },
  {
    id: 'cdn',
    label: 'GitHub Pages CDN',
    sub: 'Edge-Static-Hosting · kein PII-Storage',
    region: 'Global Edge',
    controls: [
      'Statische Assets — keine User-Daten persistiert',
      'IP-Adressen in Edge-Logs nur für Abuse-Detection',
      'kein eigenes Cookie-Setting durch CDN',
      'Custom-Domain-CNAME → GitHub Pages',
    ],
    subProcessor: 'GitHub Inc. (Microsoft) — DPA, EU-SCCs',
  },
  {
    id: 'frontend',
    label: 'React-SPA',
    sub: 'BrowserRouter · TenantProvider · CookieConsent',
    region: 'Client-Side',
    controls: [
      'Tenant-ID wird aus JWT decodiert (clientseitig nur Anzeige)',
      'Cookie-Consent-State wird vor jedem Tracking-Tag geprüft',
      'AI-Residency-Toggle: Frontend forwarded Choice an Edge-Function',
      'Sentry-Stub mit sendDefaultPii=false',
    ],
  },
  {
    id: 'edge',
    label: 'Supabase Edge Functions',
    sub: 'Deno · Bearer-JWT-Auth · Tenant-Scope',
    region: 'eu-central-1 (Frankfurt)',
    controls: [
      'JWT wird auf jeder Function-Call validiert',
      'Tenant-ID aus Token gecheckt gegen Memberships-Table',
      'API-Keys per Tenant, Rate-Limit-Enforcement',
      'Audit-Log per Function-Call (User-ID, Tenant, Action, Timestamp)',
    ],
    subProcessor: 'Supabase Inc. (AWS Frankfurt) — DPA verfügbar',
    highlight: true,
  },
  {
    id: 'db',
    label: 'Postgres + Vault',
    sub: 'RLS · AES-256 At-Rest · SECURITY DEFINER',
    region: 'eu-central-1 (Frankfurt)',
    controls: [
      'Row-Level-Security (RLS) auf allen Mandanten-Tabellen',
      'Default-Deny — explizite Policies pro Operation',
      'SECURITY DEFINER Functions mit search_path=public,pg_catalog',
      'Vault: AES-256-Encryption für Secrets (API-Keys, Webhook-URLs)',
      'Backups daily, 7 Tage retention, AES-256',
    ],
    subProcessor: 'Supabase Inc. (AWS Frankfurt) — DPA verfügbar',
    highlight: true,
  },
  {
    id: 'audit',
    label: 'Append-only Audit-Log',
    sub: 'Postgres-Trigger · Modifikation ausgeschlossen',
    region: 'eu-central-1 (Frankfurt)',
    controls: [
      'Postgres-Trigger verhindert UPDATE/DELETE auf Audit-Rows',
      'Pro KI-Aufruf: Tenant, Modell, Input-Hash, Output-Bytes, Timestamp',
      'AVV-/DSFA-/TOM-Generation-Events werden geloggt',
      'Compliance-Export für Audit-Anfragen pro Tenant verfügbar',
    ],
  },
  {
    id: 'ai-cloud',
    label: 'KI-Cloud-Pfad (Default)',
    sub: 'EU-region-pinned APIs · DPA + SCCs',
    region: 'EU (Anbieter-spezifisch)',
    controls: [
      'Anthropic EU-Tenant — Claude-Modelle',
      'OpenAI EU-Tenant — GPT-Modelle',
      'Google Vertex eu-central — Gemini',
      'Drittland-Übermittlung: SCCs nach Art. 46 DSGVO + DPA',
      'User kann via Toggle auf EU-local-Modus umschalten',
    ],
    subProcessor: 'Anthropic / OpenAI / Google (DPAs verfügbar)',
  },
  {
    id: 'ai-local',
    label: 'KI-EU-local-Pfad (Opt-In)',
    sub: 'Ollama auf VPS · Llama / Mistral · keine Drittland-Berührung',
    region: 'Frankfurt (DE) Hostinger-VPS',
    controls: [
      'Llama 3.x / Mistral lokal auf Frankfurt-VPS gehostet',
      'Kein API-Call zu Anthropic/OpenAI/Google in diesem Modus',
      'Tenant-Override: Workspace-Owner kann für alle Mitglieder erzwingen',
      'Performance: 2–8 Sek pro Inferenz vs. 0.5–2 Sek Cloud',
    ],
    subProcessor: 'Hostinger International Ltd. (DE) — DPA verfügbar',
  },
];

const HIGHLIGHT_BORDER = 'border-security-700';
const NORMAL_BORDER = 'border-titanium-800';

export function ArchitectureDiagram() {
  const [selected, setSelected] = useState<LayerId | null>(null);
  const layer = selected ? LAYERS.find((l) => l.id === selected) ?? null : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {LAYERS.map((l, idx) => {
          const isMain = ['browser', 'cdn', 'frontend', 'edge', 'db', 'audit'].includes(l.id);
          const arrow = isMain && idx < 5 ? '↓' : '';
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => setSelected(selected === l.id ? null : l.id)}
              className={`text-left p-3 bg-obsidian-900 border ${l.highlight ? HIGHLIGHT_BORDER : NORMAL_BORDER} hover:border-security-500 rounded-none transition-colors ${selected === l.id ? 'ring-2 ring-security-500' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-display font-bold text-titanium-50 text-sm flex items-center gap-2">
                    {l.label}
                    {selected === l.id && <span className="text-[10px] text-security-300 font-normal uppercase tracking-wider">aktiv</span>}
                  </div>
                  <div className="text-xs text-titanium-400 mt-0.5">{l.sub}</div>
                  <div className="text-[10px] text-titanium-500 mt-1 font-mono">{l.region}</div>
                </div>
                <span className="text-titanium-600 text-lg leading-none">{arrow}</span>
              </div>
            </button>
          );
        })}
      </div>

      {layer ? (
        <div className="p-4 bg-obsidian-900 border border-security-500 rounded-none">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-display font-bold text-titanium-50 text-base">{layer.label}</h3>
              <div className="text-xs text-titanium-400">{layer.sub}</div>
              <div className="text-[10px] text-titanium-500 mt-1 font-mono">Region: {layer.region}</div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-titanium-500 hover:text-titanium-300 underline"
            >
              schließen
            </button>
          </div>
          <div className="mt-3 pt-3 border-t border-titanium-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-titanium-500 mb-1">Controls</div>
            <ul className="space-y-1 text-sm text-titanium-300">
              {layer.controls.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">✓</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
          {layer.subProcessor && (
            <div className="mt-3 pt-3 border-t border-titanium-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-titanium-500 mb-1">Sub-Processor</div>
              <div className="text-sm text-titanium-300">{layer.subProcessor}</div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-titanium-500 italic">Klicke eine Schicht für Controls und Sub-Processor-Details.</p>
      )}
    </div>
  );
}
