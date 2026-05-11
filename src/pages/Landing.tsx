/**
 * Landing — Enterprise-Spec (Engineering-Report-Style, kein Fear-Marketing).
 *
 * Strikt 10 Sections, neutral-präzise Tonalität, procurement-tauglich.
 *   1. Hero (sachlich, 3 CTAs)
 *   2. Problem (neutral, kein Bußgeld-Drama)
 *   3. Audit Engine (3 Layers: Tracking / Security / Compliance)
 *   4. Example Report (Engineering-Report-Stil)
 *   5. How It Works
 *   6. USP (Decision-Layer-Framing)
 *   7. Trust (Procurement-Anforderungen)
 *   8. Proof (aggregierte Stats statt Einzelfälle)
 *   9. Pricing Preview
 *   10. Closing CTA
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Activity,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  Code2,
  Database,
  Server,
  FileSearch,
  Layers,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Logo } from '../components/Logo';
import { LiveProductDemo } from '../components/LiveProductDemo';
import { IdealCustomers } from '../components/IdealCustomers';
import { ThreeStepDsgvoSection } from '../components/ThreeStepDsgvoSection';
import { ServiceLaunchpad } from '../components/ServiceLaunchpad';
import { TargetAudience } from '../components/TargetAudience';
import { HowItWorks3Steps } from '../components/HowItWorks3Steps';
import { WebsiteRebuildOffer } from '../components/WebsiteRebuildOffer';
import { WatchmakerShowcase } from '../components/visual/WatchmakerShowcase';
import { SectionDivider } from '../components/visual/SectionDivider';
import { HeroOnly } from '../components/HeroOnly';

/**
 * Landing — Hero-only-Pivot.
 *
 * Strategischer Wechsel weg von der scrollbaren Long-Form-Landing hin zu
 * einer Single-Viewport-Hero-Bühne. Alle weiteren Inhalte werden über
 * Modals geladen (siehe HeroOnly.tsx). Die untenstehenden Section-
 * Funktionen (Hero, ServiceLaunchpad, TargetAudience, HowItWorks3Steps,
 * WebsiteRebuildOffer, ExampleReport, WatchmakerShowcase, AuditEngine,
 * PricingPreview, ClosingCta) bleiben definiert, sodass sie in Folge-
 * PRs auf dedizierte Routen (/produkt, /tools, /enterprise) ausgelagert
 * werden können — ohne Code-Verlust beim Pivot.
 */
export function Landing() {
  return <HeroOnly />;
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  1) HERO                                                                 */
/* ─────────────────────────────────────────────────────────────────────── */

