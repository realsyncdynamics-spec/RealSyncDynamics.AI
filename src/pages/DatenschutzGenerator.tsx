import { useState } from 'react';
import { LegalDisclaimer } from '../components/LegalDisclaimer';
import { HumanVerificationGate } from '../components/HumanVerificationGate';

interface DSEConfig {
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  dataProtectionOfficer: string;
  dpoEmail: string;
  hasDPO: boolean;
  website: string;
  usesGoogleAnalytics: boolean;
  usesGoogleFonts: boolean;
  usesCookies: boolean;
  usesNewsletter: boolean;
  usesContactForm: boolean;
  usesEcommerce: boolean;
  usesHosting: string;
  transfersToThirdCountries: boolean;
  thirdCountries: string;
  legalBasis: string[];
}

const defaultConfig: DSEConfig = {
  companyName: '',
  companyAddress: '',
  companyEmail: '',
  companyPhone: '',
  dataProtectionOfficer: '',
  dpoEmail: '',
  hasDPO: false,
  website: '',
  usesGoogleAnalytics: false,
  usesGoogleFonts: false,
  usesCookies: false,
  usesNewsletter: false,
  usesContactForm: true,
  usesEcommerce: false,
  usesHosting: '',
  transfersToThirdCountries: false,
  thirdCountries: '',
  legalBasis: ['Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse)'],
};

export function DatenschutzGenerator() {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<DSEConfig>(defaultConfig);
  const [generated, setGenerated] = useState('');
  const [copied, setCopied] = useState(false);

  const updateConfig = (key: keyof DSEConfig, value: string | boolean | string[]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const generateDSE = () => {
    const date = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    let text = `DATENSCHUTZERKLÄRUNG
Stand: ${date}

1. VERANTWORTLICHER

${config.companyName}
${config.companyAddress}
E-Mail: ${config.companyEmail}${config.companyPhone ? `\nTelefon: ${config.companyPhone}` : ''}

${config.hasDPO ? `Datenschutzbeauftragter:
${config.dataProtectionOfficer}
E-Mail: ${config.dpoEmail}\n` : ''}

2. ALLGEMEINES ZUR DATENVERARBEITUNG

Wir verarbeiten personenbezogene Daten unserer Nutzer grundsätzlich nur, soweit dies zur Bereitstellung einer funktionsfähigen Website sowie unserer Inhalte und Leistungen erforderlich ist. Die Verarbeitung personenbezogener Daten erfolgt regelmäßig nur nach Einwilligung des Nutzers oder wenn die Verarbeitung durch gesetzliche Vorschriften erlaubt ist.

Rechtsgrundlagen der Verarbeitung:
${config.legalBasis.join('\n')}

3. HOSTING${config.usesHosting ? ` (\u00fcber ${config.usesHosting})` : ''}

Diese Website wird bei einem externen Dienstleister gehostet (Hoster). Die personenbezogenen Daten, die auf dieser Website erfasst werden, werden auf den Servern des Hosters gespeichert. Hierbei kann es sich v. a. um IP-Adressen, Kontaktanfragen, Meta- und Kommunikationsdaten, Vertragsdaten, Kontaktdaten, Namen, Webseitenzugriffe und sonstige Daten handeln.

Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an zuverlässiger Bereitstellung unserer Website).

4. DATENERFASSUNG AUF DIESER WEBSITE

4.1 Cookies${config.usesCookies ? `
Diese Website verwendet Cookies. Cookies sind kleine Textdateien, die Ihr Webbrowser auf Ihrem Endgerät speichert. Sie dienen dazu, unser Angebot nutzerfreundlicher und effektiver zu machen. Wir unterscheiden zwischen technisch notwendigen Cookies (ohne Einwilligung) und Analyse-/Marketing-Cookies (nur mit Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO).` : `
Diese Website verwendet keine nicht notwendigen Cookies.`}

4.2 Kontaktformular${config.usesContactForm ? `
Wenn Sie uns per Kontaktformular Anfragen zukommen lassen, werden Ihre Angaben aus dem Anfrageformular inklusive der von Ihnen dort angegebenen Kontaktdaten zwecks Bearbeitung der Anfrage und für den Fall von Anschlussfragen bei uns gespeichert.
Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragsanbahnung) bzw. Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse).` : ''}

${config.usesNewsletter ? `4.3 Newsletter
Mit dem Newsletter informieren wir Sie über unsere Angebote. Die Verarbeitung Ihrer E-Mail-Adresse und ggf. Ihres Namens erfolgt auf Grundlage Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Sie können Ihre Einwilligung jederzeit widerrufen durch Klick auf den Abmeldelink im Newsletter.\n` : ''}
${config.usesGoogleAnalytics ? `4.4 Google Analytics
Diese Website nutzt Google Analytics, einen Webanalysedienst der Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043, USA. Google Analytics verwendet Cookies. Die durch den Cookie erzeugten Informationen über Ihre Benutzung dieser Website werden in der Regel an einen Server von Google in den USA übertragen und dort gespeichert.
Wir haben die IP-Anonymisierung aktiviert, sodass Ihre IP-Adresse von Google innerhalb der EU/EWR gekürzt wird.
Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung via Cookie-Banner).
Datenschutzerklärung Google: https://policies.google.com/privacy\n` : ''}
${config.usesGoogleFonts ? `4.5 Google Fonts
Diese Website verwendet Google Fonts (lokal eingebunden/selbst gehostet). Eine Übertragung Ihrer IP-Adresse an Google findet nicht statt.\n` : ''}
${config.usesEcommerce ? `4.6 Shop und Bestellungen
Wenn Sie bei uns bestellen, verarbeiten wir Ihre Bestell-, Kontakt- und Zahlungsdaten zur Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO). Wir speichern Ihre Daten so lange, wie dies für die Vertragsabwicklung erforderlich ist und darüber hinaus entsprechend der gesetzlichen Aufbewahrungsfristen (i. d. R. 10 Jahre nach HGB/AO).\n` : ''}

