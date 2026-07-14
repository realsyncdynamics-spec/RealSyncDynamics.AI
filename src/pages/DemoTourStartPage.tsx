/**
 * DemoTourStartPage — Einstieg zur Produkt-Tour ohne Anmeldung
 *
 * Zeigt:
 * - Hero mit "Kostenlose Produkt-Tour"
 * - Was der Nutzer sieht (Dashboard, Governance, Compliance)
 * - CTA: "Tour starten" → /demo-tour/signup
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  BarChart3,
  Shield,
  Zap,
} from 'lucide-react';
import { LandingNavbar } from '../components/LandingNavbar';
import { useDemoTour } from '../core/demo/DemoTourContext';

export function DemoTourStartPage() {
  const navigate = useNavigate();
  const { setTourStep } = useDemoTour();

  const handleStartTour = () => {
    setTourStep('signup');
    navigate('/demo-tour/signup');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <LandingNavbar />

      {/* Hero */}
      <section className="pt-20 pb-12 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            Erkunden Sie Governance OS
            <br />
            <span className="text-petrol-700">Kostenlos, ohne Registrierung</span>
          </h1>
          <p className="text-lg text-slate-600 mb-8 max-w-xl mx-auto">
            Sehen Sie, wie Governance OS Ihre AI-Systeme, Datenschutz und regulatorische
            Compliance in einem Dashboard vereint. Interaktive Tour mit allen Features.
          </p>

          <button
            onClick={handleStartTour}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-petrol-700 hover:bg-petrol-800 text-white font-semibold rounded-lg transition-colors text-lg"
          >
            Tour starten <ArrowRight className="w-5 h-5" />
          </button>

          <p className="text-sm text-slate-500 mt-4">
            ~ 5 Minuten Dauer • Keine Anmeldung nötig
          </p>
        </div>
      </section>

      {/* What you'll see */}
      <section className="py-12 px-4 sm:px-6 bg-white/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">
            Das sehen Sie in der Tour:
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 bg-white rounded-lg border border-slate-200">
              <div className="w-12 h-12 bg-petrol-100 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-petrol-700" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Governance Dashboard</h3>
              <p className="text-sm text-slate-600">
                Übersicht über AI-Systeme, Compliance-Status und Governance-Score in Echtzeit.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 bg-white rounded-lg border border-slate-200">
              <div className="w-12 h-12 bg-petrol-100 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-petrol-700" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Compliance-Tracking</h3>
              <p className="text-sm text-slate-600">
                DSGVO & AI Act Compliance automatisch überwacht und dokumentiert.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 bg-white rounded-lg border border-slate-200">
              <div className="w-12 h-12 bg-petrol-100 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-petrol-700" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Workflow-Automation</h3>
              <p className="text-sm text-slate-600">
                Automatisierte Risk-Checks, Reports und Alerting im Dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-12 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            Warum eine Tour machen?
          </h2>

          <div className="space-y-3">
            {[
              'Alle Features live in Aktion sehen',
              'Governance-Score und Risk-Management verstehen',
              'Compliance-Automation in Echtzeit erleben',
              'Keine Registrierung oder Zahlungsinfo nötig',
              'Sofort nach der Tour zum Echtzugang wechseln',
            ].map((benefit) => (
              <div key={benefit} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-petrol-700 mt-0.5 shrink-0" />
                <span className="text-slate-700">{benefit}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleStartTour}
            className="mt-8 w-full py-3 bg-petrol-700 hover:bg-petrol-800 text-white font-semibold rounded-lg transition-colors"
          >
            Jetzt Tour starten
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 px-4 text-center text-sm text-slate-600">
        <p>
          EU-souveräne SaaS für Governance, Compliance & AI Governance OS
        </p>
      </footer>
    </div>
  );
}
