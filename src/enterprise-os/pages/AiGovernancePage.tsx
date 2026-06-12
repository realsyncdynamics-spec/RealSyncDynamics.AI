import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Cpu, ShieldCheck, ScrollText } from 'lucide-react';
import { PublicNav } from '../layout/PublicNav';
import { PublicFooter } from '../layout/PublicFooter';
import { Button } from '../components/Button';
import { Badge, StatusBadge } from '../components/Badge';
import { Card, CardHeader, CardBody } from '../components/Card';
import { AI_RISK_CLASSES, AI_USE_CASES } from '../mock/data';

export function AiGovernancePage() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <PublicNav />

      {/* HERO */}
      <section className="border-b border-titanium-800 bg-puzzle-grid py-16 lg:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <Badge icon={<Cpu className="h-3 w-3 text-security-400" />} className="mb-6">
            EU AI Act Governance
          </Badge>
          <h1 className="font-display text-4xl font-bold leading-tight text-titanium-50 sm:text-5xl">
            Jedes KI-System. Klassifiziert. Überwacht. Belegt.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-titanium-400 sm:text-lg">
            Der EU AI Act verlangt eine Risikoklassifizierung für jedes eingesetzte KI-System. Die AI Use Case
            Registry erfasst, klassifiziert und überwacht Ihre KI-Systeme kontinuierlich.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/os/pricing">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                14 Tage kostenlos starten <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/os/app/ai-usecases">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                Registry live ansehen
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* RISK CLASSES */}
      <section className="border-b border-titanium-800 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-security-400">
              Risikoklassen nach EU AI Act
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold text-titanium-50 sm:text-4xl">
              Vier Stufen — eine Registry
            </h2>
            <p className="mt-4 text-base text-titanium-400">
              Jedes KI-System wird automatisch einer Risikoklasse zugeordnet, inklusive der daraus folgenden Pflichten.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AI_RISK_CLASSES.map((cls) => (
              <Card key={cls.id} className="flex flex-col p-5">
                <StatusBadge level={cls.badge} className="self-start" />
                <h3 className="mt-4 font-display text-sm font-semibold text-titanium-50">{cls.name}</h3>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-titanium-400">{cls.description}</p>
                <div className="mt-4 border-t border-titanium-800 pt-3">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-600">Beispiele</p>
                  <p className="mt-1 text-xs text-titanium-400">{cls.examples.join(' · ')}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* REGISTRY PREVIEW */}
      <section className="border-b border-titanium-800 bg-obsidian-900/40 py-16 lg:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-security-400">
              Live-Vorschau
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold text-titanium-50 sm:text-4xl">
              AI Use Case Registry
            </h2>
          </div>

          <Card className="mt-10">
            <CardHeader
              eyebrow="Beispiel-Mandant"
              title="Atelier Nord GmbH"
              subtitle="4 erfasste KI-Systeme"
              action={<ScrollText className="h-4 w-4 text-titanium-600" />}
            />
            <CardBody className="space-y-3">
              {AI_USE_CASES.map((uc) => (
                <div
                  key={uc.id}
                  className="flex flex-col gap-2 border border-titanium-800 bg-obsidian-800/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-display text-sm font-semibold text-titanium-50">{uc.name}</p>
                    <p className="mt-1 text-xs text-titanium-400">{uc.purpose}</p>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                    <span>{uc.owner}</span>
                    <span className="text-titanium-700">·</span>
                    <span>Risiko: {uc.riskClass}</span>
                    <StatusBadge level={uc.status} />
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <ShieldCheck className="mx-auto h-8 w-8 text-security-400" />
          <h2 className="mt-4 font-display text-3xl font-bold text-titanium-50 sm:text-4xl">
            Bereit für die EU-AI-Act-Pflichten ab August 2026?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-titanium-400">
            Erfassen Sie alle KI-Systeme Ihres Unternehmens zentral — inklusive Risikoklassifizierung,
            Dokumentation und kontinuierlicher Überwachung.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/os/pricing">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                14 Tage kostenlos starten <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
