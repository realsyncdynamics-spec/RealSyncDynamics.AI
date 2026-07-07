import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '../../features/supabase/SupabaseAuthContext';

type Sector = 'saas' | 'agency' | 'healthcare' | 'public_sector' | 'generic';

const SECTORS = [
  { id: 'saas' as Sector, label: 'SaaS / Tech Startup', description: 'Software-as-a-Service Produkte' },
  { id: 'agency' as Sector, label: 'Agentur', description: 'Marketing-, Web- oder Digital-Agentur' },
  { id: 'healthcare' as Sector, label: 'Healthcare', description: 'Medizin, Apotheken, Praxen' },
  { id: 'public_sector' as Sector, label: 'Öffentliche Einrichtung', description: 'Behörde, öffentliche Organisation' },
  { id: 'generic' as Sector, label: 'Sonstiges', description: 'Andere Branchen' },
];

const CONTEXT_QUESTIONS = [
  {
    id: 'team_size',
    label: 'Team-Größe',
    type: 'select' as const,
    options: ['1-5 Personen', '6-20 Personen', '21-100 Personen', '100+ Personen'],
  },
  {
    id: 'data_processing',
    label: 'Hauptsächlich verarbeitete Datentypen',
    type: 'select' as const,
    options: ['Kunden-Kontaktdaten', 'Sensible Gesundheitsdaten', 'Zahldaten', 'Nutzungsverhaltens-Daten'],
  },
  {
    id: 'ai_usage',
    label: 'Nutzen Sie KI-Systeme?',
    type: 'select' as const,
    options: ['Nein', 'Ja, intern', 'Ja, bei Anbietern'],
  },
];

export function PostRegisterOnboardingPage() {
  const navigate = useNavigate();
  const { user } = useSupabaseAuth();
  const [step, setStep] = useState<'sector' | 'questions' | 'success'>('sector');
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user) {
    navigate('/unified-entry/register');
    return null;
  }

  const handleSectorSelect = (sector: Sector) => {
    setSelectedSector(sector);
    setStep('questions');
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    setError('');

    if (!selectedSector) {
      setError('Bitte wählen Sie einen Sektor');
      return;
    }

    if (CONTEXT_QUESTIONS.length > 0 && Object.keys(answers).length < CONTEXT_QUESTIONS.length) {
      setError('Bitte beantworten Sie alle Fragen');
      return;
    }

    setLoading(true);

    try {
      // For now, just proceed to success page
      // In production, these would save to Supabase:
      // - company profile (sector, answers)
      // - create trial subscription (trial_start, trial_end = now + 14 days)
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="max-w-md mx-auto text-center space-y-6">
        <div className="text-5xl">🎉</div>
        <h1 className="text-3xl font-bold text-titanium-50">Willkommen!</h1>
        <p className="text-lg text-titanium-300">
          Ihr Governance-Dashboard ist bereit. <strong>14 Tage kostenlos.</strong>
        </p>
        <button
          onClick={() => navigate('/app/dashboard')}
          className="w-full px-6 py-3 bg-petrol-600 hover:bg-petrol-700 text-white font-medium rounded-lg transition-colors"
        >
          Zum Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-titanium-50">
          {step === 'sector' ? 'Wählen Sie Ihre Branche' : 'Ein paar Fragen'}
        </h1>
        <p className="text-titanium-300">
          {step === 'sector'
            ? 'Damit wir die Platform optimal an Ihre Bedürfnisse anpassen'
            : 'Damit wir die bestmöglichen Empfehlungen machen können'}
        </p>
      </div>

      {step === 'sector' ? (
        <div className="grid grid-cols-1 gap-3">
          {SECTORS.map((sector) => (
            <button
              key={sector.id}
              onClick={() => handleSectorSelect(sector.id)}
              className="p-4 text-left border border-titanium-700 rounded-lg hover:border-petrol-600 hover:bg-obsidian-800 transition-colors group"
            >
              <p className="font-medium text-titanium-50 group-hover:text-petrol-500">{sector.label}</p>
              <p className="text-sm text-titanium-400 mt-1">{sector.description}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {CONTEXT_QUESTIONS.map((question) => (
            <div key={question.id}>
              <label htmlFor={question.id} className="block text-sm font-medium text-titanium-200 mb-2">
                {question.label}
              </label>
              <select
                id={question.id}
                value={answers[question.id] || ''}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                className="w-full px-4 py-2 bg-obsidian-800 border border-titanium-700 rounded-lg text-titanium-50 focus:outline-none focus:border-petrol-600 disabled:opacity-50"
              >
                <option value="">— Bitte wählen —</option>
                {question.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {error && (
            <div className="px-4 py-3 bg-red-900/20 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-4 pt-6 border-t border-titanium-700">
            <button
              onClick={() => {
                setStep('sector');
                setSelectedSector(null);
              }}
              className="flex-1 px-6 py-2 bg-obsidian-700 hover:bg-obsidian-600 border border-titanium-600 text-titanium-200 font-medium rounded-lg transition-colors"
            >
              Zurück
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-6 py-2 bg-petrol-600 hover:bg-petrol-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Wird gespeichert...' : 'Weiter'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
