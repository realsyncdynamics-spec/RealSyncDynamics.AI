/**
 * Startseite `/` — Architektur-, Provider-, Nutzen-, Executive- und
 * Prinzipien-Sektionen der Governance-OS-Positionierung.
 *
 * Wenig Text, starke Aussagen: Detailwissen liegt auf Unterseiten
 * (`/agent-governance`, `/governance-runtime`, `/evidence-vault`). Inhalte
 * stehen in `hero-content.ts`; hier nur Darstellung.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  AGENT_CANNOT,
  AGENT_LAYER,
  CONTROL_PLANE_LAYERS,
  HOMEPAGE_PROVIDERS,
  HOMEPAGE_TRUST_PRINCIPLES,
  HOMEPAGE_VALUE,
} from '../governance-frontend/hero-content';

const MONO = { fontFamily: 'var(--font-rs-mono)' } as const;

export function ArchitectureSection() {
  return (
    <section id="architecture" className="os-section scroll-mt-4" aria-labelledby="architecture-heading">
      <div className="os-inner grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="os-kicker"><b>AGENT GOVERNANCE</b> ARCHITEKTUR</p>
          <h2 id="architecture-heading" className="os-display" style={{ fontSize: 'clamp(36px, 4.8vw, 76px)' }}>
            <span>Agenten können</span>
            <span>ausführen.</span>
            <span className="os-dim">Sich selbst</span>
            <span className="os-dim">autorisieren nicht.</span>
          </h2>
          <p className="os-lede">
            Agenten planen, analysieren und handeln. Über ihre Berechtigung entscheidet die Governance-Schicht —
            serverseitig, nicht der Agent und nicht der Provider.
          </p>
          <ul className="mt-8 grid gap-3 p-0" style={{ listStyle: 'none' }}>
            {AGENT_CANNOT.map((item) => (
              <li key={item} className="flex items-baseline gap-4 border-b pb-3 text-[16px]" style={{ borderColor: 'var(--color-rs-border)', color: 'var(--color-rs-fg-0)' }}>
                <span className="text-[11px] tracking-[0.14em]" style={{ ...MONO, color: 'var(--color-rs-fg-2)' }}>
                  AGENT ✕
                </span>
                {item}
              </li>
            ))}
          </ul>
          <Link to="/agent-governance" className="os-link mt-6">
            Governance-Modell für Agenten
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="os-stack" aria-label="Schichtmodell: Agent, Governance-Schicht, Execution Provider">
          <div className="os-stack__node">
            <p className="m-0 text-[11px] tracking-[0.16em]" style={{ ...MONO, color: 'var(--color-rs-fg-2)' }}>REQUEST</p>
            <p className="m-0 mt-1 text-[18px] font-semibold" style={{ color: 'var(--color-rs-fg-0)' }}>AI Agent</p>
          </div>
          <span className="os-stack__wire" aria-hidden="true" />
          <div className="os-stack__node os-stack__node--core">
            <div className="flex items-center justify-between gap-3">
              <p className="m-0 text-[11px] tracking-[0.16em]" style={{ ...MONO, color: 'var(--color-rs-cyan)' }}>POLICY AUTHORITY</p>
              <span className="os-status">Preview</span>
            </div>
            <p className="m-0 mt-1 text-[18px] font-semibold" style={{ color: 'var(--color-rs-fg-0)' }}>RealSync Governance Layer</p>
            <ul className="mt-4 grid grid-cols-2 gap-2 p-0 sm:grid-cols-3" style={{ listStyle: 'none' }}>
              {AGENT_LAYER.map((gate) => (
                <li key={gate} className="border px-3 py-2 text-[12px] uppercase tracking-[0.12em]" style={{ ...MONO, borderColor: 'var(--color-rs-border-strong)', color: 'var(--color-rs-fg-0)' }}>
                  {gate}
                </li>
              ))}
            </ul>
          </div>
          <span className="os-stack__wire" aria-hidden="true" />
          <div className="os-stack__node">
            <p className="m-0 text-[11px] tracking-[0.16em]" style={{ ...MONO, color: 'var(--color-rs-fg-2)' }}>EXECUTION · KEINE POLICY AUTHORITY</p>
            <p className="m-0 mt-1 text-[18px] font-semibold" style={{ color: 'var(--color-rs-fg-0)' }}>Execution Provider</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProvidersSection() {
  return (
    <section id="providers" className="os-section os-section--alt" aria-labelledby="providers-heading">
      <div className="os-inner">
        <p className="os-kicker"><b>PROVIDER-NEUTRAL</b> INTELLIGENCE LAYER</p>
        <h2 id="providers-heading" className="os-display" style={{ fontSize: 'clamp(34px, 4.6vw, 72px)' }}>
          <span>Ihre Modelle sind austauschbar.</span>
          <span className="os-dim">Ihre Governance nicht.</span>
        </h2>

        <div className="mt-12">
          <div className="os-panel px-6 py-6">
            <p className="m-0 text-[11px] tracking-[0.16em]" style={{ ...MONO, color: 'var(--color-rs-cyan)' }}>GOVERNANCE LAYER</p>
            <p className="m-0 mt-2 text-[clamp(20px,2vw,28px)] font-semibold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-rs-title)', color: 'var(--color-rs-fg-0)' }}>
              RealSyncDynamics.AI — Identity · Tenant · Policy · Approval · Evidence
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px lg:grid-cols-4" style={{ backgroundColor: 'var(--color-rs-border)', marginTop: 1 }}>
            {HOMEPAGE_PROVIDERS.map((provider) => (
              <div key={provider.name} className="px-5 py-5" style={{ backgroundColor: 'var(--color-rs-bg-1)' }}>
                <p className="m-0 text-[16px] font-medium" style={{ color: 'var(--color-rs-fg-0)' }}>{provider.name}</p>
                <p className="m-0 mt-1 text-[11px] uppercase tracking-[0.12em]" style={{ ...MONO, color: 'var(--color-rs-fg-2)' }}>{provider.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[13px]" style={{ color: 'var(--color-rs-fg-2)' }}>
            Intelligence- und Execution-Provider, keine Policy Authority. Weitere Provider auf Anfrage.
          </p>
        </div>
      </div>
    </section>
  );
}

export function ValueSection() {
  return (
    <section id="value" className="os-section os-section--alt" aria-labelledby="value-heading">
      <div className="os-inner">
        <p className="os-kicker"><b>WIRTSCHAFTLICHER NUTZEN</b></p>
        <h2 id="value-heading" className="os-h2">
          Governance, die KI <span className="os-dim">nicht ausbremst.</span>
        </h2>
        <ul className="mt-10 grid gap-px p-0 sm:grid-cols-2 lg:grid-cols-4" style={{ listStyle: 'none', backgroundColor: 'var(--color-rs-border)' }}>
          {HOMEPAGE_VALUE.map((item, i) => (
            <li key={item} className="px-5 py-6" style={{ backgroundColor: 'var(--color-rs-bg-0)' }}>
              <span className="text-[11px]" style={{ ...MONO, color: 'var(--color-rs-fg-2)' }} aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <p className="m-0 mt-3 text-[16px] font-medium leading-[1.4]" style={{ color: 'var(--color-rs-fg-0)' }}>{item}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ExecutiveSection() {
  return (
    <section id="executive" className="os-section" aria-labelledby="executive-heading">
      <div className="os-inner">
        <p className="os-kicker"><b>FÜR ENTSCHEIDER</b></p>
        <h2 id="executive-heading" className="os-display" style={{ fontSize: 'clamp(36px, 5vw, 80px)' }}>
          <span>Eine Control Plane</span>
          <span className="os-dim">für Unternehmens-KI.</span>
        </h2>
        <ol className="mt-12 grid gap-px p-0 md:grid-cols-3" style={{ listStyle: 'none', backgroundColor: 'var(--color-rs-border)' }}>
          {CONTROL_PLANE_LAYERS.map((layer) => (
            <li key={layer.layer} className="px-6 py-8" style={{ backgroundColor: 'var(--color-rs-bg-1)' }}>
              <p className="m-0 text-[11px] tracking-[0.2em]" style={{ ...MONO, color: 'var(--color-rs-cyan)' }}>{layer.layer}</p>
              <h3 className="m-0 mt-4 text-[22px] font-semibold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-rs-title)', color: 'var(--color-rs-fg-0)' }}>
                {layer.title}
              </h3>
              <p className="m-0 mt-3 text-[15px] leading-[1.6]" style={{ color: 'var(--color-rs-fg-1)' }}>{layer.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function PrinciplesSection() {
  return (
    <section id="principles" className="os-section os-section--alt" aria-labelledby="principles-heading">
      <div className="os-inner">
        <p className="os-kicker"><b>VERTRAUEN DURCH ARCHITEKTUR</b></p>
        <h2 id="principles-heading" className="os-h2">
          Prinzipien statt Siegel. <span className="os-dim">Compliance ist ein Ergebnis guter Governance.</span>
        </h2>
        <ul className="mt-10 grid gap-px p-0 md:grid-cols-2 lg:grid-cols-5" style={{ listStyle: 'none', backgroundColor: 'var(--color-rs-border)' }}>
          {HOMEPAGE_TRUST_PRINCIPLES.map((item) => (
            <li key={item.title} className="px-5 py-6" style={{ backgroundColor: 'var(--color-rs-bg-0)' }}>
              <h3 className="m-0 text-[15px] font-semibold uppercase tracking-[0.04em]" style={{ color: 'var(--color-rs-fg-0)' }}>{item.title}</h3>
              <p className="m-0 mt-3 text-[14px] leading-[1.6]" style={{ color: 'var(--color-rs-fg-1)' }}>{item.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-[13px]" style={{ color: 'var(--color-rs-fg-2)' }}>
          RealSyncDynamics.AI unterstützt Ihre technischen und organisatorischen Kontrollen für DSGVO und EU AI Act —
          die rechtliche Bewertung bleibt bei Ihnen.
        </p>
      </div>
    </section>
  );
}
