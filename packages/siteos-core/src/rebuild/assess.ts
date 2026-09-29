// ASSESS (Teil 2) — Ist-Zustand in acht Kriterien.
//
// Hero-Klarheit, CTA-Struktur, Vertrauenssignale, mobile UX,
// Textverständlichkeit, visuelle Hierarchie, SEO-Grundlagen,
// Conversion-Fokus.
//
// ## Regeln, die dieses Modul einhält
//
// 1. **Jeder Befund hat einen Beleg.** `finding()` verwirft einen Befund
//    ohne Evidence-Kennung, statt ihn auszugeben. Ein Befund, den niemand
//    nachprüfen kann, gehört nicht in einen Kundenbericht.
// 2. **Punktzahlen sind reine Funktionen der Befunde.** 100 minus feste
//    Abzüge je Schweregrad (ASSESSMENT_PENALTIES). Keine verdeckten
//    Eingaben, keine Prognose — ausdrücklich keine „Conversion-Rate".
// 3. **Grenzen werden benannt.** Mobile UX ist hier eine statische Prüfung
//    von Viewport und CSS, kein Rendering auf einem Gerät. Das steht im
//    Ergebnis (`coverageNote`), nicht nur im Code.
//
// Befund-Codes sind stabil (wie in `analysis/blueprint.ts`): Sie stehen in
// gespeicherten Läufen und Nachweisen. Nie umbenennen.

import type {
  Assessment,
  AssessmentFinding,
  AssessmentSeverity,
  Criterion,
  CriterionResult,
  Positioning,
  SourcePage,
  SourceSnapshot,
} from './types.ts';
import { REBUILD_ENGINE_VERSION } from './types.ts';
import { hexToHsl } from './color.ts';
import { toWellFormed } from './well-formed.ts';

/** Abzüge je Befund. Versionsrelevant — in Berichten zitiert. */
export const ASSESSMENT_PENALTIES: Readonly<Record<AssessmentSeverity, number>> = Object.freeze({
  high: 30,
  medium: 15,
  low: 6,
  info: 0,
});

export const CRITERION_LABELS: Readonly<Record<Criterion, string>> = Object.freeze({
  'hero-clarity': 'Hero-Klarheit',
  'cta-structure': 'CTA-Struktur',
  'trust-signals': 'Vertrauenssignale',
  'mobile-ux': 'Mobile UX',
  readability: 'Textverständlichkeit',
  'visual-hierarchy': 'Visuelle Hierarchie',
  'seo-basics': 'SEO-Grundlagen',
  'conversion-focus': 'Conversion-Fokus',
});

const CRITERIA: readonly Criterion[] = Object.keys(CRITERION_LABELS) as Criterion[];

const GENERIC_HEADLINE = /^(herzlich\s+)?willkommen\b|^home$|^startseite$|^start$|^welcome\b|^hallo\b|^aktuelles$/i;
const VAGUE_CTA = /^(mehr|mehr erfahren|mehr infos?|weiter|weiterlesen|hier|hier klicken|klicken sie hier|details|read more|learn more|zur seite|entdecken)$/i;

interface Draft {
  code: string;
  criterion: Criterion;
  severity: AssessmentSeverity;
  title: string;
  detail: string;
  recommendation: string;
  evidence: (string | null | undefined)[];
  pageUrl: string;
}

export function assessSnapshot(snapshot: SourceSnapshot, positioning: Positioning, assessedAt: string): Assessment {
  const findings: AssessmentFinding[] = [];
  const strengths = new Map<Criterion, { text: string; evidence: string[] }[]>();
  const add = (draft: Draft) => {
    const evidence = [...new Set(draft.evidence.filter((e): e is string => typeof e === 'string' && e !== ''))];
    if (evidence.length === 0) return; // Regel 1: kein Befund ohne Beleg
    if (findings.some((f) => f.code === draft.code && f.pageUrl === draft.pageUrl)) return;
    findings.push({ ...draft, evidence });
  };
  const strength = (criterion: Criterion, text: string, evidence: (string | null | undefined)[]) => {
    const ids = [...new Set(evidence.filter((e): e is string => typeof e === 'string'))];
    if (ids.length === 0) return;
    const list = strengths.get(criterion) ?? [];
    if (!list.some((s) => s.text === text)) list.push({ text, evidence: ids });
    strengths.set(criterion, list);
  };

  const home = snapshot.pages[0];
  if (home) {
    assessHero(home, positioning, add, strength);
    assessCtas(home, snapshot.pages, add, strength);
    assessTrust(home, snapshot.pages, add, strength);
    assessMobile(home, add, strength);
    assessReadability(home, add, strength);
    assessHierarchy(home, add, strength);
    assessSeo(snapshot, home, add, strength);
    assessConversion(home, snapshot.pages, positioning, add, strength);
  }

  const criteria: CriterionResult[] = CRITERIA.map((criterion) => {
    const own = findings.filter((f) => f.criterion === criterion);
    const score = Math.max(0, 100 - own.reduce((sum, f) => sum + ASSESSMENT_PENALTIES[f.severity], 0));
    return {
      criterion,
      label: CRITERION_LABELS[criterion],
      score,
      status: score >= 80 ? 'good' : score >= 55 ? 'fair' : 'poor',
      findingCodes: own.map((f) => f.code),
      strengths: strengths.get(criterion) ?? [],
      coverageNote: COVERAGE_NOTES[criterion] ?? null,
    };
  });

  const overall = criteria.length > 0 ? Math.round(criteria.reduce((sum, c) => sum + c.score, 0) / criteria.length) : 0;
  return toWellFormed({ engineVersion: REBUILD_ENGINE_VERSION, assessedAt, criteria, findings, overall });
}

