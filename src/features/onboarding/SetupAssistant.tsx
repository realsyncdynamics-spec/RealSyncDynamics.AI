import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/useAuth';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';
import { safeInternalPath } from '../../lib/safeInternalPath';
import { loadCompanyProfile, saveCompanyProfile } from '../company/companyProfileLocal';
import { clearScanProfile, loadScanProfile, type ScanProfile } from './scanProfile';
import { Building2, Users, Briefcase, User, ArrowRight, CheckCircle2, AlertCircle, Server, Cloud, Shuffle, Sparkles } from 'lucide-react';

type OrgType = 'freelancer' | 'sme' | 'agency' | 'enterprise';
type Step = 'org-type' | 'org-details' | 'operations' | 'welcome';
// Werte entsprechen `tenants.ai_data_residency_policy` (siehe AiResidencySettings).
type ResidencyPolicy = 'enforce_eu_local' | 'enforce_cloud' | 'user_choice';

interface SetupState {
  tenant_type: OrgType;
  org_name: string;
  org_size_employees?: number;
  residency_policy: ResidencyPolicy;
  ai_systems: string[];
}

const RESIDENCY_OPTIONS: Array<{ id: ResidencyPolicy; label: string; description: string; icon: React.ReactNode }> = [
  {
    id: 'enforce_eu_local',
    label: 'Lokal',
    description: 'KI läuft im eigenen Haus (z. B. Ollama). Keine Daten an Cloud-Anbieter.',
    icon: <Server className="w-5 h-5" />,
  },
  {
    id: 'enforce_cloud',
    label: 'Cloud',
    description: 'KI über Cloud-Anbieter (z. B. ChatGPT, Claude, Gemini).',
    icon: <Cloud className="w-5 h-5" />,
  },
  {
    id: 'user_choice',
    label: 'Hybrid',
    description: 'Beides — pro Anwendungsfall entschieden. Später änderbar.',
    icon: <Shuffle className="w-5 h-5" />,
  },
];

const AI_SYSTEM_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'claude', label: 'Claude' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'm365', label: 'Microsoft 365 Copilot' },
  { id: 'ollama', label: 'Ollama / lokale Modelle' },
  { id: 'chatbot', label: 'Website-Chatbot' },
  { id: 'code_agent', label: 'Code-Agent' },
  { id: 'custom', label: 'Eigene Modelle / API' },
];

// Scan-Rolle → Organisationstyp, Scan-System → Setup-System.
const ROLE_TO_ORG: Record<NonNullable<ScanProfile['role']>, OrgType> = {
  self: 'freelancer',
  team: 'sme',
  agency: 'agency',
  enterprise: 'enterprise',
};
const SCAN_SYSTEM_TO_SETUP: Record<string, string> = {
  chatgpt: 'chatgpt',
  m365: 'm365',
  chatbot: 'chatbot',
  code: 'code_agent',
  hr: 'custom',
  scoring: 'custom',
};
const SCAN_RESIDENCY_TO_POLICY: Record<NonNullable<ScanProfile['residency']>, ResidencyPolicy> = {
  local: 'enforce_eu_local',
  eu_cloud: 'enforce_cloud',
  hybrid: 'user_choice',
};

/** Startwerte aus dem Free-Audit-Scan — vorgeschlagen, nie erzwungen. */
function initialStateFromScan(scan: ScanProfile | null): SetupState {
  const systems = Array.from(
    new Set((scan?.systems ?? []).map((id) => SCAN_SYSTEM_TO_SETUP[id]).filter(Boolean)),
  );
  return {
    tenant_type: scan?.role ? ROLE_TO_ORG[scan.role] : 'sme',
    org_name: scan?.company ?? '',
    residency_policy: scan?.residency ? SCAN_RESIDENCY_TO_POLICY[scan.residency] : 'user_choice',
    ai_systems: systems,
  };
}

const ORG_TYPES: Array<{ id: OrgType; label: string; description: string; icon: React.ReactNode }> = [
  {
    id: 'freelancer',
    label: 'Einzelner / Freelancer',
    description: 'Ich arbeite allein oder mit wenigen Verträgen.',
    icon: <User className="w-6 h-6" />,
  },
  {
    id: 'sme',
    label: 'KMU / Handwerk',
    description: 'Wir sind ein kleineres Unternehmen (< 50 Mitarbeiter).',
    icon: <Building2 className="w-6 h-6" />,
  },
  {
    id: 'agency',
    label: 'Agentur / Kanzlei',
    description: 'Wir betreuen Kunden mit Governance & Compliance.',
    icon: <Briefcase className="w-6 h-6" />,
  },
  {
    id: 'enterprise',
    label: 'Großunternehmen',
    description: 'Wir sind ein größeres Unternehmen oder konzernweit organisiert.',
    icon: <Users className="w-6 h-6" />,
  },
];

