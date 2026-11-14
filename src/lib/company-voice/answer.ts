/**
 * Deterministische Antworten. Kein Modell, kein Echo der Frage,
 * keine Beträge außer denen aus `shared/pricing.ts`.
 */
import { formatPriceEur, monthlyPriceText, type Plan } from '../../../shared/pricing';
import { factById, quotedPlans } from './facts';
import {
  COMPANY_VOICE_DISCLAIMER,
  CONTACT_PATH,
  PRICING_HREF,
  WEBDESIGN_HREF,
  WEBDESIGN_LINK_LABEL,
  type AnswerContext,
  type CompanyAnswer,
  type PublicFact,
  type PublicFactId,
} from './types';

const GAP = 'Dazu liegt in den freigegebenen Unternehmensinfos nichts vor.';
const CONTACT_LABEL = 'Kontakt';

export function normalizeQuestion(input: string): string {
  return input
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

function has(text: string, words: readonly string[]): boolean {
  return words.some((word) => text.includes(word));
}

function gap(text: string, link: CompanyAnswer['link'] = { href: CONTACT_PATH, label: CONTACT_LABEL }): CompanyAnswer {
  return { covered: false, text, link, usedFactIds: ['product.boundaries'] };
}

function covered(text: string, usedFactIds: readonly PublicFactId[], link?: CompanyAnswer['link']): CompanyAnswer {
  return { covered: true, text, link, usedFactIds };
}

function planFromQuestion(text: string): Plan | null {
  const plans = [...quotedPlans()].sort((a, b) => b.name.length - a.name.length);
  for (const plan of plans) {
    const name = normalizeQuestion(plan.name);
    if (name.length > 0 && text.includes(name)) return plan;
  }
  return null;
}

function unknownAmounts(text: string, named: Plan | null): boolean {
  const allowed = new Set<number>();
  for (const plan of named ? [named] : quotedPlans()) {
    allowed.add(plan.price.monthlyEur);
    if (plan.price.yearlyEur != null) allowed.add(plan.price.yearlyEur);
  }
  for (const match of text.matchAll(/\d{1,6}/g)) {
    const amount = Number(match[0]);
    if (amount >= 1990 && amount <= 2100) continue;
    if (amount < 10) continue;
    if (!allowed.has(amount)) return true;
  }
  return false;
}

function betaSentence(context: AnswerContext): string {
  if (!context.publicBeta || !context.betaEndsLabel) return '';
  return ` Auf dieser Seite gilt die offene Beta: kostenlos testen bis ${context.betaEndsLabel}. Der Listenpreis bleibt der genannte Betrag.`;
}

function quotePlan(plan: Plan): string {
  if (plan.price.monthlyEur === 0) return `${plan.name} kostet ${formatPriceEur(plan.price.monthlyEur)}.`;
  return `${plan.name}: ${monthlyPriceText(plan)} laut Preisliste.`;
}

function priceAnswer(text: string, context: AnswerContext): CompanyAnswer {
  const named = planFromQuestion(text);
  const starter = quotedPlans().find((plan) => plan.planKey === 'starter');
  const free = quotedPlans().find((plan) => plan.planKey === 'free_audit');
  if (!starter || !free) return gap(`${GAP} Die Preisliste ist gerade nicht lesbar.`);

  const sentences: string[] = [];
  if (named) {
    sentences.push(quotePlan(named));
  } else {
    sentences.push(`Self-Service startet mit ${quotePlan(starter)}`);
    sentences.push(`Kostenloser Audit-Tarif: ${quotePlan(free)}`);
  }
  if (unknownAmounts(text, named)) {
    sentences.push('Andere Beträge stehen nicht in der Preisliste und gelten hier nicht.');
  }
  const beta = betaSentence(context);
  return covered(`${sentences.join(' ')}${beta}`, ['pricing.selfService', 'pricing.freeAudit'], {
    href: PRICING_HREF,
    label: 'Preise',
  });
}

export function answerCompanyQuestion(
  question: string,
  facts: readonly PublicFact[],
  context: AnswerContext = {},
): CompanyAnswer {
  const text = normalizeQuestion(question);
  if (!text) return gap('Bitte eine Frage eintippen oder einsprechen.');

  const founder = factById(facts, 'company.founder');
  const legal = factById(facts, 'company.legalForm');
  const trade = factById(facts, 'company.tradeRegisteredOn');
  const seat = factById(facts, 'company.seat');
  const summary = factById(facts, 'product.summary');
  const webdesign = factById(facts, 'service.webdesign');
  const note = factById(facts, 'timeManager.publicNote');

  if (has(text, ['telefon', 'anruf', 'rufnummer', 'hotline', 'anrufen', 'telefonie'])) {
    return gap(
      'Diese Demo nutzt keine Telefonie und nennt keine Telefonnummer. Schreiben Sie uns über die Kontaktseite.',
    );
  }

  if (has(text, ['rechtsberatung', 'anwalt', 'konformitaet', 'konform', 'garantie', 'garantiert', 'haftung'])) {
    return covered(COMPANY_VOICE_DISCLAIMER, ['product.boundaries'], { href: CONTACT_PATH, label: CONTACT_LABEL });
  }

  if (has(text, ['webdesign', 'website bauen', 'landingpage erstellen'])) {
    return covered(webdesign?.text ?? GAP, ['service.webdesign'], {
      href: WEBDESIGN_HREF,
      label: WEBDESIGN_LINK_LABEL,
    });
  }

  if (has(text, ['time manager', 'timemanager', 'second brain', 'secondbrain'])) {
    if (note) {
      return covered(
        `${note.text} Das ist eine freigegebene Angabe aus dem Time Manager, kein privates Dokument.`,
        ['timeManager.publicNote'],
      );
    }
    return gap('Eine freigegebene Angabe aus dem Time Manager liegt nicht vor.');
  }

  if (
    has(text, ['preis', 'kostet', 'kosten', 'tarif', 'monat', 'abo', 'starter', 'growth', 'agency', 'enterprise']) ||
    text.includes('€') ||
    /(?:^|\s)euro(?:\s|$)/.test(text)
  ) {
    return priceAnswer(text, context);
  }

  if (has(text, ['gruender', 'founder', 'inhaber', 'dominik', 'wer steckt', 'wer seid'])) {
    return covered([founder?.text, legal?.text].filter(Boolean).join(' '), ['company.founder', 'company.legalForm']);
  }

  if (has(text, ['sitz', 'standort', 'neuhaus', 'thueringen', 'wo sitzt', 'ansaessig'])) {
    return covered(seat?.text ?? GAP, ['company.seat']);
  }

  if (has(text, ['gewerbe', 'rechtsform', 'einzelunternehmen', 'handelsregister'])) {
    return covered([legal?.text, trade?.text].filter(Boolean).join(' '), ['company.legalForm', 'company.tradeRegisteredOn']);
  }

  if (
    has(text, [
      'produkt',
      'was macht',
      'was bietet',
      'plattform',
      'governance',
      'dsgvo',
      'ai act',
      'eu ai',
      'evidence',
      'nachweis',
      'agent',
      'saas',
      'realsync',
    ])
  ) {
    return covered(summary?.text ?? GAP, ['product.summary']);
  }

  return gap(`${GAP} Schreiben Sie uns über die Kontaktseite.`);
}
