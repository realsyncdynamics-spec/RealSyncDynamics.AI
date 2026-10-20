import { useCallback, useEffect, useState, type CSSProperties, type ChangeEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BETA, betaSignupHref, isBetaPlan } from '../../../config/beta';
import { COMPANY } from '../../../config/company';
import { tierById, type PricingTier } from '../../../config/pricing';
import { CTA } from '../../../content/runtimeVocab';
import { checkoutHrefForPlan, formatPriceEur, pricingTaxNote, PLANS, type Plan } from '@/shared/pricing';
import { readStored, useLandingMode, type LandingMode } from '../landing-mode';

/**
 * Zustand + abgeleitete Werte für Landing v6 (Claude-Design-Handoff 13.10.2026).
 *
 * Bewusste Abweichungen vom Design-Prototyp (Claims vs. Runtime):
 *  - Kein simulierter Checkout, Login, Demo-Kalender oder Fake-Dashboard.
 *    Alle CTAs führen auf echte Routen (/audit, /login, /contact-sales,
 *    Beta-Registrierung bzw. /checkout über die Pricing-SSoT).
 *  - Preise, Planliste, Steuerhinweis und Jahres-Toggle kommen aus
 *    `shared/pricing.ts` + `config/beta.ts`, nicht aus Design-Konstanten.
 *  - Die KI-Act-Einordnung läuft rein lokal; es wird keine E-Mail erhoben,
 *    weil nichts versendet wird.
 */

const SOURCE = 'landing-v6';
/** Kurzer Nettopreis-Hinweis für Hero-Preiszeile und Preis-Sektion. */
export const VAT_HINT = 'zzgl. USt.';
const ENTERPRISE_HREF = `/contact-sales?tier=enterprise&source=${SOURCE}`;

type RiskId = 'high' | 'trans' | 'min';
const USE_CASES: { id: string; label: string; risk: RiskId; ref: string }[] = [
  { id: 'hr', label: 'Bewerber-Screening', risk: 'high', ref: 'Anhang III Nr. 4' },
  { id: 'credit', label: 'Kreditwürdigkeitsprüfung', risk: 'high', ref: 'Anhang III Nr. 5' },
  { id: 'bio', label: 'Biometrische Identifizierung', risk: 'high', ref: 'Anhang III Nr. 1' },
  { id: 'edu', label: 'Prüfungsbewertung (Bildung)', risk: 'high', ref: 'Anhang III Nr. 3' },
  { id: 'chat', label: 'Kunden-Chatbot', risk: 'trans', ref: 'Art. 50' },
  { id: 'gen', label: 'Content-Generierung (GenAI)', risk: 'trans', ref: 'Art. 50' },
  { id: 'doc', label: 'Dokumentenanalyse intern', risk: 'min', ref: '—' },
  { id: 'code', label: 'Code-Assistenz', risk: 'min', ref: '—' },
];
const RISK: Record<RiskId, [string, string]> = {
  high: ['Hochrisiko', '#E5484D'],
  trans: ['Transparenzpflicht', '#F5A524'],
  min: ['Minimal', '#10B981'],
};

