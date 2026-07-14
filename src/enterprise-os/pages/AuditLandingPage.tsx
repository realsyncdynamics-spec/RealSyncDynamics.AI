import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ScanSearch, ShieldCheck, FileBarChart, Search } from 'lucide-react';
import { PublicNav } from '../layout/PublicNav';
import { PublicFooter } from '../layout/PublicFooter';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { RiskCard } from '../components/RiskCard';
import { RISKS } from '../mock/data';

const STEPS = [
  {
    icon: Search,
    title: '1. URL eingeben',
    description: 'Geben Sie die Domain Ihrer Website ein — der Scan startet automatisch, ohne Installation.',
  },
  {
    icon: ScanSearch,
    title: '2. Automatischer Scan',
    description: 'Cookies, Tracker, Drittanbieter-Skripte und Datenschutzerklärung werden geprüft.',
  },
  {
    icon: FileBarChart,
    title: '3. Sofortiger Befund',
    description: 'Sie erhalten priorisierte Findings mit Rechtsgrundlage — als Basis für Ihr Governance OS.',
  },
];

export function AuditLandingPage() {
  const [url, setUrl] = useState('');
  const [showResult, setShowResult] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setShowResult(true);
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <PublicNav />

      {/* HERO */}
      <section className="border-b border-titanium-800 bg-puzzle-grid py-16 lg:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <Badge icon={<ShieldCheck className="h-3 w-3 text-security-400" />} className="mb-6">
            Kostenloser DSGVO-Schnellcheck
          </Badge>
          <h1 className="font-display text-4xl font-bold leading-tight text-titanium-50 sm:text-5xl">
            Wie compliant ist Ihre Website wirklich?
          </h1>
          <p className="mt-5 text-base leading-relaxed text-titanium-400 sm:text-lg">
            In Sekunden prüfen wir Cookies, Tracker und Drittanbieter-Verbindungen Ihrer Website auf DSGVO- und
            TDDDG-Konformität — kostenlos und ohne Anmeldung.
          </p>

          <form onSubmit={handleSubmit} className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="ihre-website.de"
              className="flex-1 border border-titanium-800 bg-obsidian-900 px-4 py-3 text-sm text-titanium-100 placeholder-titanium-600 outline-none transition-colors focus:border-security-500"
            />
            <Button type="submit" variant="primary" size="lg">
              Jetzt prüfen <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      </section>

      {/* RESULT PREVIEW */}
      {showResult && (
        <section className="border-b border-titanium-800 py-12">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <Card className="p-5">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-600">
                Beispiel-Befund für „{url}“
              </p>
              <p className="mt-2 text-xs text-titanium-500">
                Dies ist eine Beispiel-Ausgabe mit Mock-Daten (Klick-Prototyp, Phase 2). Der echte Scan-Lauf wird über
                die Edge Functions ausgeführt.
              </p>
              <div className="mt-4 space-y-3">
                {RISKS.slice(0, 3).map((risk) => (
                  <RiskCard key={risk.id} risk={risk} />
                ))}
              </div>
              <Link to="/os/pricing" className="mt-5 block">
                <Button variant="primary" size="md" className="w-full sm:w-auto">
                  Vollständigen Bericht im Governance OS ansehen <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Link>
            </Card>
          </div>
        </section>
      )}

      {/* HOW IT WORKS */}
      <section className="border-b border-titanium-800 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-security-400">So funktioniert's</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-titanium-50 sm:text-4xl">
              Vom Schnappschuss zum Governance OS
            </h2>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {STEPS.map((step) => (
              <Card key={step.title} className="p-5">
                <span className="flex h-10 w-10 items-center justify-center border border-security-500/30 bg-security-500/10 text-security-400">
                  <step.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-sm font-semibold text-titanium-50">{step.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-titanium-400">{step.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-titanium-50 sm:text-4xl">
            Vom einmaligen Check zum kontinuierlichen Monitoring
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-titanium-400">
            Der kostenlose Check ist der erste Schritt. Mit dem Governance OS überwachen wir Ihre Website
            kontinuierlich und dokumentieren jeden Befund revisionssicher.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/os/pricing">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                14 Tage kostenlos starten <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/os/app">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                Plattform live ansehen
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
