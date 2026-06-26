/**
 * Beispiel-Usecases für AI-Act-Tests.
 * Werden verwendet, sobald data-testid-Attribute im Frontend gesetzt sind.
 */
export const aiActUsecases = [
  {
    id: 'chatbot-kundensupport',
    label: 'Chatbot Kundensupport',
    expectedRiskClass: 'minimal',
  },
  {
    id: 'bewerbungsscreening',
    label: 'Automatisches Bewerbungsscreening',
    expectedRiskClass: 'hoch',
  },
  {
    id: 'medizinische-diagnose',
    label: 'KI-gestützte Diagnoseunterstützung',
    expectedRiskClass: 'hoch',
  },
  {
    id: 'gesichtserkennung-oeffentlich',
    label: 'Biometrische Identifikation im öffentlichen Raum',
    expectedRiskClass: 'verboten',
  },
];
