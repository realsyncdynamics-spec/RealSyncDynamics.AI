// Panels des App Builder Workspace — Projekt-Navigation (links), die rechte
// Spalte (Assistent · Eigenschaften · Probleme · Governance) und die unteren
// Leisten (Konsole, Verlauf).
//
// Alles hier zeigt nur, was es gibt: Die Probleme kommen aus der statischen
// Analyse des Kerns und den Blockern der letzten Gate-Bewertung, der Verlauf
// aus der Versionskette, die Governance aus Nachweisen in der Datenbank.
// Nichts wird abgeleitet, nichts erfunden (Zielarchitektur §3.1, §7 G2).

import { useState, type ReactElement, type ReactNode } from 'react';
import { AlertTriangle, Bot, CheckCircle2, ChevronRight, Copy, Info, Lock, PencilLine, Plus, ShieldAlert, ShieldCheck, ShieldQuestionMark, ShieldX, Trash2, XCircle } from 'lucide-react';
import {
  allowedPageOperations,
  pageProtection,
  slugify,
  validatePageSlug,
  type PageOperation,
  type PublishGateEvaluation,
  type RuntimeFinding,
  type Severity,
  type SiteBlueprint,
  type SitePage,
} from '../../../../packages/siteos-core/src/index';
import type { AgentRunRow, CustodyEventRow, EvaluationRow, StoredBlueprintRow } from '../siteOsApi';

export const SECTION_LABEL = 'mb-3 text-[10px] font-bold uppercase tracking-[.16em] text-black/35';
const MONO = 'font-mono text-[10px] text-black/50';

// ─────────────────────────────────────────────────────────────────────
// Projekt-Navigation (links)
// ─────────────────────────────────────────────────────────────────────

export type NavTab = 'pages' | 'components' | 'assets' | 'data' | 'integrations';

export const NAV_TABS: ReadonlyArray<{ id: NavTab; label: string }> = [
  { id: 'pages', label: 'Seiten' },
  { id: 'components', label: 'Bausteine' },
  { id: 'assets', label: 'Medien' },
  { id: 'data', label: 'Daten' },
  { id: 'integrations', label: 'Integrationen' },
];

