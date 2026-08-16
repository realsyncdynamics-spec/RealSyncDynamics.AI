// Monitoring-Beziehung Asset ↔ Zeitplan pflegen (B3).
//
// Vertrag: docs/architecture/asset-lifecycle-contract.md §5.
// Tabelle:  scan_schedule_assets (Migration 20260823000000).
//
// Warum hier und nicht im Aufrufer: `asset_lifecycle_state` leitet
// "Monitoring aktiv" ausschliesslich aus dieser Relation ab. Wenn jeder
// Schreibpfad selbst daran denken muesste, waere die Ableitung genau so
// verlaesslich wie der nachlaessigste Aufrufer — und der Zustand wuerde still
// zu MONITORING_ACTIVE = false zurueckfallen, obwohl ein Zeitplan laeuft.
//
// Der Zeitplan traegt Domain-Strings (`domains TEXT[]`, Ausfuehrungsliste des
// Dispatchers). Das Asset haengt an der websites-Projektion. Diese Funktion
// uebersetzt zwischen beiden — mehr nicht.

// Strukturell typisiert (wie _shared/findings.ts), damit vitest ohne
// Deno-Specifier mocken kann.
type Thenable<T> = Promise<T> | { then(cb: (v: T) => unknown): unknown };

export interface ScheduleAssetsAdmin {
  // deno-lint-ignore no-explicit-any
  from(table: string): any;
}

export interface SyncResult {
  ok: boolean;
  /** Anzahl verknuepfter Assets nach dem Abgleich. */
  linked: number;
  /** Domains ohne Asset — kein Fehler, aber ein Befund fuer den Aufrufer. */
  unresolved: string[];
  error?: string;
}

/**
 * Gleicht die Asset-Verknuepfungen eines Zeitplans mit seiner Domain-Liste ab.
 *
 * Additiv gedacht: Domains ohne Website-Projektion (und damit ohne Asset)
 * werden gemeldet, nicht erfunden. Ein Zeitplan darf auf eine Domain zeigen,
 * die noch kein Asset hat — er ist dann fuer diese Domain schlicht keine
 * Monitoring-Beziehung im Sinne von §5.
 */
export async function syncScheduleAssets(
  admin: ScheduleAssetsAdmin,
  scheduleId: string,
  tenantId: string,
  domains: string[],
): Promise<SyncResult> {
  if (!scheduleId) return { ok: false, linked: 0, unresolved: [], error: 'scheduleId required' };
  if (!tenantId)   return { ok: false, linked: 0, unresolved: [], error: 'tenantId required' };

  const wanted = [...new Set(domains.filter((d) => !!d))];
  if (wanted.length === 0) {
    // Leere Liste heisst: keine Beziehung. Bestehende werden entfernt, sonst
    // bliebe ein Monitoring bestehen, das der Zeitplan nicht mehr abdeckt.
    const del = await admin.from('scan_schedule_assets').delete().eq('schedule_id', scheduleId);
    if (del?.error) return { ok: false, linked: 0, unresolved: [], error: del.error.message };
    return { ok: true, linked: 0, unresolved: [] };
  }

  const lookup = (await admin
    .from('websites')
    .select('domain, governance_asset_id')
    .eq('tenant_id', tenantId)
    .in('domain', wanted)) as Thenable<never> & {
      data: Array<{ domain: string; governance_asset_id: string | null }> | null;
      error: { message: string } | null;
    };

  if (lookup?.error) {
    return { ok: false, linked: 0, unresolved: wanted, error: lookup.error.message };
  }

  const rows = lookup?.data ?? [];
  const resolved = rows.filter((r) => !!r.governance_asset_id);
  const resolvedDomains = new Set(resolved.map((r) => r.domain));
  const unresolved = wanted.filter((d) => !resolvedDomains.has(d));
  const assetIds = resolved.map((r) => r.governance_asset_id as string);

  // Erst abraeumen, was nicht mehr abgedeckt ist. Reihenfolge ist wichtig:
  // andersherum koennte ein gleichzeitiger Leser kurzzeitig ein Asset doppelt
  // oder gar nicht sehen.
  const stale = assetIds.length > 0
    ? await admin.from('scan_schedule_assets').delete()
        .eq('schedule_id', scheduleId).not('asset_id', 'in', `(${assetIds.join(',')})`)
    : await admin.from('scan_schedule_assets').delete().eq('schedule_id', scheduleId);
  if (stale?.error) {
    return { ok: false, linked: 0, unresolved, error: stale.error.message };
  }

  if (assetIds.length === 0) return { ok: true, linked: 0, unresolved };

  const ins = await admin.from('scan_schedule_assets').upsert(
    assetIds.map((assetId) => ({
      schedule_id: scheduleId,
      asset_id: assetId,
      tenant_id: tenantId,
    })),
    { onConflict: 'schedule_id,asset_id', ignoreDuplicates: true },
  );
  if (ins?.error) return { ok: false, linked: 0, unresolved, error: ins.error.message };

  return { ok: true, linked: assetIds.length, unresolved };
}
