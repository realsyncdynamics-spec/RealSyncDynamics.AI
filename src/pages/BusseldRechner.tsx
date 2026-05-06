import { useState } from 'react';

interface BusseldConfig {
  companySize: 'micro' | 'small' | 'medium' | 'large' | 'enterprise';
  annualRevenue: number;
  violationType: string;
  severity: 'leicht' | 'mittel' | 'schwer';
  intentional: boolean;
  repeated: boolean;
  cooperation: boolean;
  selfReported: boolean;
  affectedPersons: number;
  sensitiveData: boolean;
  childrenAffected: boolean;
}

const violations = [
  { id: 'no_consent', label: 'Verarbeitung ohne Einwilligung (Art. 6 fehlt)', tier: 2 },
  { id: 'no_dse', label: 'Fehlende/mangelhafte Datenschutzerklärung (Art. 13)', tier: 1 },
  { id: 'no_avv', label: 'Fehlender AVV mit Auftragsverarbeiter (Art. 28)', tier: 1 },
  { id: 'no_vvt', label: 'Kein Verarbeitungsverzeichnis (Art. 30)', tier: 1 },
  { id: 'data_breach', label: 'Datenpanne nicht gemeldet (Art. 33)', tier: 2 },
  { id: 'no_dsfa', label: 'Fehlende DSFA bei Hochrisiko-Verarbeitung (Art. 35)', tier: 2 },
  { id: 'google_fonts', label: 'Google Fonts ohne Einwilligung (EuGH-Risiko)', tier: 1 },
  { id: 'ga_no_consent', label: 'Google Analytics ohne Consent (Art. 6 lit. a)', tier: 2 },
  { id: 'no_toms', label: 'Fehlende technische Schutzmaßnahmen (Art. 32)', tier: 2 },
  { id: 'rights_violation', label: 'Verletzung Betroffenenrechte (Art. 15-22)', tier: 2 },
  { id: 'third_country', label: 'Drittlandtransfer ohne Rechtsgrundlage (Art. 44)', tier: 2 },
  { id: 'children', label: 'Verarbeitung Kinderdaten ohne Schutz (Art. 8)', tier: 2 },
];

const sizeLimits: Record<string, { tier1: number; tier2: number; label: string }> = {
  micro:      { tier1: 2000000,   tier2: 10000000,  label: 'Kleinstunternehmen (< 10 MA)' },
  small:      { tier1: 2000000,   tier2: 10000000,  label: 'Kleines Unternehmen (10-49 MA)' },
  medium:     { tier1: 10000000,  tier2: 20000000,  label: 'Mittleres Unternehmen (50-249 MA)' },
  large:      { tier1: 10000000,  tier2: 20000000,  label: 'Großes Unternehmen (250-999 MA)' },
  enterprise: { tier1: 10000000,  tier2: 20000000,  label: 'Konzern / Enterprise (1000+ MA)' },
};

function calcFine(config: BusseldConfig): { min: number; max: number; likely: number; basis: string } {
  const violation = violations.find(v => v.id === config.violationType);
  if (!violation) return { min: 0, max: 0, likely: 0, basis: '' };
  
  const limits = sizeLimits[config.companySize];
  const absMax = violation.tier === 1 ? limits.tier1 : limits.tier2;
  const revenueMax = violation.tier === 1 
    ? config.annualRevenue * 0.02 
    : config.annualRevenue * 0.04;
  const hardMax = Math.min(absMax, revenueMax);
  
  let factor = 0.05;
  if (config.severity === 'mittel') factor = 0.20;
  if (config.severity === 'schwer') factor = 0.55;
  if (config.intentional) factor *= 1.5;
  if (config.repeated) factor *= 1.3;
  if (config.sensitiveData) factor *= 1.2;
  if (config.childrenAffected) factor *= 1.4;
  if (config.affectedPersons > 10000) factor *= 1.3;
  else if (config.affectedPersons > 1000) factor *= 1.15;
  if (config.cooperation) factor *= 0.75;
  if (config.selfReported) factor *= 0.6;
  factor = Math.min(factor, 1.0);
  
  const likely = Math.round(hardMax * factor);
  const min = Math.round(likely * 0.3);
  const max = Math.round(hardMax * Math.min(factor * 2, 1));
  
  const basis = violation.tier === 1 
    ? 'Art. 83 Abs. 4 DSGVO (bis 10 Mio. € / 2% Jahresumsatz)'
    : 'Art. 83 Abs. 5 DSGVO (bis 20 Mio. € / 4% Jahresumsatz)';
  
  return { min, max, likely, basis };
}

