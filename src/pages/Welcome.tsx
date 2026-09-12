import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2, ArrowRight, Copy, Check, AlertTriangle, ArrowLeft, Loader2, Mail,
} from 'lucide-react';
import { OAuthProviderButtons } from '../features/auth/OAuthProviderButtons';
import { Logo } from '../components/Logo';
import { PhotorealEarthGlobe } from '../components/visual/PhotorealEarthGlobe';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { claimPendingAudit } from '../core/onboarding/claimAudit';
import { safeInternalPath } from '../lib/safeInternalPath';

/**
 * /welcome — Canonical auth gate (OTP + OAuth) and post-checkout setup wizard.
 *
 * Modes:
 * - Login/register (no `session=`): after sign-in, honor `?next=` or resume
 *   SetupAssistant /app/dashboard — do NOT force the API-key wizard.
 * - Post-checkout (`session=cs_…`): Step 2–3 wizard (API key + domain/snippet).
 *
 * Step 1 — Email OTP / OAuth. auto_tenant_on_signup creates tenant + owner.
 * Step 2 — Client-side rsd_live_* key → SHA-256 → api_keys (RLS).
 * Step 3 — Cookie-SDK snippet or Audit-Pro domain → gdpr-audit.
 *
 * URL: /welcome?session=cs_...&product=...&next=/checkout/starter
 */
