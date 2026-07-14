import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Bot, ShieldCheck, KeyRound, Check,
  AlertTriangle, Loader2, Copy, ShieldAlert, Rocket,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { createAsset, createPolicy } from './resourcesApi';
import { createIngestKey } from './keysApi';
import type {
  GovernanceAssetType, AiActClass,
  GovernancePolicyType, GovernancePolicyAction, GovernanceRiskLevel,
} from './types';

/**
 * /governance/onboarding — first-time wizard. Steps:
 *
 *   1. Asset    — create the customer's first governed system
 *   2. Policy   — optional first rule (defaults block PII to
 *                 external LLMs)
 *   3. Key      — mint the first rsd_gov_… ingest token (one-time
 *                 reveal)
 *   4. Done     — summary + extension install + next steps
 *
 * Each step uses the same Edge Functions as the standalone CRUD
 * surfaces, so onboarding artefacts are first-class.
 */
export function OnboardingView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

type Step = 1 | 2 | 3 | 4;

function Inner() {
  const navigate = useNavigate();
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [step, setStep] = useState<Step>(1);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [policyId, setPolicyId] = useState<string | null>(null);
  const [keyName, setKeyName] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Defensive: if no tenant, hold here. AuthGate ensures user is logged in.
  if (!activeTenantId) {
    return (
      <Shell step={step}>
        <div className="text-center py-16">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-titanium-400 mb-3" />
          <p className="text-sm text-titanium-400">Tenant wird geladen…</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell step={step} tenantSelector={tenants.length > 1 ? (
      <select
        value={activeTenantId ?? ''}
        onChange={(e) => setActiveTenant(e.target.value)}
        className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800 max-w-[200px]"
      >
        {tenants.map((t) => <option key={t.tenantId} value={t.tenantId}>{t.name}</option>)}
      </select>
    ) : undefined}>
      {step === 1 && (
        <AssetStep
          tenantId={activeTenantId}
          onDone={(id) => { setAssetId(id); setStep(2); }}
        />
      )}
      {step === 2 && (
        <PolicyStep
          tenantId={activeTenantId}
          onDone={(id) => { setPolicyId(id); setStep(3); }}
          onSkip={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <KeyStep
          tenantId={activeTenantId}
          onDone={(name, raw) => { setKeyName(name); setToken(raw); setStep(4); }}
        />
      )}
      {step === 4 && (
        <DoneStep
          assetId={assetId}
          policyId={policyId}
          keyName={keyName}
          token={token}
          onFinish={() => navigate('/app/dashboard')}
        />
      )}
    </Shell>
  );
}

/* ── Step 1: Asset ─────────────────────────────────────────────── */

const ASSET_TYPES: GovernanceAssetType[] = [
  'ai_system', 'website', 'agent', 'model', 'api', 'workflow', 'vendor', 'dataset', 'repository',
];
const AI_ACT_CLASSES: AiActClass[] = ['minimal', 'limited', 'high', 'prohibited', 'unknown'];

function AssetStep({
  tenantId, onDone,
}: { tenantId: string; onDone: (id: string) => void }) {
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<GovernanceAssetType>('ai_system');
  const [vendor, setVendor] = useState('');
  const [aiActClass, setAiActClass] = useState<AiActClass>('limited');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    const r = await createAsset({
      tenant_id: tenantId,
      asset_type: assetType,
      name: name.trim(),
      vendor: vendor.trim() || undefined,
      ai_act_class: aiActClass,
    });
    setBusy(false);
    if (!r.ok || !r.asset) { setError(r.error?.message ?? 'Erstellen fehlgeschlagen'); return; }
    onDone(r.asset.id);
  };

  return (
    <StepCard
      icon={<Bot />}
      eyebrow="Schritt 1 von 4"
      title="Erstes Asset"
      subtitle="Lege Dein erstes governed System an — z. B. Deinen Chatbot, Deine Website oder einen Agent."
    >
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name">
          <input
            type="text" required maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Customer Support Copilot"
            className={inputCls}
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Asset-Typ">
            <select value={assetType} onChange={(e) => setAssetType(e.target.value as GovernanceAssetType)} className={inputCls}>
              {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="AI-Act-Klasse">
            <select value={aiActClass} onChange={(e) => setAiActClass(e.target.value as AiActClass)} className={inputCls}>
              {AI_ACT_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Vendor (optional)">
          <input
            type="text" maxLength={200}
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="OpenAI, Anthropic, self-hosted …"
            className={inputCls}
          />
        </Field>

        {error && <ErrorBox>{error}</ErrorBox>}

        <div className="flex items-center justify-between pt-2">
          <Link to="/app/websites" className="text-xs text-titanium-400 hover:text-titanium-200">
            Onboarding abbrechen
          </Link>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-obsidian-950 text-sm font-bold rounded-none hover:bg-amber-400 disabled:opacity-50"
          >
            {busy ? 'Erstelle…' : 'Weiter'} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </StepCard>
  );
}

/* ── Step 2: Policy ────────────────────────────────────────────── */

const POLICY_TYPES: GovernancePolicyType[] = [
  'data_transfer', 'human_review', 'logging_required', 'vendor_restriction',
  'model_usage', 'retention', 'security', 'ai_act', 'gdpr',
];
const SEVERITIES: GovernanceRiskLevel[] = ['low', 'medium', 'high', 'critical'];
const ACTIONS: GovernancePolicyAction[] = ['log', 'warn', 'require_approval', 'block'];

function PolicyStep({
  tenantId, onDone, onSkip,
}: { tenantId: string; onDone: (id: string) => void; onSkip: () => void }) {
  const [name, setName] = useState('Block PII to external LLMs');
  const [policyType, setPolicyType] = useState<GovernancePolicyType>('data_transfer');
  const [severity, setSeverity] = useState<GovernanceRiskLevel>('high');
  const [action, setAction] = useState<GovernancePolicyAction>('block');
  const [conditionStr, setConditionStr] = useState('{"data_types": ["customer_data", "employee_data"]}');
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
      setError('Condition muss valides JSON-Objekt sein, z. B. { "data_types": ["customer_data"] }');
      return;
    }
    setBusy(true);
    const r = await createPolicy({
      tenant_id: tenantId,
      name: name.trim(),
      policy_type: policyType,
      severity, action, condition: parsed, enabled: true,
    });
    setBusy(false);
    if (!r.ok || !r.policy) { setError(r.error?.message ?? 'Erstellen fehlgeschlagen'); return; }
    onDone(r.policy.id);
  };

  return (
    <StepCard
      icon={<ShieldCheck />}
      eyebrow="Schritt 2 von 4"
      title="Erste Policy"
      subtitle="Lege eine Regel an, die bei Verstößen automatisch greift. Beispiel: PII darf nicht an externe LLMs."
    >
      <div className="mb-4 border border-amber-500/30 bg-amber-500/5 p-3 text-[12px] text-amber-200 leading-relaxed">
        <strong className="text-amber-100">Tipp:</strong> 10 fertige Best-Practice-Policies (GDPR · AI Act · SOC 2 · Schrems) gibt's in der{' '}
        <Link to="/app/policies/templates" className="font-semibold underline underline-offset-2 hover:text-amber-100">
          Template-Library
        </Link>{' '}— ein Klick installiert.
      </div>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name">
          <input
            type="text" required maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Typ">
            <select value={policyType} onChange={(e) => setPolicyType(e.target.value as GovernancePolicyType)} className={inputCls}>
              {POLICY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Severity">
            <select value={severity} onChange={(e) => setSeverity(e.target.value as GovernanceRiskLevel)} className={inputCls}>
              {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Aktion">
            <select value={action} onChange={(e) => setAction(e.target.value as GovernancePolicyAction)} className={inputCls}>
              {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Condition (JSON)">
          <textarea
            rows={3}
            value={conditionStr}
            onChange={(e) => setConditionStr(e.target.value)}
            className={`${inputCls} font-mono text-xs`}
          />
        </Field>

        {error && <ErrorBox>{error}</ErrorBox>}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-titanium-400 hover:text-titanium-200"
          >
            Überspringen
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-obsidian-950 text-sm font-bold rounded-none hover:bg-amber-400 disabled:opacity-50"
          >
            {busy ? 'Erstelle…' : 'Weiter'} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </StepCard>
  );
}

/* ── Step 3: Key ───────────────────────────────────────────────── */

function KeyStep({
  tenantId, onDone,
}: { tenantId: string; onDone: (name: string, token: string) => void }) {
  const [name, setName] = useState('First production key');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    const r = await createIngestKey(tenantId, name.trim(), [], 60);
    setBusy(false);
    if (!r.ok || !r.token) { setError(r.error?.message ?? 'Erstellen fehlgeschlagen'); return; }
    onDone(name.trim(), r.token);
  };

  return (
    <StepCard
      icon={<KeyRound />}
      eyebrow="Schritt 3 von 4"
      title="Ingest-Key generieren"
      subtitle="Der Key authentifiziert Browser-Extension, SDK und Agent-Runtime gegen die Ingest-API."
    >
      <form onSubmit={submit} className="space-y-3">
        <Field label="Bezeichnung">
          <input
            type="text" required maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </Field>

        <div className="flex items-start gap-2.5 text-xs text-amber-200 bg-amber-950/30 border border-amber-900 rounded-none p-2.5">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          Der Token wird auf der nächsten Seite genau einmal angezeigt.
          Speichere ihn dann sicher (Vault / 1Password). Server speichert nur den sha256-Hash.
        </div>

        {error && <ErrorBox>{error}</ErrorBox>}

        <div className="flex items-center justify-end pt-2">
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-obsidian-950 text-sm font-bold rounded-none hover:bg-amber-400 disabled:opacity-50"
          >
            {busy ? 'Erstelle…' : 'Token generieren'} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </StepCard>
  );
}

/* ── Step 4: Done ──────────────────────────────────────────────── */

function DoneStep({
  assetId, policyId, keyName, token, onFinish,
}: {
  assetId: string | null;
  policyId: string | null;
  keyName: string | null;
  token: string | null;
  onFinish: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copyToken = async () => {
    if (!token) return;
    try { await navigator.clipboard.writeText(token); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  return (
    <StepCard
      icon={<Rocket />}
      eyebrow="Schritt 4 von 4"
      title="Fertig"
      subtitle="Du hast die Governance Runtime aktiviert. Speichere den Token, lade die Extension oder ruf den ersten Event via curl."
    >
      <div className="space-y-4">
        <div className="border border-titanium-900 bg-obsidian-950/60 p-3 space-y-1.5">
          <CheckLine done={!!assetId}>Asset angelegt</CheckLine>
          <CheckLine done={!!policyId}>Policy angelegt (optional)</CheckLine>
          <CheckLine done={!!token}>Ingest-Key „{keyName}" generiert</CheckLine>
        </div>

        {token && (
          <>
            <div className="flex items-start gap-2.5 text-xs text-amber-200 bg-amber-950/50 border border-amber-800 rounded-none p-3">
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Einmalige Anzeige</div>
                <div className="text-amber-200/80 mt-0.5">
                  Beim Verlassen ist der Token weg. Wir speichern nur den sha256-Hash und können ihn nicht
                  nochmal anzeigen.
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-titanium-400 mb-1.5">
                Ingest Token
              </label>
              <div className="flex items-stretch gap-2">
                <code className="flex-1 bg-obsidian-950 border border-titanium-900 text-amber-200 text-xs font-mono rounded-none px-3 py-2.5 break-all">
                  {token}
                </code>
                <button
                  type="button"
                  onClick={copyToken}
                  className="px-3 py-2 bg-obsidian-800 hover:bg-obsidian-700 text-titanium-200 rounded-none border border-titanium-900"
                  aria-label="Token kopieren"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-titanium-400 mb-1.5">
                Erster Event-Call
              </label>
              <pre className="bg-obsidian-950 border border-titanium-900 text-xs font-mono text-titanium-300 rounded-none p-3 overflow-x-auto">
{`curl -X POST https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/governance-ingest \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"event":{"event_type":"hello","event_source":"manual","title":"first event"}}'`}
              </pre>
            </div>
          </>
        )}

        <div className="border border-titanium-900 bg-obsidian-950/60 p-3 text-[13px] text-silver-300 leading-relaxed">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-300 mb-1.5">
            Browser-Extension
          </div>
          chrome://extensions → Developer mode → Load unpacked → <code>extension-governance/</code> aus dem Repo wählen.
          Token im Popup eintragen, fertig.
        </div>

        <div className="flex items-center justify-end pt-2">
          <button
            onClick={onFinish}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-obsidian-950 text-sm font-bold rounded-none hover:bg-amber-400"
          >
            Zum Dashboard <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </StepCard>
  );
}

/* ── Shell + bits ──────────────────────────────────────────────── */

function Shell({
  step, tenantSelector, children,
}: { step: Step; tenantSelector?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/websites" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
              <Rocket className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Governance Onboarding</div>
              <div className="text-[11px] text-titanium-400 font-medium">4 Schritte zur produktiven Runtime</div>
            </div>
          </div>
        </div>
        {tenantSelector}
      </header>

      <Progress step={step} />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}

function Progress({ step }: { step: Step }) {
  const steps: Array<{ n: Step; label: string }> = [
    { n: 1, label: 'Asset' },
    { n: 2, label: 'Policy' },
    { n: 3, label: 'Key' },
    { n: 4, label: 'Fertig' },
  ];
  return (
    <div className="border-b border-titanium-900 bg-obsidian-900/50 px-4 py-3">
      <div className="max-w-2xl mx-auto flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider">
        {steps.map((s, idx) => {
          const isDone = step > s.n;
          const isActive = step === s.n;
          return (
            <React.Fragment key={s.n}>
              <span className={`flex items-center gap-1.5 ${
                isActive ? 'text-amber-300' : isDone ? 'text-emerald-300' : 'text-titanium-500'
              }`}>
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-none border ${
                  isActive ? 'bg-amber-500 border-amber-500 text-obsidian-950' :
                  isDone ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' :
                  'border-titanium-700 text-titanium-500'
                }`}>
                  {isDone ? <Check className="h-3 w-3" /> : s.n}
                </span>
                {s.label}
              </span>
              {idx < steps.length - 1 && <span className="text-titanium-700">·</span>}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function StepCard({
  icon, eyebrow, title, subtitle, children,
}: {
  icon: React.ReactNode; eyebrow: string; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-obsidian-900 border border-titanium-900 p-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="h-4 w-4 text-amber-300">{icon}</span>
        <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-amber-300">{eyebrow}</span>
      </div>
      <h2 className="font-display font-bold text-xl text-titanium-50 tracking-tight mb-1">{title}</h2>
      <p className="text-sm text-titanium-400 mb-5 leading-relaxed">{subtitle}</p>
      {children}
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

function CheckLine({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`inline-flex items-center justify-center w-4 h-4 rounded-none border ${
        done ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'border-titanium-700 text-titanium-500'
      }`}>
        {done && <Check className="h-3 w-3" />}
      </span>
      <span className={done ? 'text-titanium-200' : 'text-titanium-500'}>{children}</span>
    </div>
  );
}

const inputCls =
  'w-full bg-obsidian-950 border border-titanium-900 text-titanium-100 text-sm rounded-none px-3 py-2 outline-none focus:border-amber-500';
