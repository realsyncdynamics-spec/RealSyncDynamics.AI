// OfficeView — Governance-OS Office-Modul
// Arbeitsumgebung für Dokumente, Tabellen, Präsentationen, Meetings, Verträge
// und Policies. Jedes Objekt ist per Plattform-Garantie versioniert, auditiert
// und evidence-fähig (Herkunftsnachweis + Prüfpfad).
import React, { useState } from 'react';
import {
  FileText,
  Table2,
  Presentation,
  CalendarClock,
  FileSignature,
  ShieldCheck,
  Plus,
  Search,
  GitBranch,
  History,
  FileCheck2,
  Eye,
  Download,
  Pencil,
} from 'lucide-react';

// ── Typen ────────────────────────────────────────────────────────────────────
type OfficeCategoryId =
  | 'dokumente'
  | 'tabellen'
  | 'praesentationen'
  | 'meetings'
  | 'vertraege'
  | 'policies';

type OfficeItemStatus = 'aktiv' | 'entwurf' | 'review' | 'archiviert';

interface OfficeCategory {
  id: OfficeCategoryId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

interface OfficeItem {
  id: string;
  title: string;
  category: OfficeCategoryId;
  status: OfficeItemStatus;
  version: string;
  updatedAt: string;
  owner: string;
}

// ── Kategorien (Office-Bereiche aus der Zielarchitektur) ─────────────────────
const CATEGORIES: OfficeCategory[] = [
  {
    id: 'dokumente',
    label: 'Dokumente',
    icon: FileText,
    description: 'Texte, Berichte und Notizen — versioniert wie Code.',
  },
  {
    id: 'tabellen',
    label: 'Tabellen',
    icon: Table2,
    description: 'Strukturierte Daten, Register und Kalkulationen.',
  },
  {
    id: 'praesentationen',
    label: 'Präsentationen',
    icon: Presentation,
    description: 'Decks für Audits, Reviews und Stakeholder.',
  },
  {
    id: 'meetings',
    label: 'Meetings',
    icon: CalendarClock,
    description: 'Protokolle, Beschlüsse und Aufgaben mit Prüfpfad.',
  },
  {
    id: 'vertraege',
    label: 'Verträge',
    icon: FileSignature,
    description: 'AVV, NDAs und Rahmenverträge mit Signaturkette.',
  },
  {
    id: 'policies',
    label: 'Policies',
    icon: ShieldCheck,
    description: 'Richtlinien, TOMs und Governance-Vorgaben.',
  },
];

// ── Mock-Objekte (konsistent mit übrigen Governance-Views ohne Backend) ──────
const ITEMS: OfficeItem[] = [
  { id: 'd1', title: 'Quartalsbericht Governance Q2/2026', category: 'dokumente', status: 'review', version: 'v4.1', updatedAt: '16.06.2026', owner: 'DSB' },
  { id: 'd2', title: 'Onboarding-Handbuch Mandanten', category: 'dokumente', status: 'aktiv', version: 'v2.0', updatedAt: '11.06.2026', owner: 'Operations' },
  { id: 't1', title: 'Risiko-Register 2026', category: 'tabellen', status: 'aktiv', version: 'v7.3', updatedAt: '15.06.2026', owner: 'Risk Lead' },
  { id: 't2', title: 'Vendor-Kostenübersicht', category: 'tabellen', status: 'entwurf', version: 'v0.9', updatedAt: '09.06.2026', owner: 'Finance' },
  { id: 'p1', title: 'AI-Act-Readiness Board-Deck', category: 'praesentationen', status: 'aktiv', version: 'v1.4', updatedAt: '13.06.2026', owner: 'GF' },
  { id: 'm1', title: 'DSB-Jour-fixe 24/2026', category: 'meetings', status: 'aktiv', version: 'v1.0', updatedAt: '14.06.2026', owner: 'DSB' },
  { id: 'm2', title: 'Incident-Review #2026-041', category: 'meetings', status: 'review', version: 'v1.2', updatedAt: '12.06.2026', owner: 'Security' },
  { id: 'v1', title: 'AVV — Hosting-Anbieter (EU)', category: 'vertraege', status: 'aktiv', version: 'v2.1', updatedAt: '01.06.2026', owner: 'Legal' },
  { id: 'v2', title: 'NDA — Auditpartner', category: 'vertraege', status: 'entwurf', version: 'v0.4', updatedAt: '10.06.2026', owner: 'Legal' },
  { id: 'po1', title: 'KI-Nutzungsrichtlinie', category: 'policies', status: 'aktiv', version: 'v3.0', updatedAt: '05.06.2026', owner: 'DSB' },
  { id: 'po2', title: 'TOM — Technische & Org. Maßnahmen', category: 'policies', status: 'review', version: 'v2.0', updatedAt: '08.06.2026', owner: 'IT-Security' },
  { id: 'po3', title: 'Aufbewahrungs- & Löschkonzept', category: 'policies', status: 'archiviert', version: 'v1.5', updatedAt: '20.02.2026', owner: 'DSB' },
];

// ── Status-Badge ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<OfficeItemStatus, { label: string; classes: string }> = {
  aktiv: { label: 'Aktiv', classes: 'bg-teal-600/20 border-teal-600/40 text-teal-400' },
  entwurf: { label: 'Entwurf', classes: 'bg-blue-600/20 border-blue-600/40 text-blue-400' },
  review: { label: 'Review', classes: 'bg-amber-600/20 border-amber-600/40 text-amber-400' },
  archiviert: { label: 'Archiviert', classes: 'bg-titanium-700/20 border-titanium-700/40 text-titanium-400' },
};

