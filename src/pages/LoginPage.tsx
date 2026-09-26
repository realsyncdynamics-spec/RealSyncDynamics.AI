/**
 * `/login` — Magic-Link-Anmeldung, Governance OS Handoff v2 (§ 2).
 *
 * Logik aus Welcome.tsx übernommen (signInWithOtp). Der Link aus der E-Mail
 * und die OAuth-Rückkehr landen auf `/welcome` (gleiche Query, also auch
 * `?next=`) — dort laufen Audit-Claim, Tenant-Auflösung und die Weiterleitung
 * wie bisher. `/welcome` bleibt unverändert erreichbar.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check } from 'lucide-react';
import '../styles/governance-os-handoff.css';
import { SEOHead } from '../components/SEOHead';
import { BrandWordmark } from '../components/handoff/BrandWordmark';
import { LangToggle } from '../components/handoff/LangToggle';
import { OAuthProviderButtons } from '../features/auth/OAuthProviderButtons';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { safeInternalPath } from '../lib/safeInternalPath';
import { useLang } from '../i18n/useLang';

function authErrorMessage(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message.trim() : '';
  if (!msg) return fallback;
  const lower = msg.toLowerCase();
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed')) {
    return fallback;
  }
  if (lower.includes('rate limit') || lower.includes('security purposes')) {
    return `${fallback} (${msg})`;
  }
  return fallback;
}

export default function LoginPage() {
  const { t } = useLang();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const search = params.toString() ? `?${params.toString()}` : '';
  const safeNext = safeInternalPath(params.get('next'));
  const welcomePath = `/welcome${search}`;

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Provider-Fehler (?error=… oder #error=…) sichtbar machen und URL säubern.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const err = query.get('error') ?? hash.get('error');
    if (!err) return;
    const desc = query.get('error_description') ?? hash.get('error_description') ?? err;
    setError(`${t('loginAborted')}: ${decodeURIComponent(desc).replace(/\+/g, ' ')}`);
    const next = query.get('next');
    window.history.replaceState({}, '', next ? `${window.location.pathname}?next=${encodeURIComponent(next)}` : window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bereits angemeldet → dieselbe Fortsetzung wie nach dem Magic Link.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    void getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled && data.session?.user) navigate(welcomePath, { replace: true });
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [navigate, welcomePath]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const address = email.trim();
    if (!address) return;
    if (!isSupabaseConfigured()) {
      setError(t('authNotConfigured'));
      return;
    }
    setBusy(true);
    try {
      const { error: otpErr } = await getSupabase().auth.signInWithOtp({
        email: address,
        options: { emailRedirectTo: `${window.location.origin}${welcomePath}` },
      });
      if (otpErr) throw otpErr;
      setSent(true);
    } catch (err) {
      setError(authErrorMessage(err, t('sendFailed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rs-ui rs-login">
      <SEOHead
        title="Anmelden | RealSyncDynamics.AI"
        description="Anmeldung per Magic Link — kein Passwort. Auth über Supabase EU (Frankfurt)."
        canonical="/login"
        noIndex
      />
      <main className="rs-login__main">
        <div className="rs-login__head">
          <BrandWordmark />
          <LangToggle />
        </div>
        <div className="rs-login__form-wrap">
          <div className="rs-login__form">
            <Link to="/" className="rs-login__back">
              <ArrowLeft size={14} aria-hidden="true" />
              {t('back')}
            </Link>
            <h1 className="rs-login__title">{t('loginTitle')}</h1>
            <p className="rs-login__sub">{t('loginSub')}</p>
            {safeNext && <p className="rs-login__note" style={{ marginTop: 8 }}>{t('resumeHint')}</p>}

            {error && (
              <div className="rs-alert" role="alert" style={{ marginTop: 20 }}>
                <AlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{error}</span>
              </div>
            )}

            {sent ? (
              <div className="rs-card" style={{ marginTop: 28 }} data-testid="login-link-sent" role="status">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-flex', width: 28, height: 28, borderRadius: 9999,
                      alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(16,185,129,.15)', color: 'var(--color-rs-success)',
                    }}
                  >
                    <Check size={16} />
                  </span>
                  <div>
                    <p style={{ fontWeight: 600, color: 'var(--color-rs-fg-0)' }}>{t('linkSent')}</p>
                    <p className="rs-mono-line" style={{ marginTop: 2 }}>{email.trim()}</p>
                  </div>
                </div>
                <p className="rs-login__sub" style={{ fontSize: 14 }}>{t('linkSentBody')}</p>
                <Link to={safeNext ?? '/app/dashboard'} className="rs-btn rs-btn--solid rs-btn--h44" style={{ marginTop: 16, width: '100%' }}>
                  {t('openDash')}
                </Link>
                <button
                  type="button"
                  className="rs-login__back"
                  style={{ marginTop: 14, background: 'none', border: 0, cursor: 'pointer', padding: 0 }}
                  onClick={() => setSent(false)}
                >
                  {t('resend')}
                </button>
              </div>
            ) : (
              <form onSubmit={submit} style={{ marginTop: 28 }} noValidate={false}>
                <label htmlFor="login-email" className="rs-overline rs-label">
                  {t('emailLabel')}
                </label>
                <input
                  id="login-email"
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  className="rs-input"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <button
                  type="submit"
                  className="rs-btn rs-btn--solid rs-btn--h44"
                  style={{ marginTop: 14, width: '100%' }}
                  disabled={busy || !email.trim()}
                  data-testid="login-magic-link"
                >
                  {busy ? t('sending') : t('loginBtn')}
                </button>
              </form>
            )}

            <div className="rs-login__divider">
              <span className="rs-overline">{t('orOauth')}</span>
            </div>
            <OAuthProviderButtons redirectAfterAuthTo={welcomePath} />
            <p className="rs-login__note">{t('loginNote')}</p>
          </div>
        </div>
      </main>
      <aside className="rs-login__aside" aria-label={t('trustRuntime')}>
        <p className="rs-overline">{t('trustRuntime')}</p>
        <blockquote className="rs-login__quote">{t('loginQuote')}</blockquote>
        <p className="rs-mono-line">{t('trustMono')}</p>
      </aside>
    </div>
  );
}
