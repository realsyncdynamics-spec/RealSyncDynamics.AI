import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { postEdgeFunction } from '../../lib/edgeFunction';
import { mergeBrief, parseBrief } from '../../../packages/siteos-core/src/blueprint/brief';
import { synthesizeBlueprint } from '../../../packages/siteos-core/src/blueprint/synthesize';
import { renderSite } from '../../../packages/siteos-core/src/render/renderer';
import {
  applySiteDesignTemplate,
  SITE_DESIGN_TEMPLATES,
  type SiteDesignTemplate,
} from '../../../packages/siteos-core/src/render/templates';

type Stage = 'wow' | 'full' | 'contact' | 'offer';

/**
 * Diese Seite zeigt jetzt eine **echt erzeugte** Site, kein Mock.
 *
 * Vorher standen hier drei hartkodierte Varianten und eine `previewHtml()`,
 * die Platzhalter-HTML zusammensetzte — nachgebaute Kopien der drei echten
 * Design-Templates aus `siteos-core`. Der Kunde sah ein Bild, das mit seiner
 * Domain nichts zu tun hatte, und die Seite musste das selbst zugeben
 * („Musterlayout dieser Richtung, nicht deine Website").
 *
 * Jetzt laeuft dieselbe Kette wie im angemeldeten Builder
 * (`PreviewSelectionPage`): Brief → Blueprint → Template → Render.
 * `siteos-core` ist abhaengigkeitsfrei und laeuft im Browser, deshalb braucht
 * dieser Schritt weder Anmeldung noch Serveraufruf — der Trichter bleibt
 * formularfrei, wie er es verspricht.
 *
 * Unterschied zum angemeldeten Builder, der auch hier benannt wird statt
 * ueberspielt zu werden: `siteos/discover` liest die **echten Inhalte** der
 * Ausgangsseite und braucht dafuer einen Tenant. Hier entsteht der Entwurf aus
 * Domain und erkannter Branche. Das ist eine echte Site, aber noch nicht die
 * mit den eigenen Texten.
 */
const DESIGN_ORDER: readonly SiteDesignTemplate[] = ['modern-minimal', 'bento-bold', 'dark-professional'];

/** Akzentfarben nur fuer die Auswahl-UI dieser Seite — nicht fuer die Site. */
const ACCENT: Record<SiteDesignTemplate, string> = {
  'modern-minimal': '#22d3ee',
  'bento-bold': '#8b5cf6',
  'dark-professional': '#34d399',
};

const VARIANTS = DESIGN_ORDER.map((id) => {
  const template = SITE_DESIGN_TEMPLATES.find((t) => t.id === id);
  return { id, name: template?.label ?? id, subtitle: template?.description ?? '', accent: ACCENT[id] };
});

type Variant = SiteDesignTemplate;

