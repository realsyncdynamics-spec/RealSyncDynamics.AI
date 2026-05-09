import { useState } from 'react';
import { LegalDisclaimer } from '../components/LegalDisclaimer';
import { ConfidenceScore } from '../components/ConfidenceScore';
import {
  REGISTRY,
  getUseCase,
  getCategory,
  getObligationLabel,
  aggregateObligations,
  aggregateSeverity,
  type AnnexIIIUseCase,
  type Severity,
} from '../lib/ai-act/registry';

/**
 * /ai-act-klassifikator — registry-backed EU-AI-Act-Risiko-Klassifikator.
 *
 * Quelle: src/rules/annex-iii.json (Annex III + Art. 5-Overlays + Art. 50
 * Disclosure-Pflichten).
 *
 * Flow (deterministisch, keine LLM-Calls):
 *   1. Optional: System-Name eingeben
 *   2. 14 Trigger-Fragen — jede mappt auf 1+ Annex-III-Use-Cases
 *   3. Result-Seite: höchste Severity + matched Use-Cases mit Pflichten,
 *      Normen-Referenzen, Beispielen und Carve-Outs
 *
 * Adaptive Question-Flow (nur Sub-Fragen wenn Top-Level-Kategorie aktiv) ist
 * für MVP-Slice P3 vorgesehen, hier noch linear.
 */

interface QuestionDef {
  id: string;
  text: string;
  matchUseCases: string[];
  /** Art. 5 Verbots-Trigger ohne Annex-III-Use-Case (z.B. Social Scoring) */
  prohibited?: { norm: string; rationale: string };
  /** Art. 50 Transparenz-Trigger ohne High-Risk-Use-Case (z.B. Chatbot, Deepfake) */
  limited?: { norm: string; rationale: string };
}

