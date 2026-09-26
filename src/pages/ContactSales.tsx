import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Mail, CheckCircle2, AlertTriangle, Loader2, Send,
} from 'lucide-react';
import { normalizePlanKey, planByKey, type PlanKey } from '@/shared/pricing';
import { ensureCsrfCookie } from '../lib/csrf';
import { edgeFunctionUrl, fnFetchInit, shouldUseFnProxy } from '../lib/fn-proxy';

interface FormState {
  name: string;
  email: string;
  company: string;
  use_case: string;
  message: string;
  /** Primary company host, e.g. acme.de */
  company_domain: string;
  /** Extra hosts, comma / whitespace / semicolon separated */
  domains: string;
}

function isInquiryPlanKey(key: PlanKey | null): boolean {
  if (!key) return false;
  return planByKey(key)?.purchaseMode === 'inquiry';
}

/** Matches backend `looksLikeEnterprisePartnerIntent` signal. */
function looksLikeEnterprisePartnerIntent(...parts: Array<string | null | undefined>): boolean {
  const hay = parts.filter(Boolean).join(' ').toLowerCase();
  return /\b(enterprise|partner|scale)\b/.test(hay);
}

function isFoundingIntent(source: string, intent: string | null): boolean {
  const hay = `${source} ${intent ?? ''}`.toLowerCase();
  return /\bfounding\b/.test(hay);
}

function planBadgeLabel(key: PlanKey): string {
  const plan = planByKey(key);
  if (!plan) return key;
  const yearly = key === plan.yearlyPlanKey;
  return yearly ? `${plan.name} (Jährlich)` : plan.name;
}

/**
 * Default inquiry plan when CTA only sets intent (many legacy links use
 * `?intent=enterprise` without `?plan=`). scale → partner via normalizePlanKey.
 */
function defaultInquiryPlanFromIntent(intent: string | null): PlanKey | null {
  if (!intent) return null;
  const lower = intent.toLowerCase();
  if (/\bpartner\b/.test(lower) || /\bscale\b/.test(lower)) {
    return normalizePlanKey('partner');
  }
  if (/\benterprise\b/.test(lower)) {
    return normalizePlanKey('enterprise');
  }
  return null;
}

/** Split free-text domain list; backend also accepts a raw string. */
function parseDomainsInput(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''))
    .filter(Boolean);
}

