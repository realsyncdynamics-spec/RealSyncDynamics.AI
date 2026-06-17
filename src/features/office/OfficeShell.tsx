// OfficeShell — Rahmen für alle /app/office/* Views.
// Rendert die Office-Sub-Navigation (7 Bereiche) über dem aktiven View-Inhalt.
// Liegt selbst innerhalb der GovernanceBrowserShell (TopBar/Tabs/StatusBar).
import { Link } from 'react-router-dom';
import {
  FileText, Table2, Presentation, LayoutTemplate, CalendarClock,
  FileSignature, ShieldCheck, type LucideIcon,
} from 'lucide-react';
import { OFFICE_AREAS, type OfficeAreaId } from './officeAreas';

const ICON_MAP: Record<string, LucideIcon> = {
  FileText, Table2, Presentation, LayoutTemplate, CalendarClock, FileSignature, ShieldCheck,
};

function OfficeSubNav({ active }: { active: OfficeAreaId }) {
  return (
    <div className="shrink-0 bg-obsidian-900 border-b border-titanium-900">
      <div className="flex items-center gap-1 px-3 py-1.5 overflow-x-auto scrollbar-none">
        <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 pr-2 shrink-0">
          Office
        </span>
        {OFFICE_AREAS.map((area) => {
          const Icon = ICON_MAP[area.icon] ?? FileText;
          const isActive = area.id === active;
          return (
            <Link
              key={area.id}
              to={area.route}
              title={area.description}
              className={`group flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors border ${
                isActive
                  ? 'border-cyan-700 bg-obsidian-800 text-titanium-50'
                  : 'border-transparent text-titanium-400 hover:text-titanium-100 hover:bg-obsidian-800'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-cyan-400' : 'text-titanium-600 group-hover:text-titanium-300'}`} />
              <span>{area.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

interface OfficeShellProps {
  active: OfficeAreaId;
  children: React.ReactNode;
}

export function OfficeShell({ active, children }: OfficeShellProps) {
  return (
    <div className="flex flex-col h-full bg-obsidian-950 text-titanium-100">
      <OfficeSubNav active={active} />
      <div className="flex flex-col flex-1 min-h-0">{children}</div>
    </div>
  );
}
