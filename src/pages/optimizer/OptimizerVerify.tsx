/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SEITE 5b — /optimizer/auth/verify  (E-Mail-Bestätigung)
 * Typ: INFO/FEEDBACK. Kein Zurück-Button (nur Logout). Auto-Redirect
 * → /optimizer/dashboard, sobald eine Session besteht (bestätigt oder
 * E-Mail-Confirmation im Projekt deaktiviert).
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MailCheck, Loader2, CheckCircle2, AlertTriangle, LogOut } from 'lucide-react';

import { OptimizerLayout } from './OptimizerLayout';
import { supabase, useSupabaseAuth } from '../../features/supabase/SupabaseAuthContext';
import { getPendingEmail } from '../../lib/optimizer/state';

export function OptimizerVerify() {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useSupabaseAuth();
  const [email] = useState<string | null>(() => getPendingEmail());
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendError, setResendError] = useState<string | null>(null);

  // Auto-Redirect, sobald authentifiziert.
  useEffect(() => {
    if (isAuthenticated) navigate('/optimizer/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  async function handleResend() {
    if (!email) return;
    setResendState('sending');
    setResendError(null);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      setResendState('sent');
    } catch (e) {
      setResendState('error');
      setResendError((e as Error).message || 'Erneutes Senden fehlgeschlagen.');
    }
  }

  return (
    <OptimizerLayout
      step={4}
      pageType="feedback"
      metaTitle="E-Mail bestätigen — Cloud Code Optimizer"
      metaDescription="Bestätige deine E-Mail-Adresse, um fortzufahren."
    >
      <div className="text-center py-6">
        <div className="inline-flex items-center justify-center w-16 h-16 border border-security-700 bg-security-900/20 rounded-none mb-6">
          <MailCheck className="h-7 w-7 text-security-400" aria-hidden />
        </div>

        <h1 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 tracking-tight mb-3">
          Fast geschafft — check deine E-Mails
        </h1>
        <p className="text-titanium-300 leading-relaxed max-w-md mx-auto mb-8">
          Wir haben dir {email ? <>einen Bestätigungslink an <span className="font-mono text-titanium-100">{email}</span></> : 'einen Bestätigungslink'} geschickt.
          Klicke den Link, um deinen Optimierungsbericht freizuschalten.
        </p>

        {/* Warte-Indikator */}
        <div className="flex items-center justify-center gap-2 text-sm text-titanium-500 mb-8">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Warte auf Bestätigung …
        </div>

        {/* Resend */}
        <div className="max-w-sm mx-auto">
          <p className="text-sm text-titanium-400 mb-2">E-Mail nicht erhalten?</p>
          {resendState === 'sent' ? (
            <p className="inline-flex items-center gap-1.5 text-sm text-petrol">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Erneut gesendet — prüfe auch den Spam-Ordner.
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={!email || resendState === 'sending'}
              className="inline-flex items-center gap-2 border border-titanium-700 hover:border-titanium-500 disabled:opacity-50 text-titanium-100 font-bold px-5 py-2.5 rounded-none transition-colors"
            >
              {resendState === 'sending' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Bestätigung erneut senden
            </button>
          )}
          {!email && (
            <p className="mt-2 text-xs text-titanium-600">
              Keine Adresse hinterlegt — bitte erneut registrieren.
            </p>
          )}
          {resendState === 'error' && resendError && (
            <div role="alert" className="mt-3 flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3 text-left">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
              <span>{resendError}</span>
            </div>
          )}
        </div>

        {/* Nur Logout statt Zurück */}
        <button
          type="button"
          onClick={async () => { await logout(); navigate('/optimizer/auth'); }}
          className="mt-10 inline-flex items-center gap-1.5 text-sm text-titanium-500 hover:text-titanium-300 transition-colors"
        >
          <LogOut className="h-4 w-4" /> Abmelden &amp; andere Adresse verwenden
        </button>
      </div>
    </OptimizerLayout>
  );
}
