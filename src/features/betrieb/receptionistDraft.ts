// Reine Mapping-Logik „Website-Check → Entwurf KI-Sekretariat“ (AI Receptionist).
//
// Eingang ist die Antwort von `siteos/discover` (Startseite einer öffentlichen
// Website: Titel, Beschreibung, Überschriften, Leistungen, sichtbarer Text).
// Keine Datenzugriffe, keine Seiteneffekte: Die View ruft den Website-Check über
// `discoverWebsite` (Mandant aus dem Tenant-Kontext, Mitgliedschaft prüft der
// Server) und übergibt das Ergebnis hierher.
//
// Grundsätze:
// - Nichts erfinden. Was die Website nicht hergibt, bleibt leer und wird als
//   offener Punkt geführt. Vorschläge (Begrüßung, Übergaberegel) sind als
//   „vorschlag“ gekennzeichnet, nie als Website-Angabe.
// - Herkunftsnachweis je Feld: aus Website (mit Fundstelle), vom Inhaber,
//   Vorschlag oder fehlt. Quelle und Lesezeitpunkt gelten für den ganzen Entwurf.
// - Website-Inhalte sind nicht vertrauenswürdige Daten: bereinigt, gekürzt,
//   und Textstellen, die wie Anweisungen an KI-Systeme aussehen, werden verworfen.
//   Freier Seitentext wandert nie ungefiltert in Begrüßung oder Regeln.

import { normalizeWebsiteSource } from '../siteos/scanHandoff';

/** Felder aus `siteos/discover`, die das Mapping liest. */
export interface WebsiteDiscovery {
  source_url: string | null;
  title: string | null;
  description: string | null;
  h1: string | null;
  headings: string[];
  services: string[];
  visible_text: string;
  fetched_at: string | null;
}

export type FieldSource = 'website' | 'inhaber' | 'vorschlag' | 'fehlt';

export interface DraftField {
  /** Leer (`[]`) heißt: keine Angabe. Einzelwerte stehen als einelementige Liste. */
  values: string[];
  source: FieldSource;
  /** Fundstelle bzw. Begründung, z. B. „Seitentitel“, „Seitentext“. */
  evidence: string | null;
  /** Heuristisch gelesen oder mehrdeutig: vor der Freigabe besonders prüfen. */
  needsReview: boolean;
}

