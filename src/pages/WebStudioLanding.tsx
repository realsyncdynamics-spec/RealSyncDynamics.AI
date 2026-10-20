import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Code2,
  Compass,
  FileText,
  Flame,
  Gauge,
  Layers,
  Layout,
  Loader2,
  Mail,
  Send,
  ShieldCheck,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { ensureCsrfCookie } from '../lib/csrf';
import { edgeFunctionUrl, fnFetchInit, shouldUseFnProxy } from '../lib/fn-proxy';
import '../styles/web-studio.css';

/**
 * Web-Studio — Landingpages & Websites als Dienstleistung (/web-studio).
 *
 * Portiert aus dem AI-Studio-Entwurf „RealSync Dynamics AI — Web & Landingpages“
 * (Owner-Upload 20.10.2026). Bewusst angepasst gegenüber dem Export:
 * - Anfragen gehen an `sales-lead` (source `web-studio`) statt nur lokal
 *   „erfolgreich“ anzuzeigen — der Export hat nichts verschickt.
 * - Keine erfundenen Referenzen: Kundenlogos und Kennzahlen entfernt, die
 *   Mockups heißen „Designkonzepte“.
 * - Interne Einrichtungs-Hinweise (Domain-Modal, Lead-Weiterleitung) sind
 *   nicht öffentlich.
 * - Kein Fremd-Video und keine Fontshare-Schrift (DSGVO, LCP).
 */

const CONTACT_EMAIL = 'info@realsyncdynamicsai.de';

interface ProjectType {
  id: string;
  name: string;
  desc: string;
  basePrice: number;
  baseDays: number;
  icon: React.ElementType;
}

const PROJECT_TYPES: ProjectType[] = [
  { id: 'landingpage', name: 'High-Converting Landingpage', desc: '1 fokussierter One-Pager für Paid Ads, SaaS oder Lead-Generierung', basePrice: 1890, baseDays: 8, icon: Layout },
  { id: 'corporate', name: 'Corporate & Brand Website', desc: '5–8 Unterseiten, klare Informationsarchitektur & CMS-Anbindung', basePrice: 3890, baseDays: 16, icon: Layers },
  { id: 'saas_platform', name: 'SaaS Marketing Platform', desc: 'Umfangreicher Webauftritt mit interaktiven Demos, Pricing & Docs', basePrice: 5490, baseDays: 24, icon: Code2 },
  { id: 'redesign_speed', name: 'Relaunch & Speed Boost', desc: 'Modernisierung bestehender Website mit Fokus auf PageSpeed & CRO', basePrice: 1490, baseDays: 6, icon: Gauge },
];

interface Addon {
  key: 'copy' | 'cms' | 'lang' | 'express';
  label: string;
  hint: string;
  price: number;
  icon: React.ElementType;
  iconClass: string;
}

const ADDONS: Addon[] = [
  { key: 'copy', label: 'Conversion-Copywriting', hint: 'Verkaufsstarke Texte komplett durch uns', price: 590, icon: FileText, iconClass: 'text-indigo-400' },
  { key: 'cms', label: 'Headless CMS Setup', hint: 'Blog & Inhalte selbst per Klick ändern', price: 490, icon: Layers, iconClass: 'text-purple-400' },
  { key: 'lang', label: 'Bilinguale Struktur (DE + EN)', hint: 'Komplettes Sprach-Routing & Lokalisierung', price: 690, icon: Compass, iconClass: 'text-amber-300' },
  { key: 'express', label: 'Express-Sprint (halbe Lieferzeit)', hint: 'Prio-1-Umsetzung für eilige Deadlines', price: 790, icon: Flame, iconClass: 'text-red-400' },
];

const SERVICES = [
  { icon: Layout, color: 'indigo', title: 'High-Converting Landingpages', text: 'Maßgeschneidert für Performance-Marketing (Google Ads, Meta, LinkedIn) und Produktlaunches. Fokussierte Nutzerführung, die Besucher in qualifizierte Anfragen oder Verkäufe verwandelt.', fit: 'SaaS, B2B-Dienstleister, Berater, Produkt-Drops' },
  { icon: Layers, color: 'purple', title: 'Full Corporate & Brand Websites', text: 'Komplette Firmenwebsites mit 5 bis 12 Unterseiten. Durchdachte Informationsarchitektur, Headless-CMS-Anbindung für einfaches Bloggen und saubere mobile Anpassung.', fit: 'Mittelstand, Agenturen, Technologieunternehmen' },
  { icon: FileText, color: 'amber', title: 'Verkaufspsychologisches Copywriting', text: 'Das schönste Design nützt nichts ohne klare Texte. Wir formulieren Wertversprechen, schärfen deine USPs und lösen Kundeneinwände vorab auf.', fit: 'Alle, die keine Zeit haben, selbst Werbetexte zu verfassen' },
  { icon: Code2, color: 'emerald', title: 'Moderner Tech-Stack & Clean Code', text: 'Umsetzung mit React, Next.js oder Vite und Tailwind CSS. Keine überladenen Page-Builder, keine Plugin-Sammlung, eine Code-Basis, die dir gehört.', fit: 'Langlebigkeit und volle Flexibilität' },
  { icon: Gauge, color: 'indigo', title: 'Sub-Second Speed & Tech-SEO', text: 'Langsame Seiten kosten Conversion. Wir liefern grüne PageSpeed-Werte, optimierte Core Web Vitals und saubere Schema.org-Struktur.', fit: 'Bessere Rankings & niedrigere Klickpreise bei Google Ads' },
  { icon: BarChart3, color: 'purple', title: 'DSGVO-Tracking & Conversion-Setup', text: 'Datenschutzkonformes Tracking (z. B. Plausible oder GA4 via Server-Side GTM), Event-Tracking für Klicks und Formular-Abbrüche — mit Consent, wo er nötig ist.', fit: 'Echte Datentransparenz ohne Abmahnrisiko' },
] as const;

