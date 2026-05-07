import React, { useState } from 'react';
import { LegalDisclaimer } from '../components/LegalDisclaimer';

const CATEGORIES = [
  {
    name: 'Zutrittskontrolle', measures: [
      'Schlüssel- / Zugangskartenverwaltung', 'Alarmanlage / Videoüberwachung Serverraum',
      'Besucherprotokoll', 'Gesicherter Serverraum mit Schließsystem',
    ]
  },
  {
    name: 'Zugangskontrolle (IT)', measures: [
      'Passwortkomplexitätspolitik (min. 12 Zeichen, MFA)', 'Automatische Bildschirmsperre (10 Min.)',
      'Verschlüsselung von Endgeräten (BitLocker/FileVault)', 'VPN für Remote-Zugriff',
    ]
  },
  {
    name: 'Zugriffskontrolle', measures: [
      'Role-Based Access Control (RBAC)', 'Need-to-know-Prinzip',
      'Regelmäßige Zugriffsrechte-Reviews (quartalsweise)', 'Trennung von Produktiv- und Testsystemen',
    ]
  },
  {
    name: 'Trennungskontrolle', measures: [
      'Mandantentrennung in Datenbank (RLS)', 'Getrennte Datenbestände pro Auftraggeber',
      'Logische Trennung per Namespace/Schema',
    ]
  },
  {
    name: 'Pseudonymisierung / Verschlüsselung', measures: [
      'TLS 1.3 für alle Datenübertragungen', 'AES-256 Verschlüsselung at rest',
      'Pseudonymisierung personenbezogener Daten', 'Ende-zu-Ende-Verschlüsselung sensibler Daten',
    ]
  },
  {
    name: 'Verfügbarkeit & Integrität', measures: [
      'Tägliche automatisierte Backups', 'Backup-Wiederherstellungstest (monatlich)',
      'Monitoring & Alerting (Uptime > 99,5%)', 'Datenbankreplikation / Failover',
    ]
  },
  {
    name: 'Weitergabekontrolle', measures: [
      'Verschlüsselte E-Mail für sensitive Kommunikation', 'Dateiübertragung nur über gesicherte Kanäle',
      'Protokollierung aller Datenweitergaben', 'AVV mit allen Auftragsverarbeitern',
    ]
  },
  {
    name: 'Eingabekontrolle / Audit', measures: [
      'Lückenloser Audit-Log aller Datenänderungen', 'Unveränderliche Log-Speicherung',
      'Protokollierung von Login/Logout', 'Alarm bei ungewöhnlichen Zugriffen',
    ]
  },
  {
    name: 'Organisatorische Maßnahmen', measures: [
      'Datenschutzschulungen (jährlich, nachweisbar)', 'Verpflichtungserklärung zur Vertraulichkeit',
      'Datenschutzbeauftragter benannt', 'Incident-Response-Plan dokumentiert',
    ]
  },
];

