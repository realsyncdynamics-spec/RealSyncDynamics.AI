import React, { useMemo, useState } from 'react';

type Variant = {
  id: string;
  name: string;
  description: string;
  accent: string;
  layout: 'minimal' | 'bento' | 'dark';
};

const variants: Variant[] = [
  { id: 'modern-minimal', name: 'Modern Minimal', description: 'Klar, hochwertig und conversion-orientiert.', accent: '#14b8a6', layout: 'minimal' },
  { id: 'bento-bold', name: 'Bento Bold', description: 'Starke visuelle Hierarchie mit modularen Content-Flächen.', accent: '#6366f1', layout: 'bento' },
  { id: 'dark-professional', name: 'Dark Professional', description: 'Premium-B2B-Auftritt mit technischer, souveräner Anmutung.', accent: '#22c55e', layout: 'dark' },
];

function BrowserFrame({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', background: dark ? '#0b0f14' : '#fff', border: `1px solid ${dark ? '#29313d' : '#dbe2ea'}`, boxShadow: '0 18px 50px rgba(0,0,0,.18)' }}>
      <div style={{ height: 30, display: 'flex', alignItems: 'center', gap: 7, padding: '0 12px', background: dark ? '#11161d' : '#f5f7fa', borderBottom: `1px solid ${dark ? '#202832' : '#e5e9ef'}` }}>
        <i style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
        <i style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b' }} />
        <i style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
        <div style={{ marginLeft: 8, flex: 1, height: 16, borderRadius: 5, background: dark ? '#1a222c' : '#e9edf2', color: dark ? '#94a3b8' : '#64748b', fontSize: 8, display: 'flex', alignItems: 'center', padding: '0 8px' }}>https://preview.realsyncdynamicsai.de</div>
      </div>
      {children}
    </div>
  );
}

