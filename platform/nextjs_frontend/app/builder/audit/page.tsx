'use client';

import { useState } from 'react';

const BUILDER_URL = process.env.NEXT_PUBLIC_BUILDER_URL ?? 'http://builder.localhost';

type Finding = { finding_id: string; title: string; description: string; remediation_hint: string; severity?: string };
type Variant = {
  variant: string;
  source_domain: string;
  evidence_hash: string;
  backend_preservation: string;
  hero: { eyebrow?: string; headline?: string; subheadline?: string; primary_cta?: { label?: string } };
  sections: Array<{ id: string; title: string; subtitle?: string; type: string; items: Array<Record<string, unknown>> }>;
  design_tokens: { theme: string; density: string; accent_color: string };
};
type TransformResponse = {
  product: string;
  evidence: { domain: string; final_url: string; evidence_hash: string; technologies: string[]; legal_pages: Record<string, boolean>; consent: Record<string, unknown> };
  audit: { score: number; summary: string; critical_findings: Finding[]; warnings: Finding[]; recommendations: Finding[] };
  variants: Variant[];
};

export default function AuditPage() {
  const [url, setUrl] = useState('https://');
  const [result, setResult] = useState<TransformResponse | null>(null);
  const [selected, setSelected] = useState('modern');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function transform() {
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch(`${BUILDER_URL}/api/v1/public/ai-studio/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.detail || `AI Studio ${res.status}`);
      setResult(body);
      if (body.variants?.some((v: Variant) => v.variant === 'modern')) setSelected('modern');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }

  const selectedVariant = result?.variants.find(v => v.variant === selected) ?? result?.variants[0];
  const findings = result ? [...result.audit.critical_findings, ...result.audit.warnings, ...result.audit.recommendations] : [];

  return (
    <main style={{ minHeight: '100vh', background: '#070a12', color: '#eef2ff', fontFamily: 'Inter, system-ui', padding: 32 }}>
      <div style={{ maxWidth: 1320, margin: '0 auto' }}>
        <header style={{ marginBottom: 24 }}>
          <div style={{ color: '#8fe7c5', fontSize: 11, fontWeight: 900, letterSpacing: '.16em' }}>REALSYNCDYNAMICS AI · AI STUDIO</div>
          <h1 style={{ fontSize: 48, letterSpacing: '-.05em', margin: '8px 0' }}>Website rein → neue Landingpage raus.</h1>
          <p style={{ color: '#8f9ab0', maxWidth: 820 }}>Playwright Evidence + DSGVO/SEO-Governance + Gemini Reasoning → SiteOS PageSpec. Das Kunden-Backend bleibt unangetastet.</p>
        </header>

        <section style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.de" style={{ flex: 1, padding: 15, borderRadius: 10, border: '1px solid #29344a', background: '#111827', color: '#fff' }} />
          <button onClick={transform} disabled={loading} style={primary}>{loading ? 'AI Studio analysiert & baut…' : 'Scan + Landingpage generieren'}</button>
        </section>

        {error && <div style={{ padding: 14, background: '#321722', border: '1px solid #6d3044', borderRadius: 10, marginBottom: 20, color: '#ffb8c5' }}>{error}</div>}

        {result && <>
          <section style={grid4}>
            <Metric label="Governance Score" value={`${result.audit.score}/100`} />
            <Metric label="Critical" value={String(result.audit.critical_findings.length)} />
            <Metric label="Evidence Hash" value={result.evidence.evidence_hash.slice(0, 12)} />
            <Metric label="Backend" value="UNTOUCHED" />
          </section>

          <section style={twoCol}>
            <div style={card}>
              <div style={label}>ORIGINAL / EVIDENCE</div>
              <h2>{result.evidence.domain}</h2>
              <p style={{ color: '#aab4c7' }}>{result.audit.summary}</p>
              <div style={{ color: '#8f9ab0', fontSize: 13 }}>Technologies: {result.evidence.technologies.join(', ') || 'none detected'}</div>
              <div style={{ color: '#8f9ab0', fontSize: 13, marginTop: 6 }}>Impressum: {String(result.evidence.legal_pages.impressum)} · Datenschutz: {String(result.evidence.legal_pages.datenschutz)}</div>
              <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>{findings.slice(0, 8).map(f => <div key={f.finding_id} style={{ borderLeft: `3px solid ${f.severity === 'critical' ? '#ff6b7a' : '#e2b45c'}`, padding: '8px 10px', background: '#0f1420' }}><strong>{f.title}</strong><div style={{ color: '#7f8ba0', fontSize: 12 }}>{f.description}</div></div>)}</div>
            </div>

            <div style={card}>
              <div style={label}>AI STUDIO · LIVE PREVIEW</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>{result.variants.map(v => <button key={v.variant} onClick={() => setSelected(v.variant)} style={{ ...pill, ...(selected === v.variant ? activePill : {}) }}>{v.variant}</button>)}</div>
              {selectedVariant && <SitePreview variant={selectedVariant} />}
            </div>
          </section>

          <section style={card}>
            <div style={label}>CUSTOMER DECISION</div>
            <h2>Die neue Landingpage ist bereits gebaut.</h2>
            <p style={{ color: '#8f9ab0' }}>Audit allein, Landingpage für 349 € oder 349 € + Governance-Paket. Nach Kauf wird nur die Frontend-/Landing-Schicht ersetzt; Backend, APIs, Auth und Datenbank bleiben erhalten.</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button style={secondary}>Nur Audit</button><button style={primary}>Neue Landingpage · 349 €</button><button style={secondary}>349 € + Governance Paket</button></div>
          </section>
        </>}
      </div>
    </main>
  );
}

function SitePreview({ variant }: { variant: Variant }) {
  const t = variant.design_tokens;
  return <div style={{ background: t.theme === 'dark' ? '#090d16' : '#f7f9fc', color: t.theme === 'dark' ? '#f5f7fb' : '#111827', borderRadius: 12, overflow: 'hidden', minHeight: 520, border: `1px solid ${t.accent_color}55` }}>
    <div style={{ padding: '12px 18px', borderBottom: '1px solid #d7dce6', fontSize: 11, opacity: .7 }}>AI GENERATED · {variant.variant.toUpperCase()} · {variant.source_domain}</div>
    <div style={{ padding: '46px 34px 30px', background: `linear-gradient(135deg, ${t.accent_color}22, transparent 55%)` }}>
      <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', opacity: .7 }}>{String(variant.hero.eyebrow || 'AI STUDIO')}</div>
      <h2 style={{ fontSize: 38, lineHeight: 1.02, letterSpacing: '-.04em', maxWidth: 680, margin: '10px 0' }}>{String(variant.hero.headline || 'Modernisierte Website')}</h2>
      <p style={{ maxWidth: 650, opacity: .72, fontSize: 16 }}>{String(variant.hero.subheadline || 'Governed website transformation.')}</p>
      <button style={{ marginTop: 12, padding: '11px 16px', border: 0, background: t.accent_color, color: '#fff', borderRadius: 7 }}>{String(variant.hero.primary_cta?.label || 'Kontakt aufnehmen')}</button>
    </div>
    <div style={{ padding: 22, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>{variant.sections.slice(0, 4).map(s => <div key={s.id} style={{ border: '1px solid #d7dce655', padding: 15, minHeight: 90 }}><strong>{s.title}</strong><div style={{ opacity: .58, fontSize: 12, marginTop: 6 }}>{s.subtitle || s.type.replaceAll('_', ' ')}</div></div>)}</div>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div style={card}><div style={labelStyle}>{label}</div><strong style={{ fontSize: 25 }}>{value}</strong></div>; }
const card: React.CSSProperties = { background: '#0b0f19', border: '1px solid #202637', borderRadius: 14, padding: 20, marginBottom: 16 };
const primary: React.CSSProperties = { padding: '13px 18px', border: 0, borderRadius: 9, background: '#6675ff', color: '#fff', fontWeight: 800, cursor: 'pointer' };
const secondary: React.CSSProperties = { ...primary, background: '#141b2b', border: '1px solid #303b53' };
const pill: React.CSSProperties = { padding: '7px 11px', border: '1px solid #303b53', borderRadius: 20, background: '#111827', color: '#9da8ba', cursor: 'pointer' };
const activePill: React.CSSProperties = { background: '#6675ff', color: '#fff', borderColor: '#6675ff' };
const grid4: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 };
const twoCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: 16 };
const label: React.CSSProperties = { color: '#8fe7c5', fontSize: 10, fontWeight: 900, letterSpacing: '.15em' };
const labelStyle: React.CSSProperties = { color: '#6f7b92', fontSize: 11 };
