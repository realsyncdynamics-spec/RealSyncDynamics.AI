/**
 * Lead-/Scan-Daten bei der Konto-Löschung (Art. 17) — Entscheidungslogik.
 *
 * Deno-frei, damit Vitest sie direkt prüfen kann.
 *
 * FAIL CLOSED: Jede fehlgeschlagene oder nicht belegbare Lead-Löschung bricht
 * die Konto-Löschung ab — auch wenn die RPC (noch) nicht existiert. Sonst
 * wäre das Konto weg und die Adresse bliebe in sales_leads, gdpr_audits und
 * Mail-Serien zurück, ohne dass der Nutzer sie noch selbst löschen könnte.
 */

export interface LeadErasureCounts {
  sales_leads_deleted: number;
  gdpr_audits_anonymized: number;
  drip_rows_deleted: number;
  newsletter_rows_deleted: number;
  waitlist_rows_deleted: number;
}

export type LeadErasureCheck =
  | { ok: true; counts: LeadErasureCounts; receiptId: string | null }
  | { ok: false; status: 500 | 503; code: string; message: string; logCode: string | null };

const KEYS: Array<keyof LeadErasureCounts> = [
  'sales_leads_deleted',
  'gdpr_audits_anonymized',
  'drip_rows_deleted',
  'newsletter_rows_deleted',
  'waitlist_rows_deleted',
];

export function checkLeadErasure(
  data: unknown,
  error: { code?: string; message?: string } | null,
): LeadErasureCheck {
  if (error) {
    const missing = error.code === 'PGRST202' || error.code === '42883';
    return {
      ok: false,
      status: missing ? 503 : 500,
      code: missing ? 'ERASURE_UNAVAILABLE' : 'ERASURE_FAILED',
      // Keine Fehlerdetails nach außen: Sie könnten die Adresse enthalten.
      message: missing
        ? 'Die Löschung ist vorübergehend nicht möglich. Ihr Konto wurde nicht verändert. Bitte versuchen Sie es später erneut.'
        : 'Die Löschung konnte nicht abgeschlossen werden. Ihr Konto wurde nicht verändert.',
      logCode: error.code ?? null,
    };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)
      || KEYS.some((k) => typeof (data as Record<string, unknown>)[k] !== 'number')) {
    return {
      ok: false,
      status: 500,
      code: 'ERASURE_UNVERIFIED',
      message: 'Die Löschung konnte nicht bestätigt werden. Ihr Konto wurde nicht verändert.',
      logCode: 'unexpected_result',
    };
  }
  const counts = {} as LeadErasureCounts;
  for (const k of KEYS) counts[k] = (data as Record<string, number>)[k]!;
  // Vorgangsnummer aus lead_erasure_log — Beleg für die betroffene Person,
  // ohne Bezug zur Adresse.
  const receipt = (data as Record<string, unknown>).receipt_id;
  return { ok: true, counts, receiptId: typeof receipt === 'string' ? receipt : null };
}

/**
 * Ergebnis der Anonymisierungs-Abfragen auswerten.
 *
 * Ein Supabase-Query meldet einen Datenbankfehler als `{ error }` und wird
 * dabei NICHT abgelehnt. `Promise.allSettled` allein sieht deshalb nur
 * Netzwerk-/Laufzeitfehler (Prüfung vom 19.10.2026). Beides zählt hier als
 * Fehlschlag; der Aufrufer bricht ab, bevor das Konto gelöscht wird.
 */
export function anonymizationFailures(
  results: ReadonlyArray<PromiseSettledResult<{ error: { code?: string; message?: string } | null } | null | undefined>>,
  tables: readonly string[],
): Array<{ table: string; code: string | null }> {
  const failures: Array<{ table: string; code: string | null }> = [];
  results.forEach((r, i) => {
    const table = tables[i] ?? `#${i}`;
    if (r.status === 'rejected') {
      failures.push({ table, code: 'rejected' });
    } else if (!r.value || r.value.error) {
      failures.push({ table, code: r.value?.error?.code ?? 'no_result' });
    }
  });
  return failures;
}
