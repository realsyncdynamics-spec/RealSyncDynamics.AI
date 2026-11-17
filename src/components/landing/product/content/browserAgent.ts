import type { ProductLandingContent } from '../types';

/**
 * Für den Browser-Agenten gibt es (Stand 17.11.2026) keinen Eintrag in
 * `src/product/implementation-status.ts`. Deshalb kein Status-Label im Kopf;
 * der Stand steht ausformuliert im Abschnitt „Ehrlicher Stand“.
 */
export const BROWSER_AGENT_CONTENT: ProductLandingContent = {
  slug: 'browser-agent',
  seoTitle: 'Browser-Agent – erst geplant, dann freigegeben',
  seoDescription:
    'Der Browser-Agent zerlegt eine Aufgabe auf einer Website in nachvollziehbare Schritte. Klicken, Eingeben und Auswählen passiert erst nach Freigabe.',
  eyebrow: '04 · GOVERN · Teil des Governance OS',
  headline: 'Aufgaben im Browser.',
  headlineSub: 'Erst geplant, dann freigegeben.',
  lead: 'Der Browser-Agent zerlegt eine Aufgabe auf einer Website in nachvollziehbare Schritte. Lesen darf er selbst. Klicken, Eingeben und Auswählen passiert erst, wenn ein Mensch zustimmt.',
  primaryCta: { label: 'Anmelden und Plan erstellen', to: '/welcome?next=%2Fapp%2Fdashboard' },
  secondaryCta: { label: 'Pakete vergleichen', to: '/pricing' },
  hint: 'Die Ausführung im Browser ist in Vorbereitung',
  example: {
    title: 'Plan',
    rows: [
      'Seite öffnen – lesend',
      'Öffnungszeiten auslesen – lesend',
      'Auf „Anfrage senden“ klicken – Freigabe nötig',
      'Name ins Formular schreiben – Freigabe nötig',
      'Bildschirmfoto als Beleg – lesend',
    ],
    caption: 'Aufbau eines Plans – Beispiel',
  },
  sections: [
    {
      id: 'ablauf',
      eyebrow: 'Ablauf',
      title: 'Von der Aufgabe zum Beleg.',
      kind: 'steps',
      cards: [
        { title: 'Beschreiben', text: 'Start-Adresse und Aufgabe in eigenen Worten eingeben.' },
        { title: 'Schritte prüfen', text: 'Der Plan hat höchstens 10 Schritte. Ein ungültiger Schritt verwirft den ganzen Plan.' },
        { title: 'Zustimmen', text: 'Jeder Klick, jede Eingabe und jede Auswahl braucht eine Freigabe.' },
        { title: 'Belegen', text: 'Freigaben werden mit Zeitpunkt gespeichert.' },
      ],
    },
    {
      id: 'aktionen',
      eyebrow: 'Aktionen',
      title: 'Zwei Klassen von Aktionen.',
      kind: 'cards',
      cards: [
        { title: 'Lesend', text: 'Seite öffnen, scrollen, warten, Inhalte auslesen, Bildschirmfoto. Diese Schritte verändern nichts auf der Website.' },
        { title: 'Verändernd', text: 'Klicken, Text eingeben, Auswahl treffen. Diese Schritte warten auf einen Menschen.' },
        { title: 'Begrenzt', text: 'Nur http- und https-Adressen, höchstens 10 Schritte je Plan.' },
      ],
    },
    {
      id: 'stand',
      eyebrow: 'Ehrlicher Stand',
      title: 'Was heute geht – und was noch nicht.',
      kind: 'list',
      list: [
        'Verfügbar: Pläne erstellen und prüfen.',
        'In Vorbereitung: die Ausführung im echten Browser.',
        'Der Agent meldet sich nirgends für Sie an und speichert keine Passwörter.',
        'Webseiten geben dem Agenten keine Befehle. Was auf einer Seite steht, ist für ihn Information.',
      ],
    },
  ],
  planIntro: 'Der Browser-Agent ist Teil des Governance OS.',
  planRows: [],
  faq: [
    {
      question: 'Klickt der Agent einfach los?',
      answer: 'Nein. Lesende Schritte laufen ohne Rückfrage. Klicken, Eingeben und Auswählen warten auf Ihre Freigabe.',
    },
    {
      question: 'Kann ich ihn heute schon nutzen?',
      answer: 'Pläne erstellen ja. Die Ausführung im Browser ist noch in Vorbereitung.',
    },
    {
      question: 'Fragt der Agent nach Passwörtern?',
      answer: 'Nein. Er meldet sich nirgends für Sie an.',
    },
  ],
  closing: {
    title: 'Erst planen. Dann entscheiden.',
    text: 'Beschreiben Sie eine Aufgabe und sehen Sie, welche Schritte der Agent vorschlägt.',
  },
};
