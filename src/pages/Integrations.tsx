import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Plug, ExternalLink } from 'lucide-react';

type Integration = {
  name: string;
  category: 'Payment' | 'Workflow' | 'CRM/Marketing' | 'Auth/SSO' | 'Communication' | 'Data/Analytics';
  status: 'live' | 'beta' | 'planned';
  desc: string;
};

const INTEGRATIONS: Integration[] = [
  { name: 'Stripe', category: 'Payment', status: 'live', desc: 'Subscriptions, Customer Portal, Meter-Sync, Webhook' },
  { name: 'Supabase', category: 'Auth/SSO', status: 'live', desc: 'Auth (Magic-Link, OAuth), Postgres, Edge Functions, Storage' },
  { name: 'n8n', category: 'Workflow', status: 'live', desc: 'Self-Hosted oder n8n.cloud — Workflow-Trigger und Callback-Handling' },
  { name: 'Slack', category: 'Communication', status: 'live', desc: 'Webhook für Sales-Lead-Notifications, Daily-Digest' },
  { name: 'Resend', category: 'Communication', status: 'live', desc: 'Transaktionale Emails (Audit-Reports, Welcome, Newsletter)' },
  { name: 'Anthropic', category: 'Data/Analytics', status: 'live', desc: 'Claude-Modelle für AI-Tools, Provider-Routing' },
  { name: 'OpenAI', category: 'Data/Analytics', status: 'live', desc: 'GPT-Modelle als Alternative-Provider' },
  { name: 'Google Vertex AI', category: 'Data/Analytics', status: 'live', desc: 'Gemini-Modelle EU-region-pinned' },
  { name: 'Ollama', category: 'Data/Analytics', status: 'live', desc: 'Lokale LLMs (Llama / Mistral) auf Frankfurt-VPS für vollständige EU-Souveränität' },
  { name: 'Sentry', category: 'Data/Analytics', status: 'live', desc: 'DSGVO-konform: sendDefaultPii=false, EU-Region wenn aktiviert' },
  { name: 'GitHub', category: 'Auth/SSO', status: 'live', desc: 'OAuth-Provider, Pages-Hosting' },
  { name: 'HubSpot', category: 'CRM/Marketing', status: 'planned', desc: 'CRM-Sync für Sales-Leads, geplant Q3/26' },
  { name: 'Pipedrive', category: 'CRM/Marketing', status: 'planned', desc: 'Alternative-CRM-Sync, geplant Q3/26' },
  { name: 'Microsoft Entra ID (Azure AD)', category: 'Auth/SSO', status: 'planned', desc: 'SAML/OIDC SSO für Enterprise-Tier, geplant Q4/26' },
  { name: 'Okta', category: 'Auth/SSO', status: 'planned', desc: 'SAML/OIDC SSO, geplant Q4/26' },
  { name: 'Datev', category: 'CRM/Marketing', status: 'planned', desc: 'Buchhaltungs-Export für DACH-Steuerberater, geplant 2027' },
  { name: 'Zapier', category: 'Workflow', status: 'beta', desc: 'Webhook-basierte Zaps — alle API-Endpoints triggerbar' },
  { name: 'Make (Integromat)', category: 'Workflow', status: 'beta', desc: 'Webhook-basierte Scenarios' },
];

const STATUS_META = {
  live: { label: 'Live', color: 'text-emerald-400 border-emerald-900 bg-emerald-950/40' },
  beta: { label: 'Beta', color: 'text-amber-400 border-amber-900 bg-amber-950/40' },
  planned: { label: 'Geplant', color: 'text-titanium-400 border-titanium-800 bg-obsidian-950' },
} as const;

export function Integrations() {
  const grouped = INTEGRATIONS.reduce((acc, i) => {
    (acc[i.category] ??= []).push(i);
    return acc;
  }, {} as Record<Integration['category'], Integration[]>);

  const categories: Integration['category'][] = [
    'Payment', 'Workflow', 'Auth/SSO', 'Communication', 'CRM/Marketing', 'Data/Analytics',
  ];

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center">
            <Plug className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Integrations</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-cyan-900 bg-cyan-950/30 text-cyan-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Plug className="h-3 w-3" /> Live-Integrations · Beta · Planned
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Integrations
            </h1>
            <p className="text-lg text-titanium-300 leading-relaxed">
              Was heute funktioniert, was in Beta ist, was wir planen. Ehrlich gekennzeichnet.
            </p>
          </div>

          <div className="space-y-8">
            {categories.map((cat) => {
              const items = grouped[cat] || [];
              if (items.length === 0) return null;
              return (
                <section key={cat}>
                  <h2 className="text-xl font-display font-bold text-titanium-50 mb-3">{cat}</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {items.map((i) => {
                      const meta = STATUS_META[i.status];
                      return (
                        <div key={i.name} className="p-3 bg-obsidian-900 border border-titanium-900 rounded-none">
                          <div className="flex items-start gap-2 flex-wrap">
                            <div className="font-display font-bold text-titanium-50 text-sm">{i.name}</div>
                            <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none ${meta.color}`}>
                              {meta.label}
                            </span>
                          </div>
                          <div className="text-xs text-titanium-400 leading-relaxed mt-1">{i.desc}</div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          <section className="mt-8">
            <h2 className="text-xl font-display font-bold text-titanium-50 mb-3">Custom-Integration</h2>
            <p className="text-titanium-300 text-sm leading-relaxed mb-3">
              Du nutzt etwas Spezifisches? Über unsere REST-API
              ({' '}<Link to="/api" className="text-security-400">/api</Link>) und Outbound-Webhooks lassen sich
              99% aller Tools anbinden, auch ohne dass wir eine offizielle Integration bauen.
              Im Enterprise-Tier können wir custom-Integrationen einplanen.
            </p>
            <a
              href="https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/issues"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-security-400 hover:underline text-sm"
            >
              Integration vorschlagen <ExternalLink className="h-3 w-3" />
            </a>
          </section>

          <div className="mt-12 p-6 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">Integration einrichten</h2>
            <p className="text-titanium-300 text-sm mb-4">
              Webhooks und API-Keys ab Growth-Tier. Pilot-Trial 14 Tage, keine Kreditkarte.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to="/pricing?source=integrations" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Pilot starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/api" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                API-Docs ansehen
              </Link>
              <Link to="/contact-sales?source=integrations" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                Custom-Integration anfragen
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/impressum" className="hover:text-titanium-300">Impressum</Link>
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
