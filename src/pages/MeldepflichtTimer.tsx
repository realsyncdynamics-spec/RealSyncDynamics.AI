import React, { useState, useEffect } from 'react';

const CHECKLIST = [
  { id: 'assess', label: 'Vorfall intern bewerten und dokumentieren', deadline: 4 },
  { id: 'contain', label: 'Ausbreitung eindämmen', deadline: 4 },
  { id: 'log', label: 'Betroffene Daten und Personen identifizieren', deadline: 12 },
  { id: 'dsb_notify', label: 'Internen DSB informieren', deadline: 12 },
  { id: 'authority_notify', label: 'Aufsichtsbehörde benachrichtigen (Art. 33 DSGVO)', deadline: 72 },
  { id: 'document', label: 'Vollständige Dokumentation abschließen', deadline: 72 },
  { id: 'affected_notify', label: 'Betroffene Personen informieren (Art. 34)', deadline: 72 },
  { id: 'remediation', label: 'Abhilfemaßnahmen implementieren', deadline: 168 },
  { id: 'review', label: 'Post-Incident-Review durchführen', deadline: 336 },
];

export function MeldepflichtTimer() {
  const [incidentTime, setIncidentTime] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());
  const [done, setDone] = useState<Set<string>>(new Set());
  const [started, setStarted] = useState(false);
  const [art, setArt] = useState('');

  useEffect(() => {
    if (!incidentTime) return;
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, [incidentTime]);

  const elapsed = incidentTime ? (now.getTime() - incidentTime.getTime()) / 3600000 : 0;
  const rem = Math.max(0, 72 - elapsed);
  const color = rem < 4 ? '#ef4444' : rem < 12 ? '#f97316' : rem < 24 ? '#eab308' : '#16a34a';
  const fmt = (h: number) => {
    const hh = Math.floor(h), mm = Math.floor((h-hh)*60), ss = Math.floor(((h-hh)*60-mm)*60);
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  };

  if (!started) return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', color:'#e5e7eb', fontFamily:'Inter,sans-serif', padding:'2rem' }}>
      <div style={{ maxWidth:700, margin:'0 auto' }}>
        <div style={{ fontSize:'0.7rem', color:'#ef4444', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'0.25rem' }}>DSGVO Art. 33</div>
        <h1 style={{ fontSize:'2rem', fontWeight:800, marginBottom:'0.5rem' }}>Datenpanne — 72h-Meldepflicht-Timer</h1>
        <p style={{ color:'#9ca3af', marginBottom:'2rem' }}>Timer startet ab dem Zeitpunkt, an dem Sie von der Panne erfahren haben.</p>
        <div style={{ border:'1px solid #374151', borderRadius:4, padding:'1.5rem', marginBottom:'1rem' }}>
          <label style={{ display:'block', fontSize:'0.7rem', color:'#9ca3af', marginBottom:'0.3rem', textTransform:'uppercase' }}>Art der Datenpanne</label>
          <input value={art} onChange={e=>setArt(e.target.value)} placeholder="z.B. Unbefugter Zugriff auf Kundendatenbank"
            style={{ width:'100%', background:'#111827', border:'1px solid #374151', borderRadius:4, padding:'0.6rem 0.75rem', color:'#e5e7eb', fontSize:'0.875rem', boxSizing:'border-box' }} />
        </div>
        <button onClick={()=>{ setIncidentTime(new Date()); setStarted(true); }}
          style={{ background:'#dc2626', color:'#fff', border:'none', borderRadius:4, padding:'1rem 2rem', fontWeight:800, fontSize:'1.1rem', cursor:'pointer', width:'100%' }}>
          🚨 Timer starten — Jetzt
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', color:'#e5e7eb', fontFamily:'Inter,sans-serif', padding:'2rem' }}>
      <div style={{ maxWidth:800, margin:'0 auto' }}>
        {art && <p style={{ color:'#9ca3af', marginBottom:'1rem' }}>Vorfall: {art}</p>}
        <div style={{ border:`2px solid ${color}`, borderRadius:8, padding:'2rem', marginBottom:'2rem', textAlign:'center' }}>
          <div style={{ fontSize:'0.75rem', color, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'0.5rem' }}>
            Verbleibende Zeit bis 72h-Meldefrist
          </div>
          <div style={{ fontSize:'4rem', fontWeight:900, fontFamily:'monospace', color }}>{fmt(rem)}</div>
          <div style={{ color:'#9ca3af', fontSize:'0.875rem', marginTop:'0.5rem' }}>
            Vorfall erkannt: {incidentTime?.toLocaleString('de-DE')} — Vergangen: {elapsed.toFixed(1)}h
          </div>
          {rem === 0 && <div style={{ marginTop:'1rem', fontWeight:700, color:'#ef4444' }}>⚠️ Meldefrist überschritten — sofort Aufsichtsbehörde kontaktieren!</div>}
        </div>
        <div style={{ border:'1px solid #374151', borderRadius:4, padding:'1.5rem', marginBottom:'1.5rem' }}>
          <h2 style={{ fontWeight:700, marginBottom:'1rem' }}>Pflicht-Checkliste</h2>
          {CHECKLIST.map(item => {
            const overdue = elapsed > item.deadline && !done.has(item.id);
            const isDone = done.has(item.id);
            return (
              <div key={item.id} onClick={()=>setDone(p=>{ const n=new Set(p); isDone?n.delete(item.id):n.add(item.id); return n; })}
                style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem', marginBottom:'0.5rem', border:`1px solid ${isDone?'#16a34a':overdue?'#ef4444':'#374151'}`, borderRadius:4, cursor:'pointer', background:isDone?'#052e16':overdue?'#450a0a':'transparent' }}>
                <div style={{ width:20, height:20, borderRadius:4, border:`2px solid ${isDone?'#16a34a':'#374151'}`, background:isDone?'#16a34a':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {isDone && <span style={{ color:'#fff', fontSize:'0.75rem' }}>✓</span>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:isDone?400:600, textDecoration:isDone?'line-through':'none' }}>{item.label}</div>
                  <div style={{ fontSize:'0.75rem', color:overdue?'#ef4444':'#6b7280' }}>Frist: {item.deadline}h{overdue?' — ÜBERFÄLLIG':''}</div>
                </div>
              </div>
            );
          })}
        </div>
        <a href="https://www.lda.bayern.de/de/meldung_von_verletzungen.html" target="_blank" rel="noopener noreferrer"
          style={{ background:'#dc2626', color:'#fff', textDecoration:'none', borderRadius:4, padding:'0.75rem 1.5rem', fontWeight:700, display:'inline-block' }}>
          Aufsichtsbehörde benachrichtigen →
        </a>
      </div>
    </div>
  );
}