// 14 Fragen die alle 8 Annex-III-Kategorien abfragen + 3 reine Limited-/Prohibited-Trigger.
const QUESTIONS: QuestionDef[] = [
  {
    id: 'q_biometric_id',
    text: 'Identifiziert Ihr System Personen biometrisch aus der Distanz (Gesicht, Stimme, Iris) — z.B. nachträgliche Video-Auswertung oder Datenbank-Abgleich?',
    matchUseCases: ['biometric_remote_identification'],
  },
  {
    id: 'q_biometric_cat',
    text: 'Kategorisiert Ihr System Personen anhand biometrischer Merkmale (Alter, Geschlecht, demografische Gruppe)?',
    matchUseCases: ['biometric_categorisation'],
  },
  {
    id: 'q_emotion',
    text: 'Erkennt Ihr System Emotionen aus Mimik, Stimme oder Körperhaltung — z.B. am Arbeitsplatz, in Bildung oder Customer-Service?',
    matchUseCases: ['emotion_recognition'],
  },
  {
    id: 'q_critical_infra',
    text: 'Wird das System als Sicherheitskomponente in kritischer Infrastruktur eingesetzt (Strom, Wasser, Gas, Verkehr)?',
    matchUseCases: ['critical_infrastructure_safety'],
  },
  {
    id: 'q_education_admission',
    text: 'Entscheidet das System über Zugang, Aufnahme oder Zuweisung zu Bildungseinrichtungen?',
    matchUseCases: ['education_admission'],
  },
  {
    id: 'q_education_eval',
    text: 'Bewertet das System Lernergebnisse, Prüfungen oder beaufsichtigt Online-Tests (Proctoring)?',
    matchUseCases: ['education_evaluation'],
  },
  {
    id: 'q_employment_recruiting',
    text: 'Filtert, rankt oder bewertet das System Bewerbungen — z.B. CV-Screening, Video-Interview-Analyse, AI-gestützte Job-Ad-Selektion?',
    matchUseCases: ['employment_recruiting'],
  },
  {
    id: 'q_employment_workforce',
    text: 'Trifft oder unterstützt das System Entscheidungen über Beförderung, Kündigung, Aufgabenverteilung oder Performance-Bewertung?',
    matchUseCases: ['employment_workforce_management'],
  },
  {
    id: 'q_public_benefits',
    text: 'Wird das System von einer öffentlichen Stelle eingesetzt um über Sozialleistungen, Jobcenter-Maßnahmen oder Wohngeld zu entscheiden?',
    matchUseCases: ['essential_services_public_benefits'],
  },
  {
    id: 'q_credit_scoring',
    text: 'Bewertet das System Kreditwürdigkeit, Bonität oder Underwriting natürlicher Personen (Konsum-Kredit, Hypothek, BNPL)?',
    matchUseCases: ['essential_services_credit_scoring'],
  },
  {
    id: 'q_insurance',
    text: 'Bewertet das System Risiken oder berechnet Preise für Lebens- oder Krankenversicherungen?',
    matchUseCases: ['essential_services_insurance_risk'],
  },
  {
    id: 'q_law_enforcement',
    text: 'Wird das System von Strafverfolgungsbehörden für Profiling, Crime-Analytics oder Beweis-Bewertung eingesetzt?',
    matchUseCases: ['law_enforcement_profiling'],
  },
  {
    id: 'q_migration',
    text: 'Wird das System in Migrations-, Visum- oder Asylverfahren oder Grenzkontrollen eingesetzt?',
    matchUseCases: ['migration_visa_asylum'],
  },
  {
    id: 'q_justice_election',
    text: 'Unterstützt das System Justizbehörden bei Urteilsfindung — oder wird es zur Beeinflussung von Wahlen oder Wähler-Verhalten eingesetzt?',
    matchUseCases: ['justice_judicial_assistance'],
  },
  // Reine Limited-Risk- bzw. Prohibited-Trigger (kein Annex-III-Use-Case erforderlich)
  {
    id: 'q_chatbot',
    text: 'Interagiert das System direkt mit Endnutzern (Chatbot, Voice-Assistant, AI-Avatar)?',
    matchUseCases: [],
    limited: {
      norm: 'AI Act Art. 50 Abs. 1',
      rationale: 'User müssen wissen dass sie mit einer KI interagieren — Disclosure-Pflicht.',
    },
  },
  {
    id: 'q_synthetic_media',
    text: 'Generiert das System synthetische Bilder, Audio, Video oder Text (Deepfakes, AI-generated content)?',
    matchUseCases: [],
    limited: {
      norm: 'AI Act Art. 50 Abs. 2 + 4',
      rationale: 'Output muss als KI-erzeugt markiert werden (machine-readable + sichtbar bei Deepfakes).',
    },
  },
  {
    id: 'q_prohibited_manipulation',
    text: 'Nutzt das System unterschwellige Manipulation, ausnutzt Schwachstellen vulnerabler Gruppen, oder macht Social Scoring durch öffentliche Stellen?',
    matchUseCases: [],
    prohibited: {
      norm: 'AI Act Art. 5 Abs. 1 lit. a-c',
      rationale: 'Vollständig verbotene KI-Praktiken — Einsatz in EU untersagt seit 2. Februar 2025.',
    },
  },
];

interface ClassificationResult {
  severity: Severity;
  matchedUseCases: AnnexIIIUseCase[];
  prohibitedTriggers: { norm: string; rationale: string }[];
  limitedTriggers: { norm: string; rationale: string }[];
  hasProhibitedOverlay: boolean;
}

