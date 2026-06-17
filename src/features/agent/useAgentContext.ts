// useAgentContext.ts — Liefert Kontext der aktuellen Seite an den Agenten
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useTenant } from '../../core/access/TenantProvider';

export interface AgentContext {
  currentRoute: string;
  moduleName: string;
  moduleDescription: string;
  tenantName: string | null;
  systemPromptHint: string;
}

const MODULE_MAP: Record<string, { name: string; description: string }> = {
  '/app':              { name: 'Dashboard',        description: 'Governance OS Übersicht mit Live-Metriken' },
  '/app/websites':     { name: 'Websites',         description: 'Website-Governance, DSGVO-Scanner und Findings' },
  '/app/gdpr':         { name: 'DSGVO',            description: 'Datenschutz-Compliance, DSR-Tracker, Incidents' },
  '/app/ai-act':       { name: 'KI-Systeme',       description: 'EU AI Act Registry, Risikoklassifizierung' },
  '/app/evidence':     { name: 'Evidence Vault',   description: 'Hashes, Snapshots, C2PA-Nachweise, Audit Trail' },
  '/app/monitoring':   { name: 'Monitoring',       description: 'Runtime Monitoring, Drift Alerts, Live-Feed' },
  '/app/automations':  { name: 'Automation Skills',description: '15 spezialisierte Governance-Agenten und Workflows' },
  '/app/office':       { name: 'Office',           description: 'Dokumente, Tabellen, Verträge, Policies, Vorlagen' },
  '/app/team':         { name: 'Team',             description: 'Rollen, Mitglieder und Zugriffsrechte' },
  '/app/settings':     { name: 'Einstellungen',    description: 'Mandant, Sicherheit und Integrationen' },
  '/app/risks':        { name: 'Risk Center',      description: 'Risiken, DSGVO-Ampelsystem, Maßnahmen' },
  '/app/audit':        { name: 'Audit Export',     description: 'Audit-Pakete, Behördenexporte, C2PA-signiert' },
  '/app/documents':    { name: 'Dokumente',        description: 'DSGVO-Dokumentengenerator: DSE, AVV, TOM, VVT, DSFA' },
  '/app/reports':      { name: 'Reports',          description: 'Compliance- und Audit-Reports' },
  '/app/vendors':      { name: 'Vendors',          description: 'Vendor- und DPA-Tracking' },
};

export function useAgentContext(): AgentContext {
  const { pathname } = useLocation();
  const { tenants, activeTenantId } = useTenant();

  const tenantName = useMemo(() => {
    if (!activeTenantId) return null;
    return tenants.find((t) => t.tenantId === activeTenantId)?.name ?? null;
  }, [tenants, activeTenantId]);

  const module = useMemo(() => {
    // Exact match first, then prefix match
    if (MODULE_MAP[pathname]) return MODULE_MAP[pathname];
    const prefix = Object.keys(MODULE_MAP)
      .filter((k) => pathname.startsWith(k) && k !== '/app')
      .sort((a, b) => b.length - a.length)[0];
    return prefix ? MODULE_MAP[prefix] : MODULE_MAP['/app'];
  }, [pathname]);

  const systemPromptHint = useMemo(() => {
    const tenant = tenantName ? ` für Mandant "${tenantName}"` : '';
    return `Du bist der Governance OS Assistent${tenant}. Der Nutzer befindet sich aktuell im Modul "${module.name}" (${module.description}). Du kannst innerhalb von /app navigieren, Module erklären und Aktionen vorbereiten. Du darfst NICHT löschen, kaufen oder externe Webseiten steuern.`;
  }, [module, tenantName]);

  return {
    currentRoute: pathname,
    moduleName: module.name,
    moduleDescription: module.description,
    tenantName,
    systemPromptHint,
  };
}
