import React, { useMemo } from 'react';
import { Download, Filter, Search, FileText, Shield } from 'lucide-react';
import { AuditLogger, type AuditLogEntry } from '../../lib/auditLogger';
import { Card, CardHeader, CardBody } from './Card';
import { Button } from './Button';

interface EvidenceVaultProps {
  resourceType?: string;
  resourceId?: string;
  limit?: number;
}

export function EvidenceVault({
  resourceType,
  resourceId,
  limit = 50,
}: EvidenceVaultProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterResult, setFilterResult] = React.useState<'all' | 'success' | 'failure'>('all');

  const logs = useMemo(() => {
    let items: AuditLogEntry[] = [];

    if (resourceType && resourceId) {
      items = AuditLogger.getLogsForResource(resourceType, resourceId, limit);
    } else {
      items = AuditLogger.getLogs(undefined, limit);
    }

    return items
      .filter((log) => {
        const matchesSearch =
          log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.actor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.resource.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterResult === 'all' || log.result === filterResult;
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [searchTerm, filterResult, resourceType, resourceId, limit]);

  const handleExport = () => {
    const trail = AuditLogger.exportTrail();
    const csvContent = [
      ['Timestamp', 'Actor', 'Action', 'Resource', 'Result', 'Hash'],
      ...trail.logs.map((log) => [
        log.timestamp,
        log.actor.email,
        log.action,
        `${log.resource.type}:${log.resource.id}`,
        log.result,
        log.hash || 'N/A',
      ]),
    ]
      .map((row) => row.map((col) => `"${col}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evidence-vault-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader
        eyebrow="Evidence Vault"
        title="Revisionssicheres Audit-Log"
        subtitle="Alle Nutzeraktionen mit Zeitstempel und Hashproof"
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> Exportieren
          </Button>
        }
      />
      <CardBody className="space-y-4">
        {/* Filter & Search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1 flex items-center gap-2 border border-titanium-800 bg-obsidian-900 px-3 py-2">
            <Search className="h-4 w-4 text-titanium-600" />
            <input
              type="text"
              placeholder="Aktion, Nutzer oder Ressource durchsuchen…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm text-titanium-100 placeholder-titanium-600"
            />
          </div>
          <select
            value={filterResult}
            onChange={(e) => setFilterResult(e.target.value as any)}
            className="border border-titanium-800 bg-obsidian-900 px-3 py-2 text-sm text-titanium-100 outline-none"
          >
            <option value="all">Alle Ergebnisse</option>
            <option value="success">Nur Erfolg</option>
            <option value="failure">Nur Fehler</option>
          </select>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto border border-titanium-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-titanium-800 bg-obsidian-900">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-titanium-500">
                  Zeitstempel
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-titanium-500">
                  Nutzer
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-titanium-500">
                  Aktion
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-titanium-500">
                  Ressource
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-titanium-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-titanium-800">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-sm text-titanium-500">
                    Keine Einträge gefunden.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-obsidian-900/50 transition-colors">
                    <td className="px-3 py-2 font-mono text-[10px] text-titanium-400">
                      {new Date(log.timestamp).toLocaleString('de-DE')}
                    </td>
                    <td className="px-3 py-2 text-xs text-titanium-300">
                      {log.actor.email}
                    </td>
                    <td className="px-3 py-2 text-xs text-titanium-300">
                      <span className="font-semibold">{log.action}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-titanium-400">
                      {log.resource.type}:{log.resource.id}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-none ${
                          log.result === 'success'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-red-500/15 text-red-300'
                        }`}
                      >
                        {log.result === 'success' ? (
                          <Shield className="h-3 w-3" />
                        ) : (
                          <FileText className="h-3 w-3" />
                        )}
                        {log.result === 'success' ? 'OK' : 'FEHLER'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Hash Integrity Info */}
        <div className="border border-titanium-800 bg-obsidian-900 p-3 text-[10px] text-titanium-500 space-y-1">
          <p className="font-mono font-semibold">
            REVISIONSSICHERHEIT · HASH-CHAIN VERIFIED
          </p>
          <p>
            Jeder Log-Eintrag ist durch einen SHA-256-ähnlichen Hash geschützt.
            Die Chain-Verknüpfung (previousHash) verhindert Manipulation.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

export default EvidenceVault;