export function ContactSales() {
  const [form, setForm] = useState<FormState>({
    name: '', email: '', company: '', use_case: '', message: '',
    company_domain: '', domains: '',
  });
  /** Inbound tracking source (utm / ?source / referrer). */
  const [inboundSource, setInboundSource] = useState<string | null>(null);
  /** Kanonischer Plan-Key aus `?plan=` / `?plan_key=` / `?tier=` / intent default. */
  const [planKey, setPlanKey] = useState<PlanKey | null>(null);
  /** True when query or CTA signals Enterprise/Partner inquiry. */
  const [inquirySignal, setInquirySignal] = useState(false);
  // `?intent=` qualifiziert den Lead (enterprise, migration, pricing, …).
  const [intent, setIntent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('source') ?? params.get('utm_source');
    if (s) {
      setInboundSource(s);
    } else if (document.referrer) {
      try {
        const ref = new URL(document.referrer);
        setInboundSource(`ref:${ref.hostname}`);
      } catch { /* ignore */ }
    }

    // Checkout redirect: `?plan=`; legacy CTAs: `?tier=` / `?plan_key=`.
    const rawPlan =
      params.get('plan') ??
      params.get('plan_key') ??
      params.get('tier');
    const fromQuery = normalizePlanKey(rawPlan);

    const i = params.get('intent')?.trim().slice(0, 100) ?? null;
    if (i) setIntent(i);
    if (i === 'policy-customization') {
      setForm((prev) => ({ ...prev, use_case: 'compliance' }));
    }

    const fromIntent = defaultInquiryPlanFromIntent(i);
    const resolved = fromQuery ?? fromIntent;
    if (resolved) setPlanKey(resolved);

    const signal =
      Boolean(rawPlan) ||
      isInquiryPlanKey(resolved) ||
      looksLikeEnterprisePartnerIntent(i, rawPlan);
    setInquirySignal(signal);
  }, []);

  const inquiryPlan = isInquiryPlanKey(planKey);
  const isInquiry = inquirySignal || inquiryPlan;
  const showFoundingCopy = !isInquiry || isFoundingIntent(inboundSource ?? '', intent);
  const showPlanBadge = isInquiry && planKey !== null;

  function handleChange(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);

    // Inquiry funnel: plan_key is REQUIRED (backend 400 PLAN_KEY_REQUIRED).
    if (isInquiry && !planKey) {
      setError('plan_key required for inquiry leads (PLAN_KEY_REQUIRED)');
      setLoading(false);
      return;
    }

    const companyDomain = form.company_domain.trim() || undefined;
    const domainsList = parseDomainsInput(form.domains);
    // Prefer array when multiple; single string also accepted by backend.
    const domainsPayload =
      domainsList.length > 1
        ? domainsList
        : domainsList.length === 1
          ? domainsList
          : undefined;

    // Inquiry: preserve utm/source when present; otherwise identify as contact-sales.
    // Backend normalizes inquiry source → `contact-sales` once plan_key is inquiry.
    const source = isInquiry
      ? (inboundSource ?? 'contact-sales')
      : (inboundSource ?? 'direct');

    try {
      // Production hosts: same-origin `/api/fn/sales-lead` + CSRF.
      // Localhost: direct `${getSupabaseUrl()}/functions/v1/sales-lead`.
      if (shouldUseFnProxy()) await ensureCsrfCookie();
      const url = edgeFunctionUrl('sales-lead');
      const resp = await fetch(url, fnFetchInit(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim() || undefined,
          email: form.email.trim(),
          company: form.company.trim() || undefined,
          use_case: form.use_case || undefined,
          message: form.message.trim() || undefined,
          company_domain: companyDomain,
          domains: domainsPayload,
          // Canonical — required for inquiry.
          ...(planKey ? { plan_key: planKey } : {}),
          // Optional alias for back-compat (metadata.tier / pre-1452 readers).
          ...(planKey ? { tier: planKey } : {}),
          source,
          intent: intent ?? undefined,
          path: '/contact-sales',
        }),
      }));
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const code = body.error?.code ? ` (${body.error.code})` : '';
        throw new Error((body.error?.message ?? `HTTP ${resp.status}`) + code);
      }
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen rs-paper bg-obsidian-950 text-titanium-100 flex items-center justify-center px-4 py-10">
        <div className="max-w-md w-full bg-obsidian-900 border border-emerald-900 p-8 text-center rounded-none">
          <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold text-titanium-50 mb-2">Danke — unser AI Agent übernimmt.</h1>
          <p className="text-sm text-titanium-300 leading-relaxed mb-5">
            Unser AI Agent verarbeitet Deine Anfrage sofort und antwortet
            automatisiert per E-Mail. Die Architektur ist parallel transparent
            dokumentiert.
          </p>
          <div className="flex flex-col gap-2">
            <Link to="/legal/sub-processors"
              className="text-sm text-security-400 hover:underline">→ Sub-Prozessoren</Link>
            <Link to="/" className="text-sm text-security-400 hover:underline">→ Zurück zur Startseite</Link>
          </div>
        </div>
      </div>
    );
  }

  const headerTitle = showFoundingCopy
    ? 'Founding Access / Kontakt'
    : 'Enterprise / Partner Anfrage';
  const headerSub = showFoundingCopy
    ? 'AI Agent antwortet sofort'
    : 'Vertrieb prüft die Anfrage';

  const headline = showFoundingCopy
    ? (planKey
      ? `${planBadgeLabel(planKey)} — Founding Access`
      : 'Founding Access anfragen')
    : (planKey ? `${planBadgeLabel(planKey)} — Anfrage` : 'Enterprise / Partner anfragen');

  const intro = showFoundingCopy
    ? '14 Tage kostenloser Enterprise-Zugang für 100 Unternehmen bis 31.12.2026. Gegenleistung: Feedback, Verbesserungsvorschläge und Screenshots von Fehlern. Onboarding komplett AI-geführt: Der Agent gleicht Deinen Use-Case mit den relevanten Features ab und schaltet den Zugang automatisiert frei.'
    : 'Individuelles Angebot für Enterprise- und Partner-Deployments — Multi-Org, SLA und vertragliche Konditionen. Kurz beschreiben, was Du brauchst; unser Team meldet sich mit einem konkreten Vorschlag.';

  const submitLabel = showFoundingCopy ? 'Founding Access anfragen' : 'Anfrage senden';

  return (
    <div className="min-h-screen rs-paper bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center">
            <Mail className="h-4 w-4 text-obsidian-950" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">{headerTitle}</div>
            <div className="text-[11px] text-titanium-400 font-medium">{headerSub}</div>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 sm:px-6 py-10">
        {showPlanBadge && planKey && (
          <div
            data-testid="contact-sales-plan-badge"
            className="mb-4 inline-flex items-center gap-2 border border-gold-600/60 bg-gold-900/20 px-3 py-1.5"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold-400">
              Plan
            </span>
            <span className="font-mono text-xs font-bold text-gold-300">
              {planBadgeLabel(planKey)}
            </span>
            <span className="font-mono text-[10px] text-titanium-500">
              {planKey}
            </span>
          </div>
        )}

        <h1 className="font-display text-3xl font-bold text-titanium-50 tracking-tight mb-2">
          {headline}
        </h1>
        <p className="text-sm text-titanium-400 leading-relaxed mb-6">
          {intro}
        </p>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3 mb-4">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="E-Mail" required>
            <input type="email" required value={form.email} onChange={handleChange('email')}
              placeholder="dein@firma.de" autoComplete="email"
              className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-sm rounded-none outline-none focus:border-security-500" />
          </Field>

          <Field label="Name">
            <input type="text" value={form.name} onChange={handleChange('name')}
              placeholder="Vor- und Nachname" autoComplete="name"
              className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-sm rounded-none outline-none focus:border-security-500" />
          </Field>

          <Field label="Firma / Kanzlei / Behörde">
            <input type="text" value={form.company} onChange={handleChange('company')}
              placeholder="z. B. Kanzlei Müller GmbH" autoComplete="organization"
              className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-sm rounded-none outline-none focus:border-security-500" />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Firmen-Domain (optional)">
              <input type="text" value={form.company_domain} onChange={handleChange('company_domain')}
                placeholder="acme.de" autoComplete="url"
                className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-sm rounded-none outline-none focus:border-security-500" />
            </Field>
            <Field label="Weitere Domains (optional)">
              <input type="text" value={form.domains} onChange={handleChange('domains')}
                placeholder="acme.com, shop.acme.de"
                className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-sm rounded-none outline-none focus:border-security-500" />
            </Field>
          </div>

          <Field label="Use-Case">
            <select value={form.use_case} onChange={handleChange('use_case')}
              className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-sm rounded-none outline-none focus:border-security-500">
              <option value="">— bitte wählen —</option>
              <option value="compliance">DSGVO / Compliance / Audit-Pflicht</option>
              <option value="legal">Anwaltskanzlei / Mandantengeheimnis</option>
              <option value="health">HealthTech / Patientendaten</option>
              <option value="fintech">FinTech / BaFin</option>
              <option value="public">Behörde / öffentlicher Sektor</option>
              <option value="agency">Agentur / System-Integrator (White-Label)</option>
              <option value="other">Etwas anderes</option>
            </select>
          </Field>

          <Field label="Was sollen wir wissen? (optional)">
            <textarea value={form.message} onChange={handleChange('message')} rows={4}
              placeholder="Kurz: was wollt Ihr automatisieren oder absichern? Welcher Zeitrahmen? Etwa wieviele Endkunden / Dokumente / Anfragen?"
              className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-sm rounded-none outline-none focus:border-security-500 resize-y" />
          </Field>

          <button type="submit" disabled={loading || !form.email || (isInquiry && !planKey)}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-security-500 hover:bg-security-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-none">
            {loading
              ? (<><Loader2 className="h-4 w-4 animate-spin" /> Senden…</>)
              : (<><Send className="h-4 w-4" /> {submitLabel}</>)}
          </button>

          <p className="text-[11px] text-titanium-500 text-center pt-2">
            Mit dem Absenden willigst Du in die Verarbeitung Deiner Anfrage gemäß unserer{' '}
            <Link to="/legal/privacy" className="text-security-400 hover:underline">Datenschutzerklärung</Link> ein.
            Source-Tracking via UTM (kein Cookie nötig).
          </p>
        </form>
      </main>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-titanium-400 uppercase tracking-wider mb-1.5 block">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}
