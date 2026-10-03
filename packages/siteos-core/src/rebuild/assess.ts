// ASSESS — Ist-Zustand bewerten, mit Beleg je Befund.
//
// Acht Kriterien: Hero-Klarheit, CTA-Struktur, Trust-Signale, Mobile UX,
// Textverständlichkeit, visuelle Hierarchie, SEO-Basics, Conversion-Fokus.
//
// ## Warum hier kein Modell bewertet
//
// Ein Befund, der in einem Kundenbericht steht, muss reproduzierbar sein.
// Derselbe Import muss dieselben Befunde ergeben — sonst ist die Bewertung
// Meinung, nicht Messung. Deshalb sind alle Regeln hier explizit, jede
// verweist auf einen Beleg aus dem Import, und der Score ist eine Funktion
// der Befunde, nicht umgekehrt.
//
// Was das nicht ist: eine Layout-Analyse. Ohne Rendering sehen wir keine
// Pixel. „Visuelle Hierarchie" wird deshalb über die Struktur bewertet —
// Überschriften-Ebenen, Textmenge vor der ersten Überschrift, Bildbelegung
// — und die Grenze steht in der Zusammenfassung des Kriteriums.

import { sha256Hex } from '../canonical.ts';
import {
  ASSESSMENT_CRITERIA,
  ASSESSMENT_CRITERION_LABEL,
  type AssessmentCriterion,
  type AssessmentFinding,
  type CriterionResult,
  type Evidence,
  type SiteAssessment,
  type SiteImport,
} from './types.ts';
import type { Severity } from '../types.ts';
import { wordCount } from './html.ts';

const SEVERITY_PENALTY: Readonly<Record<Severity, number>> = Object.freeze({
  critical: 45,
  high: 30,
  medium: 18,
  low: 8,
  info: 0,
});

/** Gewichtung der Kriterien im Gesamtindex — Conversion und Hero tragen mehr. */
const CRITERION_WEIGHT: Readonly<Record<AssessmentCriterion, number>> = Object.freeze({
  'hero-clarity': 1.5,
  'cta-structure': 1.25,
  'trust-signals': 1,
  'mobile-ux': 1.25,
  'text-clarity': 1,
  'visual-hierarchy': 0.75,
  'seo-basics': 1,
  'conversion-focus': 1.5,
});

type Draft = Omit<AssessmentFinding, 'criterion'>;

class Findings {
  readonly all: AssessmentFinding[] = [];
  private readonly imp: SiteImport;

  constructor(imp: SiteImport) {
    this.imp = imp;
  }

  /** Beleg-IDs über `ref`; wirft, wenn keiner existiert — ein Befund ohne Beleg ist ein Programmierfehler. */
  ev(...refs: string[]): string[] {
    const ids = this.imp.evidence.filter((e) => refs.includes(e.ref)).map((e) => e.id);
    if (ids.length === 0) throw new Error(`no evidence for refs: ${refs.join(', ')}`);
    return ids;
  }

  add(criterion: AssessmentCriterion, draft: Draft): void {
    this.all.push({ criterion, ...draft });
  }
}

export async function assessImport(imp: SiteImport, assessedAt: string = imp.fetchedAt): Promise<SiteAssessment> {
  const f = new Findings(imp);
  assessHero(imp, f);
  assessCtas(imp, f);
  assessTrust(imp, f);
  assessMobile(imp, f);
  assessText(imp, f);
  assessHierarchy(imp, f);
  assessSeo(imp, f);
  assessConversion(imp, f);

  const criteria: CriterionResult[] = ASSESSMENT_CRITERIA.map((criterion) => {
    const findings = f.all.filter((x) => x.criterion === criterion);
    const penalty = findings.reduce((sum, x) => sum + SEVERITY_PENALTY[x.severity], 0);
    const score = Math.max(0, Math.min(100, 100 - penalty));
    return { criterion, label: ASSESSMENT_CRITERION_LABEL[criterion], score, summary: summarize(criterion, score, findings.length), findings };
  });

  const weightSum = ASSESSMENT_CRITERIA.reduce((s, c) => s + CRITERION_WEIGHT[c], 0);
  const overall = Math.round(criteria.reduce((s, c) => s + c.score * CRITERION_WEIGHT[c.criterion], 0) / weightSum);

  const referenced = new Set(f.all.flatMap((x) => x.evidenceIds));
  const evidence: Evidence[] = imp.evidence.filter((e) => referenced.has(e.id));

  return {
    schemaVersion: 1,
    sourceUrl: imp.finalUrl,
    assessedAt,
    importSha256: await sha256Hex(imp.htmlSha256),
    overall,
    criteria,
    findings: f.all,
    evidence,
  };
}

