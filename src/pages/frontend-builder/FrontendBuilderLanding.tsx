import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { SEOHead } from '../../components/SEOHead';
import {
  LANDING_ACCENT,
  LANDING_ACCENT_SOFT,
  LANDING_BG,
  LANDING_BUTTON_TEXT,
  LANDING_CTA_GLOW,
  LANDING_H1,
  LANDING_H2,
  LANDING_LINE,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_PANEL,
  LANDING_TEXT,
} from '../../components/landing/landing-theme';
import { ensureCsrfCookie } from '../../lib/csrf';
import { edgeFunctionUrl, fnFetchInit, shouldUseFnProxy } from '../../lib/fn-proxy';
import {
  BUILDER_STEPS,
  TOTAL_STEP_COUNT,
  buildInquiryPayload,
  canAdvance,
  isHoneypotTripped,
  labelForAnswer,
  progressPercent,
  type BuilderAnswers,
  type BuilderStepId,
  type ChoiceStep,
  type KontaktForm,
} from './builderSteps';

const PROCESS_STEPS = [
  { n: '01', title: 'Anforderungen auswählen', text: 'Projektart, Ziel und Ausgangslage in wenigen Klicks.' },
  { n: '02', title: 'Umfang eingrenzen', text: 'Seitenanzahl oder laufende Unterstützung — ohne endlose Briefings.' },
  { n: '03', title: 'Stack festlegen', text: 'Webflow, Next.js, WordPress oder noch offen.' },
  { n: '04', title: 'Ergebnis + Timing', text: 'Wir zeigen, was realistisch in welchem Zeitfenster liegt.' },
  { n: '05', title: 'Anfrage absenden', text: 'Qualifizierte Anfrage — Festangebot nach kurzer Prüfung.' },
] as const;

const SERVICES = [
  {
    title: 'UI-Umsetzung',
    enthalten: 'Pixelnahe Umsetzung freigegebener Designs oder Wireframes.',
    optional: 'Design-Iteration und Varianten-Tests.',
  },
  {
    title: 'Design-System-nahe Entwicklung',
    enthalten: 'Konsistente Komponenten, Tokens und Typografie.',
    optional: 'Vollständiges Design-System von Grund auf.',
  },
  {
    title: 'Responsive',
    enthalten: 'Mobile-first Layouts für die vereinbarten Breakpoints.',
    optional: 'Zusätzliche Devices und Print/PDF-Layouts.',
  },
  {
    title: 'CMS/App-Integration',
    enthalten: 'Anbindung an bestehendes CMS oder App-API im Scope.',
    optional: 'Custom CMS, Headless-Setup oder komplexes Auth.',
  },
  {
    title: 'Performance',
    enthalten: 'Grundlegende Web-Vitals-Optimierung im Lieferumfang.',
    optional: 'Tiefgehende Core-Web-Vitals-Programme und Monitoring.',
  },
] as const;

const FAQ = [
  {
    q: 'Was kostet ein Frontend-Projekt?',
    a: 'Preise richten sich nach Scope. Nach der Qualifizierung über diesen Builder erhalten Sie ein Festangebot — ohne erfundene Listenpreise.',
  },
  {
    q: 'Wie lange dauert die Umsetzung?',
    a: 'Abhängig von Umfang und Ausgangslage. Im Builder wählen Sie Ihr Timing; wir bestätigen Machbarkeit im Festangebot.',
  },
  {
    q: 'Welchen Tech-Stack setzen wir ein?',
    a: 'Webflow, Framer, Next.js, WordPress, Shopify oder individuell — passend zu Team, Content-Workflow und Performance-Zielen.',
  },
  {
    q: 'Wie läuft die Zusammenarbeit?',
    a: 'Klare Scope-Definition, kurze Feedback-Schleifen, Lieferungen in Meilensteinen. Keine endlosen Vorabstimmungen — der Builder ersetzt den Großteil der Vorqualifizierung.',
  },
] as const;

