import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Palette, BarChart3, Users, CheckCircle2 } from 'lucide-react';
import { PublicNav } from '../layout/PublicNav';
import { PublicFooter } from '../layout/PublicFooter';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';

const FEATURES = [
  {
    icon: Building2,
    title: 'Multi-Tenant-Dashboard',
    description: 'Verwalten Sie alle Mandanten zentral — pro Kunde isolierte Daten, gemeinsame Steuerung.',
  },
  {
    icon: Palette,
    title: 'White-Label-Branding',
    description: 'Eigenes Logo, Farben und Domain — Ihre Kunden sehen Ihr Compliance-Produkt, nicht unseres.',
  },
  {
    icon: BarChart3,
    title: 'Konsolidierte Reports',
    description: 'Sammel-Reports über alle Mandanten oder einzeln pro Kunde — als PDF oder Live-Dashboard.',
  },
  {
    icon: Users,
    title: 'Team- & Rollenverwaltung',
    description: 'Feingranulare Rechte für Ihr Team und Ihre Kunden — von Read-Only bis Admin.',
  },
];

const STEPS = [
  'Workspace anlegen & White-Label-Branding konfigurieren',
  'Kunden als Mandanten einladen oder selbst anlegen',
  'Websites & KI-Systeme je Mandant erfassen',
  'Reports automatisiert an Kunden ausliefern',
];

export function AgenciesPage() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <PublicNav />

      {/* HERO */}
      <section className="border-b border-titanium-800 bg-puzzle-grid py-16 lg:py-24">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-8 lg:px-8">
          <div>
            <Badge icon={<Building2 className="h-3 w-3 text-security-400" />} className="mb-6">
              Agenturen & White Label
            </Badge>
            <h1 className="font-display text-4xl font-bold leading-tight text-titanium-50 sm:text-5xl">
              Compliance as a Service — unter Ihrer Marke
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-titanium-400 sm:text-lg">
              Bieten Sie Ihren Kunden DSGVO- und EU-AI-Act-Governance als eigenes Produkt an. Multi-Tenant-Architektur,
              White-Label-Branding und konsolidierte Reports — vollständig in der EU betrieben.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/contact-sales">
                <Button variant="primary" size="lg" className="w-full sm:w-auto">
                  Partnerschaft anfragen <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/os/pricing">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  Preise ansehen
                </Button>
              </Link>
            </div>
          </div>

          <Card className="p-5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-600">
              Beispiel: Agentur-Workspace
            </p>
            <div className="mt-4 space-y-2">
              {['Atelier Nord GmbH', 'NordWest Maschinenbau AG', 'Praxis Dr. Lindgren', 'GreenLogix Spedition'].map((tenant) => (
                <div
                  key={tenant}
                  className="flex items-center justify-between border border-titanium-800 bg-obsidian-800/60 px-3 py-2.5"
                >
                  <span className="text-sm text-titanium-200">{tenant}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-risk-passed">Aktiv</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* FEATURES */}
      <section className="border-b border-titanium-800 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-security-400">
              Für Agenturen gebaut
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold text-titanium-50 sm:text-4xl">
              Alles, was Sie für ein skalierbares Compliance-Angebot brauchen
            </h2>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="p-5">
                <span className="flex h-10 w-10 items-center justify-center border border-security-500/30 bg-security-500/10 text-security-400">
                  <feature.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-sm font-semibold text-titanium-50">{feature.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-titanium-400">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ONBOARDING STEPS */}
      <section className="border-b border-titanium-800 bg-obsidian-900/40 py-16 lg:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center font-display text-3xl font-bold text-titanium-50 sm:text-4xl">
            In vier Schritten live
          </h2>
          <ul className="mt-10 space-y-4">
            {STEPS.map((step, i) => (
              <li key={step} className="flex items-start gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-security-500/40 bg-security-500/10 font-mono text-xs font-semibold text-security-300">
                  {i + 1}
                </span>
                <span className="pt-1 text-sm text-titanium-300">{step}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <CheckCircle2 className="mx-auto h-8 w-8 text-risk-passed" />
          <h2 className="mt-4 font-display text-3xl font-bold text-titanium-50 sm:text-4xl">
            Werden Sie Compliance-Partner
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-titanium-400">
            Sprechen Sie mit unserem Partner-Team über Konditionen, White-Label-Setup und Onboarding für Ihre Kunden.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/contact-sales">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                Partnerschaft anfragen <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
