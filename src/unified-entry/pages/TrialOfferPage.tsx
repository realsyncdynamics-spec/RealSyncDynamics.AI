import { useNavigate } from 'react-router-dom';

export function TrialOfferPage() {
  const navigate = useNavigate();

  const features = [
    'Kontinuierliche Website- und Governance-Überwachung',
    'DSGVO- und EU-AI-Act-Prüfpfade',
    'Evidence & Audit Trail',
    'Governance-Dashboard und Reports',
    'AI Risk Assessment',
    'Automations- und Alert-Funktionen',
  ];

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="text-center space-y-4">
        <p className="text-sm font-medium text-petrol-500 uppercase tracking-wider">Growth</p>
        <h1 className="text-4xl font-bold text-titanium-50">14 Tage kostenlos testen</h1>
        <p className="text-xl text-titanium-300">Das Growth-Paket für 249 € pro Monat — die 14-Tage-Testphase gibt es ausschließlich für Growth.</p>
      </div>

      <div className="bg-obsidian-800 border border-petrol-600 rounded-lg p-6 space-y-4">
        <div className="flex items-baseline justify-between gap-6">
          <div><p className="text-sm text-titanium-400">Heute</p><p className="text-3xl font-bold text-petrol-500">0 €</p></div>
          <div className="text-right"><p className="text-sm text-titanium-400">Danach</p><p className="text-lg text-titanium-200">249 € / Monat</p></div>
        </div>
        <div className="text-sm text-titanium-400 pt-4 border-t border-titanium-700">
          ✓ 14 Tage Growth kostenlos<br />
          ✓ Keine Testphase bei anderen Paketen<br />
          ✓ Nach dem Test regulärer Growth-Tarif
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-titanium-50">Was Sie bekommen:</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((feature) => (
            <div key={feature} className="bg-obsidian-900 border border-titanium-800 rounded-lg p-4">
              <p className="font-medium text-titanium-100">{feature}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-6 border-t border-titanium-700">
        <button onClick={() => navigate('/unified-entry/register?plan=growth')} className="px-6 py-3 bg-petrol-600 hover:bg-petrol-700 text-white font-medium rounded-lg transition-colors text-center">
          Growth 14 Tage kostenlos starten
        </button>
        <button onClick={() => navigate('/unified-entry/preview')} className="px-6 py-3 bg-obsidian-700 hover:bg-obsidian-600 border border-titanium-600 text-titanium-200 font-medium rounded-lg transition-colors text-center">
          Zurück zur Preview
        </button>
      </div>
    </div>
  );
}
