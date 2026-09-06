import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, AlertCircle, Loader2,
  ChevronRight, Factory, ShieldAlert, FileText, Save,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';
import { AuthGate } from '../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';
import {
  evaluateIndustrialOt,
  industrialOtPack,
  toEvidence,
  toMeasures,
  type IndustrialOtAnswers,
  type IndustrialOtAssessment,
  type IndustrialOtOutcome,
} from '../../core/governance/industrial-ot';

interface SystemRow {
  id: string;
  site: string;
  sector: string;
  asset: string;
  created_at: string;
  industrial_assessment: { outcome: IndustrialOtOutcome; evaluated_at: string }[];
}

/**
 * Anzeige-Metadaten je Ergebniszustand. Die Engine setzt nur Indikatoren —
 * HIGH_RISK_CANDIDATE und PROHIBITED_CHECK sind Prüfaufträge, keine
 * Einstufungen; das muss die Oberfläche genauso sagen wie das Pack-JSON.
 */
const OUTCOME_UI: Record<IndustrialOtOutcome, { label: string; badge: string; banner: string }> = {
  MINIMAL: {
    label: 'Kein Hochrisiko-Indikator',
    badge: 'text-green-300 border-green-900 bg-green-950/50',
    banner: 'border-green-900/50 bg-green-950/30',
  },
  TRANSPARENCY: {
    label: 'Transparenzpflichten prüfen (Art. 50)',
    badge: 'text-yellow-300 border-yellow-900 bg-yellow-950/50',
    banner: 'border-yellow-900/50 bg-yellow-950/30',
  },
  HIGH_RISK_CANDIDATE: {
    label: 'Hochrisiko-Indikator — rechtliche Prüfung erforderlich',
    badge: 'text-orange-300 border-orange-900 bg-orange-950/50',
    banner: 'border-orange-900/50 bg-orange-950/30',
  },
  PROHIBITED_CHECK: {
    label: 'Mögliche verbotene Praktik — sofortige Prüfung',
    badge: 'text-red-300 border-red-900 bg-red-950/50',
    banner: 'border-red-800 bg-red-950/40',
  },
};

const EMPTY_ANSWERS: IndustrialOtAnswers = {
  site: '',
  sector: 'sonstige',
  asset: '',
  intervention: 'advisory',
  safety_function: 'no',
  machinery_ce: 'no',
  critical_infra: 'none',
  worker_monitoring: 'none',
  human_interaction: false,
  generates_content: false,
};

/** Fragetexte kommen aus dem Pack-JSON — eine Quelle, keine Duplikate. */
function question(field: string): string {
  return industrialOtPack.inputs.find((i) => i.field === field)?.question ?? field;
}

