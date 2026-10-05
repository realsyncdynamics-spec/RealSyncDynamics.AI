import { useNavigate } from 'react-router-dom';
import { formatPriceEur, planById } from '@/shared/pricing';

/**
 * Angebotsseite nach dem Scan — seit E-F6 (`.claude/os-funnel/PLAN.md`) das
 * dauerhaft kostenlose Konto, nicht mehr die Growth-Testphase. Der Kunde
 * soll sich in Ruhe mit der Plattform vertraut machen; Growth-Testphase und
 * Starter sind Upgrades aus dem Dashboard.
 */
export function TrialOfferPage() {
  const navigate = useNavigate();
  const starter = planById('starter');
  const growth = planById('growth');

  const included = [
    'Domain-Scan mit Governance Score 0–100',
    'Top-Risiken mit Paragraphenbezug (DSGVO, EU AI Act)',
    'Audit Center mit einsehbarem Prüfpfad',
    'Kompakter PDF-Bericht',
    'Governance-Dashboard zum Kennenlernen',
    `Upgrade jederzeit — Growth ${growth.trialDays} Tage testen, ohne Karte`,
  ];

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-petrol-500 uppercase tracking-wider">Kostenloses Konto</p>
        <h1 className="text-4xl font-bold text-titanium-50">Dauerhaft kostenlos. Kein Zeitdruck.</h1>
        <p className="text-xl text-titanium-300">
          Legen Sie Ihr Konto an und machen Sie sich in Ruhe mit der Plattform vertraut.
          Der einfache Scan bleibt kostenlos — ohne Karte, ohne Ablaufdatum.
        </p>
      </div>

      <div className="bg-obsidian-800 border border-petrol-600 rounded-lg p-6 space-y-4">
        <div className="flex items-baseline justify-between gap-6">
          <div><p className="text-sm text-titanium-400">Heute</p><p className="text-3xl font-bold text-petrol-500">0 €</p></div>
          <div className="text-right"><p className="text-sm text-titanium-400">Danach</p><p className="text-lg text-titanium-200">0 € — bleibt kostenlos</p></div>
        </div>
        <div className="text-sm text-titanium-400 pt-4 border-t border-titanium-700">
          ✓ Keine Karte, keine Testphase, kein Abo<br />
          ✓ Growth {growth.trialDays} Tage kostenlos testen — jederzeit aus dem Dashboard<br />
          ✓ Starter ab {formatPriceEur(starter.price.monthlyEur)} / Monat, monatlich kündbar
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-titanium-50">Was Sie bekommen:</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {included.map((item) => (
            <div key={item} className="bg-obsidian-900 border border-titanium-800 rounded-lg p-4">
              <p className="font-medium text-titanium-100">{item}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-6 border-t border-titanium-700">
        <button onClick={() => navigate('/unified-entry/register')} className="px-6 py-3 bg-petrol-600 hover:bg-petrol-700 text-white font-medium rounded-lg transition-colors text-center">
          Kostenloses Konto anlegen
        </button>
        <button onClick={() => navigate('/unified-entry/preview')} className="px-6 py-3 bg-obsidian-700 hover:bg-obsidian-600 border border-titanium-600 text-titanium-200 font-medium rounded-lg transition-colors text-center">
          Zurück zur Preview
        </button>
      </div>
    </div>
  );
}
