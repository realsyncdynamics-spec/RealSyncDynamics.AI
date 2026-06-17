// OfficeView.tsx — Office-Modul: Dokumente, Tabellen, Verträge, Policies, Vorlagen
import type React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Table2, Presentation, FileSignature,
  BookOpen, LayoutTemplate, CalendarDays,
} from 'lucide-react';

interface OfficeCard {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
  status: 'live' | 'roadmap';
  route: string | null;
}

const OFFICE_CARDS: OfficeCard[] = [
  { id: 'docs',          label: 'Dokumente',     icon: FileText,       desc: 'Datenschutzerklärungen, AVV, TOM, VVT generieren', status: 'live',    route: '/app/documents' },
  { id: 'tables',        label: 'Tabellen',      icon: Table2,         desc: 'Compliance-Tabellen und Datenregister',            status: 'roadmap', route: null },
  { id: 'presentations', label: 'Präsentationen',icon: Presentation,   desc: 'Board-Decks, Governance-Reports als Slides',       status: 'roadmap', route: null },
  { id: 'contracts',     label: 'Verträge',      icon: FileSignature,  desc: 'Vertragsmanagement, DPA-Tracking, Signaturen',     status: 'roadmap', route: null },
  { id: 'policies',      label: 'Policies',      icon: BookOpen,       desc: 'IT-Sicherheitsrichtlinien, IS-Policies, Richtlinien', status: 'roadmap', route: null },
  { id: 'templates',     label: 'Vorlagen',      icon: LayoutTemplate, desc: 'Wiederverwendbare Dokument-Templates und Bausteine', status: 'roadmap', route: null },
  { id: 'meetings',      label: 'Meetings',      icon: CalendarDays,   desc: 'DSB-Sitzungen, Protokolle, Tagesordnungspunkte',   status: 'roadmap', route: null },
];

export function OfficeView() {
  const navigate = useNavigate();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-mono text-lg font-bold text-titanium-100 tracking-tight">Office</h1>
        <p className="font-mono text-xs text-titanium-500 mt-1">
          Dokumente, Tabellen, Verträge, Policies und Vorlagen — DSGVO-konform und revisionsicher
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {OFFICE_CARDS.map((card) => {
          const Icon = card.icon;
          const isLive = card.status === 'live';
          return (
            <div
              key={card.id}
              role={isLive ? 'button' : undefined}
              tabIndex={isLive ? 0 : undefined}
              onClick={() => isLive && card.route && navigate(card.route)}
              onKeyDown={(e) => e.key === 'Enter' && isLive && card.route && navigate(card.route)}
              className={`border p-5 transition-colors ${
                isLive
                  ? 'border-titanium-800 bg-obsidian-900 hover:border-teal-700 cursor-pointer'
                  : 'border-titanium-900 bg-obsidian-950 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-obsidian-800 border border-titanium-800">
                  <Icon className="h-4 w-4 text-teal-400" />
                </div>
                <span
                  className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 border ${
                    isLive
                      ? 'text-teal-400 border-teal-900 bg-teal-950'
                      : 'text-titanium-600 border-titanium-800'
                  }`}
                >
                  {isLive ? 'live' : 'roadmap'}
                </span>
              </div>
              <h3 className="font-mono text-sm font-semibold text-titanium-100 mb-1">{card.label}</h3>
              <p className="font-mono text-[11px] text-titanium-500 leading-relaxed">{card.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-8 border border-titanium-900 bg-obsidian-900 p-4">
        <p className="font-mono text-[11px] text-titanium-500">
          <span className="text-teal-400">Hinweis:</span> Roadmap-Module werden im nächsten Release-Zyklus aktiviert.
          Für Tabellen und Präsentationen ist eine direkte Integration mit dem Evidence Vault geplant.
        </p>
      </div>
    </div>
  );
}
