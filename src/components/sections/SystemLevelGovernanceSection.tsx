import { Globe2, Network, ServerCog, Workflow } from 'lucide-react';

const layers = [
  {
    icon: Globe2,
    title: 'Website Layer',
    text: 'Seiten, Formulare, Cookies, Tracker, Tag Manager und Consent-Verhalten.',
  },
  {
    icon: ServerCog,
    title: 'API Layer',
    text: 'Backend-Endpunkte, Datenflüsse, externe Dienste und Vendor-Verbindungen.',
  },
  {
    icon: Network,
    title: 'AI Layer',
    text: 'KI-Usecases, Modelle, Datenkategorien, Outputs und AI-Act-Risikoklassen.',
  },
  {
    icon: Workflow,
    title: 'Agent Layer',
    text: 'Autonome Workflows, Agent-Aktionen, Freigaben, Logs und Evidence.',
  },
];

export function SystemLevelGovernanceSection() {
  return (
    <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
            System-Level Governance
          </div>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-tight">
            RealSync betrachtet die komplette operative Kette.
          </h2>
          <p className="mt-4 text-silver-300 text-base sm:text-lg leading-relaxed">
            Nicht nur eine einzelne Website. Nicht nur ein einzelnes Modell. RealSyncDynamics.AI
            analysiert Websites, Formulare, APIs, KI-Systeme, Third-Party-Vendoren und autonome
            Workflows als zusammenhängende Governance-Infrastruktur.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {layers.map((layer) => {
            const Icon = layer.icon;
            return (
              <article
                key={layer.title}
                className="bg-obsidian-900/60 border border-silver-700/30 p-5"
              >
                <div className="h-9 w-9 flex items-center justify-center border border-titanium-100/30 bg-titanium-100/5 text-titanium-100 mb-4">
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <h3 className="font-display font-bold text-lg text-titanium-50">{layer.title}</h3>
                <p className="mt-2 text-sm text-silver-300 leading-relaxed">{layer.text}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
