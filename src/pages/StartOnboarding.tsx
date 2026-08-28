import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import {
  INDUSTRIES,
  JOBS,
  type IndustryId,
  type JobId,
  type OnboardingProfile,
  art50Required,
  defaultChannels,
  defaultJobsFor,
  furnitureDefaults,
  lockedLimitsFor,
  suggestPlan,
} from '@/shared/onboarding';
import { ART50_SENTENCE_DE } from '@/shared/onboarding-copy.de';
import { checkoutHrefForPlan, formatPriceEur, planById } from '@/shared/pricing';

type Step = 0 | 1 | 2 | 3;

export function StartOnboarding() {
  const [params] = useSearchParams();
  const sourceUrl = params.get('domain') ?? params.get('source_url') ?? undefined;
  const [step, setStep] = useState<Step>(0);
  const [industry, setIndustry] = useState<IndustryId | null>(null);
  const [vertical, setVertical] = useState<'furniture' | 'general' | undefined>();
  const [jobs, setJobs] = useState<JobId[]>([]);

  const profile: OnboardingProfile | null = useMemo(() => {
    if (!industry || jobs.length === 0) return null;
    if (vertical === 'furniture') {
      return { ...furnitureDefaults(), jobs, source_url: sourceUrl };
    }
    return {
      industry,
      vertical,
      jobs,
      tone: industry === 'praxis' || industry === 'agentur' ? 'formal' : 'plain',
      locked_limits: lockedLimitsFor(industry, jobs),
      channels: defaultChannels(jobs),
      plan_suggested: suggestPlan({ industry, jobs }),
      source_url: sourceUrl,
    };
  }, [industry, jobs, sourceUrl, vertical]);

  const plan = profile ? planById(profile.plan_suggested) : null;

  return (
    <div className="min-h-screen bg-[rgb(3,7,18)] text-white">
      <SEOHead title="Betrieb einrichten — RealSyncDynamics.AI" canonical="/start" />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/audit" className="inline-flex items-center gap-2 text-sm text-white/50">
          <ArrowLeft className="h-4 w-4" /> Zum Scan
        </Link>
        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.25em] text-[#e8c98a]">
          Schritt {step + 1} von 4
        </p>
        <h1 className="mt-3 text-3xl tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
          Was soll RealSync zuerst übernehmen?
        </h1>
        {profile && plan && (
          <p className="mt-3 text-sm text-white/50" data-testid="onboarding-live-line">
            {INDUSTRIES.find((i) => i.id === profile.industry)?.label} · {profile.jobs.join(' + ')} ·{' '}
            {plan.name} {formatPriceEur(plan.price.monthlyEur)}
            {profile.channels.whatsapp === 'off' ? ' · WhatsApp später' : ''}
          </p>
        )}

        {step === 0 && (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {INDUSTRIES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setIndustry(item.id);
                  setJobs(defaultJobsFor(item.id));
                  if (item.id !== 'shop') setVertical(undefined);
                  setStep(1);
                }}
                className="rounded-2xl border border-white/10 p-5 text-left hover:border-[#e8c98a]/50"
              >
                <div className="font-semibold">{item.label}</div>
                <p className="mt-1 text-sm text-white/45">{item.hint}</p>
              </button>
            ))}
          </div>
        )}

        {step === 1 && industry === 'shop' && !vertical && (
          <div className="mt-8 space-y-3">
            <p className="text-sm text-white/60">Welches Sortiment?</p>
            <button type="button" className="block w-full rounded-2xl border border-white/10 p-5 text-left" onClick={() => setVertical('furniture')}>
              Möbel / Küche / Einrichtung
            </button>
            <button type="button" className="block w-full rounded-2xl border border-white/10 p-5 text-left" onClick={() => setVertical('general')}>
              Allgemeiner Laden
            </button>
          </div>
        )}

        {step === 1 && (industry !== 'shop' || vertical) && (
          <div className="mt-8 space-y-3">
            {JOBS.map((job) => {
              const on = jobs.includes(job.id);
              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setJobs((current) => (on ? current.filter((id) => id !== job.id) : [...current, job.id]))}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-5 text-left ${
                    on ? 'border-[#e8c98a]/60 bg-[#e8c98a]/10' : 'border-white/10'
                  }`}
                >
                  <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded border border-white/30">
                    {on && <Check className="h-3 w-3" />}
                  </span>
                  <span>
                    <span className="block font-semibold">{job.label}</span>
                    <span className="text-sm text-white/45">{job.hint}</span>
                  </span>
                </button>
              );
            })}
            <button type="button" disabled={jobs.length === 0} onClick={() => setStep(2)} className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#f0e6d2] px-6 py-3 text-sm font-semibold text-[#1a1714] disabled:opacity-40">
              Weiter <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === 2 && profile && (
          <div className="mt-8 space-y-4 text-sm text-white/70">
            <p>Grenzen, die der Bot nicht unterläuft:</p>
            <ul className="space-y-2">
              {profile.locked_limits.map((limit) => (
                <li key={limit} className="rounded-xl border border-white/10 px-4 py-3">
                  {limit === 'art50' ? ART50_SENTENCE_DE : limit}
                </li>
              ))}
            </ul>
            {art50Required(profile.jobs) && (
              <p className="text-xs text-white/40">Art. 50 ist nicht abwählbar, sobald ein Kanal an ist.</p>
            )}
            <button type="button" onClick={() => setStep(3)} className="inline-flex items-center gap-2 rounded-full bg-[#f0e6d2] px-6 py-3 text-sm font-semibold text-[#1a1714]">
              Zusammenfassung <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === 3 && profile && plan && (
          <div className="mt-8 space-y-5">
            <div className="rounded-2xl border border-white/10 p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#e8c98a]">Empfohlen</p>
              <p className="mt-2 text-2xl font-semibold">
                {plan.name} {formatPriceEur(plan.price.monthlyEur)}
                <span className="ml-2 text-sm font-normal text-white/45">/ Monat</span>
              </p>
              <p className="mt-2 text-sm text-white/50">{plan.outcomeHeadline}</p>
              <p className="mt-4 text-xs text-white/40">
                Kanäle starten auf Test. Live erst nach Checkliste. Meta- und Minutenpreise sind Verbrauch.
              </p>
            </div>
            <a href={checkoutHrefForPlan(plan.id, { source: 'start-onboarding' })} className="inline-flex items-center gap-2 rounded-full bg-[#f0e6d2] px-6 py-3 text-sm font-semibold text-[#1a1714]">
              Dashboard einrichten <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
