import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Headset, KeyRound, ShieldCheck } from 'lucide-react';
import { tierById } from '../../config/pricing';
import { CTA } from '../../content/runtimeVocab';
import {
  LANDING_ACCENT,
  LANDING_DISPLAY,
  LANDING_H2,
  LANDING_H2_TRACKING,
  LANDING_H2_WEIGHT,
} from './landing-theme';

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
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: LANDING_ACCENT }}>ENTERPRISE-ZUGANG</p>
            <h2
              id="enterprise-heading"
              className="mt-4 leading-[1.05]"
              style={{
                fontFamily: LANDING_DISPLAY,
                fontWeight: LANDING_H2_WEIGHT,
                fontSize: LANDING_H2,
                letterSpacing: LANDING_H2_TRACKING,
              }}
            >
              Governance mit <span style={{ color: LANDING_ACCENT }}>Ansprechpartner.</span>
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
                className="inline-flex items-center gap-2 rounded-full bg-[var(--rs-cyan-primary)] px-7 py-3.5 font-semibold text-[var(--rs-bg-primary)] transition hover:bg-[var(--rs-cyan-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rs-cyan-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--rs-bg-primary)]"
              >
                {CTA.enterprise} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                /* Anker aus der Preisseite: die Karten tragen dort `plan-<id>`.
                   Abgeleitet statt getippt, damit ein umbenannter Tarif die
                   Verlinkung nicht still ins Leere laufen laesst. */
                to={`/pricing#plan-${tier.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--rs-border-primary)] px-7 py-3.5 font-medium text-[var(--rs-text-primary)] transition hover:border-[var(--rs-titanium-silver)] hover:text-[var(--rs-cyan-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rs-cyan-primary)]/50"
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
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[var(--rs-text-secondary)]">IM ZUGANG ENTHALTEN</p>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {accessPoints.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm leading-relaxed text-white/60">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--rs-titanium-silver)]" />
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
      <Icon className="h-5 w-5 text-[var(--rs-titanium-silver)]" strokeWidth={1.5} />
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/50">{text}</p>
    </div>
  );
}
