import { Link } from 'react-router-dom';
import { ArrowLeft, Code2, Webhook, Terminal, Puzzle, GitBranch, KeyRound, ExternalLink } from 'lucide-react';
import { usePageMeta } from '../lib/usePageMeta';

export function Developers() {
  usePageMeta({
    title: 'Developers — API-first Governance | RealSyncDynamics.AI',
    description:
      'API-first Governance. SDKs für TypeScript, Webhooks, GitHub Actions, Browser Extension und Event Ingestion. So integriert ihr Compliance ins Build-System.',
  });

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 text-titanium-300 hover:text-titanium-100 text-sm">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
        <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-titanium-100">Developers</div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <section className="mb-12">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
            Built for developers
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-tight">
            API-first Governance.
          </h1>
          <p className="mt-4 text-silver-300 text-base sm:text-lg leading-relaxed max-w-3xl">
            Jede Capability hat eine stabile, versionierte HTTP/JSON-API bevor sie eine UI bekommt.
            Telemetrie, Policies, Evidence, Agenten — alles per SDK, CLI oder direktem Webhook
            erreichbar.
          </p>
        </section>

        {/* Code sample */}
        <section className="mb-12">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-100 mb-3">
            event ingestion
          </div>
          <pre className="bg-obsidian-900/60 border border-silver-700/30 p-5 overflow-x-auto text-xs sm:text-sm font-mono text-silver-200 leading-relaxed">
{`import { RsdClient } from '@realsyncdynamics/sdk';

const rsd = new RsdClient({
  apiKey: process.env.RSD_INGEST_KEY!,   // mint at /governance/keys
  tenantId: 'tnt_…',
});

await rsd.events.track({
  event_type: 'agent.runtime.call',
  event_source: 'agent_runtime',
  asset_id: 'asset_…',
  risk_level: 'high',
  vendor: 'api.openai.com',
  model_name: 'gpt-4o-mini',
  data_types: ['prompt_text'],
  policy_action: 'require_approval',
  payload: { /* ... */ },
});`}
          </pre>
        </section>

        {/* Surfaces */}
        <section className="mb-12">
          <h2 className="font-display font-bold text-2xl text-titanium-50 mb-1">Integration Surfaces</h2>
          <p className="text-sm text-silver-400 mb-5">
            Sechs Wege, die Governance-Runtime in eure Systeme zu hängen.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SURFACES.map((s) => {
              const Icon = s.icon;
              return (
                <article key={s.name} className="border border-silver-700/30 bg-obsidian-900/60 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-9 w-9 flex items-center justify-center border border-titanium-100/30 bg-titanium-100/5 text-titanium-100">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="font-display font-bold text-base text-titanium-50">{s.name}</h3>
                  </div>
                  <p className="text-sm text-silver-300 leading-relaxed mb-3">{s.body}</p>
                  <code className="block font-mono text-[11px] text-silver-400 bg-obsidian-950/60 border border-silver-700/30 px-2 py-1.5">
                    {s.endpoint}
                  </code>
                </article>
              );
            })}
          </div>
        </section>

        {/* Event schema sketch */}
        <section className="mb-12">
          <h2 className="font-display font-bold text-2xl text-titanium-50 mb-1">Event Envelope</h2>
          <p className="text-sm text-silver-400 mb-5">
            Versioniertes Schema. Zwei Source-of-truth-Felder ({' '}
            <code className="font-mono text-titanium-100">schema_version</code>,{' '}
            <code className="font-mono text-titanium-100">event_id</code>) plus eine offene{' '}
            <code className="font-mono text-titanium-100">payload</code>-Map für event-spezifische
            Daten.
          </p>
          <pre className="bg-obsidian-900/60 border border-silver-700/30 p-5 overflow-x-auto text-xs font-mono text-silver-200 leading-relaxed">
{`{
  "schema_version": "1.1.0",
  "event_id":        "01HW…",          // ULID, client-generated → dedupe
  "event_type":      "agent.runtime.call",
  "event_source":    "server_sdk",
  "tenant_id":       "uuid",
  "occurred_at":     "2026-05-12T22:30:14.123Z",
  "environment":     "production",
  "asset_id":        "uuid | null",
  "risk_level":      "low | medium | high | critical | null",
  "data_types":      ["prompt_text", …],
  "policy_action":   "allow | warn | require_approval | block | null",
  "payload":         { /* event-type-specific */ }
}`}
          </pre>
        </section>

        {/* CTAs */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/governance/keys"
            className="border border-titanium-100/30 hover:border-amber-400 hover:text-amber-300 p-5 transition-colors group"
          >
            <KeyRound className="h-5 w-5 mb-3 text-titanium-100 group-hover:text-amber-300" />
            <h3 className="font-display font-bold text-base text-titanium-50">Ingest-Key erzeugen</h3>
            <p className="mt-2 text-xs text-silver-400">Per-Tenant scoped, im Vault gespeichert, jederzeit revokebar.</p>
          </Link>
          <a
            href="https://github.com/realsyncdynamics-spec"
            target="_blank"
            rel="noreferrer noopener"
            className="border border-titanium-100/30 hover:border-amber-400 hover:text-amber-300 p-5 transition-colors group"
          >
            <GitBranch className="h-5 w-5 mb-3 text-titanium-100 group-hover:text-amber-300" />
            <h3 className="font-display font-bold text-base text-titanium-50 inline-flex items-center gap-1">
              GitHub <ExternalLink className="h-3 w-3" />
            </h3>
            <p className="mt-2 text-xs text-silver-400">SDKs, Beispiele, Issue-Tracker, Extension-Source.</p>
          </a>
          <Link
            to="/governance-runtime"
            className="border border-titanium-100/30 hover:border-amber-400 hover:text-amber-300 p-5 transition-colors group"
          >
            <Terminal className="h-5 w-5 mb-3 text-titanium-100 group-hover:text-amber-300" />
            <h3 className="font-display font-bold text-base text-titanium-50">Live Demo</h3>
            <p className="mt-2 text-xs text-silver-400">Governance-Runtime mit Demo-Daten — kein Login nötig.</p>
          </Link>
        </section>
      </main>
    </div>
  );
}

