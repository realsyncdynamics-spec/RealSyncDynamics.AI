import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function SuccessPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/app/dashboard', { replace: true });
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="max-w-md mx-auto text-center space-y-8 py-12">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-titanium-50">
            Ihr AI Governance Workspace ist vorbereitet.
          </h1>
          <p className="text-lg text-titanium-300">
            Als Nächstes: KI-Systeme erfassen und Pflichten nach EU AI Act und DSGVO zuordnen.
          </p>
        </div>
      </div>

      <div className="bg-obsidian-800 border border-petrol-600 rounded-lg p-6 space-y-4">
        <p className="text-petrol-500 font-medium">✓ Dauerhaft kostenloser Zugang</p>
        <p className="text-sm text-titanium-400">
          Scan, Governance Score und Audit Center ohne Zeitlimit. Upgrade jederzeit aus dem Dashboard.
        </p>
      </div>

      <p className="text-sm text-titanium-500">
        Sie werden in Kürze automatisch weitergeleitet...
      </p>

      <button
        onClick={() => navigate('/app/dashboard', { replace: true })}
        className="w-full px-6 py-3 bg-petrol-600 hover:bg-petrol-700 text-white font-medium rounded-lg transition-colors"
      >
        Zum Dashboard
      </button>
    </div>
  );
}
