import { Globe, Zap, MessageSquare, Building2, Workflow, Code } from 'lucide-react';

export type ApiPurpose = 'website' | 'tool' | 'chatbot' | 'crm' | 'automation' | 'custom';

interface ApiPurposeStepProps {
  selected: ApiPurpose | null;
  onChange: (purpose: ApiPurpose) => void;
}

const purposes: Array<{
  id: ApiPurpose;
  icon: React.ReactNode;
  label: string;
  description: string;
}> = [
  {
    id: 'website',
    icon: <Globe className="h-5 w-5" />,
    label: 'Meine Website',
    description: 'Compliance-Checks direkt auf meiner Seite einbinden',
  },
  {
    id: 'tool',
    icon: <Zap className="h-5 w-5" />,
    label: 'Externes Tool',
    description: 'CMS, Shopify, WordPress, etc.',
  },
  {
    id: 'chatbot',
    icon: <MessageSquare className="h-5 w-5" />,
    label: 'Bot / Chatbot',
    description: 'KI-Assistent oder Support-Bot',
  },
  {
    id: 'crm',
    icon: <Building2 className="h-5 w-5" />,
    label: 'CRM oder Kundensystem',
    description: 'Salesforce, HubSpot, Pipedrive, etc.',
  },
  {
    id: 'automation',
    icon: <Workflow className="h-5 w-5" />,
    label: 'Make / Zapier / n8n',
    description: 'Automatisierungs-Workflows',
  },
  {
    id: 'custom',
    icon: <Code className="h-5 w-5" />,
    label: 'Eigene Software',
    description: 'Meine Entwickler verbinden es',
  },
];

export function ApiPurposeStep({ selected, onChange }: ApiPurposeStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-display font-bold text-titanium-50 mb-2">
          Wofür möchtest du RealSyncDynamics.AI verbinden?
        </h3>
        <p className="text-sm text-titanium-400">
          Das hilft uns dir später die richtigen Code-Beispiele zu zeigen.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {purposes.map((p) => (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className={`p-4 text-left border rounded-none transition-all ${
              selected === p.id
                ? 'bg-security-600 border-security-500 text-white'
                : 'bg-obsidian-900 border-titanium-800 text-titanium-100 hover:border-security-500'
            }`}
            data-testid={`api-purpose-${p.id}`}
          >
            <div className="flex items-start gap-3 mb-2">
              <div className="shrink-0 mt-0.5">{p.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm">{p.label}</div>
                <div className="text-xs opacity-80 mt-0.5">{p.description}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
