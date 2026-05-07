import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Copy, Check, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Logo } from '../components/Logo';

/**
 * /welcome — Onboarding-Setup-Wizard nach Stripe-Checkout.
 *
 * Flow:
 *   Step 1 — Account-Info bestätigen (email aus session, optional Name)
 *   Step 2 — API-Key generieren + kopieren
 *   Step 3 — Snippet einbauen (für Cookie-SDK Pro) bzw. Domain für Audit-Pro
 *
 * URL: /welcome?session=cs_...&product=...
 *
 * Persistiert Step-State in customer_onboarding-Table sobald User auth'd.
 * Im Pre-Auth-Status wird API-Key über Supabase-Magic-Link erzeugt.
 */
export function Welcome() {
  const [params] = useSearchParams();
  const sessionId = params.get('session');
  const product = params.get('product') ?? 'RealSync Dynamics';
  const [step, setStep] = useState<number>(1);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [domain, setDomain] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Step 1 → 2: Account-Info gespeichert + Magic-Link gesendet
  const submitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) return;
    // In Folge-PR: Magic-Link via supabase.auth.signInWithOtp + customer_onboarding upsert
    setStep(2);
  };

  // Step 2: API-Key generieren — Demo-Generierung clientside; in echter Impl
  // ruft das ein RPC `generate_api_key_for_session(session_id)` auf.
  const generateKey = async () => {
    setError(null);
    const k = `rsd_live_${randString(40)}`;
    setApiKey(k);
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

  // Snippet (Cookie-SDK) bzw. Audit-CTA (Audit-Pro)
  const isCookieSdk = product.includes('Cookie-SDK');

  useEffect(() => {
    if (!sessionId) {
      setError('Keine Session-ID — bitte über den Email-Link öffnen, den wir nach dem Kauf gesendet haben.');
    }
  }, [sessionId]);

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
          {/* Header */}
          <div className="mb-12 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <CheckCircle2 className="h-3 w-3" /> Kauf bestätigt · {product}
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-titanium-50 tracking-tight mb-3">
              Willkommen. Drei Klicks bis zum Setup.
            </h1>
            <p className="text-titanium-400 text-base leading-relaxed">
              Account bestätigen → API-Key generieren → Snippet einbauen oder Domain prüfen.
            </p>
          </div>

          {/* Stepper */}
          <div className="flex items-center justify-center gap-3 mb-12">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 flex items-center justify-center text-sm font-mono border-2 ${
                    step >= s
                      ? 'border-indigo-500 bg-indigo-500 text-white'
                      : 'border-titanium-800 text-titanium-500'
                  }`}
                >
                  {step > s ? <Check className="h-4 w-4" /> : s}
                </div>
                {s < 3 && <div className={`w-12 h-px ${step > s ? 'bg-indigo-500' : 'bg-titanium-800'}`} />}
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-950/30 border border-red-900 rounded-none flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {/* Step 1 — Account */}
          {step === 1 && (
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
                  className="mt-2 w-full bg-obsidian-900 border border-titanium-800 text-titanium-50 px-4 py-3 text-sm rounded-none focus:border-indigo-500 outline-none placeholder:text-titanium-600"
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
                  className="mt-2 w-full bg-obsidian-900 border border-titanium-800 text-titanium-50 px-4 py-3 text-sm rounded-none focus:border-indigo-500 outline-none placeholder:text-titanium-600"
                />
              </div>
              <button
                type="submit"
                disabled={!email}
                className="inline-flex items-center gap-2 bg-white text-obsidian-950 hover:bg-titanium-200 disabled:bg-titanium-800 disabled:text-titanium-600 disabled:cursor-not-allowed px-6 py-3 text-sm font-semibold rounded-none transition-colors"
              >
                Weiter zu API-Key <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {/* Step 2 — API Key */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-display font-bold text-xl text-titanium-50 tracking-tight">API-Key generieren</h2>
              <p className="text-sm text-titanium-400">
                Dein API-Key authentifiziert API-Calls und Webhooks. Speichere ihn sicher — nach diesem
                Bildschirm kannst du ihn nicht mehr abrufen.
              </p>

              {!apiKey ? (
                <button
                  onClick={generateKey}
                  className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 text-sm font-semibold rounded-none transition-colors"
                >
                  Jetzt generieren <ArrowRight className="h-4 w-4" />
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
                      {`<script src="https://realsyncdynamicsai.de/sdk/cookie-consent.js" data-rsd-key="${apiKey ?? 'YOUR_KEY'}"></script>`}
                    </code>
                  </div>
                  <p className="text-xs text-titanium-500">
                    Stack-agnostisch: WordPress, Shopify, React, Vue, Next, Astro, statisch.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-titanium-400">
                    Trage die Domain ein, die wir für deinen Audit-Pro-Tiefenscan analysieren sollen:
                  </p>
                  <input
                    type="url"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full bg-obsidian-900 border border-titanium-800 text-titanium-50 px-4 py-3 text-sm rounded-none focus:border-indigo-500 outline-none placeholder:text-titanium-600"
                  />
                  <p className="text-xs text-titanium-500">
                    Dein Bericht wird innerhalb von 5 Werktagen per Email zugestellt — als signiertes PDF.
                  </p>
                </>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link
                  to={isCookieSdk ? '/cookie-consent-sdk' : '/audit-pro'}
                  className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-obsidian-950 px-6 py-3 text-sm font-semibold rounded-none transition-colors"
                >
                  Setup abschließen <CheckCircle2 className="h-4 w-4" />
                </Link>
                <Link
                  to="/legal/methodology"
                  className="inline-flex items-center gap-2 border border-titanium-700 text-titanium-200 hover:border-titanium-500 px-6 py-3 text-sm font-semibold rounded-none transition-colors"
                >
                  Methodik einsehen
                </Link>
              </div>
            </div>
          )}

          {/* Footer info */}
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
