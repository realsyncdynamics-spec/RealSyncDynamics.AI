import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Newspaper, Download, Mail, Image as ImageIcon, FileText, Quote } from 'lucide-react';

const FACTS = [
  { k: 'Gegründet', v: '2026 · Frankfurt am Main' },
  { k: 'Sitz', v: 'Hessen · Deutschland' },
  { k: 'Hosting', v: 'Frankfurt — EU-souverän · keine US-Cloud' },
  { k: 'Modelle', v: 'Anthropic / OpenAI / Google · Ollama EU-local Fallback' },
  { k: 'Compliance-Stack', v: 'DSGVO · AI Act · BAIT · MaRisk · DORA · BfDI 2024' },
  { k: 'Zielmärkte', v: 'HealthTech · Legal-Tech · FinTech · Public Sector · Mittelstand' },
  { k: 'Pricing', v: 'Bronze 29 €/M · Silver 99 €/M · Gold 299 €/M · 14 Tage Pilot kostenlos' },
];

const QUOTES = [
  {
    q: 'EU-Datensouveränität darf kein Premium-Feature sein. Sie ist die Voraussetzung dafür, dass deutsche Unternehmen KI überhaupt einsetzen dürfen.',
    a: 'Founder, RealSync Dynamics',
  },
  {
    q: 'OneTrust kostet ab 24.000 €/Jahr. Usercentrics ab 1.800 €/Jahr. Wir liefern dasselbe ab 348 €/Jahr — plus AVV, VVT, AI-Act-Tools.',
    a: 'Founder, RealSync Dynamics',
  },
];

