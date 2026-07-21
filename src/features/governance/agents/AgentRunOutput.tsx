// AgentRunOutput — lesbare Darstellung eines Agenten-Laufergebnisses.
//
// Ersetzt die rohe JSON-Ausgabe im Ergebnis-Modal durch strukturierte
// Karten: Statusleiste, Findings mit Schweregrad-Badges und Empfehlungen
// mit Prioritäts-Badges. Rein präsentational — keine Netzwerkaufrufe.
import React from 'react';
import { AlertTriangle, CheckCircle, Info, ShieldAlert, ShieldCheck, UserCheck } from 'lucide-react';
import type { AgentRunResult } from './agentsApi';

type Severity = 'low' | 'medium' | 'high' | 'critical';
type Priority = 'low' | 'medium' | 'high' | 'urgent';
type RunStatus = AgentRunResult['status'];

// ── Badge-Paletten (Hard-Edge, Obsidian/Titanium) ──────────────────────────
const SEVERITY_STYLE: Record<Severity, string> = {
  low: 'bg-obsidian-800 border-titanium-800 text-titanium-400',
  medium: 'bg-amber-600/15 border-amber-600/40 text-amber-300',
  high: 'bg-orange-600/15 border-orange-600/40 text-orange-300',
  critical: 'bg-red-600/20 border-red-600/50 text-red-300',
};

const SEVERITY_LABEL: Record<Severity, string> = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
  critical: 'Kritisch',
};

const PRIORITY_STYLE: Record<Priority, string> = {
  low: 'bg-obsidian-800 border-titanium-800 text-titanium-400',
  medium: 'bg-sky-600/15 border-sky-600/40 text-sky-300',
  high: 'bg-orange-600/15 border-orange-600/40 text-orange-300',
  urgent: 'bg-red-600/20 border-red-600/50 text-red-300',
};

const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
  urgent: 'Dringend',
};

const STATUS_META: Record<RunStatus, { label: string; cls: string; Icon: typeof CheckCircle }> = {
  success: { label: 'Erfolgreich', cls: 'bg-teal-600/20 border-teal-600/40 text-teal-300', Icon: CheckCircle },
  requires_approval: { label: 'Freigabe erforderlich', cls: 'bg-amber-600/20 border-amber-600/40 text-amber-300', Icon: UserCheck },
  blocked: { label: 'Blockiert', cls: 'bg-red-600/20 border-red-600/50 text-red-300', Icon: ShieldAlert },
  error: { label: 'Fehler', cls: 'bg-red-600/20 border-red-600/50 text-red-300', Icon: AlertTriangle },
};

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 border font-mono text-[10px] uppercase tracking-wide ${className}`}>
      {children}
    </span>
  );
}

// ── Findings ────────────────────────────────────────────────────────────────
function FindingItem({ finding }: { finding: AgentRunResult['findings'][number] }) {
  const severity = (finding.severity as Severity) ?? 'low';
  const title = String(finding.title ?? finding.id ?? 'Befund');
  const description = finding.description ? String(finding.description) : '';
  const evidence = finding.evidence as Record<string, unknown> | undefined;

  return (
    <div className="border border-titanium-800 bg-obsidian-950 p-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-xs font-semibold text-titanium-100 leading-snug">{title}</h4>
        <Badge className={SEVERITY_STYLE[severity]}>{SEVERITY_LABEL[severity]}</Badge>
      </div>
      {description && <p className="mt-1 text-[11px] text-titanium-400 whitespace-pre-line">{description}</p>}
      {evidence && Object.keys(evidence).length > 0 && (
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(evidence).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1">
              <dt className="font-mono text-[9px] text-titanium-600 uppercase">{k}</dt>
              <dd className="font-mono text-[10px] text-titanium-300">{formatValue(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

// ── Empfehlungen ─────────────────────────────────────────────────────────────
function RecommendationItem({ rec }: { rec: AgentRunResult['recommendations'][number] }) {
  const priority = (rec.priority as Priority) ?? 'medium';
  const title = String(rec.title ?? rec.id ?? 'Empfehlung');
  const description = rec.description ? String(rec.description) : '';
  const approval = Boolean(rec.requiresHumanApproval);

  return (
    <div className="border border-titanium-800 bg-obsidian-950 p-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-xs font-semibold text-titanium-100 leading-snug">{title}</h4>
        <Badge className={PRIORITY_STYLE[priority]}>{PRIORITY_LABEL[priority]}</Badge>
      </div>
      {description && <p className="mt-1 text-[11px] text-titanium-400 whitespace-pre-line">{description}</p>}
      {approval && (
        <div className="mt-2">
          <Badge className="bg-amber-600/15 border-amber-600/40 text-amber-300">
            <UserCheck className="h-3 w-3" /> Freigabe erforderlich
          </Badge>
        </div>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="font-mono text-[10px] text-titanium-600 uppercase tracking-wider">{title}</span>
        <span className="font-mono text-[10px] text-titanium-500">({count})</span>
      </div>
      {children}
    </section>
  );
}

/** Rendert ein Agenten-Laufergebnis als lesbare, strukturierte Karten. */
export function AgentRunOutput({ result }: { result: AgentRunResult }) {
  const status = (result.status as RunStatus) ?? 'success';
  const meta = STATUS_META[status] ?? STATUS_META.success;
  const StatusIcon = meta.Icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 border font-mono text-[10px] uppercase tracking-wide ${meta.cls}`}>
          <StatusIcon className="h-3.5 w-3.5" /> {meta.label}
        </span>
      </div>

      {result.summary && (
        <p className="flex items-start gap-2 text-xs text-titanium-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-titanium-500" />
          <span>{result.summary}</span>
        </p>
      )}

      <Section title="Befunde" count={result.findings.length}>
        {result.findings.length === 0 ? (
          <p className="flex items-center gap-1.5 text-[11px] text-titanium-500">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-500" /> Keine Befunde — nichts zu beanstanden.
          </p>
        ) : (
          <div className="space-y-2">
            {result.findings.map((f, i) => (
              <FindingItem key={String(f.id ?? i)} finding={f} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Empfehlungen" count={result.recommendations.length}>
        {result.recommendations.length === 0 ? (
          <p className="text-[11px] text-titanium-500">Keine Empfehlungen.</p>
        ) : (
          <div className="space-y-2">
            {result.recommendations.map((r, i) => (
              <RecommendationItem key={String(r.id ?? i)} rec={r} />
            ))}
          </div>
        )}
      </Section>

      {result.persist_error && (
        <p className="font-mono text-[10px] text-amber-400">
          Hinweis: Lauf nicht persistiert ({result.persist_error}).
        </p>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map((x) => formatValue(x)).join(', ');
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
