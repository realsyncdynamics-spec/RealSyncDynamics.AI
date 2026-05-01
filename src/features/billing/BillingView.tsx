import React from 'react';
import { CreditCard, Download, CheckCircle2, Zap, ArrowRight, ShieldCheck } from 'lucide-react';

export function BillingView() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-display font-bold text-titanium-50 tracking-tight">Abrechnung & Plan</h1>
        <p className="text-sm text-titanium-400 mt-1">Dein aktuelles Abonnement, Nutzungslimits und Rechnungen.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Current Plan */}
        <div className="md:col-span-2 bg-obsidian-900 rounded-none border border-titanium-900 shadow-sm p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
             <span className="bg-emerald-100 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200">Aktiv</span>
          </div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-obsidian-950 text-white rounded-none flex items-center justify-center shadow-md">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-titanium-50">Professional Plan</h2>
              <p className="text-sm text-titanium-400">149€ / Monat (Jährliche Abrechnung)</p>
            </div>
          </div>

          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-2 text-sm text-titanium-200"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> 10,000 C2PA Signaturen / Monat</div>
            <div className="flex items-center gap-2 text-sm text-titanium-200"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Unlimitierte Agenten Modus Aufrufe</div>
            <div className="flex items-center gap-2 text-sm text-titanium-200"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Stripe Monetization Integration</div>
            <div className="flex items-center gap-2 text-sm text-titanium-200"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Priority Support</div>
          </div>

          <div className="bg-obsidian-950 rounded-none p-4 border border-titanium-900/50">
            <div className="flex justify-between text-sm mb-2 font-medium">
              <span className="text-titanium-300">C2PA Signaturen Usage</span>
              <span className="text-titanium-50">8,405 <span className="text-titanium-500">/ 10,000</span></span>
            </div>
            <div className="w-full bg-titanium-900 rounded-full h-2">
              <div className="bg-security-500 h-2 rounded-full" style={{ width: '84%' }}></div>
            </div>
            <p className="text-xs text-titanium-400 mt-2">Setzt sich am 1. Mai 2026 zurück.</p>
          </div>

          <div className="mt-6 flex gap-3">
            <button className="px-5 py-2.5 bg-obsidian-900 border border-titanium-900 text-titanium-200 font-semibold text-sm rounded-none hover:bg-obsidian-950 transition-colors shadow-sm">Plan kündigen</button>
            <button className="px-5 py-2.5 bg-security-500 text-white font-semibold text-sm rounded-none hover:bg-security-600 transition-colors shadow-sm shadow-blue-600/20">Upgrade auf Enterprise</button>
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-obsidian-900 rounded-none border border-titanium-900 shadow-sm p-6 flex flex-col">
          <h3 className="font-bold text-titanium-50 mb-4">Zahlungsmethode</h3>
          <div className="bg-obsidian-950 border border-titanium-900 rounded-none p-4 flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-7 bg-obsidian-800 rounded px-1 flex flex-col justify-center relative overflow-hidden">
                <div className="w-4 h-4 bg-red-500 rounded-full absolute -left-1 opacity-80 mix-blend-screen"></div>
                <div className="w-4 h-4 bg-amber-500 rounded-full absolute left-1.5 opacity-80 mix-blend-screen"></div>
              </div>
              <div>
                <p className="text-sm font-bold text-titanium-50">•••• 4242</p>
                <p className="text-xs text-titanium-400">Exp. 12/28</p>
              </div>
            </div>
          </div>
          <button className="text-sm font-semibold text-security-400 hover:text-blue-800 w-fit">Methode aktualisieren</button>

          <h3 className="font-bold text-titanium-50 mt-8 mb-4">Rechnungsadresse</h3>
          <div className="text-sm text-titanium-300 leading-relaxed bg-obsidian-950 border border-titanium-900/50 p-4 rounded-none">
             Jane Smith<br/>
             RealSync Corp<br/>
             Musterstraße 123<br/>
             10115 Berlin, Deutschland<br/>
             VAT: DE123456789
          </div>
          <button className="text-sm font-semibold text-security-400 hover:text-blue-800 w-fit mt-3">Adresse ändern</button>
        </div>
      </div>

      {/* Invoice History */}
      <div className="bg-obsidian-900 rounded-none border border-titanium-900 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-titanium-900/50 flex items-center justify-between">
          <h3 className="font-bold text-titanium-50">Letzte Rechnungen</h3>
          <button className="text-sm font-semibold text-security-400 hover:text-blue-800 flex items-center gap-1.5">
            Alle in Stripe ansehen <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-obsidian-950 text-xs uppercase text-titanium-400">
            <tr>
              <th className="px-6 py-4 font-semibold">Datum</th>
              <th className="px-6 py-4 font-semibold">Betrag</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Aktion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[
              { date: '1. Apr 2026', amount: '149,00 €', status: 'Bezahlt' },
              { date: '1. Mrz 2026', amount: '149,00 €', status: 'Bezahlt' },
              { date: '1. Feb 2026', amount: '149,00 €', status: 'Bezahlt' },
            ].map((invoice, i) => (
              <tr key={i} className="hover:bg-obsidian-950 transition-colors">
                <td className="px-6 py-4 text-titanium-200 font-medium">{invoice.date}</td>
                <td className="px-6 py-4 text-titanium-50 font-bold">{invoice.amount}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1.5 bg-emerald-950/40 text-emerald-300 text-xs font-bold px-2.5 py-1 rounded-none border border-emerald-900">
                    <CheckCircle2 className="h-3 w-3" /> {invoice.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 text-titanium-500 hover:text-titanium-300 hover:bg-titanium-900 rounded-none transition-colors inline-flex">
                     <Download className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
