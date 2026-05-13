import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Server, AlertTriangle, CheckCircle2, Code } from 'lucide-react';

export function SaasAnbieterLanding() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center">
            <Server className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">B2B-SaaS-Anbieter</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-cyan-900 bg-cyan-950/30 text-cyan-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Server className="h-3 w-3" /> AVV · Sub-Processors · Audit-Trail · DSGVO Art. 28
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              DSGVO für B2B-SaaS — <span className="text-security-400">Auftragsverarbeiter-Pflichten</span>
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Wenn deine Kunden personenbezogene Daten in deine SaaS einspeisen, bist du
              <strong className="text-titanium-50"> Auftragsverarbeiter (Art. 28 DSGVO)</strong>.
              Das heißt: AVV-Vorlage, Sub-Processors-Liste, Audit-Trail, Meldepflichten.
              Kein „Wir sind doch nur Tool"-Bonus.
            </p>
          </div>

          <Section title="Was Enterprise-Käufer im Procurement abfragen">
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />AVV nach Art. 28 DSGVO — vorab als PDF, nicht erst nach Vertragsabschluss</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />Sub-Processors-Liste mit Region und Zweck pro Anbieter</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />TOM-Dokumentation (Art. 32) — Verschlüsselung, Backups, Access-Control</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />Meldepflicht-Prozess (Art. 33) — wie schnell informierst du Kunden bei Datenpanne?</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />Drittland-Übermittlung — Schrems II, SCCs, EU-DPA</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />Audit-Logs — wer hat wann auf welche Daten zugegriffen?</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />Löschkonzept — wie und wie lange werden Kundendaten nach Vertragsende aufbewahrt?</li>
            </ul>
          </Section>

          <Section title="Was wir liefern">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">AVV-Generator</strong> mit anpassbarem Template — branded auf dein Unternehmen, PDF-Export</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Sub-Processors-Page</strong> — pflegbar via UI, automatisches Versionieren, Email-Benachrichtigung an Kunden bei Änderung (Art. 28 Abs. 2)</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">TOM-Generator</strong> mit ISO-27001-/SOC-2-Mapping</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">72h-Meldepflicht-Timer</strong> mit Aufsichtsbehörden je Bundesland (deine + die deiner Kunden)</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">DSFA-Wizard</strong> für KI-Features in deinem SaaS (AI-Act-pflichtig ab 2026)</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Datenschutz-Generator</strong> für deine Marketing-Site mit automatischer Tool-Erkennung</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">API-Zugriff</strong> auf alle Tools — programmatisch in deinen Customer-Onboarding-Flow integrierbar</span></li>
            </ul>
          </Section>

          <Section title="Use-Case: AVV-Selfservice für Kunden">
            <p>
              Statt jede AVV-Anfrage manuell zu beantworten: Kunde lädt sich den AVV unter
              <code className="px-1 mx-1 bg-obsidian-950 text-emerald-300 text-xs font-mono">deine-domain.de/legal/avv</code>
              automatisch generiert. Du wirst über jeden Download informiert. Bei Änderungen
              an Sub-Processors triggert die Plattform die 30-Tage-Vorab-Benachrichtigung
              automatisch.
            </p>
            <div className="p-3 bg-obsidian-950 border border-titanium-700 rounded-none flex items-start gap-3 mt-2">
              <Code className="h-4 w-4 text-emerald-400 shrink-0 mt-1" />
              <code className="text-emerald-300 text-xs font-mono break-all leading-relaxed">
                GET /api/avv?customer=acme-gmbh → PDF mit Customer-Branding
              </code>
            </div>
          </Section>

          <Section title="Pricing für SaaS-Anbieter">
            <ul className="space-y-1.5 text-sm">
              <li><strong className="text-titanium-50">Growth 249 €/M</strong> — Multi-Tenant, API, AVV-Generator, Sub-Processors-Page, alle Tools</li>
              <li><strong className="text-titanium-50">Agency 699 €/M</strong> — bis zu 10 Tenants, dedicated Onboarding, White-Label-Reports, Priority-Support</li>
              <li><strong className="text-titanium-50">Enterprise</strong> — auf Anfrage, On-Premise-Option, SLA, Custom-Integration</li>
            </ul>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              Procurement-ready in 14 Tagen
            </h2>
            <p className="text-titanium-300 text-sm mb-4">
              Von „wir haben kein AVV" zu „komplettes Compliance-Paket downloadbar" —
              im Pilot-Trial, ohne Kreditkarte.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to="/pricing?source=saas-anbieter" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Pilot starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/contact-sales?source=saas-anbieter" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Founding Access starten
              </Link>
              <Link to="/avv-generator" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                AVV-Generator probieren
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
