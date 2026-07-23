// CeoCockpitView — Executive-Einstieg unter /app.
//
// Verdichtet vorhandene, RLS-gescopte Daten (Count-Helfer + KPI-Snapshot +
// Detail-Listen) zu der einen Antwort, die eine Geschäftsführung in 30
// Sekunden braucht: Gesamt-Score, Audit-Readiness, Top-3-Pflichten, Fristen.
// Nutzt ausschliesslich bestehende APIs — kein neues Backend.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, FileCheck2, Loader2, ShieldCheck,
  TrendingDown, TrendingUp, Minus, Clock, ChevronRight, Rocket, CheckCircle,
} from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { Card, CardHeader, CardBody } from '../../../enterprise-os/components/Card';
import { ScoreGauge } from '../../../enterprise-os/components/ScoreGauge';
import { Button } from '../../../enterprise-os/components/Button';
import { StatusBadge } from '../../../enterprise-os/components/Badge';
import { scoreLabel, scoreLevel } from './cockpitScore';
import { loadCockpitData, type CockpitData } from './cockpitData';
import { GovernanceBriefCard } from './GovernanceBriefCard';
import { ApiStatusCard } from '../../../features/api/ApiStatusCard';

export function CeoCockpitView() {
  const navigate = useNavigate();
  const { activeTenantId, tenants } = useTenant();
  const tenantName = tenants.find((t) => t.tenantId === activeTenantId)?.name ?? null;
  const [data, setData] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // First-time user detection: kein Assets/Data vorhanden
  const isFirstTime = data && !dismissed && (
    data.counts.incidents === 0 &&
    data.counts.dpias === 0 &&
    data.counts.dsr.total === 0 &&
    data.actions.length === 0
  );

  useEffect(() => {
    let cancelled = false;
    if (!activeTenantId) { setData(null); return; }
    setLoading(true); setError(null);

    loadCockpitData(activeTenantId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError((e as Error)?.message ?? String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [activeTenantId]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Kopf — immer sichtbar (auch ohne Session), damit /app stabil rendert. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">Übersicht</p>
          <h2 className="font-display font-bold text-2xl text-titanium-50 tracking-tight mt-1">
            {tenantName ? `Cockpit · ${tenantName}` : 'Governance-Cockpit'}
          </h2>
          <p className="text-sm text-titanium-400 mt-1">
            Ihr Risiko, Ihre Audit-Readiness und die dringendsten Pflichten — auf einen Blick.
          </p>
        </div>
        {activeTenantId && (
          <Link to="/app/cockpit/brief">
            <Button variant="primary" size="md">
              <FileCheck2 className="h-4 w-4" /> Prüfer-Mappe (PDF)
            </Button>
          </Link>
        )}
      </div>

      {isFirstTime && (
        <div className="bg-gradient-to-r from-emerald-950/40 to-cyan-950/40 border border-emerald-800 rounded-none p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <Rocket className="h-6 w-6 text-emerald-400 mt-0.5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-titanium-50">Willkommen im Governance-Cockpit!</h3>
                <p className="text-sm text-titanium-300 mt-1">
                  Drei Schritte zum Start: Registrieren Sie Ihre erste Komponente, erstellen Sie eine Policy, und aktivieren Sie Monitoring.
                </p>
              </div>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="text-titanium-400 hover:text-titanium-200 shrink-0"
              aria-label="Schließen"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/app/onboarding')}
              className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-semibold rounded-none transition-colors"
            >
              <Rocket className="h-4 w-4" /> Onboarding starten
            </button>
            <button
              onClick={() => navigate('/app/ai-systems')}
              className="inline-flex items-center justify-center gap-2 border border-titanium-700 hover:border-titanium-500 text-titanium-200 px-4 py-2 text-sm font-semibold rounded-none transition-colors"
            >
              <CheckCircle className="h-4 w-4" /> Komponente registrieren
            </button>
          </div>
        </div>
      )}

      <GovernanceBriefCard />

      {!activeTenantId && (
        <div className="py-12 text-center text-titanium-400">
          <ShieldCheck className="h-8 w-8 mx-auto mb-3 text-titanium-600" />
          <p className="text-sm">Bitte melden Sie sich an, um Ihr Governance-Cockpit zu sehen.</p>
          <Link to="/welcome" className="mt-4 inline-flex items-center gap-2 text-security-500 text-sm font-semibold">
            Zum Login <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-rose-300 bg-rose-950/40 border border-rose-900 p-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center gap-2 text-sm text-titanium-400 py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Cockpit wird geladen …
        </div>
      )}

      {data && (
        <>
          {/* Zone 1 — Hero: Score + Readiness */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-titanium-900">
            <Card className="md:col-span-1 flex flex-col items-center justify-center gap-3 py-6 bg-obsidian-900">
              <ScoreGauge score={data.score} size={128} label="Governance-Score" />
              <StatusBadge level={scoreLevel(data.score)} label={scoreLabel(data.score)} />
            </Card>

            <Card className="md:col-span-1 bg-obsidian-900">
              <CardBody className="flex flex-col justify-center h-full">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">Audit-Readiness (indikativ)</p>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="font-mono text-5xl font-bold text-titanium-50">
                    {data.readiness === null ? '–' : `${data.readiness}%`}
                  </span>
                  {data.readinessTrend && <TrendChip {...data.readinessTrend} />}
                </div>
                <p className="mt-3 text-xs text-titanium-400">
                  {data.readiness === null
                    ? 'Noch kein KPI-Snapshot vorhanden. Der Wert erscheint, sobald die erste tägliche Auswertung gelaufen ist.'
                    : 'Anteil Ihrer Objekte mit zugeordneten Kontrollen. Höher = besser prüfbar.'}
                </p>
              </CardBody>
            </Card>

            <Card className="md:col-span-1 bg-obsidian-900">
              <CardBody className="grid grid-cols-2 gap-4 h-full content-center">
                <Metric label="Offene Vorfälle" value={data.counts.incidents} danger={data.counts.incidents > 0} />
                <Metric label="DSR überfällig" value={data.counts.dsr.overdue} danger={data.counts.dsr.overdue > 0} />
                <Metric label="Offene DSFA" value={data.counts.dpias} />
                <Metric label="Vendoren ohne AVV" value={data.counts.vendorsNoDpa} danger={data.counts.vendorsNoDpa > 0} />
              </CardBody>
            </Card>
          </div>

          {/* Zone 2/3 — Top-3-Handlungen mit Fristen */}
          <Card>
            <CardHeader
              eyebrow="Priorität"
              title="Das müssen Sie als Nächstes tun"
              subtitle="Nach Schweregrad und Fristnähe sortiert."
            />
            <CardBody className="p-0">
              {data.actions.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-titanium-400">
                  <ShieldCheck className="h-6 w-6 mx-auto mb-2 text-risk-passed" />
                  Keine dringenden Pflichten offen. Gut gemacht.
                </div>
              ) : (
                <ul className="divide-y divide-titanium-800">
                  {data.actions.map((a, i) => (
                    <li key={a.id}>
                      <Link
                        to={a.href}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-obsidian-800 transition-colors"
                      >
                        <span className="font-mono text-xs text-titanium-600 w-5 shrink-0">{i + 1}</span>
                        <StatusBadge level={a.level} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-titanium-50 truncate">{a.title}</p>
                          <p className="text-xs text-titanium-400 flex items-center gap-1.5 mt-0.5">
                            <Clock className="h-3 w-3" /> {a.detail}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-titanium-600 shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Zone 4 — Posture-Abdeckung */}
          {data.posture && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-titanium-900">
              <CoverageCard label="Richtlinien aktiv" percent={data.posture.policiesEnabledPercent} />
              <CoverageCard label="Evidence-Abdeckung" percent={data.posture.assetEvidencePercent} />
              <CoverageCard label="Kontroll-Mapping" percent={data.posture.assetMappingsPercent} />
            </div>
          )}

          {/* Zone 5 — API-Status */}
          <ApiStatusCard />

          <p className="text-[11px] text-titanium-600 font-mono">
            {data.lastUpdated ? `KPI-Stand: ${data.lastUpdated}` : 'KPI-Snapshot noch nicht verfügbar — Score aus Echtzeit-Zählern.'}
            {' · '}
            <Link to="/app/overview" className="hover:text-titanium-300 underline">Klassische Übersicht</Link>
          </p>
        </>
      )}
    </div>
  );
}

function TrendChip({ direction, percent }: { direction: 'up' | 'down' | 'flat'; percent: number }) {
  if (direction === 'flat' || percent === 0) {
    return <span className="inline-flex items-center gap-1 text-xs text-titanium-500"><Minus className="h-3 w-3" /> stabil</span>;
  }
  const up = direction === 'up';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono ${up ? 'text-risk-passed' : 'text-risk-high'}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {percent}%
    </span>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div>
      <p className={`font-mono text-2xl font-bold ${danger ? 'text-rose-300' : 'text-titanium-50'}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-titanium-500 font-mono mt-0.5">{label}</p>
    </div>
  );
}

function CoverageCard({ label, percent }: { label: string; percent: number }) {
  const pct = Math.round(Math.max(0, Math.min(100, percent)));
  return (
    <div className="bg-obsidian-900 p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] uppercase tracking-wider text-titanium-500 font-mono">{label}</p>
        <span className="font-mono text-sm font-bold text-titanium-50">{pct}%</span>
      </div>
      <div className="mt-2 h-1.5 bg-titanium-900 w-full">
        <div
          className="h-full bg-security-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
