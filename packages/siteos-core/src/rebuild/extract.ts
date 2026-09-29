// DISCOVER — eine abgerufene Seite → `SourcePage`.
//
// ## Grundsatz
//
// Gelesen wird, was im Dokument steht — nicht, was eine Seite dieser Art
// „normalerweise" hat. Jede Angabe trägt die Kennung eines Belegs (Pfad,
// DOM-Auszug, Zeitpunkt). Wo die Seite eine Frage nicht beantwortet, steht
// `null`; wo das Fehlen selbst eine Aussage ist (keine H1, kein Viewport),
// wird die Abwesenheit als eigener Beleg festgehalten.
//
// ## Datenminimierung
//
// Das HTML wird nur zum Lesen gebraucht und nicht zurückgegeben. Was bleibt,
// sind abgeleitete Signale und kurze Auszüge (≤ 280 Zeichen) als Beleg —
// derselbe Grundsatz wie beim Runtime-Scanner (Art. 5 Abs. 1 lit. c DSGVO).
//
// ## Grenzen
//
// Kein JavaScript wird ausgeführt. Inhalte, die erst im Browser entstehen
// (clientseitig gerenderte Seiten, Formular-Widgets per Skript), sind nicht
// sichtbar — sie erscheinen als eingebundene Fremd-Ressource, nicht als
// Inhalt. Die Bewertung sagt das, statt es zu überspielen.

import {
  byTag,
  closest,
  collapseSpace,
  elementPath,
  excerptOf,
  findAll,
  findFirst,
  identityOf,
  isInside,
  ownText,
  parseHtml,
  textOf,
  walkElements,
  type HtmlDocument,
  type HtmlElement,
} from './html.ts';
import { CssAccumulator } from './css.ts';
import { escapeRegExp, isScriptOrDataUrl } from './text.ts';
import { backendLinkKind, categorizeHost, sameSite, socialNetwork } from './hosts.ts';
import {
  EVIDENCE_EXCERPT_MAX,
  type ColorUse,
  type CtaIntent,
  type EvidenceItem,
  type EvidenceKind,
  type FontUse,
  type FormPurpose,
  type JsonLdFacts,
  type SourceContact,
  type SourceCta,
  type SourceFaq,
  type SourceForm,
  type SourceFormField,
  type SourceHeading,
  type SourceImage,
  type SourceLink,
  type SourcePage,
  type SourcePrice,
  type SourceSection,
  type TextStats,
  type ThirdPartyResource,
  type TrustKind,
  type TrustSignal,
} from './types.ts';

export interface ExtractInput {
  /** Endgültige Adresse der Seite (nach Weiterleitungen). */
  url: string;
  html: string;
  statusCode: number;
  fetchedAt: string;
  documentSha256?: string | null;
  bytes?: number;
  /** Der Abruf hat an seiner Größengrenze abgebrochen — der Rest des Dokuments fehlt. */
  truncated?: boolean;
  /** Bereits abgerufene Stylesheets derselben Website. */
  stylesheets?: { url: string; css: string }[];
}

export interface ExtractResult {
  page: SourcePage;
  evidence: EvidenceItem[];
  /** Belege für geprüfte Abwesenheiten, nach Schlüssel (z. B. `h1`, `viewport`). */
  absences: Record<string, string>;
}

const MAX_CTAS = 40;
const MAX_IMAGES = 60;
const MAX_LINKS = 300;
const MAX_TRUST = 24;
const MAX_PRICES = 20;
const MAX_SECTIONS = 40;
const MAX_FAQ = 12;
const SAMPLE_CHARS = 1500;

const FILE_EXTENSION = /\.(pdf|jpe?g|png|gif|svg|webp|avif|ico|zip|rar|docx?|xlsx?|pptx?|mp4|mov|mp3|wav|xml|txt|css|js)$/i;

// ─────────────────────────────────────────────────────────────────────
// Belege
// ─────────────────────────────────────────────────────────────────────

class EvidenceRecorder {
  readonly items: EvidenceItem[] = [];
  private readonly byElement = new Map<number, string>();
  private readonly byStatement = new Map<string, string>();
  private counter = 0;

  constructor(
    private readonly doc: HtmlDocument,
    private readonly url: string,
    private readonly observedAt: string,
    private readonly prefix: string,
  ) {}

  element(el: HtmlElement): string {
    const known = this.byElement.get(el.start);
    if (known) return known;
    const id = this.push('element', elementPath(el), excerptOf(this.doc, el, EVIDENCE_EXCERPT_MAX));
    this.byElement.set(el.start, id);
    return id;
  }

  statement(kind: EvidenceKind, path: string, text: string): string {
    const key = `${kind}|${path}|${text}`;
    const known = this.byStatement.get(key);
    if (known) return known;
    const excerpt = text.length > EVIDENCE_EXCERPT_MAX ? `${text.slice(0, EVIDENCE_EXCERPT_MAX - 1)}…` : text;
    const id = this.push(kind, path, excerpt);
    this.byStatement.set(key, id);
    return id;
  }