function summarize(criterion: AssessmentCriterion, score: number, count: number): string {
  const label = ASSESSMENT_CRITERION_LABEL[criterion];
  const limit = criterion === 'visual-hierarchy' ? ' (strukturell bewertet, ohne Rendering)' : '';
  if (count === 0) return `${label}: keine Befunde${limit}.`;
  if (score >= 70) return `${label}: solide, ${count} Hinweis${count === 1 ? '' : 'e'}${limit}.`;
  if (score >= 40) return `${label}: ausbaufähig, ${count} Befund${count === 1 ? '' : 'e'}${limit}.`;
  return `${label}: schwach, ${count} Befund${count === 1 ? '' : 'e'}${limit}.`;
}

// ─────────────────────────────────────────────────────────────────────
// 1. Hero-Klarheit
// ─────────────────────────────────────────────────────────────────────

const VAGUE_HEADLINE = /^(?:willkommen|herzlich willkommen|welcome|home|startseite|start|über uns|hallo)\b/i;

function assessHero(imp: SiteImport, f: Findings): void {
  if (!imp.h1) {
    f.add('hero-clarity', { code: 'hero.missing-h1', severity: 'high', title: 'Keine Hauptüberschrift', detail: 'Die Seite hat kein <h1>. Besucher und Suchmaschinen finden keinen ersten Satz, der sagt, worum es geht.', recommendation: 'Eine H1 mit Angebot und Zielgruppe in höchstens zwölf Wörtern.', evidenceIds: f.ev('h1') });
    return;
  }
  const words = wordCount(imp.h1);
  if (VAGUE_HEADLINE.test(imp.h1)) {
    f.add('hero-clarity', { code: 'hero.vague-headline', severity: 'high', title: 'Hauptüberschrift ohne Aussage', detail: `„${imp.h1}" begrüßt, erklärt aber nicht, was angeboten wird.`, recommendation: 'Die H1 nennt Leistung und Nutzen, nicht die Begrüßung.', evidenceIds: f.ev('h1') });
  } else if (words > 16) {
    f.add('hero-clarity', { code: 'hero.headline-too-long', severity: 'medium', title: 'Hauptüberschrift zu lang', detail: `Die H1 hat ${words} Wörter. Über 16 Wörter wird sie überflogen statt gelesen.`, recommendation: 'Kernaussage in die H1, Details in die Subline.', evidenceIds: f.ev('h1') });
  } else if (words < 3) {
    f.add('hero-clarity', { code: 'hero.headline-too-short', severity: 'low', title: 'Hauptüberschrift sehr knapp', detail: `„${imp.h1}" nennt nur ein Stichwort. Ohne Nutzen oder Zielgruppe bleibt offen, für wen die Seite ist.`, recommendation: 'Die H1 um Nutzen oder Zielgruppe ergänzen.', evidenceIds: f.ev('h1') });
  }
  if (imp.seo.h1Count > 1) {
    f.add('hero-clarity', { code: 'hero.multiple-h1', severity: 'medium', title: 'Mehrere Hauptüberschriften', detail: `${imp.seo.h1Count} <h1>-Elemente konkurrieren um die erste Aussage.`, recommendation: 'Genau eine H1 je Seite; weitere zu H2 machen.', evidenceIds: f.ev('h1:count') });
  }
  if (!imp.positioning.offer || imp.positioning.audience === null) {
    const missing = imp.positioning.audience === null ? 'Zielgruppe' : 'Angebot';
    f.add('hero-clarity', { code: 'hero.audience-unclear', severity: 'low', title: `${missing} nicht benannt`, detail: `Aus Titel, H1 und Beschreibung ließ sich die ${missing} nicht ablesen. Das ist ein Hinweis, kein Beweis: Vielleicht steht sie in einem Bild.`, recommendation: `${missing} im Hero in Worten nennen — Bilder werden nicht gelesen.`, evidenceIds: f.ev('h1', 'title', 'description') });
  }
}

