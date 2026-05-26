import { Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, FileText } from 'lucide-react';
import { AgentWidget } from '../governance/AgentWidget/AgentWidget';

/**
 * Phase 4 (Hostinger-Pattern): AuditResultView.
 *
 * Page-level Layout fuer die Anzeige eines DSGVO-Audit-Ergebnisses mit
 * Right-Panel `<AgentWidget mode="audit_copilot" auditId={...} />`.
 *
 * Phase 4 baut die Surface — die Findings-Liste ist hier minimal gehalten
 * (Aufrufer liefert via Props). Ein spaeterer PR holt die Findings aus
 * der gdpr-audit Edge-Function via auditId und mountet die ganze
 * Detail-Ansicht hier hinein.
 */

export interface AuditResultFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'pass';
  title: string;
  detail?: string;
  paragraph_ref?: string;
}

interface AuditResultViewProps {
  auditId: string;
  domain?: string;
  score?: number;
  findings?: AuditResultFinding[];
}

const SEVERITY_LABEL: Record<AuditResultFinding['severity'], string> = {
  critical: 'kritisch',
  high:     'hoch',
  medium:   'mittel',
  low:      'niedrig',
  info:     'hinweis',
  pass:     'ok',
};
const SEVERITY_CLS: Record<AuditResultFinding['severity'], string> = {
  critical: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  high:     'border-orange-500/40 bg-orange-500/10 text-orange-200',
  medium:   'border-amber-500/40 bg-amber-500/10 text-amber-200',
  low:      'border-titanium-700 bg-titanium-800/30 text-titanium-300',
  info:     'border-sky-500/30 bg-sky-500/10 text-sky-200',
  pass:     'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
};

export function AuditResultView({ auditId, domain, score, findings = [] }: AuditResultViewProps) {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="flex h-14 items-center gap-3 border-b border-titanium-900 bg-obsidian-900 px-4">
        <Link to="/audit" className="p-1.5 text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-200" aria-label="Zurueck zum Audit">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-600">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <h1 className="font-display text-sm font-bold tracking-tight text-titanium-50">
              Audit-Ergebnis{domain ? ` — ${domain}` : ''}
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
              Audit · {auditId}{typeof score === 'number' ? ` · Score ${score}/100` : ''}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 p-4 md:p-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-3">
          <div className="border border-amber-500/40 bg-amber-500/10 p-3 text-[12px] text-titanium-300">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
              <p>
                Automatisierte Erstanalyse — kein vollstaendiges Audit, keine Rechtsberatung.
                Die Befunde sind technische Hinweise und brauchen Human Review.
              </p>
            </div>
          </div>

          {findings.length === 0 ? (
            <p className="border border-titanium-800 bg-obsidian-900 p-6 text-center text-sm text-titanium-400">
              Keine Befunde geladen. Audit-ID: <span className="font-mono">{auditId}</span>
            </p>
          ) : (
            <ul className="space-y-2">
              {findings.map((f) => (
                <li key={f.id} className="border border-titanium-800 bg-obsidian-900 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-sm text-titanium-50">{f.title}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-titanium-500">{f.id}</p>
                      {f.paragraph_ref ? (
                        <p className="mt-1 text-[11px] text-titanium-400">{f.paragraph_ref}</p>
                      ) : null}
                      {f.detail ? <p className="mt-2 text-[12px] text-titanium-300">{f.detail}</p> : null}
                    </div>
                    <span className={`shrink-0 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${SEVERITY_CLS[f.severity]}`}>
                      {SEVERITY_LABEL[f.severity]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <AgentWidget mode="audit_copilot" auditId={auditId} />
        </aside>
      </main>
    </div>
  );
}