const STAGES = [
  { n: '01', k: 'PRÜFEN', t: 'Scan', d: 'Website, Cookies, Tracker und KI-Einbindung erfassen.', preview: false },
  { n: '02', k: 'EINORDNEN', t: 'Einordnen', d: 'Risiken mit Paragraphenbezug klar benennen.', preview: false },
  { n: '03', k: 'HANDELN', t: 'Beheben', d: 'Konkrete Schritte, was Sie ändern müssen.', preview: false },
  { n: '04', k: 'NACHWEISEN', t: 'Dokumentieren', d: 'Alles dokumentieren, damit Sie es vorlegen können.', preview: false },
  // SSoT: dauerhafte Domain-Überwachung ist „Coming Soon" → als Preview kennzeichnen.
  { n: '05', k: 'BEOBACHTEN', t: 'Monitoring', d: 'Laufend prüfen, wenn sich etwas ändert.', preview: true },
  { n: '06', k: 'AUSWERTEN', t: 'Berichten', d: 'Klare Übersicht für Sie, den Datenschutzbeauftragten oder den Prüfer.', preview: false },
];
const AGENT_NO = [
  'seine eigene Identität bestimmen',
  'seinen Tenant wählen',
  'Policies außer Kraft setzen',
  'eigene kritische Aktionen genehmigen',
];
// Beispielwerte — im UI ausdrücklich als „Demo-Daten" gekennzeichnet.
const KPIS = [
  { l: 'Aktive KI-Systeme', v: '12' },
  { l: 'Policy-Entscheidungen · 7 Tage', v: '184' },
  { l: 'Offene Freigaben', v: '3', c: 'var(--rs-acc)' },
  { l: 'Blockierte Ausführungen', v: '2', c: '#E5484D' },
  { l: 'Evidence-Einträge', v: '1.248' },
];
type Decision = 'allow' | 'warn' | 'block' | 'require_approval' | 'log_only';
const DECISIONS: { t: string; agent: string; action: string; r: Decision }[] = [
  { t: '09:41:12', agent: 'finance-agent', action: 'payment.create', r: 'require_approval' },
  { t: '09:40:57', agent: 'support-agent', action: 'model.invoke · external', r: 'block' },
  { t: '09:40:31', agent: 'code-assistant', action: 'repo.pr.describe', r: 'allow' },
  { t: '09:39:48', agent: 'marketing-flow', action: 'content.publish', r: 'warn' },
  { t: '09:39:02', agent: 'chat-assistant', action: 'model.invoke · eu-local', r: 'log_only' },
];
const DEC_C: Record<Decision, string> = {
  allow: '#10B981',
  warn: '#F5A524',
  block: '#E5484D',
  require_approval: 'var(--rs-acc)',
  log_only: 'var(--rs-fg3)',
};
const CHAIN = [
  { n: '48213', time: '14:02:11 UTC', event: 'Modell-Freigabe · credit-scoring-v3', hash: 'a3f9…c41e', prev: '7b20…9d05', last: false },
  { n: '48214', time: '14:02:13 UTC', event: 'Policy PII-Filter angewendet', hash: 'e81c…02ab', prev: 'a3f9…c41e', last: false },
  { n: '48215', time: '14:05:47 UTC', event: 'Human Review · bestätigt', hash: '5d6e…f713', prev: 'e81c…02ab', last: false },
  { n: '48216', time: '14:06:02 UTC', event: 'Evidence versiegelt', hash: '0c9a…b8d2', prev: '5d6e…f713', last: true },
];
const CHECK_QS = [
  'Wissen Sie, welche KI-Anbieter in Ihrem Unternehmen genutzt werden?',
  'Wissen Sie, welche Systeme oder Agenten selbstständig Aktionen ausführen können?',
  'Ist geregelt, ob Kundendaten in KI-Systeme gelangen dürfen?',
  'Gibt es für jedes KI-System eine verantwortliche Person?',
  'Gibt es zentrale Regeln, die für alle KI-Anbieter gelten?',
  'Ist kontrolliert, welche Daten an welchen Provider gehen dürfen?',
  'Brauchen kritische KI-Aktionen eine menschliche Freigabe?',
  'Werden KI-Entscheidungen und Ausführungen nachvollziehbar protokolliert?',
];
const ROLES: [string, string][] = [
  ['provider', 'Anbieter'],
  ['deployer', 'Betreiber'],
  ['both', 'Beides'],
];
const COUNTS: [string, string][] = [
  ['s', '1–5'],
  ['m', '6–25'],
  ['l', '26+'],
];
const INDUSTRIES = [
  ['', 'Bitte wählen'],
  ['fin', 'Finanzdienstleistung'],
  ['ins', 'Versicherung'],
  ['health', 'Gesundheitswesen'],
  ['public', 'Öffentlicher Sektor'],
  ['ind', 'Industrie'],
  ['retail', 'Handel'],
  ['hr', 'Personaldienstleistung'],
  ['saas', 'Software / SaaS'],
  ['other', 'Sonstige'],
].map(([v, l]) => ({ v, l }));
const SIZES = [
  ['', 'Bitte wählen'],
  ['1', '1–49'],
  ['2', '50–249'],
  ['3', '250–999'],
  ['4', '1.000+'],
].map(([v, l]) => ({ v, l }));

const PLAN_IDS = ['starter', 'growth', 'agency', 'enterprise'] as const;
type SellableId = 'starter' | 'growth' | 'agency';

function yearlyAvailable(plan: Plan): boolean {
  return plan.yearlyPlanKey !== null && plan.yearlyCheckoutUnavailable !== true && plan.price.yearlyEur !== null;
}
const YEARLY_BILLING_ENABLED = PLANS.some(yearlyAvailable);

