import { ShoppingCart, CreditCard, AppWindow } from 'lucide-react';
import { NicheLanding, type NicheConfig } from './NicheLanding';

const CONFIG: NicheConfig = {
  segment: 'Shopify',
  sourceTag: 'shopify-dsgvo',
  eyebrow: 'Shopify & DSGVO',
  headline: 'Shopify ist US-Anbieter. Ihr Shop überträgt täglich Kundendaten in die USA — wissen Sie, ob das DSGVO-konform ist?',
  subline:
    'Shopify-Shops sind schnell aufgesetzt, aber DSGVO-Compliance ist komplex: Shopify selbst ist US-Anbieter, jede App im App Store bringt eigene Tracker mit, und Checkout-Cookies laufen oft ohne Einwilligung. Wir prüfen Ihren Shop kostenlos und zeigen, wo konkret Handlungsbedarf besteht.',
  primaryCtaHref: '/audit?source=shopify-dsgvo',
  primaryCtaLabel: 'Shop jetzt kostenlos prüfen',
  painCards: [
    {
      Icon: ShoppingCart,
      title: 'Shopify = US-Anbieter = Drittland-Transfer',
      body: 'Shopify Inc. ist ein kanadisch-US-amerikanisches Unternehmen. Kundendaten (Name, Adresse, Zahlungsdaten) werden auf Shopify-Servern verarbeitet. Das erfordert eine Rechtsgrundlage für den Drittland-Transfer nach Art. 44–49 DSGVO — plus Eintrag in Ihrer Datenschutzerklärung.',
    },
    {
      Icon: AppWindow,
      title: 'Jede App bringt neue Tracker — ohne Ihre Kontrolle',
      body: 'Klaviyo, Hotjar, Facebook Pixel, TikTok Pixel, Loox Reviews — Shopify-Apps laden oft eigene Tracking-Skripte, unabhängig von Ihrem Consent-Banner. Nach jeder App-Installation kann sich Ihr Compliance-Status ändern.',
    },
    {
      Icon: CreditCard,
      title: 'Checkout-Cookies laufen auf shopify.com — außerhalb Ihres Consent-Banners',
      body: 'Der Shopify-Checkout läuft auf einer shopify.com-Domain. Ihr Consent-Banner greift dort nicht. Shopify setzt dort eigene Cookies — was in Ihrer Datenschutzerklärung dokumentiert sein muss.',
    },
  ],
  checksTitle: 'Was wir an Shopify-Shops konkret prüfen',
  checks: [
    {
      title: 'App-Tracker-Inventar + Drittland-Bewertung',
      body: 'Vollständige Erkennung aller durch Shopify-Apps eingebundenen Tracker und Cookies. Mit Angabe des Hosting-Standorts, Drittland-Transfer-Risiko und ob der Tracker vor oder nach Consent lädt.',
    },
    {
      title: 'Datenschutzerklärung-Check: Shopify, Apps, Zahlungsanbieter',
      body: 'Abgleich der erkannten Datenflüsse mit Ihrer Datenschutzerklärung. Fehlende Einträge (z. B. Stripe, PayPal, Klarna, Shopify Payments) werden konkret benannt — mit Textvorschlag für die Ergänzung.',
    },
    {
      title: 'Consent-Banner Effektivitäts-Test',
      body: 'Wir prüfen, ob Ihr Consent-Banner (z. B. Shopify-eigener oder CookiePro/Consentmo) alle relevanten Cookies wirklich blockiert — oder ob Marketing-Pixel trotz Ablehnen weiterlaufen.',
    },
  ],
  faqTitle: 'Häufige Fragen zu Shopify & DSGVO',
  faqs: [
    {
      q: 'Darf ich Shopify in Deutschland überhaupt nutzen?',
      a: 'Ja. Shopify hat einen AVV (Auftragsverarbeitungsvertrag) und verweist auf Standard-Vertragsklauseln für EU-Transfers. Allerdings müssen Sie dies korrekt in Ihrer Datenschutzerklärung dokumentieren und dürfen sich nicht allein auf Shopify verlassen — jede App ist separat zu bewerten.',
    },
    {
      q: 'Welcher Consent-Banner eignet sich für Shopify?',
      a: 'Es gibt Shopify-Apps wie Consentmo, CookiePro oder GDPR/CCPA Cookie Manager. Wichtig ist nicht nur das Tool, sondern ob es alle Tracker tatsächlich blockiert — das prüfen wir technisch für Ihren Shop.',
    },
    {
      q: 'Müssen wir für jede Shopify-App einen AVV abschließen?',
      a: 'Für Apps, die personenbezogene Daten verarbeiten (also praktisch alle Marketing- und Analytics-Apps), ja. Wir prüfen, welche Apps Sie einsetzen — den AVV-Abschluss müssen Sie dann direkt mit den App-Anbietern regeln.',
    },
    {
      q: 'Was ist mit Facebook Pixel und TikTok Pixel im Shopify-Shop?',
      a: 'Beide Pixel sind Drittland-Transfers (USA) und müssen hinter einem Consent-Banner liegen. Shopify bietet seit 2023 ein Customer Privacy API für Consent-Management — die korrekte Implementierung prüfen wir technisch.',
    },
  ],
};

export function ShopifyDsgvoLanding() {
  return <NicheLanding config={CONFIG} />;
}
