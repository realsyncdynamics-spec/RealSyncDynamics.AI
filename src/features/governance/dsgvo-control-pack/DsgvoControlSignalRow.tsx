import { useState } from 'react';
import { Shield, Clock, Globe, Cookie, FileText, CheckSquare, ChevronRight } from 'lucide-react';
import type { ControlSignal, ControlSignalStatus, ControlSignalType } from './dsgvoControlPackTypes';

const TYPE_ICONS: Record<ControlSignalType, React.ReactNode> = {
  new_tracker:           <Shield    className="h-3.5 w-3.5 shrink-0" />,
  consent_timing:        <Clock     className="h-3.5 w-3.5 shrink-0" />,
  new_third_party_domain:<Globe     className="h-3.5 w-3.5 shrink-0" />,
  new_cookies:           <Cookie    className="h-3.5 w-3.5 shrink-0" />,
  legal_text_changed:    <FileText  className="h-3.5 w-3.5 shrink-0" />,
  evidence_snapshot:     <CheckSquare className="h-3.5 w-3.5 shrink-0" />,
};

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-rose-500',
  high:     'bg-amber-400',
  medium:   'bg-yellow-400',
  low:      'bg-emerald-400',
  info:     'bg-titanium-500',
};

const STATUS_LABEL: Record<ControlSignalStatus, string> = {
  open:         'Offen',
  acknowledged: 'Bestätigt',
  resolved:     'Behoben',
};

const STATUS_COLOR: Record<ControlSignalStatus, string> = {
  open:         'text-rose-400 border-rose-900',
  acknowledged: 'text-amber-400 border-amber-900',
  resolved:     'text-emerald-400 border-emerald-900',
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'vor <1 h';
  if (h < 24) return `vor ${h} h`;
  return `vor ${Math.floor(h / 24)} d`;
}

interface Props {
  signal: ControlSignal;
  onStatusChange: (id: string, status: ControlSignalStatus) => void;
}

export function DsgvoControlSignalRow({ signal, onStatusChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-obsidian-900 transition-colors"
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SEVERITY_DOT[signal.severity]}`} />
        <span className="text-titanium-500">{TYPE_ICONS[signal.type]}</span>
        <span className="flex-1 text-xs font-semibold text-titanium-100 truncate">{signal.label}</span>
        <span className="font-mono text-[10px] text-titanium-500 hidden sm:block">{signal.domain}</span>
        <span className="font-mono text-[10px] text-titanium-600">{formatRelative(signal.detectedAt)}</span>
        <span className={`font-mono text-[9px] uppercase tracking-wider border px-1.5 py-0.5 ${STATUS_COLOR[signal.status]}`}>
          {STATUS_LABEL[signal.status]}
        </span>
        <ChevronRight className={`h-3.5 w-3.5 text-titanium-600 transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 bg-obsidian-900 border-t border-titanium-900">
          <p className="text-[12px] text-titanium-300 leading-relaxed mb-3">{signal.summary}</p>
          {signal.evidenceRef && (
            <p className="font-mono text-[10px] text-titanium-600 break-all mb-3">{signal.evidenceRef}</p>
          )}
          <div className="flex gap-2">
            {signal.status !== 'acknowledged' && signal.status !== 'resolved' && (
              <button
                type="button"
                onClick={() => onStatusChange(signal.id, 'acknowledged')}
                className="px-2.5 py-1 text-[11px] font-semibold border border-amber-900 text-amber-400 hover:bg-amber-900/20 transition-colors"
              >
                Bestätigen
              </button>
            )}
            {signal.status !== 'resolved' && (
              <button
                type="button"
                onClick={() => onStatusChange(signal.id, 'resolved')}
                className="px-2.5 py-1 text-[11px] font-semibold border border-emerald-900 text-emerald-400 hover:bg-emerald-900/20 transition-colors"
              >
                Beheben
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
