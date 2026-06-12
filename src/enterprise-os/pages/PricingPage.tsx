import React from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import { PublicNav } from '../layout/PublicNav';
import { PublicFooter } from '../layout/PublicFooter';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { PRICING_PLANS, PRICING_FAQ } from '../mock/data';

export function PricingPage() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <PublicNav />

      {/* HERO */}
      <section className="border-b border-titanium-800 py-16 lg:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <Badge className="mb-6">Pricing</Badge>
          <h1 className="font-display text-4xl font-bold leading-tight text-titanium-50 sm:text-5xl">
            Transparente Preise für Ihr Governance OS
          </h1>
          <p className="mt-5 text-base leading-relaxed text-titanium-400 sm:text-lg">
            Starten Sie kostenlos, wachsen Sie ohne Überraschungen. Alle Pläne beinhalten Hosting & Betrieb in der EU.
          </p>
        </div>
      </section>

      {/* PLANS */}
      <section className="border-b border-titanium-800 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {PRICING_PLANS.map((plan) => (
              <Card
                key={plan.id}
                className={`flex flex-col p-6 ${
                  plan.highlighted ? 'border-security-500 bg-security-500/5' : ''
                }`}
              >
                {plan.highlighted && (
                  <Badge className="mb-4 self-start border-security-500/40 bg-security-500/10 text-security-300">
                    Beliebteste Wahl
                  </Badge>
                )}
                <h3 className="font-display text-lg font-semibold text-titanium-50">{plan.name}</h3>
                <p className="mt-2 text-sm text-titanium-400">{plan.description}</p>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="font-display text-3xl font-bold text-titanium-50">{plan.price}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">{plan.priceSuffix}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-titanium-300">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-risk-passed" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link to={plan.id === 'enterprise' ? '/contact-sales' : '/os/checkout?plan=' + plan.id} className="mt-8 block">
                  <Button variant={plan.highlighted ? 'primary' : 'secondary'} size="md" className="w-full">
                    {plan.cta} {plan.id !== 'enterprise' && <ArrowRight className="ml-1.5 h-3.5 w-3.5" />}
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 lg:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center font-display text-3xl font-bold text-titanium-50 sm:text-4xl">
            Häufige Fragen
          </h2>
          <div className="mt-10 space-y-3">
            {PRICING_FAQ.map((item) => (
              <details key={item.q} className="group border border-titanium-800 bg-obsidian-800/60 p-4">
                <summary className="cursor-pointer font-display text-sm font-semibold text-titanium-50 [&::-webkit-details-marker]:hidden">
                  {item.q}
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-titanium-400">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
