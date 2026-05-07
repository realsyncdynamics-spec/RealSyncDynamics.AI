import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, ArrowRight, CheckCircle2, FileText, Award, Clock } from 'lucide-react';

const STRIPE_PAYMENT_LINK = (import.meta.env.VITE_STRIPE_AUDIT_PRO_LINK as string | undefined)
  ?? 'https://buy.stripe.com/4gM00icIC44L76HgCp8og0g';

export function AuditPro() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
            <Award className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">DSGVO-Audit Pro</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-12">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Award className="h-3 w-3" /> Premium · Manuell verifiziert · 5 Tage Lieferzeit
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Audit-Pro: Manueller <span className="text-security-400">Compliance-Tiefenscan</span>
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              100+ Heuristiken automatisch + manueller Review durch unseren Compliance-Experten.
              Signiertes PDF, druckfertig für Aufsichts-Sonderprüfung. Einmalkauf 499 €.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { icon: <Clock className="h-5 w-5" />, title: '5 Tage Lieferzeit', desc: 'Auto-Scan in 30 Sek + manueller Review innerhalb 5 Werktagen.' },
              { icon: <FileText className="h-5 w-5" />, title: 'Signiertes PDF', desc: 'Compliance-Report mit Paragraph-Referenzen, Fix-Empfehlungen, Aufsichts-Vorlage.' },
              { icon: <ShieldCheck className="h-5 w-5" />, title: '100+ Heuristiken', desc: 'Standard-29 + erweiterte Subpages + DSFA-Analyse + Branchenspezifika.' },
            ].map((f) => (
              <div key={f.title} className="p-4 bg-obsidian-900 border border-titanium-900 rounded-none">
                <div className="text-emerald-400 mb-2">{f.icon}</div>
                <div className="font-display font-bold text-titanium-50 text-sm mb-1">{f.title}</div>
                <div className="text-xs text-titanium-400 leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>

          <div>
            <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">Was du bekommst</h2>
            <ul className="space-y-2">
              {[
                'Auto-Scan mit 29 Heuristiken (sofort verfügbar)',
                'Manueller Tiefenscan: Subpages, Cookie-Verhalten, Tracker, Drittlandtransfer',
                'DSFA-Bewertung (DSGVO Art. 35) für deine Hauptverarbeitungs-Tätigkeiten',
                'Fix-Empfehlungen mit konkreten Code-Snippets',
                'Compliance-Score-Card als Marketing-Asset (Score-Badge für deine Site)',
                'Signiertes PDF (60-90 Seiten) für Aufsichts-Sonderprüfungen',
                '30-Min-Walkthrough-Call zur Erklärung der Befunde',
                'Re-Audit nach Fix in 30 Tagen inklusive',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-titanium-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-obsidian-900 border border-security-700 p-6 rounded-none">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs text-titanium-500 uppercase tracking-wider mb-1">Einmalkauf</div>
                <div className="font-display text-4xl font-bold text-titanium-50 mb-1">499 € <span className="text-base font-normal text-titanium-400">netto</span></div>
                <div className="text-xs text-titanium-500">5 Tage Lieferzeit · Re-Audit nach 30 Tagen inklusive</div>
              </div>
              <a href={STRIPE_PAYMENT_LINK} className="inline-flex items-center gap-2 px-6 py-3 bg-security-500 hover:bg-security-600 text-white font-bold rounded-none">
                Jetzt buchen <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <p className="text-[11px] text-titanium-500 mt-4 leading-relaxed">
              Sicher zahlen via Stripe · Rechnung sofort · 14 Tage Geld-zurück-Garantie wenn du den Report nicht für Auditor-Vorlage geeignet findest.
            </p>
          </div>

          <div className="text-center text-sm text-titanium-400">
            <p>Lieber den kostenlosen Standard-Audit testen? <Link to="/audit" className="text-security-400 hover:underline">/audit</Link></p>
            <p>Größere Setups (mehrere Mandanten / Konzern-Tochter)? <Link to="/contact-sales?source=audit-pro" className="text-security-400 hover:underline">Vertrieb kontaktieren</Link></p>
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