const COVERAGE_NOTES: Partial<Record<Criterion, string>> = {
  'mobile-ux': 'Statische Prüfung von Viewport und CSS ohne Rendering auf einem Gerät. Layoutfehler, die erst im Browser entstehen, sind hier nicht erfasst.',
  readability: 'Lesbarkeit nach Amstad (Flesch, deutsch) als Näherung über Silbenzählung; erst ab 80 Wörtern Fließtext berechnet.',
  'visual-hierarchy': 'Aus Überschriftenstruktur, Schriften und Farben abgeleitet — kein Blick auf die gerenderte Seite.',
};

type Add = (draft: Draft) => void;
type Strength = (criterion: Criterion, text: string, evidence: (string | null | undefined)[]) => void;

// ─────────────────────────────────────────────────────────────────────
// Kriterien
// ─────────────────────────────────────────────────────────────────────

function assessHero(home: SourcePage, positioning: Positioning, add: Add, strength: Strength): void {
  const url = home.url;
  const h1Count = home.headings.filter((h) => h.level === 1).length;
  if (!home.hero) {
    add({
      code: 'rebuild.hero.missing-h1', criterion: 'hero-clarity', severity: 'high',
      title: 'Keine Hauptüberschrift (H1)',
      detail: 'Die Startseite hat keine H1. Besucher und Suchmaschinen sehen nicht auf einen Blick, worum es geht.',
      recommendation: 'Der Rebuild setzt eine H1, die Angebot und – falls belegt – Ort nennt.',
      evidence: [home.absences.h1], pageUrl: url,
    });
    return;
  }
  const headline = home.hero.headline;
  if (h1Count > 1) {
    add({
      code: 'rebuild.hero.multiple-h1', criterion: 'hero-clarity', severity: 'medium',
      title: `${h1Count} Hauptüberschriften auf der Startseite`,
      detail: 'Mehrere H1 konkurrieren um die Hauptaussage.',
      recommendation: 'Genau eine H1; weitere Überschriften werden H2.',
      evidence: home.headings.filter((h) => h.level === 1).map((h) => h.ev), pageUrl: url,
    });
  }
  const company = positioning.companyName.value?.toLowerCase() ?? '';
  const offerTerms = (positioning.offer.value ?? []).map((o) => o.toLowerCase());
  const lower = headline.toLowerCase();
  if (GENERIC_HEADLINE.test(headline.trim())) {
    add({
      code: 'rebuild.hero.generic-headline', criterion: 'hero-clarity', severity: 'medium',
      title: 'Hauptüberschrift ohne Aussage',
      detail: `Die H1 lautet „${headline}". Sie sagt nicht, was angeboten wird.`,
      recommendation: 'Die neue H1 benennt das Angebot im Wortlaut der eigenen Leistungen.',
      evidence: [home.hero.ev], pageUrl: url,
    });
  } else if (company !== '' && lower.replace(/\s+(gmbh|ug|ag|kg|e\.k\.|mbh|gbr)\b.*$/, '') === company.replace(/\s+(gmbh|ug|ag|kg|e\.k\.|mbh|gbr)\b.*$/, '')) {
    add({
      code: 'rebuild.hero.name-only-headline', criterion: 'hero-clarity', severity: 'low',
      title: 'Hauptüberschrift nennt nur den Firmennamen',
      detail: `Die H1 „${headline}" ist der Name — das Angebot steht erst darunter oder gar nicht.`,
      recommendation: 'Name als Wortmarke im Kopf, Angebot als H1.',
      evidence: [home.hero.ev], pageUrl: url,
    });
  } else if (offerTerms.length > 0 && offerTerms.some((term) => lower.includes(term.split(' ')[0]))) {
    strength('hero-clarity', 'Die H1 nennt das Angebot.', [home.hero.ev]);
  }
  const words = headline.split(/\s+/).length;
  if (words > 12 || headline.length > 90) {
    add({
      code: 'rebuild.hero.headline-too-long', criterion: 'hero-clarity', severity: 'low',
      title: `Hauptüberschrift mit ${words} Wörtern`,
      detail: 'Lange Überschriften werden auf Mobilgeräten mehrzeilig und verlieren an Wirkung.',
      recommendation: 'H1 auf höchstens zwölf Wörter kürzen; Details in die Unterzeile.',
      evidence: [home.hero.ev], pageUrl: url,
    });
  }
  if (!home.hero.subline) {
    add({
      code: 'rebuild.hero.no-subline', criterion: 'hero-clarity', severity: 'low',
      title: 'Keine erläuternde Unterzeile',
      detail: 'Unter der H1 folgt kein Satz, der Nutzen oder Zielgruppe erklärt.',
      recommendation: 'Unterzeile aus der eigenen Beschreibung der Website übernehmen.',
      evidence: [home.hero.ev], pageUrl: url,
    });
  } else {
    strength('hero-clarity', 'Unter der H1 steht eine erläuternde Unterzeile.', [home.hero.ev]);
  }
}