function SitePreview({ variant, domain }: { variant: Variant; domain: string }) {
  const dark = variant.layout === 'dark';
  const surface = dark ? '#0b0f14' : '#ffffff';
  const text = dark ? '#f8fafc' : '#111827';
  const muted = dark ? '#94a3b8' : '#64748b';

  if (variant.layout === 'bento') {
    return (
      <BrowserFrame>
        <div style={{ background: surface, color: text, minHeight: 390 }}>
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #edf0f4' }}>
            <strong style={{ fontSize: 13 }}>{domain || 'Ihre Marke'}</strong>
            <nav style={{ display: 'flex', gap: 14, color: muted, fontSize: 9 }}><span>Leistungen</span><span>Über uns</span><span>Kontakt</span><b style={{ color: text }}>Jetzt entdecken</b></nav>
          </header>
          <div style={{ padding: 22, background: 'linear-gradient(145deg,#f8fafc,#eef2ff)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.25fr .75fr', gap: 12 }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: 22, minHeight: 205, boxShadow: '0 10px 30px rgba(15,23,42,.07)' }}>
                <div style={{ color: variant.accent, fontSize: 8, fontWeight: 800, letterSpacing: '.16em' }}>WILLKOMMEN</div>
                <div style={{ fontSize: 29, lineHeight: 1.02, fontWeight: 850, marginTop: 9, letterSpacing: '-.04em' }}>Eine Website,<br />die für dich arbeitet.</div>
                <p style={{ color: muted, fontSize: 9, lineHeight: 1.5, maxWidth: 330, margin: '12px 0 15px' }}>Klarer Auftritt, bessere Nutzerführung und ein digitaler Prozess, der Besucher zu Kunden macht.</p>
                <span style={{ display: 'inline-flex', background: variant.accent, color: '#fff', borderRadius: 8, padding: '8px 11px', fontSize: 9, fontWeight: 800 }}>Jetzt entdecken →</span>
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ background: '#111827', color: '#fff', borderRadius: 14, padding: 16, minHeight: 88 }}><div style={{ fontSize: 8, opacity: .6 }}>01</div><b style={{ display: 'block', marginTop: 10, fontSize: 13 }}>Mehr Anfragen</b><span style={{ fontSize: 8, opacity: .65 }}>Optimierte Conversion-Flows</span></div>
                <div style={{ background: '#fff', borderRadius: 14, padding: 16, minHeight: 88, border: '1px solid #e5e7eb' }}><div style={{ color: variant.accent, fontSize: 8, fontWeight: 800 }}>02</div><b style={{ display: 'block', marginTop: 10, fontSize: 13 }}>SEO & Performance</b><span style={{ color: muted, fontSize: 8 }}>Technisch sauber aufgebaut</span></div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 12 }}>
              {['Strategie', 'Umsetzung', 'Wachstum'].map((x, i) => <div key={x} style={{ background: '#fff', borderRadius: 11, padding: 13, border: '1px solid #e7eaf0' }}><div style={{ fontSize: 8, color: muted }}>0{i + 3}</div><b style={{ display: 'block', marginTop: 7, fontSize: 10 }}>{x}</b></div>)}
            </div>
          </div>
        </div>
      </BrowserFrame>
    );
  }

  return (
    <BrowserFrame dark={dark}>
      <div style={{ background: surface, color: text, minHeight: 390 }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${dark ? '#202832' : '#edf0f4'}` }}>
          <strong style={{ fontSize: 13 }}>{domain || 'Ihre Marke'}</strong>
          <nav style={{ display: 'flex', gap: 14, color: muted, fontSize: 9 }}><span>Leistungen</span><span>Referenzen</span><span>Kontakt</span><b style={{ color: text }}>Anfragen</b></nav>
        </header>
        <div style={{ padding: 28, background: dark ? 'radial-gradient(circle at 80% 10%,#16352b 0,#0b0f14 45%)' : 'linear-gradient(180deg,#fff,#f8fafc)' }}>
          <div style={{ maxWidth: 470 }}>
            <div style={{ color: variant.accent, fontSize: 8, fontWeight: 850, letterSpacing: '.18em' }}>NEUER DIGITALER AUFTRITT</div>
            <div style={{ fontSize: 32, lineHeight: 1.02, fontWeight: 850, letterSpacing: '-.045em', marginTop: 9 }}>{dark ? 'Souverän. Klar. Digital.' : 'Mehr Wirkung für Ihre Marke.'}</div>
            <p style={{ color: muted, fontSize: 10, lineHeight: 1.55, maxWidth: 410, margin: '13px 0 18px' }}>Eine vollständig neu strukturierte Website mit klarer Positionierung, moderner UX und einem Auftritt, der Vertrauen schafft.</p>
            <div style={{ display: 'flex', gap: 8 }}><span style={{ background: variant.accent, color: dark ? '#06120b' : '#fff', borderRadius: 8, padding: '9px 12px', fontSize: 9, fontWeight: 850 }}>Jetzt entdecken →</span><span style={{ border: `1px solid ${dark ? '#334155' : '#d7dde5'}`, borderRadius: 8, padding: '9px 12px', fontSize: 9 }}>Leistungen ansehen</span></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9, marginTop: 26 }}>
            {[['01', 'Klar positioniert'], ['02', 'Mobile optimiert'], ['03', 'Conversion-ready']].map(([n, x]) => <div key={n} style={{ background: dark ? '#101720' : '#fff', border: `1px solid ${dark ? '#26313d' : '#e5e9ef'}`, borderRadius: 10, padding: 12 }}><div style={{ color: variant.accent, fontSize: 8, fontWeight: 800 }}>{n}</div><b style={{ display: 'block', marginTop: 6, fontSize: 10 }}>{x}</b><span style={{ color: muted, fontSize: 8 }}>Bereits umgesetzt</span></div>)}
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

export default function WowWebsitePreview({ domain = '', score, onContinue }: { domain?: string; score?: number; onContinue?: (variantId: string) => void }) {
  const [selected, setSelected] = useState('modern-minimal');
  const active = useMemo(() => variants.find(v => v.id === selected) ?? variants[0], [selected]);

  return (
    <main style={{ minHeight: '100vh', background: '#f6f8fb', color: '#0f172a', padding: '34px 24px 70px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 28 }}>
          <div>
            <div style={{ color: '#0f9f8a', fontSize: 11, fontWeight: 850, letterSpacing: '.14em' }}>WEBSITE BUILDER · SCHRITT 2 VON 5</div>
            <h1 style={{ margin: '8px 0 8px', fontSize: 'clamp(30px, 4vw, 48px)', lineHeight: 1.02, letterSpacing: '-.04em' }}>Deine neue Website ist bereits gebaut.</h1>
            <p style={{ margin: 0, color: '#64748b', maxWidth: 790, fontSize: 15, lineHeight: 1.55 }}>Wir haben aus deinem Scan drei fertige Designrichtungen erzeugt. Klicke eine Variante an, prüfe die echte Seitenstruktur und öffne anschließend den vollständigen Builder.</p>
          </div>
          {typeof score === 'number' && <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '14px 18px', minWidth: 120, textAlign: 'center', boxShadow: '0 8px 25px rgba(15,23,42,.05)' }}><div style={{ color: '#64748b', fontSize: 10, fontWeight: 700 }}>SCAN-SCORE</div><strong style={{ display: 'block', fontSize: 30, marginTop: 2 }}>{score}%</strong><span style={{ color: '#0f9f8a', fontSize: 9, fontWeight: 800 }}>ANALYSE ABGESCHLOSSEN</span></div>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div><strong style={{ fontSize: 15 }}>3 fertige Website-Konzepte</strong><span style={{ color: '#64748b', fontSize: 12, marginLeft: 9 }}>Aus deiner bestehenden Domain generiert</span></div>
          <span style={{ background: '#ecfdf5', color: '#047857', borderRadius: 999, padding: '6px 10px', fontSize: 10, fontWeight: 800 }}>● LIVE PREVIEWS</span>
        </div>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 18 }}>
          {variants.map(v => (
            <article key={v.id} onClick={() => setSelected(v.id)} style={{ background: '#fff', border: selected === v.id ? `2px solid ${v.accent}` : '1px solid #dfe5ec', borderRadius: 18, overflow: 'hidden', cursor: 'pointer', boxShadow: selected === v.id ? '0 14px 40px rgba(15,23,42,.12)' : '0 8px 25px rgba(15,23,42,.05)' }}>
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #edf0f4' }}>
                <div><strong style={{ fontSize: 13 }}>{v.name}</strong><div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>{v.description}</div></div>
                {selected === v.id && <span style={{ color: v.accent, fontSize: 9, fontWeight: 850 }}>AUSGEWÄHLT</span>}
              </div>
              <div style={{ padding: 10 }}><SitePreview variant={v} domain={domain} /></div>
              <div style={{ padding: '7px 14px 14px', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {['Responsive', 'SEO-ready', 'DSGVO-ready'].map(x => <span key={x} style={{ background: '#f1f5f9', color: '#475569', borderRadius: 999, padding: '5px 8px', fontSize: 9, fontWeight: 700 }}>{x}</span>)}
              </div>
            </article>
          ))}
        </section>

        <section style={{ marginTop: 22, background: '#0f172a', color: '#fff', borderRadius: 18, padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, boxShadow: '0 15px 45px rgba(15,23,42,.18)' }}>
          <div><div style={{ color: active.accent, fontSize: 9, fontWeight: 850, letterSpacing: '.13em' }}>AUSGEWÄHLTE VARIANTE</div><strong style={{ display: 'block', fontSize: 19, marginTop: 4 }}>{active.name}</strong><span style={{ color: '#94a3b8', fontSize: 11 }}>Die Seite ist bereits strukturiert – im nächsten Schritt kannst du sie im Builder bearbeiten.</span></div>
          <button type="button" onClick={() => onContinue?.(active.id)} style={{ flexShrink: 0, background: active.accent, color: '#05201b', border: 0, borderRadius: 10, padding: '12px 17px', fontWeight: 850, cursor: 'pointer' }}>Builder öffnen →</button>
        </section>
      </div>
    </main>
  );
}
