import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';

export function StripeOAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const storedState = sessionStorage.getItem('stripe_oauth_state');

        if (state !== storedState) {
          throw new Error('OAuth state mismatch - potential security issue');
        }

        if (!code) {
          throw new Error('No authorization code received');
        }

        // Exchange code for access token via your backend
        const response = await fetch('/api/integrations/stripe/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to connect Stripe');
        }

        setStatus('success');
        sessionStorage.removeItem('stripe_oauth_state');

        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          navigate('/app/seo-marketing-dashboard');
        }, 2000);
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Stripe OAuth callback error:', err);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-obsidian-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        {status === 'loading' && (
          <div className="text-center">
            <Loader size={48} className="mx-auto mb-4 text-blue-600 animate-spin" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Verbinde mit Stripe...
            </h2>
            <p className="text-slate-600">
              Dieser Vorgang dauert einen Moment.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <CheckCircle size={48} className="mx-auto mb-4 text-green-600" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Erfolgreich verbunden!
            </h2>
            <p className="text-slate-600 mb-4">
              Ihr Stripe-Konto wurde erfolgreich verbunden.
            </p>
            <p className="text-sm text-slate-500">
              Weiterleitung zum Dashboard...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-red-600" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Verbindung fehlgeschlagen
            </h2>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => navigate('/app/seo-marketing-dashboard')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Zum Dashboard zurück
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