const SERVICE_COLORS: Record<(typeof SERVICES)[number]['color'], { text: string; bg: string; border: string }> = {
  indigo: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'hover:border-indigo-500/40' },
  purple: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'hover:border-purple-500/40' },
  amber: { text: 'text-amber-300', bg: 'bg-amber-400/10', border: 'hover:border-amber-400/40' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'hover:border-emerald-400/40' },
};

const CONCEPTS = [
  { title: 'SaaS Analytics Dashboard', category: 'SaaS & Enterprise Data', image: '/web-studio/konzept-saas.webp', desc: 'Marketing-Landingpage mit Produkt-Hero, interaktivem ROI-Rechner und klarer Demo-Buchung als einzigem Ziel.' },
  { title: 'Wealth-Management-Portal', category: 'Fintech & Banking', image: '/web-studio/konzept-fintech.webp', desc: 'B2B-Portal für Vermögensverwalter: dunkle Designsprache, Liquid-Glass-Komponenten und cookieloses Event-Tracking.' },
  { title: 'Architekturstudio', category: 'Luxury & Architecture', image: '/web-studio/konzept-studio.webp', desc: 'Reduzierte Ästhetik, ruhige Übergänge und strenge typografische Hierarchie für ein Portfolio, das wirkt.' },
];

interface Package {
  label: string;
  name: string;
  price: string;
  unit: string;
  intro: string;
  features: string[];
  delivery?: string;
  cta: string;
  featured?: boolean;
}

const PACKAGES: Package[] = [
  {
    label: 'Für Produktlaunches & Ads', name: 'Landingpage Sprint', price: '1.890 €', unit: 'einmalig',
    intro: 'Ideal, wenn du qualifizierte Leads einsammeln oder eine neue Kampagne testen willst.',
    features: ['1 fokussierte High-Converting Landingpage', 'Verkaufspsychologisches Copywriting', 'Individuelles Figma-UI/UX-Design', 'Entwicklung in React / Tailwind CSS', 'PageSpeed 90+ mobil / 95+ Desktop', '2 Korrekturschleifen inklusive'],
    delivery: '7–10 Werktage', cta: 'Sprint anfragen',
  },
  {
    label: 'Vollständiger Markenauftritt', name: 'Full Brand Website', price: '3.890 €', unit: 'einmalig', featured: true,
    intro: 'Für B2B-Unternehmen, Agenturen & Dienstleister, die im Markt Autorität ausstrahlen wollen.',
    features: ['Bis zu 8 maßgeschneiderte Unterseiten', 'Headless CMS für Text- & Blog-Pflege', 'Interaktive Animationen & Liquid-Glass-Effekte', 'Technisches SEO-Fundament & Schema.org', 'DSGVO-konformes Cookie- & Tracking-Setup', '30 Tage Support nach Launch & Video-Einweisung'],
    delivery: '14–21 Werktage', cta: 'Website anfragen',
  },
  {
    label: 'Laufende Optimierung', name: 'Growth Retainer', price: '1.290 €', unit: '/ Monat',
    intro: 'Dein ausgelagertes Web- & Conversion-Team mit laufenden A/B-Tests.',
    features: ['Bis zu 2 neue Kampagnen-Landingpages / Monat', 'Monatliches A/B-Testing & Heatmap-Analysen', 'Laufende Speed- & Sicherheits-Updates', 'Direkter Support (Antwort innerhalb 24 h werktags)', 'Monatlich kündbar'],
    cta: 'Retainer anfragen',
  },
];

const STEPS = [
  { n: '01', color: 'text-indigo-400', meta: 'text-indigo-300', title: 'Strategie & Audit', text: '45-minütiges Briefing. Wir analysieren Zielgruppe, Wertversprechen und Mitbewerber und legen die Conversion-Architektur fest.', time: 'Tag 1–2' },
  { n: '02', color: 'text-purple-400', meta: 'text-purple-300', title: 'Wireframe & Copy', text: 'Wir schreiben die Texte und erstellen ein strukturiertes Wireframe. Du gibst das Fundament frei.', time: 'Tag 3–5' },
  { n: '03', color: 'text-amber-300', meta: 'text-amber-200', title: 'Design & Code', text: 'Wir gestalten die Seite in Figma und setzen sie mit modernen Web-Standards um.', time: 'Tag 6–10' },
  { n: '04', color: 'text-emerald-400', meta: 'text-emerald-300', title: 'Testing & Launch', text: 'Core-Web-Vitals- und PageSpeed-Prüfung, Tracking-Verifizierung und schlüsselfertiger Go-live auf deiner Domain.', time: 'Tag 11–12' },
];

