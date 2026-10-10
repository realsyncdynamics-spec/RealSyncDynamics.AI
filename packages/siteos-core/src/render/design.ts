// Design-Layer: `DesignSpec` → Stylesheet für das gestaltete Markup.
//
// Dieselben Regeln wie in `theme.ts`: Die Werte stammen aus dem Blueprint und
// damit mittelbar aus fremdem CSS einer Ausgangsseite. Jeder Wert wird
// geprüft und bei Zweifel verworfen — Farben über `safeColor`, Schriften über
// `safeFontStack`, alles andere aus festen Listen. Das Stylesheet enthält nur
// Werte, die dieses Modul gebilligt hat.
//
// Gestaltungsgrundsätze (bewusst eng): eine Akzentfarbe, zwei Flächen, eine
// Schriftpaarung, eine Radius-Stufe, eine Abstandsstufe. Keine Verläufe als
// Dekor, keine Schatten-Kaskaden, Bewegung nur als kurzes Einblenden und nur
// ohne `prefers-reduced-motion`. Der Fokus bleibt immer sichtbar.

import type { DesignSpec } from '../types.ts';
import { safeColor, safeFontStack, safeRadius } from './theme.ts';

const DEFAULTS: DesignSpec = {
  version: 1,
  direction: 'clean-enterprise',
  mode: 'light',
  palette: { accent: '#1f4fbf', accentText: '#ffffff', surface: '#ffffff', surfaceAlt: '#f5f6f8', foreground: '#0f172a', muted: '#4b5563', line: '#e2e5ea' },
  typography: { display: 'system-ui, sans-serif', body: 'system-ui, sans-serif', displayWeight: 600, scale: 'regular', tracking: 'tight' },
  radius: { control: 8, card: 12 },
  spacing: 'regular',
  elevation: 'flat',
  cards: 'bordered',
  sections: 'plain',
  buttons: { primary: 'solid', secondary: 'outline' },
  hero: 'split',
  ctaEmphasis: 'standard',
  headerCta: true,
  motion: 'subtle',
  notes: [],
};

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Garantiert unbedenkliche Fassung eines Design-Systems. */
export function sanitizeDesign(input: Partial<DesignSpec> | undefined): DesignSpec {
  const d = input ?? {};
  const p = (d.palette ?? {}) as Partial<DesignSpec['palette']>;
  const t = (d.typography ?? {}) as Partial<DesignSpec['typography']>;
  const r = (d.radius ?? {}) as Partial<DesignSpec['radius']>;
  const b = (d.buttons ?? {}) as Partial<DesignSpec['buttons']>;
  const weight = t.displayWeight === 700 || t.displayWeight === 800 ? t.displayWeight : 600;
  return {
    version: 1,
    direction: pick(d.direction, ['clean-enterprise', 'conversion-focus', 'local-trust', 'premium-advisory'], 'clean-enterprise'),
    mode: d.mode === 'dark' ? 'dark' : 'light',
    palette: {
      accent: safeColor(p.accent) ?? DEFAULTS.palette.accent,
      accentText: safeColor(p.accentText) ?? DEFAULTS.palette.accentText,
      surface: safeColor(p.surface) ?? DEFAULTS.palette.surface,
      surfaceAlt: safeColor(p.surfaceAlt) ?? DEFAULTS.palette.surfaceAlt,
      foreground: safeColor(p.foreground) ?? DEFAULTS.palette.foreground,
      muted: safeColor(p.muted) ?? DEFAULTS.palette.muted,
      line: safeColor(p.line) ?? DEFAULTS.palette.line,
    },
    typography: {
      display: safeFontStack(t.display) ?? DEFAULTS.typography.display,
      body: safeFontStack(t.body) ?? DEFAULTS.typography.body,
      displayWeight: weight,
      scale: pick(t.scale, ['compact', 'regular', 'expressive'], 'regular'),
      tracking: pick(t.tracking, ['normal', 'tight'], 'tight'),
    },
    radius: { control: Math.min(safeRadius(r.control), 24), card: Math.min(safeRadius(r.card), 28) },
    spacing: pick(d.spacing, ['compact', 'regular', 'airy'], 'regular'),
    elevation: pick(d.elevation, ['flat', 'soft'], 'flat'),
    cards: pick(d.cards, ['bordered', 'elevated', 'tinted'], 'bordered'),
    sections: pick(d.sections, ['plain', 'banded'], 'plain'),
    buttons: { primary: pick(b.primary, ['solid', 'pill'], 'solid'), secondary: pick(b.secondary, ['outline', 'ghost'], 'outline') },
    hero: pick(d.hero, ['split', 'centered', 'editorial'], 'split'),
    ctaEmphasis: pick(d.ctaEmphasis, ['standard', 'strong'], 'standard'),
    headerCta: d.headerCta !== false,
    motion: pick(d.motion, ['none', 'subtle'], 'subtle'),
    notes: [],
  };
}