5. DRITTLANDÜBERMITTLUNG

${config.transfersToThirdCountries ? `Wir übermitteln personenbezogene Daten in folgende Drittstaaten: ${config.thirdCountries || 'USA (Google, Microsoft)'}. Die Übermittlung erfolgt auf Grundlage von Standardvertragsklauseln der EU-Kommission gemäß Art. 46 Abs. 2 lit. c DSGVO oder auf Basis eines Angemessenheitsbeschlusses nach Art. 45 DSGVO.` : `Eine Übermittlung Ihrer personenbezogenen Daten in Drittstaaten (außerhalb der EU/EWR) findet nicht statt.`}

6. IHRE RECHTE ALS BETROFFENE PERSON

Sie haben folgende Rechte:
• Auskunft über Ihre bei uns gespeicherten Daten (Art. 15 DSGVO)
• Berichtigung unrichtiger Daten (Art. 16 DSGVO)
• Löschung Ihrer bei uns gespeicherten Daten (Art. 17 DSGVO)
• Einschränkung der Datenverarbeitung (Art. 18 DSGVO)
• Datenübertragbarkeit (Art. 20 DSGVO)
• Widerspruch gegen die Datenverarbeitung (Art. 21 DSGVO)
• Widerrufsrecht bei Einwilligungen (Art. 7 Abs. 3 DSGVO)
• Beschwerderecht bei der Aufsichtsbehörde (Art. 77 DSGVO)

Zur Ausübung Ihrer Rechte wenden Sie sich an: ${config.companyEmail}

Zuständige Aufsichtsbehörde: Die für Ihr Bundesland zuständige Landesdatenschutzbehörde.

7. DATENSICHERHEIT

Diese Website nutzt aus Sicherheitsgründen und zum Schutz der Übertragung vertraulicher Inhalte eine SSL- bzw. TLS-Verschlüsselung. Eine verschlüsselte Verbindung erkennen Sie daran, dass die Adresszeile des Browsers von "http://" auf "https://" wechselt.

8. AKTUALITÄT DIESER ERKLÄRUNG

