import React, { useState, useEffect } from 'react';

const CHECKLIST = [
  { id: 'assess', label: 'Vorfall intern bewerten und dokumentieren', deadline: 4 },
  { id: 'contain', label: 'Ausbreitung eindämmen (Zugriff sperren, Logs sichern)', deadline: 4 },
  { id: 'log', label: 'Betroffene Daten, Systeme und Personen identifizieren', deadline: 12 },
  { id: 'dsb_notify', label: 'Internen DSB / Geschäftsführung informieren', deadline: 12 },
  { id: 'authority_notify', label: 'Aufsichtsbehörde benachrichtigen (Art. 33 DSGVO)', deadline: 72 },
  { id: 'document', label: 'Vollständige Dokumentation des Vorfalls abschließen', deadline: 72 },
  { id: 'affected_notify', label: 'Betroffene Personen informieren falls hohes Risiko (Art. 34)', deadline: 72 },
  { id: 'remediation', label: 'Abhilfemaßnahmen implementieren und testen', deadline: 168 },
  { id: 'review', label: 'Post-Incident-Review durchführen', deadline: 336 },
];

const AUTHORITIES: Record<string, { name: string; url: string }> = {
  'Bayern': { name: 'BayLDA', url: 'https://www.lda.bayern.de/de/meldung_von_verletzungen.html' },
  'Berlin': { name: 'BlnBDI', url: 'https://www.datenschutz-berlin.de/datenpanne' },
  'Baden-Württemberg': { name: 'LfDI BW', url: 'https://www.baden-wuerttemberg.datenschutz.de/datenpanne-melden/' },
  'NRW': { name: 'LDI NRW', url: 'https://www.ldi.nrw.de/datenpanne-melden' },
  'Hamburg': { name: 'HmbBfDI', url: 'https://datenschutz.hamburg.de/meldung-datenpannen' },
  'Hessen': { name: 'HBDI', url: 'https://www.datenschutz.hessen.de' },
  'Sachsen': { name: 'SLfD', url: 'https://www.saechsdsb.de' },
  'Thüringen': { name: 'TLfDI', url: 'https://www.tlfdi.de' },
  'Bundesebene (BSI)', { name: 'BfDI', url: 'https://www.bfdi.bund.de/DE/DieFormen/Meldungen/meldungen_node.html' },
];

export function MeldepflichtTimer() {
  const [incidentTime, setIncidentTime] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());
  const [done, setDone] = useState<Set<string>>(new Set());
  const [state, setState] = useState('Bayern');
  const [incident, setIncident] = useState({ art: '', systeme: '', betroffene: '', risiko: 'mittel' });
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!incidentTime) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [incidentTime]);

  const elapsed = incidentTime ? (now.getTime() - incidentTime.getTime()) / 3600000 : 0;
  const remaining72 = Math.max(0, 72 - elapsed);
  const urgency = remaining72 < 4 ? 'critical' : remaining72 < 12 ? 'high' : remaining72 < 24 ? 'medium' : 'low';
  const urgencyColors = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#16a34a' };

  function fmt(h: number) {
    if (h <= 0) return '00:00:00';
    const hrs = Math.floor(h); const mins = Math.floor((h - hrs) * 60); const secs = Math.floor(((h - hrs) * 60 - mins) * 60);
    return `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  }

  const authority = AUTHORITIES[state] || AUTHORITIES['Bayern'];

  if (!started) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: 'Inter, sans-serif', padding: '2rem' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ fontSize: '0.7rem', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>DSGVO Art. 33 · 72-Stunden-Frist</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem' }}>Datenpanne — Meldepflicht-Timer</h1>
        <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>Starten Sie den Timer sobald Sie von der Datenpanne erfahren. Art. 33 DSGVO: 72-Stunden-Meldefrist beginnt sofort.</p>
        
        <div style={{ border: '1px solid #374151', borderRadius: 4, padding: '1.5rem', marginBottom: '1rem' }}>
          <h2 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '1rem' }}>Vorfalldetails (für Dokumentation)</h2>
          {[
            { key: 'art', label: 'Art der Datenpanne', ph: 'z.B. Unbefugter Zugriff auf Kundendatenbank' },
            { key: 'systeme', label: 'Betroffene Systeme', ph: 'z.B. CRM-System, E-Mail-Server' },
            { key: 'betroffene', label: 'Geschätzte Anzahl betroffener Personen', ph: 'z.B. 500 Kunden' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.3rem', textTransform: 'uppercase' }}>{f.label}</label>
              <input value={(incident as any)[f.key]} onChange={e => setIncident({ ...incident, [f.key]: e.target.value })} placeholder={f.ph}
                style={{ width: '100%', background: '#111827', border: '1px solid #374151', borderRadius: 4, padding: '0.6rem 0.75rem', color: '#e5e7eb', fontSize: '0.875rem', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Risikoeinstufung</label>
            <select value={incident.risiko} onChange={e => setIncident({ ...incident, risiko: e.target.value })}
              style={{ width: '100%', background: '#111827', border: '1px solid #374151', borderRadius: 4, padding: '0.6rem 0.75rem', color: '#e5e7eb', fontSize: '0.875rem' }}>
              <option value="gering">Gering — keine Meldepflicht an Betroffene</option>
              <option value="mittel">Mittel — Meldung an Aufsichtsbehörde erforderlich</option>
              <option value="hoch">Hoch — Meldung an Behörde UND Betroffene erforderlich</option>
            </select>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Ihr Bundesland</label>
            <select value={state} onChange={e => setState(e.target.value)}
              style={{ width: '100%', background: '#111827', border: '1px solid #374151', borderRadius: 4, padding: '0.6rem 0.75rem', color: '#e5e7eb', fontSize: '0.875rem' }}>
              {Object.keys(AUTHORITIES).map(s => <option key={s} value={s}>{s} — {AUTHORITIES[s].name}</option>)}
            </select>
          </div>
        </div>

        <button onClick={() => { setIncidentTime(new Date()); setStarted(true); }}
          style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, padding: '1rem 2rem', fontWeight: 800, fontSize: '1.1rem', cursor: 'pointer', width: '100%' }}>
          🚨 DATENPANNE JETZT MELDEN — Timer starten
        </button>
        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.75rem', textAlign: 'center' }}>Der Timer startet ab dem Zeitpunkt, an dem Sie von der Panne erfahren haben.</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: 'Inter, sans-serif', padding: '2rem' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Timer Display */}
        <div style={{ background: urgency === 'critical' ? '#450a0a' : '#111827', border: `2px solid ${urgencyColors[urgency]}`, borderRadius: 8, padding: '2rem', marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: urgencyColors[urgency], textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            Verbleibende Zeit bis 72h-Meldefrist
          </div>
          <div style={{ fontSize: '4rem', fontWeight: 900, fontFamily: 'monospace', color: urgencyColors[urgency], letterSpacing: '0.05em' }}>
            {fmt(remaining72)}
          </div>
          <div style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Vorfall erkannt: {incidentTime?.toLocaleString('de-DE')} · Vergangen: {elapsed.toFixed(1)}h
          </div>
          {remaining72 === 0 && (
            <div style={{ marginTop: '1rem', fontWeight: 700, color: '#ef4444', fontSize: '1.1rem' }}>
              ⚠️ Meldefrist überschritten — sofort {authority.name} kontaktieren!
            </div>
          )}
        </div>

        {/* Authority Link */}
        <div style={{ border: '1px solid #374151', borderRadius: 4, padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