const FAQ = [
  { q: 'Wie kommt die neue Website auf meine Domain?', a: 'Das übernehmen wir beim Launch: Bei deinem Domain-Anbieter (z. B. IONOS, Strato, Cloudflare) wird ein CNAME- oder A-Record gesetzt — als Hauptseite oder als Subdomain. Das SSL-Zertifikat wird automatisch ausgestellt.' },
  { q: 'Gehören Website und Quellcode zu 100 % mir?', a: 'Ja. Nach Abschluss und Bezahlung übertragen wir dir alle Nutzungsrechte, die Figma-Dateien und den Quellcode. Keine versteckten Lizenzgebühren, kein Plattform-Lock-in.' },
  { q: 'Warum kostet das mehr als ein 500-€-Template?', a: 'Ein Template sieht oft nett aus, scheitert aber in der Praxis: lange Ladezeiten, fehlende Texte, viele Plugins mit Sicherheitsrisiken und kein Conversion-Fokus. Wir bauen ein Vertriebswerkzeug, das dein Werbebudget in Anfragen verwandeln soll.' },
  { q: 'Kann ich Texte und Bilder später selbst ändern?', a: 'Ja. Auf Wunsch binden wir ein Headless CMS (z. B. Sanity oder Markdown) an. Du bekommst ein kurzes Video-Tutorial und kannst Inhalte ohne Programmierkenntnisse anpassen.' },
  { q: 'Gibt es eine Zusage zu Ladezeiten (PageSpeed)?', a: 'Ja. Für alle von uns programmierten Seiten sagen wir einen Google-PageSpeed-Score von 90+ auf Mobilgeräten und 95+ auf dem Desktop zu.' },
  { q: 'Wie geht ihr mit Datenschutz um?', a: 'Datenschutz ist unser Kerngeschäft: RealSync Dynamics AI baut Governance-Software für DSGVO und EU AI Act. Tracking, Formulare und Einbindungen planen wir von Anfang an datensparsam und dokumentiert.' },
];

const BUDGETS = [
  { value: '1.800 € – 2.500 € (Landingpage)' },
  { value: '2.500 € – 5.000 € (Full Website)' },
  { value: '5.000 € – 10.000 €+ (SaaS / Platform)' },
  { value: 'Laufender Growth Retainer' },
];

const NAV = [
  { href: '#preisanalyse', label: 'Preisanalyse' },
  { href: '#leistungen', label: 'Leistungen' },
  { href: '#kalkulator', label: 'Kalkulator' },
  { href: '#konzepte', label: 'Designkonzepte' },
  { href: '#pakete', label: 'Pakete' },
  { href: '#faq', label: 'FAQ' },
];

function scrollToContact() {
  document.getElementById('kontakt')?.scrollIntoView({ behavior: 'smooth' });
}

function SectionHead({ eyebrow, eyebrowClass = 'text-indigo-400', title, children }: { eyebrow: string; eyebrowClass?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="text-center max-w-3xl mx-auto mb-14">
      <p className={`text-xs font-semibold tracking-wider uppercase mb-2 ${eyebrowClass}`}>{eyebrow}</p>
      <h2 className="wst-display text-3xl sm:text-5xl font-medium tracking-tight mb-4">{title}</h2>
      {children && <p className="text-[#f4f2ee]/70 text-base leading-relaxed">{children}</p>}
    </div>
  );
}

