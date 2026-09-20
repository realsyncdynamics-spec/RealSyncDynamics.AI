/**
 * Online-Preisrechner fuer Enterprise und Enterprise Plus.
 *
 * ## Warum es diese Seite gibt
 *
 * Beide Plaene sind `purchaseMode: 'inquiry'` — der Self-Service-Checkout
 * kann ihren Betrag heute nicht einloesen. Bisher endete der Weg
 * deshalb in einem Kontaktformular: der Interessent nannte seinen Bedarf und
 * bekam als Antwort „wir melden uns". Hier bekommt er stattdessen einen
 * Betrag — online, in zwei Minuten, mit jedem Posten einzeln ausgewiesen.
 *
 * ## Woher der Betrag kommt
 *
 * Aus `computeQuote()` in `shared/pricing.ts`, also aus derselben SSoT wie
 * die Preiskarten. Auf dieser Seite steht keine einzige Zahl, die nicht
 * vorher dort stand. Die KI formuliert die Fragen — sie rechnet nicht.
 *
 * ## Warum der Betrag zweimal gerechnet wird
 *
 * Diese Seite rechnet fuer die Anzeige, `sales-lead` rechnet beim Absenden
 * neu. Was der Browser schickt, ist eine Behauptung; verbindlich ist, was
 * der Server aus denselben Antworten ableitet. Weichen beide ab, gewinnt der
 * Server und die Seite sagt es.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, Loader2, Sparkles } from 'lucide-react';
import {
  computeQuote,
  isQuotePlanId,
  planById,
  publicLabelOf,
  formatPriceEur,
  quotePlanForTenants,
  type Quote,
  type QuoteAnswers,
  type QuotePlanId,
} from '@/shared/pricing';
import { postEdgeFunction } from '../../lib/edgeFunction';

interface QuoteQuestion {
  id: string;
  kind: 'addon' | 'contract';
  label: string;
  question: string;
  hint: string;
  unitEur: number;
  unit?: { label: string; step: string; max: number };
}

interface StartResponse {
  ok: boolean;
  lead_id: string;
  plan_id: QuotePlanId;
  questions: QuoteQuestion[];
  ai_generated: boolean;
}

interface SubmitResponse {
  ok: boolean;
  lead_id: string;
  quote: Quote;
}

type Phase = 'context' | 'questions' | 'done';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PricingQuotePage() {
  const [params] = useSearchParams();
  const tierParam = params.get('tier') ?? '';
  const source = params.get('source') ?? 'pricing-quote';

  // Ein unbekannter Tier-Parameter ist kein Fehlerzustand, den der Besucher
  // loesen koennte — zurueck auf die Preisseite.
  if (!isQuotePlanId(tierParam)) {
    return <Navigate to="/pricing" replace />;
  }

  return <QuoteFlow planId={tierParam} source={source} />;
}

function QuoteFlow({ planId: initialPlanId, source }: { planId: QuotePlanId; source: string }) {
  const [planId, setPlanId] = useState<QuotePlanId>(initialPlanId);
  const [phase, setPhase] = useState<Phase>('context');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Schritt 1 — Kontext
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [industry, setIndustry] = useState('');
  const [tenants, setTenants] = useState('1');
  const [domainCount, setDomainCount] = useState('');
  const [country, setCountry] = useState('Deutschland');
  const [systems, setSystems] = useState('');

  // Schritt 2 — Fragebogen
  const [leadId, setLeadId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuoteQuestion[]>([]);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [contractItems, setContractItems] = useState<string[]>([]);

  // Schritt 3 — Ergebnis
  const [serverQuote, setServerQuote] = useState<Quote | null>(null);

  const plan = planById(planId);
  const label = publicLabelOf(plan);

  const answers = useMemo<QuoteAnswers>(
    () => ({ planId, quantities, contractItems }),
    [planId, quantities, contractItems],
  );
  const localQuote = useMemo(() => computeQuote(answers), [answers]);

  // Mehr Mandanten als Enterprise traegt? Dann ist Enterprise Plus der
  // richtige Plan — das ist ein Planwechsel, kein Aufpreis.
  const tenantCount = Number.parseInt(tenants, 10);
  const recommended = Number.isFinite(tenantCount) ? quotePlanForTenants(tenantCount) : planId;
  const tenantUpgrade = phase !== 'context' && recommended !== planId && recommended === 'partner';

  const start = useCallback(async () => {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError('Bitte eine gueltige E-Mail-Adresse angeben — an sie geht Ihr Angebot.');
      return;
    }
    setBusy(true);
    try {
      const effectivePlan = Number.isFinite(tenantCount) ? quotePlanForTenants(tenantCount) : planId;
      const res = await postEdgeFunction<StartResponse>(
        'sales-lead',
        {
          mode: 'quote',
          action: 'start',
          tier: effectivePlan,
          email: email.trim(),
          company: company.trim(),
          industry: industry.trim(),
          tenants: tenantCount,
          domain_count: domainCount,
          country: country.trim(),
          systems: systems.trim(),
          source,
          path: window.location.pathname,
        },
        { requireAuth: false },
      );
      setPlanId(res.plan_id ?? effectivePlan);
      setLeadId(res.lead_id);
      setQuestions(res.questions ?? []);
      setAiGenerated(Boolean(res.ai_generated));
      setPhase('questions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Der Fragebogen konnte nicht erzeugt werden.');
    } finally {
      setBusy(false);
    }
  }, [email, company, industry, tenantCount, domainCount, country, systems, planId, source]);

  const submit = useCallback(async () => {
    if (!leadId) return;
    setError(null);
    setBusy(true);
    try {
      const res = await postEdgeFunction<SubmitResponse>(
        'sales-lead',
        { mode: 'quote', action: 'submit', email: email.trim(), lead_id: leadId, answers },
        { requireAuth: false },
      );
      setServerQuote(res.quote);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Die Anfrage konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  }, [leadId, answers, email]);

  const setQuantity = (id: string, value: number) =>
    setQuantities((prev) => ({ ...prev, [id]: Math.max(0, value) }));

  const toggleContract = (id: string) =>
    setContractItems((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Nach dem Absenden zaehlt der Betrag des Servers.
  const shown = serverQuote ?? localQuote;

  useEffect(() => {
    document.title = `Preis ermitteln — ${label} | RealSyncDynamics.AI`;
  }, [label]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <Link to="/pricing" className="text-xs font-mono uppercase tracking-widest text-silver-400 hover:text-titanium-100">
          ← Preise
        </Link>

        <h1 className="mt-6 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {label} — Ihren Preis ermitteln
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-silver-300">
          {formatPriceEur(plan.price.monthlyEur)} pro Monat ist der Einstiegspreis. Was Sie
          tatsaechlich zahlen, haengt von Ihrem Umfang ab — der Fragebogen weist jeden Posten
          einzeln aus. Ihr Betrag liegt nie unter dem Einstiegspreis.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-6 border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            {error}
          </div>
        )}

        {/* ── Schritt 1 — Kontext ───────────────────────────────────────── */}
        {phase === 'context' && (
          <form
            className="mt-8 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              void start();
            }}
          >
            <Field label="E-Mail *" hint="An diese Adresse geht Ihr Angebot.">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={INPUT}
                data-testid="quote-email"
              />
            </Field>
            <Field label="Unternehmen">
              <input value={company} onChange={(e) => setCompany(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Branche" hint="Bestimmt, welche Rahmenwerke der Fragebogen aufgreift.">
              <input value={industry} onChange={(e) => setIndustry(e.target.value)} className={INPUT} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Organisationen / Mandanten" hint={`Enterprise deckt ${plan.limits.tenants} ab.`}>
                <input
                  type="number"
                  min={1}
                  value={tenants}
                  onChange={(e) => setTenants(e.target.value)}
                  className={INPUT}
                  data-testid="quote-tenants"
                />
              </Field>
              <Field label="Domains">
                <input
                  type="number"
                  min={0}
                  value={domainCount}
                  onChange={(e) => setDomainCount(e.target.value)}
                  className={INPUT}
                />
              </Field>
            </div>
            <Field label="Sitz" hint="Entscheidet ueber Datenresidenz und AVV-Fassung.">
              <input value={country} onChange={(e) => setCountry(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Bestandssysteme" hint="Was bereits laeuft — Verzeichnis, SIEM, Ticketing.">
              <textarea
                rows={3}
                value={systems}
                onChange={(e) => setSystems(e.target.value)}
                className={INPUT}
              />
            </Field>

            <button type="submit" disabled={busy} className={PRIMARY} data-testid="quote-start">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {busy ? 'Fragebogen wird erzeugt…' : 'Fragebogen erzeugen'}
            </button>
          </form>
        )}

        {/* ── Schritt 2 — Fragebogen ────────────────────────────────────── */}
        {phase === 'questions' && (
          <div className="mt-8">
            <p className="text-xs font-mono uppercase tracking-widest text-silver-400">
              {aiGenerated
                ? 'Fragebogen individuell erzeugt'
                : 'Standardfragebogen — die individuelle Fassung war nicht verfuegbar'}
            </p>

            {tenantUpgrade && (
              <div className="mt-4 border border-titanium-200/40 bg-titanium-200/5 px-4 py-3 text-sm">
                Fuer mehr als {planById('enterprise').limits.tenants} Organisationen rechnen wir mit{' '}
                <strong>{publicLabelOf(planById('partner'))}</strong> — das ist ein anderer Plan, kein
                Aufpreis auf Enterprise.
              </div>
            )}

            <div className="mt-6 space-y-5">
              {questions.map((q) => (
                <div key={q.id} className="border border-silver-700/30 bg-obsidian-900/60 p-4">
                  <div className="font-display text-sm font-semibold text-titanium-100">{q.question}</div>
                  <div className="mt-1 text-xs leading-relaxed text-silver-400">{q.hint}</div>

                  {q.kind === 'contract' ? (
                    <label className="mt-3 inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={contractItems.includes(q.id)}
                        onChange={() => toggleContract(q.id)}
                        data-testid={`quote-contract-${q.id}`}
                      />
                      <span>Ja — als Vertragspunkt aufnehmen</span>
                    </label>
                  ) : q.unit ? (
                    <div className="mt-3 flex items-center gap-3">
                      <input
                        type="number"
                        min={0}
                        max={q.unit.max}
                        value={quantities[q.id] ?? 0}
                        onChange={(e) => setQuantity(q.id, Number(e.target.value))}
                        className={`${INPUT} w-24`}
                        data-testid={`quote-qty-${q.id}`}
                      />
                      <span className="text-xs text-silver-400">
                        {q.unit.label} · je {q.unit.step} · {formatPriceEur(q.unitEur)}/Monat
                      </span>
                    </div>
                  ) : (
                    <label className="mt-3 inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={(quantities[q.id] ?? 0) > 0}
                        onChange={(e) => setQuantity(q.id, e.target.checked ? 1 : 0)}
                        data-testid={`quote-addon-${q.id}`}
                      />
                      <span>Ja — {formatPriceEur(q.unitEur)}/Monat</span>
                    </label>
                  )}
                </div>
              ))}
            </div>

            <QuoteResult quote={localQuote} />

            <button onClick={() => void submit()} disabled={busy} className={`${PRIMARY} mt-6`} data-testid="quote-submit">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {busy ? 'Wird gesendet…' : 'Diesen Preis anfragen'}
            </button>
          </div>
        )}

        {/* ── Schritt 3 — bestaetigt ────────────────────────────────────── */}
        {phase === 'done' && serverQuote && (
          <div className="mt-8">
            <div className="flex items-center gap-2 text-sm text-emerald-300">
              <Check className="h-4 w-4" /> Angefragt — unter {serverQuote.fingerprint} erfasst.
            </div>
            <QuoteResult quote={serverQuote} />
            <p className="mt-4 text-xs leading-relaxed text-silver-400">
              Wir haben genau diesen Betrag und diese Konfiguration gespeichert. Nennen Sie{' '}
              {serverQuote.fingerprint}, dann reden alle Beteiligten ueber dieselbe Rechnung.
            </p>
            <Link to="/pricing" className={`${PRIMARY} mt-6`}>
              Zurueck zu den Preisen <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {phase !== 'done' && (
          <p className="mt-10 text-xs leading-relaxed text-silver-500">
            Der genannte Betrag ist ein verbindlich kalkuliertes Angebot auf Basis Ihrer Angaben,
            kein Kaufabschluss: Enterprise und {publicLabelOf(planById('partner'))} werden
            vertraglich geschlossen und manuell fakturiert. Angezeigt wird{' '}
            {formatPriceEur(shown.monthlyEur)} pro Monat.
          </p>
        )}
      </div>
    </div>
  );
}

/** Der Betrag im Klartext plus jeder Posten, aus dem er besteht. */
function QuoteResult({ quote }: { quote: Quote }) {
  return (
    <div className="mt-8 border-t-4 border-titanium-200/70 bg-obsidian-900/60 p-6" data-testid="quote-result">
      <div className="text-xs font-mono uppercase tracking-widest text-silver-400">Ihr Preis</div>
      <div className="mt-1 font-display text-4xl font-bold tabular-nums text-titanium-50" data-testid="quote-amount">
        {formatPriceEur(quote.monthlyEur)}
        <span className="ml-2 text-sm font-mono uppercase tracking-wider text-silver-400">/ Monat</span>
      </div>

      <dl className="mt-5 space-y-1.5 text-sm">
        <div className="flex justify-between gap-4 text-silver-300">
          <dt>{quote.publicLabel} (Einstiegspreis)</dt>
          <dd className="tabular-nums">{formatPriceEur(quote.baseMonthlyEur)}</dd>
        </div>
        {quote.lines.map((line) => (
          <div key={line.id} className="flex justify-between gap-4 text-silver-300">
            <dt>
              {line.label}
              {line.quantity > 1 && ` × ${line.quantity}`}
            </dt>
            <dd className="tabular-nums">{formatPriceEur(line.monthlyEur)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-silver-700/30 pt-2 font-semibold text-titanium-50">
          <dt>Summe</dt>
          <dd className="tabular-nums">{formatPriceEur(quote.monthlyEur)}</dd>
        </div>
      </dl>

      {quote.contractItems.length > 0 && (
        <div className="mt-5 border-t border-silver-700/30 pt-4">
          <div className="text-xs font-mono uppercase tracking-widest text-silver-400">
            Vertragspunkte — im genannten Betrag enthalten, ohne Aufschlag
          </div>
          <ul className="mt-2 space-y-1 text-sm text-silver-300">
            {quote.contractItems.map((item) => (
              <li key={item.id}>· {item.label}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-mono uppercase tracking-widest text-silver-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-silver-500">{hint}</span>}
    </label>
  );
}

const INPUT =
  'mt-1.5 w-full rounded-none border border-silver-700/40 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100 outline-none focus:border-titanium-200';

const PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-none bg-titanium-50 px-5 py-3 text-sm font-bold text-obsidian-950 transition-colors hover:bg-titanium-200 disabled:opacity-60';

export default PricingQuotePage;
