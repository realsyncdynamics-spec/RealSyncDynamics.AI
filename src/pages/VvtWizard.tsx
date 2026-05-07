import React, { useState } from 'react';
import { LegalDisclaimer } from '../components/LegalDisclaimer';

interface VvtEntry {
  id: string;
  bezeichnung: string;
  zweck: string;
  rechtsgrundlage: string;
  kategorien: string[];
  betroffene: string[];
  empfaenger: string[];
  drittland: boolean;
  drittland_garantie: string;
  loeschfrist: string;
  tom: string[];
}

const RECHTSGRUNDLAGEN = [
  'Art. 6 Abs. 1 lit. a — Einwilligung',
  'Art. 6 Abs. 1 lit. b — Vertragserfüllung',
  'Art. 6 Abs. 1 lit. c — Rechtliche Verpflichtung',
  'Art. 6 Abs. 1 lit. d — Lebenswichtige Interessen',
  'Art. 6 Abs. 1 lit. e — Öffentliche Aufgabe',
  'Art. 6 Abs. 1 lit. f — Berechtigtes Interesse',
  'Art. 9 Abs. 2 — Besondere Kategorien (Gesundheit/etc.)',
];

const TOM_OPTIONS = [
  'Verschlüsselung (TLS/AES)', 'Zugangskontrolle (IAM)', 'Pseudonymisierung',
  'Datensparsamkeit', 'Backup & Wiederherstellung', 'Incident-Response-Plan',
  'Mitarbeiterschulung', 'Auftragskontrolle (AVV)', 'Weitergabekontrolle',
];

function newEntry(): VvtEntry {
  return { id: crypto.randomUUID(), bezeichnung: '', zweck: '', rechtsgrundlage: '', kategorien: [], betroffene: [], empfaenger: [], drittland: false, drittland_garantie: '', loeschfrist: '', tom: [] };
}