const EMPTY_KONTAKT: KontaktForm = {
  name: '',
  email: '',
  company: '',
  websiteUrl: '',
  message: '',
  privacyAccepted: false,
  companyWebsite: '',
};

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function DiamondMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect
        x="14"
        y="2.5"
        width="16.26"
        height="16.26"
        rx="1.2"
        transform="rotate(45 14 2.5)"
        stroke={LANDING_ACCENT}
        strokeWidth="1.4"
      />
      <path
        d="M14 8.2v11.6M8.2 14h11.6"
        stroke={LANDING_ACCENT}
        strokeWidth="1.15"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function FrontendBuilderLanding() {
  return (
    <div className="min-h-screen antialiased" style={{ backgroundColor: LANDING_BG, color: LANDING_TEXT }}>
      <SEOHead
        title="Frontend Builder für SaaS, AI und B2B-Websites"
        description="Wir planen, designen und bauen performante Frontends mit klarem Scope statt endloser Vorabstimmungen. Projekt jetzt qualifizieren."
        canonical="https://realsyncdynamicsai.de/frontend-builder"
      />
      <PageHeader />
      <main>
        <Hero />
        <ProofBar />
        <ProcessSection />
        <BuilderSection />
        <ReferenzenSection />
        <LeistungenSection />
        <FaqSection />
        <ClosingCta />
      </main>
      <PageFooter />
    </div>
  );
}

function PageHeader() {
  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-[18px]"
      style={{
        backgroundColor: 'rgba(10,10,11,0.82)',
        borderColor: 'rgba(255,255,255,0.06)',
        color: LANDING_TEXT,
      }}
    >
      <div className="mx-auto flex h-[72px] max-w-[1100px] items-center gap-4 px-[4vw]">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsd-accent,#d6ad68)]/60"
        >
          <DiamondMark />
          <span
            className="truncate text-[13px] font-semibold tracking-tight"
            style={{ fontFamily: LANDING_MONO, letterSpacing: '0.04em' }}
          >
            RealSyncDynamics.AI
          </span>
        </Link>
        <nav className="ml-auto hidden items-center gap-5 sm:flex" aria-label="Seitenbereiche">
          <a href="#referenzen" className="text-[13px] transition-colors hover:opacity-100" style={{ color: LANDING_MUTED }}>
            Beispiele
          </a>
          <a href="#leistungen" className="text-[13px] transition-colors hover:opacity-100" style={{ color: LANDING_MUTED }}>
            Leistungen
          </a>
          <a href="#prozess" className="text-[13px] transition-colors hover:opacity-100" style={{ color: LANDING_MUTED }}>
            Prozess
          </a>
        </nav>
        <button
          type="button"
          onClick={() => scrollToId('builder')}
          className="ml-2 inline-flex items-center gap-1.5 rounded-sm px-3.5 py-2 text-[12px] font-semibold sm:ml-4"
          style={{
            fontFamily: LANDING_MONO,
            backgroundColor: LANDING_ACCENT,
            color: LANDING_BUTTON_TEXT,
            boxShadow: LANDING_CTA_GLOW,
          }}
        >
          Projekt starten
        </button>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="border-b px-[4vw] py-16 sm:py-24" style={{ borderColor: LANDING_LINE }}>
      <div className="mx-auto max-w-[1100px] text-center">
        <p
          className="mb-5 inline-flex items-center gap-2 rounded-sm border px-3 py-1 text-[11px] uppercase tracking-[0.18em]"
          style={{ fontFamily: LANDING_MONO, borderColor: LANDING_LINE, color: LANDING_ACCENT_SOFT }}
        >
          Frontend Builder
        </p>
        <h1
          className="mx-auto max-w-4xl font-semibold leading-[1.08] tracking-tight"
          style={{ fontSize: LANDING_H1, color: LANDING_TEXT }}
        >
          Frontend Builder für SaaS, AI und B2B-Websites
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: LANDING_MUTED }}>
          Wir planen, designen und bauen performante Frontends mit klarem Scope statt endloser Vorabstimmungen.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => scrollToId('builder')}
            className="inline-flex items-center gap-2 rounded-sm px-6 py-3 text-sm font-bold"
            style={{
              backgroundColor: LANDING_ACCENT,
              color: LANDING_BUTTON_TEXT,
              boxShadow: LANDING_CTA_GLOW,
            }}
          >
            Projekt starten <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollToId('referenzen')}
            className="inline-flex items-center gap-2 rounded-sm border px-6 py-3 text-sm font-semibold"
            style={{ borderColor: 'rgba(255,255,255,0.12)', color: LANDING_TEXT }}
          >
            Beispiele ansehen
          </button>
        </div>
      </div>
    </section>
  );
}

