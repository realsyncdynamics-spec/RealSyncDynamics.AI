/**
 * Antwortlogik der Landing-Demo, portiert von main@2ecabb94
 * (`src/lib/company-voice`, Preise aus `shared/pricing.ts`).
 * Dieser Branch hat keinen Vite-Build. Beträge sind die Listenpreise
 * der Self-Service-Pläne zum Zeitpunkt des Ports.
 */

export const DISCLAIMER =
  'Keine Rechtsberatung und keine Konformitätszusage. Antworten nur aus freigegebenen Unternehmensinfos.';

export const CONTACT_PATH = '/kontakt';
export const PRICING_HREF = '/preise';
export const WEBDESIGN_HREF = '/contact-sales?intent=webdesign';
export const WEBDESIGN_LINK_LABEL = 'Individuelles Webdesign anfragen';

const PLANS = [
  { key: 'free_audit', name: 'Free Audit', monthlyEur: 0, yearlyEur: null },
  { key: 'starter', name: 'Starter', monthlyEur: 79, yearlyEur: 790 },
  { key: 'growth', name: 'Growth', monthlyEur: 249, yearlyEur: 2490 },
  { key: 'agency', name: 'Agency', monthlyEur: 699, yearlyEur: 6900 },
  { key: 'enterprise', name: 'Enterprise', monthlyEur: 1498, yearlyEur: 14980 },
];

export function formatPriceEur(value) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function monthlyPriceText(plan) {
  return `${formatPriceEur(plan.monthlyEur)}/Monat`;
}

export function curatedFacts() {
  const starter = PLANS.find((plan) => plan.key === 'starter');
  const free = PLANS.find((plan) => plan.key === 'free_audit');
  return [
    { id: 'company.founder', text: 'Solo-Founder und Inhaber ist Dominik Steiner.', origin: 'curated' },
    { id: 'company.legalForm', text: 'Rechtsform: Einzelunternehmen, nicht im Handelsregister eingetragen.', origin: 'curated' },
    { id: 'company.tradeRegisteredOn', text: 'Gewerbe angemeldet am 13.05.2026.', origin: 'curated' },
    { id: 'company.seat', text: 'Sitz: Neuhaus am Rennweg, Thüringen, Deutschland.', origin: 'curated' },
    {
      id: 'product.summary',
      text: 'RealSyncDynamics.AI ist eine SaaS-Plattform für DSGVO- und EU-AI-Act-Kontrollen: Governance OS, verkettete Nachweise (Evidence) und AI Agents für regulierte Unternehmen. Agenten- und Bot-Funktionen sind teilweise Preview. Telefonie ist Coming Soon und nicht Teil dieser Demo.',
      origin: 'curated',
    },
    { id: 'product.boundaries', text: DISCLAIMER, origin: 'curated' },
    {
      id: 'pricing.selfService',
      text: `Self-Service startet mit ${starter.name}: ${monthlyPriceText(starter)} laut Preisliste.`,
      origin: 'curated',
    },
    {
      id: 'pricing.freeAudit',
      text: `Kostenloser Audit-Tarif: ${free.name} kostet ${formatPriceEur(0)}.`,
      origin: 'curated',
    },
    {
      id: 'service.webdesign',
      text: 'Webdesign ist eine Erweiterung als individuelle Leistung. Einen Preis nennt diese Demo nicht; er steht nicht in der Software-Preisliste.',
      origin: 'curated',
    },
  ];
}

const GAP = 'Dazu liegt in den freigegebenen Unternehmensinfos nichts vor.';

