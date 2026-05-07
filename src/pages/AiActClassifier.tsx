import React, { useState } from 'react';
import { LegalDisclaimer } from '../components/LegalDisclaimer';

const QUESTIONS = [
  { id: 'biometric', text: 'Verarbeitet Ihr System biometrische Daten zur Identifikation?', high: true },
  { id: 'hr_screening', text: 'Wird das System für Bewerber-Screening oder Mitarbeiter-Bewertung eingesetzt?', high: true },
  { id: 'credit', text: 'Trifft das System Kreditwürdigkeits- oder Bonität-Entscheidungen?', high: true },
  { id: 'health', text: 'Unterstützt das System medizinische Diagnosen oder Behandlungsempfehlungen?', high: true },
  { id: 'law_enforcement', text: 'Wird das System von Strafverfolgungsbehörden eingesetzt?', high: true },
  { id: 'critical_infra', text: 'Steuert das System kritische Infrastruktur (Energie, Wasser, Verkehr)?', high: true },
  { id: 'education', text: 'Bewertet das System Schüler/Studierende oder entscheidet über Bildungszugang?', high: true },
  { id: 'public_decision', text: 'Trifft das System Entscheidungen über Sozialleistungen oder öffentliche Dienste?', high: true },
  { id: 'emotion', text: 'Erkennt das System Emotionen von Menschen (Emotion Recognition)?', limited: true },
  { id: 'deepfake', text: 'Generiert das System Deepfakes oder synthetische Medien?', limited: true },
  { id: 'chatbot', text: 'Handelt es sich um einen Chatbot der direkt mit Nutzern interagiert?', limited: true },
  { id: 'prohibited', text: 'Nutzt das System Manipulation durch subliminale Techniken oder Social Scoring?', prohibited: true },
];

type Risk = 'prohibited' | 'high' | 'limited' | 'minimal';