// ─────────────────────────────────────────────────────────────────────
// 2. CTA-Struktur
// ─────────────────────────────────────────────────────────────────────

function assessCtas(imp: SiteImport, f: Findings): void {
  const ctas = imp.ctas;
  if (ctas.length === 0) {
    f.add('cta-structure', { code: 'cta.none', severity: 'critical', title: 'Kein Call-to-Action erkannt', detail: 'Weder Button noch Handlungslink noch Telefon-/Mail-Link. Besucher wissen nicht, was der nächste Schritt ist.', recommendation: 'Ein primärer CTA im Hero, ein sekundärer als Alternative, beide im Footer wiederholt.', evidenceIds: f.ev('nav', 'h1') });
    return;
  }
  const primaries = ctas.filter((c) => c.prominence === 'primary');
  if (primaries.length === 0) {
    f.add('cta-structure', { code: 'cta.no-primary', severity: 'medium', title: 'Kein erkennbarer Primär-CTA', detail: `${ctas.length} Handlungsaufforderungen, aber keine ist als Hauptaktion ausgezeichnet. Alles wirkt gleich wichtig.`, recommendation: 'Eine Aktion als primär gestalten, die übrigen sekundär.', evidenceIds: ctas.slice(0, 3).map((c) => c.evidenceId) });
  } else if (primaries.length > 3) {
    f.add('cta-structure', { code: 'cta.too-many-primary', severity: 'medium', title: 'Zu viele Primär-CTAs', detail: `${primaries.length} Buttons sind als primär gestaltet. Was überall hervorgehoben ist, ist nirgends hervorgehoben.`, recommendation: 'Einen Primär-CTA je Ansicht; der Rest wird sekundär.', evidenceIds: primaries.slice(0, 4).map((c) => c.evidenceId) });
  }
  const labels = ctas.map((c) => c.label.toLowerCase());
  const generic = ctas.filter((c) => /^(?:mehr|mehr erfahren|weiter|hier klicken|klicken sie hier|read more|learn more|more|submit|senden|absenden)$/i.test(c.label.trim()));
  if (generic.length >= 2) {
    f.add('cta-structure', { code: 'cta.generic-labels', severity: 'low', title: 'Generische CTA-Beschriftungen', detail: `${generic.length} Aufforderungen heißen „${generic[0].label}" oder ähnlich. Sie sagen nicht, was danach passiert.`, recommendation: 'Beschriftung = Ergebnis: „Angebot anfordern", „Termin wählen", „Rückruf vereinbaren".', evidenceIds: generic.slice(0, 3).map((c) => c.evidenceId) });
  }
  const distinct = new Set(labels.filter((l) => l.length > 2));
  if (ctas.length >= 6 && distinct.size >= 6) {
    f.add('cta-structure', { code: 'cta.fragmented', severity: 'low', title: 'Viele unterschiedliche Aufforderungen', detail: `${distinct.size} verschiedene CTA-Texte. Ein klarer Pfad hat zwei bis drei.`, recommendation: 'Auf eine Hauptaktion und eine Alternative verdichten.', evidenceIds: ctas.slice(0, 3).map((c) => c.evidenceId) });
  }
}

// ─────────────────────────────────────────────────────────────────────
// 3. Trust-Signale
// ─────────────────────────────────────────────────────────────────────

