import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ShieldCheck, Eye, AlertTriangle, Lock } from 'lucide-react';
import { usePageMeta } from '../../lib/usePageMeta';

const SUPABASE_FUNCTIONS_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'https://ebljyceifhnlzhjfyxup.supabase.co';

export function ShopifyIntegrationPage() {
  usePageMeta({
    title: 'Shopify Integration — RealSyncDynamics.AI',
    description:
      'Compliance Monitoring für Shopify-Storefronts: Tracker-, Consent- und Header-Erkennung, Drift-Alerts nach Theme-/App-Änderungen. Keine automatischen Änderungen am Store.',
  });

  const [shop, setShop] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const onConnect = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = shop.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(normalized)) {
      setErr('Bitte vollständige .myshopify.com-Domain eingeben (z. B. mein-shop.myshopify.com).');
      return;
    }
    setErr(null);
    window.location.href = `${SUPABASE_FUNCTIONS_URL}/functions/v1/shopify-install?shop=${encodeURIComponent(normalized)}`;
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 text-titanium-300 hover:text-titanium-100 text-sm">
          <ArrowLeft className="h-4 w-4" /> Startseite
        </Link>
        <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-titanium-100">
          Shopify Integration · Beta
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-12">
        {/* Hero */}
        <section>
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
            Shopify Compliance Monitoring
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-tight">
            Erkennt Tracker, Consent-Regressionen und Storefront-Drift.
          </h1>
          <p className="mt-4 text-silver-300 text-base sm:text-lg leading-relaxed max-w-3xl">
            Verbinde deinen Shopify-Store über OAuth (read-only Scopes). RealSyncDynamics.AI scannt
            die öffentliche Storefront, prüft Security-Header, erkennt bekannte Tracker- und
            Consent-Vendoren und liefert nach jeder Theme- oder App-Änderung Drift-Events.
          </p>
        </section>

        {/* Connect form */}
        <section className="border border-titanium-900 bg-obsidian-900/60 p-6">
          <h2 className="font-display font-bold text-xl text-titanium-50 mb-2">
            Shopify Store verbinden
          </h2>
          <p className="text-sm text-silver-300 mb-4">
            Du wirst zu Shopify weitergeleitet und genehmigst dort die read-only Scopes. Wir
            speichern dein verschlüsseltes Token + registrieren Webhooks für{' '}
            <code className="font-mono text-xs">app/uninstalled</code> +{' '}
            <code className="font-mono text-xs">themes/update</code>.
          </p>
          <form onSubmit={onConnect} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={shop}
              onChange={(e) => setShop(e.target.value)}
              placeholder="mein-shop.myshopify.com"
              className="flex-1 bg-obsidian-950 border border-titanium-900 text-titanium-100 px-3 py-2.5 rounded-none font-mono text-sm outline-none focus:border-amber-400"
              aria-label="Shop Domain"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 surface-gold text-sm font-bold rounded-none whitespace-nowrap"
            >
              Shopify Store verbinden <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>
          {err && <p className="mt-3 text-xs text-rose-300">{err}</p>}
        </section>

        {/* Was wir scannen */}
        <section>
          <h2 className="font-display font-bold text-2xl text-titanium-50 mb-1">Was wir scannen</h2>
          <p className="text-sm text-silver-400 mb-4">
            Öffentliche Storefront-URLs, keine Admin- oder Customer-Daten. GraphQL Admin API
            v2026-01.
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              ['Security-Header', 'HSTS, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.'],
              ['Tracker-Erkennung', 'GA / gtag, GTM, Meta Pixel, TikTok Pixel, Klaviyo, Hotjar, Pinterest, LinkedIn, MS Clarity.'],
              ['Consent-Banner', 'OneTrust, Cookiebot, Usercentrics, Shopify Customer Privacy, CookieYes.'],
              ['Cookie-Flags', 'Secure + HttpOnly auf Set-Cookie-Antworten der Storefront.'],
              ['Pre-Consent-Hinweise', 'Tracker im initialen HTML ohne erkennbares Consent-Gate (defensiv markiert).'],
              ['Drift-Detection', 'Vergleich zwischen Scans: neuer Tracker, fehlender Header, Score-Drop, verlorenes Consent-Signal.'],
            ].map(([t, b]) => (
              <li key={t} className="border border-titanium-900 bg-obsidian-900/60 p-4">
                <div className="font-display font-semibold text-titanium-50 text-sm mb-1">{t}</div>
                <p className="text-xs text-silver-300 leading-relaxed">{b}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Was wir NICHT tun */}
        <section className="border border-rose-400/20 bg-rose-400/5 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="h-4 w-4 text-rose-300" />
            <h2 className="font-display font-bold text-xl text-titanium-50">
              Was wir nicht automatisch verändern
            </h2>
          </div>
          <ul className="space-y-2 text-sm text-titanium-200 leading-relaxed">
            <li>· Wir <strong>schreiben nichts</strong> in deinen Store. Scopes sind read-only.</li>
            <li>· Wir <strong>installieren keine Pixel</strong> und <strong>aktivieren keine Tracker</strong>.</li>
            <li>· Wir <strong>ändern dein Theme nicht</strong>, kein Liquid-Code-Eingriff.</li>
            <li>· Fix-Empfehlungen werden generiert, aber <strong>nie automatisch angewendet</strong> — du copy-pastet, bestätigst, schaltest selbst live.</li>
          </ul>
        </section>

        {/* Drift Alerts */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
            <h2 className="font-display font-bold text-xl text-titanium-50">Drift Alerts</h2>
          </div>
          <p className="text-sm text-silver-300 leading-relaxed max-w-3xl">
            Nach jedem Scan vergleichen wir gegen den letzten erfolgreichen Lauf. Wenn ein neuer
            Tracker auftaucht, ein Security-Header verschwindet, ein Consent-Signal wegfällt oder
            der Score um mehr als 10 Punkte sinkt, erzeugen wir ein Drift-Event. Themes/Update- und
            App-Uninstall-Webhooks triggern automatische Re-Scans.
          </p>
        </section>

        {/* Plan-CTA */}
        <section className="border border-titanium-100/20 bg-titanium-100/5 p-6">
          <h2 className="font-display font-bold text-xl text-titanium-50">
            Welcher Plan passt zu deinem Setup?
          </h2>
          <p className="mt-2 text-sm text-silver-300">
            <strong>Growth</strong> für einen Store mit täglichem Monitoring + Fix-Empfehlungen.
            <strong> Agency</strong> für mehrere Kundenshops mit White-Label-Reports.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <Link to="/checkout/growth?source=shopify" className="inline-flex items-center gap-2 px-4 py-2 surface-gold text-sm font-bold rounded-none">
              Growth aktivieren <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link to="/contact-sales?intent=agency-shopify" className="inline-flex items-center gap-2 px-4 py-2 border border-titanium-100/30 hover:border-amber-400 text-titanium-100 hover:text-amber-300 text-sm font-medium transition-colors">
              Agency anfragen
            </Link>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="border border-silver-700/30 p-4 flex items-start gap-3">
          <Eye className="h-4 w-4 text-silver-400 mt-0.5 shrink-0" />
          <p className="text-xs text-silver-400 leading-relaxed">
            <strong>Technische Compliance-Analyse.</strong> Keine Rechtsberatung. Keine automatischen
            Änderungen am Store ohne deine Freigabe. Endgültige juristische Bewertung erfordert
            einen Fachanwalt oder zertifizierten DSB.
          </p>
        </section>
      </main>
    </div>
  );
}
