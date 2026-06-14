import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Lock, MapPin, CheckCircle2 } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

interface AuthPageProps {
  mode: 'login' | 'signup';
}

const TRUST_POINTS = [
  { icon: MapPin, label: 'Hosting & Betrieb in der EU' },
  { icon: ShieldCheck, label: 'DSGVO-konform by Design' },
  { icon: Lock, label: 'EU AI Act Ready' },
];

export function AuthPage({ mode }: AuthPageProps) {
  const [submitted, setSubmitted] = useState(false);
  const isSignup = mode === 'signup';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="grid min-h-screen grid-cols-1 bg-obsidian-950 text-titanium-100 lg:grid-cols-2">
      {/* FORM SIDE */}
      <div className="flex flex-col px-4 py-10 sm:px-6 lg:px-12 lg:py-12">
        <Link to="/os" className="shrink-0">
          <Logo size={28} />
        </Link>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-security-400">
            {isSignup ? 'Konto erstellen' : 'Willkommen zurück'}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-titanium-50">
            {isSignup ? 'Governance OS starten' : 'Bei RealSync Dynamics AI anmelden'}
          </h1>
          <p className="mt-3 text-sm text-titanium-400">
            {isSignup
              ? 'Erstellen Sie Ihren Workspace und starten Sie Ihre 14-tägige kostenlose Testphase — ohne Kreditkarte.'
              : 'Melden Sie sich an, um Ihr Governance-OS-Dashboard zu öffnen.'}
          </p>

          {submitted ? (
            <Card className="mt-8 flex flex-col items-center gap-3 p-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-risk-passed" />
              <p className="font-display text-sm font-semibold text-titanium-50">
                {isSignup ? 'Konto-Anfrage übermittelt' : 'Anmeldung übermittelt'}
              </p>
              <p className="text-xs text-titanium-400">
                Dies ist eine Klick-Prototyp-Vorschau (Phase 2) — eine echte Authentifizierung folgt mit der
                Supabase-Integration. Schauen Sie sich in der Zwischenzeit das Dashboard an.
              </p>
              <Link to="/os/app" className="mt-2 block w-full">
                <Button variant="primary" size="md" className="w-full">
                  Zum Dashboard <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Link>
            </Card>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
              {isSignup && (
                <div>
                  <label className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
                    Unternehmen
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Atelier Nord GmbH"
                    className="mt-2 w-full border border-titanium-800 bg-obsidian-900 px-3 py-2.5 text-sm text-titanium-100 placeholder-titanium-600 outline-none transition-colors focus:border-security-500"
                  />
                </div>
              )}
              <div>
                <label className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
                  E-Mail
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@unternehmen.de"
                  className="mt-2 w-full border border-titanium-800 bg-obsidian-900 px-3 py-2.5 text-sm text-titanium-100 placeholder-titanium-600 outline-none transition-colors focus:border-security-500"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-500">
                  Passwort
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="mt-2 w-full border border-titanium-800 bg-obsidian-900 px-3 py-2.5 text-sm text-titanium-100 placeholder-titanium-600 outline-none transition-colors focus:border-security-500"
                />
              </div>

              <Button type="submit" variant="primary" size="lg" className="mt-2 w-full">
                {isSignup ? '14 Tage kostenlos starten' : 'Anmelden'} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>

              <p className="text-center text-xs text-titanium-500">
                {isSignup ? (
                  <>
                    Bereits registriert?{' '}
                    <Link to="/os/login" className="text-security-400 hover:text-security-300">
                      Anmelden
                    </Link>
                  </>
                ) : (
                  <>
                    Noch kein Konto?{' '}
                    <Link to="/os/signup" className="text-security-400 hover:text-security-300">
                      14 Tage kostenlos testen
                    </Link>
                  </>
                )}
              </p>
            </form>
          )}
        </div>

        <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-600">
          © {new Date().getFullYear()} RealSync Dynamics.AI
        </p>
      </div>

      {/* BRAND SIDE */}
      <div className="relative hidden overflow-hidden border-l border-titanium-800 bg-obsidian-900 lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="absolute -right-20 -top-20 h-72 w-72 bg-security-500/10 blur-3xl" />
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-security-400">
          Governance OS Browser
        </p>
        <h2 className="mt-3 max-w-md font-display text-3xl font-bold leading-tight text-titanium-50">
          Compliance, die mitdenkt — nicht nur dokumentiert.
        </h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-titanium-400">
          DSGVO, EU AI Act und Website-Compliance in einem kontinuierlichen Betriebssystem — mit Risk Graph,
          Evidence Vault und autonomen Compliance-Agenten.
        </p>
        <div className="mt-10 flex flex-col gap-3">
          {TRUST_POINTS.map((point) => (
            <div key={point.label} className="flex items-center gap-3 border border-titanium-800 bg-obsidian-800/60 px-4 py-3">
              <point.icon className="h-4 w-4 shrink-0 text-security-400" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-titanium-400">{point.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
