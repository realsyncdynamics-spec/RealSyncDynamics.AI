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
        <div className="text-6xl animate-bounce">🎉</div>
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-titanium-50">Willkommen!</h1>
          <p className="text-xl text-titanium-300">
            Ihr Governance-Dashboard ist bereit.
          </p>
        </div>
      </div>

      <div className="bg-obsidian-800 border border-petrol-600 rounded-lg p-6 space-y-4">
        <p className="text-petrol-500 font-medium">✓ 14 Tage kostenlos Zugriff</p>
        <p className="text-sm text-titanium-400">
          Nutzen Sie die volle Kraft unserer Governance-Platform ohne Einschränkungen.
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
