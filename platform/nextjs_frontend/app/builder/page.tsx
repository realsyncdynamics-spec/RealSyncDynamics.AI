'use client';

import { useMemo, useState } from 'react';

const BUILDER_URL = process.env.NEXT_PUBLIC_BUILDER_URL ?? 'http://builder.localhost';

type Device = 'desktop' | 'tablet' | 'mobile';
type Section = { id: string; name: string; eyebrow: string; title: string; body: string };

type AgentTask = { id: string; agent_type: string; status: string; depends_on: string[] };
type TaskGraph = { project_id: string; tasks: AgentTask[] };

const initialSections: Section[] = [
  { id: 'hero', name: 'Hero', eyebrow: 'Governance Platform', title: 'Make your digital operation trustworthy.', body: 'A premium, compliant digital experience built from your existing website and business context.' },
  { id: 'services', name: 'Services', eyebrow: 'What we do', title: 'Everything your customers need, clearly presented.', body: 'Turn complex services into a focused, conversion-ready experience.' },
  { id: 'proof', name: 'Proof', eyebrow: 'Evidence', title: 'Trust is designed into every interaction.', body: 'Governance, accessibility, SEO and privacy controls are checked alongside the experience.' },
  { id: 'contact', name: 'Contact', eyebrow: 'Start now', title: 'Ready to transform your website?', body: 'Launch a modern experience without replacing your existing backend.' },
];

const palettes = ['#0b1020', '#172554', '#111827'];

