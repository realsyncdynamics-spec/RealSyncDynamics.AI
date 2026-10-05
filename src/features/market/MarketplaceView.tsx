/**
 * `/app/marketplace` — die zubuchbaren Dienste des Arbeitsbereichs.
 *
 * Der Marketplace beantwortet dem Kunden vier Fragen (Auftrag §22):
 * Was ist bereits aktiv? Was kann ich zusätzlich buchen? Was kostet es?
 * Was passiert nach dem Klick?
 *
 * ## Ehrlichkeit vor Vollständigkeit
 *
 * Die vierte Frage ist der Grund, warum hier **kein** „Aktivieren"-Knopf je
 * Modul steht. Der modulare Checkout (Phase 5 in
 * `docs/product/modular-product-experience.md`) braucht ein eigenes
 * Stripe-Price-Objekt je Modul; die gibt es noch nicht, und
 * `stripe-checkout` nimmt ausschliesslich einen `plan_key`. Ein Knopf
 * „Aktivieren" wäre damit eine Zusage, die niemand einlöst.
 *
 * Stattdessen führt jede Karte auf den Weg, der heute wirklich trägt: den
 * Plan, in dem das Modul enthalten ist. Sobald der modulare Checkout steht,
 * tritt der Knopf an dieselbe Stelle — der Katalog in `moduleCatalog.ts`
 * liefert dann bereits alles, was er braucht.
 *
 * Gestaltung: Hard-Edge Industrial wie die übrigen `/app`-Ansichten
 * (`rounded-none`, Obsidian/Titanium), keine neue Optik.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Info, Sparkles } from 'lucide-react';
import { useEntitlements } from '../../core/billing/useEntitlements';
import { type BookableModuleId } from '@/shared/pricing';
import { buildCatalog, planLabel, addonForModule, type CatalogEntry } from './moduleCatalog';
import { readFunnelContext } from '../../core/onboarding/funnelContext';
import { MyPlanSection } from './MyPlanSection';
import { useSubscriptionAddons } from './useSubscriptionAddons';
import { previewSentence, type AddonListingEntry } from './subscriptionAddons';

export function MarketplaceView() {
  const { tier, loading } = useEntitlements();
  const katalog = useMemo(() => buildCatalog(tier), [tier]);
  const { listing, add, busy, canManage, sandbox } = useSubscriptionAddons();
  const addonByModule = useMemo(() => {
    const byId = new Map((listing?.addons ?? []).map((a) => [a.id, a]));
    const map = new Map<BookableModuleId, AddonListingEntry>();
    for (const eintrag of katalog) {
      const addonId = addonForModule(eintrag.module.id);
      if (!addonId) continue;
      const row = byId.get(addonId);
      if (row) map.set(eintrag.module.id, row);
    }
    return map;
  }, [katalog, listing]);

  // Empfehlung aus dem Trichter, sofern der Kunde über Scan → Empfehlung
  // hierher gekommen ist. Sie ist **keine** Berechtigung und ändert keinen
  // Zustand — sie macht nur sichtbar, was aus den Befunden abgeleitet wurde.
  // Der Kontext liegt in der Sitzung (`funnelContext.ts`); nach einem neuen
  // Tab ist er weg, und dann zeigt der Marketplace schlicht keine Markierung.
  const funnel = useMemo(() => readFunnelContext(), []);
  const empfohlen = useMemo(
    () => new Set<BookableModuleId>(funnel?.selectedModules ?? []),
    [funnel],
  );

  const aktiv = katalog.filter((e) => e.status === 'active');
  const verfuegbar = katalog.filter((e) => e.status !== 'active');

  return (
    <div className="dashboard-context min-h-screen bg-obsidian-950 p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10">
          <p className="mb-2 font-mono text-xs tracking-widest text-titanium-500">MARKETPLACE</p>
          <h1 className="mb-2 text-3xl font-bold text-titanium-50 md:text-4xl">
            Dienste für Ihren Arbeitsbereich
          </h1>
          <p className="max-w-3xl text-titanium-400">
            Governance ist das Fundament. Alles Weitere kommt dazu, wenn Sie es
            brauchen — Frontend-Umbau, Chat, Voice, WhatsApp, Terminbuchung.
          </p>

          {loading && (
            <p className="mt-4 font-mono text-xs text-titanium-500">Berechtigungen werden geladen …</p>
          )}
          {!loading && (
            <p className="mt-4 text-sm text-titanium-400">
              Aktueller Plan:{' '}
              <span className="font-semibold text-titanium-200">{planLabel(tier) ?? tier}</span>
              {' · '}
              <span className="text-titanium-500">
                {aktiv.length} von {katalog.length} Diensten aktiv
              </span>
            </p>
          )}
          {empfohlen.size > 0 && (
            <p className="mt-2 text-sm text-titanium-400">
              Aus Ihrem Scan{funnel?.domain ? ` für ${funnel.domain}` : ''} empfohlen:{' '}
              <span className="font-semibold text-titanium-200">
                {empfohlen.size} {empfohlen.size === 1 ? 'Dienst' : 'Dienste'}
              </span>
              {' — '}
              <span className="text-titanium-500">unten markiert.</span>
            </p>
          )}
        </header>

        {/* AP7 — „Mein Plan" plus Karten, die denselben Buchungsweg nutzen.
            Ein Eurobetrag erscheint nur, wenn subscription-addons das Add-on
            als bookable liefert. Provisorische Modulpreise bleiben unsichtbar. */}
        {sandbox && (
          <p className="mb-6 border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Billing-Sandbox. Buchungen bleiben in diesem Tab, Stripe und die Datenbank werden nicht angefasst.
            Aufruf: <span className="font-mono">?billing=sandbox</span>
          </p>
        )}
        <MyPlanSection />

        {aktiv.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-4 font-mono text-xs tracking-widest text-titanium-500">AKTIV</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {aktiv.map((eintrag) => (
                <Karte key={eintrag.module.id} eintrag={eintrag} empfohlen={empfohlen.has(eintrag.module.id)} addon={addonByModule.get(eintrag.module.id) ?? null} onAdd={add} busy={busy} canManage={canManage} />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-4 font-mono text-xs tracking-widest text-titanium-500">VERFÜGBAR</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {verfuegbar.map((eintrag) => (
              <Karte key={eintrag.module.id} eintrag={eintrag} empfohlen={empfohlen.has(eintrag.module.id)} addon={addonByModule.get(eintrag.module.id) ?? null} onAdd={add} busy={busy} canManage={canManage} />
            ))}
          </div>
        </section>

        <footer className="mt-12 border-t border-titanium-800 pt-6">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-titanium-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Jede Karte hat genau einen Zustand: im Plan enthalten, für den
            Add-on-Preis hinzufügen, oder ein höherer Plan ist nötig.
            Weitere Domain ist ein Mengen-Add-on (19 €). Ein weiteres
            Unternehmen hat noch kein Kontingent und zeigt keinen Preis.
          </p>
        </footer>
      </div>
    </div>
  );
}

