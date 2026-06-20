import {
  Home, Globe, FileCheck2, Cpu, AlertTriangle, Activity,
  Building2, BarChart3, Users, Settings,
  Bell, CreditCard, Wrench, Bot, GitMerge, FileText,
  ClipboardCheck, ClipboardList, LayoutDashboard, Briefcase,
  type LucideIcon,
} from 'lucide-react';

// Gemeinsame Navigations-Konfiguration für GovernanceSidebar (Desktop) und
// GovernanceMobileNav (Drawer) — eine Quelle, kein Drift zwischen beiden.

export const NAV_ICON_MAP: Record<string, LucideIcon> = {
  Home, Globe, FileCheck2, Cpu, Bot, AlertTriangle, Activity,
  Building2, BarChart3, Users, Settings, Bell, CreditCard, Wrench,
  GitMerge, FileText, ClipboardCheck, ClipboardList, LayoutDashboard, Briefcase,
};

export const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter', growth: 'Professional', agency: 'Agency', enterprise: 'Enterprise',
};

/** Aktiver Navigationspunkt: /app nur exakt, sonst Pfad-Präfix. */
export function isModuleActive(route: string, pathname: string): boolean {
  return route === '/app' ? pathname === '/app' : pathname.startsWith(route);
}
