// ASSESS (Teil 1) — was die bestehende Website über das Unternehmen sagt.
//
// Firma, Angebot, Zielgruppe, Branche, Ort, Tonalität, Conversion-Ziel. Jede
// Angabe trägt Belege und eine Sicherheit; was die Seite nicht hergibt, ist
// `unknown` mit Grund. Das ist keine Formalie: Der Ort wandert in Titel,
// JSON-LD und Überschriften, die Branche bestimmt das Compliance-Gerüst. Ein
// geratener Wert wäre dort eine falsche Aussage in einem ausgelieferten
// Dokument.

import { INDUSTRY_PRESETS } from '../blueprint/industries.ts';
import type { IndustryKey } from '../types.ts';
import type { Audience, ConversionGoal, Known, Positioning, SourcePage, SourceSnapshot } from './types.ts';
import { cutBefore, splitTitle } from './text.ts';
import { toWellFormed } from './well-formed.ts';

export function known<T>(value: T, confidence: 'high' | 'medium' | 'low', evidence: (string | null | undefined)[]): Known<T> {
  return { status: 'known', value, confidence, evidence: [...new Set(evidence.filter((e): e is string => typeof e === 'string'))] };
}

export function unknown<T>(reason: string): Known<T> {
  return { status: 'unknown', value: null, reason };
}

export function derivePositioning(snapshot: SourceSnapshot): Positioning {
  const home = snapshot.pages[0];
  if (!home) {
    const none = 'Keine Seite gelesen.';
    return {
      companyName: unknown(none), offer: unknown(none), industry: unknown(none), audience: unknown(none),
      audiencePhrase: unknown(none), conversionGoal: unknown(none), locality: unknown(none), tone: unknown(none),
      valueProposition: unknown(none),
    };
  }
  const companyName = deriveCompanyName(snapshot.pages);
  return toWellFormed({
    companyName,
    offer: deriveOffer(snapshot.pages, companyName.value),
    industry: deriveIndustry(snapshot.pages),
    audience: deriveAudience(snapshot.pages),
    audiencePhrase: deriveAudiencePhrase(snapshot.pages),
    conversionGoal: deriveConversionGoal(snapshot.pages),
    locality: deriveLocality(snapshot.pages),
    tone: deriveTone(snapshot.pages),
    valueProposition: deriveValueProposition(home),
  });
}

// ─────────────────────────────────────────────────────────────────────
// Firma
// ─────────────────────────────────────────────────────────────────────

const GENERIC_TITLE = /^(start|startseite|home|homepage|willkommen|herzlich willkommen|index|kontakt|impressum|datenschutz|leistungen|über uns|ueber uns)$/i;

function deriveCompanyName(pages: SourcePage[]): Known<string> {
  for (const page of pages) {
    if (page.jsonLd.name) return known(page.jsonLd.name, 'high', [page.jsonLd.ev]);
  }
  const home = pages[0];
  if (home.ogSiteName) return known(home.ogSiteName, 'high', [home.documentEv]);

  // Ein Titelsegment, das auf mehreren Seiten wiederkehrt, ist der Name.
  const segmentsPerPage = pages
    .filter((p) => p.title)
    .map((p) => ({ page: p, segments: splitTitle(p.title as string).filter((s) => s.length >= 2 && s.length <= 60) }));
  if (segmentsPerPage.length >= 2) {
    const counts = new Map<string, { count: number; pages: SourcePage[] }>();
    for (const { page, segments } of segmentsPerPage) {
      for (const segment of new Set(segments)) {
        const entry = counts.get(segment) ?? { count: 0, pages: [] };
        entry.count += 1;
        entry.pages.push(page);
        counts.set(segment, entry);
      }
    }
    const repeated = [...counts.entries()]
      .filter(([segment, v]) => v.count >= 2 && !GENERIC_TITLE.test(segment))
      .sort((a, b) => b[1].count - a[1].count || a[0].length - b[0].length);
    if (repeated.length > 0) {
      const [segment, v] = repeated[0];
      return known(segment, 'high', v.pages.map((p) => p.documentEv));
    }
  }

  const logoAlt = home.logo?.alt?.replace(/\blogo\b/gi, '').replace(/\s+/g, ' ').trim();
  if (logoAlt && logoAlt.length >= 2 && logoAlt.length <= 60) return known(logoAlt, 'medium', [home.logo?.ev]);

  if (home.title) {
    const first = splitTitle(home.title)[0];
    if (first && first.length <= 50 && !GENERIC_TITLE.test(first)) return known(first, 'low', [home.documentEv]);
  }
  return unknown('Weder strukturierte Daten noch Seitentitel noch Logo nennen einen Firmennamen.');
}