function Hero() {
  // Premium Luxury-Look: 2-Spalten Desktop, gestapelt Mobile.
  // Inline-Styles für pixelgenau Premium-Optik (Gradients, Glows, Border-Mixing).
  // Farbsystem: BG #06070C, Magenta #FF3AAE (Risiko), Gold #D9A24A (CTA),
  // Ice Blue #4DB8FF (Trust/Headline-Akzent), Warm-Light Text #F4E7D0.
  // EIN repräsentatives Risiko-Beispiel statt Triple-Threat — der Newsletter-
  // Fall ist für KMU am greifbarsten und steht stellvertretend für die Klasse.
  const cards = [
    {
      amount: '€50.000',
      qualifier: 'Newsletter',
      headline: 'Newsletter ohne Opt-in',
      tag: 'Bußgeld-Risiko · stellvertretend für 12 Standardbefunde',
    },
  ];

  return (
    <section
      style={{
        position: 'relative',
        background: '#06070C',
        paddingTop: '72px',
        paddingBottom: '128px',
        overflow: 'hidden',
      }}
    >
      {/* Sehr subtiler radialer Verlauf — 12 % Sichtbarkeit, blau-violett */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 30% 30%, rgba(99,102,241,0.10) 0%, transparent 55%), radial-gradient(ellipse at 75% 65%, rgba(167,139,250,0.07) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 32px',
        }}
      >
        {/* Logo + Brandname zentriert oben */}
        <div style={{ textAlign: 'center', marginBottom: '88px' }}>
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <Logo size={44} iconOnly />
            <span
              style={{
                fontSize: '22px',
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: '#F4E7D0',
              }}
            >
              RealSync<span style={{ color: 'rgba(244,231,208,0.55)', fontWeight: 400, marginLeft: '4px' }}>Dynamics.AI</span>
            </span>
          </div>
        </div>

        {/* 2-Column Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 1fr) 1px minmax(280px, 1fr)',
            gap: '88px',
            alignItems: 'center',
          }}
          className="hero-grid"
        >
          {/* LEFT — 3 Risiko-Karten */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {cards.map((card) => (
              <div
                key={card.amount + card.qualifier}
                style={{
                  position: 'relative',
                  padding: '28px 30px',
                  borderRadius: '24px',
                  background:
                    'linear-gradient(135deg, rgba(255,58,174,0.06) 0%, rgba(255,58,174,0.02) 100%)',
                  border: '1px solid rgba(255,58,174,0.18)',
                  backdropFilter: 'saturate(120%) blur(8px)',
                  WebkitBackdropFilter: 'saturate(120%) blur(8px)',
                  boxShadow:
                    '0 0 60px -20px rgba(255,58,174,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '10px',
                    marginBottom: '10px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '28px',
                      fontWeight: 500,
                      color: '#FF3AAE',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {card.amount}
                  </span>
                  <span
                    style={{
                      fontSize: '13px',
                      color: 'rgba(244,231,208,0.55)',
                      fontWeight: 400,
                    }}
                  >
                    {card.qualifier}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '15px',
                    color: '#F4E7D0',
                    fontWeight: 400,
                    lineHeight: 1.45,
                    marginBottom: '8px',
                  }}
                >
                  {card.headline}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'rgba(244,231,208,0.42)',
                    fontWeight: 400,
                    letterSpacing: '0.02em',
                  }}
                >
                  {card.tag}
                </div>
              </div>
            ))}
          </div>

          {/* DIVIDER */}
          <div
            aria-hidden="true"
            style={{
              width: '1px',
              height: '60%',
              alignSelf: 'center',
              background:
                'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.13) 30%, rgba(255,255,255,0.13) 70%, transparent 100%)',
            }}
          />

          {/* RIGHT — Headline + CTA + Trust */}
          <div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 500,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#4DB8FF',
                marginBottom: '24px',
              }}
            >
              30 Sekunden · kostenlos · kein Account
            </div>

            <h1
              style={{
                fontSize: 'clamp(36px, 5.2vw, 60px)',
                fontWeight: 400,
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                color: '#F4E7D0',
                margin: 0,
                marginBottom: '20px',
              }}
            >
              Wo steht Ihre Website bei DSGVO, TTDSG und EU AI Act?
            </h1>

            <p
              style={{
                fontSize: '18px',
                lineHeight: 1.5,
                color: 'rgba(244,231,208,0.72)',
                margin: 0,
                marginBottom: '36px',
                maxWidth: '520px',
              }}
            >
              In 30 Sekunden sehen Sie potenzielle Risiken bei Tracking, Cookies und Sicherheit — mit Verweisen auf relevante DSGVO-, TTDSG- und Rechtsprechungsgrundlagen und priorisierten Handlungsempfehlungen. Kostenloser Einstieg in kontinuierliche Compliance-Überwachung.
            </p>

            <Link
              to="/audit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '16px 32px',
                borderRadius: '999px',
                background:
                  'linear-gradient(135deg, #E8B765 0%, #D9A24A 50%, #B8862E 100%)',
                color: '#1B1206',
                fontSize: '20px',
                fontWeight: 600,
                letterSpacing: '-0.005em',
                textDecoration: 'none',
                boxShadow:
                  '0 0 60px -8px rgba(217,162,74,0.45), 0 12px 28px -10px rgba(217,162,74,0.55), inset 0 1px 0 rgba(255,255,255,0.32), inset 0 -1px 0 rgba(0,0,0,0.18)',
                border: '1px solid rgba(255,225,170,0.35)',
                transition: 'transform 160ms ease, box-shadow 160ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px) scale(1.015)';
                e.currentTarget.style.boxShadow =
                  '0 0 80px -8px rgba(217,162,74,0.55), 0 16px 32px -10px rgba(217,162,74,0.65), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.18)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow =
                  '0 0 60px -8px rgba(217,162,74,0.45), 0 12px 28px -10px rgba(217,162,74,0.55), inset 0 1px 0 rgba(255,255,255,0.32), inset 0 -1px 0 rgba(0,0,0,0.18)';
              }}
            >
              Kostenlosen Website-Check starten
            </Link>

            <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <a
                href="#example-report"
                style={{
                  fontSize: '14px',
                  color: 'rgba(244,231,208,0.65)',
                  textDecoration: 'none',
                  borderBottom: '1px solid rgba(244,231,208,0.25)',
                  paddingBottom: '2px',
                  transition: 'color 160ms ease, border-color 160ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#F4E7D0';
                  e.currentTarget.style.borderColor = 'rgba(244,231,208,0.55)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgba(244,231,208,0.65)';
                  e.currentTarget.style.borderColor = 'rgba(244,231,208,0.25)';
                }}
              >
                Beispiel-Report ansehen
              </a>
              <span
                style={{
                  fontSize: '13px',
                  color: 'rgba(244,231,208,0.42)',
                  letterSpacing: '0.04em',
                  fontWeight: 400,
                }}
              >
                EU-Hosting · AVV · Audit-Log
              </span>
            </div>
          </div>
        </div>

        {/* LiveProductDemo unten — sehr großer Abstand für Premium-Wirkung */}
        <div style={{ marginTop: '160px' }}>
          <LiveProductDemo />
        </div>
      </div>

      {/* Mobile-Stack: 2-Spalten kollabiert auf 1 Spalte unter 880px */}
      <style>{`
        @media (max-width: 880px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
            gap: 56px !important;
          }
          .hero-grid > div:nth-child(2) {
            display: none;
          }
          .hero-grid > div:last-child {
            order: -1;
            text-align: center;
          }
        }
      `}</style>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  2) PROBLEM (neutral)                                                    */
