import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, ArrowUpRight } from 'lucide-react';

/**
 * LiveProductDemo — visualisiert echte Produkt-Output-Shapes.
 *
 * Statt Vanity-Numbers: 3-Tab-Showcase (Findings · Documents · Methodology),
 * der genau das zeigt, was Kunden im echten Dashboard sehen würden:
 * - Findings mit Severity, Norms-Reference, Confidence
 * - Generierter AVV-Eintrag mit Stand-Tag
 * - Methodology-Version mit Sources + Last-Update
 *
 * Bewusst klein gehalten — kein Mockup, kein Lorem-Ipsum, sondern reale
 * Datenstrukturen die unsere Plattform ausgibt.
 */

type Tab = 'findings' | 'document' | 'methodology';

const SAMPLE_FINDINGS = [
  {
    id: 'GA4_WITHOUT_CONSENT',
    severity: 'high' as const,
    title: 'Google Analytics ohne Einwilligung',
    norms: 'DSGVO Art. 6 · TTDSG § 25',
    confidence: 92,
  },
  {
    id: 'COOKIE_BANNER_DARK_PATTERN',
    severity: 'medium' as const,
    title: 'Cookie-Banner ohne Reject-Button gleicher Prominenz',
    norms: 'DSGVO Art. 7 · BfDI 2024',
    confidence: 78,
  },
  {
    id: 'GOOGLE_FONTS_EMBEDDED',
    severity: 'medium' as const,
    title: 'Google Fonts dynamisch eingebunden',
    norms: 'DSGVO Art. 6 · LG München I 2022',
    confidence: 95,
  },
  {
    id: 'MISSING_AVV_REFERENCE',
    severity: 'low' as const,
    title: 'AVV-Hinweis in Datenschutzerklärung fehlt',
    norms: 'DSGVO Art. 28',
    confidence: 71,
  },
];

