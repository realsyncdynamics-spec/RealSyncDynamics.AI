/**
 * /app/policy-packs — Enforcement (HANDOFF §9), über dem Policy-Packs-Katalog.
 *
 * Policies kommen aus `governance_policies`. Die Klasse einer Policy folgt
 * `condition.system_type` über `enforcementClassOf`; fehlt der Systemtyp,
 * gilt die vorsichtige Annahme der SSoT (C). Welche Verdikte angeboten
 * werden, entscheidet ausschließlich `verdictIsHonest` — nicht einlösbare
 * Verdikte sind durchgestrichen, und ein Klick darauf ändert nichts,
 * sondern erklärt, warum.
 *
 * Speichern: Einlösbare Verdikt-Klicks werden über `governance-resources`
 * (`op: 'update_policy'`) persistent in `governance_policies` gespeichert.
 * Bei leerem Zustand lassen sich die Standard-Policies der aktivierten
 * Policy Packs direkt anlegen bzw. synchronisieren.
 */
import { useMemo, useState } from 'react';
import { useTenant } from '../../../core/access/TenantProvider';
import { fetchTenantPolicies, type DbGovernancePolicy } from '../governanceApi';
import { createPolicy, updatePolicy } from '../resourcesApi';
import { POLICY_TEMPLATES } from '../policyTemplates';
import { notifyTenantDataChanged } from '../tenantDataEvents';
import { listActivations, setPackActive } from '../../policy-packs/policyPacksApi';
import { useLang } from '../../../i18n/useLang';
import {
  VERDICTS,
  actionOfVerdict,
  bucketOfClass,
  classifyPolicy,
  decideVerdict,
  verdictOfAction,
  type EnforcementClass,
  type Verdict,
} from './enforcementModel';
import { verdictIsHonest } from '../../../../shared/enforcement-classes';
import { ClassBadge, Panel, StatCard, WarnToast } from './ui';
import { useTenantLoad } from './useTenantLoad';