function assessCtas(home: SourcePage, pages: SourcePage[], add: Add, strength: Strength): void {
  const url = home.url;
  if (home.ctas.length === 0) {
    add({
      code: 'rebuild.cta.none', criterion: 'cta-structure', severity: 'high',
      title: 'Keine Handlungsaufforderung auf der Startseite',
      detail: 'Keine Schaltfläche, kein Aktionslink, kein anklickbarer Telefon- oder E-Mail-Link.',
      recommendation: 'Primärer CTA im Hero und im Kopfbereich, abgestimmt auf das Conversion-Ziel.',
      evidence: [home.absences.cta], pageUrl: url,
    });
    return;
  }
  const inHero = home.ctas.filter((c) => c.inHero);
  if (home.hero && inHero.length === 0) {
    add({
      code: 'rebuild.cta.not-in-hero', criterion: 'cta-structure', severity: 'medium',
      title: 'Keine Handlungsaufforderung im Hero',
      detail: 'Im sichtbaren Einstiegsbereich gibt es keinen nächsten Schritt.',
      recommendation: 'Primärer und sekundärer CTA direkt unter der Unterzeile.',
      evidence: [home.hero.ev, home.ctas[0].ev], pageUrl: url,
    });
  } else if (inHero.length > 0) {
    strength('cta-structure', `CTA im Hero: „${inHero[0].label}".`, [inHero[0].ev]);
  }
  const specific = home.ctas.filter((c) => !VAGUE_CTA.test(c.label.trim()));
  if (specific.length === 0) {
    add({
      code: 'rebuild.cta.vague-labels', criterion: 'cta-structure', severity: 'medium',
      title: 'Nur unspezifische Schaltflächen',
      detail: `Beschriftungen wie „${home.ctas[0].label}" sagen nicht, was nach dem Klick passiert.`,
      recommendation: 'Beschriftung nach Ziel: „Anfrage senden", „Termin vereinbaren", „Jetzt anrufen".',
      evidence: home.ctas.slice(0, 3).map((c) => c.ev), pageUrl: url,
    });
  }
  const distinct = new Set(home.ctas.filter((c) => c.buttonLike).map((c) => c.label.toLowerCase()));
  if (distinct.size > 8) {
    add({
      code: 'rebuild.cta.too-many', criterion: 'cta-structure', severity: 'low',
      title: `${distinct.size} verschiedene Schaltflächen auf der Startseite`,
      detail: 'Viele gleichrangige Aufforderungen verteilen die Aufmerksamkeit.',
      recommendation: 'Ein primärer CTA, ein sekundärer; der Rest als Textlink.',
      evidence: home.ctas.filter((c) => c.buttonLike).slice(0, 4).map((c) => c.ev), pageUrl: url,
    });
  }
  // Nur eine sichtbar im Text stehende Nummer ist „nicht anklickbar" — eine
  // Nummer, die ausschließlich in den strukturierten Daten steht, sieht
  // niemand. Die Aussage wäre sonst falsch.
  const phoneWithoutLink = pages.flatMap((p) => p.contact.phones).find((p) => p.source === 'text');
  const anyTelLink = pages.some((p) => p.contact.phones.some((ph) => ph.href !== null));
  if (phoneWithoutLink && !home.contact.phones.some((p) => p.href !== null)) {
    add({
      code: 'rebuild.cta.phone-not-clickable', criterion: 'cta-structure', severity: anyTelLink ? 'low' : 'medium',
      title: 'Telefonnummer auf der Startseite nicht anklickbar',
      detail: `Die Nummer ${phoneWithoutLink.value} steht als Text, nicht als tel:-Link — auf dem Smartphone ist Anrufen ein Umweg.`,
      recommendation: 'Nummer als tel:-Link im Kopfbereich und im Kontaktblock.',
      evidence: [phoneWithoutLink.ev], pageUrl: url,
    });
  } else if (home.contact.phones.some((p) => p.href !== null)) {
    strength('cta-structure', 'Telefonnummer als anklickbarer Link.', [home.contact.phones.find((p) => p.href !== null)?.ev]);
  }
}

