import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSupabaseAuth } from '../../features/supabase/SupabaseAuthContext';
import { useTenant } from '../../core/access/TenantProvider';
import { postEdgeFunction } from '../../lib/edgeFunction';
import { isEdgeFunctionInProduction } from '../../config/production-edge-functions';
import { claimPendingScan } from '../../lib/scanClaim';

/**
 * Die beiden Functions, die diesen Schritt tragen.
 *
 * Bewusst wird zuerst aufgerufen und erst der Fehlschlag erklärt: Wäre die
 * Verfügbarkeit vorab aus der Liste abgeleitet, würde ein Nutzer auch dann
 * blockiert, wenn das Backend längst nachgezogen und nur die Liste nicht
 * gepflegt wurde. Messung darf erklaeren, nicht verhindern.
 */
const SETUP_FUNCTIONS = ['save-company-profile', 'create-trial-subscription'] as const;

type Sector = 'saas' | 'agency' | 'healthcare' | 'public_sector' | 'generic';

const SECTORS = [
  { id: 'saas' as Sector, label: 'SaaS / Tech Startup', description: 'Software-as-a-Service Produkte' },
  { id: 'agency' as Sector, label: 'Agentur', description: 'Marketing-, Web- oder Digital-Agentur' },
  { id: 'healthcare' as Sector, label: 'Healthcare', description: 'Medizin, Apotheken, Praxen' },
  { id: 'public_sector' as Sector, label: 'Öffentliche Einrichtung', description: 'Behörde, öffentliche Organisation' },
  { id: 'generic' as Sector, label: 'Sonstiges', description: 'Andere Branchen' },
];

const CONTEXT_QUESTIONS = [
  { id: 'team_size', label: 'Team-Größe', options: ['1-5 Personen', '6-20 Personen', '21-100 Personen', '100+ Personen'] },
  { id: 'data_processing', label: 'Hauptsächlich verarbeitete Datentypen', options: ['Kunden-Kontaktdaten', 'Sensible Gesundheitsdaten', 'Zahldaten', 'Nutzungsverhaltens-Daten'] },
  { id: 'ai_usage', label: 'Nutzen Sie KI-Systeme?', options: ['Nein', 'Ja, intern', 'Ja, bei Anbietern'] },
];