function ProofBar() {
  const items = ['SaaS', 'AI', 'B2B', 'schnell', 'responsive', 'conversion-orientiert'] as const;
  return (
    <section className="border-b px-[4vw] py-6" style={{ borderColor: LANDING_LINE }} aria-label="Schwerpunkte">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {items.map((item) => (
          <span
            key={item}
            className="text-[11px] uppercase tracking-[0.16em]"
            style={{ fontFamily: LANDING_MONO, color: LANDING_MUTED }}
          >
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function ProcessSection() {
  return (
    <section id="prozess" className="scroll-mt-24 border-b px-[4vw] py-16 sm:py-20" style={{ borderColor: LANDING_LINE }}>
      <div className="mx-auto max-w-[1100px]">
        <p className="mb-3 text-[11px] uppercase tracking-[0.2em]" style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}>
          So funktioniert&apos;s
        </p>
        <h2 className="mb-10 font-semibold tracking-tight" style={{ fontSize: LANDING_H2 }}>
          Fünf Schritte zur qualifizierten Anfrage
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {PROCESS_STEPS.map((step) => (
            <li
              key={step.n}
              className="rounded-sm border p-5"
              style={{ backgroundColor: LANDING_PANEL, borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <span className="text-[11px]" style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}>
                {step.n}
              </span>
              <h3 className="mt-2 text-sm font-semibold">{step.title}</h3>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: LANDING_MUTED }}>
                {step.text}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function BuilderSection() {
  const [stepId, setStepId] = useState<BuilderStepId>('projektart');
  const [answers, setAnswers] = useState<BuilderAnswers>({});
  const [form, setForm] = useState<KontaktForm>(EMPTY_KONTAKT);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const index = BUILDER_STEPS.findIndex((s) => s.id === stepId);
  const step = BUILDER_STEPS[index]!;
  const pct = progressPercent(index);
  const advanceOk = canAdvance(step, answers, form);

  const choiceSteps = useMemo(
    () => BUILDER_STEPS.filter((s): s is ChoiceStep => s.kind === 'choice'),
    [],
  );

  function goBack() {
    if (index <= 0) return;
    setStepId(BUILDER_STEPS[index - 1]!.id);
    setErrorMsg(null);
  }

  function goNext() {
    if (!advanceOk || index >= TOTAL_STEP_COUNT - 1) return;
    setStepId(BUILDER_STEPS[index + 1]!.id);
    setErrorMsg(null);
  }

  function selectOption(stepKey: ChoiceStep['id'], optionId: string) {
    setAnswers((prev) => ({ ...prev, [stepKey]: optionId }));
  }

  async function submit() {
    if (status === 'submitting') return;
    setErrorMsg(null);

    // Honeypot: silent success, no network call.
    if (isHoneypotTripped(form)) {
      setStatus('success');
      return;
    }
    if (!canAdvanceKontaktSafe()) {
      setErrorMsg('Bitte Pflichtfelder und Datenschutz bestätigen.');
      return;
    }

    setStatus('submitting');
    try {
      if (shouldUseFnProxy()) await ensureCsrfCookie();
      const url = edgeFunctionUrl('sales-lead');
      const payload = buildInquiryPayload(answers, form);
      const resp = await fetch(
        url,
        fnFetchInit(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      );
      const body = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { message?: string; code?: string };
      };
      if (!resp.ok) {
        const code = body.error?.code ? ` (${body.error.code})` : '';
        throw new Error((body.error?.message ?? `HTTP ${resp.status}`) + code);
      }
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg((err as Error).message);
    }
  }

  function canAdvanceKontaktSafe(): boolean {
    return canAdvance(
      BUILDER_STEPS.find((s) => s.id === 'kontakt')!,
      answers,
      form,
    );
  }

  async function onSubmitForm(e: FormEvent) {
    e.preventDefault();
    if (step.kind === 'summary') {
      await submit();
      return;
    }
    goNext();
  }

  if (status === 'success') {
    return (
      <section id="builder" className="scroll-mt-24 border-b px-[4vw] py-16 sm:py-20" style={{ borderColor: LANDING_LINE }}>
        <div
          className="mx-auto max-w-lg rounded-sm border p-8 text-center"
          style={{ backgroundColor: LANDING_PANEL, borderColor: 'rgba(32,214,154,0.35)' }}
        >
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-400" />
          <h2 className="text-2xl font-semibold">Anfrage erhalten</h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: LANDING_MUTED }}>
            Danke — wir prüfen Ihren Scope und melden uns mit dem nächsten Schritt.
            Es wird keine E-Mail-Adresse in dieser Bestätigung angezeigt.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex text-sm font-semibold underline-offset-4 hover:underline"
            style={{ color: LANDING_ACCENT_SOFT }}
          >
            Zur Startseite
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section id="builder" className="scroll-mt-24 border-b px-[4vw] py-16 sm:py-20" style={{ borderColor: LANDING_LINE }}>
      <div className="mx-auto max-w-[720px]">
        <p className="mb-3 text-[11px] uppercase tracking-[0.2em]" style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}>
          Projekt-Builder
        </p>
        <h2 className="mb-2 font-semibold tracking-tight" style={{ fontSize: LANDING_H2 }}>
          Projekt qualifizieren
        </h2>
        <p className="mb-8 text-sm" style={{ color: LANDING_MUTED }}>
          Schritt {index + 1} von {TOTAL_STEP_COUNT} — {step.title}
        </p>

        <div
          className="mb-8 h-1.5 overflow-hidden rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Fortschritt"
        >
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: LANDING_ACCENT }} />
        </div>

        <div
          className="rounded-sm border p-6 sm:p-8"
          style={{ backgroundColor: LANDING_PANEL, borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <h3 className="text-lg font-semibold">{step.title}</h3>
          <p className="mt-1 mb-6 text-sm" style={{ color: LANDING_MUTED }}>
            {step.hint}
          </p>

          {step.kind === 'choice' && (
            <div role="radiogroup" aria-label={step.title} className="grid gap-2 sm:grid-cols-2">
              {step.options.map((opt) => {
                const selected = answers[step.id] === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-pressed={selected}
                    onClick={() => selectOption(step.id, opt.id)}
                    className="rounded-sm border px-4 py-3 text-left text-sm font-medium transition"
                    style={{
                      borderColor: selected ? LANDING_ACCENT : 'rgba(255,255,255,0.1)',
                      backgroundColor: selected ? 'rgba(214,173,104,0.12)' : 'transparent',
                      color: LANDING_TEXT,
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      {selected ? <Check className="h-4 w-4" style={{ color: LANDING_ACCENT }} /> : null}
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {step.kind === 'kontakt' && (
            <form className="space-y-4" onSubmit={onSubmitForm} noValidate>
              {/* Honeypot — visually hidden, not display:none so bots still fill it */}
              <div className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden" aria-hidden="true">
                <label htmlFor="fb-company-website">Company website</label>
                <input
                  id="fb-company-website"
                  name="company_website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.companyWebsite}
                  onChange={(e) => setForm((p) => ({ ...p, companyWebsite: e.target.value }))}
                />
              </div>
              <Field
                id="fb-name"
                label="Name *"
                value={form.name}
                onChange={(v) => setForm((p) => ({ ...p, name: v }))}
                required
                autoComplete="name"
              />
              <Field
                id="fb-email"
                label="E-Mail *"
                type="email"
                value={form.email}
                onChange={(v) => setForm((p) => ({ ...p, email: v }))}
                required
                autoComplete="email"
              />
              <Field
                id="fb-company"
                label="Firma *"
                value={form.company}
                onChange={(v) => setForm((p) => ({ ...p, company: v }))}
                required
                autoComplete="organization"
              />
              <Field
                id="fb-website"
                label="Website-URL (optional)"
                type="url"
                value={form.websiteUrl}
                onChange={(v) => setForm((p) => ({ ...p, websiteUrl: v }))}
                autoComplete="url"
                placeholder="https://"
              />
              <div>
                <label htmlFor="fb-message" className="mb-1.5 block text-xs font-medium" style={{ color: LANDING_MUTED }}>
                  Nachricht (optional)
                </label>
                <textarea
                  id="fb-message"
                  rows={3}
                  value={form.message}
                  onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                  className="w-full rounded-sm border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--rsd-accent,#d6ad68)]"
                  style={{ borderColor: 'rgba(255,255,255,0.12)', color: LANDING_TEXT }}
                />
              </div>
              <label className="flex items-start gap-3 text-sm" style={{ color: LANDING_MUTED }}>
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.privacyAccepted}
                  onChange={(e) => setForm((p) => ({ ...p, privacyAccepted: e.target.checked }))}
                  required
                />
                <span>
                  Ich habe die{' '}
                  <Link to="/datenschutz" className="underline underline-offset-2" style={{ color: LANDING_ACCENT_SOFT }}>
                    Datenschutzerklärung
                  </Link>{' '}
                  gelesen und stimme der Verarbeitung meiner Angaben zur Bearbeitung dieser Anfrage zu. *
                </span>
              </label>
            </form>
          )}

          {step.kind === 'summary' && (
            <div className="space-y-3 text-sm">
              {choiceSteps.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b py-2"
                  style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                >
                  <span style={{ color: LANDING_MUTED }}>{s.title}</span>
                  <span className="font-medium">{labelForAnswer(s.id, answers[s.id])}</span>
                </div>
              ))}
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b py-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <span style={{ color: LANDING_MUTED }}>Kontakt</span>
                <span className="font-medium text-right">
                  {form.name} · {form.company}
                </span>
              </div>
              <p className="pt-2 text-xs" style={{ color: LANDING_MUTED }}>
                E-Mail wird übermittelt, aber in der Erfolgsanzeige nicht wiederholt.
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="mt-4 flex items-start gap-2 rounded-sm border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={index === 0 || status === 'submitting'}
              className="inline-flex items-center gap-1.5 rounded-sm border px-4 py-2.5 text-sm font-medium disabled:opacity-40"
              style={{ borderColor: 'rgba(255,255,255,0.12)', color: LANDING_TEXT }}
            >
              <ArrowLeft className="h-4 w-4" /> Zurück
            </button>
            {step.kind === 'summary' ? (
              <button
                type="button"
                onClick={() => void submit()}
                disabled={status === 'submitting'}
                className="inline-flex items-center gap-2 rounded-sm px-5 py-2.5 text-sm font-bold disabled:opacity-50"
                style={{ backgroundColor: LANDING_ACCENT, color: LANDING_BUTTON_TEXT }}
              >
                {status === 'submitting' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Anfrage absenden
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={!advanceOk}
                className="inline-flex items-center gap-2 rounded-sm px-5 py-2.5 text-sm font-bold disabled:opacity-40"
                style={{ backgroundColor: LANDING_ACCENT, color: LANDING_BUTTON_TEXT }}
              >
                Weiter <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required,
  autoComplete,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium" style={{ color: LANDING_MUTED }}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-sm border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--rsd-accent,#d6ad68)]"
        style={{ borderColor: 'rgba(255,255,255,0.12)', color: LANDING_TEXT }}
      />
    </div>
  );
}

function ReferenzenSection() {
  return (
    <section id="referenzen" className="scroll-mt-24 border-b px-[4vw] py-16 sm:py-20" style={{ borderColor: LANDING_LINE }}>
      <div className="mx-auto max-w-[1100px]">
        <p className="mb-3 text-[11px] uppercase tracking-[0.2em]" style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}>
          Beispiele
        </p>
        <h2 className="mb-10 font-semibold tracking-tight" style={{ fontSize: LANDING_H2 }}>
          Referenzen
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <article
            className="rounded-sm border p-6"
            style={{ backgroundColor: LANDING_PANEL, borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <p className="text-[11px] uppercase tracking-[0.14em]" style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT_SOFT }}>
              FMT / SiteOS Modernize
            </p>
            <h3 className="mt-3 text-base font-semibold">Scan → Consolidate → Rebuild → Govern</h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: LANDING_MUTED }}>
              Unser Wizard für Frontend-Modernisierung — strukturierter Pfad von Scan bis Govern.
            </p>
            <Link
              to="/app/siteos/modernize"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline"
              style={{ color: LANDING_ACCENT }}
            >
              Wizard öffnen <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </article>

          <article
            className="rounded-sm border p-6"
            style={{ backgroundColor: LANDING_PANEL, borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <p className="text-[11px] uppercase tracking-[0.14em]" style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT_SOFT }}>
              Eigenes Relaunch
            </p>
            <h3 className="mt-3 text-base font-semibold">realsyncdynamicsai.de</h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: LANDING_MUTED }}>
              Relaunch unserer Marketing-Oberfläche — Dark/Gold, klare Conversion-Pfade, EU-Hosting.
            </p>
            <a
              href="https://realsyncdynamicsai.de/"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline"
              style={{ color: LANDING_ACCENT }}
            >
              Live ansehen <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </article>

          <article
            className="relative rounded-sm border p-6 opacity-90"
            style={{ backgroundColor: LANDING_PANEL, borderColor: 'rgba(255,255,255,0.06)' }}
          >
            <span
              className="absolute right-4 top-4 rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ fontFamily: LANDING_MONO, borderColor: LANDING_LINE, color: LANDING_MUTED }}
            >
              Platzhalter
            </span>
            <p className="text-[11px] uppercase tracking-[0.14em]" style={{ fontFamily: LANDING_MONO, color: LANDING_MUTED }}>
              Weitere Cases
            </p>
            <h3 className="mt-3 text-base font-semibold">Bald verfügbar</h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: LANDING_MUTED }}>
              Hier erscheinen nur freigegebene Kundenprojekte — keine erfundenen Logos oder Kennzahlen.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

function LeistungenSection() {
  return (
    <section id="leistungen" className="scroll-mt-24 border-b px-[4vw] py-16 sm:py-20" style={{ borderColor: LANDING_LINE }}>
      <div className="mx-auto max-w-[1100px]">
        <p className="mb-3 text-[11px] uppercase tracking-[0.2em]" style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}>
          Leistungen
        </p>
        <h2 className="mb-10 font-semibold tracking-tight" style={{ fontSize: LANDING_H2 }}>
          Enthalten und optional
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <article
              key={s.title}
              className="rounded-sm border p-5"
              style={{ backgroundColor: LANDING_PANEL, borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <h3 className="text-base font-semibold">{s.title}</h3>
              <p className="mt-3 text-xs uppercase tracking-[0.12em]" style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT_SOFT }}>
                Enthalten
              </p>
              <p className="mt-1 text-sm" style={{ color: LANDING_MUTED }}>
                {s.enthalten}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.12em]" style={{ fontFamily: LANDING_MONO, color: LANDING_MUTED }}>
                Optional
              </p>
              <p className="mt-1 text-sm" style={{ color: LANDING_MUTED }}>
                {s.optional}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="border-b px-[4vw] py-16 sm:py-20" style={{ borderColor: LANDING_LINE }}>
      <div className="mx-auto max-w-[720px]">
        <p className="mb-3 text-[11px] uppercase tracking-[0.2em]" style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}>
          FAQ
        </p>
        <h2 className="mb-8 font-semibold tracking-tight" style={{ fontSize: LANDING_H2 }}>
          Häufige Fragen
        </h2>
        <div className="space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-sm border px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
              style={{ backgroundColor: LANDING_PANEL, borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold">
                {item.q}
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" style={{ color: LANDING_ACCENT }} />
              </summary>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: LANDING_MUTED }}>
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="px-[4vw] py-16 sm:py-20">
      <div
        className="mx-auto max-w-[900px] rounded-sm border px-6 py-12 text-center sm:px-10"
        style={{ backgroundColor: LANDING_PANEL, borderColor: LANDING_LINE }}
      >
        <h2 className="font-semibold tracking-tight" style={{ fontSize: LANDING_H2 }}>
          Bereit für ein klares Frontend-Scope?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed" style={{ color: LANDING_MUTED }}>
          Qualifizieren Sie Ihr Projekt im Builder — oder schreiben Sie uns kurz. Enterprise-Anfragen laufen über dieselbe Strecke.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => scrollToId('builder')}
            className="inline-flex items-center gap-2 rounded-sm px-5 py-3 text-sm font-bold"
            style={{ backgroundColor: LANDING_ACCENT, color: LANDING_BUTTON_TEXT, boxShadow: LANDING_CTA_GLOW }}
          >
            Projekt qualifizieren
          </button>
          <Link
            to="/contact-sales?source=frontend-builder"
            className="inline-flex items-center gap-2 rounded-sm border px-5 py-3 text-sm font-semibold"
            style={{ borderColor: 'rgba(255,255,255,0.12)', color: LANDING_TEXT }}
          >
            Kurz anfragen
          </Link>
          <Link
            to="/contact-sales?source=frontend-builder&intent=enterprise"
            className="inline-flex items-center gap-2 rounded-sm border px-5 py-3 text-sm font-semibold"
            style={{ borderColor: 'rgba(255,255,255,0.12)', color: LANDING_TEXT }}
          >
            Enterprise anfragen
          </Link>
        </div>
      </div>
    </section>
  );
}

function PageFooter() {
  return (
    <footer className="border-t px-[4vw] py-10" style={{ borderColor: LANDING_LINE }}>
      <div className="mx-auto flex max-w-[1100px] flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <DiamondMark />
            <span className="text-[13px] font-semibold" style={{ fontFamily: LANDING_MONO }}>
              RealSyncDynamics.AI
            </span>
          </div>
          <p className="text-sm" style={{ color: LANDING_MUTED }}>
            Kontakt:{' '}
            <a href="mailto:info@realsyncdynamicsai.de" className="underline-offset-2 hover:underline" style={{ color: LANDING_ACCENT_SOFT }}>
              info@realsyncdynamicsai.de
            </a>
            <br />
            Telefon:{' '}
            <a href="tel:+4917640132161" className="underline-offset-2 hover:underline" style={{ color: LANDING_ACCENT_SOFT }}>
              +49 176 4013 2161
            </a>
          </p>
        </div>
        <nav className="flex flex-wrap gap-4 text-sm" aria-label="Rechtliches" style={{ color: LANDING_MUTED }}>
          <Link to="/impressum" className="hover:underline underline-offset-2">
            Impressum
          </Link>
          <Link to="/datenschutz" className="hover:underline underline-offset-2">
            Datenschutz
          </Link>
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-[1100px] text-[11px]" style={{ fontFamily: LANDING_MONO, color: LANDING_MUTED }}>
        © 2026 RealSync Dynamics.AI
      </p>
    </footer>
  );
}