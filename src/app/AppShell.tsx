/**
 * Hülle im Control-Room-Layout (Dashboard, 1440).
 * Farben und Maße nur über semantische Token-Variablen.
 * Die acht Bereichsnamen folgen dem Auftrag, nicht den fünf Einträgen im Entwurf.
 */
import { useContext, type ReactNode } from 'react';
import { useTenant } from '../core/access/TenantProvider';
import { SupabaseAuthContext } from '../features/supabase/SupabaseAuthContext';
import { areaById, type AppAreaId } from './areas';
import { navigationModel } from './registry';
import './shell.css';

export function AppShell({
  areaId,
  onArea,
  children,
}: {
  areaId: AppAreaId;
  onArea: (id: AppAreaId) => void;
  children: ReactNode;
}) {
  const tenant = useTenant();
  const auth = useContext(SupabaseAuthContext);
  const nav = navigationModel();
  const area = areaById(areaId);
  const active = tenant.tenants.find((item) => item.tenantId === tenant.activeTenantId) ?? null;
  const title = areaId === 'dashboard' ? 'Governance Control Room' : area.label;

  return (
    <div className="app-shell" data-theme={tenant.themeId} data-testid="app-shell">
      <aside className="app-shell__sidebar">
        <div className="app-shell__brand">
          <img src="/brand/logo-square-400.svg" alt="" width={34} height={34} />
          <span>RSD &amp; AI</span>
        </div>
        <nav aria-label="Bereiche">
          <ul className="app-shell__nav">
            {nav.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  data-area={item.id}
                  aria-current={item.id === areaId ? 'page' : undefined}
                  onClick={() => onArea(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="app-shell__main">
        <header className="app-shell__topbar">
          <h1>{title}</h1>
          <div className="app-shell__tools">
            <div className="app-shell__search" data-slot="search">
              <input type="search" readOnly placeholder="Suche" aria-label="Suche" />
            </div>
            <label className="app-shell__tenant">
              <span className="app-shell__sr">Mandant</span>
              <select
                aria-label="Mandant wechseln"
                data-testid="tenant-switcher"
                value={tenant.activeTenantId ?? ''}
                onChange={(event) => tenant.setActiveTenant(event.target.value)}
              >
                {tenant.tenants.map((item) => (
                  <option key={item.tenantId} value={item.tenantId}>{item.name}</option>
                ))}
              </select>
            </label>
            <div className="app-shell__profile" data-slot="profile">
              <span>{auth?.user?.email ?? 'Keine Sitzung'}</span>
              <span className="app-shell__meta">
                {active?.role ?? 'ohne Rolle'}
                {tenant.plan ? ` · ${tenant.plan}` : ''}
              </span>
            </div>
            {tenant.fixturePreview && (
              <p className="app-shell__concept" data-testid="concept-mark">UI-Konzept · Beispieldaten</p>
            )}
          </div>
        </header>
        <div className="app-shell__content" data-slot="content">
          {children}
        </div>
      </div>
    </div>
  );
}
