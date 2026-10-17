// Angebotstext für das kostenlose Konto (E-F6, `.claude/os-funnel/PLAN.md`):
// eine Quelle für FreePlanPanel, TrialOfferPage und PostRegisterOnboardingPage.
// Tage und Preise kommen aus der Pricing-SSoT, hier steht nur der Wortlaut.
import { formatPriceEur, planById } from '@/shared/pricing';

export const FREE_ACCOUNT_HEADLINE = 'Dauerhaft kostenlos. Kein Zeitdruck.';

/** „Growth 14 Tage kostenlos testen“ — Tage aus `growth.trialDays`. */
export function growthTrialOfferLabel(): string {
  return `Growth ${planById('growth').trialDays} Tage kostenlos testen`;
}

/** „Starter ab 79 € / Monat“ — Preis aus `starter.price.monthlyEur`. */
export function starterFromPriceLabel(): string {
  return `Starter ab ${formatPriceEur(planById('starter').price.monthlyEur)} / Monat`;
}
