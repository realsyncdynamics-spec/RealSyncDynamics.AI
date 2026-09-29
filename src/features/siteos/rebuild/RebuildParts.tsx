// Bausteine des Rebuild-Workflows: Stufenleiste, skalierte Vorschau,
// Beleg-Schublade. Gemeinsam genutzt von der Rebuild-Seite und dem Workspace.

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Check, FileSearch, X } from 'lucide-react';
import { SandboxedPreviewFrame } from '../../../components/preview/SandboxedPreviewFrame';
import type { EvidenceItem } from '../../../../packages/siteos-core/src/index';

// ─────────────────────────────────────────────────────────────────────
// Stufen
// ─────────────────────────────────────────────────────────────────────

export type StageKey = 'discover' | 'assess' | 'rebuild' | 'refine' | 'publish' | 'automate' | 'govern';

export const STAGES: ReadonlyArray<{ key: StageKey; label: string; hint: string }> = [
  { key: 'discover', label: 'Lesen', hint: 'Seiten, Texte, Marke, Formulare' },
  { key: 'assess', label: 'Bewerten', hint: 'Acht Kriterien mit Belegen' },
  { key: 'rebuild', label: 'Neu bauen', hint: 'Zwei bis drei Richtungen' },
  { key: 'refine', label: 'Verfeinern', hint: 'Anweisungen in Klartext' },
  { key: 'publish', label: 'Veröffentlichen', hint: 'Prüfen, GO, Export' },
  { key: 'automate', label: 'Automatisieren', hint: 'Anfragen, Termine, Chat' },
  { key: 'govern', label: 'Steuern', hint: 'Nachweise, Freigaben, Scans' },
];

export function RebuildStepper({ current, done, onSelect }: { current: StageKey; done: StageKey[]; onSelect?: (stage: StageKey) => void }): ReactElement {
  return (
    <nav aria-label="Rebuild-Schritte" className="overflow-x-auto">
      <ol className="flex min-w-max items-stretch gap-1.5">
        {STAGES.map((stage, index) => {
          const isDone = done.includes(stage.key);
          const isCurrent = stage.key === current;
          const body = (
            <>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${isDone ? 'bg-emerald-600 text-white' : isCurrent ? 'bg-[#111827] text-white' : 'bg-black/[.06] text-black/45'}`}>
                {isDone ? <Check size={12} aria-hidden="true" /> : index + 1}
              </span>
              <span className="min-w-0 text-left">
                <span className={`block text-[11px] font-bold ${isCurrent ? 'text-[#111827]' : 'text-black/60'}`}>{stage.label}</span>
                <span className="block text-[10px] leading-4 text-black/40">{stage.hint}</span>
              </span>
            </>
          );
          return (
            <li key={stage.key} aria-current={isCurrent ? 'step' : undefined}>
              {onSelect ? (
                <button type="button" onClick={() => onSelect(stage.key)} className={`flex h-full items-center gap-2 rounded-xl border px-3 py-2 ${isCurrent ? 'border-[#111827]/20 bg-white shadow-sm' : 'border-transparent hover:bg-white/70'}`}>{body}</button>
              ) : (
                <div className={`flex h-full items-center gap-2 rounded-xl border px-3 py-2 ${isCurrent ? 'border-[#111827]/20 bg-white shadow-sm' : 'border-transparent'}`}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Skalierte Vorschau
// ─────────────────────────────────────────────────────────────────────

const DEVICE_PX = { desktop: 1280, mobile: 390 } as const;

/**
 * Die echte Seite in Gerätebreite, auf die Breite des Containers verkleinert
 * — damit zwei oder drei Richtungen nebeneinander vergleichbar sind, ohne
 * dass das Layout bei schmaler Breite in die Mobilansicht kippt.
 */
export function ScaledPreview({ html, title, device, height = 520 }: { html: string; title: string; device: 'desktop' | 'mobile'; height?: number }): ReactElement {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const deviceWidth = DEVICE_PX[device];
  const available = device === 'mobile' ? Math.min(width, 300) : width;
  const scale = available > 0 ? Math.min(1, available / deviceWidth) : 0.25;
  return (
    <div ref={box} className="relative w-full overflow-hidden rounded-xl border border-black/[.08] bg-[#e7ebf0]" style={{ height }}>
      <div className="absolute left-1/2 top-0 origin-top" style={{ width: deviceWidth, height: height / scale, transform: `translateX(-50%) scale(${scale})` }}>
        <SandboxedPreviewFrame title={title} html={html} className="h-full w-full border-0 bg-white" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Belege
// ─────────────────────────────────────────────────────────────────────

const KIND_LABEL: Record<EvidenceItem['kind'], string> = {
  element: 'Element',
  absence: 'Geprüfte Abwesenheit',
  document: 'Dokument',
  css: 'Stylesheet',
  resource: 'Ressource',
};

/**
 * Schublade mit den Belegen einer Aussage: Seite, Elementpfad, Auszug,
 * Zeitpunkt, SHA-256. Belege sind Daten der Ausgangsseite — sie werden als
 * Text gezeigt, nie als Markup.
 */
export function EvidenceDrawer({ title, items, onClose }: { title: string; items: EvidenceItem[]; onClose: () => void }): ReactElement {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-[#07111f]/40" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={`Belege: ${title}`} className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 border-b border-black/[.08] px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-black/40"><FileSearch size={13} aria-hidden="true" /> Belege</div>
            <h2 className="mt-1 text-sm font-bold leading-5">{title}</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-black/[.05]" aria-label="Belege schließen"><X size={16} /></button>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {items.length === 0 && <p className="text-xs text-black/50">Keine Belege gefunden.</p>}
          {items.map((item) => (
            <article key={item.id} className="rounded-xl border border-black/[.08] p-3">
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <span className="rounded-full bg-black/[.05] px-2 py-0.5 font-semibold text-black/60">{KIND_LABEL[item.kind]}</span>
                <span className="font-mono text-black/40">{item.id}</span>
              </div>
              <div className="mt-2 break-all font-mono text-[10px] text-black/55">{item.url}</div>
              <div className="mt-1 break-all font-mono text-[10px] text-cyan-800">{item.path}</div>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#f5f6f8] p-2 font-mono text-[11px] leading-4 text-black/75">{item.excerpt}</pre>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[10px] text-black/45">
                <dt>Abgerufen</dt><dd className="font-mono">{item.observedAt}</dd>
                <dt>SHA-256</dt><dd className="break-all font-mono">{item.sha256 ?? 'nicht versiegelt'}</dd>
              </dl>
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}

export function Pill({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'info' | 'muted'; children: ReactNode }): ReactElement {
  const cls = {
    ok: 'bg-emerald-50 text-emerald-700',
    warn: 'bg-amber-50 text-amber-800',
    bad: 'bg-rose-50 text-rose-700',
    info: 'bg-cyan-50 text-cyan-800',
    muted: 'bg-black/[.05] text-black/55',
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{children}</span>;
}
