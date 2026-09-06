/**
 * Preise auf der Startseite.
 *
 * ## Warum es diesen Abschnitt gibt
 *
 * Bis zum 2026-09-06 stand auf `/` kein einziger Betrag. Ein Besucher, der
 * wissen wollte, was das Produkt kostet, musste die Seite verlassen. Für ein
 * Self-Service-SaaS ist das die teuerste Lücke im Trichter — und sie zu
 * schliessen ist nach `CLAUDE.md` §10.2 eine Ergänzung, also ohne Rückfrage
 * erlaubt, solange sie die vorhandene Optik verwendet. Genau das tut sie:
 * `surface-panel`, `champagne-*`, `font-serif`, dieselben Abstände wie die
 * Nachbarabschnitte. Nichts davon ist neu erfunden.
 *
 * ## Woher die Zahlen kommen
 *
 * Aus `SELLABLE_PRICING_TIERS` — nicht aus einer Marketingliste daneben.
 * Das ist keine Stilfrage: Auf `/realsync-landing` standen bis zum
 * 2026-08-31 fünf Karten mit hart kodierten Beträgen im JSX, und die liefen
 * gegen die Preisseite auseinander. Wer hier einen Betrag hinschreibt, statt
 * ihn zu lesen, baut denselben Fehler neu.
 *
 * `SELLABLE_PRICING_TIERS` und nicht `PUBLIC_PRICING_TIERS`: Agency und
 * Partner sind seit AP2 stillgelegt. Sie anzubieten hiesse, in eine
 * Sackgasse zu führen (§14).
 *
 * ## Warum nur sechs Leistungen je Karte
 *
 * Growth trägt 16 Bullet-Punkte, Enterprise 14. Vollständig ausgeschrieben
 * ist die Karte keine Übersicht mehr. Gekürzt wird deshalb sichtbar — mit
 * der Zahl der übrigen und einem Weg zur vollständigen Liste, statt still
 * abzuschneiden.
 */

import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';

import { SELLABLE_PRICING_TIERS, formatPriceEur } from '../../config/pricing';

/** So viele Leistungen passen auf eine Karte, ohne sie zur Liste zu machen. */
const BULLETS_PER_CARD = 6;

export function LandingPricingSection() {
  return (
    <section id="preise" className="border-t border-white/10 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mb-12 max-w-3xl">
          <p className="font-mono text-[10px] tracking-[.25em] text-champagne">PREISE</p>
          <h2 className="mt-3 text-4xl font-medium tracking-tight sm:text-5xl font-serif">
            Ein Betriebssystem. <span className="text-champagne">Drei Stufen.</span>
          </h2>
          <p className="mt-5 leading-relaxed text-white/55">
            Der Scan bleibt kostenlos und braucht keinen Account. Ab Starter läuft die
            Governance dauerhaft mit — Nachweise, Prüfpfad und Monitoring inklusive.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {SELLABLE_PRICING_TIERS.map(tier => {
            const rest = tier.bullets.length - BULLETS_PER_CARD;
            return (
              <div
                key={tier.id}
                data-reveal
                data-reveal-group="pricing"
                className={`surface-panel flex flex-col rounded-2xl p-7 ${
                  tier.highlight ? 'ring-1 ring-champagne/40' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold tracking-wide">{tier.name}</h3>
                  {tier.badges.map(badge => (
                    <span
                      key={badge}
                      className="rounded-full border border-champagne/35 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[.14em] text-champagne-400"
                    >
                      {badge}
                    </span>
                  ))}
                </div>

                <p className="mt-3 min-h-[3.5rem] text-sm leading-relaxed text-white/55">{tier.tagline}</p>

                {/* `flex-wrap` und `whitespace-nowrap`: „Auf Anfrage" ist doppelt
                    so breit wie „249 €" und brach in der Enterprise-Karte mitten
                    im Wort um, direkt in den Zusatz hinein. Am Bild gesehen, nicht
                    am Code — im JSX sah die Zeile richtig aus. Der Betrag bleibt
                    jetzt einzeilig, der Zusatz rutscht bei Bedarf darunter. */}
                <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-white/10 pt-5">
                  <span className="whitespace-nowrap text-3xl font-semibold text-white">
                    {tier.priceOnRequest ? 'Auf Anfrage' : formatPriceEur(tier.priceEur)}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[.14em] text-white/40">
                    {tier.priceSuffix}
                  </span>
                </div>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {tier.bullets.slice(0, BULLETS_PER_CARD).map(bullet => (
                    <li key={bullet} className="flex gap-2.5 text-sm leading-relaxed text-white/55">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-champagne" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                  {rest > 0 && (
                    <li className="pl-6 text-sm text-white/35">
                      … und {rest} weitere Leistungen
                    </li>
                  )}
                </ul>

                <Link
                  to={tier.cta.href}
                  className={`mt-7 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition ${
                    tier.highlight
                      ? 'bg-champagne-200 text-champagne-950 hover:bg-champagne-100'
                      : 'border border-champagne/45 text-champagne-50 hover:bg-white/5'
                  }`}
                >
                  {tier.cta.label} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <Link to="/pricing" className="inline-flex items-center gap-1.5 font-medium text-champagne">
            Alle Leistungen im Vergleich <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <span className="text-white/35">Monatlich kündbar · Abrechnung in Euro · Hosting in der EU</span>
        </div>
      </div>
    </section>
  );
}