  private push(kind: EvidenceKind, path: string, excerpt: string): string {
    this.counter += 1;
    const id = `${this.prefix}-e${this.counter}`;
    this.items.push({ id, kind, url: this.url, path, excerpt, observedAt: this.observedAt, sha256: null });
    return id;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Einstieg
// ─────────────────────────────────────────────────────────────────────

export function extractPage(input: ExtractInput, pageIndex: number): ExtractResult {
  const doc = parseHtml(input.html);
  const pageUrl = safeParseUrl(input.url);
  const host = pageUrl?.hostname.toLowerCase() ?? '';
  const ev = new EvidenceRecorder(doc, input.url, input.fetchedAt, `p${pageIndex}`);
  const absences: Record<string, string> = {};
  const absent = (key: string, path: string, statement: string): string => {
    const id = ev.statement('absence', path, statement);
    absences[key] = id;
    return id;
  };

  const html = findFirst(doc.root, byTag('html'));
  const head = findFirst(doc.root, byTag('head'));
  const body = findFirst(doc.root, byTag('body')) ?? doc.root;
  const metas = findAll(head ?? doc.root, byTag('meta'));
  const meta = (name: string): HtmlElement | null =>
    metas.find((m) => (m.attrs.name ?? m.attrs.property ?? '').toLowerCase() === name) ?? null;

  // ── Kopf ──────────────────────────────────────────────────────────
  const lang = html?.attrs.lang?.trim() || null;
  if (!lang) absent('lang', 'html[lang]', 'Das <html>-Element trägt kein lang-Attribut.');

  const titleEl = findFirst(doc.root, byTag('title'));
  const title = titleEl ? textOf(titleEl, 300) || null : null;
  if (!title) absent('title', 'head>title', 'Kein <title> oder leerer Titel im Dokument.');

  const descriptionEl = meta('description');
  const metaDescription = descriptionEl?.attrs.content ? collapseSpace(descriptionEl.attrs.content).slice(0, 400) || null : null;
  if (!metaDescription) absent('description', 'head>meta[name=description]', 'Keine Meta-Beschreibung im Dokument.');

  const canonicalEl = findAll(head ?? doc.root, byTag('link')).find((l) => relIncludes(l, 'canonical')) ?? null;
  const canonical = canonicalEl && pageUrl ? resolveHref(canonicalEl.attrs.href ?? '', pageUrl)?.toString() ?? null : null;
  if (!canonical) absent('canonical', 'head>link[rel=canonical]', 'Kein Canonical-Link im Dokument.');

  const robotsMeta = meta('robots')?.attrs.content?.toLowerCase() ?? null;
  const viewportEl = meta('viewport');
  const viewport = viewportEl?.attrs.content ?? null;
  if (!viewport) absent('viewport', 'head>meta[name=viewport]', 'Kein Viewport-Meta-Tag: Mobilgeräte zeigen die Desktop-Breite verkleinert an.');
  const themeColor = meta('theme-color')?.attrs.content ?? null;
  const generator = meta('generator')?.attrs.content?.slice(0, 80) ?? null;
  const ogSiteName = meta('og:site_name')?.attrs.content?.trim().slice(0, 120) || null;
  const ogImageRaw = meta('og:image')?.attrs.content ?? null;
  const ogImage = ogImageRaw && pageUrl ? resolveHref(ogImageRaw, pageUrl)?.toString() ?? null : null;

  // ── Bereiche ──────────────────────────────────────────────────────
  const header = findFirst(body, (el) => el.tag === 'header' || el.attrs.role === 'banner')
    ?? findFirst(body, (el) => el.tag === 'div' && /(^|\s|-)(header|masthead|site-header|navbar|topbar)(\s|-|$)/.test(identityOf(el)));
  const footer = findLast(body, (el) => el.tag === 'footer' || el.attrs.role === 'contentinfo');
  const inChrome = (el: HtmlElement): boolean =>
    (header !== null && within(el, header)) || (footer !== null && within(el, footer)) || isInside(el, byTag('nav'));

  // ── Überschriften ─────────────────────────────────────────────────
  const headings: SourceHeading[] = [];
  for (const el of findAll(body, byTag('h1', 'h2', 'h3', 'h4', 'h5', 'h6'))) {
    const text = textOf(el, 240);
    if (!text) continue;
    headings.push({ level: Number(el.tag.slice(1)) as SourceHeading['level'], text, ev: ev.element(el) });
    if (headings.length >= 80) break;
  }
  const h1s = findAll(body, byTag('h1')).filter((el) => textOf(el, 10) !== '');
  if (h1s.length === 0) absent('h1', 'h1', `Kein <h1> im Dokument (${headings.length} andere Überschriften gefunden).`);

  // ── Hero ──────────────────────────────────────────────────────────
  const heroH1 = h1s.find((el) => !isInside(el, byTag('footer', 'nav'))) ?? null;
  // Der Hero ist der Bereich um die H1. Ist der umgebende Container zu groß
  // (die H1 steht direkt in <main>), wäre „im Hero" gleichbedeutend mit „auf
  // der Seite" — dann gilt der Bereich von der H1 bis zur nächsten H2.
  let heroRange: { start: number; end: number } | null = null;
  let hero: SourcePage['hero'] = null;
  if (heroH1) {
    const container = closest(heroH1, (el) =>
      el.tag === 'section' || el.tag === 'header'
      || /(hero|banner|intro|jumbotron|masthead|slider|stage|teaser|cover|splash)/.test(identityOf(el)),
    ) ?? heroH1.parent;
    const compact = container !== null && container !== body && textOf(container, 3200).length < 3000;
    const nextH2 = findFirst(body, (el) => el.tag === 'h2' && el.start > heroH1.start);
    heroRange = compact && container
      ? { start: container.start, end: container.end }
      : { start: heroH1.start, end: nextH2 ? nextH2.start : Math.min(doc.source.length, heroH1.end + 4000) };
    const range = heroRange;
    const sublineEl = findFirst(body, (el) =>
      el.start > heroH1.end - 1
      && el.start < range.end
      && (el.tag === 'p' || (el.tag === 'div' && el.children.every((c) => c.type === 'text')) || el.tag === 'h2' || el.tag === 'span')
      && textOf(el, 400).length >= 20,
    );
    const subline = sublineEl ? textOf(sublineEl, 320) : null;
    hero = { headline: textOf(heroH1, 200), subline, ev: ev.element(compact && container ? container : heroH1) };
  }
  const inHeroRange = (el: HtmlElement): boolean => heroRange !== null && el.start >= heroRange.start && el.start < heroRange.end;

  // ── Navigation ────────────────────────────────────────────────────
  const navEl = findFirst(body, (el) => el.tag === 'nav' && !(footer !== null && within(el, footer))) ?? header;
  const navigation: SourceLink[] = [];
  if (navEl && pageUrl) {
    const seen = new Set<string>();
    for (const a of findAll(navEl, byTag('a'))) {
      const label = textOf(a, 60);
      const url = resolveHref(a.attrs.href ?? '', pageUrl);
      if (!label || !url || !isHttp(url)) continue;
      const key = `${label.toLowerCase()}|${stripHash(url)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      navigation.push({ label, href: stripHash(url), ev: ev.element(a) });
      if (navigation.length >= 24) break;
    }
  } else {
    absent('navigation', 'nav', 'Kein <nav>-Element und kein Kopfbereich mit Links gefunden.');
  }

  // ── Links, CTAs, Backend-Strecken ─────────────────────────────────
  const internal = new Set<string>();
  const socialLinks: SourceLink[] = [];
  const backendLinks: SourcePage['backendLinks'] = [];
  const ctas: SourceCta[] = [];
  const ctaSeen = new Map<string, number>();
  const phones: SourceContact['phones'] = [];
  const emails: SourceContact['emails'] = [];
  const legalLinks: { kind: 'imprint-link' | 'privacy-link'; href: string; ev: string }[] = [];
  const sourceLength = Math.max(1, doc.source.length);

  const candidates = findAll(body, (el) => el.tag === 'a' || el.tag === 'button' || (el.tag === 'input' && /^(submit|button)$/i.test(el.attrs.type ?? '')));
  for (const el of candidates) {
    const rawHref = el.tag === 'a' ? (el.attrs.href ?? '').trim() : '';
    const label = labelOfControl(el);
    const lowerHref = rawHref.toLowerCase();

    if (lowerHref.startsWith('tel:')) {
      const number = rawHref.slice(4).replace(/[^\d+]/g, '');
      if (number.length >= 6 && !phones.some((p) => p.href === `tel:${number}`)) {
        phones.push({ value: label && /\d/.test(label) ? label : number, href: `tel:${number}`, source: 'link', ev: ev.element(el) });
      }
    } else if (lowerHref.startsWith('mailto:')) {
      const address = rawHref.slice(7).split('?')[0].trim();
      if (address.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) && !emails.some((m) => m.value === address)) {
        emails.push({ value: address, ev: ev.element(el) });
      }
    }

    let resolved: URL | null = null;
    if (el.tag === 'a' && pageUrl && rawHref !== '' && !isScriptOrDataUrl(rawHref)) {
      resolved = resolveHref(rawHref, pageUrl);
    }

    if (resolved && isHttp(resolved)) {
      const same = sameSite(resolved.hostname, host);
      if (same && !FILE_EXTENSION.test(resolved.pathname) && internal.size < MAX_LINKS) internal.add(stripHash(resolved, true));
      const network = same ? null : socialNetwork(resolved.hostname);
      if (network && socialLinks.length < 10 && !socialLinks.some((s) => s.href === resolved!.toString())) {
        socialLinks.push({ label: network, href: resolved.toString(), ev: ev.element(el) });
      }
      const backend = backendLinkKind(resolved, host);
      if (backend && backendLinks.length < 30 && !backendLinks.some((b) => b.href === stripHash(resolved!))) {
        backendLinks.push({ kind: backend, href: stripHash(resolved), label: label ?? resolved.pathname, ev: ev.element(el) });
      }
      const target = `${resolved.pathname} ${label ?? ''}`.toLowerCase();
      if (same && /(impressum|imprint|legal-notice)/.test(target) && !legalLinks.some((l) => l.kind === 'imprint-link')) {
        legalLinks.push({ kind: 'imprint-link', href: stripHash(resolved), ev: ev.element(el) });
      }
      if (/(datenschutz|privacy)/.test(target) && !legalLinks.some((l) => l.kind === 'privacy-link')) {
        legalLinks.push({ kind: 'privacy-link', href: stripHash(resolved), ev: ev.element(el) });
      }
    }

    // CTA?
    if (!label) continue;
    const buttonLike = el.tag !== 'a' || el.attrs.role === 'button' || BUTTON_CLASS.test(identityOf(el))
      || (el.parent !== null && BUTTON_CLASS.test(identityOf(el.parent)) && el.parent.children.length <= 3);
    const actionVerb = ACTION_VERB.test(label.toLowerCase());
    const contactHref = lowerHref.startsWith('tel:') || lowerHref.startsWith('mailto:');
    if (!buttonLike && !actionVerb && !contactHref) continue;
    const insideNav = isInside(el, byTag('nav'));
    if (insideNav && !buttonLike) continue;
    if (el.tag !== 'a' && isInside(el, byTag('form'))) continue; // Absenden-Knöpfe gehören zum Formular
    // Profil-Links in soziale Netzwerke sind keine Handlungsaufforderung der Seite.
    if (resolved && !sameSite(resolved.hostname, host) && socialNetwork(resolved.hostname)) continue;
    const href = resolved ? stripHash(resolved) : contactHref ? rawHref : null;
    const key = `${label.toLowerCase()}|${href ?? ''}`;
    const inHeaderNow = header !== null && within(el, header);
    const inHeroNow = inHeroRange(el);
    const known = ctaSeen.get(key);
    if (known !== undefined) {
      // Dieselbe Aufforderung an mehreren Stellen (Kopf und Hero): ein
      // Eintrag, aber beide Orte zählen.
      const entry = ctas[known];
      entry.inHeader = entry.inHeader || inHeaderNow;
      entry.inHero = entry.inHero || inHeroNow;
      entry.buttonLike = entry.buttonLike || buttonLike;
      continue;
    }
    if (ctas.length >= MAX_CTAS) continue;
    ctaSeen.set(key, ctas.length);
    ctas.push({
      label: label.slice(0, 80),
      href,
      intent: ctaIntent(label, lowerHref, resolved),
      buttonLike,
      inHeader: inHeaderNow,
      inHero: inHeroNow,
      position: round3(el.start / sourceLength),
      ev: ev.element(el),
    });
  }
  if (ctas.length === 0) absent('cta', 'a,button', 'Keine Handlungsaufforderung erkannt (keine Schaltfläche, kein Aktionslink, kein tel:/mailto:).');

  // ── Formulare ─────────────────────────────────────────────────────
  const labelFor = new Map<string, string>();
  for (const label of findAll(body, byTag('label'))) {
    const target = label.attrs.for;
    if (target) labelFor.set(target, textOf(label, 160));
  }
  const forms: SourceForm[] = [];
  for (const form of findAll(body, byTag('form'))) {
    if (isInside(form, byTag('form'))) continue;
    forms.push(readForm(form, pageUrl, host, labelFor, ev));
    if (forms.length >= 12) break;
  }

  // ── Bilder und Logo ───────────────────────────────────────────────
  const images: SourceImage[] = [];
  let imagesWithoutAlt = 0;
  let imageCount = 0;
  for (const img of findAll(body, byTag('img'))) {
    imageCount += 1;
    const alt = img.attrs.alt === undefined ? null : collapseSpace(img.attrs.alt).slice(0, 160);
    if (alt === null) imagesWithoutAlt += 1;
    if (images.length >= MAX_IMAGES) continue;
    const rawSrc = img.attrs['data-src'] || img.attrs['data-lazy-src'] || img.attrs.src || '';
    if (rawSrc === '' || rawSrc.startsWith('data:') || !pageUrl) continue;
    const src = resolveHref(rawSrc.split(' ')[0], pageUrl);
    if (!src || !isHttp(src)) continue;
    const ident = `${identityOf(img)} ${rawSrc.toLowerCase()} ${(alt ?? '').toLowerCase()} ${img.parent ? identityOf(img.parent) : ''}`;
    const isLogo = /logo/.test(ident) || (header !== null && within(img, header) && images.every((i) => !i.isLogoCandidate));
    images.push({
      src: src.toString(),
      alt,
      width: positiveInt(img.attrs.width),
      height: positiveInt(img.attrs.height),
      isLogoCandidate: isLogo,
      ev: ev.element(img),
    });
  }
  const logo = images.find((i) => i.isLogoCandidate) ?? null;

  // ── CSS: Farben, Schriften, Signale ───────────────────────────────
  const acc = new CssAccumulator();
  for (const style of findAll(doc.root, byTag('style'))) {
    const text = style.children.find((c) => c.type === 'text');
    if (text && text.type === 'text') acc.addStylesheet(text.text.slice(0, 400_000));
  }
  for (const sheet of input.stylesheets ?? []) acc.addStylesheet(sheet.css.slice(0, 600_000));
  walkElements(body, (el) => {
    const style = el.attrs.style;
    if (style && style.length <= 2000) acc.addInlineStyle(style, el.tag === 'a' || el.tag === 'button' || BUTTON_CLASS.test(identityOf(el)));
    return undefined;
  });
  if (themeColor) acc.addColor(themeColor, 6);
  if (header) {
    for (const shape of findAll(header, (el) => el.tag === 'path' || el.tag === 'rect' || el.tag === 'circle' || el.tag === 'polygon' || el.tag === 'svg')) {
      if (shape.attrs.fill) acc.addColor(shape.attrs.fill, 4);
    }
  }
  const fontSources = new Map<string, FontUse['source']>();
  for (const link of findAll(doc.root, byTag('link'))) {
    const href = link.attrs.href ?? '';
    const fontsUrl = href !== '' && pageUrl ? resolveHref(href, pageUrl) : null;
    if (fontsUrl && fontsUrl.hostname === 'fonts.googleapis.com' && fontsUrl.pathname.startsWith('/css')) {
      for (const family of googleFontFamilies(href)) {
        acc.addFontFamily(family);
        fontSources.set(family.toLowerCase(), 'google-fonts');
      }
    }
  }
  const cssResult = acc.result();
  const cssEv = cssResult.observedChars > 0
    ? ev.statement('css', 'css', `CSS gelesen: ${cssResult.observedChars} Zeichen (${(input.stylesheets ?? []).length} externe Stylesheets), ${cssResult.mediaQueryCount} Media Queries${cssResult.maxFixedWidthPx ? `, feste Breite bis ${cssResult.maxFixedWidthPx}px` : ''}${cssResult.minFontPx !== null ? `, kleinste Schrift ${cssResult.minFontPx}px` : ''}.`)
    : null;
  if (cssResult.observedChars > 2000 && cssResult.mediaQueryCount === 0) {
    absent('media-queries', 'css @media', `Keine Media Query in ${cssResult.observedChars} Zeichen CSS.`);
  }
  const colors: ColorUse[] = cssResult.colors.slice(0, 16).map((c) => ({
    hex: c.hex,
    count: c.count,
    weight: c.weight,
    ev: ev.statement('css', `color ${c.hex}`, `Farbe ${c.hex}: ${c.count} Vorkommen, Markengewicht ${c.weight} (Variablen, Schaltflächen, theme-color zählen höher).`),
  }));
  const fonts: FontUse[] = cssResult.fonts.slice(0, 8).map((f) => ({
    family: f.family,
    count: f.count,
    headingUses: f.headingUses,
    source: fontSources.get(f.family.toLowerCase()) ?? (f.fontFace ? 'font-face' : 'css'),
    ev: ev.statement('css', `font ${f.family}`, `Schriftfamilie „${f.family}": ${f.count} Deklaration(en)${fontSources.get(f.family.toLowerCase()) === 'google-fonts' ? ', geladen von fonts.googleapis.com' : ''}.`),
  }));

  // ── Fremd-Ressourcen ──────────────────────────────────────────────
  const thirdParty: ThirdPartyResource[] = [];
  const tpSeen = new Set<string>();
  for (const el of findAll(doc.root, (e) => e.tag === 'script' || e.tag === 'iframe' || e.tag === 'link' || e.tag === 'img' || e.tag === 'source' || e.tag === 'embed' || e.tag === 'video')) {
    const raw = el.attrs.src || el.attrs['data-src'] || (el.tag === 'link' ? el.attrs.href : '') || '';
    if (raw === '' || !pageUrl) continue;
    const url = resolveHref(raw, pageUrl);
    if (!url || !isHttp(url) || sameSite(url.hostname, host)) continue;
    const category = categorizeHost(url.hostname, url.pathname);
    const key = `${url.hostname}|${el.tag}`;
    if (tpSeen.has(key)) continue;
    tpSeen.add(key);
    thirdParty.push({ host: url.hostname.toLowerCase(), category, via: el.tag, ev: ev.element(el) });
    if (thirdParty.length >= 60) break;
  }

  // ── JSON-LD ───────────────────────────────────────────────────────
  const jsonLd = readJsonLd(doc, ev);
  if (jsonLd.types.length === 0) absent('structured-data', 'script[type=application/ld+json]', 'Keine strukturierten Daten (JSON-LD) im Dokument.');

  // ── Kontakt ───────────────────────────────────────────────────────
  const contact = readContact(body, footer, header, jsonLd, phones, emails, ev);
  if (contact.phones.length === 0 && contact.emails.length === 0 && contact.address === null) {
    absent('contact', 'body', 'Weder Telefonnummer noch E-Mail-Adresse noch Postanschrift auf dieser Seite gefunden.');
  }

  // ── Vertrauenssignale ─────────────────────────────────────────────
  const trust = readTrust(body, jsonLd, thirdParty, legalLinks, ev);
  if (!legalLinks.some((l) => l.kind === 'imprint-link')) absent('imprint-link', 'a[href*=impressum]', 'Kein Link zum Impressum auf dieser Seite.');
  if (!legalLinks.some((l) => l.kind === 'privacy-link')) absent('privacy-link', 'a[href*=datenschutz]', 'Kein Link zur Datenschutzerklärung auf dieser Seite.');

  // ── Preise, FAQ, Abschnitte, Text ─────────────────────────────────
  const prices = readPrices(body, inChrome, ev);
  const faqs = readFaqs(body, jsonLd, ev);
  const sections = readSections(body, inChrome, ev);
  const text = readText(body, inChrome, ev);

  // Gekürzt: vom Abruf (Größengrenze) oder vom Parser (Knotengrenze). Was
  // danach stand — Formulare, Strecken —, ist nicht gesehen.
  const truncated = doc.truncated || input.truncated === true;
  const documentEv = ev.statement(
    'document',
    'document',
    `HTTP ${input.statusCode} · ${formatKb(input.bytes ?? input.html.length)} · Titel: ${title ?? '—'} · ${headings.length} Überschriften · ${forms.length} Formular(e) · ${imageCount} Bilder (${imagesWithoutAlt} ohne alt) · ${text.words} Wörter${truncated ? ' · Dokument an Lesegrenze gekürzt' : ''}.`,
  );

  const page: SourcePage = {
    url: input.url,
    fetchedAt: input.fetchedAt,
    statusCode: input.statusCode,
    documentSha256: input.documentSha256 ?? null,
    bytes: input.bytes ?? input.html.length,
    truncated,
    lang,
    title,
    metaDescription,
    canonical,
    robotsMeta,
    viewport,
    themeColor,
    generator,
    ogSiteName,
    ogImage,
    headings,
    hero,
    ctas,
    navigation,
    forms,
    images,
    logo,
    colors,
    fonts,
    css: {
      observedChars: cssResult.observedChars,
      mediaQueryCount: cssResult.mediaQueryCount,
      maxFixedWidthPx: cssResult.maxFixedWidthPx,
      minFontPx: cssResult.minFontPx,
      usesFlexOrGrid: cssResult.usesFlexOrGrid,
      radiiPx: cssResult.radiiPx.slice(0, 200),
      pageBackground: cssResult.pageBackground,
      ev: cssEv,
    },
    trust,
    prices,
    contact,
    jsonLd,
    faqs,
    sections,
    thirdParty,
    internalLinks: [...internal].slice(0, MAX_LINKS),
    socialLinks,
    backendLinks,
    text,
    documentEv,
    absences,
  };

  // Bilder ohne Alternativtext als eigener Beleg — die Zählung steht im
  // Dokumentbeleg, das erste betroffene Bild als Element.
  if (imagesWithoutAlt > 0) {
    const first = findFirst(body, (el) => el.tag === 'img' && el.attrs.alt === undefined);
    if (first) absences['img-alt'] = ev.element(first);
  }

  return { page, evidence: ev.items, absences };
}

// ─────────────────────────────────────────────────────────────────────
// Formulare
// ─────────────────────────────────────────────────────────────────────

function readForm(
  form: HtmlElement,
  pageUrl: URL | null,
  host: string,
  labelFor: Map<string, string>,
  ev: EvidenceRecorder,
): SourceForm {
  const rawAction = (form.attrs.action ?? '').trim();
  let action: string | null = null;
  let targetKind: SourceForm['targetKind'] = 'none';
  if (rawAction.toLowerCase().startsWith('mailto:')) {
    action = rawAction.split('?')[0];
    targetKind = 'mailto';
  } else if (pageUrl && !isScriptOrDataUrl(rawAction) && rawAction !== '#') {
    // Leeres `action` sendet an die Seite selbst — das ist ein Ziel.
    const resolved = resolveHref(rawAction === '' ? pageUrl.toString() : rawAction, pageUrl);
    if (resolved && isHttp(resolved)) {
      action = stripHash(resolved);
      targetKind = sameSite(resolved.hostname, host) ? 'same-host' : 'other-host';
    }
  }

  const fields: SourceFormField[] = [];
  for (const control of findAll(form, byTag('input', 'select', 'textarea'))) {
    const type = control.tag === 'input' ? (control.attrs.type ?? 'text').toLowerCase() : control.tag;
    if (['hidden', 'submit', 'button', 'image', 'reset'].includes(type)) continue;
    const id = control.attrs.id ?? '';
    let label = (id && labelFor.get(id)) || null;
    if (!label) {
      const wrapping = closest(control, byTag('label'));
      if (wrapping) label = textOf(wrapping, 160) || null;
    }
    label = label || control.attrs['aria-label'] || control.attrs.placeholder || control.attrs.title || null;
    const required = control.attrs.required !== undefined || control.attrs['aria-required'] === 'true' || (label ?? '').includes('*');
    fields.push({
      name: (control.attrs.name || id || type).slice(0, 60),
      type,
      label: label ? collapseSpace(label).slice(0, 120) : null,
      required,
    });
    if (fields.length >= 30) break;
  }

  const formText = textOf(form, 1500).toLowerCase();
  const hasConsent = fields.some((f) => f.type === 'checkbox' && /(datenschutz|einwillig|privacy|dsgvo|zustimm)/.test((f.label ?? '').toLowerCase()))
    || (/(datenschutz|privacy|dsgvo)/.test(formText) && findAll(form, byTag('a')).some((a) => /(datenschutz|privacy)/i.test(a.attrs.href ?? '')));

  const submit = findFirst(form, (el) => (el.tag === 'button' && (el.attrs.type ?? 'submit').toLowerCase() === 'submit') || (el.tag === 'input' && (el.attrs.type ?? '').toLowerCase() === 'submit'));
  const submitLabel = submit ? (submit.tag === 'input' ? submit.attrs.value ?? null : textOf(submit, 60) || null) : null;

  return {
    action,
    method: (form.attrs.method ?? 'get').toLowerCase() === 'post' ? 'post' : 'get',
    fields,
    purpose: formPurpose(form, fields, formText),
    hasConsent,
    submitLabel,
    targetKind,
    ev: ev.element(form),
  };
}

function formPurpose(form: HtmlElement, fields: SourceFormField[], text: string): FormPurpose {
  const names = fields.map((f) => `${f.name} ${f.type} ${f.label ?? ''}`.toLowerCase()).join(' ');
  if (form.attrs.role === 'search' || fields.some((f) => f.type === 'search') || (fields.length <= 2 && /\b(s|q|search|query|suche|suchbegriff)\b/.test(names))) return 'search';
  if (fields.some((f) => f.type === 'password')) return 'login';
  if (fields.some((f) => ['date', 'time', 'datetime-local'].includes(f.type)) || /(termin|buchung|reservier)/.test(text)) return 'booking';
  if (/(bestell|warenkorb|checkout|kaufen|menge|quantity)/.test(text)) return 'order';
  if (fields.length <= 3 && fields.some((f) => f.type === 'email') && /(newsletter|abonnier|subscribe|anmelden)/.test(text)) return 'newsletter';
  if (fields.some((f) => f.type === 'textarea') || /(kontakt|nachricht|anfrage|rückruf|rueckruf|message)/.test(text)) return 'contact';
  return 'other';
}

// ─────────────────────────────────────────────────────────────────────
// Kontakt
// ─────────────────────────────────────────────────────────────────────

const PHONE_IN_TEXT = /(?:\+49|0049|\b0)[\d\s/().-]{6,18}\d/;
const EMAIL_IN_TEXT = /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,120}\.[A-Za-z]{2,12}/;
const POSTCODE_CITY = /\b(\d{5})\s+([A-ZÄÖÜ][a-zäöüß]+(?:[\s-][A-ZÄÖÜ][a-zäöüß]+)?)/;

