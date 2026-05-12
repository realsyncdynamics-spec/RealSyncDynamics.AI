const TOOL_LABELS: Record<string, string> = {
  list_assets: 'Assets gelistet',
  get_risk_summary: 'Risiko-Übersicht',
  list_dpias: 'DPIAs gelistet',
  list_incidents: 'Incidents gelistet',
  list_vendors: 'Vendoren gelistet',
  get_regulation_info: 'Regulierung nachgeschlagen',
  escalate_to_human: 'An Mensch eskaliert',
};

export function ToolBadges({ actions }: { actions?: string[] }) {
  if (!actions || actions.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {actions.map((a, i) => (
        <span
          key={`${a}-${i}`}
          className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-300"
        >
          {TOOL_LABELS[a] ?? a}
        </span>
      ))}
    </div>
  );
}
