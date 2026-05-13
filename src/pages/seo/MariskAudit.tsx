import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * /marisk-audit — fokussierte SEO-Doorway für MaRisk
 * (Mindestanforderungen an das Risikomanagement) der BaFin.
 */
export function MariskAudit() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-blue-700 to-purple-800 flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">MaRisk-Audit</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-purple-900 bg-purple-950/30 text-purple-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <ShieldCheck className="h-3 w-3" /> BaFin · 8. MaRisk-Novelle · 2024
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              MaRisk-Audit — <span className="text-security-400">KI als operationelles Risiko abbilden</span>
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Die 8. MaRisk-Novelle (2024) verlangt explizit, dass KI-Modelle als operationelles Risiko
              im Risikomanagement-Framework abgebildet werden. Wir liefern den dokumentations-fähigen
              Audit-Trail dafür.
            </p>
          </div>

          <Section title="Was MaRisk konkret fordert">
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50 mr-1">AT 4.3.4 Risikoanalyse:</strong> wesentliche Risiken identifizieren, bewerten, steuern, überwachen — inkl. Modell-Risiken durch KI.</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50 mr-1">AT 7.2 IT-Anforderungen:</strong> verzahnt sich mit BAIT — Audit-Trail, Berechtigungen, Tests.</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50 mr-1">AT 9 Auslagerungen:</strong> KI-Cloud-APIs sind wesentliche Auslagerungen — Vor-Notifikation BaFin.</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50 mr-1">BTO 1.4 Modellvalidierung:</strong> jährliche Validierung der KI-Modelle, dokumentiert &amp; revisionssicher.</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50 mr-1">BT 3 Internes Kontrollsystem:</strong> 4-Augen-Prinzip, Funktionstrennung — Audit-Trail-Pflicht.</li>
            </ul>
          </Section>

          <Section title="Was wir liefern">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">KI-Modell-Register</strong> mit Versions-Tagging, Validierungs-Datum, Owner-Zuordnung</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Audit-Trail pro KI-Aufruf</strong> (Tenant, User, Modell, Input-Hash, Output-Bytes, Zeitstempel)</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Risiko-Kategorisierung</strong> nach AI Act Annex III + MaRisk-Wesentlichkeits-Kriterien</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Vor-Notifikation-Templates</strong> für BaFin-Auslagerungs-Anzeigen (AT 9)</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Modell-Validierungs-Workflow</strong> mit jährlichen Re-Audit-Erinnerungen</span></li>
            </ul>
          </Section>

          <Section title="Quick-Audit für deine Bank">
            <p>
              Unser MaRisk-Quick-Audit gleicht 18 Indikatoren ab und liefert einen
              dokumentations-tauglichen Stand-Bericht für die nächste BaFin-Prüfung.
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <Link to="/audit?intent=marisk" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                MaRisk-Audit starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/bait-compliance" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Auch BAIT
              </Link>
            </div>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              Bank-Compliance-Stand vor BaFin-Prüfung dokumentieren
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Link to="/contact-sales?source=marisk-audit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Founding Access starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/fintech" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                FinTech-Industry-Page
              </Link>
              <Link to="/versicherungen" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                Auch Versicherer (VAIT)
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/impressum" className="hover:text-titanium-300">Impressum</Link>
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
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