export function VvtWizard() {
  const [entries, setEntries] = useState<VvtEntry[]>([newEntry()]);
  const [activeId, setActiveId] = useState(entries[0].id);
  const [exported, setExported] = useState(false);
  const [org, setOrg] = useState({ name: '', adresse: '', dsb: '', dsb_email: '' });

  const active = entries.find(e => e.id === activeId)!;
  function update(fields: Partial<VvtEntry>) { setEntries(prev => prev.map(e => e.id === activeId ? { ...e, ...fields } : e)); }
  function toggleArr(arr: string[], val: string) { return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]; }

  const S = (x: React.CSSProperties) => x;
  const card = S({ border: '1px solid #374151', borderRadius: 4, padding: '1.5rem', marginBottom: '1rem' });
  const input = S({ width: '100%', background: '#111827', border: '1px solid #374151', borderRadius: 4, padding: '0.6rem 0.75rem', color: '#e5e7eb', fontSize: '0.875rem', boxSizing: 'border-box' });
  const label = S({ display: 'block', fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' });

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: 'Inter, sans-serif', padding: '2rem' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>DSGVO Art. 30</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem' }}>Verarbeitungsverzeichnis (VVT)</h1>
        <p style={{ color: '#9ca3af', marginBottom: '1rem' }}>Pflichtdokument nach Art. 30 DSGVO — strukturiert erfassen, als PDF exportieren.</p>
        <LegalDisclaimer context="document" />

        {!exported ? (
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1.5rem' }}>
            {/* Sidebar */}
            <div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Verarbeitungstätigkeiten</div>
              {entries.map((e, i) => (
                <div key={e.id} onClick={() => setActiveId(e.id)}
                  style={{ padding: '0.75rem', border: `1px solid ${activeId === e.id ? '#3b82f6' : '#374151'}`, borderRadius: 4, marginBottom: '0.5rem', cursor: 'pointer', background: activeId === e.id ? '#172554' : 'transparent' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>#{i+1}</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.bezeichnung || '(unbenannt)'}</div>
                </div>
              ))}
              <button onClick={() => { const e = newEntry(); setEntries(prev => [...prev, e]); setActiveId(e.id); }}
                style={{ width: '100%', border: '1px dashed #374151', borderRadius: 4, padding: '0.6rem', color: '#6b7280', background: 'transparent', cursor: 'pointer', fontSize: '0.85rem' }}>
                + Tätigkeit hinzufügen
              </button>
            </div>

            {/* Form */}
            <div>
              {/* Org (show only once) */}
              {activeId === entries[0].id && (
                <div style={card}>
                  <h3 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '0.95rem' }}>Organisation (einmalig)</h3>
                  {[
                    { key: 'name', label: 'Unternehmensname', ph: 'Kanzlei Müller GmbH' },
                    { key: 'adresse', label: 'Anschrift', ph: 'Musterstr. 1, 80333 München' },
                    { key: 'dsb', label: 'Datenschutzbeauftragter (falls vorhanden)', ph: 'Max Mustermann' },
                    { key: 'dsb_email', label: 'DSB E-Mail', ph: 'dsb@kanzlei.de' },
                  ].map(f => (
                    <div key={f.key} style={{ marginBottom: '0.75rem' }}>
                      <label style={label}>{f.label}</label>
                      <input style={input} value={(org as any)[f.key]} onChange={e => setOrg({ ...org, [f.key]: e.target.value })} placeholder={f.ph} />
                    </div>
                  ))}
                </div>
              )}

              <div style={card}>
                <h3 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '0.95rem' }}>Verarbeitungstätigkeit</h3>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={label}>Bezeichnung *</label>
                  <input style={input} value={active.bezeichnung} onChange={e => update({ bezeichnung: e.target.value })} placeholder="z.B. Mandanten-CRM mit KI-Auswertung" />
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={label}>Zweck der Verarbeitung *</label>
                  <input style={input} value={active.zweck} onChange={e => update({ zweck: e.target.value })} placeholder="z.B. Verwaltung und Bearbeitung von Mandantenanfragen" />
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={label}>Rechtsgrundlage *</label>
                  <select style={input} value={active.rechtsgrundlage} onChange={e => update({ rechtsgrundlage: e.target.value })}>
                    <option value="">Bitte wählen...</option>
                    {RECHTSGRUNDLAGEN.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={label}>Löschfrist</label>
                  <input style={input} value={active.loeschfrist} onChange={e => update({ loeschfrist: e.target.value })} placeholder="z.B. 10 Jahre (§ 257 HGB) nach Vertragsende" />
                </div>
              </div>

              <div style={card}>
                <h3 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '0.95rem' }}>Datenkategorien & Empfänger</h3>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={label}>Kategorien personenbezogener Daten (kommagetrennt)</label>
                  <input style={input} value={active.kategorien.join(', ')} onChange={e => update({ kategorien: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="Name, E-Mail, Vertragsdaten, IP-Adresse" />
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={label}>Betroffenengruppen</label>
                  <input style={input} value={active.betroffene.join(', ')} onChange={e => update({ betroffene: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="Kunden, Mitarbeiter, Interessenten" />
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={label}>Empfänger / Auftragsverarbeiter</label>
                  <input style={input} value={active.empfaenger.join(', ')} onChange={e => update({ empfaenger: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="Supabase EU, Stripe, Resend" />
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ ...label, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={active.drittland} onChange={e => update({ drittland: e.target.checked })} />
                    <span>Übermittlung in Drittland (außerhalb EWR)</span>
                  </label>
                  {active.drittland && (
                    <input style={input} value={active.drittland_garantie} onChange={e => update({ drittland_garantie: e.target.value })} placeholder="z.B. SCCs gem. Art. 46 Abs. 2 lit. c + TIA" />
                  )}
                </div>
              </div>

              <div style={card}>
                <h3 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '0.95rem' }}>Technische & Organisatorische Maßnahmen (Art. 32)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  {TOM_OPTIONS.map(opt => (
                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', padding: '0.4rem', border: `1px solid ${active.tom.includes(opt) ? '#3b82f6' : '#374151'}`, borderRadius: 4 }}>
                      <input type="checkbox" checked={active.tom.includes(opt)} onChange={() => update({ tom: toggleArr(active.tom, opt) })} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>

              <button onClick={() => setExported(true)}
                style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, padding: '0.75rem 2rem', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>
                VVT exportieren (PDF)
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ background: '#052e16', border: '1px solid #16a34a', borderRadius: 4, padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ color: '#16a34a', fontSize: '1.5rem' }}>✓</span>
              <div><div style={{ fontWeight: 700, color: '#16a34a' }}>Verarbeitungsverzeichnis erstellt — Art. 30 DSGVO</div>
              <div style={{ fontSize: '0.8rem', color: '#86efac' }}>{entries.length} Verarbeitungstätigkeit(en) erfasst</div></div>
            </div>

            <div id="vvt-print" style={{ background: '#fff', color: '#111', padding: '3rem', borderRadius: 4, fontFamily: 'Georgia, serif', fontSize: '0.9rem', lineHeight: 1.8 }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, textAlign: 'center', marginBottom: '0.5rem' }}>Verzeichnis von Verarbeitungstätigkeiten</h1>
              <p style={{ textAlign: 'center', color: '#555', marginBottom: '0.5rem' }}>gem. Art. 30 Datenschutz-Grundverordnung (DSGVO)</p>
              <hr style={{ margin: '1rem 0' }} />
              <p><strong>Verantwortlicher:</strong> {org.name}, {org.adresse}</p>
              {org.dsb && <p><strong>Datenschutzbeauftragter:</strong> {org.dsb} ({org.dsb_email})</p>}
              <p><strong>Stand:</strong> {new Date().toLocaleDateString('de-DE')}</p>
              <hr style={{ margin: '1rem 0' }} />

              {entries.map((e, i) => (
                <div key={e.id} style={{ marginBottom: '2rem', pageBreakInside: 'avoid' }}>
                  <h2 style={{ fontWeight: 700, fontSize: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Tätigkeit {i+1}: {e.bezeichnung}</h2>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    {[
                      ['Zweck', e.zweck], ['Rechtsgrundlage', e.rechtsgrundlage],
                      ['Datenkategorien', e.kategorien.join(', ')], ['Betroffenengruppen', e.betroffene.join(', ')],
                      ['Empfänger', e.empfaenger.join(', ')],
                      e.drittland ? ['Drittlandtransfer', e.drittland_garantie || 'Garantie ausstehend'] : null,
                      ['Löschfrist', e.loeschfrist], ['TOM', e.tom.join(', ')],
                    ].filter(Boolean).map(([k, v]) => (
                      <tr key={k as string} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.4rem 0.75rem', fontWeight: 600, width: '30%', background: '#f9fafb' }}>{k}</td>
                        <td style={{ padding: '0.4rem 0.75rem' }}>{v as string || '—'}</td>
                      </tr>
                    ))}
                  </table>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button onClick={() => window.print()} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 4, padding: '0.75rem 1.5rem', fontWeight: 700, cursor: 'pointer' }}>⎙ PDF drucken</button>
              <button onClick={() => setExported(false)} style={{ background: 'transparent', color: '#9ca3af', border: '1px solid #374151', borderRadius: 4, padding: '0.75rem 1.5rem', fontWeight: 700, cursor: 'pointer' }}>Bearbeiten</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
