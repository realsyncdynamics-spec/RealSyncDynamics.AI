import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { postEdgeFunction } from '../../lib/edgeFunction';

export function ScanEntryPage() {
  const navigate = useNavigate();
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!domain.trim()) {
      setError('Bitte geben Sie eine Domain ein');
      return;
    }

    setLoading(true);

    try {
      const normalizedUrl = domain.trim().match(/^https?:\/\//i) ? domain.trim() : `https://${domain.trim()}`;
      // Öffentlicher Free-Audit-Flow: gdpr-audit ist verify_jwt=false, daher
      // kein JWT-Zwang (sonst Abbruch für nicht eingeloggte Besucher).
      const data = await postEdgeFunction<{ audit_id?: string; id?: string }>('gdpr-audit', {
        url: normalizedUrl,
      }, { requireAuth: false });

      const auditId = data.audit_id || data.id;

      if (!auditId) {
        throw new Error('Keine Audit-ID in Antwort erhalten');
      }

      navigate(`/unified-entry/preview?auditId=${auditId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold text-titanium-50">
          Kostenlose Compliance-Analyse
        </h1>
        <p className="text-xl text-titanium-300">
          Geben Sie Ihre Domain ein und erhalten Sie in wenigen Minuten eine personalisierte Governance-Analyse.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="domain" className="block text-sm font-medium text-titanium-200 mb-2">
            Website Domain
          </label>
          <input
            id="domain"
            type="text"
            placeholder="z.B. example.com oder https://example.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-3 bg-obsidian-800 border border-titanium-700 rounded-lg text-titanium-50 placeholder-titanium-500 focus:outline-none focus:border-petrol-600 focus:ring-1 focus:ring-petrol-600 transition-colors disabled:opacity-50"
          />
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-900/20 border border-red-700 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3 bg-petrol-600 hover:bg-petrol-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {loading ? 'Scan wird gestartet...' : 'Kostenlos starten'}
        </button>
      </form>

      <div className="grid grid-cols-3 gap-4 pt-4">
        <div className="space-y-2">
          <div className="text-2xl font-bold text-petrol-500">5 Min</div>
          <p className="text-sm text-titanium-400">Scan-Zeit</p>
        </div>
        <div className="space-y-2">
          <div className="text-2xl font-bold text-petrol-500">0€</div>
          <p className="text-sm text-titanium-400">Kein Abo nötig</p>
        </div>
        <div className="space-y-2">
          <div className="text-2xl font-bold text-petrol-500">∞</div>
          <p className="text-sm text-titanium-400">Detailliertes Report</p>
        </div>
      </div>
    </div>
  );
}
