import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { PortalChrome, StatusChip } from '../../components/portal/PortalChrome';
import {
  PRODUCTS,
  appDeepLink,
  productById,
  type CapabilityStatus,
  type ProductId,
} from '../../product/productSuite';
import { PLANS, PLAN_ORDER, planEntitlementValue, type EntitlementKey } from '@/shared/pricing';
import { TRY_FREE } from '../../config/beta';

/**
 * Produktseite je Produkt (/produkte/build-studio, /produkte/agent-studio,
 * /produkte/governance-os). Gleicher Aufbau für alle drei:
 * Hero → produktspezifische Bereiche → Fähigkeiten mit Status →
 * Oberflächen nach Login → Freischaltung je Tarif → andere Produkte.
 *
 * Freischaltungen kommen aus `PLAN_ENTITLEMENTS` (shared/pricing.ts), Beträge
 * stehen ausschließlich auf /pricing.
 */

interface DetailItem {
  label: string;
  detail: string;
  status?: CapabilityStatus;
  to?: string;
}

interface DetailSection {
  title: string;
  intro?: string;
  items: readonly DetailItem[];
}

const DETAILS: Record<ProductId, readonly DetailSection[]> = {
  build: [
    {
      title: 'So entsteht Ihre Website',
      intro: 'Der Ablauf im Studio. Veröffentlicht wird nur nach ausdrücklicher Freigabe und mit gültiger Berechtigung.',
      items: [
        { label: '1 · Projekt beschreiben oder Domain angeben', detail: 'Neues Projekt im Studio beschreiben; eine bestehende Website über den Website-Scan analysieren.', status: 'preview', to: '/build' },
        { label: '2 · Öffentliche Inhalte strukturiert übernehmen', detail: 'Nur öffentlich zugängliche, rechtlich zulässige Inhalte. Die Nutzungsrechte an Texten und Bildern prüft der Kunde.', status: 'preview' },
        { label: '3 · Designkonzept und Seitenstruktur', detail: 'Die KI erzeugt eine strukturierte Seitenbeschreibung (SiteOS-Blueprint) als Grundlage des Editors.', status: 'preview' },
        { label: '4 · Bearbeiten im visuellen Editor', detail: 'Seiten, Komponenten, Medien und KI-Assistent; jede Änderung wird serverseitig als neue Version abgelegt.', status: 'preview' },
        { label: '5 · Vorschau Desktop, Tablet, Smartphone', detail: 'Vorschau im Workspace; Cloudflare-Vorschau über den Publish Controller.', status: 'preview' },
        { label: '6 · Governance-Prüfung', detail: 'Das Publish Gate bewertet die gespeicherte Version auf technische und datenschutzrelevante Risiken.', status: 'preview' },
        { label: '7 · Freigabe und Vorschau-Veröffentlichung', detail: 'Publish Controller: Gate → Cloudflare-Vorschau; Produktion nur mit Owner-/Admin-Freigabe.', status: 'preview' },
        { label: '8 · Livegang auf eigener Domain', detail: 'DNS-Automatik und Rollback fehlen noch – daher gesperrt.', status: 'blocked' },
      ],
    },
    {
      title: 'Für Web-Anwendungen',
      items: [
        { label: 'Engineering-Oberfläche', detail: 'Dateien, Code und Vorschau unter /builder/:slug/code – dasselbe Projekt wie im visuellen Editor.', status: 'preview' },
        { label: 'Individuelles Webdesign', detail: 'Wenn Sie lieber bauen lassen: Anfrage über den Frontend-Builder-Assistenten.', status: 'live', to: '/frontend-builder' },
      ],
    },
  ],
  automate: [
    {
      title: 'Drei Kanäle',
      intro: 'Ein nicht aktivierter Kanal ist als Vorschau oder gesperrt gekennzeichnet. Es gibt keine simulierten Anrufe, Nachrichten oder Buchungen.',
      items: [
        { label: 'A · Website-Chatbot', detail: 'Persona, Wissensbasis und Gesprächsregeln im Bot-Builder; Anfragen, Kontaktdaten und Terminwünsche landen im Posteingang.', status: 'preview', to: '/chatbot/start' },
        { label: 'B · WhatsApp-Agent', detail: 'Kanal über die WhatsApp Business Platform; eingehende Nachrichten mit Signaturprüfung. Produktivbetrieb erst nach verifizierter Business-Nummer.', status: 'blocked' },
        { label: 'C · Telefonagent', detail: 'Begrüßung, Branche, Stimme und Freigaben konfigurieren. Echte Anrufe sind noch nicht freigeschaltet.', status: 'blocked', to: '/phonebot/start' },
      ],
    },
    {
      title: 'Branchenvorlagen',
      intro: 'Vorlagen geben Gesprächsrahmen vor (Anfrage, Kontakt, Terminwunsch, Übergabe). Sie enthalten keine medizinische oder rechtliche Fachberatung und täuschen keine Kalender- oder Praxissoftware-Anbindung vor.',
      items: [
        { label: 'Handwerk', detail: 'Erster Ablauf der Plattform: Anfrage entgegennehmen, Anliegen und Kontakt erfassen, Terminwunsch aufnehmen, an einen Menschen übergeben.', status: 'preview' },
        { label: 'Arztpraxis · Zahnarztpraxis · Kanzlei', detail: 'Nur Organisatorisches (Erreichbarkeit, Rückruf, Terminwunsch) – keine Fachauskunft.', status: 'not-implemented' },
        { label: 'Hotel · Restaurant · Immobilien · Autohaus · Einzelhandel · Dienstleistungen', detail: 'Geplant als Varianten desselben Ablaufs.', status: 'not-implemented' },
      ],
    },
    {
      title: 'Agent-Studio-Bereiche nach dem Login',
      items: [
        { label: 'Übersicht', detail: 'Gemeinsames Command Center.', status: 'live', to: appDeepLink('/app/dashboard') },
        { label: 'Meine Agenten', detail: 'Bots anlegen und konfigurieren.', status: 'preview', to: appDeepLink('/app/bots') },
        { label: 'Kommunikationskanäle', detail: 'WhatsApp-Kanäle und Kanalstatus.', status: 'preview', to: appDeepLink('/app/bots/whatsapp') },
        { label: 'Anruf- und Nachrichtenzentrale', detail: 'Posteingang für Anfragen; Sprach-Sessions (Liste).', status: 'preview', to: appDeepLink('/app/bots/inbox') },
        { label: 'Wissensbasis', detail: 'Je Bot im Bot-Builder.', status: 'preview', to: appDeepLink('/app/bots') },
        { label: 'Workflows', detail: 'Automationskatalog, noch ohne produktive Ausführung.', status: 'preview', to: appDeepLink('/app/automations') },
        { label: 'Integrationen', detail: 'Konnektoren-Register der Governance-Schicht.', status: 'preview', to: appDeepLink('/app/governance/connectors') },
        { label: 'Qualitätslabor', detail: 'Testgespräche und Bewertung – noch nicht gebaut.', status: 'not-implemented' },
        { label: 'Nutzung und Abrechnung', detail: 'Tarif, Kontingente und Rechnungen.', status: 'live', to: appDeepLink('/app/billing') },
      ],
    },
  ],
  govern: [
    {
      title: 'Module',
      intro: 'Die bestehende Governance Runtime – eigenständig nutzbar und zugleich die gemeinsame Kontrollschicht für Build Studio und Agent Studio. Die rechtliche Bewertung bleibt bei Ihnen bzw. qualifizierten Fachpersonen.',
      items: [
        { label: 'Discover & Scan', detail: 'Website- und Tracking-Analyse, KI-Systeminventar, Datenflüsse.', status: 'live', to: '/audit?source=portal-govern' },
        { label: 'Risk & Compliance', detail: 'DSGVO-Prüfprozesse, EU-AI-Act-Klassifizierung, Risikoregister und Maßnahmen.', status: 'live', to: '/ai-act-klassifikator' },
        { label: 'Policy Engine', detail: 'Richtlinien, Policy Evaluation und serverseitiges Enforcement.', status: 'live', to: '/policy-engine' },
        { label: 'Evidence Vault', detail: 'Ereignisprotokolle, Hash-Verkettung, Integritätsprüfung und Export.', status: 'live', to: appDeepLink('/app/evidence') },
        { label: 'Monitoring & Operations', detail: 'Einzelprüfungen und Berichte live; dauerhafte Überwachung und Drift-Erkennung auf der Roadmap.', status: 'not-implemented', to: appDeepLink('/app/monitoring') },
        { label: 'Command Center', detail: 'Gemeinsame Übersicht, Rollen, Freigaben, Evidence und Integrationsstatus.', status: 'live', to: appDeepLink('/app/dashboard') },
      ],
    },
  ],
};

