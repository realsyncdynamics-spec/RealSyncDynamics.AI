import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, FileText, Loader2, ShieldCheck, ArrowRight,
  Linkedin, Share2,
} from 'lucide-react';
import { AgentWidget } from '../governance/AgentWidget/AgentWidget';

/**
 * AuditResultView — Render-Surface fuer ein Audit-Ergebnis an
 * /audit/result/:auditId.
 *
 * Renders:
 *   1. Score-Hero mit Score-Badge (groß, farbcodiert nach Severity)
 *      + Summary-Satz + Methodik-Link
 *   2. Befunde gruppiert nach Severity (critical/high/medium/low/info/pass)
 *   3. Sidebar mit AuditCopilot + Share/Print-CTAs
 *
 * Loading- und Error-States bekommen eigene, klare Surfaces — kein
 * stiller "Keine Befunde geladen" mehr, das nach einem Scam aussieht.
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
  domain?:   string;
  score?:    number;
  findings?: AuditResultFinding[];
  loading?:  boolean;
  error?:    string | null;
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
const SEVERITY_ORDER: AuditResultFinding['severity'][] =
  ['critical', 'high', 'medium', 'low', 'info', 'pass'];

function scoreConfig(score: number) {
  if (score >= 80) return { label: 'Sehr gut',              color: 'text-emerald-300', bg: 'bg-emerald-950/30', border: 'border-emerald-700/60' };
  if (score >= 60) return { label: 'Verbesserungsbedarf',   color: 'text-amber-300',   bg: 'bg-amber-950/30',   border: 'border-amber-700/60'   };
  if (score >= 40) return { label: 'Erhebliche Maengel',    color: 'text-orange-300',  bg: 'bg-orange-950/30',  border: 'border-orange-700/60'  };
  return              { label: 'Kritisch',              color: 'text-rose-300',    bg: 'bg-rose-950/30',    border: 'border-rose-700/60'    };
}

export function AuditResultView({
  auditId, domain, score, findings = [], loading = false, error = null,
}: AuditResultViewProps) {
  const grouped = useMemo(() => {
    const g: Record<AuditResultFinding['severity'], AuditResultFinding[]> = {
      critical: [], high: [], medium: [], low: [], info: [], pass: [],
    };
    for (const f of findings) g[f.severity].push(f);
    return g;
  }, [findings]);

  const counts = useMemo(() => {
    const c: Record<AuditResultFinding['severity'], number> = {
      critical: 0, high: 0, medium: 0, low: 0, info: 0, pass: 0,
    };
    for (const f of findings) c[f.severity] += 1;
    return c;
  }, [findings]);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="flex h-14 items-center gap-3 border-b border-titanium-900 bg-obsidian-900 px-4">
        <Link to="/audit" className="p-1.5 text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-200" aria-label="Zurueck zum Audit">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-600">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 leading-tight">
            <h1 className="truncate font-display text-sm font-bold tracking-tight text-titanium-50">
              Audit-Ergebnis{domain ? ` — ${domain}` : ''}
            </h1>
            <p className="truncate font-mono text-[10px] uppercase tracking-wider text-titanium-500">
              Audit · {auditId.slice(0, 8)}…
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 p-4 md:p-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-5">
          {loading ? (
            <LoadingHero />
          ) : error ? (
            <ErrorHero message={error} />
          ) : (
            <>
              {typeof score === 'number' && (
                <ScoreHero score={score} domain={domain} totalFindings={findings.length} />
              )}

              {findings.length > 0 && <SeverityCounts counts={counts} />}

              <div className="border border-amber-500/40 bg-amber-500/10 p-3 text-[12px] text-titanium-300">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                  <p>
                    Automatisierte Erstanalyse — kein vollstaendiges Audit, keine Rechtsberatung.
                    Die Befunde sind technische Hinweise und brauchen Human Review.{' '}
                    <Link to="/legal/methodology" className="text-titanium-200 underline">Methodik</Link>
                  </p>
                </div>
              </div>

              {findings.length === 0 ? (
                <EmptyFindings hasScore={typeof score === 'number'} />
              ) : (
                <FindingsBySeverity grouped={grouped} />
              )}
            </>
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {!loading && !error && (
            <SidebarActions shareUrl={shareUrl} domain={domain} score={score} />
          )}
          <AgentWidget mode="audit_copilot" auditId={auditId} />
        </aside>
      </main>
    </div>
  );
}

function ScoreHero({ score, domain, totalFindings }: { score: number; domain?: string; totalFindings: number }) {
  const cfg = scoreConfig(score);
  return (
    <div className={`border ${cfg.border} ${cfg.bg} p-5 sm:p-6`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">DSGVO-Score</div>
          <div className={`mt-1 font-display text-base font-bold ${cfg.color}`}>{cfg.label}</div>
          {domain && (
            <div className="mt-1 font-mono text-xs text-titanium-400">{domain}</div>
          )}
        </div>
        <div className={`shrink-0 text-right font-display text-5xl font-bold tabular-nums sm:text-6xl ${cfg.color}`}>
          {score}<span className="text-base text-titanium-500"> / 100</span>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-titanium-300">
        {totalFindings === 0
          ? 'Keine Befunde — saubere Site nach unseren 29 DSGVO-Heuristik-Checks.'
          : `${totalFindings} ${totalFindings === 1 ? 'Befund' : 'Befunde'} aus 29 DSGVO-Heuristik-Checks. Details unten, nach Schwere sortiert.`}
      </p>
    </div>
  );
}

function SeverityCounts({ counts }: { counts: Record<AuditResultFinding['severity'], number> }) {
  const items = SEVERITY_ORDER.filter((s) => counts[s] > 0);
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((s) => (
        <a
          key={s}
          href={`#sev-${s}`}
          className={`border px-3 py-2 ${SEVERITY_CLS[s]} hover:opacity-90 transition-opacity`}
        >
          <div className="font-mono text-[10px] uppercase tracking-wider opacity-80">{SEVERITY_LABEL[s]}</div>
          <div className="mt-0.5 font-display text-xl font-bold tabular-nums">{counts[s]}</div>
        </a>
      ))}
    </div>
  );
}

function FindingsBySeverity({
  grouped,
}: {
  grouped: Record<AuditResultFinding['severity'], AuditResultFinding[]>;
}) {
  return (
    <div className="space-y-6">
      {SEVERITY_ORDER.filter((s) => grouped[s].length > 0).map((sev) => (
        <section key={sev} id={`sev-${sev}`}>
          <div className="mb-2 flex items-center gap-2">
            <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${SEVERITY_CLS[sev]}`}>
              {SEVERITY_LABEL[sev]}
            </span>
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-titanium-500">
              {grouped[sev].length} {grouped[sev].length === 1 ? 'Befund' : 'Befunde'}
            </h2>
          </div>
          <ul className="space-y-2">
            {grouped[sev].map((f) => (
              <li key={f.id} className="border border-titanium-800 bg-obsidian-900 p-3">
                <p className="font-display text-sm text-titanium-50">{f.title}</p>
                {f.paragraph_ref && (
                  <p className="mt-1 font-mono text-[11px] text-titanium-400">{f.paragraph_ref}</p>
                )}
                {f.detail && (
                  <p className="mt-2 text-[12px] leading-relaxed text-titanium-300">{f.detail}</p>
                )}
                <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-titanium-600">
                  {f.id}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SidebarActions({ shareUrl, domain, score }: { shareUrl: string; domain?: string; score?: number }) {
  const xText =
    domain && typeof score === 'number'
      ? `${domain} hat ${score}/100 im DSGVO-Audit. Wie schneidet Deine Site ab?`
      : 'Mein DSGVO-Audit-Ergebnis von RealSync Dynamics.';
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
  const xUrl        = `https://twitter.com/intent/tweet?text=${encodeURIComponent(xText)}&url=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="space-y-3">
      <div className="border border-security-700/60 bg-obsidian-900 p-4">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-security-400" />
          <div>
            <h3 className="font-display text-sm font-bold text-titanium-50">Befunde gezielt fixen</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-titanium-300">
              Mit Continuous Monitoring + Fix-Empfehlungen behebst Du die Befunde
              messbar — und siehst beim naechsten Scan den Delta.
            </p>
          </div>
        </div>
        <Link
          to="/pricing"
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 bg-security-500 px-4 py-2 text-xs font-bold text-white hover:bg-security-600"
        >
          Tarife ansehen <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="border border-titanium-800 bg-obsidian-900 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Share2 className="h-3.5 w-3.5 text-titanium-400" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-titanium-400">Teilen / Drucken</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <a
            href={linkedInUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-[#0A66C2] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#004182]"
          >
            <Linkedin className="h-3 w-3" /> LinkedIn
          </a>
          <a
            href={xUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 border border-titanium-700 bg-obsidian-950 px-2.5 py-1 text-[11px] font-semibold text-titanium-200 hover:border-titanium-500"
          >
            X / Twitter
          </a>
          <button
            type="button"
            onClick={() => typeof window !== 'undefined' && window.print()}
            className="inline-flex items-center gap-1.5 border border-titanium-700 bg-obsidian-950 px-2.5 py-1 text-[11px] font-semibold text-titanium-200 hover:border-titanium-500"
          >
            PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingHero() {
  return (
    <div className="border border-titanium-800 bg-obsidian-900 p-8">
      <div className="flex flex-col items-center gap-3 text-titanium-400">
        <Loader2 className="h-6 w-6 animate-spin" />
        <div className="text-sm">Audit-Report wird geladen …</div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-600">
          Score · Befunde · Methodik
        </div>
      </div>
    </div>
  );
}

function ErrorHero({ message }: { message: string }) {
  return (
    <div className="border border-rose-500/40 bg-rose-500/10 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
        <div>
          <h2 className="font-display text-base font-bold text-titanium-50">Audit nicht verfuegbar</h2>
          <p className="mt-1 text-sm leading-relaxed text-titanium-300">{message}</p>
          <p className="mt-2 text-[12px] text-titanium-400">
            Falls Du den Link gerade aus einer E-Mail oder Notiz geoeffnet hast: der Audit kann
            zurueckgezogen oder geloescht worden sein. Du kannst jederzeit einen frischen Scan
            starten — kostenlos und ohne Account.
          </p>
          <Link
            to="/audit"
            className="mt-3 inline-flex items-center gap-1.5 bg-security-500 px-4 py-2 text-xs font-bold text-white hover:bg-security-600"
          >
            Neuen Scan starten <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptyFindings({ hasScore }: { hasScore: boolean }) {
  // Edge-Case: Audit existiert, hat aber 0 Issues. Nur dann sehen wir
  // diesen Branch (vorher loading + error sind raus). Wenn auch der
  // Score fehlt, ist das ein abgelaufener / revoked Audit.
  if (!hasScore) {
    return (
      <div className="border border-titanium-800 bg-obsidian-900 p-6 text-center">
        <p className="text-sm text-titanium-300">
          Fuer diesen Audit liegen aktuell keine sichtbaren Daten vor.
        </p>
      </div>
    );
  }
  return (
    <div className="border border-emerald-700/60 bg-emerald-950/30 p-5 text-sm text-titanium-200">
      Keine technischen Befunde aus den 29 DSGVO-Heuristik-Checks — saubere Site. Bedenke
      die Confidence-Grenzen der statischen Analyse: Server-Side-Tracking, dynamisch geladene
      Skripte und post-consent Tracker werden hier nicht erfasst.
    </div>
  );
}