function _IndustrialOtWizardView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const IndustrialOtWizardView = withPerformanceMonitoring(
  _IndustrialOtWizardView,
  'IndustrialOtWizardView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [systems, setSystems] = useState<SystemRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'form' | 'result'>('list');
  const [answers, setAnswers] = useState<IndustrialOtAnswers>(EMPTY_ANSWERS);
  const [assessment, setAssessment] = useState<IndustrialOtAssessment | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  const reload = useCallback(async () => {
    if (!activeTenantId) return;
    setError(null);
    const sb = getSupabase();
    const { data, error: err } = await sb
      .from('industrial_system')
      .select('id, site, sector, asset, created_at, industrial_assessment(outcome, evaluated_at)')
      .eq('tenant_id', activeTenantId)
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); setSystems([]); return; }
    setSystems((data ?? []) as SystemRow[]);
  }, [activeTenantId]);

  useEffect(() => { void reload(); }, [reload]);

  const set = <K extends keyof IndustrialOtAnswers>(key: K, value: IndustrialOtAnswers[K]) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  const formValid = answers.site.trim() !== '' && answers.asset.trim() !== '';

  const runEvaluation = async () => {
    // Bedingte Felder bereinigt übergeben: `learning` ist nur relevant, wenn
    // eine Sicherheitsfunktion nicht ausgeschlossen ist; `generates_content`
    // nur bei direkter Interaktion — sonst hasht ein unsichtbares Feld mit.
    const cleaned: IndustrialOtAnswers = {
      ...answers,
      site: answers.site.trim(),
      asset: answers.asset.trim(),
      learning: answers.safety_function === 'no' ? undefined : answers.learning,
      generates_content: answers.human_interaction ? answers.generates_content : false,
    };
    setAssessment(await evaluateIndustrialOt(cleaned));
    setSavedOk(false);
    setMode('result');
  };

  const saveAssessment = async () => {
    if (!activeTenantId || !assessment) return;
    setSaving(true);
    setError(null);
    const sb = getSupabase();
    try {
      const userId = (await sb.auth.getUser()).data.user?.id ?? null;
      const a = assessment.answers;

      const { data: system, error: sysErr } = await sb
        .from('industrial_system')
        .insert({
          tenant_id: activeTenantId,
          site: a.site, sector: a.sector, asset: a.asset,
          intervention: a.intervention,
          safety_function: a.safety_function,
          machinery_ce: a.machinery_ce,
          critical_infra: a.critical_infra,
          learning: a.learning ?? null,
          worker_monitoring: a.worker_monitoring,
          human_interaction: a.human_interaction,
          generates_content: a.generates_content,
          created_by: userId,
        })
        .select('id')
        .single();
      if (sysErr) throw new Error(sysErr.message);

      // Prüfpfad zuerst: Der Evidence-Eintrag gehört zur Bewertung; schlägt
      // er fehl (z. B. fehlende Policy), wird trotzdem gespeichert — die
      // Bewertung selbst trägt Hash und Indikatoren.
      let evidenceId: string | null = null;
      const { data: ev } = await sb
        .from('ai_evidence_events')
        .insert({ tenant_id: activeTenantId, ...toEvidence(assessment) })
        .select('id')
        .single();
      evidenceId = ev?.id ?? null;

      const { data: saved, error: assErr } = await sb
        .from('industrial_assessment')
        .insert({
          system_id: system.id,
          tenant_id: activeTenantId,
          pack_id: assessment.pack_id,
          pack_version: assessment.pack_version,
          legal_basis_version: assessment.legal_basis_version,
          answers: assessment.answers,
          answers_sha256: assessment.answers_sha256,
          triggered_indicators: assessment.triggered,
          outcome: assessment.outcome,
          open_questions: assessment.open_questions,
          evaluated_by: userId,
          evidence_id: evidenceId,
        })
        .select('id')
        .single();
      if (assErr) throw new Error(assErr.message);

      const measures = toMeasures(assessment).map((m) => ({
        ...m,
        assessment_id: saved.id,
        tenant_id: activeTenantId,
      }));
      if (measures.length > 0) {
        const { error: mErr } = await sb.from('industrial_measure').insert(measures);
        if (mErr) throw new Error(mErr.message);
      }

      setSavedOk(true);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  const sectors = useMemo(
    () => (industrialOtPack.inputs.find((i) => i.field === 'sector') as { values?: string[] })?.values ?? [],
    [],
  );

  const triSelect = (field: 'safety_function' | 'machinery_ce') => (
    <div>
      <label className="block text-[12px] font-semibold text-titanium-200 mb-1.5">{question(field)}</label>
      <div className="flex gap-2">
        {(['yes', 'no', 'unclear'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => set(field, v)}
            className={`px-3 py-1.5 text-xs font-medium border rounded-none ${
              answers[field] === v
                ? 'border-security-500 bg-security-500/10 text-security-300'
                : 'border-titanium-900 text-titanium-400 hover:bg-obsidian-800'
            }`}
          >
            {v === 'yes' ? 'Ja' : v === 'no' ? 'Nein' : 'Unklar'}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance/ai-act-assessment" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-security-600 to-security-800 flex items-center justify-center shadow-sm">
              <Factory className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Industrial OT — AI-Act-Vorprüfung</div>
              <div className="text-[11px] text-titanium-400 font-medium">
                {industrialOtPack.pack_name} · v{industrialOtPack.version}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tenants.length > 1 && (
            <select
              value={activeTenantId ?? ''}
              onChange={(e) => setActiveTenant(e.target.value)}
              className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800 max-w-[200px]"
            >
              {tenants.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>{t.name}</option>
              ))}
            </select>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!activeTenantId ? (
          <div className="text-titanium-500 text-sm">Tenant wählen.</div>
        ) : mode === 'list' ? (
          <div className="space-y-6">
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-5">
              <h2 className="font-semibold text-titanium-50 mb-2">Indikatorenbasierte Vorprüfung für industrielle KI</h2>
              <p className="text-[13px] text-titanium-300 leading-relaxed">
                {industrialOtPack.disclaimer}
              </p>
              <p className="text-[11px] text-titanium-500 mt-3 font-mono">
                Rechtsstand: {industrialOtPack.legal_basis_version}
              </p>
            </div>

            <button
              onClick={() => { setAnswers(EMPTY_ANSWERS); setMode('form'); }}
              className="w-full bg-security-600 hover:bg-security-500 text-white text-sm font-semibold px-6 py-4 rounded-none flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-3">
                <Factory className="h-5 w-5" />
                Neues industrielles KI-System bewerten
              </span>
              <ChevronRight className="h-5 w-5" />
            </button>

            {systems === null ? (
              <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Laden…
              </div>
            ) : systems.length > 0 ? (
              <div>
                <h3 className="font-semibold text-titanium-50 mb-3">Bewertete Systeme</h3>
                <div className="space-y-2">
                  {systems.map((s) => {
                    const latest = [...(s.industrial_assessment ?? [])]
                      .sort((x, y) => y.evaluated_at.localeCompare(x.evaluated_at))[0];
                    const ui = latest ? OUTCOME_UI[latest.outcome] : null;
                    return (
                      <div key={s.id} className="flex items-center justify-between bg-obsidian-900 border border-titanium-900 rounded-none px-4 py-3">
                        <div className="leading-tight">
                          <div className="text-sm font-medium text-titanium-100">{s.asset}</div>
                          <div className="text-[11px] text-titanium-500 font-mono">{s.site} · {s.sector}</div>
                        </div>
                        {ui && latest && (
                          <span className={`text-[11px] font-semibold border rounded-none px-2 py-1 ${ui.badge}`}>
                            {latest.outcome}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : mode === 'form' ? (
          <div className="space-y-5 bg-obsidian-900 border border-titanium-900 rounded-none p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-titanium-200 mb-1.5">{question('site')}</label>
                <input
                  value={answers.site}
                  onChange={(e) => set('site', e.target.value)}
                  className="w-full bg-obsidian-950 border border-titanium-900 text-titanium-100 text-sm rounded-none px-3 py-2 outline-none focus:border-security-500"
                  placeholder="z. B. Werk Bruchsal"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-titanium-200 mb-1.5">{question('sector')}</label>
                <select
                  value={answers.sector}
                  onChange={(e) => set('sector', e.target.value)}
                  className="w-full bg-obsidian-950 border border-titanium-900 text-titanium-100 text-sm rounded-none px-3 py-2 outline-none"
                >
                  {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-titanium-200 mb-1.5">{question('asset')}</label>
              <input
                value={answers.asset}
                onChange={(e) => set('asset', e.target.value)}
                className="w-full bg-obsidian-950 border border-titanium-900 text-titanium-100 text-sm rounded-none px-3 py-2 outline-none focus:border-security-500"
                placeholder="z. B. Ofenlinie 3 — Temperaturführung"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-titanium-200 mb-1.5">{question('intervention')}</label>
              <div className="flex flex-wrap gap-2">
                {([
                  ['advisory', 'Empfiehlt nur'],
                  ['operator_confirm', 'Bediener bestätigt'],
                  ['closed_loop', 'Greift selbst ein (Closed Loop)'],
                ] as const).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set('intervention', v)}
                    className={`px-3 py-1.5 text-xs font-medium border rounded-none ${
                      answers.intervention === v
                        ? 'border-security-500 bg-security-500/10 text-security-300'
                        : 'border-titanium-900 text-titanium-400 hover:bg-obsidian-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {triSelect('safety_function')}
            {triSelect('machinery_ce')}

            {answers.safety_function !== 'no' && (
              <div>
                <label className="block text-[12px] font-semibold text-titanium-200 mb-1.5">{question('learning')}</label>
                <div className="flex flex-wrap gap-2">
                  {([
                    ['static', 'Statisch'],
                    ['ml_offline_update', 'ML, Updates offline'],
                    ['self_evolving_online', 'Selbstlernend im Betrieb'],
                  ] as const).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => set('learning', v)}
                      className={`px-3 py-1.5 text-xs font-medium border rounded-none ${
                        answers.learning === v
                          ? 'border-security-500 bg-security-500/10 text-security-300'
                          : 'border-titanium-900 text-titanium-400 hover:bg-obsidian-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-[12px] font-semibold text-titanium-200 mb-1.5">{question('critical_infra')}</label>
              <select
                value={answers.critical_infra}
                onChange={(e) => set('critical_infra', e.target.value as IndustrialOtAnswers['critical_infra'])}
                className="w-full bg-obsidian-950 border border-titanium-900 text-titanium-100 text-sm rounded-none px-3 py-2 outline-none"
              >
                <option value="none">Nein — nur werksinterne Prozesse</option>
                <option value="strom">Strom (öffentliches Netz)</option>
                <option value="gas">Gas</option>
                <option value="waerme">Wärme</option>
                <option value="wasser">Wasser</option>
                <option value="verkehr">Verkehr</option>
                <option value="digitale_infrastruktur">Digitale Infrastruktur</option>
              </select>
              <p className="text-[11px] text-titanium-500 mt-1.5">
                Nur öffentliche Versorgungsnetze. Werksinternes Energiemanagement zählt <span className="font-semibold">nicht</span> (Anhang III Nr. 2).
              </p>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-titanium-200 mb-1.5">{question('worker_monitoring')}</label>
              <div className="flex flex-wrap gap-2">
                {([
                  ['none', 'Nein'],
                  ['performance', 'Leistung wird bewertet'],
                  ['behaviour_safety', 'Verhalten (Sicherheit)'],
                  ['emotion', 'Emotionserkennung'],
                ] as const).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set('worker_monitoring', v)}
                    className={`px-3 py-1.5 text-xs font-medium border rounded-none ${
                      answers.worker_monitoring === v
                        ? v === 'emotion'
                          ? 'border-red-700 bg-red-950/40 text-red-300'
                          : 'border-security-500 bg-security-500/10 text-security-300'
                        : 'border-titanium-900 text-titanium-400 hover:bg-obsidian-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-[13px] text-titanium-200 cursor-pointer">
              <input
                type="checkbox"
                checked={answers.human_interaction}
                onChange={(e) => set('human_interaction', e.target.checked)}
                className="accent-security-500"
              />
              {question('human_interaction')}
            </label>

            {answers.human_interaction && (
              <label className="flex items-center gap-2.5 text-[13px] text-titanium-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={answers.generates_content}
                  onChange={(e) => set('generates_content', e.target.checked)}
                  className="accent-security-500"
                />
                {question('generates_content')}
              </label>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => void runEvaluation()}
                disabled={!formValid}
                className="bg-security-600 hover:bg-security-500 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 rounded-none"
              >
                Indikatoren auswerten
              </button>
              <button
                onClick={() => setMode('list')}
                className="text-titanium-400 hover:text-titanium-200 text-sm px-3 py-2.5"
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : assessment ? (
          <div className="space-y-5">
            <div className={`border rounded-none p-5 ${OUTCOME_UI[assessment.outcome].banner}`}>
              <div className="flex items-center gap-3">
                {assessment.outcome === 'PROHIBITED_CHECK' ? (
                  <ShieldAlert className="h-6 w-6 text-red-400 shrink-0" />
                ) : assessment.outcome === 'HIGH_RISK_CANDIDATE' ? (
                  <AlertTriangle className="h-6 w-6 text-orange-400 shrink-0" />
                ) : assessment.outcome === 'TRANSPARENCY' ? (
                  <AlertCircle className="h-6 w-6 text-yellow-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-6 w-6 text-green-400 shrink-0" />
                )}
                <div className="leading-tight">
                  <div className="font-display font-bold text-titanium-50">{OUTCOME_UI[assessment.outcome].label}</div>
                  <div className="text-[11px] text-titanium-400 font-mono mt-1">
                    {assessment.triggered.length} Indikatoren · {assessment.open_questions} offene Fragen · SHA-256 {assessment.answers_sha256.slice(0, 16)}…
                  </div>
                </div>
              </div>
              <p className="text-[12px] text-titanium-400 mt-3">{industrialOtPack.disclaimer}</p>
            </div>

            <div className="space-y-3">
              {assessment.triggered.map((t) => (
                <div key={t.id} className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-titanium-500">{t.id}</span>
                      <span className="text-sm font-semibold text-titanium-100">{t.title}</span>
                    </div>
                    <span className={`text-[10px] font-semibold border rounded-none px-1.5 py-0.5 ${OUTCOME_UI[t.outcome].badge}`}>
                      {t.outcome}
                    </span>
                  </div>
                  <div className="text-[12px] text-titanium-400 flex items-start gap-1.5">
                    <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {t.legal_basis}
                  </div>
                  {t.open_question && (
                    <div className="text-[12px] text-yellow-200/80 mt-2 border-l-2 border-yellow-800 pl-2.5">
                      {t.open_question}
                    </div>
                  )}
                  {t.measures.length > 0 && (
                    <ul className="mt-2.5 space-y-1">
                      {t.measures.map((m) => (
                        <li key={m} className="text-[12px] text-titanium-300 flex items-start gap-1.5">
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-security-400" />
                          {m}{t.deadline ? <span className="text-titanium-500 font-mono ml-1">bis {t.deadline}</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {savedOk ? (
                <div className="flex items-center gap-2 text-green-300 text-sm">
                  <CheckCircle2 className="h-4 w-4" /> Gespeichert — Bewertung und Maßnahmen liegen im Prüfpfad.
                </div>
              ) : (
                <button
                  onClick={() => void saveAssessment()}
                  disabled={saving}
                  className="bg-security-600 hover:bg-security-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-none flex items-center gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Bewertung speichern
                </button>
              )}
              <button
                onClick={() => setMode(savedOk ? 'list' : 'form')}
                className="text-titanium-400 hover:text-titanium-200 text-sm px-3 py-2.5"
              >
                {savedOk ? 'Zur Übersicht' : 'Zurück zum Fragebogen'}
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