export function TomGenerator() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [org, setOrg] = useState({ name: '', datum: new Date().toISOString().split('T')[0] });
  const [exported, setExported] = useState(false);

  function toggle(key: string) {
    setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  function selectAll() {
    const all = CATEGORIES.flatMap(c => c.measures.map(m => c.name + ':' + m));
    setSelected(new Set(all));
  }

  const totalMeasures = CATEGORIES.reduce((s, c) => s + c.measures.length, 0);
  const progress = Math.round((selected.size / totalMeasures) * 100);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: 'Inter, sans-serif', padding: '2rem' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>DSGVO Art. 32</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem' }}>TOM-Generator</h1>
        <p style={{ color: '#9ca3af', marginBottom: '1rem' }}>Technische und Organisatorische Maßnahmen dokumentieren — export-fertig nach Art. 32 DSGVO.</p>
        <LegalDisclaimer context="document" />

        {!exported ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Organisation</label>
                <input value={org.name} onChange={e => setOrg({ ...org, name: e.target.value })} placeholder="Kanzlei Müller GmbH"
                  style={{ width: '100%', background: '#111827', border: '1px solid #374151', borderRadius: 4, padding: '0.6rem 0.75rem', color: '#e5e7eb', fontSize: '0.875rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Stand</label>
                <input type="date" value={org.datum} onChange={e => setOrg({ ...org, datum: e.target.value })}
                  style={{ width: '100%', background: '#111827', border: '1px solid #374151', borderRadius: 4, padding: '0.6rem 0.75rem', color: '#e5e7eb', fontSize: '0.875rem', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ flex: 1, height: 8, background: '#374151', borderRadius: 4 }}>
                <div style={{ height: '100%', background: progress > 70 ? '#16a34a' : progress > 40 ? '#eab308' : '#ef4444', borderRadius: 4, width: progress + '%', transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontSize: '0.875rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>{selected.size}/{totalMeasures} Maßnahmen ({progress}%)</span>
              <button onClick={selectAll} style={{ background: 'transparent', border: '1px solid #374151', borderRadius: 4, padding: '0.4rem 0.75rem', color: '#9ca3af', cursor: 'pointer', fontSize: '0.8rem' }}>Alle wählen</button>
            </div>

            {CATEGORIES.map(cat => (
              <div key={cat.name} style={{ border: '1px solid #374151', borderRadius: 4, padding: '1.25rem', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem', color: '#f3f4f6' }}>{cat.name}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {cat.measures.map(m => {
                    const key = cat.name + ':' + m;
                    const isSelected = selected.has(key);
                    return (
                      <label key={m} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', padding: '0.4rem 0.6rem', border: `1px solid ${isSelected ? '#16a34a' : '#374151'}`, borderRadius: 4, background: isSelected ? '#052e16' : 'transparent' }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggle(key)} style={{ marginTop: '0.1rem', flexShrink: 0 }} />
                        <span>{m}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button onClick={() => setExported(true)} disabled={selected.size === 0}
                style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, padding: '0.75rem 2rem', fontWeight: 700, cursor: 'pointer', opacity: selected.size === 0 ? 0.5 : 1 }}>
                TOM-Dokument exportieren ({selected.size} Maßnahmen)
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ background: '#052e16', border: '1px solid #16a34a', borderRadius: 4, padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ color: '#16a34a', fontSize: '1.5rem' }}>✓</span>
              <div><div style={{ fontWeight: 700, color: '#16a34a' }}>TOM-Dokument erstellt — Art. 32 DSGVO</div>
              <div style={{ fontSize: '0.8rem', color: '#86efac' }}>{selected.size} Maßnahmen dokumentiert · {new Date(org.datum).toLocaleDateString('de-DE')}</div></div>
            </div>
            
            <div id="tom-print" style={{ background: '#fff', color: '#111', padding: '3rem', borderRadius: 4, fontFamily: 'Georgia, serif', fontSize: '0.9rem', lineHeight: 1.8 }}>
              <h1 style={{ fontSize: '1.3rem', fontWeight: 700, textAlign: 'center', marginBottom: '0.5rem' }}>Verzeichnis Technischer und Organisatorischer Maßnahmen</h1>
              <p style={{ textAlign: 'center', color: '#555', marginBottom: '0.5rem' }}>gem. Art. 32 Datenschutz-Grundverordnung (DSGVO)</p>
              <hr style={{ margin: '1rem 0' }} />
              {org.name && <p><strong>Organisation:</strong> {org.name}</p>}
              <p><strong>Stand:</strong> {new Date(org.datum).toLocaleDateString('de-DE')}</p>
              <hr style={{ margin: '1rem 0' }} />
              
              {CATEGORIES.map(cat => {
                const catSelected = cat.measures.filter(m => selected.has(cat.name + ':' + m));
                if (catSelected.length === 0) return null;
                return (
                  <div key={cat.name} style={{ marginBottom: '1.5rem' }}>
                    <h2 style={{ fontWeight: 700, fontSize: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.3rem', marginBottom: '0.5rem' }}>{cat.name}</h2>
                    <ul style={{ paddingLeft: '1.5rem', margin: 0 }}>
                      {catSelected.map(m => <li key={m}>{m}</li>)}
                    </ul>
                  </div>
                );
              })}
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
