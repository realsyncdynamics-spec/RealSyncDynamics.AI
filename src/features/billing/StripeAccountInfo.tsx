import React from 'react';
import { CreditCard, Copy, CheckCircle2, AlertCircle } from 'lucide-react';

interface StripeAccountInfoProps {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  onOpenPortal: () => void;
  canManage: boolean;
}

export function StripeAccountInfo({
  stripeCustomerId,
  stripeSubscriptionId,
  status,
  cancelAtPeriodEnd,
  currentPeriodEnd,
  onOpenPortal,
  canManage,
}: StripeAccountInfoProps) {
  const [copied, setCopied] = React.useState<'customer' | 'subscription' | null>(null);

  function copyToClipboard(text: string, type: 'customer' | 'subscription') {
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    }
  }

  if (!stripeCustomerId) {
    return (
      <div className="bg-obsidian-900 rounded-none border border-titanium-900 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-display font-bold text-titanium-50 text-sm mb-1">Kein Stripe-Konto verknüpft</h3>
            <p className="text-xs text-titanium-400 leading-relaxed">
              Wechseln Sie zu einem bezahlten Plan, um Stripe-Zahlungsinformationen anzuzeigen.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const periodEndDate = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString('de-DE')
    : null;

  return (
    <div className="space-y-4">
      <div className="bg-obsidian-900 rounded-none border border-titanium-900 p-6">
        <h3 className="font-display font-bold text-titanium-50 text-sm mb-4 flex items-center gap-2">
          <CreditCard className="h-4 w-4" /> Stripe-Konto Informationen
        </h3>

        <div className="space-y-3">
          {/* Customer ID */}
          <div className="bg-obsidian-950 p-3 rounded-none border border-titanium-900">
            <div className="text-xs font-bold text-titanium-400 uppercase tracking-wider mb-1">Kunden-ID</div>
            <div className="flex items-center justify-between">
              <code className="font-mono text-xs text-titanium-300 break-all">{stripeCustomerId}</code>
              <button
                onClick={() => copyToClipboard(stripeCustomerId, 'customer')}
                className="ml-2 p-1.5 text-titanium-500 hover:text-titanium-300 hover:bg-obsidian-900 rounded-none shrink-0"
                title="In Zwischenablage kopieren"
              >
                {copied === 'customer' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Subscription ID */}
          {stripeSubscriptionId && (
            <div className="bg-obsidian-950 p-3 rounded-none border border-titanium-900">
              <div className="text-xs font-bold text-titanium-400 uppercase tracking-wider mb-1">Abo-ID</div>
              <div className="flex items-center justify-between">
                <code className="font-mono text-xs text-titanium-300 break-all">{stripeSubscriptionId}</code>
                <button
                  onClick={() => copyToClipboard(stripeSubscriptionId, 'subscription')}
                  className="ml-2 p-1.5 text-titanium-500 hover:text-titanium-300 hover:bg-obsidian-900 rounded-none shrink-0"
                  title="In Zwischenablage kopieren"
                >
                  {copied === 'subscription' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Status */}
          {status && (
            <div className="bg-obsidian-950 p-3 rounded-none border border-titanium-900">
              <div className="text-xs font-bold text-titanium-400 uppercase tracking-wider mb-1">Status</div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-titanium-300">
                  {status === 'active' && 'Aktiv'}
                  {status === 'trialing' && 'In Testphase'}
                  {status === 'past_due' && 'Überfällig'}
                  {status === 'canceled' && 'Gekündigt'}
                  {status === 'unpaid' && 'Unbezahlt'}
                  {status === 'incomplete' && 'Unvollständig'}
                  {!['active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete'].includes(status) && status}
                </span>
                {cancelAtPeriodEnd && status === 'active' && (
                  <span className="text-xs text-amber-400 font-medium">Wird gekündigt</span>
                )}
              </div>
            </div>
          )}

          {/* Period End */}
          {periodEndDate && (
            <div className="bg-obsidian-950 p-3 rounded-none border border-titanium-900">
              <div className="text-xs font-bold text-titanium-400 uppercase tracking-wider mb-1">
                {cancelAtPeriodEnd ? 'Endet am' : 'Nächste Abrechnung'}
              </div>
              <div className="text-sm text-titanium-300">{periodEndDate}</div>
            </div>
          )}
        </div>
      </div>

      {/* Management Info */}
      {canManage && (
        <div className="bg-obsidian-950 rounded-none border border-titanium-900/60 p-4">
          <p className="text-xs text-titanium-400 leading-relaxed mb-3">
            Um Zahlungsmethode, Rechnungen, Steuernummer oder Abonnement zu verwalten, öffnen Sie das Stripe-Kundenportal.
          </p>
          <button
            onClick={onOpenPortal}
            className="text-xs text-security-400 hover:text-security-300 font-semibold flex items-center gap-1.5"
          >
            Zum Stripe-Portal →
          </button>
        </div>
      )}
    </div>
  );
}