const PLAN_IDS = PLAN_ORDER.filter((id) => {
  const plan = PLANS.find((p) => p.id === id);
  return plan && plan.availability !== 'legacy';
});

function entitlementCell(planId: string, key: EntitlementKey): string {
  const v = planEntitlementValue(planId, key);
  if (v === null || v === 0) return '—';
  if (v === -1) return 'laut Vertrag';
  if (key.startsWith('limit.')) return v.toLocaleString('de-DE');
  return 'enthalten';
}

const KEY_LABEL: Partial<Record<EntitlementKey, string>> = {
  'siteos.builder': 'Builder-Zugang',
  'siteos.publish': 'Veröffentlichen',
  'limit.sites': 'Websites',
  'bots.enabled': 'Agenten nutzbar',
  'limit.bots': 'Agenten',
  'limit.bot_messages_monthly': 'Nachrichten / Monat',
  'bots.whatsapp': 'WhatsApp-Kanal',
  'bots.voice': 'Telefon-Kanal',
  'limit.bot_voice_minutes_monthly': 'Sprachminuten / Monat',
  'dashboard.access': 'Command Center',
  'governance.ai_register': 'KI-Register',
  'governance.risk_register': 'Risikoregister',
  'evidence.basic_vault': 'Evidence (Basis)',
  'evidence.advanced': 'Evidence (erweitert)',
  'limit.domains': 'Domains',
};