function assessTrust(home: SourcePage, pages: SourcePage[], add: Add, strength: Strength): void {
  const url = home.url;
  const substantive = home.trust.filter((t) => t.kind !== 'imprint-link' && t.kind !== 'privacy-link');
  const siteWide = pages.flatMap((p) => p.trust).filter((t) => t.kind !== 'imprint-link' && t.kind !== 'privacy-link');
  if (!home.trust.some((t) => t.kind === 'imprint-link')) {
    add({
      code: 'rebuild.trust.no-imprint-link', criterion: 'trust-signals', severity: 'high',
      title: 'Kein Impressum-Link auf der Startseite',
      detail: 'Das Impressum muss leicht erkennbar und unmittelbar erreichbar sein (§ 5 DDG).',
      recommendation: 'Impressum im Fußbereich jeder Seite.',
      evidence: [home.absences['imprint-link']], pageUrl: url,
    });
  }
  if (!home.trust.some((t) => t.kind === 'privacy-link')) {
    add({
      code: 'rebuild.trust.no-privacy-link', criterion: 'trust-signals', severity: 'high',
      title: 'Kein Datenschutz-Link auf der Startseite',
      detail: 'Die Datenschutzerklärung ist von der Startseite aus nicht verlinkt (Art. 13 DSGVO).',
      recommendation: 'Datenschutz im Fußbereich jeder Seite und an jedem Formular.',
      evidence: [home.absences['privacy-link']], pageUrl: url,
    });
  }
  if (siteWide.length === 0) {
    add({
      code: 'rebuild.trust.none', criterion: 'trust-signals', severity: 'medium',
      title: 'Keine belegbaren Vertrauenssignale gefunden',
      detail: 'Keine Zertifikate, Mitgliedschaften, Kundenstimmen, Bewertungen oder Jahresangaben auf den gelesenen Seiten.',
      recommendation: 'Der Rebuild erfindet keine. Echte Referenzen, Siegel oder Bewertungen pflegen — dann erscheint eine Trust-Leiste.',
      evidence: [home.documentEv], pageUrl: url,
    });
  } else if (substantive.length === 0) {
    add({
      code: 'rebuild.trust.not-on-home', criterion: 'trust-signals', severity: 'low',
      title: 'Vertrauenssignale nur auf Unterseiten',
      detail: `${siteWide.length} Vertrauenssignal(e) gefunden, keines davon auf der Startseite.`,
      recommendation: 'Belegte Signale als Trust-Leiste direkt unter den Hero holen.',
      evidence: siteWide.slice(0, 3).map((t) => t.ev), pageUrl: url,
    });
  } else {
    strength('trust-signals', `${substantive.length} belegte Vertrauenssignal(e) auf der Startseite.`, substantive.slice(0, 3).map((t) => t.ev));
  }
  if (home.contact.phones.length === 0 && home.contact.emails.length === 0 && home.contact.address === null) {
    add({
      code: 'rebuild.trust.no-contact-data', criterion: 'trust-signals', severity: 'medium',
      title: 'Keine Kontaktdaten auf der Startseite',
      detail: 'Weder Telefon noch E-Mail noch Anschrift sind auf der Startseite zu sehen.',
      recommendation: 'Kontaktblock mit den belegten Daten der Kontakt- oder Impressumsseite.',
      evidence: [home.absences.contact], pageUrl: url,
    });
  }
  const tracking = home.thirdParty.filter((t) => t.category === 'analytics' || t.category === 'ads');
  const consentTool = home.thirdParty.some((t) => t.category === 'consent');
  if (tracking.length > 0 && !consentTool) {
    add({
      code: 'rebuild.trust.tracking-without-consent-tool', criterion: 'trust-signals', severity: 'high',
      title: 'Tracking ohne erkennbares Einwilligungs-Werkzeug',
      detail: `Eingebunden: ${tracking.map((t) => t.host).join(', ')}. Ein Consent-Werkzeug ist im HTML nicht zu erkennen (TDDDG § 25).`,
      recommendation: 'Der Rebuild bindet kein Tracking ein. Ob es vor der Einwilligung Daten überträgt, prüft der DSGVO-Laufzeit-Scan.',
      evidence: tracking.map((t) => t.ev), pageUrl: url,
    });
  }
}

