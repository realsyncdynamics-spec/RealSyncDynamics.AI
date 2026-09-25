/**
 * /app/dashboard — Übersicht im Handoff-Raster (HANDOFF §6).
 *
 * Score: `CockpitData.score` aus cockpitScore (computeGovernanceScoreIfReliable)
 * — dieselbe Zahl wie im Command Center darunter. Die Prototyp-Formel
 * (`38 + klassifiziert/8×26 + …`) ist bewusst NICHT übernommen.
 * Rahmenwerk-Balken nur, wo echte Control-Mappings existieren; ISO 42001
 * erscheint nur mit eigenen Mappings.
 * Klassenbalken: KI-Assets + Connectoren, Klasse über classifyAsset.
 * Alles andere: leerer Zustand statt Beispielzahl.
 */
import { Link } from 'react-router-dom';
import { fetchTenantAssets, fetchTenantEvidence, fetchTenantPolicies } from '../governanceApi';
import { listConnectors } from '../gatesApi';
import { listTenantMappings } from '../../policy-packs/policyPacksApi';
import { listScanRuns } from '../scans/scansApi';
import type { CockpitData } from '../cockpit/cockpitData';
import { useLang } from '../../../i18n/useLang';
import {
  CLASS_COLOR_VAR,
  CLASS_ORDER,
  classDistribution,
  classifiedSystemClasses,
  classifyAsset,
  frameworkProgress,
  isAiSystemAsset,
  shortHash,
  type EnforcementClass,
} from './enforcementModel';
import { ENFORCEMENT_CLASSES } from '../../../../shared/enforcement-classes';
import { ClassBadge, Panel, StatCard, WarnToast, formatDateTime } from './ui';
import { settled, useTenantLoad } from './useTenantLoad';

const FRAMEWORKS: ReadonlyArray<{ id: string; label: string; color: string }> = [
  { id: 'GDPR', label: 'DSGVO', color: 'var(--color-rs-primary)' },
  { id: 'EU_AI_ACT', label: 'EU AI Act', color: 'var(--color-rs-warning)' },
  { id: 'ISO_42001', label: 'ISO 42001', color: 'var(--color-rs-violet)' },
];

async function loadOverview(tenantId: string) {
  const [assetsR, policiesR, connectorsR, evidenceR, mappingsR, scansR] = await Promise.allSettled([
    fetchTenantAssets(tenantId),
    fetchTenantPolicies(tenantId),
    listConnectors(tenantId),
    fetchTenantEvidence(tenantId, 4),
    listTenantMappings(tenantId),
    listScanRuns(tenantId, { limit: 1 }),
  ]);
  const failures: string[] = [];
  return {
    assets: settled(assetsR, [], 'assets', failures),
    policies: settled(policiesR, [], 'policies', failures),
    connectors: settled(connectorsR, [], 'connectors', failures),
    evidence: settled(evidenceR, [], 'evidence', failures),
    mappings: settled(mappingsR, [], 'mappings', failures),
    scans: settled(scansR, [], 'scans', failures),
    failures,
  };
}

interface AttentionItem {
  id: string;
  title: string;
  reason: string;
  href: string;
  klasse: EnforcementClass | null;
}

