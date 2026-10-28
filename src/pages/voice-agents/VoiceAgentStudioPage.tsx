import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, ChevronRight, Headphones, Phone, ShieldCheck } from 'lucide-react';
import { SEOHead } from '../../components/SEOHead';
import { IMPLEMENTATION_ITEMS } from '../../product/implementation-status';
import { findVoiceIndustry, VOICE_INDUSTRIES, VOICE_ONBOARDING_STEPS, VOICE_PRODUCT_CONCEPTS, type VoiceIndustry } from './catalog';
import './voice-agent-studio.css';

const ROOT = '/voice-agents';
const voiceStatus = IMPLEMENTATION_ITEMS.find((item) => item.id === 'voice-telephony')?.status;

function PageMeta({ title, description }: { title: string; description: string }) {
  return <SEOHead title={title} description={description} noIndex />;
}

function Action({ to, children, secondary = false }: { to: string; children: ReactNode; secondary?: boolean }) {
  return <Link className={`vs-button ${secondary ? 'vs-button-secondary' : ''}`} to={to}>{children}<ArrowRight size={17} aria-hidden /></Link>;
}

function Intro({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <div className="vs-intro"><p className="vs-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="vs-lead">{children}</p></div>;
}

function IndustryCards({ limit }: { limit?: number }) {
  return <div className="vs-industry-grid">{VOICE_INDUSTRIES.slice(0, limit).map((industry, index) => (
    <Link className="vs-industry" key={industry.slug} to={`${ROOT}/branchen/${industry.slug}`}>
      <span className="vs-meta">{String(index + 1).padStart(2, '0')} / BRANCHENKONZEPT</span>
      <h3>{industry.name}<ArrowRight size={20} aria-hidden /></h3>
      <p>{industry.description}</p>
      <span className="vs-text-link">Ablauf ansehen</span>
    </Link>
  ))}</div>;
}

function ConversationExample({ industry }: { industry: VoiceIndustry }) {
  const [scenario, setScenario] = useState<'request' | 'unknown' | 'handoff'>('request');
  const examples = {
    request: { caller: industry.exampleRequest, reply: industry.exampleReply, outcome: 'Anliegen strukturiert · Beispiel, nichts gespeichert' },
    unknown: { caller: 'Können Sie mir dafür einen verbindlichen Preis nennen?', reply: 'Dazu liegen mir keine bestätigten aktuellen Daten vor. Ich kann Ihnen keinen Preis zusagen. Bitte wenden Sie sich an das zuständige Team.', outcome: 'Wissenslücke erkannt · Keine erfundene Auskunft' },
    handoff: { caller: 'Ich möchte mit einem Menschen sprechen.', reply: 'Selbstverständlich. Im eingerichteten Betrieb würde ich jetzt den freigegebenen Kontaktweg nutzen. Dieses Beispiel führt keine Weiterleitung aus.', outcome: 'Übergabe vorgesehen · Kein Anruf ausgeführt' },
  };
  const selected = examples[scenario];
  return <section className="vs-conversation" aria-label={`Gesprächsbeispiel ${industry.name}`}>
    <div className="vs-panel-top"><span><Headphones size={18} aria-hidden /> {industry.name}</span><span className="vs-meta">BEISPIEL</span></div>
    <div className="vs-wave" aria-hidden>{[12, 22, 38, 20, 46, 60, 35, 76, 48, 88, 60, 34, 70, 46, 28, 56, 82, 48, 64, 34, 22, 42, 18, 12].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
    <p className="vs-example-label">Vorgeschriebener Dialog · kein Live-Gespräch</p>
    <div className="vs-scenarios" role="group" aria-label="Beispielsituation">
      {([['request', 'Anfrage'], ['unknown', 'Wissenslücke'], ['handoff', 'Übergabe']] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={scenario === id} onClick={() => setScenario(id)}>{label}</button>)}
    </div>
    <div className="vs-dialog" aria-live="polite" aria-atomic="true">
      <div><span className="vs-meta">KI-ASSISTENT</span><p>Guten Tag. Sie sprechen mit einem KI-Assistenten. Wie kann ich Ihnen helfen?</p></div>
      <div className="vs-caller"><span className="vs-meta">ANRUFENDE PERSON</span><p>{selected.caller}</p></div>
      <div><span className="vs-meta">KI-ASSISTENT</span><p>{selected.reply}</p></div>
      <p className="vs-outcome"><Check size={16} aria-hidden />{selected.outcome}</p>
    </div>
  </section>;
}

function HomePage() {
  return <>
    <PageMeta title="Voice Agent Studio | RealSync Dynamics AI" description="Entdecke die geplanten KI-Telefonassistenten für deine Branche. Gesprächsabläufe, Aufgaben und Voraussetzungen transparent kennenlernen." />
    <section className="vs-hero">
      <div><p className="vs-eyebrow">REALSYNC VOICE AGENT STUDIO</p><h1>Dein Unternehmen.<br /><span>Immer ein offenes Ohr.</span></h1>
        <p className="vs-lead">Dein KI-Telefonassistent. Für deine Branche. Geplant für Kundenanfragen, Rückrufe und organisierte Termine — mit klaren Regeln für jede Aufgabe.</p>
        <div className="vs-actions"><Action to={`${ROOT}/branchen`}>Branche auswählen</Action><Action to={`${ROOT}/demo`} secondary>Gesprächsablauf ansehen</Action></div>
        <p className="vs-caption">In Entwicklung. Browser-Testgespräche, Tarife und Telefonie sind noch nicht zur Aktivierung verfügbar.</p>
      </div>
      <ConversationExample industry={VOICE_INDUSTRIES[0]} />
    </section>
    <section className="vs-section"><div className="vs-section-heading"><p className="vs-eyebrow">SO IST ES GEPLANT</p><h2>Dein Betrieb gibt den Rahmen.<br />Der Assistent folgt ihm.</h2></div>
      <div className="vs-steps">{[
        ['01', 'Dein Unternehmen erklären', 'Branche wählen, Leistungen beschreiben und die Informationen freigeben, die dein Assistent verwenden darf.'],
        ['02', 'Im Gespräch ausprobieren', 'Stimme, Aufgaben und Übergaben testen. Erst geprüfte Abläufe sollen für Kunden erreichbar werden.'],
        ['03', 'Kontrolliert aktivieren', 'Telefonie, Berechtigung, Budget und Tests müssen bestätigt sein. Danach folgt der laufende Betrieb.'],
      ].map(([number, title, copy]) => <article key={number}><span className="vs-step-number">{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
    </section>
    <section className="vs-section"><div className="vs-section-heading vs-heading-row"><div><p className="vs-eyebrow">BRANCHEN</p><h2>Versteht deinen Alltag.</h2></div><Link className="vs-text-link" to={`${ROOT}/branchen`}>Alle zehn Branchen <ArrowRight size={16} aria-hidden /></Link></div><IndustryCards limit={3} /></section>
    <section className="vs-section vs-split"><div><p className="vs-eyebrow">KLARE GRENZEN. BESSERE ABLÄUFE.</p><h2>Ein Assistent.<br />Deine Regeln.</h2><p>Geplant ist ein mehrsprachiger Assistent, dessen Wissen, Aufgaben und Verbindungen dein Unternehmen kontrolliert. Menschen übernehmen, wenn eine Antwort oder Entscheidung außerhalb dieses Rahmens liegt.</p></div>
      <div className="vs-feature-list">{[
        ['Freigegebenes Wissen', 'Quellen und Aktualität sollen sichtbar bleiben. Preise und Verfügbarkeiten brauchen eine verlässliche, aktuelle Verbindung.'],
        ['Kalender und Systeme', 'Eine Vormerkung ist keine Buchung. Verbindliche Aktionen benötigen passende Rechte und eine bestätigte Ausführung.'],
        ['Menschliche Übergabe', 'Ein klarer Kontaktweg gehört zum Aktivierungscheck. Er darf nicht durch eine erfundene Erfolgsmeldung ersetzt werden.'],
        ['Nachvollziehbare Kosten', 'Vor dem Start sollen Tarif, Kontingent und Budget feststehen. Kosten bei Weiterleitungen gehören in dieselbe Rechnung.'],
      ].map(([title, text]) => <article key={title}><ShieldCheck size={20} aria-hidden /><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
    </section>
    <section className="vs-section vs-faq"><div><p className="vs-eyebrow">GUT ZU WISSEN</p><h2>Offene Fragen.<br />Klare Antworten.</h2></div><div>{[
      ['Kann ich bereits mit meinem Agenten telefonieren?', 'Noch nicht über dieses Studio. Hier kannst du Branchenkonzepte und vorgegebene Gesprächsbeispiele ansehen. Ein echtes Browser-Testgespräch und die Telefonaktivierung folgen erst nach erfolgreicher technischer Prüfung.'],
      ['Was kostet ein Voice Agent?', 'Für die neue Produktfamilie sind noch keine Tarife freigegeben. Die vorhandenen Governance-Pläne sind ein separates Angebot und aktivieren das neue Studio nicht automatisch.'],
      ['Was passiert mit sensiblen Anliegen?', 'Der geplante Ablauf begrenzt die erfassten Daten und Aufgaben. Medizinische Entscheidungen, individuelle Rechtsberatung und unberechtigte Änderungen gehören nicht zu den vorgesehenen Aufgaben.'],
      ['Kann ich meine Geschäftsnummer behalten?', 'Eine Weiterleitung oder Rufnummernübernahme wird erst nach Prüfung von Anbieter, Verfügbarkeit und erforderlichen Nachweisen angeboten. Eine Aktivierung ist hier noch nicht möglich.'],
    ].map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
    <section className="vs-closing"><p className="vs-eyebrow">DER ERSTE SCHRITT</p><h2>Was soll dein Telefonassistent<br />für dich übernehmen?</h2><Action to={`${ROOT}/branchen`}>Passende Branche entdecken</Action></section>
  </>;
}

function IndustriesPage() {
  return <><PageMeta title="Voice Agents nach Branche | RealSync Dynamics AI" description="Zehn Branchenkonzepte für KI-Telefonassistenten: Aufgaben, Wissensbedarf und Grenzen. Die produktive Freischaltung ist noch in Vorbereitung." /><Intro eyebrow="ZEHN BRANCHEN. EIN STUDIO." title="Für deinen Arbeitsalltag gedacht.">Entdecke, welche Aufgaben dein Assistent künftig übernehmen soll und wo dein Team die Verantwortung behält. Alle Vorlagen sind in Vorbereitung.</Intro><IndustryCards /></>;
}

function MissingPage() {
  return <><PageMeta title="Seite nicht gefunden | RealSync Dynamics AI" description="Diese Seite ist im Voice Agent Studio nicht vorhanden." /><Intro eyebrow="SEITE NICHT GEFUNDEN" title="Hier gibt es noch keinen Eintrag.">Wähle eine der verfügbaren Branchenbeschreibungen.</Intro><Action to={`${ROOT}/branchen`}>Zur Branchenübersicht</Action></>;
}

function IndustryPage() {
  const { slug } = useParams();
  const industry = findVoiceIndustry(slug);
  if (!industry) return <MissingPage />;
  return <>
    <PageMeta title={`Voice Agent für ${industry.name} | RealSync Dynamics AI`} description={industry.description} />
    <Link className="vs-back" to={`${ROOT}/branchen`}>Branchen / {industry.name}</Link>
    <Intro eyebrow={`${industry.name.toLocaleUpperCase('de-DE')} · IN VORBEREITUNG`} title={industry.headline}>{industry.description}</Intro>
    <div className="vs-split"><div><h2>Vorgesehene Aufgaben</h2><ul className="vs-checklist">{industry.tasks.map((task) => <li key={task}><Check size={18} aria-hidden />{task}</li>)}</ul><h3>Dieses Wissen braucht der Assistent</h3><ul className="vs-plain-list">{industry.knowledge.map((item) => <li key={item}>{item}</li>)}</ul><h3>Geplante Verbindung</h3><p>{industry.integration}</p><div className="vs-note"><strong>Grenzen dieser Vorlage</strong><p>{industry.boundary}</p></div><Action to={`${ROOT}/start?branche=${industry.slug}`}>Einrichtung kennenlernen</Action></div><ConversationExample key={industry.slug} industry={industry} /></div>
  </>;
}

function DemoPage() {
  const [search, setSearch] = useSearchParams();
  const requested = search.get('branche');
  const industry = findVoiceIndustry(requested) ?? VOICE_INDUSTRIES[0];
  return <>
    <PageMeta title="Voice-Gesprächsbeispiele | RealSync Dynamics AI" description="Erkunde vorgegebene Gesprächsabläufe für verschiedene Branchen. Kein Live-Anruf, keine Mikrofonaufnahme und keine Speicherung von Gesprächsdaten." />
    <Intro eyebrow="INTERAKTIVES GESPRÄCHSBEISPIEL" title="So soll sich gute Anrufannahme anfühlen.">Wechsle die Branche und die Situation. Die Texte sind illustrative Beispiele. Ein echtes Gespräch mit deinem eigenen Agenten ist noch nicht verfügbar.</Intro>
    <div className="vs-split"><div><label className="vs-label" htmlFor="voice-industry">Branche</label><select id="voice-industry" value={industry.slug} onChange={(event) => setSearch({ branche: event.target.value }, { replace: true })}>{VOICE_INDUSTRIES.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select>
      {requested && !findVoiceIndustry(requested) && <p role="status">Die angefragte Branche ist unbekannt. Gezeigt wird Handwerk.</p>}
      <div className="vs-note"><strong>Was du hier testen kannst</strong><p>Anfrage, fehlendes Wissen und Übergabe als vorgegebene Dialoge vergleichen. Es werden kein Mikrofon, kein Anbieter und keine Telefonleitung verwendet.</p></div>
      <h2>Im späteren Testlabor</h2><p>Ein echter Sprachtest soll Transkript, erlaubte Aktionen, Ergebnisse und gemessenen Verbrauch zeigen. Er wird erst mit geprüfter Laufzeit und aktivem Budget angeboten.</p><Action to={`${ROOT}/branchen/${industry.slug}`} secondary>Branche im Detail</Action></div><ConversationExample key={industry.slug} industry={industry} /></div>
  </>;
}

function PricingPage() {
  return <>
    <PageMeta title="Voice-Angebote in Vorbereitung | RealSync Dynamics AI" description="Die geplante Voice-Produktfamilie mit Voraussetzungen und Abrechnungsmodell. Preise und Kontingente werden vor einer Buchung verbindlich freigegeben." />
    <Intro eyebrow="ANGEBOTE IN VORBEREITUNG" title="Ein passender Umfang. Klare Kosten.">Für das Voice Agent Studio sind noch keine Preise oder Kontingente freigegeben. Die folgenden Produkte beschreiben den geplanten Leistungsumfang und sind noch nicht buchbar.</Intro>
    <div className="vs-offers">{VOICE_PRODUCT_CONCEPTS.map((product) => <article key={product.name}><span className="vs-meta">PRODUKTKONZEPT</span><h2>{product.name}</h2><p>{product.purpose}</p><div className="vs-offer-requirement">{product.requirement}</div><strong>Tarif in Vorbereitung</strong></article>)}</div>
    <section className="vs-section vs-split"><div><h2>Vor deiner Buchung sichtbar</h2><ul className="vs-checklist">{['Grundgebühr und eventuelle Einrichtung', 'Enthaltene Minuten und Zusatzverbrauch', 'Budgetgrenze und Verhalten am Limit', 'Laufzeit, Kündigung und Zahlungsbedingungen'].map((item) => <li key={item}><Check size={18} aria-hidden />{item}</li>)}</ul></div><div><h2>Bereits bestehende Plattformtarife</h2><p>Die Governance-Pläne findest du auf der zentralen Preisseite. Ein bestehender Tarif ersetzt die noch ausstehenden Aktivierungsprüfungen des neuen Voice Studios nicht.</p><Action to="/pricing" secondary>Plattformtarife ansehen</Action></div></section>
  </>;
}

function StartPage() {
  const [search] = useSearchParams();
  const industry = findVoiceIndustry(search.get('branche'));
  return <>
    <PageMeta title="Voice Agent einrichten – Vorschau | RealSync Dynamics AI" description="Der geplante Einrichtungsweg für deinen KI-Telefonassistenten. Der vollständige Wizard und die Aktivierung sind noch in Vorbereitung." />
    <Intro eyebrow="DER GEPLANTE EINRICHTUNGSWEG" title={industry ? `Dein Voice Agent für ${industry.name}.` : 'Von deinem Betrieb zum Telefonassistenten.'}>Das Studio ist in Vorbereitung. Hier siehst du den geplanten Ablauf. Es wird noch keine Konfiguration gespeichert und keine Telefonie aktiviert.</Intro>
    <div className="vs-split"><ol className="vs-onboarding">{VOICE_ONBOARDING_STEPS.map((step, index) => <li key={step}><span className="vs-meta">{String(index + 1).padStart(2, '0')}</span><span>{step}</span><span className="vs-meta">GEPLANT</span></li>)}</ol><div className="vs-start-panel"><Phone size={30} aria-hidden /><h2>Was heute möglich ist</h2><p>Der bestehende Bot-Builder bietet einen Einstieg in Bot-Konfigurationen. Er ist noch kein vollständiges Voice Studio. Branchenwahl und Beispiele von dieser Seite werden nicht automatisch übernommen.</p><Action to="/app/bots">Bestehenden Bot-Builder öffnen</Action><p className="vs-caption">Anmeldung über dein vorhandenes RealSync-Konto. Die Telefonie benötigt zusätzliche Einrichtung und Prüfung.</p><Link className="vs-text-link" to={`${ROOT}/branchen`}>Andere Branche ansehen <ChevronRight size={16} aria-hidden /></Link></div></div>
  </>;
}

/** Phase 1: public pages only. No new identity, tenant, provider or billing path. */
export function VoiceAgentStudioPage() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current !== pathname) {
      mainRef.current?.focus();
      window.scrollTo({ top: 0, behavior: 'instant' });
      previousPath.current = pathname;
    }
  }, [pathname]);
  return <div className="voice-studio">
    <a className="vs-skip" href="#voice-studio-content">Zum Inhalt</a>
    <header className="vs-header"><Link className="vs-brand" to="/" aria-label="RealSync Dynamics AI Startseite"><span className="vs-brand-symbol" aria-hidden>R</span><span>RealSync<span className="vs-brand-sub">DYNAMICS.AI</span></span></Link><nav aria-label="Voice Agent Studio"><NavLink to={ROOT} end>Studio</NavLink><NavLink to={`${ROOT}/branchen`}>Branchen</NavLink><NavLink to={`${ROOT}/demo`}>Beispiele</NavLink><NavLink to={`${ROOT}/preise`}>Angebote</NavLink></nav><Link className="vs-account" to="/app/bots">Mein Konto <ArrowRight size={16} aria-hidden /></Link></header>
    <div className="vs-release" role="note"><span className="vs-status-dot" aria-hidden /><strong>STUDIO IN ENTWICKLUNG</strong><span>{voiceStatus === 'coming-soon' ? 'Telefonie: geplant.' : 'Telefonie: separate Freigabe erforderlich.'} Hier sind Branchenkonzepte und Gesprächsbeispiele verfügbar.</span></div>
    <main ref={mainRef} id="voice-studio-content" tabIndex={-1} className="vs-main"><Routes><Route index element={<HomePage />} /><Route path="branchen" element={<IndustriesPage />} /><Route path="branchen/:slug" element={<IndustryPage />} /><Route path="demo" element={<DemoPage />} /><Route path="preise" element={<PricingPage />} /><Route path="start" element={<StartPage />} /><Route path="*" element={<MissingPage />} /></Routes></main>
    <footer className="vs-footer"><span>RealSync Voice Agent Studio <span className="vs-meta">/ IN ENTWICKLUNG</span></span><nav aria-label="Rechtliche Informationen"><Link to="/impressum">Impressum</Link><Link to="/datenschutz">Datenschutz</Link><Link to="/contact-sales">Kontakt</Link></nav></footer>
  </div>;
}
