import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';
import { useApiAccess } from './useApiAccess';
import { ApiPurposeStep, type ApiPurpose } from './components/ApiPurposeStep';
import { ApiPermissionsStep, type ApiPermissionLevel } from './components/ApiPermissionsStep';
import { ApiNameStep } from './components/ApiNameStep';
import { ApiConfirmStep } from './components/ApiConfirmStep';
import { ApiSuccessStep } from './components/ApiSuccessStep';

type WizardStep = 1 | 2 | 3 | 4 | 5;

export function ApiSetupWizard() {
  const navigate = useNavigate();
  const { activeTenantId } = useTenant();
  const { hasAccess, tier, loading: accessLoading } = useApiAccess();

  const [step, setStep] = useState<WizardStep>(1);
  const [purpose, setPurpose] = useState<ApiPurpose | null>(null);
  const [permission, setPermission] = useState<ApiPermissionLevel | null>(null);
  const [name, setName] = useState('');
  const [createdKey, setCreatedKey] = useState<{ id: string; raw: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessLoading && !hasAccess) {
      navigate('/app/api?noAccess=true', { replace: true });
    }
  }, [accessLoading, hasAccess, navigate]);

  const purposeLabels: Record<ApiPurpose, string> = {
    website: 'Meine Website',
    tool: 'Externes Tool',
    chatbot: 'Bot / Chatbot',
    crm: 'CRM oder Kundensystem',
    automation: 'Make / Zapier / n8n',
    custom: 'Eigene Software',
  };

  const permissionLabels: Record<ApiPermissionLevel, string> = {
    read: 'Nur Ergebnisse lesen',
    write: 'Scans starten & Ergebnisse lesen',
    full: 'Vollständiger Zugriff',
  };

  async function createKey() {
    if (!activeTenantId || !name.trim() || !permission) return;
    setCreating(true);
    setError(null);

    try {
      const buf = crypto.getRandomValues(new Uint8Array(32));
      const raw = 'rsd_' + btoa(String.fromCharCode(...buf))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const prefix = raw.slice(0, 12);
      const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
      const hash = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, '0')).join('');

      const sb = getSupabase();
      const { data, error: err } = await sb.from('api_keys').insert({
        tenant_id: activeTenantId,
        name: name.trim(),
        key_hash: hash,
        key_prefix: prefix,
      }).select('id').single();

      if (err) throw err;
      setCreatedKey({ id: data!.id, raw });
      setStep(5);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  if (accessLoading) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Wird geladen…
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <button
          onClick={() => navigate('/app/settings/api-keys')}
          className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">
            API-Schlüssel einrichten
          </div>
          <div className="text-[11px] text-titanium-400 font-medium">
            Schritt {step} von 5
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  s === step
                    ? 'bg-security-500'
                    : s < step
                      ? 'bg-emerald-600'
                      : 'bg-titanium-800'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-titanium-500 mt-2">Fortschritt: {step} / 5</p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        <div className="bg-obsidian-900 border border-titanium-800 rounded-none p-6 min-h-96">
          {step === 1 && <ApiPurposeStep selected={purpose} onChange={setPurpose} />}
          {step === 2 && <ApiPermissionsStep selected={permission} onChange={setPermission} />}
          {step === 3 && <ApiNameStep value={name} onChange={setName} />}
          {step === 4 && (
            <ApiConfirmStep
              name={name}
              purpose={purposeLabels[purpose!]}
              permission={permissionLabels[permission!]}
            />
          )}
          {step === 5 && createdKey && (
            <ApiSuccessStep
              keyName={name}
              fullKey={createdKey.raw}
              onCopyConfirmed={() => {
                setTimeout(() => navigate('/app/settings/api-keys'), 1000);
              }}
            />
          )}
        </div>

        <div className="flex gap-3 mt-6 justify-between">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1) as WizardStep)}
            disabled={step === 1}
            className="px-4 py-2 bg-obsidian-900 border border-titanium-700 hover:border-security-500 text-titanium-200 rounded-none disabled:opacity-40 text-sm font-semibold transition-colors"
          >
            ← Zurück
          </button>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/app/settings/api-keys')}
              className="px-4 py-2 bg-obsidian-900 border border-titanium-700 hover:border-titanium-600 text-titanium-400 rounded-none text-sm font-semibold transition-colors"
            >
              Abbrechen
            </button>

            <button
              onClick={() => {
                if (step === 4) {
                  createKey();
                } else if (
                  (step === 1 && purpose) ||
                  (step === 2 && permission) ||
                  (step === 3 && name.trim())
                ) {
                  setStep((s) => Math.min(5, s + 1) as WizardStep);
                }
              }}
              disabled={
                creating ||
                (step === 1 && !purpose) ||
                (step === 2 && !permission) ||
                (step === 3 && !name.trim()) ||
                step === 5
              }
              className="px-4 py-2 bg-security-600 hover:bg-security-500 disabled:opacity-40 text-white rounded-none text-sm font-bold transition-colors"
              data-testid="api-wizard-next"
            >
              {creating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 inline mr-1.5 animate-spin" />
                  Wird erstellt…
                </>
              ) : step === 4 ? (
                'API-Key erstellen'
              ) : (
                'Weiter →'
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