function assessMobile(home: SourcePage, add: Add, strength: Strength): void {
  const url = home.url;
  if (!home.viewport) {
    add({
      code: 'rebuild.mobile.no-viewport', criterion: 'mobile-ux', severity: 'high',
      title: 'Kein Viewport-Meta-Tag',
      detail: 'Ohne Viewport rendern Mobilgeräte die Desktop-Breite verkleinert — Text wird winzig.',
      recommendation: 'Viewport `width=device-width, initial-scale=1` (setzt der Renderer immer).',
      evidence: [home.absences.viewport], pageUrl: url,
    });
  } else {
    const content = home.viewport.toLowerCase();
    const scaleMatch = /maximum-scale\s*=\s*([\d.]+)/.exec(content);
    if (/user-scalable\s*=\s*(no|0)/.test(content) || (scaleMatch && Number(scaleMatch[1]) <= 1)) {
      add({
        code: 'rebuild.mobile.zoom-disabled', criterion: 'mobile-ux', severity: 'medium',
        title: 'Zoomen ist gesperrt',
        detail: `Viewport: „${home.viewport}". Menschen mit Sehschwäche können nicht vergrößern (WCAG 2.2 — 1.4.4).`,
        recommendation: 'Zoom zulassen; der Renderer setzt keine Sperre.',
        evidence: [home.documentEv], pageUrl: url,
      });
    } else {
      strength('mobile-ux', 'Viewport für Mobilgeräte gesetzt.', [home.documentEv]);
    }
  }
  if (home.css.maxFixedWidthPx !== null && home.css.maxFixedWidthPx >= 900 && home.css.mediaQueryCount === 0) {
    add({
      code: 'rebuild.mobile.fixed-width-layout', criterion: 'mobile-ux', severity: 'medium',
      title: `Feste Seitenbreite (${home.css.maxFixedWidthPx}px) ohne Media Queries`,
      detail: 'Das Layout ist auf eine Desktop-Breite festgelegt und passt sich nicht an.',
      recommendation: 'Fluides Raster mit Umbrüchen bei 640, 900 und 1200px.',
      evidence: [home.css.ev], pageUrl: url,
    });
  } else if (home.absences['media-queries']) {
    add({
      code: 'rebuild.mobile.no-media-queries', criterion: 'mobile-ux', severity: 'medium',
      title: 'Keine Media Queries im CSS',
      detail: 'Das gelesene CSS enthält keine Anpassung an Bildschirmbreiten.',
      recommendation: 'Responsives Raster; mobil einspaltig.',
      evidence: [home.absences['media-queries']], pageUrl: url,
    });
  } else if (home.css.mediaQueryCount > 0) {
    strength('mobile-ux', `${home.css.mediaQueryCount} Media Queries im CSS.`, [home.css.ev]);
  }
  if (home.css.minFontPx !== null && home.css.minFontPx < 12) {
    add({
      code: 'rebuild.mobile.small-font', criterion: 'mobile-ux', severity: 'low',
      title: `Schriftgröße ${home.css.minFontPx}px`,
      detail: 'Text unter 12px ist auf Mobilgeräten schwer lesbar.',
      recommendation: 'Mindestens 14px für Fließtext, 12px für Kleingedrucktes.',
      evidence: [home.css.ev], pageUrl: url,
    });
  }
}

function assessReadability(home: SourcePage, add: Add, strength: Strength): void {
  const url = home.url;
  const t = home.text;
  if (t.words < 120) {
    add({
      code: 'rebuild.text.thin-content', criterion: 'readability', severity: 'low',
      title: `Wenig Text auf der Startseite (${t.words} Wörter)`,
      detail: 'Wenig Text heißt oft: Angebot und Nutzen sind nicht erklärt.',
      recommendation: 'Leistungen mit je einem erklärenden Satz aus den eigenen Unterseiten.',
      evidence: [t.ev], pageUrl: url,
    });
  }
  if (t.avgWordsPerSentence !== null && (t.avgWordsPerSentence > 20 || (t.longSentenceShare ?? 0) > 0.25)) {
    add({
      code: 'rebuild.text.long-sentences', criterion: 'readability', severity: 'medium',
      title: `Lange Sätze (Ø ${formatNumber(t.avgWordsPerSentence)} Wörter)`,
      detail: `${Math.round((t.longSentenceShare ?? 0) * 100)} % der Sätze haben mehr als 25 Wörter.`,
      recommendation: 'Kürzere Sätze in neuen Abschnitten; Aufzählungen statt Schachtelsätzen.',
      evidence: [t.ev], pageUrl: url,
    });
  }
  if (t.fleschDe !== null) {
    if (t.fleschDe < 30) {
      add({
        code: 'rebuild.text.hard-to-read', criterion: 'readability', severity: 'medium',
        title: `Schwer lesbar (Lesbarkeitsindex ${t.fleschDe})`,
        detail: 'Der Index (Amstad, Näherung) liegt im Bereich „sehr schwer" — typisch für Fachsprache und Substantivketten.',
        recommendation: 'Verben statt Substantivierungen, kürzere Wörter in Überschriften.',
        evidence: [t.ev], pageUrl: url,
      });
    } else if (t.fleschDe < 50) {
      add({
        code: 'rebuild.text.moderately-hard', criterion: 'readability', severity: 'low',
        title: `Eher schwer lesbar (Lesbarkeitsindex ${t.fleschDe})`,
        detail: 'Der Index (Amstad, Näherung) liegt im Bereich „schwer".',
        recommendation: 'Kernaussagen in kurzen Sätzen voranstellen.',
        evidence: [t.ev], pageUrl: url,
      });
    } else {
      strength('readability', `Gut lesbar (Lesbarkeitsindex ${t.fleschDe}).`, [t.ev]);
    }
  }
  if (t.longestParagraphWords > 110) {
    add({
      code: 'rebuild.text.wall-of-text', criterion: 'readability', severity: 'low',
      title: `Absatz mit ${t.longestParagraphWords} Wörtern`,
      detail: 'Sehr lange Absätze werden auf Mobilgeräten übersprungen.',
      recommendation: 'Absätze auf drei bis vier Sätze begrenzen, Zwischenüberschriften setzen.',
      evidence: [t.ev], pageUrl: url,
    });
  }
  if (t.formalAddress >= 3 && t.informalAddress >= 3) {
    add({
      code: 'rebuild.text.mixed-address', criterion: 'readability', severity: 'low',
      title: 'Gemischte Ansprache (Sie und du)',
      detail: `„Sie" ${t.formalAddress}×, „du" ${t.informalAddress}× — die Tonalität schwankt.`,
      recommendation: 'Eine Ansprache durchgängig verwenden.',
      evidence: [t.ev], pageUrl: url,
    });
  }
}

