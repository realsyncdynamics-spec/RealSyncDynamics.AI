import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MOCK_DASHBOARD_DATA } from '../mock-data';
import { postEdgeFunction } from '../../lib/edgeFunction';

export function DashboardPreviewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);

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
    return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-2 border-petrol-600 border-t-transparent" /></div>;
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

  const submitLead = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!email.trim() || !marketingConsent) {
      setError('Bitte E-Mail-Adresse eingeben und dem Erhalt des Angebots per E-Mail zustimmen.');
      return;
    }
    setSending(true);
    try {
      await postEdgeFunction('sales-lead', {
        name,
        email,
        company,
        use_case: 'website_rebuild',
        source: 'unified-entry',
        intent: 'starter_3_months_free',
        tier: 'starter',
        path: window.location.pathname,
        message: `Website: ${data.scanDomain}; Score: ${data.complianceScore}; Tracker: ${data.scanResults.trackersFound}; Cookies: ${data.scanResults.cookiesDetected}; Severity: ${scanSeverity}; marketing_consent=true`,
      }, { requireAuth: false });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Das Angebot konnte nicht angefordert werden.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-medium text-petrol-500 uppercase tracking-wider">Website Scan abgeschlossen</p>
        <h1 className="text-4xl font-bold text-titanium-50">Das können wir aus Ihrer Website machen</h1>
        <p className="text-lg text-titanium-300">Live-Analyse für <span className="text-titanium-100 font-medium">{data.scanDomain}</span>.</p>
      </div>

      <div className="bg-obsidian-800 border border-petrol-700 rounded-lg p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm text-titanium-400">Live Scan</p><p className="text-3xl font-bold text-petrol-500">{data.complianceScore}%</p></div>
          <div className="text-sm text-titanium-300">
            <span className="font-medium text-titanium-100">{data.scanResults.trackersFound}</span> Tracker ·{' '}
            <span className="font-medium text-titanium-100">{data.scanResults.cookiesDetected}</span> Cookies ·{' '}
            <span className="font-medium text-titanium-100 capitalize">{scanSeverity}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-obsidian-800 border border-titanium-700 rounded-lg p-6">
          <p className="text-sm text-titanium-400 mb-2">Compliance Score</p>
          <div className="text-5xl font-bold text-petrol-500">{data.complianceScore}%</div>
          <p className="text-xs text-titanium-500 mt-3">{data.scanDomain} — gerade live gescannt</p>
        </div>
        <div className="bg-obsidian-800 border border-titanium-700 rounded-lg p-6">
          <p className="text-sm text-titanium-400 mb-4">Erste Findings</p>
          <div className="space-y-2">
            {data.findings.slice(0, 3).map((finding) => (
              <div key={finding.id} className="flex items-start gap-2">
                <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${finding.severity === 'high' ? 'bg-red-500' : finding.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                <div><p className="text-xs font-medium text-titanium-200">{finding.title}</p><p className="text-xs text-titanium-500 mt-0.5">{finding.count} Problem{finding.count !== 1 ? 'e' : ''}</p></div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-obsidian-800 border border-titanium-700 rounded-lg p-6">
          <p className="text-sm text-titanium-400 mb-4">Scan-Statistiken</p>
          <p className="text-xs text-titanium-500">Tracker gefunden</p><p className="text-2xl font-bold text-titanium-50">{data.scanResults.trackersFound}</p>
          <p className="text-xs text-titanium-500 mt-3">Cookies erkannt</p><p className="text-2xl font-bold text-titanium-50">{data.scanResults.cookiesDetected}</p>
          <p className="text-xs text-titanium-500 mt-3">Dritte Domänen</p><p className="text-2xl font-bold text-titanium-50">{data.scanResults.thirdPartiesDomains}</p>
        </div>
      </div>

      <div className="bg-obsidian-800 border border-titanium-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-titanium-50 mb-3">So können wir die Website umbauen</h2>
        <p className="text-titanium-300 mb-4">Modernes Redesign, SEO-Optimierung, DSGVO- und EU-AI-Act-Anforderungen sowie optional Chat- und Telefon-Assistenten — auf Basis des gerade durchgeführten Scans.</p>
        <div className="flex flex-wrap gap-2 text-sm text-titanium-300">
          {['Modernes Redesign', 'SEO', 'DSGVO', 'EU AI Act', 'Chatbot', 'Telefonbot'].map((item) => <span key={item} className="px-3 py-1 rounded-full bg-obsidian-900 border border-titanium-700">{item}</span>)}
        </div>
      </div>

      {!sent ? (
        <form onSubmit={submitLead} className="bg-obsidian-800 border border-petrol-700 rounded-lg p-6 space-y-4">
          <div>
            <p className="text-sm font-medium text-petrol-500 uppercase tracking-wider">Ihr Angebot</p>
            <h2 className="text-2xl font-bold text-titanium-50 mt-1">Starter 3 Monate gratis</h2>
            <p className="text-sm text-titanium-300 mt-2">Wir senden Ihnen nach dem Scan die nächsten Schritte und das Starter-Angebot per E-Mail.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="px-4 py-3 bg-obsidian-900 border border-titanium-700 rounded-lg text-titanium-50" />
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail-Adresse" className="px-4 py-3 bg-obsidian-900 border border-titanium-700 rounded-lg text-titanium-50" />
          </div>
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Unternehmen (optional)" className="w-full px-4 py-3 bg-obsidian-900 border border-titanium-700 rounded-lg text-titanium-50" />
          <label className="flex items-start gap-3 text-sm text-titanium-300">
            <input type="checkbox" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} className="mt-1" />
            <span>Ich möchte das Starter-Angebot und weitere Informationen zum Website-/Governance-Angebot per E-Mail erhalten. Die Einwilligung kann jederzeit widerrufen werden.</span>
          </label>
          {error && <div className="px-4 py-3 bg-red-900/20 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}
          <button disabled={sending} className="w-full px-6 py-4 bg-petrol-600 hover:bg-petrol-700 disabled:opacity-50 text-white font-semibold rounded-lg">
            {sending ? 'Angebot wird gesendet...' : 'Starter-Angebot per E-Mail erhalten'}
          </button>
        </form>
      ) : (
        <div className="bg-emerald-900/20 border border-emerald-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-emerald-300">Angebot angefordert.</h2>
          <p className="text-sm text-titanium-300 mt-2">Wir haben Ihre Angaben erhalten. Das Starter-Angebot für 3 Monate gratis wird an Ihre E-Mail-Adresse gesendet.</p>
        </div>
      )}
    </div>
  );
}