const SURFACES = [
  {
    icon: Code2,
    name: 'TypeScript / Node SDK',
    body: '@realsyncdynamics/sdk — type-safe Event-Tracking, Asset-CRUD, Policy-Lookups. Tree-shakable, ESM-first.',
    endpoint: 'npm install @realsyncdynamics/sdk',
  },
  {
    icon: Webhook,
    name: 'Outbound Webhooks',
    body: 'HMAC-SHA256-signed, exponential backoff, per-tenant Routes. Replay-Schutz via X-RSD-Timestamp.',
    endpoint: 'POST /functions/v1/governance-webhooks',
  },
  {
    icon: GitBranch,
    name: 'GitHub Actions',
    body: 'PR-Check Action: erkennt neue Vendors / AI-Modelle / Tracker pre-merge. Risk-Delta in der Check-Box.',
    endpoint: 'uses: realsyncdynamics/governance-check@v1',
  },
  {
    icon: Puzzle,
    name: 'Browser Extension (MV3)',
    body: 'Detektiert Tracker, KI-Vendoren und Consent-Drift im Browser. Manifest V3, MAIN-world Hooks.',
    endpoint: 'extension-governance/',
  },
  {
    icon: Terminal,
    name: 'Ingest API (REST)',
    body: 'Direkter HTTPS-POST mit Bearer-Token. ~80 Event-Types in v1, dot-namespaced. Idempotent auf event_id.',
    endpoint: 'POST /functions/v1/governance-ingest',
  },
  {
    icon: KeyRound,
    name: 'Per-Tenant API Keys',
    body: 'Mint im /governance/keys UI, hashed at rest, last_used_at recorded, scopes enforced, instant revoke.',
    endpoint: '/governance/keys',
  },
];
