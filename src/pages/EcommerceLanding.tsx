import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ShoppingCart, AlertTriangle, CheckCircle2, Code } from 'lucide-react';

export function EcommerceLanding() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-pink-500 to-rose-700 flex items-center justify-center">
            <ShoppingCart className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">E-Commerce &amp; Online-Shops</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-pink-900 bg-pink-950/30 text-pink-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <ShoppingCart className="h-3 w-3" /> Shopify · WooCommerce · Shopware · GTM Consent Mode v2
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              DSGVO für Online-Shops — <span className="text-security-400">ohne Conversion zu killen</span>.
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Cookie-Consent (BfDI 2024 konform), Sub-Processor-AVV mit Stripe / Klarna / Mollie,
              Google Consent Mode v2, Meta Pixel Anonymisierung — auf einer Plattform.
            </p>
          </div>

          <Section title="Typische DSGVO-Probleme im Online-Shop">
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />Cookie-Banner ohne <em>Alle ablehnen</em>-Button auf gleicher Ebene = abmahnbar (BfDI 2024 + LG-Düsseldorf)</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />Google Analytics + Meta Pixel ohne Consent = Drittland-Übermittlung (Schrems II)</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />Stripe / Klarna / Mollie / Shopify ohne AVV-Vertrag → Auftragsverarbeitung-Lücke</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />Newsletter-Anmeldung ohne Double-Opt-In = § 7 UWG Verstoß</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />Bestellbutton ohne <em>Zahlungspflichtig bestellen</em>-Beschriftung = § 312j BGB verletzt</li>
            </ul>
          </Section>

          <Section title="Was wir liefern">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Cookie-Consent-SDK</strong> mit GTM Consent Mode v2 — analytics_storage, ad_storage, etc.</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">AVV-Generator</strong> mit Vorlagen für Stripe, Klarna, Mollie, PayPal, Shopify, GLS, DHL</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">VVT-Wizard</strong> mit E-Commerce-Use-Cases vorinstalliert (Bestellung, Versand, Retoure, Newsletter)</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Meta Pixel Anonymisierung</strong> — Server-Side-Tracking-Pattern ohne IP-Cleartext</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Datenschutz-Generator</strong> — automatische Einbindung der genutzten Tools (Stripe, GA4, Hotjar)</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">DSGVO-Audit für deine Shop-URL</strong> — kostenlos, sofortiger Score + Maßnahmen-Liste</span></li>
            </ul>
          </Section>

          <Section title="Plattform-Support">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { t: 'Shopify / Shopify Plus', d: 'Snippet im theme.liquid · GTM-Integration · App-Embed Block' },
                { t: 'WooCommerce', d: 'WordPress-Header-Plugin oder direkt im child-theme' },
                { t: 'Shopware 6', d: 'Plugin-Slot in Storefront-Theme · Custom-Fields für Consent' },
                { t: 'Magento / Adobe Commerce', d: 'Layout-XML-Snippet · Customer-Group-Integration' },
                { t: 'Custom Stack (Next.js, Astro, …)', d: '1-Zeile-Embed · oder React/Vue-Component-Wrapper' },
                { t: 'Headless (Stripe-only-Checkout)', d: 'Server-Side-Consent-Validation · API-Endpunkt' },
              ].map((p) => (
                <div key={p.t} className="p-3 bg-obsidian-900 border border-titanium-900 rounded-none">
                  <div className="font-display font-bold text-titanium-50 text-sm mb-1">{p.t}</div>
                  <div className="text-xs text-titanium-400 leading-relaxed">{p.d}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Snippet — 1 Zeile">
            <div className="p-3 bg-obsidian-950 border border-titanium-700 rounded-none flex items-start gap-3">
              <Code className="h-4 w-4 text-emerald-400 shrink-0 mt-1" />
              <code className="text-emerald-300 text-xs font-mono break-all leading-relaxed">
                {'<script src="https://realsyncdynamicsai.de/sdk/cookie-consent.js" data-rsd-key="YOUR_KEY" data-mode="gtm-v2"></script>'}
              </code>
            </div>
            <p className="text-xs text-titanium-500 mt-2">
              <code>data-mode="gtm-v2"</code> aktiviert Google Consent Mode v2 (analytics_storage, ad_storage, ad_user_data, ad_personalization).
              Standard-Cookie-Banner bleibt sichtbar; GTM-Tags warten auf Consent-Update.
            </p>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              Kostenloser Shop-Audit — 30 Sekunden zum Score
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Link to="/audit?source=ecommerce" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Shop-URL prüfen <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/cookie-consent-sdk" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Cookie-SDK einbetten
              </Link>
              <Link to="/avv-generator" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                AVV mit Stripe erstellen
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
            <Link to="/legal/avv" className="hover:text-titanium-300">AVV</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-display font-bold text-titanium-50 mb-3">{title}</h2>
      <div className="prose prose-invert max-w-none text-titanium-300 text-sm sm:text-base leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}
