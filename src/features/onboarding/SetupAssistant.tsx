import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/useAuth';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';
import { Building2, ArrowRight, ArrowLeft, CheckCircle2, Phone, ShieldCheck, CalendarDays, Headphones, Sparkles } from 'lucide-react';

type OrgType = 'freelancer' | 'sme' | 'agency' | 'enterprise';
type Goal = 'phone' | 'support' | 'sales' | 'appointments';
type Step = 'company' | 'goal' | 'ready';

interface SetupState {
  tenant_type: OrgType;
  org_name: string;
  org_size_employees?: number;
  website: string;
  goal: Goal | null;
}

const ORG_TYPES: Array<{ id: OrgType; label: string; description: string }> = [
  { id: 'freelancer', label: 'Einzelner / Freelancer', description: 'Ich arbeite allein oder mit wenigen Verträgen.' },
  { id: 'sme', label: 'KMU / Handwerk', description: 'Kleineres Unternehmen oder lokales Geschäft.' },
  { id: 'agency', label: 'Agentur / Kanzlei', description: 'Wir betreuen Kunden und mehrere Prozesse.' },
  { id: 'enterprise', label: 'Großunternehmen', description: 'Größere Organisation oder mehrere Teams.' },
];

const GOALS: Array<{ id: Goal; label: string; description: string; icon: React.ReactNode }> = [
  { id: 'phone', label: 'Telefonzentrale automatisieren', description: 'Anrufe annehmen, Fragen beantworten und weiterleiten.', icon: <Phone className="w-5 h-5" /> },
  { id: 'support', label: 'Kundenservice automatisieren', description: 'Support-Anfragen schneller beantworten und eskalieren.', icon: <Headphones className="w-5 h-5" /> },
  { id: 'sales', label: 'Leads qualifizieren', description: 'Interessenten erfassen, qualifizieren und an Menschen übergeben.', icon: <Sparkles className="w-5 h-5" /> },
  { id: 'appointments', label: 'Termine automatisieren', description: 'Termine vereinbaren und Kalenderprozesse ausführen.', icon: <CalendarDays className="w-5 h-5" /> },
];

const STORAGE_PREFIX = 'realsync_self_service_onboarding:';