export function EnforcementPanel() {
  const { activeTenantId } = useTenant();
  const { t } = useLang();
  const [state, reload] = useTenantLoad(activeTenantId, fetchTenantPolicies);
  const [savedVerdicts, setSavedVerdicts] = useState<Record<string, Verdict>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const policies = state.status === 'ready' ? state.data : [];
  const rows = useMemo(
    () =>
      policies.map((p) => {
        const stored = savedVerdicts[p.id] ?? verdictOfAction(p.action);
        return { policy: p, cls: classifyPolicy(p), stored };
      }),
    [policies, savedVerdicts],
  );
  const stats = useMemo(() => {
    const s = { blocking: 0, observing: 0, paper: 0 };
    for (const r of rows) s[bucketOfClass(r.cls.klasse)] += 1;
    return s;
  }, [rows]);
  const ready = state.status === 'ready';

  async function choose(policy: DbGovernancePolicy, klasse: EnforcementClass, verdict: Verdict) {
    const decision = decideVerdict(klasse, verdict);
    if (!decision.ok) {
      setToast(t('verdictRejected', { v: verdict, k: klasse }));
      return;
    }
    setToast(null);
    setSaveError(null);
    const prevVerdict = savedVerdicts[policy.id] ?? verdictOfAction(policy.action);
    setSavedVerdicts((prev) => ({ ...prev, [policy.id]: verdict }));
    setSavingId(policy.id);
    try {
      const res = await updatePolicy({
        policy_id: policy.id,
        action: actionOfVerdict(verdict),
      });
      if (res && res.ok === false) {
        setSavedVerdicts((prev) => ({ ...prev, [policy.id]: prevVerdict }));
        setSaveError(res.error?.message ?? t('verdictSaveFailed'));
        return;
      }
      if (activeTenantId) {
        notifyTenantDataChanged(activeTenantId);
      }
    } catch (e) {
      setSavedVerdicts((prev) => ({ ...prev, [policy.id]: prevVerdict }));
      setSaveError((e as Error)?.message ?? t('verdictSaveFailed'));
    } finally {
      setSavingId((curr) => (curr === policy.id ? null : curr));
    }
  }

  async function syncPackPolicies() {
    if (!activeTenantId || syncing) return;
    setSyncing(true);
    setToast(null);
    setSaveError(null);
    try {
      let packIds: string[] = [];
      try {
        const activePacks = await listActivations(activeTenantId);
        packIds = Array.from(activePacks);
      } catch {
        packIds = [];
      }
      if (packIds.length === 0) {
        packIds = ['dsgvo-essentials'];
      }
      for (const packId of packIds) {
        await setPackActive({ tenant_id: activeTenantId, pack_id: packId, active: true });
      }
      const existing = await fetchTenantPolicies(activeTenantId).catch(() => []);
      if (existing.length === 0) {
        for (const tpl of POLICY_TEMPLATES.slice(0, 4)) {
          await createPolicy({
            tenant_id: activeTenantId,
            name: tpl.name,
            description: tpl.description,
            policy_type: tpl.policy_type,
            severity: tpl.severity,
            action: tpl.action,
            condition: tpl.condition,
            enabled: tpl.enabled,
          });
        }
      }
      notifyTenantDataChanged(activeTenantId);
      reload();
    } catch (e) {
      setSaveError((e as Error)?.message ?? t('loadFailed'));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="rs-apppage rs-ui" data-testid="enforcement-panel">
      <div className="rs-stats">
        <StatCard label={t('statPolicies')} value={ready ? rows.length : null} testId="stat-policies" />
        <StatCard label={t('statBlocking')} value={ready ? stats.blocking : null} accent="var(--color-rs-success)" testId="stat-blocking" />
        <StatCard label={t('statObserving')} value={ready ? stats.observing : null} accent="var(--color-rs-warning)" testId="stat-observing" />
        <StatCard label={t('statPaper')} value={ready ? stats.paper : null} accent="var(--color-rs-danger)" testId="stat-paper" />
      </div>

      {toast && <WarnToast>{toast}</WarnToast>}
      {saveError && <WarnToast error>{saveError}</WarnToast>}
      {state.status === 'error' && <WarnToast error>{t('loadFailed')}</WarnToast>}
      {state.status === 'idle' && <p className="rs-muted">{t('noTenant')}</p>}

      <Panel className="rs-panel--flush">
        <div className="rs-panel__head" style={{ padding: '14px 16px 0' }}>
          <span className="rs-overline">{t('ttlEnforce')}</span>
        </div>
        {state.status === 'loading' && <div className="rs-empty">{t('loading')}</div>}
        {ready && rows.length === 0 && (
          <div className="rs-empty" data-testid="policies-empty">
            <div>{t('policiesNone')}</div>
            <div className="rs-note mt-1">{t('policiesSyncEmptyHint')}</div>
            <div className="mt-3">
              <button
                type="button"
                className="rs-btn rs-btn--primary"
                data-testid="sync-pack-policies-btn"
                disabled={syncing || !activeTenantId}
                onClick={() => void syncPackPolicies()}
              >
                {syncing ? t('policiesSyncing') : t('policiesSyncBtn')}
              </button>
            </div>
          </div>
        )}
        {rows.map(({ policy, cls, stored }) => {
          const current = stored;
          const storedHonest = verdictIsHonest(cls.klasse, stored);
          const isSaving = savingId === policy.id;
          return (
            <div key={policy.id} className="rs-policy" data-testid="policy-row" data-class={cls.klasse}>
              <div className="min-w-0">
                <div className="rs-policy__title">
                  {policy.name}
                  {!policy.enabled && <span className="rs-note"> · {t('disabledPolicy')}</span>}
                </div>
                <div className="rs-policy__rule">{policy.description ?? policy.policy_type}</div>
                {!storedHonest && (
                  <div className="rs-note mt-1" style={{ color: 'var(--color-rs-warning)' }}>
                    {t('verdictStoredDishonest', { v: stored, k: cls.klasse })}
                  </div>
                )}
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <ClassBadge klasse={cls.klasse} />
                <span className="rs-ellipsis text-[12px]" title={cls.reason}>
                  {cls.systemLabel ?? t('policyNoSystem')}
                </span>
              </div>
              <div className="rs-verdicts" role="group" aria-label={`${policy.name} — Verdikt`}>
                {VERDICTS.map((v) => {
                  const honest = verdictIsHonest(cls.klasse, v);
                  const strong = v === 'block' || v === 'require_approval';
                  return (
                    <button
                      key={v}
                      type="button"
                      className={`rs-verdict${strong ? ' rs-verdict--strong' : ''}${honest ? '' : ' rs-verdict--dishonest'}`}
                      aria-pressed={current === v}
                      aria-disabled={!honest || isSaving}
                      data-verdict={v}
                      title={honest ? v : t('verdictRejected', { v, k: cls.klasse })}
                      onClick={() => void choose(policy, cls.klasse, v)}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Panel>
      <p className="rs-note" data-testid="enforce-foot">
        {t('enforceFoot')}
      </p>
    </div>
  );
}
