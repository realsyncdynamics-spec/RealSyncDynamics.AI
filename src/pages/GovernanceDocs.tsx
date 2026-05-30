import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, ArrowRight } from 'lucide-react';
import { usePageMeta } from '../lib/usePageMeta';

/**
 * /docs/governance — public API reference for the Governance
 * Runtime. Designed so a prospective customer can self-onboard:
 *
 *   1. Read what the engine does (overview).
 *   2. Mint a key in /governance/keys (link).
 *   3. Send the first event via curl (sample block).
 *   4. See it appear in /governance (link).
 *
 * No auth required; the keys themselves auth the API calls.
 */
export function GovernanceDocs() {
  usePageMeta({
    title: 'Governance Runtime — API Reference · RealSyncDynamics.AI',
    description:
      'API-Referenz für die Governance Runtime: Telemetry-Ingestion, Policy-Engine, Evidence-Vault, Browser-Extension und SDK.',
    url: 'https://RealSyncDynamicsAI.de/docs/governance',
  });

  return (
    <div className="bg-hero-only min-h-screen flex flex-col text-titanium-50">
      <header className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between border-b border-silver-700/30">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs sm:text-sm text-silver-300 hover:text-titanium-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="font-display font-bold tracking-tight text-titanium-50">
            RealSyncDynamics.AI
          </span>
        </Link>

        <Link
          to="/governance-runtime"
          className="surface-mono inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-none"
        >
          Runtime ansehen <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
            <BookOpen className="h-3.5 w-3.5" />
            Governance Runtime · API Reference
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-[1.05] mb-6">
            Self-Service API für AI-, Web- und Agent-Governance.
          </h1>
          <p className="max-w-3xl text-base sm:text-lg text-silver-300 leading-relaxed mb-12">
            Drei Edge Functions auf EU-Infrastruktur, eine Browser-Extension und ein zero-dep
            TypeScript-SDK. Alles, was Du brauchst, um Runtime-Events Deiner AI-Systeme, Websites
            und Agents in eine auditierbare Compliance-Spur zu verwandeln.
          </p>

          <Toc />

          <Section id="quickstart" title="Quickstart">
            <ol className="list-decimal list-inside space-y-3 text-silver-200 leading-relaxed">
              <li>
                Melde Dich auf <Link to="/welcome" className="text-amber-300 hover:text-amber-200">/welcome</Link> an
                und wähle Deinen Tenant.
              </li>
              <li>
                Lege auf <Link to="/governance" className="text-amber-300 hover:text-amber-200">/governance</Link> ein
                erstes <em>Asset</em> an (z. B. Deinen Chatbot) und eine <em>Policy</em>
                (z. B. „Block customer_data to OpenAI ohne TIA").
              </li>
              <li>
                Erstelle auf <Link to="/governance/keys" className="text-amber-300 hover:text-amber-200">/governance/keys</Link> einen
                Ingest-Key. Der Token erscheint <strong>genau einmal</strong> — sicher speichern.
              </li>
              <li>
                Sende den ersten Event via curl oder SDK (siehe unten). Policy-Decision +
                Auto-Evidence landen direkt im Dashboard.
              </li>
            </ol>
          </Section>

          <Section id="ingest" title="POST /functions/v1/governance-ingest">
            <FieldList>
              <Field name="Auth"    value="Bearer rsd_gov_<token>" />
              <Field name="Method"  value="POST" />
              <Field name="Content" value="application/json" />
              <Field name="Limit"   value="max 50 events per request" />
            </FieldList>

            <SubHeading>Body (Single)</SubHeading>
            <Code>{`{
  "event": {
    "event_type": "agent.runtime.call",
    "event_source": "agent_runtime",
    "title": "Customer Support Copilot called OpenAI",
    "summary": "Support ticket processed via gpt-4o-mini.",
    "risk_level": "high",
    "vendor": "OpenAI",
    "model_name": "gpt-4o-mini",
    "data_types": ["customer_message", "email"],
    "asset_id": "asset-uuid-optional",
    "payload": { "request_id": "req_8f2a" }
  },
  "evidence": [
    {
      "evidence_type": "log",
      "title": "Redacted prompt + response",
      "content_hash": "sha256:0c7a…"
    }
  ]
}`}</Code>

            <SubHeading>Body (Batch)</SubHeading>
            <Code>{`{
  "events": [
    { "event": { /* ... */ }, "evidence": [ /* ... */ ] },
    { "event": { /* ... */ } }
  ]
}`}</Code>

            <SubHeading>Response</SubHeading>
            <Code>{`{
  "ok": true,
  "event_ids": ["evt-uuid-1", "evt-uuid-2"],
  "evidence_ids": ["ev-uuid-1"],
  "policy_decisions": [
    {
      "event_id": "evt-uuid-1",
      "policy_id": "policy-uuid",
      "action": "block"
    }
  ]
}`}</Code>

            <SubHeading>Allowed enums</SubHeading>
            <FieldList>
              <Field name="event_source"  value="website_scanner · browser_extension · sdk · api · github · ci_cd · manual · agent_runtime" />
              <Field name="risk_level"    value="info · low · medium · high · critical" />
              <Field name="policy_action" value="allow · log · warn · block · require_approval" />
              <Field name="evidence_type" value="screenshot · har · json · log · pdf · hash · policy_snapshot · approval · pull_request" />
            </FieldList>

            <SubHeading>Curl Example</SubHeading>
            <Code>{`curl -X POST https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/governance-ingest \\
  -H "Authorization: Bearer rsd_gov_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": {
      "event_type": "test",
      "event_source": "manual",
      "title": "hello"
    }
  }'`}</Code>
          </Section>

          <Section id="policy" title="Policy Language">
            <p className="text-silver-300 leading-relaxed mb-3">
              Policies werden serverseitig <strong>vor dem Insert</strong> evaluiert. Trifft eine
              Policy auf das Event zu, überschreibt die Engine <code>policy_id</code> und
              <code> policy_action</code> auf dem Event und erstellt automatisch eine
              <code> policy_snapshot</code> Evidence. Strengste Aktion gewinnt:
              <span className="font-mono text-amber-300 ml-2">block &gt; require_approval &gt; warn &gt; log &gt; allow</span>.
            </p>

            <SubHeading>Condition Format</SubHeading>
            <p className="text-silver-300 leading-relaxed mb-3">
              JSON-Objekt; Top-Level-Keys sind AND-verknüpft. Strings/Booleans matchen per Equality,
              Arrays per At-least-one-Overlap.
            </p>

            <Code>{`// Block alle Calls an US-only-Vendor ohne TIA
{
  "vendor": "OpenAI",
  "data_types": ["customer_data", "employee_data"]
}

// Trigger nur für high-risk AI-Act-Assets
{ "ai_act_class": "high" }

// Mehrere Vendors gleichzeitig erlaubt
{ "vendor": ["OpenAI", "Anthropic"] }`}</Code>

            <SubHeading>Erlaubte Keys</SubHeading>
            <FieldList>
              <Field name="Event-Felder" value="event_type · event_source · vendor · model_name · data_types · risk_level" />
              <Field name="Asset-Felder" value="asset_type · ai_act_class (Asset wird via event.asset_id resolved)" />
              <Field name="Sonstige"     value="Unbekannte Keys werden gegen event.payload[key] gematcht" />
            </FieldList>
          </Section>

          <Section id="errors" title="Error Codes">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-[10px] font-mono uppercase tracking-[0.18em] text-silver-500 border-b border-silver-700/40">
                  <th className="text-left py-2 pr-3">HTTP</th>
                  <th className="text-left py-2 pr-3">Code</th>
                  <th className="text-left py-2">Bedeutung</th>
                </tr>
              </thead>
              <tbody className="text-silver-200">
                {[
                  ['400', 'BAD_REQUEST',    'JSON ungültig oder Pflichtfeld fehlt'],
                  ['400', 'BATCH_TOO_LARGE','> 50 Events in einem Request'],
                  ['401', 'UNAUTHORIZED',   'Fehlender / ungültiger / widerrufener Bearer-Token'],
                  ['403', 'FORBIDDEN',      'Operation nur für Owner/Admin des Tenants'],
                  ['403', 'CROSS_TENANT',   'asset_id / policy_id gehört zu anderem Tenant'],
                  ['404', 'NOT_FOUND',      'asset_id / policy_id existiert nicht'],
                  ['500', 'INSERT_FAILED',  'DB-Constraint-Violation (siehe message)'],
                ].map((row) => (
                  <tr key={row[1]} className="border-b border-silver-700/20">
                    <td className="py-2 pr-3 font-mono text-amber-300">{row[0]}</td>
                    <td className="py-2 pr-3 font-mono">{row[1]}</td>
                    <td className="py-2">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section id="keys" title="POST /functions/v1/governance-keys">
            <p className="text-silver-300 leading-relaxed mb-3">
              Owner/Admin-only. Token erscheint genau einmal beim
              <code> create</code> — Server speichert nur den sha256-Hash.
            </p>
            <FieldList>
              <Field name="op: create" value='{ tenant_id, name, allowed_sources?, rate_limit_per_minute? } → { ok, key, token }' />
              <Field name="op: list"   value="{ tenant_id } → { ok, keys[] }" />
              <Field name="op: revoke" value="{ key_id } → { ok }" />
            </FieldList>
            <p className="text-silver-300 leading-relaxed mt-3">
              UI-Variante: <Link to="/governance/keys" className="text-amber-300 hover:text-amber-200">/governance/keys</Link>.
            </p>
          </Section>

          <Section id="resources" title="POST /functions/v1/governance-resources">
            <p className="text-silver-300 leading-relaxed mb-3">
              Owner/Admin-only. Create + State-Toggle für Assets und Policies. Reads laufen direkt
              gegen Supabase mit Tenant-RLS (Membership-gated).
            </p>
            <FieldList>
              <Field name="op: create_asset"  value='{ tenant_id, asset_type, name, ai_act_class?, vendor?, data_types?, risk_score?, ... } → { ok, asset }' />
              <Field name="op: archive_asset" value="{ asset_id } → { ok }" />
              <Field name="op: create_policy" value='{ tenant_id, name, policy_type, severity?, action?, condition?, enabled? } → { ok, policy }' />
              <Field name="op: toggle_policy" value="{ policy_id, enabled: boolean } → { ok, enabled }" />
            </FieldList>
            <p className="text-silver-300 leading-relaxed mt-3">
              UI-Variante: <Link to="/governance" className="text-amber-300 hover:text-amber-200">/governance</Link>.
            </p>
          </Section>

          <Section id="extension" title="Browser Extension">
            <p className="text-silver-300 leading-relaxed mb-3">
              Manifest V3 Chrome-Extension im Repo unter <code>extension-governance/</code>.
              Erfasst Tracker-Insertions, AI-Vendor-Calls (OpenAI · Anthropic · Google ·
              Mistral · Cohere · Together · Perplexity · DeepSeek), sowie Cookies-vor-Consent
              und sendet sie an die Ingest-API.
            </p>
            <SubHeading>Install</SubHeading>
            <Code>{`# 1. Repo klonen + Extension-Verzeichnis öffnen
git clone https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI
cd RealSyncDynamics.AI/extension-governance

# 2. Chrome → chrome://extensions
#    → Developer mode aktivieren
#    → "Load unpacked" → extension-governance/ wählen

# 3. Popup öffnen, Ingest-URL + Token eintragen, "Speichern".`}</Code>
          </Section>

          <Section id="sdk" title="TypeScript SDK">
            <p className="text-silver-300 leading-relaxed mb-3">
              Zero-dep TS-Client. Im Repo unter <code>src/features/governance/ingestClient.ts</code>.
              Browser- und Node-tauglich, kein Bundler-Setup nötig.
            </p>
            <Code>{`import { IngestClient } from './ingestClient';

const client = new IngestClient({
  url: 'https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/governance-ingest',
  token: process.env.RSD_GOV_TOKEN!,
});

const res = await client.send({
  event_type: 'agent.runtime.call',
  event_source: 'sdk',
  title: 'Outbound model call',
  risk_level: 'medium',
  vendor: 'OpenAI',
  data_types: ['prompt_text'],
});

if (!res.ok) {
  console.error('ingest failed', res.error);
} else {
  console.log('matched policy:', res.policy_decisions[0]?.action);
}`}</Code>
          </Section>

          <div className="mt-16 border border-titanium-100/20 bg-titanium-100/5 p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-2">
                  Pilot-Slots
                </div>
                <h2 className="font-display font-bold text-xl text-titanium-50">
                  Für Enterprise-Pilots: Dedicated Onboarding + SLA.
                </h2>
              </div>
              <Link
                to="/contact-sales?intent=governance-pilot&source=docs"
                className="surface-mono inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-none"
              >
                Enterprise anfragen <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-silver-700/30 px-4 sm:px-6 py-8">
        <div className="max-w-4xl mx-auto text-xs text-titanium-500 flex flex-wrap items-center justify-between gap-3">
          <span>© 2026 RealSync Dynamics · EU-Hosted (Frankfurt) · Made in Germany</span>
          <div className="flex gap-4">
            <Link to="/governance-runtime" className="hover:text-titanium-300">Runtime</Link>
            <Link to="/legal/methodology"  className="hover:text-titanium-300">Methodik</Link>
            <Link to="/security"           className="hover:text-titanium-300">Security</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────── */

function Toc() {
  const items = [
    { id: 'quickstart', label: 'Quickstart' },
    { id: 'ingest',     label: 'Telemetry Ingestion' },
    { id: 'policy',     label: 'Policy Language' },
    { id: 'errors',     label: 'Error Codes' },
    { id: 'keys',       label: 'Key Management' },
    { id: 'resources',  label: 'Asset & Policy CRUD' },
    { id: 'extension',  label: 'Browser Extension' },
    { id: 'sdk',        label: 'TypeScript SDK' },
  ];
  return (
    <nav className="mb-10 border border-silver-700/30 p-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-silver-500 mb-2">
        Inhalt
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {items.map((i) => (
          <li key={i.id}>
            <a href={`#${i.id}`} className="text-silver-300 hover:text-titanium-50">
              <span className="text-amber-300 mr-2">→</span>{i.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Section({
  id, title, children,
}: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-10 scroll-mt-24">
      <h2 className="font-display font-bold text-2xl text-titanium-50 tracking-tight mb-4 pb-2 border-b border-silver-700/30">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display font-bold text-sm uppercase tracking-[0.18em] text-titanium-100 mt-5 mb-1.5">
      {children}
    </h3>
  );
}

function Field({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-silver-700/30 py-1.5 last:border-b-0">
      <span className="font-mono text-[11px] uppercase tracking-wider text-amber-300 min-w-[100px]">{name}</span>
      <span className="font-mono text-xs text-silver-300 break-all">{value}</span>
    </div>
  );
}

function FieldList({ children }: { children: React.ReactNode }) {
  return <div className="border border-silver-700/30 bg-obsidian-900/40 px-4 py-2 my-2">{children}</div>;
}

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-obsidian-900 border border-silver-700/30 text-[12px] font-mono text-titanium-200 p-4 overflow-x-auto leading-relaxed my-3">
      {children}
    </pre>
  );
}
