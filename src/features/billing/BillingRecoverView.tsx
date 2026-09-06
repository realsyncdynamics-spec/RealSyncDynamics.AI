// Zahlungs-Wiederherstellung — der eine Weg zurück aus dem Zahlungsverzug.
//
// Route: /app/billing/recover (P0-Journey, 2026-09-06)
//
// ## Warum diese Fläche neben `/app/billing` existiert
//
// `/app/billing` steht hinter `RequireAal2` und bleibt dort. Das ist richtig:
// Dort lassen sich Pläne wechseln, Abos kündigen und Rechnungsdaten ändern —
// privilegierte Vorgänge, für die ADR 0006 den zweiten Faktor verlangt.
//
// Der Zahlungsverzug bringt aber genau die Konstellation hervor, in der diese
// Sperre gegen den Kunden arbeitet: Die Karte ist abgelaufen, der Hinweis
// zählt die Gnadenfrist herunter, und der einzige Knopf, der die Frist stoppen
// würde, liegt hinter einer MFA-Hürde. Wer sein Authenticator-Gerät gerade
// nicht zur Hand hat, verliert am achten Tag die bezahlten Berechtigungen —
// nicht weil er nicht zahlen wollte, sondern weil er nicht zahlen konnte.
//
// Diese Seite löst das, ohne die Sperre aufzuweichen: Sie kann genau eine
// Sache, nämlich das Zahlungsmittel erneuern. Kein Planwechsel, keine
// Kündigung, keine Rechnungshistorie, keine Team- oder Steuerdaten.
//
// ## Wo der eingeschränkte Umfang durchgesetzt wird
//
// Nicht hier. Diese Datei fragt die Edge Function `stripe-portal` mit
// `flow: 'payment_method_update'` — Stripe erzeugt daraufhin eine
// Portal-Sitzung, die nur den Zahlungsmittel-Dialog kennt. Eine Oberfläche,
// die bloß weniger Knöpfe zeigt, wäre keine Einschränkung; die Sitzung selbst
// muss eingeschränkt sein, sonst führte die URL wieder ins volle Portal.
//
// Die Rollenprüfung bleibt unverändert serverseitig: nur `owner`/`admin`
// dürfen eine Portal-Sitzung öffnen. Der Wegfall von AAL2 ändert daran nichts.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CreditCard, Loader2, ShieldCheck, ArrowRight } from 'lucide-react';

import { useTenant } from '../../core/access/TenantProvider';
import { useEntitlements } from '../../core/billing/useEntitlements';
import { getSupabase } from '../../lib/supabase';

export function BillingRecoverView() {
  const { tenants, activeTenantId } = useTenant();
  const { paymentState } = useEntitlements();

  const activeTenant = tenants.find((t) => t.tenantId === activeTenantId);
  const canManage = activeTenant?.role === 'owner' || activeTenant?.role === 'admin';

  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const istVerzug = paymentState.status === 'past_due';
  const tage = paymentState.graceDaysRemaining;

  async function openPaymentMethodUpdate() {
    if (!activeTenantId) return;
    setOpening(true);
    setError(null);
    try {
      const sb = getSupabase();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error('Nicht angemeldet.');
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-portal`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenant_id: activeTenantId,
            // Der eingeschränkte Umfang, den diese Seite zusagt.
            flow: 'payment_method_update',
            return_url: window.location.href,
          }),
        },
      );
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error?.message ?? `HTTP ${resp.status}`);
      window.location.href = body.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setOpening(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="font-display font-bold text-titanium-50 text-xl tracking-tight">
          Zahlungsmittel erneuern
        </h1>
        <p className="mt-2 text-sm text-titanium-400 leading-relaxed">
          Hier lässt sich ausschließlich die hinterlegte Zahlungsmethode aktualisieren.
          Plan, Kündigung und Rechnungen bleiben der{' '}
          <Link to="/app/billing" className="text-security-400 hover:underline">
            Abrechnungsverwaltung
          </Link>{' '}
          vorbehalten.
        </p>
      </header>

      {istVerzug && (
        <div
          role="status"
          className="flex items-start gap-3 border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={1.75} />
          <span>
            <strong className="font-semibold">Die letzte Abbuchung ist fehlgeschlagen.</strong>{' '}
            {tage === null
              ? 'Ihre Funktionen bleiben vorerst vollständig aktiv.'
              : tage > 0
                ? `Ihre Funktionen bleiben noch ${tage} ${tage === 1 ? 'Tag' : 'Tage'} vollständig aktiv.`
                : 'Die kostenpflichtigen Funktionen sind derzeit pausiert.'}{' '}
            Ihre Daten, Prüfpfade und Nachweise bleiben in jedem Fall erhalten.
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <div className="border border-titanium-800 bg-obsidian-900 p-5 space-y-4">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-titanium-400">
          <CreditCard className="h-3.5 w-3.5" /> Neue Karte oder IBAN hinterlegen
        </h2>
        <p className="text-sm text-titanium-300 leading-relaxed">
          Der Knopf öffnet eine Stripe-Sitzung, die nur den Zahlungsmittel-Dialog enthält.
          Nach dem Speichern kehren Sie hierher zurück; die offene Rechnung wird von Stripe
          erneut eingezogen.
        </p>

        {canManage ? (
          <button
            type="button"
            onClick={openPaymentMethodUpdate}
            disabled={opening || !activeTenantId}
            className="inline-flex items-center gap-2 bg-security-500 hover:bg-security-600 disabled:opacity-40 px-4 py-2.5 text-sm font-semibold text-white"
          >
            {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Zahlungsmethode aktualisieren
          </button>
        ) : (
          // Dieselbe Rollenschranke wie serverseitig — hier nur als Erklärung,
          // damit ein Mitglied ohne Recht nicht auf einen Knopf drückt, den die
          // Function anschließend mit 403 beantwortet.
          <p className="flex items-start gap-2 text-sm text-titanium-400">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-titanium-600" />
            Nur Inhaber und Administratoren des Arbeitsbereichs können das Zahlungsmittel
            ändern. Bitte wenden Sie sich an eine dieser Personen.
          </p>
        )}
      </div>

      <p className="text-xs text-titanium-500">
        Fragen zu Rechnung oder Steuer:{' '}
        <a href="mailto:billing@realsyncdynamicsai.de" className="text-security-400 hover:underline">
          billing@realsyncdynamicsai.de
        </a>
        .{' '}
        <Link to="/app/dashboard" className="inline-flex items-center gap-1 text-security-400 hover:underline">
          Zurück zur Übersicht <ArrowRight className="h-3 w-3" />
        </Link>
      </p>
    </div>
  );
}

export default BillingRecoverView;
