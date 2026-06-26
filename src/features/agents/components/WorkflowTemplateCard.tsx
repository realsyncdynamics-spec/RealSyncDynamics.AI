interface WorkflowTemplate {
  id: string;
  title: string;
  category: string | null;
  trigger_type: string | null;
  required_integrations: string[];
  implementation_notes: string | null;
}

interface WorkflowTemplateCardProps {
  template: WorkflowTemplate;
}

export function WorkflowTemplateCard({ template }: WorkflowTemplateCardProps) {
  return (
    <div className="border border-titanium-800 bg-obsidian-950 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-titanium-50 leading-snug">{template.title}</h3>
        {template.category && (
          <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border border-titanium-700 text-titanium-400 shrink-0">
            {template.category}
          </span>
        )}
      </div>

      {template.trigger_type && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-titanium-500 font-mono uppercase tracking-wide">Trigger:</span>
          <span className="font-mono text-[10px] text-cyan-400">{template.trigger_type}</span>
        </div>
      )}

      {template.required_integrations.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {template.required_integrations.map((integration) => (
            <span
              key={integration}
              className="font-mono text-[10px] px-1.5 py-0.5 border border-titanium-800 text-titanium-400 bg-obsidian-900"
            >
              {integration}
            </span>
          ))}
        </div>
      )}

      {template.implementation_notes && (
        <p className="text-xs text-titanium-400 leading-relaxed line-clamp-2">
          {template.implementation_notes}
        </p>
      )}
    </div>
  );
}
