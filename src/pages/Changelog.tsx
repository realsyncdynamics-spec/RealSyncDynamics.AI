import { Link } from 'react-router-dom';
import { ArrowLeft, GitCommit, Sparkles, Wrench, ShieldCheck } from 'lucide-react';

type Entry = {
  date: string;
  type: 'feat' | 'fix' | 'security';
  title: string;
  body: string;
};

const ENTRIES: Entry[] = [
  {
    date: '2026-05-07',
    type: 'feat',
    title: 'Impressum + Datenschutz mit echten Stammdaten',
    body: 'Inhaber, Anschrift, Telefon, Aufsichtsbehörde TLfDI eingetragen. Pre-Launch-Status auf realistischen Stand reduziert.',
  },
  {
    date: '2026-05-07',
    type: 'feat',
    title: '/versicherungen, /ecommerce, /proliance-alternative',
    body: 'Drei weitere Doorways: Versicherungs-Compliance (VAIT/Solvency II/IDD/DORA), E-Commerce (Shopify/Woo/Shopware mit GTM Consent v2), Proliance-Vergleich.',
  },
  {
    date: '2026-05-07',
    type: 'fix',
    title: 'Apex-Domain in Meta-Tags + Sitemap',
    body: 'Stale GH-Pages-Project-URLs in canonical/OG/Twitter/JSON-LD führten Crawler und Tester zu falschen 404-Diagnosen. Alle Meta-Tags auf RealSyncDynamicsAI.de umgebogen. Plus /impressum + /datenschutz Route-Aliase.',
  },
  {
    date: '2026-05-07',
    type: 'fix',
    title: 'GitHub-Pages SPA-404-Fallback für Apex-Custom-Domain',
    body: 'pathSegmentsToKeep auf 0 reduziert. Direkte Aufrufe wie /pricing oder /legal/privacy laden nun ohne 404-Spam.',
  },
  {
    date: '2026-05-06',
    type: 'feat',
    title: '/about, /press, /security + 3 Competitor-Alternatives',
    body: 'Trust-Pages: Founder-Story, Media-Kit, Security-Posture mit ehrlicher Lücken-Liste. Plus Borlabs- und Cookiebot-Alternative-Doorways.',
  },
  {
    date: '2026-05-06',
    type: 'feat',
    title: '/healthtech, /legal-tech, /onetrust-alternative + Landing-Redesign',
    body: 'Industry-Doorways HealthTech (AI Act High-Risk) und Legal-Tech (§ 203 StGB / BRAO). OneTrust-Vergleich. Landing in Enterprise-Stil.',
  },
  {
    date: '2026-05-06',
    type: 'feat',
    title: '/tools Hub + 8 kostenlose Compliance-Tools',
    body: 'AVV-Generator, VVT-Wizard, DSFA-Wizard, TOM-Generator, AI-Act-Klassifikator, Datenschutz-Generator, 72h-Meldepflicht-Timer, Bußgeld-Rechner.',
  },
  {
    date: '2026-05-05',
    type: 'security',
    title: 'RLS-Hardening + SECURITY DEFINER search_path',
    body: 'Row-Level-Security auf allen Mandanten-Tabellen verifiziert. SECURITY DEFINER Functions mit explizitem search_path=public,pg_catalog (Schema-Injection-Schutz). REVOKE überschüssiger EXECUTE-Grants.',
  },
  {
    date: '2026-05-05',
    type: 'feat',
    title: 'Cookie-Consent-SDK (BfDI 2024 konform)',
    body: '1-Zeile-Embed via Snippet. 3 gleichberechtigte Buttons (kein Dark-Pattern). i18n DE/EN. Stack-agnostisch.',
  },
  {
    date: '2026-05-04',
    type: 'feat',
    title: 'Multi-Tenant + Stripe-Subscription-Flow',
    body: 'Tenants, Memberships, Invites, Accept-Invite-Flow. Stripe Checkout/Customer-Portal/Webhook/Meter-Sync (4 Edge Functions). Auto-Tenant bei Signup.',
  },
  {
    date: '2026-05-04',
    type: 'security',
    title: 'DSGVO Art. 15 + 17 Selfservice',
    body: 'Datenexport (maschinenlesbares JSON, Art. 20) und Account-Löschung (Art. 17) im /settings/account. Edge Functions gdpr-export + gdpr-delete.',
  },
  {
    date: '2026-05-03',
    type: 'feat',
    title: 'EU-lokal-Modus mit Ollama-Fallback',
    body: 'AI-Residency-Toggle pro User + Tenant-Override. KI-Calls wahlweise via EU-Cloud-APIs oder vollständig lokal auf Frankfurt-VPS (Llama / Mistral).',
  },
];

const TYPE_META = {
  feat: { label: 'Feature', icon: Sparkles, color: 'text-emerald-400 border-emerald-900 bg-emerald-950/30' },
  fix: { label: 'Fix', icon: Wrench, color: 'text-amber-400 border-amber-900 bg-amber-950/30' },
  security: { label: 'Security', icon: ShieldCheck, color: 'text-security-400 border-security-900 bg-security-950/30' },
} as const;

export function Changelog() {
  const grouped = ENTRIES.reduce((acc, e) => {
    (acc[e.date] ??= []).push(e);
    return acc;
  }, {} as Record<string, Entry[]>);

  const dates = Object.keys(grouped).sort().reverse();

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-security-500 to-security-700 flex items-center justify-center">
            <GitCommit className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Changelog</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-security-900 bg-security-950/30 text-security-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <GitCommit className="h-3 w-3" /> Public Release Notes
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Changelog
            </h1>
            <p className="text-lg text-titanium-300 leading-relaxed">
              Was wir tatsächlich gebaut haben — chronologisch, ohne Marketing-Gloss.
              Letzte 14 Tage öffentlich, ältere Einträge auf Anfrage.
            </p>
          </div>

          <div className="space-y-8">
            {dates.map((date) => (
              <section key={date}>
                <div className="flex items-baseline gap-3 mb-3">
                  <h2 className="font-display font-bold text-titanium-50 text-lg tracking-tight">{date}</h2>
                  <div className="h-px flex-1 bg-titanium-900" />
                </div>
                <div className="space-y-2">
                  {grouped[date].map((e, i) => {
                    const meta = TYPE_META[e.type];
                    const Icon = meta.icon;
                    return (
                      <div key={i} className="p-3 bg-obsidian-900 border border-titanium-900 rounded-none">
                        <div className="flex items-start gap-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none shrink-0 ${meta.color}`}>
                            <Icon className="h-3 w-3" /> {meta.label}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-display font-bold text-titanium-50 text-sm">{e.title}</div>
                            <div className="text-xs text-titanium-400 leading-relaxed mt-1">{e.body}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-12 p-6 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">Updates abonnieren</h2>
            <p className="text-titanium-300 text-sm mb-4">
              Newsletter (Double-Opt-In, monatlich, jederzeit kündbar): wesentliche Releases,
              neue Tools, regulatorische Änderungen.
            </p>
            <Link to="/ressourcen" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
              Newsletter abonnieren
            </Link>
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
