/**
 * KI-System anlegen oder Registerdaten bearbeiten (Auftrag §14).
 *
 * Schreibt ausschließlich über `governance-resources` (create_asset /
 * update_asset): der Server prüft owner/admin gegen `memberships` und die
 * Wertelisten; die Datenbank hat dieselben CHECK-Constraints. Die
 * AI-Act-Klasse ist nur beim Anlegen als eigene Einschätzung wählbar —
 * danach ändert sie nur die Klassifizierung.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useLang } from '../../../i18n/useLang';
import type { DbGovernanceAsset } from '../governanceApi';
import { createAsset, updateAsset } from '../resourcesApi';
import { notifyTenantDataChanged } from '../tenantDataEvents';
import type { AiActClass } from '../types';
import { TIERS } from '../handoff/enforcementModel';
import {
  AI_SYSTEM_TYPES,
  AI_SYSTEM_TYPE_LABEL,
  DATA_RESIDENCIES,
  DATA_RESIDENCY_LABEL,
  DEPLOYMENT_MODELS,
  DEPLOYMENT_MODEL_LABEL,
  EDITABLE_STATUSES,
  STATUS_LABEL,
  type EditableStatus,
} from './registryModel';

interface FormState {
  name: string;
  ai_system_type: string;
  vendor: string;
  model_name: string;
  deployment_model: string;
  data_residency: string;
  intended_purpose: string;
  owner_email: string;
  ai_act_class: AiActClass;
  status: EditableStatus;
}

function initialState(asset: DbGovernanceAsset | null): FormState {
  const status = asset?.status;
  return {
    name: asset?.name ?? '',
    ai_system_type: asset?.ai_system_type ?? '',
    vendor: asset?.vendor ?? '',
    model_name: asset?.model_name ?? '',
    deployment_model: asset?.deployment_model ?? '',
    data_residency: asset?.data_residency ?? '',
    intended_purpose: asset?.intended_purpose ?? '',
    owner_email: asset?.owner_email ?? '',
    ai_act_class: asset?.ai_act_class ?? 'unknown',
    status: status && (EDITABLE_STATUSES as readonly string[]).includes(status) ? (status as EditableStatus) : 'active',
  };
}

const orNull = (v: string): string | null => (v.trim() === '' ? null : v.trim());

export function AiSystemForm({
  tenantId,
  asset,
  onClose,
  onSaved,
}: {
  tenantId: string;
  /** null = neues System anlegen */
  asset: DbGovernanceAsset | null;
  onClose: () => void;
  onSaved: (asset: DbGovernanceAsset | null) => void;
}) {
  const { t, lang } = useLang();
  const titleId = useId();
  const firstField = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(() => initialState(asset));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = asset !== null;

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const registry = {
      vendor: orNull(form.vendor),
      owner_email: orNull(form.owner_email),
      intended_purpose: orNull(form.intended_purpose),
      ai_system_type: orNull(form.ai_system_type),
      model_name: orNull(form.model_name),
      deployment_model: orNull(form.deployment_model),
      data_residency: orNull(form.data_residency),
    };
    const result = editing
      ? await updateAsset({ asset_id: asset.id, name: form.name.trim(), status: form.status, ...registry })
      : await createAsset({
          tenant_id: tenantId,
          asset_type: 'ai_system',
          name: form.name.trim(),
          ai_act_class: form.ai_act_class,
          ...registry,
          vendor: registry.vendor ?? undefined,
          owner_email: registry.owner_email ?? undefined,
        });
    setBusy(false);
    if (!result.ok) {
      setError(result.error?.message ?? t('loadFailed'));
      return;
    }
    notifyTenantDataChanged(tenantId);
    onSaved(result.asset ?? null);
  }

  return (
    <div className="rs-drawer rs-ui" role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid="ai-system-form">
      <div className="rs-drawer__backdrop" onClick={onClose} />
      <form className="rs-drawer__panel" onSubmit={submit}>
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="rs-h2">{editing ? t('regEdit') : t('regAdd')}</h2>
          <button type="button" className="rs-chip-sm" onClick={onClose} aria-label={t('regCancel')}>
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <label className="rs-field">
          {t('regFieldName')} *
          <input
            ref={firstField}
            className="rs-field__input"
            required
            maxLength={200}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </label>

        <label className="rs-field">
          {t('regFieldType')} *
          <select
            className="rs-select"
            required
            value={form.ai_system_type}
            onChange={(e) => set('ai_system_type', e.target.value)}
          >
            <option value="">{t('regChoose')}</option>
            {AI_SYSTEM_TYPES.map((v) => (
              <option key={v} value={v}>{AI_SYSTEM_TYPE_LABEL[v][lang]}</option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="rs-field">
            {t('regFieldVendor')}
            <input className="rs-field__input" maxLength={200} value={form.vendor} onChange={(e) => set('vendor', e.target.value)} />
          </label>
          <label className="rs-field">
            {t('regFieldModel')}
            <input className="rs-field__input" maxLength={200} value={form.model_name} onChange={(e) => set('model_name', e.target.value)} />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="rs-field">
            {t('regFieldDeployment')}
            <select className="rs-select" value={form.deployment_model} onChange={(e) => set('deployment_model', e.target.value)}>
              <option value="">{t('regNotSet')}</option>
              {DEPLOYMENT_MODELS.map((v) => (
                <option key={v} value={v}>{DEPLOYMENT_MODEL_LABEL[v][lang]}</option>
              ))}
            </select>
          </label>
          <label className="rs-field">
            {t('regFieldResidency')}
            <select className="rs-select" value={form.data_residency} onChange={(e) => set('data_residency', e.target.value)}>
              <option value="">{t('regNotSet')}</option>
              {DATA_RESIDENCIES.map((v) => (
                <option key={v} value={v}>{DATA_RESIDENCY_LABEL[v][lang]}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="rs-field">
          {t('regFieldPurpose')}
          <textarea
            className="rs-field__input"
            maxLength={2000}
            value={form.intended_purpose}
            onChange={(e) => set('intended_purpose', e.target.value)}
          />
        </label>

        <label className="rs-field">
          {t('regFieldOwner')}
          <input
            className="rs-field__input"
            type="email"
            maxLength={254}
            value={form.owner_email}
            onChange={(e) => set('owner_email', e.target.value)}
          />
        </label>

        {editing ? (
          <label className="rs-field">
            {t('regFieldStatus')}
            <select className="rs-select" value={form.status} onChange={(e) => set('status', e.target.value as EditableStatus)}>
              {EDITABLE_STATUSES.map((v) => (
                <option key={v} value={v}>{STATUS_LABEL[v][lang]}</option>
              ))}
            </select>
          </label>
        ) : (
          <label className="rs-field">
            {t('regFieldClass')}
            <select className="rs-select" value={form.ai_act_class} onChange={(e) => set('ai_act_class', e.target.value as AiActClass)}>
              <option value="unknown">{t('tierUnknown')}</option>
              {TIERS.map((def) => (
                <option key={def.id} value={def.dbValue}>{t(def.labelKey)} · {def.article}</option>
              ))}
            </select>
            <span className="rs-note">{t('regClassHint')}</span>
          </label>
        )}

        {error && <p role="alert" className="rs-note" style={{ color: 'var(--color-rs-danger)' }}>{error}</p>}

        <div className="mt-auto flex flex-wrap justify-end gap-2 pt-2">
          <button type="button" className="rs-chip-sm" onClick={onClose}>{t('regCancel')}</button>
          <button type="submit" className="rs-chip-sm rs-chip-sm--primary" disabled={busy}>
            {busy ? t('regSaving') : editing ? t('regSave') : t('regCreate')}
          </button>
        </div>
      </form>
    </div>
  );
}
