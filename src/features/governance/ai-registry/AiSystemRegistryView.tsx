/**
 * /app/ai-systems — KI-Inventar (HANDOFF §7).
 *
 * Nur echte Zeilen aus `governance_assets` (Typ `ai_system`). Die frühere
 * Fassung zeigte ohne Mandantendaten fünf Beispielsysteme und ein
 * Registrierungsformular, das nichts speicherte — beides ist entfernt.
 *
 * Klasse: `classifyAsset` (Connector-Klasse aus dem DB-Trigger, sonst
 * `enforcementClassOf(metadata.system_type)`, sonst vorsichtig C).
 * Zeilenklick → /app/ai-systems/:id (Klassifizierung).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../../core/access/TenantProvider';
import { fetchTenantAssets, type DbGovernanceAsset } from '../governanceApi';
import { listConnectors, type ConnectorRegistryEntry } from '../gatesApi';
import { useLang } from '../../../i18n/useLang';
import {
  CLASS_ORDER,
  art50Of,
  classifyAsset,
  isAiSystemAsset,
  tierOf,
  type AssetClassification,
  type EnforcementClass,
} from '../handoff/enforcementModel';
import { ClassBadge, Panel, TierPill, WarnToast } from '../handoff/ui';
import { useTenantLoad } from '../handoff/useTenantLoad';

interface Row {
  asset: DbGovernanceAsset;
  cls: AssetClassification;
}

async function loadRows(tenantId: string): Promise<Row[]> {
  const [assets, connectors] = await Promise.all([
    fetchTenantAssets(tenantId),
    listConnectors(tenantId).catch((): ConnectorRegistryEntry[] => []),
  ]);
  return assets
    .filter(isAiSystemAsset)
    .map((asset) => ({ asset, cls: classifyAsset(asset, connectors) }));
}

type Filter = 'all' | EnforcementClass;

const FILTER_KEY: Record<EnforcementClass, 'filterA' | 'filterB' | 'filterC' | 'filterD'> = {
  A: 'filterA',
  B: 'filterB',
  C: 'filterC',
  D: 'filterD',
};

export function AiSystemRegistryView() {
  const { activeTenantId } = useTenant();
  const { t } = useLang();
  const [filter, setFilter] = useState<Filter>('all');
  const [state] = useTenantLoad(activeTenantId, loadRows);

  const rows = state.status === 'ready' ? state.data : [];
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: rows.length, A: 0, B: 0, C: 0, D: 0 };
    for (const r of rows) c[r.cls.klasse] += 1;
    return c;
  }, [rows]);
  const visible = filter === 'all' ? rows : rows.filter((r) => r.cls.klasse === filter);

  return (
    <div className="rs-page rs-ui" data-testid="ai-systems-view">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="rs-filters" role="group" aria-label={t('enfClass')}>
          {(['all', ...CLASS_ORDER] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              className="rs-filter"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? t('all') : t(FILTER_KEY[f])}
              <span className="rs-filter__count">{state.status === 'ready' ? counts[f] : '—'}</span>
            </button>
          ))}
        </div>
        <Link to="/app/ai-systems/agents" className="rs-chip-sm">
          Agent Registry
        </Link>
      </div>

      {state.status === 'error' && <WarnToast error>{t('loadFailed')}</WarnToast>}
      {state.status === 'idle' && <p className="rs-muted">{t('noTenant')}</p>}

      <Panel className="rs-panel--flush">
        <div className="rs-table">
          <div className="rs-table__inner">
            <div className="rs-trow rs-trow--head rs-trow--systems" role="row">
              <span>{t('colSystem')}</span>
              <span>{t('type')}</span>
              <span>{t('enfClass')}</span>
              <span>{t('riskTier')}</span>
              <span>{t('colArt50')}</span>
              <span>{t('colStatus')}</span>
            </div>
            {state.status === 'loading' && <div className="rs-empty">{t('loading')}</div>}
            {state.status === 'ready' && rows.length === 0 && (
              <div className="rs-empty" data-testid="ai-systems-empty">
                <p className="font-semibold text-[color:var(--color-rs-fg-0)]">{t('systemsNone')}</p>
                <p className="mt-1">{t('systemsNoneSub')}</p>
              </div>
            )}
            {visible.map(({ asset, cls }) => {
              const art50 = art50Of(asset);
              const archived = asset.status === 'archived';
              return (
                <Link
                  key={asset.id}
                  to={`/app/ai-systems/${asset.id}`}
                  className="rs-trow rs-trow--systems"
                  data-testid="ai-system-row"
                >
                  <span className="min-w-0">
                    <span className="rs-cell-main block">{asset.name}</span>
                    <span className="rs-cell-sub block">{asset.owner_email ?? t('noOwner')}</span>
                  </span>
                  <span className="rs-ellipsis">{cls.systemLabel ?? asset.vendor ?? '—'}</span>
                  <span>
                    <ClassBadge klasse={cls.klasse} />
                  </span>
                  <span>
                    <TierPill tier={tierOf(asset.ai_act_class)} />
                  </span>
                  <span style={{ color: art50 ? 'var(--color-rs-success)' : 'var(--color-rs-fg-3)' }}>
                    {art50 ? t('art50Active') : '—'}
                  </span>
                  <span className="rs-ellipsis" style={{ color: archived ? 'var(--color-rs-fg-3)' : 'var(--color-rs-fg-1)' }}>
                    {archived ? t('stArchived') : cls.source === 'connector' ? t('stMonitored') : t('stNotCaptured')}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </Panel>
    </div>
  );
}
