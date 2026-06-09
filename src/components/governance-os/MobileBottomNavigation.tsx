import { Link, useLocation } from 'react-router-dom';
import { Home, Globe, FileCheck2, Cpu, AlertCircle } from 'lucide-react';

const BOTTOM_TABS = [
  { icon: Home,        label: 'Übersicht',  route: '/app' },
  { icon: Globe,       label: 'Websites',   route: '/app/websites' },
  { icon: FileCheck2,  label: 'Nachweise',  route: '/app/evidence' },
  { icon: Cpu,         label: 'KI-Systeme', route: '/app/ai-systems' },
  { icon: AlertCircle, label: 'Risiken',    route: '/app/risks' },
] as const;

export function MobileBottomNavigation() {
  const { pathname } = useLocation();

  const isActive = (route: string) =>
    route === '/app' ? pathname === '/app' : pathname.startsWith(route);

  return (
    <nav className="lg:hidden h-12 shrink-0 bg-obsidian-900 border-t border-titanium-900 flex">
      {BOTTOM_TABS.map(({ icon: Icon, label, route }) => {
        const active = isActive(route);
        return (
          <Link
            key={route}
            to={route}
            className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
              active
                ? 'text-cyan-400 bg-obsidian-800'
                : 'text-titanium-600 hover:text-titanium-300 hover:bg-obsidian-800'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className={`font-mono text-[8px] uppercase tracking-widest leading-none ${active ? 'text-cyan-400' : 'text-titanium-700'}`}>
              {label}
            </span>
            {active && <span className="absolute bottom-0 w-8 h-0.5 bg-cyan-400" />}
          </Link>
        );
      })}
    </nav>
  );
}
