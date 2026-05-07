import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Globe, AlertTriangle, CheckCircle2, ShieldCheck,
  Search, Wrench, Activity,
} from 'lucide-react';

export function DsgvoWebsiteLanding() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-fuchsia-600 to-amber-600 flex items-center justify-center">
            <Globe className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">DSGVO-Website-as-a-Service</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">

          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-amber-900 bg-amber-950/30 text-amber-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <ShieldCheck className="h-3 w-3" /> Audit · Rebuild · Managed · EU-Hosted
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Ihre Website wird <span className="text-security-400">rechtssicher</span> — und wir betreiben sie für Sie.
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Eine Pauschale, drei Bausteine: Wir auditieren Ihre bestehende Site, bauen sie DSGVO/TTDSG-konform neu auf und übernehmen den laufenden Betrieb. Sie zahlen monatlich, wir kümmern uns um Updates, Header, Consent und Re-Audits.
            </p>
          </div>

          <Section title="Was wir typischerweise finden">
            <p className="mb-3">
              Aus unseren Audits regionaler Mittelstands-Sites (Praxen, Handwerk, Hotels, Kanzleien) — fast immer dieselben Befunde:
            </p>
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50 mr-1">Google Fonts remote eingebunden:</strong> LG München I, 3 O 17493/20 — 100 € pro Verstoß plus Abmahnrisiko</span></li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50 mr-1">GA4 / Pixel ohne Consent:</strong> § 25 TTDSG — Einwilligung vor jedem Tracking-Cookie zwingend, fehlender Banner = Bußgeld-Risiko</span></li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50 mr-1">HSTS / Security-Header fehlen:</strong> Kein HSTS, keine CSP, kein X-Frame-Options — BSI-Empfehlung verfehlt, leicht prüfbar</span></li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50 mr-1">Kein Datenschutz-Link auf Startseite:</strong> Art. 13 DSGVO + § 5 TMG — direkter UWG-Abmahngrund</span></li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50 mr-1">Tote Domains / fehlerhafte DNS:</strong> Geld fließt für Hosting, Site nicht erreichbar — schädigt Vertrauen und Auffindbarkeit</span></li>
            </ul>
          </Section>

          <Section title="Drei Pakete · klar getrennt">
            <div className="grid sm:grid-cols-3 gap-3 mt-2">
              <PackageCard
                icon={<Search className="h-4 w-4 text-emerald-400" />}
                badge="Einstieg"
                title="Audit"
                price="ab 249 €"
                priceNote="einmalig"
                bullets={[
                  'Voll-Scan auf 12+ DSGVO/TTDSG-Befunde',
                  'PDF-Report mit Priorisierung + Paragraphen-Refs',
                  'Drittanbieter-Karte + Header-Analyse',
                  '30-Min-Befund-Call inklusive',
                ]}
                cta={{ to: '/audit?source=dsgvo-website', label: 'Quick-Scan starten' }}
              />
              <PackageCard
                icon={<Wrench className="h-4 w-4 text-amber-400" />}
                badge="Projekt"
                title="Rebuild"
                price="1.500 – 4.000 €"
                priceNote="einmalig"
                bullets={[
                  'Audit inklusive + Befund-Behebung',
                  'Modernes Layout · lokale Fonts · Consent-Banner',
                  'Security-Header · Impressum/DS-Templates',
                  'Übergabe oder Direkt-Übernahme in Managed',
                ]}
                cta={{ to: '/contact-sales?source=dsgvo-website-rebuild', label: 'Beratung anfragen' }}
                accent
              />
              <PackageCard
                icon={<Activity className="h-4 w-4 text-fuchsia-400" />}
                badge="Laufend"
                title="Managed"
                price="ab 99 €"
                priceNote="pro Monat"
                bullets={[
                  'EU-Hosting · TLS · Backups · Monitoring',
                  'Security-Updates · Header-Pflege · Consent-Updates',
                  '2× Re-Audit pro Jahr inkl. Fix-Plan',
                  'Audit-Trail · jederzeit kündbar',
                ]}
                cta={{ to: '/contact-sales?source=dsgvo-website-managed', label: 'Tarif anfragen' }}
              />
            </div>
          </Section>

          <Section title="So läuft der Prozess">
            <ol className="space-y-2 text-sm">
              <li className="flex items-start gap-3"><Step n={1} /><span><strong className="text-titanium-50">Domain eingeben.</strong> Sie geben Ihre URL über den Quick-Scan ein, in 30 Sekunden sehen Sie die Top-Befunde.</span></li>
              <li className="flex items-start gap-3"><Step n={2} /><span><strong className="text-titanium-50">Voll-Audit (Paket A).</strong> Wir liefern den vollständigen PDF-Report mit Paragraphen-Bezug. Optional: Befund-Call.</span></li>
              <li className="flex items-start gap-3"><Step n={3} /><span><strong className="text-titanium-50">Rebuild (Paket B).</strong> Wir bauen Ihre Site auf einer DSGVO-konformen Basis neu auf. Inhalte werden migriert, Pflicht-Seiten als Templates aufgesetzt.</span></li>
              <li className="flex items-start gap-3"><Step n={4} /><span><strong className="text-titanium-50">Managed (Paket C).</strong> Hosting, Header-Pflege, Updates und halbjährliche Re-Audits — Sie zahlen monatlich, wir halten alles aktuell.</span></li>
            </ol>
          </Section>

          <Section title="Was wir nicht versprechen">
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-titanium-400 shrink-0 mt-0.5" /><span>Keine Rechtsberatung — wir liefern technische Compliance-Härtung, kein Anwaltsschreiben.</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-titanium-400 shrink-0 mt-0.5" /><span>Keine Garantie gegen Abmahnung — wir reduzieren Angriffsfläche, nicht juristisches Risiko in Gänze.</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-titanium-400 shrink-0 mt-0.5" /><span>Keine Inhaltspflege — Texte/Bilder bleibt bei Ihnen, wir pflegen Technik und Pflicht-Layer.</span></li>
            </ul>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              Erst der Quick-Scan, dann reden wir.
            </h2>
            <p className="text-titanium-400 text-sm leading-relaxed">
              In 30 Sekunden sehen Sie, wo Ihre Site steht. Wenn die Befunde klar sind, schicken wir Ihnen ein passendes Paket — ohne Vorab-Verpflichtung.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Link to="/audit?source=dsgvo-website" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Quick-Scan starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/contact-sales?source=dsgvo-website" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Beratung anfragen
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

