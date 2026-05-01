import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Sparkles, ArrowRight, Loader2, AlertTriangle } from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { isSupabaseConfigured } from '../../lib/supabase';
import { AuthGate } from '../kodee/connections/AuthGate';
import { createCheckoutSession, type PlanKey } from './checkout';

interface PlanTile {
  key: PlanKey;
  name: string;
  priceLabel: string;
  tagline: string;
  highlights: string[];
  highlight?: boolean;
  ctaLabel: string;
}

const PLANS: PlanTile[] = [
  {
    key: 'free',
    name: 'Free',
    priceLabel: '0 € / Monat',
    tagline: 'Zum Reinschnuppern',
    highlights: [
      'C2PA-Verifikation öffentlicher Assets',
      '10 aktive Assets',
      'Kein AI-Kontingent',
    ],
    ctaLabel: 'Kostenlos starten',
  },
  {
    key: 'bronze',
    name: 'Bronze',
    priceLabel: '29 € / Monat',
    tagline: 'Solo-Creator',
    highlights: [
      '+ Asset-Registrierung',
      '+ Basis-Herkunftsnachweis',
      '50 AI-Aufrufe / Monat',
      '100k AI-Token / Monat',
    ],
    ctaLabel: 'Bronze buchen',
  },
  {
    key: 'silver',
    name: 'Silver',
    priceLabel: '99 € / Monat',
    tagline: 'Kleine Teams',
    highlights: [
      '+ Wasserzeichen + Barcodes',
      '+ C2PA-Export',
      '+ AI: Code-Erklärung & Log-Analyse',
      '250 AI-Aufrufe / Monat',
      '10 Team-Seats',
    ],
    highlight: true,
    ctaLabel: 'Silver buchen',
  },
  {
    key: 'gold',
    name: 'Gold',
    priceLabel: '299 € / Monat',
    tagline: 'Wachsende Agenturen',
    highlights: [
      '+ Erweiterte Provenance',
      '+ API-Zugriff + Bulk-Jobs',
      '+ Compliance-Exporte',
      '+ AI: VPS-Diagnose + Action-Advisor',
      '2.500 AI-Aufrufe / Monat',
    ],
    ctaLabel: 'Gold buchen',
  },
  {
    key: 'enterprise_public',
    name: 'Enterprise Public',
    priceLabel: 'Auf Anfrage',
    tagline: 'Behörden & Konzerne',
    highlights: [
      '+ SSO / SAML',
      '+ Org-Governance + Audit-Logs',
      '+ Public-Sector-Modus',
      'Unlimitierte AI-Aufrufe',
    ],
    ctaLabel: 'Vertrieb kontaktieren',
  },
];

export function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="h-14 border-b border-slate-200/60 bg-white flex items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="bg-slate-900 p-1.5 rounded-lg shadow-sm">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-slate-900">
            RealSync<span className="text-slate-500 font-medium">Dynamics</span>
          </span>
        </Link>
        <Link
          to="/dashboard"
          className="text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
        >
          Zum Dashboard →
        </Link>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-3">
            Pläne & Preise
          </h1>
          <p className="text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Plan jederzeit upgrade- oder downgradebar. Du zahlst über Stripe;
            Rechnungen kommen automatisch.
          </p>
        </div>

        <AuthGate>{(_session) => <Tiles />}</AuthGate>
      </main>
    </div>
  );
}

function Tiles() {
  const { activeTenantId, loading } = useTenant();
  const [busyPlan, setBusyPlan] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onChoose = async (planKey: PlanKey) => {
    setError(null);

    if (planKey === 'enterprise_public') {
      window.location.href = 'mailto:sales@realsyncdynamicsai.de?subject=Enterprise%20Public%20Plan';
      return;
    }
    if (planKey === 'free') {
      window.location.href = '/dashboard';
      return;
    }
    if (!activeTenantId) {
      setError('Tenant wird gerade angelegt — bitte kurz warten und nochmal klicken.');
      return;
    }
    if (!isSupabaseConfigured()) {
      setError('Supabase ist nicht konfiguriert — Checkout nicht verfügbar.');
      return;
    }

    setBusyPlan(planKey);
    try {
      const r = await createCheckoutSession(activeTenantId, planKey);
      if (r.ok && r.url) {
        window.location.href = r.url;
        return;
      }
      setError(r.error?.message ?? 'Checkout konnte nicht gestartet werden.');
    } finally {
      setBusyPlan(null);
    }
  };

  return (
    <>
      {error && (
        <div className="max-w-2xl mx-auto mb-6 flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
        {PLANS.map((p) => {
          const busy = busyPlan === p.key;
          return (
            <div
              key={p.key}
              className={`relative bg-white border rounded-2xl p-6 flex flex-col ${
                p.highlight
                  ? 'border-indigo-300 shadow-lg shadow-indigo-200/40 ring-2 ring-indigo-100'
                  : 'border-slate-200'
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-indigo-600 text-white text-[11px] font-bold tracking-wider rounded-full uppercase">
                  Beliebt
                </span>
              )}
              <div>
                <div className="font-display font-bold text-lg text-slate-900">{p.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{p.tagline}</div>
                <div className="mt-3 font-mono text-sm text-slate-700">{p.priceLabel}</div>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-slate-700 flex-1">
                {p.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={busy || loading}
                onClick={() => onChoose(p.key)}
                className={`mt-6 w-full py-2.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1.5 ${
                  p.highlight
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {busy ? 'Stripe lädt…' : p.ctaLabel}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-slate-400 mt-8 max-w-xl mx-auto">
        Preise zzgl. MwSt. Auto-renew nach 30 Tagen. Du kannst jederzeit
        kündigen oder den Plan wechseln. Zahlungsabwicklung über Stripe.
      </p>
    </>
  );
}