export default function BuilderPage() {
  const [projectName, setProjectName] = useState('My Website');
  const [prompt, setPrompt] = useState('Make this website more premium, clearer and more conversion-focused.');
  const [sections, setSections] = useState(initialSections);
  const [selectedId, setSelectedId] = useState('hero');
  const [device, setDevice] = useState<Device>('desktop');
  const [palette, setPalette] = useState(0);
  const [graph, setGraph] = useState<TaskGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Draft');
  const [loading, setLoading] = useState(false);

  const selected = sections.find((section) => section.id === selectedId) ?? sections[0];
  const canvasWidth = device === 'desktop' ? 'min(100%, 920px)' : device === 'tablet' ? '768px' : '390px';

  const completion = useMemo(() => Math.min(100, 74 + sections.length * 4), [sections.length]);

  function updateSelected(key: 'eyebrow' | 'title' | 'body', value: string) {
    setSections((current) => current.map((section) => section.id === selectedId ? { ...section, [key]: value } : section));
    setStatus('Unsaved changes');
  }

  function addSection() {
    const id = `section-${Date.now()}`;
    const section = { id, name: 'New Section', eyebrow: 'New', title: 'A new section for your story.', body: 'Edit this content with the visual controls or ask the AI editor.' };
    setSections((current) => [...current, section]);
    setSelectedId(id);
    setStatus('Unsaved changes');
  }

  async function buildApp() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BUILDER_URL}/api/v1/builder/create-spec`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_name: projectName, description: prompt.slice(0, 200), prompt, data_types: ['customer_data'], data_subjects: ['customers'], models: ['claude-3-5-sonnet'], llm_provider: 'anthropic', jurisdiction: 'eu', target_stack: 'nextjs_supabase' }),
      });
      if (!response.ok) throw new Error(`Builder API ${response.status}`);
      setGraph(await response.json());
      setStatus('Build queued');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#070a12', color: '#eef2ff', fontFamily: 'Inter, ui-sans-serif, system-ui', display: 'grid', gridTemplateRows: '64px 1fr 76px' }}>
      <header style={{ borderBottom: '1px solid #202637', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: '#0b0f19' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <strong style={{ letterSpacing: '-.02em', fontSize: 18 }}>RealSync <span style={{ color: '#8b9cff' }}>SiteOS</span></strong>
          <span style={{ color: '#7d879b', fontSize: 13 }}>/ Website Builder</span>
          <input value={projectName} onChange={(e) => setProjectName(e.target.value)} style={{ background: '#121827', border: '1px solid #283249', borderRadius: 8, color: '#fff', padding: '7px 10px', width: 150 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {(['desktop', 'tablet', 'mobile'] as Device[]).map((item) => <button key={item} onClick={() => setDevice(item)} style={buttonStyle(device === item)}>{item}</button>)}
          <button onClick={() => setStatus('Saved')} style={buttonStyle(false)}>Save</button>
          <button onClick={buildApp} disabled={loading} style={{ ...buttonStyle(false), background: '#eef2ff', color: '#090c14' }}>{loading ? 'Building…' : 'Publish'}</button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr 290px', minHeight: 0 }}>
        <aside style={{ borderRight: '1px solid #202637', background: '#0b0f19', padding: 16, overflow: 'auto' }}>
          <small style={label}>PAGES</small>
          <div style={pageItem}>⌂ Home</div><div style={pageItem}>About</div><div style={pageItem}>Services</div><div style={pageItem}>Contact</div>
          <small style={{ ...label, display: 'block', marginTop: 24 }}>SECTIONS</small>
          {sections.map((section) => <button key={section.id} onClick={() => setSelectedId(section.id)} style={{ ...sideButton, borderColor: selectedId === section.id ? '#6675ff' : '#202637', background: selectedId === section.id ? '#151b31' : 'transparent' }}>{section.name}</button>)}
          <button onClick={addSection} style={{ ...sideButton, marginTop: 8, color: '#9aa7ff' }}>+ Add section</button>
        </aside>

        <section style={{ background: '#111522', overflow: 'auto', padding: 28 }}>
          <div style={{ maxWidth: canvasWidth, margin: '0 auto', transition: 'width .2s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#7d879b', fontSize: 12, marginBottom: 12 }}><span>LIVE PREVIEW</span><span>{device.toUpperCase()}</span></div>
            <div style={{ background: '#fff', color: '#111827', borderRadius: 14, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,.35)' }}>
              <nav style={{ height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px', borderBottom: '1px solid #e5e7eb' }}><strong>YOUR BRAND</strong><span style={{ fontSize: 13 }}>About &nbsp; Services &nbsp; Contact</span></nav>
              {sections.map((section, index) => <article key={section.id} onClick={() => setSelectedId(section.id)} style={{ padding: index === 0 ? '88px 8%' : '64px 8%', background: index === 0 ? palettes[palette] : index % 2 ? '#f8fafc' : '#fff', color: index === 0 ? '#fff' : '#111827', outline: selectedId === section.id ? '3px solid #6675ff' : 'none', outlineOffset: -3, cursor: 'pointer' }}><div style={{ maxWidth: 760, margin: '0 auto' }}><div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', opacity: .68 }}>{section.eyebrow}</div><h1 style={{ fontSize: index === 0 ? 'clamp(38px, 5vw, 72px)' : 38, lineHeight: 1.05, letterSpacing: '-.04em', margin: '14px 0 18px' }}>{section.title}</h1><p style={{ fontSize: 17, lineHeight: 1.65, maxWidth: 650, opacity: .78 }}>{section.body}</p>{index === 0 && <button style={{ marginTop: 24, padding: '13px 20px', borderRadius: 8, border: 0, background: '#fff', color: '#111827', fontWeight: 700 }}>Get started →</button>}</div></article>)}
              <footer style={{ padding: 24, background: '#0b1020', color: '#fff', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}><span>© 2026 Your Brand</span><span>Privacy · Legal</span></footer>
            </div>
          </div>
        </section>

        <aside style={{ borderLeft: '1px solid #202637', background: '#0b0f19', padding: 18, overflow: 'auto' }}>
          <small style={label}>SELECTED SECTION</small>
          <input value={selected.name} readOnly style={inputStyle} />
          <small style={label}>EYEBROW</small><input value={selected.eyebrow} onChange={(e) => updateSelected('eyebrow', e.target.value)} style={inputStyle} />
          <small style={label}>HEADLINE</small><textarea value={selected.title} onChange={(e) => updateSelected('title', e.target.value)} rows={4} style={inputStyle} />
          <small style={label}>BODY</small><textarea value={selected.body} onChange={(e) => updateSelected('body', e.target.value)} rows={5} style={inputStyle} />
          <small style={label}>STYLE</small>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>{palettes.map((p, i) => <button key={p} onClick={() => { setPalette(i); setStatus('Unsaved changes'); }} style={{ width: 32, height: 32, borderRadius: 8, border: i === palette ? '2px solid #fff' : '1px solid #30394d', background: p }} />)}</div>
          <div style={{ border: '1px solid #283249', borderRadius: 12, padding: 14, background: '#101625' }}><strong style={{ fontSize: 13 }}>AI EDITOR</strong><p style={{ color: '#8f9ab0', fontSize: 12, lineHeight: 1.5 }}>Describe a change and SiteOS will apply it to the selected section.</p><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} style={inputStyle} /><button onClick={() => { updateSelected('title', selected.title.includes('premium') ? selected.title : `${selected.title} — premium, clearer and conversion-focused`); setStatus('AI change applied'); }} style={{ width: '100%', padding: 10, borderRadius: 8, border: 0, background: '#6675ff', color: '#fff', fontWeight: 700 }}>Apply with AI</button></div>
          <small style={{ ...label, display: 'block', marginTop: 22 }}>GOVERNANCE</small>
          {['SEO', 'Privacy / DSGVO', 'Accessibility', 'EU AI Act', 'Evidence'].map((item) => <div key={item} style={{ padding: '8px 0', fontSize: 13, color: '#b7c0d2' }}>✓ {item}</div>)}
          <div style={{ marginTop: 16, fontSize: 12, color: '#7d879b' }}>Readiness <strong style={{ color: '#dfe5ff' }}>{completion}%</strong> · {status}</div>
          {error && <div style={{ color: '#ff8e9d', marginTop: 12, fontSize: 12 }}>{error}</div>}
          {graph && <div style={{ marginTop: 12, color: '#7d879b', fontSize: 11 }}>{graph.tasks.length} build tasks queued</div>}
        </aside>
      </div>

      <footer style={{ borderTop: '1px solid #202637', background: '#0b0f19', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#7d879b', fontSize: 12 }}><span>RealSync SiteOS · Governance-aware website builder</span><span>Draft · {status}</span></footer>
    </main>
  );
}

const label: React.CSSProperties = { display: 'block', color: '#6f7b92', fontSize: 10, fontWeight: 800, letterSpacing: '.12em', marginBottom: 8, marginTop: 16 };
const pageItem: React.CSSProperties = { padding: '9px 10px', color: '#cbd5e1', fontSize: 13 };
const sideButton: React.CSSProperties = { width: '100%', textAlign: 'left', padding: '9px 10px', border: '1px solid', borderRadius: 8, color: '#d8def0', fontSize: 13, marginBottom: 5, cursor: 'pointer' };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: '#111827', color: '#f8fafc', border: '1px solid #29344a', borderRadius: 8, padding: '9px 10px', marginBottom: 6, fontFamily: 'inherit' };
const buttonStyle = (active: boolean): React.CSSProperties => ({ padding: '7px 10px', borderRadius: 7, border: `1px solid ${active ? '#6675ff' : '#29344a'}`, background: active ? '#1a2140' : '#111827', color: '#e8ecff', fontSize: 12, cursor: 'pointer' });