export function Press() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-security-500 to-security-700 flex items-center justify-center">
            <Newspaper className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Presse &amp; Media-Kit</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-security-900 bg-security-950/30 text-security-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Newspaper className="h-3 w-3" /> Press · Media · Investor-Anfragen
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Media-Kit — <span className="text-security-400">Fakten, Zitate, Logos</span>
            </h1>
            <p className="text-lg text-titanium-300 leading-relaxed max-w-2xl">
              Alles, was du für einen Artikel über RealSync Dynamics brauchst: Boilerplate, Founder-Quotes,
              Logos in mehreren Formaten, Produkt-Screenshots — frei verwendbar mit Quellenangabe.
            </p>
          </div>

          <Section title="Boilerplate (kurz)">
            <div className="p-4 bg-obsidian-900 border border-titanium-900 rounded-none">
              <p className="text-sm text-titanium-200 leading-relaxed">
                <strong className="text-titanium-50">RealSync Dynamics</strong> ist eine EU-souveräne KI-Compliance-Plattform
                für DACH-Mittelstand und Behörden. Sitz: Frankfurt am Main. Hosting: ausschließlich EU.
                Produkt: AVV-Generator, VVT-Wizard, DSFA-Wizard, AI-Act-Klassifikator, Cookie-Consent-SDK,
                72h-Meldepflicht-Timer, Bußgeld-Rechner — auf einer Plattform ab 29 €/Monat.
                Made in Germany. DSGVO-by-Design. AI Act-ready.
              </p>
            </div>
          </Section>

          <Section title="Boilerplate (lang)">
            <div className="p-4 bg-obsidian-900 border border-titanium-900 rounded-none space-y-3 text-sm text-titanium-200 leading-relaxed">
              <p>
                <strong className="text-titanium-50">RealSync Dynamics</strong> wurde 2026 in Hessen gegründet, um
                deutsche Mittelständler bei der Umsetzung der DSGVO, des EU AI Acts und branchenspezifischer
                Anforderungen (BAIT/MaRisk in Banken, § 203 StGB in Kanzleien, BFSG/BITV in Behörden)
                zu unterstützen — ohne 6-Monats-Implementierung und ohne 50.000 €/Jahr-Enterprise-Verträge.
              </p>
              <p>
                Die Plattform kombiniert acht kostenfreie Self-Service-Tools (AVV, VVT, DSFA, TOM,
                AI-Act-Klassifikator, Datenschutz-Generator, Meldepflicht-Timer, Bußgeld-Rechner) mit einem
                kostenpflichtigen Premium-Tier (Cookie-Consent-SDK, Audit-Trail, Multi-Tenant-Management).
                Hosting erfolgt vollständig in der EU (Frankfurt). KI-Workloads laufen wahlweise auf europäischen
                Anbietern oder lokal via Ollama (Llama / Mistral) — keine US-Cloud-Default-Pfade.
              </p>
              <p>
                Mission: <em>EU-Datensouveränität als Default, nicht als Premium-Feature.</em> Ziel bis Ende 2027 ist es,
                Standard-Compliance-Plattform für den DACH-Mittelstand und die öffentliche Verwaltung zu sein.
              </p>
            </div>
          </Section>

          <Section title="Fakten in Stichworten">
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-hidden">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-titanium-900">
                  {FACTS.map((f) => (
                    <tr key={f.k}>
                      <td className="px-4 py-2.5 text-titanium-400 font-bold w-44">{f.k}</td>
                      <td className="px-4 py-2.5 text-titanium-100">{f.v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Founder-Quotes">
            <div className="space-y-3">
              {QUOTES.map((q, i) => (
                <div key={i} className="p-4 bg-obsidian-900 border-l-2 border-security-500 rounded-none">
                  <Quote className="h-4 w-4 text-security-400 mb-2" />
                  <p className="text-titanium-100 text-sm sm:text-base italic leading-relaxed mb-2">„{q.q}"</p>
                  <div className="text-xs text-titanium-400">— {q.a}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Logos &amp; Brand-Assets">
            <p>
              Logos in SVG, PNG (1×, 2×, 4×) und in mehreren Hintergrund-Varianten (dunkel, hell, monochrom).
              Verwendung kostenfrei für redaktionelle Zwecke, Branchen-Reports und Konferenz-Programme.
              Bei Modifikationen bitte Rücksprache.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
              {[
                { f: 'logo-square-400.png', d: 'Quadratisch · 400×400' },
                { f: 'logo-square-400.svg', d: 'Quadratisch · Vektor' },
                { f: 'avatar-400.png', d: 'Founder-Avatar · 400×400' },
                { f: 'linkedin-banner-1584x396.png', d: 'Banner · LinkedIn-Format' },
                { f: 'linkedin-banner-1584x396.svg', d: 'Banner · Vektor' },
                { f: 'logo-monochrome.svg', d: 'Monochrom · Print-tauglich' },
              ].map((a) => (
                <a
                  key={a.f}
                  href={`/marketing/assets/${a.f}`}
                  className="flex items-start gap-3 p-3 bg-obsidian-900 border border-titanium-900 hover:border-security-500 rounded-none transition-colors group"
                >
                  <ImageIcon className="h-5 w-5 text-security-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-titanium-100 truncate">{a.f}</div>
                    <div className="text-xs text-titanium-500 mt-0.5">{a.d}</div>
                  </div>
                  <Download className="h-4 w-4 text-titanium-600 group-hover:text-security-400 shrink-0 mt-0.5" />
                </a>
              ))}
            </div>
            <p className="text-xs text-titanium-500 mt-2">
              Hinweis: Asset-Dateien werden im Repo unter <code className="px-1 bg-obsidian-950 text-emerald-300">marketing/assets/</code> gepflegt.
              Sollte ein Asset hier 404 liefern, bitte direkt anfragen.
            </p>
          </Section>

          <Section title="Themen, zu denen wir gerne Auskunft geben">
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><FileText className="h-4 w-4 text-security-400 shrink-0 mt-0.5" />EU AI Act in der Praxis — Annex III, Conformity Assessment, Transparenz-Pflichten</li>
              <li className="flex items-start gap-2"><FileText className="h-4 w-4 text-security-400 shrink-0 mt-0.5" />Schrems II + DPF — was deutsche Unternehmen wirklich tun müssen</li>
              <li className="flex items-start gap-2"><FileText className="h-4 w-4 text-security-400 shrink-0 mt-0.5" />Cookie-Banner nach BfDI 2024 — 3 gleichberechtigte Buttons, kein Dark-Pattern</li>
              <li className="flex items-start gap-2"><FileText className="h-4 w-4 text-security-400 shrink-0 mt-0.5" />KI in der öffentlichen Verwaltung — DSK-Position, OZG-Workflows, BFSG/BITV</li>
              <li className="flex items-start gap-2"><FileText className="h-4 w-4 text-security-400 shrink-0 mt-0.5" />BAIT / MaRisk / DORA — KI-Risiko-Management in Banken und Versicherern</li>
              <li className="flex items-start gap-2"><FileText className="h-4 w-4 text-security-400 shrink-0 mt-0.5" />DACH-SaaS vs. US-SaaS — Souveränität, Pricing, Marktstruktur</li>
            </ul>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-5 w-5 text-security-400" />
              <h2 className="font-display font-bold text-titanium-50 text-xl">Presse-Anfragen</h2>
            </div>
            <p className="text-titanium-300 text-sm mb-4">
              Interview-Anfragen, Hintergrund-Gespräche, Quotes für laufende Recherchen, Investor-Decks,
              Konferenz-Slots — schnellste Antwort über das Kontakt-Formular.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to="/contact-sales?source=press" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Anfrage senden <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/about" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Über uns
              </Link>
              <Link to="/legal/sub-processors" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                Sub-Processors-Liste
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
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