export function Welcome() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get('session');
  const product = params.get('product') ?? 'RealSync Dynamics';
  /** Post-checkout wizard only when Stripe success handed us a session id. */
  const isPostCheckoutWizard = Boolean(sessionId);
  const resumeNext = safeInternalPath(params.get('next'));
  const [step, setStep] = useState<number>(1);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [domain, setDomain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [auditQueued, setAuditQueued] = useState(false);
  /** Signed-in return path resolving (skip wizard UI flash). */
  const [resolvingReturn, setResolvingReturn] = useState(false);

  // OAuth-Provider-Fehler abfangen, falls der User mit ?error=... oder
  // #error=... auf /welcome zurueck navigiert (z.B. access_denied,
  // server_error). Der invalid_client-Fall bleibt allerdings auf der
  // Provider-Seite haengen — dagegen hilft nur das Provider-Flag in
  // OAuthProviderButtons.tsx.
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const hash   = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const err    = search.get('error') ?? hash.get('error');
    if (!err) return;
    const desc =
      search.get('error_description') ??
      hash.get('error_description') ??
      err;
    setError(`Login abgebrochen: ${decodeURIComponent(desc).replace(/\+/g, ' ')}`);
    // Query + Hash aufraeumen, damit ein Reload den Banner nicht wieder zeigt.
    const cleaned = window.location.pathname;
    window.history.replaceState({}, '', cleaned);
  }, []);

  // Detect signed-in state on mount + on auth changes (post-magic-link return).
  // Critical: getSession() must honor ?next= the same way SIGNED_IN does —
  // otherwise a logged-in user opening /welcome?next=/checkout/starter stays
  // stuck on the wizard and never resumes checkout.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const sb = getSupabase();
    let cancelled = false;

    const resumeAfterAuth = (userEmail: string | undefined) => {
      setEmail((prev) => prev || userEmail || '');
      void claimPendingAudit().catch(() => null);

      const nextParam = safeInternalPath(
        new URLSearchParams(window.location.search).get('next'),
      );
      if (nextParam) {
        navigate(nextParam, { replace: true });
        return;
      }

      // Post-checkout: enter API-key wizard. Plain login: resolve tenant then
      // SetupAssistant or /app/dashboard — do not force the wizard.
      if (sessionId) {
        setStep((prev) => (prev === 1 ? 2 : prev));
        return;
      }
      setResolvingReturn(true);
      setStep((prev) => (prev === 1 ? 2 : prev));
    };

    sb.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session?.user) {
        resumeAfterAuth(data.session.user.email);
      }
    });

    const { data: subscription } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        resumeAfterAuth(session.user.email);
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [navigate, sessionId]);

  // Resolve owner-tenant for the signed-in user once we hit step 2+
  useEffect(() => {
    if (!isSupabaseConfigured() || step < 2 || tenantId) return;
    const sb = getSupabase();
    let cancelled = false;
    void (async () => {
      const { data: userData } = await sb.auth.getUser();
      if (cancelled || !userData.user) return;
      const { data, error: lookupErr } = await sb
        .from('memberships')
        .select('tenant_id, role')
        .eq('user_id', userData.user.id)
        .order('role', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (lookupErr) {
        setError(friendlyError(lookupErr, 'Konto konnte nicht geladen werden.'));
        return;
      }
      if (data?.tenant_id) setTenantId(data.tenant_id);
      void claimPendingAudit().catch(() => null);
    })();
    return () => { cancelled = true; };
  }, [step, tenantId]);

  // Step 1 → Magic-Link
  const submitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) return;
    if (!isSupabaseConfigured()) {
      setError('Auth ist nicht konfiguriert (VITE_SUPABASE_URL fehlt).');
      return;
    }
    setBusy(true);
    try {
      const sb = getSupabase();
      const redirectTo = `${window.location.origin}${window.location.pathname}${window.location.search}`;
      const { error: otpErr } = await sb.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          data: name ? { full_name: name } : undefined,
        },
      });
      if (otpErr) throw otpErr;
      setMagicSent(true);
    } catch (err) {
      setError(friendlyError(err, 'Magic-Link konnte nicht gesendet werden.'));
    } finally {
      setBusy(false);
    }
  };

  // Step 2 → Generate + persist API key
  const generateKey = async () => {
    setError(null);
    if (!isSupabaseConfigured()) {
      setError('Supabase nicht konfiguriert.');
      return;
    }
    if (!tenantId) {
      setError('Kein Tenant gefunden — bitte zuerst über den Magic-Link einloggen.');
      return;
    }
    setBusy(true);
    try {
      const plain = `rsd_live_${randString(40)}`;
      const keyHash = await sha256Hex(plain);
      const keyPrefix = plain.slice(0, 12);
      const sb = getSupabase();
      const { data: insertedKey, error: insertErr } = await sb
        .from('api_keys')
        .insert({
          tenant_id: tenantId,
          name: 'Onboarding key',
          key_hash: keyHash,
          key_prefix: keyPrefix,
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      setApiKey(plain);

      // Persist wizard progress so the customer_onboarding row reflects step 2
      // completion + the new api_key_id. Best-effort: a row may not exist if
      // the user landed on /welcome without prior Stripe-checkout (e.g. test
      // flow), in which case the RPC silently returns zero rows — not an error.
      await sb.rpc('update_onboarding_progress', {
        p_step: 2,
        p_api_key_id: insertedKey?.id ?? null,
      });
    } catch (err) {
      setError(friendlyError(err, 'API-Key-Generierung fehlgeschlagen.'));
    } finally {
      setBusy(false);
    }
  };

  const copyKey = async () => {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  // Step 3 (Audit-Pro) → trigger gdpr-audit edge function with the entered domain
  const submitAuditDomain = async () => {
    setError(null);
    if (!domain) return;
    if (!isSupabaseConfigured()) {
      setError('Supabase nicht konfiguriert.');
      return;
    }
    setBusy(true);
    try {
      const sb = getSupabase();
      const url = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
      const { error: invokeErr } = await sb.functions.invoke('gdpr-audit', {
        body: { url, email },
      });
      if (invokeErr) throw invokeErr;
      setAuditQueued(true);

      // Persist step-3 completion + the connected domain so customer_onboarding
      // reflects the wizard's terminal state. Best-effort — see Step-2 note.
      await sb.rpc('update_onboarding_progress', {
        p_step: 4,
        p_domain_connected: url,
      });
    } catch (err) {
      setError(friendlyError(err, 'Audit konnte nicht gestartet werden.'));
    } finally {
      setBusy(false);
    }
  };

  const isCookieSdk = product.includes('Cookie-SDK');

  // After tenant resolve: resume ?next=, run post-checkout wizard, or send
  // returning users to SetupAssistant / dashboard. Never steal a checkout
  // resume into setup-assistant without preserving next.
  useEffect(() => {
    if (!isSupabaseConfigured() || step < 2 || !tenantId) return;
    const sb = getSupabase();
    let cancelled = false;

    void (async () => {
      try {
        const nextParam = safeInternalPath(
          new URLSearchParams(window.location.search).get('next'),
        );
        if (nextParam) {
          navigate(nextParam, { replace: true });
          return;
        }

        const { data: tenant } = await sb
          .from('tenants')
          .select('onboarded_at')
          .eq('id', tenantId)
          .single();
        if (cancelled) return;

        if (sessionId) {
          // Post-checkout wizard stays on this page.
          setResolvingReturn(false);
          return;
        }

        if (tenant && !tenant.onboarded_at) {
          navigate('/setup-assistant', { replace: true });
          return;
        }
        navigate('/app/dashboard', { replace: true });
      } catch {
        if (!cancelled && !sessionId) {
          navigate('/app/dashboard', { replace: true });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [step, tenantId, navigate, sessionId]);

  // Final "Setup abschließen" CTA — mark wizard complete, then navigate.
  // ?next=<safe-path> wins (interruptive checkouts); else /app/dashboard.
  const finalizeAndNavigate = async () => {
    const target =
      safeInternalPath(new URLSearchParams(window.location.search).get('next')) ??
      '/app/dashboard';
    if (isSupabaseConfigured()) {
      try {
        const sb = getSupabase();
        await sb.rpc('update_onboarding_progress', { p_step: 4 });
      } catch {
        // Best-effort: navigation should still happen even if persistence fails.
      }
    }
    navigate(target);
  };

  if (resolvingReturn && step >= 2 && !isPostCheckoutWizard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian-950 text-titanium-400">
        <Loader2 className="h-5 w-5 animate-spin" aria-label="Sitzung wird fortgesetzt" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.95fr)]">
        <div className="flex min-h-screen flex-col">
          <header className="flex h-14 shrink-0 items-center border-b border-titanium-900 bg-obsidian-900 px-4">
            <Link to="/" className="mr-3 rounded-none p-1.5 text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-200">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Logo size={24} />
          </header>

          <main className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
            <div className="mx-auto w-full max-w-xl">
              <div className="mb-12 text-center lg:text-left">
                {sessionId ? (
                  <>
                    <div className="mb-5 inline-flex items-center gap-2 rounded-none border border-emerald-900 bg-emerald-950/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" /> Kauf bestätigt · {product}
                    </div>
                    <h1 className="mb-3 font-display text-3xl font-bold tracking-tight text-titanium-50 sm:text-4xl">
                      Willkommen. Drei Klicks bis zum Setup.
                    </h1>
                    <p className="text-base leading-relaxed text-titanium-400">
                      Account bestätigen → API-Key generieren → Snippet einbauen oder Domain prüfen.
                    </p>
                  </>
                ) : (
                  <>
                    <h1 className="mb-3 font-display text-3xl font-bold tracking-tight text-titanium-50 sm:text-4xl">
                      Willkommen zurück.
                    </h1>
                    <p className="text-base leading-relaxed text-titanium-400">
                      {resumeNext
                        ? 'Anmelden und danach direkt fortsetzen.'
                        : 'Mit Magic-Link oder OAuth anmelden — dann weiter ins Governance OS.'}
                    </p>
                  </>
                )}
              </div>

              <div className="mb-12 flex items-center justify-center gap-3 lg:justify-start">
                {[1, 2, 3].map((s) => {
                  const isCompleted = step > s;
                  const isCurrent = step === s;
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center border-2 font-mono text-sm transition-colors ${
                          isCompleted
                            ? 'border-brass-500 bg-brass-500 text-obsidian-950'
                            : isCurrent
                              ? 'border-ai-cyan-500 bg-ai-cyan-500/15 text-ai-cyan-300'
                              : 'border-titanium-800 text-titanium-500'
                        }`}
                      >
                        {isCompleted ? <Check className="h-4 w-4" /> : s}
                      </div>
                      {s < 3 && <div className={`h-px w-12 ${isCompleted ? 'bg-brass-500' : 'bg-titanium-800'}`} />}
                    </div>
                  );
                })}
              </div>

              {error && (
                <div className="mb-8 flex items-start gap-3 rounded-none border border-red-900 bg-red-950/30 p-4">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              {/* Step 1 — Account: OAuth-Provider zuerst, Magic-Link als Fallback */}
              {step === 1 && !magicSent && (
                <div className="space-y-5">
                  <OAuthProviderButtons
                    redirectAfterAuthTo={params.get('next') ?? undefined}
                  />
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-titanium-700/40" />
                    <span className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                      oder mit E-Mail-Magic-Link
                    </span>
                    <div className="h-px flex-1 bg-titanium-700/40" />
                  </div>
                  <form onSubmit={submitAccount} className="space-y-5">
                    <div>
                      <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">
                        E-Mail (für Magic-Link-Login)
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="vorname.name@firma.de"
                        className="mt-2 w-full rounded-none border border-titanium-800 bg-obsidian-900 px-4 py-3 text-sm text-titanium-50 outline-none placeholder:text-titanium-600 focus:border-ai-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">
                        Name (optional)
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Vor- + Nachname"
                        className="mt-2 w-full rounded-none border border-titanium-800 bg-obsidian-900 px-4 py-3 text-sm text-titanium-50 outline-none placeholder:text-titanium-600 focus:border-ai-cyan-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!email || busy}
                      className="inline-flex items-center gap-2 rounded-none bg-white px-6 py-3 text-sm font-semibold text-obsidian-950 transition-colors hover:bg-titanium-200 disabled:cursor-not-allowed disabled:bg-titanium-800 disabled:text-titanium-600"
                    >
                      {busy
                        ? (<><Loader2 className="h-4 w-4 animate-spin" /> Sende Magic-Link …</>)
                        : (<>Magic-Link senden <ArrowRight className="h-4 w-4" /></>)}
                    </button>
                  </form>
                </div>
              )}

              {step === 1 && magicSent && (
                <div className="space-y-3 rounded-none border border-emerald-700 bg-obsidian-900 p-6">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-emerald-400" />
                    <h2 className="font-display text-lg font-bold text-titanium-50">Magic-Link gesendet</h2>
                  </div>
                  <p className="text-sm leading-relaxed text-titanium-300">
                    Wir haben einen Login-Link an <strong className="text-titanium-50">{email}</strong> gesendet.
                    Öffne ihn auf diesem Gerät — du landest automatisch hier zurück und gehst zu Schritt 2.
                  </p>
                  <p className="text-xs text-titanium-500">
                    Keine E-Mail bekommen?{' '}
                    <button
                      type="button"
                      onClick={() => { setMagicSent(false); }}
                      className="text-emerald-400 underline-offset-2 hover:text-emerald-300 hover:underline"
                    >
                      E-Mail-Adresse korrigieren und erneut senden
                    </button>
                  </p>
                </div>
              )}

              {/* Step 2 — API Key */}
              {step === 2 && (
                <div className="space-y-5">
                  <h2 className="font-display text-xl font-bold tracking-tight text-titanium-50">API-Key generieren</h2>
                  <p className="text-sm text-titanium-400">
                    Dein API-Key authentifiziert API-Calls und Webhooks. Speichere ihn sicher — nach diesem
                    Bildschirm kannst du den Plaintext nicht mehr abrufen.
                  </p>

                  {!apiKey ? (
                    <button
                      onClick={generateKey}
                      disabled={busy || !tenantId}
                      className="inline-flex items-center gap-2 rounded-none bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-600 disabled:bg-titanium-800 disabled:text-titanium-600"
                    >
                      {busy
                        ? (<><Loader2 className="h-4 w-4 animate-spin" /> Generiere …</>)
                        : (<>Jetzt generieren <ArrowRight className="h-4 w-4" /></>)}
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-none border border-emerald-700 bg-obsidian-900 p-4">
                        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300">
                          Dein API-Key — einmal anzeigbar
                        </div>
                        <div className="flex items-center gap-3">
                          <code className="flex-1 break-all font-mono text-sm text-emerald-300">{apiKey}</code>
                          <button
                            onClick={copyKey}
                            className="rounded-none border border-titanium-700 p-2 text-titanium-300 hover:border-emerald-500 hover:text-emerald-300"
                            aria-label="Kopieren"
                          >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-none border border-amber-900 bg-amber-950/20 p-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                        <p className="text-xs text-amber-200">
                          Speichere den Key in einem sicheren Secrets-Manager (1Password, Vault, AWS Secrets-Manager).
                          Bei Verlust: neuen Key generieren, alten widerrufen.
                        </p>
                      </div>
                      <button
                        onClick={() => setStep(3)}
                        className="inline-flex items-center gap-2 rounded-none bg-white px-6 py-3 text-sm font-semibold text-obsidian-950 transition-colors hover:bg-titanium-200"
                      >
                        Weiter zu Setup <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3 — Setup */}
              {step === 3 && (
                <div className="space-y-5">
                  <h2 className="font-display text-xl font-bold tracking-tight text-titanium-50">
                    {isCookieSdk ? 'Snippet einbauen' : 'Domain prüfen'}
                  </h2>

                  {isCookieSdk ? (
                    <>
                      <p className="text-sm text-titanium-400">
                        Füge das folgende Snippet im &lt;head&gt; deiner Site ein, vor allem anderen JavaScript:
                      </p>
                      <div className="rounded-none border border-titanium-700 bg-obsidian-950 p-4">
                        <code className="break-all font-mono text-xs leading-relaxed text-emerald-300">
                          {`<script src="https://RealSyncDynamicsAI.de/sdk/cookie-consent.js" data-rsd-key="${apiKey ?? 'YOUR_KEY'}"></script>`}
                        </code>
                      </div>
                      <p className="text-xs text-titanium-500">
                        Stack-agnostisch: WordPress, Shopify, React, Vue, Next, Astro, statisch.
                      </p>
                    </>
                  ) : auditQueued ? (
                    <div className="flex items-start gap-3 rounded-none border border-emerald-700 bg-obsidian-900 p-4">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                      <div>
                        <div className="mb-1 font-display font-bold text-titanium-50">Audit gestartet</div>
                        <p className="text-sm leading-relaxed text-titanium-300">
                          Wir analysieren <strong className="text-titanium-50">{domain}</strong>. Ergebnisse landen
                          in deiner Inbox ({email}) — Tiefenscan binnen 5 Werktagen als signiertes PDF.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-titanium-400">
                        Trage die Domain ein, die wir im Audit-Pro-Tiefenscan analysieren sollen:
                      </p>
                      <input
                        type="text"
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        placeholder="https://example.com"
                        className="w-full rounded-none border border-titanium-800 bg-obsidian-900 px-4 py-3 text-sm text-titanium-50 outline-none placeholder:text-titanium-600 focus:border-ai-cyan-500"
                      />
                      <button
                        onClick={submitAuditDomain}
                        disabled={!domain || busy}
                        className="inline-flex items-center gap-2 rounded-none bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-600 disabled:bg-titanium-800 disabled:text-titanium-600"
                      >
                        {busy
                          ? (<><Loader2 className="h-4 w-4 animate-spin" /> Audit wird gestartet …</>)
                          : (<>Audit starten <ArrowRight className="h-4 w-4" /></>)}
                      </button>
                      <p className="text-xs text-titanium-500">
                        Der Tiefenscan-Bericht kommt innerhalb von 5 Werktagen per E-Mail — als signiertes PDF.
                      </p>
                    </>
                  )}

                  <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={finalizeAndNavigate}
                      className="inline-flex items-center gap-2 rounded-none bg-emerald-500 px-6 py-3 text-sm font-semibold text-obsidian-950 transition-colors hover:bg-emerald-600"
                    >
                      Setup abschließen <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <Link
                      to="/legal/methodology"
                      className="inline-flex items-center gap-2 rounded-none border border-titanium-700 px-6 py-3 text-sm font-semibold text-titanium-200 transition-colors hover:border-titanium-500"
                    >
                      Methodik einsehen
                    </Link>
                  </div>
                </div>
              )}

              {sessionId && (
                <div className="mt-12 border-t border-titanium-900 pt-8 font-mono text-[11px] text-titanium-600">
                  session: {sessionId.slice(0, 24)}…
                </div>
              )}
            </div>
          </main>
        </div>

        <PhotorealEarthGlobe />
      </div>
    </div>
  );
}


function friendlyError(err: unknown, fallback: string): string {
  const raw =
    err instanceof Error ? err.message
    : typeof err === 'string' ? err
    : '';
  const msg = raw.trim();
  if (!msg) return fallback;
  const lower = msg.toLowerCase();
  if (
    lower.includes('failed to send a request') ||
    lower.includes('edge function') ||
    lower.includes('functionsrelayerror') ||
    lower.includes('failed to send a request to the edge function')
  ) {
    return 'Der Audit-Dienst ist gerade nicht erreichbar. Bitte in ein paar Minuten erneut versuchen.';
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed')) {
    return 'Netzwerkfehler — bitte Verbindung prüfen und erneut versuchen.';
  }
  if (lower.includes('jwt') || lower.includes('not authenticated') || lower.includes('unauthorized') || lower.includes('invalid claim')) {
    return 'Sitzung abgelaufen. Bitte neu anmelden.';
  }
  if (lower.includes('cors') || lower.includes('preflight')) {
    return 'Der Audit-Dienst hat die Anfrage abgelehnt. Bitte später erneut versuchen.';
  }
  // Don't surface raw English infrastructure errors on a German page.
  if (/[äöüÄÖÜß]/.test(msg)) return msg;
  if (/[A-Za-z]/.test(msg) && !/[äöüÄÖÜß]/.test(msg) && /\b(error|failed|exception|undefined|null)\b/i.test(msg)) {
    return fallback;
  }
  return msg || fallback;
}

function randString(len: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  const buf = new Uint8Array(len);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
    for (let i = 0; i < len; i++) out += alphabet[buf[i] % alphabet.length];
  } else {
    for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
