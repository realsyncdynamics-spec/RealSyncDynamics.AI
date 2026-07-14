import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2, ArrowRight, Copy, Check, AlertTriangle, ArrowLeft, Loader2, Mail,
} from 'lucide-react';
import { OAuthProviderButtons } from '../features/auth/OAuthProviderButtons';
import { Logo } from '../components/Logo';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * /welcome — Onboarding-Setup-Wizard nach Stripe-Checkout.
 *
 * Step 1 — Email eingeben → Magic-Link wird per Supabase signInWithOtp versendet.
 * Step 2 — Nach Magic-Link-Klick ist der User signed-in (auto_tenant_on_signup
 *          legt Tenant + Owner-Membership an); wir generieren clientseitig einen
 *          rsd_live_*-Key, hashen mit SHA-256 und speichern via RLS in api_keys.
 *          Plaintext wird einmalig angezeigt.
 * Step 3 — Cookie-SDK: Snippet mit echtem Key. Audit-Pro: Domain-Submit triggert
 *          die gdpr-audit Edge-Function.
 *
 * URL: /welcome?session=cs_...&product=...
 */
export function Welcome() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get('session');
  const product = params.get('product') ?? 'RealSync Dynamics';
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

  // Detect signed-in state on mount + on auth changes (post-magic-link return)
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const sb = getSupabase();
    let cancelled = false;

    sb.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session?.user) {
        setEmail((prev) => prev || data.session?.user.email || '');
        setStep((prev) => (prev === 1 ? 2 : prev));
      }
    });

    const { data: subscription } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setEmail((prev) => prev || session.user.email || '');
        setStep((prev) => (prev === 1 ? 2 : prev));

        // Nach Login: ?next= auslesen und weiterleiten (z.B. /checkout/starter?pilot=true)
        const nextParam = new URLSearchParams(window.location.search).get('next');
        if (nextParam) {
          // Consent aus sessionStorage persistieren (fire-and-forget)
          try {
            const raw = sessionStorage.getItem('rsd_pending_audit');
            if (raw) {
              const pending = JSON.parse(raw) as {
                audit_id: string; analytics_consent: boolean;
                consent_version: string; consent_type: string;
              };
              if (pending.analytics_consent) {
                sb.from('user_consents').insert({
                  user_id: session.user.id,
                  scan_result_id: pending.audit_id,
                  consent_type: pending.consent_type,
                  consent_version: pending.consent_version,
                  granted: true,
                }).then(() => {/* fire-and-forget */});
              }
              sessionStorage.removeItem('rsd_pending_audit');
            }
          } catch { /* sessionStorage nicht verfügbar */ }
          navigate(nextParam, { replace: true });
          return;
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

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
        setError(lookupErr.message);
        return;
      }
      if (data?.tenant_id) setTenantId(data.tenant_id);
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
      setError(err instanceof Error ? err.message : 'Magic-Link konnte nicht gesendet werden.');
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
      setError(err instanceof Error ? err.message : 'API-Key-Generierung fehlgeschlagen.');
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
      setError(err instanceof Error ? err.message : 'Audit konnte nicht gestartet werden.');
    } finally {
      setBusy(false);
    }
  };

  const isCookieSdk = product.includes('Cookie-SDK');

  // Final "Setup abschließen" CTA — mark wizard complete, then navigate to dashboard.
  // Post-Checkout-Flow: ALLE Benutzer gehen zu /app/dashboard (Workspace-Home),
  // um das Governance-OS zu sehen. Keine Umleitung zu Produktseiten; diese sind
  // über die Dashboard-Navigation erreichbar.
  // ?next=<safe-path> hat Vorrang (z.B. für interruptive Checkouts).
  // Sicherheits-Whitelist: nur Pfade die mit / starten und KEIN //
  // (Open-Redirect-Schutz) werden akzeptiert.
  const finalizeAndNavigate = async () => {
    const nextParam = new URLSearchParams(window.location.search).get('next');
    const safeNext =
      nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
        ? nextParam
        : null;
    // Post-Checkout oder generischer Login: BEIDE gehen zu /app/dashboard.
    // Das ist das zentrale Workspace-Home, von dem aus alle Features erreichbar sind.
    const target = safeNext ?? '/app/dashboard';
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

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Logo size={24} />
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-2xl mx-auto">
          <div className="mb-12 text-center">
            {sessionId ? (
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
                  <CheckCircle2 className="h-3 w-3" /> Kauf bestätigt · {product}
                </div>
                <h1 className="text-3xl sm:text-4xl font-display font-bold text-titanium-50 tracking-tight mb-3">
                  Willkommen. Drei Klicks bis zum Setup.
                </h1>
                <p className="text-titanium-400 text-base leading-relaxed">
                  Account bestätigen → API-Key generieren → Snippet einbauen oder Domain prüfen.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-3xl sm:text-4xl font-display font-bold text-titanium-50 tracking-tight mb-3">
                  Willkommen zurück.
                </h1>
                <p className="text-titanium-400 text-base leading-relaxed">
                  Account bestätigen → API-Key generieren → Snippet einbauen oder Domain prüfen.
                </p>
              </>
            )}
          </div>

          <div className="flex items-center justify-center gap-3 mb-12">
            {[1, 2, 3].map((s) => {
              const isCompleted = step > s;
              const isCurrent = step === s;
              return (
                <div key={s} className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 flex items-center justify-center text-sm font-mono border-2 transition-colors ${
                      isCompleted
                        ? 'border-brass-500 bg-brass-500 text-obsidian-950'
                        : isCurrent
                          ? 'border-ai-cyan-500 bg-ai-cyan-500/15 text-ai-cyan-300'
                          : 'border-titanium-800 text-titanium-500'
                    }`}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : s}
                  </div>
                  {s < 3 && <div className={`w-12 h-px ${isCompleted ? 'bg-brass-500' : 'bg-titanium-800'}`} />}
                </div>
              );
            })}
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-950/30 border border-red-900 rounded-none flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
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
                <div className="flex-1 h-px bg-titanium-700/40" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">
                  oder mit Email-Magic-Link
                </span>
                <div className="flex-1 h-px bg-titanium-700/40" />
              </div>
              <form onSubmit={submitAccount} className="space-y-5">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500">
                  E-Mail (für Magic-Link-Login)
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vorname.name@firma.de"
                  className="mt-2 w-full bg-obsidian-900 border border-titanium-800 text-titanium-50 px-4 py-3 text-sm rounded-none focus:border-ai-cyan-500 outline-none placeholder:text-titanium-600"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500">
                  Name (optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Vor- + Nachname"
                  className="mt-2 w-full bg-obsidian-900 border border-titanium-800 text-titanium-50 px-4 py-3 text-sm rounded-none focus:border-ai-cyan-500 outline-none placeholder:text-titanium-600"
                />
              </div>
              <button
                type="submit"
                disabled={!email || busy}
                className="inline-flex items-center gap-2 bg-white text-obsidian-950 hover:bg-titanium-200 disabled:bg-titanium-800 disabled:text-titanium-600 disabled:cursor-not-allowed px-6 py-3 text-sm font-semibold rounded-none transition-colors"
              >
                {busy
                  ? (<><Loader2 className="h-4 w-4 animate-spin" /> Sende Magic-Link …</>)
                  : (<>Magic-Link senden <ArrowRight className="h-4 w-4" /></>)}
              </button>
            </form>
            </div>
          )}

          {step === 1 && magicSent && (
            <div className="p-6 bg-obsidian-900 border border-emerald-700 rounded-none space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-emerald-400" />
                <h2 className="font-display font-bold text-lg text-titanium-50">Magic-Link gesendet</h2>
              </div>
              <p className="text-sm text-titanium-300 leading-relaxed">
                Wir haben einen Login-Link an <strong className="text-titanium-50">{email}</strong> gesendet.
                Öffne ihn auf diesem Gerät — du landest automatisch hier zurück und gehst zu Schritt 2.
              </p>
              <p className="text-xs text-titanium-500">
                Keine E-Mail bekommen?{' '}
                <button
                  type="button"
                  onClick={() => { setMagicSent(false); }}
                  className="text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline"
                >
                  E-Mail-Adresse korrigieren und erneut senden
                </button>
              </p>
            </div>
          )}

          {/* Step 2 — API Key */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-display font-bold text-xl text-titanium-50 tracking-tight">API-Key generieren</h2>
              <p className="text-sm text-titanium-400">
                Dein API-Key authentifiziert API-Calls und Webhooks. Speichere ihn sicher — nach diesem
                Bildschirm kannst du den Plaintext nicht mehr abrufen.
              </p>

              {!apiKey ? (
                <button
                  onClick={generateKey}
                  disabled={busy || !tenantId}
                  className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-titanium-800 disabled:text-titanium-600 text-white px-6 py-3 text-sm font-semibold rounded-none transition-colors"
                >
                  {busy
                    ? (<><Loader2 className="h-4 w-4 animate-spin" /> Generiere …</>)
                    : (<>Jetzt generieren <ArrowRight className="h-4 w-4" /></>)}
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-obsidian-900 border border-emerald-700 rounded-none">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-300 mb-2">
                      Dein API-Key — einmal anzeigbar
                    </div>
                    <div className="flex items-center gap-3">
                      <code className="flex-1 font-mono text-sm text-emerald-300 break-all">{apiKey}</code>
                      <button
                        onClick={copyKey}
                        className="p-2 border border-titanium-700 hover:border-emerald-500 text-titanium-300 hover:text-emerald-300 rounded-none"
                        aria-label="Kopieren"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="p-3 bg-amber-950/20 border border-amber-900 rounded-none flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-200">
                      Speichere den Key in einem sicheren Secrets-Manager (1Password, Vault, AWS Secrets-Manager).
                      Bei Verlust: neuen Key generieren, alten widerrufen.
                    </p>
                  </div>
                  <button
                    onClick={() => setStep(3)}
                    className="inline-flex items-center gap-2 bg-white text-obsidian-950 hover:bg-titanium-200 px-6 py-3 text-sm font-semibold rounded-none transition-colors"
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
              <h2 className="font-display font-bold text-xl text-titanium-50 tracking-tight">
                {isCookieSdk ? 'Snippet einbauen' : 'Domain prüfen'}
              </h2>

              {isCookieSdk ? (
                <>
                  <p className="text-sm text-titanium-400">
                    Füge das folgende Snippet im &lt;head&gt; deiner Site ein, vor allem anderen JavaScript:
                  </p>
                  <div className="p-4 bg-obsidian-950 border border-titanium-700 rounded-none">
                    <code className="font-mono text-xs text-emerald-300 break-all leading-relaxed">
                      {`<script src="https://RealSyncDynamicsAI.de/sdk/cookie-consent.js" data-rsd-key="${apiKey ?? 'YOUR_KEY'}"></script>`}
                    </code>
                  </div>
                  <p className="text-xs text-titanium-500">
                    Stack-agnostisch: WordPress, Shopify, React, Vue, Next, Astro, statisch.
                  </p>
                </>
              ) : auditQueued ? (
                <div className="p-4 bg-obsidian-900 border border-emerald-700 rounded-none flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-display font-bold text-titanium-50 mb-1">Audit gestartet</div>
                    <p className="text-sm text-titanium-300 leading-relaxed">
                      Wir analysieren <strong className="text-titanium-50">{domain}</strong>. Ergebnisse landen
                      in deiner Inbox ({email}) — Tiefenscan binnen 5 Werktagen als signiertes PDF.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-titanium-400">
                    Trage die Domain ein, die wir für deinen Audit-Pro-Tiefenscan analysieren sollen:
                  </p>
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full bg-obsidian-900 border border-titanium-800 text-titanium-50 px-4 py-3 text-sm rounded-none focus:border-ai-cyan-500 outline-none placeholder:text-titanium-600"
                  />
                  <button
                    onClick={submitAuditDomain}
                    disabled={!domain || busy}
                    className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-titanium-800 disabled:text-titanium-600 text-white px-6 py-3 text-sm font-semibold rounded-none transition-colors"
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

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={finalizeAndNavigate}
                  className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-obsidian-950 px-6 py-3 text-sm font-semibold rounded-none transition-colors"
                >
                  Setup abschließen <CheckCircle2 className="h-4 w-4" />
                </button>
                <Link
                  to="/legal/methodology"
                  className="inline-flex items-center gap-2 border border-titanium-700 text-titanium-200 hover:border-titanium-500 px-6 py-3 text-sm font-semibold rounded-none transition-colors"
                >
                  Methodik einsehen
                </Link>
              </div>
            </div>
          )}

          {sessionId && (
            <div className="mt-12 pt-8 border-t border-titanium-900 text-[11px] font-mono text-titanium-600">
              session: {sessionId.slice(0, 24)}…
            </div>
          )}
        </div>
      </main>
    </div>
  );
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
