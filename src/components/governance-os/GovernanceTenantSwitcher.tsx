// GovernanceTenantSwitcher — Mandanten-Umschalter im Top-Bar
// Zeigt nur an wenn der User Mitglied in >1 Mandant ist.
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Building2 } from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';

export function GovernanceTenantSwitcher() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (tenants.length <= 1) return null;

  const active = tenants.find((t) => t.tenantId === activeTenantId);

  return (
    <div ref={ref} className="relative hidden md:block shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-titanium-300 bg-obsidian-800 border border-titanium-800 hover:border-titanium-600 hover:text-titanium-100 transition-colors max-w-[140px]"
      >
        <Building2 className="h-3 w-3 text-titanium-500 shrink-0" />
        <span className="truncate">{active?.name ?? 'Mandant'}</span>
        <ChevronDown className={`h-3 w-3 text-titanium-600 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-obsidian-900 border border-titanium-800 shadow-xl min-w-[200px]">
          <div className="px-3 py-2 border-b border-titanium-900">
            <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-600">Mandanten</span>
          </div>
          {tenants.map((t) => {
            const isActive = t.tenantId === activeTenantId;
            return (
              <button
                key={t.tenantId}
                onClick={() => { setActiveTenant(t.tenantId); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-obsidian-800 transition-colors text-left"
              >
                <div className={`w-5 h-5 flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-teal-600/30 border border-teal-600/40' : 'bg-obsidian-800 border border-titanium-800'
                }`}>
                  {isActive
                    ? <Check className="h-3 w-3 text-teal-400" />
                    : <Building2 className="h-3 w-3 text-titanium-600" />
                  }
                </div>
                <div className="min-w-0">
                  <div className={`font-mono text-xs truncate ${isActive ? 'text-teal-400' : 'text-titanium-300'}`}>
                    {t.name}
                  </div>
                  <div className="font-mono text-[9px] text-titanium-600 uppercase tracking-wider">
                    {t.role}{t.isPublicSector ? ' · Öff. Sektor' : ''}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
