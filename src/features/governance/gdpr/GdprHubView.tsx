// GdprHubView.tsx — DSGVO-Hub mit Navigation zu Sub-Modulen
import { useNavigate } from 'react-router-dom';
import {
  Users, FileWarning, AlertCircle, FileText,
  ShieldCheck, ClipboardCheck,
} from 'lucide-react';

const GDPR_MODULES = [
  { id: 'dsr',       label: 'DSR Tracker',   icon: Users,          route: '/app/dsr',       desc: 'Betroffenenanfragen erfassen und verwalten' },
  { id: 'dpia',      label: 'DSFA / DPIA',   icon: FileWarning,    route: '/app/dpia',      desc: 'Datenschutzfolgenabschätzung durchführen' },
  { id: 'incidents', label: 'Datenpannen',   icon: AlertCircle,    route: '/app/incidents', desc: 'Incident-Tracking, Meldepflichten, 72h-Frist' },
  { id: 'documents', label: 'Dokumente',     icon: FileText,       route: '/app/documents', desc: 'DSE, AVV, TOM, VVT automatisch generieren' },
  { id: 'risks',     label: 'Risiken',       icon: ShieldCheck,    route: '/app/risks',     desc: 'DSGVO-Ampel, Risikoklassen und Maßnahmen' },
  { id: 'audit',     label: 'Audit Export',  icon: ClipboardCheck, route: '/app/audit',     desc: 'Behördenexporte, Nachweise und Prüfpfad' },
];

export function GdprHubView() {
  const navigate = useNavigate();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-mono text-lg font-bold text-titanium-100 tracking-tight">DSGVO-Compliance</h1>
        <p className="font-mono text-xs text-titanium-500 mt-1">
          Datenschutz-Management: DSR-Tracker, Incidents, DSFA, Dokumente, Risiken und Audit
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {GDPR_MODULES.map((mod) => {
          const Icon = mod.icon;
          return (
            <button
              key={mod.id}
              onClick={() => navigate(mod.route)}
              className="flex flex-col items-start text-left border border-titanium-800 bg-obsidian-900 p-5 hover:border-teal-700 transition-colors"
            >
              <div className="p-2 bg-obsidian-800 border border-titanium-800 mb-3">
                <Icon className="h-4 w-4 text-teal-400" />
              </div>
              <h3 className="font-mono text-sm font-semibold text-titanium-100 mb-1">{mod.label}</h3>
              <p className="font-mono text-[11px] text-titanium-500 leading-relaxed">{mod.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
