// REBUILD — Texte aus dem, was die Website selbst sagt.
//
// ## Was hier erlaubt ist und was nicht
//
// Erlaubt: Wortlaut der Quelle übernehmen, kürzen, neu anordnen, in feste
// Satzmuster einsetzen („Heizung, Sanitär und Bad in Leipzig"). Die Muster
// enthalten nur Verbindungswörter — keine Eigenschaften, keine Zahlen,
// keine Versprechen.
//
// Nicht erlaubt: Zahlen, Jahresangaben, Siegel, Superlative oder Garantien,
// die nicht auf der Ausgangsseite stehen. `findUnbackedClaims` prüft jeden
// zusammengesetzten Text gegen den Wortlaut der Quelle; ein Text mit einer
// unbelegten Behauptung wird verworfen und durch eine neutrale Fassung
// ersetzt. Eine erfundene Referenz oder Kennzahl wäre irreführende Werbung
// (§ 5 UWG) — und das Gegenteil dessen, wofür diese Plattform steht.
//
// Kein Sprachmodell: Die Stufe ist regelbasiert. Ein Modell kann später
// davor sitzen (Politur), der Guard bleibt davor stehen.

import type { ConversionGoal, Positioning, SourcePage, SourceSnapshot } from './types.ts';
import type { DirectionKey } from './design-system.ts';

// ─────────────────────────────────────────────────────────────────────
// Guard gegen unbelegte Behauptungen
// ─────────────────────────────────────────────────────────────────────

/** Wörter, die eine Behauptung tragen und belegt sein müssen. */
const CLAIM_WORDS = [
  'führend', 'marktführer', 'nr. 1', 'nummer 1', 'nummer eins', 'bester', 'beste', 'besten', 'einzig', 'einzige',
  'top', 'garantiert', 'garantie', 'zertifiziert', 'preisgekrönt', 'ausgezeichnet', 'award', 'testsieger',
  'kostenlos', 'gratis', 'unverbindlich', 'festpreis', 'sofort', '24/7', 'rund um die uhr', 'meisterbetrieb',
  'tüv', 'iso', 'dekra', 'weltweit', 'deutschlandweit', 'bundesweit', 'familiengeführt', 'inhabergeführt',
  'erfahren', 'erfahrung', 'experte', 'experten', 'spezialist', 'spezialisten', 'zufrieden', 'zufriedene',
  'schnell', 'schnellste', 'günstig', 'günstigste', 'billig', 'premium', 'exklusiv', 'innovativ',
];

/**
 * Liefert die Behauptungen in `text`, die im Wortlaut der Quelle (`corpus`)
 * nicht vorkommen: Zahlen (inklusive Jahreszahlen und Prozent) und
 * Behauptungswörter. Leer = der Text sagt nichts, was die Quelle nicht sagt.
 */
export function findUnbackedClaims(text: string, corpus: string): string[] {
  const source = normalize(corpus);
  const out: string[] = [];
  const lower = normalize(text);
  for (const number of lower.match(/\d+(?:[.,]\d+)?\s?%?/g) ?? []) {
    const bare = number.replace(/\s/g, '');
    if (!source.includes(bare) && !out.includes(bare)) out.push(bare);
  }
  for (const word of CLAIM_WORDS) {
    if (containsWord(lower, word) && !containsWord(source, word) && !out.includes(word)) out.push(word);
  }
  return out;
}

/** Nimmt den ersten Kandidaten ohne unbelegte Behauptung, sonst `fallback`. */
export function guarded(candidates: (string | null | undefined)[], fallback: string, corpus: string): { text: string; rejected: string[] } {
  const rejected: string[] = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const claims = findUnbackedClaims(candidate, corpus);
    if (claims.length === 0) return { text: candidate, rejected };
    rejected.push(`„${candidate}" (unbelegt: ${claims.join(', ')})`);
  }
  return { text: fallback, rejected };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ');
}

function containsWord(text: string, word: string): boolean {
  for (let from = 0; ; from += 1) {
    const at = text.indexOf(word, from);
    if (at === -1) return false;
    const before = text[at - 1];
    if (before === undefined || !/[\p{L}\p{N}]/u.test(before)) return true;
    from = at;
  }
}

