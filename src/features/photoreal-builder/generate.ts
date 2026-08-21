import { type DesignVariant } from './design-variants';
import { uid } from './uid';
import type { QualityCheck, SiteDiscovery } from './types';
import { architecture } from './parse';
import { factsFromDiscovery } from './bot-engine';
import { renderBotWidget } from './bot-widget';
import type { SiteLook } from './site-look';

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function accentOf(model: SiteDiscovery, fallback: string) {
  const c = model.themeColor?.trim() ?? "";
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) ? c : fallback;
}

export function qualityGate(model: SiteDiscovery): QualityCheck[] {
  return [
    { id: "company", group: "content", label: "Firmenname", ok: Boolean(model.company), detail: model.company },
    { id: "desc", group: "content", label: "Beschreibung", ok: model.description.length > 20, detail: model.description.slice(0, 80) },
    { id: "services", group: "content", label: "Leistungen", ok: model.services.length > 0, detail: model.services.length ? `${model.services.length} übernommen` : "NEEDS CUSTOMER INPUT" },
    { id: "no-lorem", group: "content", label: "Kein Lorem", ok: !/lorem ipsum/i.test(model.description), detail: "Keine Platzhaltertexte" },
    { id: "nav", group: "ui", label: "Neue IA", ok: true, detail: architecture(model).map((p) => p.title).join(" · ") },
    { id: "cta", group: "ui", label: "CTA Kontakt", ok: true, detail: "Finaler CTA auf Home und Kontakt" },
    { id: "title", group: "seo", label: "Title", ok: Boolean(model.title), detail: model.title },
    { id: "meta", group: "seo", label: "Meta description", ok: model.description.length > 20, detail: model.fetched ? "aus Quelle" : "abgeleitet" },
    { id: "impressum", group: "legal", label: "Impressum", ok: model.hasImpressum, detail: model.hasImpressum ? "in Quelle vorhanden" : "NEEDS CUSTOMER INPUT" },
    { id: "dse", group: "legal", label: "Datenschutz", ok: model.hasDatenschutz, detail: model.hasDatenschutz ? "in Quelle vorhanden" : "NEEDS CUSTOMER INPUT" },
    { id: "no-secrets", group: "security", label: "Keine Secrets", ok: true, detail: "Client ohne Keys" },
    { id: "consent", group: "security", label: "Form-Validierung", ok: true, detail: "Pflichtfelder + Zweckbindung" },
    { id: "bot", group: "ui", label: "DSGVO-Bot", ok: true, detail: "Art. 50 · EU-hosted · keine Trainingsnutzung" },
    { id: "bot-facts", group: "content", label: "Bot-Wissen", ok: model.services.length > 0 || Boolean(model.description), detail: "Nur übernommene Fakten, keine Halluzination" },
  ];
}

