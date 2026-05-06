import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, X, ArrowRight, CheckCircle2, Building2, Globe, FileSearch, FileText, Key,
} from 'lucide-react';
import { getSupabase } from '../lib/supabase';

interface OnboardingState {
  user_id: string;
  step: number;
  completed: boolean;
  dismissed: boolean;
}

const STEPS = [
  {
    icon: <Building2 className="h-5 w-5" />,
    title: 'Tenant einrichten',
    detail: 'Workspace-Identität anlegen — Name + Branche + AVV-Vertragspartner. Pro Tenant separate Audit-Logs und Compliance-Reports.',
    cta: 'Settings öffnen',
    href: '/settings',
  },
  {
    icon: <Globe className="h-5 w-5" />,
    title: 'EU-Datenresidenz aktivieren',
    detail: 'Toggle in /settings/ai-residency. EU-only zwingt alle KI-Calls auf Frankfurt-Hosted Ollama statt US-Cloud. Optional pro Tenant.',
    cta: 'Residency Settings',
    href: '/settings/ai-residency',
  },
  {
    icon: <FileSearch className="h-5 w-5" />,
    title: 'Erster DSGVO-Audit',
    detail: 'Kostenloser Site-Scan mit 29 Heuristiken. Score + Befunde mit Paragraph-Referenz. Audit-Log läuft ab dem ersten Call.',
    cta: 'Audit starten',
    href: '/audit',
  },
  {
    icon: <Key className="h-5 w-5" />,
    title: 'API-Key generieren',
    detail: 'Programmatic /audit aus deiner CI-Pipeline oder n8n-Workflow. Bronze 100/M · Silver 1k · Gold 10k Aufrufe pro Monat.',
    cta: 'API-Keys verwalten',
    href: '/settings/api-keys',
  },
  {
    icon: <FileText className="h-5 w-5" />,
    title: 'AVV vorbereiten',
    detail: 'AVV-Template gemäß DSGVO Art. 28 Abs. 3 mit TOM-Anhang. Direkt drucken, anpassen, an Kunden schicken.',
    cta: 'AVV-Template',
    href: '/legal/avv',
  },
];

export function OnboardingTour() {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = getSupabase();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data } = await sb.from('profiles')
        .select('id, onboarding_step, onboarding_completed_at, onboarding_dismissed_at')
        .eq('id', user.id).maybeSingle();
      if (!data) return;
      const completed = !!data.onboarding_completed_at;
      const dismissed = !!data.onboarding_dismissed_at;
      setState({
        user_id: user.id,
        step: data.onboarding_step ?? 0,
        completed,
        dismissed,
      });
      // Auto-open if user hasn't seen it yet
      setOpen(!completed && !dismissed);
    })();
  }, []);

  async function advanceStep(nextStep: number) {
    if (!state) return;
    const sb = getSupabase();
    const updates: Record<string, unknown> = { onboarding_step: nextStep };
    if (nextStep >= STEPS.length) {
      updates.onboarding_completed_at = new Date().toISOString();
      setOpen(false);
    }
    await sb.from('profiles').update(updates).eq('id', state.user_id);
    setState((s) => s ? { ...s, step: nextStep, completed: nextStep >= STEPS.length } : s);
  }

  async function dismiss() {
    if (!state) return;
    const sb = getSupabase();
    await sb.from('profiles')
      .update({ onboarding_dismissed_at: new Date().toISOString() })
      .eq('id', state.user_id);
    setState((s) => s ? { ...s, dismissed: true } : s);
    setOpen(false);
  }

  if (!state || !open) return null;

  const currentStep = state.step;
  const step = STEPS[currentStep];
  if (!step) return null;
  const progress = Math.round((currentStep / STEPS.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6 bg-obsidian-950/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-obsidian-900 border border-titanium-700 rounded-none shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-titanium-900">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-titanium-500 font-bold">Onboarding · Schritt {currentStep + 1}/{STEPS.length}</div>
              <div className="font-display font-bold text-titanium-50 text-sm">Willkommen bei RealSyncDynamics.AI</div>
            </div>
          </div>
          <button onClick={dismiss}
            title="Tour überspringen"
            className="shrink-0 p-1.5 text-titanium-500 hover:text-titanium-200 rounded-none">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-1 bg-obsidian-950">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${progress}%` }} />
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="shrink-0 w-10 h-10 rounded-none bg-emerald-950/40 border border-emerald-900 flex items-center justify-center text-emerald-300">
              {step.icon}
            </div>
            <div>
              <h3 className="font-display font-bold text-titanium-50 text-base mb-1">{step.title}</h3>
              <p className="text-sm text-titanium-300 leading-relaxed">{step.detail}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mt-5">
            <Link
              to={step.href}
              onClick={() => advanceStep(currentStep + 1)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none"
            >
              {step.cta} <ArrowRight className="h-4 w-4" />
            </Link>
            <button onClick={() => advanceStep(currentStep + 1)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-obsidian-950 border border-titanium-700 hover:border-titanium-500 text-titanium-200 text-sm font-bold rounded-none">
              Schritt überspringen
            </button>
            {currentStep === STEPS.length - 1 && (
              <button onClick={() => advanceStep(STEPS.length)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-emerald-300 hover:text-emerald-200 text-sm font-bold rounded-none">
                <CheckCircle2 className="h-4 w-4" /> Tour abschließen
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-titanium-900 px-5 py-3 flex items-center justify-between text-[11px] text-titanium-500">
          <span>{progress}% abgeschlossen</span>
          <button onClick={dismiss} className="hover:text-titanium-300">Nicht mehr anzeigen</button>
        </div>
      </div>
    </div>
  );
}
