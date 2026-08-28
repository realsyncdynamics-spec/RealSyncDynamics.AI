/**
 * Q&A-Onboarding → Dashboard-Schalter.
 * Keine Preise hier. Plan-Empfehlung nur als PlanId.
 * Keine Runtime-Imports.
 */

/** Spiegel der verkaufbaren Plan-IDs — keine Preisimporte. */
export type SuggestedPlanId = 'starter' | 'growth' | 'agency' | 'enterprise';

export type IndustryId =
  | 'handwerk'
  | 'praxis'
  | 'agentur'
  | 'shop'
  | 'gastro'
  | 'immo'
  | 'sonst';

export type ShopVertical = 'furniture' | 'general';

export type JobId = 'site' | 'chat' | 'wa' | 'phone' | 'proof';

export type ChannelState = 'off' | 'test' | 'live';

export type SiteSet = 'landing' | 'small_site' | 'booking' | 'showcase';

export type ToneId = 'plain' | 'formal' | 'friendly' | 'site';

export interface OnboardingProfile {
  industry: IndustryId;
  vertical?: ShopVertical;
  jobs: JobId[];
  site?: {
    set: SiteSet;
    photos: 'own' | 'templates' | 'later';
    worlds?: string[];
  };
  chat?: string[];
  wa?: 'later' | 'prepare' | 'live_when_ready';
  phone?: 'callback' | 'slots' | 'handoff';
  tone: ToneId;
  locked_limits: string[];
  extra_limit?: string;
  channels: { web: ChannelState; whatsapp: ChannelState; voice: ChannelState };
  plan_suggested: SuggestedPlanId;
  source_url?: string;
  clients?: 'only_us' | 'we_plus_clients';
}

export const INDUSTRIES: { id: IndustryId; label: string; hint: string }[] = [
  { id: 'handwerk', label: 'Handwerk & Montage', hint: 'Sanitär, Elektro, Dach, SHK, Bau' },
  { id: 'praxis', label: 'Praxis & Gesundheit', hint: 'Arzt, Zahn, Physio, Heilpraktiker' },
  { id: 'agentur', label: 'Agentur & Beratung', hint: 'Marketing, IT, Steuer, Kanzlei' },
  { id: 'shop', label: 'Shop & lokale Ware', hint: 'Einzelhandel, D2C, Showroom, Möbel' },
  { id: 'gastro', label: 'Gastro & Hotellerie', hint: 'Restaurant, Café, Pension' },
  { id: 'immo', label: 'Immobilien & Hausverwaltung', hint: 'Makler, HV, WEG' },
  { id: 'sonst', label: 'Anderes Unternehmen', hint: 'Dienstleistung, Verein, Kommune' },
];

export const JOBS: { id: JobId; label: string; hint: string }[] = [
  { id: 'site', label: 'Neue Website / Landing', hint: 'Eine klare Seite, die gefunden wird' },
  { id: 'chat', label: 'Chat auf der Website', hint: 'Öffnung, Leistung, Kontakt — mit KI-Hinweis' },
  { id: 'wa', label: 'WhatsApp', hint: 'Dieselbe Logik auf der Kundennummer' },
  { id: 'phone', label: 'Telefon annehmen', hint: 'Annahme, Rückruf, einfacher Termin' },
  { id: 'proof', label: 'Nachweis', hint: 'DSGVO + AI-Act, prüfbarer Bot' },
];

export const ART50_LIMIT = 'art50';

const DEFAULT_JOBS: Record<IndustryId, JobId[]> = {
  handwerk: ['site', 'chat', 'proof'],
  praxis: ['site', 'chat', 'proof'],
  agentur: ['site', 'proof'],
  shop: ['site', 'chat', 'proof'],
  gastro: ['site', 'chat'],
  immo: ['site', 'chat', 'proof'],
  sonst: ['site', 'proof'],
};

export function defaultJobsFor(industry: IndustryId): JobId[] {
  return [...DEFAULT_JOBS[industry]];
}

export function art50Required(jobs: readonly JobId[]): boolean {
  return jobs.includes('chat') || jobs.includes('wa') || jobs.includes('phone');
}

export function lockedLimitsFor(industry: IndustryId, jobs: readonly JobId[]): string[] {
  const limits = new Set<string>(['no_invented_price']);
  if (art50Required(jobs)) limits.add(ART50_LIMIT);
  if (industry === 'praxis') {
    limits.add('no_diagnosis');
    limits.add('emergency_to_human');
  }
  if (industry === 'handwerk') {
    limits.add('no_remote_diagnosis');
    limits.add('no_calendar_promise');
  }
  if (industry === 'shop') {
    limits.add('no_delivery_promise');
    limits.add('complaint_to_human');
    limits.add('no_safety_certificate');
  }
  if (industry === 'immo') limits.add('no_legal_advice');
  if (industry === 'gastro') limits.add('no_allergen_guess');
  if (industry === 'agentur') limits.add('no_legal_or_tax_advice');
  return [...limits];
}

export interface SuggestPlanInput {
  jobs: readonly JobId[];
  industry: IndustryId;
  siteSet?: SiteSet;
  clients?: 'only_us' | 'we_plus_clients';
  extraDomain?: boolean;
}

export function suggestPlan(input: SuggestPlanInput): SuggestedPlanId {
  if (input.industry === 'agentur' && input.clients === 'we_plus_clients') {
    return 'agency';
  }
  const operate =
    input.jobs.includes('wa') ||
    input.jobs.includes('phone') ||
    input.siteSet === 'small_site' ||
    input.siteSet === 'booking' ||
    input.extraDomain === true;
  if (operate) return 'growth';
  return 'starter';
}

export function defaultChannels(jobs: readonly JobId[]): OnboardingProfile['channels'] {
  return {
    web: jobs.includes('chat') || jobs.includes('site') ? 'test' : 'off',
    whatsapp: jobs.includes('wa') ? 'test' : 'off',
    voice: jobs.includes('phone') ? 'test' : 'off',
  };
}

export function canGoLive(args: {
  checklistDone: number;
  checklistTotal: number;
  art50Visible: boolean;
  jobs: readonly JobId[];
}): boolean {
  if (args.checklistDone < args.checklistTotal) return false;
  if (art50Required(args.jobs) && !args.art50Visible) return false;
  return true;
}

export function furnitureDefaults(): OnboardingProfile {
  const industry: IndustryId = 'shop';
  const jobs: JobId[] = ['site', 'chat', 'proof'];
  return {
    industry,
    vertical: 'furniture',
    jobs,
    site: { set: 'showcase', photos: 'later', worlds: ['wohnen', 'schlafen', 'kueche'] },
    chat: ['hours', 'price_frame', 'booking_request', 'callback'],
    tone: 'friendly',
    locked_limits: lockedLimitsFor(industry, jobs),
    channels: defaultChannels(jobs),
    plan_suggested: suggestPlan({ jobs, industry, siteSet: 'showcase' }),
  };
}

export const FURNITURE_CHECKLIST = [
  'Öffnungszeiten und Parken',
  'Drei Welten mit Foto oder Platzhalter',
  'Planungsgespräch: Dauer und wer zurückruft',
  'Art.-50-Text sichtbar',
  'Reklamations-Kontakt hinterlegt',
] as const;
