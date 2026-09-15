/**
 * Honest top-3 risk preview after a public gdpr-audit — no fake production KPIs.
 * Reuses issue titles/details + optional evidence metadata from the audit payload.
 */
import { AlertTriangle, FileSearch } from 'lucide-react';

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export interface TopRiskIssue {
  id: string;
  severity: string;
  title: string;
  detail: string;
  paragraph_ref?: string;
  evidence?: {
    evidence_type: string;
    source_url: string;
    sha256: string;
    confidence: number;
  };
  fix_snippets?: Array<{ label: string }>;
}

/** Severity-ordered top N findings for the public result surface. */
export function pickTopRisks(issues: readonly TopRiskIssue[], limit = 3): TopRiskIssue[] {
  return [...issues]
    .sort(
      (a, b) =>
        (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99),
    )
    .slice(0, limit);
}

/** One concrete next measure from the highest-severity finding. */
export function nextMeasureFor(issues: readonly TopRiskIssue[]): string {
  const top = pickTopRisks(issues, 1)[0];
  if (!top) {
    return 'Keine kritischen Befunde — Domain in Monitoring aufnehmen, sobald verfügbar.';
  }
  const snippet = top.fix_snippets?.[0]?.label;
  if (snippet) return snippet;
  if (top.severity === 'critical' || top.severity === 'high') {
    return `Priorität: „${top.title}" beheben und Evidence dokumentieren.`;
  }
  return `Nächste Maßnahme: „${top.title}" prüfen und im Fix-Plan festhalten.`;
}

const SEV_LABEL: Record<string, string> = {
  critical: 'KRITISCH',
  high: 'HOCH',
  medium: 'MITTEL',
  low: 'NIEDRIG',
  info: 'INFO',
};

export function Top3RisksPreview({
  issues,
  score,
}: {
  issues: readonly TopRiskIssue[];
  score: number;
}) {
  const top = pickTopRisks(issues, 3);
  const measure = nextMeasureFor(issues);
  const evidenceHit = top.find((i) => i.evidence);

  return (
    <section
      aria-label="Top-Risiken und Evidence-Preview"
      className="border border-titanium-800 bg-obsidian-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-titanium-900 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[#e4cfa2]" aria-hidden />
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#e4cfa2]/80">
              Sofortergebnis · ehrlich
            </p>
            <h2 className="font-display text-sm font-semibold text-titanium-50">
              Top-{Math.max(top.length, 1)} Risiken + nächste Maßnahme
            </h2>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-[8px] uppercase tracking-widest text-titanium-600">
            Governance Score
          </p>
          <p className="font-display text-2xl font-bold tabular-nums text-titanium-50">
            {score}
            <span className="text-sm text-titanium-500"> / 100</span>
          </p>
        </div>
      </div>

      {top.length === 0 ? (
        <p className="px-4 py-5 text-sm text-titanium-300">
          Keine Standard-Befunde in diesem Lauf. Score {score}/100 — Snapshot, kein
          Konformitätszertifikat.
        </p>
      ) : (
        <ol className="divide-y divide-titanium-900">
          {top.map((issue, idx) => (
            <li key={issue.id} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-titanium-600">{idx + 1}.</span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-titanium-400">
                  {SEV_LABEL[issue.severity] ?? issue.severity}
                </span>
                {issue.paragraph_ref && (
                  <span className="font-mono text-[9px] text-titanium-600">
                    {issue.paragraph_ref}
                  </span>
                )}
              </div>
              <p className="mt-1 font-display text-sm font-bold text-titanium-50">
                {issue.title}
              </p>
              <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-titanium-400">
                {issue.detail}
              </p>
            </li>
          ))}
        </ol>
      )}

      <div className="border-t border-titanium-900 px-4 py-3">
        <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-600">
          Konkrete nächste Maßnahme
        </p>
        <p className="mt-1 text-sm text-titanium-200">{measure}</p>
      </div>

      <div className="border-t border-titanium-900 bg-obsidian-950 px-4 py-3">
        <div className="flex items-start gap-2">
          <FileSearch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#e4cfa2]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-600">
              Evidence-Preview
            </p>
            {evidenceHit?.evidence ? (
              <dl className="mt-1 space-y-0.5 font-mono text-[10px] text-titanium-400">
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  <dt className="text-titanium-600">Typ</dt>
                  <dd>{evidenceHit.evidence.evidence_type}</dd>
                  <dt className="text-titanium-600">Konfidenz</dt>
                  <dd>{Math.round(evidenceHit.evidence.confidence * 100)}%</dd>
                </div>
                <div className="truncate">
                  <span className="text-titanium-600">Quelle </span>
                  {evidenceHit.evidence.source_url}
                </div>
                <div className="truncate">
                  <span className="text-titanium-600">SHA-256 </span>
                  {evidenceHit.evidence.sha256.slice(0, 16)}…
                </div>
              </dl>
            ) : (
              <p className="mt-1 text-[12px] text-titanium-500">
                Für die Top-Befunde liegt in diesem Lauf noch keine Evidence-Metadaten-Vorschau
                vor — vollständige Nachweise nach Speichern unter /app/evidence.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
