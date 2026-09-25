/**
 * /app/ai-systems/:id — Klassifizierung (HANDOFF §8).
 *
 * Gelesen wird ausschließlich aus `governance_assets` und `connector_registry`.
 * Die Durchsetzbarkeits-Klasse wird angezeigt, nicht gewählt — sie kommt aus
 * `shared/enforcement-classes.ts` (bzw. dem DB-Trigger am Connector).
 *
 * Risikostufe, Annex III und Art. 50 sind hier bearbeitbar, aber NICHT
 * speicherbar: `governanceApi` liest nur, und `governance-resources` kennt
 * kein Asset-Update (nur create/archive). Jede Abweichung vom gespeicherten
 * Stand trägt deshalb sichtbar „Entwurf · nicht gespeichert".
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, FileDown } from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { fetchTenantAssets, type DbGovernanceAsset } from '../governanceApi';
import { listConnectors, type ConnectorRegistryEntry } from '../gatesApi';
import {
  ANNEX_III_CATEGORIES,
  ANNEX_III_CATEGORY_LABEL,
  PROVIDER_ROLE_LABEL,
  type AnnexIIICategory,
  type ProviderRole,
} from '../../../lib/ai-act/annexCategories';
import { downloadConformityDossier } from '../../../lib/ai-act/conformityDossier';
import { useLang } from '../../../i18n/useLang';
import {
  OBLIGATIONS,
  TIERS,
  art50Of,
  classifyAsset,
  isAiSystemAsset,
  tierDefinition,
  tierOf,
  type TierId,
} from '../handoff/enforcementModel';
import { ClassBadge, DraftBadge, Panel, WarnToast, colorVar } from '../handoff/ui';
import { useTenantLoad } from '../handoff/useTenantLoad';

interface DetailData {
  systems: DbGovernanceAsset[];
  connectors: ConnectorRegistryEntry[];
}

async function loadDetail(tenantId: string): Promise<DetailData> {
  const [assets, connectors] = await Promise.all([
    fetchTenantAssets(tenantId),
    listConnectors(tenantId).catch((): ConnectorRegistryEntry[] => []),
  ]);
  return { systems: assets.filter(isAiSystemAsset), connectors };
}

function isAnnexCategory(v: unknown): v is AnnexIIICategory {
  return typeof v === 'string' && v in ANNEX_III_CATEGORY_LABEL;
}

export function AiSystemDetailView() {
  const { id } = useParams<{ id: string }>();
  const { activeTenantId } = useTenant();
  const { t, lang } = useLang();
  const [state] = useTenantLoad(activeTenantId, loadDetail);

  const systems = state.status === 'ready' ? state.data.systems : [];
  const connectors = state.status === 'ready' ? state.data.connectors : [];
  const asset = systems.find((s) => s.id === id) ?? null;

  return (
    <div className="rs-page rs-ui" data-testid="ai-system-detail">
      {state.status === 'error' && <WarnToast error>{t('loadFailed')}</WarnToast>}
      {state.status === 'idle' && <p className="rs-muted">{t('noTenant')}</p>}
      <div className="rs-classify">
        <Panel className="rs-panel--flush">
          <div className="rs-panel__head" style={{ padding: '12px 16px 0', marginBottom: 0 }}>
            <span className="rs-overline">{t('inventory')}</span>
          </div>
          <nav className="rs-syslist" aria-label={t('classifyPick')}>
            {state.status === 'loading' && <div className="rs-empty">{t('loading')}</div>}
            {state.status === 'ready' && systems.length === 0 && <div className="rs-empty">{t('systemsNone')}</div>}
            {systems.map((s) => (
              <Link
                key={s.id}
                to={`/app/ai-systems/${s.id}`}
                className="rs-syslist__item"
                aria-current={s.id === id ? 'page' : undefined}
              >
                <ClassBadge klasse={classifyAsset(s, connectors).klasse} />
                <span className="rs-ellipsis">{s.name}</span>
              </Link>
            ))}
          </nav>
        </Panel>

        {state.status === 'ready' && !asset ? (
          <Panel className="rs-panel--pad24" testId="ai-system-not-found">
            <p className="rs-muted">{t('systemNotFound')}</p>
            <Link to="/app/ai-systems" className="rs-chip-sm mt-3">
              {t('backToList')}
            </Link>
          </Panel>
        ) : asset ? (
          <ClassificationDetail key={asset.id} asset={asset} connectors={connectors} lang={lang} />
        ) : (
          <Panel className="rs-panel--pad24">
            <div className="rs-empty">{t('loading')}</div>
          </Panel>
        )}
      </div>
    </div>
  );
}

function ClassificationDetail({
  asset,
  connectors,
  lang,
}: {
  asset: DbGovernanceAsset;
  connectors: ConnectorRegistryEntry[];
  lang: 'de' | 'en';
}) {
  const { t } = useLang();
  const cls = useMemo(() => classifyAsset(asset, connectors), [asset, connectors]);
  const storedTier = tierOf(asset.ai_act_class);
  const storedAnnex = isAnnexCategory(asset.annex_iii_category) ? asset.annex_iii_category : null;
  const storedArt50 = art50Of(asset);

  const [tier, setTier] = useState<TierId | null>(storedTier);
  const [annex, setAnnex] = useState<AnnexIIICategory | null>(storedAnnex);
  const [art50, setArt50] = useState<boolean>(storedArt50 ?? false);

  useEffect(() => {
    setTier(storedTier);
    setAnnex(storedAnnex);
    setArt50(storedArt50 ?? false);
  }, [storedTier, storedAnnex, storedArt50]);

  const dirty = tier !== storedTier || annex !== storedAnnex || art50 !== (storedArt50 ?? false);
  const annexMeta = annex ? ANNEX_III_CATEGORIES.find((c) => c.id === annex) : null;

  function onDossier() {
    downloadConformityDossier({
      system: {
        name: asset.name,
        provider: asset.vendor,
        model: typeof asset.metadata?.model_name === 'string' ? (asset.metadata.model_name as string) : null,
        riskLabel: storedTier ? t(tierDefinition(storedTier).labelKey) : t('tierUnknown'),
        annexCategory: storedAnnex ? ANNEX_III_CATEGORY_LABEL[storedAnnex] : null,
        providerRole:
          asset.provider_role && asset.provider_role in PROVIDER_ROLE_LABEL
            ? PROVIDER_ROLE_LABEL[asset.provider_role as ProviderRole]
            : null,
        intendedPurpose: asset.intended_purpose ?? null,
        deploymentContext: asset.deployment_context ?? null,
        affectedGroups: asset.affected_groups ?? [],
        scope: asset.data_types.join(' · ') || null,
        owner: asset.owner_email,
      },
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Panel className="rs-panel--pad24">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="rs-overline rs-cyan" data-testid="classify-overline">
              {(cls.systemLabel ?? t('type'))} · {t('classPrefix')} {cls.klasse}
            </p>
            <h2 className="rs-h2 mt-2">{asset.name}</h2>
            <p className="rs-muted mt-2 max-w-2xl" data-testid="classify-reason">
              {cls.reason}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rs-chip-sm" onClick={onDossier}>
              <FileDown className="h-3.5 w-3.5" aria-hidden="true" /> {t('dossierBtn')}
            </button>
            <Link to="/app/policy-packs" className="rs-chip-sm rs-chip-sm--primary">
              {t('toEnforce')} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </Panel>

      <Panel className="rs-panel--pad20">
        <div className="rs-panel__head">
          <span className="rs-overline">{t('riskTier')}</span>
          <span className="flex items-center gap-2">
            <span className="rs-note">
              {t('storedTier', { tier: storedTier ? t(tierDefinition(storedTier).labelKey) : t('tierUnknown') })}
            </span>
            {dirty && <DraftBadge />}
          </span>
        </div>
        <div className="rs-tiers" role="group" aria-label={t('riskTier')}>
          {TIERS.map((def) => (
            <button
              key={def.id}
              type="button"
              className="rs-tier"
              style={colorVar(def.colorVar)}
              aria-pressed={tier === def.id}
              onClick={() => setTier(def.id)}
            >
              <span className="rs-tier__name">{t(def.labelKey)}</span>
              <span className="rs-tier__art">{def.article}</span>
            </button>
          ))}
        </div>
        {dirty && <p className="rs-note mt-3">{t('classifyDraftNote')}</p>}
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel className="rs-panel--pad20">
          <div className="rs-panel__head">
            <span className="rs-overline">{t('annexTitle')}</span>
            {annexMeta && <span className="rs-mono rs-cyan text-[11px]">{annexMeta.annexPoint}</span>}
          </div>
          <select
            className="rs-select"
            aria-label={t('annexTitle')}
            value={annex ?? ''}
            onChange={(e) => setAnnex(isAnnexCategory(e.target.value) ? e.target.value : null)}
          >
            <option value="">—</option>
            {ANNEX_III_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.annexPoint} · {c.label}
              </option>
            ))}
          </select>
          <p className="rs-note mt-2">
            {storedAnnex
              ? t('annexStored', {
                  cat: ANNEX_III_CATEGORY_LABEL[storedAnnex],
                  pt: ANNEX_III_CATEGORIES.find((c) => c.id === storedAnnex)?.annexPoint ?? '—',
                })
              : t('annexNone')}
          </p>
        </Panel>
        <Panel className="rs-panel--pad20">
          <div className="rs-panel__head">
            <span className="rs-overline">{t('transparency')}</span>
            <button
              type="button"
              role="switch"
              className="rs-toggle"
              aria-checked={art50}
              aria-label={t('art50Toggle')}
              onClick={() => setArt50((v) => !v)}
            />
          </div>
          <p className="rs-muted">{t('art50Note')}</p>
          <p className="rs-note mt-2">{storedArt50 === null ? t('art50Unknown') : null}</p>
        </Panel>
      </div>

      <Panel className="rs-panel--pad20" testId="obligations">
        <div className="rs-panel__head">
          <span className="rs-overline">{t('obligations')}</span>
        </div>
        {tier ? (
          OBLIGATIONS[tier].map((o) => (
            <div key={`${o.article}-${o.en}`} className="rs-obligation">
              <span className="rs-mono rs-cyan">{o.article}</span>
              <span>{lang === 'de' ? o.de : o.en}</span>
            </div>
          ))
        ) : (
          <p className="rs-muted">{t('tierUnknown')}</p>
        )}
      </Panel>
    </div>
  );
}
