// OfficeHome — Hub-Landing für die Office-OS-Sektion (/app/office).
// Zeigt die 7 Bereiche als Karten und eine kurze Einordnung der Schicht.
import { Link } from 'react-router-dom';
import {
  FileText, Table2, Presentation, LayoutTemplate, CalendarClock,
  FileSignature, ShieldCheck, ArrowRight, Briefcase, type LucideIcon,
} from 'lucide-react';
import { OFFICE_AREAS } from './officeAreas';

const ICON_MAP: Record<string, LucideIcon> = {
  FileText, Table2, Presentation, LayoutTemplate, CalendarClock, FileSignature, ShieldCheck,
};

const STATUS_LABEL: Record<string, { label: string; classes: string }> = {
  live: { label: 'Live', classes: 'text-teal-400 border-teal-800' },
  beta: { label: 'Beta', classes: 'text-cyan-400 border-cyan-800' },
  roadmap: { label: 'Roadmap', classes: 'text-titanium-500 border-titanium-800' },
};

export function OfficeHome() {
  return (
    <div className="flex flex-col h-full bg-obsidian-950 text-titanium-100 overflow-y-auto">
      {/* Hero */}
      <div className="border-b border-titanium-900 px-6 py-8">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 flex items-center justify-center bg-obsidian-800 border border-titanium-800">
            <Briefcase className="h-5 w-5 text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-semibold text-titanium-50 tracking-tight">Office</h1>
            <p className="font-mono text-xs text-titanium-500 mt-1">
              Governance-fähige Dokumenten- und Arbeitsumgebung im Governance OS
            </p>
          </div>
        </div>
        <p className="text-sm text-titanium-400 leading-relaxed mt-5 max-w-2xl">
          Office OS ersetzt nicht klassische Bürosoftware — es bringt Dokumente, Tabellen,
          Präsentationen, Verträge und Policies in dieselbe souveräne Umgebung wie Risiken,
          Evidence und Monitoring. Jedes Artefakt erhält Versionierung, Freigaben und einen
          Prüfpfad direkt neben deinen Governance-Daten.
        </p>
      </div>

      {/* Bereich-Karten */}
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {OFFICE_AREAS.map((area) => {
            const Icon = ICON_MAP[area.icon] ?? FileText;
            const status = STATUS_LABEL[area.status];
            return (
              <Link
                key={area.id}
                to={area.route}
                className="group bg-obsidian-900 border border-titanium-900 hover:border-cyan-800 transition-colors p-5 flex flex-col"
              >
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 flex items-center justify-center bg-obsidian-800 border border-titanium-800 group-hover:border-cyan-900 transition-colors">
                    <Icon className="h-5 w-5 text-titanium-300 group-hover:text-cyan-400 transition-colors" />
                  </div>
                  <span className={`font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 border ${status.classes}`}>
                    {status.label}
                  </span>
                </div>
                <h2 className="text-base font-semibold text-titanium-100 mt-4">{area.label}</h2>
                <p className="text-xs text-titanium-500 leading-relaxed mt-1.5 flex-1">{area.description}</p>
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-titanium-500 group-hover:text-cyan-400 transition-colors mt-4">
                  Öffnen <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
