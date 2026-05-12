import { useState } from 'react';
import { LegalDisclaimer } from '../components/LegalDisclaimer';
import { HumanVerificationGate } from '../components/HumanVerificationGate';
import { ConfidenceScore } from '../components/ConfidenceScore';

interface DsfaEntry {
  id: string;
  name: string;
  category: string;
  purpose: string;
  dataTypes: string[];
  subjects: string[];
  risks: { risk: string; severity: 'hoch' | 'mittel' | 'niedrig'; likelihood: 'hoch' | 'mittel' | 'niedrig'; measure: string }[];
  necessityAssessed: boolean;
  consultationRequired: boolean;
  notes: string;
}

const riskLevels = ['hoch', 'mittel', 'niedrig'] as const;
const dataTypeOptions = ['Identifikationsdaten', 'Kontaktdaten', 'Gesundheitsdaten', 'Biometrische Daten', 'Standortdaten', 'Finanzdaten', 'Rassische/ethnische Herkunft', 'Politische Meinungen', 'Religiöse Überzeugungen', 'Sexualleben/Orientierung', 'Strafrechtliche Daten', 'Genetische Daten', 'Kommunikationsdaten', 'Verhaltensdaten'];
const subjectOptions = ['Mitarbeiter', 'Kunden', 'Patienten', 'Minderjährige', 'Öffentlichkeit', 'Lieferanten', 'Interessenten', 'Bewerber'];

const emptyRisk = () => ({ risk: '', severity: 'mittel' as const, likelihood: 'mittel' as const, measure: '' });

const SENSITIVE_TYPES = ['Gesundheitsdaten', 'Biometrische Daten', 'Genetische Daten', 'Rassische/ethnische Herkunft', 'Politische Meinungen', 'Religiöse Überzeugungen', 'Sexualleben/Orientierung', 'Strafrechtliche Daten'];

function dsfaConfidence(entries: DsfaEntry[]): number {
  if (entries.length === 0) return 0;
  let score = 65; // base — wizards leiten Entwurf, nicht Endurteil
  const allHaveRisks = entries.every((e) => e.risks.some((r) => r.risk.length > 0));
  if (allHaveRisks) score += 10;
  const allHaveMeasures = entries.every((e) => e.risks.every((r) => r.measure.length > 0));
  if (allHaveMeasures) score += 10;
  const allHaveSubjects = entries.every((e) => e.subjects.length > 0);
  if (allHaveSubjects) score += 5;
  return Math.min(score, 88); // never claim certainty — Final-DSFA durch DSB
}

function dsfaConfidenceFlags(entries: DsfaEntry[]): string[] {
  const flags: string[] = [];
  for (const e of entries) {
    const sensitive = e.dataTypes.filter((t) => SENSITIVE_TYPES.includes(t));
    if (sensitive.length > 0) {
      flags.push(`„${e.name}": Art. 9 besondere Kategorien (${sensitive.join(', ')}) — Anwalt + DSB zwingend einbeziehen`);
    }
    if (e.subjects.includes('Minderjährige')) {
      flags.push(`„${e.name}": Minderjährige (Art. 8) — verschärfte Schutzanforderungen + Eltern-Einwilligung`);
    }
    if (e.consultationRequired) {
      flags.push(`„${e.name}": Vor-Konsultation der Aufsichtsbehörde nach Art. 36 erforderlich (Hochrisiko)`);
    }
    if (e.risks.length > 0 && e.risks.every((r) => !r.measure)) {
      flags.push(`„${e.name}": Keine TOMs zu Risiken erfasst — Sektion ergänzen`);
    }
  }
  if (entries.length === 0) flags.push('Keine Verarbeitungen erfasst — DSFA unvollständig');
  return flags;
}

