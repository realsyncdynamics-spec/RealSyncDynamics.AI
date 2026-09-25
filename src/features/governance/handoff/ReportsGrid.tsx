/**
 * /app/reports — vier Berichtskarten (HANDOFF §11), über dem bestehenden
 * Mandanten-Snapshot (ComplianceReportView).
 *
 * Jede Karte nutzt einen Pfad, den es im Repo schon gibt — oder sagt
 * ehrlich „Noch nicht verfügbar". Kein simulierter Fortschritt, kein
 * erfundener Hash: Zeit, Zähler und SHA-256 stammen aus dem erzeugten
 * Artefakt selbst.
 *
 *   DSGVO Art. 30      → nicht verfügbar (VVT-Ansicht nutzt Beispieldaten)
 *   EU AI Act Dossier  → buildConformityDossier + renderDossierMarkdown
 *   Evidence Bundle    → exportEvidenceBundle (evidence-vault-export)
 *   Management Summary → /app/cockpit/brief (Prüfer-Mappe, SHA-256-Anker)
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileText } from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { fetchTenantAssets, type DbGovernanceAsset } from '../governanceApi';
import { exportEvidenceBundle } from '../../evidence-vault/evidenceVaultApi';
import { listDatasets } from '../aiActDataGovernanceApi';
import { buildConformityDossier, renderDossierMarkdown } from '../../../lib/ai-act/conformityDossier';
import { ANNEX_III_CATEGORY_LABEL, type AnnexIIICategory } from '../../../lib/ai-act/annexCategories';
import { sha256HexOfString } from '../../../lib/provenance';
import { useLang } from '../../../i18n/useLang';
import { isAiSystemAsset, shortHash, tierDefinition, tierOf } from './enforcementModel';
import { Panel, colorVar, formatDateTime } from './ui';
import { useTenantLoad } from './useTenantLoad';

type RunState =
  | { status: 'draft' }
  | { status: 'running' }
  | { status: 'ready'; meta: string }
  | { status: 'failed'; message: string };

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function StatusPill({ state }: { state: RunState | 'na' | 'link' }) {
  const { t } = useLang();
  if (state === 'na') return <span className="rs-tierpill">{t('repNa')}</span>;
  if (state === 'link') return <span className="rs-tierpill" style={colorVar('var(--color-rs-success)')}>{t('stReady')}</span>;
  const map = {
    draft: { label: t('stDraft'), color: 'var(--color-rs-fg-3)' },
    running: { label: t('stRun'), color: 'var(--color-rs-cyan)' },
    ready: { label: t('stReady'), color: 'var(--color-rs-success)' },
    failed: { label: t('repFailed'), color: 'var(--color-rs-danger)' },
  } as const;
  const m = map[state.status];
  return (
    <span className="rs-tierpill" style={colorVar(m.color)}>
      {m.label}
    </span>
  );
}

export function ReportsGrid() {
  const { activeTenantId } = useTenant();
  const { t, lang } = useLang();
  const [assetsState] = useTenantLoad(activeTenantId, fetchTenantAssets);
  const systems: DbGovernanceAsset[] =
    assetsState.status === 'ready' ? assetsState.data.filter(isAiSystemAsset) : [];
  const [systemId, setSystemId] = useState<string>('');
  const [dossier, setDossier] = useState<RunState>({ status: 'draft' });
  const [bundle, setBundle] = useState<RunState>({ status: 'draft' });

  const selected = systems.find((s) => s.id === systemId) ?? systems[0] ?? null;

  async function onDossier() {
    if (!activeTenantId || !selected) return;
    setDossier({ status: 'running' });
    try {
      const datasets = await listDatasets(activeTenantId)
        .then((rows) =>
          rows
            .filter((d) => (d.ai_system_ref ?? '').toLowerCase() === selected.name.toLowerCase())
            .map((d) => ({
              name: d.name,
              role: d.dataset_role,
              containsPersonalData: d.contains_personal_data,
              legalBasis: d.legal_basis,
              biasAssessment: d.bias_assessment,
            })),
        )
        .catch(() => []);
      const tier = tierOf(selected.ai_act_class);
      const annex = selected.annex_iii_category as AnnexIIICategory | null | undefined;
      const built = buildConformityDossier({
        system: {
          name: selected.name,
          provider: selected.vendor,
          riskLabel: tier ? t(tierDefinition(tier).labelKey) : t('tierUnknown'),
          annexCategory: annex && annex in ANNEX_III_CATEGORY_LABEL ? ANNEX_III_CATEGORY_LABEL[annex] : null,
          intendedPurpose: selected.intended_purpose ?? null,
          deploymentContext: selected.deployment_context ?? null,
          affectedGroups: selected.affected_groups ?? [],
          owner: selected.owner_email,
        },
        datasets,
      });
      const md = renderDossierMarkdown(built);
      const sha = await sha256HexOfString(md);
      const now = new Date();
      const slug = selected.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'ai-system';
      downloadText(`annex-iv-dossier_${slug}_${now.toISOString().slice(0, 10)}.md`, md, 'text/markdown;charset=utf-8');
      setDossier({
        status: 'ready',
        meta: t('repMetaDossier', { time: formatDateTime(now.toISOString(), lang), pct: built.completeness, sha: shortHash(sha, 12) }),
      });
    } catch (e) {
      setDossier({ status: 'failed', message: (e as Error).message });
    }
  }

  async function onBundle() {
    if (!activeTenantId) return;
    setBundle({ status: 'running' });
    const r = await exportEvidenceBundle({ tenant_id: activeTenantId });
    if (r.kind !== 'ok') {
      setBundle({ status: 'failed', message: r.kind === 'forbidden' ? t('loadFailed') : r.message });
      return;
    }
    const json = JSON.stringify(r.data, null, 2);
    downloadText(
      `evidence-vault-export-${activeTenantId}-${new Date().toISOString().slice(0, 10)}.json`,
      json,
      'application/json',
    );
    const time = formatDateTime(r.data.exported_at, lang);
    setBundle({
      status: 'ready',
      meta: r.data.tip
        ? t('repMetaBundle', { time, n: r.data.count, sha: shortHash(r.data.tip.event_hash, 12) })
        : t('repMetaBundleEmpty', { time, n: r.data.count }),
    });
  }

  return (
    <div className="rs-apppage rs-ui" data-testid="reports-grid">
      <div className="rs-reports">
        {/* DSGVO Art. 30 */}
        <Panel className="rs-panel--pad20 rs-report" style={colorVar('var(--color-rs-primary-light)')} testId="report-dsgvo">
          <div className="flex items-center justify-between gap-2">
            <span className="rs-report__fw">{t('repDsgvo')}</span>
            <StatusPill state="na" />
          </div>
          <h3 className="rs-h3">{t('repDsgvoTitle')}</h3>
          <p className="rs-muted">{t('repDsgvoNote')}</p>
          <div className="rs-report__actions">
            <button type="button" className="rs-chip-sm" disabled aria-disabled="true" style={{ opacity: 0.45 }}>
              {t('notAvailableYet')}
            </button>
          </div>
        </Panel>

        {/* EU AI Act Dossier */}
        <Panel className="rs-panel--pad20 rs-report" style={colorVar('var(--color-rs-warning)')} testId="report-aiact">
          <div className="flex items-center justify-between gap-2">
            <span className="rs-report__fw">{t('repAiAct')}</span>
            <StatusPill state={systems.length === 0 && assetsState.status === 'ready' ? 'na' : dossier} />
          </div>
          <h3 className="rs-h3">{t('repAiActTitle')}</h3>
          {assetsState.status === 'ready' && systems.length === 0 ? (
            <p className="rs-muted">{t('repAiActNone')}</p>
          ) : (
            <select
              className="rs-select"
              aria-label={t('classifyPick')}
              value={selected?.id ?? ''}
              onChange={(e) => setSystemId(e.target.value)}
              disabled={systems.length === 0}
            >
              {systems.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          {dossier.status === 'ready' && <p className="rs-mono rs-note">{dossier.meta}</p>}
          {dossier.status === 'failed' && <p className="rs-note" style={{ color: 'var(--color-rs-danger)' }}>{dossier.message}</p>}
          <div className="rs-report__actions">
            <button
              type="button"
              className="rs-chip-sm rs-chip-sm--primary"
              onClick={() => void onDossier()}
              disabled={!selected || dossier.status === 'running'}
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              {dossier.status === 'running' ? t('genRun') : dossier.status === 'ready' ? t('genReady') : t('genBtn')}
            </button>
          </div>
        </Panel>

        {/* Evidence Audit-Bundle */}
        <Panel className="rs-panel--pad20 rs-report" style={colorVar('var(--color-rs-cyan)')} testId="report-evidence">
          <div className="flex items-center justify-between gap-2">
            <span className="rs-report__fw">{t('repEvidence')}</span>
            <StatusPill state={bundle} />
          </div>
          <h3 className="rs-h3">{t('repEvidenceTitle')}</h3>
          <p className="rs-muted">evidence-vault-export · JSON</p>
          {bundle.status === 'ready' && <p className="rs-mono rs-note">{bundle.meta}</p>}
          {bundle.status === 'failed' && <p className="rs-note" style={{ color: 'var(--color-rs-danger)' }}>{bundle.message}</p>}
          <div className="rs-report__actions">
            <button
              type="button"
              className="rs-chip-sm rs-chip-sm--primary"
              onClick={() => void onBundle()}
              disabled={!activeTenantId || bundle.status === 'running'}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {bundle.status === 'running' ? t('genRun') : bundle.status === 'ready' ? t('genReady') : t('genBtn')}
            </button>
          </div>
        </Panel>

        {/* Management Summary */}
        <Panel className="rs-panel--pad20 rs-report" style={colorVar('var(--color-rs-violet)')} testId="report-mgmt">
          <div className="flex items-center justify-between gap-2">
            <span className="rs-report__fw">{t('repMgmt')}</span>
            <StatusPill state={activeTenantId ? 'link' : 'na'} />
          </div>
          <h3 className="rs-h3">{t('repMgmtTitle')}</h3>
          <p className="rs-muted">{t('repMgmtNote')}</p>
          <div className="rs-report__actions">
            <Link to="/app/cockpit/brief" className="rs-chip-sm rs-chip-sm--primary">
              {t('repMgmtBtn')}
            </Link>
          </div>
        </Panel>
      </div>
      <p className="rs-overline">{t('snapshotHeading')}</p>
    </div>
  );
}
