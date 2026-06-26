import { useMemo } from 'react';
import { ScrollText, AlertCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SovereignButton } from '../../../components/ui/SovereignButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { useTenant } from '../../../core/access/TenantProvider';
import { AdminLayout } from '../layouts/AdminLayout';

interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  details: string;
  status: 'success' | 'failure' | 'warning';
}

export function AdminAuditPage() {
  const { activeTenantId, tenants } = useTenant();

  const activeTenant = useMemo(
    () => tenants.find(t => t.tenantId === activeTenantId),
    [tenants, activeTenantId]
  );

  const isAuditor = !!(activeTenant?.role && (activeTenant.role === 'owner' || activeTenant.role === 'admin' || (activeTenant.role as string) === 'dpo'));

  // Mock audit events
  const events: AuditEvent[] = [
    {
      id: '1',
      timestamp: '23. Juni 2026, 14:32 UTC',
      actor: 'max.mueller@company.de',
      action: 'Mitglied eingeladen',
      resource: 'Team',
      details: 'Benutzer anna.schmidt@company.de zum Workspace hinzugefügt',
      status: 'success',
    },
    {
      id: '2',
      timestamp: '23. Juni 2026, 10:15 UTC',
      actor: 'admin@company.de',
      action: 'Rolle geändert',
      resource: 'Team',
      details: 'Rolle von max.mueller@company.de zu "admin" geändert',
      status: 'success',
    },
    {
      id: '3',
      timestamp: '22. Juni 2026, 16:48 UTC',
      actor: 'api-key-xxx',
      action: 'API-Anfrage',
      resource: 'API',
      details: 'GET /governance/websites erfolgreich',
      status: 'success',
    },
    {
      id: '4',
      timestamp: '22. Juni 2026, 09:20 UTC',
      actor: 'admin@company.de',
      action: 'Einstellung geändert',
      resource: 'Workspace',
      details: 'Datenresidenz von EU-Frankfurt zu EU-Amsterdam geändert',
      status: 'success',
    },
    {
      id: '5',
      timestamp: '21. Juni 2026, 14:05 UTC',
      actor: 'anna.schmidt@company.de',
      action: 'Authentifizierungsfehler',
      resource: 'Auth',
      details: 'Fehlgeschlagener Login-Versuch (IP: 192.168.1.100)',
      status: 'warning',
    },
  ];

  const getStatusColor = (status: AuditEvent['status']) => {
    switch (status) {
      case 'success': return 'success';
      case 'warning': return 'warning';
      case 'failure': return 'error';
      default: return 'default';
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-titanium-50 mb-2">Prüfprotokoll</h1>
            <p className="text-titanium-400">
              Alle Änderungen und Aktivitäten in Ihrem Workspace — manipulationssicher und vollständig.
            </p>
          </div>
          <Link to="/app/admin-log">
            <SovereignButton variant="secondary" size="md" rightIcon={<ExternalLink className="h-4 w-4" />}>
              Erweiterte Ansicht
            </SovereignButton>
          </Link>
        </div>

        {!isAuditor && (
          <Card variant="default" className="border-amber-900/50 bg-amber-950/20">
            <CardContent className="pt-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-300 font-semibold mb-1">Eingeschränkter Zugriff</p>
                <p className="text-sm text-amber-300/80">
                  Sie haben nicht die erforderlichen Berechtigungen für Audit-Logs. Nur Owner/Admin/DPO können diese einsehen.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Audit Events */}
        <Card variant="default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5" />
              Letzte Ereignisse
            </CardTitle>
            <CardDescription>Die letzten 100 Aktivitäten in chronologischer Reihenfolge</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-0 divide-y divide-titanium/10">
              {events.map(event => (
                <div key={event.id} className="py-4 first:pt-0 last:pb-0 hover:bg-obsidian-900/30 px-4 mx-4 transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-titanium-100">{event.action}</p>
                        <Badge variant={getStatusColor(event.status)} size="sm">
                          {event.status === 'success' && 'Erfolgreich'}
                          {event.status === 'warning' && 'Warnung'}
                          {event.status === 'failure' && 'Fehler'}
                        </Badge>
                      </div>
                      <p className="text-sm text-titanium-300">{event.details}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs text-titanium-500">
                          <span className="text-titanium-600">Resource:</span> {event.resource}
                        </span>
                        <span className="text-xs text-titanium-500">
                          <span className="text-titanium-600">Actor:</span> {event.actor}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-titanium-500 whitespace-nowrap">{event.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Audit Information */}
        <Card variant="default" className="border-titanium/20">
          <CardHeader>
            <CardTitle>Über das Prüfprotokoll</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-titanium-300">
            <p>
              Das Prüfprotokoll (Audit Trail) ist ein vollständiges, chronologisches Verzeichnis aller Ereignisse in Ihrem Workspace.
              Es ist manipulationssicher und wird für Compliance-, Audit- und Sicherheitszwecke verwendet.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 border border-titanium/10 rounded-sm bg-obsidian-900">
                <p className="font-semibold text-titanium-200 mb-1">Was wird protokolliert?</p>
                <ul className="space-y-1 text-xs text-titanium-400">
                  <li>✓ Mitgliederverwaltung (Einladung, Entfernung, Rollenänderung)</li>
                  <li>✓ Konfigurationsänderungen (Einstellungen, Sicherheit)</li>
                  <li>✓ API-Zugriffe und Fehler</li>
                  <li>✓ Authentifizierungsereignisse</li>
                  <li>✓ Datenzugriffe und Exporte</li>
                </ul>
              </div>
              <div className="p-3 border border-titanium/10 rounded-sm bg-obsidian-900">
                <p className="font-semibold text-titanium-200 mb-1">Aufbewahrung</p>
                <ul className="space-y-1 text-xs text-titanium-400">
                  <li>✓ Mindestens 2 Jahre</li>
                  <li>✓ Für Enterprise-Kunden 7 Jahre</li>
                  <li>✓ Nicht editierbar oder löschbar</li>
                  <li>✓ Sichere Speicherung in EU-Regionen</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Export Option */}
        <Card variant="default">
          <CardHeader>
            <CardTitle>Audit-Export</CardTitle>
            <CardDescription>Exportieren Sie das Prüfprotokoll für externe Compliance-Audits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-titanium-400">
              Exportieren Sie das vollständige Prüfprotokoll als CSV oder JSON für Compliance-, Audit- und Forensik-Zwecke.
            </p>
            <div className="flex gap-2">
              {isAuditor ? (
                <>
                  <SovereignButton variant="secondary" size="sm">
                    Als CSV exportieren
                  </SovereignButton>
                  <SovereignButton variant="outline" size="sm">
                    Als JSON exportieren
                  </SovereignButton>
                </>
              ) : (
                <p className="text-xs text-titanium-500">Nur Owner/Admin/DPO können Audit-Logs exportieren.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
