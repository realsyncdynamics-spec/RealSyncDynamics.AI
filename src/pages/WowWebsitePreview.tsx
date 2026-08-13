import React, { useMemo, useState } from 'react';

type Variant = {
  id: string;
  name: string;
  description: string;
  accent: string;
  layout: 'minimal' | 'bento' | 'dark';
};

const variants: Variant[] = [
  { id: 'modern-minimal', name: 'Modern Minimal', description: 'Klar, ruhig und conversion-orientiert.', accent: '#22d3ee', layout: 'minimal' },
  { id: 'bento-bold', name: 'Bento Bold', description: 'Starke visuelle Hierarchie mit modularen Content-Blöcken.', accent: '#8b5cf6', layout: 'bento' },
  { id: 'dark-professional', name: 'Dark Professional', description: 'Premium-Look für technologie- und B2B-orientierte Marken.', accent: '#34d399', layout: 'dark' },
];

function PreviewCanvas({ variant, domain }: { variant: Variant; domain: string }) {
  const dark = variant.layout === 'dark';
  const bg = dark ? '#09090b' : '#f8fafc';
  const fg = dark ? '#f8fafc' : '#0f172a';
  const muted = dark ? '#a1a1aa' : '#64748b';
  return (
    <div style={{ background: bg, color: fg, borderRadius: 16, overflow: 'hidden', minHeight: 280, border: `1px solid ${dark ? '#27272a' : '#e2e8f0'}` }}>
      <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${dark ? '#27272a' : '#e2e8f0'}` }}>
        <strong>{domain || 'Ihre Website'}</strong>
        <span style={{ fontSize: 11, color: variant.accent }}>NEW DESIGN</span>
      </div>
      <div style={{ padding: 24, background: variant.layout === 'bento' ? `linear-gradient(135deg, ${dark ? '#18181b' : '#fff'}, ${dark ? '#111827' : '#eef2ff'})` : undefined }}>
        <div style={{ maxWidth: 520 }}>
          <div style={{ fontSize: 12, color: variant.accent, fontWeight: 700, letterSpacing: '.08em' }}>DIGITAL EXPERIENCE</div>
          <h3 style={{ fontSize: 28, lineHeight: 1.05, margin: '8px 0' }}>Mehr Wirkung. Weniger Reibung.</h3>
          <p style={{ color: muted, margin: '0 0 18px', fontSize: 14 }}>Eine modernisierte Website mit klarer Struktur, stärkerem SEO-Fundament und einem deutlich besseren Nutzererlebnis.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ background: variant.accent, color: '#09090b', padding: '8px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>Jetzt starten</span>
            <span style={{ border: `1px solid ${dark ? '#3f3f46' : '#cbd5e1'}`, padding: '8px 12px', borderRadius: 999, fontSize: 12 }}>Leistungen ansehen</span>
          </div>
        </div>
        {variant.layout === 'bento' && <div style={{ display: 'grid', gridTemplateColumns: '1.3fr .7fr', gap: 10, marginTop: 18 }}><div style={{ height: 52, borderRadius: 10, background: `${variant.accent}22` }} /><div style={{ height: 52, borderRadius: 10, background: `${variant.accent}16` }} /></div>}
      </div>
    </div>
  );
}

export default function WowWebsitePreview({ domain = '', score, onContinue }: { domain?: string; score?: number; onContinue?: (variantId: string) => void }) {
  const [selected, setSelected] = useState('modern-minimal');
  const active = useMemo(() => variants.find(v => v.id === selected) ?? variants[0], [selected]);

  return (
    <main style={{ minHeight: '100vh', background: '#05070b', color: '#f8fafc', padding: '36px 24px 64px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, marginBottom: 28 }}>
          <div>
            <div style={{ color: '#22d3ee', fontSize: 12, fontWeight: 800, letterSpacing: '.12em' }}>SCAN ABGESCHLOSSEN</div>
            <h1 style={{ margin: '8px 0 6px', fontSize: 'clamp(30px, 5vw, 52px)', lineHeight: 1 }}>Wir haben deine Website. Jetzt zeigen wir dir, was daraus werden kann.</h1>
            <p style={{ margin: 0, color: '#a1a1aa', maxWidth: 760 }}>Keine Formulare. Keine Paketwahl. Erst der Wow-Moment: drei visuelle Richtungen, die auf deiner bestehenden Website aufbauen.</p>
          </div>
          {typeof score === 'number' && <div style={{ border: '1px solid #27272a', borderRadius: 16, padding: '14px 18px', minWidth: 120, textAlign: 'center' }}><div style={{ color: '#a1a1aa', fontSize: 11 }}>Scan-Score</div><strong style={{ fontSize: 28 }}>{score}%</strong></div>}
        </div>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
          {variants.map(v => (
            <button key={v.id} type="button" onClick={() => setSelected(v.id)} style={{ textAlign: 'left', padding: 10, background: selected === v.id ? '#111827' : '#090b10', color: '#fff', border: selected === v.id ? `2px solid ${v.accent}` : '1px solid #27272a', borderRadius: 18, cursor: 'pointer' }}>
              <PreviewCanvas variant={v} domain={domain} />
              <div style={{ padding: '12px 6px 4px' }}><strong>{v.name}</strong><div style={{ color: '#a1a1aa', fontSize: 13, marginTop: 4 }}>{v.description}</div></div>
            </button>
          ))}
        </section>

        <section style={{ marginTop: 26, padding: 24, border: '1px solid #27272a', borderRadius: 18, background: '#090b10' }}>
          <div style={{ color: active.accent, fontSize: 12, fontWeight: 800 }}>DEINE AUSWAHL</div>
          <h2 style={{ margin: '6px 0' }}>{active.name}</h2>
          <p style={{ color: '#a1a1aa', marginTop: 0 }}>Als Nächstes bauen wir diese Richtung als vollständige Vorschau aus deiner bestehenden Website auf.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '14px 0 20px' }}>
            {['Modernisiert', 'SEO-optimiert', 'DSGVO-ready', 'EU-AI-Act-ready', 'Responsive'].map(x => <span key={x} style={{ border: '1px solid #3f3f46', borderRadius: 999, padding: '7px 10px', fontSize: 12 }}>{x}</span>)}
          </div>
          <button type="button" onClick={() => onContinue?.(active.id)} style={{ background: active.accent, color: '#05070b', border: 0, borderRadius: 12, padding: '13px 18px', fontWeight: 800, cursor: 'pointer' }}>Diese Variante wählen → vollständige Vorschau</button>
        </section>
      </div>
    </main>
  );
}