export function PostRegisterOnboardingPage() {
  const navigate = useNavigate();
  const { user } = useSupabaseAuth();
  const { activeTenantId } = useTenant();
  const [step, setStep] = useState<'sector' | 'questions' | 'success' | 'incomplete'>('sector');
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();

  // Übernahme des kostenlosen Scans, sobald ein Konto besteht.
  //
  // Bewusst hier und nicht im Absenden-Pfad: Der Mandant existiert bereits
  // mit der Registrierung, und die Zuordnung soll auch dann gelingen, wenn
  // der Nutzer die Branchenfragen abbricht. Der Aufruf blockiert nichts und
  // meldet nichts — schlägt er fehl, bleibt das Konto unberührt und der Scan
  // in der Sitzung, wo ihn ein späterer Versuch noch einlösen kann.
  const claimVersucht = useRef(false);
  useEffect(() => {
    if (!user || claimVersucht.current) return;
    claimVersucht.current = true;
    void claimPendingScan(searchParams.get('scan'));
  }, [user, searchParams]);

  if (!user) {
    navigate('/unified-entry/register');
    return null;
  }

  const handleSubmit = async () => {
    setError('');
    if (!selectedSector) { setError('Bitte wählen Sie einen Sektor'); return; }
    if (Object.keys(answers).length < CONTEXT_QUESTIONS.length) { setError('Bitte beantworten Sie alle Fragen'); return; }

    setLoading(true);
    try {
      // `tenantId` mitschicken, wenn der Kontext ihn schon kennt: Gehört der
      // Nutzer zu mehreren Arbeitsbereichen, kann die Function ihn nicht
      // erraten und antwortet mit TENANT_AMBIGUOUS. Fehlt er, löst sie ihn
      // über `memberships` auf — der frische Registrierungsfall.
      const tenant = activeTenantId ? { tenantId: activeTenantId } : {};
      await postEdgeFunction('save-company-profile', { sector: selectedSector, answers, ...tenant });
      await postEdgeFunction('create-trial-subscription', { planKey: 'growth', ...tenant });
      setStep('success');
    } catch (err) {
      // Der Fehlschlag hat zwei sehr verschiedene Ursachen, und der Unterschied
      // gehört dem Nutzer gesagt: Ist die Function gar nicht deployt, hilft
      // kein zweiter Versuch — das Konto besteht, nur die Einrichtung fehlt.
      // Alles andere kann vorübergehend sein und bleibt ein Wiederholungsfall.
      const backendMissing = SETUP_FUNCTIONS.some((fn) => !isEdgeFunctionInProduction(fn));
      if (backendMissing) {
        setStep('incomplete');
      } else {
        setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
      }
    } finally {
      setLoading(false);
    }
  };

  // Kein „Growth ist bereit", wenn kein Growth angelegt wurde. Die Seite hat
  // an dieser Stelle bislang einen rohen HTTP-Fehler gezeigt und den Nutzer
  // stehen lassen — Konto vorhanden, kein Weg weiter, keine Erklärung.
  if (step === 'incomplete') {
    return (
      <div className="max-w-md mx-auto text-center space-y-6">
        <h1 className="text-3xl font-bold text-titanium-50">Ihr Konto steht.</h1>
        <p className="text-lg text-titanium-300">
          Die automatische Einrichtung von Branche und Testphase konnten wir gerade nicht
          abschließen. Ihre Registrierung ist davon nicht betroffen — Sie sind angemeldet.
        </p>
        <p className="text-sm text-titanium-400">
          Wir richten den Growth-Testzeitraum manuell ein. Bis dahin steht Ihnen das
          Dashboard offen.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/app/dashboard')}
            className="w-full px-6 py-3 bg-petrol-600 hover:bg-petrol-700 text-white font-medium rounded-lg transition-colors"
          >
            Zum Dashboard
          </button>
          <button
            onClick={() => navigate('/contact-sales?source=onboarding-incomplete')}
            className="w-full px-6 py-3 bg-obsidian-700 hover:bg-obsidian-600 border border-titanium-600 text-titanium-200 font-medium rounded-lg transition-colors"
          >
            Einrichtung anfordern
          </button>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="max-w-md mx-auto text-center space-y-6">
        <div className="text-5xl">🎉</div>
        <h1 className="text-3xl font-bold text-titanium-50">Growth ist bereit.</h1>
        <p className="text-lg text-titanium-300"><strong>14 Tage kostenlos</strong>, danach 249 € / Monat.</p>
        <button onClick={() => navigate('/app/dashboard')} className="w-full px-6 py-3 bg-petrol-600 hover:bg-petrol-700 text-white font-medium rounded-lg transition-colors">Zum Dashboard</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-titanium-50">{step === 'sector' ? 'Wählen Sie Ihre Branche' : 'Ein paar Fragen'}</h1>
        <p className="text-titanium-300">{step === 'sector' ? 'Damit wir die Plattform optimal an Ihre Bedürfnisse anpassen.' : 'Damit wir die bestmöglichen Empfehlungen machen können.'}</p>
      </div>

      {step === 'sector' ? (
        <div className="grid grid-cols-1 gap-3">
          {SECTORS.map((sector) => (
            <button key={sector.id} onClick={() => { setSelectedSector(sector.id); setStep('questions'); }} className="p-4 text-left border border-titanium-700 rounded-lg hover:border-petrol-600 hover:bg-obsidian-800 transition-colors group">
              <p className="font-medium text-titanium-50 group-hover:text-petrol-500">{sector.label}</p>
              <p className="text-sm text-titanium-400 mt-1">{sector.description}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {CONTEXT_QUESTIONS.map((question) => (
            <div key={question.id}>
              <label htmlFor={question.id} className="block text-sm font-medium text-titanium-200 mb-2">{question.label}</label>
              <select id={question.id} value={answers[question.id] || ''} onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))} className="w-full px-4 py-2 bg-obsidian-800 border border-titanium-700 rounded-lg text-titanium-50 focus:outline-none focus:border-petrol-600">
                <option value="">— Bitte wählen —</option>
                {question.options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          ))}
          {error && <div className="px-4 py-3 bg-red-900/20 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}
          <div className="flex gap-4 pt-6 border-t border-titanium-700">
            <button onClick={() => { setStep('sector'); setSelectedSector(null); }} className="flex-1 px-6 py-2 bg-obsidian-700 hover:bg-obsidian-600 border border-titanium-600 text-titanium-200 font-medium rounded-lg">Zurück</button>
            <button onClick={handleSubmit} disabled={loading} className="flex-1 px-6 py-2 bg-petrol-600 hover:bg-petrol-700 disabled:opacity-50 text-white font-medium rounded-lg">{loading ? 'Wird gespeichert...' : 'Growth starten'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