function readContact(
  body: HtmlElement,
  footer: HtmlElement | null,
  header: HtmlElement | null,
  jsonLd: JsonLdFacts,
  phones: SourceContact['phones'],
  emails: SourceContact['emails'],
  ev: EvidenceRecorder,
): SourceContact {
  const contactScopes = [header, footer, ...findAll(body, (el) => el.tag === 'address' || /(kontakt|contact)/.test(identityOf(el)))]
    .filter((el): el is HtmlElement => el !== null);

  // Telefonnummern im Text nur dort, wo ein Telefonhinweis danebensteht —
  // sonst wird jede Ziffernfolge (Aktenzeichen, Preise) zur Nummer.
  if (phones.length === 0) {
    // Kontaktbereiche zuerst; danach der ganze Seitenrumpf (Notdienst-Leisten
    // stehen oft oberhalb des Kopfbereichs).
    for (const scope of [...contactScopes, body]) {
      for (const node of textElements(scope)) {
        const text = ownText(node);
        if (text.length > 200 || !/(tel|telefon|fon|phone|☎|📞|mobil|ruf)/i.test(text)) continue;
        const match = PHONE_IN_TEXT.exec(text);
        if (match) {
          const digits = match[0].replace(/[^\d+]/g, '');
          if (digits.length >= 7 && !phones.some((p) => p.value === match[0].trim())) {
            phones.push({ value: match[0].trim(), href: null, source: 'text', ev: ev.element(node) });
          }
        }
        if (phones.length >= 3) break;
      }
      if (phones.length >= 3) break;
    }
  }
  if (jsonLd.telephone && !phones.some((p) => p.value.replace(/\D/g, '') === jsonLd.telephone!.replace(/\D/g, ''))) {
    phones.push({ value: jsonLd.telephone, href: null, source: 'json-ld', ev: jsonLd.ev ?? ev.statement('document', 'json-ld', `Telefon laut JSON-LD: ${jsonLd.telephone}`) });
  }

  if (emails.length === 0) {
    for (const scope of contactScopes) {
      for (const node of textElements(scope)) {
        const text = ownText(node);
        if (text.length > 300) continue;
        const match = EMAIL_IN_TEXT.exec(text);
        if (match && !emails.some((m) => m.value === match[0])) emails.push({ value: match[0], ev: ev.element(node) });
        if (emails.length >= 2) break;
      }
      if (emails.length >= 2) break;
    }
  }
  if (jsonLd.email && !emails.some((m) => m.value === jsonLd.email)) {
    emails.push({ value: jsonLd.email, ev: jsonLd.ev ?? ev.statement('document', 'json-ld', `E-Mail laut JSON-LD: ${jsonLd.email}`) });
  }

  let address: SourceContact['address'] = null;
  if (jsonLd.postalCode && jsonLd.locality) {
    const value = [jsonLd.streetAddress, `${jsonLd.postalCode} ${jsonLd.locality}`].filter(Boolean).join(', ');
    address = { value, ev: jsonLd.ev ?? ev.statement('document', 'json-ld', `Adresse laut JSON-LD: ${value}`) };
  } else {
    for (const scope of contactScopes.length > 0 ? contactScopes : [body]) {
      for (const node of textElements(scope)) {
        const text = textOf(node, 220);
        if (text.length > 220) continue;
        if (POSTCODE_CITY.test(text)) {
          address = { value: text.slice(0, 160), ev: ev.element(node) };
          break;
        }
      }
      if (address) break;
    }
  }

  let openingHours: SourceContact['openingHours'] = null;
  if (jsonLd.openingHours) {
    openingHours = { value: jsonLd.openingHours, ev: jsonLd.ev ?? ev.statement('document', 'json-ld', `Öffnungszeiten laut JSON-LD: ${jsonLd.openingHours}`) };
  } else {
    const marker = findFirst(body, (el) => /^(h\d|strong|b|p|dt|span|div)$/.test(el.tag) && /^(öffnungszeiten|sprechzeiten|geschäftszeiten|bürozeiten)\b/i.test(ownText(el)));
    if (marker) {
      const scope = marker.parent ?? marker;
      const text = textOf(scope, 220).replace(/^(öffnungszeiten|sprechzeiten|geschäftszeiten|bürozeiten)\s*:?\s*/i, '');
      if (text.length >= 6 && /\d/.test(text)) openingHours = { value: text.slice(0, 160), ev: ev.element(scope) };
    }
  }

  return { phones: phones.slice(0, 3), emails: emails.slice(0, 3), address, openingHours };
}

