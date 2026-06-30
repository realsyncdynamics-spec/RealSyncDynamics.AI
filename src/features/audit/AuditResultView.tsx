import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, FileText, Loader2, ShieldCheck, ArrowRight,
  Linkedin, Share2, Globe, Mail, Clock, Copy, Check, Zap,
} from 'lucide-react';
import { AgentWidget } from '../governance/AgentWidget/AgentWidget';
import type { ScanFinding } from '../../core/onboarding/types';

/**
 * AuditResultView — Render-Surface fuer ein Audit-Ergebnis an
 * /audit/result/:auditId.
 *
 * Vertikale Struktur (bewusst in dieser Reihenfolge fuer Lesbarkeit
 * und Conversion):
 *
 *   1. Header
 *   2. Audit-Zusammenfassung (Domain, E-Mail, Zeit, ID, Score, Status,
 *      Severity-Counts)            ← "10-Sekunden-Verstaendnis"
 *   3. Ergebnis in einem Satz       ← Klartext-Summary
 *   4. Methodik-Disclaimer
 *   5. Befunde nach Severity in Geschaeftssprache
 *      (Risiko, Geschaeftsauswirkung, Behebungsaufwand, Empfohlene Massnahme)
 *   6. Monitoring-CTA               ← erst nach Verstaendnis
 *   7. Audit-Copilot-Sidebar
 *
 * Loading- und Error-States bekommen eigene, klare Surfaces — kein
 * stiller "Keine Befunde geladen" mehr.
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
  domain?:         string;
  score?:          number;
  email?:          string;
  createdAt?:      string;
  coverage?:       'full' | 'limited' | 'failed';
  coverageNotice?: string;
  findings?:       AuditResultFinding[];
  loading?:        boolean;
  error?:          string | null;
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

// Mapping: Severity → Geschaeftssprache (Auswirkung + Aufwand-Schaetzung).
// Generisch, unabhaengig vom konkreten finding.id. Wenn pro Rule eine
// genauere Aussage moeglich ist, kann das spaeter aus einer Lookup-Tabelle
// kommen — fuer jetzt deckt Severity-Mapping >90% der Faelle ab.
const SEVERITY_BUSINESS: Record<AuditResultFinding['severity'], {
  impact: string; effort: string; risk: string;
}> = {
  critical: {
    risk:   'Sofortiger Handlungsbedarf',
    impact: 'Behoerdliches Bussgeldrisiko, Abmahnungsrisiko',
    effort: '30–60 min',
  },
  high: {
    risk:   'Hohes Risiko',
    impact: 'Compliance-Luecke mit konkretem Vorfallsrisiko',
    effort: '15–30 min',
  },
  medium: {
    risk:   'Mittleres Risiko',
    impact: 'Empfohlene Sicherheitsverbesserung',
    effort: '10–15 min',
  },
  low: {
    risk:   'Niedriges Risiko',
    impact: 'Best-Practice-Hinweis',
    effort: '5 min',
  },
  info: {
    risk:   'Hinweis',
    impact: 'Optionale Konfigurationsverbesserung',
    effort: '5 min',
  },
  pass: {
    risk:   'OK',
    impact: 'Check erfolgreich',
    effort: '—',
  },
};

function scoreConfig(score: number) {
  if (score >= 80) return { label: 'Sehr gut',              color: 'text-emerald-300', bg: 'bg-emerald-950/30', border: 'border-emerald-700/60' };
  if (score >= 60) return { label: 'Verbesserungsbedarf',   color: 'text-amber-300',   bg: 'bg-amber-950/30',   border: 'border-amber-700/60'   };
  if (score >= 40) return { label: 'Erhebliche Maengel',    color: 'text-orange-300',  bg: 'bg-orange-950/30',  border: 'border-orange-700/60'  };
  return              { label: 'Kritisch',              color: 'text-rose-300',    bg: 'bg-rose-950/30',    border: 'border-rose-700/60'    };
}

/**
 * Ergebnis in einem Satz. Reine Severity-Arithmetik:
 *   - 0 Befunde         → saubere Site
 *   - 0 critical/high   → keine Verstoesse, optionale Empfehlungen
 *   - critical > 0      → sofortiger Handlungsbedarf
 *   - high > 0          → kurzfristig beheben
 */
