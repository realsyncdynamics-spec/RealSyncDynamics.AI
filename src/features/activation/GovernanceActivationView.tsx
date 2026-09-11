/**
 * Governance Activation — first UI slice (Preview).
 *
 * Product module (NOT onboarding / NOT a setup wizard). Spec:
 * `docs/product/governance-activation.md`
 *
 * Route: `/app/activation` inside GovernanceBrowserShell.
 * No live tenant KPIs — placeholder numbers are labeled Preview / Coming Soon.
 */
import { useState, type DragEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileUp,
  Layers,
  ShieldCheck,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { ModuleStatusBadge } from '../../components/governance-os/ModuleStatusBadge';

type WizardStep = 'organization' | 'scope' | 'blueprint' | 'documents' | 'review' | 'status';

const STEPS: readonly { id: WizardStep; label: string; index: string }[] = [
  { id: 'organization', label: 'Organization', index: '01' },
  { id: 'scope', label: 'Scope', index: '02' },
  { id: 'blueprint', label: 'Blueprint', index: '03' },
  { id: 'documents', label: 'Migration', index: '04' },
  { id: 'review', label: 'Expert Review', index: '05' },
  { id: 'status', label: 'Go-Live', index: '06' },
];

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

const ACCEPTED_TYPES = 'XLSX · CSV · DOCX · PDF · JSON · VVT · DSFA · TOM · Policies · Risiko-Register';

interface OrgDraft {
  company: string;
  entities: string;
  locations: string;
  businessUnits: string;
  teamStructure: string;
  responsibilities: string;
  roles: string;
}

const EMPTY_ORG: OrgDraft = {
  company: '',
  entities: '',
  locations: '',
  businessUnits: '',
  teamStructure: '',
  responsibilities: '',
  roles: '',
};

function PreviewChip({ children }: { children: string }) {
  return (
    <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 bg-amber-950 text-amber-300 border border-amber-800">
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
    'w-full bg-obsidian-950 border border-titanium-800 text-sm text-titanium-100 px-3 py-2 outline-none focus:border-cyan-500 placeholder:text-titanium-600';
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

export function GovernanceActivationView() {
  const [step, setStep] = useState<WizardStep>('organization');
  const [org, setOrg] = useState<OrgDraft>(EMPTY_ORG);
  const [scopes, setScopes] = useState<string[]>(['dsgvo', 'eu-ai-act', 'ai-governance']);
  const [dropActive, setDropActive] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<string[]>([]);

  const stepMeta = STEPS.find((s) => s.id === step) ?? STEPS[0];
  const stepIdx = STEPS.findIndex((s) => s.id === step);

  function toggleScope(id: string) {
    setScopes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function goNext() {
    const next = STEPS[stepIdx + 1];
    if (next) setStep(next.id);
  }

  function goBack() {
    const prev = STEPS[stepIdx - 1];
    if (prev) setStep(prev.id);
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
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-obsidian-800 border border-titanium-800 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="font-display font-bold text-xl text-titanium-50 tracking-tight">
                  Governance Activation
                </h1>
                <ModuleStatusBadge status="beta" />
                <PreviewChip>Preview</PreviewChip>
              </div>
              <p className="text-sm text-titanium-400">
                Turn existing data into operational governance.
              </p>
              <p className="mt-2 text-xs text-titanium-500 max-w-xl leading-relaxed">
                Von Bestandschaos zu aktiver Governance. Importiere bestehende Daten und Dokumente —
                RealSyncDynamics.AI strukturiert Organisation, Risiken, Systeme, Policies und Nachweise.
                Experten prüfen nur Entscheidungen.
              </p>
            </div>
          </div>
          <Link
            to="/app/dashboard"
            className="text-[11px] font-mono uppercase tracking-wider text-titanium-500 hover:text-cyan-300 transition-colors shrink-0"
          >
            ← Compliance Dashboard
          </Link>
        </header>

        {/* Submodule strip */}
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

        {/* Step rail */}
        <nav aria-label="Activation steps" className="flex flex-wrap gap-px bg-titanium-900 border border-titanium-900">
          {STEPS.map((s) => {
            const active = s.id === step;
            const done = STEPS.findIndex((x) => x.id === s.id) < stepIdx;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={`flex-1 min-w-[7.5rem] px-3 py-2.5 text-left transition-colors ${
                  active
                    ? 'bg-obsidian-800 text-titanium-50'
                    : 'bg-obsidian-950 text-titanium-500 hover:bg-obsidian-900 hover:text-titanium-200'
                }`}
              >
                <div className="font-mono text-[9px] tracking-widest text-cyan-500/80">
                  {s.index}
                  {done ? ' · DONE' : active ? ' · ACTIVE' : ''}
                </div>
                <div className="text-xs font-medium mt-0.5">{s.label}</div>
              </button>
            );
          })}
        </nav>

        {/* Canvas */}
        <section className="border border-titanium-900 bg-obsidian-900 p-5 sm:p-6 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display font-semibold text-titanium-50 text-base">
              <span className="font-mono text-cyan-400 mr-2">{stepMeta.index}</span>
              {stepMeta.label}
            </h2>
            {step !== 'organization' && step !== 'scope' && <PreviewChip>Coming Soon</PreviewChip>}
          </div>

          {step === 'organization' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Unternehmen"
                value={org.company}
                onChange={(v) => setOrg({ ...org, company: v })}
                placeholder="z. B. RealSync Dynamics GmbH"
              />
              <Field
                label="Gesellschaften"
                value={org.entities}
                onChange={(v) => setOrg({ ...org, entities: v })}
                placeholder="Rechtsträger, Tochtergesellschaften"
              />
              <Field
                label="Standorte"
                value={org.locations}
                onChange={(v) => setOrg({ ...org, locations: v })}
                placeholder="Frankfurt, München, …"
              />
              <Field
                label="Business Units"
                value={org.businessUnits}
                onChange={(v) => setOrg({ ...org, businessUnits: v })}
                placeholder="Sales, Engineering, Legal, …"
              />
              <Field
                label="Mitarbeiter- / Teamstruktur"
                value={org.teamStructure}
                onChange={(v) => setOrg({ ...org, teamStructure: v })}
                placeholder="Teams und Berichtslinien"
                rows={3}
              />
              <Field
                label="Verantwortlichkeiten"
                value={org.responsibilities}
                onChange={(v) => setOrg({ ...org, responsibilities: v })}
                placeholder="DSB, AI Officer, Risk Owner, …"
                rows={3}
              />
              <div className="sm:col-span-2">
                <Field
                  label="Rollen"
                  value={org.roles}
                  onChange={(v) => setOrg({ ...org, roles: v })}
                  placeholder="Admin, Reviewer, Auditor, Owner"
                />
              </div>
            </div>
          )}

          {step === 'scope' && (
            <div className="space-y-4">
              <p className="text-sm text-titanium-400">
                Governance Scope wählen (Mehrfachauswahl). Danach erzeugt die Engine automatisch einen
                Governance Blueprint.
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
                          ? 'border-cyan-400 bg-obsidian-800'
                          : 'border-titanium-800 bg-obsidian-950 hover:border-titanium-600'
                      }`}
                    >
                      {active ? (
                        <CheckCircle2 className="h-4 w-4 text-cyan-300 shrink-0 mt-0.5" />
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

          {step === 'blueprint' && (
            <div className="space-y-4">
              <p className="text-sm text-titanium-400">
                Auto-Blueprint Engine — Flow:{' '}
                <span className="font-mono text-[11px] text-cyan-300/90">
                  ORGANIZATION → BLUEPRINT → Policies / Controls / Risks → Systems → Evidence → Owners → Tasks
                </span>
              </p>
              <div className="border border-dashed border-titanium-800 bg-obsidian-950 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-cyan-400" />
                  <span className="text-sm font-semibold text-titanium-100">Governance Blueprint</span>
                  <PreviewChip>Preview</PreviewChip>
                </div>
                <p className="text-xs text-titanium-500 leading-relaxed">
                  Beispiel-Erkennung (Spec): „Ihr Unternehmen nutzt Microsoft 365, Salesforce und OpenAI.“
                  → Systeme, Anbieter, Datenverarbeitungen, KI-Systeme, Risiken, Controls, Verantwortliche,
                  Nachweise, Aufgaben, Review-Anforderungen.
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
                        <PreviewChip>Coming Soon</PreviewChip>
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
                Extraction und Mapping sind <span className="font-mono text-amber-300">Coming Soon</span>.
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
                    ? 'border-cyan-400 bg-cyan-950/20'
                    : 'border-titanium-800 bg-obsidian-950'
                }`}
              >
                <FileUp className="h-8 w-8 text-cyan-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-titanium-100">Bestehende Dokumente hier ablegen</p>
                <p className="mt-2 text-[11px] font-mono text-titanium-500 tracking-wide">{ACCEPTED_TYPES}</p>
                <label className="mt-4 inline-flex cursor-pointer items-center gap-2 px-3 py-2 border border-titanium-700 text-xs text-titanium-200 hover:border-cyan-500 hover:text-titanium-50 transition-colors">
                  Dateien wählen
                  <input type="file" multiple className="hidden" onChange={onBrowse} />
                </label>
              </div>

              {queuedFiles.length > 0 && (
                <div className="border border-titanium-900 bg-obsidian-950 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-titanium-200">Warteschlange</span>
                    <PreviewChip>Preview</PreviewChip>
                  </div>
                  <ul className="space-y-1">
                    {queuedFiles.map((name) => (
                      <li key={name} className="font-mono text-[11px] text-titanium-400 truncate">
                        {name} · mapping table Coming Soon
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
                  <AlertCircle className="h-4 w-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-titanium-100">
                    Entscheidungen, die Aufmerksamkeit brauchen
                  </h3>
                  <PreviewChip>Preview</PreviewChip>
                </div>
                <p className="text-sm text-titanium-400">
                  Experten sehen nicht alles — nur offene Entscheidungen. Aktuell keine offenen
                  Entscheidungen (leere Queue / Preview).
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
                  Unklarer KI-Anbieter: <span className="font-mono text-cyan-300">OpenAI</span>
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
              <h3 className="text-sm font-semibold text-titanium-100">Your Governance Activation</h3>
              <p className="text-sm text-titanium-400">
                Nach dem Import kein leeres Shell — Readiness, Ausnahmen und nächste Schritte. Zahlen
                nur als Preview, bis echte Tenant-Daten vorliegen.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  ['Readiness', '—', 'Preview'],
                  ['Exceptions', '—', 'Coming Soon'],
                  ['Open decisions', '0', 'Preview'],
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
              <div className="border border-titanium-900 bg-obsidian-950 p-4">
                <div className="font-mono text-[9px] uppercase tracking-widest text-titanium-500 mb-2">
                  Next actions
                </div>
                <ul className="space-y-1.5 text-sm text-titanium-300">
                  <li>· Review AI systems</li>
                  <li>· Confirm processors</li>
                  <li>· Upload TOM</li>
                  <li>· Assign owner</li>
                  <li>· Approve AI Act policy pack</li>
                </ul>
              </div>
            </div>
          )}
        </section>

        {/* Footer actions */}
        <footer className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={stepIdx === 0}
            className="px-4 py-2 text-sm border border-titanium-800 text-titanium-300 hover:border-titanium-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Zurück
          </button>
          <div className="flex flex-wrap gap-2">
            {stepIdx < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={step === 'scope' && scopes.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-obsidian-950 text-sm font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Continue Activation <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <Link
                to="/app/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-obsidian-950 text-sm font-semibold hover:brightness-110 transition"
              >
                Continue Activation <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
