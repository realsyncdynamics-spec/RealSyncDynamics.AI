import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarClock, AlertTriangle, Play, Pause, Trash2, RefreshCw } from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { Button } from '../../enterprise-os/components/Button';
import { Card, CardHeader, CardBody } from '../../enterprise-os/components/Card';
import { parseDomainList } from '../../lib/bulk/domains';
import { computeNextRun, describeSchedule, validateSchedule, type Frequency } from '../../lib/scheduler/nextRun';
import {
  createSchedule, pauseSchedule, deleteSchedule, listSchedules,
  type ScanSchedule, type SchedulerError,
} from './schedulerApi';

/**
 * /app/scheduler — Enterprise Scheduler: benutzerdefinierte wiederkehrende
 * Scans (täglich/wöchentlich/monatlich). Ab Agency (scheduler.enabled).
 * Ausführung via scheduler-dispatch (pg_cron) → Bulk-Scan-Batch.
 */
export function SchedulerView() {
  return <AuthGate>{() => <SchedulerInner />}</AuthGate>;
}

function errorMessage(e: SchedulerError): string {
  switch (e.kind) {
    case 'forbidden': return 'Kein Zugriff auf diesen Mandanten.';
    case 'payment_required': return 'Der Scheduler ist erst ab Agency verfügbar.';
    default: return e.message;
  }
}

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function SchedulerInner() {
  const { activeTenantId, hasFeature } = useTenant();
  const enabled = hasFeature('scheduler.enabled');

  const [label, setLabel] = useState('');
  const [domainsInput, setDomainsInput] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [hour, setHour] = useState(3);
  const [minute, setMinute] = useState(0);
  const [weekday, setWeekday] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<ScanSchedule[]>([]);

  const preview = useMemo(() => parseDomainList(domainsInput), [domainsInput]);

  const spec = useMemo(() => ({
    frequency, hour, minute,
    weekday: frequency === 'weekly' ? weekday : undefined,
    dayOfMonth: frequency === 'monthly' ? dayOfMonth : undefined,
  }), [frequency, hour, minute, weekday, dayOfMonth]);

  const nextRunPreview = useMemo(() => {
    if (!validateSchedule(spec).ok) return null;
    try { return computeNextRun(spec, Date.now()); } catch { return null; }
  }, [spec]);

  const reload = useCallback(async () => {
    if (!activeTenantId) { setSchedules([]); return; }
    try { setSchedules(await listSchedules(activeTenantId)); }
    catch (e) { setError((e as Error).message); }
  }, [activeTenantId]);

  useEffect(() => { reload(); }, [reload]);

  async function onCreate() {
    if (!activeTenantId || preview.valid.length === 0) return;
    setBusy(true); setError(null); setNotice(null);
    const r = await createSchedule({
      tenant_id: activeTenantId, label: label.trim() || undefined, domains: preview.valid,
      frequency, hour, minute,
      weekday: frequency === 'weekly' ? weekday : undefined,
      day_of_month: frequency === 'monthly' ? dayOfMonth : undefined,
    });
    if (r.kind === 'ok') {
      setNotice(`Zeitplan angelegt — nächster Lauf: ${new Date(r.data.next_run_at).toLocaleString('de-DE')}.`);
      setLabel(''); setDomainsInput('');
      reload();
    } else {
      setError(errorMessage(r));
    }
    setBusy(false);
  }

  async function onPause(s: ScanSchedule) { if (activeTenantId) { await pauseSchedule(activeTenantId, s.id, !s.paused); reload(); } }
  async function onDelete(s: ScanSchedule) { if (activeTenantId) { await deleteSchedule(activeTenantId, s.id); reload(); } }

  const inputCls = 'w-full border border-titanium-700 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100 placeholder:text-titanium-600 focus:border-security-500 focus:outline-none';
  const labelCls = 'mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500';

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="flex h-14 items-center justify-between border-b border-titanium-900 bg-obsidian-900 px-4">
        <div className="flex items-center gap-3">
          <Link to="/app" className="p-1.5 text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-sky-500 to-blue-700">
              <CalendarClock className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-display text-sm font-semibold tracking-tight text-titanium-50">Scheduler</h1>
              <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                Geplante Scans · täglich / wöchentlich / monatlich
              </p>
            </div>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={reload}><RefreshCw className="h-3.5 w-3.5" /> Aktualisieren</Button>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6 sm:px-6">
        {!enabled && (
          <div className="flex items-start gap-3 border border-amber-500/40 bg-amber-500/5 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="text-xs text-titanium-300">
              <p className="font-semibold text-amber-300">Der Scheduler ist in deinem Plan nicht freigeschaltet.</p>
              <p className="mt-1">Verfügbar ab <strong>Agency</strong>. Zeitpläne kannst du anlegen, ausgeführt werden sie erst nach Upgrade.</p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader title="Neuer Zeitplan" eyebrow="Geplanter Scan" subtitle="Domains werden lokal geprüft; die Ausführung läuft als Bulk-Scan zum geplanten Zeitpunkt (UTC)." />
          <CardBody>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Bezeichnung (optional)</label>
                  <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z.B. Wöchentlicher Portfolio-Scan" />
                </div>
                <div>
                  <label className={labelCls}>Frequenz</label>
                  <select className={inputCls} value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
                    <option value="daily">Täglich</option>
                    <option value="weekly">Wöchentlich</option>
                    <option value="monthly">Monatlich</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <label className={labelCls}>Stunde (UTC)</label>
                  <input type="number" min={0} max={23} className={inputCls} value={hour} onChange={(e) => setHour(Number(e.target.value))} />
                </div>
                <div>
                  <label className={labelCls}>Minute</label>
                  <input type="number" min={0} max={59} className={inputCls} value={minute} onChange={(e) => setMinute(Number(e.target.value))} />
                </div>
                {frequency === 'weekly' && (
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Wochentag</label>
                    <select className={inputCls} value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                      {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                    </select>
                  </div>
                )}
                {frequency === 'monthly' && (
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Tag im Monat (1–28)</label>
                    <input type="number" min={1} max={28} className={inputCls} value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} />
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Domains / CSV</label>
                <textarea
                  value={domainsInput}
                  onChange={(e) => setDomainsInput(e.target.value)}
                  rows={5}
                  placeholder={'example.com\nkunde-a.de'}
                  className={`${inputCls} resize-y font-mono text-xs`}
                />
                {domainsInput.trim() && (
                  <div className="mt-2 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-wider">
                    <span className="border border-emerald-500/40 bg-emerald-500/5 px-2 py-1 text-emerald-300">{preview.valid.length} gültig</span>
                    {preview.rejected.length > 0 && <span className="border border-risk-critical/40 bg-risk-critical/5 px-2 py-1 text-risk-critical">{preview.rejected.length} ungültig</span>}
                  </div>
                )}
              </div>

              <div className="border border-titanium-800 bg-obsidian-900 px-3 py-2 font-mono text-[11px] text-titanium-400">
                {describeSchedule(spec)}
                {nextRunPreview && <> · nächster Lauf: <span className="text-security-400">{new Date(nextRunPreview).toLocaleString('de-DE')}</span></>}
              </div>

              <Button onClick={onCreate} disabled={busy || !enabled || !activeTenantId || preview.valid.length === 0}>
                <Play className="h-3.5 w-3.5" /> {busy ? 'Lege an…' : 'Zeitplan anlegen'}
              </Button>

              {notice && <div className="border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-300">{notice}</div>}
              {error && <div className="border border-risk-critical/40 bg-risk-critical/5 px-4 py-3 text-xs text-risk-critical">{error}</div>}
            </div>
          </CardBody>
        </Card>

        <div>
          <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">Zeitpläne</div>
          {schedules.length === 0 ? (
            <p className="font-mono text-xs text-titanium-500">Noch keine Zeitpläne angelegt.</p>
          ) : (
            <div className="space-y-2">
              {schedules.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 border border-titanium-800 bg-obsidian-900 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-titanium-100">
                      {s.label || `Zeitplan ${s.id.slice(0, 8)}`}
                      {s.paused && <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-amber-400">pausiert</span>}
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                      {describeSchedule({ frequency: s.frequency, hour: s.hour, minute: s.minute, weekday: s.weekday ?? undefined, dayOfMonth: s.day_of_month ?? undefined })}
                      {' · '}{s.domains.length} Domains{' · '}nächster Lauf {new Date(s.next_run_at).toLocaleString('de-DE')}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => onPause(s)}>
                      {s.paused ? <><Play className="h-3.5 w-3.5" /> Fortsetzen</> : <><Pause className="h-3.5 w-3.5" /> Pausieren</>}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => onDelete(s)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
