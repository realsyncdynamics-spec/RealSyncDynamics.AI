import { useState } from 'react';
import {
  Shield, Clock, Globe, Cookie, FileText, CheckSquare,
  ChevronDown, ChevronRight, type LucideIcon,
} from 'lucide-react';
import type { ControlSignal, ControlSignalSeverity, ControlSignalStatus, ControlSignalType } from './dsgvoControlPackTypes';

const TYPE_ICON: Record<ControlSignalType, LucideIcon> = {
  new_tracker:            Shield,
  consent_timing:         Clock,
  new_third_party_domain: Globe,
  new_cookies:            Cookie,
  legal_text_changed:     FileText,
  evidence_snapshot:      CheckSquare,
};

const SEVERITY_DOT: Record<ControlSignalSeverity, string> = {
  critical: 'bg-rose-500',
  high:     'bg-amber-400',
  medium:   'bg-yellow-400',
  low:      'bg-emerald-400',
  info:     'bg-titanium-500',
};

const SEVERITY_LABEL: Record<ControlSignalSeverity, string> = {
  critical: 'Kritisch',
  high:     'Hoch',
  medium:   'Mittel',
  low:      'Niedrig',
  info:     'Info',
};

const STATUS_STYLES: Record<ControlSignalStatus, string> = {
  open:         'bg-rose-950 text-rose-300 border border-rose-800',
  acknowledged: 'bg-amber-950 text-amber-300 border border-amber-800',
  resolved:     'bg-obsidian-800 text-titanium-400 border border-obsidian-700',
};

const STATUS_LABEL: Record<ControlSignalStatus, string> = {
  open:         'Offen',
  acknowledged: 'Bestätigt',
  resolved:     'Behoben',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `vor ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `vor ${hrs} Std.`;
  return `vor ${Math.floor(hrs / 24)} Tagen`;
}

interface Props {
  signal: ControlSignal;
  onStatusChange: (id: string, status: ControlSignalStatus) => void;
}

export function DsgvoControlSignalRow({ signal, onStatusChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TYPE_ICON[signal.type];

  return (
    <div>
      {/* Main row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-obsidian-900 transition-colors group"
      >
        {/* Severity dot */}
        <span className={`h-2 w-2 shrink-0 ${SEVERITY_DOT[signal.severity]}`} aria-label={SEVERITY_LABEL[signal.severity]} />

        {/* Type icon */}
        <Icon className="h-4 w-4 shrink-0 text-titanium-500 group-hover:text-titanium-300" />

        {/* Label */}
        <span className="flex-1 text-sm font-medium text-titanium-100 min-w-0 truncate">
          {signal.label}
        </span>

        {/* Domain */}
        <span className="hidden sm:block font-mono text-[11px] text-titanium-500 shrink-0">
          {signal.domain}
        </span>

        {/* Time */}
        <span className="hidden md:block font-mono text-[11px] text-titanium-600 shrink-0 w-24 text-right">
          {relativeTime(signal.detectedAt)}
        </span>

        {/* Status badge */}
        <span className={`font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 shrink-0 ${STATUS_STYLES[signal.status]}`}>
          {STATUS_LABEL[signal.status]}
        </span>

        {/* Expand chevron */}
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 text-titanium-500 shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-titanium-600 shrink-0" />
        }
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 bg-obsidian-900 border-t border-titanium-900">
          <p className="text-sm text-titanium-300 leading-relaxed mt-3 mb-3">
            {signal.summary}
          </p>

          {signal.evidenceRef && (
            <p className="font-mono text-[10px] text-titanium-600 mb-4 break-all">
              Evidence: {signal.evidenceRef}
            </p>
          )}

          {signal.status !== 'resolved' && (
            <div className="flex gap-2">
              {signal.status === 'open' && (
                <button
                  onClick={() => onStatusChange(signal.id, 'acknowledged')}
                  className="px-3 py-1.5 text-xs font-semibold border border-amber-800 text-amber-300 hover:bg-amber-950 transition-colors"
                >
                  Bestätigen
                </button>
              )}
              <button
                onClick={() => onStatusChange(signal.id, 'resolved')}
                className="px-3 py-1.5 text-xs font-semibold border border-emerald-800 text-emerald-300 hover:bg-emerald-950 transition-colors"
              >
                Als behoben markieren
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
