import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Brain, Plus, Trash2, Download, AlertTriangle, ShieldCheck, Sparkles,
  FileSearch, Briefcase,
} from 'lucide-react';

/**
 * /ai-act-workflows — AI-Act Workflow-Inventory (Portfolio-Tool).
 *
 * Multi-Workflow-Klassifikator: User trägt alle AI-Use-Cases ihrer Org ein,
 * pro Workflow wird Annex-III-Risk indikativ bestimmt. Lokale Speicherung
 * (localStorage), kein Account. Free-Tool im Sinne der Strategie:
 * Agenturen / Berater nutzen es für Mandanten-Audits.
 *
 * Differenzierung zu /ai-act-klassifikator (Single-System):
 *   - Single-System dort: 12 Fragen, eine Antwort
 *   - Hier: Liste von N Workflows, pro Workflow Kompakt-Klassifikation,
 *     plus Portfolio-Aggregation (Anzahl Prohibited / High / Limited / Minimal)
 */

type RiskLevel = 'prohibited' | 'high' | 'limited' | 'minimal';

interface Workflow {
  id: string;
  name: string;
  description: string;
  category: WorkflowCategory;
  contextWorkplaceOrEducation: boolean;
  notes: string;
  createdAt: string;
}

type WorkflowCategory =
  | 'chatbot'
  | 'lead_scoring'
  | 'recommendation'
  | 'biometric_id'
  | 'hr_screening'
  | 'credit_decision'
  | 'medical_assist'
  | 'law_enforcement'
  | 'critical_infra'
  | 'education_grading'
  | 'public_benefits'
  | 'emotion_recognition'
  | 'deepfake_generation'
  | 'social_scoring'
  | 'subliminal_manipulation'
  | 'genai_content'
  | 'other';

interface CategoryDef {
  id: WorkflowCategory;
  label: string;
  riskBase: RiskLevel;
  annexRef?: string;
  helper: string;
}

const CATEGORIES: CategoryDef[] = [
  { id: 'social_scoring',          label: 'Social Scoring (öffentl. Stellen)',  riskBase: 'prohibited', annexRef: 'Art. 5 Abs. 1 lit. c', helper: 'Nach AI Act verboten.' },
  { id: 'subliminal_manipulation', label: 'Subliminale Manipulation',           riskBase: 'prohibited', annexRef: 'Art. 5 Abs. 1 lit. a', helper: 'Nach AI Act verboten.' },
  { id: 'biometric_id',            label: 'Biometrische Identifikation',        riskBase: 'high',       annexRef: 'Annex III §1',          helper: 'High-Risk; Echtzeit in öff. Räumen zusätzl. eingeschränkt (Art. 5(1)(h)).' },
  { id: 'hr_screening',            label: 'HR / Bewerber-Screening',            riskBase: 'high',       annexRef: 'Annex III §4',          helper: 'High-Risk per Annex III §4 (Beschäftigung).' },
  { id: 'credit_decision',         label: 'Kreditwürdigkeit / Bonität',         riskBase: 'high',       annexRef: 'Annex III §5(b)',       helper: 'High-Risk per Annex III §5(b) (Zugang zu wesentl. Diensten).' },
  { id: 'medical_assist',          label: 'Medizin-Diagnose-Assistenz',         riskBase: 'high',       annexRef: 'Annex III §1 / MDR',    helper: 'High-Risk; oft zusätzlich MDR-relevant.' },
  { id: 'law_enforcement',         label: 'Strafverfolgung',                    riskBase: 'high',       annexRef: 'Annex III §6',          helper: 'High-Risk, sektoral eingeschränkt.' },
  { id: 'critical_infra',          label: 'Kritische Infrastruktur',            riskBase: 'high',       annexRef: 'Annex III §2',          helper: 'High-Risk per Annex III §2 (Sicherheitskomponente).' },
  { id: 'education_grading',       label: 'Bildung / Bewertung / Zugang',       riskBase: 'high',       annexRef: 'Annex III §3',          helper: 'High-Risk per Annex III §3.' },
  { id: 'public_benefits',         label: 'Sozialleistungen / öff. Dienste',    riskBase: 'high',       annexRef: 'Annex III §5(a)',       helper: 'High-Risk per Annex III §5(a).' },
  { id: 'emotion_recognition',     label: 'Emotion Recognition',                riskBase: 'limited',    annexRef: 'Art. 5(1)(f) / Art. 50',helper: 'Verboten am Arbeitsplatz / in Bildung; sonst Transparenzpflicht.' },
  { id: 'deepfake_generation',     label: 'Deepfake / synthet. Medien',         riskBase: 'limited',    annexRef: 'Art. 50 Abs. 4',        helper: 'Limited-Risk; Markierungspflicht.' },
  { id: 'chatbot',                 label: 'Chatbot / Voice-Assistant',          riskBase: 'limited',    annexRef: 'Art. 50 Abs. 1',        helper: 'Limited-Risk; User-Hinweis nötig („Sie interagieren mit KI").' },
  { id: 'genai_content',           label: 'GenAI Content / GPAI Anwendung',     riskBase: 'limited',    annexRef: 'Art. 50 Abs. 2',        helper: 'Markierungspflicht für künstlich erzeugte Inhalte.' },
  { id: 'lead_scoring',            label: 'Lead-Scoring / Marketing-Targeting', riskBase: 'minimal',    annexRef: '—',                     helper: 'Meist Minimal-Risk; DSGVO-Profiling-Regeln aber relevant.' },
  { id: 'recommendation',          label: 'Recommendation / Personalisierung',  riskBase: 'minimal',    annexRef: '—',                     helper: 'Meist Minimal-Risk; UX-Transparenz empfohlen.' },
  { id: 'other',                   label: 'Anderes / nicht aufgelistet',        riskBase: 'minimal',    annexRef: '—',                     helper: 'Manuelle Prüfung empfohlen — Klassifikator nutzen.' },
];

