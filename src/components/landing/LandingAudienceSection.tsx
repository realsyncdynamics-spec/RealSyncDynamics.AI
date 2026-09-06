/**
 * „Für wen" — die Zielgruppen der Plattform.
 *
 * ## Warum es diesen Abschnitt gibt
 *
 * Die Startseite erklärte bis zum 2026-09-06 sehr genau, *was* die Runtime
 * tut (sechs Governance-Schritte, neun Module, Evidence-Kette) — aber an
 * keiner Stelle, *wer* damit welches Problem löst. Ein Besucher musste sich
 * selbst zuordnen. Das ist die zweite grosse Lücke einer Verkaufsseite nach
 * dem fehlenden Preis.
 *
 * Ergänzung nach `CLAUDE.md` §10.2, mit den vorhandenen Klassen und Tokens.
 *
 * ## Regel für diesen Abschnitt
 *
 * Jede Zeile beschreibt eine **Rolle und ihren Auslöser**, keine erfundene
 * Referenz. Es steht hier bewusst kein Kundenname, kein Logo und keine Zahl
 * über bestehende Nutzer — dieselbe Behandlung wie `testimonials` im
 * Vorschau-Generator, und aus demselben Grund (§ 5 UWG, siehe die Freigabe
 * vom 2026-09-01 in §10). Wer eine Behauptung über Dritte aufstellt, braucht
 * eine Quelle; ohne Quelle bleibt der Block bei dem, was nachweisbar ist.
 */

import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Landmark, Users } from 'lucide-react';

interface Audience {
  icon: typeof Users;
  role: string;
  trigger: string;
  outcome: string;
  to: string;
  linkLabel: string;
}

const AUDIENCES: readonly Audience[] = [
  {
    icon: Building2,
    role: 'Mittelstand mit KI im Einsatz',
    trigger:
      'Im Unternehmen laufen Chatbots, Assistenten und Automationen — niemand führt Buch darüber, welche Systeme das sind und welches Risiko sie tragen.',
    outcome:
      'Bestandsaufnahme, Risikoklasse je System und ein Nachweis, der einer Prüfung standhält.',
    to: '/ai-act',
    linkLabel: 'EU AI Act im Detail',
  },
  {
    icon: Landmark,
    role: 'Datenschutz und Compliance',
    trigger:
      'Die Prüfung ist eine Momentaufnahme: Nach dem Audit ändert sich die Website, und der Stand von gestern gilt nicht mehr.',
    outcome:
      'Wiederkehrende Nachprüfung mit Meldung bei Abweichung — und ein Prüfpfad, der jede Änderung datiert.',
    to: '/sicherheit',
    linkLabel: 'Sicherheit und Nachweis',
  },
  {
    icon: Users,
    role: 'Agenturen und Dienstleister',
    trigger:
      'Mehrere Mandanten, dieselben Pflichten — und jede Kundenwebsite wird von Hand geprüft und dokumentiert.',
    outcome:
      'Ein Arbeitsbereich je Mandant, gemeinsame Richtlinien und Berichte, die den Kunden direkt erreichen.',
    to: '/pricing',
    linkLabel: 'Stufen vergleichen',
  },
];

export function LandingAudienceSection() {
  return (
    <section id="fuer-wen" className="border-t border-white/10 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mb-12 max-w-3xl">
          <p className="font-mono text-[10px] tracking-[.25em] text-champagne">FÜR WEN</p>
          <h2 className="mt-3 text-4xl font-medium tracking-tight sm:text-5xl font-serif">
            Drei Ausgangslagen. <span className="text-champagne">Dieselbe Kontrollschicht.</span>
          </h2>
          <p className="mt-5 leading-relaxed text-white/55">
            Der Auslöser ist selten die Regulierung selbst — es ist die Frage, die niemand
            beantworten kann, wenn sie zum ersten Mal gestellt wird.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {AUDIENCES.map(audience => (
            <div
              key={audience.role}
              data-reveal
              data-reveal-group="audience"
              className="surface-panel flex flex-col rounded-2xl p-7"
            >
              <audience.icon className="h-5 w-5 text-champagne" strokeWidth={1.5} />
              <h3 className="mt-4 text-lg font-semibold tracking-wide">{audience.role}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/50">{audience.trigger}</p>
              <p className="mt-4 flex-1 border-t border-white/10 pt-4 text-sm leading-relaxed text-champagne-300">
                {audience.outcome}
              </p>
              <Link
                to={audience.to}
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-champagne"
              >
                {audience.linkLabel} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
