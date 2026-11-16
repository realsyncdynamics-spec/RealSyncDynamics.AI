// Datenklassifikation für Ziele (Origins) und Inhalte (Text).
//
// Zwei Quellen, eine Regel: Die Klasse eines Origins kommt aus der
// Mandanten-Richtlinie (deklariert). Die Inhaltserkennung ist eine Heuristik
// und darf NUR verschärfen, nie entschärfen. Was sie übersieht (Namen,
// Gesundheitsdaten, Freitext), deckt die deklarierte Klasse ab — deshalb ist
// ein nicht gelisteter Origin `unclassified` und nicht `public`.

import type { DataClass, GuardianPolicy, OriginRule, TargetClass } from './types.ts';

const RANK: Record<TargetClass, number> = {
  public: 0,
  internal: 1,
  unclassified: 2,
  confidential: 3,
  personal: 4,
};

export function stricterClass(a: TargetClass, b: TargetClass): TargetClass {
  return RANK[a] >= RANK[b] ? a : b;
}

export function isPublic(c: TargetClass): boolean {
  return c === 'public';
}

// ─── Origins ─────────────────────────────────────────────────────────────────

function matchesOrigin(rule: string, origin: string): boolean {
  const r = rule.trim().toLowerCase().replace(/\/$/, '');
  const o = origin.toLowerCase();
  if (!r.includes('*')) return r === o;
  const m = r.match(/^(https?):\/\/\*\.([a-z0-9.-]+)(:\d+)?$/);
  if (!m) return false; // ungültiges Muster passt auf nichts
  let url: URL;
  try { url = new URL(o); } catch { return false; }
  if (url.protocol !== `${m[1]}:`) return false;
  if ((m[3] ?? '') !== (url.port ? `:${url.port}` : '')) return false;
  return url.hostname.endsWith(`.${m[2]}`);
}

/** Strengste passende Regel gewinnt; keine Regel ⇒ `unclassified`. */
export function classifyOrigin(policy: GuardianPolicy, origin: string | null): TargetClass {
  if (!origin) return 'unclassified';
  const hits: OriginRule[] = policy.origins.filter((r) => matchesOrigin(r.origin, origin));
  if (hits.length === 0) return 'unclassified';
  return hits.map((h) => h.data_class as TargetClass).reduce(stricterClass);
}

export function isOriginBlocked(policy: GuardianPolicy, origin: string): boolean {
  return (policy.blocked_origins ?? []).some((rule) => matchesOrigin(rule, origin));
}

// ─── Inhalte ─────────────────────────────────────────────────────────────────

export type FindingKind = 'email' | 'phone' | 'iban' | 'payment_card' | 'secret';

export interface ContentClassification {
  data_class: DataClass;
  findings: Array<{ kind: FindingKind; count: number }>;
}

// Alle Wiederholungen begrenzt: Seitentext ist fremde Eingabe (bis 50.000
// Zeichen); unbegrenzte, überlappende Muster laufen quadratisch (CodeQL).
const EMAIL = /[A-Z0-9._%+-]{1,64}@[A-Z0-9-]{1,63}(?:\.[A-Z0-9-]{1,63}){0,8}\.[A-Z]{2,24}/gi;
// Telefonnummern: +49…, 0049…, 0… mit 8–17 Ziffern; je Schritt genau eine Ziffer.
const PHONE = /(?:\+|00)\d{1,3}(?:[\s/()-]{0,2}\d){6,14}|\b0\d(?:[\s/-]?\d){6,13}/g;
const IBAN = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b/g;
const CARD = /\b(?:\d[ -]?){13,19}\b/g;
const SECRETS: RegExp[] = [
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,  // JWT
  /\bsk-[A-Za-z0-9_-]{16,}\b/,                                          // OpenAI/Anthropic-Stil
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,                                     // GitHub
  /\bAKIA[0-9A-Z]{16}\b/,                                               // AWS
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/,                                   // Slack
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:password|passwort|kennwort|pwd|secret|api[_-]?key|token)\s*[:=]\s*\S{4,}/i,
];

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

function luhnOk(digits: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return digits.length >= 13 && sum % 10 === 0;
}

function ibanOk(raw: string): boolean {
  const s = raw.replace(/\s/g, '').toUpperCase();
  if (s.length < 15 || s.length > 34) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const code = ch.charCodeAt(0);
    const val = code >= 65 ? String(code - 55) : ch;
    for (const d of val) rem = (rem * 10 + (d.charCodeAt(0) - 48)) % 97;
  }
  return rem === 1;
}

/**
 * Text → Klasse. `baseline` ist die deklarierte Klasse der Quelle
 * (z. B. des Origins); das Ergebnis ist nie milder als die Baseline.
 */
export function classifyText(text: string, baseline: DataClass = 'public'): ContentClassification {
  const findings: ContentClassification['findings'] = [];
  const add = (kind: FindingKind, count: number) => { if (count > 0) findings.push({ kind, count }); };

  add('email', (text.match(EMAIL) ?? []).length);
  add('iban', (text.match(IBAN) ?? []).filter(ibanOk).length);
  add('payment_card', (text.match(CARD) ?? []).map(digitsOnly).filter(luhnOk).length);
  // Telefon erst nach IBAN/Karte, damit lange Ziffernfolgen nicht doppelt zählen.
  const cardDigits = new Set((text.match(CARD) ?? []).map(digitsOnly));
  add('phone', (text.match(PHONE) ?? []).filter((p) => !cardDigits.has(digitsOnly(p)) && digitsOnly(p).length >= 8).length);
  add('secret', SECRETS.filter((re) => re.test(text)).length);

  let cls: TargetClass = baseline;
  for (const f of findings) {
    cls = stricterClass(cls, f.kind === 'secret' ? 'confidential' : 'personal');
  }
  return { data_class: cls === 'unclassified' ? 'confidential' : cls, findings };
}

export function hasFinding(c: ContentClassification, kind: FindingKind): boolean {
  return c.findings.some((f) => f.kind === kind);
}