Diese Datenschutzerklärung ist aktuell gültig und hat den Stand ${date}. Durch die Weiterentwicklung unserer Website oder aufgrund geänderter gesetzlicher oder behördlicher Vorgaben kann es notwendig werden, diese Datenschutzerklärung zu ändern.`;

    setGenerated(text);
    setStep(4);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const printDSE = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Datenschutzerklärung</title><style>
      body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #333; }
      h1 { font-size: 22px; } h2 { font-size: 16px; margin-top: 24px; }
      pre { white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 14px; }
    </style></head><body><pre>${generated.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`);
    win.document.close();
    win.print();
  };

  const s: React.CSSProperties = {
    background: '#0a0a0a', color: '#e5e7eb', minHeight: '100vh', padding: '32px 16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  };
  const card: React.CSSProperties = {
    maxWidth: 760, margin: '0 auto', background: '#111', border: '1px solid #1f2937',
    borderRadius: 12, padding: '32px'
  };
  const label: React.CSSProperties = { display: 'block', color: '#9ca3af', fontSize: 13, marginBottom: 6, marginTop: 20 };
  const input: React.CSSProperties = {
    width: '100%', background: '#1a1a2e', border: '1px solid #374151', borderRadius: 8,
    padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box'
  };
  const btn: React.CSSProperties = {
    background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
    padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 24
  };
  const tag: React.CSSProperties = {
    display: 'inline-block', background: '#1e3a5f', color: '#93c5fd', borderRadius: 6,
    padding: '3px 10px', fontSize: 12, marginRight: 8, marginBottom: 6
  };
  const checkRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 };

  return (
    <div style={s}>
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{ fontSize: 36 }}>📄</span>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: '8px 0 4px' }}>Datenschutzerklärung-Generator</h1>
          <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 16px 0' }}>DSGVO-konforme DSE in 3 Schritten — kostenlos & ohne Anmeldung</p>
        </div>
        <LegalDisclaimer context="document" />
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            {[1,2,3,4].map(n => (
              <div key={n} style={{
                width: 32, height: 4, borderRadius: 2,
                background: step >= n ? '#2563eb' : '#1f2937'
              }} />
            ))}
          </div>
          {step < 4 && <p style={{ color: '#6b7280', fontSize: 12, marginTop: 8 }}>Schritt {step} von 3</p>}
        </div>

        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Unternehmensdaten</h2>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>Pflichtfelder nach Art. 13 DSGVO — Verantwortlicher</p>

            <label style={label}>Unternehmensname *</label>
            <input style={input} placeholder="Musterfirma GmbH" value={config.companyName}
              onChange={e => updateConfig('companyName', e.target.value)} />

            <label style={label}>Anschrift *</label>
            <input style={input} placeholder="Musterstraße 1, 10115 Berlin" value={config.companyAddress}
              onChange={e => updateConfig('companyAddress', e.target.value)} />

            <label style={label}>E-Mail-Adresse (Datenschutz) *</label>
            <input style={input} type="email" placeholder="datenschutz@muster.de" value={config.companyEmail}
              onChange={e => updateConfig('companyEmail', e.target.value)} />

            <label style={label}>Telefon (optional)</label>
            <input style={input} placeholder="+49 30 1234567" value={config.companyPhone}
              onChange={e => updateConfig('companyPhone', e.target.value)} />

            <label style={label}>Website *</label>
            <input style={input} placeholder="https://www.muster.de" value={config.website}
              onChange={e => updateConfig('website', e.target.value)} />

            <div style={checkRow}>
              <input type="checkbox" id="hasDPO" checked={config.hasDPO}
                onChange={e => updateConfig('hasDPO', e.target.checked)} style={{ accentColor: '#2563eb' }} />
              <label htmlFor="hasDPO" style={{ color: '#d1d5db', fontSize: 14 }}>Datenschutzbeauftragter (DSB) benannt?</label>
            </div>

            {config.hasDPO && (
              <>
                <label style={label}>Name DSB</label>
                <input style={input} placeholder="Max Mustermann" value={config.dataProtectionOfficer}
                  onChange={e => updateConfig('dataProtectionOfficer', e.target.value)} />
                <label style={label}>E-Mail DSB</label>
                <input style={input} type="email" placeholder="dsb@muster.de" value={config.dpoEmail}
                  onChange={e => updateConfig('dpoEmail', e.target.value)} />
              </>
            )}

            <button style={btn} onClick={() => setStep(2)}>
              Weiter: Dienste & Tools →
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Eingesetzte Dienste & Tools</h2>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>Welche externen Dienste nutzen Sie? Bitte ehrlich angeben!</p>

            {[
              { key: 'usesGoogleAnalytics', label: '📊 Google Analytics / GA4', badge: 'Einwilligung nötig' },
              { key: 'usesGoogleFonts', label: '🔤 Google Fonts (extern eingebunden)', badge: 'EuGH-Risiko' },
              { key: 'usesCookies', label: '🍪 Cookies (nicht-notwendig)', badge: 'Consent erforderlich' },
              { key: 'usesNewsletter', label: '📧 Newsletter / E-Mail-Marketing', badge: 'Einwilligung nötig' },
              { key: 'usesContactForm', label: '📝 Kontaktformular', badge: 'Standard' },
              { key: 'usesEcommerce', label: '🛒 Online-Shop / Bestellungen', badge: 'Art. 6 lit. b' },
            ].map(({ key, label: lbl, badge }) => (
              <div key={key} style={{ ...checkRow, background: '#1a1a2e', borderRadius: 8, padding: '12px 16px', marginTop: 0, marginBottom: 8 }}>
                <input type="checkbox" checked={config[key as keyof DSEConfig] as boolean}
                  onChange={e => updateConfig(key as keyof DSEConfig, e.target.checked)}
                  style={{ accentColor: '#2563eb', width: 16, height: 16 }} />
                <span style={{ color: '#e5e7eb', fontSize: 14, flex: 1 }}>{lbl}</span>
                <span style={tag}>{badge}</span>
              </div>
            ))}

            <label style={{ ...label, marginTop: 20 }}>Hosting-Anbieter</label>
            <input style={input} placeholder="z.B. Hetzner, AWS, Strato, ALL-INKL" value={config.usesHosting}
              onChange={e => updateConfig('usesHosting', e.target.value)} />

            <div style={{ ...checkRow, marginTop: 20 }}>
              <input type="checkbox" id="thirdCountry" checked={config.transfersToThirdCountries}
                onChange={e => updateConfig('transfersToThirdCountries', e.target.checked)}
                style={{ accentColor: '#2563eb' }} />
              <label htmlFor="thirdCountry" style={{ color: '#d1d5db', fontSize: 14 }}>
                Datenübermittlung in Drittstaaten (z.B. USA via Google, AWS)?
              </label>
            </div>
            {config.transfersToThirdCountries && (
              <>
                <label style={label}>Welche Länder / Anbieter?</label>
                <input style={input} placeholder="USA (Google Analytics, AWS), UK (Mailchimp)" value={config.thirdCountries}
                  onChange={e => updateConfig('thirdCountries', e.target.value)} />
              </>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{ ...btn, background: '#374151' }} onClick={() => setStep(1)}>← Zurück</button>
              <button style={btn} onClick={() => setStep(3)}>Weiter: Rechtsgrundlagen →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Rechtsgrundlagen & Zusammenfassung</h2>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>Überprüfen Sie die ermittelten Rechtsgrundlagen</p>

            {[
              { id: 'lit_a', label: 'Art. 6 Abs. 1 lit. a DSGVO — Einwilligung (z.B. Cookies, Newsletter, Analytics)' },
              { id: 'lit_b', label: 'Art. 6 Abs. 1 lit. b DSGVO — Vertragserfüllung (z.B. Shop, Buchungen)' },
              { id: 'lit_c', label: 'Art. 6 Abs. 1 lit. c DSGVO — Rechtliche Verpflichtung (z.B. Aufbewahrungsfristen)' },
              { id: 'lit_f', label: 'Art. 6 Abs. 1 lit. f DSGVO — Berechtigtes Interesse (z.B. Hosting, Sicherheit)' },
            ].map(({ id, label: lbl }) => (
              <div key={id} style={{ ...checkRow, background: '#1a1a2e', borderRadius: 8, padding: '12px 16px', marginBottom: 8 }}>
                <input type="checkbox" id={id}
                  checked={config.legalBasis.some(b => b.includes(id.replace('_', '.'[0])))}
                  onChange={e => {
                    const basis = lbl.split('—')[0].trim();
                    if (e.target.checked) {
                      updateConfig('legalBasis', [...config.legalBasis, basis]);
                    } else {
                      updateConfig('legalBasis', config.legalBasis.filter(b => b !== basis));
                    }
                  }}
                  style={{ accentColor: '#2563eb', width: 16, height: 16 }} />
                <label htmlFor={id} style={{ color: '#e5e7eb', fontSize: 13 }}>{lbl}</label>
              </div>
            ))}

            <div style={{ background: '#1a1a2e', borderRadius: 8, padding: 16, marginTop: 20 }}>
              <p style={{ color: '#9ca3af', fontSize: 13, margin: '0 0 8px' }}>Zusammenfassung Ihrer Konfiguration:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                {config.usesGoogleAnalytics && <span style={tag}>Google Analytics</span>}
                {config.usesGoogleFonts && <span style={{ ...tag, background: '#3b1515', color: '#fca5a5' }}>Google Fonts ⚠️</span>}
                {config.usesCookies && <span style={tag}>Cookies</span>}
                {config.usesNewsletter && <span style={tag}>Newsletter</span>}
                {config.usesContactForm && <span style={tag}>Kontaktformular</span>}
                {config.usesEcommerce && <span style={tag}>E-Commerce</span>}
                {config.transfersToThirdCountries && <span style={{ ...tag, background: '#3b1515', color: '#fca5a5' }}>Drittland-Transfer ⚠️</span>}
                {config.hasDPO && <span style={{ ...tag, background: '#1a3a1a', color: '#86efac' }}>DSB benannt ✓</span>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{ ...btn, background: '#374151' }} onClick={() => setStep(2)}>← Zurück</button>
              <button style={{ ...btn, background: '#16a34a' }} onClick={generateDSE}>
                ✨ Datenschutzerklärung generieren
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <div style={{ background: '#1a3a1a', borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <span style={{ color: '#86efac', fontSize: 14, fontWeight: 600 }}>Datenschutzerklärung erfolgreich generiert</span>
            </div>

            <HumanVerificationGate
              context="avv"
              proceedLabel="Datenschutzerklärung als PDF drucken"
              onProceed={printDSE}
            />

            <div style={{ display: 'flex', gap: 10, marginTop: 16, marginBottom: 16, flexWrap: 'wrap' as const }}>
              <button style={{ ...btn, marginTop: 0, background: '#374151' }} onClick={copyToClipboard}>
                {copied ? '✓ Kopiert!' : '📋 In Zwischenablage kopieren'}
              </button>
              <button style={{ ...btn, marginTop: 0, background: '#4b5563' }} onClick={() => setStep(1)}>
                🔄 Neu erstellen
              </button>
              <a href="/grenzen" style={{ ...btn, marginTop: 0, background: 'transparent', color: '#9ca3af', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Grenzen dieser Vorlage</a>
            </div>

            <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, padding: 20, maxHeight: 500, overflowY: 'auto' as const }}>
              <pre style={{ color: '#d1d5db', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' as const, margin: 0, fontFamily: 'monospace' }}>
                {generated}
              </pre>
            </div>

            <div style={{ background: '#1a1a2e', borderRadius: 8, padding: 16, marginTop: 16 }}>
              <p style={{ color: '#fbbf24', fontSize: 13, margin: 0 }}>
                ⚠️ <strong>Hinweis:</strong> Diese Datenschutzerklärung dient als Ausgangsbasis. Für eine rechtlich belastbare Umsetzung empfehlen wir eine Prüfung durch einen Datenschutzbeauftragten. Kontakt: <a href="mailto:support@realsyncdynamicsai.de" style={{ color: '#60a5fa' }}>support@realsyncdynamicsai.de</a>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
