const integrations = [
  'GitHub',
  'GitLab',
  'Jira',
  'Slack',
  'Vercel',
  'Netlify',
  'OpenAI',
  'Anthropic',
];

export function InfrastructureIntegrationsStrip() {
  return (
    <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-2">
              Integrations
            </div>
            <h2 className="font-display font-bold text-2xl text-titanium-50">
              Built for modern infrastructure.
            </h2>
            <p className="mt-2 text-sm text-silver-300">
              More integrations and governance agents coming soon.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {integrations.map((i) => (
              <span
                key={i}
                className="border border-silver-700/30 bg-obsidian-900/60 px-3 py-2 text-xs font-mono uppercase tracking-wider text-silver-300"
              >
                {i}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