export const FIELD_KEYS = [
  'businessName',
  'trade',
  'services',
  'openingHours',
  'phones',
  'emails',
  'serviceArea',
  'greeting',
  'handoverRule',
  'handoverTarget',
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

export const FIELD_LABEL: Record<FieldKey, string> = {
  businessName: 'Betriebsname',
  trade: 'Gewerk',
  services: 'Leistungen',
  openingHours: 'Öffnungszeiten',
  phones: 'Telefon',
  emails: 'E-Mail',
  serviceArea: 'Einzugsgebiet',
  greeting: 'Begrüßung',
  handoverRule: 'Übergabe an Menschen – wann',
  handoverTarget: 'Übergabe an Menschen – an wen',
};

/** Felder mit mehreren Einträgen (Bearbeitung: ein Eintrag je Zeile). */
export const LIST_FIELDS: readonly FieldKey[] = ['trade', 'services', 'openingHours', 'phones', 'emails'];

export type OpenPointSeverity = 'pflicht' | 'pruefen' | 'empfohlen';

export interface OpenPoint {
  /** `null`: betrifft den Entwurf insgesamt. */
  field: FieldKey | null;
  severity: OpenPointSeverity;
  text: string;
}

/** Eingaben des Inhabers. `''` heißt: bewusst geleert (Website-Wert verwerfen). */
export type OwnerInput = Partial<Record<FieldKey, string>>;

export interface ReceptionistDraft {
  provenance: { sourceUrl: string | null; fetchedAt: string | null };
  fields: Record<FieldKey, DraftField>;
  /** Was der Assistent in jedem Gespräch aufnimmt (fester Ablauf des AI Receptionist). */
  intake: readonly string[];
  openPoints: OpenPoint[];
  /** Verworfene Website-Inhalte (Grund), damit der Inhaber sieht, was fehlt und warum. */
  discarded: string[];
}

export const INTAKE_STEPS: readonly string[] = [
  'Anliegen',
  'Name',
  'Rückrufnummer',
  'Ort bzw. Adresse des Einsatzes',
  'Terminwunsch (wird aufgenommen, nicht bestätigt)',
];

export const HANDOVER_RULE_PROPOSAL =
  'An einen Menschen übergeben, wenn die anrufende Person es wünscht, ein Notfall oder eine ' +
  'Beschwerde vorliegt, nach Preisen, Angeboten oder verbindlichen Terminen gefragt wird oder ' +
  'der Assistent unsicher ist. Übergeben werden Anliegen, Name, Rückrufnummer, Ort und Terminwunsch.';

const MAX_TEXT = 200;
const MAX_SERVICES = 8;
const MAX_HOURS = 7;
const MAX_PHONES = 4;
const MAX_EMAILS = 3;
const MAX_SCAN_TEXT = 12_000;

// ── Bereinigung ─────────────────────────────────────────────────────────

const INVISIBLE_OR_CONTROL = /[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g;

/** Text aus fremder Quelle: Steuer-/Unsichtbarzeichen und spitze Klammern raus, Leerraum glätten, kürzen. */
export function cleanText(value: unknown, max = MAX_TEXT): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(INVISIBLE_OR_CONTROL, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

const INSTRUCTION_LIKE =
  /\b(?:ignorier(?:e|en|t)?|ignore|disregard|vergiss|forget|system\s*-?\s*prompt|jailbreak|anweisung(?:en)?|instructions?)\b|\b(?:du bist|you are)\s+(?:jetzt|nun|ab sofort|now)\b|\b(?:assistant|system)\s*:|```|\{\{|\}\}/i;

/** Sieht der Text wie eine Anweisung an ein KI-System aus? Dann nicht übernehmen. */
export function looksLikeInstruction(text: string): boolean {
  return INSTRUCTION_LIKE.test(text);
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.toLocaleLowerCase('de-DE');
    if (!v || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Antwort von `siteos/discover` defensiv lesen; alles Unbekannte wird leer. */
export function normalizeDiscovery(raw: unknown): WebsiteDiscovery | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const fetchedRaw = r.fetched_at;
  const sourceRaw = r.source_url;
  const fetched = typeof fetchedRaw === 'string' && !Number.isNaN(Date.parse(fetchedRaw)) ? fetchedRaw : null;
  return {
    source_url: typeof sourceRaw === 'string' ? normalizeWebsiteSource(sourceRaw) : null,
    title: cleanText(r.title) || null,
    description: cleanText(r.description, 400) || null,
    h1: cleanText(r.h1) || null,
    headings: stringList(r.headings).map((h) => cleanText(h)).filter(Boolean),
    services: stringList(r.services).map((s) => cleanText(s)).filter(Boolean),
    visible_text: cleanText(r.visible_text, MAX_SCAN_TEXT),
    fetched_at: fetched,
  };
}

// ── Extraktion ──────────────────────────────────────────────────────────

const GENERIC_SEGMENT =
  /^(?:startseite|home|homepage|willkommen|herzlich willkommen|start|index|aktuelles|news|kontakt|impressum)$/i;
const WELCOME_PREFIX = /^(?:herzlich\s+)?willkommen\s+(?:bei|auf|im|in der|in)\s+(?:der\s+|dem\s+|den\s+)?/i;

/** Betriebsname aus Seitentitel (erstes sinnvolles Segment) oder Hauptüberschrift. */
export function extractBusinessName(d: WebsiteDiscovery): { value: string; evidence: string; needsReview: boolean } | null {
  const candidates: { text: string; evidence: string }[] = [];
  if (d.title) {
    for (const seg of d.title.split(/\s+[|–—·•:-]\s+|\s*\|\s*/)) candidates.push({ text: seg, evidence: 'Seitentitel' });
  }
  if (d.h1) candidates.push({ text: d.h1, evidence: 'Hauptüberschrift' });

  for (const c of candidates) {
    const text = cleanText(c.text.replace(WELCOME_PREFIX, ''), 80).replace(/[!.]+$/, '').trim();
    if (text.length < 2 || GENERIC_SEGMENT.test(text) || looksLikeInstruction(text)) continue;
    // Ein Name aus Titel/Überschrift ist immer eine Lesart, kein Registereintrag.
    return { value: text, evidence: c.evidence, needsReview: true };
  }
  return null;
}

const TRADES: readonly (readonly [string, RegExp])[] = [
  ['Elektro', /\belektr(?:o|iker|isch)/i],
  ['Sanitär, Heizung, Klima', /\b(?:sanitär|sanitaer|heizung|heizungsbau|shk\b|klimatechnik|wärmepumpe|installateur)/i],
  ['Dachdecker', /\bdach(?:decker|deckerei|sanierung|arbeiten)/i],
  ['Maler und Lackierer', /\b(?:maler|malerbetrieb|lackier)/i],
  ['Tischler/Schreiner', /\b(?:tischler|schreiner)/i],
  ['Zimmerei', /\bzimmer(?:ei|er)\b/i],
  ['Fliesenleger', /\bfliese/i],
  ['Garten- und Landschaftsbau', /\b(?:garten-?\s*und\s*landschaftsbau|galabau|landschaftsgärtner)/i],
  ['Kfz-Werkstatt', /\b(?:kfz|autowerkstatt|karosserie)/i],
  ['Metallbau/Schlosserei', /\b(?:metallbau|schlosserei)/i],
  ['Maurer/Bau', /\b(?:maurer|bauunternehmen|hochbau|rohbau)/i],
  ['Bodenleger', /\b(?:bodenleger|parkett)/i],
  ['Gebäudereinigung', /\bgebäudereinigung/i],
  ['Schornsteinfeger', /\bschornsteinfeger/i],
];

/** Gewerk(e) per Stichwort, zuerst aus Titel/Beschreibung/Überschriften, sonst aus dem Seitentext. */
export function extractTrades(d: WebsiteDiscovery): { values: string[]; evidence: string } | null {
  const prominent = [d.title, d.description, d.h1, ...d.headings].filter(Boolean).join(' · ');
  const match = (text: string) => TRADES.filter(([, re]) => re.test(text)).map(([label]) => label);
  const fromProminent = match(prominent);
  if (fromProminent.length) return { values: fromProminent.slice(0, 3), evidence: 'Seitentitel, Beschreibung, Überschriften' };
  const fromText = match(d.visible_text);
  if (fromText.length) return { values: fromText.slice(0, 3), evidence: 'Seitentext' };
  return null;
}

const GENERIC_HEADING =
  /^(?:kontakt(?:ieren sie uns)?|über uns|ueber uns|wir über uns|impressum|datenschutz(?:erklärung)?|(?:herzlich )?willkommen.*|startseite|home|menü|menu|navigation|aktuelles|news|neuigkeiten|(?:unser )?team|jobs|karriere|stellenangebote|referenzen|bewertungen|öffnungszeiten|anfahrt|so finden sie uns|cookie.*|newsletter|faq|häufige fragen|mehr erfahren|weiterlesen)$/i;

/** Leistungen aus den vom Website-Check erkannten Überschriften/Sätzen, ohne Navigationsbegriffe. */
export function extractServices(d: WebsiteDiscovery, businessName: string | null, discarded: string[]): string[] {
  const nameKey = businessName?.toLocaleLowerCase('de-DE') ?? null;
  const out: string[] = [];
  for (const raw of d.services) {
    const s = cleanText(raw, 100).replace(/[:!]+$/, '').trim();
    if (s.length < 3 || GENERIC_HEADING.test(s)) continue;
    if (nameKey && s.toLocaleLowerCase('de-DE') === nameKey) continue;
    if (looksLikeInstruction(s)) {
      discarded.push('Leistungstext verworfen: wirkt wie eine Anweisung an KI-Systeme.');
      continue;
    }
    out.push(s);
  }
  return unique(out).slice(0, MAX_SERVICES);
}

const DAY = '(?<!\\p{L})(?:Mo(?:ntag)?|Di(?:enstag)?|Mi(?:ttwoch)?|Do(?:nnerstag)?|Fr(?:eitag)?|Sa(?:mstag)?|So(?:nntag)?)\\.?(?!\\p{L})';
const TIME = '\\d{1,2}(?:[:.]\\d{2})?';
const SEP = '\\s*(?:-|–|—|bis)\\s*';
const DAY_LIST = `${DAY}(?:(?:${SEP}|\\s*(?:,|und|&|\\+)\\s*)${DAY})*`;
const SLOT = `${TIME}${SEP}${TIME}(?:\\s*Uhr)?`;
const HOURS_RE = new RegExp(`${DAY_LIST}\\s*:?\\s*${SLOT}(?:\\s*(?:,|und|&|\\/)\\s*${SLOT})*`, 'giu');
const SLOT_RE = new RegExp(`(${TIME})${SEP}(${TIME})`, 'gu');
const HOURS_CONTEXT = /öffnungszeit|geschäftszeit|bürozeit|sprechzeit|erreichbar/i;

function minutes(t: string): number {
  const [h, m = '0'] = t.split(/[:.]/);
  return Number(h) * 60 + Number(m);
}

function plausibleSlots(text: string): boolean {
  const slots = [...text.matchAll(SLOT_RE)];
  return slots.length > 0 && slots.every((s) => {
    const a = minutes(s[1]);
    const b = minutes(s[2]);
    return a < b && b <= 24 * 60 && /^\d{1,2}(?:[:.][0-5]\d)?$/.test(s[1]) && /^\d{1,2}(?:[:.][0-5]\d)?$/.test(s[2]);
  });
}

/** Öffnungszeiten wörtlich aus dem Seitentext (Tag(e) + Uhrzeitspanne). Keine Deutung, keine Ergänzung. */
export function extractOpeningHours(text: string): { values: string[]; needsReview: boolean } | null {
  const found = [...text.matchAll(HOURS_RE)]
    .map((m) => cleanText(m[0], 80))
    .filter(plausibleSlots);
  const values = unique(found).slice(0, MAX_HOURS);
  if (!values.length) return null;
  return { values, needsReview: !HOURS_CONTEXT.test(text) };
}

// Höchstens ein Trennzeichen (ggf. mit Leerzeichen) zwischen Ziffern, damit Nummern nicht in
// Folgetext (z. B. Postleitzahl) hineinlaufen.
const PHONE_RE = /(?:\+|00)49\s?(?:\(0\)\s?)?[\-\/.]?\s?[1-9](?:\s?[\-\/.]?\s?\d){4,13}|\(?0[1-9]\d{1,4}\)?(?:\s?[\-\/.]?\s?\d){4,10}/g;
const PHONE_SKIP_CONTEXT = /iban|bic|swift|konto|ust|steuer|st\.?\s*-?nr|hrb|hra|register|amtsgericht/i;

export function normalizePhone(display: string): string {
  let s = display.replace(/\(0\)/g, '').replace(/[^\d+]/g, '');
  if (s.startsWith('+49')) s = `0${s.slice(3)}`;
  else if (s.startsWith('0049')) s = `0${s.slice(4)}`;
  return s.replace(/\+/g, '');
}

export interface PhoneHit {
  label: 'Telefon' | 'Mobil' | 'Notdienst';
  display: string;
}

/** Telefonnummern aus dem Seitentext. Fax und Bank-/Registernummern werden nicht übernommen. */
export function extractPhones(text: string, discarded: string[]): PhoneHit[] {
  const hits: PhoneHit[] = [];
  const seen = new Set<string>();
  let lastEnd = 0;
  let faxSkipped = false;
  for (const m of text.matchAll(PHONE_RE)) {
    const start = m.index ?? 0;
    const context = text.slice(Math.max(lastEnd, start - 30), start);
    lastEnd = start + m[0].length;
    const display = cleanText(m[0], 30).replace(/[\s\-\/.]+$/, '');
    const digits = normalizePhone(display);
    if (digits.length < 6 || digits.length > 14) continue;
    if (PHONE_SKIP_CONTEXT.test(context)) continue;
    if (/fax/i.test(context)) { faxSkipped = true; continue; }
    if (seen.has(digits)) continue;
    seen.add(digits);
    const label: PhoneHit['label'] = /notdienst|notruf|24\s*h|24\/7/i.test(context)
      ? 'Notdienst'
      : /mobil|handy|cell/i.test(context) ? 'Mobil' : 'Telefon';
    hits.push({ label, display });
  }
  if (faxSkipped) discarded.push('Fax-Nummer nicht übernommen: Der Assistent nennt nur Telefon und E-Mail.');
  return hits.slice(0, MAX_PHONES);
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi;
const NOT_A_MAIL_TLD = /\.(?:png|jpe?g|gif|svg|webp|avif|css|js)$/i;

export function extractEmails(text: string): string[] {
  const found = (text.match(EMAIL_RE) ?? [])
    .map((e) => e.toLowerCase())
    .filter((e) => !NOT_A_MAIL_TLD.test(e) && !/@(?:example|beispiel|domain)\./.test(e));
  return unique(found).slice(0, MAX_EMAILS);
}

const AREA_PHRASE =
  /(?:einzugsgebiet|einsatzgebiet|arbeitsgebiet|tätig\s+(?:in|im)|im\s+raum|in\s+und\s+um|rund\s+um|im\s+umkreis\s+von)\s*:?\s*[^.!?;]{3,80}/iu;
const AND_SURROUNDINGS = /(?<!\p{L})\p{Lu}[\p{L}-]+(?:\s\p{Lu}[\p{L}-]+)?\s+und\s+Umgebung/u;
const POSTAL_TOWN = /(?<!\d)(\d{5})\s+(\p{Lu}[\p{L}-]+(?:\s(?:am|an der|im|bei|in)\s\p{Lu}[\p{L}-]+)?)/u;

/** Einzugsgebiet: ausdrückliche Angabe, sonst nur Standort aus der Anschrift (als unsicher markiert). */
export function extractServiceArea(text: string): { value: string; evidence: string; needsReview: boolean } | null {
  const explicit = text.match(AREA_PHRASE)?.[0] ?? text.match(AND_SURROUNDINGS)?.[0];
  if (explicit) {
    const value = cleanText(explicit, 100);
    // Der Seitentext ist ohne Absätze zusammengezogen; die Phrase kann in Folgetext laufen.
    if (!looksLikeInstruction(value)) return { value, evidence: 'Seitentext', needsReview: true };
  }
  const postal = text.match(POSTAL_TOWN);
  if (postal) {
    return { value: `Standort ${postal[1]} ${postal[2]}`, evidence: 'Anschrift im Seitentext (nur Standort)', needsReview: true };
  }
  return null;
}

const AI_DISCLOSURE = /\bKI\b|künstliche[rn]?\s+intelligenz|\bAI\b|digitale[rn]?\s+assistent|virtuelle[rn]?\s+assistent/i;

export function greetingProposal(businessName: string): string {
  return `Guten Tag, hier ist der KI-Assistent von ${businessName}. Ich nehme Ihr Anliegen auf und gebe es an unser Team weiter. Worum geht es?`;
}

// ── Entwurf ─────────────────────────────────────────────────────────────

function field(values: string[], source: FieldSource, evidence: string | null, needsReview = false): DraftField {
  return values.length ? { values, source, evidence, needsReview } : { values: [], source: 'fehlt', evidence: null, needsReview: false };
}

function ownerField(key: FieldKey, raw: string): DraftField {
  const lines = LIST_FIELDS.includes(key)
    ? unique(raw.split(/\r?\n/).map((l) => cleanText(l)).filter(Boolean))
    : [cleanText(raw, key === 'greeting' || key === 'handoverRule' ? 400 : MAX_TEXT)].filter(Boolean);
  return lines.length
    ? { values: lines, source: 'inhaber', evidence: 'vom Inhaber eingetragen', needsReview: false }
    : { values: [], source: 'fehlt', evidence: 'vom Inhaber geleert', needsReview: false };
}

/**
 * Baut den Entwurf. `discovery` darf `null` sein (leerer Scan / ohne Website begonnen).
 * Inhaberangaben haben Vorrang vor Website-Werten.
 */
export function buildReceptionistDraft(discovery: unknown, owner: OwnerInput = {}): ReceptionistDraft {
  const d = normalizeDiscovery(discovery);
  const discarded: string[] = [];
  const text = d?.visible_text ?? '';

  const fromWebsite: Partial<Record<FieldKey, DraftField>> = {};
  if (d) {
    const name = extractBusinessName(d);
    fromWebsite.businessName = field(name ? [name.value] : [], 'website', name?.evidence ?? null, name?.needsReview);

    const trades = extractTrades(d);
    fromWebsite.trade = field(trades?.values ?? [], 'website', trades?.evidence ?? null, (trades?.values.length ?? 0) > 1);

    const services = extractServices(d, name?.value ?? null, discarded);
    fromWebsite.services = field(services, 'website', 'Überschriften und Leistungssätze der Startseite', true);

    const hours = extractOpeningHours(text);
    fromWebsite.openingHours = field(hours?.values ?? [], 'website', 'Seitentext', hours?.needsReview);

    const phones = extractPhones(text, discarded);
    fromWebsite.phones = field(phones.map((p) => `${p.label} ${p.display}`), 'website', 'Seitentext', phones.length > 1);

    const emails = extractEmails(text);
    fromWebsite.emails = field(emails, 'website', 'Seitentext', emails.length > 1);

    const area = extractServiceArea(text);
    fromWebsite.serviceArea = field(area ? [area.value] : [], 'website', area?.evidence ?? null, area?.needsReview);

    if (/\[email(?:&#160;|\s)protected\]|email\s+protected/i.test(text) && !emails.length) {
      discarded.push('E-Mail-Adresse auf der Website verschleiert und nicht lesbar.');
    }
  }

  const resolve = (key: FieldKey, fallback: () => DraftField): DraftField =>
    owner[key] !== undefined ? ownerField(key, owner[key] ?? '') : fromWebsite[key] ?? fallback();

  const none = (): DraftField => field([], 'fehlt', null);
  const fields = {} as Record<FieldKey, DraftField>;
  fields.businessName = resolve('businessName', none);
  fields.trade = resolve('trade', none);
  fields.services = resolve('services', none);
  fields.openingHours = resolve('openingHours', none);
  fields.phones = resolve('phones', none);
  fields.emails = resolve('emails', none);
  fields.serviceArea = resolve('serviceArea', none);
  const businessName = fields.businessName.values[0] ?? null;
  fields.greeting = resolve('greeting', () =>
    businessName ? field([greetingProposal(businessName)], 'vorschlag', 'Vorschlag aus dem Betriebsnamen') : none());
  fields.handoverRule = resolve('handoverRule', () => field([HANDOVER_RULE_PROPOSAL], 'vorschlag', 'Standardregel AI Receptionist'));
  fields.handoverTarget = resolve('handoverTarget', none);

  return {
    provenance: { sourceUrl: d?.source_url ?? null, fetchedAt: d?.fetched_at ?? null },
    fields,
    intake: INTAKE_STEPS,
    openPoints: collectOpenPoints(fields, discarded),
    discarded: unique(discarded),
  };
}

function collectOpenPoints(fields: Record<FieldKey, DraftField>, discarded: string[]): OpenPoint[] {
  const points: OpenPoint[] = [];
  const add = (key: FieldKey | null, severity: OpenPointSeverity, text: string) => points.push({ field: key, severity, text });
  const empty = (k: FieldKey) => fields[k].values.length === 0;

  if (empty('businessName')) add('businessName', 'pflicht', 'Betriebsname eintragen.');
  if (empty('phones') && empty('emails')) add('phones', 'pflicht', 'Mindestens einen Kontaktweg (Telefon oder E-Mail) eintragen.');
  if (empty('handoverTarget')) add('handoverTarget', 'pflicht', 'Festlegen, an wen der Assistent übergibt (Name und Rückrufnummer oder E-Mail im Betrieb).');
  if (!empty('greeting') && !AI_DISCLOSURE.test(fields.greeting.values[0])) {
    add('greeting', 'pflicht', 'Die Begrüßung muss erkennbar machen, dass ein KI-Assistent spricht.');
  }

  if (empty('openingHours')) add('openingHours', 'empfohlen', 'Öffnungszeiten eintragen – auf der Website nicht gefunden.');
  if (empty('trade')) add('trade', 'empfohlen', 'Gewerk eintragen.');
  if (empty('services')) add('services', 'empfohlen', 'Leistungen eintragen, damit der Assistent Anfragen einordnen kann.');
  if (empty('serviceArea')) add('serviceArea', 'empfohlen', 'Einzugsgebiet eintragen.');
  if (empty('greeting')) add('greeting', 'empfohlen', 'Die Begrüßung entsteht, sobald der Betriebsname feststeht.');

  const review: Partial<Record<FieldKey, string>> = {
    businessName: 'Betriebsname wurde aus Titel/Überschrift gelesen – bitte bestätigen.',
    trade: 'Mehrere Gewerke erkannt – bitte bestätigen oder kürzen.',
    services: 'Leistungen wurden aus Überschriften gelesen – bitte prüfen.',
    openingHours: 'Uhrzeiten ohne Hinweis „Öffnungszeiten“ gefunden – bitte bestätigen.',
    phones: 'Mehrere Telefonnummern gefunden – bitte die Rückrufnummer für Übergaben festlegen.',
    emails: 'Mehrere E-Mail-Adressen gefunden – bitte die richtige festlegen.',
    serviceArea: 'Einzugsgebiet aus dem Seitentext abgeleitet – bitte prüfen und ggf. kürzen.',
  };
  for (const key of FIELD_KEYS) {
    const text = review[key];
    if (text && fields[key].needsReview && fields[key].source === 'website') add(key, 'pruefen', text);
  }
  if (discarded.length) add(null, 'pruefen', 'Einzelne Website-Inhalte wurden verworfen – siehe Hinweise.');
  return points;
}

// ── Freigabe (nur Zustand, keine Speicherung) ───────────────────────────

export type ApprovalState =
  | { status: 'entwurf' }
  | { status: 'freigegeben'; approvedAt: string; fingerprint: string };

export const DRAFT_STATUS_LABEL = 'Entwurf – Freigabe durch Inhaber erforderlich';

/** Stabiler Fingerabdruck der Inhalte; jede Änderung nach der Freigabe macht sie ungültig. */
export function draftFingerprint(draft: ReceptionistDraft): string {
  return JSON.stringify([
    draft.provenance.sourceUrl,
    ...FIELD_KEYS.map((k) => [k, draft.fields[k].source, draft.fields[k].values]),
  ]);
}

export function approvalBlockers(draft: ReceptionistDraft): OpenPoint[] {
  return draft.openPoints.filter((p) => p.severity === 'pflicht');
}

export function approveDraft(
  draft: ReceptionistDraft,
  opts: { reviewed: boolean; now: Date },
): { ok: true; state: ApprovalState } | { ok: false; reasons: string[] } {
  const reasons = approvalBlockers(draft).map((p) => p.text);
  if (!opts.reviewed) reasons.push('Bitte bestätigen, dass Sie alle Angaben geprüft haben.');
  if (reasons.length) return { ok: false, reasons };
  return { ok: true, state: { status: 'freigegeben', approvedAt: opts.now.toISOString(), fingerprint: draftFingerprint(draft) } };
}

/** Freigabe gilt nur für genau den freigegebenen Inhalt. */
export function currentApproval(state: ApprovalState, draft: ReceptionistDraft): ApprovalState {
  if (state.status === 'freigegeben' && state.fingerprint !== draftFingerprint(draft)) return { status: 'entwurf' };
  return state;
}
