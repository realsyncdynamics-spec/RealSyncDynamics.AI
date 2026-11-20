import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Newspaper, Download, Mail, Image as ImageIcon, FileText, Quote } from 'lucide-react';
import { COMPANY } from '../config/company';
import { monthlyPriceText, planById } from '@/shared/pricing';
import {
  IMPLEMENTATION_MEASURED_AT,
  PLATFORM_LIVE_ITEMS,
} from '../product/implementation-status';

const starterPrice = monthlyPriceText(planById('starter'));
const liveProductNames = PLATFORM_LIVE_ITEMS.map((item) => item.name).join(', ');

const FACTS = [
  { k: 'Gegründet', v: '2026 · Thüringen' },
  { k: 'Sitz', v: `${COMPANY.headquartersAddress.city} · Thüringen` },
  { k: 'Datenbank', v: 'Supabase, Frankfurt. KI-Aufrufe können an Anbieter in den USA gehen (siehe Datenschutzerklärung).' },
  { k: 'Modelle', v: 'Anthropic / OpenAI / Google. EU-lokal: eigener VPS in Deutschland (siehe Datenschutzerklärung).' },
  {
    k: 'Live laut Registry',
    v: `${liveProductNames} (Stand ${IMPLEMENTATION_MEASURED_AT})`,
  },
  { k: 'Zielmärkte', v: 'HealthTech · Legal-Tech · FinTech · Public Sector · Mittelstand' },
  {
    k: 'Pricing',
    v: `Free Audit ${monthlyPriceText(planById('free'))} · Starter ${starterPrice} · Growth ${monthlyPriceText(planById('growth'))} · Agency ${monthlyPriceText(planById('agency'))} · Enterprise ${monthlyPriceText(planById('enterprise'))}`,
  },
];

const QUOTES = [
  {
    q: 'EU-Datensouveränität darf kein Premium-Feature sein. Sie ist die Voraussetzung dafür, dass deutsche Unternehmen KI überhaupt einsetzen dürfen.',
    a: `Founder, ${COMPANY.companyName}`,
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
              Alles, was du für einen Artikel über {COMPANY.companyName} brauchst: Boilerplate, Founder-Quotes,
              Logos in mehreren Formaten, Produkt-Screenshots — frei verwendbar mit Quellenangabe.
            </p>
          </div>

          <Section title="Boilerplate (kurz)">
            <div className="p-4 bg-obsidian-900 border border-titanium-900 rounded-none">
              <p className="text-sm text-titanium-200 leading-relaxed">
                <strong className="text-titanium-50">{COMPANY.companyName}</strong> ist eine KI-Compliance-Plattform.
                Sitz: {COMPANY.headquartersAddress.city} (Thüringen). Rechtsform: {COMPANY.legalForm}.
                Listenpreis Starter: {starterPrice}.
                Als live geführt (Registry-Stand {IMPLEMENTATION_MEASURED_AT}): {liveProductNames}.
                Made in Germany.
              </p>
            </div>
          </Section>

          <Section title="Boilerplate (lang)">
            <div className="p-4 bg-obsidian-900 border border-titanium-900 rounded-none space-y-3 text-sm text-titanium-200 leading-relaxed">
              <p>
                <strong className="text-titanium-50">{COMPANY.companyName}</strong> wurde 2026 in Thüringen gegründet.
                Sitz ist {COMPANY.headquartersAddress.city}. Rechtsform: {COMPANY.legalForm}.
              </p>
              <p>
                Listenpreis Starter: {starterPrice}.
                Als live geführt (Registry-Stand {IMPLEMENTATION_MEASURED_AT}): {liveProductNames}.
                Module, die in der Registry Preview oder Coming Soon sind, stehen hier nicht als Produktumfang.
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
                { f: 'logo-square-400.png', d: 'Quadratisch · 400×400 PNG' },
                { f: 'logo-square-400.svg', d: 'Quadratisch · Vektor' },
                { f: 'avatar-400.png', d: 'Founder-Avatar · 400×400 PNG' },
                { f: 'avatar-400.svg', d: 'Founder-Avatar · Vektor' },
                { f: 'linkedin-banner-1584x396.png', d: 'Banner · LinkedIn-Format PNG' },
                { f: 'linkedin-banner-1584x396.svg', d: 'Banner · Vektor' },
              ].map((a) => (
                <a
                  key={a.f}
                  href={`/brand/${a.f}`}
                  download
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
              Konferenz-Slots — schnellste Antwort per E-Mail an hello@realsyncdynamicsai.de.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <a href="mailto:hello@realsyncdynamicsai.de?subject=Presseanfrage" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Anfrage senden <ArrowRight className="h-4 w-4" />
              </a>
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
          <div>© 2026 {COMPANY.companyName} · Made in Germany · EU-Hosted</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
            <Link to="/legal/avv" className="hover:text-titanium-200">AVV</Link>
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