export function SetupAssistant() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeTenantId, refresh } = useTenant();
  const [step, setStep] = useState<Step>('company');
  const [state, setState] = useState<SetupState>({ tenant_type: 'sme', org_name: '', website: '', goal: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  if (!user || !activeTenantId) return <div className="text-center py-12">Loading...</div>;

  const saveLocalSetup = () => {
    localStorage.setItem(`${STORAGE_PREFIX}${activeTenantId}`, JSON.stringify({ ...state, completedAt: new Date().toISOString() }));
  };

  const handleCompanyContinue = () => {
    setError(undefined);
    if (!state.org_name.trim()) { setError('Bitte gib den Namen deiner Organisation ein.'); return; }
    setStep('goal');
  };

  const handleFinish = async () => {
    setError(undefined);
    if (!state.goal) { setError('Bitte wähle ein Ziel aus.'); return; }
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { error: updateError } = await supabase
        .from('tenants')
        .update({
          tenant_type: state.tenant_type,
          org_name: state.org_name.trim(),
          org_size_employees: state.org_size_employees || null,
          onboarded_at: new Date().toISOString(),
        })
        .eq('id', activeTenantId);

      if (updateError) throw updateError;
      saveLocalSetup();
      await refresh();
      setStep('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Die Einrichtung konnte nicht gespeichert werden.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900 px-4 py-10" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-cyan-400 font-semibold">RealSyncDynamics.AI</div>
            <div className="text-sm text-slate-400 mt-1">Self-Service Setup</div>
          </div>
          <div className="text-xs text-slate-500">{step === 'company' ? '1 / 3' : step === 'goal' ? '2 / 3' : '3 / 3'}</div>
        </div>

        <div className="h-1 bg-slate-800 mb-10 overflow-hidden rounded-full">
          <div className="h-full bg-cyan-400 transition-all duration-300" style={{ width: step === 'company' ? '33%' : step === 'goal' ? '66%' : '100%' }} />
        </div>

        {step === 'company' && (
          <div className="space-y-7">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Erzähl uns kurz von deinem Unternehmen.</h1>
              <p className="text-slate-400 text-lg">Wir verwenden diese Angaben, um dein Setup automatisch vorzubereiten.</p>
            </div>

            <div className="space-y-5 bg-slate-900/70 p-6 rounded-2xl border border-slate-700">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Unternehmensname</label>
                <input autoFocus type="text" value={state.org_name} onChange={(e) => setState((p) => ({ ...p, org_name: e.target.value }))} placeholder="z. B. Muster GmbH" className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-800 text-white placeholder-slate-500 focus:border-cyan-400 outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Website <span className="text-slate-500">(optional)</span></label>
                <input type="url" value={state.website} onChange={(e) => setState((p) => ({ ...p, website: e.target.value }))} placeholder="https://deine-firma.de" className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-800 text-white placeholder-slate-500 focus:border-cyan-400 outline-none" />
                <p className="text-xs text-slate-500 mt-2">Als nächster Automatisierungsschritt kann daraus deine Knowledge Base erzeugt werden.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-3">Welche Beschreibung passt am besten?</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ORG_TYPES.map((item) => (
                    <button key={item.id} type="button" onClick={() => setState((p) => ({ ...p, tenant_type: item.id }))} className={`p-3 text-left rounded-xl border transition-colors ${state.tenant_type === item.id ? 'border-cyan-400 bg-cyan-950/30' : 'border-slate-700 bg-slate-800 hover:border-slate-500'}`}>
                      <div className="font-medium text-white text-sm">{item.label}</div>
                      <div className="text-xs text-slate-400 mt-1">{item.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Mitarbeiter</label>
                <select value={state.org_size_employees || ''} onChange={(e) => setState((p) => ({ ...p, org_size_employees: e.target.value ? Number(e.target.value) : undefined }))} className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-800 text-white focus:border-cyan-400 outline-none">
                  <option value="">Bitte wählen...</option><option value="1">1–5</option><option value="10">6–25</option><option value="50">26–100</option><option value="250">101–500</option><option value="1000">500+</option>
                </select>
              </div>
              {error && <p className="text-sm text-red-300">{error}</p>}
            </div>

            <div className="flex justify-end"><button onClick={handleCompanyContinue} className="px-6 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold flex items-center gap-2">Weiter <ArrowRight className="w-4 h-4" /></button></div>
          </div>
        )}

        {step === 'goal' && (
          <div className="space-y-7">
            <div>
              <button onClick={() => setStep('company')} className="text-slate-500 hover:text-white text-sm flex items-center gap-1 mb-5"><ArrowLeft className="w-4 h-4" /> Zurück</button>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Was soll RealSync für dich erledigen?</h1>
              <p className="text-slate-400 text-lg">Wähle einen Startpunkt. Weitere Prozesse kannst du später hinzufügen.</p>
            </div>

            <div className="grid gap-3">
              {GOALS.map((goal) => (
                <button key={goal.id} onClick={() => setState((p) => ({ ...p, goal: goal.id }))} className={`p-5 text-left rounded-2xl border transition-all flex items-center gap-4 ${state.goal === goal.id ? 'border-cyan-400 bg-cyan-950/30' : 'border-slate-700 bg-slate-900/70 hover:border-slate-500'}`}>
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-cyan-400">{goal.icon}</div>
                  <div className="flex-1"><div className="font-semibold text-white">{goal.label}</div><div className="text-sm text-slate-400 mt-1">{goal.description}</div></div>
                  {state.goal === goal.id && <CheckCircle2 className="w-5 h-5 text-cyan-400" />}
                </button>
              ))}
            </div>
            {error && <p className="text-sm text-red-300">{error}</p>}
            <div className="flex justify-end"><button onClick={handleFinish} disabled={loading} className="px-6 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-semibold flex items-center gap-2">{loading ? 'Wird eingerichtet…' : 'Setup erstellen'} <ArrowRight className="w-4 h-4" /></button></div>
          </div>
        )}

        {step === 'ready' && (
          <div className="text-center space-y-7">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-950/60 border border-emerald-700 flex items-center justify-center"><CheckCircle2 className="w-9 h-9 text-emerald-400" /></div>
            <div><h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Dein Setup ist bereit.</h1><p className="text-slate-400 text-lg">RealSync hat dein Arbeitsprofil gespeichert. Der nächste Schritt ist der Test deines gewählten Workflows.</p></div>

            <div className="grid sm:grid-cols-3 gap-3 text-left">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-700"><Building2 className="w-5 h-5 text-cyan-400 mb-3" /><div className="text-sm font-semibold text-white">Unternehmen</div><div className="text-xs text-slate-500 mt-1">{state.org_name}</div></div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-700"><ShieldCheck className="w-5 h-5 text-cyan-400 mb-3" /><div className="text-sm font-semibold text-white">Governance</div><div className="text-xs text-slate-500 mt-1">Profil erfasst</div></div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-700"><Phone className="w-5 h-5 text-cyan-400 mb-3" /><div className="text-sm font-semibold text-white">Workflow</div><div className="text-xs text-slate-500 mt-1">{GOALS.find((g) => g.id === state.goal)?.label}</div></div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {state.goal === 'phone' && <button onClick={() => navigate('/phonebot/start')} className="px-6 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold flex items-center justify-center gap-2"><Phone className="w-4 h-4" /> Telefon-Agent testen</button>}
              <button onClick={() => navigate('/app/dashboard', { replace: true })} className="px-6 py-3 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white font-semibold">Zum Dashboard</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
