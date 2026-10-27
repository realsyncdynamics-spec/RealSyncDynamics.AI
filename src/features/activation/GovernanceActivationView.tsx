/**
 * Governance Activation — first production vertical & canonical post-signup
 * onboarding target (WP10 / Masterplan M1).
 *
 * Spec: `docs/product/governance-activation.md`
 * Route: `/app/activation` inside GovernanceBrowserShell + AppGate.
 *
 * Canonical 4-step Activation flow ("Schritt x von 4"):
 *   1. Organization (inkl. Organisationstyp, Mitarbeiterzahl, KI-Betriebsmodus
 *      aus SetupAssistant)
 *   2. Scope (Governance Frameworks)
 *   3. AI Setup (KI-Systeme, Bots/Agenten, Datenklassen, Freigaben)
 *   4. Go-Live (Zusammenfassung → /app/dashboard)
 *
 * Blueprint / Migration extraction / Expert Review stay Coming Soon per
 * `src/product/implementation-status.ts`.
 */
import { useEffect, useState, type DragEvent, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileUp,
  Layers,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { ModuleStatusBadge } from '../../components/governance-os/ModuleStatusBadge';
import {
  OS_ACCENT_TEXT,
  OS_CREAM_BTN,
  OS_FOCUS_BORDER,
} from '../../components/governance-os/osChrome';
import { useTenant } from '../../core/access/TenantProvider';
import { claimPendingAudit } from '../../core/onboarding/claimAudit';
import { safeInternalPath } from '../../lib/safeInternalPath';
import { recordTimeToFirstEvidence } from '../../lib/marketingAnalytics';
import {
  getImplementation,
  STATUS_LABEL,
  type ImplementationStatus,
} from '../../product/implementation-status';
import { loadCompanyProfile, saveCompanyProfile } from '../company/companyProfileLocal';
import { clearScanProfile, loadScanProfile, type ScanProfile } from '../onboarding/scanProfile';
import {
  EMPTY_ORGANIZATION,
  loadGovernanceActivation,
  saveGovernanceActivation,
  type ActivationOrganization,
  type ActivationResidencyPolicy,
  type ActivationTenantType,
} from './activationApi';
import { AiSetupStep } from './AiSetupStep';
import {
  countSelected,
  createEmptyAiSetup,
  isAiSetupComplete,
  NONE_OPTION_ID,
  type AiSetup,
} from './aiSetupCatalog';

export type WizardStep =
  | 'organization'
  | 'scope'
  | 'ai-inventory'
  | 'blueprint'
  | 'documents'
  | 'review'
  | 'status';

export const ACTIVATION_CORE_STEPS: readonly {
  id: WizardStep;
  label: string;
  index: string;
  stepNumber: 1 | 2 | 3 | 4;
}[] = [
  { id: 'organization', label: 'Organization', index: '01', stepNumber: 1 },
  { id: 'scope', label: 'Scope', index: '02', stepNumber: 2 },
  { id: 'ai-inventory', label: 'AI Setup', index: '03', stepNumber: 3 },
  { id: 'status', label: 'Go-Live', index: '04', stepNumber: 4 },
];

export const COMING_SOON_STEPS: readonly {
  id: WizardStep;
  label: string;
  implementationId: string;
}[] = [
  { id: 'blueprint', label: 'Blueprint', implementationId: 'activation-blueprint' },
  { id: 'documents', label: 'Migration', implementationId: 'activation-doc-extract' },
  { id: 'review', label: 'Expert Review', implementationId: 'activation-expert-review' },
];

/** Schritte, die beim Weiter/Speichern in `governance_activations` persistieren. */
const PERSISTED_STEPS: readonly WizardStep[] = ['organization', 'scope', 'ai-inventory'];

const SUBMODULES = [
  'Activation',
  'Discovery',
  'Blueprint',
  'Migration',
  'Mapping',
  'Expert Review',
  'Evidence',
  'Tasks',
  'Go-Live',
] as const;

const SCOPE_OPTIONS = [
  { id: 'dsgvo', label: 'DSGVO' },
  { id: 'eu-ai-act', label: 'EU AI Act' },
  { id: 'ai-governance', label: 'AI Governance' },
  { id: 'third-party', label: 'Third-Party Risk' },
  { id: 'info-sec', label: 'Information Security' },
  { id: 'policies', label: 'Policies' },
  { id: 'audit-evidence', label: 'Audit & Evidence' },
  { id: 'other', label: 'Weitere Frameworks' },
] as const;

const DEFAULT_SCOPES: readonly string[] = ['dsgvo', 'eu-ai-act', 'ai-governance'];

const ACCEPTED_TYPES = 'XLSX · CSV · DOCX · PDF · JSON · VVT · DSFA · TOM · Policies · Risiko-Register';

const TENANT_TYPE_OPTIONS: readonly { id: ActivationTenantType; label: string }[] = [
  { id: 'freelancer', label: 'Einzelner / Freelancer' },
  { id: 'sme', label: 'KMU / Handwerk (< 50 MA)' },
  { id: 'agency', label: 'Agentur / Kanzlei' },
  { id: 'enterprise', label: 'Großunternehmen' },
];

const EMPLOYEE_SIZE_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 1, label: '1–5' },
  { value: 10, label: '6–25' },
  { value: 50, label: '26–100' },
  { value: 250, label: '101–500' },
  { value: 1000, label: '500+' },
];

