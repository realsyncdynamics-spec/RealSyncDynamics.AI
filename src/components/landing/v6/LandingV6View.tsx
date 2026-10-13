import { Fragment, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { LandingV6Values } from './useLandingV6';

/**
 * Landing v6 — Markup aus dem Claude-Design-Handoff (13.10.2026),
 * 1:1 in JSX übertragen (Inline-Styles wie im Design). Logik, Preise und
 * Ziele der CTAs kommen aus `useLandingV6` — hier nur Darstellung.
 */
export function LandingV6View({ v }: { v: LandingV6Values }) {
  return (
      <div className="lv6" data-rs-theme={v.theme} data-rs-accent={v.accent} data-testid="landing-v6" style={{ backgroundColor: "var(--rs-bg)", color: "var(--rs-fg)", fontFamily: "'Inter',system-ui,sans-serif", fontFeatureSettings: "'ss01','cv11'", transition: "background-color 320ms cubic-bezier(.2,.8,.2,1),color 320ms cubic-bezier(.2,.8,.2,1)" }}>

      {v.showSticky ? (<>
        <div style={{ position: "fixed", top: "0", left: "0", right: "0", zIndex: "40", background: "var(--rs-nav)", backdropFilter: "blur(12px) saturate(140%)", WebkitBackdropFilter: "blur(12px) saturate(140%)", borderBottom: "1px solid var(--rs-line)", animation: "rsIn 200ms cubic-bezier(.2,.8,.2,1)" }}>
          <div style={{ maxWidth: "var(--wrap)", margin: "0 auto", padding: "12px var(--px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px" }}>
            <a href="#top" style={{ fontSize: "clamp(17px,1.1vw,28px)", fontWeight: "500" }}>RealSyncDynamics.AI</a>
            <div style={{ display: "flex", alignItems: "center", gap: "clamp(14px,1.6vw,40px)", fontSize: "var(--fs-body)", whiteSpace: "nowrap" }}>
              {v.showLinks ? (<>
                <a href="#produkt">Plattform</a><a href="#evidence">Evidence</a><a href="#architektur">Sicherheit</a><a href="#preise">Preise</a>
                <Link to={v.href.login} style={{ background: "none", border: "0", padding: "0", color: "var(--rs-fg)", cursor: "pointer", fontSize: "var(--fs-body)" }}>Login</Link>
              </>) : null}
              <Link to={v.href.audit} style={{ whiteSpace: "nowrap", padding: "10px 20px", borderRadius: "6px", border: "1px solid var(--rs-acc)", background: "var(--rs-btn)", color: "#FFFDF6", cursor: "pointer", fontSize: "var(--fs-body)", fontWeight: "500" }}>Kostenlosen Check starten</Link>
            </div>
          </div>
        </div>
      </>) : null}

      <main id="main">
      <section id="top" style={{ position: "relative", minHeight: "100vh", overflowX: "clip", display: "flex", flexDirection: "column", backgroundImage: "radial-gradient(ellipse 50% 60% at 18% 30%,rgba(128,128,128,.07) 0%,transparent 70%)" }}>
        <div aria-hidden="true" className="lv6-map" style={{ position: "absolute", top: "0", right: "0", bottom: "0", width: "min(100%,max(40%,calc(100vh * .66)))", backgroundSize: "cover", backgroundPosition: "left center", WebkitMaskImage: "linear-gradient(90deg,transparent 0%,#000 30%)", maskImage: "linear-gradient(90deg,transparent 0%,#000 30%)", filter: "var(--rs-map-filter) hue-rotate(var(--rs-hue))", mixBlendMode: "var(--rs-map-blend)" as CSSProperties["mixBlendMode"], opacity: v.mapOpacity, pointerEvents: "none" }}></div>

        <div style={{ position: "relative", zIndex: "2", borderBottom: "1px solid var(--rs-line)" }}>
          <div style={{ maxWidth: "var(--wrap)", margin: "0 auto", padding: "10px var(--px)", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "8px 24px", fontFamily: "'JetBrains Mono Optional',monospace", fontSize: "var(--fs-small)", color: "var(--rs-fg3)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px" }}><span>EU-gehostet · Frankfurt (eu-central-1)</span><span>DSGVO · EU AI Act · ISO 27001 · NIS2</span></div>
            {v.beta.active ? (<Link to={v.href.betaRibbon} data-hero-cta="beta" style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0", border: "0", background: "none", color: "var(--rs-fg2)", cursor: "pointer", font: "inherit" }}><span style={{ width: "6px", height: "6px", borderRadius: "9999px", background: "var(--rs-acc)" }}></span>Offene Beta bis {v.beta.endsShort} – alle Funktionen kostenlos<span aria-hidden="true" style={{ color: "var(--rs-acc)" }}>→</span></Link>) : null}
          </div>
        </div>

        <header style={{ position: "relative", zIndex: "2" }}>
          <div style={{ maxWidth: "var(--wrap)", margin: "0 auto", padding: "clamp(18px,1.6vw,44px) var(--px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px" }}>
            <a href="#top" style={{ fontSize: "clamp(19px,1.45vw,44px)", fontWeight: "600", letterSpacing: "-.015em", color: "var(--rs-fg)", whiteSpace: "nowrap" }}>RealSyncDynamics<span style={{ color: "var(--rs-acc)" }}>.AI</span></a>
            <nav aria-label="Hauptnavigation" style={{ display: "flex", alignItems: "center", gap: "clamp(14px,2vw,60px)", whiteSpace: "nowrap", fontSize: "clamp(14px,.95vw,28px)" }}>
              {v.showLinks ? (<>
                <a href="#produkt" style={{ color: "var(--rs-fg2)" }}>Plattform</a>
                <a href="#evidence" style={{ color: "var(--rs-fg2)" }}>Evidence</a>
                <a href="#architektur" style={{ color: "var(--rs-fg2)" }}>Sicherheit</a>
                <a href="#preise" style={{ color: "var(--rs-fg2)" }}>Preise</a>
                <span aria-hidden="true" style={{ width: "1px", height: "20px", background: "var(--rs-line)" }}></span>
                <Link to={v.href.login} style={{ background: "none", border: "0", padding: "0", color: "var(--rs-fg)", cursor: "pointer", fontSize: "inherit" }}>Anmelden</Link>
              </>) : null}
              <button type="button" onClick={v.toggleTheme} aria-label={v.toggleLabel} title={v.toggleLabel} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px", borderRadius: "9999px", border: "1px solid var(--rs-chip-b)", background: "var(--rs-toggle)", cursor: "pointer", color: "var(--rs-fg)" }}>
                <span style={v.sunStyle}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg></span>
                <span style={v.moonStyle}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg></span>
              </button>
              {v.showLinks ? (<>
                <Link to={v.href.audit} style={{ whiteSpace: "nowrap", padding: "clamp(10px,.7vw,20px) clamp(18px,1.3vw,40px)", borderRadius: "6px", background: "var(--rs-btn)", color: "#FFFDF6", border: "1px solid var(--rs-acc)", cursor: "pointer", fontSize: "inherit", fontWeight: "500" }}>Kostenlosen Check starten</Link>
              </>) : null}
              {v.showBurger ? (<>
                <button type="button" onClick={v.toggleMenu} aria-label="Menü öffnen" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "44px", height: "44px", borderRadius: "6px", border: "1px solid var(--rs-chip-b)", background: "var(--rs-toggle)", color: "var(--rs-fg)", cursor: "pointer" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"></path></svg></button>
              </>) : null}
            </nav>
          </div>
        </header>

        <div style={{ position: "relative", zIndex: "1", flex: "1 0 auto", display: "flex", flexDirection: "column", justifyContent: "center", width: "100%", boxSizing: "border-box", maxWidth: "var(--wrap)", margin: "0 auto", padding: "clamp(40px,5vw,160px) var(--px)" }}>
          <div style={{ maxWidth: "min(100%,clamp(320px,58vw,2000px))" }}>
            <p style={{ margin: "0 0 clamp(20px,1.8vw,52px)", fontSize: "var(--fs-kicker)", fontWeight: "600", letterSpacing: ".18em", color: "var(--rs-acc)" }}>AI GOVERNANCE FÜR EUROPÄISCHE UNTERNEHMEN</p>
            <h1 style={{ margin: "0", fontFamily: "'Source Serif 4',Georgia,serif", fontWeight: "400", fontSize: "clamp(40px,5.2vw,176px)", lineHeight: "1.04", letterSpacing: "-.025em", textWrap: "balance" }}>
              <span style={{ background: "var(--rs-h1)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>The Governance OS </span><span style={{ background: "var(--rs-acc-g)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>für DSGVO und EU AI Act.</span>
            </h1>
            <p style={{ margin: "clamp(20px,1.8vw,56px) 0 0", fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "clamp(22px,2vw,68px)", lineHeight: "1.25", letterSpacing: "-.01em", color: "var(--rs-fg)", textWrap: "balance" }}>Website- und KI-Risiken erkennen. Prüffähig nachweisen.</p>
            <p style={{ margin: "clamp(14px,1.2vw,36px) 0 0", maxWidth: "40em", fontSize: "clamp(16px,1.2vw,40px)", lineHeight: "1.6", color: "var(--rs-fg2)", textWrap: "pretty" }}>RealSync prüft Ihre Website und Ihren KI-Einsatz nach DSGVO und EU AI Act – mit Paragraphenbezug, konkreten Maßnahmen und einem Nachweis, den Sie Datenschutzbeauftragten und Prüfern vorlegen können.</p>
            <div style={{ marginTop: "clamp(28px,2.6vw,80px)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
              <Link to={v.href.audit} data-hero-cta="audit" data-testid="hero-primary-cta" style={{ flex: "none", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "10px", minHeight: "clamp(52px,3.4vw,104px)", padding: "0 clamp(22px,1.7vw,52px)", borderRadius: "6px", background: "var(--rs-btn)", border: "1px solid var(--rs-acc)", color: "#FFFDF6", cursor: "pointer", fontSize: "clamp(15px,1.05vw,34px)", fontWeight: "500" }}>Kostenlosen Check starten<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"></path></svg></Link>
              <Link to={v.href.enterprise} data-hero-cta="enterprise" data-testid="hero-secondary-cta" style={{ flex: "none", whiteSpace: "nowrap", display: "flex", alignItems: "center", minHeight: "clamp(52px,3.4vw,104px)", padding: "0 clamp(22px,1.7vw,52px)", borderRadius: "6px", background: "transparent", border: "1px solid var(--rs-chip-b)", color: "var(--rs-fg)", cursor: "pointer", fontSize: "clamp(15px,1.05vw,34px)" }}>Enterprise anfragen</Link>
            </div>
            <p style={{ margin: "16px 0 0", fontSize: "var(--fs-small)", color: "var(--rs-fg3)" }}>Ergebnis in unter 90 Sekunden · ohne Konto · keine Kreditkarte</p>
          </div>
        </div>

        <div style={{ position: "relative", zIndex: "1", borderTop: "1px solid var(--rs-line)", background: "var(--rs-nav)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
          <dl style={{ maxWidth: "var(--wrap)", margin: "0 auto", padding: "0 var(--px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))" }}>
            <div style={{ padding: "clamp(18px,1.4vw,40px) 24px clamp(18px,1.4vw,40px) 0", display: "flex", flexDirection: "column", gap: "6px" }}><dt style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "clamp(24px,1.7vw,56px)", lineHeight: "1" }}>90 s</dt><dd style={{ margin: "0", fontSize: "var(--fs-small)", color: "var(--rs-fg3)" }}>bis zum ersten Befund</dd></div>
            <div style={{ padding: "clamp(18px,1.4vw,40px) 24px clamp(18px,1.4vw,40px) 0", display: "flex", flexDirection: "column", gap: "6px" }}><dt style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "clamp(24px,1.7vw,56px)", lineHeight: "1" }}>Art.-Bezug</dt><dd style={{ margin: "0", fontSize: "var(--fs-small)", color: "var(--rs-fg3)" }}>DSGVO, TTDSG und EU AI Act je Befund</dd></div>
            <div style={{ padding: "clamp(18px,1.4vw,40px) 24px clamp(18px,1.4vw,40px) 0", display: "flex", flexDirection: "column", gap: "6px" }}><dt style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "clamp(24px,1.7vw,56px)", lineHeight: "1" }}>SHA-256</dt><dd style={{ margin: "0", fontSize: "var(--fs-small)", color: "var(--rs-fg3)" }}>verkettete Nachweise im Evidence Vault</dd></div>
            <div style={{ padding: "clamp(18px,1.4vw,40px) 24px clamp(18px,1.4vw,40px) 0", display: "flex", flexDirection: "column", gap: "6px" }}><dt style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "clamp(24px,1.7vw,56px)", lineHeight: "1" }}>EU</dt><dd style={{ margin: "0", fontSize: "var(--fs-small)", color: "var(--rs-fg3)" }}>Datenhaltung in Frankfurt</dd></div>
          </dl>
        </div>
      </section>

      <section aria-label="Unterstützte Regelwerke" style={{ borderTop: "1px solid var(--rs-line)", borderBottom: "1px solid var(--rs-line)", background: "var(--rs-bg2)" }}>
        <div style={{ maxWidth: "var(--wrap)", margin: "0 auto", padding: "clamp(24px,1.6vw,48px) var(--px)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px 40px" }}>
          <span style={{ fontSize: "var(--fs-kicker)", fontWeight: "600", letterSpacing: ".2em", color: "var(--rs-fg3)" }}>SECHS POLICY PACKS · EIN PRÜFPFAD</span>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px clamp(24px,2.4vw,72px)", fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "clamp(18px,1.4vw,40px)", color: "var(--rs-fg2)" }}>
            <span>DSGVO</span><span>EU AI Act</span><span>ISO 27001</span><span>NIS2</span><span style={{ color: "var(--rs-fg3)" }}>TISAX · next</span><span style={{ color: "var(--rs-fg3)" }}>DORA · next</span>
          </div>
        </div>
      </section>

      <section id="regulierung" style={{ backgroundImage: "linear-gradient(var(--rs-grid) 1px,transparent 1px),linear-gradient(90deg,var(--rs-grid) 1px,transparent 1px)", backgroundSize: "32px 32px" }}>
        <div style={{ maxWidth: "var(--wrap)", margin: "0 auto", padding: "var(--sec-y) var(--px)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "40px 80px", alignItems: "end" }}>
            <div>
              <p style={{ margin: "0 0 20px", fontSize: "var(--fs-kicker)", fontWeight: "600", letterSpacing: ".2em", color: "var(--rs-acc)" }}>DER RAHMEN</p>
              <h2 style={{ margin: "0", fontFamily: "'Source Serif 4',Georgia,serif", fontWeight: "400", fontSize: "var(--fs-h2)", lineHeight: "1.08", letterSpacing: "-.02em", textWrap: "balance" }}>Der EU AI Act ist in Kraft. Nachweise sind jetzt Betriebsaufgabe.</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", alignItems: "flex-start" }}>
              <p style={{ margin: "0", fontSize: "var(--fs-lead)", lineHeight: "1.65", color: "var(--rs-fg2)", textWrap: "pretty" }}>Anbieter und Betreiber von KI-Systemen müssen Risiken bewerten, Kontrollen umsetzen und Konformität dokumentieren – fortlaufend, nicht einmalig. Verstöße gegen verbotene Praktiken können mit bis zu 35 Mio. € oder 7 % des weltweiten Jahresumsatzes geahndet werden.</p>
              <button type="button" onClick={v.openClassifier} style={{ display: "inline-flex", alignItems: "center", gap: "10px", padding: "0", background: "none", border: "0", color: "var(--rs-acc)", fontSize: "var(--fs-body)", fontWeight: "600", cursor: "pointer" }}>Eigene Risikoklasse in 3 Minuten prüfen<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"></path></svg></button>
            </div>
          </div>
          <ol style={{ listStyle: "none", margin: "clamp(48px,4.5vw,120px) 0 0", padding: "0", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", borderTop: "1px solid var(--rs-line)" }}>
            <li style={{ padding: "28px 28px 0 0", display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "var(--fs-small)", color: "var(--rs-fg3)" }}>01.08.2024</span>
              <span style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "var(--fs-h3)" }}>Inkrafttreten</span>
              <span style={{ fontSize: "var(--fs-body)", lineHeight: "1.55", color: "var(--rs-fg2)" }}>Verordnung (EU) 2024/1689 im Amtsblatt veröffentlicht.</span>
            </li>
            <li style={{ padding: "28px 28px 0 0", display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "var(--fs-small)", color: "var(--rs-fg3)" }}>02.02.2025</span>
              <span style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "var(--fs-h3)" }}>Verbote & AI Literacy</span>
              <span style={{ fontSize: "var(--fs-body)", lineHeight: "1.55", color: "var(--rs-fg2)" }}>Unzulässige Praktiken untersagt, KI-Kompetenzpflicht gilt.</span>
            </li>
            <li style={{ padding: "28px 28px 0 0", display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "var(--fs-small)", color: "var(--rs-fg3)" }}>02.08.2025</span>
              <span style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "var(--fs-h3)" }}>General-Purpose AI</span>
              <span style={{ fontSize: "var(--fs-body)", lineHeight: "1.55", color: "var(--rs-fg2)" }}>Pflichten für GPAI-Anbieter, Governance-Struktur, Sanktionen.</span>
            </li>
            <li style={{ padding: "28px 28px 0 0", display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "var(--fs-small)", color: "var(--rs-acc)" }}>02.08.2026</span>
              <span style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "var(--fs-h3)" }}>Allgemeine Anwendung</span>
              <span style={{ fontSize: "var(--fs-body)", lineHeight: "1.55", color: "var(--rs-fg2)" }}>Transparenzpflichten und Hochrisiko-Systeme nach Anhang III.</span>
            </li>
          </ol>
        </div>
      </section>

      <section id="produkt" style={{ borderTop: "1px solid var(--rs-line)" }}>
        <div style={{ maxWidth: "var(--wrap)", margin: "0 auto", padding: "var(--sec-y) var(--px)" }}>
          <p style={{ margin: "0 0 20px", fontSize: "var(--fs-kicker)", fontWeight: "600", letterSpacing: ".2em", color: "var(--rs-acc)" }}>DIE PLATTFORM</p>
          <h2 style={{ margin: "0", maxWidth: "22ch", fontFamily: "'Source Serif 4',Georgia,serif", fontWeight: "400", fontSize: "var(--fs-h2)", lineHeight: "1.08", letterSpacing: "-.02em", textWrap: "balance" }}>Eine Runtime. <span style={{ color: "var(--rs-acc)" }}>Kontrollierte KI-Governance.</span></h2>
          <p style={{ margin: "24px 0 0", maxWidth: "60ch", fontSize: "var(--fs-lead)", lineHeight: "1.65", color: "var(--rs-fg2)", textWrap: "pretty" }}>Risiken erkennen. Regeln durchsetzen. Nachweise bereitstellen — in einem durchgängigen Kontrollprozess.</p>
          <div style={{ marginTop: "clamp(48px,4.5vw,120px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: "1px", background: "var(--rs-line)", border: "1px solid var(--rs-line)", borderRadius: "16px", overflow: "hidden" }}>
            {v.stages.map((st, stI) => (<Fragment key={stI}>
              <article style={{ background: "var(--rs-bg)", padding: "var(--card-p)", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "var(--fs-small)", color: "var(--rs-acc)" }}>{st.n} — {st.k}</span>{st.preview ? (<><span style={{ padding: "3px 10px", borderRadius: "9999px", border: "1px solid var(--rs-chip-b)", fontSize: "11px", fontWeight: "600", letterSpacing: ".08em", color: "var(--rs-fg3)" }}>PREVIEW</span></>) : null}</div>
                <h3 style={{ margin: "0", fontFamily: "'Source Serif 4',Georgia,serif", fontWeight: "400", fontSize: "var(--fs-h3)", lineHeight: "1.2" }}>{st.t}</h3>
                <p style={{ margin: "0", fontSize: "var(--fs-body)", lineHeight: "1.6", color: "var(--rs-fg2)" }}>{st.d}</p>
              </article>
            </Fragment>))}
          </div>
          <div style={{ marginTop: "32px", display: "flex", flexWrap: "wrap", gap: "12px" }}>
            <Link to={v.href.audit} style={{ display: "flex", alignItems: "center", minHeight: "clamp(48px,3vw,80px)", padding: "0 clamp(22px,1.6vw,44px)", borderRadius: "8px", border: "1px solid var(--rs-acc)", background: "var(--rs-btn)", color: "#FFFDF6", cursor: "pointer", fontSize: "var(--fs-body)", boxShadow: "0 0 18px var(--rs-glow)" }}>Kostenlosen Check starten</Link>
            <Link to={v.href.enterprise} style={{ display: "flex", alignItems: "center", minHeight: "clamp(48px,3vw,80px)", padding: "0 clamp(22px,1.6vw,44px)", borderRadius: "8px", border: "1px solid var(--rs-chip-b)", background: "var(--rs-chip)", color: "var(--rs-fg)", cursor: "pointer", fontSize: "var(--fs-body)" }}>Enterprise anfragen</Link>
          </div>
        </div>
      </section>


      <section id="agenten" style={{ borderTop: "1px solid var(--rs-line)", backgroundImage: "linear-gradient(var(--rs-grid) 1px,transparent 1px),linear-gradient(90deg,var(--rs-grid) 1px,transparent 1px)", backgroundSize: "32px 32px" }}>
        <div style={{ maxWidth: "var(--wrap)", margin: "0 auto", padding: "var(--sec-y) var(--px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,460px),1fr))", gap: "56px clamp(56px,5vw,160px)", alignItems: "center" }}>
          <div>
            <p style={{ margin: "0 0 20px", fontSize: "var(--fs-kicker)", fontWeight: "600", letterSpacing: ".2em", color: "var(--rs-acc)" }}>AGENT GOVERNANCE</p>
            <h2 style={{ margin: "0", maxWidth: "22ch", fontFamily: "'Source Serif 4',Georgia,serif", fontWeight: "400", fontSize: "var(--fs-h2)", lineHeight: "1.08", letterSpacing: "-.02em", textWrap: "balance" }}>Agenten können ausführen. Sich selbst autorisieren nicht.</h2>
            <p style={{ margin: "24px 0 0", maxWidth: "60ch", fontSize: "var(--fs-lead)", lineHeight: "1.65", color: "var(--rs-fg2)", textWrap: "pretty" }}>Agenten planen, analysieren und handeln. Über ihre Berechtigung entscheidet die Governance-Schicht – serverseitig, nicht der Agent und nicht der Provider.</p>
            <ul style={{ listStyle: "none", margin: "36px 0 0", padding: "0", display: "flex", flexDirection: "column", borderTop: "1px solid var(--rs-line)" }}>
              {v.agentNo.map((a, aI) => (<Fragment key={aI}>
                <li style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px 0", borderBottom: "1px solid var(--rs-line)", fontSize: "var(--fs-body)" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M18 6 6 18M6 6l12 12"></path></svg><span><span style={{ color: "var(--rs-fg3)" }}>Ein Agent kann nicht </span>{a}</span></li>
              </Fragment>))}
            </ul>
          </div>
          <div aria-label="Architektur Agent Governance" style={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}>
            <div style={{ padding: "var(--card-p)", border: "1px solid var(--rs-line)", borderRadius: "16px", background: "var(--rs-bg)", display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "var(--fs-kicker)", fontWeight: "600", letterSpacing: ".2em", color: "var(--rs-fg3)" }}>REQUEST</span>
              <span style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "var(--fs-h3)" }}>AI Agent</span>
            </div>
            <div style={{ width: "1px", height: "32px", marginLeft: "40px", background: "var(--rs-acc)" }}></div>
            <div style={{ padding: "var(--card-p)", border: "2px solid var(--rs-acc)", borderRadius: "16px", background: "var(--rs-bg)", boxShadow: "0 0 28px var(--rs-glow)", display: "flex", flexDirection: "column", gap: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}><span style={{ fontSize: "var(--fs-kicker)", fontWeight: "600", letterSpacing: ".2em", color: "var(--rs-acc)" }}>POLICY AUTHORITY</span><span style={{ padding: "3px 10px", borderRadius: "9999px", border: "1px solid var(--rs-chip-b)", fontSize: "11px", fontWeight: "600", letterSpacing: ".08em", color: "var(--rs-fg3)" }}>PREVIEW</span></div>
              <span style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "var(--fs-h3)" }}>RealSync Governance Layer</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {v.gateChecks.map((g, gI) => (<Fragment key={gI}><span style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid var(--rs-chip-b)", background: "var(--rs-chip)", fontFamily: "'JetBrains Mono',monospace", fontSize: "var(--fs-small)" }}>{g}</span></Fragment>))}
              </div>
            </div>
            <div style={{ width: "1px", height: "32px", marginLeft: "40px", background: "var(--rs-acc)" }}></div>
            <div style={{ padding: "var(--card-p)", border: "1px solid var(--rs-line)", borderRadius: "16px", background: "var(--rs-bg)", display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "var(--fs-kicker)", fontWeight: "600", letterSpacing: ".2em", color: "var(--rs-fg3)" }}>EXECUTION · KEINE POLICY AUTHORITY</span>
              <span style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "var(--fs-h3)" }}>Execution Provider</span>
            </div>
          </div>
        </div>
      </section>

      <section id="control-room" style={{ borderTop: "1px solid var(--rs-line)", background: "var(--rs-bg2)" }}>
        <div style={{ maxWidth: "var(--wrap)", margin: "0 auto", padding: "var(--sec-y) var(--px)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "28px" }}>
            <div>
              <p style={{ margin: "0 0 20px", fontSize: "var(--fs-kicker)", fontWeight: "600", letterSpacing: ".2em", color: "var(--rs-acc)" }}>IHR WORKSPACE</p>
              <h2 style={{ margin: "0", maxWidth: "22ch", fontFamily: "'Source Serif 4',Georgia,serif", fontWeight: "400", fontSize: "var(--fs-h2)", lineHeight: "1.08", letterSpacing: "-.02em", textWrap: "balance" }}>Das bekommen Sie: <span style={{ color: "var(--rs-acc)" }}>Ihr Governance-Dashboard.</span></h2>
              <p style={{ margin: "24px 0 0", maxWidth: "60ch", fontSize: "var(--fs-lead)", lineHeight: "1.65", color: "var(--rs-fg2)", textWrap: "pretty" }}>Nach dem Free Audit läuft Ihre Runtime im Command Center weiter — Rahmenwerk-Reifegrade, offene Findings, Evidence-Chain und der Agent-Intent auf einer Fläche.</p>
            </div>
            <Link to={v.href.dashboard} style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "clamp(48px,3vw,80px)", padding: "0 clamp(22px,1.6vw,44px)", borderRadius: "8px", border: "1px solid var(--rs-chip-b)", background: "var(--rs-chip)", color: "var(--rs-fg)", cursor: "pointer", fontSize: "var(--fs-body)" }}>Zum Command Center<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"></path></svg></Link>
          </div>
          <div style={{ marginTop: "clamp(40px,4vw,96px)", border: "1px solid var(--rs-line)", borderRadius: "16px", background: "var(--rs-bg)", overflow: "hidden" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "12px", padding: "18px var(--card-p)", borderBottom: "1px solid var(--rs-line)" }}><span style={{ fontSize: "var(--fs-body)" }}>Governance Control Room · Workspace „Demo“</span><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "var(--fs-small)", color: "var(--rs-fg3)" }}>Beispielumgebung · Demo-Daten</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: "1px", background: "var(--rs-line)", borderBottom: "1px solid var(--rs-line)" }}>
              {v.crKpis.map((kpi, kpiI) => (<Fragment key={kpiI}>
                <div style={{ background: "var(--rs-bg)", padding: "var(--card-p)", display: "flex", flexDirection: "column", gap: "10px" }}><span style={{ fontSize: "var(--fs-small)", color: "var(--rs-fg3)" }}>{kpi.l}</span><span style={kpi.style}>{kpi.v}</span></div>
              </Fragment>))}
            </div>
            <div style={{ padding: "8px var(--card-p) 12px" }}>
              <div style={{ padding: "14px 0", fontSize: "var(--fs-kicker)", fontWeight: "600", letterSpacing: ".2em", color: "var(--rs-fg3)" }}>LETZTE POLICY-ENTSCHEIDUNGEN</div>
              {v.decisions.map((d, dI) => (<Fragment key={dI}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(80px,auto) minmax(0,1fr) auto", gap: "16px", alignItems: "center", padding: "14px 0", borderTop: "1px solid var(--rs-line)", fontFamily: "'JetBrains Mono',monospace", fontSize: "var(--fs-small)" }}>
                  <span style={{ color: "var(--rs-fg3)" }}>{d.t}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><span style={{ color: "var(--rs-fg)" }}>{d.agent}</span><span style={{ color: "var(--rs-fg3)" }}> · {d.action}</span></span>
                  <span style={d.style}>{d.r}</span>
                </div>
              </Fragment>))}
            </div>
          </div>
          <p style={{ margin: "16px 0 0", fontSize: "var(--fs-small)", color: "var(--rs-fg3)" }}>Beispielwerte zur Veranschaulichung, keine Kundendaten. Ihr eigener Control Room entsteht nach dem Login aus Ihren Systemen.</p>
        </div>
      </section>

      <section id="evidence" style={{ borderTop: "1px solid var(--rs-line)", background: "var(--rs-bg2)" }}>
        <div style={{ maxWidth: "var(--wrap)", margin: "0 auto", padding: "var(--sec-y) var(--px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,460px),1fr))", gap: "56px clamp(56px,5vw,160px)", alignItems: "center" }}>
          <div>
            <p style={{ margin: "0 0 20px", fontSize: "var(--fs-kicker)", fontWeight: "600", letterSpacing: ".2em", color: "var(--rs-acc)" }}>EVIDENCE & TRUST</p>
            <h2 style={{ margin: "0", fontFamily: "'Source Serif 4',Georgia,serif", fontWeight: "400", fontSize: "var(--fs-h2)", lineHeight: "1.08", letterSpacing: "-.02em", textWrap: "balance" }}>Compliance, die sich <span style={{ color: "var(--rs-acc)" }}>beweisen lässt.</span></h2>
            <p style={{ margin: "28px 0 0", maxWidth: "36em", fontSize: "var(--fs-lead)", lineHeight: "1.65", color: "var(--rs-fg2)", textWrap: "pretty" }}>PDFs, Logs, Zeitstempel und nachvollziehbare Prüfpfade. Jede Prüfung, jede Entscheidung und jede Änderung landet in derselben Governance-Historie.</p>
            <ul style={{ listStyle: "none", margin: "36px 0 0", padding: "0", display: "flex", flexDirection: "column", borderTop: "1px solid var(--rs-line)" }}>
              <li style={{ display: "flex", justifyContent: "space-between", gap: "20px", padding: "16px 0", borderBottom: "1px solid var(--rs-line)", fontSize: "var(--fs-body)" }}><span>Technische Dokumentation</span><span style={{ color: "var(--rs-fg3)" }}>Anhang IV</span></li>
              <li style={{ display: "flex", justifyContent: "space-between", gap: "20px", padding: "16px 0", borderBottom: "1px solid var(--rs-line)", fontSize: "var(--fs-body)" }}><span>Automatische Protokollierung</span><span style={{ color: "var(--rs-fg3)" }}>Art. 12</span></li>
              <li style={{ display: "flex", justifyContent: "space-between", gap: "20px", padding: "16px 0", borderBottom: "1px solid var(--rs-line)", fontSize: "var(--fs-body)" }}><span>Menschliche Aufsicht</span><span style={{ color: "var(--rs-fg3)" }}>Art. 14</span></li>
              <li style={{ display: "flex", justifyContent: "space-between", gap: "20px", padding: "16px 0", borderBottom: "1px solid var(--rs-line)", fontSize: "var(--fs-body)" }}><span>Verzeichnis von Verarbeitungstätigkeiten</span><span style={{ color: "var(--rs-fg3)" }}>Art. 30 DSGVO</span></li>
            </ul>
            <Link to={v.href.dashboard} style={{ marginTop: "28px", display: "inline-flex", alignItems: "center", gap: "10px", padding: "0", background: "none", border: "0", color: "var(--rs-acc)", fontSize: "var(--fs-body)", fontWeight: "600", cursor: "pointer" }}>Im Dashboard ansehen<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"></path></svg></Link>
          </div>
          <div aria-label="Beispiel Hash-Chain" style={{ display: "flex", flexDirection: "column", fontFamily: "'JetBrains Mono',monospace", fontSize: "var(--fs-small)" }}>
            {v.chain.map((b, bI) => (<Fragment key={bI}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}>
                <div style={b.cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", color: "var(--rs-fg3)" }}><span>BLOCK #{b.n}</span><span>{b.time}</span></div>
                  <div style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "clamp(18px,1.2vw,34px)", color: "var(--rs-fg)" }}>{b.event}</div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", color: "var(--rs-fg2)" }}><span style={{ color: "var(--rs-fg3)" }}>hash</span><span>{b.hash}</span></div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", color: "var(--rs-fg2)" }}><span style={{ color: "var(--rs-fg3)" }}>prev</span><span>{b.prev}</span></div>
                </div>
                {b.link ? (<><div style={{ width: "1px", height: "24px", marginLeft: "32px", background: "var(--rs-acc)" }}></div></>) : null}
              </div>
            </Fragment>))}
          </div>
        </div>
      </section>

      <section id="architektur" style={{ borderTop: "1px solid var(--rs-line)" }}>
        <div style={{ maxWidth: "var(--wrap)", margin: "0 auto", padding: "var(--sec-y) var(--px)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "40px 80px", alignItems: "end" }}>
            <div>
              <p style={{ margin: "0 0 20px", fontSize: "var(--fs-kicker)", fontWeight: "600", letterSpacing: ".2em", color: "var(--rs-acc)" }}>EU-NATIVE BY DESIGN</p>
              <h2 style={{ margin: "0", fontFamily: "'Source Serif 4',Georgia,serif", fontWeight: "400", fontSize: "var(--fs-h2)", lineHeight: "1.08", letterSpacing: "-.02em", textWrap: "balance" }}>Datenhaltung in Europa. Nachvollziehbar dokumentiert.</h2>
            </div>
            <p style={{ margin: "0", fontSize: "var(--fs-lead)", lineHeight: "1.65", color: "var(--rs-fg2)", textWrap: "pretty" }}>Datenbank und Evidence Vault liegen in der EU – Supabase in Frankfurt am Main. Welche KI-Anbieter Daten erhalten, legen Sie per Policy fest; alle Sub-Prozessoren sind offen gelistet, mit Auftragsverarbeitungsvertrag nach Art. 28 DSGVO.</p>
          </div>
          <dl style={{ margin: "clamp(48px,4.5vw,120px) 0 0", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: "16px" }}>
            <div style={{ padding: "var(--card-p)", border: "1px solid var(--rs-line)", borderRadius: "16px", background: "var(--rs-surface)", display: "flex", flexDirection: "column", gap: "10px" }}>
              <dt style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "var(--fs-h3)" }}>EU-Datenhaltung</dt>
              <dd style={{ margin: "0", fontSize: "var(--fs-body)", lineHeight: "1.6", color: "var(--rs-fg2)" }}>Policy-Entscheidungen, Prüfpfade und Nachweise werden in der EU gespeichert.</dd>
            </div>
            <div style={{ padding: "var(--card-p)", border: "1px solid var(--rs-line)", borderRadius: "16px", background: "var(--rs-surface)", display: "flex", flexDirection: "column", gap: "10px" }}>
              <dt style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "var(--fs-h3)" }}>Supabase Frankfurt</dt>
              <dd style={{ margin: "0", fontSize: "var(--fs-body)", lineHeight: "1.6", color: "var(--rs-fg2)" }}>Postgres in eu-central-1, verschlüsselt at rest und in transit.</dd>
            </div>
            <div style={{ padding: "var(--card-p)", border: "1px solid var(--rs-line)", borderRadius: "16px", background: "var(--rs-surface)", display: "flex", flexDirection: "column", gap: "10px" }}>
              <dt style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "var(--fs-h3)" }}>Multi-Tenant RLS</dt>
              <dd style={{ margin: "0", fontSize: "var(--fs-body)", lineHeight: "1.6", color: "var(--rs-fg2)" }}>Mandantentrennung auf Datenbankebene per Row-Level Security.</dd>
            </div>
            <div style={{ padding: "var(--card-p)", border: "1px solid var(--rs-line)", borderRadius: "16px", background: "var(--rs-surface)", display: "flex", flexDirection: "column", gap: "10px" }}>
              <dt style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "var(--fs-h3)" }}>Lokale Modelle · optional</dt>
              <dd style={{ margin: "0", fontSize: "var(--fs-body)", lineHeight: "1.6", color: "var(--rs-fg2)" }}>Klassifizierung mit selbst betriebenen Open-Weight-Modellen (Ollama) – auf Anfrage.</dd>
            </div>
            <div style={{ padding: "var(--card-p)", border: "1px solid var(--rs-line)", borderRadius: "16px", background: "var(--rs-surface)", display: "flex", flexDirection: "column", gap: "10px" }}>
              <dt style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "var(--fs-h3)" }}>n8n · Preview</dt>
              <dd style={{ margin: "0", fontSize: "var(--fs-body)", lineHeight: "1.6", color: "var(--rs-fg2)" }}>Webhook-Anbindung für Freigaben und Eskalationen – noch keine produktive Ausführung.</dd>
            </div>
            <div style={{ padding: "var(--card-p)", border: "1px solid var(--rs-line)", borderRadius: "16px", background: "var(--rs-surface)", display: "flex", flexDirection: "column", gap: "10px" }}>
              <dt style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "var(--fs-h3)" }}>Stripe Billing</dt>
              <dd style={{ margin: "0", fontSize: "var(--fs-body)", lineHeight: "1.6", color: "var(--rs-fg2)" }}>Abrechnung in Euro per Karte oder SEPA-Lastschrift – während der Beta ohne Zahlung.</dd>
            </div>
          </dl>
        </div>
      </section>

      <section id="check" style={{ borderTop: "1px solid var(--rs-line)" }}>
        <div style={{ maxWidth: "var(--wrap)", margin: "0 auto", padding: "var(--sec-y) var(--px)" }}>
          <p style={{ margin: "0 0 20px", fontSize: "var(--fs-kicker)", fontWeight: "600", letterSpacing: ".2em", color: "var(--rs-acc)" }}>GOVERNANCE-CHECK · ACHT FRAGEN</p>
          <h2 style={{ margin: "0", maxWidth: "24ch", fontFamily: "'Source Serif 4',Georgia,serif", fontWeight: "400", fontSize: "var(--fs-h2)", lineHeight: "1.08", letterSpacing: "-.02em", textWrap: "balance" }}>Wo steht Ihre KI-Governance? Eine ehrliche Selbsteinschätzung.</h2>
          <p style={{ margin: "24px 0 0", maxWidth: "60ch", fontSize: "var(--fs-lead)", lineHeight: "1.65", color: "var(--rs-fg2)", textWrap: "pretty" }}>Kein automatischer Scan: Das Ergebnis beruht ausschließlich auf Ihren Antworten. Nichts wird gespeichert oder übertragen.</p>
          <div style={{ marginTop: "clamp(40px,4vw,96px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "32px clamp(40px,4vw,120px)", alignItems: "start" }}>
            <ol style={{ listStyle: "none", margin: "0", padding: "0", display: "flex", flexDirection: "column", borderTop: "1px solid var(--rs-line)" }}>
              {v.checkQs.map((q, qI) => (<Fragment key={qI}>
                <li style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "14px 24px", padding: "18px 0", borderBottom: "1px solid var(--rs-line)" }}>
                  <div style={{ display: "flex", gap: "16px", flex: "1 1 280px", minWidth: "0" }}><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "var(--fs-small)", color: "var(--rs-acc)", paddingTop: "3px" }}>{q.n}</span><span style={{ fontSize: "var(--fs-body)", lineHeight: "1.5" }}>{q.q}</span></div>
                  <div role="radiogroup" aria-label={q.q} style={{ display: "flex", gap: "6px" }}>
                    {q.opts.map((o, oI) => (<Fragment key={oI}><button type="button" role="radio" aria-checked={o.on} onClick={o.pick} style={o.style}>{o.l}</button></Fragment>))}
                  </div>
                </li>
              </Fragment>))}
            </ol>
            <aside style={{ position: "sticky", top: "120px", padding: "var(--card-p)", border: "1px solid var(--rs-line)", borderRadius: "16px", background: "var(--rs-bg2)", display: "flex", flexDirection: "column", gap: "18px" }}>
              <span style={{ fontSize: "var(--fs-kicker)", fontWeight: "600", letterSpacing: ".2em", color: "var(--rs-fg3)" }}>IHR ERGEBNIS</span>
              {v.checkEmpty ? (<>
                <p style={{ margin: "0", fontSize: "var(--fs-body)", lineHeight: "1.6", color: "var(--rs-fg2)" }}>Beantworten Sie die Fragen – das Ergebnis erscheint hier.</p>
              </>) : null}
              {v.checkHas ? (<>
                <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}><span style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "clamp(56px,4vw,120px)", lineHeight: "1", color: "var(--rs-acc)" }}>{v.checkScore}</span><span style={{ fontSize: "var(--fs-body)", color: "var(--rs-fg3)" }}>/ 8 geregelt · {v.checkAnswered} von 8 beantwortet</span></div>
                <div style={{ height: "6px", borderRadius: "9999px", background: "var(--rs-line)", overflow: "hidden" }}><div style={v.checkBar}></div></div>
                <h3 style={{ margin: "0", fontFamily: "'Source Serif 4',Georgia,serif", fontWeight: "400", fontSize: "var(--fs-h3)" }}>{v.checkLevel}</h3>
                <p style={{ margin: "0", fontSize: "var(--fs-body)", lineHeight: "1.6", color: "var(--rs-fg2)" }}>{v.checkText}</p>
              </>) : null}
              <p style={{ margin: "0", fontSize: "var(--fs-small)", lineHeight: "1.55", color: "var(--rs-fg3)" }}>Nächster Schritt: den kostenlosen Website-Check starten oder offene Punkte für Ihr Unternehmen klären.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                <Link to={v.href.audit} style={{ display: "flex", alignItems: "center", minHeight: "48px", padding: "0 22px", borderRadius: "8px", border: "1px solid var(--rs-acc)", background: "var(--rs-btn)", color: "#FFFDF6", cursor: "pointer", fontSize: "var(--fs-body)", boxShadow: "0 0 18px var(--rs-glow)" }}>Governance-Scan starten</Link>
                <Link to={v.href.enterprise} style={{ display: "flex", alignItems: "center", minHeight: "48px", padding: "0 22px", borderRadius: "8px", border: "1px solid var(--rs-chip-b)", background: "var(--rs-chip)", color: "var(--rs-fg)", cursor: "pointer", fontSize: "var(--fs-body)" }}>Enterprise anfragen</Link>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section id="preise" style={{ borderTop: "1px solid var(--rs-line)", background: "var(--rs-bg2)" }}>
        <div style={{ maxWidth: "var(--wrap)", margin: "0 auto", padding: "var(--sec-y) var(--px)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "28px" }}>
            <div>
              <p style={{ margin: "0 0 20px", fontSize: "var(--fs-kicker)", fontWeight: "600", letterSpacing: ".2em", color: "var(--rs-acc)" }}>PREISE</p>
              <h2 style={{ margin: "0", maxWidth: "18ch", fontFamily: "'Source Serif 4',Georgia,serif", fontWeight: "400", fontSize: "var(--fs-h2)", lineHeight: "1.08", letterSpacing: "-.02em", textWrap: "balance" }}>Pläne für die <span style={{ color: "var(--rs-acc)" }}>Governance Runtime.</span></h2>
            </div>
            {v.yearlyEnabled ? (<div role="radiogroup" aria-label="Abrechnungszeitraum" style={{ display: "flex", padding: "4px", borderRadius: "9999px", border: "1px solid var(--rs-chip-b)", background: "var(--rs-chip)" }}>
              <button type="button" onClick={v.setMonthly} style={v.cycleMonthlyStyle}>Monatlich</button>
              <button type="button" onClick={v.setYearly} style={v.cycleYearlyStyle}>Jährlich · 2 Monate gratis</button>
            </div>) : (<p data-testid="pricing-yearly-disabled" style={{ margin: "0", fontSize: "var(--fs-small)", color: "var(--rs-fg3)" }}>Monatlich · Jährlich demnächst</p>)}
          </div>
          <div style={{ marginTop: "clamp(48px,4.5vw,120px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,250px),1fr))", gap: "16px", alignItems: "stretch" }}>
            {v.plans.map((p, pI) => (<Fragment key={pI}>
              <article style={p.cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                  <h3 style={{ margin: "0", fontFamily: "'Source Serif 4',Georgia,serif", fontWeight: "400", fontSize: "var(--fs-h3)" }}>{p.name}</h3>
                  {p.featured ? (<><span style={{ padding: "4px 10px", borderRadius: "9999px", background: "var(--rs-acc-soft)", color: "var(--rs-acc)", fontSize: "11px", fontWeight: "600", letterSpacing: ".08em" }}>EMPFOHLEN</span></>) : null}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", flexWrap: "wrap" }}>{p.listPrice ? (<s style={{ fontSize: "var(--fs-body)", color: "var(--rs-fg3)" }}>{p.listPrice}</s>) : null}<span style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "clamp(40px,2.6vw,80px)", lineHeight: "1" }}>{p.priceLabel}</span><span style={{ fontSize: "var(--fs-small)", color: "var(--rs-fg3)" }}>{p.unit}</span></div>
                <p style={{ margin: "-8px 0 0", minHeight: "1.4em", fontSize: "var(--fs-small)", color: "var(--rs-acc)" }}>{p.billingNote}</p>
                <p style={{ margin: "0", fontSize: "var(--fs-body)", lineHeight: "1.55", color: "var(--rs-fg2)" }}>{p.desc}</p>
                <ul style={{ listStyle: "none", margin: "0", padding: "16px 0 0", borderTop: "1px solid var(--rs-line)", display: "flex", flexDirection: "column", gap: "10px", fontSize: "var(--fs-small)", color: "var(--rs-fg2)", flex: "1" }}>
                  {p.features.map((f, fI) => (<Fragment key={fI}><li style={{ display: "flex", gap: "10px" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: "2px", color: "var(--rs-acc)" }}><path d="M20 6 9 17l-5-5"></path></svg><span>{f}</span></li></Fragment>))}
                </ul>
                <Link to={p.href} data-plan-cta={p.id} style={p.btnStyle}>{p.cta}</Link>
              </article>
            </Fragment>))}
          </div>
          <p style={{ margin: "24px 0 0", fontSize: "var(--fs-small)", color: "var(--rs-fg3)" }}>{v.pricingFoot} Vollständige Feature-Matrix unter <Link to="/pricing" style={{ color: "var(--rs-acc)" }}>/pricing</Link>.</p>
        </div>
      </section>

      <section id="faq" style={{ borderTop: "1px solid var(--rs-line)" }}>
        <div style={{ maxWidth: "var(--wrap)", margin: "0 auto", padding: "var(--sec-y) var(--px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,380px),1fr))", gap: "40px 80px" }}>
          <div>
            <p style={{ margin: "0 0 20px", fontSize: "var(--fs-kicker)", fontWeight: "600", letterSpacing: ".2em", color: "var(--rs-acc)" }}>HÄUFIGE FRAGEN</p>
            <h2 style={{ margin: "0", fontFamily: "'Source Serif 4',Georgia,serif", fontWeight: "400", fontSize: "var(--fs-h2)", lineHeight: "1.08", letterSpacing: "-.02em" }}>Governance-Fragen, klar beantwortet.</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid var(--rs-line)" }}>
            <details style={{ borderBottom: "1px solid var(--rs-line)", padding: "22px 0" }}>
              <summary style={{ listStyle: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", gap: "20px", fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "var(--fs-h3)" }}>Wo werden unsere Daten verarbeitet?<span style={{ color: "var(--rs-acc)" }}>+</span></summary>
              <p style={{ margin: "14px 0 0", fontSize: "var(--fs-body)", lineHeight: "1.65", color: "var(--rs-fg2)" }}>Datenbank und Nachweise liegen in der EU (Supabase, Frankfurt am Main). Welche KI-Anbieter eingebunden werden, legen Sie per Policy fest – alle Sub-Prozessoren sind unter <Link to="/legal/sub-processors" style={{ color: "var(--rs-acc)" }}>Sub-Prozessoren</Link> gelistet.</p>
            </details>
            <details style={{ borderBottom: "1px solid var(--rs-line)", padding: "22px 0" }}>
              <summary style={{ listStyle: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", gap: "20px", fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "var(--fs-h3)" }}>Welche Regelwerke deckt die Plattform ab?<span style={{ color: "var(--rs-acc)" }}>+</span></summary>
              <p style={{ margin: "14px 0 0", fontSize: "var(--fs-body)", lineHeight: "1.65", color: "var(--rs-fg2)" }}>DSGVO, EU AI Act, ISO 27001 und NIS2 als Policy Packs. TISAX und DORA stehen auf der Roadmap.</p>
            </details>
            <details style={{ borderBottom: "1px solid var(--rs-line)", padding: "22px 0" }}>
              <summary style={{ listStyle: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", gap: "20px", fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "var(--fs-h3)" }}>Was umfasst das Free Audit?<span style={{ color: "var(--rs-acc)" }}>+</span></summary>
              <p style={{ margin: "14px 0 0", fontSize: "var(--fs-body)", lineHeight: "1.65", color: "var(--rs-fg2)" }}>Ein kostenloser Check Ihrer Website: Cookies, Tracker und KI-Einbindung werden erfasst, Risiken mit Paragraphenbezug (DSGVO, TTDSG, EU AI Act) benannt und konkrete Hinweise gegeben – Ergebnis in unter 90 Sekunden.</p>
            </details>
            <details style={{ borderBottom: "1px solid var(--rs-line)", padding: "22px 0" }}>
              <summary style={{ listStyle: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", gap: "20px", fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "var(--fs-h3)" }}>Kann ich monatlich kündigen?<span style={{ color: "var(--rs-acc)" }}>+</span></summary>
              <p style={{ margin: "14px 0 0", fontSize: "var(--fs-body)", lineHeight: "1.65", color: "var(--rs-fg2)" }}>{v.faqCancel}</p>
            </details>
          </div>
        </div>
      </section>

      <section id="audit" style={{ position: "relative", overflow: "hidden", borderTop: "1px solid var(--rs-line)", backgroundImage: "radial-gradient(ellipse 40% 80% at 50% 0%,var(--rs-acc-soft) 0%,transparent 100%)" }}>
        <div style={{ maxWidth: "min(100%,clamp(900px,56vw,1800px))", margin: "0 auto", padding: "var(--sec-y) var(--px)", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "28px" }}>
          <p style={{ margin: "0", fontSize: "var(--fs-kicker)", fontWeight: "600", letterSpacing: ".2em", color: "var(--rs-acc)" }}>ONE GOVERNANCE PLANE</p>
          <h2 style={{ margin: "0", fontFamily: "'Source Serif 4',Georgia,serif", fontWeight: "400", fontSize: "clamp(38px,4.6vw,150px)", lineHeight: "1.05", letterSpacing: "-.02em", textWrap: "balance" }}><span style={{ background: "var(--rs-h1)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Governance statt </span><span style={{ background: "var(--rs-acc-g)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Checkliste.</span></h2>
          <p style={{ margin: "0", maxWidth: "34em", fontSize: "var(--fs-lead)", lineHeight: "1.6", color: "var(--rs-fg2)" }}>Compliance statt Selbstauskunft. Evidence statt Behauptung. Enforcement statt Empfehlung.</p>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "14px" }}>
            <Link to={v.href.audit} style={{ display: "flex", alignItems: "center", gap: "12px", minHeight: "clamp(52px,3.2vw,88px)", padding: "0 clamp(24px,1.6vw,48px)", borderRadius: "9999px", border: "0", background: "var(--rs-btn)", color: "#FFFDF6", cursor: "pointer", fontSize: "var(--fs-lead)", boxShadow: "0 0 22px var(--rs-glow),inset 0 1px 0 rgba(255,255,255,.35)" }}>Free Audit starten<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"></path></svg></Link>
            <button type="button" onClick={v.goPricing} style={{ display: "flex", alignItems: "center", minHeight: "clamp(52px,3.2vw,88px)", padding: "0 clamp(24px,1.6vw,48px)", borderRadius: "9999px", border: "1px solid var(--rs-chip-b)", background: "var(--rs-chip)", color: "var(--rs-fg)", cursor: "pointer", fontSize: "var(--fs-lead)" }}>Preise ansehen</button>
          </div>
        </div>
      </section>

      </main>

      <footer style={{ borderTop: "1px solid var(--rs-line)", background: "var(--rs-bg2)" }}>
        <div style={{ maxWidth: "var(--wrap)", margin: "0 auto", padding: "56px var(--px) 40px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: "40px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <span style={{ fontSize: "clamp(20px,1.2vw,34px)", fontWeight: "500" }}>RealSyncDynamics.AI</span>
            <span style={{ fontSize: "var(--fs-small)", lineHeight: "1.6", color: "var(--rs-fg3)" }}>Datenhaltung in der EU (Supabase, eu-central-1 · Frankfurt). Unterstützt DSGVO- und EU-AI-Act-Kontrollen — die rechtliche Bewertung bleibt beim Anwender.</span>
          </div>
          <nav aria-label="Produkt" style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "var(--fs-small)", color: "var(--rs-fg2)" }}>
            <span style={{ fontSize: "12px", fontWeight: "600", letterSpacing: ".16em", color: "var(--rs-fg3)" }}>PRODUKT</span>
            <a href="#produkt">Plattform</a><a href="#agenten">Agent Governance</a><a href="#control-room">Control Room</a><a href="#check">Governance-Check</a><a href="#evidence">Evidence Vault</a><a href="#preise">Preise</a><Link to="/roadmap">Roadmap</Link>
          </nav>
          <nav aria-label="Governance" style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "var(--fs-small)", color: "var(--rs-fg2)" }}>
            <span style={{ fontSize: "12px", fontWeight: "600", letterSpacing: ".16em", color: "var(--rs-fg3)" }}>GOVERNANCE</span>
            <Link to="/governance-runtime">Governance Runtime</Link><Link to="/agent-governance">Agent Governance</Link><Link to="/legal/sub-processors">Sub-Prozessoren</Link><Link to="/contact-sales?intent=enterprise">Enterprise anfragen</Link>
          </nav>
          <nav aria-label="Rechtliches" style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "var(--fs-small)", color: "var(--rs-fg2)" }}>
            <span style={{ fontSize: "12px", fontWeight: "600", letterSpacing: ".16em", color: "var(--rs-fg3)" }}>RECHTLICHES</span>
            <Link to="/impressum">Impressum</Link><Link to="/datenschutz">Datenschutz</Link><Link to="/agb">AGB</Link><Link to="/legal/widerruf">Widerruf</Link><Link to="/kontakt">Kontakt</Link>
          </nav>
        </div>
        <div style={{ maxWidth: "var(--wrap)", margin: "0 auto", padding: "20px var(--px) 32px", borderTop: "1px solid var(--rs-line)", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "12px", fontSize: "var(--fs-small)", color: "var(--rs-fg3)" }}>
          <span>© {v.year} RealSync Dynamics AI · Einzelunternehmen · Dominik Steiner · Neuhaus am Rennweg</span>
        </div>
      </footer>

      {v.menuOpen ? (<>
        <div style={{ position: "fixed", inset: "0", zIndex: "60", background: "var(--rs-bg)", display: "flex", flexDirection: "column", padding: "20px", animation: "rsIn 200ms cubic-bezier(.2,.8,.2,1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "20px", fontWeight: "500" }}>RealSyncDynamics.AI</span>
            <button type="button" onClick={v.toggleMenu} aria-label="Menü schließen" style={{ width: "44px", height: "44px", borderRadius: "8px", border: "1px solid var(--rs-chip-b)", background: "var(--rs-toggle)", color: "var(--rs-fg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18"></path></svg></button>
          </div>
          <nav style={{ marginTop: "40px", display: "flex", flexDirection: "column", fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "34px" }}>
            <a href="#produkt" onClick={v.toggleMenu} style={{ padding: "14px 0", borderBottom: "1px solid var(--rs-line)" }}>Produkt</a>
            <a href="#agenten" onClick={v.toggleMenu} style={{ padding: "14px 0", borderBottom: "1px solid var(--rs-line)" }}>Agenten</a>
            <a href="#control-room" onClick={v.toggleMenu} style={{ padding: "14px 0", borderBottom: "1px solid var(--rs-line)" }}>Control Room</a>
            <a href="#check" onClick={v.toggleMenu} style={{ padding: "14px 0", borderBottom: "1px solid var(--rs-line)" }}>Governance-Check</a>
            <a href="#preise" onClick={v.toggleMenu} style={{ padding: "14px 0", borderBottom: "1px solid var(--rs-line)" }}>Preise</a>
            <Link to={v.href.login} style={{ textAlign: "left", padding: "14px 0", border: "0", borderBottom: "1px solid var(--rs-line)", background: "none", color: "var(--rs-fg)", fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "34px", cursor: "pointer" }}>Login</Link>
          </nav>
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
            <Link to={v.href.audit} style={{ minHeight: "56px", borderRadius: "8px", border: "1px solid var(--rs-acc)", background: "var(--rs-btn)", color: "#FFFDF6", fontSize: "17px", cursor: "pointer" }}>Kostenlosen Check starten</Link>
            <Link to={v.href.enterprise} style={{ minHeight: "56px", borderRadius: "8px", border: "1px solid var(--rs-chip-b)", background: "var(--rs-chip)", color: "var(--rs-fg)", fontSize: "17px", cursor: "pointer" }}>Enterprise anfragen</Link>
          </div>
        </div>
      </>) : null}

      {v.modalOpen ? (<>
        <div onClick={v.closeModal} style={{ position: "fixed", inset: "0", zIndex: "70", background: "var(--rs-scrim)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: v.scrimPad }}>
          <div role="dialog" aria-modal="true" aria-label={v.modalTitle} onClick={v.stop} style={v.panelStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "18px 24px", borderBottom: "1px solid var(--rs-line)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "11px", fontWeight: "600", letterSpacing: ".16em", color: "var(--rs-acc)" }}>{v.modalKicker}</span>
                <span style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "24px" }}>{v.modalTitle}</span>
              </div>
              <button type="button" onClick={v.closeModal} aria-label="Schließen" style={{ flex: "none", width: "40px", height: "40px", borderRadius: "8px", border: "1px solid var(--rs-line)", background: "transparent", color: "var(--rs-fg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18"></path></svg></button>
            </div>

            <div style={{ flex: "1", overflow: "auto", padding: "24px" }}>

              {v.showStepper ? (<>
                <ol style={{ listStyle: "none", margin: "0 0 28px", padding: "0", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {v.stepper.map((st, stI) => (<Fragment key={stI}>
                    <li style={st.style}><span style={st.numStyle}>{st.num}</span>{st.label}</li>
                  </Fragment>))}
                </ol>
              </>) : null}

              {v.isAudit0 ? (<>
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.6", color: "var(--rs-fg2)" }}>In drei Minuten zur vorläufigen Einordnung Ihrer KI-Systeme nach EU AI Act. Kostenlos und unverbindlich.</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", gap: "16px" }}>
                    <label style={v.ui.label}>Unternehmen *<input value={v.audit.company} autoComplete="organization" onChange={v.sa.company} placeholder="Muster GmbH" style={v.ui.input} /></label>
                    <label style={v.ui.label}>Branche<select value={v.audit.industry} onChange={v.sa.industry} style={v.ui.input}>{v.industries.map((o, oI) => (<Fragment key={oI}><option value={o.v}>{o.l}</option></Fragment>))}</select></label>
                    <label style={v.ui.label}>Mitarbeitende<select value={v.audit.size} onChange={v.sa.size} style={v.ui.input}>{v.sizes.map((o, oI) => (<Fragment key={oI}><option value={o.v}>{o.l}</option></Fragment>))}</select></label>
                  </div>
                </div>
              </>) : null}

              {v.isAudit1 ? (<>
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <span style={{ fontSize: "13px", fontWeight: "500", color: "var(--rs-fg2)" }}>Welche KI-Anwendungen setzen Sie ein? *</span>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: "8px" }}>
                      {v.useCases.map((u, uI) => (<Fragment key={uI}>
                        <button type="button" onClick={u.toggle} style={u.style}><span style={u.boxStyle}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"></path></svg></span>{u.label}</button>
                      </Fragment>))}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: "20px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "500", color: "var(--rs-fg2)" }}>Ihre Rolle *</span>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>{v.roles.map((r, rI) => (<Fragment key={rI}><button type="button" onClick={r.pick} style={r.style}>{r.label}</button></Fragment>))}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "500", color: "var(--rs-fg2)" }}>Anzahl KI-Systeme *</span>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>{v.counts.map((r, rI) => (<Fragment key={rI}><button type="button" onClick={r.pick} style={r.style}>{r.label}</button></Fragment>))}</div>
                    </div>
                  </div>
                </div>
              </>) : null}

              {v.isAudit2 ? (<>
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  <div>
                    <h3 style={{ margin: "0", fontFamily: "'Source Serif 4',Georgia,serif", fontWeight: "400", fontSize: "30px", lineHeight: "1.2" }}>Vorläufige Einordnung für {v.auditCompany}</h3>
                    <p style={{ margin: "8px 0 0", fontSize: "14px", color: "var(--rs-fg3)" }}>Rolle: {v.auditRoleLabel} · {v.auditCountLabel} KI-Systeme</p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "1px", background: "var(--rs-line)", border: "1px solid var(--rs-line)", borderRadius: "8px", overflow: "hidden" }}>
                    <div style={{ background: "var(--rs-bg)", padding: "16px", display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "36px", color: "#E5484D" }}>{v.riskCounts.high}</span><span style={{ fontSize: "13px", color: "var(--rs-fg2)" }}>Hochrisiko</span></div>
                    <div style={{ background: "var(--rs-bg)", padding: "16px", display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "36px", color: "#F5A524" }}>{v.riskCounts.trans}</span><span style={{ fontSize: "13px", color: "var(--rs-fg2)" }}>Transparenzpflicht</span></div>
                    <div style={{ background: "var(--rs-bg)", padding: "16px", display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "36px", color: "#10B981" }}>{v.riskCounts.min}</span><span style={{ fontSize: "13px", color: "var(--rs-fg2)" }}>Minimal</span></div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid var(--rs-line)" }}>
                    {v.auditRows.map((r, rI) => (<Fragment key={rI}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "12px 0", borderBottom: "1px solid var(--rs-line)", fontSize: "15px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}><span>{r.label}</span><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", color: "var(--rs-fg3)" }}>{r.ref}</span></div>
                        <span style={r.badgeStyle}>{r.risk}</span>
                      </div>
                    </Fragment>))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "600", letterSpacing: ".16em", color: "var(--rs-fg3)" }}>NÄCHSTE SCHRITTE</span>
                    {v.nextSteps.map((n, nI) => (<Fragment key={nI}>
                      <div style={{ display: "flex", gap: "12px", fontSize: "15px", lineHeight: "1.5", color: "var(--rs-fg2)" }}><span style={{ fontFamily: "'JetBrains Mono',monospace", color: "var(--rs-acc)" }}>{n.i}</span><span>{n.t}</span></div>
                    </Fragment>))}
                  </div>
                  <div style={{ padding: "20px", borderRadius: "8px", border: "1px solid var(--rs-acc)", background: "var(--rs-acc-soft)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "600", letterSpacing: ".16em", color: "var(--rs-acc)" }}>EMPFEHLUNG</span>
                      <span style={{ fontFamily: "'Source Serif 4',Georgia,serif", fontSize: "24px" }}>{v.rec.name} · {v.rec.price}</span>
                      <span style={{ fontSize: "14px", color: "var(--rs-fg2)" }}>{v.rec.reason}</span>
                    </div>
                    <Link to={v.rec.href} style={v.ui.primary}>{v.rec.cta}</Link>
                  </div>
                  <p style={{ margin: "0", fontSize: "13px", lineHeight: "1.5", color: "var(--rs-fg3)" }}>Diese Einordnung ist vorläufig und ersetzt keine Rechtsberatung. Sie wird nur in Ihrem Browser berechnet – nichts wird gespeichert oder übertragen.</p>
                </div>
              </>) : null}

            </div>

            {v.showFooter ? (<>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", padding: "16px 24px", borderTop: "1px solid var(--rs-line)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--rs-fg3)" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>Berechnung lokal im Browser · nichts wird übertragen</span>
                <div style={{ display: "flex", gap: "8px" }}>
                  {v.showBack ? (<><button type="button" onClick={v.back} style={v.ui.ghost}>Zurück</button></>) : null}
                  <button type="button" onClick={v.next} style={v.nextStyle}>{v.nextLabel}</button>
                </div>
              </div>
            </>) : null}
          </div>
        </div>
      </>) : null}

      </div>
  );
}
