// KI-Sekretariat aus der Website — reine Ableitungslogik.
//
// Eingabe ist die Antwort des bestehenden Endpunkts `siteos/discover`
// (serverseitiger Abruf mit Mandanten- und Hostprüfung). Hier wird nichts
// abgerufen und nichts gespeichert: Aus öffentlichem Website-Text entsteht
// ein **Entwurf**, jedes Feld mit Herkunftsnachweis (Seite, Zeitpunkt,
// Verfahren, Auszug). Unbekanntes bleibt `unknown` mit Grund — es wird nichts
// Plausibles erfunden. Aktiv wird der Assistent erst nach Freigabe durch den
// Inhaber (`secretariatBot.ts`).
//
// Abhängigkeitsfrei, damit derselbe Code später auch in einer Edge Function
// laufen kann.

export const SECRETARIAT_DRAFT_VERSION = 'sekretariat-2026.11.1';

/** Antwortform von `siteos/discover` (siehe supabase/functions/siteos/handlers/discover.ts). */
export interface WebsiteDiscovery {
  source_url: string;
  title: string | null;
  description: string | null;
  h1: string | null;
  headings?: string[];
  services: string[];
  visible_text: string;
  fetched_at?: string;
}

export type DraftMethod =
  | 'title'
  | 'h1'
  | 'meta-description'
  | 'phone-pattern'
  | 'email-pattern'
  | 'hours-pattern'
  | 'address-pattern'
  | 'discovery-services'
  | 'question-heading'
  | 'owner-edit';

export interface FieldSource {
  url: string;
  fetchedAt: string;
  method: DraftMethod;
  /** Kurzer Auszug aus der Quelle, höchstens `EXCERPT_MAX` Zeichen. */
  excerpt: string;
}

export type DraftField<T> =
  | { status: 'known'; value: T; confidence: 'high' | 'medium' | 'low'; source: FieldSource; derivedFrom?: FieldSource }
  | { status: 'unknown'; value: null; reason: string };

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface SecretariatFields {
  businessName: DraftField<string>;
  phone: DraftField<string>;
  email: DraftField<string>;
  address: DraftField<string>;
  openingHours: DraftField<string>;
  services: DraftField<string[]>;
  faq: DraftField<FaqEntry[]>;
}

export type FieldKey = keyof SecretariatFields;

export interface SecretariatDraft {
  version: string;
  sourceUrl: string;
  fetchedAt: string;
  fields: SecretariatFields;
}

export const FIELD_LABELS: Record<FieldKey, string> = {
  businessName: 'Name des Betriebs',
  phone: 'Telefon',
  email: 'E-Mail',
  address: 'Adresse',
  openingHours: 'Öffnungszeiten',
  services: 'Leistungen',
  faq: 'Häufige Fragen',
};

export const METHOD_LABELS: Record<DraftMethod, string> = {
  title: 'Seitentitel',
  h1: 'Hauptüberschrift',
  'meta-description': 'Seitenbeschreibung',
  'phone-pattern': 'Telefonnummer im Text',
  'email-pattern': 'E-Mail-Adresse im Text',
  'hours-pattern': 'Öffnungszeiten im Text',
  'address-pattern': 'Adresse im Text',
  'discovery-services': 'Überschriften der Website',
  'question-heading': 'Frage-Überschrift',
  'owner-edit': 'vom Inhaber bearbeitet',
};

export const EXCERPT_MAX = 160;
export const VALUE_MAX = 200;
export const MAX_SERVICES = 8;
export const MAX_FAQ = 5;
const ANSWER_MAX = 280;

// ─────────────────────────────────────────────────────────────────────
// Bereinigung
// ─────────────────────────────────────────────────────────────────────