export function AiActClassifier() {
  const [answers, setAnswers] = useState<Record<string, boolean | null>>({});
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<Risk | null>(null);
  const [system, setSystem] = useState('');

  function answer(id: string, val: boolean) {
    const next = { ...answers, [id]: val };
    setAnswers(next);
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      classify(next);
    }
  }

  function classify(a: Record<string, boolean | null>) {
    if (QUESTIONS.filter(q => q.prohibited).some(q => a[q.id])) { setResult('prohibited'); return; }
    if (QUESTIONS.filter(q => q.high).some(q => a[q.id])) { setResult('high'); return; }
    if (QUESTIONS.filter(q => q.limited).some(q => a[q.id])) { setResult('limited'); return; }
    setResult('minimal');
  }

  const q = QUESTIONS[step];
  const progress = Math.round((step / QUESTIONS.length) * 100);

  const riskConfig: Record<Risk, { color: string; bg: string; label: string; icon: string; desc: string; actions: string[] }> = {
    prohibited: {
      color: '#ef4444', bg: '#450a0a', label: 'VERBOTEN', icon: '🚫',
      desc: 'Ihr System fällt unter Art. 5 AI Act: vollständig verbotene KI-Praktiken. Der Einsatz ist ab 2. August 2024 untersagt.',
      actions: ['System sofort einstellen oder grundlegend überarbeiten', 'Rechtliche Beratung einholen', 'Alternative Ansätze ohne verbotene Techniken entwickeln'],
    },
    high: {
      color: '#f97316', bg: '#431407', label: 'HOHES RISIKO (Annex III)', icon: '⚠️',
      desc: 'Ihr System ist nach Annex III AI Act als Hochrisiko eingestuft. Conformity Assessment bis 2. August 2026 Pflicht.',
      actions: [
        'Risiko-Management-System einrichten (Art. 9)',
        'Technische Dokumentation erstellen (Art. 11)',
        'Human Oversight implementieren (Art. 14)',
        'Audit-Log für alle KI-Entscheidungen (Art. 12)',
        'Conformity Assessment durchführen',
        'EU-Datenbank-Registrierung (Art. 49)',
      ],
    },
    limited: {
      color: '#eab308', bg: '#422006', label: 'BEGRENZTES RISIKO', icon: '⚡',
      desc: 'Ihr System unterliegt spezifischen Transparenzpflichten (Art. 50 AI Act): Nutzer müssen wissen, dass sie mit KI interagieren.',
      actions: [
        'Transparenzhinweis für Nutzer implementieren ("Sie interagieren mit KI")',
        'Deepfake-Label bei generierten Inhalten',
        'Regelmäßige Überprüfung der Einstufung',
      ],
    },
    minimal: {
      color: '#16a34a', bg: '#052e16', label: 'MINIMALES RISIKO', icon: '✓',
      desc: 'Ihr System fällt in die Kategorie minimales Risiko. Keine verpflichtenden Anforderungen — Good Practice empfohlen.',
      actions: [
        'Freiwilliger Code of Conduct (empfohlen)',
        'Basis-Dokumentation des Systems',
        'Regelmäßige Neubewertung bei System-Updates',
      ],
    },
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: 'Inter, sans-serif', padding: '2rem' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>EU AI Act · Annex III</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem' }}>KI-Risikoklassifikation</h1>
        <p style={{ color: '#9ca3af', marginBottom: '1rem' }}>Finden Sie in 2 Minuten heraus, welche AI-Act-Anforderungen für Ihr System gelten.</p>
        <LegalDisclaimer context="classification" />

        {result === null ? (
          <div style={{ border: '1px solid #374151', borderRadius: 4, padding: '2rem' }}>
            {/* System Name */}
            {step === 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Ihr KI-System (optional)</label>
                <input value={system} onChange={e => setSystem(e.target.value)} placeholder="z.B. GPT-gestützte Mandantenanalyse" style={{ width: '100%', background: '#111827', border: '1px solid #374151', borderRadius: 4, padding: '0.6rem 0.75rem', color: '#e5e7eb', fontSize: '0.875rem', boxSizing: 'border-box' }} />
              </div>
            )}

            {/* Progress */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.4rem' }}>
                <span>Frage {step + 1} von {QUESTIONS.length}</span>
                <span>{progress}%</span>
              </div>
              <div style={{ height: 4, background: '#374151', borderRadius: 2 }}>
                <div style={{ height: '100%', background: '#3b82f6', borderRadius: 2, width: progress + '%', transition: 'width 0.3s' }} />
              </div>
            </div>

            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '2rem', lineHeight: 1.5 }}>{q.text}</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <button onClick={() => answer(q.id, true)}
                style={{ padding: '1rem', border: '1px solid #374151', borderRadius: 4, background: 'transparent', color: '#e5e7eb', fontSize: '1rem', cursor: 'pointer', fontWeight: 600 }}>
                ✓ Ja
              </button>
              <button onClick={() => answer(q.id, false)}
                style={{ padding: '1rem', border: '1px solid #374151', borderRadius: 4, background: 'transparent', color: '#e5e7eb', fontSize: '1rem', cursor: 'pointer', fontWeight: 600 }}>
                ✗ Nein
              </button>
            </div>

            {step > 0 && (
              <button onClick={() => setStep(step - 1)} style={{ marginTop: '1rem', background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.875rem' }}>
                ← Zurück
              </button>
            )}
          </div>
        ) : (
          <div>
            <div style={{ background: riskConfig[result].bg, border: `1px solid ${riskConfig[result].color}`, borderRadius: 4, padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{riskConfig[result].icon}</div>
              <div style={{ fontSize: '0.7rem', color: riskConfig[result].color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>AI Act Risiko-Einstufung</div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: riskConfig[result].color, marginBottom: '0.5rem' }}>{riskConfig[result].label}</h2>
              {system && <p style={{ color: '#9ca3af', marginBottom: '0.75rem', fontSize: '0.875rem' }}>System: {system}</p>}
              <p style={{ lineHeight: 1.7 }}>{riskConfig[result].desc}</p>
            </div>

            <div style={{ border: '1px solid #374151', borderRadius: 4, padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Erforderliche Maßnahmen:</h3>
              <ul style={{ paddingLeft: '1.5rem', lineHeight: 2 }}>
                {riskConfig[result].actions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <a href="/contact-sales" style={{ background: '#3b82f6', color: '#fff', textDecoration: 'none', borderRadius: 4, padding: '0.75rem 1.5rem', fontWeight: 700, display: 'inline-block' }}>
                Expertengespräch buchen
              </a>
              <a href="/dsgvo-ki-checkliste" style={{ background: 'transparent', color: '#9ca3af', textDecoration: 'none', border: '1px solid #374151', borderRadius: 4, padding: '0.75rem 1.5rem', fontWeight: 700, display: 'inline-block' }}>
                DSGVO-Checkliste ansehen
              </a>
              <button onClick={() => { setAnswers({}); setStep(0); setResult(null); setSystem(''); }} style={{ background: 'transparent', color: '#6b7280', border: 'none', cursor: 'pointer', padding: '0.75rem 1rem' }}>
                Neu klassifizieren
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