function formatEuro(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.', ',') + ' Mio. €';
  if (n >= 1000) return (n / 1000).toFixed(0) + '.000 €';
  return n.toLocaleString('de-DE') + ' €';
}

export function BusseldRechner() {
  const [config, setConfig] = useState<BusseldConfig>({
    companySize: 'medium',
    annualRevenue: 5000000,
    violationType: 'no_consent',
    severity: 'mittel',
    intentional: false,
    repeated: false,
    cooperation: true,
    selfReported: false,
    affectedPersons: 500,
    sensitiveData: false,
    childrenAffected: false,
  });
  const [showResult, setShowResult] = useState(false);

  const update = (key: keyof BusseldConfig, val: string | number | boolean) => {
    setConfig(prev => ({ ...prev, [key]: val }));
    setShowResult(false);
  };

  const result = calcFine(config);

  const s: React.CSSProperties = {
    background: '#0a0a0a', color: '#e5e7eb', minHeight: '100vh', padding: '32px 16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  };
  const card: React.CSSProperties = { maxWidth: 760, margin: '0 auto', background: '#111', border: '1px solid #1f2937', borderRadius: 12, padding: '32px' };
  const label: React.CSSProperties = { display: 'block', color: '#9ca3af', fontSize: 13, marginBottom: 6, marginTop: 18 };
  const inp: React.CSSProperties = { width: '100%', background: '#1a1a2e', border: '1px solid #374151', borderRadius: 8, padding: '10px 14px', color: '#e5e7eb', fontSize: 14, boxSizing: 'border-box' as const };
  const btn: React.CSSProperties = { background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '13px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 24 };
  const checkRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 };

  return (
    <div style={s}>
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <span style={{ fontSize: 40 }}>⚖️</span>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: '8px 0 4px' }}>DSGVO-Bußgeldrechner</h1>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>Schätzen Sie das Bußgeldrisiko Ihres Unternehmens — auf Basis von Art. 83 DSGVO</p>
          <div style={{ background: '#3b1515', border: '1px solid #dc2626', borderRadius: 8, padding: '10px 16px', marginTop: 16 }}>
            <p style={{ color: '#fca5a5', fontSize: 13, margin: 0 }}>
              ⚠️ Dies ist eine <strong>Schätzung</strong> zur Risikoorientierung. Die tatsächlichen Bußgelder werden von Aufsichtsbehörden im Einzelfall festgesetzt.
            </p>
          </div>
        </div>

        <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>Unternehmensgröße</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginTop: 10 }}>
          {Object.entries(sizeLimits).map(([key, val]) => (
            <button key={key} onClick={() => update('companySize', key)}
              style={{ background: config.companySize === key ? '#1e3a5f' : '#1f2937', color: config.companySize === key ? '#93c5fd' : '#9ca3af', border: config.companySize === key ? '1px solid #2563eb' : '1px solid #374151', borderRadius: 8, padding: '10px 8px', cursor: 'pointer', fontSize: 12, textAlign: 'center' as const, fontWeight: config.companySize === key ? 700 : 400 }}>
              {val.label}
            </button>
          ))}
        </div>

        <label style={label}>Jährlicher Jahresumsatz (Konzernumsatz weltweit)</label>
        <input type="number" style={inp} value={config.annualRevenue} onChange={e => update('annualRevenue', Number(e.target.value))} min={0} step={100000} />
        <p style={{ color: '#6b7280', fontSize: 12, margin: '4px 0 0' }}>Aktuell: {formatEuro(config.annualRevenue)}</p>

        <label style={{ ...label, marginTop: 20 }}>Art des Verstoßes</label>
        <select style={inp} value={config.violationType} onChange={e => update('violationType', e.target.value)}>
          {violations.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>

        <label style={label}>Schwere des Verstoßes</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['leicht', 'mittel', 'schwer'] as const).map(s2 => (
            <button key={s2} onClick={() => update('severity', s2)}
              style={{ flex: 1, background: config.severity === s2 ? (s2 === 'schwer' ? '#3b1515' : s2 === 'mittel' ? '#3b2a00' : '#1a3a1a') : '#1f2937', color: config.severity === s2 ? (s2 === 'schwer' ? '#fca5a5' : s2 === 'mittel' ? '#fcd34d' : '#86efac') : '#9ca3af', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: 14, fontWeight: config.severity === s2 ? 700 : 400 }}>
              {s2 === 'leicht' ? '🟢 Leicht' : s2 === 'mittel' ? '🟡 Mittel' : '🔴 Schwer'}
            </button>
          ))}
        </div>

        <label style={{ ...label, marginTop: 20 }}>Betroffene Personen (Anzahl)</label>
        <input type="number" style={inp} value={config.affectedPersons} onChange={e => update('affectedPersons', Number(e.target.value))} min={1} />

        <div style={{ marginTop: 20 }}>
          {[
            { key: 'intentional', label: '🎯 Vorsätzlicher Verstoß (nicht fahrlässig)', red: true },
            { key: 'repeated', label: '🔁 Wiederholungsverstoß (bereits abgemahnt)', red: true },
            { key: 'sensitiveData', label: '🏥 Besondere Kategorien betroffen (Gesundheit, Religion etc.)', red: true },
            { key: 'childrenAffected', label: '👶 Minderjährige betroffen', red: true },
            { key: 'cooperation', label: '🤝 Aktive Kooperation mit Behörde (strafmildernd)', red: false },
            { key: 'selfReported', label: '📢 Selbstmeldung bei Behörde (strafmildernd)', red: false },
          ].map(({ key, label: lbl, red }) => (
            <div key={key} style={checkRow}>
              <input type="checkbox" checked={config[key as keyof BusseldConfig] as boolean}
                onChange={e => update(key as keyof BusseldConfig, e.target.checked)}
                style={{ accentColor: red ? '#dc2626' : '#16a34a', width: 16, height: 16 }} />
              <label style={{ color: '#d1d5db', fontSize: 14, cursor: 'pointer' }}>{lbl}</label>
            </div>
          ))}
        </div>

        <button style={btn} onClick={() => setShowResult(true)}>
          Bußgeld berechnen →
        </button>

        {showResult && result.likely > 0 && (
          <div style={{ marginTop: 28 }}>
            <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 12, padding: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 0, marginBottom: 16 }}>Bußgeld-Schätzung</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Minimum', val: result.min, color: '#16a34a' },
                  { label: 'Wahrscheinlich', val: result.likely, color: '#d97706', bold: true },
                  { label: 'Maximum', val: result.max, color: '#dc2626' },
                ].map(({ label: lbl, val, color, bold }) => (
                  <div key={lbl} style={{ background: '#1a1a2e', borderRadius: 10, padding: 16, textAlign: 'center' as const }}>
                    <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>{lbl}</div>
                    <div style={{ color, fontSize: bold ? 22 : 18, fontWeight: bold ? 800 : 600 }}>{formatEuro(val)}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: '#1f2937', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>
                  <strong>Rechtsgrundlage:</strong> {result.basis}
                </p>
              </div>

              {result.likely > 50000 && (
                <div style={{ background: '#3b1515', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
                  <p style={{ color: '#fca5a5', fontSize: 14, margin: 0, fontWeight: 600 }}>
                    🚨 Kritisches Bußgeldrisiko — professionelle Beratung empfohlen
                  </p>
                  <p style={{ color: '#fca5a5', fontSize: 13, margin: '6px 0 0' }}>
                    Bei diesem Risikoprofil ist ein DSGVO-Audit dringend empfohlen. Ein präventiver Audit kostet einen Bruchteil des Bußgeldes.
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
                <a href="/audit" style={{ background: '#2563eb', color: '#fff', borderRadius: 8, padding: '11px 20px', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                  🔍 Kostenloser DSGVO-Audit
                </a>
                <a href="/contact-sales" style={{ background: '#374151', color: '#e5e7eb', borderRadius: 8, padding: '11px 20px', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                  Beratung anfragen
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
