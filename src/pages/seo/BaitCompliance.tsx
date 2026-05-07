import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ShieldCheck, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';

/**
 * /bait-compliance — fokussierte SEO-Doorway für BAIT (Bankaufsichtliche
 * Anforderungen an die IT) der BaFin. Self-Service-Audit-Pfad mit klarer
 * Conversion-Funnel zu /audit oder /contact-sales.
 */
export function BaitCompliance() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">BAIT-Compliance</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-blue-900 bg-blue-950/30 text-blue-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <ShieldCheck className="h-3 w-3" /> BaFin · Bankaufsicht · KWG § 25a
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              BAIT-Compliance — <span className="text-security-400">Bankaufsichtskonform auditierbar</span>
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Die Bankaufsichtlichen Anforderungen an die IT (BAIT) verlangen Audit-Trails,
              Revisionssicherheit und nachvollziehbare Auslagerungs-Bewertung. Unsere Plattform
              dokumentiert all das automatisiert.
            </p>
          </div>

          <Section title="Was BAIT konkret fordert">
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50 mr-1">AT 4.5 Auslagerung:</strong> wesentliche IT-Auslagerungen (Cloud, KI-APIs) brauchen Risiko-Analyse + Vor-Notifikation der BaFin.</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50 mr-1">AT 7.2 Identitäts- &amp; Berechtigungsmanagement:</strong> Least-Privilege + Audit-Trail über alle Zugriffe.</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50 mr-1">AT 9 IT-Sicherheitsmanagement:</strong> dokumentiertes ISMS mit regelmäßigen Reviews + Incident-Response.</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><strong className="text-titanium-50 mr-1">KWG § 25a:</strong> Wirksamkeit + Angemessenheit nachweisbar — der Vorstand haftet persönlich.</li>
            </ul>
          </Section>

          <Section title="Was wir liefern">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Append-only Audit-Trail</strong> über alle Datenverarbeitungs-Aktionen (Postgres-Trigger blockt UPDATE/DELETE)</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Auslagerungs-Register</strong> mit AVV-Status pro Sub-Processor + Risiko-Klassifikation</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">EU-souveräner KI-Pfad</strong> via Ollama-Local — kein US-Cloud-Default für Kreditscoring/Underwriting</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Versionierte Compliance-Rules</strong> die BAIT-/MaRisk-/DORA-Mapping aktuell halten</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Vor-Notifikation-Vorlagen</strong> für AT-4.5-Auslagerungs-Anzeigen an die BaFin</span></li>
            </ul>
          </Section>

          <Section title="Quick-Check in 60 Sekunden">
            <p>
              Unser BAIT-Audit prüft 12 Indikatoren auf deiner Site: TLS-Konfig, HSTS,
              Sub-Processor-Liste, Audit-Log-Hinweise, Rollen-Modell-Dokumentation. Du bekommst
              einen Score 0-100 plus Maßnahmen-Liste.
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <Link to="/audit?intent=bait" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                BAIT-Audit starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/bait-marisk-compliance-guide" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Vollständiger Guide
              </Link>
            </div>
          </Section>

          <Section title="Für wen relevant">
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><FileText className="h-4 w-4 text-security-400 shrink-0 mt-0.5" />Banken nach KWG § 1 (alle Universalbanken, Sparkassen, Volks- und Raiffeisenbanken)</li>
              <li className="flex items-start gap-2"><FileText className="h-4 w-4 text-security-400 shrink-0 mt-0.5" />Wertpapierfirmen nach WpIG</li>
              <li className="flex items-start gap-2"><FileText className="h-4 w-4 text-security-400 shrink-0 mt-0.5" />Zahlungsinstitute &amp; E-Geld-Institute nach ZAG</li>
              <li className="flex items-start gap-2"><FileText className="h-4 w-4 text-security-400 shrink-0 mt-0.5" />FinTechs mit BaFin-Lizenz oder im Zulassungsverfahren</li>
            </ul>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              Vor der nächsten BaFin-Prüfung Compliance-Stand klären
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Link to="/contact-sales?source=bait-compliance" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Bank-Demo buchen <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/fintech" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                FinTech-Industry-Page
              </Link>
              <Link to="/legal/methodology" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                Audit-Methodik
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