function assessTrust(imp: SiteImport, f: Findings): void {
  if (imp.trust.length === 0) {
    f.add('trust-signals', { code: 'trust.none', severity: 'high', title: 'Keine Vertrauensbelege gefunden', detail: 'Weder Bewertungen, Zertifikate, Erfahrungsjahre, Mitgliedschaften noch Referenzen im sichtbaren Text. Das heißt nicht, dass es keine gibt — nur, dass die Seite sie nicht zeigt.', recommendation: 'Vorhandene Belege sichtbar machen. Der Rebuild lässt den Trust-Block als Platzhalter, bis echte Belege vorliegen — er erfindet keine.', evidenceIds: f.ev('text', 'headings') });
    return;
  }
  const kinds = new Set(imp.trust.map((t) => t.kind));
  if (kinds.size === 1 && imp.trust.length <= 2) {
    f.add('trust-signals', { code: 'trust.thin', severity: 'medium', title: 'Vertrauensbelege dünn', detail: `Nur ${imp.trust.length} Beleg${imp.trust.length === 1 ? '' : 'e'} einer Art (${[...kinds][0]}). Eine zweite Quelle wirkt glaubwürdiger als eine wiederholte.`, recommendation: 'Belege unterschiedlicher Art kombinieren: Zahl + Zertifikat + Stimme.', evidenceIds: imp.trust.map((t) => t.evidenceId) });
  }
  if (!kinds.has('reference') && !kinds.has('rating')) {
    f.add('trust-signals', { code: 'trust.no-social-proof', severity: 'low', title: 'Keine Kundenstimmen oder Bewertungen', detail: 'Es gibt Belege, aber keine Stimme von außen. Fremdurteil überzeugt mehr als Selbstbeschreibung.', recommendation: 'Echte Bewertungen oder eine Referenz mit Namen einbinden — nur mit Freigabe der Genannten.', evidenceIds: imp.trust.slice(0, 3).map((t) => t.evidenceId) });
  }
}

// ─────────────────────────────────────────────────────────────────────
// 4. Mobile UX
// ─────────────────────────────────────────────────────────────────────

function assessMobile(imp: SiteImport, f: Findings): void {
  if (!imp.seo.hasViewport) {
    f.add('mobile-ux', { code: 'mobile.no-viewport', severity: 'critical', title: 'Kein Viewport-Meta', detail: 'Ohne <meta name="viewport"> rendern Smartphones die Desktop-Breite und skalieren herunter. Text ist dann unlesbar klein.', recommendation: 'Viewport setzen; der Rebuild bringt ihn mit.', evidenceIds: f.ev('viewport') });
  }
  if (imp.navigation.length > 9) {
    f.add('mobile-ux', { code: 'mobile.nav-overloaded', severity: 'medium', title: 'Navigation zu breit für Mobil', detail: `${imp.navigation.length} Navigationspunkte. Auf 390 px passt das nur als langes Menü.`, recommendation: 'Auf fünf bis sieben Hauptpunkte verdichten; Rest in den Footer.', evidenceIds: f.ev('nav') });
  }
  const telCtas = imp.ctas.filter((c) => c.kind === 'tel');
  const mentionsPhone = /\b(?:\+49|0\d{2,5}[\s/-]?\d{3,})\b/.test(imp.texts.paragraphs.join(' '));
  if (mentionsPhone && telCtas.length === 0) {
    f.add('mobile-ux', { code: 'mobile.phone-not-tappable', severity: 'medium', title: 'Telefonnummer nicht antippbar', detail: 'Eine Telefonnummer steht im Text, aber kein tel:-Link. Auf dem Smartphone muss sie abgetippt werden.', recommendation: 'Telefonnummer als tel:-Link, im Header und im Kontaktblock.', evidenceIds: f.ev('text') });
  }
  if (imp.htmlBytes > 600_000) {
    f.add('mobile-ux', { code: 'mobile.heavy-document', severity: 'low', title: 'Schweres HTML-Dokument', detail: `${Math.round(imp.htmlBytes / 1024)} kB HTML vor Bildern und Skripten. Im Mobilfunk kostet das spürbar Zeit bis zum ersten Inhalt.`, recommendation: 'Inline-Skripte und -Styles auslagern, Markup verschlanken.', evidenceIds: f.ev('text') });
  }
}

// ─────────────────────────────────────────────────────────────────────
// 5. Textverständlichkeit
// ─────────────────────────────────────────────────────────────────────