export function SetupAssistant() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeNext = safeInternalPath(searchParams.get('next'));
  const { user } = useAuth();
  const { activeTenantId, refresh } = useTenant();
  const [step, setStep] = useState<Step>('org-type');
  const scan = useMemo(() => loadScanProfile(), []);
  const [state, setState] = useState<SetupState>(() => initialStateFromScan(scan));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const finishTarget = resumeNext ?? '/app/dashboard';

  if (!user || !activeTenantId) {
    return <div className="text-center py-12">Loading...</div>;
  }

  const handleSelectOrgType = (type: OrgType) => {
    setState((prev) => ({ ...prev, tenant_type: type }));
    setStep('org-details');
  };

  const handleContinueDetails = () => {
    if (!state.org_name.trim()) {
      setError('Bitte geben Sie den Namen Ihrer Organisation ein.');
      return;
    }
    setError(undefined);
    setStep('operations');
  };

  const toggleSystem = (id: string) =>
    setState((prev) => ({
      ...prev,
      ai_systems: prev.ai_systems.includes(id)
        ? prev.ai_systems.filter((x) => x !== id)
        : [...prev.ai_systems, id],
    }));

  const handleFinish = async () => {
    setLoading(true);
    setError(undefined);

    try {
      // Update tenant with collected info
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

      if (updateError) {
        setError(`Update failed: ${updateError.message}`);
        return;
      }

      // Betriebsmodus: dieselbe Spalte wie in den KI-Datenhaltungs-Einstellungen.
      // Nur der Owner darf sie setzen (RLS) — scheitert das, bleibt das Setup
      // trotzdem gültig; der Modus ist dort jederzeit nachholbar.
      const { error: residencyError } = await supabase
        .from('tenants')
        .update({ ai_data_residency_policy: state.residency_policy })
        .eq('id', activeTenantId);
      if (residencyError) {
        console.warn('Setup: Betriebsmodus nicht gespeichert:', residencyError.message);
      }

      // Genutzte KI-Systeme ins (noch lokale) Firmenprofil — Grundlage für
      // das KI-Register. Bestehende Felder bleiben erhalten.
      const profile = loadCompanyProfile(activeTenantId);
      saveCompanyProfile(activeTenantId, { ...profile, usedTools: state.ai_systems });
      clearScanProfile();

      // Refresh tenant context
      await refresh();

      // Move to success step
      setStep('welcome');

      // Auto-redirect after 2 seconds — honor ?next= (e.g. checkout resume)
      setTimeout(() => {
        navigate(finishTarget, { replace: true });
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    // Mark onboarded with defaults
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { error: updateError } = await supabase
        .from('tenants')
        .update({
          onboarded_at: new Date().toISOString(),
        })
        .eq('id', activeTenantId);

      if (!updateError) {
        await refresh();
        navigate(finishTarget, { replace: true });
      }
    } catch (e) {
      console.error('Skip error:', e);
      navigate(finishTarget, { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 px-4"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <div className="w-full max-w-2xl">
        {/* Step 1: Organization Type Selection */}
        {step === 'org-type' && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                Wer bist du?
              </h1>
              <p className="text-slate-400 text-lg">
                Wir passen die Plattform an deine Bedürfnisse an.
              </p>
              {scan?.role && (
                <p className="mt-3 inline-flex items-center gap-2 text-sm text-cyan-300">
                  <Sparkles className="w-4 h-4" />
                  Aus deinem Scan vorgeschlagen — bitte bestätigen.
                </p>
              )}
            </div>

            <div className="grid gap-4">
              {ORG_TYPES.map((orgType) => (
                <button
                  key={orgType.id}
                  onClick={() => handleSelectOrgType(orgType.id)}
                  className={`text-left p-5 rounded-xl border bg-slate-800 hover:bg-slate-700 hover:border-cyan-400 transition-all cursor-pointer group ${
                    scan?.role && state.tenant_type === orgType.id ? 'border-cyan-400' : 'border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1 text-cyan-400 group-hover:scale-110 transition-transform">
                      {orgType.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-white">{orgType.label}</h3>
                      <p className="text-sm text-slate-400 mt-1">{orgType.description}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-8 flex justify-between">
              <button
                onClick={handleSkip}
                className="text-slate-400 hover:text-white text-sm transition-colors"
              >
                Überspringen
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Organization Details */}
        {step === 'org-details' && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                Mehr über dich
              </h1>
              <p className="text-slate-400 text-lg">
                Optional: Hilf uns, die Plattform besser zu personalisieren.
              </p>
            </div>

            <div className="space-y-5 bg-slate-800 p-6 rounded-xl border border-slate-700">
              {/* Organization Name */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Name deiner Organisation
                </label>
                <input
                  type="text"
                  value={state.org_name}
                  onChange={(e) => setState((prev) => ({ ...prev, org_name: e.target.value }))}
                  placeholder="z.B. MyCompany GmbH"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-600 bg-slate-700 text-white placeholder-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none transition-colors"
                />
              </div>

              {/* Employee Count */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Anzahl Mitarbeiter (optional)
                </label>
                <select
                  value={state.org_size_employees || ''}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      org_size_employees: e.target.value ? parseInt(e.target.value) : undefined,
                    }))
                  }
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-600 bg-slate-700 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none transition-colors"
                >
                  <option value="">Bitte wählen...</option>
                  <option value="1">1-5</option>
                  <option value="10">6-25</option>
                  <option value="50">26-100</option>
                  <option value="250">101-500</option>
                  <option value="1000">500+</option>
                </select>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 rounded-lg bg-red-900/30 border border-red-800 flex gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}
            </div>

            <div className="mt-8 flex gap-3 justify-between">
              <button
                onClick={() => setStep('org-type')}
                disabled={loading}
                className="px-4 py-2.5 text-slate-400 hover:text-white text-sm transition-colors disabled:opacity-50"
              >
                Zurück
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleSkip}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-lg border border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Überspringen
                </button>
                <button
                  onClick={handleContinueDetails}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  Weiter
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Betrieb — Betriebsmodus + genutzte KI-Systeme */}
        {step === 'operations' && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                Wie nutzt ihr KI?
              </h1>
              <p className="text-slate-400 text-lg">
                Damit dein Dashboard nicht leer startet. Alles später änderbar.
              </p>
              {scan && (
                <p className="mt-3 inline-flex items-center gap-2 text-sm text-cyan-300">
                  <Sparkles className="w-4 h-4" />
                  Vorausgefüllt aus deinem Scan{scan.domain ? ` von ${scan.domain}` : ''}.
                </p>
              )}
            </div>

            <div className="space-y-6 bg-slate-800 p-6 rounded-xl border border-slate-700">
              <div>
                <p className="block text-sm font-medium text-white mb-3">Betriebsmodus</p>
                <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Betriebsmodus">
                  {RESIDENCY_OPTIONS.map((opt) => {
                    const active = state.residency_policy === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setState((prev) => ({ ...prev, residency_policy: opt.id }))}
                        className={`text-left p-4 rounded-lg border transition-colors ${
                          active
                            ? 'border-cyan-400 bg-slate-700'
                            : 'border-slate-600 bg-slate-800 hover:border-slate-500'
                        }`}
                      >
                        <span className="flex items-center gap-2 text-white font-semibold text-sm">
                          <span className="text-cyan-400">{opt.icon}</span>
                          {opt.label}
                        </span>
                        <span className="block text-xs text-slate-400 mt-1.5">{opt.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="block text-sm font-medium text-white mb-3">
                  Welche KI-Systeme sind schon im Einsatz? (optional)
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="KI-Systeme">
                  {AI_SYSTEM_OPTIONS.map((opt) => {
                    const active = state.ai_systems.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleSystem(opt.id)}
                        className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                          active
                            ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200'
                            : 'border-slate-600 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-900/30 border border-red-800 flex gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}
            </div>

            <div className="mt-8 flex gap-3 justify-between">
              <button
                onClick={() => setStep('org-details')}
                disabled={loading}
                className="px-4 py-2.5 text-slate-400 hover:text-white text-sm transition-colors disabled:opacity-50"
              >
                Zurück
              </button>
              <button
                onClick={handleFinish}
                disabled={loading}
                className="px-6 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                Setup abschließen
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Welcome / Success */}
        {step === 'welcome' && (
          <div className="animate-fade-in text-center">
            <div className="flex justify-center mb-6">
              <CheckCircle2 className="w-16 h-16 text-emerald-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Willkommen, {state.org_name || 'Nutzer'}!
            </h1>
            <p className="text-slate-400 text-lg mb-8">
              Dein Governance-Dashboard wird gerade vorbereitet...
            </p>
            <div className="flex justify-center">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
