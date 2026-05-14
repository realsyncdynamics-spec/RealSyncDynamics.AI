import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { usePageMeta } from '../../lib/usePageMeta';

export function ShopifyErrorPage() {
  usePageMeta({
    title: 'Shopify Integration · Fehler — RealSyncDynamics.AI',
    description: 'Die Shopify-Verbindung konnte nicht abgeschlossen werden.',
  });

  const [params] = useSearchParams();
  const reason = params.get('reason') ?? 'unknown';
  const shop = params.get('shop') ?? '';

  const explanation = REASONS[reason] ?? REASONS.unknown;

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <Link to="/integrations/shopify" className="flex items-center gap-2 text-titanium-300 hover:text-titanium-100 text-sm">
          <ArrowLeft className="h-4 w-4" /> Shopify Integration
        </Link>
        <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-rose-300 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" /> Verbindung fehlgeschlagen
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <h1 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight mb-3">
          {explanation.title}
        </h1>
        <p className="text-silver-300 leading-relaxed">{explanation.body}</p>
        {shop && (
          <p className="mt-3 text-[11px] font-mono text-silver-500">shop: {shop}</p>
        )}
        <p className="mt-2 text-[11px] font-mono text-silver-500">reason: {reason}</p>

        <div className="mt-8 flex gap-3">
          <Link to="/integrations/shopify" className="inline-flex items-center gap-2 px-4 py-2 surface-gold text-sm font-bold rounded-none">
            Erneut versuchen
          </Link>
          <Link to="/contact-sales?intent=shopify-help" className="inline-flex items-center gap-2 px-4 py-2 border border-titanium-100/30 hover:border-amber-400 text-titanium-100 hover:text-amber-300 text-sm font-medium transition-colors">
            Support kontaktieren
          </Link>
        </div>
      </main>
    </div>
  );
}

const REASONS: Record<string, { title: string; body: string }> = {
  hmac_failed: {
    title: 'HMAC-Verifikation fehlgeschlagen',
    body: 'Die Signatur der Shopify-Antwort konnte nicht verifiziert werden. Bitte versuche es erneut — falls das Problem bleibt, ist eventuell der SHOPIFY_API_SECRET-Wert auf unserer Seite falsch konfiguriert.',
  },
  state_mismatch: {
    title: 'Session-State stimmt nicht überein',
    body: 'Die OAuth-Session ist abgelaufen oder das State-Cookie wurde unterbrochen. Bitte starte den Verbindungsprozess neu — am besten ohne zwischendurch den Tab zu schliessen.',
  },
  scope_not_allowed: {
    title: 'Scope wurde gewährt, ist aber nicht erlaubt',
    body: 'Shopify hat dem Token einen Scope gewährt, der ausserhalb unserer read-only-Whitelist liegt. Wir lehnen die Verbindung defensiv ab — das ist Absicht, kein Defekt.',
  },
  token_exchange_failed: {
    title: 'Token-Tausch fehlgeschlagen',
    body: 'Shopify hat den Code nicht in ein Access-Token getauscht. Häufige Ursachen: Code bereits eingelöst, Code abgelaufen, App-Konfiguration im Partner-Dashboard inkonsistent.',
  },
  unknown: {
    title: 'Unbekannter Fehler bei der Shopify-Verbindung',
    body: 'Bitte versuche es erneut. Falls das Problem bleibt, übernimmt unser AI Agent die Log-Analyse — Fallback-Kanal: support@realsyncdynamicsai.de.',
  },
};