const RESIDENCY_OPTIONS: readonly { id: ActivationResidencyPolicy; label: string }[] = [
  { id: 'enforce_eu_local', label: 'Lokal (EU / On-Prem)' },
  { id: 'enforce_cloud', label: 'Cloud-Anbieter' },
  { id: 'user_choice', label: 'Hybrid (pro Anwendungsfall)' },
];

const SCAN_ROLE_TO_TENANT_TYPE: Record<NonNullable<ScanProfile['role']>, ActivationTenantType> = {
  self: 'freelancer',
  team: 'sme',
  agency: 'agency',
  enterprise: 'enterprise',
};

const SCAN_RESIDENCY_TO_POLICY: Record<NonNullable<ScanProfile['residency']>, ActivationResidencyPolicy> = {
  local: 'enforce_eu_local',
  eu_cloud: 'user_choice',
  hybrid: 'user_choice',
};

function prefillOrgFromScan(scan: ScanProfile | null, domainParam: string | null): ActivationOrganization {
  const company = scan?.company?.trim() || domainParam?.trim() || '';
  const tenantType = scan?.role ? SCAN_ROLE_TO_TENANT_TYPE[scan.role] : undefined;
  const residencyPolicy = scan?.residency ? SCAN_RESIDENCY_TO_POLICY[scan.residency] : undefined;
  return {
    ...EMPTY_ORGANIZATION,
    company,
    ...(tenantType ? { tenantType } : {}),
    ...(residencyPolicy ? { residencyPolicy } : {}),
  };
}

function implementationStatusLabel(featureId: string, fallback: ImplementationStatus = 'coming-soon'): string {
  const status = getImplementation(featureId)?.status ?? fallback;
  return STATUS_LABEL[status];
}

function PreviewChip({ children }: { children: string }) {
  return (
    <span className="badge-preview font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5">
      {children}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  rows = 1,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const shared =
    `w-full bg-obsidian-950 border border-titanium-800 text-sm text-titanium-100 px-3 py-2 outline-none ${OS_FOCUS_BORDER} placeholder:text-titanium-600`;
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] uppercase tracking-wider text-titanium-400 font-mono">{label}</span>
      {rows > 1 ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={`${shared} resize-y min-h-[72px]`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={shared}
        />
      )}
    </label>
  );
}

function countLabel(list: readonly string[]): string {
  return list.includes(NONE_OPTION_ID) ? 'keine' : String(countSelected(list));
}

/** Reine Zählung gespeicherter Angaben — bewusst ohne Score oder Ampel. */
function aiSetupSummary(
  setup: AiSetup | null,
): { label: string; value: string; badge: string }[] {
  if (!setup) {
    return [
      { label: 'KI-Systeme erfasst', value: '—', badge: 'Offen' },
      { label: 'Bots/Agenten vorbereitet', value: '—', badge: 'Offen' },
      { label: 'Datenklassen erkannt', value: '—', badge: 'Offen' },
      { label: 'Freigaben definiert', value: '—', badge: 'Offen' },
    ];
  }
  return [
    { label: 'KI-Systeme erfasst', value: countLabel(setup.aiSystems), badge: 'Persisted' },
    { label: 'Bots/Agenten vorbereitet', value: countLabel(setup.botsAgents), badge: 'Persisted' },
    { label: 'Datenklassen erkannt', value: String(setup.dataClasses.length), badge: 'Persisted' },
    {
      label: 'Freigaben definiert',
      value: `${setup.approvals.humanApprovalFor.length} Aktionen`,
      badge: setup.approvals.logEveryAgentAction ? 'Persisted · Protokoll an' : 'Persisted',
    },
  ];
}

