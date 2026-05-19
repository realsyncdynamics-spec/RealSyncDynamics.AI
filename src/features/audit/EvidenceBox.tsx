import { ShieldCheck } from 'lucide-react';
import {
  RuntimeStatusBadge,
  severityToTone,
} from '../../components/runtime-ui';
import type { RuntimeSeverity } from '../../lib/runtime/runtimeTypes';

export interface EvidenceBoxFinding {
  severity:      RuntimeSeverity;
  title:         string;
  description?:  string;
  rule_id?:      string;
  rule_version?: string;
  detected_at?:  string;
  source_url?:   string;
  evidence_hash?: string;
  /** 0..1. Wird als „Konfidenz" gerundet angezeigt. */
  confidence?:   number;
  /** Fix-Snippet-Kennung (z. B. „fix.snippet.csp_block_ga"). */
  fix_snippet_id?: string;
  /** Honest review state. */
  review_status?: 'draft' | 'review_required' | 'approved' | 'rejected';
}

const REVIEW_LABEL: Record<NonNullable<EvidenceBoxFinding['review_status']>, string> = {
  draft:           'Entwurf',
  review_required: 'Review erforderlich',
  approved:        'Freigegeben',
  rejected:        'Abgelehnt',
};

const REVIEW_TONE: Record<NonNullable<EvidenceBoxFinding['review_status']>, 'neutral' | 'warn' | 'success' | 'danger'> = {
  draft:           'neutral',
  review_required: 'warn',
  approved:        'success',
  rejected:        'danger',
};

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('de-DE', { hour12: false }); } catch { return iso; }
}

/**
 * EvidenceBox — wiederverwendbare Audit-Komponente, die ein Finding mit
 * allen Pflichtfeldern (Severity, Rule, Evidence-Hash, Konfidenz, Review-
 * Status) darstellt. Keine Rechtsbehauptung — alle Aussagen sind
 * technisch und beleg-basiert.
 */
export function EvidenceBox({ finding }: { finding: EvidenceBoxFinding }) {
  return (
    <article className="border border-titanium-800 bg-obsidian-950 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="border border-titanium-800 bg-obsidian-900 p-2">
            <ShieldCheck className="h-4 w-4 text-ai-cyan-400" />
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wide text-titanium-500">
              Audit-Finding · evidence-based
            </p>
            <h3 className="mt-0.5 font-display text-base font-bold text-titanium-50">
              {finding.title}
            </h3>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RuntimeStatusBadge label={finding.severity} tone={severityToTone(finding.severity)} />
          {finding.review_status ? (
            <RuntimeStatusBadge
              label={REVIEW_LABEL[finding.review_status]}
              tone={REVIEW_TONE[finding.review_status]}
            />
          ) : null}
        </div>
      </header>

      {finding.description ? (
        <p className="mt-3 text-sm leading-relaxed text-titanium-200">
          {finding.description}
        </p>
      ) : null}

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        <Field label="Regel">
          {finding.rule_id ? (
            <>
              <span className="font-mono text-xs text-titanium-100">{finding.rule_id}</span>
              {finding.rule_version ? (
                <span className="ml-1 font-mono text-xs text-titanium-500">v{finding.rule_version}</span>
              ) : null}
            </>
          ) : <Dash />}
        </Field>
        <Field label="Erkannt"><span className="font-mono text-xs text-titanium-200">{fmtDate(finding.detected_at)}</span></Field>
        <Field label="Quelle">
          {finding.source_url ? (
            <span className="break-all font-mono text-xs text-titanium-200">{finding.source_url}</span>
          ) : <Dash />}
        </Field>
        <Field label="Konfidenz">
          {typeof finding.confidence === 'number' ? (
            <span className="font-mono text-xs text-titanium-200">
              {Math.round(Math.max(0, Math.min(1, finding.confidence)) * 100)}%
            </span>
          ) : <Dash />}
        </Field>
        <Field label="Evidence-Hash">
          {finding.evidence_hash ? (
            <span className="font-mono text-[11px] text-titanium-300">{finding.evidence_hash}</span>
          ) : <Dash />}
        </Field>
        <Field label="Fix-Snippet">
          {finding.fix_snippet_id ? (
            <span className="font-mono text-xs text-ai-cyan-300">{finding.fix_snippet_id}</span>
          ) : <Dash />}
        </Field>
      </dl>

      <footer className="mt-4 border-t border-titanium-800 pt-2 font-mono text-[11px] uppercase tracking-wide text-titanium-500">
        Technische Feststellung · Human Review vor Freigabe noetig
      </footer>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-500">{label}</dt>
      <dd className="mt-0.5 text-titanium-200">{children}</dd>
    </div>
  );
}

function Dash() {
  return <span className="text-titanium-500">—</span>;
}