function StatusBadge({ status }: { status: OfficeItemStatus }) {
  const { label, classes } = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 border font-mono text-[10px] ${classes}`}>
      {label}
    </span>
  );
}

// ── Garantie-Chip (versioniert · auditiert · evidence-fähig) ─────────────────
function GuaranteeChip({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-titanium-400">
      <Icon className="h-3 w-3 text-cyan-400" />
      {label}
    </span>
  );
}

// ── Kategorie-Kachel ─────────────────────────────────────────────────────────
function CategoryCard({
  category,
  count,
  active,
  onSelect,
}: {
  category: OfficeCategory;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = category.icon;
  return (
    <button
      onClick={onSelect}
      className={`text-left bg-obsidian-900 border p-4 transition-colors ${
        active ? 'border-cyan-400/60' : 'border-titanium-900 hover:border-titanium-700'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 flex items-center justify-center bg-obsidian-800 border border-titanium-800">
          <Icon className={`h-4 w-4 ${active ? 'text-cyan-400' : 'text-titanium-400'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-titanium-100 leading-tight">{category.label}</h3>
            <span className="font-mono text-[11px] text-titanium-500">{count}</span>
          </div>
          <p className="text-xs text-titanium-500 mt-1 leading-snug">{category.description}</p>
        </div>
      </div>
    </button>
  );
}

// ── OfficeView ───────────────────────────────────────────────────────────────
export function OfficeView() {
  const [activeCategory, setActiveCategory] = useState<OfficeCategoryId | 'alle'>('alle');
  const [search, setSearch] = useState('');

  const countFor = (id: OfficeCategoryId) => ITEMS.filter((i) => i.category === id).length;

  const filtered = ITEMS.filter((item) => {
    const matchesCategory = activeCategory === 'alle' || item.category === activeCategory;
    const matchesSearch = !search || item.title.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const activeLabel =
    activeCategory === 'alle'
      ? 'Alle Objekte'
      : CATEGORIES.find((c) => c.id === activeCategory)?.label ?? 'Objekte';

  return (
    <div className="flex flex-col h-full bg-obsidian-950 text-titanium-100">
      {/* Header */}
      <div className="border-b border-titanium-900 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-display font-semibold text-titanium-100 tracking-tight">
              Office
            </h1>
            <p className="font-mono text-xs text-titanium-500 mt-0.5">
              Dokumente · Tabellen · Präsentationen · Meetings · Verträge · Policies
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-xs font-mono hover:bg-teal-500 transition-colors">
            <Plus className="h-3.5 w-3.5" />
            Neues Objekt
          </button>
        </div>
      </div>

      {/* Plattform-Garantie */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-6 py-2.5 border-b border-titanium-900 bg-obsidian-900/40 shrink-0">
        <span className="font-mono text-[10px] uppercase tracking-widest text-titanium-600">
          Jedes Objekt automatisch
        </span>
        <GuaranteeChip icon={GitBranch} label="versioniert" />
        <GuaranteeChip icon={History} label="auditiert (Prüfpfad)" />
        <GuaranteeChip icon={FileCheck2} label="evidence-fähig (Herkunftsnachweis)" />
      </div>

      {/* Kategorie-Launcher */}
      <div className="px-6 py-4 border-b border-titanium-900 shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {CATEGORIES.map((cat) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              count={countFor(cat.id)}
              active={activeCategory === cat.id}
              onSelect={() =>
                setActiveCategory((prev) => (prev === cat.id ? 'alle' : cat.id))
              }
            />
          ))}
        </div>
      </div>

      {/* Aktionsleiste */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-titanium-900 shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-titanium-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Objekt suchen …"
            className="w-full bg-obsidian-900 border border-titanium-800 pl-9 pr-3 py-1.5 text-xs font-mono text-titanium-100 placeholder-titanium-600 outline-none focus:border-teal-700 transition-colors"
          />
        </div>
        <span className="font-mono text-[11px] text-titanium-500">
          {activeLabel} · {filtered.length}
        </span>
        {activeCategory !== 'alle' && (
          <button
            onClick={() => setActiveCategory('alle')}
            className="px-3 py-1.5 text-[11px] font-mono text-titanium-400 border border-titanium-800 hover:bg-obsidian-800 transition-colors"
          >
            Alle anzeigen
          </button>
        )}
      </div>

      {/* Objekt-Liste */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-10 w-10 text-titanium-700 mb-3" />
            <p className="text-sm text-titanium-500">Keine Objekte gefunden</p>
            <p className="font-mono text-xs text-titanium-600 mt-1">Filter anpassen oder neues Objekt anlegen</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-obsidian-900 border-b border-titanium-900">
              <tr className="font-mono text-[10px] uppercase tracking-widest text-titanium-600">
                <th className="px-6 py-2 font-normal">Objekt</th>
                <th className="px-3 py-2 font-normal hidden md:table-cell">Bereich</th>
                <th className="px-3 py-2 font-normal">Status</th>
                <th className="px-3 py-2 font-normal hidden lg:table-cell">Version</th>
                <th className="px-3 py-2 font-normal hidden lg:table-cell">Aktualisiert</th>
                <th className="px-3 py-2 font-normal hidden xl:table-cell">Verantwortlich</th>
                <th className="px-6 py-2 font-normal text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const cat = CATEGORIES.find((c) => c.id === item.category);
                const Icon = cat?.icon ?? FileText;
                return (
                  <tr
                    key={item.id}
                    className="border-b border-titanium-900/60 hover:bg-obsidian-900/60 transition-colors"
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 text-titanium-500 shrink-0" />
                        <span className="text-sm text-titanium-100">{item.title}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <span className="font-mono text-[11px] text-titanium-500">{cat?.label}</span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell">
                      <span className="font-mono text-xs text-titanium-300">{item.version}</span>
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell">
                      <span className="font-mono text-xs text-titanium-400">{item.updatedAt}</span>
                    </td>
                    <td className="px-3 py-3 hidden xl:table-cell">
                      <span className="font-mono text-xs text-titanium-400">{item.owner}</span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          title="Anzeigen"
                          className="p-1.5 text-titanium-400 border border-titanium-800 hover:bg-obsidian-800 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title="Bearbeiten"
                          className="p-1.5 text-titanium-400 border border-titanium-800 hover:bg-obsidian-800 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title="Export"
                          className="p-1.5 text-titanium-400 border border-titanium-800 hover:bg-obsidian-800 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
