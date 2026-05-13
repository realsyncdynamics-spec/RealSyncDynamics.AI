import React, { useState } from 'react';
import { LegalDisclaimer } from '../components/LegalDisclaimer';
import { HumanVerificationGate } from '../components/HumanVerificationGate';

export function AvvGenerator() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    auftraggeber_name: '',
    auftraggeber_adresse: '',
    auftraggeber_email: '',
    auftragnehmer_name: 'RealSync Dynamics',
    auftragnehmer_adresse: 'Neuhaus am Rennweg, Thüringen, Deutschland',
    auftragnehmer_email: 'privacy@realsyncdynamicsai.de',
    verarbeitungszweck: '',
    datenarten: [] as string[],
    betroffenengruppen: [] as string[],
    laufzeit: '12',
    subprozessoren: true,
  });
  const [generated, setGenerated] = useState(false);

  const datenartenOptions = [
    'Name und Kontaktdaten', 'E-Mail-Adressen', 'IP-Adressen',
    'Vertragsdaten', 'Zahlungsdaten', 'Gesundheitsdaten (Art. 9)',
    'Standortdaten', 'Nutzungsdaten / Log-Daten', 'KI-generierte Outputs',
  ];
  const betroffeneOptions = [
    'Kunden / Mandanten', 'Mitarbeiter', 'Interessenten / Leads',
    'Patienten', 'Nutzer der Website', 'Geschäftspartner',
  ];

  function toggle(arr: string[], val: string) {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  }

  const S = (x: React.CSSProperties) => x;
  const card = S({ border: '1px solid #374151', borderRadius: 4, padding: '1.5rem', marginBottom: '1rem' });
  const input = S({ width: '100%', background: '#111827', border: '1px solid #374151', borderRadius: 4, padding: '0.6rem 0.75rem', color: '#e5e7eb', fontSize: '0.875rem', boxSizing: 'border-box' });
  const btnPrimary = S({ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, padding: '0.75rem 1.5rem', fontWeight: 700, cursor: 'pointer' });
  const btnSecondary = S({ background: 'transparent', color: '#9ca3af', border: '1px solid #374151', borderRadius: 4, padding: '0.75rem 1.5rem', fontWeight: 700, cursor: 'pointer' });

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: 'Inter, sans-serif', padding: '2rem' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ marginBottom: '0.25rem', fontSize: '0.7rem', color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase' }}>DSGVO Art. 28</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem' }}>AVV-Generator</h1>
        <p style={{ color: '#9ca3af', marginBottom: '1rem' }}>Rechtssicherer Auftragsverarbeitungsvertrag in 3 Schritten. Kostenlos, kein Account.</p>
        <LegalDisclaimer context="document" />

        {/* Progress Bar */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
          {['Auftraggeber', 'Verarbeitung', 'AVV-Dokument'].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: '0.75rem', border: `1px solid ${step === i+1 ? '#3b82f6' : '#374151'}`, borderRadius: 4, background: step === i+1 ? '#172554' : 'transparent', opacity: step < i+1 ? 0.5 : 1 }}>
              <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>SCHRITT {i+1}</div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{s}</div>
            </div>
          ))}
        </div>

        {step === 1 && (
          <div style={card}>
            <h2 style={{ fontWeight: 700, marginBottom: '1.5rem' }}>Ihr Unternehmen (Auftraggeber)</h2>
            {[
              { key: 'auftraggeber_name', label: 'Unternehmensname *', placeholder: 'Kanzlei Müller GmbH' },
              { key: 'auftraggeber_adresse', label: 'Ladungsfähige Anschrift *', placeholder: 'Musterstraße 1, 80333 München' },
              { key: 'auftraggeber_email', label: 'Datenschutz-Kontakt E-Mail *', placeholder: 'dsb@kanzlei-mueller.de' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</label>
                <input style={input} value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder} />
              </div>
            ))}
            <button style={{ ...btnPrimary, opacity: (!form.auftraggeber_name || !form.auftraggeber_adresse || !form.auftraggeber_email) ? 0.5 : 1 }}
              disabled={!form.auftraggeber_name || !form.auftraggeber_adresse || !form.auftraggeber_email}
              onClick={() => setStep(2)}>Weiter →</button>
          </div>
        )}

        {step === 2 && (
          <div style={card}>
            <h2 style={{ fontWeight: 700, marginBottom: '1.5rem' }}>Was wird verarbeitet?</h2>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verarbeitungszweck *</label>
              <input style={input} value={form.verarbeitungszweck} onChange={e => setForm({ ...form, verarbeitungszweck: e.target.value })} placeholder="z.B. DSGVO-Compliance-Analyse mittels KI" />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verarbeitete Datenarten *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {datenartenOptions.map(opt => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', padding: '0.5rem', border: `1px solid ${form.datenarten.includes(opt) ? '#3b82f6' : '#374151'}`, borderRadius: 4 }}>
                    <input type="checkbox" checked={form.datenarten.includes(opt)} onChange={() => setForm({ ...form, datenarten: toggle(form.datenarten, opt) })} />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Betroffenengruppen *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {betroffeneOptions.map(opt => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', padding: '0.5rem', border: `1px solid ${form.betroffenengruppen.includes(opt) ? '#3b82f6' : '#374151'}`, borderRadius: 4 }}>
                    <input type="checkbox" checked={form.betroffenengruppen.includes(opt)} onChange={() => setForm({ ...form, betroffenengruppen: toggle(form.betroffenengruppen, opt) })} />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button style={btnSecondary} onClick={() => setStep(1)}>← Zurück</button>
              <button style={{ ...btnPrimary, opacity: (!form.verarbeitungszweck || !form.datenarten.length || !form.betroffenengruppen.length) ? 0.5 : 1 }}
                disabled={!form.verarbeitungszweck || !form.datenarten.length || !form.betroffenengruppen.length}
                onClick={() => { setGenerated(true); setStep(3); }}>AVV generieren →</button>
            </div>
          </div>
        )}

        {step === 3 && generated && (
          <div>
            <div style={{ background: '#052e16', border: '1px solid #16a34a', borderRadius: 4, padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ color: '#16a34a', fontSize: '1.5rem' }}>✓</span>
              <div><div style={{ fontWeight: 700, color: '#16a34a' }}>AVV-Vorlage generiert — Standardklauseln nach DSGVO Art. 28</div>
              <div style={{ fontSize: '0.8rem', color: '#86efac' }}>Stand Mai 2026 · Vorlage zur Anpassung · Anwaltliche Prüfung empfohlen</div></div>
            </div>

            <div id="avv-print" style={{ background: '#fff', color: '#111', padding: '3rem', borderRadius: 4, fontSize: '0.9rem', lineHeight: 1.8, fontFamily: 'Georgia, serif' }}>
              <h1 style={{ textAlign: 'center', fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>Auftragsverarbeitungsvertrag</h1>
              <p style={{ textAlign: 'center', color: '#555', marginBottom: '0.5rem' }}>gemäß Art. 28 Datenschutz-Grundverordnung (DSGVO)</p>
              <hr style={{ margin: '1.5rem 0' }} />
              <p><strong>Auftraggeber:</strong> {form.auftraggeber_name}, {form.auftraggeber_adresse} (nachfolgend „AG")</p>
              <p><strong>Auftragnehmer:</strong> {form.auftragnehmer_name}, {form.auftragnehmer_adresse} (nachfolgend „AN")</p>

              <h2 style={{ fontWeight: 700, marginTop: '1.5rem', fontSize: '1rem' }}>§ 1 Gegenstand und Dauer</h2>
              <p>Der AG beauftragt den AN mit: <em>{form.verarbeitungszweck}</em>. Laufzeit: {form.laufzeit} Monate ab Unterzeichnung.</p>

              <h2 style={{ fontWeight: 700, marginTop: '1.5rem', fontSize: '1rem' }}>§ 2 Art, Zweck und Umfang der Verarbeitung</h2>
              <p><strong>Verarbeitete Datenarten:</strong> {form.datenarten.join(', ')}.</p>
              <p><strong>Betroffenengruppen:</strong> {form.betroffenengruppen.join(', ')}.</p>
              <p><strong>Verarbeitungszweck:</strong> {form.verarbeitungszweck}. Die Verarbeitung erfolgt ausschließlich im EWR bzw. auf Basis geeigneter Garantien nach Art. 44 ff. DSGVO.</p>

              <h2 style={{ fontWeight: 700, marginTop: '1.5rem', fontSize: '1rem' }}>§ 3 Pflichten des AN</h2>
              <p>Der AN verarbeitet personenbezogene Daten ausschließlich auf dokumentierte Weisung des AG (Art. 28 Abs. 3 lit. a). Der AN stellt sicher, dass alle Personen, die mit der Verarbeitung befasst sind, zur Vertraulichkeit verpflichtet sind (Art. 28 Abs. 3 lit. b). Der AN ergreift alle erforderlichen technischen und organisatorischen Maßnahmen nach Art. 32 DSGVO (Art. 28 Abs. 3 lit. c). Bei Verdacht auf Datenpanne informiert der AN den AG unverzüglich, spätestens innerhalb von 24 Stunden.</p>

              <h2 style={{ fontWeight: 700, marginTop: '1.5rem', fontSize: '1rem' }}>§ 4 Unterauftragnehmer</h2>
              <p>Der Einsatz von Unterauftragnehmern ist mit schriftlicher Genehmigung des AG gestattet. Aktuelle Sub-Prozessoren-Liste: https://RealSyncDynamicsAI.de/legal/sub-processors. Der AG wird über neue Unterauftragnehmer mindestens 14 Tage vorab informiert.</p>

              <h2 style={{ fontWeight: 700, marginTop: '1.5rem', fontSize: '1rem' }}>§ 5 Betroffenenrechte</h2>
              <p>Der AN unterstützt den AG bei der Erfüllung von Anfragen nach Art. 15–22 DSGVO (Auskunft, Berichtigung, Löschung, Einschränkung, Datenportabilität, Widerspruch) und leitet eingehende Anfragen unverzüglich weiter.</p>

              <h2 style={{ fontWeight: 700, marginTop: '1.5rem', fontSize: '1rem' }}>§ 6 Kontrollrechte</h2>
              <p>Der AG ist berechtigt, die Einhaltung der TOM beim AN zu prüfen — vor Ort oder durch Fragebogen. Kontrollen sind mit mind. 5 Werktagen Vorlauf anzukündigen.</p>

              <h2 style={{ fontWeight: 700, marginTop: '1.5rem', fontSize: '1rem' }}>§ 7 Datenlöschung und Rückgabe</h2>
              <p>Nach Beendigung des Vertrags werden alle personenbezogenen Daten auf Weisung des AG zurückgegeben oder gelöscht (Art. 28 Abs. 3 lit. g), sofern keine gesetzliche Aufbewahrungspflicht besteht.</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginTop: '3rem' }}>
                <div><p><strong>{form.auftraggeber_name}</strong></p><p style={{ fontSize: '0.8rem', color: '#666' }}>{form.auftraggeber_adresse}</p><div style={{ marginTop: '3rem', borderTop: '1px solid #000', paddingTop: '0.5rem', fontSize: '0.75rem', color: '#666' }}>Ort, Datum, Unterschrift (AG)</div></div>
                <div><p><strong>{form.auftragnehmer_name}</strong></p><p style={{ fontSize: '0.8rem', color: '#666' }}>{form.auftragnehmer_adresse}</p><div style={{ marginTop: '3rem', borderTop: '1px solid #000', paddingTop: '0.5rem', fontSize: '0.75rem', color: '#666' }}>Ort, Datum, Unterschrift (AN)</div></div>
              </div>
            </div>

            <HumanVerificationGate
              context="avv"
              proceedLabel="AVV-Vorlage als PDF drucken"
              onProceed={() => window.print()}
            />

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              <a href="/contact-sales" style={{ ...btnPrimary, background: '#0f766e', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Founding Access starten — AVV vollständig umsetzen</a>
              <a href="/grenzen" style={{ ...btnSecondary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Grenzen dieser Vorlage</a>
              <button onClick={() => { setStep(1); setGenerated(false); }} style={btnSecondary}>Neuen AVV erstellen</button>
            </div>
          </div>
        )}

        <div style={{ marginTop: '3rem', padding: '1rem', background: '#111827', borderRadius: 4, fontSize: '0.8rem', color: '#6b7280' }}>
          <strong style={{ color: '#9ca3af' }}>Hinweis:</strong> Dieser AVV-Generator dient als Ausgangspunkt. Für Ihren konkreten Fall empfehlen wir rechtliche Prüfung.
          Fragen? <a href="mailto:privacy@realsyncdynamicsai.de" style={{ color: '#3b82f6' }}>privacy@realsyncdynamicsai.de</a>
        </div>
      </div>
    </div>
  );
}
