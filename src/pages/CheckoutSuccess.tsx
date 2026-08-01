import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSupabaseAuth } from '../features/supabase/SupabaseAuthContext';
import { useTenant } from '../core/access/TenantProvider';
import { createClient } from '@supabase/supabase-js';

export function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = useSupabaseAuth();
  const tenantState = useTenant();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sessionId = searchParams.get('session_id');
  const planKey = searchParams.get('plan_key');

  useEffect(() => {
    async function verifyCheckout() {
      if (!sessionId || !auth.user?.id || !tenantState.activeTenantId) {
        setError('Missing session or tenant info');
        setLoading(false);
        return;
      }

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false },
        });

        // Get fresh session token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('No active session');
          setLoading(false);
          return;
        }

        // Call edge function to verify and sync Stripe session
        const response = await fetch(
          `${supabaseUrl}/functions/v1/stripe-checkout-verify`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              session_id: sessionId,
              tenant_id: tenantState.activeTenantId,
            }),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          setError(data?.error?.message || 'Failed to verify checkout');
          setLoading(false);
          return;
        }

        const { subscription } = await response.json();

        // Redirect to billing dashboard after 2 seconds to show success message
        setTimeout(() => {
          navigate(`/app/billing?subscription=${subscription.id}&plan=${planKey || 'unknown'}`);
        }, 2000);
      } catch (err) {
        setError((err as Error).message || 'Network error');
        setLoading(false);
      }
    }

    verifyCheckout();
  }, [sessionId, auth, tenantState, planKey, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian-900">
        <div className="max-w-md w-full mx-4 p-8 bg-obsidian-800 border border-titanium-700 rounded-card">
          <h1 className="text-2xl font-bold text-titanium-50 mb-4">Checkout Failed</h1>
          <p className="text-titanium-300 mb-6">{error}</p>
          <button
            onClick={() => navigate('/app/billing')}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-card transition-colors"
          >
            Go to Billing
          </button>
          <button
            onClick={() => navigate('/pricing')}
            className="w-full mt-2 px-4 py-2 bg-obsidian-700 hover:bg-obsidian-600 text-titanium-200 font-medium rounded-card border border-titanium-700 transition-colors"
          >
            Back to Pricing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-obsidian-900">
      <div className="max-w-md w-full mx-4 p-8 bg-obsidian-800 border border-titanium-700 rounded-card text-center">
        <div className="mb-6">
          {/* Animated checkmark */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-900/30 border border-green-600/50 animate-pulse">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-titanium-50 mb-2">Payment Successful!</h1>
        <p className="text-titanium-300 mb-2">
          Your subscription to <span className="font-semibold">{planKey || 'plan'}</span> is now active.
        </p>
        <p className="text-sm text-titanium-400 mb-6">Redirecting to your dashboard...</p>

        {/* Loading indicator */}
        <div className="flex justify-center gap-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>

        {/* Manual navigation fallback */}
        <button
          onClick={() => navigate('/app/billing')}
          className="w-full mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-card transition-colors"
        >
          Go to Dashboard Now
        </button>
      </div>
    </div>
  );
}