export function DsfaWizard() {
  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [responsible, setResponsible] = useState('');
  const [entries, setEntries] = useState<DsfaEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<DsfaEntry>({
    id: Date.now().toString(), name: '', category: '', purpose: '',
    dataTypes: [], subjects: [], risks: [emptyRisk()],
    necessityAssessed: false, consultationRequired: false, notes: ''
  });
  const [editMode, setEditMode] = useState(true);
  const [generated, setGenerated] = useState(false);

  const s: React.CSSProperties = {
    background: '#0a0a0a', color: '#e5e7eb', minHeight: '100vh', padding: '32px 16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  };
  const card: React.CSSProperties = { maxWidth: 820, margin: '0 auto', background: '#111', border: '1px solid #1f2937', borderRadius: 12, padding: '32px' };
  const label: React.CSSProperties = { display: 'block', color: '#9ca3af', fontSize: 13, marginBottom: 6, marginTop: 18 };
  const input: React.CSSProperties = { width: '100%', background: '#1a1a2e', border: '1px solid #374151', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' as const };
  const btn: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer' };
  const tag = (color = '#1e3a5f', text = '#93c5fd'): React.CSSProperties => ({ display: 'inline-block', background: color, color: text, borderRadius: 6, padding: '3px 10px', fontSize: 12, margin: '3px 4px 3px 0' });
  const riskColor = (level: string) => level === 'hoch' ? '#dc2626' : level === 'mittel' ? '#d97706' : '#16a34a';

  const toggleDataType = (dt: string) => {
    setCurrentEntry(e => ({
      ...e,
      dataTypes: e.dataTypes.includes(dt) ? e.dataTypes.filter(d => d !== dt) : [...e.dataTypes, dt]
    }));
  };
  const toggleSubject = (s2: string) => {
    setCurrentEntry(e => ({
      ...e,
      subjects: e.subjects.includes(s2) ? e.subjects.filter(d => d !== s2) : [...e.subjects, s2]
    }));
  };
  const updateRisk = (i: number, field: string, val: string) => {
    setCurrentEntry(e => {
      const risks = [...e.risks];
      risks[i] = { ...risks[i], [field]: val };
      return { ...e, risks };
    });
  };
  const addRisk = () => setCurrentEntry(e => ({ ...e, risks: [...e.risks, emptyRisk()] }));
  const saveEntry = () => {
    setEntries(prev => {
      const idx = prev.findIndex(e => e.id === currentEntry.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = currentEntry; return n; }
      return [...prev, currentEntry];
    });
    setCurrentEntry({ id: Date.now().toString(), name: '', category: '', purpose: '', dataTypes: [], subjects: [], risks: [emptyRisk()], necessityAssessed: false, consultationRequired: false, notes: '' });
    setEditMode(false);
  };

  const printReport = () => {
    const date = new Date().toLocaleDateString('de-DE');
    const win = window.open('', '_blank');
    if (!win) return;
    const allHighRisk = entries.some(e => e.risks.some(r => r.severity === 'hoch' && r.likelihood === 'hoch'));
    win.document.write(`<html><head><title>DSFA — ${projectName}</title>
    <style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6;color:#333}
    h1{font-size:22px;border-bottom:2px solid #333;padding-bottom:8px}h2{font-size:17px;margin-top:24px}
    h3{font-size:14px;margin-top:16px;color:#555}.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;margin-right:6px}
    .high{background:#fee2e2;color:#991b1b}.med{background:#fef3c7;color:#92400e}.low{background:#d1fae5;color:#065f46}
    table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #ddd;padding:8px;font-size:13px}th{background:#f5f5f5}
    .warn{background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;margin:12px 0}
    </style></head><body>
    <h1>Datenschutz-Folgenabschätzung (DSFA)</h1>
    <p><strong>Projekt:</strong> ${projectName}<br>
    <strong>Beschreibung:</strong> ${projectDesc}<br>
    <strong>Verantwortliche Stelle:</strong> ${responsible}<br>
    <strong>Datum:</strong> ${date}</p>
    ${allHighRisk ? '<div class="warn">⚠️ <strong>Hinweis:</strong> Mindestens eine Verarbeitung wurde als hohes Risiko eingestuft. Prüfen Sie, ob eine vorherige Konsultation der Aufsichtsbehörde nach Art. 36 DSGVO erforderlich ist.</div>' : ''}
    ${entries.map(e => `
    <h2>${e.name}</h2>
    <p><strong>Kategorie:</strong> ${e.category} | <strong>Zweck:</strong> ${e.purpose}</p>
    <p><strong>Datenkategorien:</strong> ${e.dataTypes.join(', ')}<br>
    <strong>Betroffene Personen:</strong> ${e.subjects.join(', ')}</p>
    <h3>Risikoanalyse</h3>
    <table><tr><th>Risiko</th><th>Schwere</th><th>Wahrscheinlichkeit</th><th>Schutzmaßnahme</th></tr>
    ${e.risks.map(r => `<tr>
      <td>${r.risk}</td>
      <td><span class="${r.severity === 'hoch' ? 'high' : r.severity === 'mittel' ? 'med' : 'low'} badge">${r.severity}</span></td>
      <td><span class="${r.likelihood === 'hoch' ? 'high' : r.likelihood === 'mittel' ? 'med' : 'low'} badge">${r.likelihood}</span></td>
      <td>${r.measure}</td>
    </tr>`).join('')}
    </table>
    ${e.notes ? `<p><strong>Anmerkungen:</strong> ${e.notes}</p>` : ''}
    ${e.consultationRequired ? '<div class="warn">Diese Verarbeitung erfordert möglicherweise eine Konsultation der Aufsichtsbehörde (Art. 36 DSGVO).</div>' : ''}
    `).join('')}
    <p style="margin-top:40px;color:#888;font-size:12px">Erstellt mit RealSync Dynamics AI — DSGVO-Compliance-Plattform | RealSyncDynamicsAI.de</p>
    </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div style={s}>
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <span style={{ fontSize: 36 }}>🔍</span>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: '8px 0 4px' }}>DSFA-Assistent</h1>
          <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 16px 0' }}>Datenschutz-Folgenabschätzung nach Art. 35 DSGVO — strukturiert & auditfähig</p>
        </div>
        <LegalDisclaimer context="document" />
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            {[1,2,3].map(n => (
              <div key={n} style={{ width: 32, height: 4, borderRadius: 2, background: step >= n ? '#2563eb' : '#1f2937' }} />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div>
            <div style={{ background: '#1a1a2e', borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
              <p style={{ color: '#60a5fa', fontSize: 13, margin: 0 }}>
                📋 Eine DSFA ist nach Art. 35 DSGVO <strong>verpflichtend</strong> bei Verarbeitungen mit hohem Risiko — z.B. systematische Überwachung, Scoring, Gesundheitsdaten, automatisierte Entscheidungen.
              </p>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Projektinformationen</h2>
            <label style={label}>Projektname / Bezeichnung der Verarbeitung *</label>
            <input style={input} placeholder="z.B. KI-gestützte Bewerberauswahl" value={projectName} onChange={e => setProjectName(e.target.value)} />
            <label style={label}>Beschreibung des Verarbeitungsvorgangs</label>
            <textarea style={{ ...input, height: 80, resize: 'vertical' as const }} placeholder="Kurze Beschreibung: Was wird verarbeitet, zu welchem Zweck, wer ist beteiligt?" value={projectDesc} onChange={e => setProjectDesc(e.target.value)} />
            <label style={label}>Verantwortliche Stelle / Abteilung</label>
            <input style={input} placeholder="z.B. Musterfirma GmbH — HR-Abteilung" value={responsible} onChange={e => setResponsible(e.target.value)} />
            <button style={{ ...btn, marginTop: 24 }} onClick={() => setStep(2)}>Weiter: Verarbeitungen erfassen →</button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Verarbeitungstätigkeiten & Risikoanalyse</h2>

            {entries.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                {entries.map(e => (
                  <div key={e.id} style={{ background: '#1a1a2e', borderRadius: 8, padding: '12px 16px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{e.name}</span>
                      <div style={{ marginTop: 4 }}>
                        {e.risks.map((r, i) => (
                          <span key={i} style={{ ...tag(), background: r.severity === 'hoch' ? '#3b1515' : r.severity === 'mittel' ? '#3b2a00' : '#1a3a1a', color: r.severity === 'hoch' ? '#fca5a5' : r.severity === 'mittel' ? '#fcd34d' : '#86efac' }}>
                            {r.severity}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => { setCurrentEntry(e); setEditMode(true); }}
                      style={{ background: '#374151', color: '#e5e7eb', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
                      Bearbeiten
                    </button>
                  </div>
                ))}
              </div>
            )}

            {editMode && (
              <div style={{ background: '#0d1117', border: '1px solid #374151', borderRadius: 10, padding: 20, marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 0, marginBottom: 16 }}>
                  {entries.find(e => e.id === currentEntry.id) ? 'Verarbeitung bearbeiten' : 'Neue Verarbeitung erfassen'}
                </h3>
                <label style={label}>Bezeichnung der Verarbeitung *</label>
                <input style={input} placeholder="z.B. Profiling Kreditwürdigkeit" value={currentEntry.name} onChange={e => setCurrentEntry(v => ({ ...v, name: e.target.value }))} />
                <label style={label}>Kategorie</label>
                <input style={input} placeholder="z.B. Scoring, Überwachung, Gesundheit, KI-Entscheidung" value={currentEntry.category} onChange={e => setCurrentEntry(v => ({ ...v, category: e.target.value }))} />
                <label style={label}>Verarbeitungszweck</label>
                <input style={input} placeholder="z.B. Automatisierte Kreditentscheidung für Privatkunden" value={currentEntry.purpose} onChange={e => setCurrentEntry(v => ({ ...v, purpose: e.target.value }))} />

                <label style={{ ...label, marginTop: 16 }}>Datenkategorien</label>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginTop: 6 }}>
                  {dataTypeOptions.map(dt => (
                    <button key={dt} onClick={() => toggleDataType(dt)}
                      style={{ background: currentEntry.dataTypes.includes(dt) ? '#1e3a5f' : '#1f2937', color: currentEntry.dataTypes.includes(dt) ? '#93c5fd' : '#9ca3af', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>
                      {dt}
                    </button>
                  ))}
                </div>

                <label style={{ ...label, marginTop: 16 }}>Betroffene Personen</label>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginTop: 6 }}>
                  {subjectOptions.map(s2 => (
                    <button key={s2} onClick={() => toggleSubject(s2)}
                      style={{ background: currentEntry.subjects.includes(s2) ? '#1e3a5f' : '#1f2937', color: currentEntry.subjects.includes(s2) ? '#93c5fd' : '#9ca3af', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>
                      {s2}
                    </button>
                  ))}
                </div>

                <div style={{ marginTop: 20 }}>
                  <label style={{ ...label, marginTop: 0 }}>Risiken & Schutzmaßnahmen</label>
                  {currentEntry.risks.map((r, i) => (
                    <div key={i} style={{ background: '#111', borderRadius: 8, padding: 14, marginBottom: 10 }}>
                      <input style={{ ...input, marginBottom: 8 }} placeholder="Risikobeschreibung (z.B. unbefugter Zugriff auf Gesundheitsdaten)" value={r.risk} onChange={e => updateRisk(i, 'risk', e.target.value)} />
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ ...label, marginTop: 0 }}>Schwere</label>
                          <select style={{ ...input }} value={r.severity} onChange={e => updateRisk(i, 'severity', e.target.value)}>
                            {riskLevels.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ ...label, marginTop: 0 }}>Wahrscheinlichkeit</label>
                          <select style={{ ...input }} value={r.likelihood} onChange={e => updateRisk(i, 'likelihood', e.target.value)}>
                            {riskLevels.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                          <div style={{ width: 14, height: 14, background: riskColor(r.severity === 'hoch' && r.likelihood === 'hoch' ? 'hoch' : r.severity === 'niedrig' && r.likelihood === 'niedrig' ? 'niedrig' : 'mittel'), borderRadius: '50%', marginBottom: 10 }} />
                        </div>
                      </div>
                      <input style={input} placeholder="Schutzmaßnahme (z.B. AES-256 Verschlüsselung, Zugriffsprotokoll)" value={r.measure} onChange={e => updateRisk(i, 'measure', e.target.value)} />
                    </div>
                  ))}
                  <button onClick={addRisk} style={{ background: '#1f2937', color: '#9ca3af', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}>
                    + Weiteres Risiko hinzufügen
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' as const }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#d1d5db', fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={currentEntry.necessityAssessed} onChange={e => setCurrentEntry(v => ({ ...v, necessityAssessed: e.target.checked }))} style={{ accentColor: '#2563eb' }} />
                    Notwendigkeit & Verhältnismäßigkeit bewertet
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#d1d5db', fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={currentEntry.consultationRequired} onChange={e => setCurrentEntry(v => ({ ...v, consultationRequired: e.target.checked }))} style={{ accentColor: '#dc2626' }} />
                    Behördenkonsultation erforderlich (Art. 36)
                  </label>
                </div>

                <label style={label}>Anmerkungen / Maßnahmen gesamt</label>
                <textarea style={{ ...input, height: 60, resize: 'vertical' as const }} value={currentEntry.notes} onChange={e => setCurrentEntry(v => ({ ...v, notes: e.target.value }))} placeholder="Weitere Hinweise zur Verarbeitung..." />

                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button style={{ ...btn, background: '#16a34a' }} onClick={saveEntry}>✓ Verarbeitung speichern</button>
                  {entries.length > 0 && <button style={{ ...btn, background: '#374151' }} onClick={() => setEditMode(false)}>Abbrechen</button>}
                </div>
              </div>
            )}

            {!editMode && (
              <button style={{ ...btn, background: '#1f2937', color: '#e5e7eb', marginBottom: 16 }} onClick={() => setEditMode(true)}>
                + Weitere Verarbeitung erfassen
              </button>
            )}

            {entries.length > 0 && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ ...btn, background: '#374151' }} onClick={() => setStep(1)}>← Zurück</button>
                <button style={btn} onClick={() => setStep(3)}>Weiter: Zusammenfassung →</button>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>DSFA-Zusammenfassung</h2>
            <div style={{ background: '#1a1a2e', borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{projectName}</p>
              <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 4px' }}>{projectDesc}</p>
              <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Verantwortlich: {responsible}</p>
            </div>

            {entries.map(e => {
              const maxRisk = e.risks.some(r => r.severity === 'hoch' && r.likelihood === 'hoch') ? 'hoch' :
                e.risks.some(r => r.severity === 'hoch' || r.likelihood === 'hoch') ? 'mittel' : 'niedrig';
              return (
                <div key={e.id} style={{ background: '#111', border: `1px solid ${maxRisk === 'hoch' ? '#dc2626' : maxRisk === 'mittel' ? '#d97706' : '#374151'}`, borderRadius: 8, padding: 16, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>{e.name}</h3>
                    <span style={{ background: riskColor(maxRisk) + '22', color: riskColor(maxRisk), borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                      Risiko: {maxRisk}
                    </span>
                  </div>
                  <p style={{ color: '#9ca3af', fontSize: 13, margin: '8px 0 4px' }}>{e.purpose}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4, marginTop: 8 }}>
                    {e.dataTypes.map(dt => <span key={dt} style={tag()}>{dt}</span>)}
                  </div>
                  {e.consultationRequired && (
                    <div style={{ background: '#3b1515', borderRadius: 6, padding: '8px 12px', marginTop: 10 }}>
                      <span style={{ color: '#fca5a5', fontSize: 13 }}>⚠️ Behördenkonsultation nach Art. 36 DSGVO erforderlich</span>
                    </div>
                  )}
                </div>
              );
            })}

            <ConfidenceScore
              score={dsfaConfidence(entries)}
              flags={dsfaConfidenceFlags(entries)}
              methodologyVersion="dsfa:2026.05.0"
            />

            <HumanVerificationGate
              context="dsfa"
              proceedLabel="DSFA-Entwurf drucken / als PDF"
              onProceed={printReport}
            />

            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' as const }}>
              <button style={{ ...btn, background: '#374151' }} onClick={() => setStep(2)}>← Zurück</button>
              <a href="/grenzen" style={{ ...btn, background: 'transparent', color: '#9ca3af', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Grenzen dieses Wizards</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
