import { Link } from 'react-router-dom';
import { ArrowRight, Search, Wrench, Activity } from 'lucide-react';

type Step = {
  n: number;
  icon: React.ReactNode;
  badge: string;
  title: string;
  body: string;
};

const steps: Step[] = [
  {
    n: 1,
    icon: <Search className="h-4 w-4 text-security-400" />,
    badge: 'Schritt 1 · Audit',
    title: 'Sie geben nur Ihre Domain ein.',
    body: 'Unser System prüft Ihre Website automatisch auf DSGVO-, TTDSG- und Security-Risiken — Tracker, Cookies, Schriften, Header. PDF-Report mit Paragraphen-Bezug.',
  },
  {
    n: 2,
    icon: <Wrench className="h-4 w-4 text-amber-400" />,
    badge: 'Schritt 2 · Automatischer Neuaufbau',
    title: 'Wir bauen Ihre Site sauber neu.',
    body: 'Auf Basis Ihrer bestehenden Inhalte: EU-Hosting, lokales Consent-Management, Security-Header, Performance — bereits beim Launch konform.',
  },
  {
    n: 3,
    icon: <Activity className="h-4 w-4 text-fuchsia-400" />,
    badge: 'Schritt 3 · Laufender Betrieb',
    title: 'Wir betreiben sie für Sie.',
    body: 'Updates, halbjährliche Re-Audits, Anpassungen bei Gesetzesänderungen, Monitoring — automatisiert im Hintergrund. Audit-Reports für Ihre Unterlagen inklusive.',
  },
];

export function ThreeStepDsgvoSection() {
  return (
    <section
      id="managed-website"
      className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 border-t border-titanium-900 bg-obsidian-900/30"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500 mb-3">
            Website-as-a-Service
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-titanium-50 tracking-tight leading-tight">
            In 3 Schritten zur DSGVO-konformen Website — voll automatisch.
          </h2>
          <p className="mt-4 text-base text-titanium-400 max-w-2xl mx-auto leading-relaxed">
            Von der bestehenden Seite zur modernen, rechtssicheren EU-Website — ohne Agentur-Briefing, ohne manuelle Übergaben.
          </p>
        </div>

        <div className="grid gap-px bg-titanium-900 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.n} className="flex flex-col bg-obsidian-950 p-6 sm:p-7">
              <div className="flex items-center gap-2 mb-3">
                {step.icon}
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500 font-bold">
                  {step.badge}
                </span>
              </div>
              <h3 className="font-display font-bold text-titanium-50 text-lg mb-2 tracking-tight">
                {step.title}
              </h3>
              <p className="text-sm text-titanium-300 leading-relaxed flex-1">
                {step.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-2 justify-center items-center">
          <Link
            to="/dsgvo-website"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none transition-colors"
          >
            Automatischen Neuaufbau anfragen <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/audit?source=website-service"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none transition-colors"
          >
            Erst Quick-Scan starten
          </Link>
        </div>
      </div>
    </section>
  );
}