/** Gesamter Wortlaut der Quelle, gegen den geprüft wird. */
export function sourceCorpus(snapshot: SourceSnapshot): string {
  return snapshot.pages
    .map((p) => [
      p.title, p.metaDescription, p.hero?.headline, p.hero?.subline, p.text.sample,
      ...p.headings.map((h) => h.text), ...p.trust.map((t) => t.value), ...p.navigation.map((n) => n.label),
      ...p.ctas.map((c) => c.label), ...p.prices.map((x) => x.text), ...p.sections.flatMap((s) => [s.heading, s.text, ...s.items]),
      p.jsonLd.name, p.jsonLd.streetAddress, p.jsonLd.postalCode, p.jsonLd.locality, p.jsonLd.openingHours,
      p.contact.address?.value, p.contact.openingHours?.value, ...p.contact.phones.map((x) => x.value), ...p.contact.emails.map((x) => x.value),
      ...p.trust.map((t) => t.detail), ...p.faqs.flatMap((f) => [f.question, f.answer]), ...p.prices.map((x) => x.label),
    ].filter(Boolean).join(' \n '))
    .join(' \n ');
}

// ─────────────────────────────────────────────────────────────────────
// Bausteine
// ─────────────────────────────────────────────────────────────────────

const LEGAL_SUFFIX = /\s*(?:,\s*)?(?:(?:Steuerberatungs|Wirtschaftsprüfungs|Rechtsanwalts|Partnerschafts)gesellschaft\s*)?(?:mbB|mbH|GmbH\s*&\s*Co\.?\s*KG|GmbH|gGmbH|UG\s*\(haftungsbeschränkt\)|UG|AG|KG|OHG|GbR|e\.\s?K\.?|e\.\s?V\.?|PartG(?:\s*mbB)?|SE|Ltd\.?|Inc\.?)\.?$/i;

/** Anzeigename ohne Rechtsformzusatz („Müller Haustechnik GmbH" → „Müller Haustechnik"). */
export function displayName(name: string): string {
  let current = name.trim();
  for (let k = 0; k < 3; k += 1) {
    const next = current.replace(LEGAL_SUFFIX, '').trim();
    if (next === current || next.length < 2) break;
    current = next;
  }
  return current;
}

/**
 * „A, B und C" — höchstens `max` Einträge. Enthält ein vorderer Eintrag
 * selbst ein „und" („Finanz- und Lohnbuchhaltung"), verbindet „sowie" —
 * sonst stünden zwei „und" hintereinander.
 */
export function joinList(items: string[], max = 3): string {
  const list = items.slice(0, max);
  if (list.length <= 1) return list[0] ?? '';
  const head = list.slice(0, -1);
  const connector = head.some((item) => / und /.test(item)) ? ' sowie ' : ' und ';
  return `${head.join(', ')}${connector}${list[list.length - 1]}`;
}

/**
 * Zerlegt in Sätze — ohne Lookbehind, weil der Kern auch in älteren
 * Browsern laufen muss (siehe `refine.ts`).
 */
export function sentencesOf(text: string): string[] {
  const out: string[] = [];
  let from = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if ((ch === '.' || ch === '!' || ch === '?') && (text[i + 1] === ' ' || text[i + 1] === undefined)) {
      out.push(text.slice(from, i + 1).trim());
      from = i + 1;
    }
  }
  const rest = text.slice(from).trim();
  if (rest !== '') out.push(rest);
  return out.filter((s) => s !== '');
}

