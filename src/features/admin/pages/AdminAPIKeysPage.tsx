import { useMemo, useState } from 'react';
import { Key, Copy, Trash2, AlertCircle, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SovereignButton } from '../../../components/ui/SovereignButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { useTenant } from '../../../core/access/TenantProvider';
import { AdminLayout } from '../layouts/AdminLayout';

interface APIKey {
  id: string;
  name: string;
  key: string;
  lastUsed: string;
  createdAt: string;
  scopes: string[];
}

export function AdminAPIKeysPage() {
  const { activeTenantId, tenants } = useTenant();
  const [keys, setKeys] = useState<APIKey[]>([
    {
      id: '1',
      name: 'Production API Key',
      key: 'sk_live_51H2L8axx••••••••xxxx',
      createdAt: '5. März 2026',
      lastUsed: 'vor 2 Stunden',
      scopes: ['read', 'write', 'governance'],
    },
    {
      id: '2',
      name: 'Staging Integration',
      key: 'sk_test_1A9K3J9a••••••••xxxx',
      createdAt: '12. Januar 2026',
      lastUsed: 'vor 5 Tagen',
      scopes: ['read', 'governance'],
    },
  ]);

  const [copied, setCopied] = useState<string | null>(null);

  const activeTenant = useMemo(
    () => tenants.find(t => t.tenantId === activeTenantId),
    [tenants, activeTenantId]
  );

  const isAdmin = activeTenant?.role === 'owner' || activeTenant?.role === 'admin';

  const copyToClipboard = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = (id: string) => {
    setKeys(keys.filter(k => k.id !== id));
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-titanium-50 mb-2">API-Schlüssel</h1>
            <p className="text-titanium-400">
              Verwalten Sie Ihre API-Schlüssel für die Integration mit externen Systemen.
            </p>
          </div>
          {isAdmin && (
            <SovereignButton variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              Neuer Schlüssel
            </SovereignButton>
          )}
        </div>

        {!isAdmin && (
          <Card variant="default" className="border-amber-900/50 bg-amber-950/20">
            <CardContent className="pt-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-300 font-semibold mb-1">Nur für Owner/Admin</p>
                <p className="text-sm text-amber-300/80">
                  Sie können API-Schlüssel einsehen, aber keine neuen erstellen.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* API Keys List */}
        <Card variant="default">
          <CardHeader>
            <CardTitle>Aktive Schlüssel ({keys.length})</CardTitle>
            <CardDescription>Alle API-Schlüssel für diesen Workspace</CardDescription>
          </CardHeader>
          <CardContent>
            {keys.length === 0 ? (
              <div className="py-8 text-center">
                <Key className="h-8 w-8 text-titanium-500 mx-auto mb-3" />
                <p className="text-sm text-titanium-400 mb-4">Noch keine API-Schlüssel erstellt</p>
                {isAdmin && (
                  <SovereignButton variant="secondary" size="sm">
                    Ersten Schlüssel erstellen
                  </SovereignButton>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {keys.map(key => (
                  <div key={key.id} className="p-4 border border-titanium/10 rounded-sm hover:border-titanium/20 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-titanium-100">{key.name}</p>
                        <p className="text-xs text-titanium-400 mt-1">Erstellt: {key.createdAt}</p>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(key.id)}
                          className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-sm transition-colors"
                          title="Schlüssel löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="p-3 bg-obsidian rounded-sm border border-titanium/10 flex items-center justify-between group">
                        <code className="font-mono text-xs text-titanium-400 break-all">{key.key}</code>
                        <button
                          onClick={() => copyToClipboard(key.key, key.id)}
                          className="ml-3 shrink-0 text-titanium-400 hover:text-titanium-200 opacity-0 group-hover:opacity-100 transition-all"
                          title="Kopieren"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-titanium-400">Zuletzt verwendet: <span className="text-titanium-300">{key.lastUsed}</span></p>
                          <div className="flex gap-1 mt-2">
                            {key.scopes.map(scope => (
                              <Badge key={scope} variant="secondary" size="sm">
                                {scope}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Documentation */}
        <Card variant="default">
          <CardHeader>
            <CardTitle>API-Dokumentation</CardTitle>
            <CardDescription>Erfahren Sie mehr über unsere REST- und GraphQL-APIs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link to="/api-docs" className="p-4 border border-titanium/10 rounded-sm hover:border-security-blue/50 hover:bg-security-blue/5 transition-colors">
                <h3 className="font-semibold text-titanium-100 mb-1">REST API</h3>
                <p className="text-xs text-titanium-400">Dokumentation und Code-Beispiele</p>
              </Link>
              <Link to="/api-docs" className="p-4 border border-titanium/10 rounded-sm hover:border-security-blue/50 hover:bg-security-blue/5 transition-colors">
                <h3 className="font-semibold text-titanium-100 mb-1">GraphQL</h3>
                <p className="text-xs text-titanium-400">Schema und Spielplatz</p>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Security Best Practices */}
        <Card variant="default" className="border-amber-900/30 bg-amber-950/10">
          <CardHeader>
            <CardTitle className="text-amber-400">Sicherheits-Tipps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="space-y-2 text-sm text-amber-300/90">
              <li className="flex gap-2">
                <span>•</span>
                <span>Teilen Sie API-Schlüssel niemals öffentlich oder in Code-Repositories</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Rotieren Sie Schlüssel regelmäßig (mindestens jährlich)</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Verwenden Sie unterschiedliche Schlüssel für verschiedene Umgebungen</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Überprüfen Sie regelmäßig die letzten Verwendungsdaten</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Löschen Sie sofort nicht verwendete oder kompromittierte Schlüssel</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