// ─────────────────────────────────────────────────────────────────────
// Angebot
// ─────────────────────────────────────────────────────────────────────

const OFFER_HEADING = /(leistung|angebot|service|beratungsfeld|produkt|was wir|schwerpunkt|kompetenz|tätigkeit|fachgebiet|rechtsgebiet|lösungen|loesungen|sortiment)/i;
const GENERIC_NAV = /^(start|startseite|home|über uns|ueber uns|about|kontakt|contact|impressum|datenschutz|team|karriere|jobs|stellen|blog|news|aktuelles|faq|login|anmelden|preise|referenzen|ressourcen|galerie|anfahrt|downloads?|presse|partner|branchen|unternehmen|wir|mehr|menü|menu|suche|search|produkt|produkte|features|funktionen|plattform|lösungen|loesungen|use cases|kunden|shop|termin.*|demo.*|kostenlos.*|jetzt.*)$/i;

function deriveOffer(pages: SourcePage[], companyName: string | null): Known<string[]> {
  const items: { text: string; ev: string }[] = [];
  const add = (text: string, ev: string) => {
    const clean = text.replace(/^\d+[.)]\s*/, '').trim();
    if (clean.length < 3 || clean.length > 60 || clean.split(/\s+/).length > 6) return;
    if (GENERIC_NAV.test(clean) || (companyName && clean.toLowerCase() === companyName.toLowerCase())) return;
    if (/[?!]$/.test(clean)) return;
    if (items.some((i) => i.text.toLowerCase() === clean.toLowerCase())) return;
    items.push({ text: clean, ev });
  };

  // 1. Unterpunkte eines Leistungsabschnitts — die stärkste Quelle.
  for (const page of pages) {
    for (const section of page.sections) {
      if (!OFFER_HEADING.test(section.heading)) continue;
      for (const item of section.items) add(item, section.ev);
    }
  }
  const confidence: 'high' | 'medium' = items.length > 0 ? 'high' : 'medium';

  // 2. Navigation ohne Standardpunkte.
  if (items.length < 3) {
    for (const link of pages[0].navigation) add(link.label, link.ev);
  }
  // 3. Titelsegmente nach dem Namen („Heizung, Sanitär & Bad in Leipzig").
  if (items.length < 2 && pages[0].title) {
    const segments = splitTitle(pages[0].title).slice(1);
    for (const segment of segments) {
      // Ort und Zielgruppe gehören nicht zum Angebot (Segmente sind
      // zusammengezogen: einzelne Leerzeichen, feste Muster).
      const withoutPlace = cutBefore(cutBefore(segment, / in [A-ZÄÖÜ]/), / für /);
      for (const part of withoutPlace.split(/ ?[,&] ?| und /)) add(part, pages[0].documentEv);
    }
  }

  if (items.length === 0) return unknown('Kein Leistungsabschnitt, keine sprechenden Navigationspunkte, kein Angebot im Titel.');
  return known(items.slice(0, 6).map((i) => i.text), confidence, items.slice(0, 6).map((i) => i.ev));
}

// ─────────────────────────────────────────────────────────────────────
// Branche
// ─────────────────────────────────────────────────────────────────────

