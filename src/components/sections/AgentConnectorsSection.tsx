import { Code2, Workflow, Boxes, Plug, ArrowRight, Lock } from 'lucide-react';

/**
 * AgentConnectorsSection — Public-Marketing fuer die 4 SDK/Workflow-
 * Integrations-Pfade (OpenAI / Anthropic / n8n / Make).
 *
 * Eingebettet auf /ai-governance unter EnterpriseEvidenceVaultSection als
 * letzter Roadmap-Layer.
 */

const CONNECTORS = [
  {
    icon: Code2,
    title: 'OpenAI Wrapper',
    sub: 'TypeScript-Drop-in',
    detail:
      'logOpenAiChatCompletion() Per-Call-Helper + wrapOpenAiClient() Proxy. Sendet pro openai.chat.completions.create einen response_received-Event mit Token-Counts, Latenz, Vendor=openai.',
    snippet: `import { wrapOpenAiClient } from '@rsd/connectors';
const wrapped = wrapOpenAiClient(openai, {
  telemetry,
  defaults: { dataClass: 'internal', team: 'Eng' },
});`,
  },
  {
    icon: Code2,
    title: 'Anthropic Wrapper',
    sub: 'TypeScript-Drop-in',
    detail:
      'logAnthropicMessage() + wrapAnthropicClient() — gleiche Shape wie OpenAI-Connector. input_tokens / output_tokens werden korrekt auf prompt_tokens / response_tokens gemappt.',
    snippet: `import { wrapAnthropicClient } from '@rsd/connectors';
const wrapped = wrapAnthropicClient(claude, {
  telemetry,
  defaults: { dataClass: 'confidential' },
});`,
  },
  {
    icon: Workflow,
    title: 'n8n Custom Node',
    sub: 'Self-Hosted-n8n',
    detail:
      'RsdAiTelemetry-Node mit allen Event-Properties als Dropdowns. Credentials-Type fuer Endpoint + Tenant-Key. Response-Field rsd_telemetry mit policy_status fuer Folge-Nodes.',
    snippet: `[OpenAI Node] → [RSD AI Telemetry] → [Slack Alert]
                  ▲
                  if policy_status === 'blocked'`,
  },
  {
    icon: Boxes,
    title: 'Make.com Blueprint',
    sub: 'Cloud-Workflow',
    detail:
      'Importierbares JSON-Blueprint mit HTTP-Modul-Vorlage. Connection-fertig fuer eu1.make.com. Felder per Drag&Drop aus Vorgaenger-Modulen mappbar.',
    snippet: `Webhook → OpenAI → HTTP (RSD Telemetry) → Mailgun
              POST /api/telemetry/ai-event
              x-rsd-tenant-key: <UUID>`,
  },
];

export interface AgentConnectorsSectionProps {
  eyebrow?: string;
  headline?: string;
  subline?: string;
}

export function AgentConnectorsSection({
  eyebrow = 'Agent Connectors · SDK + Workflow-Integrations',
  headline = 'Verkabelt das Compliance-OS in den Stack, den Sie schon einsetzen.',
  subline = 'Vier Pfade ins Telemetry-Backend: OpenAI- und Anthropic-SDK-Wrapper für Code, n8n-Custom-Node für Self-Hosted-Workflows, Make.com-Blueprint für Cloud-Scenarios. Alle vier halten den Privacy-Default — Presence statt Content.',
}: AgentConnectorsSectionProps = {}) {
  return (
    <section
      id="agent-connectors"
      className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-obsidian-950/50"
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 sm:mb-12">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
            {eyebrow}
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight max-w-3xl">
            {headline}
          </h2>
          <p className="mt-4 max-w-3xl text-silver-300 text-sm sm:text-base leading-relaxed">
            {subline}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 mb-10">
          {CONNECTORS.map((c) => {
            const Icon = c.icon;
            return (
              <article
                key={c.title}
                className="bg-obsidian-900/80 border border-silver-700/30 p-5 sm:p-6"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-5 w-5 text-gold-400" />
                  <h3 className="font-display font-bold text-titanium-50 text-base sm:text-lg">
                    {c.title}
                  </h3>
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-silver-500">
                    {c.sub}
                  </span>
                </div>
                <p className="text-sm text-silver-300 leading-relaxed mb-3">{c.detail}</p>
                <pre className="bg-obsidian-950 border border-silver-800/50 p-3 overflow-x-auto text-[11px] font-mono text-silver-200 leading-relaxed">
                  {c.snippet}
                </pre>
              </article>
            );
          })}
        </div>

        {/* Privacy-Note */}
        <div className="bg-obsidian-900/60 border-l-2 border-l-emerald-400/70 border border-silver-700/30 p-5 sm:p-6 mb-10">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-display font-bold text-titanium-50 text-sm sm:text-base mb-1">
                Vier Pfade, ein Privacy-Default
              </div>
              <p className="text-sm text-silver-300 leading-relaxed">
                Alle Connectors senden ausschliesslich Metadaten — Vendor, Modell, Token-Counts,
                Latenz, Datenklasse, Risk-Level. Prompt- und Response-Texte verlassen nie den
                Prozess in dem Sie laufen. Telemetry-Failures blocken nie den Original-AI-Call.
              </p>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/tree/main/connectors"
            target="_blank"
            rel="noreferrer noopener"
            className="surface-gold inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-none"
          >
            <Plug className="h-4 w-4" /> Connectors auf GitHub <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="/contact-sales?intent=connectors"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-silver-500 hover:border-gold-400 text-silver-100 hover:text-titanium-50 text-sm font-semibold rounded-none transition-colors"
          >
            Custom-Integration anfragen
          </a>
        </div>

        <p className="mt-4 text-[11px] font-mono uppercase tracking-[0.18em] text-silver-500">
          Folgt: npm-Packages · Python-Connectors · Zapier · LangChain-Callbacks
        </p>
      </div>
    </section>
  );
}
