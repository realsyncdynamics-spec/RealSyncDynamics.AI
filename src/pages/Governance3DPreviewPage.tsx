import Governance3DHero from '../components/landing/governance-3d/Governance3DHero';

/** Isolated review surface. The public homepage remains LandingV3 until approval. */
export default function Governance3DPreviewPage() {
  return (
    <div style={{ background: '#f8fafd', minHeight: '100vh' }}>
      <nav aria-label="Vorschau-Navigation" style={{
        position: 'absolute', zIndex: 5, left: 24, top: 20,
        display: 'flex', gap: 18, alignItems: 'center',
      }}>
        <a href="/" style={{ color: '#1d4ed8', fontWeight: 700, textDecoration: 'none' }}>
          ← RealSync Startseite
        </a>
        <span style={{ fontSize: 12, color: '#64748b' }}>Governance 3D · Designvorschau</span>
      </nav>
      <Governance3DHero auditHref="/audit" platformHref="/governance-runtime" />
      <section id="governance-platform" aria-labelledby="governance-platform-title"
        style={{ maxWidth: 940, margin: '0 auto', padding: '100px 24px 140px' }}>
        <p style={{ color: '#2563eb', fontWeight: 750, letterSpacing: '.15em', fontSize: 12 }}>
          GOVERNANCE OS
        </p>
        <h2 id="governance-platform-title" style={{ fontSize: 'clamp(32px, 4vw, 56px)', lineHeight: 1.1 }}>
          Vom KI-System zum nachvollziehbaren Nachweis.
        </h2>
        <p style={{ fontSize: 18, lineHeight: 1.7, color: '#475569', maxWidth: 650 }}>
          Diese Vorschau visualisiert Audit, Evidence, Richtlinien und Monitoring.
          Die Grafik enthält keine echten Mandantendaten oder erfundenen Compliance-Ergebnisse.
          Der nächste Schritt führt zu den bereits vorhandenen Produktseiten.
        </p>
        <a href="/governance-runtime" style={{ color: '#1d4ed8', fontWeight: 750 }}>
          Bestehendes Governance OS öffnen →
        </a>
      </section>
    </div>
  );
}