function assessText(imp: SiteImport, f: Findings): void {
  const t = imp.texts;
  if (t.wordCount < 80) {
    f.add('text-clarity', { code: 'text.too-little', severity: 'medium', title: 'Sehr wenig lesbarer Text', detail: `${t.wordCount} Wörter im sichtbaren Text. Entweder ist die Seite sehr knapp — oder der Inhalt entsteht erst per JavaScript und wurde hier nicht gesehen.`, recommendation: 'Kernaussagen als Text liefern, nicht nur als Bild oder Skript.', evidenceIds: f.ev('text') });
    return;
  }
  if (t.avgSentenceLength !== null && t.avgSentenceLength > 22) {
    f.add('text-clarity', { code: 'text.long-sentences', severity: 'medium', title: 'Lange Sätze', detail: `Durchschnittlich ${t.avgSentenceLength} Wörter je Satz${t.longSentenceShare !== null ? `, ${Math.round(t.longSentenceShare * 100)} % über 25 Wörter` : ''}. Auf dem Bildschirm werden solche Sätze überflogen.`, recommendation: 'Ein Gedanke je Satz, höchstens 20 Wörter.', evidenceIds: f.ev('text') });
  }
  const jargon = imp.texts.paragraphs.join(' ').match(/\b(?:ganzheitlich|synerg|innovativ|maßgeschneidert|kompetent|professionell|hochwertig|individuell|zuverlässig|kundenorientiert|lösungsorientiert)\w*/gi) ?? [];
  if (jargon.length >= 4) {
    f.add('text-clarity', { code: 'text.buzzwords', severity: 'low', title: 'Allgemeinplätze statt Aussagen', detail: `${jargon.length} Wörter wie „${jargon[0]}" — sie klingen nach Qualität, belegen aber nichts.`, recommendation: 'Jedes Adjektiv durch eine prüfbare Aussage ersetzen: was, für wen, seit wann, mit welchem Ergebnis.', evidenceIds: f.ev('text') });
  }
  if (imp.texts.paragraphs.some((p) => wordCount(p) > 120)) {
    f.add('text-clarity', { code: 'text.wall', severity: 'low', title: 'Textwände', detail: 'Mindestens ein Absatz hat über 120 Wörter. Ohne Zwischenüberschrift oder Liste wird er nicht gelesen.', recommendation: 'Absätze auf 40–60 Wörter, Aufzählungen für Leistungen.', evidenceIds: f.ev('text') });
  }
}

// ─────────────────────────────────────────────────────────────────────
// 6. Visuelle Hierarchie (strukturell)
// ─────────────────────────────────────────────────────────────────────

function assessHierarchy(imp: SiteImport, f: Findings): void {
  if (imp.headings.length === 0 && imp.texts.wordCount >= 150) {
    f.add('visual-hierarchy', { code: 'hierarchy.no-subheadings', severity: 'medium', title: 'Keine Zwischenüberschriften', detail: 'Über 150 Wörter ohne h2/h3. Die Seite hat keine erkennbaren Abschnitte.', recommendation: 'Je Abschnitt eine H2, die den Nutzen benennt.', evidenceIds: f.ev('headings') });
  }
  const h2 = imp.headings.filter((h) => h.level === 2).length;
  const h3 = imp.headings.filter((h) => h.level === 3).length;
  if (h3 > 0 && h2 === 0) {
    f.add('visual-hierarchy', { code: 'hierarchy.skipped-level', severity: 'low', title: 'Übersprungene Überschriften-Ebene', detail: `${h3} H3, aber keine H2. Die Gliederung ist nicht nachvollziehbar.`, recommendation: 'Ebenen der Reihe nach: H1 → H2 → H3.', evidenceIds: f.ev('headings') });
  }
  if (imp.headings.length > 25) {
    f.add('visual-hierarchy', { code: 'hierarchy.too-many-headings', severity: 'low', title: 'Sehr viele Überschriften', detail: `${imp.headings.length} h2/h3 auf einer Seite. Wenn alles eine Überschrift ist, trägt keine.`, recommendation: 'Abschnitte zusammenfassen; sechs bis neun Abschnitte je Seite.', evidenceIds: f.ev('headings') });
  }
  const noAlt = imp.images.filter((i) => i.alt === null || i.alt === '').length;
  if (imp.images.length > 0 && noAlt / imp.images.length > 0.5) {
    f.add('visual-hierarchy', { code: 'hierarchy.images-without-alt', severity: 'medium', title: 'Bilder ohne Alternativtext', detail: `${noAlt} von ${imp.images.length} Bildern haben keinen Alternativtext. Für Screenreader und Suchmaschinen sind sie leer.`, recommendation: 'Jedes inhaltliche Bild bekommt einen Alt-Text; dekorative alt="".', evidenceIds: f.ev('images') });
  }
  if (imp.images.length === 0 && imp.texts.wordCount > 200) {
    f.add('visual-hierarchy', { code: 'hierarchy.no-images', severity: 'info', title: 'Keine Bilder', detail: 'Die Seite ist reiner Text. Das kann Absicht sein — oder Bilder werden per CSS/JS geladen und wurden hier nicht gesehen.', recommendation: 'Ein Bild im Hero, das das Angebot zeigt; keine Stockfotos.', evidenceIds: f.ev('images') });
  }
}

