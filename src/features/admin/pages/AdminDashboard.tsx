import { useMemo } from 'react';
import { Users, CreditCard, Key, AlertCircle } from 'lucide-react';
import { SovereignButton } from '../../../components/ui/SovereignButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { useTenant } from '../../../core/access/TenantProvider';
import { AdminLayout } from '../layouts/AdminLayout';

export function AdminDashboard() {
  const { tenants, activeTenantId } = useTenant();
  const activeTenant = useMemo(
    () => tenants.find(t => t.tenantId === activeTenantId),
    [tenants, activeTenantId]
  );

  if (!activeTenantId || !activeTenant) {
    return (
      <AdminLayout>
        <div className="max-w-2xl">
          <Card variant="default">
            <CardContent className="pt-12 pb-12 text-center">
              <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <h2 className="font-display font-bold text-lg text-titanium-50 mb-2">Kein Workspace aktiv</h2>
              <p className="text-sm text-titanium-400">Wählen Sie einen Workspace aus der Seitenleiste.</p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="font-display font-bold text-2xl text-titanium-50 mb-2">
            {activeTenant.name}
          </h1>
          <p className="text-titanium-400">
            Verwalten Sie Ihr Workspace, Team, Abrechnung und Einstellungen.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-titanium-200">Team-Größe</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-security-blue" />
                <p className="font-display font-bold text-2xl text-titanium-50">—</p>
              </div>
              <p className="text-xs text-titanium-400 mt-2">Mitglieder im Workspace</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-titanium-200">Abo-Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <CreditCard className="h-8 w-8 text-petrol" />
                <p className="font-display font-bold text-2xl text-titanium-50">—</p>
              </div>
              <p className="text-xs text-titanium-400 mt-2">Aktueller Plan</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-titanium-200">API-Integration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Key className="h-8 w-8 text-amber-500" />
                <p className="font-display font-bold text-2xl text-titanium-50">—</p>
              </div>
              <p className="text-xs text-titanium-400 mt-2">Aktive Keys</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="font-display font-bold text-lg text-titanium-50 mb-4">Schnellzugriff</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card variant="default" className="hover:border-security-blue/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-base">Team verwalten</CardTitle>
                <CardDescription>Mitglieder einladen, entfernen und Rollen ändern</CardDescription>
              </CardHeader>
              <CardContent>
                <SovereignButton variant="secondary" size="sm" isFullWidth>
                  Zum Team
                </SovereignButton>
              </CardContent>
            </Card>

            <Card variant="default" className="hover:border-security-blue/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-base">Einstellungen</CardTitle>
                <CardDescription>Workspace-Name, Domains und Compliance-Optionen</CardDescription>
              </CardHeader>
              <CardContent>
                <SovereignButton variant="secondary" size="sm" isFullWidth>
                  Konfigurieren
                </SovereignButton>
              </CardContent>
            </Card>

            <Card variant="default" className="hover:border-security-blue/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-base">Abrechnung & Nutzung</CardTitle>
                <CardDescription>Plan, Verbrauch und Rechnungen einsehen</CardDescription>
              </CardHeader>
              <CardContent>
                <SovereignButton variant="secondary" size="sm" isFullWidth>
                  Zur Abrechnung
                </SovereignButton>
              </CardContent>
            </Card>

            <Card variant="default" className="hover:border-security-blue/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-base">Prüfprotokoll</CardTitle>
                <CardDescription>Alle Änderungen und Admin-Aktivitäten einsehen</CardDescription>
              </CardHeader>
              <CardContent>
                <SovereignButton variant="secondary" size="sm" isFullWidth>
                  Ansehen
                </SovereignButton>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Workspace Info */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-base">Workspace-Informationen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-titanium/10">
              <span className="text-sm text-titanium-400">Workspace ID</span>
              <span className="font-mono text-sm text-titanium-300">{activeTenantId}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-titanium/10">
              <span className="text-sm text-titanium-400">Rolle</span>
              <span className="font-mono text-sm text-security-blue font-semibold uppercase">
                {activeTenant.role}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-titanium-400">Status</span>
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span className="h-2 w-2 rounded-full bg-green-500"></span>
                <span className="text-green-400">Aktiv</span>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
