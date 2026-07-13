import { useState } from 'react';
import { ChevronDown, Clock, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export interface CustodyEvent {
  seq: number;
  action: 'registered' | 'updated' | 'licensed' | 'audited';
  actor: string;
  event_ts: Date;
  event_hash: string;
  prev_hash: string | null;
  signed: boolean;
  signature_alg?: 'ed25519' | 'hmac-sha256' | null;
}

interface AuditTrailVisualizationProps {
  events: CustodyEvent[];
  assetRef: string;
}

export function AuditTrailVisualization({ events, assetRef }: AuditTrailVisualizationProps) {
  const [expandedSeq, setExpandedSeq] = useState<number | null>(null);

  const actionIcons = {
    registered: '📝',
    updated: '🔄',
    licensed: '⚖️',
    audited: '🔍',
  };

  const actionLabels = {
    registered: 'Registriert',
    updated: 'Aktualisiert',
    licensed: 'Lizenziert',
    audited: 'Geprüft',
  };

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="font-display text-sm font-semibold text-titanium-50">Audit-Trail: {assetRef}</h3>
        <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mt-1">
          {events.length} Event{events.length !== 1 ? 's' : ''} in der Custody-Kette
        </p>
      </div>

      <div className="relative space-y-2">
        {/* Timeline line */}
        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-titanium-800" />

        {events.map((event, idx) => {
          const isExpanded = expandedSeq === event.seq;
          const nextEvent = idx < events.length - 1 ? events[idx + 1] : null;
          const isBroken = nextEvent && event.event_hash !== (nextEvent.prev_hash ?? null);

          return (
            <div key={event.seq} className="relative">
              {/* Timeline dot */}
              <div
                className={`absolute left-0 top-2 h-2 w-2 rounded-full border-2 border-obsidian-900 ${
                  isBroken ? 'bg-risk-critical' : 'bg-emerald-400'
                }`}
              />

              {/* Event card */}
              <div className="ml-8 border border-titanium-800 bg-obsidian-900 hover:border-titanium-700 transition-colors">
                <button
                  onClick={() => setExpandedSeq(isExpanded ? null : event.seq)}
                  className="w-full px-4 py-3 text-left flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{actionIcons[event.action]}</span>
                      <div>
                        <p className="font-semibold text-titanium-100">
                          #{event.seq} — {actionLabels[event.action]}
                        </p>
                        <p className="font-mono text-[10px] text-titanium-500 mt-0.5">
                          {new Date(event.event_ts).toLocaleString('de-DE')}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] bg-obsidian-800 px-2 py-1 text-titanium-400 rounded">
                        {event.actor}
                      </span>
                      {event.signed && (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-2 py-1 border border-emerald-500/40 rounded">
                          ✓ Signiert
                        </span>
                      )}
                      {event.signature_alg && (
                        <span
                          className={`text-[10px] px-2 py-1 rounded ${
                            event.signature_alg === 'ed25519'
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40'
                              : 'bg-titanium-700/10 text-titanium-400 border border-titanium-700/40'
                          }`}
                          title={event.signature_alg === 'ed25519' ? 'Asymmetrisch, extern prüfbar' : 'Symmetrisch, intern prüfbar'}
                        >
                          {event.signature_alg === 'ed25519' ? 'Ed25519' : 'HMAC'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {isBroken && (
                      <AlertTriangle className="h-4 w-4 text-risk-critical" title="Kette unterbrochen!" />
                    )}
                    <ChevronDown
                      className={`h-4 w-4 text-titanium-500 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-titanium-800 px-4 py-3 bg-obsidian-950 space-y-3 text-xs">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-1">Event-Hash</p>
                      <p className="font-mono break-all text-titanium-400 bg-obsidian-900 px-2 py-1">
                        {event.event_hash}
                      </p>
                    </div>

                    {event.prev_hash && (
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-1">Vorhergehender Hash</p>
                        <p className="font-mono break-all text-titanium-400 bg-obsidian-900 px-2 py-1">
                          {event.prev_hash}
                        </p>
                      </div>
                    )}

                    {isBroken && (
                      <div className="flex gap-2 p-2 bg-risk-critical/10 border border-risk-critical/40 rounded">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-risk-critical mt-0.5" />
                        <div className="text-risk-critical">
                          <p className="font-semibold">Kette unterbrochen!</p>
                          <p className="text-[11px] opacity-80 mt-1">
                            Dieser Event verweist nicht auf den vorherigen Hash. Mögliche Manipulation erkannt.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {events.length === 0 && (
        <div className="border border-titanium-800 bg-obsidian-900 px-4 py-6 text-center text-titanium-500 text-sm">
          Keine Custody-Events registriert
        </div>
      )}
    </div>
  );
}
