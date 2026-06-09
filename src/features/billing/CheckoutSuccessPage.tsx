import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck, Check } from 'lucide-react';
import { Navbar } from '../../components/Navbar';
import { usePageMeta } from '../../lib/usePageMeta';

/**
 * /checkout/success — bestaetigt einen erfolgreich uebermittelten
 * Stripe-Checkout. Wichtig: kein Zahlungs-Garantie-Wording.
 * Die endgueltige Aktivierung erfolgt erst, wenn der Webhook
 * `checkout.session.completed` und `customer.subscription.created`
 * verarbeitet hat — das kann wenige Sekunden dauern.
 */
export function CheckoutSuccessPage() {
  usePageMeta({
    title: 'Aktivierung laeuft — RealSyncDynamics.AI',
    description: 'Dein Stripe-Checkout wurde uebermittelt. Die Runtime-Freischaltung erfolgt sobald der Zahlungsstatus bestaetigt ist.',
    url: 'https://realsyncdynamicsai.de/checkout/success',
  });

  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const planKey   = params.get('plan_key');

  // Sanftes Animationsfenster: 3s „aktiviert gleich" -> dann gruener Check.
  const [activating, setActivating] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setActivating(false), 2400);
    return () => window.clearTimeout(timer);
  }, []);

  const planLabel = useMemo(() => labelForPlanKey(planKey), [planKey]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-16 sm:py-24">
        <div className="border border-titanium-800 bg-obsidian-900 p-8">
          <div className="flex items-center gap-3">
            {activating ? (
              <Loader2 className="h-6 w-6 animate-spin text-ai-cyan-400" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            )}
            <h1 className="font-display text-2xl font-bold tracking-tight text-titanium-50">
              {activating ? 'Deine Runtime wird aktiviert.' : 'Runtime aktiviert.'}
            </h1>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-titanium-300">
            Der Zahlungsstatus wurde von Stripe entgegengenommen. Die Freischaltung
            kann wenige Sekunden dauern — sobald der Webhook das Abonnement
            verarbeitet hat, ist dein Plan im Dashboard sichtbar.
          </p>

          {planLabel ? (
            <p className="mt-3 font-mono text-[11px] uppercase tracking-wide text-titanium-500">
              Plan: {planLabel}
            </p>
          ) : null}
          {sessionId ? (
            <p className="mt-1 break-all font-mono text-[11px] text-titanium-500">
              Session: {sessionId}
            </p>
          ) : null}

          <OnboardingSteps planKey={planKey} />

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/app"
              className="inline-flex items-center gap-2 border border-ai-cyan-500/50 bg-ai-cyan-900/20 px-4 py-2 font-mono text-[11px] uppercase tracking-wide text-ai-cyan-200 hover:bg-ai-cyan-900/40"
            >
              Dashboard öffnen <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 border border-titanium-700 bg-obsidian-950 px-4 py-2 font-mono text-[11px] uppercase tracking-wide text-titanium-200 hover:border-titanium-500 hover:text-titanium-50"
            >
              Zurück zur Übersicht
            </Link>
          </div>

          <div className="mt-8 flex items-start gap-2 border-t border-titanium-800 pt-4 text-[11px] text-titanium-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-titanium-400" />
            <span>
              Zahlungsabwicklung ueber Stripe (EU-Hosted). Keine automatische
              Rechtsfreigabe — die Runtime liefert technische Vorbereitung,
              Human Review bleibt erforderlich.
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

interface OnboardingStep { label: string; detail: string }

const ONBOARDING_STEPS: Record<string, OnboardingStep[]> = {
  agency: [
    { label: 'E-Mail prüfen', detail: 'Account-Zugang + API-Key innerhalb von 15 Minuten' },
    { label: 'Dashboard öffnen', detail: 'White-Label-Panel, Logo, Farben und eigene Domain konfigurieren' },
    { label: 'Erste Kundenseite hinzufügen', detail: '10 Domains inklusive — Domain-Onboarding im Dashboard unter "Websites"' },
    { label: 'Optional: Setup-Gespräch', detail: 'Unser Team meldet sich innerhalb von 24 h für ein kostenfreies Onboarding-Call' },
  ],
  growth: [
    { label: 'E-Mail prüfen', detail: 'Account-Zugang innerhalb von 15 Minuten' },
    { label: 'Domain hinzufügen', detail: 'Bis zu 3 Domains im Dashboard — tägliches Monitoring startet automatisch' },
    { label: 'Risk-Dashboard öffnen', detail: 'Erste Drift-Events und Consent-Analyse sind sofort sichtbar' },
  ],
  starter: [
    { label: 'E-Mail prüfen', detail: 'Account-Zugang innerhalb von 15 Minuten' },
    { label: 'Domain hinzufügen', detail: '1 Domain — monatlicher Re-Scan startet automatisch' },
  ],
};

function OnboardingSteps({ planKey }: { planKey: string | null }) {
  const steps = planKey ? ONBOARDING_STEPS[planKey] : null;
  if (!steps) return null;
  return (
    <div className="mt-6 border border-titanium-800 bg-obsidian-950 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-500 mb-3">
        Nächste Schritte
      </p>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-start gap-3">
            <span className="shrink-0 font-mono text-[10px] text-titanium-600 mt-0.5 w-4">{i + 1}.</span>
            <div>
              <span className="text-xs font-semibold text-titanium-100 flex items-center gap-1.5">
                <Check className="h-3 w-3 text-emerald-400 shrink-0" /> {s.label}
              </span>
              <p className="text-[11px] text-titanium-500 mt-0.5">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function labelForPlanKey(planKey: string | null): string | null {
  switch (planKey) {
    case 'starter':    return 'Starter';
    case 'growth':     return 'Growth';
    case 'agency':     return 'Agency';
    case 'scale':      return 'Scale';
    case 'enterprise': return 'Enterprise';
    default:           return null;
  }
}

export default CheckoutSuccessPage;
