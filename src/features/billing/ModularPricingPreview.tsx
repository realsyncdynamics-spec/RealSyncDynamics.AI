import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MODULAR_OFFERS, MODULAR_PRODUCT_IDS, MODULAR_STANDALONE_MONTHLY_EUR, isValidModularSelection, formatPriceEur, type ModularOfferId, type ModularProductId } from '@/shared/pricing';

const productNames: Record<ModularProductId, string> = {
  'ki-bots': 'KI-Bots',
  'app-builder': 'App Builder',
  'governance-os': 'Governance OS',
  'claude-code-optimizer': 'Claude Code Optimizer',
};
const offerNames: Record<ModularOfferId, string> = {
  starter: 'Starter', professional: 'Professional', growth: 'Growth', agency: 'Agency',
};

export function ModularPricingPreview() {
  const [params] = useSearchParams();
  const testReturn = params.get('test');
  const [offerId, setOfferId] = useState<ModularOfferId>('professional');
  const [products, setProducts] = useState<ModularProductId[]>([]);
  const offer = MODULAR_OFFERS.find(item => item.id === offerId) ?? MODULAR_OFFERS[1];
  const valid = isValidModularSelection(offer.id, products);
  return (
    <main className="min-h-screen bg-white text-slate-950 px-4 py-10 sm:px-8" data-testid="modular-pricing-preview">
      <div className="mx-auto max-w-6xl">
        <meta name="robots" content="noindex, nofollow" />
        <Link to="/pricing" className="underline text-blue-800">Zur aktuellen Preisseite</Link>
        <p className="mt-8 text-sm font-mono uppercase text-blue-800">RealSync Dynamics &amp; AI · Abnahmeentwurf</p>
        <h1 className="mt-2 text-4xl sm:text-5xl font-bold">Planbare Kosten. Ihre Produktauswahl.</h1>
        <p className="mt-4 max-w-2xl text-slate-700">Unverbindliche Vorschau. Keine Buchung, keine Zahlung, keine Änderung bestehender Abos. Leistungsumfang und Verbrauchskontingente sind noch nicht freigegeben.</p>
        {(testReturn === 'success' || testReturn === 'cancelled') && (
          <section role="status" className="mt-6 border border-blue-700 p-5" data-testid="modular-sandbox-return">
            <h2 className="font-bold">{testReturn === 'success' ? 'Rückkehr vom Sandbox-Checkout' : 'Sandbox-Checkout verlassen'}</h2>
            <p className="mt-2">Diese Rückleitung ist kein Zahlungsnachweis. Der Zahlungsstatus muss serverseitig bei Stripe bestätigt werden. Es werden hier keine Produkte freigeschaltet.</p>
          </section>
        )}
        <fieldset className="mt-8">
          <legend className="font-semibold mb-3">Paket auswählen</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {MODULAR_OFFERS.map(item => (
              <label key={item.id} className={`cursor-pointer border-2 p-5 ${offerId === item.id ? 'border-blue-700' : 'border-slate-200'}`}>
                <input type="radio" name="modular-offer" value={item.id} checked={offerId === item.id} onChange={() => { setOfferId(item.id); setProducts(item.id === 'agency' ? [...MODULAR_PRODUCT_IDS] : []); }} />
                <span className="ml-2 font-semibold">{offerNames[item.id]}</span>
                <span className="block mt-4 text-3xl font-bold">{formatPriceEur(item.monthlyEur)}</span>
                <span className="block text-sm text-slate-600">pro Monat · Preisentwurf</span>
                <span className="block mt-3">{item.selectableProducts === 0 ? 'Testzugang geplant' : `${item.selectableProducts} Produkt(e)`}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="mt-8">
          <legend className="font-semibold mb-3">Produkte · {products.length} von {offer.selectableProducts}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODULAR_PRODUCT_IDS.map(id => (
              <label key={id} className="border border-slate-300 p-4 flex items-start gap-3">
                <input type="checkbox" checked={products.includes(id)} disabled={offer.id === 'agency' || (!products.includes(id) && products.length >= offer.selectableProducts)} onChange={e => { const checked = e.currentTarget.checked; setProducts(prev => checked ? [...prev, id] : prev.filter(value => value !== id)); }} />
                <span><strong>{productNames[id]}</strong><span className="block text-sm text-slate-600">Einzelpreis-Entwurf: {formatPriceEur(MODULAR_STANDALONE_MONTHLY_EUR[id])} / Monat</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <p role="status" className="mt-6">{valid ? 'Auswahl vollständig.' : 'Bitte die vorgesehene Anzahl an Produkten auswählen.'}</p>
        <button type="button" disabled className="mt-4 border border-slate-400 bg-slate-100 text-slate-600 px-6 py-3 cursor-not-allowed">Checkout noch nicht freigegeben</button>
        <p className="mt-3 text-sm text-slate-600">Keine automatischen Mehrkosten. Budget- und Verbrauchslimits sind Freigabevoraussetzungen, noch keine zugesicherte Funktion dieses Entwurfs.</p>
      </div>
    </main>
  );
}