export function normalizeQuestion(input) {
  return String(input ?? '')
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .replace(/[?!.,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function has(text, words) {
  return words.some((word) => text.includes(word));
}

function fact(facts, id) {
  return facts.find((item) => item.id === id);
}

function quotePlan(plan) {
  if (plan.monthlyEur === 0) return `${plan.name} kostet ${formatPriceEur(0)}.`;
  return `${plan.name}: ${monthlyPriceText(plan)} laut Preisliste.`;
}

function unknownAmounts(text, named) {
  const allowed = new Set();
  for (const plan of named ? [named] : PLANS) {
    allowed.add(plan.monthlyEur);
    if (plan.yearlyEur != null) allowed.add(plan.yearlyEur);
  }
  for (const match of text.matchAll(/\d{1,6}/g)) {
    const amount = Number(match[0]);
    if (amount >= 1990 && amount <= 2100) continue;
    if (amount < 10) continue;
    if (!allowed.has(amount)) return true;
  }
  return false;
}

function priceAnswer(text, context) {
  const named = [...PLANS].sort((a, b) => b.name.length - a.name.length).find((plan) => text.includes(normalizeQuestion(plan.name)));
  const starter = PLANS.find((plan) => plan.key === 'starter');
  const free = PLANS.find((plan) => plan.key === 'free_audit');
  const sentences = [];
  if (named) sentences.push(quotePlan(named));
  else {
    sentences.push(`Self-Service startet mit ${quotePlan(starter)}`);
    sentences.push(`Kostenloser Audit-Tarif: ${quotePlan(free)}`);
  }
  if (unknownAmounts(text, named || null)) {
    sentences.push('Andere Beträge stehen nicht in der Preisliste und gelten hier nicht.');
  }
  const beta = context.publicBeta && context.betaEndsLabel
    ? ` Auf dieser Seite gilt die offene Beta: kostenlos testen bis ${context.betaEndsLabel}. Der Listenpreis bleibt der genannte Betrag.`
    : '';
  return {
    covered: true,
    text: `${sentences.join(' ')}${beta}`,
    link: { href: PRICING_HREF, label: 'Preise' },
  };
}

export function answerCompanyQuestion(question, facts = curatedFacts(), context = {}) {
  const text = normalizeQuestion(question);
  if (!text) return { covered: false, text: 'Bitte eine Frage eintippen oder einsprechen.', link: { href: CONTACT_PATH, label: 'Kontakt' } };

  if (has(text, ['telefon', 'anruf', 'rufnummer', 'hotline', 'anrufen', 'telefonie'])) {
    return {
      covered: false,
      text: 'Diese Demo nutzt keine Telefonie und nennt keine Telefonnummer. Schreiben Sie uns über die Kontaktseite.',
      link: { href: CONTACT_PATH, label: 'Kontakt' },
    };
  }
  if (has(text, ['rechtsberatung', 'anwalt', 'konformitaet', 'konform', 'garantie', 'garantiert', 'haftung'])) {
    return { covered: true, text: DISCLAIMER, link: { href: CONTACT_PATH, label: 'Kontakt' } };
  }
  if (has(text, ['webdesign', 'website bauen', 'landingpage erstellen'])) {
    return {
      covered: true,
      text: fact(facts, 'service.webdesign')?.text ?? GAP,
      link: { href: WEBDESIGN_HREF, label: WEBDESIGN_LINK_LABEL },
    };
  }
  if (has(text, ['time manager', 'timemanager', 'second brain', 'secondbrain'])) {
    const note = fact(facts, 'timeManager.publicNote');
    if (note) return { covered: true, text: `${note.text} Das ist eine freigegebene Angabe aus dem Time Manager, kein privates Dokument.` };
    return { covered: false, text: 'Eine freigegebene Angabe aus dem Time Manager liegt nicht vor.', link: { href: CONTACT_PATH, label: 'Kontakt' } };
  }
  if (
    has(text, ['preis', 'kostet', 'kosten', 'tarif', 'monat', 'abo', 'starter', 'growth', 'agency', 'enterprise']) ||
    text.includes('€') ||
    /(?:^|\s)euro(?:\s|$)/.test(text)
  ) {
    return priceAnswer(text, context);
  }
  if (has(text, ['gruender', 'founder', 'inhaber', 'dominik', 'wer steckt', 'wer seid'])) {
    return { covered: true, text: [fact(facts, 'company.founder')?.text, fact(facts, 'company.legalForm')?.text].filter(Boolean).join(' ') };
  }
  if (has(text, ['sitz', 'standort', 'neuhaus', 'thueringen', 'wo sitzt', 'ansaessig'])) {
    return { covered: true, text: fact(facts, 'company.seat')?.text ?? GAP };
  }
  if (has(text, ['gewerbe', 'rechtsform', 'einzelunternehmen', 'handelsregister'])) {
    return { covered: true, text: [fact(facts, 'company.legalForm')?.text, fact(facts, 'company.tradeRegisteredOn')?.text].filter(Boolean).join(' ') };
  }
  if (has(text, ['produkt', 'was macht', 'was bietet', 'plattform', 'governance', 'dsgvo', 'ai act', 'eu ai', 'evidence', 'nachweis', 'agent', 'saas', 'realsync'])) {
    return { covered: true, text: fact(facts, 'product.summary')?.text ?? GAP };
  }
  return { covered: false, text: `${GAP} Schreiben Sie uns über die Kontaktseite.`, link: { href: CONTACT_PATH, label: 'Kontakt' } };
}

export function selectVoiceOutput(input) {
  if (input?.elevenLabsEnabled === true) return { engine: 'web-speech', elevenLabs: 'not-bundled' };
  return { engine: 'web-speech', elevenLabs: 'disabled' };
}
