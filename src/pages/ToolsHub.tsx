export function ToolsHub() {
  const s: React.CSSProperties = {
    background: '#0a0a0a', color: '#e5e7eb', minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  };

  const tools = [
    {
      icon: '📝',
      title: 'AVV-Generator',
      subtitle: 'Auftragsverarbeitungsvertrag nach Art. 28 DSGVO',
      desc: 'Erstellen Sie rechtssichere AVV-Verträge in 3 Schritten. Mit allen gesetzlich vorgeschriebenen Klauseln, TOMs und Anlagen.',
      href: '/avv-generator',
      badge: 'Art. 28 DSGVO',
      badgeColor: '#1e3a5f',
      textColor: '#93c5fd',
      popular: true,
    },
    {
      icon: '📋',
      title: 'Verarbeitungsverzeichnis',
      subtitle: 'VVT nach Art. 30 DSGVO',
      desc: 'Dokumentieren Sie alle Verarbeitungstätigkeiten Ihres Unternehmens strukturiert und auditfähig.',
      href: '/vvt-wizard',
      badge: 'Art. 30 DSGVO',
      badgeColor: '#1e3a5f',
      textColor: '#93c5fd',
      popular: false,
    },
    {
      icon: '🤖',
      title: 'AI Act Klassifikator',
      subtitle: 'Risikoklassifizierung nach EU AI Act Annex III',
      desc: '12 gezielte Fragen — erfahren Sie sofort, welche Risikokategorie Ihr KI-System hat und was das rechtlich bedeutet.',
      href: '/ai-act-klassifikator',
      badge: 'EU AI Act',
      badgeColor: '#3b1515',
      textColor: '#fca5a5',
      popular: true,
    },
    {
      icon: '⏱️',
      title: '72h Datenpanne Timer',
      subtitle: 'Meldepflicht-Assistent nach Art. 33/34 DSGVO',
      desc: 'Datenpanne erkannt? Starten Sie den 72h-Countdown sofort. Checkliste und Dokumentationshilfe inklusive.',
      href: '/datenpanne-meldung',
      badge: 'Art. 33/34 DSGVO',
      badgeColor: '#3b1515',
      textColor: '#fca5a5',
      popular: false,
    },
    {
      icon: '🛡️',
      title: 'TOM-Generator',
      subtitle: 'Technisch-organisatorische Maßnahmen nach Art. 32',
      desc: '36 TOMs strukturiert dokumentieren. Exportierbar als PDF für Audits, Zertifizierungen und Behördenanfragen.',
      href: '/tom-generator',
      badge: 'Art. 32 DSGVO',
      badgeColor: '#1e3a5f',
      textColor: '#93c5fd',
      popular: false,
    },
    {
      icon: '📄',
      title: 'Datenschutzerklärung-Generator',
      subtitle: 'DSGVO-konforme DSE in 3 Schritten',
      desc: 'Individuelle Datenschutzerklärung für Ihre Website — kostenlos, ohne Anmeldung, sofort einsetzbar.',
      href: '/datenschutz-generator',
      badge: 'Art. 13/14 DSGVO',
      badgeColor: '#1e3a5f',
      textColor: '#93c5fd',
      popular: true,
    },
  ];

  return (
    <div style={s}>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #0d1117 100%)', borderBottom: '1px solid #1f2937', padding: '64px 24px 48px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#1a1a2e', border: '1px solid #374151', borderRadius: 20, padding: '6px 16px', marginBottom: 24 }}>
            <span style={{ width: 6, height: 6, background: '#16a34a', borderRadius: '50%', display: 'inline-block' }} />
            <span style={{ color: '#9ca3af', fontSize: 13 }}>6 kostenlose Tools — kein Account erforderlich</span>
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 800, margin: '0 0 16px', lineHeight: 1.2 }}>
            DSGVO-Compliance<br />
            <span style={{ color: '#2563eb' }}>selbst erledigen</span>
          </h1>
          <p style={{ color: '#6b7280', fontSize: 18, maxWidth: 600, margin: '0 auto 32px', lineHeight: 1.6 }}>
            Professionelle Compliance-Dokumente ohne Anwalt. Alle Tools sind kostenlos, auf Deutsch und sofort einsetzbar.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' as const }}>
            {['DSGVO 2018', 'EU AI Act 2024', 'Keine Anmeldung', 'Kostenlos', 'Deutsch'].map(tag => (
              <span key={tag} style={{ background: '#1f2937', color: '#9ca3af', borderRadius: 6, padding: '4px 12px', fontSize: 13 }}>{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 24 }}>
          {tools.map(tool => (
            <a key={tool.href} href={tool.href} style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{
                background: '#111', border: '1px solid #1f2937', borderRadius: 12, padding: 24,
                cursor: 'pointer', transition: 'border-color 0.2s', position: 'relative',
                height: '100%', boxSizing: 'border-box'
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#2563eb')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#1f2937')}
              >
                {tool.popular && (
                  <div style={{ position: 'absolute', top: 12, right: 12, background: '#2563eb', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                    BELIEBT
                  </div>
                )}
                <div style={{ fontSize: 36, marginBottom: 12 }}>{tool.icon}</div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: '#f9fafb' }}>{tool.title}</h2>
                <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 12px' }}>{tool.subtitle}</p>
                <span style={{ display: 'inline-block', background: tool.badgeColor, color: tool.textColor, borderRadius: 6, padding: '3px 10px', fontSize: 12, marginBottom: 12 }}>
                  {tool.badge}
                </span>
                <p style={{ color: '#9ca3af', fontSize: 14, lineHeight: 1.5, margin: 0 }}>{tool.desc}</p>
                <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 6, color: '#2563eb', fontSize: 14, fontWeight: 600 }}>
                  <span>Tool öffnen</span>
                  <span>→</span>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* CTA Section */}
        <div style={{ background: '#111', border: '1px solid #1f2937', borderRadius: 12, padding: 40, marginTop: 48, textAlign: 'center' }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 12 }}>Alle Tools — professionell überwacht</h2>
          <p style={{ color: '#6b7280', fontSize: 16, maxWidth: 560, margin: '0 auto 28px', lineHeight: 1.6 }}>
            Mit RealSync Dynamics AI erhalten Sie kontinuierliches DSGVO-Monitoring, automatische Audit-Reports und Echtzeitwarnungen — für Ihr gesamtes Unternehmen.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' as const }}>
            <a href="/audit" style={{ background: '#2563eb', color: '#fff', borderRadius: 8, padding: '12px 24px', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
              🔍 Kostenloser Website-Audit
            </a>
            <a href="/pricing" style={{ background: '#1f2937', color: '#e5e7eb', borderRadius: 8, padding: '12px 24px', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
              Preise ansehen
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