/** Elemente mit eigenem Text (Blätter der Textstruktur). */
function textElements(scope: HtmlElement, max = 1500): HtmlElement[] {
  return findAll(scope, (el) => el.children.some((c) => c.type === 'text') && !['script', 'style', 'noscript', 'template'].includes(el.tag)).slice(0, max);
}

// ─────────────────────────────────────────────────────────────────────
// Vertrauenssignale
// ─────────────────────────────────────────────────────────────────────

const TRUST_TERMS: ReadonlyArray<{ kind: TrustKind; pattern: RegExp }> = [
  { kind: 'certification', pattern: /(TÜV(?:[- ][A-ZÄÖÜ][\wäöüß-]*){0,2}|DEKRA|ISO(?:\/IEC)?\s?\d{4,5}(?::\d{4})?|DIN EN(?: ISO)? \d{3,5}|TISAX|zertifiziert\w*|Zertifizierung|Gütesiegel|Qualitätssiegel|Meisterbetrieb|Fachbetrieb|Fachanwält(?:in|e)? für [\wäöüß-]+|Fachanwalt für [\wäöüß-]+|DATEV[- ](?:Mitglied|Digitale Kanzlei|Partner|Siegel)|Trusted Shops|Käuferschutz)/gi },
  { kind: 'membership', pattern: /(Mitglied (?:der|im|des|in der) [A-ZÄÖÜ][\wäöüß-]*(?: [A-ZÄÖÜ][\wäöüß-]*){0,3}|Handwerkskammer|Innungsbetrieb|Steuerberaterkammer|Rechtsanwaltskammer|Zahnärztekammer|Ärztekammer|IHK)/g },
  { kind: 'award', pattern: /(Award|Preisträger\w*|Auszeichnung\w*|Testsieger|FOCUS[- ][A-ZÄÖÜ][\wäöüß-]*|Top[- ]Arbeitgeber)/g },
  { kind: 'guarantee', pattern: /(Festpreis\w*|Garantie\w*|Geld[- ]zurück|Gewährleistung|unverbindlich\w*|kostenlos\w*)/gi },
  { kind: 'years', pattern: /(seit\s+(?:über\s+)?(?:18|19|20)\d{2}|gegründet\s+(?:im\s+Jahr\s+)?(?:18|19|20)\d{2}|(?:seit über|seit mehr als|über|mehr als)\s+\d{1,3}\s+Jahre\w*|\d{1,3}\s+Jahre\s+Erfahrung)/gi },
];

