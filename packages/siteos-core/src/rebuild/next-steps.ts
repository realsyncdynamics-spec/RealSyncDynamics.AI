// AUTOMATE — nächste Schritte im RealSync-Betriebssystem vorschlagen.
//
// Der Builder ist der Einstieg, nicht das Ende. Nach dem Rebuild schlägt
// das System vor, was auf der neuen Betriebsfläche sinnvoll ist — und
// jeder Vorschlag sagt, worauf er sich stützt (Belege), wohin er führt
// (Route) und dass er ohne Freigabe nichts tut.
//
// `connection` ist immer `none` oder `requires-setup`. Es gibt hier keine
// „verbundene" Integration, weil keine Verbindung besteht, nur weil sie
// vorgeschlagen wurde. Eine Anbindung, die nicht real ist, wird nicht als
// real gezeigt.

import { visibleComponents } from './components.ts';
import type { NextStepSuggestion, RebuildDirection, SiteAssessment, SiteImport } from './types.ts';

export function proposeNextSteps(imp: SiteImport, direction: RebuildDirection, assessment: SiteAssessment | null): NextStepSuggestion[] {
  const out: NextStepSuggestion[] = [];
  const visible = visibleComponents(direction);
  const lead = visible.find((c) => c.kind === 'lead-form');
  const formEvidence = imp.forms.map((f) => f.evidenceId);
  const goal = imp.positioning.conversionGoal;
  const score = (c: string) => assessment?.criteria.find((x) => x.criterion === c)?.score ?? null;
  const conv = score('conversion-focus');
  const evidenceFor = (ref: string) => imp.evidence.filter((e) => e.ref === ref).map((e) => e.id);

  const add = (s: Omit<NextStepSuggestion, 'requiresApproval' | 'status'>) => out.push({ ...s, requiresApproval: true, status: 'proposed' });

  if (lead) {
    add({
      key: 'lead-automation',
      label: 'Lead-Automatisierung',
      why: `Der Rebuild bringt ein Anfrageformular mit${direction.leadFlow.formTarget ? '' : ' (Ziel noch offen)'}. Anfragen können nach Freigabe an E-Mail, CRM oder Kalender weitergeleitet werden.`,
      evidenceIds: formEvidence,
      route: '/app/automations',
      connection: 'requires-setup',
    });
    add({
      key: 'form-to-workflow',
      label: 'Formular → Workflow',
      why: 'Jede Anfrage als Workflow-Auslöser: Bestätigung, Zuweisung, Wiedervorlage — mit Prüfpfad.',
      evidenceIds: formEvidence,
      route: '/app/workflows',
      connection: 'requires-setup',
    });
  }

  if (goal === 'booking' || ['zahnarzt', 'arztpraxis', 'handwerk', 'gastronomie', 'rechtsanwalt', 'steuerberatung'].includes(imp.positioning.industry ?? '')) {
    add({
      key: 'booking',
      label: 'Terminbuchung',
      why: goal === 'booking' ? 'Die Quelle zielt auf Termine — freie Slots direkt auf der Seite statt Rückruf-Schleife.' : 'In dieser Branche ist der Termin der Abschluss. Buchung auf der Seite verkürzt den Weg.',
      evidenceIds: goal === 'booking' ? formEvidence : evidenceFor('nav'),
      route: '/app/automations',
      connection: 'requires-setup',
    });
  }

  add({
    key: 'chatbot',
    label: 'Chatbot mit Governance',
    why: conv !== null && conv < 60 ? `Conversion-Fokus der alten Seite: ${conv}/100. Ein geführter Dialog beantwortet die ersten Fragen und leitet zur Anfrage.` : 'Ein geführter Dialog beantwortet Standardfragen (FAQ) und übergibt an Menschen — mit Prüfpfad je Antwort.',
    evidenceIds: evidenceFor('headings'),
    route: '/app/bots',
    connection: 'none',
  });

  add({
    key: 'dsgvo-ai-act-check',
    label: 'DSGVO- / EU-AI-Act-Check',
    why: `${imp.thirdPartyHosts.length} Drittanbieter-Host${imp.thirdPartyHosts.length === 1 ? '' : 's'} auf der alten Seite${imp.forms.some((f) => !f.hasConsentHint) ? ', Formulare ohne Datenschutzhinweis' : ''}. Die neue Seite laufend prüfen.`,
    evidenceIds: [...evidenceFor('third-party'), ...imp.forms.filter((f) => !f.hasConsentHint).map((f) => f.evidenceId)],
    route: '/app/scans',
    connection: 'none',
  });

  add({
    key: 'governance-scan',
    label: 'KI-Governance-Scan',
    why: 'Inventar der eingesetzten KI-Systeme, Risikoklasse nach EU AI Act, Pflichten je System — bevor die erste Automatisierung live geht.',
    evidenceIds: evidenceFor('text'),
    route: '/app/governance',
    connection: 'none',
  });

  add({
    key: 'local-ai',
    label: 'Lokale KI-Anbindung',
    why: 'Modelle in der EU oder im eigenen Haus betreiben — für Chatbot, Textprüfung und Anfragebewertung ohne Datenabfluss.',
    evidenceIds: [],
    route: '/app/local-ai',
    connection: 'requires-setup',
  });

  add({
    key: 'crm-email-stripe',
    label: 'CRM / E-Mail / Stripe',
    why: goal === 'purchase' ? 'Die Quelle verkauft direkt. Zahlung, Bestätigung und Kundenkartei gehören an die neue Seite — nach Freigabe.' : 'Anfragen in die Kundenkartei, Bestätigungen per E-Mail, Zahlung bei Bedarf — jede Anbindung einzeln freigegeben.',
    evidenceIds: goal === 'purchase' ? imp.ctas.filter((c) => /shop|kaufen|bestellen|cart/i.test(`${c.label} ${c.href ?? ''}`)).map((c) => c.evidenceId) : formEvidence,
    route: '/app/automations',
    connection: 'requires-setup',
  });

  return out;
}
