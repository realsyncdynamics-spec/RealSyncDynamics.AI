import { useNavigate } from 'react-router-dom';
import { TrialTimer } from '../components/TrialTimer';

export function TrialOfferPage() {
  const navigate = useNavigate();

  const features = [
    {
      title: 'Vollständiger Governance Score',
      description: '8 Dimensionen: DSGVO, EU AI Act, Evidence, Monitoring und mehr',
    },
    {
      title: 'Automatische Compliance-Überwachung',
      description: 'Tägliche Scans und Benachrichtigungen bei neuen Problemen',
    },
    {
      title: 'Evidence & Audit Trail',
      description: 'Sichere Dokumentation aller Governance-Entscheidungen',
    },
    {
      title: 'Governance-Dashboard',
      description: 'Übersichtliche Darstellung aller Compliance-Metriken',
    },
    {
      title: 'AI Risk Assessment',
      description: 'Bewertung Ihrer KI-Systeme nach EU AI Act',
    },
    {
      title: 'Datenschutzerklärung Generator',
      description: 'Automatisch generierte, DSGVO-konforme Dokumentation',
    },
  ];

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4">
        <TrialTimer durationMinutes={30} />
        <h1 className="text-4xl font-bold text-titanium-50 mt-4">
          Möchten Sie 14 Tage kostenlos Zugriff erhalten?
        </h1>
        <p className="text-xl text-titanium-300">
          Nutzen Sie die volle Kraft unserer Governance-Platform ohne Zeitlimit oder Einschränkungen.
        </p>
      </div>

      {/* Trial Details */}
      <div className="bg-obsidian-800 border border-petrol-600 rounded-lg p-6 space-y-4">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-sm text-titanium-400">Kostenlos für</p>
            <p className="text-3xl font-bold text-petrol-500">14 Tage</p>
          </div>
          <div>
            <p className="text-sm text-titanium-400">Danach</p>
            <p className="text-lg text-titanium-200">
              Zahlen oder Abbruch — <br /> kein automatisches Abo
            </p>
          </div>
        </div>
        <div className="text-sm text-titanium-400 pt-4 border-t border-titanium-700">
          ✓ Kein Abo erforderlich <br />
          ✓ Jederzeit kündbar <br />
          ✓ Volle Funktionalität
        </div>
      </div>

      {/* Features Grid */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-titanium-50">Was Sie bekommen:</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((feature, i) => (
            <div
              key={i}
              className="bg-obsidian-900 border border-titanium-800 rounded-lg p-4 hover:border-petrol-600 transition-colors"
            >
              <p className="font-medium text-titanium-100">{feature.title}</p>
              <p className="text-sm text-titanium-400 mt-2">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Buttons */}
      <div className="flex flex-col gap-3 pt-6 border-t border-titanium-700">
        <button
          onClick={() => navigate('/unified-entry/register')}
          className="px-6 py-3 bg-petrol-600 hover:bg-petrol-700 text-white font-medium rounded-lg transition-colors text-center"
        >
          Ja, 14 Tage kostenlos starten
        </button>
        <button
          onClick={() => navigate('/unified-entry/preview')}
          className="px-6 py-3 bg-obsidian-700 hover:bg-obsidian-600 border border-titanium-600 text-titanium-200 font-medium rounded-lg transition-colors text-center"
        >
          Zurück zur Preview
        </button>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 text-titanium-400 hover:text-titanium-200 transition-colors text-center text-sm"
        >
          Nicht jetzt, danke
        </button>
      </div>
    </div>
  );
}
