import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Building2, FileWarning, Loader2, ShieldAlert } from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { fetchTenantVendors, type DbVendor } from './vendorsApi';

type FilterId = 'all' | 'critical' | 'high' | 'no-dpa' | 'transfer' | 'expiring';

const DAY = 86_400_000;

function isTransferExposure(vendor: DbVendor): boolean {
  const country = (vendor.country ?? '').toUpperCase();
  if (!country || country === 'DE' || country === 'EU' || country === 'EEA') return false;
  return vendor.transfer_mechanism === 'none' || vendor.transfer_mechanism === 'unknown';
}

function dpaExpiringSoon(vendor: DbVendor, nowMs: number): boolean {
  if (vendor.dpa_status !== 'signed' || !vendor.dpa_expires_at) return false;
  const expiry = new Date(vendor.dpa_expires_at).getTime();
  if (Number.isNaN(expiry)) return false;
  const diff = expiry - nowMs;
  return diff >= 0 && diff <= 30 * DAY;
}

export function VendorExposureView() {
  const { activeTenantId, tenants } = useTenant();
  const tenantName = tenants.find((t) => t.tenantId === activeTenantId)?.name ?? null;
  const [vendors, setVendors] = useState<DbVendor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>('all');

  useEffect(() => {
    let cancelled = false;
    if (!activeTenantId) {
      setVendors(null);
      return;
    }
    setVendors(null);
    setError(null);
    void fetchTenantVendors(activeTenantId)
      .then((rows) => { if (!cancelled) setVendors(rows); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { cancelled = true; };
  }, [activeTenantId]);

  const nowMs = Date.now();
  const metrics = useMemo(() => {
    const rows = vendors ?? [];
    return {
      total: rows.length,
      critical: rows.filter((v) => v.risk_level === 'critical').length,
      high: rows.filter((v) => v.risk_level === 'high').length,
      noDpa: rows.filter((v) => ['none', 'requested', 'expired'].includes(v.dpa_status)).length,
      transfer: rows.filter(isTransferExposure).length,
      expiring: rows.filter((v) => dpaExpiringSoon(v, nowMs)).length,
    };
  }, [vendors, nowMs]);

  const visible = (vendors ?? []).filter((vendor) => {
    if (filter === 'critical') return vendor.risk_level === 'critical';
    if (filter === 'high') return vendor.risk_level === 'high';
    if (filter === 'no-dpa') return ['none', 'requested', 'expired'].includes(vendor.dpa_status);
    if (filter === 'transfer') return isTransferExposure(vendor);
    if (filter === 'expiring') return dpaExpiringSoon(vendor, nowMs);
    return true;
  });

  return (
    <div className="rs-apppage rs-ui" data-testid="vendor-exposure">
      <header className="mb-5">
        <span className="rs-overline">P2.2 · Third-Party Governance</span>
        <h1 className="rs-h2 mt-1">Vendor Exposure{tenantName ? ` · ${tenantName}` : ''}</h1>
        <p className="rs-note mt-1">
          Exposure aus realen Vendor-Risikostufen, DPA-Status, Vertragsablauf und Transfermechanismen.
        </p>
      </header>

      {!activeTenantId && (
        <div className="rs-panel rs-panel--pad20">
          <p className="rs-note">Kein aktiver Mandant. Ohne Tenant werden keine Vendor-Daten geladen.</p>
        </div>
      )}

      {error && (
        <div className="border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-300 flex gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {activeTenantId && !vendors && !error && (
        <div className="flex items-center justify-center gap-2 py-12 rs-note">
          <Loader2 className="h-4 w-4 animate-spin" /> Vendor Exposure wird geladen …
        </div>
      )}

      {vendors && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5" aria-label="Vendor Exposure Kennzahlen">
            <Metric label="Vendoren" value={metrics.total} />
            <Metric label="Kritisch" value={metrics.critical} tone={metrics.critical ? 'danger' : undefined} />
            <Metric label="Hochrisiko" value={metrics.high} tone={metrics.high ? 'warn' : undefined} />
            <Metric label="Kein gültiger DPA" value={metrics.noDpa} tone={metrics.noDpa ? 'danger' : undefined} />
            <Metric label="Transfer ungeklärt" value={metrics.transfer} tone={metrics.transfer ? 'warn' : undefined} />
            <Metric label="DPA ≤ 30 Tage" value={metrics.expiring} tone={metrics.expiring ? 'warn' : undefined} />
          </section>

          <section className="rs-panel">
            <div className="rs-panel__head px-4 pt-4">
              <span className="rs-overline">Exposure Register</span>
              <Link to="/app/vendors" className="rs-note rs-cyan">Vendor Inventory →</Link>
            </div>

            <div className="flex flex-wrap gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--color-rs-line)' }}>
              {([
                ['all', 'Alle', metrics.total],
                ['critical', 'Kritisch', metrics.critical],
                ['high', 'Hoch', metrics.high],
                ['no-dpa', 'DPA-Lücke', metrics.noDpa],
                ['transfer', 'Transfer', metrics.transfer],
                ['expiring', 'DPA-Ablauf', metrics.expiring],
              ] as const).map(([id, label, count]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`rs-btn ${filter === id ? 'rs-btn--primary' : 'rs-btn--secondary'}`}
                >
                  {label} · {count}
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <div className="p-8 text-center">
                <Building2 className="h-6 w-6 mx-auto mb-2 text-titanium-500" />
                <p className="rs-note">Keine Vendoren in diesem Filter.</p>
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--color-rs-line)' }}>
                {visible.map((vendor) => (
                  <li key={vendor.id} className="px-4 py-4">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rs-cell-main">{vendor.name}</span>
                          <span className="rs-note rs-mono uppercase">{vendor.risk_level}</span>
                          {vendor.country && <span className="rs-note rs-mono uppercase">{vendor.country}</span>}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 rs-note">
                          <span className="inline-flex items-center gap-1.5">
                            <FileWarning className="h-3.5 w-3.5" />
                            DPA: {vendor.dpa_status}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            Transfer: {vendor.transfer_mechanism}
                          </span>
                          {vendor.dpa_expires_at && (
                            <span>DPA bis {new Date(vendor.dpa_expires_at).toLocaleDateString('de-DE')}</span>
                          )}
                        </div>
                      </div>
                      <Link to="/app/vendors" className="rs-btn rs-btn--secondary shrink-0">
                        Vendor öffnen <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="rs-note mt-4">
            Kein eigener Review-Deadline- oder „nicht bewertet“-Wert vorhanden: solche Kennzahlen werden hier bewusst nicht simuliert.
          </p>
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'danger' | 'warn';
}) {
  const color = tone === 'danger'
    ? 'var(--color-rs-danger)'
    : tone === 'warn'
      ? 'var(--color-rs-warning)'
      : 'var(--color-rs-fg)';

  return (
    <div className="rs-panel rs-panel--pad20">
      <div className="rs-mono text-3xl font-semibold" style={{ color }}>{value}</div>
      <div className="rs-note mt-1">{label}</div>
    </div>
  );
}
