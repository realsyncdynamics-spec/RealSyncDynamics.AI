import { useEffect, useMemo, useState } from 'react';
import { Megaphone, Filter, Trash2, AlertTriangle } from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { getAdminSocialStore, CHANNEL_LABEL } from './api';
import type {
  QueueEntry,
  SocialChannel,
  RuntimeEvent,
  OrchestrationResult,
} from './api';
import { RuntimeEventForm } from './RuntimeEventForm';
import { SocialPostCard } from './SocialPostCard';
import { BlockedBadge, StatusBadge } from './StatusBadge';

type Filter = 'all' | QueueEntry['status'];

const FILTERS: Filter[] = ['all', 'pending', 'auto', 'approved', 'rejected', 'published', 'failed'];

export function AdminSocialPreviewPage() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { activeTenantId } = useTenant();
  const store = getAdminSocialStore();
  const [entries, setEntries]   = useState<QueueEntry[]>([]);
  const [filter, setFilter]     = useState<Filter>('all');
  const [chanFilter, setChan]   = useState<SocialChannel | 'all'>('all');
  const [busy, setBusy]         = useState(false);
  const [lastResult, setLastResult] = useState<OrchestrationResult | null>(null);

  // Hydrate from the store on mount.
  useEffect(() => {
    setEntries(store.getSnapshot());
  }, [store]);

  const refresh = () => setEntries(store.getSnapshot());

  const onSubmit = async (event: RuntimeEvent) => {
    setBusy(true);
    try {
      const result = await store.submitEvent(event);
      setLastResult(result);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const onApprove = async (id: string) => {
    store.approve(id, activeTenantId ? `tenant:${activeTenantId.slice(0, 8)}` : 'reviewer:admin');
    refresh();
  };
  const onReject = async (id: string) => {
    store.reject(id, activeTenantId ? `tenant:${activeTenantId.slice(0, 8)}` : 'reviewer:admin');
    refresh();
  };
  const onPublish = async (id: string) => {
    await store.publish(id);
    refresh();
  };
  const onClearAll = () => {
    if (!window.confirm('Alle gespeicherten Queue-Einträge löschen?')) return;
    store.clearAll();
    setLastResult(null);
    refresh();
  };

  const filtered = useMemo(() => {
    return entries
      .filter(e => filter === 'all' ? true : e.status === filter)
      .filter(e => chanFilter === 'all' ? true : e.post.channel === chanFilter)
      .slice()
      .reverse(); // newest first
  }, [entries, filter, chanFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: entries.length };
    for (const e of entries) c[e.status] = (c[e.status] ?? 0) + 1;
    return c;
  }, [entries]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-6 flex items-center gap-3">
          <div className="border border-titanium-800 bg-obsidian-950 p-2">
            <Megaphone className="h-5 w-5 text-security-400" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-titanium-50">
              Social Posts · Admin-Preview
            </h1>
            <p className="text-sm text-titanium-400">
              Generierte Posts pro Runtime-Event · Status AUTO / REVIEW / BLOCKED ·
              Persistiert lokal pro Tab
            </p>
          </div>
        </header>

        {/* Hinweis-Banner */}
        <div className="mb-6 flex items-start gap-3 border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-100">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p className="font-semibold text-amber-50">Vorschau-Modus</p>
            <p className="mt-1 text-amber-200/90">
              Diese Ansicht verbindet sich noch nicht zu echten Social-APIs.
              Posten erzeugt einen Mock-Eintrag. Persistenz liegt in
              <code className="mx-1 rounded bg-obsidian-900 px-1 py-0.5">localStorage</code>
              und ist tab-lokal. DB-Persistenz + echte Publisher folgen.
            </p>
          </div>
        </div>

        {/* Form: simuliere Event */}
        <div className="mb-6">
          <RuntimeEventForm onSubmit={onSubmit} busy={busy} />
        </div>

        {/* Letztes Result — SocialEvent + ggf. BLOCKED-Hinweis */}
        {lastResult ? (
          <div className="mb-6 border border-titanium-800 bg-obsidian-950 p-4">
            <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-titanium-300">
              Letzter Lauf
            </h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-titanium-300 sm:grid-cols-4">
              <div>
                <dt className="text-titanium-500 uppercase tracking-wider">Typ</dt>
                <dd className="font-mono text-titanium-100">{lastResult.socialEvent.type}</dd>
              </div>
              <div>
                <dt className="text-titanium-500 uppercase tracking-wider">Severity</dt>
                <dd className="font-mono text-titanium-100">{lastResult.socialEvent.severity}</dd>
              </div>
              <div>
                <dt className="text-titanium-500 uppercase tracking-wider">publicSafe</dt>
                <dd className="font-mono text-titanium-100">{String(lastResult.socialEvent.publicSafe)}</dd>
              </div>
              <div>
                <dt className="text-titanium-500 uppercase tracking-wider">Status</dt>
                <dd>
                  {lastResult.socialEvent.approvalStatus === 'BLOCKED'
                    ? <BlockedBadge />
                    : <span className="font-mono text-titanium-100">{lastResult.socialEvent.approvalStatus}</span>}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-sm text-titanium-200">{lastResult.socialEvent.anonymizedSummary}</p>
            {lastResult.socialEvent.approvalStatus === 'BLOCKED' ? (
              <p className="mt-3 text-xs text-rose-300">
                Diese Event-Klasse wurde blockiert. Es wurden keine Queue-Einträge erzeugt.
                Die Vorschau-Karten unten zeigen, was <em>gepostet worden wäre</em>.
              </p>
            ) : (
              <p className="mt-3 text-xs text-titanium-400">
                {lastResult.queueEntries.length} Queue-Einträge erzeugt
                ({lastResult.posts.length} Posts insgesamt über alle Kanäle).
              </p>
            )}

            {/* Show generated posts of the last run as cards (read-only
                preview, no actions — actions are on the queue list below). */}
            {lastResult.posts.length > 0 ? (
              <div className="mt-4 space-y-3">
                {lastResult.posts.map((p) => {
                  const fakeEntry: QueueEntry = {
                    id: `preview_${p.id}`,
                    post: p,
                    status: p.approvalStatus === 'BLOCKED' ? 'rejected'
                          : p.approvalStatus === 'AUTO'    ? 'auto'
                          : 'pending',
                    enqueuedAt: p.generatedAt,
                  };
                  return (
                    <SocialPostCard
                      key={p.id}
                      entry={fakeEntry}
                    />
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Filters + clear */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-titanium-500" />
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider ${
                  filter === f
                    ? 'border-security-500/60 bg-security-500/20 text-security-100'
                    : 'border-titanium-800 bg-obsidian-950 text-titanium-300 hover:border-titanium-700'
                }`}
              >
                {f} <span className="ml-1 text-titanium-500">{counts[f] ?? 0}</span>
              </button>
            ))}
            <select
              value={chanFilter}
              onChange={(e) => setChan(e.target.value as SocialChannel | 'all')}
              className="ml-2 border border-titanium-800 bg-obsidian-950 px-2 py-1 text-[11px] text-titanium-200"
            >
              <option value="all">Alle Kanäle</option>
              {(Object.keys(CHANNEL_LABEL) as SocialChannel[]).map(c => (
                <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <button
            onClick={onClearAll}
            className="inline-flex items-center gap-1.5 border border-rose-500/40 bg-rose-500/5 px-2.5 py-1 text-xs text-rose-200 hover:bg-rose-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Queue leeren
          </button>
        </div>

        {/* Queue list */}
        {filtered.length === 0 ? (
          <div className="border border-titanium-800 bg-obsidian-950 px-6 py-12 text-center">
            <p className="text-sm text-titanium-300">
              {entries.length === 0
                ? 'Noch keine Posts in der Queue. Simuliere oben ein Runtime-Event.'
                : 'Keine Einträge passen zum aktuellen Filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(e => (
              <SocialPostCard
                key={e.id}
                entry={e}
                onApprove={onApprove}
                onReject={onReject}
                onPublish={onPublish}
              />
            ))}
          </div>
        )}

        <footer className="mt-8 text-center text-[11px] text-titanium-500">
          <StatusBadge status="pending" /> = Review erforderlich · <StatusBadge status="auto" /> = direkt postable ·
          {' '}<StatusBadge status="published" /> = bereits gepostet (mock)
        </footer>
      </div>
    </div>
  );
}
