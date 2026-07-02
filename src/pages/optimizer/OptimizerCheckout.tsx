/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SEITE 8 — /optimizer/checkout  (Paket buchen)
 * Typ: ACTION. Zusammenfassung des gewählten Pakets + Abrechnungs-Toggle,
 * dann Übergabe an den **kanonischen** Checkout `/checkout/:planKey`
 * (echtes Stripe-Hosted-Checkout inkl. BGB-Consent). Kein Duplikat-Stack.
 *
 * Preis/Plan stammen aus der kanonischen Pricing-Config, damit an der
 * Kasse exakt derselbe Preis erscheint wie auf der Karte.
 */

import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ArrowRight, Info, ShieldCheck } from 'lucide-react';

import { OptimizerLayout } from './OptimizerLayout';
import { tierById } from '../../config/pricing';
import {
  optimizerTierById, isSelfServeCheckout, realPriceEur, type OptimizerTierId,
} from '../../lib/optimizer/tiers';
import { setPostCheckoutReturn } from '../../lib/optimizer/state';

type Billing = 'monthly' | 'yearly';

export function OptimizerCheckout() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tierId = params.get('tier') as OptimizerTierId | null;
  const [billing, setBilling] = useState<Billing>('monthly');

  const tier = useMemo(() => (tierId ? optimizerTierById(tierId) : undefined), [tierId]);
  const realTier = tier ? tierById(tier.planKey) : undefined;

  // Ungültiges / nicht self-service-fähiges Paket → zurück zur Übersicht.
  if (!tier || !realTier || tier.planKey === 'free' || !isSelfServeCheckout(tier.planKey)) {
    return (
      <OptimizerLayout
        step={5}
        pageType="action"
        backTo="/optimizer/pricing"
        metaTitle="Paket wählen — Cloud Code Optimizer"
        metaDescription="Wähle ein buchbares Paket."
      >
        <div className="text-center py-12">
          <Info className="h-8 w-8 text-titanium-500 mx-auto mb-4" aria-hidden />
          <h1 className="text-2xl font-display font-bold text-titanium-50 mb-2">Kein buchbares Paket gewählt</h1>
          <p className="text-titanium-400 mb-6">Bitte wähle ein Paket auf der Preisübersicht.</p>
          <button
            type="button"
            onClick={() => navigate('/optimizer/pricing')}
            className="inline-flex items-center gap-2 bg-security-500 hover:bg-security-400 text-white font-bold px-5 py-2.5 rounded-none transition-colors"
          >
            Zu den Paketen <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </OptimizerLayout>
    );
  }

  const monthly = realPriceEur(tier);

  return (
    <OptimizerLayout
      step={5}
      pageType="action"
      backTo="/optimizer/pricing"
      metaTitle={`${realTier.name} buchen — Cloud Code Optimizer`}
      metaDescription={`Aktiviere das Paket ${realTier.name} und schalte den vollständigen Optimizer frei.`}
    >
      <h1 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 tracking-tight mb-2">
        Paket aktivieren — {realTier.name}
      </h1>
      <p className="text-titanium-400 mb-8">
        Marketing-Stufe <span className="text-titanium-200 font-semibold">{tier.name}</span> entspricht
        dem <span className="text-titanium-200 font-semibold">{realTier.name}</span>-Plan.
      </p>

      {/* Abrechnungs-Toggle */}
      <div className="inline-flex border border-titanium-900 rounded-none mb-6 overflow-hidden" role="group" aria-label="Abrechnungszeitraum">
        {(['monthly', 'yearly'] as Billing[]).map((b) => (
          <button
            key={b}
            type="button"
            aria-pressed={billing === b}
            onClick={() => setBilling(b)}
            className={
              'px-4 py-2 text-sm font-bold transition-colors ' +
              (billing === b ? 'bg-obsidian-800 text-titanium-50' : 'bg-obsidian-900 text-titanium-400 hover:text-titanium-200')
            }
          >
            {b === 'monthly' ? 'Monatlich' : 'Jährlich'}
          </button>
        ))}
      </div>

      {/* Zusammenfassung */}
      <div className="border border-titanium-900 bg-obsidian-900 rounded-none p-6 mb-6">
        <div className="flex items-baseline justify-between mb-4">
          <span className="font-display font-bold text-titanium-50">{realTier.name}</span>
          <span className="font-mono text-2xl text-titanium-50 tabular-nums">€{monthly}<span className="text-sm text-titanium-500"> / Monat</span></span>
        </div>
        <ul className="space-y-2">
          <li className="flex items-start gap-2 text-sm text-titanium-300">
            <Check className="h-4 w-4 text-petrol shrink-0 mt-0.5" aria-hidden /> {tier.optimizerFeature}
          </li>
          <li className="flex items-start gap-2 text-sm text-titanium-300">
            <Check className="h-4 w-4 text-petrol shrink-0 mt-0.5" aria-hidden /> Monatlich kündbar · keine Setup-Gebühren
          </li>
        </ul>

        {billing === 'yearly' && (
          <p className="mt-4 flex items-start gap-2 text-xs text-brass-300">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
            Jährliche Abrechnung folgt in Kürze — die Buchung startet vorerst monatlich.
          </p>
        )}
      </div>

      {/* Übergabe an kanonischen Checkout */}
      <button
        type="button"
        onClick={() => {
          // Nach erfolgreicher Zahlung zurück in den Optimizer-Flow.
          setPostCheckoutReturn('/optimizer/dashboard');
          navigate(`/checkout/${tier.planKey}`);
        }}
        className="inline-flex items-center gap-2 bg-security-500 hover:bg-security-400 text-white font-bold px-6 py-3 rounded-none transition-colors"
      >
        Weiter zur sicheren Zahlung <ArrowRight className="h-4 w-4" />
      </button>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-titanium-500">
        <ShieldCheck className="h-3.5 w-3.5 text-petrol" aria-hidden />
        Stripe-Hosted-Checkout · AGB &amp; Widerrufsbelehrung im nächsten Schritt.
      </p>
    </OptimizerLayout>
  );
}
