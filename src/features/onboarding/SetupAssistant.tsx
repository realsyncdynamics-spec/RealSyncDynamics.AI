import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/useAuth';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';
import { Building2, Users, Briefcase, User, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

type OrgType = 'freelancer' | 'sme' | 'agency' | 'enterprise';
type Step = 'org-type' | 'org-details' | 'welcome';

interface SetupState {
  tenant_type: OrgType;
  org_name: string;
  org_size_employees?: number;
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
  const { user } = useAuth();
  const { activeTenantId, refresh } = useTenant();
  const [step, setStep] = useState<Step>('org-type');
  const [state, setState] = useState<SetupState>({
    tenant_type: 'sme',
    org_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  if (!user || !activeTenantId) {
    return <div className="text-center py-12">Loading...</div>;
  }

  const handleSelectOrgType = (type: OrgType) => {
    setState((prev) => ({ ...prev, tenant_type: type }));
    setStep('org-details');
  };

  const handleContinueDetails = async () => {
    if (!state.org_name.trim()) {
      setError('Bitte geben Sie den Namen Ihrer Organisation ein.');
      return;
    }

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

      // Refresh tenant context
      await refresh();

      // Move to success step
      setStep('welcome');

      // Auto-redirect after 2 seconds
      setTimeout(() => {
        navigate('/app/dashboard', { replace: true });
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
        navigate('/app/dashboard', { replace: true });
      }
    } catch (e) {
      console.error('Skip error:', e);
      navigate('/app/dashboard', { replace: true });
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
            </div>

            <div className="grid gap-4">
              {ORG_TYPES.map((orgType) => (
                <button
                  key={orgType.id}
                  onClick={() => handleSelectOrgType(orgType.id)}
                  className="text-left p-5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 hover:border-cyan-400 transition-all cursor-pointer group"
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

        {/* Step 3: Welcome / Success */}
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
