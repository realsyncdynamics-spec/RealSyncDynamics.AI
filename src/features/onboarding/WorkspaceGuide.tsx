import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, Circle, Compass, Loader2, ShieldCheck, Users } from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';
import {
  FOCUS_OPTIONS, workspaceGuideProgress, workspaceGuideSteps,
  type WorkspaceFocus, type WorkspaceStepId,
} from './workspaceGuideModel';

interface GuideState {
  focus: WorkspaceFocus;
  completed_steps: WorkspaceStepId[];
}

const EMPTY: GuideState = { focus: 'none', completed_steps: [] };
const PANEL = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const BUTTON = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500';

// Supabase liefert PostgrestError-Objekte, nicht zwingend Error-Instanzen.
function errorMessage(cause: unknown, fallback: string): string {
  if (cause && typeof cause === 'object' && 'message' in cause) {
    const message = (cause as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export function WorkspaceGuide() {
  const { activeTenantId, tenants, loading: tenantLoading } = useTenant();
  const tenant = tenants.find((item) => item.tenantId === activeTenantId);
  const canInvite = tenant?.role === 'owner' || tenant?.role === 'admin';
  const [record, setRecord] = useState<GuideState>(EMPTY);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadedTenant, setLoadedTenant] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeTenantRef = useRef(activeTenantId);
  activeTenantRef.current = activeTenantId;

  useEffect(() => {
    let cancelled = false;
    setRecord(EMPTY);
    setUserId(null);
    setLoadedTenant(null);
    setError(null);
    if (!activeTenantId) return;
    void (async () => {
      try {
        const sb = getSupabase();
        const { data: authData, error: authError } = await sb.auth.getUser();
        if (authError || !authData.user) throw new Error('Bitte zuerst anmelden.');
        const { data, error: loadError } = await sb
          .from('workspace_onboarding_state')
          .select('focus,completed_steps')
          .eq('tenant_id', activeTenantId)
          .eq('user_id', authData.user.id)
          .maybeSingle();
        if (loadError) throw loadError;
        if (cancelled) return;
        const allowed = new Set(FOCUS_OPTIONS.map((item) => item.id));
        const nextFocus: WorkspaceFocus =
          data?.focus && allowed.has(data.focus as Exclude<WorkspaceFocus, 'none'>)
            ? data.focus as WorkspaceFocus : 'none';
        const allowedSteps = new Set<WorkspaceStepId>(['profile', 'team', 'focus', 'first-result', 'review']);
        const completed = Array.isArray(data?.completed_steps)
          ? data.completed_steps.filter((id: string): id is WorkspaceStepId => allowedSteps.has(id as WorkspaceStepId))
          : [];
        setRecord({ focus: nextFocus, completed_steps: completed });
        setUserId(authData.user.id);
        setLoadedTenant(activeTenantId);
      } catch (cause) {
        if (!cancelled) setError(errorMessage(cause, 'Einrichtung konnte nicht geladen werden.'));
      }
    })();
    return () => { cancelled = true; };
  }, [activeTenantId]);

  const steps = useMemo(() => workspaceGuideSteps(record.focus, canInvite), [record.focus, canInvite]);
  const progress = useMemo(
    () => workspaceGuideProgress(steps, record.completed_steps),
    [steps, record.completed_steps],
  );
  const selected = FOCUS_OPTIONS.find((item) => item.id === record.focus);

  async function save(next: GuideState) {
    if (!activeTenantId || !userId || loadedTenant !== activeTenantId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const { error: saveError } = await getSupabase().from('workspace_onboarding_state').upsert({
        tenant_id: activeTenantId,
        user_id: userId,
        focus: next.focus,
        completed_steps: next.completed_steps,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,user_id' });
      if (saveError) throw saveError;
      if (activeTenantRef.current === activeTenantId) setRecord(next);
    } catch (cause) {
      if (activeTenantRef.current === activeTenantId) {
        setError(errorMessage(cause, 'Speichern fehlgeschlagen.'));
      }
    } finally {
      setSaving(false);
    }
  }

  function chooseFocus(focus: Exclude<WorkspaceFocus, 'none'>) {
    const changed = record.focus !== focus;
    const retained = record.completed_steps.filter((id) =>
      id !== 'focus' && (!changed || (id !== 'first-result' && id !== 'review')));
    void save({ focus, completed_steps: [...retained, 'focus'] });
  }

  function toggleStep(id: WorkspaceStepId) {
    if (id === 'focus' || (id === 'first-result' && record.focus === 'none')) return;
    const exists = record.completed_steps.includes(id);
    const completed = exists
      ? record.completed_steps.filter((step) => step !== id)
      : [...record.completed_steps, id];
    void save({ ...record, completed_steps: completed });
  }

  if (tenantLoading || (activeTenantId && loadedTenant !== activeTenantId && !error)) {
    return <div className="min-h-[50vh] flex items-center justify-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Einrichtung wird geladen…</div>;
  }
  if (!activeTenantId) {
    return <div className="p-8 text-slate-300">Melde dich an und wähle einen Workspace aus, um den Einrichtungs-Guide zu öffnen.</div>;
  }

  return (
    <main className="min-h-screen bg-[#f6f8fc] text-slate-900 px-4 py-8 md:px-8 md:py-12" data-testid="workspace-guide">
      <div className="max-w-6xl mx-auto space-y-7">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-indigo-600 mb-2"><Compass className="w-4 h-4" /> RealSync · Geführter Start</div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Dein Workspace. Dein Start.</h1>
            <p className="mt-2 text-slate-600 max-w-2xl">Richte <strong>{tenant?.name ?? 'deinen Arbeitsbereich'}</strong> Schritt für Schritt ein – passend zu deinem Team und deinem ersten KI-Produkt.</p>
          </div>
          <Link to="/app/dashboard" className={BUTTON + ' border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}>Zum Dashboard <ArrowRight className="w-4 h-4" /></Link>
        </header>

        {error && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <strong>Einrichtung nicht verfügbar:</strong> {error}
            <p className="mt-1">Bitte Anmeldung, Berechtigungen und Verbindung prüfen. Es wurde kein Fortschritt als gespeichert ausgegeben.</p>
          </div>
        )}
        {loadedTenant === activeTenantId && (
          <>
            <section className={PANEL + ' p-6 md:p-7'} aria-label="Dein Onboarding-Fortschritt">
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-indigo-600">Deine Einrichtung</p>
                  <h2 className="text-xl font-bold mt-1">{progress.done} von {progress.total} Schritten markiert</h2>
                  <p className="text-xs text-slate-500 mt-1">Persönlicher Fortschritt · kein automatischer technischer Funktionstest</p>
                </div>
                <span className="text-3xl font-bold tabular-nums text-slate-900">{progress.percent}%</span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full mt-5 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} aria-label="Einrichtungsfortschritt">
                <div className="h-full bg-indigo-600 rounded-full transition-all duration-300" style={{ width: String(progress.percent) + '%' }} />
              </div>
            </section>

            <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_330px] items-start">
              <section className={PANEL + ' p-5 md:p-7'} aria-labelledby="guide-steps">
                <div className="flex gap-3 items-center mb-7">
                  <div className="p-2 bg-indigo-50 rounded-xl"><CheckCircle2 className="text-indigo-600 w-5 h-5" /></div>
                  <div><h2 id="guide-steps" className="text-xl font-bold">Deine nächsten Schritte</h2><p className="text-sm text-slate-500">Auf deine Rolle zugeschnitten</p></div>
                </div>
                <div className="space-y-4">
                  {steps.map((step, i) => {
                    const done = record.completed_steps.includes(step.id);
                    return (
                      <article key={step.id} className="rounded-xl border border-slate-200 p-4 sm:p-5 flex items-start gap-4">
                        <span aria-hidden="true" className={'mt-0.5 w-9 h-9 shrink-0 rounded-full flex items-center justify-center font-bold text-sm ' + (done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                          {done ? <Check className="w-4 h-4" /> : i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{step.title}</h3>
                            {done && <span className="text-xs font-medium text-emerald-700">Von dir markiert</span>}
                          </div>
                          <p className="text-sm text-slate-600 mt-1">{step.detail}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-4">
                            {step.href && <Link to={step.href} className={BUTTON + ' bg-indigo-600 text-white hover:bg-indigo-700'}>{step.cta} <ArrowRight className="w-4 h-4" /></Link>}
                            {step.id === 'focus' ? (
                              <span className="text-xs text-slate-500">{selected ? 'Gewählt: ' + selected.title : 'Produkt unten auswählen'}</span>
                            ) : (
                              <button type="button" disabled={saving || (step.id === 'first-result' && !selected)}
                                onClick={() => toggleStep(step.id)}
                                className={BUTTON + ' border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40'}>
                                {done ? <><CheckCircle2 className="w-4 h-4" /> Markierung entfernen</> : <><Circle className="w-4 h-4" /> Als erledigt markieren</>}
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <aside className="space-y-5">
                <div className={PANEL + ' p-5'}>
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-3"><ShieldCheck className="w-5 h-5 text-indigo-600" /></div>
                  <h2 className="font-bold">Rollen & Sicherheit</h2>
                  <p className="text-sm text-slate-600 mt-2">Deine Rolle: <strong>{tenant?.role ?? 'unbekannt'}</strong>. Team-Einladungen stehen nur Administratoren und Eigentümern zur Verfügung.</p>
                  <Link className="inline-flex gap-1 items-center mt-3 text-sm font-semibold text-indigo-700 hover:underline" to="/app/team"><Users className="w-4 h-4" /> Rollenverwaltung <ArrowRight className="w-4 h-4" /></Link>
                </div>
                <div className={PANEL + ' p-5'}>
                  <h2 className="font-bold">Was passiert nach dem Start?</h2>
                  <p className="text-sm text-slate-600 mt-2">Nutze das bestehende RealSync-Dashboard. Nicht fertig getestete Module bleiben zur Prüfung gekennzeichnet. Hier werden keine Services automatisch freigeschaltet.</p>
                </div>
              </aside>
            </div>

            <section className={PANEL + ' p-5 md:p-7'} aria-labelledby="focus-heading">
              <div className="mb-5">
                <h2 id="focus-heading" className="text-xl font-bold">Womit möchtest du starten?</h2>
                <p className="mt-1 text-sm text-slate-500">Deine Auswahl steuert den nächsten Einrichtungsschritt, nicht die Produktfreischaltung.</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {FOCUS_OPTIONS.map((focus) => (
                  <button key={focus.id} type="button" disabled={saving}
                    onClick={() => chooseFocus(focus.id)}
                    aria-pressed={record.focus === focus.id}
                    className={'text-left p-4 rounded-xl border-2 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ' +
                      (record.focus === focus.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200')}>
                    <span className="flex justify-between gap-2 items-start">
                      <strong className="text-sm">{focus.title}</strong>
                      {record.focus === focus.id && <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-600" />}
                    </span>
                    <span className="block text-xs text-slate-600 mt-2">{focus.detail}</span>
                    <span className="block text-xs text-slate-500 mt-3">Status: {focus.status}</span>
                  </button>
                ))}
              </div>
              {saving && <p role="status" className="text-sm text-indigo-600 mt-4 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Speichere Änderung…</p>}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
