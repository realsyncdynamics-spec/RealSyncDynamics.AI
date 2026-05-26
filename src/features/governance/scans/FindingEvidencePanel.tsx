/**
 * Evidence-Detail-Panel — toggelt unter einem Finding.
 *
 * Surface der Felder, die nach dem Tone-Down + Confidence-Schema zu
 * jedem Finding gehören:
 *   - confidence_score (Pille mit 0..1 als Prozent)
 *   - evidence_level   (observed / inferred / reported / unverifiable)
 *   - verification_status (verified / partial / unverified / disputed)
 *   - evidence_ref     (URL / Hash / Storage / Runtime-Event)
 *   - raw_payload      (JSON, formatiert)
 *
 * Keine Animation, kein Auto-Scroll, ein einfacher Disclosure-Toggle.
 * Bewusst rein-lesend; Status-Transitions kommen in einer eigenen PR.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, ShieldQuestion, Sparkles } from 'lucide-react';
import type { Finding } from '../../../types/governance/finding';
import {
  parseEvidenceRef,
  evidenceRefLabel,
} from '../../../types/governance/evidence';

const EVIDENCE_LEVEL_LABEL: Record<Finding['evidence_level'], string> = {
  observed:     'beobachtet',
  inferred:     'inferiert',
  reported:     'gemeldet',
  unverifiable: 'nicht verifizierbar',
};

const EVIDENCE_LEVEL_PILL: Record<Finding['evidence_level'], string> = {
  observed:     'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  inferred:     'border-amber-500/30 bg-amber-500/10 text-amber-200',
  reported:     'border-sky-500/30 bg-sky-500/10 text-sky-200',
  unverifiable: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
};

const VERIFICATION_LABEL: Record<Finding['verification_status'], string> = {
  verified:   'verifiziert',
  partial:    'teilweise',
  unverified: 'unverifiziert',
  disputed:   'bestritten',
};

const VERIFICATION_PILL: Record<Finding['verification_status'], string> = {
  verified:   'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  partial:    'border-amber-500/30 bg-amber-500/10 text-amber-200',
  unverified: 'border-titanium-700 bg-titanium-800/30 text-titanium-300',
  disputed:   'border-rose-500/30 bg-rose-500/10 text-rose-200',
};

export interface FindingEvidencePanelProps {
  finding: Finding;
  /** Default: collapsed. Set true for "always-open" surfaces (PDF). */
  defaultOpen?: boolean;
}

export function FindingEvidencePanel({ finding, defaultOpen = false }: FindingEvidencePanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-titanium-900 mt-3 pt-3">
      <ConfidenceLine finding={finding} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-titanium-400 hover:text-titanium-100 transition-colors"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Evidence anzeigen
      </button>
      {open ? <EvidenceDetails finding={finding} /> : null}
    </div>
  );
}

function ConfidenceLine({ finding }: { finding: Finding }) {
  const pct = Math.round(finding.confidence_score * 100);
  // Confidence-Farbe nach Stufen: ≥80 grün, 50–79 amber, <50 rose.
  const cls =
    pct >= 80 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' :
    pct >= 50 ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' :
                'border-rose-500/30 bg-rose-500/10 text-rose-200';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase font-mono tracking-wider border ${cls}`}>
        <Sparkles className="h-3 w-3" />
        Confidence {pct}%
      </span>
      <span className={`inline-flex items-center px-2 py-0.5 text-[10px] uppercase font-mono tracking-wider border ${EVIDENCE_LEVEL_PILL[finding.evidence_level]}`}>
        {EVIDENCE_LEVEL_LABEL[finding.evidence_level]}
      </span>
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase font-mono tracking-wider border ${VERIFICATION_PILL[finding.verification_status]}`}>
        <ShieldQuestion className="h-3 w-3" />
        {VERIFICATION_LABEL[finding.verification_status]}
      </span>
    </div>
  );
}

function EvidenceDetails({ finding }: { finding: Finding }) {
  const ref = parseEvidenceRef(finding.evidence_ref);
  return (
    <div className="mt-3 space-y-3">
      {ref ? (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-titanium-500 mb-1">
            Beleg
          </div>
          <div className="text-[12px] text-titanium-200 font-mono break-all">
            {evidenceRefLabel(ref)}
          </div>
          {ref.kind === 'url' ? (
            <a
              href={ref.url}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-cyan-300 hover:text-cyan-200 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Quelle öffnen
            </a>
          ) : null}
        </div>
      ) : (
        <div className="text-[12px] text-titanium-500">
          Kein strukturierter Beleg zum Befund gespeichert.
        </div>
      )}

      {finding.raw_payload ? (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-titanium-500 mb-1">
            Detektor-Rohdaten
          </div>
          <pre className="text-[11px] text-titanium-200 bg-obsidian-950 border border-titanium-900 p-3 overflow-x-auto font-mono whitespace-pre-wrap">
{JSON.stringify(finding.raw_payload, null, 2)}
          </pre>
        </div>
      ) : null}

      <div className="text-[11px] text-titanium-500 leading-relaxed border-t border-titanium-900 pt-2">
        Diese Felder zeigen, <em>wie</em> der Detektor zu seinem Befund kam.
        Sie sind keine rechtliche Würdigung — die Bewertung obliegt
        Datenschutzbeauftragten oder qualifiziertem Rechtsbeistand.
      </div>
    </div>
  );
}
