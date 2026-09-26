/**
 * Enterprise-Zugang der Governance-AI-Vorschau — die VIP-Stufe.
 *
 * Optisch die einzige Sektion in City-Light-Gold: Sie steht über den
 * Self-Service-Tarifen, und die Farbe sagt das, bevor der Text es tut. Den
 * Akzentwechsel besorgt `.ga-vip` auf dem Abschnitt — die Tokens darunter
 * bleiben dieselben.
 *
 * ## Jede Zahl stammt aus `shared/pricing.ts`
 *
 * Kein Preis, keine Reaktionszeit, keine Mandantenzahl steht hier als Literal
 * — die Übernahme aus `EnterpriseAccessSection` ist bewusst wörtlich. Fehlt
 * der Enterprise-Plan, rendert der Abschnitt nichts: Lieber eine fehlende
 * Sektion als eine mit erfundenen Konditionen.
 *
 * ## Die CTA ist nicht frei gewählt
 *
 * `CTA.enterprise` ist die einzige kontaktbasierte Handlungsaufforderung, die
 * dieses Produkt führt; Termin- und Gesprächssprache steht auf der
 * CI-Sperrliste (`runtimeVocab.ts`, CI-Gate `cta-enforcement.yml`).
 */
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Headset, KeyRound, ShieldCheck } from 'lucide-react';
import { tierById } from '../../config/pricing';
import { CTA } from '../../content/runtimeVocab';
import { GA_DISPLAY, GA_LINE_SOFT, GA_MONO, GA_MUTED, GA_TEXT, GA_TITAN } from './governance-ai-theme';
import { SectionEyebrow, SectionHeading, SectionIndex } from './GovernanceSectionChrome';

const SUPPORT_LABEL: Record<string, string> = {
  community: 'Community-Support',
  email: 'E-Mail-Support',
  priority: 'Priorisierter Support',
  dedicated: 'Dedizierter Ansprechpartner',
};

function AccessCard({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="ga-card ga-glass p-6">
      <Icon
        className="h-[22px] w-[22px]"
        strokeWidth={2}
        style={{ color: 'var(--ga-accent)' }}
        aria-hidden="true"
      />
      <h3
        className="mt-4 text-[21px] font-medium tracking-[-.01em]"
        style={{ fontFamily: GA_DISPLAY, color: GA_TEXT }}
      >
        {title}
      </h3>
      <p className="mt-3 text-[14px] leading-[1.6]" style={{ color: GA_MUTED }}>
        {text}
      </p>
    </div>
  );
}

export function GovernanceEnterpriseSection() {
  const tier = tierById('enterprise');
  if (!tier) return null;

  const { plan } = tier;
  const supportLabel = SUPPORT_LABEL[plan.support] ?? 'Support nach Vereinbarung';
  const accessPoints = plan.features.multi_tenant_reseller;

  return (
    <section
      id="enterprise"
      className="ga-vip relative z-[1] border-t px-[4vw] py-[clamp(72px,9vw,140px)]"
      style={{
        borderColor: GA_LINE_SOFT,
        backgroundImage:
          'radial-gradient(70% 50% at 70% 0%, rgba(242,201,138,.10) 0%, transparent 60%), linear-gradient(180deg, rgba(0,0,0,.6), rgba(0,0,0,.9))',
      }}
      aria-labelledby="enterprise-heading"
    >
      <div className="mx-auto w-full max-w-[1500px]">
        <SectionIndex number="08" label="ENTERPRISE" />

        <div className="grid gap-14 lg:grid-cols-[.85fr_1.15fr] lg:items-start">
          <div>
            <SectionEyebrow>ENTERPRISE-ZUGANG</SectionEyebrow>
            <span id="enterprise-heading">
              <SectionHeading accent="Ansprechpartner.">Governance mit</SectionHeading>
            </span>

            <p className="mt-5 text-[clamp(1.05rem,1rem+.4vw,1.25rem)] leading-[1.6]" style={{ color: GA_MUTED }}>
              {tier.tagline}
            </p>
            <p className="mt-3 text-[14px] leading-[1.6]" style={{ color: GA_TITAN }}>
              {tier.subline}
            </p>

            <div className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span
                className="text-[40px] font-normal leading-none tracking-[-.01em]"
                style={{ fontFamily: GA_DISPLAY, color: 'var(--ga-accent-lite)' }}
              >
                {tier.priceString} €
              </span>
              <span
                className="text-[11px] uppercase tracking-[.18em]"
                style={{ fontFamily: GA_MONO, color: GA_TITAN }}
              >
                {tier.priceSuffix}
              </span>
            </div>
            {plan.trialDays > 0 && (
              <p className="mt-2 text-[11px]" style={{ color: GA_TITAN }}>
                {plan.trialDays} Tage kostenlos testen.
              </p>
            )}

            <div className="mt-8 flex flex-wrap gap-3.5">
              <Link
                to="/contact-sales?source=landing-enterprise"
                className="ga-pill-sheen relative inline-flex items-center gap-2 overflow-hidden rounded-full px-[30px] py-[17px] text-[15px] font-semibold transition hover:brightness-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ga-accent-lite)]"
                style={{
                  fontFamily: GA_DISPLAY,
                  backgroundImage:
                    'linear-gradient(180deg, #fff3dc 0%, #f2c98a 50%, #b98a4a 100%)',
                  color: '#140f06',
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,.7), 0 0 0 1px rgba(242,201,138,.4), 0 12px 32px rgba(0,0,0,.5), 0 0 34px rgba(242,201,138,.3)',
                }}
              >
                {CTA.enterprise}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                /* Anker aus der Preisseite: die Karten tragen dort `plan-<id>`.
                   Abgeleitet statt getippt, damit ein umbenannter Tarif die
                   Verlinkung nicht still ins Leere laufen lässt. */
                to={`/pricing#plan-${tier.id}`}
                className="inline-flex items-center gap-2 rounded-full border px-[26px] py-[14px] text-[14px] font-medium backdrop-blur-[8px] transition hover:bg-[rgba(242,201,138,.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ga-accent-lite)]"
                style={{
                  fontFamily: GA_DISPLAY,
                  borderColor: 'var(--ga-accent-border)',
                  backgroundColor: 'rgba(0,0,0,.6)',
                  color: 'var(--ga-accent-lite)',
                }}
              >
                Leistungen im Detail
              </Link>
            </div>

            <p
              className="mt-8 text-[11px] tracking-[.14em]"
              style={{ fontFamily: GA_MONO, color: GA_TITAN }}
            >
              CUSTOM-DPA · BEHÖRDENVERTRAG · BESTELLUNG PER PO
            </p>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
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
              title="Aktive Policy Packs + Roadmap"
              text="Live: DSGVO, EU AI Act, ISO 27001, NIS2. TISAX und DORA: Roadmap / auf Anfrage — kein Fake-LIVE, kein Policy-Packs-Alias."
            />
            <AccessCard
              icon={KeyRound}
              title="Single Sign-On"
              text={`Zentrale Rechteverwaltung, ${plan.limits.evidenceStorageGb} GB Nachweisspeicher.`}
            />

            <div className="ga-card ga-glass p-6 sm:col-span-2">
              <p
                className="text-[11px] tracking-[.2em]"
                style={{ fontFamily: GA_MONO, color: 'var(--ga-accent)' }}
              >
                IM ZUGANG ENTHALTEN
              </p>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {accessPoints.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2.5 text-[14px] leading-[1.6]"
                    style={{ color: GA_MUTED }}
                  >
                    <span
                      className="mt-2 h-1 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: 'var(--ga-accent)' }}
                      aria-hidden="true"
                    />
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
