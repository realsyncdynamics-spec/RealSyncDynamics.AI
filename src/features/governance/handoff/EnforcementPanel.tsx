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
 * Speichern: `governance-resources` kennt `create_policy` und
 * `toggle_policy`, aber kein Ändern der Aktion. Verdikt-Wahl bleibt deshalb
 * lokal und trägt „Entwurf · nicht gespeichert".
 */
import { useMemo, useState } from 'react';
import { useTenant } from '../../../core/access/TenantProvider';
import { fetchTenantPolicies, type DbGovernancePolicy } from '../governanceApi';
import { useLang } from '../../../i18n/useLang';
import {
  VERDICTS,
  bucketOfClass,
  classifyPolicy,
  decideVerdict,
  verdictOfAction,
  type EnforcementClass,
  type Verdict,
} from './enforcementModel';
import { verdictIsHonest } from '../../../../shared/enforcement-classes';
import { ClassBadge, DraftBadge, Panel, StatCard, WarnToast } from './ui';
import { useTenantLoad } from './useTenantLoad';

export function EnforcementPanel() {
  const { activeTenantId } = useTenant();
  const { t } = useLang();
  const [state] = useTenantLoad(activeTenantId, fetchTenantPolicies);
  const [drafts, setDrafts] = useState<Record<string, Verdict>>({});
  const [toast, setToast] = useState<string | null>(null);

  const policies = state.status === 'ready' ? state.data : [];
  const rows = useMemo(
    () => policies.map((p) => ({ policy: p, cls: classifyPolicy(p), stored: verdictOfAction(p.action) })),
    [policies],
  );
  const stats = useMemo(() => {
    const s = { blocking: 0, observing: 0, paper: 0 };
    for (const r of rows) s[bucketOfClass(r.cls.klasse)] += 1;
    return s;
  }, [rows]);
  const ready = state.status === 'ready';
  const anyDraft = rows.some((r) => drafts[r.policy.id] && drafts[r.policy.id] !== r.stored);

  function choose(policy: DbGovernancePolicy, klasse: EnforcementClass, verdict: Verdict) {
    const decision = decideVerdict(klasse, verdict);
    if (!decision.ok) {
      setToast(t('verdictRejected', { v: verdict, k: klasse }));
      return;
    }
    setToast(null);
    setDrafts((prev) => ({ ...prev, [policy.id]: verdict }));
  }

  return (
    <div className="rs-page rs-ui" data-testid="enforcement-panel">
      <div className="rs-stats">
        <StatCard label={t('statPolicies')} value={ready ? rows.length : null} testId="stat-policies" />
        <StatCard label={t('statBlocking')} value={ready ? stats.blocking : null} accent="var(--color-rs-success)" testId="stat-blocking" />
        <StatCard label={t('statObserving')} value={ready ? stats.observing : null} accent="var(--color-rs-warning)" testId="stat-observing" />
        <StatCard label={t('statPaper')} value={ready ? stats.paper : null} accent="var(--color-rs-danger)" testId="stat-paper" />
      </div>

      {toast && <WarnToast>{toast}</WarnToast>}
      {state.status === 'error' && <WarnToast error>{t('loadFailed')}</WarnToast>}
      {state.status === 'idle' && <p className="rs-muted">{t('noTenant')}</p>}

      <Panel className="rs-panel--flush">
        <div className="rs-panel__head" style={{ padding: '14px 16px 0' }}>
          <span className="rs-overline">{t('ttlEnforce')}</span>
          {anyDraft && <DraftBadge />}
        </div>
        {state.status === 'loading' && <div className="rs-empty">{t('loading')}</div>}
        {ready && rows.length === 0 && (
          <div className="rs-empty" data-testid="policies-empty">
            {t('policiesNone')}
          </div>
        )}
        {rows.map(({ policy, cls, stored }) => {
          const current = drafts[policy.id] ?? stored;
          const storedHonest = verdictIsHonest(cls.klasse, stored);
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
                      aria-disabled={!honest}
                      data-verdict={v}
                      title={honest ? v : t('verdictRejected', { v, k: cls.klasse })}
                      onClick={() => choose(policy, cls.klasse, v)}
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
      {anyDraft && <p className="rs-note">{t('enforceDraftNote')}</p>}
      <p className="rs-note" data-testid="enforce-foot">
        {t('enforceFoot')}
      </p>
    </div>
  );
}
