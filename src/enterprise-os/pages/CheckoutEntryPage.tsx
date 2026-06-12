import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Lock, CheckCircle2, MapPin } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { Button } from '../components/Button';
import { Card, CardHeader, CardBody } from '../components/Card';
import { PRICING_PLANS } from '../mock/data';

export function CheckoutEntryPage() {
  const [params] = useSearchParams();
  const [confirmed, setConfirmed] = useState(false);
  const planId = params.get('plan') ?? 'professional';
  const plan = PRICING_PLANS.find((p) => p.id === planId) ?? PRICING_PLANS[1];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmed(true);
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="border-b border-titanium-800">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/os"><Logo size={28} /></Link>
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
            <Lock className="h-3.5 w-3.5 text-security-400" /> Sichere Bestellung
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-16">
        {/* ORDER SUMMARY */}
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-security-400">
            Bestellübersicht
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold text-titanium-50 sm:text-3xl">
            Governance OS — Plan {plan.name}
          </h1>

          <Card className="mt-6">
            <CardHeader eyebrow="Plan" title={plan.name} subtitle={plan.description} />
            <CardBody>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-titanium-300">Monatlicher Preis</span>
                <span className="font-display text-xl font-bold text-titanium-50">
                  {plan.price} <span className="text-xs font-normal text-titanium-500">{plan.priceSuffix}</span>
                </span>
              </div>
              <ul className="mt-4 space-y-2 border-t border-titanium-800 pt-4">
                {plan.features.slice(0, 4).map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-titanium-300">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-risk-passed" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <div className="mt-4 flex items-center gap-2 border border-titanium-800 bg-obsidian-900/60 px-3 py-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-security-400" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
              Abrechnung & Hosting in der EU · DSGVO-konform
            </span>
          </div>
        </div>

        {/* PAYMENT FORM */}
        <div>
          {confirmed ? (
            <Card className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-risk-passed" />
              <p className="font-display text-lg font-semibold text-titanium-50">Bestellung erfasst</p>
              <p className="max-w-sm text-sm text-titanium-400">
                Dies ist eine Klick-Prototyp-Vorschau (Phase 2) — die echte Stripe-Checkout-Integration folgt in der
                Backend-Anbindung. Ihr Workspace wäre jetzt freigeschaltet.
              </p>
              <Link to="/os/app" className="mt-2 block w-full">
                <Button variant="primary" size="md" className="w-full">
                  Zum Dashboard <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Link>
            </Card>
          ) : (
            <Card className="p-5">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-600">
                Zahlungsdaten
              </p>
              <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
                <div>
                  <label className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
                    Karteninhaber
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Max Mustermann"
                    className="mt-2 w-full border border-titanium-800 bg-obsidian-900 px-3 py-2.5 text-sm text-titanium-100 placeholder-titanium-600 outline-none transition-colors focus:border-security-500"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
                    Kartennummer
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="4242 4242 4242 4242"
                    className="mt-2 w-full border border-titanium-800 bg-obsidian-900 px-3 py-2.5 text-sm text-titanium-100 placeholder-titanium-600 outline-none transition-colors focus:border-security-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
                      Ablauf
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="MM/JJ"
                      className="mt-2 w-full border border-titanium-800 bg-obsidian-900 px-3 py-2.5 text-sm text-titanium-100 placeholder-titanium-600 outline-none transition-colors focus:border-security-500"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
                      CVC
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="123"
                      className="mt-2 w-full border border-titanium-800 bg-obsidian-900 px-3 py-2.5 text-sm text-titanium-100 placeholder-titanium-600 outline-none transition-colors focus:border-security-500"
                    />
                  </div>
                </div>
                <Button type="submit" variant="primary" size="lg" className="mt-2 w-full">
                  Kostenlose Testphase starten <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
                <p className="text-center text-xs text-titanium-500">
                  Sie zahlen nichts während der 14-tägigen Testphase. Jederzeit kündbar.
                </p>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
