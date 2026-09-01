/**
 * Add-on-Buchung aus dem Dashboard — Client der Edge Function
 * `subscription-addons` (AP6) plus die reinen Helfer für „Mein Plan" (AP7).
 *
 * Die Function liefert alles, was die Fläche braucht, in **einer** Antwort:
 * Plan, Abo-Zustand, wirksame Entitlements, jedes Add-on mit seinem Zustand
 * und einer Preisvorschau. Der Zustand je Add-on (`AddonOfferStatus`) wird
 * serverseitig mit derselben Funktion bestimmt, die diese Datei nicht noch
 * einmal implementiert — `addonOfferStatus()` in `shared/pricing.ts`.
 *
 * Kein Betrag entsteht hier. Beträge kommen aus der Antwort, die sie aus der
 * Pricing-SSoT rechnet.
 */
import { getSupabase } from '../../lib/supabase';
import { entitlementLabel } from '../../core/access/entitlementLabels';
import {
  formatPriceEur,
  type AddOnId,
  type AddonOfferStatus,
  type EntitlementKey,
} from '@/shared/pricing';

export type SubscriptionAddonAction = 'list' | 'add' | 'remove';

export interface AddonListingEntry {
  id: AddOnId;
  name: string;
  description: string;
  price_eur: number;
  price_note: string;
  bullets: string[];
  per_unit: boolean;
  grants: Partial<Record<EntitlementKey, number>>;
  status: AddonOfferStatus;
  missing: EntitlementKey[];
  quantity: number;
  stripe_item_id: string | null;
  preview: {
    current_monthly_eur: number;
    delta_monthly_eur: number;
    new_monthly_eur: number;
    effective_from: string;
    full_amount_from: string | null;
  };
}

export interface AddonListing {
  ok: true;
  plan: { id: string; plan_key: string; name: string; monthly_eur: number; availability: string };
  subscription: {
    status: string;
    paid_access: boolean;
    current_period_end: string | null;
    past_due_since: string | null;
    grace_days_remaining: number | null;
    has_stripe_subscription: boolean;
  } | null;
  entitlements: { key: string; kind: 'boolean' | 'limit'; value: number }[];
  addons: AddonListingEntry[];
  totals: { plan_eur: number; addons_eur: number; monthly_eur: number };
}

export interface AddonApiError {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}

async function readApiError(error: unknown): Promise<AddonApiError> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = (await ctx.json()) as AddonApiError;
      if (body?.error?.code) return { ok: false, error: body.error };
    } catch { /* fall through */ }
  }
  return {
    ok: false,
    error: {
      code: 'NETWORK',
      message: error instanceof Error ? error.message : 'Add-ons konnten nicht geladen werden.',
    },
  };
}

/** Ein Aufruf, drei Aktionen. `list` für jedes Mitglied, der Rest owner/admin. */
export async function invokeSubscriptionAddons(
  tenantId: string,
  action: SubscriptionAddonAction,
  addonId?: AddOnId,
  quantity?: number,
): Promise<AddonListing | AddonApiError> {
  const { data, error } = await getSupabase().functions.invoke('subscription-addons', {
    body: { tenant_id: tenantId, action, addon_id: addonId, quantity },
  });
  if (error) return readApiError(error);
  const body = data as AddonListing | AddonApiError;
  if (!body || body.ok !== true) return (body as AddonApiError) ?? readApiError(new Error('leere Antwort'));
  return body;
}

// ── Reine Helfer für die Anzeige ─────────────────────────────────────────

export { entitlementLabel } from '../../core/access/entitlementLabels';

/** `-1` heißt unbegrenzt; sonst die Zahl mit Tausenderpunkt. */
export function formatEntitlementValue(kind: 'boolean' | 'limit', value: number): string {
  if (kind === 'boolean') return value === -1 || value > 0 ? 'enthalten' : 'nicht enthalten';
  if (value === -1) return 'unbegrenzt';
  return new Intl.NumberFormat('de-DE').format(value);
}

export interface IncludedEntitlement {
  key: string;
  label: string;
  kind: 'boolean' | 'limit';
  value: number;
  display: string;
}

/**
 * Was der Mandant heute hält — nur das, was tatsächlich gewährt ist.
 * Kontingente zuerst, dann Fähigkeiten; innerhalb alphabetisch nach Label,
 * damit die Liste bei jedem Laden gleich aussieht.
 */
export function includedEntitlements(listing: Pick<AddonListing, 'entitlements'>): IncludedEntitlement[] {
  const rows = listing.entitlements
    .filter((e) => e.value === -1 || e.value > 0)
    // Das Scan-Kontingent ist seit dem 2026-08-24 in jedem Plan unbegrenzt
    // und keine Verkaufsgröße mehr — es würde die Liste nur verlängern.
    .filter((e) => e.key !== 'website.scan_monthly_limit')
    .map((e) => ({
      key: e.key,
      label: entitlementLabel(e.key),
      kind: e.kind,
      value: e.value,
      display: formatEntitlementValue(e.kind, e.value),
    }));
  return rows.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'limit' ? -1 : 1;
    return a.label.localeCompare(b.label, 'de');
  });
}

export interface AddonGroups {
  booked: AddonListingEntry[];
  bookable: AddonListingEntry[];
  /** Ehrlich benannt: alles, was heute nicht gebucht werden kann, mit Grund. */
  unavailable: AddonListingEntry[];
}

/** Gebucht · zubuchbar · nicht verfügbar — die drei Listen der Fläche. */
export function groupAddons(listing: Pick<AddonListing, 'addons'>): AddonGroups {
  const groups: AddonGroups = { booked: [], bookable: [], unavailable: [] };
  for (const addon of listing.addons) {
    if (addon.status === 'booked') groups.booked.push(addon);
    else if (addon.status === 'bookable') groups.bookable.push(addon);
    // `not_for_plan` und `included` sind für diesen Mandanten kein Angebot —
    // sie werden nicht als „nicht verfügbar" gelistet, das wäre Rauschen.
    else if (addon.status === 'not_purchasable' || addon.status === 'missing_dependency') groups.unavailable.push(addon);
  }
  return groups;
}

/** Warum ein Add-on heute nicht gebucht werden kann — in einem Satz. */
export function unavailableReason(addon: Pick<AddonListingEntry, 'status' | 'missing'>): string {
  switch (addon.status) {
    case 'not_purchasable':
      return 'Buchung folgt — der Zahlungsweg für dieses Add-on wird gerade eingerichtet.';
    case 'missing_dependency':
      return `Setzt voraus: ${addon.missing.map(entitlementLabel).join(', ')}.`;
    case 'not_for_plan':
      return 'Für Ihren Plan nicht vorgesehen.';
    case 'included':
      return 'In Ihrem Umfang bereits enthalten.';
    default:
      return '';
  }
}

/** „249 € → 399 € / Monat, voll ab 1.10.2026" */
export function previewSentence(entry: Pick<AddonListingEntry, 'preview'>): string {
  const p = entry.preview;
  const von = formatPriceEur(p.current_monthly_eur);
  const nach = formatPriceEur(p.new_monthly_eur);
  const plus = formatPriceEur(p.delta_monthly_eur);
  const datum = p.full_amount_from ? formatDate(p.full_amount_from) : null;
  return datum
    ? `${von} + ${plus} = ${nach} pro Monat · anteilig ab sofort, voll ab ${datum}`
    : `${von} + ${plus} = ${nach} pro Monat · anteilig ab sofort`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}