const SECTION_Y: Readonly<Record<DesignSpec['spacing'], string>> = {
  compact: 'clamp(3rem,6vw,4.5rem)',
  regular: 'clamp(4rem,8vw,6.5rem)',
  airy: 'clamp(4.75rem,10vw,8.25rem)',
};

const H1_SIZE: Readonly<Record<DesignSpec['typography']['scale'], string>> = {
  compact: 'clamp(2.1rem,3.4vw + 1rem,3.35rem)',
  regular: 'clamp(2.35rem,4.2vw + 1rem,4.1rem)',
  expressive: 'clamp(2.6rem,5.4vw + .9rem,4.9rem)',
};

const H2_SIZE: Readonly<Record<DesignSpec['typography']['scale'], string>> = {
  compact: 'clamp(1.55rem,1.6vw + 1rem,2.1rem)',
  regular: 'clamp(1.7rem,2vw + 1rem,2.5rem)',
  expressive: 'clamp(1.85rem,2.6vw + 1rem,2.9rem)',
};

/**
 * Stylesheet des gestalteten Zweigs. Deterministisch: gleiches System ⇒
 * gleiches CSS. Wird nach `renderThemeCss` ausgegeben und überschreibt
 * dessen Grundregeln; Fokus- und Bewegungsregeln des Kerns bleiben wirksam.
 */
