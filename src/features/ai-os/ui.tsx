// Kleine Bausteine des AI Command Center. Bewusst eigenständig unter .aios,
// damit Hell/Dunkel nur hier wirkt und keine globalen Tokens berührt werden.

import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import type { Health, OsStatus } from '../../../packages/ai-os-core/src/index';
import { STATUS_LABEL } from '../../product/implementation-status';
import { DENY_HINT, type AiOsResult, type Resource } from './aiOsApi';

export type Tone = 'ok' | 'warn' | 'fail' | 'info' | 'neutral';

export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className="aios-pill" data-tone={tone}>{children}</span>;
}

const HEALTH_TEXT: Record<Health, { tone: Tone; label: string }> = {
  ok: { tone: 'ok', label: 'In Ordnung' },
  warn: { tone: 'warn', label: 'Hinweise' },
  fail: { tone: 'fail', label: 'Handlungsbedarf' },
  unknown: { tone: 'neutral', label: 'Ohne Daten' },
};

export function HealthPill({ health }: { health: Health }) {
  const h = HEALTH_TEXT[health];
  return <Pill tone={h.tone}>{h.label}</Pill>;
}

export function StatusPill({ status }: { status: OsStatus }) {
  const tone: Tone = status === 'live' ? 'ok' : status === 'preview' ? 'info' : 'neutral';
  return <Pill tone={tone}>{STATUS_LABEL[status]}</Pill>;
}

export function conclusionTone(conclusion: string | null | undefined, status?: string | null): Tone {
  if (status && status !== 'completed') return 'info';
  if (conclusion === 'success') return 'ok';
  if (conclusion === 'skipped' || conclusion === 'neutral') return 'neutral';
  if (!conclusion) return 'neutral';
  return 'fail';
}

export function Panel({ title, actions, children, source }: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Datenquelle, sichtbar für die Nachvollziehbarkeit. */
  source?: string;
}) {
  return (
    <section className="aios-panel">
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="aios-h2">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
      {source && <p className="text-xs aios-muted">Quelle: <span className="aios-mono">{source}</span></p>}
    </section>
  );
}

export function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="aios-kpi">
      <div className="aios-kpi-label">{label}</div>
      <div className="aios-kpi-value">{value}</div>
      {sub && <div className="aios-kpi-sub">{sub}</div>}
    </div>
  );
}

export function Note({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return <div className="aios-note" data-tone={tone} role={tone === 'fail' ? 'alert' : undefined}>{children}</div>;
}

export function ReloadButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button type="button" className="aios-btn" onClick={onClick} disabled={loading} aria-label="Neu laden">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      <span className="hidden sm:inline">Neu laden</span>
    </button>
  );
}

export function ErrorNote({ result }: { result: Extract<AiOsResult<unknown>, { ok: false }> }) {
  const hint = DENY_HINT[result.code];
  return (
    <Note tone="fail">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold">Fehler{result.status ? ` (HTTP ${result.status})` : ''}: <span className="aios-mono">{result.code}</span></div>
          <div>{hint ?? result.message}</div>
        </div>
      </div>
    </Note>
  );
}

/** Ergebnis einer Operation, die GitHub braucht und `configured:false` liefern kann. */
export interface MaybeConfigured { configured?: boolean; message?: string }

export function NotConfigured({ message }: { message?: string }) {
  return (
    <Note tone="warn">
      <strong>Nicht verbunden.</strong>{' '}
      {message ?? 'Die Datenquelle ist noch nicht eingerichtet.'}{' '}
      Einrichtung: <span className="aios-mono">docs/ai-os/README.md</span> → „Zugangsdaten".
    </Note>
  );
}

/** Standard-Rahmen für eine lesende Ressource: lädt · Fehler · nicht verbunden · Daten. */
export function ResourceView<T extends MaybeConfigured>({ resource, children }: {
  resource: Resource<T>;
  children: (data: T) => React.ReactNode;
}) {
  const { loading, result } = resource;
  if (loading && !result) {
    return (
      <div className="flex items-center gap-2 aios-muted text-sm" role="status">
        <Loader2 className="h-4 w-4 animate-spin" /> Lädt …
      </div>
    );
  }
  if (!result) return null;
  if (!result.ok) return <ErrorNote result={result} />;
  if (result.data.configured === false) return <NotConfigured message={result.data.message} />;
  return <>{children(result.data)}</>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm aios-muted">{children}</p>;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

/** Bestätigungsdialog für Schreibaktionen — die Bestätigung geht als `confirmed:true` an den Server. */
export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel, busy }: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="aios-dialog-backdrop">
      <div className="aios-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h3 id={titleId} className="font-semibold text-base">{title}</h3>
        <div className="text-sm aios-fg2">{body}</div>
        <div className="flex flex-wrap justify-end gap-2">
          <button ref={cancelRef} type="button" className="aios-btn" onClick={onCancel} disabled={busy}>Abbrechen</button>
          <button type="button" className="aios-btn" data-variant="primary" onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Zustand einer Schreibaktion inkl. Rückmeldung. */
export function useActionState() {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: Tone; text: string } | null>(null);
  return { busy, setBusy, feedback, setFeedback };
}
