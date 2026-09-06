/**
 * „Mein Plan" — Kopf des Marketplace (AP7).
 *
 * Vier Dinge, in dieser Reihenfolge: Was ist mein Plan und was kostet er?
 * Was ist enthalten? Was kann ich dazubuchen — und was kostet das ab wann?
 * Was ist gebucht und lässt sich kündigen?
 *
 * Kein neues Dashboard, keine neue Optik: vorhandene Klassen und Tokens der
 * `/app`-Ansichten (Obsidian/Titanium, Hard-Edge). Jeder Knopf tut, was er
 * sagt — ein Add-on ohne Stripe-Price bekommt keinen Knopf, sondern den
 * Grund (`CLAUDE.md` §14).
 */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, CreditCard, Info, Loader2, Plus, X } from 'lucide-react';
import { formatPriceEur, type AddOnId } from '@/shared/pricing';
import { useSubscriptionAddons } from './useSubscriptionAddons';
import {
  formatDate,
  groupAddons,
  includedEntitlements,
  previewSentence,
  unavailableReason,
  type AddonListingEntry,
} from './subscriptionAddons';

export function MyPlanSection() {
  const { listing, loading, busy, error, canManage, add, remove } = useSubscriptionAddons();
  const [bestaetigen, setBestaetigen] = useState<AddOnId | null>(null);

  if (loading && !listing) {
    return (
      <section className="mb-12 border border-titanium-800 bg-obsidian-900 p-5">
        <p className="font-mono text-xs text-titanium-500">Mein Plan wird geladen …</p>
      </section>
    );
  }
  if (!listing) {
    return (
      <section className="mb-12 border border-titanium-800 bg-obsidian-900 p-5">
        <p className="flex items-start gap-2 text-sm text-titanium-400">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error?.message ?? 'Mein Plan konnte nicht geladen werden.'}
        </p>
      </section>
    );
  }

  const gruppen = groupAddons(listing);
  const enthalten = includedEntitlements(listing);
  const abo = listing.subscription;
  const kontingente = enthalten.filter((e) => e.kind === 'limit');
  const faehigkeiten = enthalten.filter((e) => e.kind === 'boolean');

  return (
    <section className="mb-12 space-y-6" aria-label="Mein Plan">
      {/* Kopf */}
      <div className="border border-titanium-800 bg-obsidian-900 p-5">
        <p className="mb-2 font-mono text-xs tracking-widest text-titanium-500">MEIN PLAN</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-titanium-50">{listing.plan.name}</h2>
            <p className="mt-1 font-mono text-sm text-titanium-300">
              {formatPriceEur(listing.totals.plan_eur)} Plan
              {listing.totals.addons_eur > 0 && (
                <> + {formatPriceEur(listing.totals.addons_eur)} Add-ons = <span className="text-titanium-100">{formatPriceEur(listing.totals.monthly_eur)}</span></>
              )}
              {' '}pro Monat
            </p>
          </div>
          <div className="text-right text-xs text-titanium-500">
            {abo?.current_period_end && abo.paid_access && (
              <p className="flex items-center justify-end gap-1.5">
                <CreditCard className="h-3.5 w-3.5" aria-hidden />
                Nächste Abrechnung: {formatDate(abo.current_period_end)}
              </p>
            )}
            {abo?.status === 'past_due' && (
              <p className="mt-1 flex items-center justify-end gap-1.5 text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                Zahlung offen
                {abo.grace_days_remaining !== null && (
                  <> — noch {abo.grace_days_remaining} {abo.grace_days_remaining === 1 ? 'Tag' : 'Tage'}, dann pausieren die bezahlten Funktionen</>
                )}
              </p>
            )}
            {abo && !abo.paid_access && (
              <p className="mt-1 text-amber-300">Abo nicht wirksam — es gilt der Umfang von Free Audit.</p>
            )}
          </div>
        </div>
      </div>

      {/* Enthalten */}
      <div className="border border-titanium-800 bg-obsidian-900 p-5">
        <h3 className="mb-3 font-mono text-xs tracking-widest text-titanium-500">ENTHALTEN</h3>
        {enthalten.length === 0 ? (
          <p className="text-sm text-titanium-500">Keine Berechtigungen geladen.</p>
        ) : (
          <div className="grid gap-x-8 gap-y-1.5 md:grid-cols-2">
            {kontingente.map((e) => (
              <div key={e.key} className="flex items-baseline justify-between gap-3 border-b border-titanium-900 py-1 text-sm">
                <span className="text-titanium-300">{e.label}</span>
                <span className="font-mono text-titanium-100">{e.display}</span>
              </div>
            ))}
            {faehigkeiten.length > 0 && (
              <ul className="md:col-span-2 mt-2 flex flex-wrap gap-1.5">
                {faehigkeiten.map((e) => (
                  <li key={e.key} className="flex items-center gap-1 border border-titanium-800 px-2 py-0.5 font-mono text-[11px] text-titanium-300">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" aria-hidden /> {e.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Gebucht */}
      {gruppen.booked.length > 0 && (
        <div className="border border-titanium-800 bg-obsidian-900 p-5">
          <h3 className="mb-3 font-mono text-xs tracking-widest text-titanium-500">GEBUCHTE ADD-ONS</h3>
          <div className="space-y-2">
            {gruppen.booked.map((a) => (
              <AddonZeile key={a.id} addon={a} busy={busy === a.id}>
                {canManage && (
                  bestaetigen === a.id ? (
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-titanium-400">Wirklich kündigen? Die Berechtigungen entfallen sofort, die Gutschrift erfolgt anteilig.</span>
                      <button type="button" onClick={async () => { setBestaetigen(null); await remove(a.id); }} className="border border-amber-500/60 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/10">
                        Ja, kündigen
                      </button>
                      <button type="button" onClick={() => setBestaetigen(null)} className="px-2 py-1.5 text-xs text-titanium-400 hover:text-titanium-200">Abbrechen</button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setBestaetigen(a.id)} disabled={busy !== null} className="inline-flex items-center gap-1.5 border border-titanium-700 px-3 py-1.5 text-xs font-medium text-titanium-300 hover:border-titanium-500 hover:text-titanium-100 disabled:opacity-50">
                      <X className="h-3 w-3" aria-hidden /> Kündigen
                    </button>
                  )
                )}
              </AddonZeile>
            ))}
          </div>
        </div>
      )}

      {/* Zubuchbar */}
      {(gruppen.bookable.length > 0 || gruppen.unavailable.length > 0) && (
        <div className="border border-titanium-800 bg-obsidian-900 p-5">
          <h3 className="mb-3 font-mono text-xs tracking-widest text-titanium-500">ZUBUCHBAR</h3>
          {error && (
            <p className="mb-3 flex items-start gap-2 border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {error.message}
            </p>
          )}
          <div className="space-y-2">
            {gruppen.bookable.map((a) => (
              <AddonZeile key={a.id} addon={a} busy={busy === a.id} vorschau>
                {canManage ? (
                  bestaetigen === a.id ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-titanium-200">{previewSentence(a)}</span>
                      <button type="button" onClick={async () => { setBestaetigen(null); await add(a.id); }} className="inline-flex items-center gap-1.5 border border-ai-cyan-500 bg-ai-cyan-500/10 px-3 py-1.5 text-xs font-medium text-ai-cyan-300 hover:bg-ai-cyan-500/20">
                        <CheckCircle2 className="h-3 w-3" aria-hidden /> Jetzt buchen
                      </button>
                      <button type="button" onClick={() => setBestaetigen(null)} className="px-2 py-1.5 text-xs text-titanium-400 hover:text-titanium-200">Abbrechen</button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setBestaetigen(a.id)} disabled={busy !== null || !abo?.has_stripe_subscription} title={abo?.has_stripe_subscription ? undefined : 'Add-ons setzen ein laufendes Abo voraus.'} className="inline-flex items-center gap-1.5 border border-ai-cyan-500 bg-ai-cyan-500/10 px-3 py-1.5 text-xs font-medium text-ai-cyan-300 hover:bg-ai-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50">
                      <Plus className="h-3 w-3" aria-hidden /> Zubuchen
                    </button>
                  )
                ) : (
                  <span className="text-xs text-titanium-500">Buchung nur durch Owner oder Admin.</span>
                )}
              </AddonZeile>
            ))}
            {gruppen.unavailable.map((a) => (
              <AddonZeile key={a.id} addon={a} busy={false}>
                <span className="flex items-center gap-1.5 text-xs text-titanium-500">
                  <Clock className="h-3 w-3" aria-hidden /> {unavailableReason(a)}
                </span>
              </AddonZeile>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function AddonZeile({ addon, busy, vorschau = false, children }: {
  addon: AddonListingEntry;
  busy: boolean;
  vorschau?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 border border-titanium-900 bg-obsidian-950 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-titanium-100">{addon.name}</span>
          {addon.quantity > 1 && <span className="font-mono text-[10px] text-titanium-500">× {addon.quantity}</span>}
          <span className="font-mono text-xs text-titanium-300">{formatPriceEur(addon.price_eur)} {addon.price_note}</span>
        </div>
        <p className="truncate text-xs text-titanium-500">{addon.description}</p>
        {vorschau && (
          <p className="mt-0.5 font-mono text-[11px] text-titanium-600">{previewSentence(addon)}</p>
        )}
      </div>
      <div className="shrink-0">
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-titanium-400" aria-label="wird verarbeitet" /> : children}
      </div>
    </div>
  );
}

export default MyPlanSection;
