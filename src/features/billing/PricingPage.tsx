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
      'EU-Hosting + AVV',
      'DSGVO-Selfservice (Art. 15 + 17)',
      'Kein AI-Kontingent',
    ],
    ctaLabel: 'Kostenlos starten',
  },
  {
    key: 'bronze',
    name: 'Bronze',
    priceLabel: '29 € / Monat',
    tagline: 'Solo-Operator · DSGVO-Basis',
    highlights: [
      '+ EU-Datenresidenz (eu_local Modus)',
      '+ Audit-Log + CSV-Export',
      '50 AI-Aufrufe / Monat',
      '100k AI-Token / Monat',
    ],
    ctaLabel: 'Bronze buchen',
  },
  {
    key: 'silver',
    name: 'Silver',
    priceLabel: '99 € / Monat',
    tagline: 'Kleine Teams · Compliance-Standard',
    highlights: [
      '+ Workflow-Engine (n8n)',
      '+ AVV / DPA-Generator',
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
    tagline: 'Mittelstand · Audit-tauglich',
    highlights: [
      '+ API-Zugriff + Bulk-Jobs',
      '+ Compliance-Reports (PDF, signiert)',
      '+ Bring-Your-Own-Key (BYOK)',
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
    <div className="min-h-screen bg-obsidian-950">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="bg-obsidian-950 p-1.5 rounded-none shadow-sm">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-titanium-50">
            RealSync<span className="text-titanium-400 font-medium">Dynamics</span>
          </span>
        </Link>
        <Link
          to="/dashboard"
          className="text-sm font-semibold text-titanium-200 hover:text-titanium-50 transition-colors"
        >
          Zum Dashboard →
        </Link>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <PilotBanner />
        <div className="text-center mb-12">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-titanium-50 mb-3">
            Pläne & Preise
          </h1>
          <p className="text-titanium-400 max-w-2xl mx-auto leading-relaxed">
            Plan jederzeit upgrade- oder downgradebar. Du zahlst über Stripe;
            Rechnungen kommen automatisch.
          </p>
        </div>

        <AuthGate>{(_session) => <Tiles />}</AuthGate>
      </main>
    </div>
  );
}

function PilotBanner() {
  const isPilot = new URLSearchParams(window.location.search).get('pilot') === 'true';
  if (!isPilot) return null;
  return (
    <div className="max-w-3xl mx-auto mb-10 p-4 sm:p-5 bg-emerald-950/40 border border-emerald-700 rounded-none flex items-start gap-3">
      <div className="text-2xl shrink-0">🎟️</div>
      <div>
        <div className="font-display font-bold text-emerald-200 text-sm sm:text-base mb-1">
          Pilot-Modus aktiv — 14 Tage kostenlos
        </div>
        <div className="text-xs sm:text-sm text-emerald-100/80 leading-relaxed">
          Beim Checkout wird kein Geld eingezogen. Stripe rechnet erst ab Tag 15 ab.
          Vorher jederzeit kündbar im Customer Portal.
        </div>
      </div>
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
        <div className="max-w-2xl mx-auto mb-6 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
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
              className={`relative bg-obsidian-900 border rounded-none p-6 flex flex-col ${
                p.highlight
                  ? 'border-indigo-300 shadow-lg shadow-indigo-200/40 ring-2 ring-indigo-100'
                  : 'border-titanium-900'
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-security-500 text-white text-[11px] font-bold tracking-wider rounded-full uppercase">
                  Beliebt
                </span>
              )}
              <div>
                <div className="font-display font-bold text-lg text-titanium-50">{p.name}</div>
                <div className="text-xs text-titanium-400 mt-0.5">{p.tagline}</div>
                <div className="mt-3 font-mono text-sm text-titanium-200">{p.priceLabel}</div>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-titanium-200 flex-1">
                {p.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={busy || loading}
                onClick={() => onChoose(p.key)}
                className={`mt-6 w-full py-2.5 text-sm font-semibold rounded-none transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1.5 ${
                  p.highlight
                    ? 'bg-security-500 text-white hover:bg-security-600'
                    : 'bg-obsidian-950 text-white hover:bg-obsidian-800'
                }`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {busy ? 'Stripe lädt…' : p.ctaLabel}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-titanium-500 mt-8 max-w-xl mx-auto">
        Preise zzgl. MwSt. Auto-renew nach 30 Tagen. Du kannst jederzeit
        kündigen oder den Plan wechseln. Zahlungsabwicklung über Stripe.
      </p>

      <WebsiteServiceSection />
    </>
  );
}

/**
 * WebsiteServiceSection — die 3 DSGVO-Website-as-a-Service-Tier:
 * Audit (one-off) · Rebuild (one-off) · Managed (recurring). Diese
 * Tier sind absichtlich NICHT in der PlanKey-Union — Rebuild hat
 * variable Pricing (1.5–4 k€), Audit reuse die /audit-Engine.
 * Self-Service-Checkout läuft über /dsgvo-website (eigene Stripe-
 * Configuration siehe docs/runbooks/stripe-rebuild-managed-setup.md).
 */
function WebsiteServiceSection() {
  const tiles = [
    {
      eyebrow: 'Audit',
      name: 'Quick-Scan',
      price: 'ab 249 €',
      period: 'einmalig',
      body: 'Voll-Scan auf 12+ DSGVO/TTDSG-Befunde, PDF-Report mit Paragraph-Refs, 30-Min-Befund-Call.',
      to: '/audit?source=pricing-website',
      cta: 'Quick-Scan starten',
    },
    {
      eyebrow: 'Rebuild',
      name: 'Site-Neuaufbau',
      price: '1.500 – 4.000 €',
      period: 'einmalig',
      body: 'Audit + Befund-Behebung, modernes Layout, lokale Fonts, Consent-Banner, Übergabe oder Übergang in Managed.',
      to: '/dsgvo-website#rebuild',
      cta: 'Beratung anfragen',
      highlight: true,
    },
    {
      eyebrow: 'Managed',
      name: 'Betrieb',
      price: 'ab 99 € / Monat',
      period: 'recurring',
      body: 'EU-Hosting, TLS, Header-Pflege, Consent-Updates, 2× Re-Audit pro Jahr, Audit-Trail.',
      to: '/dsgvo-website#managed',
      cta: 'Tarif anfragen',
    },
  ];

  return (
    <section className="mt-20 pt-12 border-t border-titanium-900">
      <div className="text-center mb-10">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-brass-400 mb-2">
          DSGVO-Website-as-a-Service
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-titanium-50 mb-2">
          Audit. Rebuild. Managed.
        </h2>
        <p className="text-sm text-titanium-400 max-w-2xl mx-auto">
          Drei Pakete für KMU, die ihre Site nicht selbst pflegen, sondern betreiben lassen.
          Variable Rebuild-Pricing nach Scope, Managed mit fester Monatspauschale.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-titanium-900 max-w-5xl mx-auto">
        {tiles.map((t) => (
          <div
            key={t.eyebrow}
            className={`flex flex-col p-6 ${
              t.highlight ? 'bg-obsidian-900 ring-1 ring-brass-500/40' : 'bg-obsidian-950'
            }`}
          >
            {t.highlight && (
              <span className="self-start mb-3 inline-flex items-center px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.18em] surface-brass text-obsidian-950 font-bold">
                Komplett-Service
              </span>
            )}
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-brass-400 mb-1.5">
              {t.eyebrow}
            </div>
            <div className="font-display font-bold text-titanium-50 text-lg tracking-tight">
              {t.name}
            </div>
            <div className="mt-2 mb-1">
              <span className="font-mono text-base text-titanium-50">{t.price}</span>
              <span className="text-xs text-titanium-500 ml-2">· {t.period}</span>
            </div>
            <p className="text-sm text-titanium-400 leading-relaxed mt-3 mb-6 flex-1">
              {t.body}
            </p>
            <Link
              to={t.to}
              className={`inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-none transition-colors ${
                t.highlight
                  ? 'bg-brass-500 text-obsidian-950 hover:bg-brass-400'
                  : 'border border-titanium-700 text-titanium-100 hover:border-titanium-500'
              }`}
            >
              {t.cta} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-titanium-500 mt-6 max-w-xl mx-auto">
        Variable Rebuild-Pricing wird im Erstgespräch festgelegt. Stripe-Setup für direkten
        Self-Service-Checkout in Vorbereitung — siehe{' '}
        <Link to="/dsgvo-website" className="text-titanium-400 hover:text-titanium-200 underline-offset-4 hover:underline">
          /dsgvo-website
        </Link>
        .
      </p>
    </section>
  );
}