export function plainLanguageSummary(counts: Record<AuditResultFinding['severity'], number>): string {
  const c = counts.critical, h = counts.high, m = counts.medium, l = counts.low;
  const totalNonPass = c + h + m + l;
  if (totalNonPass === 0) {
    return 'Saubere Site — keine DSGVO-Befunde aus den 29 Standard-Checks.';
  }
  if (c === 0 && h === 0) {
    const opt = m + l;
    return `Es wurden keine kritischen DSGVO-Verstoesse erkannt. ${opt} technische ${opt === 1 ? 'Sicherheitsverbesserung wird' : 'Sicherheitsverbesserungen werden'} empfohlen.`;
  }
  if (c > 0) {
    const rest = h + m + l;
    const restText = rest > 0 ? ` ${rest} weitere ${rest === 1 ? 'Befund' : 'Befunde'} mit niedrigerer Prioritaet.` : '';
    return `${c} kritische DSGVO-${c === 1 ? 'Verstoss' : 'Verstoesse'} erkannt — sofortiger Handlungsbedarf.${restText}`;
  }
  const rest = m + l;
  const restText = rest > 0 ? ` ${rest} weitere ${rest === 1 ? 'Empfehlung' : 'Empfehlungen'} mit niedrigerer Prioritaet.` : '';
  return `${h} ${h === 1 ? 'hoher Befund' : 'hohe Befunde'} erkannt — kurzfristig beheben.${restText}`;
}

function formatDateTime(iso?: string): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }) + ' Uhr';
  } catch {
    return null;
  }
}

export function AuditResultView({
  auditId, domain, score, email, createdAt, coverageNotice,
  findings = [], loading = false, error = null,
}: AuditResultViewProps) {
  const navigate = useNavigate();

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

  const handleGovernanceOnboarding = () => {
    const scanFindings: ScanFinding[] = findings
      .filter((f) => f.severity !== 'pass')
      .map((f) => ({
        id: f.id,
        severity: f.severity as Exclude<typeof f.severity, 'pass'>,
        title: f.title,
        detail: f.detail || '',
        paragraph_ref: f.paragraph_ref,
      }));

    navigate(`/onboarding/${auditId}`, {
      state: { findings: scanFindings, domain },
    });
  };

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
              Scan abgeschlossen{domain ? ` — ${domain}` : ''}
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
              <SummaryBlock
                domain={domain}
                email={email}
                createdAt={createdAt}
                auditId={auditId}
                score={score}
                counts={counts}
              />

              {typeof score === 'number' && findings.length > 0 && (
                <PlainLanguageBlock counts={counts} />
              )}

              {coverageNotice && (
                <div className="border border-sky-500/30 bg-sky-500/5 p-3 text-[12px] text-titanium-300">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-sky-300">ℹ</span>
                    <p>{coverageNotice}</p>
                  </div>
                </div>
              )}

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

              {findings.length > 0 && (
                <>
                  <GovernanceOnboardingCta onStart={handleGovernanceOnboarding} />
                  <MonitoringCta />
                </>
              )}
            </>
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {!loading && !error && (
            <ShareCard shareUrl={shareUrl} domain={domain} score={score} />
          )}
          <AgentWidget mode="audit_copilot" auditId={auditId} />
        </aside>
      </main>
    </div>
  );
}