function classify(answers: Record<string, boolean>): ClassificationResult {
  const matchedIds = new Set<string>();
  const prohibitedTriggers: ClassificationResult['prohibitedTriggers'] = [];
  const limitedTriggers: ClassificationResult['limitedTriggers'] = [];

  for (const q of QUESTIONS) {
    if (answers[q.id] !== true) continue;
    for (const ucId of q.matchUseCases) matchedIds.add(ucId);
    if (q.prohibited) prohibitedTriggers.push(q.prohibited);
    if (q.limited)    limitedTriggers.push(q.limited);
  }

  const matchedUseCases = [...matchedIds].map(getUseCase).filter(Boolean) as AnnexIIIUseCase[];
  const sev = aggregateSeverity([...matchedIds]);

  let severity: Severity;
  if (prohibitedTriggers.length > 0) {
    severity = 'prohibited';
  } else if (sev.highest === 'high') {
    severity = 'high';
  } else if (limitedTriggers.length > 0) {
    severity = 'limited';
  } else {
    severity = 'limited'; // "minimal" gibts in der Registry-Severity nicht — wir mappen auf "limited" nur falls Trigger
    // Wenn gar nichts matched: zeigen wir als Severity 'limited' aber mit Hinweis "minimal/keine Pflicht"
    if (matchedUseCases.length === 0 && limitedTriggers.length === 0) {
      severity = 'limited'; // Workaround — siehe ResultPanel: zeigt "minimal" wenn matchedUseCases leer
    }
  }

  return {
    severity,
    matchedUseCases,
    prohibitedTriggers,
    limitedTriggers,
    hasProhibitedOverlay: sev.hasProhibitedOverlay,
  };
}

function confidenceFor(result: ClassificationResult, answeredCount: number): number {
  if (result.prohibitedTriggers.length > 0) return 90;
  if (result.matchedUseCases.length >= 2) return 85;
  if (result.matchedUseCases.length === 1) return 78;
  if (result.limitedTriggers.length > 0) return 75;
  if (answeredCount === QUESTIONS.length) return 70;
  return 60;
}

const STYLE = {
  page: { minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: 'Inter, sans-serif', padding: '2rem' } as React.CSSProperties,
  container: { maxWidth: 760, margin: '0 auto' } as React.CSSProperties,
  card: { border: '1px solid #374151', borderRadius: 4, padding: '2rem' } as React.CSSProperties,
  label: { display: 'block', fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.3rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  input: { width: '100%', background: '#111827', border: '1px solid #374151', borderRadius: 4, padding: '0.6rem 0.75rem', color: '#e5e7eb', fontSize: '0.875rem', boxSizing: 'border-box' as const },
  btn: { padding: '1rem', border: '1px solid #374151', borderRadius: 4, background: 'transparent', color: '#e5e7eb', fontSize: '1rem', cursor: 'pointer', fontWeight: 600 },
};

export function AiActClassifier() {
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState(0);
  const [system, setSystem] = useState('');
  const [done, setDone] = useState(false);

  function answer(id: string, val: boolean) {
    const next = { ...answers, [id]: val };
    setAnswers(next);
    if (step < QUESTIONS.length - 1) setStep(step + 1);
    else setDone(true);
  }

  if (done) {
    const result = classify(answers);
    return (
      <div style={STYLE.page}>
        <div style={STYLE.container}>
          <Header />
          <ResultPanel system={system} result={result} answeredCount={Object.keys(answers).length} />
        </div>
      </div>
    );
  }

  const q = QUESTIONS[step];
  const progress = Math.round((step / QUESTIONS.length) * 100);

  return (
    <div style={STYLE.page}>
      <div style={STYLE.container}>
        <Header />

        <div style={STYLE.card}>
          {step === 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={STYLE.label}>Ihr KI-System (optional)</label>
              <input
                value={system}
                onChange={(e) => setSystem(e.target.value)}
                placeholder="z.B. ATS mit ML-CV-Ranking"
                style={STYLE.input}
              />
            </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.4rem' }}>
              <span>Frage {step + 1} von {QUESTIONS.length}</span>
              <span>{progress}%</span>
            </div>
            <div style={{ height: 4, background: '#374151', borderRadius: 2 }}>
              <div style={{ height: '100%', background: '#3b82f6', borderRadius: 2, width: progress + '%', transition: 'width 0.3s' }} />
            </div>
          </div>

          <h2 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '2rem', lineHeight: 1.55 }}>{q.text}</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <button onClick={() => answer(q.id, true)} style={STYLE.btn}>✓ Ja</button>
            <button onClick={() => answer(q.id, false)} style={STYLE.btn}>✗ Nein</button>
          </div>

          <div style={{ marginTop: '1rem', fontSize: '0.7rem', color: '#6b7280', textAlign: 'center' }}>
            Annex-III-Registry v{REGISTRY.version} · {REGISTRY.use_cases.length} Use-Cases · {REGISTRY.categories.length} Kategorien
          </div>
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <>
      <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>
        EU AI Act · Annex III
      </div>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem' }}>KI-Risikoklassifikation</h1>
      <p style={{ color: '#9ca3af', marginBottom: '1rem' }}>
        Registry-basierte Klassifikation gemäß Annex III der Verordnung 2024/1689 — deterministisch, juristisch granular.
      </p>
      <LegalDisclaimer context="classification" />
    </>
  );
}

