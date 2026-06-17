// GovernanceCommandPalette — ⌘K Schnellnavigation
// Modul-Suche und Aktionspalette für alle Governance OS Routen.
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Home, Globe, FileCheck2, Cpu, AlertTriangle, Activity,
  Building2, BarChart3, Users, Settings, Bot, GitMerge, FileText,
  ClipboardCheck, X, LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';

interface PaletteItem {
  id: string;
  label: string;
  description: string;
  route: string;
  Icon: LucideIcon;
  group: string;
  keywords: string[];
}

const ITEMS: PaletteItem[] = [
  { id: 'overview',  label: 'Übersicht',        description: 'Governance OS Dashboard',               route: '/app',              Icon: LayoutDashboard, group: 'Module',   keywords: ['dashboard', 'home', 'start'] },
  { id: 'websites',  label: 'Websites',          description: 'Website-Governance, Scans & Findings',  route: '/app/websites',     Icon: Globe,           group: 'Module',   keywords: ['domain', 'scan', 'cookie', 'dsgvo'] },
  { id: 'evidence',  label: 'Evidence Vault',    description: 'Hashes, Snapshots, Audit Trails',       route: '/app/evidence',     Icon: FileCheck2,      group: 'Module',   keywords: ['nachweis', 'hash', 'c2pa', 'snapshot'] },
  { id: 'ai',        label: 'KI-Systeme',        description: 'KI-Registry & EU AI Act',               route: '/app/ai-systems',   Icon: Cpu,             group: 'Module',   keywords: ['ai', 'ki', 'eu ai act', 'hochrisiko'] },
  { id: 'risks',     label: 'Risiken',           description: 'Risikoidentifikation & Ampelsystem',    route: '/app/risks',        Icon: AlertTriangle,   group: 'Module',   keywords: ['risk', 'kritisch', 'incident', 'dsfa'] },
  { id: 'monitor',   label: 'Monitoring',        description: 'Runtime Monitoring & Drift Alerts',     route: '/app/monitoring',   Icon: Activity,        group: 'Module',   keywords: ['alert', 'drift', 'live', 'runtime'] },
  { id: 'vendors',   label: 'Vendors',           description: 'Vendor- und DPA-Tracking',              route: '/app/vendors',      Icon: Building2,       group: 'Module',   keywords: ['vendor', 'dpa', 'avv', 'auftrags'] },
  { id: 'reports',   label: 'Reports',           description: 'Compliance- und Audit-Reports',         route: '/app/reports',      Icon: BarChart3,       group: 'Module',   keywords: ['report', 'bericht', 'compliance'] },
  { id: 'agents',    label: 'Agenten',           description: 'Enterprise Skills – 15 Governance-Agenten', route: '/app/agents',  Icon: Bot,             group: 'Module',   keywords: ['agent', 'ki', 'skill', 'automation'] },
  { id: 'workflows', label: 'Workflows',         description: 'DSGVO-Prozesse automatisieren (n8n)',   route: '/app/workflows',    Icon: GitMerge,        group: 'Module',   keywords: ['n8n', 'workflow', 'automation', 'prozess'] },
  { id: 'documents', label: 'Dokumente',         description: 'DSE, AVV, TOM, VVT, DSFA Generator',   route: '/app/documents',    Icon: FileText,        group: 'Module',   keywords: ['dse', 'avv', 'tom', 'vvt', 'dokument'] },
  { id: 'audit',     label: 'Audit Export',      description: 'Audit-Ready Reports & Behördenexporte', route: '/app/audit',       Icon: ClipboardCheck,  group: 'Module',   keywords: ['export', 'behörde', 'pdf', 'bsi'] },
  { id: 'team',      label: 'Team',              description: 'Rollen, Team & Zugriff',                route: '/app/team',         Icon: Users,           group: 'Verwaltung', keywords: ['user', 'team', 'rolle', 'zugriff'] },
  { id: 'settings',  label: 'Einstellungen',     description: 'Mandant, Sicherheit & Integrationen',   route: '/app/settings',     Icon: Settings,        group: 'Verwaltung', keywords: ['settings', 'integration', 'api', 'key'] },
  { id: 'home',      label: 'Startseite',        description: 'Marketing & Landing Page',              route: '/',                 Icon: Home,            group: 'Navigation', keywords: ['landing', 'home', 'start', 'marketing'] },
];

const GROUP_ORDER = ['Module', 'Verwaltung', 'Navigation'];

interface GovernanceCommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function GovernanceCommandPalette({ open, onClose }: GovernanceCommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? ITEMS.filter((item) => {
        const q = query.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.keywords.some((k) => k.includes(q))
        );
      })
    : ITEMS;

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  const handleSelect = useCallback((item: PaletteItem) => {
    navigate(item.route);
    onClose();
  }, [navigate, onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[activeIdx]) handleSelect(filtered[activeIdx]);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, filtered, activeIdx, handleSelect, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!open) return null;

  // Group items preserving filter order
  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: filtered.filter((i) => i.group === group),
  })).filter((g) => g.items.length > 0);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-obsidian-950/80"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-xl bg-obsidian-900 border border-titanium-800 shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-titanium-900">
          <Search className="h-4 w-4 text-titanium-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Modul oder Aktion suchen …"
            className="flex-1 bg-transparent text-sm font-mono text-titanium-100 placeholder-titanium-600 outline-none"
          />
          <button onClick={onClose} className="text-titanium-600 hover:text-titanium-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[380px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-10 text-center font-mono text-xs text-titanium-600">
              Kein Ergebnis für „{query}"
            </div>
          ) : (
            grouped.map(({ group, items }) => (
              <div key={group}>
                <div className="px-4 py-1.5 font-mono text-[9px] uppercase tracking-widest text-titanium-700 bg-obsidian-950/40 border-b border-titanium-900/60">
                  {group}
                </div>
                {items.map((item) => {
                  const globalIdx = filtered.indexOf(item);
                  const isActive = globalIdx === activeIdx;
                  return (
                    <button
                      key={item.id}
                      data-idx={globalIdx}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setActiveIdx(globalIdx)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-titanium-900/40 ${
                        isActive ? 'bg-obsidian-800' : 'hover:bg-obsidian-800/60'
                      }`}
                    >
                      <div className={`w-8 h-8 flex items-center justify-center shrink-0 border ${
                        isActive
                          ? 'bg-teal-600/20 border-teal-600/40'
                          : 'bg-obsidian-800 border-titanium-800'
                      }`}>
                        <item.Icon className={`h-4 w-4 ${isActive ? 'text-teal-400' : 'text-titanium-500'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-semibold ${isActive ? 'text-teal-400' : 'text-titanium-100'}`}>
                          {item.label}
                        </div>
                        <div className="font-mono text-[10px] text-titanium-500 truncate">{item.description}</div>
                      </div>
                      {isActive && (
                        <kbd className="font-mono text-[9px] text-titanium-600 border border-titanium-800 px-1.5 py-0.5 shrink-0">
                          ↵
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-titanium-900 flex items-center gap-4">
          <span className="font-mono text-[9px] text-titanium-700">
            <kbd className="border border-titanium-800 px-1">↑↓</kbd> navigieren
          </span>
          <span className="font-mono text-[9px] text-titanium-700">
            <kbd className="border border-titanium-800 px-1">↵</kbd> öffnen
          </span>
          <span className="font-mono text-[9px] text-titanium-700">
            <kbd className="border border-titanium-800 px-1">Esc</kbd> schließen
          </span>
          <span className="ml-auto font-mono text-[9px] text-titanium-700">
            {filtered.length} Ergebnis{filtered.length !== 1 ? 'se' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