export function WebStudioLanding() {
  const [calcType, setCalcType] = useState('landingpage');
  const [addons, setAddons] = useState<Record<Addon['key'], boolean>>({ copy: true, cms: false, lang: false, express: false });
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [budget, setBudget] = useState(BUDGETS[1].value);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { price, days } = useMemo(() => {
    const selected = PROJECT_TYPES.find((p) => p.id === calcType) ?? PROJECT_TYPES[0];
    let p = selected.basePrice;
    let d = selected.baseDays;
    if (addons.copy) { p += 590; d += 2; }
    if (addons.cms) { p += 490; d += 2; }
    if (addons.lang) { p += 690; d += 3; }
    if (addons.express) { p += 790; d = Math.max(4, Math.round(d * 0.55)); }
    return { price: p, days: d };
  }, [calcType, addons]);

  const applyConfig = () => {
    const selected = PROJECT_TYPES.find((p) => p.id === calcType)?.name ?? 'Web-Projekt';
    const extras = ADDONS.filter((a) => addons[a.key]).map((a) => a.label);
    setDetails(`Konfiguration aus Kalkulator: ${selected} (~${price.toLocaleString('de-DE')} €, ca. ${days} Werktage). Optionen: ${extras.length ? extras.join(', ') : 'Standard'}.`);
    scrollToContact();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError(null);
    try {
      if (shouldUseFnProxy()) await ensureCsrfCookie();
      const url = edgeFunctionUrl('sales-lead');
      const resp = await fetch(url, fnFetchInit(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim(),
          company: company.trim() || undefined,
          use_case: 'website',
          message: `Budget: ${budget}\n\n${details.trim()}`.slice(0, 4000),
          source: 'web-studio',
          path: '/web-studio',
        }),
      }));
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(body.error?.message ?? `HTTP ${resp.status}`);
      }
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const mailtoHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Projektanfrage Web-Studio${name ? ` – ${name}` : ''}`)}&body=${encodeURIComponent(`Budget: ${budget}\n\n${details}`)}`;

  return (
    <div className="wst">
      <SEOHead />

      {/* HERO */}
      <div className="wst-hero-bg relative min-h-screen flex flex-col">
        <header className="w-full">
          <nav aria-label="Hauptnavigation" className="w-full py-5 px-4 sm:px-8 flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
              <img src="/brand/logo-square-400.svg" alt="" width={32} height={32} className="h-8 w-8" />
              <span className="flex flex-col">
                <span className="wst-display font-semibold tracking-tight text-lg leading-tight">
                  RealSync <span className="text-indigo-400">Dynamics</span>
                </span>
                <span className="wst-mono text-[10px] text-[#f4f2ee]/50 tracking-wider uppercase">Web-Studio</span>
              </span>
            </Link>

            <ul className="hidden lg:flex items-center gap-7 text-sm font-medium">
              {NAV.map((n) => (
                <li key={n.href}>
                  <a href={n.href} className="text-[#f4f2ee]/85 hover:text-white transition-colors">{n.label}</a>
                </li>
              ))}
            </ul>

            <a href="#kontakt" className="wst-btn rounded-full px-5 py-2 text-sm">Projekt anfragen</a>
          </nav>
          <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </header>

        <section className="relative flex-1 flex flex-col items-center justify-center px-4 py-12 text-center">
          <div className="inline-flex flex-wrap justify-center items-center gap-2 px-3 py-1 mb-5 rounded-full wst-glass border border-white/10 text-xs text-[#f4f2ee]/80">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
            <span>RealSync Dynamics AI</span>
            <span className="text-[#f4f2ee]/40" aria-hidden="true">·</span>
            <span>Web- & Landingpage-Systeme</span>
            <span className="text-[#f4f2ee]/40" aria-hidden="true">·</span>
            <span className="text-emerald-400">Launch in 7–14 Tagen</span>
          </div>

          <p aria-hidden="true" className="wst-display select-none font-normal leading-[1.02] tracking-[-0.024em] text-[64px] sm:text-[110px] md:text-[150px] lg:text-[190px]">
            RealSync <span className="wst-wordmark-gradient">AI</span>
          </p>

          <h1 className="wst-display text-2xl sm:text-3xl font-medium tracking-tight mt-2 max-w-3xl">
            High-Converting Landingpages &amp; moderne Websites
          </h1>
          <p className="text-[#d4d0c9] text-base sm:text-lg leading-8 max-w-xl mt-3">
            Keine Baukasten-Templates. Kein Agentur-Overhead. Festpreis, messbare Conversion und Datenschutz vom Governance-Spezialisten.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 mt-7">
            <a href="#kontakt" className="wst-btn group rounded-full px-7 py-5 text-base tracking-tight">
              <span>Kostenloses Erstgespräch anfragen</span>
              <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 group-hover:opacity-100 transition-all" aria-hidden="true" />
            </a>
            <a href="#kalkulator" className="px-6 py-4 text-sm font-medium text-[#f4f2ee]/80 hover:text-white transition-colors flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" aria-hidden="true" />
              <span>Projektkosten berechnen</span>
            </a>
          </div>
        </section>

        <ul className="w-full pb-10 px-4 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-[#f4f2ee]/55">
          {['Festpreis statt Stundensatz', '100 % Code-Eigentum', 'PageSpeed 90+ zugesagt', 'DSGVO-konformes Tracking'].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-400" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
      </div>

      <main>
        {/* PREISANALYSE */}
        <section id="preisanalyse" className="py-24 px-4 sm:px-6 border-t border-white/5 bg-[hsl(260_87%_3%)]">
          <div className="max-w-6xl mx-auto">
            <SectionHead eyebrow="Marktüberblick DACH 2026" title="Was kostet eine professionelle Website wirklich?">
              Typische Preisspannen in Deutschland, Österreich und der Schweiz — damit du Angebote einordnen und teure Folgekosten vermeiden kannst.
            </SectionHead>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
              <div className="rounded-3xl p-8 wst-glass border border-white/10 flex flex-col justify-between">
                <div>
                  <p className="wst-mono text-xs uppercase tracking-wider text-[#f4f2ee]/50 mb-2">Modell 1</p>
                  <h3 className="text-xl font-semibold mb-1">Freelancer-Templates</h3>
                  <p className="wst-mono text-2xl font-bold text-[#f4f2ee]/70 mb-4">300 € – 900 €</p>
                  <p className="text-sm text-[#f4f2ee]/60 mb-6 leading-relaxed">Generische WordPress- oder Wix-Vorlagen, schnell angepasst — oft ohne Blick auf dein Geschäftsmodell.</p>
                  <ul className="space-y-2.5 text-xs text-red-400/90 mb-6">
                    <li>✕ Häufig mehrere Sekunden Ladezeit</li>
                    <li>✕ Kaum Conversion-Fokus („Visitenkarte“)</li>
                    <li>✕ Texte musst du meist selbst schreiben</li>
                    <li>✕ Wartungsaufwand durch viele Plugins</li>
                  </ul>
                </div>
                <p className="pt-4 border-t border-white/10 text-xs text-[#f4f2ee]/50">Fazit: Günstig im Einkauf, teuer, wenn Werbebudget an schwacher Conversion verpufft.</p>
              </div>

              <div className="rounded-3xl p-8 wst-glass border-2 border-indigo-500/60 bg-gradient-to-b from-indigo-950/20 via-black/40 to-black/60 shadow-2xl shadow-indigo-500/10 flex flex-col justify-between relative md:-translate-y-2 overflow-visible">
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[11px] font-semibold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-lg whitespace-nowrap">RealSync Web-Studio</span>
                <div>
                  <p className="wst-mono text-xs uppercase tracking-wider text-indigo-400 mb-2">Unser Studio</p>
                  <h3 className="text-2xl font-semibold mb-1">High-Performance Studio</h3>
                  <p className="wst-mono text-3xl font-bold text-white mb-4">1.890 € – 3.890 €</p>
                  <p className="text-sm text-[#f4f2ee]/80 mb-6 leading-relaxed">Direkte Zusammenarbeit mit Design und Entwicklung — maßgeschneidert, schnell und auf Conversion gebaut.</p>
                  <ul className="space-y-2.5 text-xs text-emerald-400 mb-6">
                    {['PageSpeed 90+ mobil / 95+ Desktop zugesagt', 'Verkaufspsychologisches Copywriting inklusive', 'Figma-Design & Code nach Maß', 'Lieferung in 7–14 Tagen', '100 % Eigentum — kein Plattform-Lock-in'].map((t) => (
                      <li key={t} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />{t}</li>
                    ))}
                  </ul>
                </div>
                <a href="#kontakt" className="wst-btn wst-btn-primary w-full rounded-xl py-3 text-sm">
                  Unverbindlich anfragen <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </a>
              </div>

              <div className="rounded-3xl p-8 wst-glass border border-white/10 flex flex-col justify-between">
                <div>
                  <p className="wst-mono text-xs uppercase tracking-wider text-[#f4f2ee]/50 mb-2">Modell 3</p>
                  <h3 className="text-xl font-semibold mb-1">Klassische Werbeagentur</h3>
                  <p className="wst-mono text-2xl font-bold text-[#f4f2ee]/70 mb-4">8.000 € – 25.000 €+</p>
                  <p className="text-sm text-[#f4f2ee]/60 mb-6 leading-relaxed">Große Teams mit Account-Management und Creative Direction — du bezahlst einen spürbaren Anteil Overhead mit.</p>
                  <ul className="space-y-2.5 text-xs text-amber-300 mb-6">
                    <li>⚠ Oft 8–16 Wochen bis zum Launch</li>
                    <li>⚠ Viele Meetings & Freigabeschleifen</li>
                    <li>⚠ Umsetzung häufig im Juniorteam</li>
                    <li>⚠ Oft laufende Wartungsverträge</li>
                  </ul>
                </div>
                <p className="pt-4 border-t border-white/10 text-xs text-[#f4f2ee]/50">Fazit: Sinnvoll für große Kampagnen mit vielen Beteiligten.</p>
              </div>
            </div>

            <dl className="rounded-2xl p-6 wst-glass border border-white/10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {[
                { v: 'Festpreis', l: 'Kein Stundensatz, keine Nachträge', c: 'text-indigo-400' },
                { v: '90+', l: 'PageSpeed mobil (zugesagt)', c: 'text-purple-400' },
                { v: '7–14 Tage', l: 'Lieferzeit Landingpage', c: 'text-amber-300' },
                { v: '100 %', l: 'Code- & Design-Eigentum beim Kunden', c: 'text-emerald-400' },
              ].map((s) => (
                <div key={s.l} className="flex flex-col-reverse">
                  <dt className="text-xs text-[#f4f2ee]/60 mt-1">{s.l}</dt>
                  <dd className={`wst-mono text-2xl sm:text-3xl font-bold ${s.c}`}>{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* LEISTUNGEN */}
        <section id="leistungen" className="py-24 px-4 sm:px-6 bg-[hsl(260_87%_2.5%)]">
          <div className="max-w-6xl mx-auto">
            <SectionHead eyebrow="Alles aus einer Hand" eyebrowClass="text-purple-400" title="Unser Leistungsportfolio">
              Design, Text und Programmierung ohne Schnittstellenverluste.
            </SectionHead>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {SERVICES.map((s, i) => {
                const c = SERVICE_COLORS[s.color];
                const Icon = s.icon;
                return (
                  <article key={s.title} className={`p-8 rounded-3xl wst-glass border border-white/10 ${c.border} transition-colors group`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${c.text} ${c.bg} group-hover:scale-110 transition-transform`}>
                      <Icon className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <p className={`wst-mono text-xs mb-2 ${c.text}`}>{String(i + 1).padStart(2, '0')}. Service</p>
                    <h3 className="wst-display text-xl font-semibold mb-3">{s.title}</h3>
                    <p className="text-sm text-[#f4f2ee]/70 leading-relaxed mb-4">{s.text}</p>
                    <p className="text-xs text-[#f4f2ee]/50 border-t border-white/5 pt-3">Ideal für: {s.fit}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* DESIGNKONZEPTE */}
        <section id="konzepte" className="py-24 px-4 sm:px-6 border-t border-white/5 bg-[hsl(260_87%_3%)]">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-6">
              <div>
                <p className="text-xs font-semibold tracking-wider uppercase text-indigo-400 mb-2">Stilrichtungen</p>
                <h2 className="wst-display text-3xl sm:text-5xl font-medium tracking-tight">Designkonzepte</h2>
              </div>
              <p className="text-[#f4f2ee]/70 text-sm max-w-md">
                Beispielhafte Entwürfe, die zeigen, wie wir an unterschiedliche Branchen herangehen. Es sind Konzepte, keine Kundenprojekte.
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {CONCEPTS.map((c) => (
                <article key={c.title} className="rounded-3xl overflow-hidden wst-glass border border-white/10 hover:border-indigo-500/40 transition-colors flex flex-col group">
                  <div className="relative aspect-video overflow-hidden bg-black/40">
                    <img src={c.image} alt={`Designkonzept ${c.title}`} width={800} height={447} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <span className="absolute top-4 left-4 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-indigo-200 border border-indigo-500/30">Konzept</span>
                  </div>
                  <div className="p-7">
                    <p className="wst-mono text-xs text-indigo-400 mb-1">{c.category}</p>
                    <h3 className="wst-display text-xl font-semibold mb-2">{c.title}</h3>
                    <p className="text-sm text-[#f4f2ee]/70 leading-relaxed">{c.desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* KALKULATOR */}
        <section id="kalkulator" className="py-24 px-4 sm:px-6 bg-gradient-to-b from-[hsl(260_87%_3%)] to-[hsl(260_87%_2%)]">
          <div className="max-w-4xl mx-auto">
            <SectionHead eyebrow="Transparenter Richtwert in 30 Sekunden" title="Interaktiver Projektkalkulator">
              Konfiguriere deinen Projektumfang und erhalte sofort einen Richtpreis und die voraussichtliche Umsetzungsdauer.
            </SectionHead>

            <div className="rounded-3xl wst-glass border border-white/15 shadow-2xl">
              <div className="p-6 sm:p-10">
                <fieldset className="mb-8">
                  <legend className="block text-xs uppercase tracking-wider text-[#f4f2ee]/60 mb-3 font-semibold">1. Projekttyp</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PROJECT_TYPES.map((pt) => {
                      const selected = calcType === pt.id;
                      const Icon = pt.icon;
                      return (
                        <button
                          key={pt.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setCalcType(pt.id)}
                          className={`p-4 rounded-2xl text-left border transition-colors cursor-pointer flex items-start gap-3.5 ${selected ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10' : 'border-white/10 hover:border-white/20 bg-white/[0.02]'}`}
                        >
                          <span className={`p-2 rounded-xl shrink-0 ${selected ? 'bg-indigo-500 text-white' : 'bg-white/5 text-[#f4f2ee]/70'}`}>
                            <Icon className="w-4 h-4" aria-hidden="true" />
                          </span>
                          <span className="flex-1">
                            <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                              <span>{pt.name}</span>
                              <span className="wst-mono text-xs opacity-75 whitespace-nowrap">ab {pt.basePrice.toLocaleString('de-DE')} €</span>
                            </span>
                            <span className="block text-xs text-[#f4f2ee]/60 mt-1 leading-snug">{pt.desc}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="pt-6 border-t border-white/10">
                  <legend className="block text-xs uppercase tracking-wider text-[#f4f2ee]/60 mb-3 font-semibold">2. Zusatzoptionen</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ADDONS.map((a) => {
                      const on = addons[a.key];
                      const Icon = a.icon;
                      return (
                        <button
                          key={a.key}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setAddons((prev) => ({ ...prev, [a.key]: !prev[a.key] }))}
                          className={`p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 cursor-pointer transition-colors ${on ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20'}`}
                        >
                          <span className="flex items-center gap-3">
                            <Icon className={`w-4 h-4 shrink-0 ${a.iconClass}`} aria-hidden="true" />
                            <span>
                              <span className="block text-xs font-semibold">{a.label}</span>
                              <span className="block text-[11px] text-[#f4f2ee]/60">{a.hint}</span>
                            </span>
                          </span>
                          <span className="wst-mono text-xs font-medium text-[#f4f2ee]/80 whitespace-nowrap">+{a.price} €</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </div>

              <div className="border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-6 bg-black/40 p-6 sm:p-8 rounded-b-3xl" aria-live="polite">
                <div>
                  <p className="wst-mono text-xs text-[#f4f2ee]/60 uppercase tracking-wider">Geschätzter Festpreis</p>
                  <p className="flex items-baseline gap-3">
                    <span className="wst-mono text-3xl sm:text-4xl font-bold text-white">{price.toLocaleString('de-DE')} €</span>
                    <span className="text-xs text-[#f4f2ee]/60">netto zzgl. USt.</span>
                  </p>
                  <p className="flex items-center gap-2 mt-1 text-xs text-indigo-300">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    Voraussichtliche Umsetzungsdauer: ca. {days} Werktage
                  </p>
                </div>
                <button type="button" onClick={applyConfig} className="wst-btn wst-btn-primary rounded-xl px-6 py-3.5 text-sm w-full sm:w-auto">
                  Mit dieser Auswahl anfragen <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-[#f4f2ee]/50">Richtwert, kein verbindliches Angebot. Das Festpreis-Angebot erhältst du nach dem Erstgespräch.</p>
          </div>
        </section>

        {/* PAKETE */}
        <section id="pakete" className="py-24 px-4 sm:px-6 bg-[hsl(260_87%_2.5%)] border-t border-white/5">
          <div className="max-w-6xl mx-auto">
            <SectionHead eyebrow="Klare Konditionen ohne böse Überraschungen" title="Transparente Festpreis-Pakete">
              Keine unkalkulierbaren Stundensätze, keine versteckten Posten. Du weißt vorab, was du investierst und wann dein Projekt live geht.
            </SectionHead>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PACKAGES.map((p) => (
                <article
                  key={p.name}
                  className={`p-8 rounded-3xl wst-glass flex flex-col justify-between relative ${p.featured ? 'border-2 border-indigo-500/80 bg-gradient-to-b from-indigo-950/30 to-black/70 shadow-2xl overflow-visible' : 'border border-white/10'}`}
                >
                  {p.featured && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-md whitespace-nowrap">Beliebteste Wahl</span>
                  )}
                  <div>
                    <p className={`wst-mono text-xs uppercase mb-2 ${p.featured ? 'text-indigo-400' : 'text-[#f4f2ee]/60'}`}>{p.label}</p>
                    <h3 className="wst-display text-2xl font-semibold mb-1">{p.name}</h3>
                    <p className="wst-mono text-3xl font-bold text-white mb-4">
                      {p.price} <span className="text-xs text-[#f4f2ee]/50 font-normal">{p.unit}</span>
                    </p>
                    <p className="text-xs text-[#f4f2ee]/75 mb-6 leading-relaxed">{p.intro}</p>
                    <ul className="space-y-3 text-xs text-[#f4f2ee]/85 mb-8 border-t border-white/10 pt-6">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />{f}</li>
                      ))}
                      {p.delivery && (
                        <li className="flex items-center gap-2 text-indigo-300 font-medium"><Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />Lieferzeit: {p.delivery}</li>
                      )}
                    </ul>
                  </div>
                  <a
                    href="#kontakt"
                    onClick={() => setDetails(`Anfrage für Paket: ${p.name} (${p.price}${p.unit === '/ Monat' ? '/Monat' : ''})`)}
                    className={`wst-btn w-full rounded-xl py-3 text-xs font-semibold ${p.featured ? 'wst-btn-primary' : ''}`}
                  >
                    {p.cta}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* PROZESS */}
        <section className="py-24 px-4 sm:px-6 bg-[hsl(260_87%_3%)] border-t border-white/5" aria-labelledby="wst-prozess">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <p className="text-xs font-semibold tracking-wider uppercase text-amber-300 mb-2">Strukturiert & ohne Reibung</p>
              <h2 id="wst-prozess" className="wst-display text-3xl sm:text-5xl font-medium tracking-tight mb-4">In 4 Schritten zum Launch</h2>
              <p className="text-[#f4f2ee]/70 text-base leading-relaxed">Ein transparenter Ablauf, bei dem du jederzeit weißt, was als Nächstes passiert.</p>
            </div>
            <ol className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {STEPS.map((s) => (
                <li key={s.n} className="p-6 rounded-2xl wst-glass border border-white/10">
                  <p className={`wst-mono text-3xl font-bold mb-3 ${s.color}`} aria-hidden="true">{s.n}</p>
                  <h3 className="wst-display text-lg font-semibold mb-2">{s.title}</h3>
                  <p className="text-xs text-[#f4f2ee]/70 leading-relaxed">{s.text}</p>
                  <p className={`wst-mono mt-4 text-[11px] ${s.meta}`}>Dauer: {s.time}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-24 px-4 sm:px-6 bg-[hsl(260_87%_2.5%)] border-t border-white/5">
          <div className="max-w-4xl mx-auto">
            <SectionHead eyebrow="Klarheit vor Projektstart" title="Häufig gestellte Fragen">
              Rechte, Technologie, Zusammenarbeit und Go-live.
            </SectionHead>
            <div className="space-y-4">
              {FAQ.map((f, i) => {
                const open = openFaq === i;
                return (
                  <div key={f.q} className="rounded-2xl wst-glass border border-white/10">
                    <h3>
                      <button
                        type="button"
                        id={`wst-faq-q-${i}`}
                        aria-expanded={open}
                        aria-controls={`wst-faq-a-${i}`}
                        onClick={() => setOpenFaq(open ? null : i)}
                        className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 cursor-pointer text-sm sm:text-base font-semibold"
                      >
                        {f.q}
                        <ChevronDown className={`w-5 h-5 text-indigo-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                      </button>
                    </h3>
                    <div
                      id={`wst-faq-a-${i}`}
                      role="region"
                      aria-labelledby={`wst-faq-q-${i}`}
                      hidden={!open}
                      className="px-5 pb-5 sm:px-6 sm:pb-6 pt-4 text-sm text-[#f4f2ee]/75 leading-relaxed border-t border-white/5"
                    >
                      {f.a}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* KONTAKT */}
        <section id="kontakt" className="py-24 px-4 sm:px-6 bg-[hsl(260_87%_3%)] border-t border-white/5">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-3xl p-6 sm:p-12 wst-glass border border-white/15 shadow-2xl">
              {sent ? (
                <div className="py-12 flex flex-col items-center text-center" role="status">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-emerald-400 mb-6 bg-emerald-500/10">
                    <CheckCircle2 className="w-10 h-10" aria-hidden="true" />
                  </div>
                  <h2 className="wst-display text-3xl font-bold mb-3">Anfrage ist angekommen</h2>
                  <p className="text-[#f4f2ee]/75 text-sm max-w-md mb-8 leading-relaxed">
                    Danke{name ? `, ${name}` : ''}! Wir prüfen deine Anforderungen und melden uns innerhalb eines Werktags per E-Mail.
                  </p>
                  <Link to="/" className="text-sm text-indigo-300 hover:text-white">Zur RealSync-Governance-Plattform →</Link>
                </div>
              ) : (
                <>
                  <div className="text-center max-w-xl mx-auto mb-10">
                    <p className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full wst-glass border border-white/10 text-xs text-indigo-400 mb-3">
                      <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                      Kostenloses 30-Minuten-Erstgespräch
                    </p>
                    <h2 className="wst-display text-2xl sm:text-4xl font-semibold mb-3">Lass uns über dein Projekt sprechen</h2>
                    <p className="text-sm text-[#f4f2ee]/70 leading-relaxed">
                      Beschreibe kurz dein Vorhaben oder übernimm die Daten aus dem Kalkulator. Wir antworten innerhalb eines Werktags.
                    </p>
                  </div>

                  <form onSubmit={submit} className="space-y-4 max-w-2xl mx-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="wst-name" className="block text-xs font-medium text-[#f4f2ee]/80 mb-1.5">Dein Name *</label>
                        <input id="wst-name" type="text" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Alex Müller" className="wst-field" />
                      </div>
                      <div>
                        <label htmlFor="wst-email" className="block text-xs font-medium text-[#f4f2ee]/80 mb-1.5">Geschäftliche E-Mail *</label>
                        <input id="wst-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@unternehmen.de" className="wst-field" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="wst-company" className="block text-xs font-medium text-[#f4f2ee]/80 mb-1.5">Unternehmen / aktuelle Website</label>
                        <input id="wst-company" type="text" autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="z. B. Acme GmbH (acme.de)" className="wst-field" />
                      </div>
                      <div>
                        <label htmlFor="wst-budget" className="block text-xs font-medium text-[#f4f2ee]/80 mb-1.5">Geplanter Budgetrahmen</label>
                        <select id="wst-budget" value={budget} onChange={(e) => setBudget(e.target.value)} className="wst-field cursor-pointer">
                          {BUDGETS.map((b) => <option key={b.value} value={b.value}>{b.value}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="wst-details" className="block text-xs font-medium text-[#f4f2ee]/80 mb-1.5">Projekt-Details & Zielsetzung</label>
                      <textarea id="wst-details" rows={4} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="z. B. neue Werbekampagne, Relaunch der Hauptseite, höhere Conversion-Rate …" className="wst-field" />
                    </div>

                    {error && (
                      <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                        Die Anfrage konnte nicht gesendet werden ({error}). Schreib uns gern direkt an{' '}
                        <a href={mailtoHref} className="underline">{CONTACT_EMAIL}</a>.
                      </p>
                    )}

                    <button type="submit" disabled={sending} className="wst-btn wst-btn-primary w-full rounded-xl py-4 text-sm mt-2 disabled:opacity-60 disabled:cursor-wait">
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
                      {sending ? 'Wird gesendet …' : 'Unverbindliche Projektanfrage absenden'}
                    </button>

                    <p className="text-[11px] text-[#f4f2ee]/50 text-center leading-relaxed">
                      Wir verwenden deine Angaben nur zur Bearbeitung der Anfrage. Details in der{' '}
                      <Link to="/datenschutz" className="underline hover:text-white">Datenschutzerklärung</Link>.
                    </p>
                    <ul className="flex flex-wrap items-center justify-center gap-4 pt-1 text-[11px] text-[#f4f2ee]/50">
                      <li className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" /> Unverbindlich & kostenlos</li>
                      <li className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" /> Antwort werktags &lt; 24 h</li>
                    </ul>
                  </form>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full py-12 px-4 sm:px-8 border-t border-white/10 bg-black/60 text-xs text-[#f4f2ee]/60">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-3">
            <img src="/brand/logo-square-400.svg" alt="" width={24} height={24} className="h-6 w-6" />
            <span className="wst-display font-semibold text-[#f4f2ee]">RealSync Dynamics AI</span>
          </Link>
          <nav aria-label="Fußzeile" className="flex flex-wrap items-center justify-center gap-6">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="hover:text-[#f4f2ee] transition-colors">{n.label}</a>
            ))}
            <Link to="/impressum" className="hover:text-[#f4f2ee] transition-colors">Impressum</Link>
            <Link to="/datenschutz" className="hover:text-[#f4f2ee] transition-colors">Datenschutz</Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-[#f4f2ee] transition-colors">{CONTACT_EMAIL}</a>
          </nav>
          <p className="text-[11px] text-[#f4f2ee]/40">© {new Date().getFullYear()} RealSync Dynamics AI</p>
        </div>
      </footer>
    </div>
  );
}
