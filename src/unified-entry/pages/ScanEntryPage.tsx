import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { postEdgeFunction } from '../../lib/edgeFunction';

interface CookieScanResponse {
  ok: true;
  url: string;
  domain: string;
  fetched_status: number | null;
  fetch_error: string | null;
  scanned_at: string;
  cookies: unknown[];
  trackers: Array<{ id: string; name: string; category: string }>;
  privacy_analytics: unknown[];
  consent_manager_detected: boolean;
  score: number;
  severity: 'pass' | 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  forms?: {
    total_forms: number;
    has_email_field: boolean;
    has_password_field: boolean;
    has_phone_field: boolean;
    contact_form_detected: boolean;
    signup_form_detected: boolean;
    visible_consent_link: boolean;
  };
  unknown_scripts_count?: number;
}

export function ScanEntryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [domain, setDomain] = useState(searchParams.get('domain') ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const queryDomain = searchParams.get('domain');
    if (queryDomain) setDomain(queryDomain);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!domain.trim()) {
      setError('Bitte geben Sie eine Domain ein');
      return;
    }

    setLoading(true);

    try {
      const normalizedUrl = domain.trim().match(/^https?:\/\//i)
        ? domain.trim()
        : `https://${domain.trim()}`;

      const data = await postEdgeFunction<CookieScanResponse>('cookie-scan', {
        url: normalizedUrl,
      }, { requireAuth: false });

      if (!data?.ok) {
        throw new Error(data?.fetch_error || 'Der Website-Scan konnte nicht abgeschlossen werden');
      }

      const params = new URLSearchParams({
        auditId: `urlscan-${Date.now()}`,
        domain: data.domain,
        url: data.url,
        score: String(data.score),
        severity: data.severity,
        trackers: String(data.trackers?.length ?? 0),
        cookies: String(data.cookies?.length ?? 0),
        consent: data.consent_manager_detected ? '1' : '0',
      });

      navigate(`/unified-entry/entscheidung?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold text-titanium-50">Was soll RealSync für Ihre Website automatisieren?</h1>
        <p className="text-xl text-titanium-300">
          Wir beginnen mit der Prüfung Ihrer Domain auf DSGVO- und
          KI-Governance-Risiken. Danach entscheiden Sie, ob es bei der
          laufenden Überwachung bleibt oder ob zusätzlich ein neues Frontend
          entsteht.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="domain" className="block text-sm font-medium text-titanium-200 mb-2">Website-URL</label>
          <input
            id="domain"
            type="text"
            placeholder="z. B. realsyncdynamicsai.de"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={loading}
            autoFocus={!domain}
            className="w-full px-4 py-4 bg-obsidian-800 border border-titanium-700 rounded-lg text-titanium-50 placeholder-titanium-500 focus:outline-none focus:border-petrol-600 focus:ring-1 focus:ring-petrol-600 transition-colors disabled:opacity-50"
          />
        </div>

        {error && <div className="px-4 py-3 bg-red-900/20 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-4 bg-petrol-600 hover:bg-petrol-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
        >
          {loading ? 'Website wird gescannt...' : 'Website scannen'}
        </button>
      </form>

      <div className="grid grid-cols-3 gap-4 pt-4">
        <div><div className="text-2xl font-bold text-petrol-500">URL zuerst</div><p className="text-sm text-titanium-400">Kein Account nötig</p></div>
        <div><div className="text-2xl font-bold text-petrol-500">Live Scan</div><p className="text-sm text-titanium-400">Bestehende Website</p></div>
        <div><div className="text-2xl font-bold text-petrol-500">Ihre Wahl</div><p className="text-sm text-titanium-400">Überwachen oder zusätzlich neu bauen</p></div>
      </div>
    </div>
  );
}