// ─────────────────────────────────────────────────────────────────────
// 7. SEO-Basics
// ─────────────────────────────────────────────────────────────────────

function assessSeo(imp: SiteImport, f: Findings): void {
  if (!imp.title) {
    f.add('seo-basics', { code: 'seo.missing-title', severity: 'high', title: 'Kein Seitentitel', detail: 'Ohne <title> zeigt die Suchmaschine die URL.', recommendation: 'Titel mit Angebot + Ort + Marke, 50–60 Zeichen.', evidenceIds: f.ev('title') });
  } else if (imp.title.length > 65) {
    f.add('seo-basics', { code: 'seo.title-too-long', severity: 'low', title: 'Seitentitel zu lang', detail: `${imp.title.length} Zeichen; ab etwa 60 wird er im Suchergebnis abgeschnitten.`, recommendation: 'Titel auf 50–60 Zeichen kürzen, Wichtiges nach vorn.', evidenceIds: f.ev('title') });
  } else if (imp.title.length < 20) {
    f.add('seo-basics', { code: 'seo.title-too-short', severity: 'low', title: 'Seitentitel sehr kurz', detail: `„${imp.title}" — ${imp.title.length} Zeichen. Angebot und Ort fehlen.`, recommendation: 'Titel um Leistung und Ort ergänzen.', evidenceIds: f.ev('title') });
  }
  if (!imp.description) {
    f.add('seo-basics', { code: 'seo.missing-description', severity: 'medium', title: 'Keine Meta-Description', detail: 'Die Suchmaschine wählt dann selbst einen Textausschnitt — selten den besten.', recommendation: 'Description mit Angebot, Nutzen und Aufforderung, 120–155 Zeichen.', evidenceIds: f.ev('description') });
  } else if (imp.description.length > 165) {
    f.add('seo-basics', { code: 'seo.description-too-long', severity: 'low', title: 'Meta-Description zu lang', detail: `${imp.description.length} Zeichen; ab etwa 155 wird sie abgeschnitten.`, recommendation: 'Auf 120–155 Zeichen kürzen.', evidenceIds: f.ev('description') });
  }
  if (!imp.seo.lang) {
    f.add('seo-basics', { code: 'seo.missing-lang', severity: 'medium', title: 'Sprache nicht deklariert', detail: 'Kein lang-Attribut am <html>. Screenreader und Suchmaschinen raten die Sprache.', recommendation: '<html lang="de"> setzen.', evidenceIds: f.ev('lang') });
  }
  if (!imp.seo.canonical) {
    f.add('seo-basics', { code: 'seo.missing-canonical', severity: 'low', title: 'Kein Canonical-Link', detail: 'Ohne Canonical können www/nicht-www und Parameter-Varianten als Duplikate zählen.', recommendation: 'Canonical auf die bevorzugte URL setzen.', evidenceIds: f.ev('canonical') });
  }
  if (!imp.seo.ogTitle && !imp.seo.ogImage) {
    f.add('seo-basics', { code: 'seo.missing-og', severity: 'low', title: 'Keine Open-Graph-Angaben', detail: 'Geteilte Links zeigen in Messengern und Social Media keine Vorschau.', recommendation: 'og:title, og:description und ein og:image (1200×630) setzen.', evidenceIds: f.ev('og') });
  }
  if (imp.seo.jsonLdTypes.length === 0) {
    f.add('seo-basics', { code: 'seo.missing-structured-data', severity: 'low', title: 'Keine strukturierten Daten', detail: 'Kein JSON-LD. Öffnungszeiten, Adresse und Organisationstyp werden nicht maschinenlesbar ausgeliefert.', recommendation: 'JSON-LD für Organisation/LocalBusiness — der Rebuild erzeugt es aus den bekannten Feldern.', evidenceIds: f.ev('jsonld') });
  }
  if (imp.seo.robots && /noindex/i.test(imp.seo.robots)) {
    f.add('seo-basics', { code: 'seo.noindex', severity: 'high', title: 'Seite ist auf noindex', detail: `robots="${imp.seo.robots}" — die Startseite verbietet die Indexierung.`, recommendation: 'Prüfen, ob das Absicht ist; sonst entfernen.', evidenceIds: f.ev('title') });
  }
}

