import { Link } from 'react-router-dom';

/** Uses existing audit, auth and setup routes. All dashboard values are illustrative. */
const steps = [
  { n: '01', title: 'Website prüfen', description: 'Starten Sie kostenlos mit Ihrer Internetadresse. Wir zeigen technische Auffälligkeiten.', to: '/audit', action: 'Check starten' },
  { n: '02', title: 'Ergebnisse verstehen', description: 'Sehen Sie verständlich, was die Hinweise für Ihren Betrieb bedeuten könnten.', to: '/audit', action: 'Audit ansehen' },
  { n: '03', title: 'Sicher anmelden', description: 'Registrieren Sie sich erst, wenn Sie weitermachen möchten. Bestehender Login, kein zweites Konto.', to: '/welcome?next=%2Fsetup-assistant', action: 'Anmelden' },
  { n: '04', title: 'Betrieb einrichten', description: 'Wählen Sie Unternehmensart, Mitarbeiterzahl und KI-Werkzeuge im vorhandenen Einrichtungsassistenten.', to: '/setup-assistant', action: 'Einrichtung öffnen' },
] as const;

export function V5UnifiedEntry() {
  return <section className="rs-v5-entry" aria-labelledby="rs-v5-entry-title">
    <div className="rs-v5-entry__inner">
      <div className="rs-v5-entry__headline">
        <div><p className="rs-v5-entry__eyebrow">REALSYNC · IHR EINSTIEG</p><h2 id="rs-v5-entry-title">Verstehen, was wichtig ist. <span>Danach gezielt handeln.</span></h2><p>Vom ersten Website-Check bis zu Ihrem eigenen Unternehmens-Dashboard. Ohne Fachchinesisch, ohne doppelten Anmeldeprozess.</p></div>
        <Link to="/audit" className="rs-v5-entry__primary">Kostenlosen Check starten <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="rs-v5-entry__layout">
        <ol className="rs-v5-entry__steps">{steps.map(s=><li key={s.n}><span className="rs-v5-entry__number">{s.n}</span><div><h3>{s.title}</h3><p>{s.description}</p><Link to={s.to}>{s.action} →</Link></div></li>)}</ol>
        <div className="rs-v5-entry__app" role="region" aria-label="Beispiel eines RealSync-Command-Centers">
          <div className="rs-v5-entry__chrome"><strong>R<span>ealSync</span> <i>Dynamics.AI</i></strong><span>PRODUKTVORSCHAU · BEISPIELDATEN</span></div>
          <div className="rs-v5-entry__screen">
            <nav aria-label="Bereiche der Vorschau"><span className="active">Übersicht</span><span>Website-Audit</span><span>Risiken</span><span>Maßnahmen</span><span>Nachweise</span></nav>
            <div className="rs-v5-entry__dash"><small>COMMAND CENTER · DEMO</small><h3>Ihr Betrieb. Ihr Überblick.</h3><p>Welche Fragen sind geklärt – und was sollten Sie als Nächstes prüfen?</p>
              <div className="rs-v5-entry__metrics"><article><span>Erfasste Website</span><b>1</b><small>Beispiel</small></article><article><span>Offene Prüfpunkte</span><b>3</b><small>Beispiel</small></article><article><span>Dokumentation</span><b>Bereit</b><small>Beispiel</small></article></div>
              <div className="rs-v5-entry__issues"><h4>Ihre nächsten Schritte <span>BEISPIEL</span></h4><p><i/> Cookie-Einbindung kontrollieren <b>Prüfen</b></p><p><i/> KI-Regeln für Mitarbeiter festlegen <b>Klärung</b></p><p><i/> Zuständigkeit für Freigaben bestimmen <b>Planen</b></p></div>
              <div className="rs-v5-entry__flow">PRÜFEN <span>→</span> VERSTEHEN <span>→</span> HANDELN <span>→</span> NACHWEISEN</div>
            </div>
          </div>
        </div>
      </div>
      <p className="rs-v5-entry__disclaimer">Die Vorschau enthält keine echten Kundendaten oder gemessenen Compliance-Werte. Ihr Zugang, die Mandantentrennung und vorhandene Onboarding-Funktionen bleiben bestehen. Ein Website-Scan ersetzt keine rechtliche Prüfung.</p>
    </div>
  </section>;
}
