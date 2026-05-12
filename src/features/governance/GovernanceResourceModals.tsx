import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import {
  createAsset, createPolicy,
  type CreateAssetInput, type CreatePolicyInput,
} from './resourcesApi';
import type {
  GovernanceAssetType, AiActClass,
  GovernancePolicyType, GovernancePolicyAction, GovernanceRiskLevel,
} from './types';

const ASSET_TYPES: GovernanceAssetType[] = [
  'website', 'ai_system', 'vendor', 'model', 'agent',
  'api', 'dataset', 'repository', 'workflow',
];
const AI_ACT_CLASSES: AiActClass[] = ['minimal', 'limited', 'high', 'prohibited', 'unknown'];

const POLICY_TYPES: GovernancePolicyType[] = [
  'data_transfer', 'model_usage', 'human_review', 'logging_required',
  'vendor_restriction', 'retention', 'security', 'ai_act', 'gdpr',
];
const SEVERITIES: GovernanceRiskLevel[] = ['info', 'low', 'medium', 'high', 'critical'];
const ACTIONS: GovernancePolicyAction[] = ['allow', 'log', 'warn', 'block', 'require_approval'];

export function CreateAssetModal({
  tenantId, onClose, onCreated,
}: { tenantId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<CreateAssetInput>({
    tenant_id: tenantId,
    asset_type: 'ai_system',
    name: '',
    ai_act_class: 'unknown',
    data_types: [],
  });
  const [dataTypesInput, setDataTypesInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    const dataTypes = dataTypesInput.split(',').map((s) => s.trim()).filter(Boolean);
    const r = await createAsset({ ...form, data_types: dataTypes });
    setBusy(false);
    if (!r.ok) { setError(r.error?.message ?? 'Erstellen fehlgeschlagen'); return; }
    onCreated();
  };

  return (
    <ModalShell title="Neues Asset" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name">
          <input
            type="text" required maxLength={200}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls}
            placeholder="z. B. Customer Support Copilot"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Asset-Typ">
            <select
              value={form.asset_type}
              onChange={(e) => setForm({ ...form, asset_type: e.target.value as GovernanceAssetType })}
              className={inputCls}
            >
              {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="AI-Act-Klasse">
            <select
              value={form.ai_act_class}
              onChange={(e) => setForm({ ...form, ai_act_class: e.target.value as AiActClass })}
              className={inputCls}
            >
              {AI_ACT_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Beschreibung">
          <textarea
            rows={2}
            maxLength={2000}
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Vendor">
            <input
              type="text" maxLength={200}
              value={form.vendor ?? ''}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              className={inputCls}
              placeholder="OpenAI, self-hosted, …"
            />
          </Field>
          <Field label="Owner-Email">
            <input
              type="email" maxLength={254}
              value={form.owner_email ?? ''}
              onChange={(e) => setForm({ ...form, owner_email: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="System-URL">
          <input
            type="url" maxLength={500}
            value={form.system_url ?? ''}
            onChange={(e) => setForm({ ...form, system_url: e.target.value })}
            className={inputCls}
            placeholder="https://…"
          />
        </Field>

        <Field label="Data-Types (kommagetrennt)">
          <input
            type="text"
            value={dataTypesInput}
            onChange={(e) => setDataTypesInput(e.target.value)}
            className={inputCls}
            placeholder="customer_data, ip_address, email"
          />
        </Field>

        <Field label="Risk-Score (0–100)">
          <input
            type="number" min={0} max={100}
            value={form.risk_score ?? 0}
            onChange={(e) => setForm({ ...form, risk_score: Number(e.target.value) })}
            className={inputCls}
          />
        </Field>

        {error && <ErrorBox>{error}</ErrorBox>}

        <FormFooter onCancel={onClose} busy={busy} disabled={!form.name.trim()} label="Asset anlegen" />
      </form>
    </ModalShell>
  );
}

export function CreatePolicyModal({
  tenantId, onClose, onCreated,
}: { tenantId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<CreatePolicyInput>({
    tenant_id: tenantId,
    name: '',
    policy_type: 'data_transfer',
    severity: 'medium',
    action: 'warn',
    enabled: true,
    condition: {},
  });
  const [conditionStr, setConditionStr] = useState('{}');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    let parsed: Record<string, unknown> = {};
    try {
      parsed = conditionStr.trim() ? JSON.parse(conditionStr) : {};
      if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    } catch {
      setError('Condition muss valides JSON-Objekt sein, z. B. { "ai_act_class": "high" }');
      return;
    }
    setBusy(true);
    const r = await createPolicy({ ...form, condition: parsed });
    setBusy(false);
    if (!r.ok) { setError(r.error?.message ?? 'Erstellen fehlgeschlagen'); return; }
    onCreated();
  };

  return (
    <ModalShell title="Neue Policy" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name">
          <input
            type="text" required maxLength={200}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls}
            placeholder="z. B. No personal data to US-only vendors"
          />
        </Field>

        <Field label="Beschreibung">
          <textarea
            rows={2}
            maxLength={2000}
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Typ">
            <select
              value={form.policy_type}
              onChange={(e) => setForm({ ...form, policy_type: e.target.value as GovernancePolicyType })}
              className={inputCls}
            >
              {POLICY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Severity">
            <select
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value as GovernanceRiskLevel })}
              className={inputCls}
            >
              {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Aktion">
            <select
              value={form.action}
              onChange={(e) => setForm({ ...form, action: e.target.value as GovernancePolicyAction })}
              className={inputCls}
            >
              {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Condition (JSON, AND über Top-Level-Keys)">
          <textarea
            rows={4}
            value={conditionStr}
            onChange={(e) => setConditionStr(e.target.value)}
            className={`${inputCls} font-mono text-xs`}
            placeholder='{ "ai_act_class": "high" }'
          />
          <p className="mt-1 text-[11px] text-titanium-500">
            Erlaubte Keys: event_type, event_source, vendor, model_name, data_types, risk_level,
            asset_type, ai_act_class. Unbekannte Keys werden gegen <code>event.payload</code> gematcht.
          </p>
        </Field>

        <label className="flex items-center gap-2 text-sm text-titanium-200">
          <input
            type="checkbox"
            checked={form.enabled ?? true}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />
          Direkt aktivieren
        </label>

        {error && <ErrorBox>{error}</ErrorBox>}

        <FormFooter onCancel={onClose} busy={busy} disabled={!form.name.trim()} label="Policy anlegen" />
      </form>
    </ModalShell>
  );
}

/* ── Shared bits ───────────────────────────────────────────────── */

const inputCls =
  'w-full bg-obsidian-950 border border-titanium-900 text-titanium-100 text-sm rounded-none px-3 py-2 outline-none focus:border-amber-500';

function ModalShell({
  title, onClose, children,
}: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-obsidian-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-obsidian-900 border border-titanium-900 rounded-none shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-titanium-900 sticky top-0 bg-obsidian-900">
          <h2 className="font-display font-bold text-titanium-50">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-mono uppercase tracking-wider text-titanium-400 mb-1">{label}</span>
      {children}
    </label>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/50 border border-red-900 rounded-none p-2.5">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {children}
    </div>
  );
}

function FormFooter({
  onCancel, busy, disabled, label,
}: { onCancel: () => void; busy: boolean; disabled: boolean; label: string }) {
  return (
    <div className="flex items-center justify-end gap-2 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="px-3 py-1.5 text-sm font-semibold text-titanium-300 hover:bg-obsidian-800 rounded-none"
      >
        Abbrechen
      </button>
      <button
        type="submit"
        disabled={busy || disabled}
        className="px-4 py-1.5 bg-amber-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-amber-400 disabled:opacity-50"
      >
        {busy ? 'Erstelle…' : label}
      </button>
    </div>
  );
}