// ─────────────────────────────────────────────────────────────────────
// 8. Conversion-Fokus
// ─────────────────────────────────────────────────────────────────────

function assessConversion(imp: SiteImport, f: Findings): void {
  const goal = imp.positioning.conversionGoal;
  if (goal === 'unknown') {
    f.add('conversion-focus', { code: 'conversion.goal-unclear', severity: 'high', title: 'Kein erkennbares Conversion-Ziel', detail: 'Weder Formular, Terminlink, Telefon-Link noch Kauf-Pfad. Die Seite informiert, aber sie führt nirgendwohin.', recommendation: 'Ein Ziel festlegen — Anfrage, Termin oder Anruf — und alle CTAs darauf ausrichten.', evidenceIds: f.ev('nav', 'h1') });
  }
  const leadForms = imp.forms.filter((form) => ['contact', 'quote', 'booking'].includes(form.purpose));
  for (const form of leadForms) {
    if (form.fields.length > 6) {
      f.add('conversion-focus', { code: 'conversion.form-too-long', severity: 'medium', title: 'Anfrageformular zu lang', detail: `${form.fields.length} Felder. Jedes Feld über fünf kostet Abschlüsse.`, recommendation: 'Name, E-Mail, Anliegen — der Rest kommt im Gespräch.', evidenceIds: [form.evidenceId] });
    }
    if (!form.hasConsentHint) {
      f.add('conversion-focus', { code: 'conversion.form-without-consent', severity: 'high', title: 'Formular ohne Datenschutzhinweis', detail: 'Das Formular verarbeitet personenbezogene Daten ohne erkennbaren Hinweis auf Zweck und Rechtsgrundlage (Art. 13 DSGVO).', recommendation: 'Hinweis mit Link zur Datenschutzerklärung direkt am Absende-Button; der Rebuild bringt ihn mit.', evidenceIds: [form.evidenceId] });
    }
    if (form.action === null) {
      f.add('conversion-focus', { code: 'conversion.form-target-unknown', severity: 'medium', title: 'Formularziel nicht erkennbar', detail: 'Das Formular hat kein action-Attribut — es wird per Skript verschickt. Der Rebuild kann das Ziel nicht übernehmen; es muss konfiguriert werden.', recommendation: 'Formularziel im Publish-Schritt setzen.', evidenceIds: [form.evidenceId] });
    }
  }
  if (goal !== 'unknown' && leadForms.length === 0 && !imp.ctas.some((c) => c.kind === 'tel' || c.kind === 'mailto')) {
    f.add('conversion-focus', { code: 'conversion.no-direct-path', severity: 'medium', title: 'Kein direkter Kontaktpfad', detail: 'Es gibt ein Ziel, aber kein Formular, keinen Telefon- und keinen Mail-Link auf dieser Seite. Der Weg zur Anfrage führt über Unterseiten.', recommendation: 'Anfragepfad auf die Startseite holen: kurzes Formular oder tel:-Link im Hero.', evidenceIds: f.ev('nav') });
  }
  const priceMention = /\b(?:preis|preise|ab\s+\d+|€|eur\b|kosten)\b/i.test(imp.texts.paragraphs.join(' ') + imp.headings.map((h) => h.text).join(' '));
  if (!priceMention && (imp.positioning.industry === 'handwerk' || imp.positioning.industry === 'agentur' || imp.positioning.industry === 'ecommerce')) {
    f.add('conversion-focus', { code: 'conversion.no-price-signal', severity: 'info', title: 'Kein Preissignal', detail: 'Keine Angabe zu Preisen, Preisspannen oder Festpreis. In dieser Branche fragen Besucher zuerst danach.', recommendation: 'Preislogik nennen („ab", „Festpreis nach Besichtigung") — ohne Zahlen zu erfinden.', evidenceIds: f.ev('text') });
  }
}
