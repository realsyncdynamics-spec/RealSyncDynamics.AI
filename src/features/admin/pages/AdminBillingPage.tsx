import { useMemo } from 'react';
import { CreditCard, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SovereignButton } from '../../../components/ui/SovereignButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { useTenant } from '../../../core/access/TenantProvider';
import { AdminLayout } from '../layouts/AdminLayout';

export function AdminBillingPage() {
  const { activeTenantId, tenants } = useTenant();

  const activeTenant = useMemo(
    () => tenants.find(t => t.tenantId === activeTenantId),
    [tenants, activeTenantId]
  );

  const isAdmin = activeTenant?.role === 'owner' || activeTenant?.role === 'admin';

  return (
    <AdminLayout>
      <div className="max-w-4xl space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-titanium-50 mb-2">Abrechnung & Verbrauch</h1>
            <p className="text-titanium-400">Verwalten Sie Ihren Plan, Verbrauch und Rechnungen.</p>
          </div>
          <Link to="/app/billing">
            <SovereignButton variant="secondary" size="md">
              Zur Abrechnung
            </SovereignButton>
          </Link>
        </div>

        {!isAdmin && (
          <Card variant="default" className="border-amber-900/50 bg-amber-950/20">
            <CardContent className="pt-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-300 font-semibold mb-1">Nur für Owner/Admin</p>
                <p className="text-sm text-amber-300/80">
                  Sie können Abrechnung einsehen, aber nicht bearbeiten.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Plan */}
        <Card variant="default">
          <CardHeader>
            <CardTitle>Aktueller Plan</CardTitle>
            <CardDescription>Ihr Abonnement und seine Funktionen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 border border-titanium/10 rounded-sm">
                <p className="text-xs text-titanium-400 mb-1">Plan</p>
                <p className="font-display font-bold text-lg text-titanium-50">Agency</p>
              </div>
              <div className="p-4 border border-titanium/10 rounded-sm">
                <p className="text-xs text-titanium-400 mb-1">Abgerechnet</p>
                <p className="font-display font-bold text-lg text-titanium-50">€699/Monat</p>
              </div>
              <div className="p-4 border border-titanium/10 rounded-sm">
                <p className="text-xs text-titanium-400 mb-1">Status</p>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="font-semibold text-green-400">Aktiv</span>
                </div>
              </div>
            </div>

            <div className="p-4 border border-titanium/10 rounded-sm bg-obsidian-900">
              <p className="text-sm font-semibold text-titanium-200 mb-3">Plan-Features</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-titanium-300">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Unbegrenzte Websites & AI-Systeme</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-titanium-300">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Team-Zusammenarbeit (bis 10 Mitglieder)</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-titanium-300">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Compliance-Reports & Evidence-Vault</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-titanium-300">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>API-Zugriff</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-titanium-300">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Priority-Support</span>
                </li>
              </ul>
            </div>

            {isAdmin && (
              <SovereignButton variant="secondary" size="sm">
                Plan ändern
              </SovereignButton>
            )}
          </CardContent>
        </Card>

        {/* Usage */}
        <Card variant="default">
          <CardHeader>
            <CardTitle>Verbrauch diesen Monat</CardTitle>
            <CardDescription>Ihre API-Nutzung und verfügbare Kontingente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-titanium-200">API-Anfragen</span>
                  <span className="text-sm text-titanium-400">12.543 / 100.000</span>
                </div>
                <div className="w-full h-2 bg-obsidian-900 rounded-full overflow-hidden">
                  <div className="h-full w-1/4 bg-security-blue"></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-titanium-200">Speicher</span>
                  <span className="text-sm text-titanium-400">2.1 GB / 100 GB</span>
                </div>
                <div className="w-full h-2 bg-obsidian-900 rounded-full overflow-hidden">
                  <div className="h-full w-[2%] bg-petrol"></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-titanium-200">Team-Mitglieder</span>
                  <span className="text-sm text-titanium-400">3 / 10</span>
                </div>
                <div className="w-full h-2 bg-obsidian-900 rounded-full overflow-hidden">
                  <div className="h-full w-[30%] bg-amber-500"></div>
                </div>
              </div>
            </div>

            <Link to="/app/billing">
              <SovereignButton variant="secondary" size="sm" isFullWidth>
                Detaillierte Nutzung ansehen
              </SovereignButton>
            </Link>
          </CardContent>
        </Card>

        {/* Invoices */}
        <Card variant="default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Rechnungen
            </CardTitle>
            <CardDescription>Ihre bisherigen Rechnungen und Zahlungshistorie</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-titanium/10">
                    <th className="text-left py-3 px-4 font-mono text-xs text-titanium-400 font-semibold">Datum</th>
                    <th className="text-left py-3 px-4 font-mono text-xs text-titanium-400 font-semibold">Rechnungsnummer</th>
                    <th className="text-left py-3 px-4 font-mono text-xs text-titanium-400 font-semibold">Betrag</th>
                    <th className="text-left py-3 px-4 font-mono text-xs text-titanium-400 font-semibold">Status</th>
                    <th className="text-right py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { date: '23. Juni 2026', number: 'INV-2026-0534', amount: '€699,00', status: 'Bezahlt' },
                    { date: '23. Mai 2026', number: 'INV-2026-0521', amount: '€699,00', status: 'Bezahlt' },
                    { date: '23. April 2026', number: 'INV-2026-0508', amount: '€699,00', status: 'Bezahlt' },
                  ].map((invoice, idx) => (
                    <tr key={idx} className="border-b border-titanium/10 hover:bg-obsidian-900/50">
                      <td className="py-3 px-4 text-titanium-300">{invoice.date}</td>
                      <td className="py-3 px-4 font-mono text-titanium-300">{invoice.number}</td>
                      <td className="py-3 px-4 font-semibold text-titanium-100">{invoice.amount}</td>
                      <td className="py-3 px-4">
                        <Badge variant="success" size="sm">{invoice.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button className="text-security-blue hover:text-security-blue/80 transition-colors">
                          <Download className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card variant="default">
          <CardHeader>
            <CardTitle>Zahlungsmethode</CardTitle>
            <CardDescription>Verwenden Sie eine Kreditkarte für die Abrechnung</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border border-titanium/10 rounded-sm flex items-start justify-between">
              <div>
                <p className="font-semibold text-titanium-100">Visa •••• 4242</p>
                <p className="text-sm text-titanium-400 mt-1">Gültig bis: 12/2027</p>
              </div>
              <Badge variant="default" size="sm">Standard</Badge>
            </div>
            {isAdmin && (
              <SovereignButton variant="secondary" size="sm">
                Zahlungsmethode aktualisieren
              </SovereignButton>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
