import { useState, useEffect } from 'react';


export function Landing() {
  const [auditUrl, setAuditUrl] = useState('');
  const [scrolled, setScrolled] = useState(false);


  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);


  const css = `
    @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { 0%,100%{opacity:.6} 50%{opacity:1} }
    @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
    @keyframes gradMove { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
    .hero-word { animation: fadeUp .7s ease both; }
    .hero-word:nth-child(2){animation-delay:.1s}
    .hero-word:nth-child(3){animation-delay:.2s}
    .shimmer { animation: shimmer 2.5s ease infinite; }
    .stat-card:hover { border-color:#2563eb!important; transform:translateY(-2px); }
    .feature-card:hover { border-color:#374151!important; transform:translateY(-2px); }
    .tool-card:hover { border-color:#2563eb!important; transform:translateY(-3px); box-shadow:0 8px 32px rgba(37,99,235,.18)!important; }
    .btn-primary:hover { background:#1d4ed8!important; transform:translateY(-1px); box-shadow:0 6px 24px rgba(37,99,235,.4)!important; }
    .btn-ghost:hover { background:#1f2937!important; }
    .tier-card:hover { border-color:#2563eb!important; transform:translateY(-2px); }
    .nav-link:hover { color:#e5e7eb!important; }
    * { transition: color .15s, background .15s, border-color .2s, transform .2s, box-shadow .2s; box-sizing:border-box; }
  `;


  const ROOT: React.CSSProperties = {
    background: '#09090b',
    color: '#e4e4e7',
    minHeight: '100vh',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    overflowX: 'hidden',
  };


  const navStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
    background: scrolled ? 'rgba(9,9,11,.92)' : 'transparent',
    backdropFilter: scrolled ? 'blur(16px)' : 'none',
    borderBottom: scrolled ? '1px solid #18181b' : '1px solid transparent',
    padding: '0 24px', height: 64,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  };


  return (
    <div style={ROOT}>
      <style>{css}</style>


      {/* ── NAV ─────────────────────────────────────────── */}
      <nav style={navStyle}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ color:'#fff', fontSize:16 }}>⚖</span>
          </div>
          <span style={{ fontWeight:700, fontSize:16, letterSpacing:'-.3px' }}>RealSync<span style={{ color:'#2563eb' }}>Dynamics</span>.AI</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:28 }}>
          {[['DSGVO-Audit','/audit'],['Tools','/tools'],['Preise','/pricing'],['Agenturen','/agencies']].map(([label,href])=>(
            <a key={label} className="nav-link" href={href} style={{ color:'#71717a', fontSize:14, fontWeight:500, textDecoration:'none' }}>{label}</a>
          ))}
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <a href="/contact-sales" style={{ background:'transparent', color:'#a1a1aa', border:'1px solid #27272a', borderRadius:8, padding:'8px 18px', fontSize:14, fontWeight:500, textDecoration:'none' }}>Demo buchen</a>
          <a href="/audit" className="btn-primary" style={{ background:'#2563eb', color:'#fff', border:'none', borderRadius:8, padding:'8px 18px', fontSize:14, fontWeight:600, textDecoration:'none', cursor:'pointer' }}>Jetzt starten →</a>
        </div>
      </nav>


      {/* ── HERO ────────────────────────────────────────── */}
      <section style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'120px 24px 80px', position:'relative', overflow:'hidden' }}>
        {/* Background glow */}
        <div style={{ position:'absolute', top:'20%', left:'50%', transform:'translateX(-50%)', width:800, height:500, background:'radial-gradient(ellipse, rgba(37,99,235,.15) 0%, transparent 70%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:'40%', left:'20%', width:300, height:300, background:'radial-gradient(ellipse, rgba(37,99,235,.08) 0%, transparent 70%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:'30%', right:'15%', width:250, height:250, background:'radial-gradient(ellipse, rgba(124,58,237,.07) 0%, transparent 70%)', pointerEvents:'none' }} />


        {/* Badge */}
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(37,99,235,.12)', border:'1px solid rgba(37,99,235,.3)', borderRadius:100, padding:'6px 16px', marginBottom:32 }}>
          <span style={{ width:6, height:6, background:'#2563eb', borderRadius:'50%', display:'inline-block' }} className="shimmer" />
          <span style={{ color:'#93c5fd', fontSize:12, fontWeight:600, letterSpacing:'.5px' }}>DSGVO · EU AI ACT · BAIT · MARISK · ISO 27001</span>
        </div>


        {/* Headline */}
        <h1 style={{ fontSize:'clamp(36px,5.5vw,72px)', fontWeight:800, lineHeight:1.08, letterSpacing:'-2px', textAlign:'center', margin:'0 0 24px', maxWidth:820 }}>
          <span className="hero-word" style={{ display:'block' }}>Compliance-Infrastruktur</span>
          <span className="hero-word" style={{ display:'block', color:'#2563eb' }}>für regulierte Unternehmen.</span>
        </h1>


        <p style={{ fontSize:'clamp(16px,2vw,20px)', color:'#71717a', lineHeight:1.6, maxWidth:600, textAlign:'center', margin:'0 0 40px', animation:'fadeUp .7s .3s ease both', opacity:0, animationFillMode:'forwards' }}>
          DSGVO-Audit, AVV-Generator, DSFA, Bußgeld-Kalkulator, AI-Act-Klassifikator — alles in einer Plattform. Ohne Anwalt. Ohne Vendor-Lock-in.
        </p>


        {/* Inline Audit CTA */}
        <div style={{ display:'flex', gap:0, background:'#18181b', border:'1px solid #27272a', borderRadius:12, padding:6, marginBottom:16, width:'100%', maxWidth:520, animation:'fadeUp .7s .4s ease both', opacity:0, animationFillMode:'forwards' }}>
          <input
            type="url"
            placeholder="https://ihre-website.de"
            value={auditUrl}
            onChange={e=>setAuditUrl(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter' && auditUrl) window.location.href=`/audit?url=${encodeURIComponent(auditUrl)}`; }}
            style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#e4e4e7', fontSize:15, padding:'10px 12px' }}
          />
          <a href={auditUrl ? `/audit?url=${encodeURIComponent(auditUrl)}` : '/audit'}
            className="btn-primary"
            style={{ background:'#2563eb', color:'#fff', borderRadius:8, padding:'10px 20px', fontSize:14, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>
            Audit starten →
          </a>
        </div>
        <p style={{ color:'#52525b', fontSize:12, marginBottom:48, animation:'fadeUp .7s .5s ease both', opacity:0, animationFillMode:'forwards' }}>
          Kostenlos · Kein Account · Ergebnis in 30 Sekunden
        </p>


        {/* Social proof logos */}
        <div style={{ display:'flex', alignItems:'center', gap:32, flexWrap:'wrap', justifyContent:'center', animation:'fadeUp .7s .6s ease both', opacity:0, animationFillMode:'forwards' }}>
          <span style={{ color:'#52525b', fontSize:13 }}>Vertraut von Teams in:</span>
          {['Fintech','Healthtech','Legal','HR-Software','E-Commerce','Beratung'].map(s=>(
            <span key={s} style={{ color:'#71717a', fontSize:13, fontWeight:500, border:'1px solid #27272a', borderRadius:6, padding:'4px 12px' }}>{s}</span>
          ))}
        </div>
      </section>
      {/* ── TRUST NUMBERS ──────────────────────────────── */}
      <section style={{ borderTop:'1px solid #18181b', borderBottom:'1px solid #18181b', padding:'64px 24px', background:'#0c0c0e' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:40 }}>
          {[
            { num:'746 Mio. €', label:'DSGVO-Bußgelder 2024 in der EU', sub:'Quelle: EDPB Annual Report' },
            { num:'4 %', label:'Max. Jahresumsatz Bußgeld', sub:'Art. 83 Abs. 5 DSGVO' },
            { num:'72 h', label:'Meldefrist Datenpanne', sub:'Art. 33 DSGVO — weltweit schärfste Frist' },
            { num:'< 30 s', label:'Unser Website-Audit braucht', sub:'Inkl. 29 Heuristiken ohne Account' },
          ].map(({num,label,sub})=>(
            <div key={num} className="stat-card" style={{ border:'1px solid #18181b', borderRadius:12, padding:'28px 24px', cursor:'default' }}>
              <div style={{ fontSize:'clamp(28px,3vw,40px)', fontWeight:800, color:'#fff', letterSpacing:'-1.5px', marginBottom:8 }}>{num}</div>
              <div style={{ color:'#a1a1aa', fontSize:14, fontWeight:500, marginBottom:6 }}>{label}</div>
              <div style={{ color:'#52525b', fontSize:12 }}>{sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PROBLEM SECTION ─────────────────────────────── */}
      <section style={{ padding:'96px 24px', maxWidth:1100, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:64 }}>
          <div style={{ color:'#ef4444', fontSize:12, fontWeight:700, letterSpacing:'1.5px', marginBottom:16 }}>DAS PROBLEM</div>
          <h2 style={{ fontSize:'clamp(28px,4vw,48px)', fontWeight:800, letterSpacing:'-1.5px', margin:'0 0 20px', lineHeight:1.1 }}>
            Jede DSGVO-Prüfung findet<br /><span style={{ color:'#ef4444' }}>dasselbe</span>.
          </h2>
          <p style={{ color:'#71717a', fontSize:18, maxWidth:560, margin:'0 auto' }}>
            Weil niemand Compliance-Infrastruktur gebaut hat. Bis jetzt.
          </p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:16 }}>
          {[
            { icon:'⚠️', title:'Google Fonts = Bußgeld', body:'LG München: 100 € pro Besucher wegen IP-Übertragung. Tausende Websites betroffen, die meisten wissen es nicht.', law:'LG München I, Az. 3 O 17493/20' },
            { icon:'📊', title:'Analytics ohne Consent', body:'GA4 ohne Cookie-Banner = Verstoß gegen Art. 6 DSGVO. Datenschutzbehörden verhängen aktiv Bußgelder.', law:'DSB Österreich, C-DSB 27/2021' },
            { icon:'🤖', title:'KI ohne AVV', body:'ChatGPT, Claude, Gemini — jeder Einsatz mit Kundendaten braucht einen Auftragsverarbeitungsvertrag nach Art. 28.', law:'Art. 28 DSGVO — Pflicht' },
            { icon:'🔒', title:'Datenpanne, 72h verpasst', body:'Behörde nicht informiert = automatisches Bußgeld obendrauf. Die meisten Unternehmen haben keinen Prozess.', law:'Art. 33 DSGVO — 72h-Frist' },
          ].map(({icon,title,body,law})=>(
            <div key={title} className="feature-card" style={{ background:'#0f0f11', border:'1px solid #1c1c1f', borderRadius:12, padding:24, cursor:'default' }}>
              <div style={{ fontSize:28, marginBottom:14 }}>{icon}</div>
              <div style={{ fontWeight:700, fontSize:16, color:'#fff', marginBottom:10 }}>{title}</div>
              <div style={{ color:'#71717a', fontSize:14, lineHeight:1.6, marginBottom:14 }}>{body}</div>
              <div style={{ color:'#52525b', fontSize:11, fontFamily:'monospace', background:'#18181b', borderRadius:6, padding:'4px 10px', display:'inline-block' }}>{law}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FREE TOOLS SECTION ──────────────────────────── */}
      <section style={{ padding:'80px 24px', background:'#0c0c0e', borderTop:'1px solid #18181b', borderBottom:'1px solid #18181b' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:56 }}>
            <h2 style={{ fontSize:'clamp(26px,3.5vw,44px)', fontWeight:800, letterSpacing:'-1.5px', margin:'0 0 16px', lineHeight:1.15 }}>
              Compliance selbst erledigen —<br />sofort, kostenlos, auf Deutsch.
            </h2>
            <p style={{ color:'#71717a', fontSize:17, maxWidth:520, margin:'0 auto' }}>
              8 professionelle Compliance-Tools. Kein Account. Kein Abo. PDF-Export inklusive.
            </p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:16 }}>
            {[
              { icon:'📝', title:'AVV-Generator', sub:'Art. 28 DSGVO', desc:'3-Schritt Auftragsverarbeitungsvertrag mit TOMs und PDF-Export', href:'/avv-generator', hot:true },
              { icon:'⚖️', title:'Bußgeld-Rechner', sub:'Art. 83 DSGVO', desc:'Schätzen Sie Ihr Bußgeld-Risiko nach Umsatz, Verstoß und Schwere', href:'/busseld-rechner', hot:true },
              { icon:'📄', title:'DSE-Generator', sub:'Art. 13/14 DSGVO', desc:'Individuelle Datenschutzerklärung in 3 Schritten — sofort einsetzbar', href:'/datenschutz-generator', hot:true },
              { icon:'🔍', title:'DSFA-Wizard', sub:'Art. 35 DSGVO', desc:'Datenschutz-Folgenabschätzung mit Risikoanalyse und Behörden-Check', href:'/dsfa-wizard', hot:false },
              { icon:'📋', title:'VVT-Wizard', sub:'Art. 30 DSGVO', desc:'Verarbeitungsverzeichnis strukturiert und auditfähig dokumentieren', href:'/vvt-wizard', hot:false },
              { icon:'🤖', title:'AI Act Klassifikator', sub:'EU AI Act Annex III', desc:'12 Fragen — sofort Ihre KI-Risikokategorie ermitteln', href:'/ai-act-klassifikator', hot:true },
              { icon:'🛡️', title:'TOM-Generator', sub:'Art. 32 DSGVO', desc:'36 technisch-organisatorische Maßnahmen dokumentieren', href:'/tom-generator', hot:false },
              { icon:'⏱️', title:'Datenpanne Timer', sub:'Art. 33/34 DSGVO', desc:'72h-Countdown mit Melde-Checkliste starten', href:'/datenpanne-meldung', hot:false },
            ].map(({icon,title,sub,desc,href,hot})=>(
              <a key={href} href={href} className="tool-card" style={{ background:'#0f0f11', border:'1px solid #1c1c1f', borderRadius:12, padding:22, textDecoration:'none', display:'block', position:'relative' }}>
                {hot && <div style={{ position:'absolute', top:12, right:12, background:'rgba(37,99,235,.2)', color:'#93c5fd', borderRadius:6, padding:'2px 8px', fontSize:10, fontWeight:700, border:'1px solid rgba(37,99,235,.3)' }}>BELIEBT</div>}
                <div style={{ fontSize:28, marginBottom:12 }}>{icon}</div>
                <div style={{ fontWeight:700, fontSize:15, color:'#fff', marginBottom:4 }}>{title}</div>
                <div style={{ color:'#2563eb', fontSize:11, fontWeight:600, marginBottom:10 }}>{sub}</div>
                <div style={{ color:'#71717a', fontSize:13, lineHeight:1.5, marginBottom:14 }}>{desc}</div>
                <div style={{ color:'#2563eb', fontSize:13, fontWeight:600 }}>Öffnen →</div>
              </a>
            ))}
          </div>
          <div style={{ textAlign:'center', marginTop:40 }}>
            <a href="/tools" style={{ color:'#a1a1aa', fontSize:14, textDecoration:'none', border:'1px solid #27272a', borderRadius:8, padding:'10px 24px', display:'inline-block' }}>
              Alle 8 Tools ansehen →
            </a>
          </div>
        </div>
      </section>
      {/* ── FEATURES ────────────────────────────────────── */}
      <section style={{ padding:'96px 24px', maxWidth:1100, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:64 }}>
          <div style={{ color:'#2563eb', fontSize:12, fontWeight:700, letterSpacing:'1.5px', marginBottom:16 }}>PLATTFORM</div>
          <h2 style={{ fontSize:'clamp(28px,4vw,48px)', fontWeight:800, letterSpacing:'-1.5px', margin:'0 0 20px', lineHeight:1.1 }}>
            Eine Plattform für<br />die gesamte Compliance-Infrastruktur.
          </h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {[
            {
              icon:'🔍', badge:'DSGVO AUDIT', title:'Automatisiertes Website-Scoring',
              body:'29 Heuristiken, 5 Kategorien. CSP, Cookie-Timing, Datenschutzerklärung, Google Fonts, Analytics-Consent — in unter 30 Sekunden. Mit §§-Referenzen und konkreten Handlungsempfehlungen.',
              tags:['CSP-Check','Cookie-Timing','GA4-Consent','Google Fonts','DSE-Analyse'],
            },
            {
              icon:'📜', badge:'DOKUMENTATION', title:'Compliance-Dokumente generieren',
              body:'AVV, VVT, TOM, DSE, DSFA — alle gesetzlich erforderlichen Dokumente auf Knopfdruck. DSGVO-konform, auf Deutsch, mit PDF-Export für Auditor und Datenschutzbeauftragten.',
              tags:['Art. 28 AVV','Art. 30 VVT','Art. 32 TOM','Art. 35 DSFA','Art. 13 DSE'],
            },
            {
              icon:'🤖', badge:'EU AI ACT', title:'KI-Compliance für regulierte Branchen',
              body:'Klassifizieren Sie Ihre KI-Systeme nach Annex III. Prüfen Sie Hochrisiko-Anforderungen, Transparenzpflichten und Meldepflichten. Inklusive Konformitätsbewertungs-Checkliste.',
              tags:['Annex III Klassifikation','Hochrisiko-Prüfung','Transparenzpflicht','DSGVO + AI Act'],
            },
            {
              icon:'⚡', badge:'MONITORING', title:'Kontinuierliche Überwachung & Alerts',
              body:'Wöchentliche Re-Audits per Cron. Sofort-Alert wenn sich Ihr Score verschlechtert. Audit-History mit Delta-Tracking. Shareable Report-Links für Ihr Team und Ihren DSB.',
              tags:['Wöchentliches Re-Audit','Score-Delta','Email-Alerts','Share-Links'],
            },
          ].map(({icon,badge,title,body,tags})=>(
            <div key={badge} className="feature-card" style={{ background:'#0f0f11', border:'1px solid #1c1c1f', borderRadius:16, padding:32, cursor:'default' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
                <div style={{ width:44, height:44, background:'rgba(37,99,235,.12)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, border:'1px solid rgba(37,99,235,.2)' }}>{icon}</div>
                <span style={{ color:'#2563eb', fontSize:11, fontWeight:700, letterSpacing:'1px' }}>{badge}</span>
              </div>
              <h3 style={{ fontSize:20, fontWeight:700, color:'#fff', margin:'0 0 12px', lineHeight:1.3 }}>{title}</h3>
              <p style={{ color:'#71717a', fontSize:14, lineHeight:1.7, margin:'0 0 20px' }}>{body}</p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {tags.map(t=>(
                  <span key={t} style={{ background:'#18181b', color:'#a1a1aa', borderRadius:6, padding:'4px 10px', fontSize:11, border:'1px solid #27272a' }}>{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── AUDIT CTA BANNER ─────────────────────────────── */}
      <section style={{ padding:'0 24px 80px', maxWidth:1100, margin:'0 auto' }}>
        <div style={{ background:'linear-gradient(135deg, #1e3a5f 0%, #1e1b4b 100%)', border:'1px solid rgba(37,99,235,.3)', borderRadius:20, padding:'56px 48px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:32 }}>
          <div style={{ maxWidth:560 }}>
            <div style={{ color:'#93c5fd', fontSize:12, fontWeight:700, letterSpacing:'1.5px', marginBottom:14 }}>KOSTENLOSER AUDIT — KEINE KARTE</div>
            <h2 style={{ fontSize:'clamp(24px,3vw,38px)', fontWeight:800, color:'#fff', margin:'0 0 14px', letterSpacing:'-1px', lineHeight:1.2 }}>
              Wie DSGVO-konform ist<br />Ihre Website gerade?
            </h2>
            <p style={{ color:'#93c5fd', fontSize:16, margin:'0', lineHeight:1.6 }}>
              Unser Audit prüft 29 Heuristiken in unter 30 Sekunden. Inklusive §§-Referenzen und Handlungsempfehlungen — kostenlos, kein Account.
            </p>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <a href="/audit" className="btn-primary" style={{ background:'#fff', color:'#1e3a5f', borderRadius:10, padding:'14px 32px', fontSize:15, fontWeight:700, textDecoration:'none', textAlign:'center', whiteSpace:'nowrap' }}>
              🔍 Website jetzt prüfen
            </a>
            <a href="/busseld-rechner" style={{ background:'transparent', color:'#93c5fd', borderRadius:10, padding:'12px 32px', fontSize:14, fontWeight:600, textDecoration:'none', textAlign:'center', border:'1px solid rgba(147,197,253,.3)' }}>
              ⚖️ Bußgeld-Risiko kalkulieren
            </a>
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────── */}
      <section style={{ padding:'80px 24px', background:'#0c0c0e', borderTop:'1px solid #18181b' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:56 }}>
            <div style={{ color:'#2563eb', fontSize:12, fontWeight:700, letterSpacing:'1.5px', marginBottom:16 }}>PREISE</div>
            <h2 style={{ fontSize:'clamp(28px,4vw,44px)', fontWeight:800, letterSpacing:'-1.5px', margin:'0 0 16px' }}>
              Pro System. Nicht pro Nutzer.
            </h2>
            <p style={{ color:'#71717a', fontSize:17, maxWidth:480, margin:'0 auto' }}>
              Unser Pricing-Modell passt zu der Art, wie Unternehmen Compliance wirklich nutzen.
            </p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>
            {[
              {
                name:'Starter', price:'0 €', period:'/Monat', highlight:false,
                desc:'Für Einzelpersonen und kleine Teams.',
                features:['1 Website-Audit pro Tag','Alle 8 kostenlosen Tools','PDF-Export','DSGVO §§-Referenzen'],
                cta:'Kostenlos starten', href:'/audit',
              },
              {
                name:'Professional', price:'149 €', period:'/Monat', highlight:true,
                desc:'Für wachsende Unternehmen mit Compliance-Anforderungen.',
                features:['Unbegrenzte Audits','Wöchentliche Re-Audits','E-Mail-Alerts bei Score-Verschlechterung','API-Zugang','Audit-History & Delta','Shareable Reports'],
                cta:'14 Tage kostenlos testen', href:'/contact-sales',
              },
              {
                name:'Enterprise', price:'Auf Anfrage', period:'', highlight:false,
                desc:'Für regulierte Branchen mit komplexen Anforderungen.',
                features:['Multi-Tenant-Dashboard','EU-Datenresidenz garantiert','Dedicated DSB-Support','BAIT/MaRisk-Modul','SLA & Custom Contracts','On-Premise Option'],
                cta:'Demo vereinbaren', href:'/contact-sales',
              },
            ].map(({name,price,period,highlight,desc,features,cta,href})=>(
              <div key={name} className="tier-card" style={{ background: highlight ? 'rgba(37,99,235,.1)' : '#0f0f11', border: highlight ? '1px solid #2563eb' : '1px solid #1c1c1f', borderRadius:16, padding:32, position:'relative', cursor:'default' }}>
                {highlight && <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:'#2563eb', color:'#fff', borderRadius:100, padding:'4px 14px', fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>EMPFOHLEN</div>}
                <div style={{ color: highlight ? '#93c5fd' : '#a1a1aa', fontSize:13, fontWeight:700, marginBottom:8 }}>{name}</div>
                <div style={{ fontSize:'clamp(28px,4vw,42px)', fontWeight:800, color:'#fff', letterSpacing:'-1.5px', marginBottom:4 }}>
                  {price}<span style={{ fontSize:14, color:'#71717a', fontWeight:400 }}>{period}</span>
                </div>
                <div style={{ color:'#71717a', fontSize:13, marginBottom:24 }}>{desc}</div>
                <div style={{ borderTop:'1px solid #27272a', paddingTop:20, marginBottom:24 }}>
                  {features.map(f=>(
                    <div key={f} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                      <span style={{ color:'#16a34a', fontSize:16 }}>✓</span>
                      <span style={{ color:'#a1a1aa', fontSize:14 }}>{f}</span>
                    </div>
                  ))}
                </div>
                <a href={href} style={{ display:'block', textAlign:'center', background: highlight ? '#2563eb' : '#18181b', color: highlight ? '#fff' : '#a1a1aa', borderRadius:10, padding:'12px', fontSize:14, fontWeight:600, textDecoration:'none', border: highlight ? 'none' : '1px solid #27272a' }}>{cta}</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS / TRUST ─────────────────────────── */}
      <section style={{ padding:'96px 24px', maxWidth:1100, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:56 }}>
          <div style={{ color:'#a1a1aa', fontSize:12, fontWeight:700, letterSpacing:'1.5px', marginBottom:16 }}>VERTRAUEN</div>
          <h2 style={{ fontSize:'clamp(26px,3.5vw,42px)', fontWeight:800, letterSpacing:'-1.5px', margin:'0 0 16px' }}>
            Warum Compliance-Teams<br />RealSync Dynamics AI wählen.
          </h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>
          {[
            { quote:'Endlich ein Tool, das die §§ nicht versteckt. Wir können dem DSB direkt den Link schicken.', author:'Datenschutzbeauftragter', company:'Mittelständisches Fintech, München' },
            { quote:'Der Bußgeld-Rechner hat unserer Geschäftsführung in 2 Minuten klar gemacht, warum Compliance kein Nice-to-have ist.', author:'IT-Leiter', company:'E-Commerce, Hamburg' },
            { quote:'In 14 Jahren als DSB habe ich noch kein Tool gesehen, das AVV, VVT und DSFA so strukturiert kombiniert.', author:'Externer Datenschutzbeauftragter', company:'Beratungsunternehmen, Berlin' },
          ].map(({quote,author,company})=>(
            <div key={author} style={{ background:'#0f0f11', border:'1px solid #1c1c1f', borderRadius:16, padding:28 }}>
              <div style={{ color:'#2563eb', fontSize:24, marginBottom:12 }}>"</div>
              <p style={{ color:'#a1a1aa', fontSize:15, lineHeight:1.7, margin:'0 0 20px', fontStyle:'italic' }}>{quote}</p>
              <div style={{ color:'#fff', fontSize:14, fontWeight:600 }}>{author}</div>
              <div style={{ color:'#52525b', fontSize:12, marginTop:4 }}>{company}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────── */}
      <section style={{ padding:'80px 24px 120px', textAlign:'center' }}>
        <div style={{ maxWidth:680, margin:'0 auto' }}>
          <h2 style={{ fontSize:'clamp(32px,5vw,60px)', fontWeight:800, letterSpacing:'-2px', lineHeight:1.08, margin:'0 0 24px' }}>
            Starten Sie heute.<br />
            <span style={{ color:'#2563eb' }}>Kostenlos.</span>
          </h2>
          <p style={{ color:'#71717a', fontSize:18, margin:'0 0 40px', lineHeight:1.6 }}>
            Kein Account. Keine Kreditkarte. Ihr erster DSGVO-Audit dauert 30 Sekunden.
          </p>
          <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }}>
            <a href="/audit" className="btn-primary" style={{ background:'#2563eb', color:'#fff', borderRadius:10, padding:'15px 36px', fontSize:16, fontWeight:700, textDecoration:'none' }}>
              🔍 Website-Audit starten →
            </a>
            <a href="/tools" className="btn-ghost" style={{ background:'#18181b', color:'#a1a1aa', border:'1px solid #27272a', borderRadius:10, padding:'15px 36px', fontSize:16, fontWeight:600, textDecoration:'none' }}>
              Alle Tools ansehen
            </a>
          </div>
          <div style={{ display:'flex', justifyContent:'center', gap:32, marginTop:40, flexWrap:'wrap' }}>
            {['Hosted in EU','DSGVO-konformes AVV inklusive','ISO 27001 aligned','Keine Weitergabe an Dritte'].map(t=>(
              <div key={t} style={{ display:'flex', alignItems:'center', gap:8, color:'#52525b', fontSize:13 }}>
                <span style={{ color:'#16a34a' }}>✓</span>{t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────── */}
      <footer style={{ borderTop:'1px solid #18181b', padding:'48px 24px', background:'#0c0c0e' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:40 }}>
          <div style={{ maxWidth:300 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <div style={{ width:28, height:28, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ color:'#fff', fontSize:14 }}>⚖</span>
              </div>
              <span style={{ fontWeight:700, fontSize:15 }}>RealSync<span style={{ color:'#2563eb' }}>Dynamics</span>.AI</span>
            </div>
            <p style={{ color:'#52525b', fontSize:13, lineHeight:1.6, margin:'0 0 16px' }}>
              DSGVO-Compliance-Infrastruktur für regulierte Unternehmen in Deutschland und der EU.
            </p>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {['DSGVO','EU AI Act','BAIT','MaRisk'].map(t=>(
                <span key={t} style={{ color:'#52525b', fontSize:11, border:'1px solid #27272a', borderRadius:4, padding:'2px 8px' }}>{t}</span>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', gap:64, flexWrap:'wrap' }}>
            {[
              { head:'Tools', links:[['DSGVO-Audit','/audit'],['AVV-Generator','/avv-generator'],['Bußgeld-Rechner','/busseld-rechner'],['DSE-Generator','/datenschutz-generator'],['Alle Tools','/tools']] },
              { head:'Plattform', links:[['Preise','/pricing'],['Agenturen','/agencies'],['Ressourcen','/ressourcen'],['AI Act FAQ','/ai-act-faq']] },
              { head:'Legal', links:[['Datenschutz','/legal/privacy'],['AVV-Template','/legal/avv'],['Sub-Processors','/legal/sub-processors'],['Compliance Matrix','/legal/compliance-matrix']] },
            ].map(({head,links})=>(
              <div key={head}>
                <div style={{ color:'#fff', fontSize:13, fontWeight:600, marginBottom:14 }}>{head}</div>
                {links.map(([label,href])=>(
                  <a key={label} href={href} style={{ display:'block', color:'#52525b', fontSize:13, marginBottom:10, textDecoration:'none' }}
                    onMouseEnter={e=>(e.currentTarget.style.color='#a1a1aa')}
                    onMouseLeave={e=>(e.currentTarget.style.color='#52525b')}
                  >{label}</a>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div style={{ maxWidth:1100, margin:'40px auto 0', paddingTop:24, borderTop:'1px solid #18181b', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16 }}>
          <div style={{ color:'#3f3f46', fontSize:12 }}>© 2025 RealSync Dynamics AI · Hosted in EU · Alle Rechte vorbehalten</div>
          <div style={{ color:'#3f3f46', fontSize:12 }}>realsyncdynamicsai.de · realsyncdynamics.de</div>
        </div>
      </footer>
    </div>
  );
        }
