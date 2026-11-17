import { formatLimit } from '@/shared/pricing';
import type { ProductLandingContent } from '../types';

export const KI_BOTS_CONTENT: ProductLandingContent = {
  slug: 'ki-bots',
  seoTitle: 'KI-Bots – Kundenfragen beantwortet, nach Ihren Regeln',
  seoDescription:
    'Ein KI-Assistent beantwortet Fragen Ihrer Kunden im Website-Chat. Jede Nachricht läuft durch Ihre Regeln und zählt gegen ein festes Kontingent.',
  eyebrow: '02 · AUTOMATE',
  statusId: 'channel-bots',
  headline: 'Kundenfragen beantwortet.',
  headlineSub: 'Nach Ihren Regeln.',
  lead: 'Ein KI-Assistent beantwortet Fragen Ihrer Kunden im Chat. Jede Nachricht läuft durch Ihre Regeln, jede Antwort zählt gegen ein festes Kontingent und wird nachvollziehbar gespeichert.',
  primaryCta: { label: 'Eigenen Bot einrichten', to: '/welcome?next=%2Fapp%2Fbots' },
  secondaryCta: { label: 'Pakete vergleichen', to: '/pricing' },
  hint: 'Heute im Website-Chat · Telefonie ist noch nicht nutzbar',
  example: {
    title: 'So entsteht eine Antwort',
    rows: [
      '1 · Kunde schreibt im Website-Chat',
      '2 · Regelprüfung der Nachricht',
      '3 · Kontingent und Kostendeckel',
      '4 · Antwort im Ton Ihres Betriebs',
      '5 · Frage und Antwort gespeichert',
    ],
    caption: 'Die Reihenfolge ist im Backend festgelegt',
  },
  sections: [
    {
      id: 'kanaele',
      eyebrow: 'Kanäle',
      title: 'Wo der Assistent erreichbar ist.',
      kind: 'cards',
      cards: [
        { title: 'Website-Chat', text: 'Auf Ihrer eigenen Website.', statusId: 'channel-bots' },
        { title: 'WhatsApp', text: 'Über die WhatsApp Business Platform.', statusId: 'channel-bots' },
        { title: 'Telegram', text: 'Als Bot-Kanal mit demselben Protokoll wie der Website-Chat.', statusId: 'channel-bots' },
        { title: 'Telefon', text: 'Anrufe annehmen und beantworten.', statusId: 'voice-telephony' },
      ],
    },
    {
      id: 'persona',
      eyebrow: 'Persona',
      title: 'Sie bestimmen, wie er spricht – und was nicht.',
      kind: 'cards',
      cards: [
        { title: 'Name und Begrüßung', text: 'Wie stellt sich der Assistent vor, und womit eröffnet er das Gespräch?' },
        { title: 'Ton und Länge', text: 'Sie-Form, kurz und freundlich – oder so, wie Ihr Betrieb spricht.' },
        { title: 'Grenzen', text: 'Zum Beispiel: keine verbindlichen Preise, keine Rechtsberatung, keine Zusagen ohne Ihr Team.' },
        { title: 'Als KI erkennbar', text: 'Der Assistent gibt sich als KI zu erkennen.' },
      ],
    },
    {
      id: 'grenzen',
      eyebrow: 'Klare Grenzen',
      title: 'Was er heute noch nicht tut.',
      kind: 'list',
      list: [
        'Telefonie ist noch nicht nutzbar.',
        'Ist das Monatskontingent aufgebraucht, antwortet der Assistent erst im nächsten Monat wieder – oder nach einem Paketwechsel.',
        'Weiß der Assistent etwas nicht, verweist er auf Ihre Kontaktwege, statt eine Antwort zu erfinden.',
      ],
    },
  ],
  planIntro: 'Ab Starter mit eigenem Assistenten.',
  planRows: [
    { label: 'Bots', value: (plan) => formatLimit(plan.limits.bots) },
    { label: 'Antworten pro Monat', value: (plan) => formatLimit(plan.limits.answersPerMonth) },
    { label: 'Website-Chat', value: (plan) => plan.limits.bots > 0 && plan.channels.includes('website') },
    { label: 'WhatsApp', value: (plan) => plan.channels.includes('whatsapp') },
    { label: 'Telegram', value: (plan) => plan.channels.includes('telegram') },
  ],
  faq: [
    {
      question: 'Kann der Assistent schon telefonieren?',
      answer: 'Noch nicht. Heute antwortet er im Chat.',
    },
    {
      question: 'Was passiert, wenn er etwas nicht weiß?',
      answer: 'Er sagt das offen und verweist auf Ihre Kontaktwege, statt eine Antwort zu erfinden.',
    },
    {
      question: 'Was zählt gegen das Kontingent?',
      answer: 'Jede Antwort des Assistenten. Ein Kostendeckel begrenzt zusätzlich die KI-Kosten.',
    },
  ],
  closing: {
    title: 'Ein Assistent, der sich an Ihre Regeln hält.',
    text: 'Richten Sie Ihren Bot im Konto ein.',
  },
};