function assessHierarchy(home: SourcePage, add: Add, strength: Strength): void {
  const url = home.url;
  const levels = home.headings.map((h) => h.level);
  let skip: { from: number; to: number; ev: string } | null = null;
  for (let k = 1; k < home.headings.length; k += 1) {
    if (levels[k] - levels[k - 1] > 1) {
      skip = { from: levels[k - 1], to: levels[k], ev: home.headings[k].ev };
      break;
    }
  }
  if (skip) {
    add({
      code: 'rebuild.hierarchy.heading-skip', criterion: 'visual-hierarchy', severity: 'low',
      title: `Überschriftenebene springt von H${skip.from} auf H${skip.to}`,
      detail: 'Sprünge in der Gliederung erschweren Screenreadern und Suchmaschinen die Orientierung (WCAG 2.2 — 1.3.1).',
      recommendation: 'Lückenlose Gliederung H1 → H2 → H3.',
      evidence: [skip.ev], pageUrl: url,
    });
  }
  const h2 = home.headings.filter((h) => h.level === 2);
  if (h2.length < 2 && home.text.words > 150) {
    add({
      code: 'rebuild.hierarchy.few-sections', criterion: 'visual-hierarchy', severity: 'medium',
      title: 'Kaum gegliedert',
      detail: `Nur ${h2.length} Zwischenüberschrift(en) bei ${home.text.words} Wörtern.`,
      recommendation: 'Klare Abschnitte: Leistungen, Ablauf, Vertrauen, Kontakt.',
      evidence: [home.text.ev], pageUrl: url,
    });
  } else if (h2.length >= 3) {
    strength('visual-hierarchy', `${h2.length} Abschnitte mit Zwischenüberschrift.`, h2.slice(0, 2).map((h) => h.ev));
  }
  if (home.fonts.length > 3) {
    add({
      code: 'rebuild.hierarchy.too-many-fonts', criterion: 'visual-hierarchy', severity: 'low',
      title: `${home.fonts.length} Schriftfamilien`,
      detail: `Verwendet: ${home.fonts.map((f) => f.family).join(', ')}.`,
      recommendation: 'Höchstens zwei Familien: eine für Überschriften, eine für Text.',
      evidence: home.fonts.map((f) => f.ev), pageUrl: url,
    });
  }
  const saturated = home.colors.filter((c) => isSaturated(c.hex));
  if (saturated.length > 6) {
    add({
      code: 'rebuild.hierarchy.color-sprawl', criterion: 'visual-hierarchy', severity: 'low',
      title: `${saturated.length} Akzentfarben`,
      detail: 'Viele gleichwertige Farben schwächen die Führung des Blicks.',
      recommendation: 'Eine Markenfarbe als Akzent, dazu neutrale Töne.',
      evidence: saturated.slice(0, 4).map((c) => c.ev), pageUrl: url,
    });
  }
  const withoutAlt = home.absences['img-alt'];
  if (withoutAlt) {
    add({
      code: 'rebuild.hierarchy.images-without-alt', criterion: 'visual-hierarchy', severity: 'medium',
      title: 'Bilder ohne Alternativtext',
      detail: 'Mindestens ein Bild hat kein alt-Attribut (WCAG 2.2 — 1.1.1).',
      recommendation: 'Übernommene Bilder bekommen einen Alternativtext; ohne ihn werden sie nicht eingesetzt.',
      evidence: [withoutAlt, home.documentEv], pageUrl: url,
    });
  }
}

