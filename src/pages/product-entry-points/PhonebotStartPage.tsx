import { Link, useSearchParams } from 'react-router-dom';
import { governanceHandoffHref } from '../../features/siteos/scanHandoff';
import { SEOHead } from '../../components/SEOHead';
import { CapabilityAvailabilityNotice } from '../../components/landing/CapabilityAvailabilityNotice';
import { StatusPill, V3ModuleSwitch, V3PageShell } from '../../components/landing/v3/V3Shell';
import { formatPriceEur, VOICE_STANDALONE_OFFERS } from '@/shared/pricing';
import { getImplementation, STATUS_LABEL } from '../../product/implementation-status';
import { canOfferVoiceCheckout } from '../../config/voice-checkout';

/**
 * Eigenständiger Voice-Agent-Einstieg auf der BESTEHENDEN Route /phonebot/start.
 * Gestaltung und Navigation wie die Startseite v3 (`V3PageShell`).
 *
 * Voice-Pakete sind bereits im Stripe-Livekatalog angelegt, aber die
 * Verbindung Preis → eigenständiges Abo → Entitlement → Agent-Provisioning →
 * produktive Telefonnummer ist noch nicht Ende-zu-Ende freigegeben.
 * Deshalb gibt es hier nur dann einen Kauf-Knopf (→ /voice/checkout/:offerId),
 * wenn `canOfferVoiceCheckout` es erlaubt: Anzeige-Schalter
 * VITE_VOICE_CHECKOUT_ENABLED, deployte Function und freigegebenes Angebot.
 * Default: kein Kauf-Knopf.
 *
 * Das Governance-Voice-Add-on (150 EUR) ist NICHT Teil dieses Katalogs.
 * Preise stammen ausschließlich aus shared/pricing.ts.
 */
const ONBOARDING_URL = 'https://voice.realsyncdynamicsai.de/onboarding.html';
const WAITLIST_URL = '/warteliste?interest=bots&utm_source=voice-product&utm_medium=product-page&utm_campaign=voice-agent-preview';

const STEPS = [
  {
    title: 'Betrieb auswählen',
    text: 'Branche und Einsatzbereich im bestehenden Voice-Konfigurator festlegen.',
  },
  {
    title: 'Assistent gestalten',
    text: 'Stimme, Anwendungsfall und erlaubte Aufgaben im Vorschau-Onboarding auswählen.',
  },
  {
    title: 'Freigabe und Aktivierung',
    text: 'Vor dem ersten produktiven Anruf werden Vertrag, Telefonanbindung und Berechtigungen geprüft.',
  },
] as const;

const SECTIONS = [
  { id: 'ueberblick', label: 'Überblick' },
  { id: 'pakete', label: 'Pakete' },
  { id: 'ablauf', label: 'Ablauf' },
  { id: 'module', label: 'Weitere Module' },
] as const;