export function stepNumberForWizardStep(step: WizardStep): 1 | 2 | 3 | 4 {
  const core = ACTIVATION_CORE_STEPS.find((s) => s.id === step);
  if (core) return core.stepNumber;
  return 3;
}

export function GovernanceActivationView() {
  const { activeTenantId, loading: tenantLoading } = useTenant();
  const [searchParams] = useSearchParams();
  const finishTarget = safeInternalPath(searchParams.get('next')) ?? '/app/dashboard';
  const domainParam = searchParams.get('domain');
  const [step, setStep] = useState<WizardStep>('organization');
  const [org, setOrg] = useState<ActivationOrganization>(() =>
    prefillOrgFromScan(loadScanProfile(), domainParam),
  );
  const [scopes, setScopes] = useState<string[]>([...DEFAULT_SCOPES]);
  const [dropActive, setDropActive] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<string[]>([]);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [aiSetup, setAiSetup] = useState<AiSetup>(createEmptyAiSetup);
  /** Zuletzt gespeicherter Stand — die Ergebnisseite zeigt nur Gespeichertes. */
  const [savedAiSetup, setSavedAiSetup] = useState<AiSetup | null>(null);
  /** Was zuletzt gespeichert wurde — die Erfolgsmeldung folgt dem Speichervorgang, nicht dem aktuellen Schritt. */
  const [lastSavedPart, setLastSavedPart] = useState<'org-scope' | 'ai-setup' | null>(null);
  const isPersistedStep = PERSISTED_STEPS.includes(step);
  /** Tenant, dessen Bestand im Formular steht (`''` = kein Tenant). `undefined` = noch nicht geladen. */
  const [loadedTenantId, setLoadedTenantId] = useState<string | undefined>(undefined);
  /** Solange der Bestand des aktiven Tenants nicht geladen ist, zeigt das Formular nur Vorbelegung — nicht speichern. */
  const isLoadingActivation =
    tenantLoading || loadState === 'loading' || loadedTenantId !== (activeTenantId ?? '');

  const currentStepNumber = stepNumberForWizardStep(step);
  const coreStepMeta = ACTIVATION_CORE_STEPS.find((s) => s.id === step);
  const comingSoonMeta = COMING_SOON_STEPS.find((s) => s.id === step);
  const activeHeaderIndex = coreStepMeta?.index ?? 'VORSCHAU';
  const activeHeaderLabel = coreStepMeta?.label ?? comingSoonMeta?.label ?? 'Organization';
  const coreIdx = ACTIVATION_CORE_STEPS.findIndex((s) => s.id === step);

  useEffect(() => {
    recordTimeToFirstEvidence('activation_started', 1);
  }, []);

  useEffect(() => {
    if (!activeTenantId) return;
    void claimPendingAudit().catch(() => null);
  }, [activeTenantId]);

  useEffect(() => {
    if (tenantLoading) return;
    const scanPrefill = prefillOrgFromScan(loadScanProfile(), domainParam);
    // Workspace-Wechsel: Formularzustand des vorherigen Tenants verwerfen, bevor
    // geladen wird — sonst landen fremde Angaben im neuen Tenant.
    setOrg(scanPrefill);
    setScopes([...DEFAULT_SCOPES]);
    setAiSetup(createEmptyAiSetup());
    setSavedAiSetup(null);
    setLastSavedAt(null);
    setLastSavedPart(null);
    setSaveState('idle');
    setLoadedTenantId(undefined);
    if (!activeTenantId) {
      setLoadedTenantId('');
      setLoadState('ready');
      return;
    }
    let cancelled = false;
    setLoadState('loading');
    void loadGovernanceActivation(activeTenantId)
      .then((record) => {
        if (cancelled) return;
        if (record) {
          const { aiSetup: storedAiSetup, ...orgFields } = record.organization;
          setOrg({
            ...scanPrefill,
            ...orgFields,
            company: orgFields.company || scanPrefill.company,
          });
          if (storedAiSetup) {
            setAiSetup(storedAiSetup);
            setSavedAiSetup(storedAiSetup);
          }
          if (record.scopes.length > 0) setScopes(record.scopes);
          setLastSavedAt(record.updatedAt);
        }
        setLoadedTenantId(activeTenantId);
        setLoadState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        // Wie bisher: Formular startet leer und bleibt speicherbar.
        setLoadedTenantId(activeTenantId);
        setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenantId, tenantLoading, domainParam]);

  function toggleScope(id: string) {
    setScopes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setSaveState('idle');
  }

  function updateAiSetup(next: AiSetup) {
    setAiSetup(next);
    setSaveState('idle');
  }

  async function persistActivation(): Promise<boolean> {
    if (isLoadingActivation) return false;
    if (!activeTenantId) {
      setSaveError('Kein aktiver Tenant. Activation speichern erfordert einen Workspace.');
      setSaveState('error');
      return false;
    }
    setSaveState('saving');
    setSaveError(null);
    try {
      // aiSetup nur aus dem eigenen Schritt mitsenden; Org-/Scope-Speichern lässt
      // den gespeicherten Bestand per Merge in activationApi unangetastet.
      const savingAiSetup = step === 'ai-inventory';
      await saveGovernanceActivation({
        tenantId: activeTenantId,
        organization: savingAiSetup ? { ...org, aiSetup } : org,
        scopes,
      });
      if (savingAiSetup) {
        setSavedAiSetup(aiSetup);
        const profile = loadCompanyProfile(activeTenantId);
        const selectedSystems = aiSetup.aiSystems.filter((id) => id !== NONE_OPTION_ID);
        saveCompanyProfile(activeTenantId, {
          ...profile,
          aiSystems: Array.from(new Set([...profile.aiSystems, ...selectedSystems])),
        });
        clearScanProfile();
        recordTimeToFirstEvidence('first_evidence_ready', 3);
      } else if (step === 'organization') {
        recordTimeToFirstEvidence('organization_saved', 1);
      } else if (step === 'scope') {
        recordTimeToFirstEvidence('scope_saved', 2);
      }
      setLastSavedPart(savingAiSetup ? 'ai-setup' : 'org-scope');
      setSaveState('saved');
      setLastSavedAt(new Date().toISOString());
      return true;
    } catch (e) {
      setSaveState('error');
      setSaveError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
      return false;
    }
  }

  async function goNext() {
    if (isPersistedStep) {
      const ok = await persistActivation();
      if (!ok) return;
    }
    if (coreIdx >= 0 && coreIdx < ACTIVATION_CORE_STEPS.length - 1) {
      setStep(ACTIVATION_CORE_STEPS[coreIdx + 1].id);
      return;
    }
    setStep('status');
  }

  function goBack() {
    if (coreIdx > 0) {
      setStep(ACTIVATION_CORE_STEPS[coreIdx - 1].id);
      return;
    }
    setStep('ai-inventory');
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDropActive(false);
    const names = Array.from(e.dataTransfer.files).map((f) => f.name);
    if (names.length === 0) return;
    setQueuedFiles((prev) => [...prev, ...names]);
  }

  function onBrowse(e: FormEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const names = Array.from(input.files ?? []).map((f) => f.name);
    if (names.length) setQueuedFiles((prev) => [...prev, ...names]);
    input.value = '';
  }

  return (
    <div className="min-h-full bg-obsidian-950 text-titanium-100 px-4 sm:px-6 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-obsidian-800 border border-titanium-800 flex items-center justify-center shrink-0">
              <Sparkles className={`h-5 w-5 ${OS_ACCENT_TEXT}`} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="font-display font-bold text-xl text-titanium-50 tracking-tight">
                  Governance Activation
                </h1>
                <ModuleStatusBadge status="beta" />
                <span
                  data-testid="activation-step-progress"
                  className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border border-[#00B8D4]/50 bg-obsidian-900 text-[#00B8D4]"
                >
                  Schritt {currentStepNumber} von 4
                </span>
                {isPersistedStep && lastSavedAt ? (
                  <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 border border-emerald-800 bg-emerald-950 text-emerald-300">
                    Persisted
                  </span>
                ) : (
                  <PreviewChip>{implementationStatusLabel('governance-activation', 'live')}</PreviewChip>
                )}
              </div>
              <p className="text-sm text-titanium-400">
                Turn existing data into operational governance.
              </p>
              <p className="mt-2 text-xs text-titanium-500 max-w-xl leading-relaxed">
                Von Bestandschaos zu aktiver Governance. Organization, Scope und AI Setup werden im
                Tenant gespeichert. Blueprint, Extraction und Expert Review bleiben Coming Soon, bis
                das Backend steht.
              </p>
            </div>
          </div>
          <Link
            to={finishTarget}
            className={`text-[11px] font-mono uppercase tracking-wider text-titanium-500 hover:text-[#00B8D4] transition-colors shrink-0`}
          >
            ← Compliance Dashboard
          </Link>
        </header>

        <div className="flex flex-wrap gap-1.5">
          {SUBMODULES.map((name) => (
            <span
              key={name}
              className="font-mono text-[9px] uppercase tracking-widest px-2 py-1 border border-titanium-900 text-titanium-500 bg-obsidian-900"
            >
              {name}
            </span>
          ))}
        </div>

        {(loadState === 'loading' || tenantLoading) && (
          <p className="text-xs text-titanium-500 flex items-center gap-2 font-mono">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Activation wird geladen…
          </p>
        )}
        {loadState === 'error' && (
          <p className="text-xs text-amber-400 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            Bestehende Activation konnte nicht geladen werden — Formular startet leer.
          </p>
        )}
        {!activeTenantId && !tenantLoading && (
          <p className="text-xs text-amber-400 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            Kein Workspace aktiv — Speichern ist erst nach Tenant-Zuordnung möglich.
          </p>
        )}

        <nav aria-label="Activation steps" className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-titanium-900 border border-titanium-900">
          {ACTIVATION_CORE_STEPS.map((s) => {
            const active = s.id === step;
            const done = s.stepNumber < currentStepNumber;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={`px-3 py-2.5 text-left transition-colors ${
                  active
                    ? 'bg-obsidian-800 text-titanium-50 border-b-2 border-[#00B8D4]'
                    : 'bg-obsidian-950 text-titanium-500 hover:bg-obsidian-900 hover:text-titanium-200'
                }`}
              >
                <div className={`font-mono text-[9px] tracking-widest ${active || done ? 'text-[#00B8D4]/90' : 'text-titanium-600'}`}>
                  {s.index} · SCHRITT {s.stepNumber}/4
                  {done ? ' · DONE' : active ? ' · ACTIVE' : ''}
                </div>
                <div className="text-xs font-medium mt-0.5">{s.label}</div>
              </button>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
            Geplante Erweiterungen:
          </span>
          {COMING_SOON_STEPS.map((cs) => {
            const active = cs.id === step;
            return (
              <button
                key={cs.id}
                type="button"
                onClick={() => setStep(cs.id)}
                className={`px-2.5 py-1 border font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  active
                    ? 'border-[#00B8D4] bg-obsidian-800 text-titanium-50'
                    : 'border-titanium-900 bg-obsidian-950 text-titanium-500 hover:text-titanium-300'
                }`}
              >
                {cs.label} · {implementationStatusLabel(cs.implementationId)}
              </button>
            );
          })}
        </div>

        <section className="border border-titanium-900 bg-obsidian-900 p-5 sm:p-6 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display font-semibold text-titanium-50 text-base">
              <span className={`font-mono ${OS_ACCENT_TEXT} mr-2`}>{activeHeaderIndex}</span>
              {activeHeaderLabel}
            </h2>
            <span className="font-mono text-[11px] text-titanium-400">
              Schritt {currentStepNumber} von 4
            </span>
            {comingSoonMeta && (
              <PreviewChip>{implementationStatusLabel(comingSoonMeta.implementationId)}</PreviewChip>
            )}
          </div>

          {step === 'organization' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Unternehmen"
                value={org.company}
                onChange={(v) => {
                  setOrg({ ...org, company: v });
                  setSaveState('idle');
                }}
                placeholder="z. B. Muster GmbH"
              />
              <label className="block space-y-1.5">
                <span className="text-[11px] uppercase tracking-wider text-titanium-400 font-mono">
                  Organisationstyp
                </span>
                <select
                  aria-label="Organisationstyp"
                  value={org.tenantType ?? ''}
                  onChange={(e) => {
                    const val = e.target.value as ActivationTenantType | '';
                    setOrg({
                      ...org,
                      tenantType: val ? val : undefined,
                    });
                    setSaveState('idle');
                  }}
                  className={`w-full bg-obsidian-950 border border-titanium-800 text-sm text-titanium-100 px-3 py-2 outline-none ${OS_FOCUS_BORDER}`}
                >
                  <option value="">Bitte wählen (optional)…</option>
                  {TENANT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px] uppercase tracking-wider text-titanium-400 font-mono">
                  Anzahl Mitarbeiter (optional)
                </span>
                <select
                  aria-label="Anzahl Mitarbeiter"
                  value={org.orgSizeEmployees ?? ''}
                  onChange={(e) => {
                    const parsed = e.target.value ? Number(e.target.value) : undefined;
                    setOrg({
                      ...org,
                      orgSizeEmployees: parsed,
                    });
                    setSaveState('idle');
                  }}
                  className={`w-full bg-obsidian-950 border border-titanium-800 text-sm text-titanium-100 px-3 py-2 outline-none ${OS_FOCUS_BORDER}`}
                >
                  <option value="">Bitte wählen…</option>
                  {EMPLOYEE_SIZE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px] uppercase tracking-wider text-titanium-400 font-mono">
                  KI-Betriebsmodus (optional)
                </span>
                <select
                  aria-label="KI-Betriebsmodus"
                  value={org.residencyPolicy ?? ''}
                  onChange={(e) => {
                    const val = e.target.value as ActivationResidencyPolicy | '';
                    setOrg({
                      ...org,
                      residencyPolicy: val ? val : undefined,
                    });
                    setSaveState('idle');
                  }}
                  className={`w-full bg-obsidian-950 border border-titanium-800 text-sm text-titanium-100 px-3 py-2 outline-none ${OS_FOCUS_BORDER}`}
                >
                  <option value="">Bitte wählen…</option>
                  {RESIDENCY_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="Gesellschaften"
                value={org.entities}
                onChange={(v) => {
                  setOrg({ ...org, entities: v });
                  setSaveState('idle');
                }}
                placeholder="Rechtsträger, Tochtergesellschaften"
              />
              <Field
                label="Standorte"
                value={org.locations}
                onChange={(v) => {
                  setOrg({ ...org, locations: v });
                  setSaveState('idle');
                }}
                placeholder="Frankfurt, München, …"
              />
              <Field
                label="Business Units"
                value={org.businessUnits}
                onChange={(v) => {
                  setOrg({ ...org, businessUnits: v });
                  setSaveState('idle');
                }}
                placeholder="Sales, Engineering, Legal, …"
              />
              <Field
                label="Rollen"
                value={org.roles}
                onChange={(v) => {
                  setOrg({ ...org, roles: v });
                  setSaveState('idle');
                }}
                placeholder="Admin, Reviewer, Auditor, Owner"
              />
              <Field
                label="Mitarbeiter- / Teamstruktur"
                value={org.teamStructure}
                onChange={(v) => {
                  setOrg({ ...org, teamStructure: v });
                  setSaveState('idle');
                }}
                placeholder="Teams und Berichtslinien"
                rows={3}
              />
              <Field
                label="Verantwortlichkeiten"
                value={org.responsibilities}
                onChange={(v) => {
                  setOrg({ ...org, responsibilities: v });
                  setSaveState('idle');
                }}
                placeholder="DSB, AI Officer, Risk Owner, …"
                rows={3}
              />
            </div>
          )}

          {step === 'scope' && (
            <div className="space-y-4">
              <p className="text-sm text-titanium-400">
                Governance Scope wählen (Mehrfachauswahl). Organization + Scope werden im Tenant
                persistiert. Der Auto-Blueprint bleibt Coming Soon.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SCOPE_OPTIONS.map((opt) => {
                  const active = scopes.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleScope(opt.id)}
                      className={`text-left p-3 border transition-colors flex items-start gap-2 ${
                        active
                          ? 'border-[#00B8D4] bg-obsidian-800'
                          : 'border-titanium-800 bg-obsidian-950 hover:border-titanium-600'
                      }`}
                    >
                      {active ? (
                        <CheckCircle2 className={`h-4 w-4 ${OS_ACCENT_TEXT} shrink-0 mt-0.5`} />
                      ) : (
                        <ShieldCheck className="h-4 w-4 text-titanium-600 shrink-0 mt-0.5" />
                      )}
                      <span className="text-sm font-medium text-titanium-100">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              {scopes.length === 0 && (
                <p className="text-xs text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> Mindestens einen Scope wählen.
                </p>
              )}
            </div>
          )}

          {step === 'ai-inventory' && <AiSetupStep value={aiSetup} onChange={updateAiSetup} />}

          {step === 'blueprint' && (
            <div className="space-y-4">
              <p className="text-sm text-titanium-400">
                Auto-Blueprint Engine — Flow:{' '}
                <span className="font-mono text-[11px] text-[#00B8D4]/90">
                  ORGANIZATION → BLUEPRINT → Policies / Controls / Risks → Systems → Evidence → Owners → Tasks
                </span>
              </p>
              <div className="border border-dashed border-titanium-800 bg-obsidian-950 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Layers className={`h-4 w-4 ${OS_ACCENT_TEXT}`} />
                  <span className="text-sm font-semibold text-titanium-100">Governance Blueprint</span>
                  <PreviewChip>{implementationStatusLabel('activation-blueprint')}</PreviewChip>
                </div>
                <p className="text-xs text-titanium-500 leading-relaxed">
                  Spec-Beispiel (nicht live): „Ihr Unternehmen nutzt Microsoft 365, Salesforce und
                  OpenAI.“ → Systeme, Anbieter, Datenverarbeitungen, KI-Systeme, Risiken, Controls,
                  Verantwortliche, Nachweise, Aufgaben.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                  {[
                    ['Systeme', '—'],
                    ['Risiken', '—'],
                    ['Controls', '—'],
                    ['Aufgaben', '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="border border-titanium-900 bg-obsidian-900 p-3">
                      <div className="font-mono text-[9px] uppercase tracking-widest text-titanium-500">
                        {label}
                      </div>
                      <div className="mt-1 text-lg text-titanium-300 font-mono">{value}</div>
                      <div className="mt-1">
                        <PreviewChip>{implementationStatusLabel('activation-blueprint')}</PreviewChip>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'documents' && (
            <div className="space-y-4">
              <p className="text-sm text-titanium-400">
                Evidence & Migration Engine — Ablegen erzeugt lokal eine Warteschlange. Parsing,
                Extraction und Mapping sind <span className="font-mono text-amber-300">{implementationStatusLabel('activation-doc-extract')}</span>.
              </p>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropActive(true);
                }}
                onDragLeave={() => setDropActive(false)}
                onDrop={onDrop}
                className={`border border-dashed p-8 text-center transition-colors ${
                  dropActive
                    ? 'border-[#00B8D4] bg-[#00B8D4]/10'
                    : 'border-titanium-800 bg-obsidian-950'
                }`}
              >
                <FileUp className={`h-8 w-8 ${OS_ACCENT_TEXT} mx-auto mb-3`} />
                <p className="text-sm font-medium text-titanium-100">Bestehende Dokumente hier ablegen</p>
                <p className="mt-2 text-[11px] font-mono text-titanium-500 tracking-wide">{ACCEPTED_TYPES}</p>
                <label className="mt-4 inline-flex cursor-pointer items-center gap-2 px-3 py-2 border border-titanium-700 text-xs text-titanium-200 hover:border-[#00B8D4] hover:text-titanium-50 transition-colors">
                  Dateien wählen
                  <input type="file" multiple className="hidden" onChange={onBrowse} />
                </label>
              </div>

              {queuedFiles.length > 0 && (
                <div className="border border-titanium-900 bg-obsidian-950 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-titanium-200">Warteschlange</span>
                    <PreviewChip>{STATUS_LABEL.preview}</PreviewChip>
                  </div>
                  <ul className="space-y-1">
                    {queuedFiles.map((name) => (
                      <li key={name} className="font-mono text-[11px] text-titanium-400 truncate">
                        {name} · mapping table {implementationStatusLabel('activation-doc-extract')}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-titanium-600">
                    Ergebnis-UX ist eine Mapping-Tabelle (recognized vs auto-mapped) — nicht „Import
                    erfolgreich“.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <div className="border border-titanium-900 bg-obsidian-950 p-5">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <AlertCircle className={`h-4 w-4 ${OS_ACCENT_TEXT}`} />
                  <h3 className="text-sm font-semibold text-titanium-100">
                    Entscheidungen, die Aufmerksamkeit brauchen
                  </h3>
                  <PreviewChip>{implementationStatusLabel('activation-expert-review')}</PreviewChip>
                </div>
                <p className="text-sm text-titanium-400">
                  Experten sehen nicht alles — nur offene Entscheidungen. Aktuell keine offenen
                  Entscheidungen (leere Queue / kein Extraction-Backend).
                </p>
              </div>

              <div className="border border-dashed border-titanium-800 bg-obsidian-950/60 p-4 opacity-70">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-titanium-500" />
                  <span className="text-xs font-mono uppercase tracking-wider text-titanium-500">
                    Spec-Beispiel · nicht live
                  </span>
                </div>
                <p className="text-sm text-titanium-300">
                  Unklarer KI-Anbieter: <span className={`font-mono ${OS_ACCENT_TEXT}`}>OpenAI</span>
                </p>
                <p className="mt-1 text-xs text-titanium-500">
                  Optionen: AI Service Provider / Processor / Third Party / Other
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['Bestätigen', 'Ändern', 'Ignorieren'].map((label) => (
                    <button
                      key={label}
                      type="button"
                      disabled
                      className="px-3 py-1.5 text-xs border border-titanium-800 text-titanium-600 cursor-not-allowed"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'status' && (
            <div className="space-y-4">
              {savedAiSetup ? (
                <h3 className="text-base font-semibold text-titanium-50 flex items-center gap-2">
                  <CheckCircle2 className={`h-5 w-5 ${OS_ACCENT_TEXT}`} />
                  Ihr AI Governance Workspace ist vorbereitet.
                </h3>
              ) : (
                <div className="border border-amber-900 bg-obsidian-950 p-4 space-y-2">
                  <p className="text-sm text-amber-300 flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4" /> Das AI Setup ist noch nicht gespeichert.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep('ai-inventory')}
                    className="text-xs text-[#00B8D4] hover:underline"
                  >
                    Zum AI Setup
                  </button>
                </div>
              )}
              <p className="text-sm text-titanium-400">
                Die Zahlen zählen Ihre gespeicherten Angaben. Sie sind keine Risikobewertung.
                Blueprint und Readiness bleiben Coming Soon, bis die Backends live sind.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {aiSetupSummary(savedAiSetup).map(({ label, value, badge }) => (
                  <div key={label} className="border border-titanium-900 bg-obsidian-950 p-4">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-titanium-500">
                      {label}
                    </div>
                    <div className="mt-1 text-2xl font-mono text-titanium-200">{value}</div>
                    <div className="mt-2">
                      <PreviewChip>{badge}</PreviewChip>
                    </div>
                  </div>
                ))}
                <div className="border border-titanium-900 bg-obsidian-950 p-4">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-titanium-500">
                    Evidence / Audit
                  </div>
                  <div className="mt-1 text-sm text-titanium-200">Nächster Schritt</div>
                  <Link
                    to="/app/evidence"
                    className="mt-2 inline-block text-xs text-[#00B8D4] hover:underline"
                  >
                    Evidence prüfen
                  </Link>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  ['Organization', org.company.trim() ? 'saved' : '—', org.company.trim() ? 'Persisted' : STATUS_LABEL.preview],
                  ['Scopes', String(scopes.length), scopes.length > 0 ? 'Persisted' : STATUS_LABEL.preview],
                  ['Blueprint', '—', implementationStatusLabel('activation-blueprint')],
                ].map(([label, value, badge]) => (
                  <div key={label} className="border border-titanium-900 bg-obsidian-950 p-4">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-titanium-500">
                      {label}
                    </div>
                    <div className="mt-1 text-2xl font-mono text-titanium-200">{value}</div>
                    <div className="mt-2">
                      <PreviewChip>{badge}</PreviewChip>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <footer className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 'organization' || saveState === 'saving'}
            className="px-4 py-2 text-sm border border-titanium-800 text-titanium-300 hover:border-titanium-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Zurück
          </button>
          <div className="flex flex-col items-stretch sm:items-end gap-2">
            {saveState === 'saved' && (
              <span className="font-mono text-[10px] text-emerald-400 tracking-wider">
                {lastSavedPart === 'ai-setup' ? 'AI SETUP SAVED' : 'ORGANIZATION + SCOPE SAVED'}
              </span>
            )}
            {saveState === 'error' && saveError && (
              <span className="text-xs text-amber-400 max-w-sm text-right">{saveError}</span>
            )}
            <div className="flex flex-wrap gap-2 justify-end">
              {isPersistedStep && (
                <button
                  type="button"
                  onClick={() => void persistActivation()}
                  disabled={
                    saveState === 'saving' ||
                    isLoadingActivation ||
                    !activeTenantId ||
                    (step === 'ai-inventory' && !isAiSetupComplete(aiSetup))
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 border border-titanium-700 text-sm text-titanium-200 hover:border-[#00B8D4] disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  {saveState === 'saving' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Speichern…
                    </>
                  ) : (
                    'Speichern'
                  )}
                </button>
              )}
              {step !== 'status' ? (
                <button
                  type="button"
                  onClick={() => void goNext()}
                  disabled={
                    (step === 'scope' && scopes.length === 0) ||
                    (step === 'ai-inventory' && !isAiSetupComplete(aiSetup)) ||
                    saveState === 'saving' ||
                    (isPersistedStep && (isLoadingActivation || !activeTenantId))
                  }
                  className={`inline-flex items-center gap-2 px-4 py-2 ${OS_CREAM_BTN} text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition`}
                >
                  Continue Activation <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <Link
                  to={finishTarget}
                  className={`inline-flex items-center gap-2 px-4 py-2 ${OS_CREAM_BTN} text-sm font-semibold transition`}
                >
                  Zum Governance Command Center <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