function assessSeo(snapshot: SourceSnapshot, home: SourcePage, add: Add, strength: Strength): void {
  const url = home.url;
  if (url.startsWith('http://')) {
    add({
      code: 'rebuild.seo.no-https', criterion: 'seo-basics', severity: 'high',
      title: 'Startseite ohne HTTPS',
      detail: `Abgerufen unter ${url}.`,
      recommendation: 'Auslieferung ausschließlich über HTTPS.',
      evidence: [home.documentEv], pageUrl: url,
    });
  }
  if (!home.title) {
    add({
      code: 'rebuild.seo.missing-title', criterion: 'seo-basics', severity: 'high',
      title: 'Kein Seitentitel',
      detail: 'Ohne <title> zeigen Suchmaschinen einen selbst gewählten Text.',
      recommendation: 'Titel aus Firma, Angebot und Ort (≤ 60 Zeichen).',
      evidence: [home.absences.title], pageUrl: url,
    });
  } else if (home.title.length < 25 || home.title.length > 65) {
    add({
      code: 'rebuild.seo.title-length', criterion: 'seo-basics', severity: 'low',
      title: `Seitentitel mit ${home.title.length} Zeichen`,
      detail: `„${home.title}" — ideal sind etwa 30–60 Zeichen.`,
      recommendation: 'Titel auf 30–60 Zeichen bringen.',
      evidence: [home.documentEv], pageUrl: url,
    });
  } else {
    strength('seo-basics', 'Seitentitel in sinnvoller Länge.', [home.documentEv]);
  }
  if (!home.metaDescription) {
    add({
      code: 'rebuild.seo.missing-description', criterion: 'seo-basics', severity: 'medium',
      title: 'Keine Meta-Beschreibung',
      detail: 'Suchmaschinen zeigen dann einen zufälligen Textausschnitt.',
      recommendation: 'Beschreibung mit 120–155 Zeichen aus dem eigenen Angebot.',
      evidence: [home.absences.description], pageUrl: url,
    });
  } else if (home.metaDescription.length < 70 || home.metaDescription.length > 170) {
    add({
      code: 'rebuild.seo.description-length', criterion: 'seo-basics', severity: 'low',
      title: `Meta-Beschreibung mit ${home.metaDescription.length} Zeichen`,
      detail: 'Ideal sind etwa 120–155 Zeichen.',
      recommendation: 'Beschreibung auf 120–155 Zeichen bringen.',
      evidence: [home.documentEv], pageUrl: url,
    });
  }
  if (!home.lang) {
    add({
      code: 'rebuild.seo.missing-lang', criterion: 'seo-basics', severity: 'medium',
      title: 'Sprache nicht ausgezeichnet',
      detail: 'Das <html>-Element hat kein lang-Attribut (WCAG 2.2 — 3.1.1).',
      recommendation: 'lang="de" setzt der Renderer immer.',
      evidence: [home.absences.lang], pageUrl: url,
    });
  }
  if (!home.canonical) {
    add({
      code: 'rebuild.seo.missing-canonical', criterion: 'seo-basics', severity: 'low',
      title: 'Kein Canonical-Link',
      detail: 'Ohne Canonical können Varianten der Adresse als Duplikate gelten.',
      recommendation: 'Canonical auf die bevorzugte Adresse jeder Seite.',
      evidence: [home.absences.canonical], pageUrl: url,
    });
  }
  if (home.robotsMeta && /noindex/.test(home.robotsMeta)) {
    add({
      code: 'rebuild.seo.noindex', criterion: 'seo-basics', severity: 'high',
      title: 'Startseite ist auf noindex gesetzt',
      detail: `robots-Meta: „${home.robotsMeta}". Die Seite erscheint nicht in Suchergebnissen.`,
      recommendation: 'Vor der Veröffentlichung bewusst entscheiden; der Rebuild setzt kein noindex auf Inhaltsseiten.',
      evidence: [home.documentEv], pageUrl: url,
    });
  }
  if (home.absences['structured-data']) {
    add({
      code: 'rebuild.seo.no-structured-data', criterion: 'seo-basics', severity: 'low',
      title: 'Keine strukturierten Daten',
      detail: 'Kein JSON-LD mit Organisation oder Geschäft.',
      recommendation: 'JSON-LD mit Name, Branche und – falls belegt – Anschrift.',
      evidence: [home.absences['structured-data']], pageUrl: url,
    });
  } else {
    strength('seo-basics', 'Strukturierte Daten (JSON-LD) vorhanden.', [home.jsonLd.ev]);
  }
  if (!snapshot.sitemap.found) {
    add({
      code: 'rebuild.seo.no-sitemap', criterion: 'seo-basics', severity: 'low',
      title: 'Keine Sitemap gefunden',
      detail: 'Weder in robots.txt verwiesen noch unter /sitemap.xml erreichbar.',
      recommendation: 'Sitemap mit allen Inhaltsseiten veröffentlichen.',
      evidence: [snapshot.sitemap.ev], pageUrl: url,
    });
  }
  const titles = snapshot.pages.filter((p) => p.title).map((p) => ({ title: p.title as string, ev: p.documentEv }));
  const duplicates = titles.filter((t, i) => titles.findIndex((o) => o.title === t.title) !== i);
  if (duplicates.length > 0) {
    add({
      code: 'rebuild.seo.duplicate-titles', criterion: 'seo-basics', severity: 'low',
      title: 'Doppelte Seitentitel',
      detail: `„${duplicates[0].title}" steht auf mehreren Seiten.`,
      recommendation: 'Eindeutiger Titel je Seite.',
      evidence: duplicates.map((d) => d.ev), pageUrl: url,
    });
  }
}