export function LiveProductDemo() {
  const [tab, setTab] = useState<Tab>('findings');
  const [trackerDb, setTrackerDb] = useState<{ version: string; updated_at: string } | null>(null);

  useEffect(() => {
    fetch('/tracker-db-version.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setTrackerDb(data))
      .catch(() => null);
  }, []);

  return (
    <div className="relative max-w-3xl mx-auto">
      <div
        aria-hidden="true"
        className="absolute -inset-1 rounded-none blur-2xl opacity-30"
        style={{ background: 'linear-gradient(110deg, #6366f1 0%, #a78bfa 50%, transparent 100%)' }}
      />

      <div className="relative bg-obsidian-900/85 backdrop-blur border border-titanium-800 rounded-none">
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-titanium-900 text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500">
          <span className="w-2 h-2 rounded-full bg-red-500/60" />
          <span className="w-2 h-2 rounded-full bg-amber-500/60" />
          <span className="w-2 h-2 rounded-full bg-emerald-500/60" />
          <span className="ml-3 truncate">app.realsyncdynamicsai.de · audit · live</span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-titanium-900">
          {(['findings', 'document', 'methodology'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-[11px] font-mono uppercase tracking-[0.18em] transition-colors ${
                tab === t
                  ? 'bg-obsidian-950 text-titanium-50 border-b-2 border-indigo-500'
                  : 'text-titanium-500 hover:text-titanium-300 border-b-2 border-transparent'
              }`}
            >
              {t === 'findings' ? 'Findings' : t === 'document' ? 'AVV-Vorlage' : 'Methodik'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5 sm:p-6">
          {tab === 'findings' && <FindingsTab findings={SAMPLE_FINDINGS} />}
          {tab === 'document' && <DocumentTab />}
          {tab === 'methodology' && <MethodologyTab trackerDb={trackerDb} />}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-titanium-900 flex items-center justify-between text-[10px] font-mono text-titanium-500">
          <span>
            tracker-db: {trackerDb ? `${trackerDb.version} (${trackerDb.updated_at})` : '2026.05.0'} ·
            engine: 2026.05.0
          </span>
          <span className="text-emerald-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            live
          </span>
        </div>
      </div>
    </div>
  );
}

function FindingsTab({ findings }: { findings: typeof SAMPLE_FINDINGS }) {
  return (
    <div className="space-y-2">
      {findings.map((f) => (
        <div key={f.id} className="flex items-start gap-3 p-3 bg-obsidian-950 border border-titanium-900">
          <SeverityBadge severity={f.severity} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-titanium-100 truncate">{f.title}</div>
            <div className="mt-1 text-[11px] font-mono text-titanium-500 truncate">
              {f.id} · {f.norms}
            </div>
          </div>
          <ConfidencePill score={f.confidence} />
        </div>
      ))}
      <div className="pt-2 text-[11px] font-mono text-titanium-500 text-center">
        4 Findings · Sample-Output für example.com
      </div>
    </div>
  );
}

function DocumentTab() {
  return (
    <div className="font-mono text-[11px] text-titanium-300 leading-relaxed space-y-2 bg-obsidian-950 p-4 border border-titanium-900 max-h-72 overflow-hidden">
      <div className="text-titanium-500"># Auftragsverarbeitungsvertrag (Art. 28 DSGVO)</div>
      <div className="text-titanium-500"># Generiert: 2026-05-07 14:23 · Version 2026.05.0</div>
      <div>&nbsp;</div>
      <div>
        <span className="text-indigo-300">§ 1 Vertragsgegenstand</span>
      </div>
      <div>
        Auftraggeber: <span className="text-emerald-300">{'{{customer.legal_name}}'}</span>,{' '}
        <span className="text-emerald-300">{'{{customer.address}}'}</span>
      </div>
      <div>
        Auftragnehmer: RealSync Dynamics, Schwarzburger Str. 31, 98724 Neuhaus am Rennweg
      </div>
      <div>&nbsp;</div>
      <div>
        <span className="text-indigo-300">§ 2 Datenarten</span>
      </div>
      <div>
        - Account-Daten (E-Mail, Tenant-Zugehörigkeit)
        <br />
        - Nutzungsdaten (AI-Tool-Aufrufe, Workflow-Runs)
        <br />- Technische Daten (IP-Hash, User-Agent)
      </div>
      <div>&nbsp;</div>
      <div>
        <span className="text-indigo-300">§ 3 Sub-Processors</span>
      </div>
      <div className="text-titanium-500">… 8 Sub-Processors mit AVV-Status (auto-populiert)</div>
    </div>
  );
}

function MethodologyTab({
  trackerDb,
}: {
  trackerDb: { version: string; updated_at: string } | null;
}) {
  const items = [
    { label: 'Audit-Engine', value: '2026.05.0', note: 'Static-HTTP-Analyse + Rule Engine' },
    {
      label: 'Tracker-DB',
      value: trackerDb ? trackerDb.version : '2026.05.0',
      note: trackerDb ? `aktualisiert ${trackerDb.updated_at}` : 'EasyList + Disconnect.me + DACH',
    },
    { label: 'Rule Engine', value: '2026.05.0', note: '14 Rules (7 GDPR + 7 AI Act)' },
    { label: 'Methodology-Center', value: '/legal/methodology', note: 'Datenquellen + Update-Prozess' },
  ];
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline gap-3 justify-between border-b border-titanium-900 pb-3 last:border-b-0">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500">
            {it.label}
          </div>
          <div className="text-right">
            <div className="font-mono text-titanium-100">{it.value}</div>
            <div className="text-[11px] font-mono text-titanium-500">{it.note}</div>
          </div>
        </div>
      ))}
      <Link
        to="/legal/methodology"
        className="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-300 hover:text-indigo-200 mt-2"
      >
        Volle Methodik einsehen <ArrowUpRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: 'critical' | 'high' | 'medium' | 'low' }) {
  const map = {
    critical: { bg: 'bg-red-950/40', border: 'border-red-700', text: 'text-red-300' },
    high: { bg: 'bg-orange-950/40', border: 'border-orange-700', text: 'text-orange-300' },
    medium: { bg: 'bg-amber-950/40', border: 'border-amber-700', text: 'text-amber-300' },
    low: { bg: 'bg-titanium-900', border: 'border-titanium-700', text: 'text-titanium-400' },
  } as const;
  const m = map[severity];
  const Icon = severity === 'critical' || severity === 'high' ? AlertTriangle : CheckCircle2;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.14em] border ${m.bg} ${m.border} ${m.text} shrink-0`}
    >
      <Icon className="h-3 w-3" strokeWidth={2} />
      {severity}
    </span>
  );
}

function ConfidencePill({ score }: { score: number }) {
  const color = score >= 85 ? 'text-emerald-300' : score >= 60 ? 'text-amber-300' : 'text-red-300';
  return (
    <span className={`text-[10px] font-mono tabular-nums ${color} shrink-0 mt-1`}>
      {score}/100
    </span>
  );
}