/**
 * Website-Text landet später im Prompt des Assistenten. Deshalb einzeilig,
 * ohne Steuerzeichen, spitze und eckige Klammern (die Abschnittsmarken des
 * Prompts wie `[Neue Nachricht]` lassen sich so nicht einschleusen) und mit
 * harter Längengrenze. Inhaltlich bleibt der Text eine Angabe der Website —
 * der Prompt kennzeichnet ihn als Daten, nicht als Anweisung.
 */
export function cleanValue(input: string, max = VALUE_MAX): string {
  return input
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, ' ')
    .replace(/[<>[\]{}`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

function excerptAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + length + 40);
  return cleanValue(`${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`, EXCERPT_MAX);
}

function unknown(reason: string): { status: 'unknown'; value: null; reason: string } {
  return { status: 'unknown', value: null, reason };
}

// ─────────────────────────────────────────────────────────────────────
// Einzelne Felder
// ─────────────────────────────────────────────────────────────────────

/**
 * Trenner, mit denen Seitentitel Name und Zusatz verbinden. Genau ein Leerzeichen
 * je Seite statt `\s+`: Das frühere `\s+[|–—·•:]\s+` lief auf langen Leerzeichenfolgen
 * im Fremdtitel quadratisch (polynomielles ReDoS). Überzählige Leerzeichen entfernt
 * danach `cleanValue`.
 */
const TITLE_SEPARATORS = /\s[|–—·•:-]\s/;
const GENERIC_TITLES = /^(startseite|home|willkommen|herzlich willkommen|index|homepage)$/i;
const LEGAL_FORM_RE = /\b(GmbH|gGmbH|UG|AG|KG|OHG|GbR|e\.\s?K\.|e\.\s?Kfr\.|Inh\.|& Co\.?)(?=\s|$|,)/;

function deriveBusinessName(d: WebsiteDiscovery, src: (m: DraftMethod, e: string) => FieldSource): DraftField<string> {
  const fromTitle = (d.title ?? '').split(TITLE_SEPARATORS).map((p) => cleanValue(p, 120)).filter((p) => p && !GENERIC_TITLES.test(p));
  if (fromTitle.length > 0) {
    // Teil mit Rechtsform ist der Name („Bad und Heizung | Muster GmbH“); sonst der erste Teil,
    // weil Titel meist „Name | Zusatz“ lauten — dann nur geringe Sicherheit.
    const withLegalForm = fromTitle.find((p) => LEGAL_FORM_RE.test(p));
    const name = withLegalForm ?? fromTitle[0];
    if (name.length >= 2) {
      return { status: 'known', value: name, confidence: withLegalForm ? 'medium' : 'low', source: src('title', d.title ?? '') };
    }
  }
  const h1 = cleanValue(d.h1 ?? '', 120);
  if (h1.length >= 2 && !GENERIC_TITLES.test(h1)) {
    return { status: 'known', value: h1, confidence: 'low', source: src('h1', h1) };
  }
  return unknown('Kein Seitentitel und keine Hauptüberschrift gefunden.');
}

/**
 * Deutsche/österreichische Rufnummern im Fließtext: +49/+43/0049/0, mindestens
 * 7 Ziffern. Bevorzugt Nummern, vor denen „Tel“, „Telefon“ oder „Fon“ steht.
 */
const PHONE_RE = /(?:\+|00)(?:49|43|41)[\s/.\-()]*\d[\d\s/.\-()]{5,18}\d|\b0\d{2,5}[\s/.\-()]*\d[\d\s/.\-]{3,14}\d/g;
const PHONE_LABEL_RE = /(tel(?:efon)?\.?|fon|phone|anruf|ruf(?:en sie)? an)\s*:?\s*$/i;
const FAX_LABEL_RE = /fax\s*:?\s*$/i;

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  const count = digits.replace(/\D/g, '').length;
  if (count < 7 || count > 15) return null;
  // Datumsangaben und Postleitzahlbereiche schließen wir über die Länge und den Präfix aus.
  if (!/^(\+|00|0)/.test(digits)) return null;
  return cleanValue(raw, 40);
}

function derivePhone(d: WebsiteDiscovery, src: (m: DraftMethod, e: string) => FieldSource): DraftField<string> {
  const text = d.visible_text ?? '';
  let best: { value: string; index: number; raw: string; labelled: boolean } | null = null;
  for (const m of text.matchAll(PHONE_RE)) {
    const index = m.index ?? 0;
    const before = text.slice(Math.max(0, index - 20), index);
    if (FAX_LABEL_RE.test(before)) continue;
    const value = normalizePhone(m[0]);
    if (!value) continue;
    const labelled = PHONE_LABEL_RE.test(before);
    if (!best || (labelled && !best.labelled)) best = { value, index, raw: m[0], labelled };
    if (labelled) break;
  }
  if (!best) return unknown('Keine Telefonnummer im Website-Text gefunden.');
  return {
    status: 'known', value: best.value, confidence: best.labelled ? 'high' : 'medium',
    source: src('phone-pattern', excerptAround(text, best.index, best.raw.length)),
  };
}

// Linear statt Regex über den ganzen Fremdtext: Das frühere Muster
// `[a-z0-9.-]+\.[a-z]{2,24}` lief auf Eingaben wie `a@a.a.a.…` quadratisch
// (polynomielles ReDoS, CodeQL-Befund in #2435). Jetzt wird nur rund um jedes
// `@` ein begrenzter Kandidat ausgeschnitten und verankert geprüft.
const EMAIL_LOCAL_CHARS = /[a-z0-9._%+-]/i;
const EMAIL_DOMAIN_CHARS = /[a-z0-9.-]/i;
const EMAIL_LOCAL_MAX = 64;
const EMAIL_DOMAIN_MAX = 253;
const EMAIL_EXACT_RE = /^[a-z0-9._%+-]{1,64}@(?:[a-z0-9-]{1,63}\.){1,10}[a-z]{2,24}$/i;
const NOREPLY_RE = /^(no-?reply|noreply|donotreply|webmaster|wordpress|example)@/i;
const ASSET_SUFFIX_RE = /\.(png|jpe?g|gif|svg|webp)$/i;

/** Findet E-Mail-Kandidaten in linearer Zeit (je Zeichen höchstens konstant oft besucht). */
export function findEmails(text: string): Array<{ value: string; index: number }> {
  const out: Array<{ value: string; index: number }> = [];
  let from = 0;
  for (let at = text.indexOf('@'); at >= 0; at = text.indexOf('@', at + 1)) {
    let start = at;
    const minStart = Math.max(from, at - EMAIL_LOCAL_MAX);
    while (start > minStart && EMAIL_LOCAL_CHARS.test(text[start - 1])) start--;
    let end = at + 1;
    const maxEnd = Math.min(text.length, at + 1 + EMAIL_DOMAIN_MAX);
    while (end < maxEnd && EMAIL_DOMAIN_CHARS.test(text[end])) end++;
    // Satzzeichen am Ende („info@x.de.“) gehört nicht zur Adresse.
    while (end > at + 1 && (text[end - 1] === '.' || text[end - 1] === '-')) end--;
    const candidate = text.slice(start, end);
    // Steht direkt davor ein Buchstabe außerhalb ASCII („Büro@…“), wäre der Kandidat
    // nur ein Wortrest („ro@…“) – dann lieber nichts als eine falsche Adresse.
    const cutWord = start > 0 && /\p{L}/u.test(text[start - 1]);
    if (!cutWord && start < at && end > at + 1 && EMAIL_EXACT_RE.test(candidate)) {
      out.push({ value: candidate, index: start });
      from = end;
    }
  }
  return out;
}

/**
 * Platzhalter-Domain (RFC 2606): nur `example.com` selbst und echte Subdomains.
 * Vorher `value.endsWith('example.com')` – das verwarf auch echte Adressen wie
 * `info@meinexample.com` (CodeQL js/incomplete-url-substring-sanitization, Alert #275).
 * Die Domain wird hinter dem letzten `@` genommen und normalisiert (Groß-/Kleinschreibung,
 * abschließender Punkt).
 */
export function isPlaceholderEmailDomain(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  const domain = email.slice(at + 1).trim().toLowerCase().replace(/\.$/, '');
  return domain === 'example.com' || domain.endsWith('.example.com');
}

function deriveEmail(d: WebsiteDiscovery, src: (m: DraftMethod, e: string) => FieldSource): DraftField<string> {
  const text = d.visible_text ?? '';
  for (const m of findEmails(text)) {
    const value = m.value.toLowerCase();
    if (NOREPLY_RE.test(value) || ASSET_SUFFIX_RE.test(value) || isPlaceholderEmailDomain(value)) continue;
    return { status: 'known', value, confidence: 'high', source: src('email-pattern', excerptAround(text, m.index, m.value.length)) };
  }
  return unknown('Keine E-Mail-Adresse im Website-Text gefunden.');
}

const DAY = '(?:Mo(?:ntag)?|Di(?:enstag)?|Mi(?:ttwoch)?|Do(?:nnerstag)?|Fr(?:eitag)?|Sa(?:mstag)?|So(?:nntag)?)\\.?';
const TIME = '\\d{1,2}(?:[:.]\\d{2})?';
// Kein `\s*X?\s*` und kein `\s*` am Segmentende vor einem `\s*` im nächsten Schritt:
// Solche Folgen können dieselben Leerzeichen auf viele Arten aufteilen und liefen
// quadratisch (polynomielles ReDoS). Optionale Teile tragen ihr Leerzeichen selbst.
const RANGE = '\\s*(?:[-–—]|bis)\\s*';
const UHR = '(?:\\s*Uhr)?';
const HOURS_SEGMENT = `${DAY}(?:${RANGE}${DAY})?\\s*(?::\\s*)?${TIME}${RANGE}${TIME}${UHR}`;
const HOURS_RE = new RegExp(`${HOURS_SEGMENT}(?:\\s*(?:(?:[,;/|]|und)\\s*)?(?:${HOURS_SEGMENT}|${TIME}${RANGE}${TIME}${UHR}))*`, 'gi');

function deriveOpeningHours(d: WebsiteDiscovery, src: (m: DraftMethod, e: string) => FieldSource): DraftField<string> {
  const text = d.visible_text ?? '';
  const matches = [...text.matchAll(HOURS_RE)];
  if (matches.length === 0) return unknown('Keine Öffnungszeiten im Website-Text gefunden.');
  // Längster Treffer = vollständigste Angabe.
  const best = matches.reduce((a, b) => (b[0].length > a[0].length ? b : a));
  const labelled = /(öffnungszeit|geöffnet|erreichbar|bürozeit|sprechzeit)/i.test(text.slice(Math.max(0, (best.index ?? 0) - 40), best.index ?? 0));
  return {
    status: 'known', value: cleanValue(best[0], 160), confidence: labelled ? 'high' : 'medium',
    source: src('hours-pattern', excerptAround(text, best.index ?? 0, best[0].length)),
  };
}

// Begrenzte Quantoren ({1,40}, {0,3}): kein Backtracking über beliebig lange Fremdtext-Wörter.
const ADDRESS_RE = /([A-ZÄÖÜ][a-zäöüß.-]{1,40}(?:\s[A-ZÄÖÜa-zäöüß.-]{1,40}){0,3}(?:straße|strasse|str\.|weg|gasse|platz|allee|ring|damm|ufer|chaussee)\s?\d{1,4}\s?[a-z]?)\s{0,3},?\s{0,3}((?:A-|D-)?\d{4,5})\s{1,3}([A-ZÄÖÜ][a-zäöüß-]{1,40}(?:\s(?:am|an der|im|bei)?\s?[A-ZÄÖÜ][a-zäöüß-]{1,40})?)/;

function deriveAddress(d: WebsiteDiscovery, src: (m: DraftMethod, e: string) => FieldSource): DraftField<string> {
  const text = d.visible_text ?? '';
  const m = text.match(ADDRESS_RE);
  if (!m) return unknown('Keine Postanschrift im Website-Text erkannt.');
  const value = cleanValue(`${m[1]}, ${m[2]} ${m[3]}`, 120);
  return { status: 'known', value, confidence: 'medium', source: src('address-pattern', excerptAround(text, m.index ?? 0, m[0].length)) };
}

/** Überschriften, die keine Leistung beschreiben. */
const NON_SERVICE_RE = /^(kontakt|impressum|datenschutz|über uns|ueber uns|team|aktuelles|news|blog|karriere|jobs|referenzen|bewertungen|faq|häufige fragen|anfahrt|cookie|startseite|home|menü|menu|navigation|login|warenkorb|newsletter|willkommen)/i;

function deriveServices(d: WebsiteDiscovery, src: (m: DraftMethod, e: string) => FieldSource): DraftField<string[]> {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of d.services ?? []) {
    const value = cleanValue(raw, 80);
    const key = value.toLowerCase();
    if (value.length < 3 || value.endsWith('?') || NON_SERVICE_RE.test(value) || seen.has(key)) continue;
    seen.add(key);
    items.push(value);
    if (items.length >= MAX_SERVICES) break;
  }
  if (items.length === 0) return unknown('Keine Leistungen in den Überschriften erkannt.');
  return { status: 'known', value: items, confidence: 'low', source: src('discovery-services', items.slice(0, 3).join(' · ')) };
}

function deriveFaq(d: WebsiteDiscovery, src: (m: DraftMethod, e: string) => FieldSource): DraftField<FaqEntry[]> {
  const text = d.visible_text ?? '';
  const headings = (d.headings ?? []).map((h) => cleanValue(h, 140)).filter(Boolean);
  const entries: FaqEntry[] = [];
  for (const question of headings) {
    if (!question.endsWith('?')) continue;
    const at = text.indexOf(question);
    if (at < 0) continue;
    let rest = text.slice(at + question.length);
    // Antwort endet an der nächsten bekannten Überschrift.
    for (const other of headings) {
      if (other === question) continue;
      const cut = rest.indexOf(other);
      if (cut > 0) rest = rest.slice(0, cut);
    }
    const answer = cleanValue(rest, ANSWER_MAX);
    if (answer.length < 10) continue;
    entries.push({ question, answer });
    if (entries.length >= MAX_FAQ) break;
  }
  if (entries.length === 0) return unknown('Keine Fragen mit Antwort auf der Website erkannt.');
  return { status: 'known', value: entries, confidence: 'low', source: src('question-heading', entries[0].question) };
}

// ─────────────────────────────────────────────────────────────────────
// Entwurf
// ─────────────────────────────────────────────────────────────────────

export function deriveSecretariatDraft(discovery: WebsiteDiscovery, now: () => string = () => new Date().toISOString()): SecretariatDraft {
  const fetchedAt = discovery.fetched_at ?? now();
  const sourceUrl = discovery.source_url;
  const src = (method: DraftMethod, excerpt: string): FieldSource => ({
    url: sourceUrl, fetchedAt, method, excerpt: cleanValue(excerpt, EXCERPT_MAX),
  });
  return {
    version: SECRETARIAT_DRAFT_VERSION,
    sourceUrl,
    fetchedAt,
    fields: {
      businessName: deriveBusinessName(discovery, src),
      phone: derivePhone(discovery, src),
      email: deriveEmail(discovery, src),
      address: deriveAddress(discovery, src),
      openingHours: deriveOpeningHours(discovery, src),
      services: deriveServices(discovery, src),
      faq: deriveFaq(discovery, src),
    },
  };
}

/**
 * Änderung durch den Inhaber. Der Wert wird bereinigt; der ursprüngliche
 * Herkunftsnachweis bleibt als `derivedFrom` erhalten (Prüfpfad).
 * Ein leerer Wert setzt das Feld auf `unknown`.
 */
export function applyOwnerEdit<K extends FieldKey>(
  draft: SecretariatDraft,
  key: K,
  value: SecretariatFields[K] extends DraftField<infer T> ? T : never,
  at: string,
): SecretariatDraft {
  const prev = draft.fields[key] as DraftField<unknown>;
  const cleaned = cleanFieldValue(value as unknown);
  const isEmpty = cleaned === null;
  const source: FieldSource = { url: draft.sourceUrl, fetchedAt: at, method: 'owner-edit', excerpt: '' };
  const next: DraftField<unknown> = isEmpty
    ? unknown('Vom Inhaber geleert.')
    : {
        status: 'known', value: cleaned, confidence: 'high', source,
        ...(prev.status === 'known' ? { derivedFrom: prev.source.method === 'owner-edit' ? prev.derivedFrom : prev.source } : {}),
      };
  return { ...draft, fields: { ...draft.fields, [key]: next } as SecretariatFields };
}

function cleanFieldValue(value: unknown): unknown {
  if (typeof value === 'string') {
    const v = cleanValue(value);
    return v ? v : null;
  }
  if (Array.isArray(value)) {
    const items = value
      .map((item) => {
        if (typeof item === 'string') return cleanValue(item, 80);
        if (item && typeof item === 'object' && 'question' in item && 'answer' in item) {
          const q = cleanValue(String((item as FaqEntry).question), 140);
          const a = cleanValue(String((item as FaqEntry).answer), ANSWER_MAX);
          return q && a ? { question: q, answer: a } : null;
        }
        return null;
      })
      .filter((item) => item !== null && item !== '');
    return items.length > 0 ? items : null;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Formular-Hilfen (eine Zeile je Eintrag)
// ─────────────────────────────────────────────────────────────────────

export function linesToList(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

/** „Frage? Antwort“ je Zeile; Zeilen ohne Fragezeichen oder ohne Antwort entfallen. */
export function linesToFaq(text: string): FaqEntry[] {
  const out: FaqEntry[] = [];
  for (const line of linesToList(text)) {
    const q = line.indexOf('?');
    if (q < 1) continue;
    const question = line.slice(0, q + 1).trim();
    const answer = line.slice(q + 1).trim();
    if (answer) out.push({ question, answer });
  }
  return out;
}

export function faqToLines(faq: FaqEntry[] | null): string {
  return (faq ?? []).map((e) => `${e.question} ${e.answer}`).join('\n');
}

/** Felder, die für die Freigabe fehlen. Leere Liste = freigabefähig. */
export function approvalBlockers(draft: SecretariatDraft): string[] {
  const out: string[] = [];
  if (draft.fields.businessName.status !== 'known') out.push('Name des Betriebs fehlt.');
  if (draft.fields.phone.status !== 'known' && draft.fields.email.status !== 'known') {
    out.push('Mindestens Telefon oder E-Mail angeben, damit Anfragende den Betrieb erreichen.');
  }
  return out;
}

/** Hinweise, die die Freigabe nicht blockieren, aber die Qualität mindern. */
export function draftHints(draft: SecretariatDraft): string[] {
  const out: string[] = [];
  const f = draft.fields;
  if (f.services.status !== 'known') out.push('Ohne Leistungen kann der Assistent Anfragen schlechter einordnen.');
  if (f.openingHours.status !== 'known') out.push('Ohne Öffnungszeiten nennt der Assistent keine Erreichbarkeit.');
  for (const key of Object.keys(f) as FieldKey[]) {
    const field = f[key];
    if (field.status === 'known' && field.confidence === 'low') {
      out.push(`${FIELD_LABELS[key]}: automatisch erkannt, bitte prüfen.`);
    }
  }
  return out;
}
