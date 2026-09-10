import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Headset, KeyRound, ShieldCheck } from 'lucide-react';
import { tierById } from '../../config/pricing';
import { CTA } from '../../content/runtimeVocab';

/**
 * Enterprise-Zugang auf der Startseite.
 *
 * Freigegeben am 2026-08-19 (Frage 3 der Drei-Fragen-Regel, CLAUDE.md §10.4)
 * als **Ergänzung** — bestehende Sektionen bleiben in Aufbau und Reihenfolge.
 *
 * ## Jede Zahl hier stammt aus `shared/pricing.ts`
 *
 * Kein Preis, keine Reaktionszeit und keine Mandantenzahl steht in dieser
 * Datei als Literal. Wer den Plan ändert, ändert diesen Abschnitt mit — das
 * ist der einzige Weg, auf dem eine Preisseite und eine Startseite dauerhaft
 * dasselbe sagen (CLAUDE.md §6).
 *
 * Deshalb rendert der Abschnitt auch **nichts**, wenn der Enterprise-Plan
 * nicht auffindbar ist: Lieber eine fehlende Sektion als eine mit erfundenen
 * Konditionen.
 *
 * ## Die CTA ist nicht frei gewählt
 *
 * `CTA.enterprise` aus `src/content/runtimeVocab.ts` ist die **einzige**
 * kontaktbasierte Handlungsaufforderung, die dieses Produkt führt. Termin-
 * und Gesprächssprache steht dort ausdrücklich auf der CI-Sperrliste, weil
 * sie der Positionierung „Tools statt Beratung" widerspricht. Ein Entwurf
 * mit „Gespräch vereinbaren" wäre daran vorbeigegangen, ohne die Regex zu
 * treffen — deshalb hier die Konstante statt eines Literals.
 */

const SUPPORT_LABEL: Record<string, string> = {
  community: 'Community-Support',
  email: 'E-Mail-Support',
  priority: 'Priorisierter Support',
  dedicated: 'Dedizierter Ansprechpartner',
};

export function EnterpriseAccessSection() {
  const tier = tierById('enterprise');
  if (!tier) return null;

  const { plan } = tier;
  const supportLabel = SUPPORT_LABEL[plan.support] ?? 'Support nach Vereinbarung';

  // Die vier Aussagen der Gruppe „multi_tenant_reseller" sind das, was den
  // Enterprise-Zugang vom Rest unterscheidet — Mandanten, Rechte, SSO,
  // White-Label. Genau deshalb tragen sie diesen Abschnitt.
  const accessPoints = plan.features.multi_tenant_reseller;

  return (
    <section
      id="enterprise"
      className="border-t border-white/10 py-24 md:py-32"
      aria-labelledby="enterprise-heading"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid gap-14 lg:grid-cols-[.85fr_1.15fr] lg:items-start">
          <div>
            <p className="font-mono text-[10px] tracking-[.25em] text-[#e8c98a]">ENTERPRISE-ZUGANG</p>
            <h2
              id="enterprise-heading"
              className="mt-4 text-[2rem] tracking-tight sm:text-5xl"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500 }}
            >
              Governance mit <span className="text-[#e8c98a]">Ansprechpartner.</span>
            </h2>
            <p className="mt-5 text-base leading-relaxed text-white/55">{tier.tagline}</p>
            <p className="mt-3 text-sm leading-relaxed text-white/40">{tier.subline}</p>

            <div className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-semibold text-white">{tier.priceString} €</span>
              <span className="font-mono text-[11px] uppercase tracking-[.18em] text-white/40">
                {tier.priceSuffix}
              </span>
            </div>
            {plan.trialDays > 0 && (
              <p className="mt-2 text-[11px] text-white/35">
                {plan.trialDays} Tage kostenlos testen.
              </p>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/contact-sales?source=landing-enterprise"
                className="inline-flex items-center gap-2 rounded-full bg-[#f0e6d2] px-7 py-3.5 font-semibold text-[#1a1714] transition hover:bg-[#f6efe4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8c98a] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(3,7,18)]"
              >
                {CTA.enterprise} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                /* Anker aus der Preisseite: die Karten tragen dort `plan-<id>`.
                   Abgeleitet statt getippt, damit ein umbenannter Tarif die
                   Verlinkung nicht still ins Leere laufen laesst. */
                to={`/pricing#plan-${tier.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-[#e8c98a]/40 px-7 py-3.5 font-medium text-[#f3d9a0] transition hover:border-[#e8c98a]/65 hover:bg-[#e8c98a]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8c98a]/50"
              >
                Leistungen im Detail
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <AccessCard
              icon={Headset}
              title={supportLabel}
              text={
                plan.badges.length > 0
                  ? `Zugesicherte Reaktion: ${plan.badges.join(' · ')}.`
                  : 'Fester Ansprechpartner statt Ticket-Warteschlange.'
              }
            />
            <AccessCard
              icon={Building2}
              title={`${plan.limits.tenants} Organisationen`}
              text={`Getrennte Mandanten unter einer Governance-Ebene, ${plan.limits.seats} Benutzerplätze.`}
            />
            <AccessCard
              icon={ShieldCheck}
              title="Alle sechs Rahmenwerke"
              text="DSGVO, EU AI Act, ISO 27001, NIS2, TISAX und DORA als aktive Policy Packs."
            />
            <AccessCard
              icon={KeyRound}
              title="Single Sign-On"
              text={`Zentrale Rechteverwaltung, ${plan.limits.evidenceStorageGb} GB Nachweisspeicher.`}
            />

            <div className="surface-panel rounded-2xl p-6 sm:col-span-2" data-reveal data-reveal-group="enterprise">
              <p className="font-mono text-[10px] tracking-[.2em] text-[#e8c98a]/80">IM ZUGANG ENTHALTEN</p>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {accessPoints.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm leading-relaxed text-white/60">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#e8c98a]" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AccessCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof ShieldCheck;
  title: string;
  text: string;
}) {
  return (
    <div className="surface-panel rounded-2xl p-6" data-reveal data-reveal-group="enterprise">
      <Icon className="h-5 w-5 text-[#e8c98a]" strokeWidth={1.5} />
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/50">{text}</p>
    </div>
  );
}
