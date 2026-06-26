import { useMemo } from 'react';
import { AlertCircle, Globe, Lock, Server } from 'lucide-react';
import { SovereignButton } from '../../../components/ui/SovereignButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { useTenant } from '../../../core/access/TenantProvider';
import { AdminLayout } from '../layouts/AdminLayout';

export function AdminSettingsPage() {
  const { activeTenantId, tenants } = useTenant();

  const activeTenant = useMemo(
    () => tenants.find(t => t.tenantId === activeTenantId),
    [tenants, activeTenantId]
  );

  const isAdmin = activeTenant?.role === 'owner' || activeTenant?.role === 'admin';

  return (
    <AdminLayout>
      <div className="max-w-3xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="font-display font-bold text-2xl text-titanium-50 mb-2">Workspace-Einstellungen</h1>
          <p className="text-titanium-400">Konfigurieren Sie Name, Sicherheit und Compliance-Optionen.</p>
        </div>

        {!isAdmin && (
          <Card variant="default" className="border-amber-900/50 bg-amber-950/20">
            <CardContent className="pt-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-300 font-semibold mb-1">Nur für Owner/Admin</p>
                <p className="text-sm text-amber-300/80">
                  Sie haben nicht die erforderlichen Berechtigungen, um diese Einstellungen zu ändern.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Workspace Name */}
        <Card variant="default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Workspace-Name
            </CardTitle>
            <CardDescription>Der Name Ihres Workspaces, wie er den Mitgliedern angezeigt wird</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-titanium-200 mb-2">Name</label>
              <input
                type="text"
                defaultValue={activeTenant?.name || ''}
                disabled={!isAdmin}
                placeholder="z.B. Meine Organisation"
                className="w-full bg-obsidian border border-titanium/20 text-titanium-100 text-sm rounded-sm px-4 py-2 outline-none focus:border-security-blue focus:ring-1 focus:ring-security-blue/30 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <SovereignButton variant="primary" size="sm" disabled={!isAdmin}>
              Speichern
            </SovereignButton>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card variant="default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Sicherheit
            </CardTitle>
            <CardDescription>Sicherheitsrichtlinien und Authentifizierung</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border border-titanium/10 rounded-sm">
                <div>
                  <p className="text-sm font-semibold text-titanium-200">Zwei-Faktor-Authentifizierung (2FA)</p>
                  <p className="text-xs text-titanium-400 mt-0.5">Verpflichtet Mitglieder zur 2FA</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    className="rounded disabled:opacity-50"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between p-3 border border-titanium/10 rounded-sm">
                <div>
                  <p className="text-sm font-semibold text-titanium-200">IP-Whitelist</p>
                  <p className="text-xs text-titanium-400 mt-0.5">Nur Zugriff von bestimmten IP-Adressen</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    className="rounded disabled:opacity-50"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between p-3 border border-titanium/10 rounded-sm">
                <div>
                  <p className="text-sm font-semibold text-titanium-200">Session-Timeout</p>
                  <p className="text-xs text-titanium-400 mt-0.5">Automatisches Logout nach Inaktivität (in Minuten)</p>
                </div>
                <input
                  type="number"
                  min="5"
                  max="1440"
                  defaultValue="60"
                  disabled={!isAdmin}
                  className="w-20 bg-obsidian border border-titanium/20 text-titanium-100 text-sm rounded-sm px-2 py-1 outline-none focus:border-security-blue focus:ring-1 focus:ring-security-blue/30 disabled:opacity-50"
                />
              </div>
            </div>
            <SovereignButton variant="primary" size="sm" disabled={!isAdmin}>
              Speichern
            </SovereignButton>
          </CardContent>
        </Card>

        {/* Data Residency */}
        <Card variant="default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Datenresidenz
            </CardTitle>
            <CardDescription>Wählen Sie, wo Ihre Daten gespeichert und verarbeitet werden</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <label className="flex items-center p-3 border border-security-blue/50 rounded-sm cursor-pointer bg-security-blue/5">
                <input
                  type="radio"
                  name="residency"
                  value="eu-frankfurt"
                  defaultChecked
                  disabled={!isAdmin}
                  className="disabled:opacity-50"
                />
                <div className="ml-3">
                  <p className="text-sm font-semibold text-titanium-100">EU - Frankfurt</p>
                  <p className="text-xs text-titanium-400">Maximale Datenschutz-Compliance (DSGVO)</p>
                </div>
              </label>

              <label className="flex items-center p-3 border border-titanium/10 rounded-sm cursor-pointer hover:border-titanium/20">
                <input
                  type="radio"
                  name="residency"
                  value="eu-amsterdam"
                  disabled={!isAdmin}
                  className="disabled:opacity-50"
                />
                <div className="ml-3">
                  <p className="text-sm font-semibold text-titanium-100">EU - Amsterdam</p>
                  <p className="text-xs text-titanium-400">Alternative EU-Region</p>
                </div>
              </label>

              <label className="flex items-center p-3 border border-titanium/10 rounded-sm cursor-pointer hover:border-titanium/20 opacity-50">
                <input
                  type="radio"
                  name="residency"
                  disabled
                  className="disabled:opacity-50"
                />
                <div className="ml-3">
                  <p className="text-sm font-semibold text-titanium-400">Global (alle Regionen)</p>
                  <p className="text-xs text-titanium-500">Nur für Enterprise-Kunden verfügbar</p>
                </div>
              </label>
            </div>
            <SovereignButton variant="primary" size="sm" disabled={!isAdmin}>
              Speichern
            </SovereignButton>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card variant="default" className="border-rose-900/50">
          <CardHeader>
            <CardTitle className="text-rose-400">Gefahrenzone</CardTitle>
            <CardDescription>Irreversible Aktionen — bitte mit Vorsicht verwenden</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border border-rose-900/30 rounded-sm bg-rose-950/10">
              <p className="text-sm text-rose-300 mb-4">
                Das Löschen des Workspace ist permanent und kann nicht rückgängig gemacht werden. Alle Daten werden gelöscht.
              </p>
              <SovereignButton variant="danger" size="sm" disabled={!isAdmin}>
                Workspace löschen
              </SovereignButton>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