function Karte({
  eintrag,
  empfohlen = false,
  addon,
  onAdd,
  busy,
  canManage,
}: {
  eintrag: CatalogEntry;
  empfohlen?: boolean;
  addon: AddonListingEntry | null;
  onAdd: (id: AddonListingEntry['id']) => Promise<boolean>;
  busy: AddonListingEntry['id'] | null;
  canManage: boolean;
}) {
  const { module, status, unlockedByPlan } = eintrag;
  const imPlan = status === 'active' || addon?.status === 'included';
  const gebucht = addon?.status === 'booked';
  const zubuchbar = !imPlan && !gebucht && addon?.status === 'bookable';
  const label = planLabel(unlockedByPlan);

  return (
    <article
      className={`flex flex-col border bg-obsidian-900 p-5 ${
        empfohlen ? 'border-ai-cyan-500/60' : 'border-titanium-800'
      }`}
    >
      {empfohlen && (
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-ai-cyan-300">
          Aus Ihrem Scan empfohlen
        </p>
      )}
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-titanium-50">{module.name}</h3>
        {imPlan || gebucht ? (
          <span className="flex shrink-0 items-center gap-1.5 border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-emerald-300">
            <CheckCircle2 className="h-3 w-3" aria-hidden /> {gebucht && !imPlan ? 'Gebucht' : 'Enthalten'}
          </span>
        ) : zubuchbar ? (
          <span className="shrink-0 border border-ai-cyan-500/40 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-ai-cyan-300">
            Zubuchbar
          </span>
        ) : (
          <span className="shrink-0 border border-titanium-700 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-titanium-400">
            {label ? `Ab ${label}` : 'Anfrage'}
          </span>
        )}
      </div>

      <p className="mb-4 text-sm leading-relaxed text-titanium-400">{module.description}</p>

      <ul className="mb-5 space-y-1.5">
        {module.bullets.slice(0, 3).map((punkt) => (
          <li key={punkt} className="flex items-start gap-2 text-xs leading-relaxed text-titanium-500">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-ai-cyan-500" aria-hidden />
            {punkt}
          </li>
        ))}
      </ul>

      <div className="mt-auto border-t border-titanium-800 pt-4">
        {imPlan && <p className="text-xs text-titanium-500">Im Plan enthalten.</p>}
        {gebucht && !imPlan && addon && (
          <p className="font-mono text-sm text-titanium-200">Gebucht · {addon.price_eur} € / Monat</p>
        )}
        {zubuchbar && addon && (
          <>
            <p className="font-mono text-sm text-titanium-200">+ {addon.price_eur} € / Monat hinzufügen</p>
            <p className="mt-1 text-xs text-titanium-500">{previewSentence(addon)}</p>
            {canManage ? (
              <button
                type="button"
                disabled={busy === addon.id}
                onClick={() => void onAdd(addon.id)}
                className="mt-3 inline-flex items-center gap-2 border border-ai-cyan-500 bg-ai-cyan-500/10 px-3 py-2 text-xs font-medium text-ai-cyan-300 transition-colors hover:bg-ai-cyan-500/20 disabled:opacity-50"
              >
                {busy === addon.id ? 'Wird gebucht …' : `Für +${addon.price_eur} €/Monat hinzufügen`}
                <ArrowRight className="h-3 w-3" aria-hidden />
              </button>
            ) : (
              <p className="mt-3 text-xs text-titanium-500">Nur Inhaber oder Admins können dazubuchen.</p>
            )}
          </>
        )}
        {!imPlan && !gebucht && !zubuchbar && label && (
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 border border-titanium-700 px-3 py-2 text-xs font-medium text-titanium-200 transition-colors hover:border-ai-cyan-500 hover:text-ai-cyan-300"
          >
            Benötigt {label} <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        )}
        {!imPlan && !gebucht && !zubuchbar && !label && (
          <Link
            to="/contact-sales?source=marketplace"
            className="inline-flex items-center gap-2 border border-titanium-700 px-3 py-2 text-xs font-medium text-titanium-200 transition-colors hover:border-ai-cyan-500 hover:text-ai-cyan-300"
          >
            Angebot anfragen <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        )}
      </div>
    </article>
  );
}

export default MarketplaceView;