function ResultPanel({ system, result, answeredCount }: {
  system: string;
  result: ClassificationResult;
  answeredCount: number;
}) {
  const isMinimal = result.severity === 'limited' && result.matchedUseCases.length === 0 && result.limitedTriggers.length === 0;

  const cfg = isMinimal ? {
    color: '#16a34a', bg: '#052e16', border: '#166534', label: 'MINIMALES RISIKO', icon: '✓',
    desc: 'Keine Annex-III-Use-Cases und keine Art.50-Transparenzpflichten getroffen. Empfehlung: Code-of-Conduct nach Art. 95 freiwillig adoptieren.',
  } : result.severity === 'prohibited' ? {
    color: '#ef4444', bg: '#450a0a', border: '#7f1d1d', label: 'VERBOTEN', icon: '🚫',
    desc: 'Mindestens ein Trigger fällt unter Art. 5 AI Act — vollständig verbotene Praktik. Einsatz in EU untersagt.',
  } : result.severity === 'high' ? {
    color: '#f97316', bg: '#431407', border: '#9a3412', label: 'HOHES RISIKO (Annex III)', icon: '⚠️',
    desc: `Ihr System ist nach Annex III als High-Risk eingestuft. ${result.matchedUseCases.length} Use-Case${result.matchedUseCases.length === 1 ? '' : 's'} matched. Conformity Assessment + Annex-IV-Dokumentation Pflicht vor Inverkehrbringen.`,
  } : {
    color: '#eab308', bg: '#422006', border: '#854d0e', label: 'BEGRENZTES RISIKO', icon: '⚡',
    desc: 'Ihr System unterliegt Transparenzpflichten nach Art. 50 — User müssen wissen dass sie mit KI interagieren bzw. Output ist als KI-generiert zu markieren.',
  };

  const obligations = aggregateObligations(result.matchedUseCases.map((uc) => uc.id));
  const confidence = confidenceFor(result, answeredCount);

  return (
    <div>
      {/* Severity-Card */}
      <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 4, padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>{cfg.icon}</span>
          <div style={{ color: cfg.color, fontWeight: 800, fontSize: '1.15rem', letterSpacing: '0.04em' }}>{cfg.label}</div>
        </div>
        {system && <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.4rem' }}>System: <strong>{system}</strong></div>}
        <p style={{ color: '#e5e7eb', lineHeight: 1.6, marginBottom: 0 }}>{cfg.desc}</p>
        <div style={{ marginTop: '1rem' }}>
          <ConfidenceScore score={confidence} flags={[]} />
        </div>
      </div>

      {/* Prohibited Triggers */}
      {result.prohibitedTriggers.length > 0 && (
        <Section title="Verbotene Praktiken (Art. 5 AI Act)">
          {result.prohibitedTriggers.map((t, i) => (
            <div key={i} style={{ padding: '1rem', border: '1px solid #7f1d1d', borderRadius: 4, marginBottom: '0.5rem', background: '#1a0606' }}>
              <div style={{ fontSize: '0.7rem', color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>{t.norm}</div>
              <div style={{ color: '#fecaca' }}>{t.rationale}</div>
            </div>
          ))}
        </Section>
      )}

      {/* Annex-III Prohibited-Overlay-Hinweis */}
      {result.hasProhibitedOverlay && result.matchedUseCases.length > 0 && (
        <div style={{ padding: '1rem', border: '1px solid #ea580c', background: '#27170d', borderRadius: 4, marginBottom: '1.5rem' }}>
          <div style={{ color: '#fed7aa', fontSize: '0.85rem' }}>
            ⚠ Mindestens ein matched Use-Case hat einen <strong>Art. 5-Verbots-Overlay</strong> (z.B. Emotion-Recognition am Arbeitsplatz). Prüfen Sie die Detail-Cards unten ob Ihr Kontext unter die Verbots-Variante fällt.
          </div>
        </div>
      )}

      {/* Matched Use-Cases */}
      {result.matchedUseCases.length > 0 && (
        <Section title={`Annex-III Use-Cases (${result.matchedUseCases.length})`}>
          {result.matchedUseCases.map((uc) => {
            const cat = getCategory(uc.category);
            return (
              <div key={uc.id} style={{ padding: '1.25rem', border: '1px solid #374151', borderRadius: 4, marginBottom: '0.75rem', background: '#0f172a' }}>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                  {cat?.annex_section} · {cat?.label}
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.5rem' }}>{uc.title}</h3>
                <p style={{ color: '#cbd5e1', lineHeight: 1.55, marginBottom: '0.75rem' }}>{uc.description}</p>

                {uc.examples_de && uc.examples_de.length > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Beispiele</div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#cbd5e1', fontSize: '0.85rem' }}>
                      {uc.examples_de.map((ex) => <li key={ex}>{ex}</li>)}
                    </ul>
                  </div>
                )}

                {uc.prohibited_overlay && (
                  <div style={{ padding: '0.6rem 0.8rem', border: '1px solid #ea580c', borderRadius: 4, fontSize: '0.8rem', color: '#fed7aa', marginBottom: '0.5rem' }}>
                    <strong>Art.5-Overlay:</strong> {uc.prohibited_overlay}
                  </div>
                )}
                {uc.carve_out && (
                  <div style={{ padding: '0.6rem 0.8rem', border: '1px solid #16a34a', borderRadius: 4, fontSize: '0.8rem', color: '#bbf7d0', marginBottom: '0.5rem' }}>
                    <strong>Ausnahme:</strong> {uc.carve_out}
                  </div>
                )}

                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Normen-Referenzen</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {uc.norms.map((n) => (
                      <span key={n} style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', border: '1px solid #475569', borderRadius: 2, color: '#cbd5e1', fontFamily: 'monospace' }}>
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </Section>
      )}

      {/* Aggregated Obligations */}
      {obligations.length > 0 && (
        <Section title={`Pflichten (${obligations.length})`}>
          <ol style={{ paddingLeft: '1.25rem', color: '#cbd5e1', lineHeight: 1.7 }}>
            {obligations.map((o) => (
              <li key={o} style={{ marginBottom: '0.5rem' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#94a3b8', marginRight: '0.4rem' }}>{o}</span>
                — {getObligationLabel(o)}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Limited-Risk Triggers */}
      {result.limitedTriggers.length > 0 && (
        <Section title="Transparenz-Pflichten (Art. 50)">
          {result.limitedTriggers.map((t, i) => (
            <div key={i} style={{ padding: '1rem', border: '1px solid #854d0e', borderRadius: 4, marginBottom: '0.5rem', background: '#1f1503' }}>
              <div style={{ fontSize: '0.7rem', color: '#fde68a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>{t.norm}</div>
              <div style={{ color: '#fef3c7' }}>{t.rationale}</div>
            </div>
          ))}
        </Section>
      )}

    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.6rem', fontWeight: 600 }}>
        {title}
      </div>
      {children}
    </div>
  );
}
