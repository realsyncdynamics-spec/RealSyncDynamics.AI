import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Loader2, UserRoundCheck } from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { fetchTenantIncidents, type DbIncident } from './incidentsApi';
import { fetchTenantDsrs, type DbDsrRequest } from './dsrApi';
import { listDpias, type DbDpia } from './dpiasApi';

type ActionKind = 'incident' | 'dsr' | 'dpia';
type ActionStatus = 'open' | 'done';
type FilterId = 'all' | 'overdue' | 'week' | 'unowned';

interface ActionItem {
  id: string;
  kind: ActionKind;
  title: string;
  href: string;
  status: ActionStatus;
  rawStatus: string;
  owner: string | null;
  deadline: string | null;
  completedAt: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface ActionCenterData {
  incidents: DbIncident[];
  dsrs: DbDsrRequest[];
  dpias: DbDpia[];
}

const DAY = 86_400_000;

function toActionItems(data: ActionCenterData): ActionItem[] {
  const incidents: ActionItem[] = data.incidents.map((row) => ({
    id: row.id,
    kind: 'incident',
    title: row.title,
    href: '/app/incidents',
    status: ['resolved', 'reported_to_authority'].includes(row.status) ? 'done' : 'open',
    rawStatus: row.status,
    owner: row.assigned_to,
    deadline: row.notification_deadline_at,
    completedAt: row.resolved_at ?? row.reported_to_authority_at,
    severity: row.severity,
  }));

  const dsrs: ActionItem[] = data.dsrs.map((row) => ({
    id: row.id,
    kind: 'dsr',
    title: `Betroffenenanfrage · ${row.request_type}`,
    href: '/app/dsr',
    status: ['completed', 'rejected'].includes(row.status) ? 'done' : 'open',
    rawStatus: row.status,
    owner: row.assigned_to,
    deadline: row.deadline_at,
    completedAt: row.completed_at,
    severity: 'medium',
  }));

  const dpias: ActionItem[] = data.dpias.map((row) => ({
    id: row.id,
    kind: 'dpia',
    title: row.title,
    href: '/app/dpia',
    status: ['approved', 'rejected'].includes(row.status) ? 'done' : 'open',
    rawStatus: row.status,
    owner: null,
    deadline: row.review_due_at,
    completedAt: row.approved_at,
    severity: 'medium',
  }));

  return [...incidents, ...dsrs, ...dpias];
}

function dueMs(item: ActionItem): number | null {
  if (!item.deadline) return null;
  const value = new Date(item.deadline).getTime();
  return Number.isNaN(value) ? null : value;
}

function isToday(iso: string | null, now = new Date()): boolean {
  if (!iso) return false;
  const value = new Date(iso);
  return value.getFullYear() === now.getFullYear()
    && value.getMonth() === now.getMonth()
    && value.getDate() === now.getDate();
}

function sortActions(items: ActionItem[], nowMs: number): ActionItem[] {
  return [...items].sort((a, b) => {
    const aDone = a.status === 'done' ? 1 : 0;
    const bDone = b.status === 'done' ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    const ad = dueMs(a) ?? Number.POSITIVE_INFINITY;
    const bd = dueMs(b) ?? Number.POSITIVE_INFINITY;
    const aOver = ad < nowMs ? 0 : 1;
    const bOver = bd < nowMs ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    return ad - bd;
  });
}

function deadlineLabel(item: ActionItem, nowMs: number): { text: string; tone: string } {
  const due = dueMs(item);
  if (item.status === 'done') return { text: 'Erledigt', tone: 'text-emerald-300' };
  if (due === null) return { text: 'Keine Frist', tone: 'text-titanium-500' };
  const diff = due - nowMs;
  if (diff < 0) return { text: `${Math.ceil(Math.abs(diff) / DAY)} Tg. überfällig`, tone: 'text-rose-300' };
  if (diff <= DAY) return { text: `${Math.max(0, Math.floor(diff / 3_600_000))} h`, tone: 'text-rose-300' };
  if (diff <= 7 * DAY) return { text: `${Math.ceil(diff / DAY)} Tg.`, tone: 'text-amber-300' };
  return { text: `${Math.ceil(diff / DAY)} Tg.`, tone: 'text-titanium-300' };
}

export function ActionCenterView() {
  const { activeTenantId, tenants } = useTenant();
  const tenantName = tenants.find((tenant) => tenant.tenantId === activeTenantId)?.name ?? null;
  const [data, setData] = useState<ActionCenterData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>('all');

  useEffect(() => {
    let cancelled = false;
    if (!activeTenantId) {
      setData(null);
      return;
    }

    setData(null);
    setError(null);

    void Promise.all([
      fetchTenantIncidents(activeTenantId),
      fetchTenantDsrs(activeTenantId),
      listDpias(activeTenantId),
    ]).then(([incidents, dsrs, dpiaResult]) => {
      if (cancelled) return;
      if (!dpiaResult.ok) throw new Error(dpiaResult.error?.message ?? 'DSFA-Daten nicht verfügbar');
      setData({ incidents, dsrs, dpias: dpiaResult.dpias ?? [] });
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
    });

    return () => { cancelled = true; };
  }, [activeTenantId]);

  const nowMs = Date.now();
  const allItems = useMemo(() => data ? sortActions(toActionItems(data), nowMs) : [], [data, nowMs]);
  const open = allItems.filter((item) => item.status === 'open');
  const overdue = open.filter((item) => {
    const due = dueMs(item);
    return due !== null && due < nowMs;
  });
  const dueThisWeek = open.filter((item) => {
    const due = dueMs(item);
    return due !== null && due >= nowMs && due <= nowMs + 7 * DAY;
  });
  const unowned = open.filter((item) => !item.owner);
  const doneToday = allItems.filter((item) => item.status === 'done' && isToday(item.completedAt));

  const visible = allItems.filter((item) => {
    if (filter === 'overdue') return overdue.some((row) => row.kind === item.kind && row.id === item.id);
    if (filter === 'week') return dueThisWeek.some((row) => row.kind === item.kind && row.id === item.id);
    if (filter === 'unowned') return unowned.some((row) => row.kind === item.kind && row.id === item.id);
    return true;
  });

  return (
    <div className="rs-apppage rs-ui" data-testid="action-center">
      <header className="mb-5">
        <span className="rs-overline">P2.1 · Operative Governance</span>
        <h1 className="rs-h2 mt-1">Action Center{tenantName ? ` · ${tenantName}` : ''}</h1>
        <p className="rs-note mt-1">
          Offene Maßnahmen aus Incidents, Betroffenenanfragen und DSFA-Reviews — ohne separate Schatten-Tabelle.
        </p>
      </header>

      {!activeTenantId && (
        <div className="rs-panel rs-panel--pad20">
          <p className="rs-note">Kein aktiver Mandant. Ohne Tenant werden keine Maßnahmen geladen.</p>
        </div>
      )}

      {error && (
        <div className="border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-300 flex gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {activeTenantId && !data && !error && (
        <div className="flex items-center justify-center gap-2 py-12 rs-note">
          <Loader2 className="h-4 w-4 animate-spin" /> Maßnahmen werden geladen …
        </div>
      )}

      {data && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5" aria-label="Action Center Kennzahlen">
            <Metric label="Offen" value={open.length} />
            <Metric label="Überfällig" value={overdue.length} tone={overdue.length ? 'danger' : undefined} />
            <Metric label="Diese Woche" value={dueThisWeek.length} tone={dueThisWeek.length ? 'warn' : undefined} />
            <Metric label="Ohne Owner" value={unowned.length} tone={unowned.length ? 'warn' : undefined} />
            <Metric label="Heute erledigt" value={doneToday.length} tone="good" />
          </section>

          <section className="rs-panel">
            <div className="rs-panel__head px-4 pt-4">
              <span className="rs-overline">Maßnahmen</span>
              <span className="rs-note rs-mono">{visible.length}</span>
            </div>

            <div className="flex flex-wrap gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--color-rs-line)' }}>
              {([
                ['all', 'Alle', allItems.length],
                ['overdue', 'Überfällig', overdue.length],
                ['week', 'Diese Woche', dueThisWeek.length],
                ['unowned', 'Ohne Owner', unowned.length],
              ] as const).map(([id, label, count]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`rs-btn ${filter === id ? 'rs-btn--primary' : 'rs-btn--secondary'}`}
                >
                  {label} · {count}
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-300" />
                <p className="rs-note">Keine Maßnahmen in diesem Filter.</p>
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--color-rs-line)' }}>
                {visible.map((item) => {
                  const deadline = deadlineLabel(item, nowMs);
                  return (
                    <li key={`${item.kind}-${item.id}`} className="px-4 py-4">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rs-cell-main">{item.title}</span>
                            <span className="rs-note rs-mono uppercase">{item.kind}</span>
                            <span className="rs-note rs-mono">{item.rawStatus}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 rs-note">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock3 className="h-3.5 w-3.5" />
                              <span className={deadline.tone}>{deadline.text}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <UserRoundCheck className="h-3.5 w-3.5" />
                              {item.owner ?? 'Owner nicht hinterlegt'}
                            </span>
                          </div>
                        </div>
                        <Link to={item.href} className="rs-btn rs-btn--secondary shrink-0">
                          Quelle öffnen <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <p className="rs-note mt-4">
            DSFA-Owner werden derzeit nicht persistiert; diese Maßnahmen erscheinen deshalb ehrlich als „Owner nicht hinterlegt“.
          </p>
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'danger' | 'warn' | 'good';
}) {
  const color = tone === 'danger'
    ? 'var(--color-rs-danger)'
    : tone === 'warn'
      ? 'var(--color-rs-warning)'
      : tone === 'good'
        ? 'var(--color-rs-success)'
        : 'var(--color-rs-fg)';

  return (
    <div className="rs-panel rs-panel--pad20">
      <div className="rs-mono text-3xl font-semibold" style={{ color }}>{value}</div>
      <div className="rs-note mt-1">{label}</div>
    </div>
  );
}