function Step({ n }: { n: number }) {
  return (
    <span className="shrink-0 w-6 h-6 rounded-none bg-obsidian-900 border border-titanium-800 text-titanium-300 text-xs font-bold flex items-center justify-center mt-0.5">
      {n}
    </span>
  );
}

interface PackageCardProps {
  icon: React.ReactNode;
  badge: string;
  title: string;
  price: string;
  priceNote: string;
  bullets: string[];
  cta: { to: string; label: string };
  accent?: boolean;
}

function PackageCard({ icon, badge, title, price, priceNote, bullets, cta, accent }: PackageCardProps) {
  return (
    <div className={`p-4 bg-obsidian-900 border ${accent ? 'border-amber-700' : 'border-titanium-900'} rounded-none flex flex-col`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[10px] uppercase tracking-wider text-titanium-500 font-bold">{badge}</span>
      </div>
      <div className="font-display font-bold text-titanium-50 text-lg">{title}</div>
      <div className="mt-1 mb-3">
        <span className="text-2xl font-display font-bold text-titanium-50">{price}</span>
        <span className="text-xs text-titanium-500 ml-1.5">{priceNote}</span>
      </div>
      <ul className="space-y-1.5 text-xs text-titanium-300 mb-4 flex-1">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <Link
        to={cta.to}
        className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-none ${
          accent
            ? 'bg-amber-500 hover:bg-amber-600 text-obsidian-950'
            : 'bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200'
        }`}
      >
        {cta.label} <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
