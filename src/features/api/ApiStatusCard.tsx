import { Link } from 'react-router-dom';
import { Key, Lock, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../enterprise-os/components/Card';
import { useApiAccess } from './useApiAccess';

export function ApiStatusCard() {
  const { hasAccess, keysCount, message, loading, error } = useApiAccess();

  if (loading) {
    return (
      <Card data-testid="api-card">
        <CardHeader
          eyebrow="Integration"
          title="API-Zugriff"
          subtitle="Verbinde RealSyncDynamics.AI mit deinen Systemen"
        />
        <CardBody className="flex items-center justify-center gap-2 py-6 text-sm text-titanium-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Wird geladen…
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="api-card">
        <CardHeader
          eyebrow="Integration"
          title="API-Zugriff"
          subtitle="Verbinde RealSyncDynamics.AI mit deinen Systemen"
        />
        <CardBody className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm text-red-300">{error}</div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card data-testid="api-card">
      <CardHeader
        eyebrow="Integration"
        title="API-Zugriff"
        subtitle="Verbinde RealSyncDynamics.AI mit deinen Systemen"
      />
      <CardBody className="space-y-4">
        {/* Status Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${hasAccess ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="text-sm font-semibold text-titanium-100">
              {hasAccess ? 'API-Zugriff aktiv' : 'API nicht verfügbar'}
            </span>
          </div>
          {keysCount > 0 && hasAccess && (
            <span className="text-xs px-2 py-1 bg-security-900/50 border border-security-700 text-security-300 rounded-none">
              {keysCount} Schlüssel
            </span>
          )}
        </div>

        <p className="text-xs text-titanium-400">{message}</p>

        {/* Button Row */}
        <div className="flex flex-wrap gap-2 pt-2">
          {hasAccess ? (
            <>
              {keysCount === 0 ? (
                <Link
                  to="/app/api/setup"
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-security-600 hover:bg-security-500 text-white text-xs font-bold rounded-none transition-colors"
                  data-testid="api-card-generate"
                >
                  <Key className="h-3.5 w-3.5" /> API-Key generieren
                </Link>
              ) : (
                <Link
                  to="/app/settings/api-keys"
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-obsidian-800 hover:bg-obsidian-700 border border-titanium-700 hover:border-security-500 text-titanium-200 text-xs font-bold rounded-none transition-colors"
                  data-testid="api-card-manage"
                >
                  <Key className="h-3.5 w-3.5" /> Verwalten
                </Link>
              )}

              <Link
                to="/app/api/docs"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-obsidian-800 hover:bg-obsidian-700 border border-titanium-700 hover:border-titanium-600 text-titanium-400 text-xs font-bold rounded-none transition-colors"
                data-testid="api-card-docs"
              >
                Dokumentation
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-obsidian-800 hover:bg-obsidian-700 border border-titanium-700 hover:border-security-500 text-titanium-200 text-xs font-bold rounded-none transition-colors"
                data-testid="api-card-upgrade"
              >
                <Lock className="h-3.5 w-3.5" /> Paketdetails
              </Link>

              <Link
                to="/app/api/docs"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-obsidian-800 hover:bg-obsidian-700 border border-titanium-700 hover:border-titanium-600 text-titanium-400 text-xs font-bold rounded-none transition-colors"
                data-testid="api-card-docs"
              >
                Mehr erfahren
              </Link>
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