const CATEGORY_BY_ID: Record<WorkflowCategory, CategoryDef> =
  Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<WorkflowCategory, CategoryDef>;

const STORAGE_KEY = 'ai-act-workflows-v1';

function classifyWorkflow(w: Workflow): { risk: RiskLevel; reason: string } {
  const cat = CATEGORY_BY_ID[w.category];
  if (cat.id === 'emotion_recognition' && w.contextWorkplaceOrEducation) {
    return { risk: 'prohibited', reason: 'Emotion-Recognition am Arbeitsplatz / in Bildung — Art. 5(1)(f).' };
  }
  return { risk: cat.riskBase, reason: cat.helper };
}

function loadWorkflows(): Workflow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch { return []; }
}
function saveWorkflows(list: Workflow[]) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* quota or private mode */ }
}

const RISK_STYLES: Record<RiskLevel, { color: string; bg: string; border: string; label: string }> = {
  prohibited: { color: 'text-red-300',     bg: 'bg-red-950/40',     border: 'border-red-700',     label: 'PROHIBITED' },
  high:       { color: 'text-amber-300',   bg: 'bg-amber-950/30',   border: 'border-amber-700',   label: 'HIGH-RISK' },
  limited:    { color: 'text-yellow-300',  bg: 'bg-yellow-950/30',  border: 'border-yellow-700',  label: 'LIMITED' },
  minimal:    { color: 'text-emerald-300', bg: 'bg-emerald-950/30', border: 'border-emerald-800', label: 'MINIMAL' },
};