/** Kürzt an einer Satzgrenze, notfalls an einer Wortgrenze. */
export function trimToSentence(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const sentences = sentencesOf(clean);
  let out = '';
  for (const sentence of sentences) {
    if ((out + (out ? ' ' : '') + sentence).length > max) break;
    out += (out ? ' ' : '') + sentence;
  }
  if (out.length >= Math.min(60, max / 2)) return out;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:–-]$/, '')}…`;
}

/** Erster Satz, wenn er kurz genug ist, eine Überschrift zu sein. */
function headlineSentence(text: string | null | undefined, maxWords = 12): string | null {
  if (!text) return null;
  const first = sentencesOf(text)[0]?.replace(/[.!]$/, '').trim();
  if (!first) return null;
  const words = first.split(/\s+/).length;
  return words >= 3 && words <= maxWords ? first : null;
}

const GENERIC_H1 = /^(herzlich\s+)?willkommen\b|^home$|^startseite$|^start$|^welcome\b|^hallo\b/i;

/** Die H1 der Quelle, wenn sie als Hauptaussage taugt. */
function usableSourceHeadline(home: SourcePage, company: string | null): string | null {
  const h1 = home.hero?.headline?.trim();
  if (!h1 || GENERIC_H1.test(h1)) return null;
  const words = h1.split(/\s+/).length;
  if (words < 2 || words > 12 || h1.length > 90) return null;
  if (company && displayName(h1).toLowerCase() === displayName(company).toLowerCase()) return null;
  return h1;
}

/** Titelsegmente, die nur die Seite benennen, nicht das Angebot („Startseite – Müller Bau"). */
const GENERIC_SEGMENT = /^(start|startseite|home|homepage|index|willkommen|herzlich willkommen|welcome|kontakt|impressum|datenschutz|leistungen|über uns|ueber uns|aktuelles|news|blog|seite nicht gefunden|404)$/i;

/** Titelsegment neben dem Namen („Heizung, Sanitär & Bad in Leipzig"). */
function titleClaim(home: SourcePage, company: string | null): string | null {
  if (!home.title) return null;
  const segments = home.title.split(/\s+[|–—·•:-]\s+|\s*\|\s*/).map((s) => s.trim()).filter((s) => s.length >= 4);
  const name = company ? displayName(company).toLowerCase() : '';
  const candidates = segments.filter((s) => {
    if (GENERIC_SEGMENT.test(s) || GENERIC_H1.test(s)) return false;
    const lower = displayName(s).toLowerCase();
    return lower !== name && !(name && (lower.includes(name) || name.includes(lower)));
  });
  const best = candidates.find((s) => s.split(/\s+/).length <= 9);
  return best ?? null;
}

// ─────────────────────────────────────────────────────────────────────
// Handlungsaufforderungen
// ─────────────────────────────────────────────────────────────────────

export interface CtaCopy {
  label: string;
  href: string;
  source: 'quelle' | 'komponiert';
}

const VAGUE = /^(mehr|mehr erfahren|mehr infos?|weiter|weiterlesen|hier|hier klicken|details|entdecken|zur seite)$/i;

const GOAL_LABELS: Readonly<Record<ConversionGoal, { sie: string; du: string }>> = {
  anfrage: { sie: 'Anfrage senden', du: 'Anfrage senden' },
  termin: { sie: 'Termin vereinbaren', du: 'Termin vereinbaren' },
  anruf: { sie: 'Jetzt anrufen', du: 'Jetzt anrufen' },
  kauf: { sie: 'Zum Shop', du: 'Zum Shop' },
  demo: { sie: 'Demo anfragen', du: 'Demo anfragen' },
};

export function primaryCta(snapshot: SourceSnapshot, positioning: Positioning, formAnchor: string): CtaCopy {
  const home = snapshot.pages[0];
  const goal = positioning.conversionGoal.value ?? 'anfrage';
  const tone = positioning.tone.value ?? 'sie';
  const phone = snapshot.pages.flatMap((p) => p.contact.phones)[0];
  const bookingLink = snapshot.pages.flatMap((p) => p.backendLinks).find((b) => b.kind === 'booking');
  const shopLink = snapshot.pages.flatMap((p) => p.backendLinks).find((b) => b.kind === 'shop' || b.kind === 'payment');

  // Die prominente Aufforderung der Quelle behalten, wenn sie konkret ist —
  // mit ihrem Ziel. Das erhält zugleich Buchungs- und Demo-Strecken.
  const prominent = home?.ctas.find((c) => (c.inHero || c.inHeader) && c.buttonLike && !VAGUE.test(c.label.trim()) && c.href && c.intent !== 'other');
  if (prominent && prominent.href) {
    const href = prominent.intent === 'contact' && sameOriginPath(prominent.href, snapshot.resolvedUrl) ? formAnchor : prominent.href;
    return { label: prominent.label, href, source: 'quelle' };
  }

  const label = GOAL_LABELS[goal][tone];
  switch (goal) {
    case 'termin':
      return { label, href: bookingLink?.href ?? formAnchor, source: 'komponiert' };
    case 'anruf':
      return phone ? { label, href: phone.href ?? `tel:${phone.value.replace(/[^\d+]/g, '')}`, source: 'komponiert' } : { label: GOAL_LABELS.anfrage[tone], href: formAnchor, source: 'komponiert' };
    case 'kauf':
      return shopLink ? { label, href: shopLink.href, source: 'komponiert' } : { label: GOAL_LABELS.anfrage[tone], href: formAnchor, source: 'komponiert' };
    default:
      return { label, href: formAnchor, source: 'komponiert' };
  }
}

export function secondaryCta(snapshot: SourceSnapshot, primary: CtaCopy, servicesAnchor: string): CtaCopy {
  const phone = snapshot.pages.flatMap((p) => p.contact.phones).find((p) => p.source !== 'json-ld') ?? snapshot.pages.flatMap((p) => p.contact.phones)[0];
  if (phone && !primary.href.startsWith('tel:')) {
    return { label: `Anrufen: ${phone.value}`, href: phone.href ?? `tel:${phone.value.replace(/[^\d+]/g, '')}`, source: 'quelle' };
  }
  return { label: 'Leistungen ansehen', href: servicesAnchor, source: 'komponiert' };
}

function sameOriginPath(href: string, base: string): boolean {
  try {
    return new URL(href).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Hero und Abschnittstexte je Richtung
// ─────────────────────────────────────────────────────────────────────

export interface HeroCopy {
  eyebrow: string | null;
  headline: string;
  subline: string | null;
  proof: string | null;
  sources: { headline: 'quelle' | 'komponiert'; subline: 'quelle' | 'komponiert' | null };
  rejected: string[];
}

export function composeHero(
  snapshot: SourceSnapshot,
  positioning: Positioning,
  direction: DirectionKey,
  proofItems: string[],
): HeroCopy {
  const home = snapshot.pages[0];
  const corpus = sourceCorpus(snapshot);
  const company = positioning.companyName.value;
  const name = company ? displayName(company) : null;
  const offers = positioning.offer.value ?? [];
  const locality = positioning.locality.value;
  const sourceH1 = usableSourceHeadline(home, company);
  const claim = titleClaim(home, company);
  const offerPhrase = offers.length > 0 ? joinList(offers, offers.join('').length > 48 ? 2 : 3) : null;
  const withPlace = (phrase: string | null, preposition: 'in' | 'aus') =>
    phrase && locality && !phrase.includes(locality) ? `${phrase} ${preposition} ${locality}` : phrase;

  let candidates: (string | null)[];
  switch (direction) {
    case 'clean-enterprise':
      candidates = [sourceH1, claim, withPlace(offerPhrase, 'in'), name];
      break;
    case 'conversion-focus':
      candidates = [withPlace(claim && claim.split(/\s+/).length <= 7 ? claim : offerPhrase, 'in'), sourceH1, claim, name];
      break;
    case 'local-trust':
      candidates = [withPlace(offerPhrase, 'aus'), sourceH1, claim, name];
      break;
    case 'premium-advisory':
      candidates = [sourceH1, headlineSentence(positioning.valueProposition.value), claim, withPlace(offerPhrase, 'in'), name];
      break;
  }
  const fallbackHeadline = name ?? (home.title ? home.title.split(/\s+[|–—-]\s+/)[0] : 'Willkommen');
  const headline = guarded(candidates, fallbackHeadline, corpus);
  const headlineSource: 'quelle' | 'komponiert' = headline.text === sourceH1 || headline.text === claim ? 'quelle' : 'komponiert';

  const sublineRaw = positioning.valueProposition.value ?? home.hero?.subline ?? null;
  const subline = sublineRaw ? trimToSentence(sublineRaw, direction === 'conversion-focus' ? 150 : 190) : (offerPhrase ? `Leistungen: ${offerPhrase}.` : null);

  let eyebrow: string | null = null;
  switch (direction) {
    case 'clean-enterprise':
      eyebrow = positioning.audiencePhrase.value ? capitalize(positioning.audiencePhrase.value) : name;
      break;
    case 'conversion-focus':
      eyebrow = locality ? `${name ?? ''}${name ? ' · ' : ''}${locality}` : name;
      break;
    case 'local-trust':
      eyebrow = name && locality ? `${name} · ${locality}` : name ?? locality;
      break;
    case 'premium-advisory':
      eyebrow = name;
      break;
  }
  if (eyebrow && eyebrow.toLowerCase() === headline.text.toLowerCase()) eyebrow = null;

  const proof = proofItems.length > 0 ? proofItems.slice(0, 3).join(' · ') : null;

  return {
    eyebrow,
    headline: headline.text,
    subline,
    proof,
    sources: { headline: headlineSource, subline: sublineRaw ? 'quelle' : subline ? 'komponiert' : null },
    rejected: headline.rejected,
  };
}

export interface SeoCopy {
  title: string;
  description: string;
}

export function composeSeo(snapshot: SourceSnapshot, positioning: Positioning): SeoCopy {
  const home = snapshot.pages[0];
  const corpus = sourceCorpus(snapshot);
  const company = positioning.companyName.value;
  const name = company ? displayName(company) : null;
  const offers = positioning.offer.value ?? [];
  const locality = positioning.locality.value;
  const claim = titleClaim(home, company);

  const offerPart = claim ?? (offers.length > 0 ? joinList(offers, 2) : null);
  const withLocality = offerPart && locality && !offerPart.includes(locality) ? `${offerPart} in ${locality}` : offerPart;
  const titleCandidates = [
    name && withLocality ? `${name} – ${withLocality}` : null,
    name && offerPart ? `${name} – ${offerPart}` : null,
    withLocality,
    name,
  ].filter((t): t is string => t !== null && t.length <= 60);
  const title = guarded(titleCandidates, trimToSentence(home.title ?? name ?? 'Website', 60), corpus).text;

  const descriptionSource = positioning.valueProposition.value ?? home.hero?.subline ?? null;
  const composed = [name, withLocality ? `${withLocality}.` : null].filter(Boolean).join(': ');
  const description = trimToSentence(descriptionSource ?? (composed || title), 155);
  return { title, description };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
