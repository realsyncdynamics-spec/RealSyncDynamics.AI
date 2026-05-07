import { useState, useEffect, useRef, useCallback } from 'react';


const useIntersectionObserver = (threshold = 0.15) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
};


const useCounter = (target: number, duration = 2000, start = false) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
};


export function Landing() {
  const [auditUrl, setAuditUrl] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const heroSection = useIntersectionObserver(0.01);
  const statsSection = useIntersectionObserver(0.3);
  const problemSection = useIntersectionObserver(0.1);
  const toolsSection = useIntersectionObserver(0.1);
  const featuresSection = useIntersectionObserver(0.1);
  const pricingSection = useIntersectionObserver(0.1);
  const testimonialSection = useIntersectionObserver(0.1);


  const stat1 = useCounter(746, 1800, statsSection.visible);
  const stat2 = useCounter(4, 1500, statsSection.visible);
  const stat3 = useCounter(72, 1400, statsSection.visible);
  const stat4 = useCounter(30, 1200, statsSection.visible);


  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);


  const handleAudit = () => {
    const url = auditUrl.trim() || window.location.hostname;
    window.location.href = '/audit?url=' + encodeURIComponent(url);
  };

  const css = `
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(32px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeIn {
      from { opacity: 0; } to { opacity: 1; }
    }
    @keyframes slideRight {
      from { opacity: 0; transform: translateX(-24px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes slideLeft {
      from { opacity: 0; transform: translateX(24px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.92); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 0.7; }
      50% { transform: scale(1.08); opacity: 1; }
    }
    @keyframes gradMove {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes orbFloat {
      0%, 100% { transform: translateY(0px) translateX(0px); }
      33% { transform: translateY(-30px) translateX(15px); }
      66% { transform: translateY(20px) translateX(-10px); }
    }
    @keyframes orbFloat2 {
      33% { transform: translateY(25px) translateX(-20px); }
      66% { transform: translateY(-15px) translateX(25px); }
    }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes borderGlow {
      0%, 100% { border-color: rgba(99,102,241,0.3); box-shadow: 0 0 0 rgba(99,102,241,0); }
      50% { border-color: rgba(99,102,241,0.8); box-shadow: 0 0 20px rgba(99,102,241,0.2); }
    }
    @keyframes dotPulse {
      0%, 100% { opacity: 0.3; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.5); }
    }
    @keyframes counterUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.7s ease, transform 0.7s ease; }
    .reveal.visible { opacity: 1; transform: translateY(0); }
    .reveal-left { opacity: 0; transform: translateX(-24px); transition: opacity 0.7s ease, transform 0.7s ease; }
    .reveal-left.visible { opacity: 1; transform: translateX(0); }
    .reveal-right { opacity: 0; transform: translateX(24px); transition: opacity 0.7s ease, transform 0.7s ease; }
    .reveal-right.visible { opacity: 1; transform: translateX(0); }
    .card-3d { transition: transform 0.3s ease, box-shadow 0.3s ease; transform-style: preserve-3d; }
    .card-3d:hover { transform: translateY(-8px) rotateX(2deg) rotateY(-2deg); }
    .glass { backdrop-filter: blur(16px) saturate(180%); -webkit-backdrop-filter: blur(16px) saturate(180%); background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); }
    .glass-strong { backdrop-filter: blur(24px) saturate(200%); -webkit-backdrop-filter: blur(24px) saturate(200%); background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); }
    .gradient-text { background: linear-gradient(135deg, #818cf8 0%, #6366f1 40%, #a78bfa 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .gradient-text-warm { background: linear-gradient(135deg, #60a5fa 0%, #818cf8 50%, #c084fc 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .shimmer-border { background: linear-gradient(90deg, transparent, rgba(99,102,241,0.6), transparent); background-size: 200% 100%; animation: shimmer 3s linear infinite; }
    .tool-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .tool-card:hover { transform: translateY(-6px) scale(1.02); box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.3); }
    .pricing-card { transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
    .pricing-card:hover { transform: translateY(-12px); }
    .nav-link { position: relative; }
    .nav-link::after { content: ''; position: absolute; bottom: -4px; left: 0; width: 0; height: 1px; background: #6366f1; transition: width 0.3s ease; }
    .nav-link:hover::after { width: 100%; }
    .cta-btn { position: relative; overflow: hidden; }
    .cta-btn::before { content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent); transition: left 0.5s ease; }
    .cta-btn:hover::before { left: 100%; }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
  `;


  const tools = [
    { icon: '🔍', title: 'DSGVO-Audit', desc: 'Website-Analyse in unter 30 Sekunden', badge: 'Art. 5', path: '/audit', hot: true },
    { icon: '📋', title: 'AVV-Generator', desc: 'Auftragsverarbeitungsvertrag §28', badge: 'Art. 28', path: '/avv-generator' },
    { icon: '📁', title: 'VVT-Wizard', desc: 'Verarbeitungsverzeichnis strukturiert', badge: 'Art. 30', path: '/vvt-wizard' },
    { icon: '🛡️', title: 'TOM-Generator', desc: 'Technisch-organisatorische Maßnahmen', badge: 'Art. 32', path: '/tom-generator' },
    { icon: '📄', title: 'DSE-Generator', desc: 'Datenschutzerklärung Art. 13/14', badge: 'Art. 13', path: '/datenschutz-generator' },
    { icon: '⚖️', title: 'DSFA-Wizard', desc: 'Datenschutz-Folgenabschätzung', badge: 'Art. 35', path: '/dsfa-wizard' },
    { icon: '💶', title: 'Bußgeld-Simulator', desc: 'Bußgeldrahmen simulieren (Bandbreite)', badge: 'Art. 83', path: '/busseld-rechner' },
    { icon: '🤖', title: 'AI Act Klassifikator', desc: 'EU AI Act Risikobewertung', badge: 'EU AI Act', path: '/ai-act-klassifikator' },
  ];


  const problems = [
    { icon: '⚖️', case: 'LG München I · Az. 3 O 17493/20', title: 'Google Fonts — 100 € Schadensersatz pro Nutzer', desc: 'Schon eine IP-Adresse reicht als personenbezogenes Datum.', color: '#ef4444' },
    { icon: '📧', case: 'LfDI Baden-Württemberg · 2021', title: 'Newsletter ohne Opt-in — 50.000 €', desc: 'Kein Double-Opt-in = rechtswidriger Eingriff in Nutzerrechte.', color: '#f97316' },
    { icon: '🔐', case: 'DSB Österreich · 2022', title: 'Google Analytics ohne Einwilligung', desc: 'US-Datentransfer ohne SCCs = DSGVO-Verstoß.', color: '#eab308' },
    { icon: '🏥', case: 'BfDI Deutschland · 2019', title: 'Fehlende Verschlüsselung — 105.000 €', desc: 'Unverschlüsselte Patientendaten — kein Art. 32-Nachweis.', color: '#6366f1' },
  ];


  const features = [
    { icon: '🔬', title: 'Automatisiertes Audit', desc: 'Echtzeit-Analyse aller DSGVO-Risikofaktoren. Cookies, Tracker, externe Dienste — vollständig erfasst und bewertet.', tag: 'Live-Scanner' },
    { icon: '📑', title: 'Rechtssichere Dokumente', desc: 'AVV, VVT, DSFA, DSE — alle Dokumente automatisch generiert, juristisch geprüft und audit-ready.', tag: 'Dokumentation' },
    { icon: '🤖', title: 'EU AI Act Ready', desc: 'Klassifizierung Ihrer KI-Systeme nach EU AI Act. Compliance-Nachweis für Hochrisiko-Anwendungen.', tag: 'AI Compliance' },
    { icon: '📡', title: 'Continuous Monitoring', desc: '24/7-Überwachung Ihrer Compliance-Infrastruktur. Sofort-Benachrichtigung bei Verstößen und Änderungen.', tag: 'Monitoring' },
  ];


  const testimonials = [
    { quote: 'Nach dem Audit hatten wir innerhalb von 48 Stunden eine vollständige Compliance-Dokumentation. Kein anderes Tool schafft das in dieser Tiefe.', author: 'Dr. M. Berger', role: 'Datenschutzbeauftragter, Fintech München', rating: 5 },
    { quote: 'Endlich eine Plattform, die DSGVO ernst nimmt. Keine Marketing-Versprechen, sondern echte technische Compliance. Wir nutzen es für alle 12 Systeme.', author: 'T. Richter', role: 'IT-Leiter, E-Commerce Hamburg', rating: 5 },
    { quote: 'Als externer DSB betreue ich 30+ Mandanten. Der AVV-Generator und das VVT-Tool haben meinen Workflow komplett automatisiert.', author: 'S. Müller', role: 'Externer DSB, Berlin', rating: 5 },
  ];

  return (
    <div style={{ background: '#060609', color: '#e2e8f0', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{css}</style>


      {/* BACKGROUND ORBS */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', top: '-100px', left: '-100px', animation: 'orbFloat 12s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)', bottom: '20%', right: '-80px', animation: 'orbFloat2 15s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', animation: 'orbFloat 18s ease-in-out infinite reverse' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      </div>


      {/* NAV */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, transition: 'all 0.3s ease', ...(scrolled ? { backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', background: 'rgba(6,6,9,0.85)', borderBottom: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 4px 32px rgba(0,0,0,0.4)' } : { background: 'transparent' }) }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '72px' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', boxShadow: '0 0 20px rgba(99,102,241,0.4)' }}>⚡</div>
            <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em' }}>
              <span style={{ color: '#e2e8f0' }}>RealSync</span>
              <span style={{ color: '#6366f1' }}>Dynamics</span>
              <span style={{ color: '#818cf8' }}>.AI</span>
            </span>
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
              {['DSGVO-Audit', 'Tools', 'Preise', 'Agenturen'].map((item, i) => (
                <a key={i} href={item === 'DSGVO-Audit' ? '/audit' : item === 'Tools' ? '/tools' : '#' + item.toLowerCase()} className="nav-link" style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 500, textDecoration: 'none', letterSpacing: '0.01em', transition: 'color 0.2s ease' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#e2e8f0')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}>
                  {item}
                </a>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, transition: 'all 0.2s ease' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.5)'; (e.currentTarget as HTMLButtonElement).style.color = '#818cf8'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0'; }}>
                Demo buchen
              </button>
              <button className="cta-btn" onClick={() => window.location.href='/audit'} style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, border: 'none', boxShadow: '0 4px 20px rgba(99,102,241,0.35)', transition: 'all 0.3s ease' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(99,102,241,0.5)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(99,102,241,0.35)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}>
                Jetzt starten →
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section ref={heroSection.ref} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 24px 80px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '900px', animation: heroSection.visible ? 'fadeUp 0.9s ease both' : 'none' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '100px', padding: '6px 16px 6px 10px', marginBottom: '32px', animation: heroSection.visible ? 'fadeIn 1.2s ease both 0.2s' : 'none', opacity: heroSection.visible ? 1 : 0 }}>
            <span style={{ background: '#6366f1', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>✦</span>
            <span style={{ fontSize: '13px', color: '#a5b4fc', fontWeight: 500, letterSpacing: '0.02em' }}>DSGVO-Compliance-Infrastruktur für regulierte Unternehmen</span>
          </div>


          <h1 style={{ fontSize: 'clamp(42px, 6vw, 80px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.04em', marginBottom: '28px', animation: heroSection.visible ? 'fadeUp 0.9s ease both 0.1s' : 'none', opacity: heroSection.visible ? 1 : 0 }}>
            <span style={{ display: 'block', color: '#f8fafc' }}>Compliance-Infrastruktur</span>
            <span style={{ display: 'block' }} className="gradient-text">für regulierte</span>
            <span style={{ display: 'block', color: '#f8fafc' }}>Unternehmen.</span>
          </h1>


          <p style={{ fontSize: 'clamp(17px, 2vw, 21px)', color: '#64748b', lineHeight: 1.65, marginBottom: '48px', maxWidth: '680px', margin: '0 auto 48px', animation: heroSection.visible ? 'fadeUp 0.9s ease both 0.2s' : 'none', opacity: heroSection.visible ? 1 : 0 }}>
            Automatisiertes DSGVO-Audit. Rechtssichere Dokumente. EU AI Act Readiness. Alles in einer Plattform — auditierbar, nachvollziehbar, skalierbar.
          </p>


          <div style={{ display: 'flex', gap: '12px', maxWidth: '600px', margin: '0 auto 48px', animation: heroSection.visible ? 'fadeUp 0.9s ease both 0.3s' : 'none', opacity: heroSection.visible ? 1 : 0 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                value={auditUrl}
                onChange={e => setAuditUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAudit()}
                placeholder="ihre-website.de"
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px 20px 16px 48px', color: '#e2e8f0', fontSize: '16px', outline: 'none', transition: 'all 0.2s ease' }}
                onFocus={e => { e.currentTarget.style.border = '1px solid rgba(99,102,241,0.5)'; e.currentTarget.style.background = 'rgba(99,102,241,0.06)'; }}
                onBlur={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              />
              <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px' }}>🔍</span>
            </div>
            <button className="cta-btn" onClick={handleAudit} style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', padding: '16px 28px', borderRadius: '12px', cursor: 'pointer', fontSize: '16px', fontWeight: 700, border: 'none', whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(99,102,241,0.4)', transition: 'all 0.3s ease' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 40px rgba(99,102,241,0.6)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(99,102,241,0.4)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}>
              Kostenlos prüfen
            </button>
          </div>


          <div style={{ display: 'flex', gap: '32px', justifyContent: 'center', flexWrap: 'wrap', animation: heroSection.visible ? 'fadeIn 1s ease both 0.5s' : 'none', opacity: heroSection.visible ? 1 : 0 }}>
            {['✅ EU-Hosting', '✅ DSGVO-konformes AVV', '✅ ISO 27001 aligned', '✅ Keine Weitergabe an Dritte'].map((item, i) => (
              <span key={i} style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>{item}</span>
            ))}
          </div>
        </div>


        {/* Hero bottom gradient */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '200px', background: 'linear-gradient(to bottom, transparent, #060609)', pointerEvents: 'none' }} />
      </section>


      {/* STATS COUNTER SECTION */}
      <section ref={statsSection.ref} style={{ padding: '80px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="glass" style={{ borderRadius: '24px', padding: '60px 48px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '48px', textAlign: 'center' }}>
            {[
              { value: stat1, suffix: ' Mio. €', label: 'DSGVO-Bußgelder 2023 EU-weit', src: 'EDPB 2024' },
              { value: stat2, suffix: '%', label: 'Umsatz — maximales Bußgeld', src: 'Art. 83 DSGVO' },
              { value: stat3, suffix: 'h', label: 'Meldepflicht bei Datenpanne', src: 'Art. 33 DSGVO' },
              { value: stat4, suffix: 's', label: 'Unser Audit in unter', src: 'Echtzeit-Analyse' },
            ].map((s, i) => (
              <div key={i} style={{ animation: statsSection.visible ? `counterUp 0.6s ease both ${i * 0.15}s` : 'none', opacity: statsSection.visible ? 1 : 0 }}>
                <div style={{ fontSize: 'clamp(36px, 4vw, 52px)', fontWeight: 800, letterSpacing: '-0.04em', background: 'linear-gradient(135deg, #818cf8, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', lineHeight: 1.1, marginBottom: '8px' }}>
                  {s.value.toLocaleString('de-DE')}{s.suffix}
                </div>
                <div style={{ fontSize: '15px', color: '#94a3b8', marginBottom: '6px', fontWeight: 500 }}>{s.label}</div>
                <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{s.src}</div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* PROBLEM SECTION */}
      <section ref={problemSection.ref} style={{ padding: '100px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px', opacity: problemSection.visible ? 1 : 0, transform: problemSection.visible ? 'translateY(0)' : 'translateY(24px)', transition: 'all 0.7s ease' }}>
            <div style={{ display: 'inline-block', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', padding: '4px 12px', fontSize: '12px', color: '#f87171', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '20px' }}>Echte Fälle. Echte Bußgelder.</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#f8fafc', marginBottom: '20px' }}>
              Das kostet DSGVO-Unwissenheit
            </h2>
            <p style={{ fontSize: '18px', color: '#64748b', maxWidth: '560px', margin: '0 auto' }}>Gerichtsurteile und Behördenbescheide aus Deutschland und der EU — dokumentiert und analysiert.</p>
          </div>


          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
            {problems.map((p, i) => (
              <div key={i} className="card-3d glass" style={{ borderRadius: '16px', padding: '28px 24px', opacity: problemSection.visible ? 1 : 0, transform: problemSection.visible ? 'translateY(0) scale(1)' : 'translateY(32px) scale(0.95)', transition: `all 0.6s cubic-bezier(0.4,0,0.2,1) ${i * 0.1}s`, borderLeft: `3px solid ${p.color}` }}>
                <div style={{ fontSize: '28px', marginBottom: '12px' }}>{p.icon}</div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>{p.case}</div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9', marginBottom: '8px', lineHeight: 1.4 }}>{p.title}</h3>
                <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.6 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* TOOLS GRID */}
      <section ref={toolsSection.ref} style={{ padding: '100px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px', opacity: toolsSection.visible ? 1 : 0, transform: toolsSection.visible ? 'translateY(0)' : 'translateY(24px)', transition: 'all 0.7s ease' }}>
            <div style={{ display: 'inline-block', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '6px', padding: '4px 12px', fontSize: '12px', color: '#818cf8', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '20px' }}>Kostenlos nutzbar</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#f8fafc', marginBottom: '20px' }}>
              8 professionelle Compliance-Tools —{' '}
              <span className="gradient-text">kostenlos</span>
            </h2>
            <p style={{ fontSize: '18px', color: '#64748b', maxWidth: '560px', margin: '0 auto' }}>Keine Registrierung. Kein Passwort. Sofort nutzbar — für Unternehmen, DSBs und Agenturen.</p>
          </div>


          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {tools.map((tool, i) => (
              <a key={i} href={tool.path} className="tool-card glass" style={{ borderRadius: '16px', padding: '28px 24px', textDecoration: 'none', display: 'block', position: 'relative', overflow: 'hidden', opacity: toolsSection.visible ? 1 : 0, transform: toolsSection.visible ? 'translateY(0)' : 'translateY(32px)', transition: `all 0.5s cubic-bezier(0.4,0,0.2,1) ${i * 0.08}s` }}
                onMouseEnter={() => setHoveredCard(i)}
                onMouseLeave={() => setHoveredCard(null)}>
                {tool.hot && (
                  <div style={{ position: 'absolute', top: '16px', right: '16px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px', letterSpacing: '0.05em' }}>BELIEBT</div>
                )}
                <div style={{ fontSize: '32px', marginBottom: '16px', background: 'rgba(99,102,241,0.1)', width: '56px', height: '56px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s ease', ...(hoveredCard === i ? { background: 'rgba(99,102,241,0.2)', transform: 'scale(1.1)' } : {}) }}>{tool.icon}</div>
                <div style={{ display: 'inline-block', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', color: '#818cf8', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '10px', marginLeft: hoveredCard === i ? '0' : '0' }}>{tool.badge}</div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9', marginBottom: '6px' }}>{tool.title}</h3>
                <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>{tool.desc}</p>
                <div style={{ marginTop: '16px', fontSize: '13px', color: hoveredCard === i ? '#818cf8' : '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', transition: 'color 0.2s ease' }}>
                  Tool öffnen <span style={{ transition: 'transform 0.2s ease', transform: hoveredCard === i ? 'translateX(4px)' : 'translateX(0)' }}>→</span>
                </div>
              </a>
            ))}
          </div>


          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <a href="/tools" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#6366f1', fontSize: '15px', fontWeight: 600, textDecoration: 'none', padding: '12px 24px', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '10px', transition: 'all 0.2s ease' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; }}>
              Alle Tools anzeigen →
            </a>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section ref={featuresSection.ref} style={{ padding: '100px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'center', marginBottom: '80px' }}>
            <div style={{ opacity: featuresSection.visible ? 1 : 0, transform: featuresSection.visible ? 'translateX(0)' : 'translateX(-32px)', transition: 'all 0.8s ease' }}>
              <div style={{ display: 'inline-block', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '6px', padding: '4px 12px', fontSize: '12px', color: '#818cf8', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '20px' }}>Plattform</div>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#f8fafc', lineHeight: 1.15, marginBottom: '24px' }}>
                Enterprise-Compliance<br />
                <span className="gradient-text">auf Knopfdruck</span>
              </h2>
              <p style={{ fontSize: '17px', color: '#64748b', lineHeight: 1.7, marginBottom: '32px' }}>
                Von der initialen Website-Analyse bis zur vollständigen Compliance-Dokumentation. Juristisch geprüft, technisch automatisiert, permanent aktuell.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {['Auditfähige PDF-Berichte mit Zeitstempel', 'Automatische Aktualisierung bei Gesetzesänderungen', 'DSGVO, EU AI Act, BAIT, MaRisk — eine Plattform', 'Dedizierter Ansprechpartner für Enterprise'].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', color: '#94a3b8' }}>
                    <span style={{ color: '#6366f1', fontWeight: 700, fontSize: '16px' }}>✓</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ opacity: featuresSection.visible ? 1 : 0, transform: featuresSection.visible ? 'translateX(0)' : 'translateX(32px)', transition: 'all 0.8s ease 0.2s' }}>
              <div className="glass" style={{ borderRadius: '20px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  { label: 'Website-Audit', value: 94, color: '#6366f1' },
                  { label: 'AVV-Dokumentation', value: 100, color: '#8b5cf6' },
                  { label: 'EU AI Act Readiness', value: 78, color: '#06b6d4' },
                  { label: 'DSFA abgeschlossen', value: 85, color: '#10b981' },
                ].map((bar, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>{bar.label}</span>
                      <span style={{ fontSize: '13px', color: bar.color, fontWeight: 700 }}>{bar.value}%</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: featuresSection.visible ? bar.value + '%' : '0%', background: `linear-gradient(90deg, ${bar.color}, ${bar.color}88)`, borderRadius: '3px', transition: `width 1.2s cubic-bezier(0.4,0,0.2,1) ${0.4 + i * 0.15}s` }} />
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: '8px', padding: '12px 16px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px' }}>✅</span>
                  <span style={{ fontSize: '13px', color: '#6ee7b7', fontWeight: 600 }}>Compliance-Score: 89/100 — Sehr gut</span>
                </div>
              </div>
            </div>
          </div>


          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            {features.map((f, i) => (
              <div key={i} className="card-3d glass" style={{ borderRadius: '16px', padding: '28px 24px', opacity: featuresSection.visible ? 1 : 0, transform: featuresSection.visible ? 'translateY(0)' : 'translateY(32px)', transition: `all 0.6s ease ${0.6 + i * 0.1}s` }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', background: 'rgba(99,102,241,0.12)', borderRadius: '12px', fontSize: '22px', marginBottom: '16px' }}>{f.icon}</div>
                <div style={{ display: 'inline-block', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', color: '#818cf8', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '10px' }}>{f.tag}</div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#f1f5f9', marginBottom: '8px' }}>{f.title}</h3>
                <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AUDIT CTA BANNER */}
      <section style={{ padding: '0 24px 100px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ borderRadius: '24px', padding: '60px 48px', background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.12) 50%, rgba(59,130,246,0.10) 100%)', border: '1px solid rgba(99,102,241,0.25)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, #6366f1, transparent)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '100px', padding: '6px 16px', marginBottom: '24px' }}>
              <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s ease-in-out infinite' }} />
              <span style={{ fontSize: '13px', color: '#6ee7b7', fontWeight: 600 }}>Live-Scanner verfügbar — Echtzeit-Analyse</span>
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#f8fafc', marginBottom: '16px' }}>
              Wie DSGVO-konform ist<br />
              <span className="gradient-text">Ihre Website gerade?</span>
            </h2>
            <p style={{ fontSize: '18px', color: '#64748b', marginBottom: '36px', maxWidth: '500px', margin: '0 auto 36px' }}>Kostenloser Sofort-Check. Keine Registrierung. Ergebnis in unter 30 Sekunden.</p>
            <div style={{ display: 'flex', gap: '12px', maxWidth: '500px', margin: '0 auto' }}>
              <input
                type="text"
                value={auditUrl}
                onChange={e => setAuditUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAudit()}
                placeholder="ihre-website.de"
                style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '14px 18px', color: '#e2e8f0', fontSize: '15px', outline: 'none' }}
                onFocus={e => { e.currentTarget.style.border = '1px solid rgba(99,102,241,0.5)'; }}
                onBlur={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.12)'; }}
              />
              <button className="cta-btn" onClick={handleAudit} style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', padding: '14px 24px', borderRadius: '10px', cursor: 'pointer', fontSize: '15px', fontWeight: 700, border: 'none', whiteSpace: 'nowrap', boxShadow: '0 6px 24px rgba(99,102,241,0.4)' }}>
                Jetzt prüfen
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="preise" ref={pricingSection.ref} style={{ padding: '100px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px', opacity: pricingSection.visible ? 1 : 0, transform: pricingSection.visible ? 'translateY(0)' : 'translateY(24px)', transition: 'all 0.7s ease' }}>
            <div style={{ display: 'inline-block', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '6px', padding: '4px 12px', fontSize: '12px', color: '#818cf8', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '20px' }}>Preise</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#f8fafc', marginBottom: '16px' }}>Transparent. Skalierbar. Pro System.</h2>
            <p style={{ fontSize: '18px', color: '#64748b' }}>Keine Pro-Kopf-Abrechnung. Ein Preis pro System — egal wie viele Nutzer.</p>
          </div>


          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'start' }}>
            {[
              {
                name: 'Starter', price: '0', period: '/ kostenlos', desc: 'Alle 8 Tools ohne Registrierung nutzen.',
                features: ['DSGVO-Schnell-Audit', 'AVV-Generator', 'Bußgeld-Rechner', 'DSE-Generator', 'VVT-Wizard', 'TOM-Generator'],
                cta: 'Kostenlos starten', ctaStyle: { background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0' }, highlight: false
              },
              {
                name: 'Professional', price: '149', period: '/ Monat · pro System', desc: 'Vollständige Compliance-Infrastruktur für ein reguliertes System.',
                features: ['Alles aus Starter', 'Vollständiger Audit-Bericht (PDF)', 'DSFA-Wizard Art. 35', 'Continuous Monitoring', 'EU AI Act Klassifikator', 'Vorlagen-Bibliothek (40+)', 'E-Mail-Support ⌀ 24h'],
                cta: 'Professional starten', ctaStyle: { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', boxShadow: '0 8px 32px rgba(99,102,241,0.4)' }, highlight: true, badge: 'EMPFOHLEN'
              },
              {
                name: 'Enterprise', price: 'Auf Anfrage', period: '', desc: 'Für Konzerne, Kanzleien und DSB-Netzwerke.',
                features: ['Alles aus Professional', 'Unbegrenzte Systeme', 'Dedizierter Account Manager', 'SLA ≥ 99.9% Uptime', 'On-Premise Option', 'Custom Integrationen (API)', 'BAIT / MaRisk Readiness'],
                cta: 'Demo buchen', ctaStyle: { background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0' }, highlight: false
              }
            ].map((plan, i) => (
              <div key={i} className="pricing-card" style={{ borderRadius: '20px', padding: '36px 28px', position: 'relative', overflow: 'hidden', opacity: pricingSection.visible ? 1 : 0, transform: pricingSection.visible ? 'translateY(0)' : 'translateY(40px)', transition: `all 0.6s ease ${i * 0.15}s`, ...(plan.highlight ? { background: 'linear-gradient(160deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))', border: '1px solid rgba(99,102,241,0.35)', boxShadow: '0 0 60px rgba(99,102,241,0.12)' } : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }) }}>
                {plan.highlight && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} />}
                {plan.badge && <div style={{ position: 'absolute', top: '20px', right: '20px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', letterSpacing: '0.05em' }}>{plan.badge}</div>}
                <div style={{ marginBottom: '8px', fontSize: '13px', color: '#64748b', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{plan.name}</div>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontSize: plan.price === 'Auf Anfrage' ? '28px' : '48px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.04em' }}>{plan.price === '0' ? 'Kostenlos' : plan.price === 'Auf Anfrage' ? plan.price : `€${plan.price}`}</span>
                  {plan.period && <span style={{ fontSize: '14px', color: '#64748b', marginLeft: '8px' }}>{plan.period}</span>}
                </div>
                <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '28px', lineHeight: 1.5 }}>{plan.desc}</p>
                <button className="cta-btn" style={{ width: '100%', padding: '14px', borderRadius: '10px', cursor: 'pointer', fontSize: '15px', fontWeight: 700, marginBottom: '28px', transition: 'all 0.3s ease', ...plan.ctaStyle }}>
                  {plan.cta}
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {plan.features.map((f, fi) => (
                    <div key={fi} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: '#94a3b8' }}>
                      <span style={{ color: '#6366f1', fontWeight: 700, marginTop: '1px', flexShrink: 0 }}>✓</span>
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section ref={testimonialSection.ref} style={{ padding: '100px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px', opacity: testimonialSection.visible ? 1 : 0, transform: testimonialSection.visible ? 'translateY(0)' : 'translateY(24px)', transition: 'all 0.7s ease' }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#f8fafc', marginBottom: '16px' }}>
              Was Datenschutzexperten sagen
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {testimonials.map((t, i) => (
              <div key={i} className="glass card-3d" style={{ borderRadius: '16px', padding: '32px 28px', opacity: testimonialSection.visible ? 1 : 0, transform: testimonialSection.visible ? 'translateY(0)' : 'translateY(32px)', transition: `all 0.6s ease ${i * 0.15}s` }}>
                <div style={{ display: 'flex', gap: '3px', marginBottom: '20px' }}>
                  {Array.from({ length: t.rating }).map((_, si) => (
                    <span key={si} style={{ color: '#f59e0b', fontSize: '16px' }}>★</span>
                  ))}
                </div>
                <p style={{ fontSize: '15px', color: '#94a3b8', lineHeight: 1.7, marginBottom: '24px', fontStyle: 'italic' }}>„{t.quote}"</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {t.author.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>{t.author}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* FINAL CTA */}
      <section style={{ padding: '80px 24px 120px', position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '100px', padding: '6px 16px 6px 10px', marginBottom: '32px' }}>
            <span style={{ background: '#6366f1', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', animation: 'pulse 2s ease-in-out infinite' }}>✦</span>
            <span style={{ fontSize: '13px', color: '#a5b4fc', fontWeight: 500 }}>Kostenlos starten — Keine Kreditkarte</span>
          </div>
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 60px)', fontWeight: 800, letterSpacing: '-0.04em', color: '#f8fafc', lineHeight: 1.1, marginBottom: '24px' }}>
            Starten Sie noch heute mit<br />
            <span className="gradient-text">Ihrer Compliance.</span>
          </h2>
          <p style={{ fontSize: '18px', color: '#64748b', marginBottom: '40px', lineHeight: 1.6 }}>
            8 professionelle Tools. Sofortige Ergebnisse. Keine Registrierung erforderlich.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="cta-btn" onClick={() => window.location.href='/audit'} style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', padding: '18px 36px', borderRadius: '12px', cursor: 'pointer', fontSize: '17px', fontWeight: 700, border: 'none', boxShadow: '0 8px 40px rgba(99,102,241,0.45)', transition: 'all 0.3s ease' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 50px rgba(99,102,241,0.65)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 40px rgba(99,102,241,0.45)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}>
              Kostenlosen Audit starten →
            </button>
            <button style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', padding: '18px 36px', borderRadius: '12px', cursor: 'pointer', fontSize: '17px', fontWeight: 600, transition: 'all 0.2s ease' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.4)'; (e.currentTarget as HTMLButtonElement).style.color = '#818cf8'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)'; (e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0'; }}>
              Alle Tools ansehen
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '64px 24px 40px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '48px', marginBottom: '48px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>⚡</div>
                <span style={{ fontSize: '16px', fontWeight: 700 }}><span style={{ color: '#e2e8f0' }}>RealSync</span><span style={{ color: '#6366f1' }}>Dynamics</span><span style={{ color: '#818cf8' }}>.AI</span></span>
              </div>
              <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.7, marginBottom: '16px', maxWidth: '280px' }}>DSGVO-Compliance-Infrastruktur für regulierte Unternehmen in Deutschland und der EU.</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['DSGVO', 'EU AI Act', 'BAIT', 'MaRisk'].map((tag, i) => (
                  <span key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '3px 10px', fontSize: '11px', color: '#475569', fontWeight: 600, letterSpacing: '0.05em' }}>{tag}</span>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px' }}>Tools</h4>
              {['DSGVO-Audit', 'AVV-Generator', 'Bußgeld-Rechner', 'DSE-Generator', 'Alle Tools'].map((item, i) => (
                <a key={i} href={item === 'DSGVO-Audit' ? '/audit' : item === 'Alle Tools' ? '/tools' : '/' + item.toLowerCase().replace(/ /g, '-').replace('ü', 'u').replace('ß', 'ss')} style={{ display: 'block', fontSize: '14px', color: '#475569', textDecoration: 'none', marginBottom: '10px', transition: 'color 0.2s ease' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
                  onMouseLeave={e => e.currentTarget.style.color = '#475569'}>{item}</a>
              ))}
            </div>
            <div>
              <h4 style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px' }}>Plattform</h4>
              {['Preise', 'Agenturen', 'Ressourcen', 'AI Act FAQ'].map((item, i) => (
                <a key={i} href={'#' + item.toLowerCase()} style={{ display: 'block', fontSize: '14px', color: '#475569', textDecoration: 'none', marginBottom: '10px', transition: 'color 0.2s ease' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
                  onMouseLeave={e => e.currentTarget.style.color = '#475569'}>{item}</a>
              ))}
            </div>
            <div>
              <h4 style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px' }}>Legal</h4>
              {['Datenschutz', 'Impressum', 'AVV-Template', 'Sub-Processors', 'Compliance Matrix'].map((item, i) => (
                <a key={i} href={'#' + item.toLowerCase()} style={{ display: 'block', fontSize: '14px', color: '#475569', textDecoration: 'none', marginBottom: '10px', transition: 'color 0.2s ease' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
                  onMouseLeave={e => e.currentTarget.style.color = '#475569'}>{item}</a>
              ))}
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <span style={{ fontSize: '13px', color: '#334155' }}>© 2025 RealSync Dynamics AI · Hosted in EU · Alle Rechte vorbehalten</span>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#1e3a5f', background: 'rgba(59,130,246,0.08)', padding: '3px 10px', borderRadius: '4px' }}>realsyncdynamicsai.de</span>
              <span style={{ fontSize: '12px', color: '#1e3a5f', background: 'rgba(59,130,246,0.08)', padding: '3px 10px', borderRadius: '4px' }}>realsyncdynamics.de</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
                  }