function assessConversion(home: SourcePage, pages: SourcePage[], positioning: Positioning, add: Add, strength: Strength): void {
  const url = home.url;
  const forms = pages.flatMap((p) => p.forms.map((f) => ({ form: f, page: p })));
  const leadForms = forms.filter(({ form }) => form.purpose === 'contact' || form.purpose === 'booking');
  const bookingLinks = pages.flatMap((p) => p.backendLinks).filter((b) => b.kind === 'booking');
  const telLinks = pages.flatMap((p) => p.contact.phones).filter((p) => p.href !== null);
  if (leadForms.length === 0 && bookingLinks.length === 0 && telLinks.length === 0) {
    const scriptForms = pages.flatMap((p) => p.thirdParty).filter((t) => t.category === 'form' || t.category === 'booking');
    add({
      code: 'rebuild.conversion.no-lead-path', criterion: 'conversion-focus', severity: scriptForms.length > 0 ? 'low' : 'medium',
      title: scriptForms.length > 0 ? 'Anfrage nur über ein Skript-Widget' : 'Kein direkter Anfrageweg',
      detail: scriptForms.length > 0
        ? `Formular oder Buchung laufen über ${scriptForms.map((s) => s.host).join(', ')} — ohne JavaScript nicht erreichbar und im HTML nicht prüfbar.`
        : 'Kein Kontaktformular, keine Buchungsstrecke, keine anklickbare Telefonnummer auf den gelesenen Seiten.',
      recommendation: 'Lead-Formular im Hauptinhalt mit Rechtsgrundlage und Datenschutz-Hinweis.',
      evidence: scriptForms.length > 0 ? scriptForms.map((s) => s.ev) : [home.documentEv], pageUrl: url,
    });
  } else if (leadForms.length > 0) {
    strength('conversion-focus', `${leadForms.length} Anfrageformular(e) gefunden.`, leadForms.slice(0, 2).map(({ form }) => form.ev));
  }
  for (const { form, page } of leadForms) {
    const visible = form.fields.filter((f) => f.type !== 'checkbox' && f.type !== 'radio');
    if (visible.length > 7) {
      add({
        code: 'rebuild.conversion.form-too-long', criterion: 'conversion-focus', severity: 'low',
        title: `Formular mit ${visible.length} Feldern`,
        detail: 'Jedes zusätzliche Pflichtfeld senkt die Zahl abgeschickter Anfragen; erfragt werden sollte nur, was für die erste Antwort nötig ist (Art. 5 Abs. 1 lit. c DSGVO).',
        recommendation: 'Kurzform mit Name, E-Mail, Telefon und Nachricht; Details im Gespräch.',
        evidence: [form.ev], pageUrl: page.url,
      });
    }
    if (!form.hasConsent) {
      add({
        code: 'rebuild.conversion.form-without-privacy-hint', criterion: 'conversion-focus', severity: 'medium',
        title: 'Formular ohne Datenschutz-Hinweis',
        detail: 'Am Formular fehlt ein Hinweis bzw. Link auf die Datenschutzerklärung (Art. 13 DSGVO).',
        recommendation: 'Der Rebuild setzt Rechtsgrundlage, Einwilligungstext und Link an jedes Formular.',
        evidence: [form.ev], pageUrl: page.url,
      });
    }
  }
  if (positioning.conversionGoal.status === 'unknown') {
    add({
      code: 'rebuild.conversion.goal-unclear', criterion: 'conversion-focus', severity: 'medium',
      title: 'Conversion-Ziel nicht erkennbar',
      detail: positioning.conversionGoal.reason,
      recommendation: 'Ein Ziel festlegen (Anfrage, Termin, Anruf) und jede Seite darauf ausrichten.',
      evidence: [home.documentEv], pageUrl: url,
    });
  }
}

function isSaturated(hex: string): boolean {
  const hsl = hexToHsl(hex);
  return hsl !== null && hsl.s >= 0.3 && hsl.l > 0.15 && hsl.l < 0.85;
}

function formatNumber(value: number): string {
  return String(value).replace('.', ',');
}