/* ─────────────────────────────────────────────────────────────────────── */

function Problem() {
  const items = [
    {
      title: 'Third-Party Tracking ohne vollständige Consent-Kaskade',
      body: 'Tags werden via GTM, Inline-Scripts oder Webhooks geladen, bevor Consent durch User gewährt wurde.',
    },
    {
      title: 'Consent-Banner deckt nicht alle Skripte ab',
      body: 'Pixel- und Conversion-Tags entstehen oft nachträglich durch Marketing-Tools — Banner-Konfiguration veraltet.',
    },
    {
      title: 'Internationale Tools mit Datenübertragungs-Risiken',
      body: 'Drittland-Provider laden via CDN, ohne dass Schrems-II-/SCCs-Bewertung dokumentiert ist.',
    },
    {
      title: 'Fehlende technische Schutzmechanismen',
      body: 'CSP, HSTS, Referrer-Policy oft nicht konfiguriert — Erkennung im Static-Audit trivial.',
    },
  ];
  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <SectionHeader
          eyebrow="Beobachtungen aus der Praxis"
          title={<>Wo moderne Websites häufig DSGVO-, TTDSG- und AI-Act-Risiken haben.</>}
        />
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-px bg-titanium-900">
          {items.map((it) => (
            <div key={it.title} className="bg-obsidian-950 p-6 sm:p-7">
              <h3 className="font-display font-bold text-titanium-50 text-base">{it.title}</h3>
              <p className="mt-2 text-sm text-titanium-400 leading-relaxed">{it.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-titanium-500 italic">
          Beobachtungen aus 12&nbsp;Compliance-Audits — keine Drama-Statistik. Detaillierte Methodik:{' '}
          <Link to="/legal/methodology" className="text-titanium-400 hover:text-titanium-200 underline-offset-4 hover:underline">
            /legal/methodology
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  3) AUDIT ENGINE (3 Layers)                                              */
/* ─────────────────────────────────────────────────────────────────────── */

function AuditEngine() {
  // Vorher: 12 Bullets inline. Jetzt: 1-Zeilen-Pitch pro Layer + ein
  // gemeinsamer "Methodik einsehen"-Link unten (statt 3× pro Layer).
  // Wer Tiefe will, klickt auf /legal/methodology — wer scannt, sieht
  // die drei Layers und das war's.
  const layers = [
    {
      Icon: Activity,
      eyebrow: 'Tracking Layer',
      title: 'Detection',
      iconClass: 'text-titanium-200',
      summary: 'GA / Meta / LinkedIn / TikTok mit Consent-Status pro Tag und Pre/Post-Consent-Request-Map.',
    },
    {
      Icon: Lock,
      eyebrow: 'Security Layer',
      title: 'Headers & Hardening',
      iconClass: 'text-titanium-200',
      summary: 'CSP / HSTS / X-Frame-Options / Referrer-Policy + TLS-Version + HTTPS-Enforcement.',
    },
    {
      Icon: ShieldCheck,
      eyebrow: 'Compliance Layer',
      title: 'Norm-Mapping',
      iconClass: 'text-titanium-100',
      summary: 'DSGVO Art. 5/6/28/32/35 · § 25 TTDSG · Drittlandtransfer (SCCs · Schrems-II · DPF).',
    },
  ];
  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-obsidian-900/30">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow="Audit Engine"
          title={<>Automatisierte Analyse mit technischer und rechtlicher Bewertung.</>}
        />
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-px bg-titanium-900">
          {layers.map((layer) => (
            <div
              key={layer.title}
              className="bg-obsidian-950 p-7 sm:p-8 border-t border-t-transparent hover:border-t-titanium-700/60 transition-colors"
            >
              <layer.Icon className={`h-6 w-6 ${layer.iconClass}`} strokeWidth={1.5} />
              <div className="mt-5 text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500">
                {layer.eyebrow}
              </div>
              <h3 className="mt-1 font-display font-bold text-xl tracking-tight text-titanium-50">
                {layer.title}
              </h3>
              <p className="mt-3 text-sm text-titanium-400 leading-relaxed">
                {layer.summary}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            to="/legal/methodology"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-titanium-300 hover:text-titanium-50 underline-offset-4 hover:underline"
          >
            Methodik im Detail ansehen
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  4) EXAMPLE REPORT                                                       */
/* ─────────────────────────────────────────────────────────────────────── */

function ExampleReport() {
  return (
    <section id="example-report" className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <SectionHeader
          eyebrow="Engineering-Report-Stil"
          title={<>So sieht ein Audit-Finding bei uns aus.</>}
        />

        <div className="mt-12 bg-obsidian-900 border border-titanium-800 rounded-none">
          <div className="px-5 py-3 border-b border-titanium-900 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em]">
            <span className="text-titanium-500">finding · GA4_WITHOUT_CONSENT</span>
            <span className="inline-flex items-center gap-1.5 text-red-300">
              <AlertCircle className="h-3 w-3" strokeWidth={2} /> severity: high
            </span>
          </div>

          <div className="p-6 sm:p-7 space-y-5">
            <Field label="Finding">Google Analytics ohne wirksames Consent geladen</Field>
            <Field label="Impact">
              Unautorisierte Datenverarbeitung vor Einwilligung. Personenbezogene Daten (IP, User-Agent,
              Client-ID) werden an <code className="font-mono text-titanium-200 text-[12px]">www.google-analytics.com/g/collect</code> übertragen,
              bevor der Nutzer dem zustimmen konnte.
            </Field>
            <Field label="Legal Basis">
              <span className="font-mono text-[12px]">DSGVO Art. 6 Abs. 1 lit. a · TTDSG § 25 Abs. 1 · Schrems II (USA-Transfer)</span>
            </Field>
            <Field label="Technical Fix">
              Deferred-Loading via Google Consent Mode v2 oder GTM-Tag-Trigger auf{' '}
              <code className="font-mono text-titanium-200 text-[12px]">consent.granted</code>.
              Default-State <code className="font-mono text-titanium-200 text-[12px]">analytics_storage: 'denied'</code> setzen.
            </Field>
            <Field label="Recommendation">
              Block-Script-Execution-Before-Opt-In. Test: erste Network-Requests vor Consent prüfen
              (analytics.google.com darf nicht erscheinen). Nach Fix: Re-Audit zur Bestätigung.
            </Field>
            <div className="pt-3 border-t border-titanium-900 flex items-center justify-between text-[11px] font-mono text-titanium-500">
              <span>methodology: rule_engine 2026.05.0 · tracker-db 2026.05.0</span>
              <span className="text-titanium-200">confidence: 92 / 100</span>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/audit"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-titanium-200 hover:text-titanium-50 underline-offset-4 hover:underline"
          >
            Eigene Domain prüfen — kostenlos
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500 mb-1">{label}</div>
      <div className="text-sm sm:text-base text-titanium-200 leading-relaxed">{children}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  5) HOW IT WORKS                                                         */
/* ─────────────────────────────────────────────────────────────────────── */

function HowItWorks() {
  const steps = [
    { step: '01', title: 'URL eingeben', body: 'Eine Domain oder mehrere via API. Ohne Account, ohne Setup.' },
    { step: '02', title: 'Automatisierter Scan', body: '10–60 Sekunden. Real-Browser-Render, Tracker-Detection, Header-Analyse.' },
    { step: '03', title: 'Compliance-Report', body: 'Strukturierte Findings + Fix-Recommendations + Methodology-Version.' },
  ];
  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-obsidian-900/30">
      <div className="max-w-5xl mx-auto">
        <SectionHeader
          eyebrow="Workflow"
          title={<>Von URL zu Compliance-Report in drei Schritten.</>}
        />

        <div className="mt-14 relative">
          <div
            aria-hidden="true"
            className="hidden md:block absolute top-6 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-titanium-500/40 to-transparent"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
            {steps.map((s) => (
              <div key={s.step} className="relative text-center md:text-left">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-titanium-700/40 bg-obsidian-950 text-titanium-200 font-mono text-sm font-bold relative z-10">
                  {s.step}
                </div>
                <h3 className="mt-5 font-display font-bold text-xl tracking-tight text-titanium-50">{s.title}</h3>
                <p className="mt-3 text-sm text-titanium-400 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 grid sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
          {[
            { icon: Code2, label: 'API-Zugriff', to: '/api' },
            { icon: Layers, label: 'CI/CD-Integration', to: '/integrations' },
            { icon: Database, label: 'Batch-Scanning', to: '/contact-sales?intent=batch' },
          ].map((opt) => (
            <Link
              key={opt.label}
              to={opt.to}
              className="group flex items-center gap-2 px-4 py-3 border border-titanium-800 hover:border-titanium-600 bg-obsidian-950 text-titanium-300 hover:text-titanium-100 text-sm font-medium transition-colors"
            >
              <opt.icon className="h-4 w-4 text-titanium-500 group-hover:text-titanium-100" strokeWidth={1.5} />
              {opt.label}
              <ArrowUpRight className="h-3 w-3 ml-auto text-titanium-500 group-hover:text-titanium-300" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  6) USP                                                                  */
/* ─────────────────────────────────────────────────────────────────────── */

function UspDecisionLayer() {
  const items = [
    'Technische und rechtliche Bewertung kombiniert — kein Tool-Silo.',
    'Priorisierte Fix-Liste statt reiner Findings — Engineering-tauglich.',
    'Developer-first Output: JSON-API + CI-Integration — kein PDF-only-Tool.',
    'Audit-ready Export für DSBs &amp; Legal-Teams — Sub-Processor-Notification automatisiert.',
  ];
  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <SectionHeader
          eyebrow="Differentiation"
          title={<>Mehr als ein Scanner — ein Compliance-Decision-Layer.</>}
        />
        <ul className="mt-12 space-y-4 max-w-3xl">
          {items.map((it) => (
            <li key={it} className="flex items-start gap-3">
              <span className="font-mono text-xs text-titanium-200 mt-1">+</span>
              <p className="text-base text-titanium-200" dangerouslySetInnerHTML={{ __html: it }} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  7) TRUST SECTION — moved to /security in PR #84.                        */
/*     ArchitectureDiagram lives at src/pages/Security.tsx as the           */
/*     interactive centerpiece; this section was removed from the Landing   */
/*     funnel during the simplification (#82) and the function definition   */
/*     was deleted here so the orphan ArchitectureDiagram import could be   */
/*     dropped.                                                             */
/* ─────────────────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────────────── */
/*  8) PROOF — aggregierte Stats                                            */
/* ─────────────────────────────────────────────────────────────────────── */

function ProofStats() {
  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <SectionHeader
          eyebrow="Aggregierte Audit-Befunde"
          title={<>Typische Ergebnisse aus realen Analysen.</>}
        />

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-px bg-titanium-900">
          <StatCard
            number="8 – 15"
            label="Tracking-Findings pro Website"
            sub="Median über static-HTTP-Audits"
          />
          <StatCard
            number="62 %"
            label="Sites mit Tracker vor Consent"
            sub="Third-Party-Scripts pre-load"
          />
          <StatCard
            number="3 / 5"
            label="Header-Schwächen pro Site"
            sub="CSP · HSTS · Referrer-Policy"
          />
        </div>

        <div className="mt-10 max-w-3xl">
          <h3 className="font-display font-bold text-titanium-50 text-base mb-3">Häufigste Issue-Cluster</h3>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {['CSP fehlt oder ineffektiv', 'Unkontrollierte Pixel (Meta · LinkedIn · TikTok)', 'Fehlende IP-Anonymisierung'].map((it) => (
              <li
                key={it}
                className="p-3 bg-obsidian-900 border border-titanium-800 text-sm text-titanium-300"
              >
                {it}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-titanium-500 italic">
            Anonymisiert &amp; aggregiert. Keine Site-spezifische Aussage. Datenbasis verfügbar in der
            Methodology-Doc unter{' '}
            <Link to="/legal/methodology" className="text-titanium-400 hover:text-titanium-200 underline-offset-4 hover:underline">
              /legal/methodology
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}

function StatCard({ number, label, sub }: { number: string; label: string; sub: string }) {
  return (
    <div className="bg-obsidian-950 p-7 sm:p-8 text-center">
      <div className="font-display font-bold text-4xl sm:text-5xl tracking-tight bg-gradient-to-r from-titanium-100 to-titanium-300 bg-clip-text text-transparent">
        {number}
      </div>
      <div className="mt-3 text-sm text-titanium-200 font-medium">{label}</div>
      <div className="mt-1 text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500">{sub}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  9) PRICING PREVIEW                                                      */
/* ─────────────────────────────────────────────────────────────────────── */

function PricingPreview() {
  const tiers = [
    {
      name: 'Starter',
      price: 'Kostenlos',
      sub: 'Einzel-URLs',
      features: ['8 Free-Tools', '1 Domain pro Scan', 'Methodik einsehbar'],
      to: '/audit',
      cta: 'Starten',
      highlight: false,
      managed: false,
    },
    {
      name: 'Team',
      price: '€ 149',
      sub: 'pro Monat / System',
      features: ['Wiederkehrende Audits', 'API + Webhooks', 'Continuous Monitoring'],
      to: '/pricing?tier=team',
      cta: 'Pilot starten',
      highlight: true,
      managed: false,
    },
    {
      name: 'Managed Website',
      price: 'ab € 99',
      sub: 'pro Monat · Audit + Rebuild + Betrieb',
      features: [
        'Voller Audit Ihrer bestehenden Site',
        'Automatischer Neuaufbau auf EU-Infrastruktur',
        'EU-Hosting · TLS · Security-Header · Monitoring',
        'Integriertes Consent-Management',
        '2× Re-Audit pro Jahr · AVV inklusive',
      ],
      to: '/dsgvo-website',
      cta: 'Website-as-a-Service starten',
      highlight: false,
      managed: true,
    },
    {
      name: 'Enterprise',
      price: 'Anfrage',
      sub: 'API · Compliance Monitoring',
      features: ['Unlimited Systeme', 'SLA · DPA', 'Multi-Tenant für Agenturen'],
      to: '/contact-sales?intent=enterprise',
      cta: 'Sales kontaktieren',
      highlight: false,
      managed: false,
    },
  ];

  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-obsidian-900/30">
      <div className="max-w-4xl mx-auto">
        <SectionHeader
          eyebrow="Pricing Preview"
          title={<>Skalierbar von Einzelprüfung bis Enterprise-Governance.</>}
        />

        {/* 2×2-Grid statt 4×1 — Karten haben mehr Atemraum, Features
            besser lesbar, Preis-Vergleich liest sich wie eine Matrix. */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-px bg-titanium-900">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative p-8 ${
                t.highlight
                  ? 'bg-obsidian-900 ring-1 ring-titanium-300/40'
                  : t.managed
                    ? 'bg-obsidian-900 ring-1 ring-titanium-300/40'
                    : 'bg-obsidian-950'
              }`}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-8 inline-flex items-center px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.18em] bg-titanium-50 text-obsidian-950">
                  Empfohlen
                </span>
              )}
              {t.managed && (
                <span className="absolute -top-3 left-8 inline-flex items-center px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.18em] surface-brass text-obsidian-950 font-bold">
                  Komplett-Service
                </span>
              )}
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500">{t.name}</div>
              <div className="mt-3 font-display font-bold text-3xl sm:text-4xl text-titanium-50 tracking-tight">{t.price}</div>
              <div className="mt-1 text-xs text-titanium-500">{t.sub}</div>
              <ul className="mt-6 space-y-2">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-titanium-300">
                    <CheckCircle2 className="h-4 w-4 text-titanium-500 shrink-0 mt-0.5" strokeWidth={1.5} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={t.to}
                className={`mt-7 inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold tracking-tight rounded-none transition-colors ${
                  t.highlight
                    ? 'bg-white text-obsidian-950 hover:bg-titanium-200'
                    : t.managed
                      ? 'bg-titanium-50 text-obsidian-950 hover:bg-titanium-100'
                      : 'border border-titanium-700 text-titanium-100 hover:border-titanium-500'
                }`}
              >
                {t.cta} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-titanium-300 hover:text-titanium-50 underline-offset-4 hover:underline"
          >
            Pricing-Details ansehen
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  10) CLOSING CTA                                                         */
/* ─────────────────────────────────────────────────────────────────────── */

function ClosingCta() {
  const [email, setEmail] = useState('');
  return (
    <section className="py-32 sm:py-40 px-4 sm:px-6 lg:px-8 relative">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-15 blur-3xl"
        style={{ background: 'radial-gradient(circle at 50% 50%, #6366f1 0%, transparent 60%)' }}
      />
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-display font-bold text-4xl sm:text-5xl tracking-tight text-titanium-50 leading-[1.05]">
          Machen Sie Ihre Web-Compliance
          <br />
          <span className="bg-gradient-to-r from-titanium-100 to-titanium-300 bg-clip-text text-transparent">
            messbar.
          </span>
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!email) return;
            window.location.assign(`/audit?email=${encodeURIComponent(email)}`);
          }}
          className="mt-10 flex flex-col sm:flex-row gap-2 max-w-lg mx-auto"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vorname.name@firma.de"
            className="flex-1 bg-obsidian-900 border border-titanium-800 text-titanium-50 px-4 py-3 text-sm rounded-none focus:border-titanium-100 outline-none placeholder:text-titanium-600"
            aria-label="E-Mail für Audit"
          />
          <button
            type="submit"
            className="group inline-flex items-center justify-center gap-2 bg-white text-obsidian-950 hover:bg-titanium-200 px-6 py-3 text-sm font-semibold tracking-tight rounded-none transition-colors"
          >
            Eigene Domain prüfen
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </form>

        <div className="mt-6 text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500">
          <Link to="/legal/methodology" className="hover:text-titanium-300">
            Methodik einsehen
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  Shared UI                                                               */
/* ─────────────────────────────────────────────────────────────────────── */

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: React.ReactNode }) {
  return (
    <div className="max-w-3xl">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500">{eyebrow}</div>
      <h2 className="mt-3 font-display font-bold text-3xl sm:text-5xl tracking-tight text-titanium-50 leading-[1.05]">
        {title}
      </h2>
    </div>
  );
}

function FooterMinimal() {
  return (
    <footer className="border-t border-titanium-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <Logo size={22} />
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-titanium-500">
            <Link to="/legal/methodology" className="hover:text-titanium-300">Methodik</Link>
            <Link to="/grenzen" className="hover:text-titanium-300">Grenzen</Link>
            <Link to="/security" className="hover:text-titanium-300">Security</Link>
            <Link to="/status" className="hover:text-titanium-300">Status</Link>
            <Link to="/blog" className="hover:text-titanium-300">Blog</Link>
            <Link to="/roadmap" className="hover:text-titanium-300">Roadmap</Link>
            <Link to="/continuous-compliance" className="hover:text-titanium-300">Continuous Compliance</Link>
            <Link to="/pre-consent-tracking" className="hover:text-titanium-300">Pre-Consent Tracking</Link>
            <Link to="/google-analytics-consent" className="hover:text-titanium-300">GA Consent</Link>
            <Link to="/ai-act-readiness" className="hover:text-titanium-300">AI Act Readiness</Link>
            <Link to="/branchen" className="hover:text-titanium-300">Branchen</Link>
            <Link to="/dsgvo-website" className="hover:text-titanium-300">Website-Service</Link>
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
            <Link to="/impressum" className="hover:text-titanium-300">Impressum</Link>
            <Link to="/legal/sub-processors" className="hover:text-titanium-300">Sub-Processors</Link>
            <Link to="/legal/avv" className="hover:text-titanium-300">AVV</Link>
            <Link to="/changelog" className="hover:text-titanium-300">Changelog</Link>
          </div>
        </div>

        <div className="mt-10 p-5 border border-titanium-700/40 bg-obsidian-900/40 rounded-none">
          <div className="flex items-start gap-3">
            <Server className="h-4 w-4 text-titanium-200 shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-[12px] text-titanium-300 leading-relaxed">
              <strong className="text-titanium-200">Haftungsausschluss · Anwalts-Validierung.</strong>{' '}
              RealSync Dynamics liefert automatisiert generierte Vorlagen und Methodik-basierte
              Klassifikationen — keine individuelle Rechtsberatung im Sinne des RDG. Outputs sind
              nicht durch externen Datenschutz-Anwalt validiert; vor produktivem Einsatz empfehlen
              wir anwaltliche Prüfung.{' '}
              <Link to="/legal/methodology" className="text-titanium-200 hover:text-titanium-200 underline-offset-4 hover:underline">
                /legal/methodology
              </Link>{' '}
              ·{' '}
              <Link to="/grenzen" className="text-titanium-200 hover:text-titanium-200 underline-offset-4 hover:underline">
                /grenzen
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-[11px] font-mono text-titanium-600 uppercase tracking-[0.18em]">
          <span>© 2026 RealSync Dynamics · Made in Germany · Hosted in EU</span>
          <Link to="/legal/methodology" className="hover:text-titanium-400">Methodik 2026.05.0</Link>
        </div>
      </div>
    </footer>
  );
}