/** Höchstens so viele Treffer je Muster und Textknoten. */
const TRUST_MATCHES_PER_NODE = 3;

/** Wörter, an denen eine Vertrauensaussage endet (Konjunktionen, Verben, Pronomen). */
const PHRASE_STOP = /^(und|sowie|oder|aber|stehen|steht|sind|ist|war|wir|sie|bieten|bietet|für|mit|seit|damit|die|das|der)$/i;

/**
 * Vertrauensaussage im Wortlaut der Quelle — gekürzt, nie umformuliert.
 *
 * Kurze Texte (Listenpunkte, Siegel-Unterschriften) gelten als Ganzes. In
 * Fließtext wird der Treffer um höchstens fünf Folgewörter ergänzt und an
 * Satzzeichen oder Konjunktionen beendet: aus „Als eingetragener
 * Meisterbetrieb der Handwerkskammer zu Leipzig und Mitglied …" wird
 * „Meisterbetrieb der Handwerkskammer zu Leipzig".
 */
function trustPhrase(text: string, index: number, length: number, kind: TrustKind): string {
  if (text.length <= 70) return text.trim();
  const match = text.slice(index, index + length).trim();
  if (kind === 'years') return match;
  const words: string[] = [];
  for (const token of text.slice(index + length).split(/\s+/)) {
    if (token === '') continue;
    if (PHRASE_STOP.test(token)) break;
    const clean = token.replace(/[.,;:!?–—|·)"“]+$/, '');
    if (clean !== '') words.push(clean);
    if (clean !== token || words.length >= 5) break;
  }
  return [match, ...words].join(' ').trim();
}

/** Wendungen, in denen eine Jahresangabe nichts über das Unternehmen sagt. */
const YEARS_OFF_TOPIC = /(garantie|gewährleistung|laufzeit|kinder|jugendliche|senior|rentner|alter\b|jahre alt|jährige|lebensjahr|und älter|ab \d+ jahren|aufbewahrung|frist|verjährung|gilt|gesetz|verordnung|dsgvo|richtlinie|pflicht|vertrag|kündigung|mindestens \d+ jahre|nutzungsdauer|lebensdauer|haltbarkeit|(kunden|menschen|personen|frauen|männer|patient\w*|bewohner\w*|mitglieder|teilnehmer\w*)\s+(ab|über|unter|von)\s+\d{1,3}\s+jahre)/i;

/** Wendungen, die eine Jahresangabe an das Unternehmen binden. */
const YEARS_ABOUT_COMPANY = /\b(wir|uns|unser\w*|firma|betrieb\w*|unternehmen\w*|kanzlei|praxis|team|familienbetrieb|meisterbetrieb|tradition\w*|gegründet|gründung|inhaber\w*|erfahrung|am markt|im geschäft|für sie|kunden vertrauen)\b/i;

/**
 * Sagt die Jahresangabe etwas über das Unternehmen? „Seit 1998 Ihr
 * Meisterbetrieb" ja — „Beratung für Kunden über 60 Jahre" oder „Seit 2018
 * gilt die DSGVO" nicht. Kurze Einträge (Siegel, Listenpunkt: „Seit 1998")
 * gelten als Aussage über sich selbst; in Sätzen muss der Satz das
 * Unternehmen nennen. Im Zweifel entfällt die Angabe — sie stünde sonst mit
 * Häkchen im Hero.
 */
function yearsAboutCompany(text: string, index: number, match: string): boolean {
  if (/erfahrung|gegründet/i.test(match)) return !YEARS_OFF_TOPIC.test(sentenceAround(text, index));
  const sentence = sentenceAround(text, index);
  if (YEARS_OFF_TOPIC.test(sentence)) return false;
  if (text.length <= 40) return true;
  return YEARS_ABOUT_COMPANY.test(sentence);
}

/** Der Satz, in dem `index` steht (an . ! ? getrennt). */
function sentenceAround(text: string, index: number): string {
  let start = index;
  while (start > 0 && !/[.!?]/.test(text[start - 1])) start -= 1;
  let end = index;
  while (end < text.length && !/[.!?]/.test(text[end])) end += 1;
  return text.slice(start, end + 1);
}

function readTrust(
  body: HtmlElement,
  jsonLd: JsonLdFacts,
  thirdParty: ThirdPartyResource[],
  legalLinks: { kind: 'imprint-link' | 'privacy-link'; href: string; ev: string }[],
  ev: EvidenceRecorder,
): TrustSignal[] {
  const out: TrustSignal[] = [];
  const push = (signal: TrustSignal) => {
    if (out.length >= MAX_TRUST) return;
    const value = signal.value.toLowerCase();
    // Dieselbe Aussage nur einmal — auch wenn zwei Muster sie treffen
    // („Meisterbetrieb seit 1998" ist Zertifikat und Jahresangabe zugleich),
    // und keine Teilaussage neben der vollständigen aus demselben Beleg.
    const duplicate = out.some((s) => {
      const other = s.value.toLowerCase();
      return other === value || (s.ev === signal.ev && (other.includes(value) || value.includes(other)));
    });
    if (duplicate) return;
    out.push(signal);
  };

  for (const link of legalLinks) push({ kind: link.kind, value: link.href, detail: null, ev: link.ev });

  // Begriffe im sichtbaren Text und in Alternativtexten
  for (const node of textElements(body)) {
    if (isInside(node, byTag('script', 'style'))) continue;
    const text = ownText(node);
    if (text.length < 3 || text.length > 600) continue;
    for (const { kind, pattern } of TRUST_TERMS) {
      pattern.lastIndex = 0;
      for (let hits = 0; hits < TRUST_MATCHES_PER_NODE; hits += 1) {
        const match = pattern.exec(text);
        if (!match) break;
        if (kind === 'years' && !yearsAboutCompany(text, match.index, match[0])) continue;
        push({ kind, value: trustPhrase(text, match.index, match[0].length, kind), detail: null, ev: ev.element(node) });
      }
    }
  }
  for (const img of findAll(body, byTag('img'))) {
    const alt = img.attrs.alt ?? '';
    if (alt.length < 3 || alt.length > 160) continue;
    for (const { kind, pattern } of TRUST_TERMS) {
      if (kind === 'guarantee' || kind === 'years') continue;
      pattern.lastIndex = 0;
      if (pattern.exec(alt)) push({ kind, value: alt.trim(), detail: 'Bild', ev: ev.element(img) });
    }
  }

  // Kundenstimmen: Zitate und als solche ausgezeichnete Container
  const quoteContainers = findAll(body, (el) =>
    el.tag === 'blockquote'
    || (/(testimonial|review|kundenstimme|feedback|rezension|bewertung|referenz-item|quote)/.test(identityOf(el)) && ['div', 'li', 'article', 'figure', 'section'].includes(el.tag)),
  );
  for (const container of quoteContainers) {
    if (out.filter((s) => s.kind === 'testimonial').length >= 6) break;
    const para = findFirst(container, byTag('p', 'q')) ?? container;
    const quote = textOf(para, 420);
    if (quote.length < 30 || quote.length > 400) continue;
    const authorEl = findFirst(container, (el) => el.tag === 'cite' || el.tag === 'figcaption' || /(author|name|autor|kunde)/.test(identityOf(el)));
    const author = authorEl ? textOf(authorEl, 80) : null;
    push({ kind: 'testimonial', value: quote, detail: author && author !== quote ? author : null, ev: ev.element(container) });
  }

  // Strukturierte Bewertungen — nur, wenn die Quelle sie auch **zeigt**.
  // JSON-LD sehen Besucher nicht; eine Bewertung, die dort steht, aber nicht
  // auf der Seite, würde der Neubau erstmals sichtbar behaupten (UWG § 5b
  // Abs. 3). Die Plattform wird genannt, wo die Seite eine einbindet.
  if (jsonLd.ratingValue !== null && jsonLd.ev && ratingVisible(body, jsonLd.ratingValue)) {
    const count = jsonLd.reviewCount !== null ? ` (${jsonLd.reviewCount} Bewertungen)` : '';
    const platforms = [...new Set(thirdParty.filter((t) => t.category === 'reviews').map((t) => reviewPlatform(t.host)).filter((p): p is string => p !== null))];
    push({ kind: 'rating', value: `${formatDecimal(jsonLd.ratingValue)} von 5${count}`, detail: platforms.length === 1 ? platforms[0] : null, ev: jsonLd.ev });
  }

  for (const resource of thirdParty) {
    if (resource.category === 'reviews') push({ kind: 'review-widget', value: resource.host, detail: null, ev: resource.ev });
  }

  // Kundenlogos: Abschnitt mit passender Überschrift und mindestens drei
  // Bildern. Jeder Abschnitt wird höchstens einmal durchsucht und nach dem
  // ersten Treffer aufgehört — sonst durchliefe eine Seite mit vielen
  // gleichlautenden Überschriften ihren Baum einmal je Überschrift.
  const searchedScopes = new Set<HtmlElement>();
  let logoHeadings = 0;
  for (const heading of findAll(body, byTag('h2', 'h3', 'h4'))) {
    const text = textOf(heading, 80);
    if (!/(kunden|partner|referenzen|bekannt aus|vertrauen|clients|trusted by)/i.test(text)) continue;
    const scope = heading.parent;
    if (!scope || searchedScopes.has(scope)) continue;
    searchedScopes.add(scope);
    if (++logoHeadings > 20) break;
    const logos = findAll(scope, byTag('img'));
    if (logos.length < 3) continue;
    const alts = logos.map((l) => (l.attrs.alt ?? '').trim()).filter((a) => a !== '').slice(0, 6);
    push({ kind: 'client-logos', value: `${logos.length} Logos unter „${text}"`, detail: alts.length > 0 ? alts.join(', ') : null, ev: ev.element(scope) });
    break;
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Preise, FAQ, Abschnitte
// ─────────────────────────────────────────────────────────────────────

const PRICE = /(?:\bab\s+)?(?:€\s?\d{1,5}(?:[.,]\d{1,2})?(?:,-)?|\b\d{1,5}(?:[.,]\d{1,2})?(?:,-)?\s?(?:€|EUR\b|Euro\b))/i;

function readPrices(body: HtmlElement, inChrome: (el: HtmlElement) => boolean, ev: EvidenceRecorder): SourcePrice[] {
  const out: SourcePrice[] = [];
  const seen = new Set<string>();
  for (const node of textElements(body)) {
    if (out.length >= MAX_PRICES) break;
    if (inChrome(node) || isInside(node, byTag('script', 'style', 'form'))) continue;
    const text = ownText(node);
    if (text.length > 300 || !PRICE.test(text)) continue;
    const block = closest(node, (el) => ['li', 'p', 'td', 'tr', 'div', 'article'].includes(el.tag)) ?? node;
    const blockText = textOf(block, 200);
    if (seen.has(blockText)) continue;
    seen.add(blockText);
    const headingEl = findFirst(block, byTag('h2', 'h3', 'h4', 'h5', 'strong', 'b', 'dt'));
    const label = headingEl ? textOf(headingEl, 80) : null;
    out.push({ text: blockText.slice(0, 160), label: label && !PRICE.test(label) ? label : null, ev: ev.element(block) });
  }
  return out;
}

function readFaqs(body: HtmlElement, jsonLd: JsonLdFacts, ev: EvidenceRecorder): SourceFaq[] {
  const out: SourceFaq[] = [];
  const push = (question: string, answer: string, evidence: string) => {
    const q = question.trim();
    const a = answer.trim();
    if (q.length < 6 || a.length < 10 || out.length >= MAX_FAQ || out.some((f) => f.question === q)) return;
    out.push({ question: q.slice(0, 200), answer: a.slice(0, 600), ev: evidence });
  };

  for (const details of findAll(body, byTag('details'))) {
    const summary = findFirst(details, byTag('summary'));
    if (!summary) continue;
    const question = textOf(summary, 200);
    const answer = textOf(details, 800).slice(question.length).trim();
    push(question, answer, ev.element(details));
  }
  // Definitionslisten: je Elternelement ein Durchlauf — jedes <dt> bekommt
  // das nächste <dd> (mehrere <dt> vor einem <dd> teilen es). Linear, auch
  // bei Tausenden Einträgen.
  const dtParents = new Set<HtmlElement>();
  for (const dt of findAll(body, byTag('dt'))) if (dt.parent) dtParents.add(dt.parent);
  for (const parent of dtParents) {
    if (out.length >= MAX_FAQ) break;
    let pending: HtmlElement[] = [];
    for (const child of parent.children) {
      if (child.type !== 'element') continue;
      if (child.tag === 'dt') pending.push(child);
      else if (child.tag === 'dd' && pending.length > 0) {
        for (const dt of pending) push(textOf(dt, 200), textOf(child, 600), ev.element(parent));
        pending = [];
        if (out.length >= MAX_FAQ) break;
      }
    }
  }
  // Überschriften als Fragen zählen nur als FAQ, wenn mindestens zwei davon
  // im selben Container stehen — eine einzelne rhetorische Frage („Warum
  // wir?") ist keine Fragenliste. Gezählt und verknüpft je Container in
  // einem Durchlauf.
  const questionHeadings = findAll(body, byTag('h2', 'h3', 'h4', 'h5')).filter((h) => textOf(h, 200).endsWith('?'));
  const perParent = new Map<HtmlElement, HtmlElement[]>();
  for (const heading of questionHeadings) {
    if (!heading.parent) continue;
    const list = perParent.get(heading.parent) ?? [];
    list.push(heading);
    perParent.set(heading.parent, list);
  }
  for (const [parent, headings] of perParent) {
    if (headings.length < 2) continue;
    if (out.length >= MAX_FAQ) break;
    const wanted = new Set(headings);
    let open: HtmlElement | null = null;
    for (const child of parent.children) {
      if (child.type !== 'element') continue;
      if (open) {
        if (['p', 'div'].includes(child.tag)) push(textOf(open, 200), textOf(child, 600), ev.element(open));
        open = null;
      }
      if (wanted.has(child)) open = child;
      if (out.length >= MAX_FAQ) break;
    }
  }
  for (const item of jsonLd.faq) push(item.question, item.answer, jsonLd.ev ?? ev.statement('document', 'json-ld', 'FAQ laut JSON-LD (FAQPage).'));
  return out;
}

function readSections(body: HtmlElement, inChrome: (el: HtmlElement) => boolean, ev: EvidenceRecorder): SourceSection[] {
  // Flache Ereignisliste in Dokumentreihenfolge: Überschriften, Absätze,
  // Listenpunkte. Ein Abschnitt reicht bis zur nächsten gleich- oder
  // höherrangigen Überschrift.
  type Event = { kind: 'h'; level: number; el: HtmlElement; text: string } | { kind: 'p' | 'li'; el: HtmlElement; text: string };
  const events: Event[] = [];
  walkElements(body, (el) => {
    if (['script', 'style', 'noscript', 'template', 'svg'].includes(el.tag)) return 'skip';
    if (inChrome(el) || el.tag === 'form' || el.tag === 'aside') return 'skip';
    if (/^h[1-6]$/.test(el.tag)) {
      const text = textOf(el, 200);
      if (text) events.push({ kind: 'h', level: Number(el.tag.slice(1)), el, text });
      return 'skip';
    }
    if (el.tag === 'p') {
      const text = textOf(el, 700);
      if (text.length >= 25) events.push({ kind: 'p', el, text });
      return 'skip';
    }
    if (el.tag === 'li') {
      const text = textOf(el, 160);
      if (text.length >= 3 && text.length <= 160) events.push({ kind: 'li', el, text });
      return 'skip';
    }
    return undefined;
  });

  const out: SourceSection[] = [];
  for (let k = 0; k < events.length && out.length < MAX_SECTIONS; k += 1) {
    const event = events[k];
    if (event.kind !== 'h' || event.level < 2 || event.level > 3) continue;
    let text: string | null = null;
    const items: string[] = [];
    for (let m = k + 1; m < events.length; m += 1) {
      const next = events[m];
      if (next.kind === 'h') {
        if (next.level <= event.level) break;
        if (items.length < 8) items.push(next.text);
        continue;
      }
      if (next.kind === 'p' && text === null && next.text.length >= 40) text = next.text.slice(0, 600);
      if (next.kind === 'li' && items.length < 8) items.push(next.text);
    }
    out.push({ heading: event.text, text, items, ev: ev.element(event.el) });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Text
// ─────────────────────────────────────────────────────────────────────

function readText(body: HtmlElement, inChrome: (el: HtmlElement) => boolean, ev: EvidenceRecorder): TextStats {
  // Satz- und Silbenstatistik nur über Fließtext: Überschriften sind keine
  // Sätze und würden die mittlere Satzlänge künstlich senken.
  const blocks: string[] = [];
  const headingTexts: string[] = [];
  let paragraphs = 0;
  let longestParagraphWords = 0;
  walkElements(body, (el) => {
    if (['script', 'style', 'noscript', 'template', 'svg', 'form', 'aside'].includes(el.tag)) return 'skip';
    if (inChrome(el)) return 'skip';
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(el.tag)) {
      const text = textOf(el, 300);
      if (text) headingTexts.push(text);
      return 'skip';
    }
    if (['p', 'li', 'td', 'blockquote', 'dd', 'figcaption'].includes(el.tag)) {
      const text = textOf(el, 2000);
      if (text) {
        blocks.push(text);
        if (el.tag === 'p') {
          paragraphs += 1;
          longestParagraphWords = Math.max(longestParagraphWords, countWords(text));
        }
      }
      return 'skip';
    }
    return undefined;
  });

  const all = blocks.join(' \n');
  const words = countWords(all) + countWords(headingTexts.join(' '));
  const proseWords = countWords(all);
  let sentences = 0;
  let longSentences = 0;
  let syllables = 0;
  for (const block of blocks) {
    for (const sentence of splitSentences(block)) {
      const count = countWords(sentence);
      if (count === 0) continue;
      sentences += 1;
      if (count > 25) longSentences += 1;
    }
  }
  if (proseWords >= 80) {
    for (const word of all.split(/\s+/)) syllables += syllableCount(word);
  }
  const asl = sentences > 0 ? proseWords / sentences : null;
  const asw = proseWords > 0 ? syllables / proseWords : null;
  const fleschDe = proseWords >= 80 && asl !== null && asw !== null ? Math.round(180 - asl - 58.5 * asw) : null;

  let formal = 0;
  let informal = 0;
  for (const token of `${headingTexts.join(' ')} ${all}`.split(/[\s.,;:!?()"„“]+/)) {
    if (/^(Sie|Ihnen|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres)$/.test(token)) formal += 1;
    else if (/^(du|dich|dir|dein|deine|deinen|deinem|deiner|deines|euch|euer|eure|Du|Dich|Dir|Dein|Deine|Deinen|Deinem|Deiner)$/.test(token)) informal += 1;
  }

  const stats: Omit<TextStats, 'ev'> = {
    words,
    sentences,
    avgWordsPerSentence: asl !== null ? round1(asl) : null,
    longSentenceShare: sentences > 0 ? round3(longSentences / sentences) : null,
    fleschDe: fleschDe === null ? null : Math.max(-50, Math.min(120, fleschDe)),
    paragraphs,
    longestParagraphWords,
    formalAddress: formal,
    informalAddress: informal,
    sample: collapseSpace([...headingTexts.slice(0, 3), ...blocks].join(' ')).slice(0, SAMPLE_CHARS),
  };
  const evidence = ev.statement(
    'document',
    'text',
    `Haupttext: ${words} Wörter, ${sentences} Sätze${asl !== null ? `, Ø ${round1(asl)} Wörter/Satz` : ''}${fleschDe !== null ? `, Lesbarkeit (Amstad) ${stats.fleschDe}` : ''}, ${paragraphs} Absätze, längster ${longestParagraphWords} Wörter; Anrede „Sie" ${formal}×, „du" ${informal}×.`,
  );
  return { ...stats, ev: evidence };
}

function countWords(text: string): number {
  let count = 0;
  for (const token of text.split(/\s+/)) if (/[A-Za-zÄÖÜäöüß0-9]/.test(token)) count += 1;
  return count;
}

/** Satzgrenzen: . ! ? gefolgt von Leerraum und Großbuchstabe/Ziffer/Anführung, oder Textende. */
function splitSentences(text: string): string[] {
  const out: string[] = [];
  let from = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch !== '.' && ch !== '!' && ch !== '?') continue;
    const next = text[i + 1];
    const after = text[i + 2];
    const atEnd = next === undefined;
    const boundary = atEnd || (next === ' ' && after !== undefined && /[A-ZÄÖÜ0-9„"]/.test(after));
    if (!boundary) continue;
    // Abkürzungen („z. B.", „Nr.", „ca.") beenden keinen Satz.
    const tail = text.slice(Math.max(from, i - 5), i).toLowerCase();
    if (ch === '.' && /(^|\s)(z|b|bzw|ca|nr|inkl|ggf|u|a|d|h|usw|etc|str|tel|evtl|vgl|dr|prof|st)$/.test(tail)) continue;
    out.push(text.slice(from, i + 1));
    from = i + 1;
  }
  if (from < text.length) out.push(text.slice(from));
  return out;
}

/** Silben als Vokalgruppen (Näherung; Diphthonge zählen als eine Gruppe). */
function syllableCount(word: string): number {
  const lower = word.toLowerCase();
  let groups = 0;
  let inVowel = false;
  for (const ch of lower) {
    const vowel = 'aeiouyäöü'.includes(ch);
    if (vowel && !inVowel) groups += 1;
    inVowel = vowel;
  }
  return /[a-zäöüß]/.test(lower) ? Math.max(1, groups) : 0;
}

// ─────────────────────────────────────────────────────────────────────
// JSON-LD
// ─────────────────────────────────────────────────────────────────────

const ORG_TYPES = /(Organization|LocalBusiness|Corporation|Store|Service|Dentist|Physician|MedicalClinic|LegalService|Attorney|AccountingService|Restaurant|CafeOrCoffeeShop|Bakery|RealEstateAgent|HomeAndConstructionBusiness|Electrician|Plumber|RoofingContractor|HVACBusiness|GeneralContractor|HousePainter|Locksmith|AutoRepair|ProfessionalService|Hotel|FinancialService|InsuranceAgency|Optician|Pharmacy|BeautySalon|HairSalon|SportsActivityLocation|EducationalOrganization|OnlineStore|Brand)/;

function readJsonLd(doc: HtmlDocument, ev: EvidenceRecorder): JsonLdFacts {
  const facts: JsonLdFacts = {
    types: [], name: null, telephone: null, email: null, streetAddress: null, postalCode: null, locality: null,
    openingHours: null, sameAs: [], ratingValue: null, reviewCount: null, faq: [], ev: null,
  };
  for (const script of findAll(doc.root, (el) => el.tag === 'script' && (el.attrs.type ?? '').toLowerCase() === 'application/ld+json')) {
    const text = script.children.find((c) => c.type === 'text');
    if (!text || text.type !== 'text' || text.text.length > 150_000) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.text);
    } catch {
      continue;
    }
    const nodes = flattenJsonLd(parsed);
    let used = false;
    for (const node of nodes) {
      const types = typesOf(node);
      for (const t of types) if (!facts.types.includes(t) && facts.types.length < 12) facts.types.push(t);
      if (types.some((t) => t === 'FAQPage')) {
        const entities = Array.isArray(node.mainEntity) ? node.mainEntity : [];
        for (const entity of entities.slice(0, 12)) {
          const q = str((entity as Record<string, unknown>).name);
          const answer = (entity as Record<string, unknown>).acceptedAnswer as Record<string, unknown> | undefined;
          const a = answer ? str(answer.text) : null;
          if (q && a) {
            facts.faq.push({ question: q.slice(0, 200), answer: stripTags(a).slice(0, 600) });
            used = true;
          }
        }
      }
      if (!types.some((t) => ORG_TYPES.test(t))) continue;
      used = true;
      facts.name = facts.name ?? str(node.name)?.slice(0, 120) ?? null;
      facts.telephone = facts.telephone ?? str(node.telephone)?.slice(0, 40) ?? null;
      facts.email = facts.email ?? str(node.email)?.replace(/^mailto:/i, '').slice(0, 120) ?? null;
      const address = node.address;
      if (address && typeof address === 'object' && !Array.isArray(address)) {
        const a = address as Record<string, unknown>;
        facts.streetAddress = facts.streetAddress ?? str(a.streetAddress)?.slice(0, 120) ?? null;
        facts.postalCode = facts.postalCode ?? str(a.postalCode)?.slice(0, 12) ?? null;
        facts.locality = facts.locality ?? str(a.addressLocality)?.slice(0, 80) ?? null;
      } else if (typeof address === 'string' && !facts.locality) {
        const match = POSTCODE_CITY.exec(address.slice(0, 200));
        if (match) {
          facts.postalCode = match[1];
          facts.locality = match[2];
        }
      }
      const hours = node.openingHours;
      if (!facts.openingHours && (typeof hours === 'string' || Array.isArray(hours))) {
        facts.openingHours = (Array.isArray(hours) ? hours.filter((h) => typeof h === 'string').join('; ') : hours).slice(0, 160) || null;
      }
      if (Array.isArray(node.sameAs)) {
        for (const s of node.sameAs) if (typeof s === 'string' && facts.sameAs.length < 10) facts.sameAs.push(s.slice(0, 200));
      }
      const rating = node.aggregateRating as Record<string, unknown> | undefined;
      if (rating && facts.ratingValue === null) {
        const value = Number(rating.ratingValue);
        const count = Number(rating.reviewCount ?? rating.ratingCount);
        const best = Number(rating.bestRating ?? 5);
        if (Number.isFinite(value) && value > 0 && best === 5) {
          facts.ratingValue = Math.round(value * 10) / 10;
          facts.reviewCount = Number.isFinite(count) && count > 0 ? Math.round(count) : null;
        }
      }
    }
    if (used && !facts.ev) facts.ev = ev.element(script);
  }
  return facts;
}

function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const pending: unknown[] = [value];
  while (pending.length > 0 && out.length < 60) {
    const item = pending.shift();
    if (Array.isArray(item)) {
      pending.push(...item.slice(0, 30));
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (Array.isArray(record['@graph'])) pending.push(...(record['@graph'] as unknown[]).slice(0, 30));
    out.push(record);
  }
  return out;
}

function typesOf(node: Record<string, unknown>): string[] {
  const t = node['@type'];
  if (typeof t === 'string') return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string');
  return [];
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? collapseSpace(value.trim()) : null;
}

function stripTags(value: string): string {
  let out = '';
  let inTag = false;
  for (const ch of value) {
    if (ch === '<') inTag = true;
    else if (ch === '>') inTag = false;
    else if (!inTag) out += ch;
  }
  return collapseSpace(out);
}

// ─────────────────────────────────────────────────────────────────────
// Hilfen
// ─────────────────────────────────────────────────────────────────────

const BUTTON_CLASS = /(btn|button|cta|call-to-action|wp-block-button|elementor-button|et_pb_button|fusion-button|vc_btn|sqs-block-button|w-button|framer-button)/;
const ACTION_VERB = /(anfrag|kontakt|termin|buchen|buchung|jetzt|angebot|beratung|anruf|rufen sie|starten|kostenlos|demo|testen|bestell|kaufen|registrier|download|herunterlad|reservier|vereinbar|sichern|anmelden|schreiben sie|senden|rückruf|rueckruf|projekt anfragen|(?:^|\s)(?:get started|contact|book|buy|sign up|request)(?:\s|$))/;

function ctaIntent(label: string, lowerHref: string, url: URL | null): CtaIntent {
  const text = label.toLowerCase();
  if (lowerHref.startsWith('tel:')) return 'call';
  if (lowerHref.startsWith('mailto:')) return 'email';
  if (/(demo|testen|trial)/.test(text)) return 'demo';
  if (url && categorizeHost(url.hostname, url.pathname) === 'booking') return 'booking';
  if (/(termin|buchen|buchung|reservier|(?:^|\s)book(?:\s|$))/.test(text)) return 'booking';
  if (/(kaufen|bestell|warenkorb|in den korb|(?:^|\s)(?:shop|buy)(?:\s|$))/.test(text)) return 'buy';
  if (/(download|herunterlad)/.test(text) || (url !== null && /\.pdf$/i.test(url.pathname))) return 'download';
  if (/(anfrag|kontakt|angebot|beratung|rückruf|rueckruf|schreib|nachricht|contact|request|anruf)/.test(text)) return 'contact';
  return 'other';
}

function labelOfControl(el: HtmlElement): string | null {
  const text = el.tag === 'input' ? (el.attrs.value ?? '') : textOf(el, 120);
  const label = collapseSpace(text || el.attrs['aria-label'] || el.attrs.title || '');
  return label === '' ? null : label.slice(0, 120);
}

function relIncludes(el: HtmlElement, value: string): boolean {
  return (el.attrs.rel ?? '').toLowerCase().split(/\s+/).includes(value);
}

function googleFontFamilies(href: string): string[] {
  const out: string[] = [];
  const query = href.split('?')[1] ?? '';
  for (const part of query.split('&')) {
    const [key, raw] = part.split('=');
    if (key !== 'family' || !raw) continue;
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw.replace(/\+/g, ' '));
    } catch {
      decoded = raw.replace(/\+/g, ' ');
    }
    for (const family of decoded.split('|')) {
      const name = family.split(':')[0].trim();
      if (name && out.length < 6) out.push(name);
    }
  }
  return out;
}

export function safeParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function resolveHref(href: string, base: URL): URL | null {
  const trimmed = href.trim();
  if (trimmed === '' || trimmed.length > 2048) return null;
  try {
    return new URL(trimmed, base);
  } catch {
    return null;
  }
}

function isHttp(url: URL): boolean {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

/** URL ohne Fragment; optional auch ohne Query (für die Seitenmenge). */
export function stripHash(url: URL, dropQuery = false): string {
  const copy = new URL(url.toString());
  copy.hash = '';
  if (dropQuery) copy.search = '';
  return copy.toString();
}

function within(el: HtmlElement, container: HtmlElement): boolean {
  return el.start >= container.start && el.start < container.end;
}

function findLast(root: HtmlElement, predicate: (el: HtmlElement) => boolean): HtmlElement | null {
  const all = findAll(root, predicate);
  return all.length > 0 ? all[all.length - 1] : null;
}

function positiveInt(value: string | undefined): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 20000 ? n : null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDecimal(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

/**
 * Steht die Bewertung auch im sichtbaren Text — als Zahl in einem
 * Bewertungszusammenhang („4,9 von 5 Sternen", „★ 4.9 bei Google")?
 */
function ratingVisible(body: HtmlElement, rating: number): boolean {
  const variants = [...new Set([formatDecimal(rating), rating.toFixed(1), String(rating), String(rating).replace('.', ',')])];
  const number = new RegExp(`(^|[^\\d,.])(${variants.map(escapeRegExp).join('|')})(?![\\d])`);
  const context = /(stern|bewertung|rezension|von 5|\/\s?5\b|★|⭐|google|kundenzufriedenheit|rating|reviews?)/i;
  for (const node of textElements(body)) {
    if (isInside(node, byTag('script', 'style', 'noscript', 'template'))) continue;
    // Zahl und Zusammenhang stehen oft in Geschwistern („<b>4,9</b> von 5").
    const text = textOf(node.parent ?? node, 300);
    if (number.test(text) && context.test(text)) return true;
  }
  return false;
}

const REVIEW_PLATFORMS: ReadonlyArray<[string, string]> = [
  ['provenexpert.com', 'ProvenExpert'], ['trustpilot.com', 'Trustpilot'], ['trustedshops.com', 'Trusted Shops'], ['trustedshops.de', 'Trusted Shops'],
  ['ekomi.de', 'eKomi'], ['ekomi.com', 'eKomi'], ['kununu.com', 'kununu'], ['yelp.com', 'Yelp'], ['golocal.de', 'golocal'],
  ['werkenntdenbesten.de', 'WerkenntdenBESTEN'], ['jameda.de', 'jameda'], ['anwalt.de', 'anwalt.de'], ['reviews.io', 'REVIEWS.io'],
  ['shopauskunft.de', 'Shopauskunft'],
];

function reviewPlatform(host: string): string | null {
  const h = host.toLowerCase();
  for (const [domain, name] of REVIEW_PLATFORMS) if (h === domain || h.endsWith(`.${domain}`)) return name;
  return null;
}


// ─────────────────────────────────────────────────────────────────────
// Vorab-Erkundung für den Abruf
// ─────────────────────────────────────────────────────────────────────

export interface PageResources {
  /** Stylesheets derselben Website, in Dokumentreihenfolge. */
  stylesheets: string[];
  /** Interne Links als Kandidaten für die Unterseiten-Auswahl (`planCrawl`). */
  candidates: { url: string; label?: string; inNavigation?: boolean }[];
}

/**
 * Liest aus einer abgerufenen Seite, was als Nächstes abgerufen werden
 * könnte: Stylesheets derselben Website und interne Links. Nur Adressen —
 * ob und was davon geholt wird, entscheidet der Aufrufer (Limits, robots.txt).
 */
export function discoverPageResources(html: string, pageUrl: string): PageResources {
  const base = safeParseUrl(pageUrl);
  if (!base) return { stylesheets: [], candidates: [] };
  const doc = parseHtml(html);
  const host = base.hostname.toLowerCase();

  const stylesheets: string[] = [];
  for (const link of findAll(doc.root, byTag('link'))) {
    if (!relIncludes(link, 'stylesheet')) continue;
    const media = (link.attrs.media ?? 'all').toLowerCase();
    if (media.includes('print') && !media.includes('screen') && !media.includes('all')) continue;
    const resolved = resolveHref(link.attrs.href ?? '', base);
    if (!resolved || !isHttp(resolved) || !sameSite(resolved.hostname, host)) continue;
    const url = stripHash(resolved);
    if (!stylesheets.includes(url)) stylesheets.push(url);
    if (stylesheets.length >= 12) break;
  }

  const candidates: PageResources['candidates'] = [];
  const seen = new Set<string>();
  for (const anchor of findAll(doc.root, byTag('a'))) {
    const resolved = resolveHref(anchor.attrs.href ?? '', base);
    if (!resolved || !isHttp(resolved)) continue;
    if (resolved.hostname.replace(/^www\./, '') !== host.replace(/^www\./, '')) continue;
    const url = stripHash(resolved);
    if (seen.has(url)) continue;
    seen.add(url);
    candidates.push({
      url,
      label: textOf(anchor, 80) || undefined,
      inNavigation: isInside(anchor, (el) => el.tag === 'nav' || el.tag === 'header' || el.attrs.role === 'navigation'),
    });
    if (candidates.length >= 400) break;
  }
  return { stylesheets, candidates };
}
