function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type DesignVariantId = "modern-minimal" | "bento-bold" | "dark-professional";

export type DesignVariant = {
  id: DesignVariantId;
  name: string;
  tagline: string;
  tokens: {
    bg: string;
    fg: string;
    muted: string;
    accent: string;
    card: string;
    line: string;
  };
  layout: "minimal" | "bento" | "dark";
  hero: string;
  still: string;
  extra: string;
  detail: string;
  improvements: string[];
};

export const DESIGN_VARIANTS: DesignVariant[] = [
  {
    id: "modern-minimal",
    name: "Modern Minimal",
    tagline: "Licht, Material, eine ruhige Handlung.",
    layout: "minimal",
    hero: "/landings/hero-minimal.jpg",
    still: "/landings/still-atelier.jpg",
    extra: "/landings/still-praxis.jpg",
    detail: "/landings/detail-linen.jpg",
    tokens: {
      bg: "#f6f1e8",
      fg: "#1a1610",
      muted: "#6f675c",
      accent: "#3f5c4d",
      card: "#fffaf3",
      line: "rgba(26,22,16,.12)",
    },
    improvements: [
      "Fotorealistischer Hero statt Farbfläche — der erste Blick ist das Atelier.",
      "Redaktionelle Typo, eine Handlung, kein Formular-Wall.",
      "Echte Materialität: Holz, Leinen, Keramik — nicht Stock-Gradient.",
      "Impressum und Consent sitzen unten, Tracking startet nicht vorher.",
    ],
  },
  {
    id: "bento-bold",
    name: "Bento Bold",
    tagline: "Architektur, Kacheln, Tempo.",
    layout: "bento",
    hero: "/landings/hero-bento.jpg",
    still: "/landings/still-food.jpg",
    extra: "/landings/hero-spa.jpg",
    detail: "/landings/detail-court.jpg",
    tokens: {
      bg: "#f3f1ec",
      fg: "#12110e",
      muted: "#5c5850",
      accent: "#8a3d24",
      card: "#ffffff",
      line: "rgba(18,17,14,.1)",
    },
    improvements: [
      "Magazin-Raster aus echten Fotos — Beton, Nussbaum, Tageslicht.",
      "Angebote als Bildkacheln, nicht als Textblöcke.",
      "SEO-Titel und Canonical gehören zur Seite.",
      "DSGVO-ready: keine Tracker vor der Einwilligung.",
    ],
  },
  {
    id: "dark-professional",
    name: "Dark Professional",
    tagline: "Nacht, Glas, ruhige Autorität.",
    layout: "dark",
    hero: "/landings/hero-dark.jpg",
    still: "/landings/still-hospitality.jpg",
    extra: "/landings/detail-desk.jpg",
    detail: "/landings/detail-cup.jpg",
    tokens: {
      bg: "#07080b",
      fg: "#f4efe6",
      muted: "#9a9286",
      accent: "#c4a574",
      card: "#101218",
      line: "rgba(244,239,230,.12)",
    },
    improvements: [
      "Cinematischer Nacht-Hero — Stadtlicht, Messing, dunkles Holz.",
      "Luxury-Hospitality statt Dashboard-Optik.",
      "EU-hosted, Transfer sichtbar, Consent vor Pixel.",
      "Typo und Foto tragen die Marke, nicht ein Cyan-Glow.",
    ],
  },
];

export type Industry = "atelier" | "praxis" | "hospitality" | "food" | "professional";

export function industryFromText(raw: string): Industry {
  const s = raw.toLowerCase();
  if (/arzt|praxis|zahn|klinik|physio|therapie/.test(s)) return "praxis";
  if (/hotel|spa|pension|wellness|lodge/.test(s)) return "hospitality";
  if (/restaurant|cafe|küche|kueche|gastro|bar/.test(s)) return "food";
  if (/kanzlei|anwalt|steuer|consult|agentur|finance/.test(s)) return "professional";
  return "atelier";
}

