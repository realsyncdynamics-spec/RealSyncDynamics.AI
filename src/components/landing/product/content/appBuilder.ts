import { formatLimit } from '@/shared/pricing';
import type { ProductLandingContent } from '../types';

export const APP_BUILDER_CONTENT: ProductLandingContent = {
  slug: 'app-builder',
  seoTitle: 'App Builder – von der Idee zum Website-Plan',
  seoDescription:
    'Beschreiben Sie Ihren Betrieb in ein paar Sätzen. Der App Builder plant daraus eine Website mit Seiten, Abschnitten, Pflichtseiten und Qualitätsprüfung.',
  eyebrow: '01 · BUILD',
  statusId: 'web-builder',
  headline: 'Von der Idee',
  headlineSub: 'zum Website-Plan.',
  lead: 'Beschreiben Sie Ihren Betrieb in ein paar Sätzen. Der App Builder plant daraus eine Website – mit Seiten, Abschnitten, Pflichtseiten und Qualitätsprüfung.',
  primaryCta: { label: 'Entwurf kostenlos erstellen', to: '/build' },
  secondaryCta: { label: 'Anmelden und weiterbauen', to: '/welcome?next=%2Fbuild' },
  hint: 'Kostenlos und ohne Konto · bis zu 10 Entwürfe pro Tag',
  example: {
    title: 'Entwurf · Seitenplan',
    rows: [
      'Startseite',
      'Leistungen',
      'Referenzen',
      'Anfrage mit Formular',
      'Impressum',
      'Datenschutzerklärung',
      'Erklärung zur Barrierefreiheit',
    ],
    caption: 'Aufbau eines Entwurfs – Beispiel für einen Malerbetrieb',
  },
  sections: [
    {
      id: 'seiten',
      eyebrow: 'Seitenplan',
      title: 'Eine ganze Website, nicht nur eine Startseite.',
      intro:
        'Aus einer Beschreibung entstehen die Seiten, die ein Betrieb braucht – samt Impressum, Datenschutzerklärung und Erklärung zur Barrierefreiheit.',
      kind: 'cards',
      cards: [
        {
          title: 'Startseite, Leistungen, Referenzen',
          text: 'Die Seiten, auf denen Kunden entscheiden, mit passenden Abschnitten: Leistungen, Vorteile, Stimmen, Handlungsaufruf.',
        },
        {
          title: 'Anfrage mit Formular',
          text: 'Eine eigene Seite für Anfragen – dort, wo Besucher zu Kunden werden.',
        },
        {
          title: 'Pflichtseiten eingeplant',
          text: 'Impressum, Datenschutzerklärung und Erklärung zur Barrierefreiheit sind von Anfang an Teil des Plans.',
        },
        {
          title: 'KI-Hinweis auf jeder Seite',
          text: 'Jede Seite enthält einen Hinweis darauf, dass KI an der Erstellung beteiligt war.',
        },
      ],
    },
    {
      id: 'ablauf',
      eyebrow: 'Ablauf',
      title: 'Vom Satz zur Seite in vier Schritten.',
      kind: 'steps',
      cards: [
        { title: 'Idee eingeben', text: 'Was bieten Sie an, für wen, und was sollen Besucher tun?' },
        { title: 'Entwurf ansehen', text: 'Seitenplan, Bewertung und Hinweise – ohne Konto, sieben Tage gespeichert.' },
        { title: 'Im Builder weiterbauen', text: 'Nach der Anmeldung baut die Plattform den Entwurf aus Ihrer Beschreibung neu auf.' },
        { title: 'Veröffentlichen', text: 'Ab Starter im Paket enthalten – die Zahl der Websites richtet sich nach dem Paket.' },
      ],
    },
    {
      id: 'grenzen',
      eyebrow: 'Klare Grenzen',
      title: 'Was der Entwurf nicht ist.',
      kind: 'list',
      list: [
        'Der Entwurf entsteht nach festen Regeln, ohne KI-Modell. Dieselbe Beschreibung ergibt denselben Aufbau.',
        'Texte und Bilder sind Platzhalter. Rechtstexte für Impressum und Datenschutz müssen Sie mit Ihren echten Angaben füllen.',
        'Der Entwurf aus der Vorschau wird nicht ins Konto übernommen, sondern dort aus derselben Beschreibung neu erstellt.',
      ],
    },
  ],
  planIntro: 'Ab Starter bauen Sie weiter und veröffentlichen.',
  planRows: [
    { label: 'Entwurf ohne Konto', value: () => true },
    { label: 'Builder', value: (plan) => plan.permissions.siteosBuilder },
    { label: 'Veröffentlichen', value: (plan) => plan.permissions.siteosPublish },
    { label: 'Websites', value: (plan) => formatLimit(plan.limits.sites) },
  ],
  faq: [
    {
      question: 'Muss ich programmieren können?',
      answer: 'Nein. Sie beschreiben Ihren Betrieb in eigenen Worten, den Aufbau erstellt der App Builder.',
    },
    {
      question: 'Welche Seiten bekomme ich?',
      answer: 'Der Plan richtet sich nach Ihrer Beschreibung. Impressum, Datenschutzerklärung und Erklärung zur Barrierefreiheit gehören immer dazu.',
    },
    {
      question: 'Wie lange bleibt mein Entwurf gespeichert?',
      answer: 'Ohne Konto sieben Tage. Nach der Anmeldung baut die Plattform ihn aus Ihrer Beschreibung neu auf.',
    },
  ],
  closing: {
    title: 'Ihre Idee. Heute als Website-Plan.',
    text: 'Kostenlos und ohne Konto.',
  },
};