const SCHEMA_TO_INDUSTRY: ReadonlyArray<[RegExp, IndustryKey]> = [
  [/^Dentist$/, 'zahnarzt'],
  [/^(Physician|MedicalClinic|MedicalBusiness|Physiotherapy|Optician)$/, 'arztpraxis'],
  [/^(LegalService|Attorney|Notary)$/, 'rechtsanwalt'],
  [/^(AccountingService|FinancialService)$/, 'steuerberatung'],
  [/^(HomeAndConstructionBusiness|Electrician|Plumber|RoofingContractor|HVACBusiness|GeneralContractor|HousePainter|Locksmith)$/, 'handwerk'],
  [/^(Restaurant|CafeOrCoffeeShop|Bakery|FoodEstablishment|BarOrPub|Hotel)$/, 'gastronomie'],
  [/^(RealEstateAgent)$/, 'immobilien'],
  [/^(OnlineStore|Store)$/, 'ecommerce'],
  [/^(ProfessionalService)$/, 'agentur'],
];

function deriveIndustry(pages: SourcePage[]): Known<IndustryKey> {
  for (const page of pages) {
    for (const type of page.jsonLd.types) {
      const hit = SCHEMA_TO_INDUSTRY.find(([pattern]) => pattern.test(type));
      if (hit) return known(hit[1], 'high', [page.jsonLd.ev]);
    }
  }

  // Punkte je Branche: Treffer am Wortanfang, gewichtet nach Ort. Ein Treffer
  // in Titel oder H1 wiegt dreifach — dort steht, was die Seite ist. `bau`
  // in „Aufbau" zählt nicht (Wortanfang), `shop` in „Workshop" auch nicht.
  const home = pages[0];
  const fields: { text: string; weight: number; ev: string }[] = [
    { text: home.title ?? '', weight: 3, ev: home.documentEv },
    { text: home.hero?.headline ?? '', weight: 3, ev: home.hero?.ev ?? home.documentEv },
    { text: home.metaDescription ?? '', weight: 2, ev: home.documentEv },
    { text: home.navigation.map((n) => n.label).join(' '), weight: 1, ev: home.navigation[0]?.ev ?? home.documentEv },
    { text: home.headings.map((h) => h.text).join(' '), weight: 1, ev: home.headings[0]?.ev ?? home.documentEv },
  ];
  let best: { industry: IndustryKey; score: number; evidence: string[] } | null = null;
  for (const preset of Object.values(INDUSTRY_PRESETS)) {
    let score = 0;
    const evidence: string[] = [];
    for (const field of fields) {
      const text = field.text.toLowerCase();
      if (preset.promptTerms.some((term) => startsWord(text, term))) {
        score += field.weight;
        evidence.push(field.ev);
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { industry: preset.key, score, evidence };
  }
  if (!best || best.score < 3) return unknown('Keine Branche eindeutig erkennbar (keine strukturierten Daten, zu wenige Branchenbegriffe).');
  return known(best.industry, best.score >= 6 ? 'high' : 'medium', best.evidence);
}

/** Beginnt irgendwo in `text` ein Wort mit `term`? (Unicode-fähig, ohne Lookbehind) */
function startsWord(text: string, term: string): boolean {
  for (let from = 0; ; from += 1) {
    const at = text.indexOf(term, from);
    if (at === -1) return false;
    const before = text[at - 1];
    if (before === undefined || !/[\p{L}\p{N}]/u.test(before)) return true;
    from = at;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Zielgruppe
// ─────────────────────────────────────────────────────────────────────

/**
 * Zielgruppen-Begriffe. Im Titel, in der Beschreibung und im Hero zählt das
 * bloße Wort; im übrigen Text nur in einer „für …"-Wendung — sonst wird aus
 * „anders als viele Betriebe" eine B2B-Zielgruppe.
 */
const B2B_MARKERS = ['unternehmen', 'mittelstand', 'mittelständ', 'firmenkunden', 'geschäftskunden', 'b2b', 'selbstständige', 'selbständige', 'freiberufler', 'gewerbekunden', 'kmu', 'konzerne', 'unternehmer'];
const B2C_MARKERS = ['privatkunden', 'privatpersonen', 'familien', 'patienten', 'eigentümer', 'mieter', 'hausbesitzer', 'gäste', 'privathaushalte', 'verbraucher', 'eltern'];
const FOR_PHRASE = /\bfür\s+(?:den\s+|die\s+|das\s+|kleine\s+und\s+mittlere\s+|ihre\s+)?([A-ZÄÖÜa-zäöüß][\wäöüß-]*)/g;

function deriveAudience(pages: SourcePage[]): Known<Audience> {
  const home = pages[0];
  const prominent: { text: string; ev: string }[] = [
    { text: `${home.title ?? ''} ${home.metaDescription ?? ''}`, ev: home.documentEv },
    { text: `${home.hero?.headline ?? ''} ${home.hero?.subline ?? ''}`, ev: home.hero?.ev ?? home.documentEv },
  ];
  const b2b: string[] = [];
  const b2c: string[] = [];
  for (const scope of prominent) {
    const text = scope.text.toLowerCase();
    if (B2B_MARKERS.some((m) => startsWord(text, m))) b2b.push(scope.ev);
    if (B2C_MARKERS.some((m) => startsWord(text, m))) b2c.push(scope.ev);
  }
  // Im Fließtext nur „für <Zielgruppe>".
  const sample = home.text.sample.slice(0, 1500);
  FOR_PHRASE.lastIndex = 0;
  for (let hits = 0; hits < 20; hits += 1) {
    const match = FOR_PHRASE.exec(sample);
    if (!match) break;
    const word = match[1].toLowerCase();
    if (B2B_MARKERS.some((m) => word.startsWith(m))) b2b.push(home.text.ev);
    if (B2C_MARKERS.some((m) => word.startsWith(m))) b2c.push(home.text.ev);
  }
  const uniqueB2b = [...new Set(b2b)];
  const uniqueB2c = [...new Set(b2c)];
  if (uniqueB2b.length > 0 && uniqueB2c.length > 0) return known('beides', 'medium', [...uniqueB2b, ...uniqueB2c]);
  if (uniqueB2b.length > 0) return known('b2b', uniqueB2b.length >= 2 ? 'high' : 'medium', uniqueB2b);
  if (uniqueB2c.length > 0) return known('b2c', uniqueB2c.length >= 2 ? 'high' : 'medium', uniqueB2c);
  return unknown('Keine Zielgruppe genannt (weder Unternehmens- noch Privatkunden-Begriffe in Titel, Beschreibung oder Hero).');
}

const AUDIENCE_PHRASE = /\bfür\s+(?:den\s+|die\s+|das\s+|kleine\s+und\s+mittlere\s+)?[A-ZÄÖÜ][\wäöüß-]*(?:\s+(?:und|&)\s+(?:den\s+|die\s+)?[A-ZÄÖÜ][\wäöüß-]*)?/;

function deriveAudiencePhrase(pages: SourcePage[]): Known<string> {
  const home = pages[0];
  const candidates: { text: string; ev: string }[] = [
    { text: home.hero?.headline ?? '', ev: home.hero?.ev ?? home.documentEv },
    { text: home.title ?? '', ev: home.documentEv },
    { text: home.metaDescription ?? '', ev: home.documentEv },
    { text: home.hero?.subline ?? '', ev: home.hero?.ev ?? home.documentEv },
  ];
  for (const candidate of candidates) {
    const match = AUDIENCE_PHRASE.exec(candidate.text.slice(0, 400));
    if (!match) continue;
    const phrase = match[0].trim();
    // Eine Leistung („für Heizung") ist keine Zielgruppe.
    const lower = phrase.toLowerCase();
    if ([...B2B_MARKERS, ...B2C_MARKERS].some((m) => lower.includes(m))) return known(phrase, 'high', [candidate.ev]);
  }
  return unknown('Keine Zielgruppen-Wendung („für …") in Titel, H1 oder Beschreibung.');
}

// ─────────────────────────────────────────────────────────────────────
// Conversion-Ziel
// ─────────────────────────────────────────────────────────────────────

function deriveConversionGoal(pages: SourcePage[]): Known<ConversionGoal> {
  const home = pages[0];
  // Was die Startseite prominent anbietet, zählt zuerst: Kopf und Hero.
  const prominent = home.ctas.filter((c) => c.inHero || c.inHeader);
  const byIntent = (list: typeof prominent) => {
    for (const [intent, goal] of [['booking', 'termin'], ['demo', 'demo'], ['buy', 'kauf'], ['contact', 'anfrage'], ['email', 'anfrage'], ['call', 'anruf']] as const) {
      const hit = list.find((c) => c.intent === intent);
      if (hit) return { goal: goal as ConversionGoal, ev: hit.ev };
    }
    return null;
  };
  const top = byIntent(prominent);
  if (top) return known(top.goal, 'high', [top.ev]);

  const bookingLink = pages.flatMap((p) => p.backendLinks).find((b) => b.kind === 'booking');
  if (bookingLink) return known('termin', 'medium', [bookingLink.ev]);
  const contactForm = pages.flatMap((p) => p.forms).find((f) => f.purpose === 'contact' || f.purpose === 'booking');
  if (contactForm) return known(contactForm.purpose === 'booking' ? 'termin' : 'anfrage', 'medium', [contactForm.ev]);
  const any = byIntent(home.ctas);
  if (any) return known(any.goal, 'low', [any.ev]);
  const phone = pages.flatMap((p) => p.contact.phones)[0];
  if (phone) return known('anruf', 'low', [phone.ev]);
  return unknown('Keine Handlungsaufforderung, kein Formular und keine Telefonnummer gefunden.');
}

// ─────────────────────────────────────────────────────────────────────
// Ort, Ton, Nutzenversprechen
// ─────────────────────────────────────────────────────────────────────

function deriveLocality(pages: SourcePage[]): Known<string> {
  for (const page of pages) {
    if (page.jsonLd.locality) return known(page.jsonLd.locality, 'high', [page.jsonLd.ev]);
  }
  for (const page of pages) {
    const address = page.contact.address;
    if (!address) continue;
    const match = /\b\d{5}\s+([A-ZÄÖÜ][a-zäöüß]+(?:[\s-][A-ZÄÖÜ][a-zäöüß]+)?)/.exec(address.value);
    if (match) return known(match[1], 'high', [address.ev]);
  }
  const home = pages[0];
  for (const [text, ev] of [[home.hero?.headline ?? '', home.hero?.ev], [home.title ?? '', home.documentEv], [home.metaDescription ?? '', home.documentEv]] as const) {
    const locality = localityFromText(text);
    if (locality) return known(locality, 'medium', [ev]);
  }
  return unknown('Kein Ort in Adresse, strukturierten Daten, Titel oder Überschrift.');
}

/**
 * Wörter, die im Deutschen nach „in" großgeschrieben stehen, ohne ein Ort zu
 * sein: feste Wendungen („in Sachen", „in Zukunft"), Zeitangaben, Sprachen,
 * Länder und Anreden. Ein Ort, der keiner ist, landete sonst in Überschrift,
 * Seitentitel und JSON-LD (`addressLocality`).
 */
const NOT_A_PLACE = new Set([
  'sachen', 'bezug', 'zukunft', 'kürze', 'ruhe', 'form', 'höhe', 'folge', 'betrieb', 'arbeit', 'planung', 'hinsicht',
  'richtung', 'zusammenarbeit', 'kooperation', 'partnerschaft', 'echtzeit', 'rekordzeit', 'bestform', 'bestzeit',
  'handarbeit', 'eigenregie', 'eigenleistung', 'absprache', 'abstimmung', 'qualität', 'perfektion', 'serie', 'summe',
  'anlehnung', 'betracht', 'frage', 'gefahr', 'kraft', 'ordnung', 'sicherheit', 'verbindung', 'kombination',
  'zeiten', 'zeit', 'sekunden', 'minuten', 'stunden', 'tagen', 'wochen', 'monaten', 'jahren', 'notfällen', 'notfall',
  'eile', 'not', 'praxis', 'theorie', 'teilzeit', 'vollzeit', 'deutsch', 'englisch', 'deutschland', 'europa',
  'österreich', 'schweiz', 'germany', 'europe', 'top', 'premium', 'meisterqualität', 'ihrer', 'ihrem', 'ihren',
  'ihr', 'ihre', 'unserer', 'unserem', 'unseren', 'unser', 'allen', 'jeder', 'jedem', 'jeden', 'sie', 'du', 'dir',
]);

/** Endungen abstrakter Hauptwörter, die in Ortsnamen nicht vorkommen („in Handwerksqualität"). */
const NOUN_SUFFIX = /(ung|heit|keit|schaft|ität|tion|ismus|nis|tum|arbeit|zeit)$/i;

/** Erste Wörter mehrteiliger Ortsnamen („Bad Homburg", „St. Ingbert"). */
const PLACE_PREFIX = new Set(['bad', 'sankt', 'st.', 'neu', 'groß', 'klein', 'alt', 'ober', 'unter', 'nieder', 'hohen']);

const IN_CAPITALIZED = /\b[Ii]n\s+(St\.|[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ]?[a-zäöüß]+)*)(?:\s+([A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ]?[a-zäöüß]+)*))?/gu;

/**
 * Ort aus einer Wendung „in <Ort>" — enger als `detectLocality` des
 * KI-Builders, der einen Prompt liest, keine fremde Website.
 *
 * Nach „in" steht im Deutschen oft ein großgeschriebenes Hauptwort („Ihr
 * Partner in Sachen Dachsanierung"). Deshalb: bekannte Nicht-Orte
 * überspringen, und folgt ein zweites großgeschriebenes Wort, ist das nur
 * dann ein zweiteiliger Ortsname, wenn das erste ein Ortsnamen-Präfix ist
 * („Bad Homburg") — sonst ist es eine Nominalgruppe und kein Ort.
 */
export function localityFromText(text: string): string | null {
  IN_CAPITALIZED.lastIndex = 0;
  for (const match of text.matchAll(IN_CAPITALIZED)) {
    const first = match[1];
    const second = match[2];
    const firstKey = first.toLowerCase();
    if (NOT_A_PLACE.has(firstKey.replace(/\.$/, '')) || NOUN_SUFFIX.test(first)) continue;
    if (second) {
      if (!PLACE_PREFIX.has(firstKey) || NOT_A_PLACE.has(second.toLowerCase()) || NOUN_SUFFIX.test(second)) continue;
      return `${first} ${second}`;
    }
    if (first.endsWith('.')) continue;
    return first.length >= 2 ? first : null;
  }
  return null;
}

function deriveTone(pages: SourcePage[]): Known<'sie' | 'du'> {
  const formal = pages.reduce((sum, p) => sum + p.text.formalAddress, 0);
  const informal = pages.reduce((sum, p) => sum + p.text.informalAddress, 0);
  const evidence = pages.map((p) => p.text.ev);
  if (formal + informal < 3) return unknown('Zu wenig direkte Ansprache im Text, um die Tonalität zu bestimmen.');
  if (formal >= informal * 3) return known('sie', formal >= 8 ? 'high' : 'medium', evidence);
  if (informal >= formal * 3) return known('du', informal >= 8 ? 'high' : 'medium', evidence);
  return unknown(`Gemischte Ansprache („Sie" ${formal}×, „du" ${informal}×).`);
}

function deriveValueProposition(home: SourcePage): Known<string> {
  const description = home.metaDescription;
  if (description && description.length >= 40 && description.length <= 320) return known(description, 'medium', [home.documentEv]);
  const subline = home.hero?.subline;
  if (subline && subline.length >= 40) return known(subline, 'medium', [home.hero?.ev]);
  return unknown('Weder Meta-Beschreibung noch Hero-Unterzeile formulieren ein Nutzenversprechen.');
}