export function PhonebotStartPage() {
  const [searchParams] = useSearchParams();
  const fromWebsiteFlow = searchParams.get('source') === 'website_transformation';
  const auditId = searchParams.get('audit_id');
  const implementation = getImplementation('voice-telephony');
  const statusLabel = implementation ? STATUS_LABEL[implementation.status] : 'IN VORBEREITUNG';
  const anyCheckout = VOICE_STANDALONE_OFFERS.some((offer) => canOfferVoiceCheckout(offer));

  return (
    <V3PageShell
      current="/phonebot/start"
      source="phonebot_start"
      crumbs={[
        { label: 'Start', to: '/' },
        { label: 'Module', to: '/#module' },
        { label: 'Voice Agent' },
      ]}
      sections={SECTIONS}
    >
      <SEOHead />

      <section id="ueberblick" className="lv3-section lv3-section--first lv3-split" aria-labelledby="voice-h1">
        <div className="lv3-stack">
          <span className="lv3-meta">
            02 · AUTOMATE · RealSync AI Voice Agent
            <StatusPill label={`Telefonie: ${statusLabel}`} />
          </span>
          <h1 id="voice-h1" className="lv3-page-h1">
            Ihr KI-Empfang für Kundenanfragen und Telefonie.
          </h1>
          <p className="lv3-text">
            Gestalten Sie Ihren eigenen Sprachassistenten für Handwerk, Dienstleistung,
            Praxis oder Kanzlei. Wählen Sie Branche und Stimme im vorhandenen
            Voice-Konfigurator. Die produktive Telefonanbindung ist noch in Vorbereitung.
          </p>
          <CapabilityAvailabilityNotice capabilityId="bots" tone="light" />
          <div className="lv3-actions">
            <a href={ONBOARDING_URL} target="_blank" rel="noopener noreferrer" className="lv3-btn lv3-btn--solid lv3-btn--lg">
              Voice Agent konfigurieren <span aria-hidden="true">&nbsp;→</span>
            </a>
            <Link to={WAITLIST_URL} className="lv3-btn lv3-btn--lg">
              Verfügbarkeit vormerken
            </Link>
          </div>
          {fromWebsiteFlow && (
            <div className="lv3-callout">
              <p>
                Voice ist optional. Nach der Konfiguration oder auch ohne Voice können Sie
                unmittelbar zum Governance-Workspace wechseln. Es wird kein Sprachkanal automatisch aktiviert.
              </p>
              <Link to={governanceHandoffHref(auditId)} className="lv3-btn lv3-btn--solid">
                Weiter zur Governance-Aktivierung <span aria-hidden="true">&nbsp;→</span>
              </Link>
            </div>
          )}
          <p className="lv3-fine" role="note">
            Produktstatus: {statusLabel}. Der Konfigurator dient derzeit der Vorbereitung.
            {anyCheckout
              ? ' Ein Abo schließen Sie über die Paketkarten ab; die Telefonnummer wird erst nach Prüfung aktiviert.'
              : ' Es wird hier weder ein Abonnement abgeschlossen noch eine Telefonnummer aktiviert.'}
          </p>
        </div>

        <ol className="lv3-steps" aria-label="Vom Entwurf zum eigenen Voice Agent">
          {STEPS.map((step, i) => (
            <li key={step.title}><span className="lv3-meta">{String(i + 1).padStart(2, '0')}</span><span>{step.title}</span></li>
          ))}
        </ol>
      </section>

      <section id="pakete" className="lv3-section" aria-labelledby="voice-packages">
        <span className="lv3-eyebrow">Eigenständige Pakete</span>
        <h2 id="voice-packages" className="lv3-h2">Drei Voice-Agent-Angebote</h2>
        <p className="lv3-text">
          Diese Angebote sind separat von den Governance-Abonnements geplant.
          Die monatlichen Katalogpreise sind in Stripe hinterlegt. Leistungsgrenzen und
          Minutenkontingente werden vor Verkaufsfreigabe verbindlich bestätigt.
        </p>
        <div className="lv3-plans">
          {VOICE_STANDALONE_OFFERS.map((offer) => (
            <article key={offer.id} className="lv3-plan">
              <StatusPill label="Vorschau" />
              <h3 className="lv3-h3">{offer.name}</h3>
              <p className="lv3-price">
                <strong>{formatPriceEur(offer.monthlyEur)}</strong>
                <span>/ Monat</span>
              </p>
              {offer.bullets.length > 0 ? (
                <ul className="lv3-plan-list">
                  {offer.bullets.map((b) => <li key={b}>{b}</li>)}
                </ul>
              ) : (
                <p className="lv3-plan-desc">
                  Monatliches Angebot im Stripe-Livekatalog angelegt; kein freigeschalteter Sofortkauf.
                </p>
              )}
              {canOfferVoiceCheckout(offer) ? (
                <Link
                  to={`/voice/checkout/${offer.id}`}
                  data-testid={`voice-offer-subscribe-${offer.id}`}
                  className="lv3-btn lv3-btn--solid"
                >
                  Paket abonnieren
                </Link>
              ) : (
                <a href={ONBOARDING_URL} target="_blank" rel="noopener noreferrer" className="lv3-btn">
                  Paket vorbereiten
                </a>
              )}
            </article>
          ))}
        </div>
        <p className="lv3-fine" data-testid="voice-tax-note">
          Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.
        </p>
      </section>

      <section id="ablauf" className="lv3-section" aria-labelledby="voice-steps">
        <span className="lv3-eyebrow">Ablauf</span>
        <h2 id="voice-steps" className="lv3-h2">Vom Entwurf zum eigenen Voice Agent</h2>
        <ol className="lv3-flow">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="lv3-meta">SCHRITT {String(index + 1).padStart(2, '0')}</span>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
        <ul className="lv3-limits">
          <li>Mandantenrechte, Einwilligung und kritische Aktionen werden über die vorhandene Governance-Architektur kontrolliert.</li>
          <li>Stripe, Supabase und die ElevenLabs-Bereitstellungsfunktion sind bereits angelegt. Die vollständige Aktivierungskette wird separat geprüft.</li>
        </ul>
      </section>

      <V3ModuleSwitch currentKey="bots" />
    </V3PageShell>
  );
}