export function renderDesignCss(input: Partial<DesignSpec> | undefined): string {
  const d = sanitizeDesign(input);
  const pal = d.palette;
  const dark = d.mode === 'dark';
  const pill = d.buttons.primary === 'pill';
  const controlRadius = pill ? '999px' : `${d.radius.control}px`;
  const shadow = d.elevation === 'soft'
    ? (dark ? '0 1px 0 rgba(255,255,255,.04) inset,0 18px 40px -24px rgba(0,0,0,.7)' : '0 1px 2px rgba(15,23,42,.05),0 14px 32px -18px rgba(15,23,42,.22)')
    : 'none';
  const cardSurface = d.cards === 'tinted' ? 'var(--rs-surface-alt)' : 'var(--rs-surface)';
  const cardBorder = d.cards === 'tinted' ? '1px solid transparent' : '1px solid var(--rs-line)';
  const cardShadow = d.cards === 'elevated' ? 'var(--rs-shadow)' : 'none';

  const tokens = [
    ':root{',
    `--rs-accent:${pal.accent};`,
    `--rs-accent-text:${pal.accentText};`,
    `--rs-surface:${pal.surface};`,
    `--rs-surface-alt:${pal.surfaceAlt};`,
    `--rs-fg:${pal.foreground};`,
    `--rs-muted:${pal.muted};`,
    `--rs-line:${pal.line};`,
    '--rs-line-strong:color-mix(in srgb,var(--rs-fg) 22%,var(--rs-surface));',
    '--rs-accent-soft:color-mix(in srgb,var(--rs-accent) 11%,var(--rs-surface));',
    `--rs-font-display:${d.typography.display};`,
    `--rs-font-body:${d.typography.body};`,
    `--rs-display-weight:${d.typography.displayWeight};`,
    `--rs-tracking:${d.typography.tracking === 'tight' ? '-0.022em' : '-0.008em'};`,
    `--rs-h1:${H1_SIZE[d.typography.scale]};`,
    `--rs-h2:${H2_SIZE[d.typography.scale]};`,
    `--rs-radius:${controlRadius};`,
    `--rs-radius-card:${d.radius.card}px;`,
    `--rs-section-y:${SECTION_Y[d.spacing]};`,
    `--rs-shadow:${shadow};`,
    '--rs-maxw:1160px;',
    '--rs-gutter:clamp(1.25rem,4vw,2.5rem);',
    '--rs-header-h:72px;',
    '}',
  ].join('');

  const rules = [
    // ── Grundlage ──────────────────────────────────────────────────
    `html{color-scheme:${dark ? 'dark' : 'light'};-webkit-text-size-adjust:100%;scroll-behavior:smooth;}`,
    'body{margin:0;background:var(--rs-surface);color:var(--rs-fg);font-family:var(--rs-font-body);',
    'font-size:clamp(16px,.35vw + 15px,18px);line-height:1.65;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}',
    // Die 72ch-Grenze des Kern-Stylesheets gilt für Fließtext, nicht fürs Raster.
    'body main,body header,body footer{max-width:none;margin:0;padding:0;}',
    '.rs-container{max-width:var(--rs-maxw);margin:0 auto;padding:0 var(--rs-gutter);}',
    'h1,h2,h3{font-family:var(--rs-font-display);font-weight:var(--rs-display-weight);letter-spacing:var(--rs-tracking);color:var(--rs-fg);margin:0;}',
    'h1,h2{text-wrap:balance;}',
    'h2{font-size:var(--rs-h2);line-height:1.12;}',
    'h3{font-size:1.14rem;line-height:1.3;letter-spacing:-.01em;}',
    'p{margin:0;}',
    'a{color:var(--rs-accent);text-underline-offset:.2em;text-decoration-thickness:1px;}',
    'ul,ol{margin:0;padding:0;list-style:none;}',
    'img{max-width:100%;height:auto;display:block;}',
    '.rs-icon{flex:none;color:var(--rs-accent);}',
    '.rs-icon--lg{width:28px;height:28px;}',
    '[id]{scroll-margin-top:calc(var(--rs-header-h) + 16px);}',
    '.rs-anchor{display:block;height:0;}',
    '.skip-link:focus{background:var(--rs-surface);color:var(--rs-fg);}',

    // ── Schaltflächen ──────────────────────────────────────────────
    '.rs-btn{display:inline-flex;align-items:center;justify-content:center;gap:.55rem;min-height:48px;padding:0 1.3rem;',
    'border-radius:var(--rs-radius);font-family:var(--rs-font-body);font-weight:600;font-size:1rem;line-height:1.1;',
    'text-decoration:none;border:1px solid transparent;cursor:pointer;white-space:nowrap;}',
    '.rs-btn .rs-icon{color:currentColor;}',
    '.rs-btn--primary{background:var(--rs-accent);color:var(--rs-accent-text);box-shadow:var(--rs-shadow);}',
    '.rs-btn--primary:hover{background:color-mix(in srgb,var(--rs-accent) 88%,var(--rs-fg));}',
    d.buttons.secondary === 'outline'
      ? '.rs-btn--secondary{background:transparent;color:var(--rs-fg);border-color:var(--rs-line-strong);}.rs-btn--secondary:hover{border-color:var(--rs-fg);}'
      : '.rs-btn--secondary{background:transparent;color:var(--rs-accent);padding:0 .35rem;}.rs-btn--secondary:hover{text-decoration:underline;}',
    '.rs-btn--inverse{background:var(--rs-accent-text);color:var(--rs-accent);}',
    '.rs-btn--sm{min-height:40px;padding:0 1rem;font-size:.94rem;box-shadow:none;}',
    '.rs-btn--lg{min-height:54px;padding:0 1.6rem;font-size:1.05rem;}',
    '.rs-btn--block{width:100%;}',
    // Der Kern setzt `button{background:var(--accent)…}` — für unsere
    // Knöpfe gelten die eigenen Klassen.
    'button.rs-btn{font:inherit;font-weight:600;}',
    '.rs-btn:focus-visible,a:focus-visible,summary:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid var(--rs-accent);outline-offset:3px;}',

    // ── Kopf ───────────────────────────────────────────────────────
    '.rs-header{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--rs-surface) 88%,transparent);',
    '-webkit-backdrop-filter:saturate(1.4) blur(12px);backdrop-filter:saturate(1.4) blur(12px);border-bottom:1px solid var(--rs-line);}',
    '.rs-header__bar{display:flex;align-items:center;gap:clamp(1rem,3vw,2.5rem);min-height:var(--rs-header-h);}',
    '.rs-brand{font-family:var(--rs-font-display);font-weight:700;font-size:1.08rem;letter-spacing:-.015em;color:var(--rs-fg);text-decoration:none;white-space:nowrap;}',
    '.rs-nav{margin-left:auto;}',
    '.rs-nav ul{display:flex;gap:clamp(.9rem,2vw,1.9rem);}',
    '.rs-nav a{color:var(--rs-muted);text-decoration:none;font-size:.95rem;font-weight:500;}',
    '.rs-nav a:hover{color:var(--rs-fg);}',
    '.rs-header__cta{flex:none;}',
    '.rs-nav + .rs-header__cta{margin-left:0;}',
    '.rs-brand + .rs-header__cta{margin-left:auto;}',

    // ── Hero ───────────────────────────────────────────────────────
    '.rs-hero{padding-block:clamp(3.75rem,9vw,7.5rem) clamp(3.5rem,8vw,6.5rem);border-bottom:1px solid var(--rs-line);}',
    '.rs-hero[data-emphasis="compact"],.rs-hero--compact{padding-block:clamp(2.75rem,6vw,4.5rem);}',
    '.rs-hero[data-emphasis="tall"]{padding-block:clamp(5.5rem,13vw,10rem);}',
    '.rs-hero__grid{display:grid;gap:clamp(2.5rem,5vw,4.5rem);align-items:center;}',
    '.rs-hero__copy{max-width:40rem;}',
    '.rs-eyebrow{font-size:.8rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--rs-accent);margin-bottom:1.1rem;}',
    '.rs-hero__title{font-size:var(--rs-h1);line-height:1.04;}',
    '.rs-hero--compact .rs-hero__title{font-size:var(--rs-h2);}',
    '.rs-hero__lead{margin-top:1.35rem;font-size:clamp(1.06rem,.5vw + .95rem,1.28rem);line-height:1.6;color:var(--rs-muted);max-width:36em;}',
    '.rs-actions{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:2.1rem;}',
    '.rs-proof{display:flex;align-items:flex-start;gap:.55rem;margin-top:1.6rem;font-size:.94rem;color:var(--rs-muted);}',
    '.rs-proof .rs-icon{margin-top:.18rem;}',
    '.rs-hero--centered .rs-hero__grid{justify-items:center;text-align:center;}',
    '.rs-hero--centered .rs-hero__copy{max-width:46rem;}',
    '.rs-hero--centered .rs-hero__lead{margin-inline:auto;}',
    '.rs-hero--centered .rs-actions,.rs-hero--centered .rs-proof{justify-content:center;}',
    '.rs-hero--editorial .rs-hero__copy{max-width:52rem;}',
    '.rs-hero--editorial .rs-hero__title{max-width:18ch;}',
    '.rs-hero__media{position:relative;}',
    '.rs-hero__image{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--rs-radius-card);box-shadow:var(--rs-shadow);border:1px solid var(--rs-line);}',
    '.rs-hero__card{background:var(--rs-surface-alt);border:1px solid var(--rs-line);border-radius:var(--rs-radius-card);padding:clamp(1.5rem,3vw,2.25rem);box-shadow:var(--rs-shadow);}',
    '.rs-hero__card-title{font-size:.8rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--rs-muted);margin-bottom:1.1rem;}',
    '.rs-hero__rows li{display:flex;flex-direction:column;gap:.15rem;padding:.9rem 0;border-top:1px solid var(--rs-line);}',
    '.rs-hero__rows li:first-child{border-top:0;padding-top:0;}',
    '.rs-hero__rows span{font-size:.8rem;color:var(--rs-muted);}',
    '.rs-hero__rows a{font-size:1.15rem;font-weight:600;color:var(--rs-fg);text-decoration:none;}',
    '.rs-checklist{display:grid;gap:.8rem;}',
    '.rs-checklist li{display:flex;align-items:flex-start;gap:.65rem;font-weight:500;}',
    '.rs-checklist .rs-icon{margin-top:.2rem;}',

    // ── Abschnitte ─────────────────────────────────────────────────
    '.rs-section{padding-block:var(--rs-section-y);}',
    d.sections === 'banded' ? '.rs-section[data-tone="alt"]{background:var(--rs-surface-alt);}' : '.rs-section + .rs-section{border-top:1px solid var(--rs-line);}',
    '.rs-section__head{max-width:44rem;margin-bottom:clamp(2rem,4vw,3rem);}',
    '.rs-section__intro{margin-top:.9rem;color:var(--rs-muted);font-size:1.08rem;}',

    // ── Trust-Leiste ───────────────────────────────────────────────
    '.rs-trust{padding-block:clamp(1.4rem,3vw,2rem);border-bottom:1px solid var(--rs-line);background:var(--rs-surface);}',
    '.rs-trust__title{font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:var(--rs-muted);font-family:var(--rs-font-body);font-weight:600;margin-bottom:.9rem;}',
    '.rs-trust__list{display:flex;flex-wrap:wrap;align-items:center;gap:.75rem clamp(1.25rem,3vw,2.5rem);}',
    '.rs-trust__list li{display:inline-flex;align-items:center;gap:.5rem;font-weight:500;font-size:.96rem;color:var(--rs-fg);}',

    // ── Karten ─────────────────────────────────────────────────────
    '.rs-cards{display:grid;gap:clamp(1rem,2vw,1.5rem);grid-template-columns:repeat(auto-fit,minmax(min(100%,16.5rem),1fr));counter-reset:rs-card;}',
    `.rs-card{background:${cardSurface};border:${cardBorder};border-radius:var(--rs-radius-card);padding:clamp(1.4rem,2.4vw,1.9rem);box-shadow:${cardShadow};}`,
    '.rs-card h3{margin-bottom:.55rem;}',
    '.rs-card p{color:var(--rs-muted);font-size:.98rem;}',
    '.rs-card .rs-icon{margin-bottom:.9rem;}',
    '.rs-card__index{display:block;font-family:var(--rs-font-display);font-size:.9rem;font-weight:600;color:var(--rs-accent);margin-bottom:1.1rem;letter-spacing:.02em;}',
    '.rs-cards--list{grid-template-columns:1fr;gap:0;}',
    '.rs-cards--list .rs-card{border-radius:0;border-width:0 0 1px;background:transparent;box-shadow:none;padding-inline:0;}',

    // ── Problem / Lösung ───────────────────────────────────────────
    '.rs-ps__grid{display:grid;gap:clamp(2rem,5vw,5rem);align-items:start;}',
    '.rs-ps__problem{font-size:var(--rs-h2);line-height:1.12;}',
    '.rs-ps__solution{font-size:1.15rem;color:var(--rs-fg);margin-bottom:1.6rem;}',

    // ── Ablauf ─────────────────────────────────────────────────────
    '.rs-steps{display:grid;gap:clamp(1.25rem,3vw,2rem);grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr));}',
    '.rs-step{position:relative;padding-top:3.4rem;}',
    '.rs-step__num{position:absolute;top:0;left:0;display:grid;place-items:center;width:2.4rem;height:2.4rem;border-radius:999px;',
    'background:var(--rs-accent-soft);color:var(--rs-accent);font-weight:700;font-family:var(--rs-font-display);}',
    '.rs-step p{margin-top:.45rem;color:var(--rs-muted);}',

    // ── Preise ─────────────────────────────────────────────────────
    '.rs-price-grid{display:grid;gap:1.25rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr));}',
    '.rs-price__value{font-family:var(--rs-font-display);font-size:1.7rem;font-weight:700;color:var(--rs-fg)!important;letter-spacing:-.02em;margin-top:.35rem;}',
    '.rs-note{margin-top:1.25rem;font-size:.88rem;color:var(--rs-muted);}',
    '.rs-note a{color:inherit;}',

    // ── Stimmen ────────────────────────────────────────────────────
    '.rs-quotes{display:grid;gap:1.25rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr));}',
    '.rs-quote blockquote{margin:0;}',
    '.rs-quote blockquote p{font-size:1.1rem;line-height:1.6;color:var(--rs-fg);}',
    '.rs-quote blockquote p::before{content:"\\201E";color:var(--rs-accent);font-family:var(--rs-font-display);margin-right:.1em;}',
    '.rs-quote blockquote p::after{content:"\\201C";color:var(--rs-accent);font-family:var(--rs-font-display);margin-left:.05em;}',
    '.rs-quote__author{margin-top:1.1rem;font-size:.9rem;color:var(--rs-muted);font-weight:500;}',

    // ── Über uns, Team ─────────────────────────────────────────────
    '.rs-about__grid{display:grid;gap:clamp(1.25rem,4vw,4rem);}',
    '.rs-about__body{font-size:1.12rem;color:var(--rs-fg);max-width:40em;}',
    '.rs-team{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr));}',

    // ── FAQ ────────────────────────────────────────────────────────
    '.rs-faq__wrap{max-width:52rem;}',
    '.rs-faq details{border-bottom:1px solid var(--rs-line);}',
    '.rs-faq details:first-child{border-top:1px solid var(--rs-line);}',
    '.rs-faq summary{display:flex;justify-content:space-between;gap:1rem;align-items:center;padding:1.2rem 0;cursor:pointer;',
    'font-weight:600;font-size:1.05rem;list-style:none;}',
    '.rs-faq summary::-webkit-details-marker{display:none;}',
    '.rs-faq summary::after{content:"+";font-size:1.4rem;line-height:1;color:var(--rs-accent);flex:none;}',
    '.rs-faq details[open] summary::after{content:"\\2212";}',
    '.rs-faq details p{padding:0 0 1.3rem;color:var(--rs-muted);max-width:44em;}',

    // ── Kontakt ────────────────────────────────────────────────────
    '.rs-contact__card{font-style:normal;max-width:48rem;}',
    '.rs-contact__card dl{display:grid;gap:1.25rem 2rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,13rem),1fr));margin:0;}',
    '.rs-contact__card dt{font-size:.78rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--rs-muted);margin-bottom:.3rem;}',
    '.rs-contact__card dd{margin:0;font-size:1.05rem;}',
    '.rs-contact__card dd a{color:var(--rs-fg);font-weight:600;text-decoration:none;}',
    '.rs-contact__card dd a:hover{color:var(--rs-accent);}',

    // ── Formular ───────────────────────────────────────────────────
    '.rs-lead__grid{display:grid;gap:clamp(2rem,5vw,4.5rem);align-items:start;}',
    '.rs-lead__text{margin-top:1rem;font-size:1.08rem;color:var(--rs-muted);}',
    '.rs-lead__intro .rs-note{margin-top:1.5rem;}',
    '.rs-form{box-shadow:var(--rs-shadow);max-width:none;margin:0;}',
    '.rs-form__fields{display:grid;gap:1.1rem 1.25rem;}',
    '.rs-field label{display:block;margin:0 0 .4rem;font-size:.9rem;font-weight:500;color:var(--rs-fg);}',
    '.rs-optional{color:var(--rs-muted);font-weight:400;}',
    '.rs-field input,.rs-field textarea{display:block;width:100%;margin:0;padding:.78rem .9rem;border:1px solid var(--rs-line-strong);',
    'border-radius:var(--rs-radius);background:var(--rs-surface);color:var(--rs-fg);font:inherit;font-size:1rem;}',
    '.rs-field textarea{min-height:8.5rem;resize:vertical;}',
    '.rs-field input:focus,.rs-field textarea:focus{border-color:var(--rs-accent);}',
    '.rs-consent{display:flex;gap:.7rem;align-items:flex-start;margin:1.25rem 0 1.4rem;font-size:.9rem;color:var(--rs-muted);}',
    '.rs-consent input{flex:none;width:1.15rem;height:1.15rem;margin:.2rem 0 0;accent-color:var(--rs-accent);display:inline-block;}',
    '.rs-consent label{display:inline;margin:0;}',
    '.rs-form[data-target-missing] button[type="submit"]{opacity:.9;}',

    // ── Karte (Einwilligungsschranke) ──────────────────────────────
    // Bleibt als Schranke erkennbar (TDDDG § 25) — nicht wegzugestalten.
    '.rs-map__gate{border-style:dashed;text-align:center;max-width:48rem;margin:0 auto;}',
    '.rs-map__gate h2{font-size:1.35rem;margin-bottom:.6rem;}',
    '.rs-map__gate p{margin-bottom:1.2rem;}',

    // ── Governance ─────────────────────────────────────────────────
    '.rs-governance{padding-block:clamp(2.5rem,5vw,3.5rem);}',
    '.rs-gov{display:flex;gap:1.1rem;align-items:flex-start;max-width:52rem;color:var(--rs-muted);font-size:.94rem;}',
    '.rs-gov h2{font-size:1.1rem;font-family:var(--rs-font-body);font-weight:600;letter-spacing:0;margin-bottom:.55rem;}',
    '.rs-gov ul{display:grid;gap:.4rem;}',
    '.rs-gov li{padding-left:1rem;position:relative;}',
    '.rs-gov li::before{content:"";position:absolute;left:0;top:.72em;width:5px;height:5px;border-radius:999px;background:var(--rs-accent);}',

    // ── Handlungsaufforderung ──────────────────────────────────────
    '.rs-cta{padding-block:clamp(3.5rem,7vw,5.5rem);background:var(--rs-surface-alt);}',
    '.rs-cta__inner{display:flex;flex-wrap:wrap;gap:1.5rem 2rem;align-items:center;justify-content:space-between;}',
    '.rs-cta h2{max-width:22ch;}',
    '.rs-cta--strong{background:var(--rs-accent);}',
    '.rs-cta--strong h2{color:var(--rs-accent-text);}',

    // ── KI-Hinweis, Rechtstexte ────────────────────────────────────
    // Zurückgenommen, aber nie unsichtbar (Art. 50 EU AI Act).
    '.rs-ai{padding-block:1.25rem;border-top:1px solid var(--rs-line);font-size:.86rem;color:var(--rs-muted);}',
    '.rs-legal__wrap{max-width:52rem;}',
    '.rs-legal h1,.rs-legal h2{font-size:var(--rs-h2);margin-bottom:1.5rem;}',

    // ── Fuß ────────────────────────────────────────────────────────
    '.rs-footer{border-top:1px solid var(--rs-line);background:var(--rs-surface-alt);font-size:.93rem;color:var(--rs-muted);}',
    '.rs-footer__grid{display:grid;gap:2rem;padding-block:clamp(2.75rem,6vw,4rem) 2rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,11.5rem),1fr));}',
    '.rs-footer__brand{font-family:var(--rs-font-display);font-weight:700;color:var(--rs-fg);font-size:1.05rem;margin-bottom:.6rem;}',
    '.rs-footer__about{max-width:22rem;}',
    '.rs-footer__label{font-size:.76rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--rs-fg);margin-bottom:.8rem;}',
    '.rs-footer ul{display:grid;gap:.45rem;}',
    '.rs-footer a{color:var(--rs-muted);text-decoration:none;}',
    '.rs-footer a:hover{color:var(--rs-fg);text-decoration:underline;}',
    '.rs-footer__base{padding-block:1.25rem 2rem;border-top:1px solid var(--rs-line);font-size:.85rem;}',

    // ── Breakpoints ────────────────────────────────────────────────
    '@media (min-width:900px){',
    '.rs-hero--split .rs-hero__grid{grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);}',
    '.rs-ps__grid{grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr);}',
    '.rs-about__grid{grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);}',
    '.rs-lead__grid{grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);}',
    '.rs-form__fields{grid-template-columns:1fr 1fr;}',
    '.rs-field--message,.rs-field--slot{grid-column:1 / -1;}',
    '}',
    '@media (max-width:899px){',
    '.rs-header__bar{flex-wrap:wrap;row-gap:0;padding-block:.65rem;}',
    '.rs-nav{order:3;flex-basis:100%;margin:0 calc(var(--rs-gutter) * -1);overflow-x:auto;-webkit-overflow-scrolling:touch;}',
    '.rs-nav ul{padding:.55rem var(--rs-gutter) .35rem;gap:1rem;width:max-content;}',
    '.rs-nav a{font-size:.9rem;}',
    '.rs-brand{margin-right:auto;}',
    '.rs-brand + .rs-header__cta,.rs-nav + .rs-header__cta{margin-left:auto;}',
    '}',
    '@media (max-width:639px){',
    '.rs-actions .rs-btn{flex:1 1 100%;}',
    '.rs-cta__inner .rs-btn{width:100%;}',
    '.rs-header__cta{min-height:38px;padding:0 .85rem;font-size:.9rem;}',
    '}',
  ];

  const motion = d.motion === 'subtle'
    ? [
      '@media (prefers-reduced-motion:no-preference){',
      '.rs-btn,.rs-nav a,.rs-footer a,.rs-card{transition:background-color .15s ease,border-color .15s ease,color .15s ease,box-shadow .2s ease,transform .2s ease;}',
      '.rs-hero__copy,.rs-hero__media,.rs-hero__card{animation:rsRise .7s cubic-bezier(.2,.7,.2,1) both;}',
      '.rs-hero__media,.rs-hero__card{animation-delay:.08s;}',
      '.rs-cards--cards .rs-card:hover{transform:translateY(-2px);}',
      '@keyframes rsRise{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:none;}}',
      '}',
    ]
    : [];

  return [tokens, ...rules, ...motion].join('');
}