const COPY: Record<Industry, { kicker: string; headline: string; lead: string; cta: string; offers: [string, string][] }> = {
  atelier: {
    kicker: "Atelier · Handwerk",
    headline: "Räume, die man fühlen kann.",
    lead: "Material, Licht und eine ruhige Geste. Gebaut als fotorealistische Markenseite — nicht als Baukasten.",
    cta: "Atelier besuchen",
    offers: [
      ["Unikate", "Keramik, Textil, Objekt — jedes Stück ein Nachweis."],
      ["Ateliertermine", "Persönlich, begrenzt, ohne Tracking vor der Einwilligung."],
      ["Kommission", "Entwürfe mit Evidence-Pfad, EU-gehostet."],
    ],
  },
  praxis: {
    kicker: "Praxis · Ruhe",
    headline: "Ankommen, bevor behandelt wird.",
    lead: "Eine Praxis-Seite, die sich anfühlt wie der Warteraum: hell, still, vertrauenswürdig.",
    cta: "Termin anfragen",
    offers: [
      ["Erstgespräch", "45 Minuten. Zweckbindung: Terminverwaltung."],
      ["Therapie", "Individuelle Pläne, keine Drittanbieter-Pixel."],
      ["Nachsorge", "Erinnerungen nur mit Einwilligung."],
    ],
  },
  hospitality: {
    kicker: "Haus · Gastlichkeit",
    headline: "Die Nacht, in der man bleibt.",
    lead: "Fotografie statt Clipart. Ein Haus, das online so wirkt wie vor Ort.",
    cta: "Nacht anfragen",
    offers: [
      ["Suiten", "Leinen, Holz, Stille."],
      ["Küche", "Saisonal, regional, ohne Tracker."],
      ["Wald", "Terrasse, Dämmerung, laternenlicht."],
    ],
  },
  food: {
    kicker: "Küche · Saison",
    headline: "Was heute auf dem Stein liegt.",
    lead: "Stillleben statt Speisekarte als PDF. Die Küche ist das Bild.",
    cta: "Tisch reservieren",
    offers: [
      ["Mittags", "Kurze Karte, schnelle Plätze."],
      ["Abends", "Menü, ruhiges Licht."],
      ["Privat", "Der große Tisch, auf Anfrage."],
    ],
  },
  professional: {
    kicker: "Kanzlei · Klarheit",
    headline: "Ruhe, in der Entscheidungen fallen.",
    lead: "Dunkles Holz, Stadtlicht, keine Dashboard-Optik. Eine Seite für Mandate, nicht für Leadsammlungen.",
    cta: "Gespräch vereinbaren",
    offers: [
      ["Mandat", "Klarer Scope, EU-Hosting."],
      ["Gutachten", "Nachweise statt Folien."],
      ["Vertretung", "Termine ohne Tracking vor Consent."],
    ],
  },
};

export function variantById(id: string | undefined): DesignVariant {
  return DESIGN_VARIANTS.find((v) => v.id === id) ?? DESIGN_VARIANTS[0];
}

export function hostFromUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return "beispiel.de";
  try {
    const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    return new URL(withProto).hostname.replace(/^www\./, "") || "beispiel.de";
  } catch {
    return s.replace(/^https?:\/\//i, "").split("/")[0] || "beispiel.de";
  }
}