function SummaryBlock({
  domain, email, createdAt, auditId, score, counts,
}: {
  domain?: string;
  email?: string;
  createdAt?: string;
  auditId: string;
  score?: number;
  counts: Record<AuditResultFinding['severity'], number>;
}) {
  const [copied, setCopied] = useState(false);
  const dateText = formatDateTime(createdAt);
  const cfg = typeof score === 'number' ? scoreConfig(score) : null;

  async function copyId() {
    try {
      await navigator.clipboard.writeText(auditId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }

  return (
    <div className="border border-titanium-800 bg-obsidian-900 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">
          Audit-Zusammenfassung
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SumRow icon={<Globe className="h-3.5 w-3.5" />} label="Gescannte Website">
          <span className="font-mono text-sm text-titanium-50">{domain ?? '—'}</span>
        </SumRow>

        <SumRow icon={<Mail className="h-3.5 w-3.5" />} label="Report-E-Mail">
          {email ? (
            <span className="font-mono text-sm text-titanium-200">{email}</span>
          ) : (
            <span className="text-xs text-titanium-500">
              nicht in dieser Ansicht verfuegbar
              <span className="ml-1.5 text-titanium-600">(geteilte Permalinks zeigen keine E-Mail)</span>
            </span>
          )}
        </SumRow>

        <SumRow icon={<Clock className="h-3.5 w-3.5" />} label="Scan durchgefuehrt">
          <span className="text-sm text-titanium-200">{dateText ?? '—'}</span>
        </SumRow>

        <SumRow icon={<FileText className="h-3.5 w-3.5" />} label="Scan-ID">
          <button
            type="button"
            onClick={copyId}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] text-titanium-300 hover:text-titanium-100"
            title="In Zwischenablage kopieren"
          >
            <span className="truncate">{auditId}</span>
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 opacity-60" />}
          </button>
        </SumRow>

        <SumRow icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Compliance-Score">
          {typeof score === 'number' && cfg ? (
            <div className="flex items-baseline gap-2">
              <span className={`font-display text-2xl font-bold tabular-nums ${cfg.color}`}>
                {score}<span className="text-xs text-titanium-500">/100</span>
              </span>
            </div>
          ) : (
            <span className="text-sm text-titanium-500">—</span>
          )}
        </SumRow>

        <SumRow icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Status">
          {cfg ? (
            <span className={`inline-block border px-2 py-0.5 text-xs font-semibold ${cfg.border} ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
          ) : (
            <span className="text-sm text-titanium-500">—</span>
          )}
        </SumRow>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-titanium-900 pt-3">
        <CountChip label="Kritisch" value={counts.critical} sev="critical" />
        <CountChip label="Hoch"     value={counts.high}     sev="high" />
        <CountChip label="Mittel"   value={counts.medium}   sev="medium" />
        <CountChip label="Niedrig"  value={counts.low}      sev="low" />
        {counts.info > 0 && <CountChip label="Hinweise" value={counts.info} sev="info" />}
      </div>
    </div>
  );
}

function SumRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
        <span className="text-titanium-400">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 min-w-0">{children}</dd>
    </div>
  );
}

function CountChip({ label, value, sev }: { label: string; value: number; sev: AuditResultFinding['severity'] }) {
  const active = value > 0;
  return (
    <span
      className={`inline-flex items-baseline gap-1.5 border px-2 py-1 ${
        active ? SEVERITY_CLS[sev] : 'border-titanium-800 bg-obsidian-950 text-titanium-500'
      }`}
    >
      <span className="font-mono text-[10px] uppercase tracking-wider opacity-80">{label}</span>
      <span className="font-display text-sm font-bold tabular-nums">{value}</span>
    </span>
  );
}

function PlainLanguageBlock({ counts }: { counts: Record<AuditResultFinding['severity'], number> }) {
  return (
    <div className="border-l-4 border-security-500 bg-obsidian-900/60 p-4 sm:p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">
        Ihr Ergebnis in einem Satz
      </div>
      <p className="mt-2 text-base leading-relaxed text-titanium-100 sm:text-lg">
        {plainLanguageSummary(counts)}
      </p>
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
            {grouped[sev].map((f) => <BusinessFindingCard key={f.id} finding={f} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}

function BusinessFindingCard({ finding }: { finding: AuditResultFinding }) {
  const biz = SEVERITY_BUSINESS[finding.severity];
  return (
    <li className="border border-titanium-800 bg-obsidian-900 p-3 sm:p-4">
      <p className="font-display text-sm font-semibold text-titanium-50">{finding.title}</p>

      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-3">
        <BizCell label="Risiko" value={biz.risk} sev={finding.severity} />
        <BizCell label="Geschaeftsauswirkung" value={biz.impact} />
        <BizCell label="Behebungsaufwand" value={biz.effort} />
      </dl>

      {finding.detail && (
        <div className="mt-3 border-t border-titanium-900 pt-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
            Empfohlene Massnahme
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-titanium-200">{finding.detail}</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-titanium-500">
        {finding.paragraph_ref && (
          <span className="font-mono">{finding.paragraph_ref}</span>
        )}
        <span className="font-mono text-titanium-600">{finding.id}</span>
      </div>
    </li>
  );
}

function BizCell({ label, value, sev }: { label: string; value: string; sev?: AuditResultFinding['severity'] }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">{label}</div>
      <div className={`mt-0.5 text-[13px] ${sev ? scoreSevColor(sev) : 'text-titanium-200'}`}>{value}</div>
    </div>
  );
}

function scoreSevColor(sev: AuditResultFinding['severity']): string {
  return {
    critical: 'text-rose-300 font-semibold',
    high:     'text-orange-300 font-semibold',
    medium:   'text-amber-300',
    low:      'text-titanium-300',
    info:     'text-sky-300',
    pass:     'text-emerald-300',
  }[sev];
}

function GovernanceOnboardingCta({ onStart }: { onStart: () => void }) {
  return (
    <div className="border border-cyan-600/60 bg-gradient-to-br from-obsidian-900 to-obsidian-950 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Zap className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
        <div>
          <h3 className="font-display text-base font-bold text-titanium-50 sm:text-lg">
            Personalisierte Governance-Empfehlung
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-titanium-300">
            Basierend auf Deinen Befunden analysieren wir Dein Governance-Profil und empfehlen
            den passenden Plan für Deine Needs — mit Zeit-to-Value und konkreten Handlungsschritten.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onStart}
              className="inline-flex items-center gap-1.5 bg-cyan-500 px-4 py-2 text-sm font-bold text-obsidian-950 hover:bg-cyan-400"
            >
              Analyse starten <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              to="/governance-os-pricing"
              className="inline-flex items-center gap-1.5 border border-titanium-700 bg-obsidian-950 px-4 py-2 text-sm font-semibold text-titanium-200 hover:border-titanium-500"
            >
              Alle Pläne vergleichen
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function MonitoringCta() {
  return (
    <div className="border border-security-500/60 bg-gradient-to-br from-obsidian-900 to-obsidian-950 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-security-400" />
        <div>
          <h3 className="font-display text-base font-bold text-titanium-50 sm:text-lg">
            Befunde dauerhaft fixen — mit Continuous Monitoring
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-titanium-300">
            Du siehst beim naechsten Scan den Delta, bekommst Fix-Empfehlungen mit Code-Snippets
            und einen E-Mail-Alert, sobald sich an Deinem Compliance-Score etwas aendert.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-1.5 bg-security-500 px-4 py-2 text-sm font-bold text-white hover:bg-security-600"
            >
              Tarife ansehen <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact-sales?source=audit-result"
              className="inline-flex items-center gap-1.5 border border-titanium-700 bg-obsidian-950 px-4 py-2 text-sm font-semibold text-titanium-200 hover:border-titanium-500"
            >
              Demo-Call buchen
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShareCard({ shareUrl, domain, score }: { shareUrl: string; domain?: string; score?: number }) {
  const xText =
    domain && typeof score === 'number'
      ? `${domain} hat ${score}/100 im DSGVO-Audit. Wie schneidet Deine Site ab?`
      : 'Mein DSGVO-Audit-Ergebnis von RealSync Dynamics.';
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
  const xUrl        = `https://twitter.com/intent/tweet?text=${encodeURIComponent(xText)}&url=${encodeURIComponent(shareUrl)}`;

  return (
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
