import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { V4_ROUTES } from './landing-v4-content';
import './ModernHero.css';

/** Public product illustration, deliberately not connected to a real tenant. */
const exampleFindings = [
  { title: 'Cookie-Einbindung prüfen', detail: 'Ist vor dem Laden eine Einwilligung erforderlich?', level: 'Prüfen' },
  { title: 'KI-Nutzung klären', detail: 'Dürfen Kundendaten an externe Anbieter gehen?', level: 'Klärung' },
  { title: 'Verantwortliche festlegen', detail: 'Wer überprüft die Ergebnisse?', level: 'Nächster Schritt' },
];

export function ModernV4Hero() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = url.trim();
    navigate(V4_ROUTES.audit + (value ? '?url=' + encodeURIComponent(value) : ''));
  }
  return (
    <main className="rs-modern-hero">
      <div className="rs-modern-wrap">
        <div className="rs-modern-copy">
          <p className="rs-modern-eyebrow">EU-NATIVE BY DESIGN <span>DSGVO · EU AI Act · KI-Governance</span></p>
          <h1 data-testid="v4-hero-heading">AI Compliance Operations OS <span>für DSGVO und EU AI Act.</span></h1>
          <p className="rs-modern-claim" data-testid="v4-hero-lede">Risiken auf Ihrer Website und bei KI erkennen und nachweisen.</p>
          <p className="rs-modern-explainer">Sie haben eine Firmenwebsite oder nutzen KI wie ChatGPT? RealSync hilft Ihnen, mögliche Risiken zu erkennen, verständlich einzuordnen und die nächsten Schritte nachvollziehbar zu dokumentieren. Auch ohne Datenschutz-Fachwissen.</p>
          <ol className="rs-modern-steps" aria-label="So funktioniert RealSync">
            {['Prüfen', 'Verstehen', 'Handeln', 'Nachweisen'].map((step, i) => <li key={step}><b>{String(i + 1).padStart(2, '0')}</b>{step}</li>)}
          </ol>
          <form className="rs-modern-form" onSubmit={submit}>
            <label htmlFor="rs-modern-url">Prüfen Sie Ihre Website kostenlos</label>
            <div><input id="rs-modern-url" type="text" inputMode="url" placeholder="www.mein-betrieb.de" value={url} onChange={e => setUrl(e.target.value)} /><button type="submit">Kostenlosen Check starten <span aria-hidden="true">→</span></button></div>
            <p>Website-Adresse genügt · kein Account vor dem Einstieg · technische Vorprüfung, keine Rechtsberatung</p>
          </form>
          <div className="rs-modern-links"><Link to={V4_ROUTES.runtime}>Plattform kennenlernen →</Link><a href="#dashboard">Dashboard-Vorschau ansehen ↓</a></div>
        </div>
        <div className="rs-modern-product" role="region" aria-label="Beispiel einer RealSync-Dashboard-Ansicht">
          <div className="rs-modern-app-top"><strong><span className="rs-modern-r">R</span> RealSync <span>Dynamics.AI</span></strong><span className="rs-modern-demo">Beispielansicht · keine Kundendaten</span></div>
          <div className="rs-modern-app-body">
            <aside className="rs-modern-sidebar" aria-hidden="true"><b>COMMAND CENTER</b>{['Übersicht','Website-Audit','Risiken','Maßnahmen','Freigaben','Nachweise'].map((s,i)=><span className={i===0?'selected':''} key={s}>{s}</span>)}</aside>
            <div className="rs-modern-main">
              <p className="rs-modern-mini">BEISPIELABLAUF</p><h2>Vom Fund zur Maßnahme.</h2>
              <p className="rs-modern-sub">Eine verständliche Übersicht für Ihren Betrieb.</p>
              <div className="rs-modern-stat-grid"><div><small>Website-Prüfung</small><strong>Erfasst</strong><span>Beispieldaten</span></div><div><small>Offene Themen</small><strong>3</strong><span>Zur Einordnung</span></div><div><small>Nächster Schritt</small><strong>Prüfen</strong><span>Maßnahmen ansehen</span></div></div>
              <section className="rs-modern-findings"><h3>Mögliche Themen <span>BEISPIELE</span></h3>{exampleFindings.map(x=><div className="rs-modern-finding" key={x.title}><span className="rs-modern-finding-dot" aria-hidden="true" /><div><strong>{x.title}</strong><p>{x.detail}</p></div><em>{x.level}</em></div>)}</section>
              <div className="rs-modern-proof"><span>PRÜFEN → VERSTEHEN → HANDELN → NACHWEISEN</span><span>Nachvollziehbar dokumentieren</span></div>
            </div>
          </div>
        </div>
      </div>
      <p className="rs-modern-bottom-note">Für Handwerksbetriebe, Selbstständige, Unternehmen und Agenturen – verständlich starten, bei Bedarf vertiefen.</p>
    </main>
  );
}
