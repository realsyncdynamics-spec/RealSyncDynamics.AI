import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Bot, CheckCircle2, Gauge, Link2, Loader2,
  RefreshCw, ShieldAlert, Sparkles, Radar,
} from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { Button } from '../../enterprise-os/components/Button';
import { Card, CardHeader, CardBody } from '../../enterprise-os/components/Card';
import {
  approveAgentRun, buildSite, errorMessage, listAgentRuns, listScans, listSites,
  runAgent, runScan,
  type AgentRunRow, type ScanRow, type SiteOverviewRow,
} from './siteOsApi';

/**
 * /app/siteos — RealSync SiteOS.
 *
 * Fasst die fünf Kennzahlen, die Sites, die Runtime-Scans und die
 * Agenten-Warteschlange zusammen. Die Ansicht ist bewusst schreibarm: sie
 * stößt Edge Functions an und zeigt deren Ergebnis, rechnet aber selbst
 * keine Scores — die Bewertung liegt allein in packages/siteos-core, damit
 * Dashboard und Kundenbericht nie auseinanderlaufen.
 */
export function SiteOsDashboardView() {
  return <AuthGate>{() => <SiteOsInner />}</AuthGate>;
}

function SiteOsInner() {
  const { activeTenantId } = useTenant();

  const [sites, setSites] = useState<SiteOverviewRow[]>([]);
  const [runs, setRuns] = useState<AgentRunRow[]>([]);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [prompt, setPrompt] = useState('');
  const [scanUrl, setScanUrl] = useState('');

  const reload = useCallback(async () => {
    if (!activeTenantId) return;
    try {
      const [siteRows, runRows, scanRows] = await Promise.all([
        listSites(activeTenantId),
        listAgentRuns(activeTenantId),
        listScans(activeTenantId, 10),
      ]);
      setSites(siteRows);
      setRuns(runRows);
      setScans(scanRows);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [activeTenantId]);

  useEffect(() => { void reload(); }, [reload]);

  const onBuild = useCallback(async () => {
    if (!activeTenantId || prompt.trim() === '') return;
    setBusy('build'); setError(null); setNotice(null);
    const result = await buildSite({ tenant_id: activeTenantId, prompt: prompt.trim() });
    if (result.kind !== 'ok') {
      setError(errorMessage(result));
    } else if (result.data.unchanged) {
      setNotice('Der erzeugte Blueprint ist identisch zur letzten Version — keine neue Version angelegt.');
    } else {
      setNotice(
        `Version ${result.data.version} von „${result.data.slug}" angelegt — ` +
        `${result.data.findings.length} Befund(e), Health ${result.data.scores.health}.`,
      );
      setPrompt('');
    }
    setBusy(null);
    await reload();
  }, [activeTenantId, prompt, reload]);

  const onScan = useCallback(async (blueprintId?: string) => {
    if (!activeTenantId || scanUrl.trim() === '') return;
    setBusy('scan'); setError(null); setNotice(null);
    const result = await runScan({
      tenant_id: activeTenantId, url: scanUrl.trim(), blueprint_id: blueprintId, trigger: 'manual',
    });
    if (result.kind !== 'ok') setError(errorMessage(result));
    else setNotice(`Scan abgeschlossen — ${result.data.findings.length} Befund(e), Health ${result.data.scores.health}.`);
    setBusy(null);
    await reload();
  }, [activeTenantId, scanUrl, reload]);

  const onAgent = useCallback(async (run: AgentRunRow) => {
    if (!activeTenantId) return;
    setBusy(run.id); setError(null); setNotice(null);

    // Wartende Läufe brauchen zuerst die Freigabe, dann die Ausführung.
    if (run.status === 'awaiting_approval') {
      const approval = await approveAgentRun(activeTenantId, run.id);
      if (approval.kind !== 'ok') { setError(errorMessage(approval)); setBusy(null); return; }
    }

    const result = await runAgent(activeTenantId, run.id);
    if (result.kind !== 'ok') setError(errorMessage(result));
    else if (result.data.applied && result.data.applied.length > 0) {
      setNotice(`Agent hat ${result.data.applied.length} Befund(e) behoben und eine neue Version erzeugt.`);
    } else {
      setNotice('Agent abgeschlossen — keine automatisch behebbaren Befunde.');
    }
    setBusy(null);
    await reload();
  }, [activeTenantId, reload]);

  const aggregate = aggregateScores(sites);
  const openRuns = runs.filter((r) => r.status === 'queued' || r.status === 'awaiting_approval');

  return (
    <div className="min-h-screen bg-obsidian-900 text-titanium-200">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Link to="/app" className="mb-6 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-titanium-500 hover:text-titanium-300">
          <ArrowLeft size={14} /> Dashboard
        </Link>

        <header className="mb-8">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-400">RealSync SiteOS</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-titanium-50">Websites mit eingebauter Governance</h1>
          <p className="mt-2 max-w-2xl text-sm text-titanium-400">
            Jede Version wird geprüft, gehasht und im Herkunftsnachweis erfasst. Die Bewertung entsteht
            ausschließlich aus benannten Befunden und ist damit im Audit nachvollziehbar.
          </p>
        </header>

        {error && (
          <div role="alert" className="mb-4 border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="mb-4 border border-cyan-900 bg-cyan-950/30 px-4 py-3 text-sm text-cyan-200">
            {notice}
          </div>
        )}

        {/* ── Kennzahlen ─────────────────────────────────────────────── */}
        <section aria-label="Kennzahlen" className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
          <ScoreTile label="Health" value={aggregate.health} icon={<Gauge size={14} />} higherIsBetter />
          <ScoreTile label="Compliance" value={aggregate.compliance} icon={<CheckCircle2 size={14} />} higherIsBetter />
          <ScoreTile label="Performance" value={aggregate.performance} icon={<Radar size={14} />} higherIsBetter />
          <ScoreTile label="Risk" value={aggregate.risk} icon={<ShieldAlert size={14} />} higherIsBetter={false} />
          <ScoreTile label="AI Risk" value={aggregate.aiRisk} icon={<Sparkles size={14} />} higherIsBetter={false} />
        </section>

        {/* ── AI Builder ─────────────────────────────────────────────── */}
        <Card className="mb-6">
          <CardHeader
            eyebrow="AI Builder"
            title="Website aus einer Beschreibung erzeugen"
            subtitle="Das Compliance-Gerüst entsteht regelbasiert — unabhängig davon, was ein Sprachmodell vorschlägt."
          />
          <CardBody>
            <label htmlFor="siteos-prompt" className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-titanium-500">
              Beschreibung
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="siteos-prompt"
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Erstelle eine Website für einen Zahnarzt in Hamburg."
                className="flex-1 border border-titanium-800 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100 placeholder:text-titanium-600 focus:border-cyan-700 focus:outline-none"
              />
              <Button onClick={() => void onBuild()} disabled={busy !== null || prompt.trim() === ''}>
                {busy === 'build' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span className="ml-2">Erzeugen</span>
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* ── Runtime-Scan ───────────────────────────────────────────── */}
        <Card className="mb-6">
          <CardHeader
            eyebrow="Runtime"
            title="Live-Analyse"
            subtitle="DSGVO, EU AI Act, TDDDG, Barrierefreiheit, Sicherheit, Performance, SEO und Inhalt in einem Lauf."
          />
          <CardBody>
            <label htmlFor="siteos-url" className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-titanium-500">
              Adresse
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="siteos-url"
                type="url"
                value={scanUrl}
                onChange={(e) => setScanUrl(e.target.value)}
                placeholder="https://beispiel.de"
                className="flex-1 border border-titanium-800 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100 placeholder:text-titanium-600 focus:border-cyan-700 focus:outline-none"
              />
              <Button variant="secondary" onClick={() => void onScan()} disabled={busy !== null || scanUrl.trim() === ''}>
                {busy === 'scan' ? <Loader2 size={14} className="animate-spin" /> : <Radar size={14} />}
                <span className="ml-2">Scannen</span>
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* ── Sites ──────────────────────────────────────────────────── */}
        <Card className="mb-6">
          <CardHeader
            eyebrow="Sites"
            title={`${sites.length} Site(s)`}
            action={
              <Button variant="ghost" size="sm" onClick={() => void reload()} disabled={loading}>
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                <span className="ml-2">Aktualisieren</span>
              </Button>
            }
          />
          <CardBody className="p-0">
            {loading ? (
              <p className="px-5 py-6 text-sm text-titanium-500">Wird geladen …</p>
            ) : sites.length === 0 ? (
              <p className="px-5 py-6 text-sm text-titanium-500">
                Noch keine Site. Beschreiben Sie oben, was entstehen soll.
              </p>
            ) : (
              <ul className="divide-y divide-titanium-800">
                {sites.map((site) => (
                  <li key={site.blueprint_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-semibold text-titanium-50">{site.name}</p>
                      <p className="mt-1 font-mono text-[10px] text-titanium-500">
                        {site.slug} · v{site.version} · {site.status} · {site.content_sha256.slice(0, 12)}…
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <MiniScore label="Health" value={site.health} />
                      <MiniScore label="Compliance" value={site.compliance} />
                      <SeverityChip severity={site.severity_max} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* ── Agenten ────────────────────────────────────────────────── */}
        <Card className="mb-6">
          <CardHeader
            eyebrow="AI Agents"
            title={`${openRuns.length} offene(r) Lauf/Läufe`}
            subtitle="Agenten mit Freigabepflicht warten, bis sie freigegeben werden."
          />
          <CardBody className="p-0">
            {runs.length === 0 ? (
              <p className="px-5 py-6 text-sm text-titanium-500">Keine Agentenläufe.</p>
            ) : (
              <ul className="divide-y divide-titanium-800">
                {runs.slice(0, 12).map((run) => (
                  <li key={run.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm text-titanium-100">
                        <Bot size={14} className="text-cyan-400" />
                        {run.agent}
                        <span className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">{run.status}</span>
                      </p>
                      <p className="mt-1 truncate font-mono text-[10px] text-titanium-500">
                        {run.finding_codes.join(', ') || '—'}
                      </p>
                    </div>
                    {(run.status === 'queued' || run.status === 'awaiting_approval') && (
                      <Button size="sm" variant={run.status === 'awaiting_approval' ? 'secondary' : 'primary'}
                        onClick={() => void onAgent(run)} disabled={busy !== null}>
                        {busy === run.id ? <Loader2 size={12} className="animate-spin" /> : null}
                        <span className={busy === run.id ? 'ml-2' : ''}>
                          {run.status === 'awaiting_approval' ? 'Freigeben & ausführen' : 'Ausführen'}
                        </span>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* ── Nachweise ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader
            eyebrow="Evidence"
            title="Letzte Prüfläufe"
            subtitle="Jeder Lauf ist über Blueprint-Hash und Herkunftskette belegt."
          />
          <CardBody className="p-0">
            {scans.length === 0 ? (
              <p className="px-5 py-6 text-sm text-titanium-500">Noch keine Prüfläufe.</p>
            ) : (
              <ul className="divide-y divide-titanium-800">
                {scans.map((scan) => (
                  <li key={scan.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm text-titanium-100">
                        <Link2 size={13} className="shrink-0 text-titanium-500" />
                        {scan.url ?? 'Blueprint-Analyse'}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-titanium-500">
                        {new Date(scan.observed_at).toLocaleString('de-DE')} · {scan.scope} · {scan.trigger}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-titanium-400">{scan.finding_count} Befund(e)</span>
                      <SeverityChip severity={scan.severity_max} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Darstellungshelfer
// ─────────────────────────────────────────────────────────────────────

/**
 * Mittelt die Kennzahlen über alle Sites. Sites ohne Scan bleiben außen vor
 * — ein ungeprüfter Blueprint darf den Gesamtwert weder heben noch senken.
 */
function aggregateScores(sites: SiteOverviewRow[]): {
  health: number | null; compliance: number | null; performance: number | null;
  risk: number | null; aiRisk: number | null;
} {
  const scored = sites.filter((s) => s.health !== null);
  if (scored.length === 0) return { health: null, compliance: null, performance: null, risk: null, aiRisk: null };

  const mean = (pick: (s: SiteOverviewRow) => number | null): number =>
    Math.round((scored.reduce((sum, s) => sum + (pick(s) ?? 0), 0) / scored.length) * 10) / 10;

  return {
    health: mean((s) => s.health),
    compliance: mean((s) => s.compliance),
    performance: mean((s) => s.performance),
    risk: mean((s) => s.risk),
    aiRisk: mean((s) => s.ai_risk),
  };
}

function scoreColor(value: number | null, higherIsBetter: boolean): string {
  if (value === null) return 'text-titanium-600';
  const good = higherIsBetter ? value >= 80 : value <= 20;
  const fair = higherIsBetter ? value >= 60 : value <= 40;
  if (good) return 'text-emerald-400';
  if (fair) return 'text-amber-400';
  return 'text-red-400';
}

function ScoreTile({ label, value, icon, higherIsBetter }: {
  label: string; value: number | null; icon: React.ReactNode; higherIsBetter: boolean;
}) {
  return (
    <div className="border border-titanium-800 bg-obsidian-800/60 px-4 py-3">
      <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
        {icon} {label}
      </p>
      <p className={`mt-2 font-display text-2xl font-semibold ${scoreColor(value, higherIsBetter)}`}>
        {value === null ? '—' : value}
      </p>
    </div>
  );
}

function MiniScore({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="text-right">
      <p className="font-mono text-[9px] uppercase tracking-wider text-titanium-600">{label}</p>
      <p className={`font-mono text-sm ${scoreColor(value, true)}`}>{value === null ? '—' : value}</p>
    </div>
  );
}

const SEVERITY_LABEL: Record<string, { text: string; className: string }> = {
  critical: { text: 'kritisch', className: 'border-red-900 text-red-300' },
  high: { text: 'hoch', className: 'border-orange-900 text-orange-300' },
  medium: { text: 'mittel', className: 'border-amber-900 text-amber-300' },
  low: { text: 'gering', className: 'border-titanium-700 text-titanium-400' },
  info: { text: 'Hinweis', className: 'border-titanium-800 text-titanium-500' },
};

function SeverityChip({ severity }: { severity: string | null }) {
  if (severity === null) {
    return <span className="border border-emerald-900 px-2 py-0.5 font-mono text-[10px] uppercase text-emerald-400">sauber</span>;
  }
  const entry = SEVERITY_LABEL[severity] ?? SEVERITY_LABEL.info;
  return <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase ${entry.className}`}>{entry.text}</span>;
}