export function ProjectNav(props: {
  tab: NavTab;
  onTab: (tab: NavTab) => void;
  blueprint: SiteBlueprint;
  pagePath: string;
  onOpenPage: (path: string) => void;
  /**
   * Seitenoperationen (Schritt B). Jede läuft sofort als neue Version über
   * `siteos/edit` — nichts davon passiert nur im Browser. Fehlt der Handler,
   * zeigt die Liste keine Aktionen.
   */
  onPageOperations?: (ops: PageOperation[]) => void;
  /** Während eine Operation läuft: keine zweite starten. */
  busy?: boolean;
  /** Puck-Teile — nur im Bearbeiten-Modus vorhanden. */
  puck?: { outline: ReactNode; components: ReactNode };
}): ReactElement {
  const { tab, onTab, blueprint, pagePath, onOpenPage, onPageOperations, busy = false, puck } = props;
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1" role="tablist" aria-label="Projekt">
        {NAV_TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => onTab(item.id)}
            className={`rounded-md px-2 py-1 text-[11px] ${tab === item.id ? 'bg-black/[.06] font-semibold' : 'text-black/55 hover:bg-black/[.03]'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'pages' && (
        <div>
          <PagesPanel blueprint={blueprint} pagePath={pagePath} onOpenPage={onOpenPage} onPageOperations={onPageOperations} busy={busy} />
          {puck && (
            <div className="mt-6 border-t border-black/[.07] pt-5">
              {puck.outline}
            </div>
          )}
        </div>
      )}

      {tab === 'components' && (
        puck ? (
          <div>
            <p className="mb-3 text-[11px] leading-5 text-black/45">In die Seite ziehen. Formulare und Karten bringen Rechtsgrundlage und Einwilligung mit.</p>
            {puck.components}
          </div>
        ) : (
          <p className="text-[11px] leading-5 text-black/45">Bausteine stehen im Bearbeiten-Modus bereit.</p>
        )
      )}

      {tab === 'assets' && (
        <ComingSoon
          title="Medien"
          detail="Upload, Auswahl und Vorschau folgen mit einem eigenen, mandantengetrennten Speicherbereich. Bilder sind im Blueprint heute Platzhalter ohne Quelle."
        />
      )}
      {tab === 'data' && (
        <ComingSoon
          title="Daten"
          detail="Ein Backend-Builder ist nicht Teil dieser Phase. Es werden keine Datenstrukturen angelegt."
        />
      )}
      {tab === 'integrations' && (
        <ComingSoon
          title="Integrationen"
          detail="Angebunden wird nur, was heute sicher vorhanden ist. Für Sites gibt es noch keine freigegebene Integration."
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Seiten — Liste und Operationen (Schritt B)
// ─────────────────────────────────────────────────────────────────────

type PageForm =
  | { kind: 'create'; title: string; slug: string; slugTouched: boolean }
  | { kind: 'edit'; path: string; title: string; slug: string };

/**
 * Was hier steht, sagt nur, was der Server **annehmen wird** — geprüft mit
 * denselben Funktionen (`validatePageSlug`, `allowedPageOperations`). Die
 * Entscheidung fällt im Kern auf dem Server; die Oberfläche zeigt deshalb
 * für Rechtsseiten keine Aktionen und für die Startseite nur die erlaubten.
 */
export function PagesPanel(props: {
  blueprint: SiteBlueprint;
  pagePath: string;
  onOpenPage: (path: string) => void;
  onPageOperations?: (ops: PageOperation[]) => void;
  busy: boolean;
}): ReactElement {
  const { blueprint, pagePath, onOpenPage, onPageOperations, busy } = props;
  const [form, setForm] = useState<PageForm | null>(null);
  const canOperate = Boolean(onPageOperations) && !busy;

  const submit = () => {
    if (!form || !onPageOperations) return;
    if (form.kind === 'create') {
      onPageOperations([{ op: 'create', title: form.title.trim(), slug: form.slug.trim() }]);
    } else {
      const page = blueprint.pages.find((p) => p.path === form.path);
      if (!page) return;
      const ops: PageOperation[] = [];
      if (form.title.trim() !== page.title) ops.push({ op: 'rename', path: page.path, title: form.title.trim() });
      if (page.path !== '/' && `/${form.slug.trim()}` !== page.path) ops.push({ op: 'slug', path: page.path, slug: form.slug.trim() });
      if (ops.length > 0) onPageOperations(ops);
    }
    setForm(null);
  };

  const remove = (page: SitePage) => {
    if (!onPageOperations) return;
    const ok = window.confirm(`Seite „${page.title}" (${page.path}) löschen? Navigationslinks darauf entfallen, andere Verweise zeigen auf die Startseite. Es entsteht eine neue Version; die alte bleibt im Verlauf.`);
    if (ok) onPageOperations([{ op: 'delete', path: page.path }]);
  };

  // Slug-Prüfung wie auf dem Server, für sofortige Rückmeldung.
  const slugState = form
    ? validatePageSlug(form.slug.trim(), blueprint, form.kind === 'edit' ? form.path : undefined)
    : null;
  const slugFrozen = form?.kind === 'edit' && form.path === '/';
  const slugHint = !form || slugFrozen ? null
    : slugState && !slugState.ok
      ? ({ 'slug.empty': 'Bitte einen Slug angeben.', 'slug.invalid': `Nur Kleinbuchstaben, Ziffern und Bindestriche${slugState.suggestion ? ` — Vorschlag: ${slugState.suggestion}` : ''}.`, 'slug.reserved': 'Dieser Pfad ist für Rechtsseiten reserviert.', 'slug.taken': `Diesen Pfad gibt es schon${slugState.suggestion ? ` — frei wäre ${slugState.suggestion}` : ''}.` } as const)[slugState.reason]
      : null;
  const canSubmit = Boolean(form && form.title.trim().length > 0 && (slugFrozen || (slugState && slugState.ok)));

  const formView = form && (
    <form
      onSubmit={(e) => { e.preventDefault(); if (canSubmit) submit(); }}
      className="mt-2 rounded-lg border border-black/[.08] bg-[#f8fafc] p-3"
      aria-label={form.kind === 'create' ? 'Neue Seite' : 'Seite bearbeiten'}
    >
      <label className="block text-[10px] font-semibold uppercase tracking-wide text-black/40">Titel</label>
      <input
        value={form.title}
        autoFocus
        maxLength={80}
        onChange={(e) => setForm(form.kind === 'create'
          ? { ...form, title: e.target.value, slug: form.slugTouched ? form.slug : slugify(e.target.value) }
          : { ...form, title: e.target.value })}
        aria-label="Titel der Seite"
        className="mt-1 w-full rounded-md border border-black/[.1] px-2 py-1.5 text-xs outline-none focus:border-cyan-400/60"
      />
      <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-black/40">Pfad</label>
      <div className="mt-1 flex items-center gap-1 text-xs">
        <span className={MONO}>/</span>
        <input
          value={slugFrozen ? '' : form.slug}
          disabled={slugFrozen}
          maxLength={64}
          onChange={(e) => setForm(form.kind === 'create' ? { ...form, slug: e.target.value, slugTouched: true } : { ...form, slug: e.target.value })}
          aria-label="Slug der Seite"
          placeholder={slugFrozen ? 'Startseite' : 'slug'}
          className="w-full rounded-md border border-black/[.1] px-2 py-1.5 font-mono text-xs outline-none focus:border-cyan-400/60 disabled:bg-black/[.03]"
        />
      </div>
      {slugHint && <p className="mt-1 text-[11px] leading-4 text-amber-800">{slugHint}</p>}
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={!canSubmit || busy} className="rounded-md bg-[#111827] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40">{form.kind === 'create' ? 'Seite anlegen' : 'Übernehmen'}</button>
        <button type="button" onClick={() => setForm(null)} className="rounded-md px-3 py-1.5 text-[11px] text-black/55 hover:bg-black/[.04]">Abbrechen</button>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-black/40">Wird sofort als neue Version gespeichert — samt ungespeicherter Änderungen.</p>
    </form>
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className={SECTION_LABEL}>Seiten</div>
        {onPageOperations && (
          <button
            onClick={() => setForm({ kind: 'create', title: '', slug: '', slugTouched: false })}
            disabled={!canOperate}
            className="mb-3 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-black/60 hover:bg-black/[.04] disabled:opacity-40"
          >
            <Plus size={12} /> Neue Seite
          </button>
        )}
      </div>
      {form?.kind === 'create' && formView}
      <ul>
        {blueprint.pages.map((page, i) => {
          const protection = pageProtection(page);
          const allowed = allowedPageOperations(page);
          const editing = form?.kind === 'edit' && form.path === page.path;
          return (
            <li key={page.path} data-testid="page-row" data-path={page.path}>
              <div className={`group flex items-center gap-1 rounded-lg pr-1 hover:bg-black/[.04] ${page.path === pagePath ? 'bg-black/[.04]' : ''}`}>
                <button
                  onClick={() => onOpenPage(page.path)}
                  aria-pressed={page.path === pagePath}
                  className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs ${page.path === pagePath ? 'font-semibold' : ''}`}
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-black/[.04] text-[9px] text-black/45">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{page.path === '/' ? 'Startseite' : page.title}</span>
                  <span className={`${MONO} hidden truncate sm:inline`}>{page.path}</span>
                </button>
                {protection === 'legal' ? (
                  <span className="p-1.5 text-black/35" title="Rechtsseite — wird nicht umbenannt, verschoben, dupliziert oder gelöscht" aria-label="Rechtsseite, geschützt"><Lock size={12} /></span>
                ) : onPageOperations && (
                  <span className="flex shrink-0 items-center">
                    {allowed.has('rename') && <button onClick={() => setForm({ kind: 'edit', path: page.path, title: page.title, slug: page.path === '/' ? '' : page.path.slice(1) })} disabled={!canOperate} className="rounded-md p-1.5 text-black/45 hover:bg-black/[.06] hover:text-black disabled:opacity-40" aria-label={`Seite „${page.title}" umbenennen`} title="Umbenennen / Pfad ändern"><PencilLine size={12} /></button>}
                    {allowed.has('duplicate') && <button onClick={() => onPageOperations([{ op: 'duplicate', path: page.path }])} disabled={!canOperate} className="rounded-md p-1.5 text-black/45 hover:bg-black/[.06] hover:text-black disabled:opacity-40" aria-label={`Seite „${page.title}" duplizieren`} title="Duplizieren"><Copy size={12} /></button>}
                    {allowed.has('delete') && <button onClick={() => remove(page)} disabled={!canOperate} className="rounded-md p-1.5 text-black/45 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40" aria-label={`Seite „${page.title}" löschen`} title="Löschen"><Trash2 size={12} /></button>}
                  </span>
                )}
              </div>
              {editing && formView}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] leading-5 text-black/45">
        Rechtsseiten (Impressum, Datenschutz, Barrierefreiheit) sind geschützt. Jede Seitenoperation prüft der Server und legt eine neue Version an.
      </p>
    </div>
  );
}

function ComingSoon({ title, detail }: { title: string; detail: string }): ReactElement {
  return (
    <div>
      <div className={SECTION_LABEL}>{title}</div>
      <div className="rounded-lg border border-dashed border-black/[.12] p-3 text-[11px] leading-5 text-black/50">
        <span className="mr-2 rounded bg-black/[.05] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">In Vorbereitung</span>
        {detail}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Assistent (rechts)
// ─────────────────────────────────────────────────────────────────────

export const ASSISTANT_SUGGESTIONS: readonly string[] = [
  'Hero hochwertiger machen',
  'Kontaktbereich ergänzen',
  'Mobile-Layout verbessern',
  'Preise ergänzen',
  'Barrierefreiheit verbessern',
];

/**
 * Der Assistent dieser Phase ist der vorhandene KI-Neubau: Die Anweisung
 * geht mit der Ausgangs-URL an den Erstbau, der daraus eine neue Fassung
 * erzeugt und hierher zurückleitet. Ein Assistent, der Änderungen als
 * geprüfte Actions auf die gespeicherte Fassung anwendet, folgt im nächsten
 * Schritt — bis dahin wird hier nichts versprochen, was es nicht gibt.
 */
export function AssistantPanel(props: {
  sourceUrl: string | null;
  instruction: string;
  onInstruction: (text: string) => void;
  onRebuild: (text: string) => void;
  busy: boolean;
  children?: ReactNode;
}): ReactElement {
  const { sourceUrl, instruction, onInstruction, onRebuild, busy, children } = props;
  const canRebuild = Boolean(sourceUrl);
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-bold"><Bot size={17} className="text-cyan-600" /> AI Assistant</div>
      <p className="mt-1 text-xs leading-5 text-black/45">
        {canRebuild
          ? 'Beschreiben Sie die Änderung. Die KI baut die Website aus der Ausgangsseite neu; der Stand hier wird ersetzt.'
          : 'Die Ausgangs-URL dieser Site ist in dieser Sitzung nicht bekannt. Ein KI-Neubau ist über den Erstbau möglich.'}
      </p>
      <textarea
        value={instruction}
        onChange={(e) => onInstruction(e.target.value)}
        placeholder="z. B. Hero hochwertiger, CTA stärker, mehr Vertrauen …"
        aria-label="Anweisung an die KI"
        disabled={!canRebuild}
        className="mt-3 min-h-24 w-full resize-none rounded-xl border border-black/[.08] p-3 text-xs outline-none disabled:bg-black/[.02]"
      />
      <button
        onClick={() => { const text = instruction.trim(); if (text) onRebuild(text); }}
        disabled={!canRebuild || !instruction.trim() || busy}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#111827] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40"
      >
        Mit KI neu bauen
      </button>
      <div className={`mt-5 ${SECTION_LABEL}`}>Vorschläge</div>
      {ASSISTANT_SUGGESTIONS.map((text) => (
        <button
          key={text}
          onClick={() => onRebuild(text)}
          disabled={!canRebuild || busy}
          className="mt-2 flex w-full items-center justify-between rounded-lg border border-black/[.07] px-3 py-2.5 text-left text-xs text-black/60 hover:bg-black/[.03] disabled:opacity-40"
        >
          {text}<ChevronRight size={13} />
        </button>
      ))}
      <p className="mt-3 text-[11px] leading-5 text-black/45">
        Der Assistent liefert keinen HTML-Code und keinen Blueprint. Was entsteht, prüft der Server und legt es als neue Version ab.
      </p>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Rechte Spalte — vier Tabs (Zielbild §4: Assistent · Properties · Problems · Governance)
// ─────────────────────────────────────────────────────────────────────

export type RightTab = 'assistant' | 'properties' | 'problems' | 'governance';

export const RIGHT_TABS: ReadonlyArray<{ id: RightTab; label: string }> = [
  { id: 'assistant', label: 'Assistent' },
  { id: 'properties', label: 'Eigenschaften' },
  { id: 'problems', label: 'Probleme' },
  { id: 'governance', label: 'Governance' },
];

// ─────────────────────────────────────────────────────────────────────
// Governance-Status der gespeicherten Version (Kopfzeile)
// ─────────────────────────────────────────────────────────────────────

export type GovernanceStatusKind = 'none' | 'publishable' | 'approval' | 'blocked';

export interface GovernanceStatus {
  kind: GovernanceStatusKind;
  label: string;
  /** Länger, für `title`. */
  detail: string;
  evaluation: EvaluationRow | null;
}

/**
 * Leitet den Status aus der jüngsten gespeicherten Bewertung **dieser**
 * Version ab — nicht aus der Kette insgesamt, und nie aus der lokalen,
 * ungespeicherten Fassung. `evaluations` ist absteigend nach `evaluated_at`
 * sortiert (`listEvaluations`), der erste Treffer ist der jüngste. Ohne
 * Bewertung heißt es „keine", nicht „in Ordnung".
 */
export function governanceStatus(evaluations: EvaluationRow[], blueprintId: string): GovernanceStatus {
  const evaluation = evaluations.find((ev) => ev.blueprint_id === blueprintId) ?? null;
  if (!evaluation) {
    return { kind: 'none', label: 'Keine Bewertung', detail: 'Für die gespeicherte Version liegt keine Bewertung des Publish Gates vor. „Prüfen" erzeugt eine.', evaluation };
  }
  if (evaluation.publishable) {
    return { kind: 'publishable', label: 'Veröffentlichbar', detail: `Publish Gate: ${evaluation.status} · veröffentlichbar (${evaluation.evaluated_at.slice(0, 16).replace('T', ' ')}).`, evaluation };
  }
  if (evaluation.human_approval_required && !evaluation.approved_by) {
    return { kind: 'approval', label: 'Freigabe nötig', detail: 'Das Publish Gate verlangt die Freigabe einer berechtigten Person.', evaluation };
  }
  const n = evaluation.blockers.length;
  return { kind: 'blocked', label: n > 0 ? `Blockiert (${n})` : 'Blockiert', detail: `Publish Gate: ${evaluation.status}${n > 0 ? ` · ${n} Blocker` : ''}.`, evaluation };
}

const STATUS_CLASS: Record<GovernanceStatusKind, string> = {
  none: 'bg-black/[.05] text-black/60',
  publishable: 'bg-emerald-50 text-emerald-700',
  approval: 'bg-amber-50 text-amber-800',
  blocked: 'bg-rose-50 text-rose-700',
};

function StatusIcon({ kind }: { kind: GovernanceStatusKind }): ReactElement {
  if (kind === 'publishable') return <ShieldCheck size={13} />;
  if (kind === 'approval') return <ShieldAlert size={13} />;
  if (kind === 'blocked') return <ShieldX size={13} />;
  return <ShieldQuestionMark size={13} />;
}

/** Chip in der Kopfzeile; ein Klick öffnet den Governance-Tab. */
export function GovernanceStatusChip({ status, onClick }: { status: GovernanceStatus; onClick: () => void }): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="governance-status"
      data-status={status.kind}
      title={status.detail}
      aria-label={`Governance: ${status.label}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold sm:px-3 sm:py-1.5 ${STATUS_CLASS[status.kind]}`}
    >
      <StatusIcon kind={status.kind} />
      <span className="hidden sm:inline">{status.label}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Untere Leisten
// ─────────────────────────────────────────────────────────────────────

export type BottomTab = 'console' | 'history';

export interface ConsoleEntry {
  at: string;
  level: 'info' | 'ok' | 'error';
  text: string;
}

export function ConsolePanel({ entries }: { entries: ConsoleEntry[] }): ReactElement {
  if (entries.length === 0) return <p className="text-[11px] text-black/45">Noch keine Ereignisse in dieser Sitzung.</p>;
  return (
    <ul className="space-y-1 font-mono text-[11px]">
      {entries.slice().reverse().map((entry, i) => (
        <li key={`${entry.at}-${i}`} className={entry.level === 'error' ? 'text-rose-700' : entry.level === 'ok' ? 'text-emerald-700' : 'text-black/60'}>
          <span className="text-black/35">{entry.at.slice(11, 19)}</span> {entry.text}
        </li>
      ))}
    </ul>
  );
}

const SEVERITY_ORDER: readonly Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

function SeverityIcon({ severity }: { severity: Severity }): ReactElement {
  if (severity === 'critical' || severity === 'high') return <XCircle size={13} className="text-rose-600" />;
  if (severity === 'medium') return <AlertTriangle size={13} className="text-amber-600" />;
  return <Info size={13} className="text-black/40" />;
}

/**
 * Probleme = Befunde der statischen Analyse der **lokalen** Fassung (so wie
 * sie gespeichert würde) plus Blocker und Hinweise der letzten Bewertung
 * des Publish Gates, falls es eine gibt. Beides sind vorhandene Validatoren.
 */
export function ProblemsPanel({ findings, gate }: { findings: RuntimeFinding[]; gate: PublishGateEvaluation | null }): ReactElement {
  const sorted = findings.slice().sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
  return (
    <div className="space-y-4">
      <div>
        <div className={SECTION_LABEL}>Statische Analyse ({findings.length})</div>
        {sorted.length === 0 ? (
          <p className="flex items-center gap-2 text-[11px] text-emerald-700"><CheckCircle2 size={13} /> Keine Befunde in der aktuellen Fassung.</p>
        ) : (
          <ul className="space-y-1.5">
            {sorted.map((f, i) => (
              <li key={`${f.code}-${f.locator ?? ''}-${i}`} className="flex items-start gap-2 text-[11px] leading-5">
                <span className="mt-1"><SeverityIcon severity={f.severity} /></span>
                <span className="min-w-0">
                  <span className="font-semibold">{f.title}</span>
                  <span className={`ml-2 ${MONO}`}>{f.code}{f.locator ? ` · ${f.locator}` : ''}</span>
                  <span className="block text-black/55">{f.remediation}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <div className={SECTION_LABEL}>Publish Gate</div>
        {!gate ? (
          <p className="text-[11px] text-black/45">Noch keine Bewertung für die gespeicherte Version. „Prüfen" in der Kopfzeile erzeugt eine.</p>
        ) : (
          <div className="text-[11px] leading-5">
            <p className="flex items-center gap-2">
              {gate.publishable ? <CheckCircle2 size={13} className="text-emerald-600" /> : <XCircle size={13} className="text-rose-600" />}
              <span className="font-semibold">{gate.publishable ? 'Veröffentlichbar' : `Nicht veröffentlichbar (${gate.status})`}</span>
              <span className={MONO}>{gate.evaluation_id.slice(0, 8)} · {gate.evaluated_at.slice(0, 16).replace('T', ' ')}</span>
            </p>
            {gate.blockers.map((b) => <p key={b} className="ml-5 text-rose-700">{b}</p>)}
            {gate.warnings.map((w) => <p key={w} className="ml-5 text-amber-700">{w}</p>)}
            {gate.human_approval_required && <p className="ml-5 text-amber-700">Eine Freigabe durch eine berechtigte Person ist erforderlich.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export interface ChainRow {
  id: string; version: number; content_sha256: string; prev_hash: string | null;
  status: string; origin_model: string | null; created_at: string;
}

export function HistoryPanel({ chain, currentId }: { chain: ChainRow[]; currentId: string | null }): ReactElement {
  if (chain.length === 0) return <p className="text-[11px] text-black/45">Keine Versionen geladen.</p>;
  return (
    <ol className="space-y-1.5">
      {chain.slice().reverse().map((row) => (
        <li key={row.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] ${row.id === currentId ? 'font-semibold' : ''}`}>
          <span>v{row.version}</span>
          <span className={MONO}>{row.content_sha256.slice(0, 12)}…</span>
          <span className={MONO}>← {row.prev_hash ? `${row.prev_hash.slice(0, 12)}…` : 'Anfang'}</span>
          <span className="text-black/50">{row.created_at.slice(0, 16).replace('T', ' ')}</span>
          <span className="text-black/50">{row.status}</span>
          {row.origin_model && <span className={MONO}>{row.origin_model}</span>}
          {row.id === currentId && <span className="rounded bg-black/[.06] px-1.5 text-[10px]">aktuell</span>}
        </li>
      ))}
    </ol>
  );
}

export function GovernancePanel(props: {
  stored: StoredBlueprintRow;
  local: SiteBlueprint;
  evaluations: EvaluationRow[];
  custody: CustodyEventRow[];
  agentRuns: AgentRunRow[];
  assetRef: string;
}): ReactElement {
  const { stored, local, evaluations, custody, agentRuns, assetRef } = props;
  const blocks = local.pages.flatMap((p) => p.blocks);
  const aiBlocks = blocks.filter((b) => b.aiGenerated).length;
  return (
    <div className="grid gap-5 text-[11px] leading-5">
      <div>
        <div className={SECTION_LABEL}>Version</div>
        <dl className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-2">
          <dt className="text-black/45">Version</dt><dd>v{stored.version} · {stored.status}</dd>
          <dt className="text-black/45">Hash</dt><dd className={`${MONO} break-all`}>{stored.content_sha256}</dd>
          <dt className="text-black/45">Vorgänger</dt><dd className={`${MONO} break-all`}>{stored.prev_hash ?? '— (erste Version)'}</dd>
          <dt className="text-black/45">Herkunft</dt><dd>{stored.origin_source}{stored.origin_model ? ` · ${stored.origin_model}` : ''}</dd>
          <dt className="text-black/45">KI-generiert</dt><dd>{aiBlocks} von {blocks.length} Blöcken{local.pages.some((p) => p.blocks.some((b) => b.kind === 'ai-disclosure')) ? ' · KI-Hinweis vorhanden' : ' · kein KI-Hinweis'}</dd>
          <dt className="text-black/45">Nachweis-Ref</dt><dd className={`${MONO} break-all`}>{assetRef}</dd>
        </dl>
      </div>
      <div>
        <div className={SECTION_LABEL}>Herkunftskette ({custody.length})</div>
        {custody.length === 0 ? <p className="text-black/45">Kein Custody-Ereignis gefunden.</p> : (
          <ul className="space-y-1">
            {custody.map((e) => (
              <li key={e.seq} className="flex flex-wrap gap-x-2">
                <span>#{e.seq} {e.action}</span>
                <span className={MONO}>{e.content_sha256.slice(0, 12)}…</span>
                <span className="text-black/50">{e.event_ts.slice(0, 16).replace('T', ' ')}</span>
                <span className={MONO}>{e.signature ? 'signiert' : 'unsigniert'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <div className={SECTION_LABEL}>Publish-Bewertungen ({evaluations.length})</div>
        {evaluations.length === 0 ? <p className="text-black/45">Noch keine Bewertung. Es wurde nichts veröffentlicht.</p> : (
          <ul className="space-y-1">
            {evaluations.map((ev) => (
              <li key={ev.id} className="flex flex-wrap items-center gap-x-2">
                {ev.publishable ? <ShieldCheck size={12} className="text-emerald-600" /> : <XCircle size={12} className="text-rose-600" />}
                <span>{ev.status}{ev.publishable ? ' · veröffentlichbar' : ''}</span>
                <span className={MONO}>{ev.artifact_sha256.slice(0, 12)}…</span>
                <span className="text-black/50">{ev.evaluated_at.slice(0, 16).replace('T', ' ')}</span>
                {ev.approved_by && <span className="text-emerald-700">freigegeben</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-black/45">Auslieferung: kein Pfad vorhanden. Eine Bewertung ist keine Veröffentlichung.</p>
      </div>
      <div>
        <div className={SECTION_LABEL}>Agenten ({agentRuns.length})</div>
        {agentRuns.length === 0 ? <p className="text-black/45">Keine Agentenläufe zu dieser Site.</p> : (
          <ul className="space-y-1">
            {agentRuns.slice(0, 8).map((run) => (
              <li key={run.id} className="flex flex-wrap gap-x-2">
                <span>{run.agent}</span>
                <span className="text-black/50">{run.status}</span>
                {run.finding_codes.length > 0 && <span className={MONO}>{run.finding_codes.slice(0, 3).join(', ')}{run.finding_codes.length > 3 ? ' …' : ''}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
