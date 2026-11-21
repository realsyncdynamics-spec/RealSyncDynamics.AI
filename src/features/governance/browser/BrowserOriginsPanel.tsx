// Domain-Freigaben der Browser-Runtime je Mandant.
//
// Ohne Freigabe führt browser-execute nichts aus (PR B, Standard = verboten).
// Lesen per RLS (governance_policies), Schreiben nur über governance-resources
// (op: 'set_browser_origins', owner/admin serverseitig geprüft). Die Rollenprüfung
// hier blendet nur Bedienelemente aus; maßgeblich bleibt der Server.

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Ban, Globe2, Plus, X } from 'lucide-react';
import { fetchTenantPolicies } from '../governanceApi';
import { setBrowserOrigins } from '../resourcesApi';
import {
  normalizeOriginInput,
  originSaveErrorMessage,
  summarizeOriginPolicies,
  type OriginAllowlistView,
  type PolicyRowLike,
} from './originAllowlist';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; view: OriginAllowlistView };

type ListKind = 'allow' | 'block';

export function BrowserOriginsPanel({
  tenantId,
  canEdit,
  currentOrigin,
}: {
  tenantId: string | null;
  canEdit: boolean;
  /** Origin der zuletzt geöffneten Seite, für „Diese Seite freigeben“. */
  currentOrigin?: string | null;
}) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [allowInput, setAllowInput] = useState('');
  const [blockInput, setBlockInput] = useState('');

  const load = useCallback(async () => {
    if (!tenantId) return;
    setState({ status: 'loading' });
    try {
      const rows = await fetchTenantPolicies(tenantId);
      setState({ status: 'ready', view: summarizeOriginPolicies(rows as unknown as PolicyRowLike[]) });
    } catch {
      setState({ status: 'error' });
    }
  }, [tenantId]);

  useEffect(() => { void load(); }, [load]);

  async function save(list: ListKind, origins: string[], okText: string): Promise<boolean> {
    if (!tenantId || saving) return false;
    setSaving(true);
    setMessage(null);
    try {
      const res = await setBrowserOrigins(tenantId, list, origins);
      if (!res.ok) {
        setMessage({ tone: 'error', text: originSaveErrorMessage(res.error) });
        return false;
      }
      setMessage({ tone: 'ok', text: okText });
      await load();
      return true;
    } catch {
      setMessage({ tone: 'error', text: originSaveErrorMessage(undefined) });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function add(list: ListKind, raw: string) {
    if (state.status !== 'ready') return;
    const n = normalizeOriginInput(raw);
    if (!n.ok) {
      setMessage({ tone: 'error', text: `Ungültig: ${n.input || 'Eingabe'} (${n.reason}).` });
      return;
    }
    const current = list === 'allow' ? state.view.managedAllow : state.view.managedBlock;
    if (current.includes(n.origin)) {
      setMessage({ tone: 'ok', text: `${n.origin} ist bereits eingetragen.` });
      return;
    }
    const ok = await save(list, [...current, n.origin], list === 'allow' ? `${n.origin} freigegeben.` : `${n.origin} gesperrt.`);
    if (ok) (list === 'allow' ? setAllowInput : setBlockInput)('');
  }

  async function remove(list: ListKind, origin: string) {
    if (state.status !== 'ready') return;
    const current = list === 'allow' ? state.view.managedAllow : state.view.managedBlock;
    await save(list, current.filter((o) => o !== origin), list === 'allow' ? `Freigabe für ${origin} entfernt.` : `Sperre für ${origin} aufgehoben.`);
  }

  function onSubmit(list: ListKind) {
    return (e: FormEvent) => {
      e.preventDefault();
      void add(list, list === 'allow' ? allowInput : blockInput);
    };
  }

  if (!tenantId) return null;

  const view = state.status === 'ready' ? state.view : null;
  const suggest = view && currentOrigin && currentOrigin.startsWith('https://') && !view.effective.includes(currentOrigin) && !view.managedBlock.includes(currentOrigin)
    ? currentOrigin
    : null;

  return (
    <div className="border-t border-titanium-800 px-5 py-5" data-testid="browser-origins-panel" aria-labelledby="browser-origins-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h3 id="browser-origins-heading" className="flex items-center gap-2 text-sm font-semibold text-titanium-50">
            <Globe2 className="h-4 w-4 text-[var(--brand-champ)]" aria-hidden="true" />
            Domain-Freigaben
          </h3>
          <p className="mt-1 text-xs leading-5 text-titanium-400">
            Der Agent öffnet und bedient nur Seiten, deren Domain hier freigegeben ist. Ohne Freigabe ist alles gesperrt.
            Sperren gehen Freigaben vor. Gilt für die Produktion dieses Mandanten.
          </p>
        </div>
        {view && (
          <span
            data-testid="browser-origins-status"
            className={view.effective.length
              ? 'border border-emerald-900 bg-emerald-950/30 px-2.5 py-1 font-mono text-[11px] text-emerald-300'
              : 'border border-amber-900 bg-amber-950/30 px-2.5 py-1 font-mono text-[11px] text-amber-300'}
          >
            {view.effective.length ? `${view.effective.length} FREIGEGEBEN` : 'KEINE FREIGABE – RUNTIME GESPERRT'}
          </span>
        )}
      </div>

      {state.status === 'loading' && <p className="mt-4 text-xs text-titanium-500" role="status">Freigaben werden geladen …</p>}
      {state.status === 'error' && (
        <p className="mt-4 text-xs text-amber-300" role="alert">
          Freigaben konnten nicht geladen werden. Die Runtime bleibt in diesem Fall serverseitig gesperrt.
        </p>
      )}

      {view && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <OriginList
            kind="allow"
            title="Freigegeben"
            origins={view.managedAllow}
            readonly={view.otherAllow}
            blocked={new Set([...view.managedBlock, ...view.otherBlock])}
            canEdit={canEdit}
            saving={saving}
            input={allowInput}
            onInput={setAllowInput}
            onSubmit={onSubmit('allow')}
            onRemove={(o) => void remove('allow', o)}
          >
            {canEdit && suggest && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void add('allow', suggest)}
                className="mt-2 inline-flex items-center gap-1.5 border border-titanium-700 px-2.5 py-1.5 text-[11px] text-titanium-200 hover:border-[var(--brand-line-dark-strong)] disabled:opacity-50"
                data-testid="browser-origins-suggest"
              >
                <Plus className="h-3 w-3" aria-hidden="true" /> Aktuelle Seite freigeben: <span className="font-mono">{suggest}</span>
              </button>
            )}
          </OriginList>
          <OriginList
            kind="block"
            title="Gesperrt"
            origins={view.managedBlock}
            readonly={view.otherBlock}
            canEdit={canEdit}
            saving={saving}
            input={blockInput}
            onInput={setBlockInput}
            onSubmit={onSubmit('block')}
            onRemove={(o) => void remove('block', o)}
          />
        </div>
      )}

      {!canEdit && view && (
        <p className="mt-3 text-[11px] text-titanium-500">Nur Owner oder Admin können Freigaben ändern.</p>
      )}
      {message && (
        <p
          className={`mt-3 text-xs ${message.tone === 'ok' ? 'text-emerald-300' : 'text-amber-300'}`}
          role={message.tone === 'ok' ? 'status' : 'alert'}
          data-testid="browser-origins-message"
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

function OriginList({
  kind, title, origins, readonly, blocked, canEdit, saving, input, onInput, onSubmit, onRemove, children,
}: {
  kind: ListKind;
  title: string;
  origins: string[];
  readonly: string[];
  blocked?: Set<string>;
  canEdit: boolean;
  saving: boolean;
  input: string;
  onInput: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  onRemove: (origin: string) => void;
  children?: ReactNode;
}) {
  const inputId = `browser-origins-input-${kind}`;
  const empty = origins.length === 0 && readonly.length === 0;
  return (
    <section className="border border-titanium-800 bg-obsidian-900 px-3 py-3" data-testid={`browser-origins-${kind}`}>
      <h4 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-400">
        {kind === 'block' && <Ban className="h-3 w-3" aria-hidden="true" />}
        {title}
      </h4>
      {empty && <p className="mt-2 text-xs text-titanium-500">Keine Einträge.</p>}
      <ul className="mt-2 space-y-1.5">
        {origins.map((o) => (
          <li key={o} className="flex items-center justify-between gap-2 border border-titanium-800 px-2.5 py-1.5">
            <span className="truncate font-mono text-xs text-titanium-200" title={o}>
              {o}
              {blocked?.has(o) && <span className="ml-2 text-amber-300">(gesperrt)</span>}
            </span>
            {canEdit && (
              <button
                type="button"
                disabled={saving}
                onClick={() => onRemove(o)}
                className="shrink-0 p-1 text-titanium-500 hover:text-titanium-100 disabled:opacity-50"
                aria-label={kind === 'allow' ? `Freigabe für ${o} entfernen` : `Sperre für ${o} aufheben`}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
        {readonly.map((o) => (
          <li key={`ro-${o}`} className="flex items-center justify-between gap-2 border border-dashed border-titanium-800 px-2.5 py-1.5">
            <span className="truncate font-mono text-xs text-titanium-400" title={o}>
              {o}
              {blocked?.has(o) && <span className="ml-2 text-amber-300">(gesperrt)</span>}
            </span>
            <span className="shrink-0 text-[10px] text-titanium-500">aus Richtlinie</span>
          </li>
        ))}
      </ul>
      {canEdit && (
        <form onSubmit={onSubmit} className="mt-3 flex gap-2">
          <label htmlFor={inputId} className="sr-only">{kind === 'allow' ? 'Domain freigeben' : 'Domain sperren'}</label>
          <input
            id={inputId}
            value={input}
            onChange={(e) => onInput(e.target.value)}
            placeholder="z. B. beispiel.de"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 border border-titanium-700 bg-obsidian-950 px-2.5 py-2 font-mono text-xs text-titanium-100 placeholder:text-titanium-600 focus:border-[var(--brand-line-dark-strong)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving || !input.trim()}
            className="shrink-0 border border-titanium-700 px-3 py-2 text-xs font-medium text-titanium-100 hover:border-[var(--brand-line-dark-strong)] disabled:opacity-50"
          >
            {kind === 'allow' ? 'Freigeben' : 'Sperren'}
          </button>
        </form>
      )}
      {children}
    </section>
  );
}
