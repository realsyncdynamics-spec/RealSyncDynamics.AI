import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { HeroEarthBackdrop } from './HeroEarthBackdrop';
import {
  LANDING_ACCENT,
  LANDING_ACCENT_SOFT,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_SERIF,
  LANDING_TEXT,
} from './landing-theme';
import { MODE_ACCENT, MODE_MUTED, MODE_TEXT, modeVeil } from './landing-mode';

const HERO_PLANS = [
  { label: 'Free Audit', href: '/audit', featured: true },
  { label: 'Starter', price: '79€', href: '/checkout/starter' },
  { label: 'Growth', price: '249€', href: '/checkout/growth', highlighted: true },
  { label: 'Agency', price: '699€', href: '/checkout/agency' },
  { label: 'Enterprise', href: '/contact-sales?tier=enterprise&source=home-hero-pricing' },
] as const;

const PROOF = ['EU AI Act', 'DSGVO', 'ISO 42001', 'Evidence native'] as const;

export function OriginalComplianceHero() {
  return (
    <section
      id="product"
      className="relative isolate min-h-[min(920px,100svh)] overflow-hidden border-b"
      style={{ borderColor: 'rgba(255,255,255,.07)', backgroundColor: '#0a0a0b' }}
      aria-labelledby="original-hero-heading"
      data-testid="original-compliance-hero"
    >
      <HeroEarthBackdrop />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            `linear-gradient(90deg, ${modeVeil(100)} 0%, ${modeVeil(98)} 31%, ${modeVeil(84)} 48%, ${modeVeil(28)} 69%, transparent 86%)`,
            'linear-gradient(180deg, rgba(10,10,11,.20) 0%, transparent 18%, transparent 72%, rgba(10,10,11,.92) 100%)',
          ].join(','),
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[min(920px,100svh)] max-w-[1280px] items-center px-[4vw] pb-16 pt-32 sm:pb-20 sm:pt-36">
        <div className="w-full max-w-[760px]">
          <p
            className="mb-5 text-[10px] font-semibold uppercase tracking-[0.26em] sm:text-[11px]"
            style={{ fontFamily: LANDING_MONO, color: MODE_ACCENT }}
          >
            AI GOVERNANCE OPERATIONS OS · EUROPE
          </p>

          <h1
            id="original-hero-heading"
            className="max-w-[760px] text-balance leading-[.98] tracking-[-0.035em]"
            style={{
              fontFamily: LANDING_SERIF,
              fontWeight: 400,
              fontSize: 'clamp(3rem, 1.8rem + 4.4vw, 5.6rem)',
              color: MODE_TEXT,
            }}
          >
            <span className="block">AI Compliance</span>
            <span className="mt-[.06em] block">
              Operations OS for{' '}
              <span style={{ color: MODE_ACCENT }}>Europe</span>
            </span>
          </h1>

          <p
            className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.23em] sm:text-[13px]"
            style={{ fontFamily: LANDING_MONO, color: MODE_ACCENT }}
            aria-label="DISCOVER → CLASSIFY → ENFORCE → PROVE"
          >
            {['DISCOVER', 'CLASSIFY', 'ENFORCE', 'PROVE'].map((step, index) => (
              <span key={step} className="inline-flex items-center gap-3">
                {index > 0 && <span aria-hidden="true">→</span>}
                <span>{step}</span>
              </span>
            ))}
          </p>

          <div className="mt-7 max-w-[690px] space-y-1.5 text-[clamp(.92rem,.84rem+.32vw,1.08rem)] leading-relaxed" style={{ color: MODE_MUTED }}>
            <p>EU-Hosted Runtime · Supabase Frankfurt · Evidence Vault</p>
            <p>Hash-Chain · Ollama EU-lokal · Multi-Tenant RLS · n8n · Stripe</p>
          </div>

          <div className="mt-10 flex flex-wrap gap-2.5" role="group" aria-label="Pläne und Einstiege">
            {HERO_PLANS.map((plan) => (
              <Link
                key={plan.label}
                to={plan.href}
                data-hero-plan={plan.label.toLowerCase().replace(/\s+/g, '-')}
                className={[
                  'group relative inline-flex min-h-[64px] min-w-[92px] flex-col items-center justify-center rounded-[10px] border px-5 py-3 text-center transition duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsd-accent,#d6ad68)]',
                  plan.featured ? 'min-w-[128px]' : '',
                ].join(' ')}
                style={{
                  borderColor: plan.highlighted ? MODE_ACCENT : 'rgba(255,255,255,.24)',
                  background: plan.featured
                    ? 'linear-gradient(180deg, var(--rsd-accent-soft,#e8c98a), var(--rsd-accent,#d6ad68))'
                    : modeVeil(54),
                  color: plan.featured ? '#0a0a0b' : MODE_TEXT,
                  boxShadow: plan.featured
                    ? '0 12px 30px rgba(0,0,0,.34), 0 0 28px rgba(214,173,104,.22)'
                    : plan.highlighted
                      ? '0 0 0 1px rgba(214,173,104,.28), inset 0 0 24px rgba(214,173,104,.06)'
                      : 'inset 0 1px 0 rgba(255,255,255,.04)',
                }}
              >
                <span className="text-[15px] font-medium">{plan.label}</span>
                {'price' in plan && plan.price ? (
                  <strong
                    className="mt-0.5 text-[18px] font-semibold"
                    style={{ color: plan.highlighted ? MODE_ACCENT : MODE_TEXT }}
                  >
                    {plan.price}
                  </strong>
                ) : null}
              </Link>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Link
              to="/app/dashboard"
              className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[.14em] transition hover:opacity-80"
              style={{ fontFamily: LANDING_MONO, color: MODE_ACCENT }}
            >
              Live Dashboard ansehen <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <div className="flex flex-wrap gap-2">
              {PROOF.map((label) => (
                <span
                  key={label}
                  className="rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[.16em]"
                  style={{
                    fontFamily: LANDING_MONO,
                    color: MODE_MUTED,
                    borderColor: 'rgba(255,255,255,.12)',
                    backgroundColor: 'rgba(255,255,255,.025)',
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-24"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(10,10,11,.88))' }}
      />
    </section>
  );
}