const COMMERCIAL_NOTE: Record<ProductId, string> = {
  build:
    'Builder-Zugang, Veröffentlichung und Anzahl der Websites hängen am Tarif. Einmalige Leistungen wie individuelles Webdesign laufen über eine Anfrage.',
  automate:
    'Kanäle und Nutzungsvolumen hängen am Tarif. Für Telefonie und WhatsApp können nutzungsabhängige Provider-Kosten hinzukommen. Ob ein Kanal heute aktivierbar ist, zeigt der Status oben.',
  govern: 'Die bestehenden Governance-Tarife gelten unverändert; Enterprise auf Anfrage über die Preisseite.',
};

export function ProductPage({ id }: { id: ProductId }) {
  const p = productById(id);
  const others = PRODUCTS.filter((x) => x.id !== id);

  return (
    <PortalChrome>
      <SEOHead />
      <section className="rsp-hero" aria-labelledby="rsp-product-title">
        <div className="rsp-wrap">
          <p className="rsp-hero-kicker">{p.verb}</p>
          <h1 id="rsp-product-title" style={{ fontSize: 'clamp(32px, 5.5vw, 60px)' }}>{p.name}</h1>
          <p className="rsp-lead">{p.description}</p>
          <div className="rsp-actions">
            <Link className="rsp-btn rsp-btn-primary" to={p.primaryCta.to}>{p.primaryCta.label}</Link>
            {p.id === 'build' ? (
              <Link className="rsp-btn rsp-btn-ghost" to={p.secondaryCta.to}>{p.secondaryCta.label}</Link>
            ) : (
              <Link className="rsp-btn rsp-btn-ghost" to="/pricing">Preise ansehen</Link>
            )}
          </div>
          <p className="rsp-note">{TRY_FREE.note}</p>
        </div>
      </section>

      {DETAILS[id].map((section) => (
        <section key={section.title} className="rsp-section" aria-label={section.title}>
          <div className="rsp-wrap">
            <h2>{section.title}</h2>
            {section.intro && <p>{section.intro}</p>}
            <ul className="rsp-list" style={{ marginTop: 20 }}>
              {section.items.map((item) => (
                <li key={item.label} className="rsp-cap">
                  <div className="rsp-cap-head">
                    <strong>{item.to ? <Link to={item.to}>{item.label}</Link> : item.label}</strong>
                    {item.status && <StatusChip status={item.status} />}
                  </div>
                  <span className="rsp-cap-note">{item.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      <section className="rsp-section" aria-labelledby="rsp-caps-title">
        <div className="rsp-wrap">
          <p className="rsp-eyebrow">Stand heute</p>
          <h2 id="rsp-caps-title">Was funktioniert, was noch Vorschau ist</h2>
          <p>
            LIVE ist nutzbar. PREVIEW ist erreichbar, aber noch nicht für den Produktivbetrieb freigegeben.
            BLOCKED ist gebaut, aber durch eine fehlende Voraussetzung gesperrt. NOT IMPLEMENTED ist geplant.
          </p>
          <div className="rsp-table-wrap">
            <table className="rsp-table">
              <thead>
                <tr><th scope="col">Funktion</th><th scope="col">Status</th><th scope="col">Stand</th></tr>
              </thead>
              <tbody>
                {p.capabilities.map((c) => (
                  <tr key={c.id}>
                    <td>{c.label}</td>
                    <td><StatusChip status={c.status} /></td>
                    <td className="rsp-muted">{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rsp-section" aria-labelledby="rsp-plans-title">
        <div className="rsp-wrap">
          <p className="rsp-eyebrow">Freischaltung</p>
          <h2 id="rsp-plans-title">Was Ihr Tarif freischaltet</h2>
          <p>{COMMERCIAL_NOTE[id]} Beträge und Konditionen stehen auf der <Link to="/pricing">Preisseite</Link>.</p>
          <div className="rsp-table-wrap">
            <table className="rsp-table">
              <thead>
                <tr>
                  <th scope="col">Freischaltung</th>
                  {PLAN_IDS.map((pid) => (
                    <th key={pid} scope="col">{PLANS.find((x) => x.id === pid)?.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.entitlementKeys.map((key) => (
                  <tr key={key}>
                    <td>{KEY_LABEL[key] ?? key} <span className="rsp-mono rsp-muted">{key}</span></td>
                    {PLAN_IDS.map((pid) => (
                      <td key={pid}>{entitlementCell(pid, key)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rsp-section" aria-labelledby="rsp-more-title">
        <div className="rsp-wrap rsp-grid-2">
          <div className="rsp-panel">
            <h3 id="rsp-more-title">Nach dem Login</h3>
            <ul className="rsp-list">
              {p.appSurfaces.map((s) => (
                <li key={s.to}><Link to={s.to}>{s.label} →</Link></li>
              ))}
            </ul>
          </div>
          <div className="rsp-panel">
            <h3>Kombinierbar mit</h3>
            <ul className="rsp-list">
              {others.map((o) => (
                <li key={o.id}>
                  <Link to={o.pageRoute}><strong>{o.name}</strong></Link>
                  <div className="rsp-cap-note">{o.tagline}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </PortalChrome>
  );
}

export function BuildStudioProductPage() {
  return <ProductPage id="build" />;
}

export function AgentStudioProductPage() {
  return <ProductPage id="automate" />;
}

export function GovernanceOsProductPage() {
  return <ProductPage id="govern" />;
}
