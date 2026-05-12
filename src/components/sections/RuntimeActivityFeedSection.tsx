import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';

const FEED = [
  {
    ts: '09:42',
    agent: 'Website Drift Agent',
    severity: 'high' as const,
    title: 'Meta Pixel loading before consent',
    body: 'careers.example.de — externe Script-Source erkannt vor consent.granted.',
    actions: ['Block before consent', 'Update CMP mapping', 'Regenerate evidence package'],
  },
  {
    ts: '09:38',
    agent: 'AI Risk Classifier',
    severity: 'high' as const,
    title: 'Usecase classified as High Risk (AI Act Annex III)',
    body: 'Recruiting-Assistant verarbeitet Bewerberdaten — Art. 9 GDPR + Annex-III §4(a).',
    actions: ['DPIA-Workflow gestartet', 'Human-Oversight-Pflicht markiert', 'Logging-Anforderung eingetragen'],
  },
  {
    ts: '09:21',
    agent: 'Vendor Risk Agent',
    severity: 'medium' as const,
    title: 'US-Transfer risk increased for sub-processor',
    body: 'analytics-vendor.com — Adequacy-Status geändert. SCC-Review erforderlich.',
    actions: ['Vendor-Review-Workflow geöffnet', 'DPO-Notification gesendet'],
  },
  {
    ts: '09:05',
    agent: 'Evidence Generation Agent',
    severity: 'ok' as const,
    title: 'Annex IV evidence package sealed',
    body: 'Recruiting-Assistant v2.3 — 14 Sections, SHA-256 + RFC-3161 Timestamp.',
    actions: ['evidence_id: a3f2…b7e1', 'chain_index: 4821'],
  },
  {
    ts: '08:51',
    agent: 'Runtime Telemetry Agent',
    severity: 'medium' as const,
    title: 'Anomaly: outbound calls to api.openai.com from staging',
    body: 'Tenant-Policy verbietet OpenAI in staging — 12 Calls in 5 Min.',
    actions: ['Policy decision: require_approval', 'Approval-Queue +1'],
  },
];

const STATS = [
  { label: 'New trackers detected', value: '12', period: '24h' },
  { label: 'Policy decisions', value: '4 821', period: '24h' },
  { label: 'AI usecases classified', value: '2', period: '24h' },
  { label: 'Evidence artifacts sealed', value: '18', period: '24h' },
  { label: 'High-risk vendor flags', value: '1', period: '24h' },
  { label: 'Agent runs completed', value: '147', period: '24h' },
];

export function RuntimeActivityFeedSection() {
  return (
    <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
          <div className="max-w-2xl">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
              Runtime Activity
            </div>
            <h2 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-tight">
              Was die Plattform gerade tut.
            </h2>
            <p className="mt-4 text-silver-300 text-base sm:text-lg leading-relaxed">
              Kein Mockup. So sieht ein typischer Vormittag im Governance-Runtime aus — Agenten,
              Policy-Decisions, Evidence-Sealings. Live-Demo unter{' '}
              <Link to="/governance-runtime" className="text-amber-400 hover:text-amber-300">
                /governance-runtime
              </Link>
              .
            </p>
          </div>
          <Link
            to="/governance-runtime"
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-titanium-100/30 hover:border-amber-400 text-titanium-100 hover:text-amber-300 text-sm font-medium transition-colors"
          >
            <Activity className="h-4 w-4" /> Live Demo öffnen <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {STATS.map((s) => (
            <div key={s.label} className="border border-silver-700/30 bg-obsidian-900/60 p-4">
              <div className="font-display font-bold text-2xl text-titanium-50">{s.value}</div>
              <div className="text-[11px] text-silver-400 mt-1 leading-tight">{s.label}</div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-silver-500 mt-1">
                {s.period}
              </div>
            </div>
          ))}
        </div>

        {/* Feed */}
        <div className="bg-obsidian-900/60 border border-silver-700/30">
          <div className="border-b border-silver-700/30 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-titanium-100">
                Today · Demo Tenant
              </span>
            </div>
            <span className="font-mono text-[11px] text-silver-500">5 von 147 events</span>
          </div>
          <ul className="divide-y divide-silver-700/30">
            {FEED.map((e, idx) => {
              const sev = SEV[e.severity];
              const Icon = sev.icon;
              return (
                <li key={idx} className="px-4 py-4 sm:px-6 sm:py-5">
                  <div className="flex items-start gap-4">
                    <div className="font-mono text-[11px] text-silver-500 pt-0.5 w-12 shrink-0">
                      {e.ts}
                    </div>
                    <div
                      className={`h-7 w-7 flex items-center justify-center border ${sev.border} ${sev.bg} ${sev.text} shrink-0`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-silver-400">
                          {e.agent}
                        </span>
                        <span
                          className={`font-mono text-[10px] uppercase tracking-[0.18em] ${sev.text}`}
                        >
                          · {sev.label}
                        </span>
                      </div>
                      <h3 className="font-display font-semibold text-sm text-titanium-50 leading-snug">
                        {e.title}
                      </h3>
                      <p className="mt-1 text-xs text-silver-400 leading-relaxed">{e.body}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {e.actions.map((a) => (
                          <span
                            key={a}
                            className="border border-silver-700/30 bg-obsidian-950/60 px-2 py-0.5 text-[10px] text-silver-300"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-silver-700/30 px-4 py-3 text-center">
            <Link
              to="/governance-runtime"
              className="text-xs font-mono uppercase tracking-[0.18em] text-amber-400 hover:text-amber-300"
            >
              → vollständigen Feed in der Demo öffnen
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

const SEV = {
  high:   { icon: AlertTriangle,  label: 'high',   border: 'border-rose-400/40',    bg: 'bg-rose-400/10',    text: 'text-rose-300' },
  medium: { icon: AlertTriangle,  label: 'medium', border: 'border-amber-400/40',   bg: 'bg-amber-400/10',   text: 'text-amber-300' },
  ok:     { icon: CheckCircle2,   label: 'ok',     border: 'border-emerald-400/40', bg: 'bg-emerald-400/10', text: 'text-emerald-300' },
};