export function HandoffOverview({
  activeTenantId,
  data,
}: {
  activeTenantId: string | null;
  data: CockpitData | null;
}) {
  const { t, lang } = useLang();
  const [state] = useTenantLoad(activeTenantId, loadOverview);
  if (!activeTenantId) return null;

  const ready = state.status === 'ready' ? state.data : null;
  const has = (name: string) => ready !== null && !ready.failures.some((f) => f.startsWith(`${name}:`));

  const aiAssets = ready ? ready.assets.filter(isAiSystemAsset) : [];
  const unclassified = aiAssets.filter((a) => a.ai_act_class === 'unknown');
  const high = aiAssets.filter((a) => a.ai_act_class === 'high' || a.ai_act_class === 'prohibited');
  const enabledPolicies = ready ? ready.policies.filter((p) => p.enabled) : [];
  const logOnly = enabledPolicies.filter((p) => p.action === 'log');
  const classes = ready ? classifiedSystemClasses(ready.assets, ready.connectors) : [];
  const dist = classDistribution(classes);
  const fw = ready ? frameworkProgress(ready.mappings, FRAMEWORKS.map((f) => f.id)) : [];

  const attention: AttentionItem[] = [];
  if (ready) {
    for (const a of high) {
      const cls = classifyAsset(a, ready.connectors);
      if (!ENFORCEMENT_CLASSES[cls.klasse].kannBlockieren) {
        attention.push({ id: `high-${a.id}`, title: a.name, reason: t('attHighNoBlock'), href: `/app/ai-systems/${a.id}`, klasse: cls.klasse });
      }
    }
    for (const a of unclassified) {
      attention.push({
        id: `unc-${a.id}`,
        title: a.name,
        reason: t('attUnclassified'),
        href: `/app/ai-systems/${a.id}`,
        klasse: classifyAsset(a, ready.connectors).klasse,
      });
    }
  }
  for (const action of data?.actions ?? []) {
    attention.push({ id: `act-${action.id}`, title: action.title, reason: `${t('attAction')} · ${action.detail}`, href: action.href, klasse: null });
  }

  const score = data?.score ?? null;
  const cockpitHas = (name: string) =>
    data !== null && !data.partialFailures.some((f) => f.startsWith(`${name}:`));
  const evidenceTotal = cockpitHas('evidence-total') ? data!.evidenceHealth.totalCount : null;
  const evidenceHashed = cockpitHas('evidence-hashed') ? data!.evidenceHealth.hashedCount : null;
  const trend = data?.readinessTrend ?? null;
  const latestScan = ready?.scans[0] ?? null;
  const classifiedAi = Math.max(0, aiAssets.length - unclassified.length);
  const aiReadiness = aiAssets.length === 0 ? null : Math.round((classifiedAi / aiAssets.length) * 100);
  const riskBuckets = data?.riskDistribution ?? [];
  const risk = (id: string) => riskBuckets.find((bucket) => bucket.id === id)?.count ?? 0;
  const evidenceHealth = data?.evidenceHealth ?? null;
  const eventStream = data?.recentEvents ?? [];
  const assetFlows = data?.assetFlows ?? [];

  return (
    <div className="rs-apppage rs-ui" data-testid="handoff-overview">
      {state.status === 'error' && <WarnToast error>{t('loadFailed')}</WarnToast>}

      <section aria-labelledby="management-cockpit-heading" className="mb-6 space-y-4" data-testid="management-cockpit">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="rs-overline">Executive Governance Posture</span>
            <h2 id="management-cockpit-heading" className="rs-h2 mt-1">Management Cockpit</h2>
            <p className="rs-note mt-1">Mandantenstatus aus realen Scans, Findings, Assets, Evidence und Runtime-Ereignissen.</p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Schnellaktionen">
            <Link to="/app/websites" className="rs-btn rs-btn--secondary">Website scannen</Link>
            <Link to="/app/ai-systems" className="rs-btn rs-btn--secondary">KI-System erfassen</Link>
            <Link to="/app/vendors" className="rs-btn rs-btn--secondary">Vendor erfassen</Link>
            <Link to="/app/dpias" className="rs-btn rs-btn--secondary">DSFA starten</Link>
            <Link to="/app/incidents" className="rs-btn rs-btn--secondary">Incident melden</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
          <Panel className="xl:col-span-3 rs-panel--pad20" testId="management-score">
            <span className="rs-overline">Governance Score</span>
            <div className="mt-4 flex items-end gap-2">
              <span className="rs-mono text-4xl font-semibold" style={{ color: 'var(--color-rs-fg)' }}>
                {score === null ? '—' : score}
              </span>
              {score !== null && <span className="rs-note mb-1">/ 100</span>}
            </div>
            <p className="rs-note mt-2">{score === null ? t('scoreNone') : t('appScoreSource')}</p>
            {data?.lastUpdated && (
              <p className="rs-note rs-mono mt-3">Stand {data.lastUpdated} · Mandant</p>
            )}
          </Panel>

          <Panel className="xl:col-span-5 rs-panel--pad20" testId="management-risk-heatmap">
            <div className="rs-panel__head">
              <span className="rs-overline">Risk Heatmap</span>
              <Link to="/app/risks" className="rs-note rs-cyan">Risiko-Register →</Link>
            </div>
            {data === null ? (
              <p className="rs-note mt-4">{t('loading')}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
                {[
                  ['critical', 'Kritisch', 'var(--color-rs-danger)'],
                  ['high', 'Hoch', 'var(--color-rs-warning)'],
                  ['medium', 'Mittel', '#E0B75A'],
                  ['low', 'Niedrig', 'var(--color-rs-cyan)'],
                  ['passed', 'Stabil', '#69C18E'],
                ].map(([id, label, color]) => (
                  <div key={id} className="border p-3" style={{ borderColor: 'var(--color-rs-line)' }}>
                    <div className="rs-mono text-2xl font-semibold" style={{ color }}>{risk(id)}</div>
                    <div className="rs-note mt-1">{label}</div>
                  </div>
                ))}
              </div>
            )}
            <p className="rs-note mt-3">Verteilung aus den Risk-Scores der registrierten Governance-Assets.</p>
          </Panel>

          <Panel className="xl:col-span-4 rs-panel--pad20" testId="management-ai-readiness">
            <div className="rs-panel__head">
              <span className="rs-overline">EU AI Act Readiness</span>
              <Link to="/app/ai-systems" className="rs-note rs-cyan">KI-Systeme →</Link>
            </div>
            <div className="mt-4 flex items-end gap-2">
              <span className="rs-mono text-4xl font-semibold" style={{ color: 'var(--color-rs-fg)' }}>
                {aiReadiness === null ? '—' : `${aiReadiness}%`}
              </span>
            </div>
            <p className="rs-note mt-1">Klassifizierungsgrad · keine Konformitätsbescheinigung</p>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <MiniMetric label="KI-Systeme" value={has('assets') ? aiAssets.length : null} />
              <MiniMetric label="High Risk" value={has('assets') ? high.length : null} />
              <MiniMetric label="Unklassifiziert" value={has('assets') ? unclassified.length : null} />
            </div>
          </Panel>

          <Panel className="xl:col-span-4 rs-panel--pad20" testId="management-assets">
            <div className="rs-panel__head">
              <span className="rs-overline">Überwachter Scope</span>
              <Link to="/app/assets" className="rs-note rs-cyan">Assets →</Link>
            </div>
            {assetFlows.length === 0 ? (
              <p className="rs-note mt-4">{data ? 'Noch keine Assets im Register.' : t('loading')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 mt-4">
                {assetFlows.slice(0, 6).map((flow) => (
                  <Link key={flow.type} to={flow.href} className="border p-3 hover:border-[var(--color-rs-cyan)]" style={{ borderColor: 'var(--color-rs-line)' }}>
                    <div className="rs-mono text-2xl font-semibold" style={{ color: 'var(--color-rs-fg)' }}>{flow.count}</div>
                    <div className="rs-note mt-1">{flow.label}</div>
                    {flow.highRisk > 0 && <div className="rs-note mt-1" style={{ color: 'var(--color-rs-warning)' }}>{flow.highRisk} erhöht</div>}
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel className="xl:col-span-4 rs-panel--pad20" testId="management-live-audit">
            <div className="rs-panel__head">
              <span className="rs-overline">Live Audit Status</span>
              <Link to="/app/websites" className="rs-note rs-cyan">Scans →</Link>
            </div>
            {!has('scans') ? (
              <p className="rs-note mt-4">{t('unavailable')}</p>
            ) : !latestScan ? (
              <p className="rs-note mt-4">Noch kein Scan vorhanden.</p>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="rs-h3">{latestScan.status}</span>
                  <span className="rs-note rs-mono">{formatDateTime(latestScan.completed_at ?? latestScan.created_at, lang)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <MiniMetric label="Findings" value={latestScan.finding_count} />
                  <MiniMetric label="Max. Severity" value={latestScan.severity_max ?? '—'} />
                </div>
                {latestScan.duration_ms !== null && <p className="rs-note rs-mono">Dauer {Math.round(latestScan.duration_ms / 1000)} s</p>}
                {latestScan.error_message && <p className="rs-note" style={{ color: 'var(--color-rs-danger)' }}>{latestScan.error_message}</p>}
              </div>
            )}
          </Panel>

          <Panel className="xl:col-span-4 rs-panel--pad20" testId="management-evidence-health">
            <div className="rs-panel__head">
              <span className="rs-overline">Evidence Health</span>
              <Link to="/app/evidence" className="rs-note rs-cyan">Evidence Hub →</Link>
            </div>
            <div className="mt-4 flex items-end gap-2">
              <span className="rs-mono text-4xl font-semibold" style={{ color: 'var(--color-rs-fg)' }}>
                {evidenceHealth?.percent === null || evidenceHealth === null ? '—' : `${evidenceHealth.percent}%`}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <MiniMetric label="Dokumente" value={evidenceHealth?.totalCount ?? null} />
              <MiniMetric label="Gehasht" value={evidenceHealth?.hashedCount ?? null} />
              <MiniMetric label="Neu 24h" value={evidenceHealth?.newEvidence24h ?? null} />
            </div>
            <p className="rs-note mt-3">{evidenceHealth?.label ?? 'Noch nicht bewertet'}</p>
          </Panel>

          <Panel className="xl:col-span-12 rs-panel--pad20" testId="management-timeline">
            <div className="rs-panel__head">
              <span className="rs-overline">Executive Timeline</span>
              <Link to="/app/activity" className="rs-note rs-cyan">Aktivität →</Link>
            </div>
            {eventStream.length === 0 ? (
              <p className="rs-note mt-4">{data ? 'Noch keine Governance-Aktivität protokolliert.' : t('loading')}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 mt-4">
                {eventStream.slice(0, 8).map((event) => (
                  <div key={event.id} className="border p-3" style={{ borderColor: 'var(--color-rs-line)' }}>
                    <div className="rs-note rs-mono">{formatDateTime(event.createdAt, lang)}</div>
                    <div className="rs-cell-main mt-2">{event.title}</div>
                    <div className="rs-note mt-1">{event.source} · {event.riskLevel}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </section>

      <div className="rs-dash">
        <Panel className="rs-dash__score rs-panel--pad20" testId="overview-score">
          <div className="rs-score">
            <span className="rs-overline self-start">{t('complianceScore')}</span>
            <div className="rs-score__ring">
              <svg viewBox="0 0 160 160" width="160" height="160" aria-hidden="true">
                <circle cx="80" cy="80" r="70" fill="none" stroke="var(--color-rs-bg-3)" strokeWidth="10" />
                {score !== null && (
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    fill="none"
                    stroke="var(--color-rs-cyan)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${(Math.max(0, Math.min(100, score)) / 100) * 2 * Math.PI * 70} ${2 * Math.PI * 70}`}
                    transform="rotate(-90 80 80)"
                  />
                )}
              </svg>
              <div className="rs-score__value" data-testid="overview-score-value">
                {score === null ? '—' : score}
              </div>
            </div>
            {score === null ? (
              <div>
                <div className="rs-h3">{t('scoreNone')}</div>
                <p className="rs-note mt-1">{t('scoreNoneSub')}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                {trend && (
                  <div className="rs-score__delta">
                    {t('trend30', { dir: trend.direction === 'down' ? '−' : trend.direction === 'up' ? '+' : '±', n: trend.percent })}
                  </div>
                )}
                <p className="rs-note text-center" data-testid="overview-score-source">{t('appScoreSource')}</p>
              </div>
            )}
            <div className="flex w-full flex-col gap-3">
              <span className="rs-note self-start">{t('fwBars')}</span>
              {fw.length === 0 ? (
                <p className="rs-note self-start">{ready ? t('fwNone') : '—'}</p>
              ) : (
                fw.map((f) => {
                  const meta = FRAMEWORKS.find((x) => x.id === f.framework)!;
                  return (
                    <div key={f.framework} className="rs-fwbar">
                      <div className="rs-fwbar__row">
                        <span>{meta.label}</span>
                        <span className="rs-mono">
                          {f.implemented}/{f.total}
                        </span>
                      </div>
                      <div className="rs-fwbar__track">
                        <div className="rs-fwbar__fill" style={{ width: `${f.percent}%`, background: meta.color }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Panel>

        <StatCard
          label={t('kSystems')}
          value={has('assets') ? aiAssets.length : null}
          sub={has('assets') ? (aiAssets.length === 0 ? t('kSystemsNone') : t('kSystemsSub', { n: unclassified.length })) : null}
          testId="kpi-systems"
        />
        <StatCard
          label={t('kHigh')}
          value={has('assets') ? high.length : null}
          sub={has('assets') ? t('kHighSubReal') : null}
          accent="var(--color-rs-warning)"
          testId="kpi-high"
        />
        <StatCard
          label={t('kPolicies')}
          value={has('policies') ? enabledPolicies.length : null}
          sub={has('policies') ? t('kPoliciesSubReal', { n: logOnly.length }) : null}
          testId="kpi-policies"
        />
        <StatCard
          label={t('kEvidence')}
          value={evidenceTotal}
          sub={evidenceHashed === null ? null : t('kEvidenceSubReal', { n: evidenceHashed })}
          accent="var(--color-rs-cyan)"
          testId="kpi-evidence"
        />

        <Panel className="rs-dash__wide" testId="overview-classes">
          <div className="rs-panel__head">
            <span className="rs-overline">{t('enforceClasses')}</span>
            <span className="rs-note rs-mono">{classes.length}</span>
          </div>
          {classes.length === 0 ? (
            <p className="rs-note">{ready ? t('classBarNone') : t('loading')}</p>
          ) : (
            <>
              <div className="rs-stack" role="img" aria-label={CLASS_ORDER.map((k) => `${k}: ${dist[k]}`).join(', ')}>
                {CLASS_ORDER.map((k) =>
                  dist[k] > 0 ? (
                    <div key={k} style={{ width: `${(dist[k] / classes.length) * 100}%`, background: CLASS_COLOR_VAR[k] }} />
                  ) : null,
                )}
              </div>
              <div className="rs-legend">
                {CLASS_ORDER.map((k) => (
                  <span key={k}>
                    <span className="rs-legend__dot" style={{ background: CLASS_COLOR_VAR[k] }} />
                    {k} · {ENFORCEMENT_CLASSES[k].titel.split(' — ')[0]} <span className="rs-mono">{dist[k]}</span>
                  </span>
                ))}
              </div>
            </>
          )}
          <p className="rs-note mt-3">{t('classBarSource')}</p>
        </Panel>

        <Panel className="rs-dash__wide" testId="overview-evidence">
          <div className="rs-panel__head">
            <span className="rs-overline">{t('lastEvidence')}</span>
            <Link to="/app/evidence" className="rs-note rs-cyan">
              {t('navEvidence')} →
            </Link>
          </div>
          {!ready ? (
            <p className="rs-note">{t('loading')}</p>
          ) : ready.evidence.length === 0 ? (
            <p className="rs-note">{has('evidence') ? t('evidenceNone') : t('unavailable')}</p>
          ) : (
            ready.evidence.map((e) => (
              <div key={e.id} className="rs-evrow">
                <span className="min-w-0">
                  <span className="rs-cell-main block">{e.title}</span>
                  <span className="rs-cell-sub block rs-mono">{formatDateTime(e.created_at, lang)}</span>
                </span>
                <span className="rs-mono text-[11px]" style={{ color: 'var(--color-rs-fg-2)' }} title={e.content_hash ?? undefined}>
                  {shortHash(e.content_hash, 10)}
                </span>
              </div>
            ))
          )}
        </Panel>
      </div>

      <section aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="rs-overline mb-3">
          {t('attention')}
        </h2>
        {!ready ? (
          <p className="rs-note">{t('loading')}</p>
        ) : attention.length === 0 ? (
          <Panel>
            <p className="rs-note" data-testid="attention-empty">
              {t('attentionNone')}
            </p>
          </Panel>
        ) : (
          <div className="rs-attention">
            {attention.slice(0, 3).map((item) => (
              <Link key={item.id} to={item.href} className="rs-panel rs-attention__card" data-testid="attention-item">
                <span className="flex items-center gap-2">
                  {item.klasse && <ClassBadge klasse={item.klasse} />}
                  <span className="rs-cell-main">{item.title}</span>
                </span>
                <span className="rs-note">{item.reason}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="border p-3" style={{ borderColor: 'var(--color-rs-line)' }}>
      <div className="rs-mono text-xl font-semibold" style={{ color: 'var(--color-rs-fg)' }}>
        {value === null ? '—' : value}
      </div>
      <div className="rs-note mt-1">{label}</div>
    </div>
  );
}