function bullets(tier: PricingTier): string[] {
  return tier.bullets.filter((b) => b.trim().length > 0).slice(0, 4);
}

function planHref(plan: Plan, interval: 'month' | 'year', source: string): string {
  if (isBetaPlan(plan.id)) return betaSignupHref(plan.id, source);
  return checkoutHrefForPlan(plan, { interval, source });
}

interface AuditState {
  company: string;
  industry: string;
  size: string;
  role: string;
  count: string;
  uses: string[];
}
const EMPTY_AUDIT: AuditState = { company: '', industry: '', size: '', role: '', count: '', uses: [] };

export function useLandingV6() {
  const navigate = useNavigate();
  const { setMode } = useLandingMode();
  // Wie v5: dunkel/Gold als Start, erst eine gespeicherte Wahl ändert das
  // (eigener State, weil `mode` ohne Speicherwert dem OS folgt).
  const [stored, setStored] = useState<LandingMode | null>(() => (typeof window === 'undefined' ? null : readStored()));
  const theme: 'dark' | 'light' = stored === 'light' ? 'light' : 'dark';
  const accent: 'gold' | 'cyan' = stored === 'cyan' ? 'cyan' : 'gold';

  const [vw, setVw] = useState<number>(() => (typeof window === 'undefined' ? 1400 : window.innerWidth));
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState(false);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [auditStep, setAuditStep] = useState(0);
  const [audit, setAudit] = useState<AuditState>(EMPTY_AUDIT);
  const [check, setCheck] = useState<Record<number, string>>({});

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.85);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModal(false);
        setMenu(false);
      }
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);
    onResize();
    onScroll();
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = modal || menu ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [modal, menu]);

  const mobile = vw < 760;
  const yearly = YEARLY_BILLING_ENABLED && cycle === 'yearly';

  // ---- Styles aus dem Design (dynamisch, daher hier statt CSS)
  const pill = (active: boolean): CSSProperties =>
    active
      ? { display: 'flex', padding: '6px', borderRadius: '9999px', background: 'var(--rs-acc)', color: '#FFFDF6', transition: 'all 200ms' }
      : { display: 'flex', padding: '6px', borderRadius: '9999px', opacity: 0.6, transition: 'all 200ms' };
  const seg = (active: boolean): CSSProperties => ({
    padding: '8px 16px',
    borderRadius: '9999px',
    border: 0,
    cursor: 'pointer',
    fontSize: 'var(--fs-small)',
    background: active ? 'var(--rs-acc)' : 'transparent',
    color: active ? '#FFFDF6' : 'var(--rs-fg2)',
    transition: 'all 200ms cubic-bezier(.2,.8,.2,1)',
    whiteSpace: 'nowrap',
  });
  const chip = (active: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minHeight: '44px',
    padding: '0 14px',
    borderRadius: '8px',
    border: active ? '1px solid var(--rs-acc)' : '1px solid var(--rs-chip-b)',
    background: active ? 'var(--rs-acc-soft)' : 'var(--rs-chip)',
    color: 'var(--rs-fg)',
    fontSize: '14px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 200ms',
  });
  const box = (active: boolean): CSSProperties => ({
    flex: 'none',
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: active ? '1px solid var(--rs-acc)' : '1px solid var(--rs-chip-b)',
    background: active ? 'var(--rs-acc)' : 'transparent',
    color: active ? '#FFFDF6' : 'transparent',
  });
  const badge = (r: RiskId): CSSProperties => ({
    flex: 'none',
    padding: '3px 10px',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: 600,
    color: RISK[r][1],
    background: RISK[r][1] + '1F',
    whiteSpace: 'nowrap',
  });
  const primary: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    minHeight: '48px',
    padding: '0 24px',
    borderRadius: '8px',
    border: '1px solid var(--rs-acc)',
    background: 'var(--rs-btn)',
    color: '#FFFDF6',
    fontSize: '15px',
    cursor: 'pointer',
    boxShadow: '0 0 18px var(--rs-glow)',
  };
  const input: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    height: '48px',
    padding: '0 14px',
    borderRadius: '8px',
    border: '1px solid var(--rs-chip-b)',
    background: 'var(--rs-chip)',
    color: 'var(--rs-fg)',
    fontFamily: 'inherit',
    fontSize: '16px',
    outline: 'none',
  };
  const label: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--rs-fg2)',
    minWidth: 0,
  };
  const ui = {
    input,
    label,
    primary,
    primaryOff: { ...primary, opacity: 0.4, cursor: 'not-allowed', boxShadow: 'none' } as CSSProperties,
    ghost: {
      ...primary,
      border: '1px solid var(--rs-chip-b)',
      background: 'var(--rs-chip)',
      color: 'var(--rs-fg)',
      boxShadow: 'none',
    } as CSSProperties,
  };

  // ---- Preise (SSoT + Beta)
  const card: CSSProperties = {
    padding: 'var(--card-p)',
    borderRadius: '16px',
    border: '1px solid var(--rs-line)',
    background: 'var(--rs-bg)',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  };
  const cardBtn: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 'clamp(48px,2.8vw,76px)',
    borderRadius: '8px',
    border: '1px solid var(--rs-chip-b)',
    background: 'transparent',
    color: 'var(--rs-fg)',
    fontSize: 'var(--fs-body)',
    cursor: 'pointer',
  };
  const plans = PLAN_IDS.map((id) => tierById(id))
    .filter((t): t is PricingTier => Boolean(t))
    .map((tier) => {
      const plan = tier.plan;
      const inquiry = tier.priceOnRequest || plan.purchaseMode === 'inquiry';
      const beta = BETA.active && isBetaPlan(plan.id);
      const useYearly = yearly && !inquiry && yearlyAvailable(plan);
      const listEur = useYearly && plan.price.yearlyEur !== null ? plan.price.yearlyEur : plan.price.monthlyEur;
      const priceLabel = tier.priceOnRequest ? 'Auf Anfrage' : beta ? formatPriceEur(0) : formatPriceEur(listEur);
      const featured = plan.highlight;
      return {
        id: plan.id,
        name: plan.name,
        featured,
        priceLabel,
        priceOnRequest: Boolean(tier.priceOnRequest),
        listPrice: beta && !tier.priceOnRequest ? formatPriceEur(listEur) : null,
        unit: tier.priceOnRequest ? tier.priceSuffix : useYearly ? '/ Jahr' : '/ Monat',
        billingNote: tier.priceOnRequest
          ? 'SLA nach Vereinbarung · bis zu 5 Organisationen'
          : beta
            ? `kostenlos bis ${BETA.endsLabel}`
            : useYearly
              ? 'jährlich abgerechnet'
              : 'monatlich kündbar',
        desc: plan.outcomeHeadline,
        features: bullets(tier),
        // Hero-Preiszeile: immer Monatspreis, eigene Quelle für die Trichter-Messung.
        heroPrice: tier.priceOnRequest ? 'Auf Anfrage' : beta ? formatPriceEur(0) : `${formatPriceEur(plan.price.monthlyEur)} / Monat`,
        heroListPrice: beta && !tier.priceOnRequest ? formatPriceEur(plan.price.monthlyEur) : null,
        heroHref:
          plan.id === 'enterprise'
            ? ENTERPRISE_HREF
            : inquiry
              ? checkoutHrefForPlan(plan, { source: `${SOURCE}-hero` })
              : planHref(plan, 'month', `${SOURCE}-hero`),
        cta: beta ? 'Kostenlos testen' : inquiry ? CTA.enterprise : plan.ctaLabel,
        href: inquiry
          ? checkoutHrefForPlan(plan, { source: SOURCE })
          : planHref(plan, useYearly ? 'year' : 'month', SOURCE),
        cardStyle: featured ? { ...card, border: '2px solid var(--rs-acc)', boxShadow: '0 0 28px var(--rs-glow)' } : card,
        btnStyle: featured
          ? { ...cardBtn, border: '1px solid var(--rs-acc)', background: 'var(--rs-btn)', color: '#FFFDF6' }
          : cardBtn,
      };
    });

  const taxNote = pricingTaxNote(COMPANY.taxMode);
  const pricingFoot = BETA.active
    ? `Offene Beta bis ${BETA.endsLabel}: Starter, Growth und Agency kostenlos testen – keine Kreditkarte, kein Abo. Danach gelten die durchgestrichenen Listenpreise. ${taxNote}`
    : `${taxNote} Bezahlung per Karte oder SEPA-Lastschrift über Stripe.`;
  const faqCancel = BETA.active
    ? `Während der Beta (bis ${BETA.endsLabel}) zahlen Sie nichts – kein Abo, keine Kreditkarte. Danach sind Starter, Growth und Agency monatlich kündbar.`
    : 'Ja. Starter, Growth und Agency sind monatlich kündbar.';

  // ---- KI-Act-Einordnung (lokal)
  const field = (name: 'company' | 'industry' | 'size') => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setAudit((s) => ({ ...s, [name]: value }));
  };
  const useCases = USE_CASES.map((u) => {
    const on = audit.uses.includes(u.id);
    return {
      ...u,
      on,
      style: chip(on),
      boxStyle: box(on),
      toggle: () =>
        setAudit((s) => ({ ...s, uses: on ? s.uses.filter((x) => x !== u.id) : [...s.uses, u.id] })),
    };
  });
  const pickA = (k: 'role' | 'count', value: string) => () => setAudit((s) => ({ ...s, [k]: value }));
  const roles = ROLES.map(([value, l]) => ({ label: l, on: audit.role === value, style: chip(audit.role === value), pick: pickA('role', value) }));
  const counts = COUNTS.map(([value, l]) => ({ label: l, on: audit.count === value, style: chip(audit.count === value), pick: pickA('count', value) }));
  const sel = USE_CASES.filter((u) => audit.uses.includes(u.id));
  const riskCounts = {
    high: sel.filter((u) => u.risk === 'high').length,
    trans: sel.filter((u) => u.risk === 'trans').length,
    min: sel.filter((u) => u.risk === 'min').length,
  };
  const auditRows = sel.map((u) => ({ label: u.label, ref: u.ref, risk: RISK[u.risk][0], badgeStyle: badge(u.risk) }));
  const nextSteps = (
    riskCounts.high
      ? [
          'Risikomanagementsystem und technische Dokumentation nach Anhang IV aufsetzen.',
          'Protokollierung (Art. 12) und menschliche Aufsicht (Art. 14) im Betrieb nachweisen.',
          'Konformitätsbewertung vorbereiten und Evidenz fortlaufend sichern.',
        ]
      : riskCounts.trans
        ? [
            'Nutzer transparent über KI-Interaktion und generierte Inhalte informieren (Art. 50).',
            'KI-Inventar mit Owner und Zweck vollständig pflegen.',
            'KI-Kompetenz der Mitarbeitenden dokumentieren (Art. 4).',
          ]
        : [
            'KI-Inventar mit Owner und Zweck vollständig pflegen.',
            'KI-Kompetenz der Mitarbeitenden dokumentieren (Art. 4).',
            'Neue Anwendungsfälle vor Go-live klassifizieren.',
          ]
  ).map((t, i) => ({ i: '0' + (i + 1), t }));
  const recId: SellableId = audit.count === 'l' ? 'agency' : riskCounts.high || audit.count === 'm' ? 'growth' : 'starter';
  const recPlan = PLANS.find((p) => p.id === recId);
  const recBeta = BETA.active && isBetaPlan(recId);
  const recMonthly = recPlan ? formatPriceEur(recPlan.price.monthlyEur) : '';
  const rec = {
    name: recPlan?.name ?? recId,
    price: recBeta ? `0 € in der Beta · danach ${recMonthly} / Monat` : `${recMonthly} / Monat`,
    cta: recBeta ? `${recPlan?.name ?? ''} kostenlos testen` : `${recPlan?.name ?? ''} starten`,
    reason:
      recId === 'agency'
        ? 'Für mehr als 25 KI-Systeme und mehrere Mandanten.'
        : recId === 'growth'
          ? riskCounts.high
            ? 'Hochrisiko-Systeme brauchen laufende Kontrollen, menschliche Freigaben und Annex-IV-Dokumentation.'
            : 'Passend für bis zu 25 KI-Systeme.'
          : 'Ausreichend für bis zu 5 Systeme ohne Hochrisiko-Einstufung.',
    href: recPlan ? planHref(recPlan, 'month', `${SOURCE}-classifier`) : '/pricing',
  };

  const stepLabels = ['Unternehmen', 'KI-Systeme', 'Ergebnis'];
  const canNext =
    auditStep === 0 ? audit.company.trim().length > 0 : auditStep === 1 ? audit.uses.length > 0 && !!audit.role && !!audit.count : true;
  const next = () => {
    if (!canNext) return;
    if (auditStep < 2) setAuditStep(auditStep + 1);
    else {
      setModal(false);
      navigate(`/audit?source=${SOURCE}-classifier`);
    }
  };
  const stepper = stepLabels.map((l, i) => ({
    num: i < auditStep ? '✓' : String(i + 1),
    label: l,
    current: i === auditStep,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 12px 6px 6px',
      borderRadius: '9999px',
      fontSize: '13px',
      border: '1px solid ' + (i === auditStep ? 'var(--rs-acc)' : 'var(--rs-line)'),
      color: i <= auditStep ? 'var(--rs-fg)' : 'var(--rs-fg3)',
    } as CSSProperties,
    numStyle: {
      width: '22px',
      height: '22px',
      borderRadius: '9999px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '11px',
      fontWeight: 600,
      background: i <= auditStep ? 'var(--rs-acc)' : 'var(--rs-chip)',
      color: i <= auditStep ? '#FFFDF6' : 'var(--rs-fg3)',
    } as CSSProperties,
  }));
  const panelStyle: CSSProperties = mobile
    ? { width: '100%', height: '100%', background: 'var(--rs-bg)', display: 'flex', flexDirection: 'column', animation: 'rsIn 320ms cubic-bezier(.2,.8,.2,1)' }
    : {
        width: '100%',
        maxWidth: 'min(1040px, 92vw)',
        maxHeight: '90vh',
        background: 'var(--rs-bg)',
        border: '1px solid var(--rs-line)',
        borderRadius: '16px',
        boxShadow: '0 4px 12px rgba(10,16,32,.06), 0 12px 32px rgba(10,16,32,.18)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'rsIn 320ms cubic-bezier(.2,.8,.2,1)',
      };

  // ---- Governance-Check (lokal)
  const pillBase: CSSProperties = {
    minWidth: '64px',
    minHeight: '40px',
    padding: '0 14px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: 'var(--fs-small)',
    transition: 'all 200ms cubic-bezier(.2,.8,.2,1)',
  };
  const checkQs = CHECK_QS.map((q, i) => ({
    n: '0' + (i + 1),
    q,
    opts: (
      [
        ['ja', 'Ja'],
        ['nein', 'Nein'],
        ['unklar', 'Unklar'],
      ] as const
    ).map(([value, l]) => {
      const on = check[i] === value;
      return {
        l,
        on,
        pick: () => setCheck((s) => ({ ...s, [i]: value })),
        style: on
          ? { ...pillBase, border: '1px solid var(--rs-acc)', background: 'var(--rs-acc)', color: '#FFFDF6' }
          : { ...pillBase, border: '1px solid var(--rs-chip-b)', background: 'var(--rs-chip)', color: 'var(--rs-fg)' },
      };
    }),
  }));
  const answered = Object.keys(check).length;
  const score = Object.values(check).filter((x) => x === 'ja').length;
  const lvl =
    score >= 7
      ? ['Governance etabliert', 'Die Grundlagen stehen. Jetzt geht es um laufende Nachweise und Durchsetzung zur Laufzeit.']
      : score >= 4
        ? ['Teilweise geregelt', 'Wichtige Bausteine fehlen – typischerweise zentrale Policies, Freigaben oder eine prüfbare Protokollierung.']
        : ['Handlungsbedarf', 'KI läuft weitgehend ohne zentrale Kontrolle. Ein Inventar und klare Verantwortlichkeiten sind der erste Schritt.'];
  const tone = score >= 7 ? '#10B981' : score >= 4 ? '#F5A524' : '#E5484D';

  const toggleTheme = useCallback(() => {
    const nextMode: LandingMode = theme === 'dark' ? 'light' : accent === 'cyan' ? 'cyan' : 'gold';
    setStored(nextMode);
    setMode(nextMode);
  }, [setMode, theme, accent]);

  const goPricing = () => {
    const el = document.getElementById('preise');
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 60, behavior: 'smooth' });
  };

  return {
    theme,
    accent,
    ui,
    year: new Date().getFullYear(),
    beta: { active: BETA.active, endsShort: BETA.endsLabel },
    href: {
      audit: `/audit?source=${SOURCE}`,
      // Eigene Quelle, damit der Trichter Check → Scan messbar ist.
      auditCheck: `/audit?source=${SOURCE}-check`,
      login: '/login',
      dashboard: '/app/dashboard',
      enterprise: ENTERPRISE_HREF,
      betaRibbon: betaSignupHref(BETA.testPlan, `${SOURCE}-ribbon`),
      betaHero: betaSignupHref(BETA.testPlan, `${SOURCE}-hero`),
    },
    goPricing,
    stages: STAGES,
    agentNo: AGENT_NO,
    gateChecks: ['Identity', 'Tenant', 'Policy', 'Risk', 'Approval'],
    crKpis: KPIS.map((k) => ({
      ...k,
      style: {
        fontFamily: "'Source Serif 4',Georgia,serif",
        fontSize: 'clamp(36px,2.6vw,80px)',
        lineHeight: 1,
        color: k.c || 'var(--rs-fg)',
      } as CSSProperties,
    })),
    decisions: DECISIONS.map((d) => ({
      ...d,
      style: { padding: '4px 10px', borderRadius: '4px', border: '1px solid ' + DEC_C[d.r], color: DEC_C[d.r], whiteSpace: 'nowrap' } as CSSProperties,
    })),
    chain: CHAIN.map((b) => ({
      ...b,
      link: !b.last,
      cardStyle: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: 'clamp(16px,1.1vw,32px) clamp(18px,1.2vw,36px)',
        borderRadius: '8px',
        border: b.last ? '1px solid var(--rs-acc)' : '1px solid var(--rs-line)',
        background: 'var(--rs-bg)',
        boxShadow: b.last ? '0 0 20px var(--rs-glow)' : 'none',
      } as CSSProperties,
    })),
    checkQs,
    checkEmpty: answered === 0,
    checkHas: answered > 0,
    checkScore: score,
    checkAnswered: answered,
    checkLevel: lvl[0],
    checkText: lvl[1],
    checkBar: { width: (score / 8) * 100 + '%', height: '100%', background: tone, transition: 'width 320ms cubic-bezier(.2,.8,.2,1)' } as CSSProperties,
    showLinks: vw >= 1180,
    showBurger: vw < 1180,
    // Karte bleibt Bühne, konkurriert aber nicht mit Headline und CTA.
    mapOpacity: vw >= 760 ? 0.82 : 0.5,
    showSticky: scrolled && !modal,
    menuOpen: menu,
    plans,
    yearlyEnabled: YEARLY_BILLING_ENABLED,
    // Nettopreise: RealSync ist seit 15.10.2026 regelbesteuert.
    vatHint: VAT_HINT,
    pricingFoot,
    faqCancel,
    sunStyle: pill(theme === 'light'),
    moonStyle: pill(theme === 'dark'),
    toggleLabel: theme === 'dark' ? 'Hellen Modus aktivieren' : 'Dunklen Modus aktivieren',
    toggleTheme,
    toggleMenu: () => setMenu((m) => !m),
    isYearly: yearly,
    cycleMonthlyStyle: seg(!yearly),
    cycleYearlyStyle: seg(yearly),
    setMonthly: () => setCycle('monthly'),
    setYearly: () => setCycle('yearly'),
    openClassifier: () => {
      setAuditStep(0);
      setMenu(false);
      setModal(true);
    },
    closeModal: () => setModal(false),
    stop: (e: MouseEvent) => e.stopPropagation(),
    modalOpen: modal,
    modalKicker: 'EU AI ACT · VORLÄUFIGE EINORDNUNG',
    modalTitle: 'KI-Systeme einordnen',
    panelStyle,
    scrimPad: mobile ? '0' : '24px',
    showStepper: true,
    stepper,
    showFooter: modal,
    showBack: auditStep > 0,
    back: () => setAuditStep((s) => Math.max(0, s - 1)),
    next,
    nextLabel: auditStep === 0 ? 'Weiter' : auditStep === 1 ? 'Ergebnis anzeigen' : 'Website-Check starten',
    canNext,
    nextStyle: canNext ? ui.primary : ui.primaryOff,
    isAudit0: modal && auditStep === 0,
    isAudit1: modal && auditStep === 1,
    isAudit2: modal && auditStep === 2,
    audit,
    sa: { company: field('company'), industry: field('industry'), size: field('size') },
    industries: INDUSTRIES,
    sizes: SIZES,
    useCases,
    roles,
    counts,
    riskCounts,
    auditRows,
    nextSteps,
    rec,
    auditCompany: audit.company || 'Ihr Unternehmen',
    auditRoleLabel: (ROLES.find((r) => r[0] === audit.role) || ['', '–'])[1],
    auditCountLabel: (COUNTS.find((r) => r[0] === audit.count) || ['', '–'])[1],
  };
}

export type LandingV6Values = ReturnType<typeof useLandingV6>;
