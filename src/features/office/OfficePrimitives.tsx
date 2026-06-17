// OfficePrimitives — geteilte UI-Bausteine für alle Office-OS-Views.
// Hard-Edge Industrial UI (keine abgerundeten Ecken, Obsidian/Titanium-Palette),
// Monospace für Metadaten.
import React from 'react';
import { ShieldCheck, type LucideIcon } from 'lucide-react';

// ── Governance-Status für Office-Artefakte ──────────────────────────────────
export type OfficeStatus =
  | 'freigegeben'
  | 'pruefung'
  | 'entwurf'
  | 'abgelaufen'
  | 'archiviert';

const STATUS_CONFIG: Record<OfficeStatus, { label: string; classes: string }> = {
  freigegeben: { label: 'Freigegeben', classes: 'bg-teal-600/20 border-teal-600/40 text-teal-400' },
  pruefung: { label: 'In Prüfung', classes: 'bg-blue-600/20 border-blue-600/40 text-blue-400' },
  entwurf: { label: 'Entwurf', classes: 'bg-amber-600/20 border-amber-600/40 text-amber-400' },
  abgelaufen: { label: 'Abgelaufen', classes: 'bg-red-600/20 border-red-600/40 text-red-400' },
  archiviert: { label: 'Archiviert', classes: 'bg-titanium-700/20 border-titanium-700/40 text-titanium-400' },
};

export function OfficeStatusChip({ status }: { status: OfficeStatus }) {
  const { label, classes } = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 border font-mono text-[10px] ${classes}`}>
      {label}
    </span>
  );
}

// ── View-Header mit Titel, Untertitel und optionaler Primär-Aktion ──────────
interface OfficeViewHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  actionLabel?: string;
  actionIcon?: LucideIcon;
  onAction?: () => void;
}

export function OfficeViewHeader({
  icon: Icon,
  title,
  subtitle,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
}: OfficeViewHeaderProps) {
  return (
    <div className="border-b border-titanium-900 px-6 py-4 shrink-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 shrink-0 flex items-center justify-center bg-obsidian-800 border border-titanium-800">
            <Icon className="h-4 w-4 text-titanium-300" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-display font-semibold text-titanium-100 tracking-tight leading-tight">
              {title}
            </h1>
            <p className="font-mono text-xs text-titanium-500 mt-0.5 truncate">{subtitle}</p>
          </div>
        </div>
        {actionLabel && (
          <button
            onClick={onAction}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-xs font-mono hover:bg-teal-500 transition-colors shrink-0"
          >
            {ActionIcon && <ActionIcon className="h-3.5 w-3.5" />}
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Prüfpfad-Hinweis (UI-first: Mock-Daten, Persistenz folgt) ───────────────
export function OfficeAuditNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 px-6 py-2.5 border-b border-titanium-900 bg-obsidian-900/60 shrink-0">
      <ShieldCheck className="h-3.5 w-3.5 text-teal-500 mt-0.5 shrink-0" />
      <p className="font-mono text-[11px] text-titanium-500 leading-relaxed">{children}</p>
    </div>
  );
}

// ── Scroll-Container für View-Inhalte ───────────────────────────────────────
export function OfficeContent({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-y-auto p-6">{children}</div>;
}

// ── Kennzahl-Leiste (kompakte KPI-Reihe) ────────────────────────────────────
export function OfficeMetricRow({
  metrics,
}: {
  metrics: { label: string; value: string | number }[];
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-titanium-900 border border-titanium-900 mb-6">
      {metrics.map((m) => (
        <div key={m.label} className="bg-obsidian-900 px-4 py-3">
          <div className="font-mono text-[10px] text-titanium-600 uppercase tracking-wide">{m.label}</div>
          <div className="text-xl font-display font-semibold text-titanium-100 mt-1">{m.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Roadmap-/Empty-State ────────────────────────────────────────────────────
export function OfficeEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-12 w-12 flex items-center justify-center bg-obsidian-800 border border-titanium-800 mb-4">
        <Icon className="h-5 w-5 text-titanium-600" />
      </div>
      <p className="text-sm text-titanium-300 font-medium">{title}</p>
      <p className="font-mono text-xs text-titanium-600 mt-1.5 max-w-md">{description}</p>
    </div>
  );
}
