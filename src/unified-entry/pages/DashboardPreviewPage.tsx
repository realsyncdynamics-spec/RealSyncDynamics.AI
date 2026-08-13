import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TrialTimer } from '../components/TrialTimer';
import { MOCK_DASHBOARD_DATA } from '../mock-data';

const PREVIEW_DURATION_MINUTES = 30;

export function DashboardPreviewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isExpired, setIsExpired] = useState(false);
  const [loading, setLoading] = useState(true);

  const auditId = searchParams.get('auditId');
  const scanDomain = searchParams.get('domain');
  const scanScore = Number(searchParams.get('score'));
  const scanTrackers = Number(searchParams.get('trackers'));
  const scanCookies = Number(searchParams.get('cookies'));
  const scanSeverity = searchParams.get('severity') ?? 'low';

  useEffect(() => {
    if (!auditId) {
      navigate('/unified-entry/scan');
      return;
    }
    setLoading(false);
  }, [auditId, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-petrol-600 border-t-transparent" />
      </div>
    );
  }

  const data = {
    ...MOCK_DASHBOARD_DATA,
    scanDomain: scanDomain || MOCK_DASHBOARD_DATA.scanDomain,
    complianceScore: Number.isFinite(scanScore) ? scanScore : MOCK_DASHBOARD_DATA.complianceScore,
    scanResults: {
      ...MOCK_DASHBOARD_DATA.scanResults,
      trackersFound: Number.isFinite(scanTrackers) ? scanTrackers : MOCK_DASHBOARD_DATA.scanResults.trackersFound,
      cookiesDetected: Number.isFinite(scanCookies) ? scanCookies : MOCK_DASHBOARD_DATA.scanResults.cookiesDetected,
    },
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-3 flex-1">
          <p className="text-sm font-medium text-petrol-500 uppercase tracking-wider">Website Scan abgeschlossen</p>
          <h1 className="text-4xl font-bold text-titanium-50">
            Das können wir aus Ihrer Website machen
          </h1>
          <p className="text-lg text-titanium-300">
            Erste Live-Analyse für <span className="text-titanium-100 font-medium">{data.scanDomain}</span>.
            Jetzt folgt die moderne Redesign-Vorschau.
          </p>
        </div>
        <TrialTimer
          durationMinutes={PREVIEW_DURATION_MINUTES}
          onExpire={() => setIsExpired(true)}
          showCountdown={!isExpired}
        />
      </div>

      <div className="bg-obsidian-800 border border-petrol-700 rounded-lg p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-titanium-400">Live Scan</p>
            <p className="text-3xl font-bold text-petrol-500">{data.complianceScore}%</p>
          </div>
          <div className="text-sm text-titanium-300">
            <span className="font-medium text-titanium-100">{data.scanResults.trackersFound}</span> Tracker ·{' '}
            <span className="font-medium text-titanium-100">{data.scanResults.cookiesDetected}</span> Cookies ·{' '}
            <span className="font-medium text-titanium-100 capitalize">{scanSeverity}</span>
          </div>
        </div>
      </div>

      {isExpired && (
        <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-300">
          <p className="font-medium">Ihre Preview ist abgelaufen.</p>
          <p className="text-sm mt-1">Registrieren Sie sich jetzt, um Zugriff zu erhalten.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-obsidian-800 border border-titanium-700 rounded-lg p-6">
          <p className="text-sm text-titanium-400 mb-2">Compliance Score</p>
          <div className="flex items-end gap-4">
            <div className="text-5xl font-bold text-petrol-500">{data.complianceScore}%</div>
            <div className="flex-1 h-32 bg-obsidian-900 rounded-lg overflow-hidden flex items-end gap-1 p-2">
              {data.dimensions.slice(0, 4).map((dim, i) => (
                <div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-petrol-600 to-petrol-500 rounded-sm"
                  style={{ height: `${dim.score}%` }}
                />
              ))}
            </div>
          </div>
          <p className="text-xs text-titanium-500 mt-3">
            {data.scanDomain} — gerade live gescannt
          </p>
        </div>

        <div className="bg-obsidian-800 border border-titanium-700 rounded-lg p-6">
          <p className="text-sm text-titanium-400 mb-4">Erste Findings</p>
          <div className="space-y-2">
            {data.findings.slice(0, 3).map((finding) => (
              <div key={finding.id} className="flex items-start gap-2">
                <div
                  className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                    finding.severity === 'high'
                      ? 'bg-red-500'
                      : finding.severity === 'medium'
                        ? 'bg-amber-500'
                        : 'bg-blue-500'
                  }`}
                />
                <div>
                  <p className="text-xs font-medium text-titanium-200">{finding.title}</p>
                  <p className="text-xs text-titanium-500 mt-0.5">
                    {finding.count} Problem{finding.count !== 1 ? 'e' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-obsidian-800 border border-titanium-700 rounded-lg p-6">
          <p className="text-sm text-titanium-400 mb-4">Scan-Statistiken</p>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-titanium-500">Tracker gefunden</p>
              <p className="text-2xl font-bold text-titanium-50">{data.scanResults.trackersFound}</p>
            </div>
            <div>
              <p className="text-xs text-titanium-500">Cookies erkannt</p>
              <p className="text-2xl font-bold text-titanium-50">{data.scanResults.cookiesDetected}</p>
            </div>
            <div>
              <p className="text-xs text-titanium-500">Dritte Domänen</p>
              <p className="text-2xl font-bold text-titanium-50">{data.scanResults.thirdPartiesDomains}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-obsidian-800 border border-titanium-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-titanium-50 mb-6">Governance Dimensionen</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.dimensions.map((dim) => (
            <div key={dim.name}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-titanium-300">{dim.name}</p>
                <p className="text-sm font-medium text-petrol-500">{dim.score}%</p>
              </div>
              <div className="h-2 bg-obsidian-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-petrol-600 to-petrol-500 rounded-full"
                  style={{ width: `${dim.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-obsidian-800 border border-titanium-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-titanium-50 mb-4">Nächster Schritt</h3>
        <p className="text-titanium-300 mb-4">
          Die erste Analyse zeigt den Ausgangspunkt. Jetzt können wir daraus eine echte moderne Website erstellen — mit SEO-Optimierung, DSGVO-/AI-Act-Anforderungen und den von Ihnen gewünschten KI-Funktionen.
        </p>
        <div className="flex flex-wrap gap-3 text-sm text-titanium-300">
          <span className="px-3 py-1 rounded-full bg-obsidian-900 border border-titanium-700">Modernes Redesign</span>
          <span className="px-3 py-1 rounded-full bg-obsidian-900 border border-titanium-700">SEO</span>
          <span className="px-3 py-1 rounded-full bg-obsidian-900 border border-titanium-700">DSGVO</span>
          <span className="px-3 py-1 rounded-full bg-obsidian-900 border border-titanium-700">EU AI Act</span>
          <span className="px-3 py-1 rounded-full bg-obsidian-900 border border-titanium-700">Chatbot</span>
          <span className="px-3 py-1 rounded-full bg-obsidian-900 border border-titanium-700">Telefonbot</span>
        </div>
      </div>

      <div className="flex gap-4 pt-6 border-t border-titanium-700">
        <button
          onClick={() => navigate('/unified-entry/trial-offer')}
          disabled={isExpired}
          className="flex-1 px-6 py-3 bg-petrol-600 hover:bg-petrol-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {isExpired ? 'Preview beendet' : 'Website neu erstellen'}
        </button>
        <button
          onClick={() => navigate('/unified-entry/register')}
          disabled={isExpired}
          className="flex-1 px-6 py-3 bg-obsidian-700 hover:bg-obsidian-600 border border-titanium-600 disabled:opacity-50 disabled:cursor-not-allowed text-titanium-200 font-medium rounded-lg transition-colors"
        >
          {isExpired ? 'Registrieren' : 'Anforderungen festlegen'}
        </button>
      </div>
    </div>
  );
}
