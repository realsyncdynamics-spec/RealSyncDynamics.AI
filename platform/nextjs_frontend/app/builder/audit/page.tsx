'use client';

import { useState } from 'react';

const BUILDER_URL = process.env.NEXT_PUBLIC_BUILDER_URL ?? 'http://builder.localhost';

type AuditResponse = {
  evidence: { domain: string; final_url: string; evidence_hash: string; technologies: string[]; legal_pages: Record<string, boolean>; consent: Record<string, unknown> };
  audit: { score: number; summary: string; critical_findings: Array<{ finding_id: string; title: string; description: string; remediation_hint: string }>; warnings: Array<{ finding_id: string; title: string; description: string; remediation_hint: string }>; recommendations: Array<{ finding_id: string; title: string; description: string; remediation_hint: string }> };
};

type Generated = { evidence_hash: string; variants: Array<{ variant: string; hero: { headline?: string; subheadline?: string }; sections: Array<{ id: string; title: string; type: string }> }> };

export default function AuditPage() {
  const [url, setUrl] = useState('https://');
  const [result, setResult] = useState<AuditResponse | null>(null);
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  async function scan() {
    setLoading(true); setError(''); setGenerated(null);
    try {
      const res = await fetch(`${BUILDER_URL}/api/v1/builder/audit/scan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      if (!res.ok) throw new Error(`Audit API ${res.status}`);
      setResult(await res.json());
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }

  async function generate() {
    if (!result) return;
    setGenerating(true); setError('');
    try {
      const res = await fetch(`${BUILDER_URL}/api/v1/builder/audit/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, evidence: result.evidence, audit: result.audit, company_context: `Website: ${result.evidence.domain}`, project_id: result.evidence.domain }) });
      if (!res.ok) throw new Error(`Generation API ${res.status}`);
      setGenerated(await res.json());
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setGenerating(false); }
  }

  const findings = result ? [...result.audit.critical_findings, ...result.audit.warnings, ...result.audit.recommendations] : [];

  return <main style={{ minHeight: '100vh', background: '#070a12', color: '#eef2ff', fontFamily: 'Inter, system-ui', padding: 32 }}>
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <header style={{ marginBottom: 28 }}><div style={{ color: '#8fe7c5', fontSize: 11, fontWeight: 800, letterSpacing: '.14em' }}>REALSYNCDYNAMICS AI · SITEOS</div><h1 style={{ fontSize: 44, letterSpacing: '-.04em', margin: '10px 0' }}>Website Governance Audit</h1><p style={{ color: '#8f9ab0', maxWidth: 720 }}>Browser evidence → deterministic normalization → Gemini governance analysis → four governed landingpage specifications.</p></header>
      <section style={{ display: 'flex', gap: 10, marginBottom: 24 }}><input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.de" style={{ flex: 1, padding: 14, borderRadius: 10, border: '1px solid #29344a', background: '#111827', color: '#fff' }} /><button onClick={scan} disabled={loading} style={primary}>{loading ? 'Scanning…' : 'Run evidence scan'}</button></section>
      {error && <div style={{ padding: 14, background: '#321722', border: '1px solid #6d3044', borderRadius: 10, marginBottom: 20, color: '#ffb8c5' }}>{error}</div>}
      {result && <>
        <section style={grid3}><Metric label="Governance score" value={`${result.audit.score}/100`} /><Metric label="Critical findings" value={String(result.audit.critical_findings.length)} /><Metric label="Evidence hash" value={result.evidence.evidence_hash.slice(0, 12)} /></section>
        <section style={card}><h2>Audit result</h2><p style={{ color: '#aab4c7' }}>{result.audit.summary}</p><div style={{ display: 'grid', gap: 10 }}>{findings.map(f => <div key={f.finding_id} style={{ border: '1px solid #283249', borderRadius: 10, padding: 14 }}><strong>{f.title}</strong><div style={{ color: '#8f9ab0', fontSize: 13, marginTop: 5 }}>{f.description}</div><div style={{ color: '#8fe7c5', fontSize: 12, marginTop: 8 }}>Remediation: {f.remediation_hint}</div></div>)}</div></section>
        <section style={card}><h2>Evidence snapshot</h2><div style={{ color: '#aab4c7', fontSize: 13 }}>Domain: {result.evidence.domain}</div><div style={{ color: '#aab4c7', fontSize: 13 }}>Technologies: {result.evidence.technologies.join(', ') || 'none detected'}</div><div style={{ color: '#aab4c7', fontSize: 13 }}>Impressum: {String(result.evidence.legal_pages.impressum)} · Datenschutz: {String(result.evidence.legal_pages.datenschutz)}</div><div style={{ color: '#6675ff', fontFamily: 'monospace', fontSize: 11, marginTop: 10 }}>{result.evidence.evidence_hash}</div></section>
        <section style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div><h2 style={{ margin: 0 }}>Rebuild with SiteOS</h2><p style={{ color: '#8f9ab0', marginBottom: 0 }}>Generate Executive, Modern, Authority and Minimal PageSpec ASTs from the same evidence.</p></div><button onClick={generate} disabled={generating} style={primary}>{generating ? 'Generating…' : 'Generate 4 variants'}</button></section>
      </>}
      {generated && <section style={card}><h2>Generated PageSpecs</h2><div style={grid4}>{generated.variants.map(v => <article key={v.variant} style={{ border: '1px solid #283249', borderRadius: 12, padding: 16 }}><div style={{ color: '#8fe7c5', fontSize: 11, textTransform: 'uppercase' }}>{v.variant}</div><h3>{v.hero?.headline || 'Generated landingpage'}</h3><p style={{ color: '#8f9ab0', fontSize: 13 }}>{v.hero?.subheadline}</p><div style={{ color: '#6f7b92', fontSize: 11 }}>{v.sections.length} SiteOS sections</div></article>)}</div></section>}
    </div>
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div style={card}><div style={{ color: '#6f7b92', fontSize: 11 }}>{label}</div><strong style={{ fontSize: 26 }}>{value}</strong></div>; }
const card: React.CSSProperties = { background: '#0b0f19', border: '1px solid #202637', borderRadius: 14, padding: 20, marginBottom: 16 };
const primary: React.CSSProperties = { padding: '13px 18px', border: 0, borderRadius: 9, background: '#6675ff', color: '#fff', fontWeight: 800, cursor: 'pointer' };
const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 };
const grid4: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 };