export function AiActWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<WorkflowCategory>('chatbot');
  const [contextFlag, setContextFlag] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => { setWorkflows(loadWorkflows()); }, []);
  useEffect(() => { saveWorkflows(workflows); }, [workflows]);

  const portfolio = useMemo(() => {
    const counts: Record<RiskLevel, number> = { prohibited: 0, high: 0, limited: 0, minimal: 0 };
    for (const w of workflows) counts[classifyWorkflow(w).risk]++;
    return counts;
  }, [workflows]);

  function addWorkflow(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const wf: Workflow = {
      id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      description: description.trim(),
      category,
      contextWorkplaceOrEducation: contextFlag,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };
    setWorkflows((cur) => [...cur, wf]);
    setName(''); setDescription(''); setCategory('chatbot'); setContextFlag(false); setNotes('');
  }

  function removeWorkflow(id: string) {
    setWorkflows((cur) => cur.filter((w) => w.id !== id));
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({
      generated_at: new Date().toISOString(),
      methodology_version: 'aiact:2026.05.0',
      portfolio,
      workflows,
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ai-act-inventory-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
            <Brain className="h-4 w-4 text-obsidian-950" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">AI-Act Workflow-Inventar</div>
          <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider bg-amber-950/50 border border-amber-700 text-amber-300 rounded-none ml-2">
            Beta
          </span>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-10">
        <div className="max-w-4xl mx-auto space-y-8">

          <section>
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-amber-900 bg-amber-950/30 text-amber-300 text-xs font-bold uppercase tracking-wider rounded-none mb-4">
              <Brain className="h-3 w-3" /> Free · Lokale Speicherung · Kein Account
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-titanium-50 tracking-tight mb-3">
              Alle AI-Workflows einer Org gegen <span className="text-amber-400">Annex III</span> mappen
            </h1>
            <p className="text-titanium-300 max-w-2xl leading-relaxed">
              Tragen Sie jeden AI-Use-Case einzeln ein — Chatbot, Lead-Scoring, Recommendation, Bewerber-
              Screening, Bonität, GenAI. Sie bekommen eine Portfolio-Übersicht mit indikativer Risiko-
              Klassifizierung. Speicherung ausschließlich im Browser (localStorage), kein Versand.
            </p>
          </section>

          {/* Portfolio summary */}
          {workflows.length > 0 && (
            <section>
              <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">
                Portfolio · {workflows.length} Workflow{workflows.length === 1 ? '' : 's'}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['prohibited', 'high', 'limited', 'minimal'] as const).map((lvl) => {
                  const s = RISK_STYLES[lvl];
                  return (
                    <div key={lvl} className={`p-4 ${s.bg} border ${s.border} rounded-none`}>
                      <div className={`text-3xl font-display font-bold tabular-nums ${s.color}`}>{portfolio[lvl]}</div>
                      <div className={`text-[10px] font-mono uppercase tracking-wider ${s.color} mt-1`}>{s.label}</div>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={exportJson}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300"
              >
                <Download className="h-3.5 w-3.5" /> Inventar als JSON exportieren
              </button>
            </section>
          )}

          {/* Add workflow form */}
          <section className="bg-obsidian-900 border border-titanium-900 p-5 sm:p-6 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-lg mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4 text-amber-400" /> Workflow hinzufügen
            </h2>
            <form onSubmit={addWorkflow} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Name (intern)">
                  <input
                    required value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="z. B. Mandanten-Chatbot Müller"
                    className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none outline-none focus:border-amber-500"
                  />
                </Field>
                <Field label="Was macht das System?">
                  <select
                    value={category} onChange={(e) => setCategory(e.target.value as WorkflowCategory)}
                    className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none outline-none focus:border-amber-500"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Kurzbeschreibung (optional)">
                <input
                  value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="z. B. GPT-4-basierter FAQ-Bot auf Mandanten-Site"
                  className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none outline-none focus:border-amber-500"
                />
              </Field>

              {category === 'emotion_recognition' && (
                <label className="flex items-start gap-2 p-3 bg-red-950/20 border border-red-900 rounded-none">
                  <input
                    type="checkbox" checked={contextFlag} onChange={(e) => setContextFlag(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="text-xs text-red-200 leading-relaxed">
                    Wird am <strong>Arbeitsplatz</strong> oder in <strong>Bildungseinrichtungen</strong> eingesetzt?
                    (Falls ja: Art. 5(1)(f) — System verboten in EU.)
                  </span>
                </label>
              )}

              <Field label="Notizen (optional)">
                <textarea
                  value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  placeholder="z. B. Provider, Datenkategorien, Mandanten-Bezug"
                  className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2 text-sm rounded-none outline-none focus:border-amber-500"
                />
              </Field>

              <div className="text-[11px] text-titanium-500 leading-relaxed">
                Hinweis: <strong>{CATEGORY_BY_ID[category].label}</strong> — Indikativ:
                <span className="ml-1 px-1.5 py-0.5 font-mono uppercase tracking-wider text-[9px] border border-titanium-700">
                  {RISK_STYLES[CATEGORY_BY_ID[category].riskBase].label}
                </span>
                {CATEGORY_BY_ID[category].annexRef && CATEGORY_BY_ID[category].annexRef !== '—' && (
                  <span className="ml-2">· Norm: {CATEGORY_BY_ID[category].annexRef}</span>
                )}
              </div>

              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-obsidian-950 text-sm font-bold rounded-none"
              >
                <Plus className="h-4 w-4" /> Hinzufügen
              </button>
            </form>
          </section>

          {/* Workflow list */}
          {workflows.length > 0 && (
            <section>
              <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Erfasste Workflows</h2>
              <ul className="space-y-2">
                {workflows.map((w) => {
                  const cls = classifyWorkflow(w);
                  const s = RISK_STYLES[cls.risk];
                  return (
                    <li key={w.id} className={`p-4 bg-obsidian-900 border ${s.border} rounded-none`}>
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div>
                          <div className="font-display font-bold text-titanium-50">{w.name}</div>
                          {w.description && <div className="text-xs text-titanium-400 mt-0.5">{w.description}</div>}
                        </div>
                        <button
                          onClick={() => removeWorkflow(w.id)}
                          className="text-titanium-500 hover:text-red-400 p-1"
                          aria-label="Workflow entfernen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] mt-2">
                        <span className={`px-1.5 py-0.5 font-mono uppercase tracking-wider border ${s.border} ${s.color}`}>
                          {s.label}
                        </span>
                        <span className="text-titanium-400">{CATEGORY_BY_ID[w.category].label}</span>
                        {CATEGORY_BY_ID[w.category].annexRef && CATEGORY_BY_ID[w.category].annexRef !== '—' && (
                          <span className="font-mono text-titanium-500">{CATEGORY_BY_ID[w.category].annexRef}</span>
                        )}
                      </div>
                      <div className="text-xs text-titanium-400 mt-2 leading-relaxed">{cls.reason}</div>
                      {w.notes && <div className="text-xs text-titanium-500 mt-1.5 italic">Notizen: {w.notes}</div>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Empty-state guidance */}
          {workflows.length === 0 && (
            <div className="p-5 bg-obsidian-900 border border-titanium-900 border-l-2 border-l-amber-500 rounded-none">
              <h3 className="font-display font-bold text-titanium-50 mb-1.5 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" /> Beispiel-Inventar einer mittelständischen Agentur
              </h3>
              <ul className="text-xs text-titanium-400 space-y-0.5 leading-relaxed">
                <li>· „Kunden-Chatbot Mandant Müller" → Limited (Art. 50)</li>
                <li>· „Lead-Scoring HubSpot" → Minimal (DSGVO-Profiling-Regeln aber relevant)</li>
                <li>· „GPT-4-Texte für Marketing" → Limited (Art. 50 Abs. 2 — Markierungspflicht)</li>
                <li>· „CV-Screening Bewerber" → High (Annex III §4)</li>
              </ul>
              <p className="text-xs text-titanium-400 mt-2">
                Tipp: Erfassen Sie zuerst die offensichtlichen Public-Touch-Workflows, dann Backoffice-Use-Cases.
              </p>
            </div>
          )}

          {/* Cross-link section */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-titanium-900">
            <Link to="/ai-act-klassifikator" className="group p-4 bg-obsidian-900 border border-titanium-900 hover:border-amber-700 rounded-none">
              <FileSearch className="h-4 w-4 text-amber-400 mb-1.5" />
              <div className="text-sm font-display font-bold text-titanium-50 mb-0.5">Tiefen-Klassifikator</div>
              <div className="text-xs text-titanium-400">12-Fragen-Wizard für ein einzelnes System.</div>
            </Link>
            <Link to="/audit" className="group p-4 bg-obsidian-900 border border-titanium-900 hover:border-amber-700 rounded-none">
              <ShieldCheck className="h-4 w-4 text-amber-400 mb-1.5" />
              <div className="text-sm font-display font-bold text-titanium-50 mb-0.5">DSGVO-Audit</div>
              <div className="text-xs text-titanium-400">Zusätzlich Tracker / Security / Drittland.</div>
            </Link>
            <Link to="/contact-sales?intent=agency_aiact" className="group p-4 bg-obsidian-900 border border-amber-700 hover:bg-amber-950/20 rounded-none">
              <Briefcase className="h-4 w-4 text-amber-400 mb-1.5" />
              <div className="text-sm font-display font-bold text-titanium-50 mb-0.5">Agentur-Pilot</div>
              <div className="text-xs text-titanium-400">Multi-Mandanten + White-Label.</div>
            </Link>
          </section>

          <div className="bg-red-950/20 border border-red-900 p-4 rounded-none flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-red-300 mt-0.5 shrink-0" />
            <div className="text-xs text-red-200 leading-relaxed">
              <strong>Indikative Klassifikation</strong> auf Basis Annex III + Art. 5/50. Final-Klassifikation
              für High-Risk-Systeme erfolgt durch Notified Body (Conformity Assessment, Art. 43).
              Keine Rechtsberatung. Methodology-Version: aiact:2026.05.0
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500 mb-1 block">{label}</span>
      {children}
    </label>
  );
}