export function companyFromHost(host: string): string {
  const stem = host.split(".")[0] ?? host;
  return stem
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function variantPreviewHtml(opts: {
  host: string;
  company: string;
  variant: DesignVariant;
  industry?: Industry;
}): string {
  const { host, company, variant: v } = opts;
  const industry = opts.industry ?? industryFromText(`${host} ${company}`);
  const copy = COPY[industry];
  const t = v.tokens;
  const c = esc(company);
  const h = esc(host);
  const btnFg = v.layout === "dark" ? "#120e0a" : "#fffaf3";
  const serif = `"Iowan Old Style", "Palatino Linotype", Palatino, "Times New Roman", serif`;
  const sans = `"Helvetica Neue", Helvetica, Arial, sans-serif`;

  const offers = copy.offers
    .map(
      ([title, body]) =>
        `<article class="offer"><h3>${esc(title)}</h3><p>${esc(body)}</p></article>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${c}</title>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;background:${t.bg};color:${t.fg};font-family:${sans};line-height:1.45}
  img{display:block;width:100%;height:100%;object-fit:cover}
  a,button{font:inherit}
  .nav{position:absolute;inset:0 0 auto;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:22px 28px;color:#fff;mix-blend-mode:difference}
  .nav strong{letter-spacing:-.03em;font-size:15px}
  .nav span{font-size:10px;letter-spacing:.18em;text-transform:uppercase}
  .hero{position:relative;min-height:100vh;min-height:100dvh;overflow:hidden}
  .hero img{position:absolute;inset:0}
  .hero .veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,8,10,.18) 0%,rgba(8,8,10,.55) 100%)}
  .hero .copy{position:absolute;left:8%;right:8%;bottom:10%;max-width:38rem;color:#f7f3ec}
  .kicker{font-size:11px;letter-spacing:.22em;text-transform:uppercase;opacity:.85;margin:0 0 12px}
  h1{font-family:${serif};font-weight:500;font-size:clamp(2.4rem,6vw,4.6rem);letter-spacing:-.04em;line-height:.95;margin:0 0 16px}
  .lead{margin:0 0 22px;font-size:1.05rem;max-width:32rem;opacity:.9}
  .cta{display:inline-flex;align-items:center;min-height:48px;padding:0 22px;border:0;border-radius:999px;background:${t.accent};color:${btnFg};font-weight:600;cursor:pointer}
  .strip{display:grid;grid-template-columns:1.1fr .9fr}
  @media(max-width:800px){.strip{grid-template-columns:1fr}.hero{min-height:72vh}}
  .strip .photo{min-height:420px}
  .strip .text{padding:56px 40px;display:flex;flex-direction:column;justify-content:center}
  .offers{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:${t.line};border-top:1px solid ${t.line}}
  .offer{background:${t.bg};padding:32px 28px}
  .offer h3{font-family:${serif};font-size:1.4rem;margin:0 0 8px;font-weight:500}
  .offer p{margin:0;color:${t.muted};font-size:.95rem}
  @media(max-width:800px){.offers{grid-template-columns:1fr}}
  footer{padding:28px;display:flex;justify-content:space-between;gap:12px;color:${t.muted};font-size:11px;letter-spacing:.04em}
</style></head>
<body>
  <section class="hero">
    <img src="${v.hero}" alt=""/>
    <div class="veil"></div>
    <nav class="nav"><strong>${c}</strong><span>${esc(copy.kicker)}</span></nav>
    <div class="copy">
      <p class="kicker">${h}</p>
      <h1>${esc(copy.headline)}</h1>
      <p class="lead">${esc(copy.lead)}</p>
      <button class="cta" type="button">${esc(copy.cta)}</button>
    </div>
  </section>
  <section class="strip">
    <div class="photo"><img src="${v.still}" alt=""/></div>
    <div class="text">
      <p class="kicker" style="color:${t.accent}">${esc(v.name)}</p>
      <h2 style="font-family:${serif};font-size:clamp(1.8rem,4vw,2.6rem);letter-spacing:-.03em;font-weight:500;margin:0 0 14px">${c}</h2>
      <p style="color:${t.muted};margin:0 0 20px">${esc(v.tagline)} Fotografie trägt die Marke. Kein Baukasten.</p>
      <button class="cta" type="button">${esc(copy.cta)}</button>
    </div>
  </section>
  <section class="strip">
    <div class="text">
      <p class="kicker" style="color:${t.accent}">Material</p>
      <h2 style="font-family:${serif};font-size:clamp(1.8rem,4vw,2.6rem);letter-spacing:-.03em;font-weight:500;margin:0 0 14px">Echte Räume. Echte Flächen.</h2>
      <p style="color:${t.muted};margin:0">Gebaut aus dem Scan von ${h}. Die Bilder sind fotorealistisch — kein Gradient, keine Dummy-Kacheln.</p>
    </div>
    <div class="photo"><img src="${v.extra}" alt=""/></div>
  </section>
  <section class="offers">${offers}</section>
  <footer>
    <span>Impressum · Datenschutz · EU-hosted</span>
    <span>${esc(v.name)}</span>
  </footer>
</body></html>`;
}

export const SCAN_NARRATIVE = [
  { label: "Bild", text: "Die alte Seite hat keine fotografische Fläche — nur Text und Widgets." },
  { label: "Raum", text: "Der erste Blick muss ein Raum sein, kein Formular." },
  { label: "Marke", text: "Material und Licht tragen mehr als ein Claim." },
];