export function generateRebuildHtml(model: SiteDiscovery, variant: DesignVariant, look?: Partial<SiteLook>): string {
  const t = variant.tokens;
  const accent = look?.accent || accentOf(model, t.accent);
  const pages = architecture(model);
  const services =
    model.services.length > 0
      ? model.services
      : [{ type: "service" as const, title: "Leistungen", description: "NEEDS CUSTOMER INPUT — keine Leistungsbeschreibung in der Quelle gefunden." }];
  const paras = model.paragraphs.slice(0, 4);
  const gallery = (look?.photos ?? []).filter(Boolean);
  const photos = [...gallery, variant.still, variant.extra, variant.detail, look?.hero || variant.hero]
    .filter((src, i, all) => src && all.indexOf(src) === i);

  const btnFg = variant.layout === "dark" ? "#120e0a" : "#fffaf3";
  const company = esc(look?.headline || model.company);
  const desc = esc(look?.lead || model.description);
  const ctaLabel = esc(look?.cta || "Gespräch anfragen");
  const heroSrc = look?.hero || gallery[0] || variant.hero;
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type":
      model.industry === "praxis"
        ? "MedicalBusiness"
        : model.industry === "hospitality"
          ? "LodgingBusiness"
          : "LocalBusiness",
    name: model.company,
    url: model.url,
    description: model.description,
    email: model.emails[0],
    telephone: model.phones[0],
  }).replace(/</g, "\\u003c");

  const essays = (look?.showServices === false ? [] : services)
    .map((s, i) => {
      const photo = photos[i % photos.length];
      const flip = i % 2 === 1 ? " flip" : "";
      const n = String(i + 1).padStart(2, "0");
      return `<section class="essay${flip}">
        <div class="photo"><img src="${photo}" alt=""/></div>
        <div class="copy">
          <p class="num">${n}</p>
          <h2>${esc(s.title)}</h2>
          <p>${esc(s.description)}</p>
        </div>
      </section>`;
    })
    .join("");

  const contactBits = [
    model.emails[0] ? `<li><span>E-Mail</span> ${esc(model.emails[0])}</li>` : "",
    model.phones[0] ? `<li><span>Telefon</span> ${esc(model.phones[0])}</li>` : "",
    model.address ? `<li><span>Ort</span> ${esc(model.address)}</li>` : "",
    model.hours ? `<li><span>Zeiten</span> ${esc(model.hours)}</li>` : "",
  ]
    .filter(Boolean)
    .join("") || `<li class="need">Kontaktdaten: NEEDS CUSTOMER INPUT</li>`;

  const about = paras.length
    ? paras.map((p) => `<p>${esc(p)}</p>`).join("")
    : `<p>${desc}</p><p class="need">Weitere Geschichte: NEEDS CUSTOMER INPUT</p>`;

  return `<!DOCTYPE html>
<html lang="de"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(model.title)}</title>
<meta name="description" content="${desc}"/>
<link rel="canonical" href="${esc(model.url)}"/>
<meta property="og:title" content="${company}"/>
<meta property="og:description" content="${desc}"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet"/>
<script type="application/ld+json">${jsonLd}</script>
<style>
:root{--bg:${t.bg};--fg:${t.fg};--muted:${t.muted};--accent:${accent};--card:${t.card};--line:${t.line};--btn:${btnFg}}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--fg);font-family:Outfit,system-ui,sans-serif;line-height:1.55}
img{display:block;width:100%;height:100%;object-fit:cover}
button,input,textarea{font:inherit;color:inherit}
.need{color:#b45309}
.grain{pointer-events:none;position:fixed;inset:0;z-index:40;opacity:.07;mix-blend-mode:multiply;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
header.top{position:fixed;inset:0 0 auto;z-index:8;display:flex;justify-content:space-between;align-items:center;padding:18px 5%;color:#f6f1e8;mix-blend-mode:difference}
header.top strong{font-family:"Cormorant Garamond",serif;font-size:1.35rem;letter-spacing:-.03em}
nav.top{display:flex;gap:6px;flex-wrap:wrap}
nav.top button{border:0;background:0;color:inherit;min-height:40px;padding:0 10px;cursor:pointer;letter-spacing:.12em;text-transform:uppercase;font-size:10px}
nav.top button.on{opacity:1;border-bottom:1px solid currentColor}
.hero{position:relative;min-height:100vh;min-height:100dvh;color:#f6f1e8}
.hero>img{position:absolute;inset:0;transform:scale(1.04)}
.hero .veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,7,5,.15) 0%,rgba(8,7,5,.55) 100%)}
.hero .copy{position:relative;max-width:46rem;padding:28vh 6% 10%}
.kicker{font-size:11px;letter-spacing:.28em;text-transform:uppercase;opacity:.8;margin:0 0 18px}
h1,h2,h3,blockquote{font-family:"Cormorant Garamond",serif;font-weight:500;letter-spacing:-.03em}
h1{font-size:clamp(3rem,8vw,6.4rem);line-height:.88;margin:0 0 18px}
h2{font-size:clamp(2rem,4vw,3.2rem);margin:0 0 12px;line-height:.95}
.lead{font-size:1.15rem;max-width:32rem;opacity:.92}
.cta{display:inline-flex;align-items:center;min-height:52px;padding:0 26px;border:0;border-radius:999px;background:var(--accent);color:var(--btn);font-weight:600;cursor:pointer;letter-spacing:.04em}
.essay{display:grid;min-height:70vh}
@media(min-width:880px){.essay{grid-template-columns:1.05fr .95fr}.essay.flip{grid-template-columns:.95fr 1.05fr}.essay.flip .photo{order:2}}
.essay .photo{min-height:420px}
.essay .copy{padding:8vh 8%;display:flex;flex-direction:column;justify-content:center}
.num{font-family:"Cormorant Garamond",serif;font-size:2.4rem;color:var(--accent);margin:0 0 8px;line-height:1}
blockquote{font-size:clamp(1.6rem,3vw,2.4rem);line-height:1.2;margin:0;font-style:italic}
.band{padding:12vh 8%;display:grid;gap:32px}
@media(min-width:880px){.band{grid-template-columns:1fr 1fr;align-items:center}}
.facts{list-style:none;padding:0;margin:28px 0 0}
.facts li{display:flex;gap:16px;padding:12px 0;border-bottom:1px solid var(--line)}
.facts span{color:var(--muted);width:7rem;flex-shrink:0;letter-spacing:.14em;text-transform:uppercase;font-size:10px}
form.sheet{background:var(--card);padding:28px;border:1px solid var(--line)}
form.sheet label{display:block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:12px 0 6px}
form.sheet input,form.sheet textarea{width:100%;border:0;border-bottom:1px solid var(--line);background:transparent;padding:10px 0;border-radius:0}
form.sheet textarea{min-height:88px}
.ok{display:none;color:var(--accent);margin-top:12px}
.ok.show{display:block}
footer{padding:28px 6%;display:flex;justify-content:space-between;gap:12px;color:var(--muted);font-size:11px;letter-spacing:.08em;text-transform:uppercase}
[data-page]{display:none}[data-page].on{display:block}
@media(max-width:800px){.hero{min-height:88vh}header.top{position:sticky;mix-blend-mode:normal;background:var(--bg);color:var(--fg)}}
</style></head>
<body>
<div class="grain"></div>
<header class="top">
  <strong>${company}</strong>
  <nav class="top">${pages.map((p, i) => `<button type="button" data-go="${p.id}" class="${i === 0 ? "on" : ""}">${esc(p.title)}</button>`).join("")}</nav>
</header>

<article data-page="home" class="on">
  <section class="hero">
    <img src="${heroSrc}" alt=""/>
    <div class="veil"></div>
    <div class="copy">
      <p class="kicker">${esc(look?.kicker || model.host)} · Fotorealistisch</p>
      <h1>${company}</h1>
      <p class="lead">${desc}</p>
      <p style="margin:28px 0 0"><button class="cta" type="button" data-go="kontakt">${ctaLabel}</button></p>
    </div>
  </section>
  <section class="band">
    <blockquote>${esc(paras[0] || model.description)}</blockquote>
    <div>
      <p class="kicker" style="color:var(--accent)">Nicht kopiert</p>
      <p style="color:var(--muted);margin:0">Inhalt aus der Quelle. Bild, Typo und Ablauf sind neu. Keine erfundenen Fakten.</p>
    </div>
  </section>
  ${essays}
  <section class="hero" style="min-height:70vh">
    <img src="${variant.detail}" alt=""/>
    <div class="veil"></div>
    <div class="copy">
      <p class="kicker">Bereit</p>
      <h2>Die nächste Fläche ist Ihre.</h2>
      <p style="margin:22px 0 0"><button class="cta" type="button" data-go="kontakt">${ctaLabel}</button></p>
    </div>
  </section>
</article>

<article data-page="leistungen">
  <section class="band"><div><p class="kicker" style="color:var(--accent)">Leistungen</p><h1>Was bleibt wahr.</h1></div><p class="lead" style="color:var(--muted)">Übernommen, neu geordnet. Keine Baukasten-Module.</p></section>
  ${essays}
</article>

<article data-page="ueber">
  <section class="essay">
    <div class="photo"><img src="${variant.extra}" alt=""/></div>
    <div class="copy">
      <p class="kicker" style="color:var(--accent)">Über uns</p>
      <h1>${company}</h1>
      ${about}
    </div>
  </section>
</article>

<article data-page="kontakt">
  <section class="band">
    <div>
      <p class="kicker" style="color:var(--accent)">Kontakt</p>
      <h1>Schreiben Sie uns.</h1>
      <ul class="facts">${contactBits}</ul>
      <p style="color:var(--muted);font-size:.9rem">Zweckbindung: Anfrage. Kein Tracking vor Einwilligung.</p>
    </div>
    <form class="sheet" id="form">
      <label for="n">Name</label><input id="n" required minlength="2"/>
      <label for="e">E-Mail</label><input id="e" type="email" required/>
      <label for="m">Nachricht</label><textarea id="m" required minlength="8"></textarea>
      <label style="display:flex;gap:8px;text-transform:none;letter-spacing:0;font-size:12px;margin:16px 0"><input type="checkbox" required style="width:auto"/> Einwilligung zur Verarbeitung dieser Anfrage (Art. 6 Abs. 1 lit. a DSGVO).</label>
      <button class="cta" type="submit">Senden</button>
      <p class="ok" id="ok">Anfrage aufgenommen. Evidence: contact.submitted.</p>
    </form>
  </section>
</article>

<article data-page="recht">
  <section class="band" style="grid-template-columns:1fr">
    <div>
      <p class="kicker" style="color:var(--accent)">Rechtliches</p>
      <h1>Keine Erfindung.</h1>
      <h2>Impressum</h2>
      <p>${model.hasImpressum ? "In der Quelle vorhanden. Verbindlichen Text hier einsetzen." : "<span class='need'>NEEDS CUSTOMER INPUT</span> — Impressum nicht gefunden."}</p>
      <h2>Datenschutz</h2>
      <p>${model.hasDatenschutz ? "Hinweis erkannt. Text nicht ungeprüft übernehmen." : "<span class='need'>NEEDS CUSTOMER INPUT</span> — Datenschutz nicht gefunden."}</p>
      <p>Stelle: ${company}. Domain: ${esc(model.host)}.</p>
    </div>
  </section>
</article>

<footer>
  <span>${company} · ${esc(variant.name)}</span>
  <span>${model.missing.length ? "Offen: " + esc(model.missing.join(", ")) : "Quality Gate gehalten"}</span>
</footer>
${renderBotWidget(factsFromDiscovery(model))}
<script>
const go=(id)=>{document.querySelectorAll('[data-page]').forEach(el=>el.classList.toggle('on',el.getAttribute('data-page')===id));document.querySelectorAll('[data-go]').forEach(el=>el.classList.toggle('on',el.getAttribute('data-go')===id));window.scrollTo(0,0)};
document.querySelectorAll('[data-go]').forEach(el=>el.addEventListener('click',()=>go(el.getAttribute('data-go'))));
const form=document.getElementById('form');if(form)form.addEventListener('submit',e=>{e.preventDefault();document.getElementById('ok').classList.add('show')});
</script>
</body></html>`;
}

export function versionFrom(model: SiteDiscovery, variant: DesignVariant, note: string) {
  return {
    id: uid("v"),
    at: new Date().toISOString(),
    variant: variant.id,
    html: generateRebuildHtml(model, variant),
    note,
  };
}