/** Domain zu einem lesbaren Namen machen: `kanzlei-mueller.de` → `Kanzlei Mueller`. */
function brandFromDomain(domain: string): string {
  const host = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  const label = host.split('.')[0] ?? '';
  return label
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Erzeugt eine echte Site aus der gescannten Domain.
 *
 * `parseBrief` erkennt die Branche aus dem Text, `mergeBrief` setzt den aus
 * der Domain abgeleiteten Namen darueber, `synthesizeBlueprint` baut daraus
 * den Blueprint. Deterministisch und ohne Modellaufruf — `origin.model`
 * bleibt deshalb `null`, was Art. 50 EU AI Act korrekt abbildet: hier war
 * keine generative KI beteiligt, also darf auch keine behauptet werden.
 */
function buildBlueprint(domain: string) {
  const brand = brandFromDomain(domain);
  const brief = parseBrief(brand || domain || 'Unternehmenswebsite', 'de');
  return synthesizeBlueprint(brand ? mergeBrief(brief, { name: brand }) : brief, {
    source: 'ai-builder',
    model: null,
  });
}

/** Blueprint + Template → fertiges HTML der Startseite. */
function renderVariant(blueprint: ReturnType<typeof buildBlueprint>, variant: Variant, domain: string): string {
  const pages = renderSite(applySiteDesignTemplate(blueprint, variant), { baseUrl: domain });
  return pages.find((page) => page.path === '/')?.html ?? pages[0]?.html ?? '';
}

/**
 * Breite, in der die Vorschau gerendert wird, bevor sie verkleinert wird.
 *
 * Vorher steckte die Seite ungeskaliert in einem 224 px hohen Rahmen. Ihr CSS
 * setzt `font-size: clamp(38px, 7vw, 76px)` — bei rund 300 px Rahmenbreite
 * sind 7vw etwa 21 px, der Wert faellt also auf den Mindestwert 38 px. Eine
 * 38-Pixel-Ueberschrift in einem 224-Pixel-Kasten, dazu eine Kopfzeile mit
 * `space-between`, deren zwei Textbloecke ineinanderliefen.
 *
 * Ein Vorschaubild muss die *Desktop*-Ansicht zeigen, verkleinert — nicht die
 * Seite in einen schmalen Rahmen quetschen. Deshalb wird bei 1280 px gerendert
 * und per `transform: scale()` heruntergerechnet.
 */
const PREVIEW_VIEWPORT = 1280;

/** Anfangswert, bis gemessen ist — verhindert einen leeren Rahmen im ersten Bild. */
const FALLBACK_SCALE = 300 / PREVIEW_VIEWPORT;

function ScaledPreview({ html, title, className }: { html: string; title: string; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(FALLBACK_SCALE);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / PREVIEW_VIEWPORT);
    measure();
    // Die Karten liegen in einem Grid, das bei jedem Breakpoint die Breite
    // aendert. Ohne Beobachter bliebe der Massstab der erste gemessene.
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={wrap} className={`relative overflow-hidden bg-white ${className ?? ''}`}>
      <iframe
        title={title}
        srcDoc={html}
        sandbox="allow-same-origin"
        aria-hidden="true"
        tabIndex={-1}
        className="pointer-events-none absolute left-0 top-0 border-0 bg-white"
        style={{
          width: PREVIEW_VIEWPORT,
          // Sichtbarer Ausschnitt geteilt durch den Massstab: So entspricht
          // die gerenderte Hoehe genau dem Rahmen.
          height: `calc(100% / ${scale})`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      />
    </div>
  );
}

function VariantCard({ variant, html, selected, onSelect }: { variant: typeof VARIANTS[number]; html: string; selected: boolean; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} className={`overflow-hidden rounded-2xl border text-left transition ${selected ? 'border-cyan-400 ring-2 ring-cyan-400/20' : 'border-white/10 hover:border-white/25'}`}><div className="bg-white p-2"><ScaledPreview title={`${variant.name} Vorschau`} html={html} className="h-56 w-full rounded-xl" /></div><div className="bg-[#090b10] p-4"><div className="font-semibold text-white">{variant.name}</div><div className="mt-1 text-xs text-white/50">{variant.subtitle}</div></div></button>;
}

export function DashboardPreviewPage() {
  const [params] = useSearchParams();
  const domain = params.get('domain') ?? '';
  const auditId = params.get('auditId') ?? '';
  const score = Number(params.get('score'));
  const trackers = Number(params.get('trackers'));
  const cookies = Number(params.get('cookies'));
  const severity = params.get('severity') ?? 'low';
  const [variant, setVariant] = useState<Variant>('modern-minimal');
  const [stage, setStage] = useState<Stage>('wow');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const selectedVariant = useMemo(() => VARIANTS.find((v) => v.id === variant) ?? VARIANTS[0], [variant]);
  // Der Blueprint haengt nur an der Domain — einmal bauen, dreimal rendern.
  // Die Synthese ist deterministisch, ein Neuaufbau je Variante waere reine
  // Rechenzeit ohne anderes Ergebnis.
  const blueprint = useMemo(() => buildBlueprint(domain), [domain]);
  const variantHtml = useMemo(
    () => Object.fromEntries(VARIANTS.map((v) => [v.id, renderVariant(blueprint, v.id, domain)])) as Record<Variant, string>,
    [blueprint, domain],
  );
  const scoreLabel = Number.isFinite(score) ? `${Math.round(score)}%` : '—';

  const submitLead = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!email.trim() || !consent) { setError('Bitte E-Mail-Adresse eingeben und dem Angebot per E-Mail zustimmen.'); return; }
    setSending(true);
    try {
      await postEdgeFunction('sales-lead', { name: name.trim(), email: email.trim(), company: company.trim(), use_case: 'website_rebuild', source: 'unified-entry-wow-first', intent: 'website_rebuild_purchase', tier: 'starter', path: window.location.pathname, message: `Website: ${domain}; Audit: ${auditId}; Score: ${scoreLabel}; Tracker: ${Number.isFinite(trackers) ? trackers : '—'}; Cookies: ${Number.isFinite(cookies) ? cookies : '—'}; Severity: ${severity}; Variante: ${selectedVariant.name}; marketing_consent=true` }, { requireAuth: false });
      setSent(true); setStage('offer');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Die Angaben konnten nicht übermittelt werden.'); }
    finally { setSending(false); }
  };

  const goToCheckout = (mode: 'one-time' | 'starter') => {
    const query = new URLSearchParams({ source_url: domain, audit_id: auditId, redesign: 'true', variant, tier: mode === 'one-time' ? 'governance_launch' : 'starter' });
    window.location.assign(`/checkout?${query.toString()}`);
  };

  return <main className="min-h-screen bg-[#05070b] text-white"><div className="mx-auto max-w-7xl px-5 py-8 sm:px-8"><header className="flex items-center justify-between border-b border-white/10 pb-5"><div className="font-semibold">RealSyncDynamics.AI</div><div className="text-xs text-white/40">Website Transformation · {stage === 'wow' ? 'Gestaltung wählen' : stage === 'full' ? 'Vorschau' : stage === 'contact' ? 'Kontakt' : 'Angebot'}</div></header>

    {stage === 'wow' && <><section className="mx-auto max-w-5xl py-12 text-center"><div className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">SCAN ABGESCHLOSSEN · {scoreLabel} SCORE</div><h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl">Jetzt zeigen wir dir, was aus deiner Website werden kann.</h1><p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/55">Keine Formulare. Keine Paketwahl. Der Scan deiner Website ist abgeschlossen — und aus deiner Domain wurde bereits eine vollständige Website erzeugt. Wähle die Gestaltung, in der du sie sehen möchtest.</p></section><p className="mb-4 text-center text-xs text-white/35">Echt erzeugte Seiten — dieselbe Gestaltung, die auch ausgeliefert wird.</p><section className="grid gap-5 md:grid-cols-3">{VARIANTS.map((v) => <VariantCard key={v.id} variant={v} html={variantHtml[v.id]} selected={v.id === variant} onSelect={() => setVariant(v.id)} />)}</section><section className="mx-auto mt-8 max-w-3xl rounded-2xl border border-white/10 bg-white/[.035] p-6"><div className="text-xs font-bold uppercase tracking-[.16em]" style={{ color: selectedVariant.accent }}>AUSGEWÄHLT</div><h2 className="mt-2 text-2xl font-bold">{selectedVariant.name}</h2><p className="mt-2 text-sm text-white/50">{selectedVariant.subtitle}</p><button type="button" onClick={() => setStage('full')} className="mt-5 rounded-xl px-5 py-3 text-sm font-bold text-[#05070b]" style={{ background: selectedVariant.accent }}>Diese Variante wählen → Vorschau öffnen</button></section></>}

    {stage === 'full' && <><section className="py-10"><div className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">DEINE NEUE WEBSITE · {selectedVariant.name}</div><h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">Gestaltungsrichtung: {selectedVariant.name}.</h1><p className="mt-3 max-w-3xl text-white/55">Diese Seite wurde eben erzeugt — Struktur, Typografie, Sektionen und mobile Darstellung sind echt. Die Texte stammen aus der erkannten Branche; im nächsten Schritt werden sie durch deine eigenen Inhalte ersetzt.</p></section><ScaledPreview title="Vollständige Website-Vorschau" html={variantHtml[variant]} className="h-[760px] w-full rounded-3xl border border-white/10 shadow-2xl" /><section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{['Modernes Design', 'SEO-Struktur', 'DSGVO-ready', 'EU-AI-Act-ready', 'Responsive', 'Chatbot möglich', 'Telefonbot möglich', 'Conversion optimiert'].map((x) => <div key={x} className="rounded-xl border border-white/10 bg-white/[.035] p-4 text-sm"><span className="text-emerald-400">✓</span> {x}</div>)}</section><div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between"><button type="button" onClick={() => setStage('wow')} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/70">← Andere Variante</button><button type="button" onClick={() => setStage('contact')} className="rounded-xl bg-cyan-400 px-6 py-3 text-sm font-bold text-[#05070b]">Ja, genau so → Angebot ansehen</button></div></>}

    {stage === 'contact' && <section className="mx-auto max-w-2xl py-14"><div className="text-center"><div className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">JETZT WIRD ES KONKRET</div><h1 className="mt-3 text-4xl font-extrabold">Wir bauen deine ausgewählte Website.</h1><p className="mt-4 text-white/55">Du hast die Gestaltungsrichtung gewählt. Jetzt brauchen wir nur noch deine Kontaktdaten für Angebot, Projektstart und die finale Umsetzung.</p></div><form onSubmit={submitLead} className="mt-8 space-y-4 rounded-3xl border border-white/10 bg-white/[.035] p-7"><input required value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="E-Mail-Adresse" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" /><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" /><input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Unternehmen (optional)" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" /><label className="flex gap-3 text-sm text-white/55"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" /><span>Ich möchte das Angebot und Informationen zur Umsetzung per E-Mail erhalten. Die Einwilligung kann jederzeit widerrufen werden.</span></label>{error && <div className="rounded-xl border border-red-700 bg-red-900/20 p-3 text-sm text-red-300">{error}</div>}<button disabled={sending} className="w-full rounded-xl bg-cyan-400 px-5 py-4 font-bold text-[#05070b] disabled:opacity-50">{sending ? 'Angebot wird vorbereitet …' : 'Weiter zum konkreten Angebot'}</button></form></section>}

    {stage === 'offer' && <section className="mx-auto max-w-4xl py-12"><div className="text-center"><div className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">DEIN ANGEBOT</div><h1 className="mt-3 text-4xl font-extrabold">{domain || 'Deine Website'} — fertig für den Umbau.</h1><p className="mt-4 text-white/55">Variante: <strong className="text-white">{selectedVariant.name}</strong>. Du kannst einmalig kaufen oder die Umsetzung mit dem Starter-Jahresabo kombinieren.</p></div><div className="mt-10 grid gap-5 md:grid-cols-2"><article className="rounded-3xl border border-white/10 bg-white/[.035] p-7"><div className="text-xs font-bold uppercase tracking-[.16em] text-cyan-300">EINMALIG</div><h2 className="mt-2 text-3xl font-bold">349 €</h2><p className="mt-2 text-sm text-white/50">Kompletter Website-Umbau in der ausgewählten Gestaltungsrichtung.</p><button type="button" onClick={() => goToCheckout('one-time')} className="mt-6 w-full rounded-xl bg-cyan-400 px-5 py-3 font-bold text-[#05070b]">Einmalig beauftragen</button></article><article className="rounded-3xl border border-cyan-400/40 bg-cyan-400/[.05] p-7"><div className="text-xs font-bold uppercase tracking-[.16em] text-cyan-300">STARTER · JAHRESABO</div><h2 className="mt-2 text-3xl font-bold">790 € / Jahr</h2><p className="mt-2 text-sm text-white/50">12 Monate Mindestlaufzeit. Effektiv 79 €/Monat, abgerechnet als 790 € pro Jahr.</p><button type="button" onClick={() => goToCheckout('starter')} className="mt-6 w-full rounded-xl bg-white px-5 py-3 font-bold text-[#05070b]">Starter-Jahresabo wählen</button></article></div><div className="mt-6 text-center text-xs text-white/35">Die 14-Tage-Testphase gehört ausschließlich zum Growth-Tarif und wird hier nicht angeboten.</div>{sent && <div className="mt-5 rounded-xl border border-emerald-700 bg-emerald-900/20 p-4 text-center text-sm text-emerald-300">Angebot und Kontaktdaten wurden erfasst.</div>}</section>}
  </div></main>;
}
